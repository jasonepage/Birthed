import Foundation

/// The wall, as the app reasons about it. docs/the-wall.md is the authority.
///
/// Pure Swift. Everything here is a value the server sent or arithmetic on
/// it, so `swift test` covers the parts that can be wrong: which date is open,
/// how many units are left, where a tile sits, what a tap may spend, and what
/// the screen says when the answer is no. The views draw and nothing else.
///
/// The server decides. Every number here is for showing and for refusing
/// early; the database refuses again, and the database is right.

// MARK: - A dated wall

/// A calendar date with a year: one wall. Distinct from `CalendarDate`, which
/// recurs. A wall for September 9, 2026 happens once.
struct WallDate: Hashable, Comparable {
    let year: Int
    let month: Int
    let day: Int

    init?(year: Int, month: Int, day: Int) {
        guard (1...12).contains(month), (1...31).contains(day), year > 0 else { return nil }
        self.year = year
        self.month = month
        self.day = day
    }

    /// "2026-09-09", the shape every wall table stores.
    init?(key: String) {
        let parts = key.split(separator: "-").map { Int($0) }
        guard parts.count == 3, let y = parts[0], let m = parts[1], let d = parts[2] else { return nil }
        self.init(year: y, month: m, day: d)
    }

    var key: String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }

    var calendarDate: CalendarDate? { CalendarDate(month: month, day: day) }

    static func < (lhs: WallDate, rhs: WallDate) -> Bool {
        (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
    }
}

// MARK: - The clock

/// Eastern time, for everybody, everywhere. docs/the-wall.md section 3: one
/// date has to mean one thing or a permanent archive is not possible.
///
/// The server's clock decides which dates are open. The app asks `wall_clock`
/// and passes the answer in as `now`; the device's own clock is never the
/// authority, only the fallback while the answer is on its way.
enum WallClock {
    static var eastern: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York") ?? .gmt
        return calendar
    }

    /// The Eastern calendar date an instant falls on.
    static func easternDate(of instant: Date) -> WallDate {
        let parts = eastern.dateComponents([.year, .month, .day], from: instant)
        return WallDate(year: parts.year ?? 1, month: parts.month ?? 1, day: parts.day ?? 1)
            ?? WallDate(year: 1, month: 1, day: 1)!
    }

    /// Yesterday, today and tomorrow, Eastern. The three dates that are open
    /// at an instant. December 31 opens January 1 of the next year, and
    /// February 28 opens February 29 only in a leap year, because the
    /// arithmetic walks real days rather than adding seconds.
    static func openDates(now: Date) -> [WallDate] {
        let today = easternDate(of: now)
        var components = DateComponents()
        components.year = today.year
        components.month = today.month
        components.day = today.day
        components.hour = 12
        guard let noon = eastern.date(from: components) else { return [today] }
        return [-1, 0, 1].compactMap { offset in
            guard let moved = eastern.date(byAdding: .day, value: offset, to: noon) else { return nil }
            return easternDate(of: moved)
        }
    }

    /// The open wall for a month and day, or nil when that date is not open
    /// right now, in which case the newest closed wall for it is shown.
    static func openWall(for date: CalendarDate, now: Date) -> WallDate? {
        openDates(now: now).first { $0.month == date.month && $0.day == date.day }
    }
}

// MARK: - What the server holds

enum WallTier: String, Equatable {
    case claimed
    case reported
    case seenDirect = "seen_direct"

    /// The word on the chip. Never a verdict.
    var label: String {
        switch self {
        case .claimed: return "Claimed"
        case .reported: return "Reported"
        case .seenDirect: return "Seen directly"
        }
    }

    /// What the word means, in the document's own terms.
    var meaning: String {
        switch self {
        case .claimed: return "Somebody said it and nobody has confirmed it."
        case .reported: return "Two or more independently owned outlets."
        case .seenDirect: return "Video, a filing, a record or an official statement."
        }
    }
}

enum WallStoryStatus: String, Equatable {
    case pool
    case placed
    case overflow
    case shownFalse = "false"
}

/// A rectangle on the sixteen by sixteen board, in modules, origin top left.
struct WallRect: Equatable {
    let mx: Int
    let my: Int
    let w: Int
    let h: Int

    var area: Int { w * h }

    /// True when the two share any module. Two stored tiles never should.
    func overlaps(_ other: WallRect) -> Bool {
        mx < other.mx + other.w && other.mx < mx + w && my < other.my + other.h && other.my < my + h
    }

    /// True when this holds every module of `inner`.
    func contains(_ inner: WallRect) -> Bool {
        mx <= inner.mx && my <= inner.my && mx + w >= inner.mx + inner.w && my + h >= inner.my + inner.h
    }
}

struct WallCheck: Equatable {
    enum Kind: String, Equatable {
        case resolves
        case quotation
    }

    let checkedAt: Date
    let kind: Kind
    let passed: Bool
    let httpStatus: Int?
    let detail: String?

    /// The check, as one line a person can read.
    var title: String {
        kind == .resolves ? "Link resolves" : "Page contains the quotation"
    }
}

struct WallSource: Equatable, Identifiable {
    let id: String
    let url: URL
    let outlet: String
    let owner: String
    let headline: String
    let quotation: String
    let verifiedAt: Date?
    let addedAt: Date
    let isPrimaryDoc: Bool
    /// Every check ever run, oldest first.
    let checks: [WallCheck]

    /// What the receipt says about the quotation, in one sentence.
    var verificationLine: String {
        if verifiedAt != nil {
            return "The quotation was found on the page, exactly. The check history below is the evidence."
        }
        if checks.isEmpty {
            return "Not checked yet. The checker reads every source within the quarter hour."
        }
        return "The quotation has not been found on the page."
    }
}

struct WallStory: Equatable, Identifiable {
    let id: String
    let wallDate: WallDate
    let submittedAt: Date
    let headline: String
    let url: URL
    let outlet: String
    let status: WallStoryStatus
    let tier: WallTier
    /// Boost units so far.
    let support: Int
    let placedAt: Date?
    let rect: WallRect?
    let falseAt: Date?
    let falseNote: String?
    let sources: [WallSource]

    /// What goes first among stories nobody has backed yet: 3 a written lead
    /// line or a year the date's own editors picked, 2 the three most looked
    /// up people, 1 other history, 0 the news feeds.
    ///
    /// Set by the worker, read by the allocator and by the feed's order, and
    /// beaten by a single buzz. A var with a default so a caller that has no
    /// priority still compiles and gets the lowest one rather than a guess.
    var priority: Int = 0

    /// The imported row this story stands for, when it stands for one:
    /// historical_event, birth_fact, cultural_event or person. Both nil for a
    /// news story, and the database will not let one be set without the other.
    ///
    /// This is what lets the timeline and the hive be one feed: a row the
    /// reader sees with their age on it and a story they can buzz are the
    /// same thing when these match `RememberSubject`.
    var subjectKind: String? = nil
    var subjectID: String? = nil

    /// On the hive: placed, or placed and later shown false. A false story
    /// keeps its exact rectangle.
    var isOnHive: Bool {
        rect != nil && (status == .placed || status == .shownFalse)
    }

    /// One line about where the story stands.
    var standing: String {
        switch status {
        case .placed:
            if let rect { return "On the hive, \(rect.w) by \(rect.h) modules." }
            return "On the hive."
        case .shownFalse:
            return "On the hive and later shown false. It keeps its rectangle."
        case .overflow:
            return "Earned a place and found no room on the hive. In the feed until one opens."
        case .pool:
            return "In the pool, waiting for enough evidence and for somebody to back it."
        }
    }
}

struct WallDay: Equatable {
    let wallDate: WallDate
    let opensAt: Date
    let liveAt: Date
    let closesAt: Date
    let closedAt: Date?
    let stories: [WallStory]

    /// The day's buzz rows in the order they were cast, without the booster,
    /// which the role cannot select. The crown and every change of hands are
    /// replayed from these, docs/the-wall.md section 30. Empty on a day read
    /// by a caller that did not ask for them, which is no crown.
    var boosts: [WallBoost] = []

    var onHive: [WallStory] { stories.filter(\.isOnHive) }
    var inPool: [WallStory] { stories.filter { $0.status == .pool } }
    var overflow: [WallStory] { stories.filter { $0.status == .overflow } }

    /// Where the window stands at an instant, by the server's rules in
    /// docs/the-wall.md section 3.
    enum Phase: Equatable {
        /// Before the day before: nothing yet.
        case notYetOpen
        /// The day before: submissions only, no boosts.
        case submissionsOnly
        /// The day itself and the day after: submitting and boosting.
        case live
        /// Midnight ending the day after has passed, or the close job stamped it.
        case closed
    }

    func phase(now: Date) -> Phase {
        if let closedAt, now >= closedAt { return .closed }
        if now >= closesAt { return .closed }
        if now >= liveAt { return .live }
        if now >= opensAt { return .submissionsOnly }
        return .notYetOpen
    }
}

// MARK: - The budget

/// Three units on the date itself, one the day after, none the day before.
/// `wall_boost_budget` in the database, the same arithmetic. The server is
/// authoritative; this is for showing the number and for refusing a tap that
/// could not succeed.
enum WallBudget {
    static func allowance(castOn: WallDate, wallDate: WallDate) -> Int {
        if castOn == wallDate { return 3 }
        if let dayAfter = dayAfter(wallDate), castOn == dayAfter { return 1 }
        return 0
    }

    static func dayAfter(_ date: WallDate) -> WallDate? {
        var components = DateComponents()
        components.year = date.year
        components.month = date.month
        components.day = date.day
        components.hour = 12
        guard let noon = WallClock.eastern.date(from: components),
              let next = WallClock.eastern.date(byAdding: .day, value: 1, to: noon)
        else { return nil }
        return WallClock.easternDate(of: next)
    }

    /// Units the caller may still spend on a wall, right now, given what they
    /// have spent on it today. Never below zero.
    static func unitsLeft(wallDate: WallDate, now: Date, spentToday: Int) -> Int {
        max(0, allowance(castOn: WallClock.easternDate(of: now), wallDate: wallDate) - spentToday)
    }

    /// Whether a tap for `units` could possibly be accepted. The server
    /// decides; this saves a request that would be refused anyway.
    static func canSpend(_ units: Int, left: Int) -> Bool {
        (1...3).contains(units) && units <= left
    }
}

// MARK: - Buzzes that refill through the day

/// docs/the-wall.md section 30, decided September 23, 2026. Still three a
/// day on the date and one on the day after; they arrive one at a time, at
/// midnight, 8 am and 4 pm Eastern, and unspent ones carry over inside the
/// day. The database is the authority (migration
/// `20260923010000_buzzes_that_refill.sql`, and `wall_units_left` already
/// answers against what has arrived once it is applied). This is the app's
/// copy of the arithmetic for the count sentence, the same as
/// `web/src/refills.ts`, pinned to the same instants the migration was
/// tested against.
///
/// `on` is false until Jason applies the migration, and flips in the same
/// build. With it off the app says three at midnight, which is what the
/// database gives until then.
enum Refills {
    static let on = false

    /// The Eastern hours a unit arrives on the date's own day, after the midnight one.
    static let hours = [8, 16]

    /// How many units have arrived for a wall date by an instant. The
    /// database's `wall_boost_allowance`.
    static func arrived(by instant: Date, wallDate: WallDate) -> Int {
        let today = WallClock.easternDate(of: instant)
        if today == wallDate {
            let hour = WallClock.eastern.component(.hour, from: instant)
            return 1 + hours.filter { hour >= $0 }.count
        }
        if let after = WallBudget.dayAfter(wallDate), today == after { return 1 }
        return 0
    }

    /// The instants a unit arrives on the date's own day after the midnight
    /// one: 8 am and 4 pm Eastern as instants, by the calendar, so the day
    /// the clocks change is still answered by the clock.
    static func refillInstants(wallDate: WallDate) -> [Date] {
        hours.compactMap { hour in
            var components = DateComponents()
            components.year = wallDate.year
            components.month = wallDate.month
            components.day = wallDate.day
            components.hour = hour
            components.minute = 0
            return WallClock.eastern.date(from: components)
        }
    }

    /// The next refill on the date's own day after an instant, or nil when
    /// none is coming today. The midnight that starts the day after is the
    /// day changing, not a unit arriving, and is not returned.
    static func next(after instant: Date, wallDate: WallDate) -> Date? {
        guard WallClock.easternDate(of: instant) == wallDate else { return nil }
        return refillInstants(wallDate: wallDate).first { $0 > instant }
    }

    /// "8 am Eastern", "4 pm Eastern".
    static func words(_ instant: Date) -> String {
        let hour = WallClock.eastern.component(.hour, from: instant)
        if hour == 0 { return "midnight Eastern" }
        if hour == 12 { return "noon Eastern" }
        return "\(hour % 12) \(hour < 12 ? "am" : "pm") Eastern"
    }

    /// The words for the count sentence, or "" when refills are off, the
    /// allowance is not the date's own three, or nothing more arrives today.
    static func nextWords(now: Date, wallDate: WallDate, allowance: Int, on: Bool = Refills.on) -> String {
        guard on, allowance == 3, let next = next(after: now, wallDate: wallDate) else { return "" }
        return words(next)
    }
}

// MARK: - Idempotent boosting

/// One request identifier per tap, never two for the same tap.
///
/// The database keeps `wall_boost_requests` keyed by this identifier and
/// returns the first boost for any repeat, so a double tap, a retried
/// request or a phone that lost the answer cannot spend twice. The ledger
/// hands out the same identifier for a story while its request is in flight
/// and a fresh one only once that request has finished.
struct WallBoostLedger: Equatable {
    private var inFlight: [String: UUID] = [:]

    init() {}

    /// The identifier to send for a tap on this story. The same one while a
    /// request for the story is still in flight.
    mutating func begin(storyID: String, fresh: () -> UUID = { UUID() }) -> UUID {
        if let existing = inFlight[storyID] { return existing }
        let made = fresh()
        inFlight[storyID] = made
        return made
    }

    func isInFlight(storyID: String) -> Bool {
        inFlight[storyID] != nil
    }

    /// The request for this story finished, one way or the other. The next
    /// tap is a new request.
    mutating func finish(storyID: String) {
        inFlight[storyID] = nil
    }
}

// MARK: - The square

/// Where each tile goes, in points, for a square of a given side. Sixteen by
/// sixteen modules, one square, never a layout that reflows: the server's
/// anchors and sizes are the picture, and the phone only scales it.
enum WallBoard {
    static let modules = 16

    struct Frame: Equatable {
        let x: Double
        let y: Double
        let width: Double
        let height: Double
    }

    /// The frame for a rectangle on a board `side` points across, with `gap`
    /// points between tiles.
    static func frame(of rect: WallRect, side: Double, gap: Double = 2) -> Frame {
        let module = side / Double(modules)
        return Frame(
            x: Double(rect.mx) * module + gap / 2,
            y: Double(rect.my) * module + gap / 2,
            width: max(0, Double(rect.w) * module - gap),
            height: max(0, Double(rect.h) * module - gap)
        )
    }

    /// How much a tile can say, decided by its shape rather than its area.
    /// The same rule the website's tileClass applies: a tall thin tile is as
    /// mute as a small one, because letters stacked down a column are not a
    /// headline.
    enum Size: Equatable {
        case tiny
        case small
        case mid
        case big
    }

    static func size(of rect: WallRect) -> Size {
        if rect.w >= 4 && rect.h >= 3 { return .big }
        if rect.w >= 3 && rect.h >= 2 { return .mid }
        if (rect.w >= 3 && rect.h == 1) || (rect.w == 2 && rect.h >= 2) { return .small }
        return .tiny
    }

    /// The stories that draw, with any story whose rectangle overlaps an
    /// earlier one dropped rather than drawn on top of it. Two stored tiles
    /// never overlap; if they ever did, drawing both would lie about the
    /// board, and drawing the earlier one is the honest half.
    static func tiles(_ stories: [WallStory]) -> [WallStory] {
        var taken: [WallRect] = []
        var out: [WallStory] = []
        for story in stories.filter(\.isOnHive) {
            guard let rect = story.rect else { continue }
            if taken.contains(where: { $0.overlaps(rect) }) { continue }
            taken.append(rect)
            out.append(story)
        }
        return out
    }
}

// MARK: - What the server extracted

/// What the submit flow shows back after the server has read the page. The
/// headline is the source's own wording and there is no way to edit it: the
/// type has no setter, no draft and no field, which is the point.
struct WallSubmitPreview: Equatable {
    let story: WallStory
    /// True when the page was already on this date and the server handed back
    /// that story rather than making a second one.
    let existing: Bool

    static let headlineNote = "This headline is the source's own wording, taken from the page. It cannot be edited."

    var line: String {
        existing
            ? "This page was already filed for this date. Here it is."
            : "Added. It waits in the pool until it has enough evidence and somebody backs it."
    }
}

// MARK: - Words

// The sentences a reader sees live in `HiveCopy`, in Hive.swift, and every one
// of them takes a voice. `WallCopy` used to be here and said boost, wall,
// square and pool in the reader's own screen; it was not renamed but retired,
// so that a sentence in the old words cannot survive by being referenced.

// MARK: - Reading the server's rows

/// The server's rows into values. Plain dictionaries in, values out, so the
/// data layer's decoding stays one line and the shape is tested here.
enum WallRows {
    /// A timestamp as the automatic interface prints it, with microseconds
    /// and an offset: "2026-09-09T14:02:00.123456+00:00". The formatter reads
    /// three fractional digits, so the rest are cut rather than refused.
    static func date(_ value: Any?) -> Date? {
        guard let text = value as? String else { return nil }
        let trimmed = text.replacingOccurrences(of: #"(\.\d{3})\d+"#, with: "$1", options: .regularExpression)
        return Self.iso.date(from: trimmed) ?? Self.isoPlain.date(from: trimmed)
    }

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func check(_ row: [String: Any]) -> WallCheck? {
        guard let checkedAt = date(row["checked_at"]),
              let kind = (row["kind"] as? String).flatMap(WallCheck.Kind.init(rawValue:)),
              let passed = row["passed"] as? Bool
        else { return nil }
        return WallCheck(checkedAt: checkedAt, kind: kind, passed: passed,
                         httpStatus: row["http_status"] as? Int, detail: row["detail"] as? String)
    }

    static func source(_ row: [String: Any]) -> WallSource? {
        guard let id = row["id"] as? String,
              let url = (row["url"] as? String).flatMap(URL.init(string:)),
              let outlet = row["outlet"] as? String,
              let headline = row["headline"] as? String,
              let quotation = row["quotation"] as? String,
              let addedAt = date(row["added_at"])
        else { return nil }
        let checks = ((row["wall_checks"] as? [[String: Any]]) ?? []).compactMap(check).sorted { $0.checkedAt < $1.checkedAt }
        return WallSource(id: id, url: url, outlet: outlet, owner: (row["owner"] as? String) ?? outlet,
                          headline: headline, quotation: quotation, verifiedAt: date(row["verified_at"]),
                          addedAt: addedAt, isPrimaryDoc: (row["is_primary_doc"] as? Bool) ?? false, checks: checks)
    }

    static func story(_ row: [String: Any]) -> WallStory? {
        guard let id = row["id"] as? String,
              let wallDate = (row["wall_date"] as? String).flatMap(WallDate.init(key:)),
              let submittedAt = date(row["submitted_at"]),
              let headline = row["headline"] as? String,
              let url = (row["url"] as? String).flatMap(URL.init(string:)),
              let outlet = row["outlet"] as? String,
              let status = (row["status"] as? String).flatMap(WallStoryStatus.init(rawValue:)),
              let tier = (row["tier"] as? String).flatMap(WallTier.init(rawValue:))
        else { return nil }
        var rect: WallRect? = nil
        if let mx = row["anchor_mx"] as? Int, let my = row["anchor_my"] as? Int,
           let w = row["w_modules"] as? Int, let h = row["h_modules"] as? Int {
            rect = WallRect(mx: mx, my: my, w: w, h: h)
        }
        let sources = ((row["wall_sources"] as? [[String: Any]]) ?? []).compactMap(source).sorted { $0.addedAt < $1.addedAt }
        // The three columns the history migration added. A row written before
        // it, or a select that did not ask for them, parses exactly as it did:
        // no priority is the lowest priority, and no subject is a news story.
        let subjectKind = row["subject_kind"] as? String
        let subjectID = row["subject_id"] as? String
        return WallStory(id: id, wallDate: wallDate, submittedAt: submittedAt, headline: headline, url: url,
                         outlet: outlet, status: status, tier: tier, support: (row["support"] as? Int) ?? 0,
                         placedAt: date(row["placed_at"]), rect: rect, falseAt: date(row["false_at"]),
                         falseNote: row["false_note"] as? String, sources: sources,
                         priority: (row["priority"] as? Int) ?? 0,
                         // The database keeps the pair whole with a constraint.
                         // Half a pair here would be a row nothing could match,
                         // so it is read as no subject at all.
                         subjectKind: subjectID == nil ? nil : subjectKind,
                         subjectID: subjectKind == nil ? nil : subjectID)
    }

    static func day(_ row: [String: Any], stories: [WallStory]) -> WallDay? {
        guard let wallDate = (row["wall_date"] as? String).flatMap(WallDate.init(key:)),
              let opensAt = date(row["opens_at"]),
              let liveAt = date(row["live_at"]),
              let closesAt = date(row["closes_at"])
        else { return nil }
        return WallDay(wallDate: wallDate, opensAt: opensAt, liveAt: liveAt, closesAt: closesAt,
                       closedAt: date(row["closed_at"]), stories: stories)
    }
}
