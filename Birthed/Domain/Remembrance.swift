import Foundation

/// What a day is remembered for, decided by the people who were there.
///
/// Every ranking signal this app has measures documentation. Sitelinks measure
/// what crossed a language border, pageviews measure what got looked up, and
/// Wikipedia's anniversaries list measures what its editors chose. None of them
/// measure what got TRANSMITTED: the thing somebody brings up unprompted, the
/// thing everybody your age knows without having read it. That is a different
/// axis and no database holds it, because it has never been collected.
///
/// This file is the pure half of that: the four answers, the handle that
/// identifies a row, the arithmetic of the window, and the words on a sealed
/// page. Everything here takes what it needs as a parameter and returns a
/// value, so `swift test` can check all of it without a simulator and without
/// a network. `RememberService` is the half that talks to the database, and it
/// holds no rules of its own.

// MARK: The four answers

/// How close a thing was to you.
///
/// **There is no fifth answer and there is no direction.** There is no way to
/// say a thing did not matter, only how close to you it was. A direction is a
/// weapon: an up and down score on January 6 or October 7 is a brigading
/// target inside a week, and a record of what happened cannot host a faction
/// fight.
///
/// **`never` is recorded and counted rather than thrown away.** A row that is
/// thoroughly documented and that nobody has heard of is the most interesting
/// result this collects, and it is invisible if you only keep the people who
/// remember.
///
/// The raw values are the strings the database checks against. Renaming one
/// here without changing the check constraint means every answer is refused.
enum RememberDepth: String, CaseIterable, Equatable, Sendable {
    case there
    case remember
    case heard
    case never

    /// The three the app puts on screen, and why `there` is not one of them.
    ///
    /// "I was there" is a claim about presence, and this feature measures
    /// transmission: what somebody knows without having read it. Those are
    /// different axes, and on most rows the presence one has no answer.
    /// Nobody was there for a diplomatic announcement, nobody was there for a
    /// song being number one, and a button that is nonsense on four rows in
    /// five is not a rung of the scale, it is noise near the top of it. The
    /// three that are left ask the same question of every row on the page.
    ///
    /// **The case stays in the type even so.** The website offers four and has
    /// been writing `there` since it shipped, the check constraint still
    /// allows it, and `remembrance_tally` still returns a column of them. A
    /// value this app has stopped offering is not a value it can stop reading:
    /// dropping the case would make every answer a web reader has already
    /// given fail to decode, and the row would quietly show a smaller total
    /// than it really has.
    static let offered: [RememberDepth] = [.remember, .heard, .never]

    /// The words on the button, exactly as the website prints them.
    var label: String {
        switch self {
        case .there: return "I was there"
        case .remember: return "I remember it"
        case .heard: return "Heard of it"
        case .never: return "Never heard of it"
        }
    }

    /// What a screen reader says after the answer has been given. Written as a
    /// finished sentence, because "I was there, selected" reads as a fragment.
    var spokenAfter: String {
        switch self {
        case .there: return "You answered that you were there."
        case .remember: return "You answered that you remember it."
        case .heard: return "You answered that you had heard of it."
        case .never: return "You answered that you had never heard of it."
        }
    }
}

// MARK: Which row an answer is about

/// Which table a row came from, as the database spells it.
///
/// Text rather than a foreign key because the feed ranks rows out of five
/// different sources, and a union of five keys is a worse thing to maintain
/// than a label somebody can read.
enum RememberKind: String, Equatable, Sendable {
    case moment
    case culturalEvent = "cultural_event"
    case historicalEvent = "historical_event"
    case birthFact = "birth_fact"
    case person
    case chartNumberOne = "chart_number_one"
}

/// The stable handle for one row of the feed.
///
/// **This is the part that will bite, so it is a type rather than a string.**
/// The feed mixes five sources, so a position in the list is not an identity.
/// The same row sits somewhere else the day a new fact lands, and if answers
/// were keyed to position then every answer anybody gave would slide quietly
/// onto a different sentence. The website hit exactly this and had to add `id`
/// to three of its selects to fix it.
///
/// A hash of the sentence is not an identity either, and it is the worse of
/// the two traps because it looks like it works. The website sends the
/// database row id. If this app sent a hash of the wording instead, the same
/// event would collect two separate piles of answers under two names and
/// neither pile would be the real number, and any copyedit to the wording
/// would silently orphan every answer the app had ever collected on it.
///
/// So: the id is whatever that row's own table calls it, and nothing else.
struct RememberSubject: Hashable, Equatable, Sendable {
    let kind: RememberKind
    let id: String

    init(kind: RememberKind, id: String) {
        self.kind = kind
        self.id = id
    }

    /// One string for both halves, for a dictionary key and for what this
    /// account has already answered. Never sent anywhere: the database is told
    /// the kind and the id separately.
    var key: String { "\(kind.rawValue):\(id)" }
}

// MARK: The window

/// When a date takes answers, worked out the same way the database works it
/// out, which is not the same way a phone would.
///
/// **The window runs on Coordinated Universal Time, not on the reader's
/// clock.** `open_edition` compares `now()` against plain dates, and the
/// database server keeps Coordinated Universal Time, so the September 8 page
/// opens at midnight on September 7 in Coordinated Universal Time and closes
/// at midnight on September 10 in the same. In Los Angeles that is five in the
/// evening on September 6 through five in the evening on September 9.
///
/// A phone that worked the window out in its own time zone would draw four
/// buttons for the last seven hours of every window on the west coast of the
/// United States, and every one of them would be refused by the server. So
/// this does the server's arithmetic instead of its own. The buttons go away
/// when the date actually seals, rather than staying and failing.
///
/// **The server is still the authority.** This decides what to draw. It never
/// decides whether an answer counts. If a post comes back refused, the page
/// says the date has sealed, whatever this computed.
enum RememberWindow {

    /// Coordinated Universal Time, on purpose and never the reader's own zone,
    /// because the question is what the server thinks the date is.
    static var reference: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        return calendar
    }

    /// Which edition a date is on, which is the year the server is currently
    /// in. It turns over at midnight in Coordinated Universal Time, so a
    /// reader in Los Angeles is on next year's edition from four in the
    /// afternoon on New Year's Eve. That is the database's own rule and
    /// disagreeing with it here would only mean drawing the wrong year.
    static func editionYear(now: Date = Date()) -> Int {
        reference.component(.year, from: now)
    }

    /// Midnight at the start of a date, in Coordinated Universal Time.
    ///
    /// Nil when that date does not exist, which is 29 February in a year that
    /// does not have one. That date has no edition, and that is correct rather
    /// than a bug to work around: the database refuses it too.
    static func midnight(year: Int, month: Int, day: Int) -> Date? {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        guard let date = reference.date(from: components) else { return nil }
        // `date(from:)` is forgiving and rolls 29 February into 1 March, so the
        // answer is checked rather than trusted.
        let back = reference.dateComponents([.year, .month, .day], from: date)
        guard back.year == year, back.month == month, back.day == day else { return nil }
        return date
    }

    /// When this date's edition opens, or nil when the date does not exist
    /// this year.
    static func opens(month: Int, day: Int, windowDays: Int, now: Date = Date()) -> Date? {
        guard let start = midnight(year: editionYear(now: now), month: month, day: day) else { return nil }
        return reference.date(byAdding: .day, value: -windowDays, to: start)
    }

    /// When this date's edition closes.
    ///
    /// The day after the last day that takes answers, at midnight, which is
    /// what the database stores in `closes_at`. With a window of one day,
    /// September 8 closes at midnight on September 10, so September 7, 8 and 9
    /// all take answers.
    static func closes(month: Int, day: Int, windowDays: Int, now: Date = Date()) -> Date? {
        guard let start = midnight(year: editionYear(now: now), month: month, day: day) else { return nil }
        return reference.date(byAdding: .day, value: windowDays + 1, to: start)
    }

    /// Whether this date is taking answers right now.
    ///
    /// The same comparison `open_edition` makes, including its edges: it
    /// refuses when now is before the opening instant or after the closing
    /// one, so both instants themselves are inside.
    static func isOpen(month: Int, day: Int, windowDays: Int, now: Date = Date()) -> Bool {
        guard let opens = opens(month: month, day: day, windowDays: windowDays, now: now),
              let closes = closes(month: month, day: day, windowDays: windowDays, now: now)
        else { return false }
        return now >= opens && now <= closes
    }
}

// MARK: What a date decided

/// The four counts for one row of one edition.
///
/// Counted apart rather than summed into one number, because the four answers
/// are not points on one scale. "I was there" and "I have never heard of it"
/// are both information, and a single average would hide the second one, which
/// is the more interesting of the two.
struct RemembranceCounts: Equatable, Sendable {
    let there: Int
    let remembers: Int
    let heard: Int
    let never: Int

    init(there: Int = 0, remembers: Int = 0, heard: Int = 0, never: Int = 0) {
        self.there = there
        self.remembers = remembers
        self.heard = heard
        self.never = never
    }

    var total: Int { there + remembers + heard + never }

    /// One answer's share of the total, between zero and one. Zero when
    /// nobody has answered, rather than undefined.
    func share(for depth: RememberDepth) -> Double {
        guard total > 0 else { return 0 }
        return Double(count(for: depth)) / Double(total)
    }

    /// One line of the little result drawn under a row somebody answered.
    struct Slice: Equatable, Sendable {
        let depth: RememberDepth
        let count: Int
        let share: Double
    }

    /// The result, in the order it is drawn.
    ///
    /// The three the app offers, and "I was there" as well but only when
    /// somebody actually gave it. Drawing a permanent empty row for an answer
    /// this app no longer offers would be explaining a decision to a reader who
    /// never saw the button, and hiding a row that has real answers in it would
    /// make the numbers underneath not add up to the total printed beside them.
    var breakdown: [Slice] {
        var rows: [Slice] = []
        if there > 0 {
            rows.append(Slice(depth: .there, count: there, share: share(for: .there)))
        }
        for depth in RememberDepth.offered {
            rows.append(Slice(depth: depth, count: count(for: depth), share: share(for: depth)))
        }
        return rows
    }

    /// This account's own answer, added the moment it is given.
    ///
    /// The reveal has to include the reader or it reads as a lie: somebody who
    /// has just pressed "never heard of it" and is shown a count that does not
    /// have them in it will assume the tap did nothing. The rest of the number
    /// is as of when the page loaded, which for one date over three days is
    /// the same number, and the alternative is a second round trip to move a
    /// figure by one.
    /// The same answer taken back out again, for an undo.
    ///
    /// Floored at zero rather than allowed to go negative. The count this is
    /// applied to came off the server before the answer was given, so in the
    /// ordinary case the number is certainly there to remove. In the case
    /// where it is not, a row reading minus one is a worse thing to put on a
    /// screen than a row reading zero.
    func removing(_ depth: RememberDepth) -> RemembranceCounts {
        RemembranceCounts(
            there: max(0, there - (depth == .there ? 1 : 0)),
            remembers: max(0, remembers - (depth == .remember ? 1 : 0)),
            heard: max(0, heard - (depth == .heard ? 1 : 0)),
            never: max(0, never - (depth == .never ? 1 : 0))
        )
    }

    func adding(_ depth: RememberDepth) -> RemembranceCounts {
        RemembranceCounts(
            there: there + (depth == .there ? 1 : 0),
            remembers: remembers + (depth == .remember ? 1 : 0),
            heard: heard + (depth == .heard ? 1 : 0),
            never: never + (depth == .never ? 1 : 0)
        )
    }

    func count(for depth: RememberDepth) -> Int {
        switch depth {
        case .there: return there
        case .remember: return remembers
        case .heard: return heard
        case .never: return never
        }
    }

    /// The one line under a sealed row, or nil when nobody answered it.
    ///
    /// It leads with whichever answer won and says how many gave it, and it
    /// says "of 12" rather than a percentage, because a percentage of nine
    /// people is a number pretending to be a measurement.
    func summary() -> String? {
        guard total > 0 else { return nil }
        // A tie goes to the answer that claims least. "There" is the strongest
        // claim on the page and the easiest to give without thinking, so when
        // it draws level with something quieter, the quieter one is printed.
        // This is the same instinct that keeps a heavy row out of the lead
        // position in `DayFeed.settled`.
        let ranked = RememberDepth.allCases.reversed()
            .max { count(for: $0) < count(for: $1) }
        guard let winner = ranked else { return nil }
        let score = count(for: winner)
        let people = total == 1 ? "1 answer" : "\(total) answers"
        switch winner {
        case .there: return "\(score) were there, of \(people)."
        case .remember: return "\(score) remember it, of \(people)."
        case .heard: return "\(score) had heard of it, of \(people)."
        case .never: return "\(score) had never heard of it, of \(people)."
        }
    }
}

// MARK: The words on the row

/// The two sentences the row itself says, kept here with the rest of the copy
/// so the house style test covers them.
enum RememberCopy {
    /// What a row shows before anybody has touched it.
    ///
    /// One quiet line rather than four buttons. A date page carries a hundred
    /// and fifty rows and four buttons on every one of them turns a feed into
    /// a form: the same eight words repeating down the screen stop being a
    /// question and become wallpaper, and wallpaper does not get answered.
    /// Asking once, small, and opening only when somebody says yes is the
    /// same amount of feature and about a tenth of the furniture.
    static let prompt = "Do you remember this?"

    /// The total under the little result. Said as answers rather than people,
    /// because that is what a per row count is: one person answering twelve
    /// rows is twelve answers, and only `edition_summary` knows how many
    /// people that was.
    static func answers(_ total: Int) -> String {
        total == 1 ? "1 answer so far" : "\(total) answers so far"
    }

    /// Taking one back, offered for half a minute and then gone.
    ///
    /// Called undo rather than change, because that is what it is for. A
    /// misclick is noticed at once. Second thoughts about your place in the
    /// room take longer than that, and the result is on screen by now, so a
    /// window long enough to reconsider is a window long enough to switch to
    /// whatever the majority said. The database enforces the limit, in
    /// `forget`, where a device cannot argue with it.
    static let undo = "Undo"

    /// Said when the window has closed, or when the answer was never there.
    /// One sentence for both, because they are the same thing to a reader.
    static let tooLateToUndo = "That one is in. It counts from here."

    /// What a row says when the answer arrived too late.
    static let sealed = "This date has sealed. It reopens next year."
}

// MARK: The seal

/// The words on a date that has closed.
///
/// A sealed page is the year one version of time travel and it exists from the
/// first day. It says what the date decided and when it decided it, and next
/// year the same date reopens on top of this one, so the difference between
/// the two editions is a measurement of collective forgetting.
enum SealText {

    /// "Sealed 8 September 2026. Forty seven people answered."
    ///
    /// **People, not answers.** One person answering twelve rows is twelve
    /// answers, and printing that as twelve people would be a lie on the one
    /// screen whose whole job is to be a record. The count of separate people
    /// comes from `edition_summary`, which counts distinct tokens in the
    /// database and never lets one out.
    static func line(sealedAt: Date, people: Int) -> String {
        let when = spelledDate(sealedAt)
        if people == 0 {
            return "Sealed \(when). Nobody answered."
        }
        if people == 1 {
            return "Sealed \(when). One person answered."
        }
        return "Sealed \(when). \(spelled(people)) people answered."
    }

    /// What an open date says instead, so the reader knows there is a clock.
    ///
    /// Scarcity and consequence, never scoring. There are no points, no
    /// streaks and no badges anywhere in this feature, so the only pressure on
    /// an answer is that the date closes and does not reopen until next year.
    /// Saying so is the whole of the mechanism.
    static func openLine(closes: Date, now: Date = Date()) -> String {
        let seconds = closes.timeIntervalSince(now)
        if seconds <= 0 { return "This date is closing." }
        let hours = Int(seconds / 3600)
        if hours < 1 { return "This date seals within the hour." }
        if hours < 24 {
            return hours == 1 ? "This date seals in an hour." : "This date seals in \(hours) hours."
        }
        let days = hours / 24
        return days == 1 ? "This date seals tomorrow." : "This date seals in \(days) days."
    }

    /// "8 September 2026". A fixed format rather than a localised one, because
    /// this sentence is a record and it should read the same everywhere.
    static func spelledDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        formatter.dateFormat = "d MMMM yyyy"
        return formatter.string(from: date)
    }

    /// A number in words, with no hyphen in it: "Forty seven".
    ///
    /// Words up to a hundred and digits above, because "one thousand two
    /// hundred and six" is not a sentence anybody reads, it is one they skip.
    ///
    /// **Written out by hand rather than handed to a formatter.** The spell
    /// out style reads its rules from the locale, and this file already had to
    /// pin one to stop the answer depending on which machine it ran on.
    /// Pinning it to `en_US_POSIX` is worse than it looks: that locale exists
    /// to be free of language, which is the opposite of what spelling a number
    /// in English needs, and what comes back is a fact about a version of a
    /// library rather than about English. Ninety nine words is less code than
    /// the comment explaining why the library was safe, and it cannot drift.
    static func spelled(_ number: Int) -> String {
        guard number > 0, number < 100 else { return grouped(number) }

        let ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
                    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
                    "Seventeen", "Eighteen", "Nineteen"]
        if number < 20 { return ones[number] }

        let tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
        let ten = tens[number / 10]
        let unit = number % 10
        // A space and not a hyphen, which is the whole reason this exists.
        return unit == 0 ? ten : "\(ten) \(ones[unit].lowercased())"
    }

    /// "1,206", grouped the same way on every machine.
    ///
    /// Written out for the same reason as the words above. This sentence is a
    /// record and it should read the same everywhere, and a test that depended
    /// on where it ran would pass on one desk and fail on another.
    static func grouped(_ number: Int) -> String {
        let digits = String(abs(number))
        var out = ""
        for (index, digit) in digits.enumerated() {
            if index > 0, (digits.count - index) % 3 == 0 { out.append(",") }
            out.append(digit)
        }
        return number < 0 ? "-" + out : out
    }
}
