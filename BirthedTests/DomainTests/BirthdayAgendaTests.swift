import XCTest
@testable import BirthedDomain

/// The ordering the whole People tab depends on. Tested against a fixed clock
/// rather than by waiting a year.
final class BirthdayAgendaTests: XCTestCase {
    private var agenda: BirthdayAgenda { BirthdayAgenda(calendar: calendarIn(losAngeles)) }

    private func person(_ name: String, _ month: Int, _ day: Int, year: Int? = nil) -> Person {
        Person(name: name, birthday: birthday(month, day, year: year))
    }

    func testSoonestFirstIgnoresTheOrderTheyWereAddedIn() {
        let people = [
            person("December", 12, 25),
            person("Tomorrow", 9, 5),
            person("Today", 9, 4),
            person("Next month", 10, 1),
        ]
        let ordered = agenda.soonestFirst(people, on: instant(2026, 9, 4, zone: losAngeles))
        XCTAssertEqual(ordered.map(\.name), ["Today", "Tomorrow", "Next month", "December"])
    }

    func testTheOrderWrapsAroundTheYearRatherThanEndingInDecember() {
        let people = [person("January", 1, 3), person("November", 11, 30)]
        let ordered = agenda.soonestFirst(people, on: instant(2026, 12, 20, zone: losAngeles))
        XCTAssertEqual(ordered.map(\.name), ["January", "November"])
    }

    func testTiesBreakByNameSoTheListDoesNotShuffleItself() {
        let people = [person("Zoe", 9, 4), person("Adam", 9, 4), person("mia", 9, 4)]
        let ordered = agenda.soonestFirst(people, on: instant(2026, 9, 4, zone: losAngeles))
        XCTAssertEqual(ordered.map(\.name), ["Adam", "mia", "Zoe"])
    }

    func testTodayIsEverybodyWhoseDayItIsLocally() {
        let people = [person("Today", 9, 4), person("Not today", 9, 5)]
        let celebrating = agenda.celebratingToday(people, on: instant(2026, 9, 4, zone: losAngeles))
        XCTAssertEqual(celebrating.map(\.name), ["Today"])
    }

    func testALeapDayFriendIsCelebratedOnTheObservedDay() {
        let leapling = Person(name: "Leapling", birthday: birthday(2, 29, observance: .february28))
        XCTAssertEqual(
            agenda.celebratingToday([leapling], on: instant(2027, 2, 28, zone: losAngeles)).count,
            1
        )
        XCTAssertTrue(
            agenda.celebratingToday([leapling], on: instant(2028, 2, 28, zone: losAngeles)).isEmpty,
            "in a leap year the observed day is February 29 again"
        )
    }

    func testWithinIsInclusiveOfBothEnds() {
        let people = [person("Today", 9, 4), person("In seven", 9, 11), person("In eight", 9, 12)]
        let soon = agenda.within(7, of: people, on: instant(2026, 9, 4, zone: losAngeles))
        XCTAssertEqual(soon.map(\.name), ["Today", "In seven"])
    }

    func testAnEmptyListStaysEmpty() {
        XCTAssertTrue(agenda.soonestFirst([], on: instant(2026, 9, 4, zone: losAngeles)).isEmpty)
    }
}
