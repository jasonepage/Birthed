import XCTest
@testable import BirthedDomain

final class NotableMixTests: XCTestCase {

    private func match(_ name: String, _ description: String?) -> NotableMatch {
        NotableMatch(
            person: NotablePerson(
                id: "Q\(name.count)\(name)",
                name: name,
                birthYear: 2000,
                deathYear: nil,
                shortDescription: description,
                sourceURL: URL(string: "https://www.wikidata.org/wiki/Q1")!,
                contentLicense: "CC0"
            ),
            birthDate: CalendarDate(month: 6, day: 1)!
        )
    }

    func testTheSentenceWikidataWritesIsEnoughToTellThemApart() {
        XCTAssertEqual(NotableMix.kind(of: "English footballer (born 2003)"), .sport)
        XCTAssertEqual(NotableMix.kind(of: "American TikToker, activist, and home repair educator"), .internetNative)
        XCTAssertEqual(NotableMix.kind(of: "British singer, songwriter and musician"), .music)
        XCTAssertEqual(NotableMix.kind(of: "American actor"), .screen)
        XCTAssertEqual(NotableMix.kind(of: "Norwegian politician"), .everybodyElse)
        XCTAssertEqual(NotableMix.kind(of: nil), .everybodyElse)
    }

    func testSomebodyWhoIsBothIsOfferedAsTheMoreSurprisingHalf() {
        // A YouTuber who also sings is offered as a YouTuber. Reading the
        // terms in order is what decides that, so it is worth pinning.
        XCTAssertEqual(NotableMix.kind(of: "American YouTuber and singer"), .internetNative)
    }

    func testAListOfNothingButFootballersStopsBeingAListOfNothingButFootballers() {
        // The real query returned Haaland, Bellingham, Sinner, Cucurella,
        // Paredes and Zverev. This is that list with three other people in it
        // much further down, which is what the database actually looks like.
        var people = (1...20).map { match("Footballer \($0)", "English footballer") }
        people.append(match("A Singer", "American singer and songwriter"))
        people.append(match("A Creator", "American YouTuber"))
        people.append(match("An Actor", "American actor"))

        let mixed = NotableMix.spread(people, limit: 6)
        let names = mixed.map(\.person.name)
        XCTAssertTrue(names.contains("A Creator"))
        XCTAssertTrue(names.contains("A Singer"))
        XCTAssertTrue(names.contains("An Actor"))
        let footballers = names.filter { $0.hasPrefix("Footballer") }
        XCTAssertLessThanOrEqual(footballers.count, 3, "not a team sheet any more")
    }

    func testPopularityOrderInsideAKindIsNeverSecondGuessed() {
        let people = [
            match("First", "American singer"),
            match("Second", "American singer"),
            match("Third", "American singer"),
        ]
        XCTAssertEqual(NotableMix.spread(people, limit: 3).map(\.person.name),
                       ["First", "Second", "Third"])
    }

    func testAListOfOneKindStillComesBackWholeRatherThanShort() {
        let people = (1...5).map { match("Footballer \($0)", "English footballer") }
        XCTAssertEqual(NotableMix.spread(people, limit: 5).count, 5)
    }

    func testAskingForMoreThanExistsReturnsWhatExists() {
        let people = [match("Only", "American singer")]
        XCTAssertEqual(NotableMix.spread(people, limit: 10).count, 1)
        XCTAssertTrue(NotableMix.spread([], limit: 10).isEmpty)
    }
}
