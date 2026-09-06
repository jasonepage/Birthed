import Foundation
import Observation

/// Asks for the facts about one birth date, and reads them back.
///
/// The search runs on the server and takes tens of seconds the first time a
/// date is asked about, so this is two calls: one to ask, which answers at
/// once with whatever is already there and whether a search is under way,
/// and one to read, which the interface repeats while a search is running.
///
/// The date, the year and the region are what is sent. Nothing that
/// identifies the person goes with them. The privacy page says so.
@Observable
final class FactsService {
    enum Status: Equatable {
        case idle
        case searching
        case done
        case failed
    }

    private(set) var facts: [BirthFact] = []
    private(set) var status: Status = .idle

    private let baseURL: URL
    private let anonKey: String
    private let session: URLSession
    private let account: AccountService

    init(account: AccountService,
         baseURL: URL = Secrets.supabaseURL,
         anonKey: String = Secrets.supabaseAnonKey,
         session: URLSession = .shared) {
        self.account = account
        self.baseURL = baseURL
        self.anonKey = anonKey
        self.session = session
    }

    /// The same normalisation the server applies, so the read matches the
    /// write: lower case, letters and digits only, single spaces, 60 at most.
    static func regionKey(_ region: String?) -> String {
        guard let region else { return "" }
        let pieces = region.lowercased()
            .split(whereSeparator: { !($0.isLetter || $0.isNumber) })
            .map(String.init)
        return String(pieces.joined(separator: " ").prefix(60))
    }

    private struct AskResponse: Decodable {
        let status: String
    }

    private struct FactRow: Decodable {
        struct LikeCount: Decodable { let count: Int }
        let id: Int
        let fact: String
        let category: String
        let source_url: String
        let region_key: String
        let birth_fact_likes: [LikeCount]
    }

    private struct LikeRow: Decodable { let fact_id: Int }

    /// Asks the server to look, then reads what is there, then keeps reading
    /// every few seconds while the search runs, for up to two minutes.
    func load(for profile: Profile) async {
        let token = await account.freshAccessToken() ?? anonKey
        status = .searching

        var request = URLRequest(url: baseURL.appending(path: "functions/v1/find-facts"))
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body: [String: Any] = [
            "month": profile.birthday.date.month,
            "day": profile.birthday.date.day,
        ]
        if let year = profile.birthday.year { body["year"] = year }
        if let region = profile.regionCode, !region.trimmingCharacters(in: .whitespaces).isEmpty {
            body["region"] = region
        }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 20

        var searching = false
        if let (data, response) = try? await session.data(for: request),
           let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
           let decoded = try? JSONDecoder().decode(AskResponse.self, from: data) {
            searching = decoded.status == "started" || decoded.status == "running"
        } else {
            status = .failed
        }

        await read(for: profile)
        guard searching else {
            if status != .failed { status = .done }
            return
        }

        // Poll. The search usually lands inside a minute.
        for _ in 0..<15 {
            try? await Task.sleep(for: .seconds(8))
            guard !Task.isCancelled else { return }
            let before = facts.count
            await read(for: profile)
            if facts.count > before { break }
        }
        status = .done
    }

    /// Everything on the table for this date, most liked first.
    func read(for profile: Profile) async {
        let key = Self.regionKey(profile.regionCode)
        let regionList = key.isEmpty ? "(\"\")" : "(\"\",\"\(key)\")"
        var components = URLComponents(url: baseURL.appending(path: "rest/v1/birth_facts"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "select", value: "id,fact,category,source_url,region_key,birth_fact_likes(count)"),
            URLQueryItem(name: "birth_month", value: "eq.\(profile.birthday.date.month)"),
            URLQueryItem(name: "birth_day", value: "eq.\(profile.birthday.date.day)"),
            URLQueryItem(name: "birth_year", value: "eq.\(profile.birthday.year ?? 0)"),
            URLQueryItem(name: "region_key", value: "in.\(regionList)"),
            URLQueryItem(name: "verified", value: "eq.true"),
            URLQueryItem(name: "order", value: "id.asc"),
        ]
        guard let url = components?.url else { return }
        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 15

        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let rows = try? JSONDecoder().decode([FactRow].self, from: data)
        else { return }

        let mine = await likedByMe()
        let loaded = rows.map { row in
            BirthFact(
                id: row.id,
                fact: row.fact,
                category: row.category,
                sourceURL: URL(string: row.source_url),
                regionKey: row.region_key,
                likes: row.birth_fact_likes.first?.count ?? 0,
                likedByMe: mine.contains(row.id)
            )
        }
        // Most liked first, then the order they were found in, which keeps
        // the list stable for a date nobody has voted on yet.
        facts = loaded.sorted { ($0.likes, -$0.id) > ($1.likes, -$1.id) }
    }

    private func likedByMe() async -> Set<Int> {
        guard let userID = account.userID, let token = await account.freshAccessToken() else { return [] }
        var components = URLComponents(url: baseURL.appending(path: "rest/v1/birth_fact_likes"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "select", value: "fact_id"),
            URLQueryItem(name: "user_id", value: "eq.\(userID)"),
        ]
        guard let url = components?.url else { return [] }
        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15
        guard let (data, _) = try? await session.data(for: request),
              let rows = try? JSONDecoder().decode([LikeRow].self, from: data) else { return [] }
        return Set(rows.map(\.fact_id))
    }

    /// A thumbs up, or taking it back. Optimistic: the count moves at once
    /// and the server is told after.
    func toggleLike(_ fact: BirthFact) async {
        guard let index = facts.firstIndex(of: fact) else { return }
        let liking = !fact.likedByMe
        facts[index].likedByMe = liking
        facts[index].likes += liking ? 1 : -1

        guard let userID = account.userID, let token = await account.freshAccessToken() else { return }
        var request: URLRequest
        if liking {
            request = URLRequest(url: baseURL.appending(path: "rest/v1/birth_fact_likes"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
            request.httpBody = try? JSONSerialization.data(withJSONObject: ["fact_id": fact.id, "user_id": userID])
        } else {
            var components = URLComponents(url: baseURL.appending(path: "rest/v1/birth_fact_likes"), resolvingAgainstBaseURL: false)
            components?.queryItems = [
                URLQueryItem(name: "fact_id", value: "eq.\(fact.id)"),
                URLQueryItem(name: "user_id", value: "eq.\(userID)"),
            ]
            guard let url = components?.url else { return }
            request = URLRequest(url: url)
            request.httpMethod = "DELETE"
        }
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15
        _ = try? await session.data(for: request)
    }
}
