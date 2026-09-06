import Foundation
import Observation

/// Which of the world-when-you-arrived subjects readers care about.
///
/// The like is on the subject and never on the sentence. A found fact is one
/// row per date, so everybody born September 4 likes the same object and the
/// five vote floor means something. A world line is computed from the reader's
/// birth year, so "you are 6 years older than Minecraft" exists only for people
/// born in one year and its identity in the code is the subject plus that
/// sentence. Likes on it could never aggregate and would show zero forever,
/// which is exactly why `docs/first-five-minutes.md` shelved likes.
///
/// On the subject they aggregate across every reader whatever their year, and
/// they answer the question actually being asked: which of these lines should
/// there be more of. That is why this is worth building before there are users
/// and most of today's ideas are not. It costs nothing to gather and it starts
/// counting from the first tester.
///
/// The key is the line's kicker in lower case. That is already the stable
/// handle in this product: `MyDayView` stores the reader's preferred lead line
/// by kicker, because position moves when a timeline is extended and the
/// sentence changes on the reader's next birthday.
@Observable
final class WorldLikesService {

    /// Totals by subject. Missing means zero, or not loaded yet, and the
    /// interface treats both the same way because it shows neither.
    private(set) var counts: [String: Int] = [:]

    /// The subjects this account has liked.
    private(set) var mine: Set<String> = []

    /// Below this, no number is shown at all.
    ///
    /// The same five `FactOrder` uses and for the same reason: the first row
    /// is seen most, so it collects the likes, so it stays first, and a number
    /// that reads zero on every row teaches a reader that nobody is here. A
    /// heart with no number beside it is one quiet control. A heart with a
    /// zero beside it is a report.
    static let floor = 5

    private let account: AccountService
    private let baseURL: URL
    private let anonKey: String
    private let session: URLSession

    init(account: AccountService,
         baseURL: URL = Secrets.supabaseURL,
         anonKey: String = Secrets.supabaseAnonKey,
         session: URLSession = .shared) {
        self.account = account
        self.baseURL = baseURL
        self.anonKey = anonKey
        self.session = session
    }

    /// The subject key for a line. Its kicker, lowercased.
    static func subject(for line: WorldThen.Line) -> String {
        line.kicker.lowercased()
    }

    /// What to show next to a subject, or nothing.
    ///
    /// Nothing below the floor, which is most of the time for a while, and
    /// that is the intended state rather than a failure to load.
    func displayCount(for subject: String) -> Int? {
        guard let count = counts[subject], count >= Self.floor else { return nil }
        return count
    }

    func isLiked(_ subject: String) -> Bool { mine.contains(subject) }

    // MARK: Reading

    private struct CountRow: Decodable {
        let subject: String
        let likes: Int
    }

    private struct MineRow: Decodable {
        let subject: String
    }

    /// Both halves in one call, and neither of them load bearing. A failure
    /// leaves the section exactly as it was: hearts that are not filled in and
    /// no numbers, which is also what a brand new account correctly sees.
    func load() async {
        async let totals: Void = loadCounts()
        async let liked: Void = loadMine()
        _ = await (totals, liked)
    }

    private func loadCounts() async {
        var components = URLComponents(
            url: baseURL.appending(path: "rest/v1/world_subject_like_counts"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "select", value: "subject,likes")]
        guard let url = components?.url else { return }

        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        if let token = await account.freshAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.timeoutInterval = 15

        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let rows = try? JSONDecoder().decode([CountRow].self, from: data)
        else { return }

        var next: [String: Int] = [:]
        for row in rows { next[row.subject] = row.likes }
        counts = next
    }

    private func loadMine() async {
        guard let userID = account.userID, let token = await account.freshAccessToken() else { return }
        var components = URLComponents(
            url: baseURL.appending(path: "rest/v1/world_subject_likes"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "select", value: "subject"),
            URLQueryItem(name: "user_id", value: "eq.\(userID)"),
        ]
        guard let url = components?.url else { return }

        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let rows = try? JSONDecoder().decode([MineRow].self, from: data)
        else { return }

        mine = Set(rows.map(\.subject))
    }

    // MARK: Writing

    /// Moved on screen first and sent afterwards, the same way the fact likes
    /// work. A tap that waits for a server before it does anything reads as a
    /// broken control, and the worst case here is a heart that is filled in on
    /// one phone and not counted, which nobody can see and nothing depends on.
    func toggle(_ subject: String) async {
        let liking = !mine.contains(subject)
        if liking {
            mine.insert(subject)
            counts[subject] = (counts[subject] ?? 0) + 1
        } else {
            mine.remove(subject)
            counts[subject] = max((counts[subject] ?? 1) - 1, 0)
        }

        guard let userID = account.userID, let token = await account.freshAccessToken() else { return }

        var request: URLRequest
        if liking {
            request = URLRequest(url: baseURL.appending(path: "rest/v1/world_subject_likes"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            // Tapping twice quickly must not be an error, and the row is the
            // same row either way.
            request.setValue("return=minimal,resolution=ignore-duplicates", forHTTPHeaderField: "Prefer")
            request.httpBody = try? JSONSerialization.data(
                withJSONObject: ["subject": subject, "user_id": userID]
            )
        } else {
            var components = URLComponents(
                url: baseURL.appending(path: "rest/v1/world_subject_likes"),
                resolvingAgainstBaseURL: false
            )
            components?.queryItems = [
                URLQueryItem(name: "subject", value: "eq.\(subject)"),
                URLQueryItem(name: "user_id", value: "eq.\(userID)"),
            ]
            guard let url = components?.url else { return }
            request = URLRequest(url: url)
            request.httpMethod = "DELETE"
            request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        }

        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15
        _ = try? await session.data(for: request)
    }
}
