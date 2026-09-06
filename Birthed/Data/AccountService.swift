import Foundation
import Observation

/// The silent anonymous account.
///
/// `FR-010`: created on first launch with no screen and no user action.
/// `FR-011`: when it cannot be created the app carries on regardless, keeps
/// the profile locally, and tries again on the next launch and the next
/// foreground. `FR-013`: there is no sign-in wall in front of anything, ever.
@Observable
final class AccountService {
    enum State: Equatable {
        case unknown
        case signedIn(userID: String)
        case unavailable(reason: String)
    }

    private enum Key {
        static let accessToken = "access_token"
        static let refreshToken = "refresh_token"
        static let userID = "user_id"
    }

    private(set) var state: State = .unknown

    private let baseURL: URL
    private let anonKey: String
    private let session: URLSession

    init(baseURL: URL = Secrets.supabaseURL,
         anonKey: String = Secrets.supabaseAnonKey,
         session: URLSession = .shared) {
        self.baseURL = baseURL
        self.anonKey = anonKey
        self.session = session
        if let existing = Keychain.get(Key.userID) {
            self.state = .signedIn(userID: existing)
        }
    }

    var accessToken: String? { Keychain.get(Key.accessToken) }
    var userID: String? {
        if case let .signedIn(id) = state { return id }
        return nil
    }

    private struct RefreshResponse: Decodable {
        let access_token: String?
        let refresh_token: String?
    }

    /// Seconds until the stored access token expires, read from its own
    /// payload. A JSON web token is three base64 parts and the middle one
    /// carries `exp`. Nothing is verified here; the server does that. This
    /// only decides whether to refresh before asking.
    private func secondsUntilExpiry(of token: String) -> TimeInterval? {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return nil }
        var payload = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while payload.count % 4 != 0 { payload += "=" }
        guard let data = Data(base64Encoded: payload),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let exp = object["exp"] as? TimeInterval
        else { return nil }
        return exp - Date().timeIntervalSince1970
    }

    /// An access token that will still be valid for the next minute, refreshed
    /// through the refresh token when the stored one is about to expire.
    ///
    /// Access tokens last an hour. Without this, everything that carries the
    /// user's token, the profile push, the likes, the account deletion, stops
    /// working an hour after first launch on a phone that stays open, and
    /// nothing says so.
    func freshAccessToken() async -> String? {
        guard let token = accessToken else { return nil }
        if let remaining = secondsUntilExpiry(of: token), remaining > 60 { return token }
        guard let refresh = Keychain.get(Key.refreshToken) else { return token }

        var components = URLComponents(url: baseURL.appending(path: "auth/v1/token"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        guard let url = components?.url else { return token }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": refresh])
        request.timeoutInterval = 15

        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let decoded = try? JSONDecoder().decode(RefreshResponse.self, from: data),
              let newToken = decoded.access_token
        else { return token }
        Keychain.set(newToken, for: Key.accessToken)
        if let newRefresh = decoded.refresh_token { Keychain.set(newRefresh, for: Key.refreshToken) }
        return newToken
    }

    private struct SignUpResponse: Decodable {
        struct User: Decodable { let id: String }
        let access_token: String?
        let refresh_token: String?
        let user: User?
    }

    /// Safe to call on every launch and every foreground. Does nothing when an
    /// account already exists.
    func ensureAccount() async {
        if case .signedIn = state { return }

        var request = URLRequest(url: baseURL.appending(path: "auth/v1/signup"))
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data("{}".utf8)
        request.timeoutInterval = 15

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                state = .unavailable(reason: "The server sent an unreadable answer.")
                return
            }
            guard (200..<300).contains(http.statusCode) else {
                // 422 with anonymous_provider_disabled means the Anonymous
                // provider is switched off in the Supabase dashboard. The app
                // still works; nothing syncs until it is on.
                state = .unavailable(reason: "Sign in is not available right now (\(http.statusCode)).")
                return
            }
            let decoded = try JSONDecoder().decode(SignUpResponse.self, from: data)
            guard let userID = decoded.user?.id, let token = decoded.access_token else {
                state = .unavailable(reason: "The server did not return an account.")
                return
            }
            Keychain.set(userID, for: Key.userID)
            Keychain.set(token, for: Key.accessToken)
            if let refresh = decoded.refresh_token {
                Keychain.set(refresh, for: Key.refreshToken)
            }
            state = .signedIn(userID: userID)
        } catch {
            state = .unavailable(reason: "No connection, so the account has not been created yet.")
        }
    }

    /// Mirrors the local profile onto the server. Failure is not an error the
    /// user needs to see: the local copy is what the interface reads.
    @discardableResult
    func pushProfile(_ profile: Profile) async -> Bool {
        guard case let .signedIn(userID) = state, let token = await freshAccessToken() else { return false }

        var body: [String: Any] = [
            "id": userID,
            "profile_type": "HUMAN",
            "birth_month": profile.birthday.date.month,
            "birth_day": profile.birthday.date.day,
            "leap_observance": profile.birthday.leapObservance.rawValue,
        ]
        if let year = profile.birthday.year {
            body["birth_year"] = year
        }
        if let region = profile.regionCode?.trimmingCharacters(in: .whitespaces), !region.isEmpty {
            body["region_code"] = region
        }

        var components = URLComponents(
            url: baseURL.appending(path: "rest/v1/profiles"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "on_conflict", value: "id")]
        guard let url = components?.url else { return false }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 15

        guard let (_, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse else { return false }
        return (200..<300).contains(http.statusCode)
    }

    /// `FR-014`. The row cascade and the auth user both go, which needs the
    /// service role, so it runs in an Edge Function rather than here.
    func deleteEverything() async throws {
        if let token = await freshAccessToken() {
            var request = URLRequest(url: baseURL.appending(path: "functions/v1/delete-account"))
            request.httpMethod = "POST"
            request.setValue(anonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.timeoutInterval = 20
            _ = try? await session.data(for: request)
        }
        Keychain.remove(Key.accessToken)
        Keychain.remove(Key.refreshToken)
        Keychain.remove(Key.userID)
        state = .unknown
    }
}
