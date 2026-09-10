import Foundation

/// What became of a buzz, and the one thing the reader hears about it after.
///
/// docs/the-wall.md section 15 named the gap this closes: a buzz has no
/// consequence at either end. The tile does not move for fifteen minutes, by
/// design, and then the date seals and the reader never hears about it again.
/// So when a date somebody buzzed on seals, the phone tells them once, the
/// next morning, at the hour their other reminders arrive.
///
/// Pure Swift, Foundation only. Where a story came and when a hive sealed are
/// both arithmetic, and arithmetic belongs where `swift test` can ask it
/// questions against a fixed clock rather than by waiting two days.
///
/// **Nothing here is a score.** Sections 6 and 8 refuse any accuracy, karma,
/// reputation or influence formula, and a place on one sealed hive is none of
/// those: it is what happened to one story on one date, told to the one
/// person who backed it and to nobody else. It is not kept as a total, it is
/// not compared against anybody, and it is never shown to another reader.

// MARK: - Where a story came

/// A story's place on a sealed hive, and how many stories it was placed
/// among.
struct HivePlace: Equatable {
    /// One based. First is the most backed story on the hive.
    let rank: Int
    /// How many stories took a place on the hive.
    let outOf: Int
}

enum HiveStanding {

    /// Where a story came among the stories that took a place on the hive, or
    /// nil when it took none.
    ///
    /// Among the hive's own stories rather than the date's, deliberately. A
    /// date carries a hundred and fifty stories and "forty seventh of a
    /// hundred and fifty" is a number that means nothing to anybody. The hive
    /// is the dozen the date came down to, so a place on it is a place worth
    /// saying. A story that never reached it has no rank at all, and the
    /// reader is told what is true instead of a number about a race it was
    /// not in.
    ///
    /// The order is `HiveFeed.before`: support, then priority, then arrival,
    /// then identifier. The same order the feed and the allocator use, so the
    /// number the reader is told is the order they could have seen for
    /// themselves.
    static func place(of storyID: String, in day: WallDay) -> HivePlace? {
        let placed = day.onHive.sorted(by: HiveFeed.before)
        guard let index = placed.firstIndex(where: { $0.id == storyID }) else { return nil }
        return HivePlace(rank: index + 1, outOf: placed.count)
    }
}

// MARK: - What this install remembers about its own buzz

/// One date this install buzzed on, and what it knows about how that turned
/// out.
///
/// Written when a buzz lands, so the notification can be scheduled from what
/// the phone already has and needs no network at the moment it fires. Read
/// again and corrected every time the app opens that date, which is the
/// reconciliation: a rank read while the hive was still open is a rank that
/// can still change, and one read after it sealed cannot.
struct HiveNote: Equatable, Codable {
    /// "2026-09-10", the key every wall table uses.
    let wallDate: String
    /// The story this install buzzed on that date. One, because one story
    /// takes one buzz from one install and the newest buzz is the one worth
    /// telling somebody about.
    var storyID: String
    /// Its headline as the phone last read it, so the notification says what
    /// was backed without asking the network at fire time.
    var headline: String
    /// When the hive seals, as the server said. Taken from the day row rather
    /// than worked out here: the server owns the clock and this phone's
    /// arithmetic about Eastern midnight is a second place for it to be
    /// wrong.
    var sealsAt: Date
    /// Where the story stood when the phone last looked, or nil if it had not
    /// taken a place on the hive then.
    var place: HivePlace?
    /// True once the reading behind `place` was of a hive that had already
    /// sealed, which is the only reading that cannot change again.
    var settled: Bool

    init(wallDate: String, storyID: String, headline: String, sealsAt: Date,
         place: HivePlace? = nil, settled: Bool = false) {
        self.wallDate = wallDate
        self.storyID = storyID
        self.headline = headline
        self.sealsAt = sealsAt
        self.place = place
        self.settled = settled
    }

    /// The calendar date the note is about.
    var date: WallDate? { WallDate(key: wallDate) }

    /// Whether the hive has sealed by `now`, which is when there is anything
    /// to say.
    func hasSealed(now: Date) -> Bool { now >= sealsAt }
}

extension HivePlace: Codable {}

/// Every note this install holds, by date.
///
/// Its own store rather than more fields on `HiveMarks`. The marks answer one
/// question, "did I buzz this", and they answer it for every story on a date;
/// this answers a different one, "what became of what I buzzed", and it holds
/// one story a date with more about it. Two stores, two jobs, and neither has
/// to grow a shape for the other's sake.
///
/// The trade is `HiveMarks`': this is what this install did. A reinstall
/// forgets it and a second device never knew it. The buzz is in the database
/// forever either way, so what is lost is being told about it and never the
/// vote.
struct HiveNotes: Equatable {
    private var byDate: [String: HiveNote]

    /// How many dates are kept. Longer than the marks' hundred and twenty,
    /// because a note has to outlive its own anniversary: a buzz on September
    /// 10, 2026 is worth mentioning on September 10, 2027, and a reader who
    /// buzzes every single day would otherwise have lost it by February. Four
    /// hundred dates of one note each is nothing on disk.
    static let datesKept = 400

    init() { byDate = [:] }

    init(notes: [HiveNote]) {
        byDate = [:]
        for note in notes where WallDate(key: note.wallDate) != nil {
            byDate[note.wallDate] = note
        }
        trim()
    }

    /// Sorted, so an unchanged write is byte for byte the same.
    var all: [HiveNote] { byDate.values.sorted { $0.wallDate < $1.wallDate } }

    var isEmpty: Bool { byDate.isEmpty }

    func note(on date: WallDate) -> HiveNote? { byDate[date.key] }

    /// Files a buzz. A second buzz on the same date replaces the note, because
    /// the newest is the one the reader will recognise when the phone tells
    /// them about it two days later.
    mutating func record(storyID: String, headline: String, on date: WallDate, sealsAt: Date) {
        var note = HiveNote(wallDate: date.key, storyID: storyID, headline: headline, sealsAt: sealsAt)
        // A place read for the story that is being replaced belongs to that
        // story and not to this one.
        note.place = nil
        note.settled = false
        byDate[date.key] = note
        trim()
    }

    /// Takes a note off, for a buzz that was taken back inside its window.
    /// A note about a buzz that no longer exists would wake somebody up to
    /// tell them about a vote they undid.
    mutating func forget(storyID: String, on date: WallDate) {
        guard let note = byDate[date.key], note.storyID == storyID else { return }
        byDate.removeValue(forKey: date.key)
    }

    /// The reconciliation. Corrects a note from a reading of the day, and
    /// marks it settled once that reading was of a sealed hive.
    ///
    /// A note already settled is left alone: a sealed hive cannot change, so
    /// a later reading that disagreed with it would be a worse reading rather
    /// than a newer fact.
    mutating func reconcile(with day: WallDay, now: Date) {
        guard var note = byDate[day.wallDate.key], !note.settled else { return }
        // A story the date no longer has is not a story to talk about. It can
        // only happen if the buzz was removed, which already forgets the note,
        // so this is the belt to that pair of braces.
        guard let story = day.stories.first(where: { $0.id == note.storyID }) else {
            byDate.removeValue(forKey: day.wallDate.key)
            return
        }
        note.headline = story.headline
        note.sealsAt = day.closesAt
        note.place = HiveStanding.place(of: note.storyID, in: day)
        note.settled = day.phase(now: now) == .closed
        byDate[day.wallDate.key] = note
    }

    /// What this install backed on the same day in earlier years, newest
    /// first. docs/the-wall.md section 15.
    ///
    /// The same month and day in an earlier year, compared as a month and a
    /// day rather than by subtracting a year, because subtracting a year from
    /// February 29 lands on a date that does not exist and the reader born on
    /// it is exactly the reader this product is for. The website's query does
    /// the same thing for the same reason.
    ///
    /// One story a date, because that is what a note holds: the newest buzz
    /// on that date. The website shows every one, because the database has
    /// every one. Widening a note to carry all three is what closes that
    /// difference if it ever matters, and it is written down here rather than
    /// left to be rediscovered.
    func anniversaries(of date: WallDate) -> [HiveNote] {
        byDate.values
            .filter { note in
                guard let on = note.date else { return false }
                return on.month == date.month && on.day == date.day && on.year < date.year
            }
            .sorted { $0.wallDate > $1.wallDate }
    }

    /// The newest dates only. Keys are "2026-09-10", so sorting them as text
    /// sorts them in time.
    private mutating func trim() {
        guard byDate.count > Self.datesKept else { return }
        let keep = Set(byDate.keys.sorted(by: >).prefix(Self.datesKept))
        byDate = byDate.filter { keep.contains($0.key) }
    }
}
