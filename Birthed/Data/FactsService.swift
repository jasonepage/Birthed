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

    /// The facts for whatever calendar date the Today tab is showing, kept
    /// apart from the reader's own because that tab walks from date to date
    /// and the two lists are never the same thing.
    private(set) var dayFacts: [BirthFact] = []

    /// Which date `dayFacts` belongs to.
    ///
    /// Two jobs, both of which were bugs without it. A failed request can tell
    /// "still the same date, so keep showing what we already had" from "new
    /// date, and we have nothing for it yet". And a slow answer for September 5
    /// that lands after the reader has already pressed on to September 6 can be
    /// recognised as stale and dropped, instead of putting one date's facts
    /// under another date's heading.
    private var dayFactsDate: CalendarDate?

    /// What deals the order of facts nobody has voted on. New on every load
    /// and on every change of date, never on a poll, so the list is stable
    /// while it is on screen and different the next time it is opened. See
    /// `FactOrder`.
    private var ownSalt: UInt64 = FactOrder.newSalt()
    private var daySalt: UInt64 = FactOrder.newSalt()

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
        // A fresh deal every time the reader comes back, so the row set large
        // is not the same row every day, and no fact earns likes by position.
        ownSalt = FactOrder.newSalt()

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
        let found = await fetch(
            month: profile.birthday.date.month,
            day: profile.birthday.date.day,
            year: profile.birthday.year ?? 0,
            regionKey: Self.regionKey(profile.regionCode)
        )
        if let found { facts = FactOrder.order(found, salt: ownSalt) }
    }

    /// The facts for one calendar date, with no year and no region.
    ///
    /// This reads and never asks. The Today tab walks from date to date, and
    /// a search costs real money per date, so a reader flicking through a
    /// month must not be able to spend a month of them. Dates that have never
    /// been searched simply have no section here; they are filled by the
    /// backfill, or by the first reader whose own birthday that is.
    func readDay(month: Int, day: Int) async {
        guard let date = CalendarDate(month: month, day: day) else { return }

        // Moving to a different date clears immediately, because the facts on
        // screen belong to the date the reader just left.
        if dayFactsDate != date {
            dayFacts = []
            dayFactsDate = date
            daySalt = FactOrder.newSalt()
        }

        // A nil answer is the request failing, which is not the same as a date
        // with nothing on it, so nothing is thrown away over a dropped
        // connection. This is the distinction `fetch` exists to make and the
        // first version of this line ignored it.
        guard let found = await fetch(month: month, day: day, year: 0, regionKey: "") else { return }
        guard dayFactsDate == date else { return }
        dayFacts = FactOrder.order(found, salt: daySalt)
    }

    /// One read, whatever is asking. Nil means the request itself failed,
    /// which is not the same as a date with nothing on it, so a caller can
    /// keep showing what it already had.
    private func fetch(month: Int, day: Int, year: Int, regionKey key: String) async -> [BirthFact]? {
        let regionList = key.isEmpty ? "(\"\")" : "(\"\",\"\(key)\")"
        var components = URLComponents(url: baseURL.appending(path: "rest/v1/birth_facts"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "select", value: "id,fact,category,source_url,region_key,birth_fact_likes(count)"),
            URLQueryItem(name: "birth_month", value: "eq.\(month)"),
            URLQueryItem(name: "birth_day", value: "eq.\(day)"),
            URLQueryItem(name: "birth_year", value: "eq.\(year)"),
            URLQueryItem(name: "region_key", value: "in.\(regionList)"),
            URLQueryItem(name: "verified", value: "eq.true"),
            URLQueryItem(name: "order", value: "id.asc"),
        ]
        guard let url = components?.url else { return nil }
        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 15

        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let rows = try? JSONDecoder().decode([FactRow].self, from: data)
        else { return nil }

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
        // Unordered. The callers deal the order with `FactOrder` and a salt
        // they own, because which salt applies depends on which list this is.
        return loaded
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

    // MARK: What readers do with them

    /// Facts that have been on screen and are waiting to be counted.
    private var pendingSeen: Set<Int> = []

    /// One fact was rendered in a list somebody opened.
    ///
    /// Held rather than sent, because a screen of ten facts would otherwise be
    /// ten requests. Note what this is honestly: it counts a fact being in a
    /// list that was drawn, not a pair of eyes on it. That is enough to be a
    /// denominator, which is the whole job. Without one, a like is a raw count
    /// and a fact shown to fifty people beats a better fact shown to five.
    func noteSeen(_ id: Int) {
        pendingSeen.insert(id)
    }

    /// Sends what has been seen. Called when a screen goes away or the app does.
    func flushSeen() async {
        guard !pendingSeen.isEmpty else { return }
        let batch = Array(pendingSeen.prefix(60))
        pendingSeen.subtract(batch)
        await record(seen: batch, shared: [])
    }

    /// The reader opened the share sheet on this fact.
    ///
    /// Not a completed send. iOS does not tell an app whether anything was
    /// actually sent, so the column is named `share_opens` for what is really
    /// observed. Even so this is the strongest signal the app has: a thumbs up
    /// costs a tap and making a card costs real effort, and it is the exact
    /// behaviour the whole distribution plan runs on.
    func recordShareOpen(_ id: Int) async {
        await record(seen: [], shared: [id])
    }

    private func record(seen: [Int], shared: [Int]) async {
        guard !seen.isEmpty || !shared.isEmpty else { return }
        var request = URLRequest(url: baseURL.appending(path: "rest/v1/rpc/record_fact_events"))
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["seen": seen, "shared": shared])
        request.timeoutInterval = 10
        // Counting is never worth interrupting anything for, so a failure here
        // is dropped rather than retried or surfaced.
        _ = try? await session.data(for: request)
    }

    /// A thumbs up, or taking it back. Optimistic: the count moves at once
    /// and the server is told after.
    func toggleLike(_ fact: BirthFact) async {
        let liking = !fact.likedByMe
        // The same fact can be on screen in two places at once, on the reader's
        // own day and on the Today tab showing that same date, so both lists
        // are moved rather than whichever one happened to be tapped.
        var known = false
        for index in facts.indices where facts[index].id == fact.id {
            facts[index].likedByMe = liking
            facts[index].likes += liking ? 1 : -1
            known = true
        }
        for index in dayFacts.indices where dayFacts[index].id == fact.id {
            dayFacts[index].likedByMe = liking
            dayFacts[index].likes += liking ? 1 : -1
            known = true
        }
        guard known else { return }

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
