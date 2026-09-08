import Foundation
import Observation
import Security

/// The remembering loop, as the app performs it.
///
/// Modelled on `WorldLikesService`, and different from it in three ways that
/// are all deliberate.
///
/// **It needs no account.** Every function it calls is granted to `anon`, so
/// remembering works on a phone whose anonymous account has not been created
/// yet, which `FR-011` says is a state the app must carry on through, and it
/// keeps `FR-013` literally true: there is no sign in wall in front of this,
/// not even the silent one.
///
/// **The token is not the account.** The database file promises that the token
/// "is not an account, not an address, not a fingerprint" and "says nothing
/// about who they are". The account's user id would have been easier and it
/// would have broken that promise, because it joins straight to the profile
/// row, which holds a birth date, a region and four counts. So this keeps its
/// own random value in the keychain instead. It is stable per install and not
/// guessable, which is all the database asks of it, and it is joinable to
/// nothing.
///
/// **Nothing is shown to somebody who has not answered yet. Everything is
/// shown the moment they do.**
///
/// The first version of this hid the counts on an open date from everybody,
/// and that was half right and half wrong in a way worth writing down. The
/// half that is right: a number on screen in front of a reader who has not
/// answered tells them what the popular answer is, and an answer given after
/// reading that is agreement rather than memory, which quietly destroys the
/// one measurement this exists to take.
///
/// The half that was wrong: it hid the counts from people who had already
/// answered too, and those people cannot be biased any more, because they have
/// already committed. So the reader got nothing back at all, and a page that
/// takes an answer and says nothing is a form rather than a thing worth
/// opening. The count is now gated on having answered that row, which protects
/// the measurement exactly as well and pays the reader immediately.
///
/// **There are no points, no streaks, no badges and no leaderboard**, and
/// there is no place in this file where one could be added by accident. An
/// answer earns nothing. If it earned status people would answer for status,
/// and if "I was there" outranked "never heard of it" then everybody was
/// there and the signal is worthless. The only pressure on an answer is that
/// the date closes.
///
/// **A remembrance is not analytics.** It is content the reader deliberately
/// contributed, by pressing a button that says what it will do. There is still
/// no event stream, no timing, no screen name and no device identifier beyond
/// the keychain value below. `Tally` explains the stance and it is unchanged.
@Observable
final class RememberService {

    // MARK: What the screen reads

    /// This date's edition, once it has been asked for. Nil while loading, and
    /// nil for a date that nobody has answered yet, which are different things
    /// the interface happens to draw the same way.
    private(set) var edition: Edition?

    /// The counts per row, for the newest edition of the date being shown.
    ///
    /// Always loaded. Whether a given row's counts may be drawn is decided by
    /// `tally(for:month:day:)` and not by whether they were fetched, because
    /// two readers on the same page are allowed to see different things: the
    /// one who has answered may see the result and the one who has not may
    /// not.
    private(set) var counts: [String: RemembranceCounts] = [:]

    /// Every edition's counts, newest year first, for the day a second edition
    /// exists and this page can show 2026 beside 2027.
    private(set) var byYear: [Int: [String: RemembranceCounts]] = [:]

    /// How many answers this reader has left on the date being shown.
    ///
    /// Nil until it has been read, and the interface shows nothing rather than
    /// guessing. The number is the reader's own and says nothing about
    /// anybody else: it is the only figure this feature puts on screen before
    /// a date has sealed, and it cannot leak what anybody answered.
    private(set) var answersLeft: Int?

    /// How many days either side of a date take answers, read from the
    /// database rather than assumed, because it is a column exactly so that
    /// widening it is an update and not a new build of this app.
    private(set) var windowDays: Int = 1

    /// What this account has already answered, so the interface can show it
    /// back. Held on the phone because `remembrances` is closed to every
    /// client and always will be: only an admin can read that table, so there
    /// is nothing to ask the server for.
    private(set) var mine: [String: RememberDepth] = [:]

    /// Set when an answer was refused because the date had already sealed, so
    /// the page can say so once rather than failing quietly.
    private(set) var refusedAsSealed = false

    /// Set when an answer was refused because this reader has spent their ten
    /// on this date.
    private(set) var outOfAnswers = false

    /// One edition of one date.
    struct Edition: Equatable {
        let year: Int
        let openedAt: Date?
        let closesAt: Date?
        let sealedAt: Date?
        /// Separate people, counted in the database and never itemised.
        let people: Int
        /// Answers, which is a larger number: one person can answer many rows.
        let answers: Int

        var isSealed: Bool { sealedAt != nil }
    }

    // MARK: Setting up

    private let baseURL: URL
    private let anonKey: String
    private let session: URLSession
    private let defaults: UserDefaults

    /// Where this account's own answers are kept between launches.
    private static let mineKey = "birthed.remember.mine"
    /// The keychain account name for the token. Not the auth user id: see the
    /// header.
    private static let tokenKey = "remember_token"

    init(baseURL: URL = Secrets.supabaseURL,
         anonKey: String = Secrets.supabaseAnonKey,
         session: URLSession = .shared,
         defaults: UserDefaults = .standard) {
        self.baseURL = baseURL
        self.anonKey = anonKey
        self.session = session
        self.defaults = defaults
        self.mine = Self.readMine(from: defaults)
    }

    /// The value the database is given so that one person cannot answer the
    /// same row twice.
    ///
    /// Made once, on first use, and kept in the keychain rather than in
    /// `UserDefaults`, which is readable from a file backup. Thirty two
    /// hexadecimal characters, so it is comfortably over the sixteen the
    /// database refuses below and there is no chance of two phones agreeing by
    /// accident. Deleting the app takes it with everything else, which is
    /// correct: the privacy page says deleting the app removes everything.
    var voterToken: String {
        if let existing = Keychain.get(Self.tokenKey), existing.count >= 16 {
            return existing
        }
        var bytes = [UInt8](repeating: 0, count: 16)
        // A failure here is not survivable as silence, because a predictable
        // token would let one phone overwrite another's answers, so the
        // fallback is still random rather than a constant.
        if SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) != errSecSuccess {
            bytes = (0..<16).map { _ in UInt8.random(in: 0...255) }
        }
        let token = bytes.map { String(format: "%02x", $0) }.joined()
        Keychain.set(token, for: Self.tokenKey)
        return token
    }

    // MARK: What this account has answered

    private static func readMine(from defaults: UserDefaults) -> [String: RememberDepth] {
        guard let stored = defaults.dictionary(forKey: mineKey) as? [String: String] else { return [:] }
        return stored.compactMapValues { RememberDepth(rawValue: $0) }
    }

    private func writeMine() {
        defaults.set(mine.mapValues(\.rawValue), forKey: Self.mineKey)
    }

    /// The key an answer is filed under on this phone.
    ///
    /// The edition year is part of it, because the same date reopens next year
    /// on top of this one and answering September 8 in 2026 must not make the
    /// 2027 buttons look already pressed. That is the entire feature: the
    /// difference between the two editions is the measurement.
    private func localKey(_ subject: RememberSubject, month: Int, day: Int, year: Int) -> String {
        "\(year)-\(month)-\(day):\(subject.key)"
    }

    /// What this account answered about a row, or nil.
    func answer(for subject: RememberSubject, month: Int, day: Int,
                year: Int = RememberWindow.editionYear()) -> RememberDepth? {
        mine[localKey(subject, month: month, day: day, year: year)]
    }

    /// Whether to draw the four buttons at all.
    ///
    /// Worked out with the database's own arithmetic, in Coordinated Universal
    /// Time, so the buttons disappear at the moment the date really seals
    /// rather than staying for another seven hours and being refused. See
    /// `RememberWindow`.
    func isOpen(month: Int, day: Int, now: Date = Date()) -> Bool {
        if let edition, edition.isSealed { return false }
        return RememberWindow.isOpen(month: month, day: day, windowDays: windowDays, now: now)
    }

    // MARK: Reading

    private struct SettingsRow: Decodable { let window_days: Int }

    private struct SummaryRow: Decodable {
        let edition_year: Int
        let opened_at: String?
        let closes_at: String?
        let sealed_at: String?
        let people: Int
        let answers: Int
    }

    private struct TallyRow: Decodable {
        let subject_kind: String
        let subject_id: String
        let edition_year: Int
        let there: Int
        let remembers: Int
        let heard: Int
        let never: Int
    }

    /// Everything one date needs, in three requests.
    ///
    /// None of them is load bearing. A failure leaves the page exactly as a
    /// brand new date correctly looks, which is four buttons and nothing else,
    /// so there is no error state to draw and nothing to retry.
    ///
    /// **Nothing here writes.** `open_edition` creates a row the first time it
    /// is called, so calling it to find out whether a date is open would make
    /// an edition for every date anybody scrolled past. The window is worked
    /// out from the setting instead, and the only thing that ever creates an
    /// edition is somebody actually answering.
    func load(month: Int, day: Int) async {
        refusedAsSealed = false
        outOfAnswers = false
        // The first two do not depend on each other. The third reads both of
        // them, so it waits rather than racing them: a tally that ran before
        // the edition landed would decide whether the date had sealed by
        // looking at a value that had not arrived yet, and would show counts
        // on an open date about one time in three.
        async let settings: Void = loadSettings()
        async let summary: Void = loadEdition(month: month, day: day)
        async let budget: Void = loadBudget(month: month, day: day)
        _ = await (settings, summary, budget)
        await loadTally(month: month, day: day)
    }

    private func loadSettings() async {
        var components = URLComponents(
            url: baseURL.appending(path: "rest/v1/remember_settings"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "select", value: "window_days")]
        guard let url = components?.url else { return }
        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let rows = try? JSONDecoder().decode([SettingsRow].self, from: data),
              let first = rows.first
        else { return }
        windowDays = first.window_days
    }

    private func loadBudget(month: Int, day: Int) async {
        let reply = await callRaw("answers_left", body: [
            "month_in": month, "day_in": day, "voter_token_in": voterToken,
        ])
        guard let text = reply.flatMap({ String(data: $0, encoding: .utf8) })?
                .trimmingCharacters(in: .whitespacesAndNewlines),
              let value = Int(text)
        else { return }
        answersLeft = value
    }

    private func loadEdition(month: Int, day: Int) async {
        guard let rows: [SummaryRow] = await call("edition_summary", body: [
            "month_in": month, "day_in": day,
        ]) else { return }

        let thisYear = RememberWindow.editionYear()
        // The current year's edition, or the newest there is, because a date
        // being looked at out of season should still show what it decided.
        let row = rows.first { $0.edition_year == thisYear } ?? rows.max { $0.edition_year < $1.edition_year }
        guard let row else {
            edition = nil
            return
        }
        edition = Edition(
            year: row.edition_year,
            openedAt: Self.instant(row.opened_at),
            closesAt: Self.instant(row.closes_at),
            sealedAt: Self.instant(row.sealed_at),
            people: row.people,
            answers: row.answers
        )
    }

    private func loadTally(month: Int, day: Int) async {
        guard let rows: [TallyRow] = await call("remembrance_tally", body: [
            "month_in": month, "day_in": day,
        ]) else { return }

        var years: [Int: [String: RemembranceCounts]] = [:]
        for row in rows {
            guard let kind = RememberKind(rawValue: row.subject_kind) else { continue }
            let subject = RememberSubject(kind: kind, id: row.subject_id)
            years[row.edition_year, default: [:]][subject.key] = RemembranceCounts(
                there: row.there, remembers: row.remembers, heard: row.heard, never: row.never
            )
        }
        byYear = years

        // The edition being shown, which is this year's while a date is in
        // season and the newest there is otherwise, so a date looked at out of
        // season still shows what it decided. Who may see any of it is decided
        // per row, below.
        let thisYear = RememberWindow.editionYear()
        let shown = edition?.year ?? thisYear
        counts = years[shown] ?? years[thisYear] ?? years.keys.max().flatMap { years[$0] } ?? [:]
    }

    /// The counts for one row, or nil when this reader may not see them.
    ///
    /// Two ways to earn them: the date has sealed, so the answering is over
    /// and nothing can be biased, or this account has answered this row, so
    /// this reader has already committed and cannot be biased either.
    /// Everybody else gets nil, which is the ordinary state on an open date
    /// and is what stops the page telling a reader the popular answer before
    /// they have given their own.
    func tally(for subject: RememberSubject, month: Int, day: Int) -> RemembranceCounts? {
        guard let counts = counts[subject.key], counts.total > 0 else { return nil }
        if let edition, edition.isSealed { return counts }
        if answer(for: subject, month: month, day: day) != nil { return counts }
        return nil
    }

    /// The same row in an earlier edition, for the year there is one to
    /// compare against. Nil in year one, and a screen that says so honestly is
    /// better than one that draws a trend from a single point.
    func tally(for subject: RememberSubject, year: Int) -> RemembranceCounts? {
        byYear[year]?[subject.key]
    }

    /// Which editions this date has, newest first.
    var editionYears: [Int] { byYear.keys.sorted(by: >) }

    // MARK: Writing

    /// One answer.
    ///
    /// Not moved on screen first, which is the opposite of how the likes work,
    /// and the difference is deliberate. A like is a preference and the worst
    /// case for guessing wrong is a heart filled in on one phone that nobody
    /// can see. This is a record. A reader who taps and is shown their own
    /// answer on a date that had already sealed has been told something untrue
    /// about a page whose entire claim is that it is a record. So it waits for
    /// the one round trip and shows what actually happened.
    ///
    /// The birth year is only ever what the reader already put in their own
    /// profile, and it is the point of the exercise: crossed with the answer
    /// it produces a map of what each generation remembers, which is the one
    /// part of this that cannot be scraped from anybody.
    @discardableResult
    func send(_ depth: RememberDepth, for subject: RememberSubject,
              month: Int, day: Int, birthYear: Int?) async -> Bool {
        var body: [String: Any] = [
            "month_in": month,
            "day_in": day,
            "subject_kind_in": subject.kind.rawValue,
            "subject_id_in": subject.id,
            "voter_token_in": voterToken,
            "depth_in": depth.rawValue,
        ]
        if let birthYear { body["birth_year_in"] = birthYear }

        // `remember_status` rather than `remember`, because the boolean could
        // not say which of four things happened and the page ended up calling
        // all of them a sealed date. See the migration.
        let reply = await callRaw("remember_status", body: body)
        let reason = reply
            .flatMap { String(data: $0, encoding: .utf8) }?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            // PostgREST hands a text result back as a JSON string, quotes and
            // all.
            .trimmingCharacters(in: CharacterSet(charactersIn: "\"")) ?? ""

        if reason == "spent" {
            // Out of answers on this date. A fact about the reader, not about
            // the date, and the row says so in its own words.
            outOfAnswers = true
            answersLeft = 0
            return false
        }

        guard reason == "kept" || reason == "already" else {
            // Sealed, out of window, or a token the database will not take.
            // Only the first two are facts about the date and the row says so
            // rather than doing nothing.
            refusedAsSealed = true
            await loadEdition(month: month, day: day)
            return false
        }

        refusedAsSealed = false
        let year = edition?.year ?? RememberWindow.editionYear()
        mine[localKey(subject, month: month, day: day, year: year)] = depth
        writeMine()
        // Counted here rather than fetched again. The reveal has to have the
        // reader in it or the tap reads as having done nothing, and the rest
        // of the number is as of when the page loaded, which on one date over
        // three days is the same number. A second round trip to move a figure
        // by one is not worth the wait in front of it.
        // Only a new row moves the number. "Already" means this install had
        // answered it before, and counting it again would show the reader a
        // total with themselves in it twice.
        if reason == "kept" {
            counts[subject.key] = (counts[subject.key] ?? RemembranceCounts()).adding(depth)
            // Only a new row costs one. Tapping something already answered
            // lands as "already" and spends nothing, which the database
            // enforces and this mirrors.
            if let left = answersLeft { answersLeft = max(0, left - 1) }
        }
        return true
    }

    /// Take one answer back, if it was given in the last half minute.
    ///
    /// The window lives in the database and is checked there, in `forget`,
    /// which also matches on the token so it can only ever reach an answer
    /// this install gave. Nothing here decides whether it is allowed; this
    /// asks, and believes the answer.
    ///
    /// False means the window has closed, or the date has sealed, or there was
    /// nothing to remove. All three are the same thing to a reader and the
    /// screen says so in one sentence.
    @discardableResult
    func forget(_ depth: RememberDepth, for subject: RememberSubject,
                month: Int, day: Int) async -> Bool {
        let reply = await callRaw("forget", body: [
            "month_in": month,
            "day_in": day,
            "subject_kind_in": subject.kind.rawValue,
            "subject_id_in": subject.id,
            "voter_token_in": voterToken,
        ])
        let gone = reply
            .flatMap { String(data: $0, encoding: .utf8) }?
            .trimmingCharacters(in: .whitespacesAndNewlines) == "true"
        guard gone else { return false }

        let year = edition?.year ?? RememberWindow.editionYear()
        mine.removeValue(forKey: localKey(subject, month: month, day: day, year: year))
        writeMine()
        counts[subject.key] = (counts[subject.key] ?? RemembranceCounts()).removing(depth)
        // An undo hands the answer back. The row is gone from the table, so
        // the database would say the same on the next read.
        if let left = answersLeft { answersLeft = left + 1 }
        return true
    }

    // MARK: Plumbing

    /// One remote procedure call, signed with the anonymous key only.
    ///
    /// The reader's own token is deliberately not sent. These functions are
    /// granted to `anon`, they check the window inside the database where
    /// nothing on a device can reach it, and sending an account token would
    /// attach an identity to a row that is supposed to carry none.
    private func call<Result: Decodable>(_ function: String, body: [String: Any]) async -> Result? {
        guard let data = await callRaw(function, body: body) else { return nil }
        return try? JSONDecoder().decode(Result.self, from: data)
    }

    /// The bytes that came back, undecoded.
    ///
    /// `remember` answers with a bare `true` or `false`, which is a top level
    /// fragment rather than an object or an array, and not every decoder will
    /// accept one. The website compares it as a value for the same reason, so
    /// this hands the body back and lets the caller do that.
    private func callRaw(_ function: String, body: [String: Any]) async -> Data? {
        var request = URLRequest(url: baseURL.appending(path: "rest/v1/rpc/\(function)"))
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 15

        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode)
        else { return nil }
        return data
    }

    /// A timestamp as PostgREST prints it.
    ///
    /// Tried three ways, because getting this wrong has one specific and
    /// nasty failure: a `sealed_at` that will not parse comes back as nil, nil
    /// means not sealed, and the page would then offer four buttons on a date
    /// that had closed and refuse every one of them.
    private static func instant(_ text: String?) -> Date? {
        guard let text else { return nil }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        if let date = plain.date(from: text) { return date }

        // PostgREST prints as many fractional digits as the value has, and
        // `.withFractionalSeconds` wants exactly three, so five digits parse as
        // nothing at all. Losing the fraction costs under a second on a
        // timestamp that is compared against days.
        var trimmed = text
        if let dot = trimmed.firstIndex(of: "."),
           let zone = trimmed[dot...].firstIndex(where: { "+-Z".contains($0) }) {
            trimmed.removeSubrange(dot..<zone)
        }
        if let date = plain.date(from: trimmed) { return date }

        // "+00" rather than "+00:00" is legal for Postgres and not for this
        // parser.
        if trimmed.hasSuffix("+00") || trimmed.hasSuffix("-00") {
            return plain.date(from: String(trimmed.dropLast(3)) + "Z")
        }
        return nil
    }
}
