import XCTest
@testable import BirthedDomain

final class BirthdayTextTests: XCTestCase {

    /// Fixed, because the two digit year rule needs to know roughly when now
    /// is and a test that changes answer on New Year's Day is not a test.
    private let now: Date = {
        var parts = DateComponents()
        parts.year = 2026
        parts.month = 6
        parts.day = 15
        return Calendar(identifier: .gregorian).date(from: parts)!
    }()

    private func read(_ text: String) -> [BirthdayText.Candidate] {
        BirthdayText.candidates(in: text, now: now)
    }

    func testTheShapesPeopleActuallyType() {
        let found = read("""
        Sam 3/14
        Priya - March 14
        Alex: 14 March 2003
        Jordan 12/25/1999
        Mia Dec 2
        """)
        XCTAssertEqual(found.count, 5)
        XCTAssertEqual(found.map(\.name), ["Sam", "Priya", "Alex", "Jordan", "Mia"])
        XCTAssertEqual(found[0].birthday.date.month, 3)
        XCTAssertEqual(found[0].birthday.date.day, 14)
        XCTAssertEqual(found[2].birthday.year, 2003)
        XCTAssertEqual(found[3].birthday.date.month, 12)
        XCTAssertEqual(found[3].birthday.date.day, 25)
        XCTAssertEqual(found[4].birthday.date.month, 12)
        XCTAssertEqual(found[4].birthday.date.day, 2)
    }

    func testANumberOverTwelveCanOnlyBeTheDay() {
        let found = read("Sam 14/3")
        XCTAssertEqual(found.first?.birthday.date.month, 3)
        XCTAssertEqual(found.first?.birthday.date.day, 14)
    }

    func testAnAmbiguousPairIsReadTheAmericanWay() {
        // 5/6 is genuinely either. This picks May 6 because that is where the
        // audience is, and the confirm screen shows the line it read so a
        // reader who meant June 5 can see that it did not.
        let found = read("Sam 5/6")
        XCTAssertEqual(found.first?.birthday.date.month, 5)
        XCTAssertEqual(found.first?.birthday.date.day, 6)
    }

    func testTwoDigitYearsLandInTheRightCentury() {
        XCTAssertEqual(read("Sam 3/14/03").first?.birthday.year, 2003)
        XCTAssertEqual(read("Sam 3/14/98").first?.birthday.year, 1998)
        XCTAssertEqual(read("Sam 3/14/26").first?.birthday.year, 2026)
    }

    func testFebruary29IsAReadableBirthdayAndFebruary30IsNot() {
        XCTAssertEqual(read("Robin 2/29").first?.birthday.date.day, 29)
        XCTAssertTrue(read("Robin 2/30").isEmpty)
        // "13/1" is not impossible, it is day first: nobody has a thirteenth
        // month, so the reader takes it as January 13, which is the rule the
        // reader documents. The first version of this test expected it to be
        // refused and was the only failing test in the suite.
        XCTAssertEqual(read("Robin 13/1").first?.birthday.date.month, 1)
        XCTAssertEqual(read("Robin 13/1").first?.birthday.date.day, 13)
        XCTAssertTrue(read("Robin 13/13").isEmpty)
    }

    func testALineWithNoDateIsNotAPerson() {
        XCTAssertTrue(read("happy birthday everyone").isEmpty)
        XCTAssertTrue(read("").isEmpty)
    }

    func testADateWithNoNameIsNotAPersonEither() {
        XCTAssertTrue(read("3/14").isEmpty)
        XCTAssertTrue(read("March 14").isEmpty)
    }

    func testAPhoneNumberIsNotABirthday() {
        // The obvious way to write the number rule also matches 555-1234, and
        // a contact list pasted in is full of those.
        XCTAssertTrue(read("Sam 555-1234").isEmpty)
    }

    func testListMarkersAreNotPartOfTheName() {
        XCTAssertEqual(read("1. Sam 3/14").first?.name, "Sam")
        XCTAssertEqual(read("- Sam 3/14").first?.name, "Sam")
        XCTAssertEqual(read("* Sam 3/14").first?.name, "Sam")
    }

    func testTheSamePersonTwiceIsOnePerson() {
        let found = read("""
        Sam 3/14
        sam 3/14
        """)
        XCTAssertEqual(found.count, 1)
    }

    func testTwoPeopleSharingADateAreStillTwoPeople() {
        let found = read("""
        Sam 3/14
        Priya 3/14
        """)
        XCTAssertEqual(found.count, 2)
    }

    func testEveryCandidateCarriesTheLineItWasReadFrom() {
        // The confirm screen shows this. A reader can only check a reading
        // they can see next to what it was read from.
        let found = read("  Priya - March 14  ")
        XCTAssertEqual(found.first?.line, "Priya - March 14")
    }

    func testAPastedNovelDoesNotBecomeTwoThousandFriends() {
        let many = (1...400).map { "Person \($0) 3/14" }.joined(separator: "\n")
        XCTAssertEqual(read(many).count, BirthdayText.maxCandidates)
    }
}
