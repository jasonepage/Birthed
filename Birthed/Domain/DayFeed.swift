import Foundation

/// Everything the database knows about one calendar date, mixed into one
/// order with the reader's age on each item.
///
/// This is the Today tab. Every "on this day" product answers what happened
/// on September 6; Birthed knows the reader's birth year, so it answers what
/// happened on September 6 while they were alive and how old they were. "You
/// were 7. The Gotthard Road Tunnel opened today." The age is the mirror.
///
/// The order is arithmetic, not likes. The research in
/// `docs/what-readers-respond-to.md` says nothing can be steered by likes
/// below five thousand impressions, so this ranks by the reader's age at the
/// time: the years somebody remembers first, the years before they were born
/// last. Within a rank the kinds take turns, so the feed never becomes forty
/// events followed by thirty names, which is the failure the old screen had.
///
/// Pure. It is handed the rows and hands back the order. Nothing in here
/// fetches, and nothing in here may ever start a search: the tab walks from
/// date to date and a search costs money per date.
struct DayFeed {

    enum Kind: String, Equatable, CaseIterable {
        case fact, event, person, song, film
    }

    struct Item: Identifiable, Equatable {
        let id: String
        let kind: Kind
        /// The small heading over the item: "SPORT", "BORN TODAY", "NUMBER ONE".
        let kicker: String
        /// The year the item belongs to. Nil for a fact whose row carries none.
        let year: Int?
        /// "You were 7", "The year you were born", "4 years before you". Nil
        /// when the reader has no birth year or the item has no year.
        let ageLabel: String?
        /// The sentence, the name, or the title.
        let text: String
        /// The description, the artist, or the chart date. Optional.
        let detail: String?
        let sourceURL: URL?
        /// The `BirthFact` this came from, for likes and shares.
        let fact: BirthFact?
        /// The stable handle this row is remembered by, or nil when the row
        /// has no identity the database would recognise.
        ///
        /// Nil rather than a guess, and the interface draws no answer buttons
        /// on a row that has none. Missing buttons on one row is a small loss.
        /// A guessed handle is a large one, because two different rows sharing
        /// a handle merge their answers into one wrong number that nothing on
        /// screen would ever reveal. See `RememberSubject`.
        var subject: RememberSubject? = nil
        /// The cover, for a chart row that has one. A var with a default so
        /// the four other kinds of row keep constructing exactly as they did.
        var artworkURL: URL? = nil
        /// Where the record lives on Apple Music, when it was matched.
        var storeURL: URL? = nil
        /// Apple's thirty second sample, when there is one.
        var previewURL: URL? = nil
    }

    /// A row of `historical_events`.
    struct Event: Equatable {
        let year: Int?
        let description: String
        let sourceURL: URL?
        /// The row's own id in `historical_events`.
        ///
        /// Optional and last so that a caller which does not have one still
        /// compiles, and because a row without one simply cannot be
        /// remembered: `RememberSubject` explains why a hash of the wording is
        /// not a substitute. The website sends this same id, and the two must
        /// agree or the same event collects two separate piles of answers.
        var id: Int? = nil
    }

    // MARK: Ranking

    /// How much a year is worth to this reader. The band is a guess about
    /// nostalgia and is the one number here that should be tuned once share
    /// counts exist to tune it against.
    static func score(year: Int?, readerBirthYear: Int?) -> Int {
        guard let year else { return 2 }
        guard let born = readerBirthYear else {
            // No reader year. Recent first, because that is the best guess
            // about what a young audience remembers.
            return year >= 1990 ? 2 : 1
        }
        let age = year - born
        if age < 0 { return 0 }
        if (5...15).contains(age) { return 3 }
        if age <= 25 { return 2 }
        return 1
    }

    static func ageLabel(year: Int?, readerBirthYear: Int?) -> String? {
        guard let year, let born = readerBirthYear else { return nil }
        let age = year - born
        if age == 0 { return "The year you were born" }
        if age < 0 {
            let before = -age
            return before == 1 ? "The year before you" : "\(before) years before you"
        }
        return "You were \(age)"
    }

    // MARK: Building

    /// The feed, ranked and interleaved.
    ///
    /// Facts carry the year in their sentence and not in a column, so they
    /// are scored with the top band and placed by likes, with the one that
    /// measures the world against the reader first.
    /// `salt` deals the order inside each rank and kind. A new salt on every
    /// load means the same hundred rows read as a new feed each time the tab
    /// is opened or pulled down, which is the whole of what "fresh" costs
    /// here: nothing. The rank itself does not move, so the years somebody
    /// remembers still come first.
    static func build(
        facts: [BirthFact],
        events: [Event],
        people: [NotablePerson],
        songs: [ChartWeek],
        films: [ChartWeek],
        readerBirthYear: Int?,
        salt: UInt64 = 0
    ) -> [Item] {
        var items: [(score: Int, order: Int, item: Item)] = []

        // Likes order the facts once they have enough of them, and the rest
        // are dealt, the same rule as Mine. Older-than leads whatever the deal.
        for (index, fact) in FactOrder.order(facts, salt: salt).enumerated() {
            let item = Item(
                id: "fact-\(fact.id)",
                kind: .fact,
                kicker: kicker(forFactCategory: fact.category),
                year: nil,
                ageLabel: nil,
                text: fact.fact,
                detail: fact.sourceURL?.host(),
                sourceURL: fact.sourceURL,
                fact: fact,
                subject: RememberSubject(kind: .birthFact, id: String(fact.id))
            )
            // Facts rank with the reader's memorable years, because they are
            // the one kind somebody went looking for. Older-than is the
            // strongest sentence in the product and leads everything.
            let score = fact.category == "older_than" ? 4 : 3
            items.append((score, index, item))
        }

        for (index, event) in events.enumerated() {
            let item = Item(
                id: "event-\(event.year ?? 0)-\(stableHash(event.description))",
                kind: .event,
                kicker: "ON THIS DAY",
                year: event.year,
                ageLabel: ageLabel(year: event.year, readerBirthYear: readerBirthYear),
                text: event.description,
                detail: event.year.map(String.init),
                sourceURL: event.sourceURL,
                fact: nil,
                subject: event.id.map { RememberSubject(kind: .historicalEvent, id: String($0)) }
            )
            items.append((score(year: event.year, readerBirthYear: readerBirthYear), index, item))
        }

        for (index, person) in people.enumerated() {
            let item = Item(
                id: "person-\(person.id)",
                kind: .person,
                kicker: "BORN TODAY",
                year: person.birthYear,
                ageLabel: ageLabel(year: person.birthYear, readerBirthYear: readerBirthYear),
                text: person.name,
                detail: person.shortDescription,
                sourceURL: person.sourceURL,
                fact: nil,
                subject: RememberSubject(kind: .person, id: person.id)
            )
            // People keep their popularity order inside a rank, and a person
            // born in the reader's memorable years ranks like an event from
            // those years, which is what puts "born the year you turned 3"
            // where it belongs.
            items.append((score(year: person.birthYear, readerBirthYear: readerBirthYear), index, item))
        }

        for (index, week) in songs.enumerated() {
            items.append((score(year: week.year, readerBirthYear: readerBirthYear), index, chartItem(week, kind: .song, readerBirthYear: readerBirthYear)))
        }
        for (index, week) in films.enumerated() {
            items.append((score(year: week.year, readerBirthYear: readerBirthYear), index, chartItem(week, kind: .film, readerBirthYear: readerBirthYear)))
        }

        return settled(interleave(items, salt: salt))
    }

    /// The same deal `FactOrder` uses, over feed items. The ids are the
    /// stable thing about a row, so the deal depends on the set and the salt
    /// and not on the order the server sent them in.
    static func deal(_ items: [Item], salt: UInt64) -> [Item] {
        guard items.count > 1 else { return items }
        var dealt = items.sorted { $0.id < $1.id }
        var state = salt
        for index in stride(from: dealt.count - 1, to: 0, by: -1) {
            let swap = Int(FactOrder.next(&state) % UInt64(index + 1))
            dealt.swapAt(index, swap)
        }
        return dealt
    }

    private static func chartItem(_ week: ChartWeek, kind: Kind, readerBirthYear: Int?) -> Item {
        Item(
            id: "\(kind.rawValue)-\(week.year)",
            kind: kind,
            kicker: kind == .song ? "NUMBER ONE SONG" : "NUMBER ONE FILM",
            year: week.year,
            ageLabel: ageLabel(year: week.year, readerBirthYear: readerBirthYear),
            text: week.song,
            detail: week.artist.isEmpty ? String(week.year) : "\(week.artist), \(week.year)",
            sourceURL: nil,
            fact: nil,
            subject: week.subjectID.map { RememberSubject(kind: .chartNumberOne, id: $0) },
            artworkURL: week.artworkURL,
            storeURL: week.storeURL,
            previewURL: week.previewURL
        )
    }

    /// Words that keep a row out of the first position.
    ///
    /// The list itself now lives in `Screening`, next to the two stricter
    /// lists the cards and the reveal lines use, because the same refusal was
    /// written here and again on the website and the two copies had already
    /// drifted apart. This is the loosest of the three and it is unchanged:
    /// 41 percent of the 19,734 imported events match it, which is why it is
    /// used here to move one row rather than to remove eight thousand.
    static func isHeavy(_ text: String) -> Bool {
        Screening.heavy(text)
    }

    /// Moves a heavy row out of the first position, and changes nothing else.
    ///
    /// The first row of this feed is set large and carries the reader's age
    /// beside it, so on somebody's own birthday the top of the screen can read
    /// "You were 7" over a mass casualty. That is the actual problem, and it
    /// lives in one position rather than throughout the list.
    ///
    /// Deliberately not a filter over the whole feed. This tab is a record of
    /// what happened on a date, and 41 percent of the events match the list, so
    /// filtering it would take September 11 off September 11 and Pearl Harbor
    /// off December 7. A history feed that has been emptied of history is not
    /// safer, it is broken, and it is the kind of broken somebody screenshots.
    /// The share cards are the opposite case and are filtered completely: a
    /// card is one line, it is a celebration rather than a record, and it
    /// travels on its own into places nobody chose.
    ///
    /// To filter the whole feed instead, this becomes
    /// `items.filter { !isHeavy($0.text) }`. One line, and it should not be
    /// changed without looking at what December 7 turns into.
    static func settled(_ items: [Item]) -> [Item] {
        guard let first = items.first, isHeavy(first.text) else { return items }
        guard let lighter = items.firstIndex(where: { !isHeavy($0.text) }) else { return items }
        var reordered = items
        let lifted = reordered.remove(at: lighter)
        reordered.insert(lifted, at: 0)
        return reordered
    }

    /// Highest score first. Inside a score the kinds take turns, each kind
    /// keeping its own order, and a kind that runs out stops taking turns.
    /// Inside a kind and a score the rows are dealt by the salt, except facts,
    /// which arrive already ordered.
    private static func interleave(_ scored: [(score: Int, order: Int, item: Item)], salt: UInt64) -> [Item] {
        var result: [Item] = []
        let scores = Set(scored.map(\.score)).sorted(by: >)
        for score in scores {
            let band = scored.filter { $0.score == score }
            var queues: [Kind: [Item]] = [:]
            for kind in Kind.allCases {
                let inOrder = band
                    .filter { $0.item.kind == kind }
                    .sorted { $0.order < $1.order }
                    .map(\.item)
                queues[kind] = kind == .fact ? inOrder : deal(inOrder, salt: salt &+ UInt64(score) &* 31)
            }
            var progressed = true
            while progressed {
                progressed = false
                for kind in Kind.allCases {
                    guard var queue = queues[kind], !queue.isEmpty else { continue }
                    result.append(queue.removeFirst())
                    queues[kind] = queue
                    progressed = true
                }
            }
        }
        return result
    }

    // MARK: Words

    /// The category the fact finder stored, as a heading.
    static func kicker(forFactCategory category: String) -> String {
        switch category {
        case "older_than": return "OLDER THAN"
        case "release": return "RELEASED"
        case "sport": return "SPORT"
        case "science": return "SCIENCE"
        case "price": return "PRICES"
        case "weather": return "WEATHER"
        case "local": return "NEAR YOU"
        case "record": return "RECORD"
        default: return "ON THIS DAY"
        }
    }

    /// A short stable key for a sentence. `Hasher` is seeded per launch and
    /// an id that changed between two loads would make the list jump.
    static func stableHash(_ text: String) -> String {
        var hash: UInt32 = 2_166_136_261
        for byte in text.utf8 {
            hash ^= UInt32(byte)
            hash = hash &* 16_777_619
        }
        return String(hash, radix: 16)
    }
}
