import XCTest
@testable import BirthedDomain

/// The Today feed: everything about a date, ranked by the reader's age.
final class DayFeedTests: XCTestCase {

    private func fact(_ id: Int, _ text: String, category: String = "event", likes: Int = 0) -> BirthFact {
        BirthFact(id: id, fact: text, category: category, sourceURL: URL(string: "https://example.org/\(id)"),
                  regionKey: "", likes: likes, likedByMe: false)
    }

    private func event(_ year: Int?, _ text: String) -> DayFeed.Event {
        DayFeed.Event(year: year, description: text, sourceURL: URL(string: "https://en.wikipedia.org/wiki/September_5"))
    }

    private func person(_ id: String, _ name: String, born: Int?) -> NotablePerson {
        NotablePerson(id: id, name: name, birthYear: born, deathYear: nil, shortDescription: "somebody",
                      sourceURL: URL(string: "https://www.wikidata.org/wiki/\(id)")!, contentLicense: "CC0")
    }

    private func song(_ year: Int, _ title: String) -> ChartWeek {
        ChartWeek(date: CalendarDate(month: 9, day: 6)!, year: year, song: title, artist: "Somebody")
    }

    private func film(_ year: Int, _ title: String) -> ChartWeek {
        ChartWeek(date: CalendarDate(month: 9, day: 7)!, year: year, song: title, artist: "", chart: "US box office")
    }

    // MARK: Age

    func testTheAgeLabelIsWrittenForTheReader() {
        XCTAssertEqual(DayFeed.ageLabel(year: 2009, readerBirthYear: 2002), "You were 7")
        XCTAssertEqual(DayFeed.ageLabel(year: 2002, readerBirthYear: 2002), "The year you were born")
        XCTAssertEqual(DayFeed.ageLabel(year: 2001, readerBirthYear: 2002), "The year before you")
        XCTAssertEqual(DayFeed.ageLabel(year: 1998, readerBirthYear: 2002), "4 years before you")
        XCTAssertNil(DayFeed.ageLabel(year: 1998, readerBirthYear: nil))
        XCTAssertNil(DayFeed.ageLabel(year: nil, readerBirthYear: 2002))
    }

    func testTheYearsSomebodyRemembersScoreHighest() {
        XCTAssertEqual(DayFeed.score(year: 2010, readerBirthYear: 2002), 3)
        XCTAssertEqual(DayFeed.score(year: 2003, readerBirthYear: 2002), 2)
        XCTAssertEqual(DayFeed.score(year: 2024, readerBirthYear: 2002), 2)
        XCTAssertEqual(DayFeed.score(year: 1972, readerBirthYear: 2002), 0)
        XCTAssertEqual(DayFeed.score(year: 2030, readerBirthYear: 2002), 1)
    }

    func testWithoutAReaderYearRecentComesFirst() {
        XCTAssertEqual(DayFeed.score(year: 2010, readerBirthYear: nil), 2)
        XCTAssertEqual(DayFeed.score(year: 1972, readerBirthYear: nil), 1)
    }

    // MARK: Order

    func testWhatHappenedWhileTheyWereAChildComesBeforeWhatHappenedBeforeThem() {
        let feed = DayFeed.build(
            facts: [],
            events: [event(1972, "Munich."), event(2010, "Something in 2010."), event(1917, "Liu Yan.")],
            people: [],
            songs: [song(2010, "Love the Way You Lie"), song(1972, "Alone Again")],
            films: [],
            readerBirthYear: 2002
        )
        let years = feed.compactMap(\.year)
        XCTAssertEqual(years.prefix(2).sorted(), [2010, 2010])
        // The three from before the reader was born are the last three,
        // dealt among themselves.
        XCTAssertEqual(Array(years.suffix(3)).sorted(), [1917, 1972, 1972])
    }

    func testKindsTakeTurnsInsideARank() {
        let feed = DayFeed.build(
            facts: [],
            events: (2007...2012).map { (year: Int) in event(year, "Event in \(year) that is long enough.") },
            people: [person("Q1", "A", born: 2008), person("Q2", "B", born: 2009)],
            songs: (2007...2012).map { song($0, "Song \($0)") },
            films: (2007...2012).map { film($0, "Film \($0)") },
            readerBirthYear: 2002
        )
        // Every one of those is in the same band, so the first four are one
        // of each kind rather than six events in a row.
        let kinds = feed.prefix(4).map(\.kind)
        XCTAssertEqual(Set(kinds).count, 4, "\(kinds)")
    }

    func testOlderThanLeadsEverything() {
        let feed = DayFeed.build(
            facts: [fact(1, "A comet was seen.", category: "science", likes: 50),
                    fact(2, "You are older than Kingdom Hearts.", category: "older_than")],
            events: [event(2009, "Something.")],
            people: [person("Q1", "A", born: 2009)],
            songs: [song(2009, "Boom Boom Pow")],
            films: [],
            readerBirthYear: 2002
        )
        XCTAssertEqual(feed.first?.fact?.id, 2)
        XCTAssertEqual(feed.first?.kicker, "OLDER THAN")
    }

    func testFactsRankWithTheMemorableYearsAndByLikesOnceTheyHaveEnough() {
        // Six and nine likes both count, so the order is by likes whatever
        // the salt. One like would not count and would be dealt.
        let feed = DayFeed.build(
            facts: [fact(1, "Less liked.", likes: 6), fact(2, "More liked.", likes: 9)],
            events: [event(1917, "Long ago.")],
            people: [],
            songs: [],
            films: [],
            readerBirthYear: 2002,
            salt: 12345
        )
        XCTAssertEqual(feed.map(\.id), ["fact-2", "fact-1", "event-1917-\(DayFeed.stableHash("Long ago."))"])
    }

    func testTheSameSaltDealsTheSameFeedAndAnotherSaltDealsAnother() {
        let songs = (2007...2015).map { song($0, "Song \($0)") }
        let first = DayFeed.build(facts: [], events: [], people: [], songs: songs, films: [],
                                  readerBirthYear: 2002, salt: 1)
        let again = DayFeed.build(facts: [], events: [], people: [], songs: songs, films: [],
                                  readerBirthYear: 2002, salt: 1)
        XCTAssertEqual(first.map(\.id), again.map(\.id))

        // Nine rows and twenty salts: if the lead never changes it is not a
        // deal. One repeat is fine; eighteen is a bug.
        let leads = Set((1...20).map { salt in
            DayFeed.build(facts: [], events: [], people: [], songs: songs, films: [],
                          readerBirthYear: 2002, salt: UInt64(salt) * 7919).first!.id
        })
        XCTAssertGreaterThan(leads.count, 3, "\(leads)")
    }

    func testTheDealNeverCrossesARank() {
        // Whatever the salt, a song from the memorable years comes before a
        // song from before the reader was born.
        let songs = [song(1972, "Before"), song(2010, "Remembered"), song(1980, "Also before")]
        for salt in 1...20 {
            let feed = DayFeed.build(facts: [], events: [], people: [], songs: songs, films: [],
                                     readerBirthYear: 2002, salt: UInt64(salt))
            XCTAssertEqual(feed.first?.text, "Remembered", "salt \(salt)")
        }
    }

    // MARK: Identity

    func testEveryItemHasAUniqueStableID() {
        let build = {
            DayFeed.build(
                facts: [self.fact(1, "One."), self.fact(2, "Two.")],
                events: [self.event(2009, "A."), self.event(2009, "B."), self.event(nil, "No year, long enough.")],
                people: [self.person("Q1", "A", born: 2009), self.person("Q2", "B", born: nil)],
                songs: [self.song(2009, "S")],
                films: [self.film(2009, "F")],
                readerBirthYear: 2002
            )
        }
        let first = build()
        let second = build()
        XCTAssertEqual(Set(first.map(\.id)).count, first.count)
        XCTAssertEqual(first.map(\.id), second.map(\.id))
        XCTAssertEqual(first.count, 9)
    }

    func testAPersonWithNoYearHasNoAgeLabelAndStillAppears() {
        let feed = DayFeed.build(facts: [], events: [], people: [person("Q9", "Unknown", born: nil)],
                                 songs: [], films: [], readerBirthYear: 2002)
        XCTAssertEqual(feed.count, 1)
        XCTAssertNil(feed.first?.ageLabel)
    }

    func testTheEmptyFeedIsEmpty() {
        XCTAssertTrue(DayFeed.build(facts: [], events: [], people: [], songs: [], films: [], readerBirthYear: nil).isEmpty)
    }

    // MARK: The first row

    /// The first row is set large and carries the reader's age beside it, so
    /// on somebody's own birthday the top of the screen can read "You were 7"
    /// over a mass casualty. These four tests are about that one position.

    func testTheLeadRowIsNotAMassCasualty() {
        let events = [
            event(2022, "Ten people are killed and 15 are injured in a stabbing spree in Saskatchewan."),
            event(2020, "The PlayStation 5 is released."),
        ]
        let feed = DayFeed.build(facts: [], events: events, people: [], songs: [], films: [],
                                 readerBirthYear: 2002)
        XCTAssertEqual(feed.first?.text, "The PlayStation 5 is released.")
    }

    func testEverythingElseKeepsItsPlaceAndNothingIsRemoved() {
        // The heavy row is moved, not dropped. This tab is a record of what
        // happened on a date, and 41 percent of the imported events match the
        // word list, so removing them would take Pearl Harbor off December 7.
        let events = [
            event(2022, "Ten people are killed in a stabbing spree."),
            event(2020, "The PlayStation 5 is released."),
            event(1998, "Google is founded by Larry Page and Sergey Brin."),
        ]
        let feed = DayFeed.build(facts: [], events: events, people: [], songs: [], films: [],
                                 readerBirthYear: 2002)
        XCTAssertEqual(feed.count, 3, "nothing is removed from the record")
        XCTAssertTrue(feed.contains { $0.text.contains("stabbing spree") }, "the heavy row is still there")
        XCTAssertEqual(feed.first?.text, "The PlayStation 5 is released.")
    }

    func testADateWhereEverythingIsHeavyIsLeftAlone() {
        // Better a heavy first row than an empty screen. December 7 exists.
        let events = [
            event(1941, "The attack on Pearl Harbor kills 2,403 Americans."),
            event(1917, "A munitions explosion destroys much of Halifax."),
        ]
        let feed = DayFeed.build(facts: [], events: events, people: [], songs: [], films: [],
                                 readerBirthYear: 2002)
        XCTAssertEqual(feed.count, 2)
        XCTAssertTrue(feed.first?.text.contains("Pearl Harbor") == true
                      || feed.first?.text.contains("Halifax") == true)
    }

    func testTheWordListReadsWholeWordsOnly() {
        XCTAssertTrue(DayFeed.isHeavy("Ten people are killed in a stabbing spree."))
        XCTAssertTrue(DayFeed.isHeavy("Swissair Flight 306 crashes near Zurich."))
        XCTAssertFalse(DayFeed.isHeavy("The PlayStation 5 is released."))
        XCTAssertFalse(DayFeed.isHeavy("George Eastman registers the trademark Kodak."))
        // "deadline" contains "dead" and is not a casualty.
        XCTAssertFalse(DayFeed.isHeavy("The deadline for entries passes at midnight."))
        // "Shotwell" contains "shot".
        XCTAssertFalse(DayFeed.isHeavy("Gwynne Shotwell is named president of SpaceX."))
    }
}
