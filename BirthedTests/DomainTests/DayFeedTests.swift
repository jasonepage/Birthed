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
        XCTAssertEqual(years.last, 1917)
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

    func testFactsRankWithTheMemorableYearsAndByLikes() {
        let feed = DayFeed.build(
            facts: [fact(1, "Less liked.", likes: 1), fact(2, "More liked.", likes: 9)],
            events: [event(1917, "Long ago.")],
            people: [],
            songs: [],
            films: [],
            readerBirthYear: 2002
        )
        XCTAssertEqual(feed.map(\.id), ["fact-2", "fact-1", "event-1917-\(DayFeed.stableHash("Long ago."))"])
    }

    func testNewestFirstInsideAKindAndABand() {
        let feed = DayFeed.build(
            facts: [], events: [], people: [],
            songs: [song(2008, "Old"), song(2012, "New"), song(2010, "Middle")],
            films: [],
            readerBirthYear: 2002
        )
        XCTAssertEqual(feed.map(\.text), ["New", "Middle", "Old"])
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
}
