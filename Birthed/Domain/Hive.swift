import Foundation

/// The hive, as the app reasons about it. docs/the-wall.md is the authority,
/// and section 14 records what this file was built on.
///
/// The board used to be called the wall and the square, and the unit used to
/// be called a boost. Both words were the allocator's and both leaked into
/// what a reader sees. On the page, in the copy and in the path the board is
/// the hive and the unit is a buzz, except on a short list of solemn dates
/// where the same controls speak plainly.
///
/// Pure Swift, Foundation only. Every rule a reader can see lives here and is
/// tested under `swift test`; the views draw and decide nothing.

// MARK: - The voice

/// The words the hive uses for one unit of support.
///
/// The mascot is a bee, so a unit is a buzz: a button that says Buzz, a count
/// that says "Two buzzes left today", a mark that says "You buzzed this". The
/// word lives in one place so the whole screen changes together and so it can
/// be turned off for a date where the pun would be grotesque.
///
/// The same five words as `Voice` in web/src/wall.ts, so the two products say
/// the same thing.
struct HiveVoice: Equatable {
    /// The verb on the button: "Buzz", "Back this".
    let button: String
    /// One unit, and more than one: "buzz", "buzzes".
    let one: String
    let many: String
    /// What the reader did: "buzzed", "backed".
    let past: String
    /// The verb that opens the sentence above the board: "Buzz", "Tap".
    let imperative: String

    static let bee = HiveVoice(button: "Buzz", one: "buzz", many: "buzzes", past: "buzzed", imperative: "Buzz")
    static let plain = HiveVoice(button: "Back this", one: "tap", many: "taps", past: "backed", imperative: "Tap")

    /// The reader's own mark on a story they backed: "You buzzed this".
    var mark: String { "You \(past) this" }
}

/// Which dates speak plainly instead of making the pun.
///
/// docs/the-wall.md section 9 left solemn dates open and named a curated list
/// as one of its two options. This is that list, ported from `PLAIN_DATES` in
/// web/src/wall.ts so the app and the site never disagree about a date. It
/// governs the voice and nothing else: the hive still opens on these dates,
/// still takes support, still seals. It only stops calling a unit a buzz.
///
/// A start, and meant to be edited by a person.
enum HiveDates {
    /// "9-11" for a month and a day, the key shape the rest of the build uses.
    static func key(month: Int, day: Int) -> String { "\(month)-\(day)" }

    static let plainDates: Set<String> = [
        "9-11",  // September 11 attacks
        "12-7",  // Pearl Harbor
        "4-19",  // Oklahoma City
        "4-20",  // Columbine
        "12-14", // Sandy Hook
        "6-12",  // Pulse
        "10-1",  // Las Vegas
        "5-24",  // Uvalde
    ]

    static func speaksPlainly(month: Int, day: Int) -> Bool {
        plainDates.contains(key(month: month, day: day))
    }

    static func voice(month: Int, day: Int) -> HiveVoice {
        speaksPlainly(month: month, day: day) ? .plain : .bee
    }

    static func voice(for date: WallDate) -> HiveVoice {
        voice(month: date.month, day: date.day)
    }

    static func voice(for date: CalendarDate) -> HiveVoice {
        voice(month: date.month, day: date.day)
    }
}

// MARK: - The part of the board the screen draws

/// The window on the board, in modules.
///
/// The board is sixteen by sixteen and a quiet day's tiles sit in the middle
/// third of it, so drawn whole the board is mostly empty and ten headlines in
/// the middle are unreadable on a phone. The screen zooms to the tiles: the
/// smallest square that holds every placed tile, never smaller than eight
/// modules across so that one tile is not a whole hive, never larger than the
/// board. It is still a square and still one picture. The stored rectangles
/// are untouched, and as the day fills the window widens until it is the
/// whole board.
///
/// Ported from `viewportFor` in web/src/wall.ts, arithmetic and all. The
/// halving is done in floating point rather than in whole numbers because
/// that is what the web does, and two ports of one rule that round
/// differently are two rules.
struct HiveViewport: Equatable {
    /// The module the window starts at, from the left and from the top.
    let ox: Int
    let oy: Int
    /// How many modules across the window is. It is always a square.
    let side: Int
}

extension WallBoard {

    /// The smallest window that is never useless: eight modules across.
    static let viewMin = 8

    static func viewport(for rects: [WallRect]) -> HiveViewport {
        guard !rects.isEmpty else { return HiveViewport(ox: 0, oy: 0, side: viewMin) }
        var x0 = modules, y0 = modules, x1 = 0, y1 = 0
        for rect in rects {
            x0 = min(x0, rect.mx)
            y0 = min(y0, rect.my)
            x1 = max(x1, rect.mx + rect.w)
            y1 = max(y1, rect.my + rect.h)
        }
        let side = min(modules, max(viewMin, x1 - x0, y1 - y0))
        func clamp(_ value: Int) -> Int { max(0, min(modules - side, value)) }
        let ox = clamp(Int(floor(Double(x0 + x1) / 2 - Double(side) / 2)))
        let oy = clamp(Int(floor(Double(y0 + y1) / 2 - Double(side) / 2)))
        return HiveViewport(ox: ox, oy: oy, side: side)
    }

    /// The window for a day's stories: the ones actually on the hive.
    static func viewport(forStories stories: [WallStory]) -> HiveViewport {
        viewport(for: tiles(stories).compactMap(\.rect))
    }

    /// The frame for a rectangle inside a window, on a square `side` points
    /// across. A module is bigger when the window is smaller, which is the
    /// whole point of the window.
    static func frame(of rect: WallRect, in viewport: HiveViewport, side: Double, gap: Double = 2) -> Frame {
        let module = side / Double(viewport.side)
        return Frame(
            x: Double(rect.mx - viewport.ox) * module + gap / 2,
            y: Double(rect.my - viewport.oy) * module + gap / 2,
            width: max(0, Double(rect.w) * module - gap),
            height: max(0, Double(rect.h) * module - gap)
        )
    }
}

// MARK: - This account's own buzzes

/// Which stories this install has buzzed, by wall date.
///
/// The mark on a tile has to come from somewhere and the database will not
/// say. `wall_boosts.booster_id` is revoked from the app's role on purpose,
/// recorded and not published, and `wall_units_left` answers with a number
/// and nothing else. `wall_web_standing` is the website's browser token and
/// refuses an authenticated caller. So the app remembers its own taps, which
/// is the same thing `RememberService` already does with this account's own
/// answers and for the same reason.
///
/// The trade, named: this is what this install did. A reinstall forgets it
/// and a second device never knew it. The buzz itself is in the database
/// forever either way, so what is lost is the mark and never the vote.
struct HiveMarks: Equatable {
    /// Wall date key to the story identifiers buzzed on it.
    private var byDate: [String: Set<String>]

    /// How many dates are kept. A wall closes forever, so an old mark stays
    /// true, but a list that only grows is a list that eventually matters.
    static let datesKept = 120

    init() { byDate = [:] }

    /// From what was stored between launches. Anything misshapen is dropped
    /// rather than guessed at.
    init(stored: [String: [String]]) {
        byDate = stored.reduce(into: [String: Set<String>]()) { out, pair in
            guard WallDate(key: pair.key) != nil else { return }
            let ids = pair.value.filter { !$0.isEmpty }
            guard !ids.isEmpty else { return }
            out[pair.key] = Set(ids)
        }
    }

    /// For storing between launches. Sorted so the stored form is stable and
    /// a write with nothing new in it is byte for byte the same.
    var stored: [String: [String]] {
        byDate.mapValues { $0.sorted() }
    }

    var isEmpty: Bool { byDate.isEmpty }

    func has(storyID: String, on date: WallDate) -> Bool {
        byDate[date.key]?.contains(storyID) ?? false
    }

    func storyIDs(on date: WallDate) -> Set<String> {
        byDate[date.key] ?? []
    }

    mutating func add(storyID: String, on date: WallDate) {
        byDate[date.key, default: []].insert(storyID)
        trim()
    }

    /// Takes one mark off, for a buzz the database took back inside its
    /// window. docs/the-wall.md, the last entry in section 16.
    ///
    /// Only ever called after the database has said `undone`. A mark removed
    /// on any other word would tell the reader they had not buzzed something
    /// they had, and the next tap would be refused by a rule they could not
    /// see. A date left holding nothing drops out rather than sitting there
    /// as an empty set, so what is stored between launches stays what it was
    /// before the buzz.
    mutating func remove(storyID: String, on date: WallDate) {
        guard var ids = byDate[date.key] else { return }
        ids.remove(storyID)
        if ids.isEmpty { byDate.removeValue(forKey: date.key) } else { byDate[date.key] = ids }
    }

    /// The newest dates only. Keys are "2026-09-09", so sorting them as text
    /// sorts them in time.
    private mutating func trim() {
        guard byDate.count > Self.datesKept else { return }
        let keep = Set(byDate.keys.sorted(by: >).prefix(Self.datesKept))
        byDate = byDate.filter { keep.contains($0.key) }
    }
}

// MARK: - Thirty seconds to take a misclick back

/// The window in which a buzz can be taken back, and what a screen may do
/// with it. docs/the-wall.md, the last entry in section 16.
///
/// Pure arithmetic on a clock, so "is the Undo button still up" is a question
/// with an answer in `swift test` rather than one somebody times with a
/// stopwatch on a phone. The database decides for real, in
/// `wall_forget_boost`, and this only decides whether the button is drawn: a
/// window a client can argue with is not a window, so this is deliberately a
/// touch tighter than the database's and never looser.
///
/// It is for the finger and not for the opinion. A misclick is noticed at
/// once; second thoughts take longer than half a minute, and a longer window
/// would let somebody watch what everybody else backed and move to it, which
/// is the thing the whole mechanic is built to avoid.
enum HiveUndo {
    /// Thirty seconds, the same number `wall_undo_seconds` holds.
    static let seconds: TimeInterval = 30

    /// The last moment the button should be up for a buzz cast at `castAt`.
    static func endsAt(castAt: Date) -> Date {
        castAt.addingTimeInterval(seconds)
    }

    /// Whether a buzz cast at `castAt` is still inside its window at `now`.
    ///
    /// A hair short of the database's window on purpose. A button that is
    /// drawn for the last tenth of a second sends a request that arrives
    /// after the window has closed and comes back "that one stands", which is
    /// a correct answer to a question the screen should not have asked.
    static func open(castAt: Date, now: Date) -> Bool {
        let gone = now.timeIntervalSince(castAt)
        return gone >= 0 && gone < seconds - 1
    }

    /// Whole seconds left, for a screen that counts down. Never below zero.
    static func secondsLeft(castAt: Date, now: Date) -> Int {
        max(0, Int((seconds - now.timeIntervalSince(castAt)).rounded(.down)))
    }
}

// MARK: - The one feed

/// The single feed under the hive.
///
/// Decided September 10, 2026: everything with a birthday on a date is a
/// pixel, so what happened on it, who was born on it, what came out on it and
/// the day's news are all wall stories in one pool taking the same buzzes.
/// The app keeps the thing the website does not have, which is the reader's
/// own timeline with their age on every row, and hangs the one verb off it.
///
/// So a row is one of three things:
///
/// - A timeline row the worker has filed as a story. It keeps its age line
///   and gains the count and the button.
/// - A timeline row the worker has not filed, which draws with no button.
///   The number one songs are the standing case: a song is keyed to a year
///   and a chart rather than to a day and is not a pixel yet.
/// - A story with no timeline row of its own. The day's news is all of these,
///   and it goes first, because it is this year and the timeline ranks by the
///   reader's age, which would sink today to the bottom of its own page.
///
/// A story that took a place on the hive is not repeated here. The hive is
/// directly above the feed and the tile carries the reader's age line, so
/// nothing is lost and no headline is drawn twice.
enum HiveFeed {

    /// One row of the feed.
    struct Row: Identifiable, Equatable {
        /// The timeline row, when this is one.
        let item: DayFeed.Item?
        /// The story this row can be buzzed as, when the worker has filed one.
        let story: WallStory?

        var id: String {
            if let item { return item.id }
            return "story-\(story?.id ?? "")"
        }

        /// True when there is something here to spend a buzz on.
        var takesBuzz: Bool {
            guard let story else { return false }
            return story.status != .shownFalse
        }
    }

    /// The order the whole feed reads in, among stories: most buzzed first,
    /// then the date's own history ahead of the news feeds, then arrival,
    /// then identifier so the order is the same on every load.
    ///
    /// The same comparison the website makes. One buzz beats any priority,
    /// which is the point of considering support first.
    static func before(_ a: WallStory, _ b: WallStory) -> Bool {
        if a.support != b.support { return a.support > b.support }
        if a.priority != b.priority { return a.priority > b.priority }
        if a.submittedAt != b.submittedAt { return a.submittedAt < b.submittedAt }
        return a.id < b.id
    }

    /// Every story that is not on the hive, in that order. All of it, no
    /// fold: a reddit reads its feed and so does this.
    static func waiting(_ stories: [WallStory]) -> [WallStory] {
        stories.filter { !$0.isOnHive }.sorted(by: before)
    }

    /// One story to the subject it stands for, when it stands for one.
    /// "historical_event:4821", the same shape `RememberSubject.key` makes,
    /// because the worker files a story against the row's own identifier in
    /// the row's own table and so does the timeline.
    static func subjectKey(_ story: WallStory) -> String? {
        guard let kind = story.subjectKind, let id = story.subjectID else { return nil }
        return "\(kind):\(id)"
    }

    /// The reader's own age line for every subject the timeline drew.
    ///
    /// A story that took a place on the hive is not drawn again in the feed
    /// under it, so the line that would have been on its row goes on its
    /// tile instead. "You were 7" is the one thing this app has that nothing
    /// else does, and the tile is the biggest thing on the screen.
    ///
    /// The first line for a subject wins. Two timeline rows for one subject
    /// should not happen, and if they do the reader sees the one the
    /// timeline put first rather than the one that happened to be last.
    static func ageLines(items: [DayFeed.Item]) -> [String: String] {
        var out: [String: String] = [:]
        for item in items {
            guard let subject = item.subject, let line = item.ageLabel else { continue }
            if out[subject.key] == nil { out[subject.key] = line }
        }
        return out
    }

    /// The line for one story, when the timeline drew its subject and the
    /// reader gave a birth year. Nil the rest of the time, which includes
    /// every news story, because the day's news has no subject.
    static func ageLine(for story: WallStory, lines: [String: String]) -> String? {
        guard let key = subjectKey(story) else { return nil }
        return lines[key]
    }

    /// The feed, built.
    ///
    /// `items` is the timeline in the order `DayFeed` put it in, and that
    /// order is not touched: it is arithmetic on the reader's age and it is
    /// the app's best surface. What this adds is which rows carry a buzz,
    /// what goes above them, and what goes below.
    static func build(items: [DayFeed.Item], stories: [WallStory]) -> [Row] {
        let onHive = Set(WallBoard.tiles(stories).map(\.id))
        var byKey: [String: WallStory] = [:]
        for story in stories {
            guard let key = subjectKey(story) else { continue }
            // Two stories for one subject should not happen: the worker keys
            // a history story by its subject exactly so it cannot be filed
            // twice. If it ever does, the feed shows the one the feed's own
            // order would show first rather than whichever arrived last.
            if let seen = byKey[key], before(seen, story) { continue }
            byKey[key] = story
        }

        var rows: [Row] = []
        var used: Set<String> = []

        // This year's rows first: the day's news, which has no subject and no
        // place in a timeline ranked by the reader's age.
        for story in waiting(stories) where subjectKey(story) == nil {
            rows.append(Row(item: nil, story: story))
            used.insert(story.id)
        }

        // Then the timeline, in its own order, each row carrying its story.
        for item in items {
            let story = item.subject.flatMap { byKey[$0.key] }
            if let story, onHive.contains(story.id) { continue }
            if let story { used.insert(story.id) }
            rows.append(Row(item: item, story: story))
        }

        // Then anything the worker filed that the timeline did not draw. The
        // worker takes twelve people a date and the timeline may hold other
        // ones, and a filed story with nowhere to be buzzed is not one feed.
        for story in waiting(stories) where !used.contains(story.id) {
            rows.append(Row(item: nil, story: story))
        }

        return rows
    }
}

// MARK: - What the hive says

/// The sentences the hive says, in one place, so the views carry none.
///
/// Every one of them takes a voice, because the same screen says "buzz" on
/// September 8 and "tap" on September 11 and nothing else about it changes.
enum HiveCopy {

    private static let words = ["No", "One", "Two", "Three", "Four"]

    /// How much support a story has, in the reader's own word for it, or nil
    /// when nobody has backed it.
    ///
    /// Nil rather than "0 buzzes". Seventy tiles each saying nought was the
    /// whole of what the first board communicated, and a story nobody has
    /// backed yet is not a story with a score of zero.
    static func count(_ support: Int, voice: HiveVoice) -> String? {
        guard support > 0 else { return nil }
        return support == 1 ? "1 \(voice.one)" : "\(support) \(voice.many)"
    }

    /// The remaining count, said so it means something.
    ///
    /// An allowance of one is the day after the date, and that is the screen
    /// whose count needs "on this date" to make sense, because the reader may
    /// still have three on today's.
    static func left(_ left: Int, allowance: Int, voice: HiveVoice) -> String {
        let n = max(0, min(left, words.count - 1))
        let unit = n == 1 ? voice.one : voice.many
        let dayAfter = allowance == 1
        if n == 0 {
            return dayAfter ? "No \(voice.many) left today on this date." : "No \(voice.many) left today."
        }
        return dayAfter
            ? "\(words[n]) \(unit) left today on this date. It closes tonight."
            : "\(words[n]) \(unit) left today."
    }

    /// What the screen says about the reader's allowance, by phase.
    static func allowance(_ left: Int, allowance: Int, phase: WallDay.Phase, voice: HiveVoice) -> String {
        switch phase {
        case .notYetOpen: return "This hive has not opened yet."
        case .submissionsOnly: return "Stories only until the date arrives. \(voice.many.capitalizedFirst) start then."
        case .closed: return "This hive has sealed and is permanent now."
        case .live: return Self.left(left, allowance: allowance, voice: voice)
        }
    }

    /// The sentence over the full screen hive, on a date taking support.
    ///
    /// It used to be the fourth line above the field on the Today tab, where
    /// it asked the question the field asks. One question on that screen,
    /// and the field is the one a reader can act on, so this is said where
    /// the board is the whole page.
    static func lede(dateName: String, voice: HiveVoice) -> String {
        "\(voice.imperative) what you think will still matter about \(dateName) years from now."
            + " Each \(voice.one) makes it bigger on the hive, and you get a few a day."
    }

    /// What state the hive is in, above the board, on a date where the field
    /// is not drawn. On a live date nothing says this above the board: the
    /// field is the heading and the seal is on the confirmation, where it is
    /// a term of the spend rather than a warning over an empty line.
    static func state(phase: WallDay.Phase, ending: String, voice: HiveVoice) -> String {
        switch phase {
        case .closed: return "Sealed at midnight Eastern ending \(ending). Permanent."
        case .notYetOpen: return "Not open yet."
        case .submissionsOnly:
            return "Open for stories. \(voice.many.capitalizedFirst) start when the date arrives, Eastern time."
        case .live: return "Open. Seals at midnight Eastern ending \(ending), then permanent."
        }
    }

    /// The sentence above the board on a date that is not taking support.
    static func quietLede(dateName: String, phase: WallDay.Phase, voice: HiveVoice) -> String {
        switch phase {
        case .notYetOpen, .submissionsOnly:
            return "Tomorrow's hive for \(dateName). When the date arrives, the \(voice.many) people give"
                + " decide how much of the hive each story holds."
        default:
            return "What people here thought would still matter about \(dateName). Each story is a link to a"
                + " source, in the source's own words. Support decided how much of the hive it holds."
        }
    }

    /// The one line under the board. The tier chip came off the tile, so the
    /// legend is the only place that says what a colour means.
    static let legend = "A tile's colour is its tier, and a tier is not a verdict."

    /// What the feed under the hive is, said once.
    static func feedNote(dateName: String, phase: WallDay.Phase, voice: HiveVoice) -> String {
        let what = "Everything with a birthday on \(dateName): the day's news, and what happened,"
            + " who was born and what came out on this date before."
        switch phase {
        case .live:
            return what + " A \(voice.one) here counts the same as one on the hive,"
                + " and the hive makes room for what people back."
        case .closed:
            return what + " The hive has sealed, so the feed takes no more."
        case .notYetOpen, .submissionsOnly:
            return what + " When the hive opens, every one of these takes \(voice.many)."
        }
    }

    static func empty(phase: WallDay.Phase, voice: HiveVoice) -> String {
        switch phase {
        case .closed: return "Nothing reached the hive before it sealed."
        case .notYetOpen, .submissionsOnly: return "Opens when the date arrives. What people \(voice.past) lands here."
        case .live: return "Nothing on the hive yet. What people \(voice.past) lands here."
        }
    }

    static func nothingWaiting(dateName: String) -> String {
        "Everything filed for \(dateName) is on the hive."
    }

    static let noHive = "This date has no hive yet. Its first one opens the day before it arrives,"
        + " takes everything with a birthday that day and the buzzes people give it, and seals two days later,"
        + " for good."

    /// Said once beside the sources, and never a claim about what is true.
    static let receiptNote = "The wording is the source's, never a person's. A check confirms that a link"
        + " resolves and that the page contains the quotation, by exact match. Nothing here decides what is true."

    static let openTheHive = "Open the hive full screen"

    // MARK: The typed field, docs/the-wall.md section 15

    /// The question over the field. A recall task rather than a recognition
    /// task: everybody has an answer to this before they open the app.
    static func ask(dateName: String) -> String {
        "What mattered about \(dateName)?"
    }

    static let askPlaceholder = "A name, a place, a few words"

    /// Under the field while it is focused, so the reader knows what typing
    /// costs: nothing. Not drawn over a field nobody has touched; a
    /// sentence about spending in front of an empty line made the line feel
    /// like a form. The cost of the buzz itself is `terms`, on the
    /// confirmation.
    ///
    /// The one argument form is the one the sentence sweep in
    /// `BirthedTests` names; it says the same thing without the date.
    static func askHint(dateName: String, voice: HiveVoice) -> String {
        "Typing spends nothing. The hive finds the story among what is filed for \(dateName)"
            + " and shows it back before a \(voice.one) is spent."
    }

    static func askHint(voice: HiveVoice) -> String {
        askHint(dateName: "the date", voice: voice)
    }

    /// Not drawn. There is no Find button: Return asks, and a button beside
    /// the field was a second control doing the field's job. The word stays
    /// only because the sentence sweep in `BirthedTests` names it, and that
    /// directory is not this pass's to edit. Retire it with the test.
    static let find = "Find"

    /// Over the chips. A blank line with a cursor intimidates people, and the
    /// chips are a way in for somebody with no answer yet.
    static let orStartFrom = "Or one of these, from the hive:"

    static let found = "Is this the one?"

    static let severalFound = "A few stories say that. Which one did you mean?"

    /// A query of stop words alone. Not a miss: it never asked anything.
    static let tooCommon = "Those words are too common to search on. Try a name, a place or what happened."

    /// The miss, and it is the front door to submission rather than an
    /// error. If people keep typing about something the feeds did not carry,
    /// that is the only editorial signal here that comes from a person.
    static func miss(dateName: String) -> String {
        "Nothing filed for \(dateName) says that. If you have a link to it, add it and it is filed for the date."
    }

    static let addWithLink = "Add a story with a link"

    /// The heading on the confirmation. The confirmation is not optional:
    /// a silent wrong match spends something permanent on what the reader
    /// did not mean.
    static func confirm(voice: HiveVoice) -> String {
        "Spend one \(voice.one) on this?"
    }

    static let irreversible = "What is spent cannot be taken back."

    /// The terms, under the button on the confirmation: that a buzz cannot
    /// be taken back, and when the hive seals. Both used to be above the
    /// field, before the reader had typed a thing, which is the wrong
    /// moment for a warning about a cost. `ending` is the name of the day
    /// the hive seals at the end of.
    static func terms(ending: String, voice: HiveVoice) -> String {
        "A \(voice.one) cannot be taken back. The hive seals at midnight Eastern ending \(ending),"
            + " then it is permanent."
    }

    static let notThisOne = "Not this one"

    // MARK: Taking a misclick back, docs/the-wall.md, the last entry in section 16

    /// The button. One word, and the plainest one there is, because a reader
    /// looking for it is a reader who has just done something they did not
    /// mean and is not in the mood to read a label.
    static let undo = "Undo"

    /// Under the button, while it is up. It says how long, so nobody is left
    /// wondering whether it will still be there in a minute, and it says what
    /// the window is for, so nobody treats it as a way to shop the board.
    static let undoWindow = "Thirty seconds, for a tap you did not mean."

    /// After the database has taken it back.
    static func undone(voice: HiveVoice) -> String {
        "Taken back. That \(voice.one) is gone and you have it again."
    }

    /// Past the window, or a story this account never buzzed. One sentence
    /// for both, because from a screen they are the same answer, which is
    /// the reasoning the database gives for answering both in one word.
    static func tooLate(voice: HiveVoice) -> String {
        "That one stands. A \(voice.one) can be taken back for thirty seconds after it is cast."
    }

    /// After the database has taken it.
    static let counted = "That counts. The hive redraws on the quarter hour, so a bigger tile takes a few"
        + " minutes to show; your mark is there now."

    /// A story shown false is still the story the reader meant, so it is
    /// found and shown, and this is what the confirmation says instead of a
    /// button.
    static func takesNone(voice: HiveVoice) -> String {
        "This story has been shown false and takes no \(voice.many)."
    }

    /// A story this install already backed, on the confirmation.
    static func alreadyBacked(voice: HiveVoice) -> String {
        "\(voice.mark). One story takes one \(voice.one) from this account."
    }

    // MARK: The morning after a hive seals, docs/the-wall.md section 15

    private static let ordinals = [
        "", "first", "second", "third", "fourth", "fifth", "sixth",
        "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth",
    ]

    private static let counts = [
        "", "one", "two", "three", "four", "five", "six",
        "seven", "eight", "nine", "ten", "eleven", "twelve",
    ]

    /// The banner's first line. The date, and the one thing that happened to
    /// it: it is over.
    static func sealedTitle(dateName: String) -> String {
        "Your \(dateName) hive sealed"
    }

    /// What the banner says underneath, and it says only what is known.
    ///
    /// Three sentences for three states, and the difference between the first
    /// two is the whole of the honesty here. A hive that has sealed cannot
    /// change, so a place read after it sealed is a fact and is said flatly.
    /// A place read while it was still open can still move, so it is said as
    /// what it was when the reader last looked, which is true and is still
    /// worth telling them. A story that never took a place on the hive gets
    /// no number at all: it is not last, it was not in that race, and giving
    /// it a rank would be inventing one.
    ///
    /// No total, no streak, no comparison with anybody. Sections 6 and 8
    /// refuse every score and this is not one.
    static func sealedBody(place: HivePlace?, settled: Bool, headline: String, voice: HiveVoice) -> String {
        guard let place else {
            return "The story you \(voice.past): \(headline)"
        }
        let where_ = "\(ordinal(place.rank)) of \(count(place.outOf))"
        return settled
            ? "The story you \(voice.past) came \(where_)."
            : "The story you \(voice.past) was \(where_) when you last looked."
    }

    /// "third", and plain numerals past what a hive can hold, so a board that
    /// grows one day does not start saying "the thirteenth" wrongly.
    static func ordinal(_ n: Int) -> String {
        guard n >= 1, n < ordinals.count else { return "number \(n)" }
        return ordinals[n]
    }

    /// "twelve", and plain numerals past that, for the same reason.
    static func count(_ n: Int) -> String {
        guard n >= 1, n < counts.count else { return "\(n)" }
        return counts[n]
    }

    // MARK: The anniversary, docs/the-wall.md section 15

    /// The heading over what this install backed on this day in earlier
    /// years. Second person and quiet: it is one person's own memory and
    /// nobody else can see it.
    static let anniversaryHead = "You were here"

    /// Under the heading. It says the two things that make it not a score:
    /// only this reader sees it, and there is no number in it.
    static let anniversaryNote = "Only you can see this. It is on this phone and it is not a score."

    /// "You buzzed this, one year ago today".
    ///
    /// Years, because the anniversary is the same month and day in an earlier
    /// year, so the difference is always a whole number of years and never a
    /// number of days. Plain numerals past ten, which this app will not reach
    /// for another decade.
    static func anniversaryLine(from: WallDate, to: WallDate, voice: HiveVoice) -> String {
        let gap = to.year - from.year
        guard gap >= 1 else { return "" }
        let words = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]
        let said = gap < words.count ? words[gap] : "\(gap)"
        return "You \(voice.past) this, \(said) \(gap == 1 ? "year" : "years") ago today"
    }

    // MARK: Find it for me, docs/the-wall.md section 15 past the miss

    /// The button under the miss. It is offered beside the link button, not
    /// instead of it: a reader with an address in hand still has the short
    /// way.
    static let findForMe = "Find it for me"

    /// Under the button, before it is tapped. This is the one sentence that
    /// says text is about to leave the phone, and it is the whole of what
    /// leaves: the words and the date. Typing sends nothing; this button
    /// does, and it says so before it is pressed rather than after.
    static func findWillSearch(dateName: String) -> String {
        "This sends the words you typed and \(dateName) to a web search, and nothing else."
            + " Nothing you type is kept."
    }

    /// While the search runs. It takes tens of seconds; a spinner with no
    /// sentence beside it reads as a hang.
    static let finding = "Searching the web for a source. This takes a moment."

    /// Over the candidates. The wording promise is made here, before the
    /// pick, because the pick files it.
    static func findFound(voice: HiveVoice) -> String {
        "Found. Pick one and it is filed for the date in the page's own words."
            + " No \(voice.one) is spent until you say so."
    }

    /// The search ran and nothing held up. Still the front door to the link
    /// flow, because a reader may know where it is better than a search does.
    static func findNothing(dateName: String) -> String {
        "Nothing found on the web for that and \(dateName). If you have a link to it, add it and it is filed."
    }

    /// Out of searches: the month's, the day's, or this account's five.
    /// One sentence for all three, because which one it is does not change
    /// what the reader can do about it.
    static let findPaused = "Searching is paused for now. If you have a link, add it and it is filed."

    /// The function did not answer. Not retried on its own, because each
    /// try costs money and a reader can tap again.
    static let findFailed = "The search did not answer. Try again in a moment, or add a link."

    /// While the pick is being filed through the submit path, which reads
    /// the page. The same words the link flow uses for the same wait.
    static let findFiling = "Reading the page"

    /// Under a candidate, for a screen reader. Filing is a write and is
    /// said to be one; spending is not, and is said not to be.
    static func findPickHint(voice: HiveVoice) -> String {
        "Files this page for the date. The headline comes from the page. No \(voice.one) is spent."
    }

    /// A refusal from the server, in the reader's terms.
    ///
    /// The server's own sentences start with "wall:" and are plain by design;
    /// anything else is summarised rather than shown. Every sentence a reader
    /// can reach is in this account's own word for a unit.
    static func refusal(_ message: String, voice: HiveVoice = .bee) -> String {
        let lower = message.lowercased()
        if lower.contains("has closed") { return "This hive has sealed. Nothing more can be added to it." }
        if lower.contains("takes no boosts until the day") {
            return "\(voice.many.capitalizedFirst) for this date start when the day arrives, Eastern time."
        }
        if lower.contains("left on") || lower.contains("exceed the budget") {
            return "Your \(voice.many) on this date are spent for today."
        }
        if lower.contains("shown false") { return "That story has been shown false and takes no \(voice.many)." }
        if lower.contains("ten submissions") { return "Ten stories a day, and today's ten are spent." }
        if lower.contains("not open today") {
            return "That date is not open. A hive takes stories the day before, the day itself and the day after."
        }
        if lower.contains("could not be read") || lower.contains("answered") {
            return "That page could not be read. Check the link and try again."
        }
        if lower.contains("does not say what it is about") || lower.contains("nothing on it to quote")
            || lower.contains("fewer than twenty") {
            return "That page does not describe itself well enough to quote. Try the article's own address."
        }
        if lower.contains("not a web address") { return "That is not a web address." }
        if lower.contains("not been checked") || lower.contains("could not be verified")
            || lower.contains("not been attested") {
            return "This device could not be verified. Adding to the hive needs a real device."
        }
        if lower.contains("not signed in") { return "The account is not ready yet. Try again in a moment." }
        if lower.contains("search did not answer") || lower.contains("phrase is too short") { return findFailed }
        return "The hive refused that. Try again in a moment."
    }
}

/// One capital at the front and the rest left alone, so "buzzes" opens a
/// sentence without "Buzzes" having to be written beside "buzzes" everywhere.
/// Foundation's own capitalized would lowercase the rest of a word.
extension String {
    var capitalizedFirst: String {
        guard let first else { return self }
        return String(first).uppercased() + String(dropFirst())
    }
}
