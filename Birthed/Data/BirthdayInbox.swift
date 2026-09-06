import Foundation
import Observation

/// The queue of birthdays somebody sent you, and the link that asks for them.
///
/// Two calls and nothing clever. `link` makes sure this phone has a live code
/// and hands back the address to share; `collect` reads whatever has arrived
/// against every code this account owns and deletes each one as soon as it has
/// been dealt with.
///
/// There is no push notification here and there is not going to be. A birthday
/// is at worst a year away, so collecting on foreground is soon enough, and it
/// means Birthed still has no server that can send anything to anybody's
/// phone. The privacy page says that, and this is the feature that would have
/// quietly made it untrue.
///
/// Everything here needs a signed in account, because the read is nothing but
/// a row level security policy: the server returns the replies to codes whose
/// owner is you, and returns an empty list to everybody else, including to the
/// anonymous key this app ships with. If the account is not available the
/// inbox does nothing and says nothing, which is the same way the rest of the
/// app treats a missing account.
@Observable
final class BirthdayInbox {
    /// One birthday, waiting to be confirmed.
    struct Arrival: Identifiable, Equatable {
        let id: Int
        let name: String
        let birthday: CalendarBirthday

        /// The same shape a tapped link produces, so both routes are confirmed
        /// through the same sheet and there is one place where a birthday
        /// enters the people list.
        var incoming: PersonLink.Incoming {
            PersonLink.Incoming(name: name, birthday: birthday)
        }
    }

    private(set) var arrivals: [Arrival] = []

    /// Put aside for now, in memory only. Somebody who taps "Not now" should
    /// not be asked again three seconds later, and should be asked again next
    /// time they open the app, and forgetting on relaunch is exactly that.
    private var setAside: Set<Int> = []

    /// The next one to show, or nil when there is nothing to ask about.
    var next: Arrival? { arrivals.first { !setAside.contains($0.id) } }

    private let account: AccountService
    private let baseURL: URL
    private let anonKey: String
    private let session: URLSession
    private let defaults: UserDefaults

    private enum Key {
        static let code = "birthday.request.code"
    }

    init(account: AccountService,
         baseURL: URL = Secrets.supabaseURL,
         anonKey: String = Secrets.supabaseAnonKey,
         session: URLSession = .shared,
         defaults: UserDefaults = .standard) {
        self.account = account
        self.baseURL = baseURL
        self.anonKey = anonKey
        self.session = session
        self.defaults = defaults
    }

    // MARK: Asking

    /// The link to put in a group chat, or nil when there is no account to
    /// hang it on.
    ///
    /// The same code every time. A person who has already sent their link to
    /// six people should not find that the seventh gets a different one, and
    /// the row is rewritten on every share, which pushes the expiry out. So a
    /// link keeps working for as long as its owner keeps offering it, and
    /// stops working a fortnight after they stop.
    func link(from name: String? = nil) async -> URL? {
        guard let token = await account.freshAccessToken(),
              let userID = account.userID
        else { return nil }

        let code = defaults.string(forKey: Key.code).flatMap {
            BirthdayRequest.isWellFormed($0) ? $0 : nil
        } ?? BirthdayRequest.newCode()

        var request = URLRequest(url: baseURL.appending(path: "rest/v1/birthday_requests"))
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // An upsert, so sharing twice extends the code rather than failing on
        // the primary key. The expiry the server actually stores is whatever
        // its own ceiling allows, not whatever is written here.
        request.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "code": code,
            "owner_id": userID,
        ])
        request.timeoutInterval = 15

        guard let (_, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode)
        else { return nil }

        defaults.set(code, forKey: Key.code)
        return BirthdayRequest.url(code: code, from: name)
    }

    // MARK: Collecting

    private struct ReplyRow: Decodable {
        let id: Int
        let name: String
        let birth_month: Int
        let birth_day: Int
        let birth_year: Int?
    }

    /// Everything waiting, oldest first. Safe to call on every foreground:
    /// with an empty inbox it is one request that answers with two characters.
    func collect() async {
        guard let token = await account.freshAccessToken() else { return }

        var components = URLComponents(
            url: baseURL.appending(path: "rest/v1/birthday_replies"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "select", value: "id,name,birth_month,birth_day,birth_year"),
            URLQueryItem(name: "order", value: "id.asc"),
            URLQueryItem(name: "limit", value: "100"),
        ]
        guard let url = components?.url else { return }

        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode),
              let rows = try? JSONDecoder().decode([ReplyRow].self, from: data)
        else { return }

        arrivals = rows.compactMap { row in
            guard let birthday = CalendarBirthday(
                month: row.birth_month, day: row.birth_day, year: row.birth_year
            ) else { return nil }
            let name = row.name.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !name.isEmpty else { return nil }
            return Arrival(id: row.id, name: name, birthday: birthday)
        }
    }

    /// Dealt with: gone from the list here and gone from the server.
    ///
    /// The local removal happens first and does not wait for the delete. A
    /// failed delete means the row is offered again on a later launch, which
    /// is a repeat question rather than a lost birthday, and that is the right
    /// way round for something whose whole job is not losing them.
    func clear(id: Int) {
        arrivals.removeAll { $0.id == id }
        setAside.remove(id)
        Task { await delete(id) }
    }

    /// Asked about once. Stays on the server, stops being offered until the
    /// next launch.
    ///
    /// Called the moment something is put in front of the reader rather than
    /// when they decline it, which is the only way to be sure. A sheet that is
    /// dismissed reports nothing about why, so an inbox that waited for a
    /// decision would present the same birthday again the instant the sheet
    /// closed, forever.
    func putAside(id: Int) {
        setAside.insert(id)
    }

    private func delete(_ id: Int) async {
        guard let token = await account.freshAccessToken() else { return }
        var components = URLComponents(
            url: baseURL.appending(path: "rest/v1/birthday_replies"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "id", value: "eq.\(id)")]
        guard let url = components?.url else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15
        _ = try? await session.data(for: request)
    }
}
