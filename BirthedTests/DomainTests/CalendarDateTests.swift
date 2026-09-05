import XCTest
@testable import BirthedDomain

final class CalendarDateTests: XCTestCase {

    func testAnImpossibleDateIsRefusedRatherThanClamped() {
        XCTAssertNil(CalendarDate(month: 13, day: 1))
        XCTAssertNil(CalendarDate(month: 0, day: 1))
        XCTAssertNil(CalendarDate(month: 1, day: 0))
        XCTAssertNil(CalendarDate(month: 1, day: 32))
        XCTAssertNotNil(CalendarDate(month: 2, day: 29))
    }

    func testWalkingForwardCrossesTheYearBoundary() {
        XCTAssertEqual(CalendarDate(month: 12, day: 31)?.advanced(byDays: 1),
                       CalendarDate(month: 1, day: 1))
    }

    func testWalkingBackwardCrossesTheYearBoundary() {
        XCTAssertEqual(CalendarDate(month: 1, day: 1)?.advanced(byDays: -1),
                       CalendarDate(month: 12, day: 31))
    }

    func testTheWalkIncludesFebruary29() {
        // The walk happens inside a leap year on purpose, so the cycle is all
        // 366 days and February 29 is reachable.
        XCTAssertEqual(CalendarDate(month: 2, day: 28)?.advanced(byDays: 1),
                       CalendarDate(month: 2, day: 29))
        XCTAssertEqual(CalendarDate(month: 2, day: 29)?.advanced(byDays: 1),
                       CalendarDate(month: 3, day: 1))
    }

    func testTodayReadsTheCalendarRatherThanAnOffset() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = kiritimati
        let today = CalendarDate.today(calendar: calendar, now: instant(2026, 9, 4, zone: kiritimati))
        XCTAssertEqual(today, CalendarDate(month: 9, day: 4))
    }

    func testDisplayNameUsesTheCalendarsOwnMonthNames() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "en_US")
        XCTAssertEqual(CalendarDate(month: 9, day: 4)?.displayName(calendar: calendar), "September 4")
    }
}
