import XCTest
@testable import BirthedDomain

/// The People tab's arithmetic: the age gap, said from the reader's side and
/// right about the month and the day, and the names it is said with.
final class PersonDayTests: XCTestCase {
    private func born(_ year: Int?, _ month: Int, _ day: Int) -> CalendarBirthday {
        CalendarBirthday(month: month, day: day, year: year)!
    }

    func testAnOlderPersonIsSaidAsTheirAgeWhenYouArrived() {
        let reader = born(2002, 9, 4)
        XCTAssertEqual(PersonDay.ageGap(name: "Sam", theirs: born(1998, 9, 25), reader: reader),
                       "Sam was 3 when you were born.", "September 25 had not come round by September 4")
        XCTAssertEqual(PersonDay.ageGap(name: "Sam", theirs: born(1998, 9, 1), reader: reader),
                       "Sam was 4 when you were born.")
    }

    func testAYoungerPersonIsSaidAsYourAgeWhenTheyArrived() {
        XCTAssertEqual(PersonDay.ageGap(name: "Mia", theirs: born(2010, 1, 2), reader: born(2002, 9, 4)),
                       "You were 7 when Mia was born.")
    }

    func testUnderAYearIsNotSaidAsZero() {
        XCTAssertEqual(PersonDay.ageGap(name: "Jo", theirs: born(2003, 1, 10), reader: born(2002, 9, 4)),
                       "You were not yet one when Jo was born.")
        XCTAssertEqual(PersonDay.ageGap(name: "Jo", theirs: born(2002, 1, 10), reader: born(2002, 9, 4)),
                       "Jo was not yet one when you were born.")
        XCTAssertEqual(PersonDay.ageGap(name: "Jo", theirs: born(2002, 9, 4), reader: born(2002, 9, 4)),
                       "You and Jo were born on the same day.")
    }

    func testNoYearOnEitherSideSaysNothing() {
        XCTAssertNil(PersonDay.ageGap(name: "Sam", theirs: born(nil, 9, 25), reader: born(2002, 9, 4)))
        XCTAssertNil(PersonDay.ageGap(name: "Sam", theirs: born(1998, 9, 25), reader: born(nil, 9, 4)))
        XCTAssertNil(PersonDay.ageGap(name: "Sam", theirs: born(1998, 9, 25), reader: nil))
    }

    func testNames() {
        XCTAssertEqual(PersonDay.shortName("  Sam Rivera "), "Sam")
        XCTAssertEqual(PersonDay.possessive("Sam Rivera"), "Sam's")
        XCTAssertEqual(PersonDay.possessive("James"), "James'")
    }

    func testWeekdayNames() {
        var gregorian = Calendar(identifier: .gregorian)
        gregorian.locale = Locale(identifier: "en_US")
        XCTAssertEqual(PersonDay.weekdayName(6, calendar: gregorian), "Friday")
        XCTAssertNil(PersonDay.weekdayName(0, calendar: gregorian))
    }

    func testTheNextBirthdayLandsOnTheRightWeekday() {
        var gregorian = Calendar(identifier: .gregorian)
        gregorian.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        let day = PersonDay(calendar: BirthdayCalendar(calendar: gregorian, timeZone: gregorian.timeZone))
        let now = gregorian.date(from: DateComponents(year: 2026, month: 9, day: 22, hour: 12))!
        // September 25, 2026 is a Friday.
        XCTAssertEqual(day.nextWeekday(of: born(1998, 9, 25), from: now), 6)
    }
}
