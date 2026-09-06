import XCTest
@testable import BirthedDomain

/// The week the follow sheet asks about. Every interesting case is a calendar
/// case, which is why this is in the domain and not in the network layer.
final class UpcomingDatesTests: XCTestCase {

    private var utc: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }

    private func day(_ year: Int, _ month: Int, _ day: Int) -> Date {
        utc.date(from: DateComponents(year: year, month: month, day: day, hour: 12))!
    }

    func testTodayIsIncludedFirst() {
        // Somebody whose birthday is today is the most interesting person to
        // be offered, not the least.
        let dates = UpcomingDates.next(6, from: day(2026, 9, 6), calendar: utc)
        XCTAssertEqual(dates.first, CalendarDate(month: 9, day: 6))
        XCTAssertEqual(dates.count, 7, "today plus six")
    }

    func testItWalksOverTheEndOfAMonth() {
        let dates = UpcomingDates.next(6, from: day(2026, 9, 28), calendar: utc)
        XCTAssertEqual(dates, [
            CalendarDate(month: 9, day: 28)!, CalendarDate(month: 9, day: 29)!,
            CalendarDate(month: 9, day: 30)!, CalendarDate(month: 10, day: 1)!,
            CalendarDate(month: 10, day: 2)!, CalendarDate(month: 10, day: 3)!,
            CalendarDate(month: 10, day: 4)!,
        ])
    }

    func testItWalksOverTheEndOfAYear() {
        let dates = UpcomingDates.next(3, from: day(2026, 12, 30), calendar: utc)
        XCTAssertEqual(dates, [
            CalendarDate(month: 12, day: 30)!, CalendarDate(month: 12, day: 31)!,
            CalendarDate(month: 1, day: 1)!, CalendarDate(month: 1, day: 2)!,
        ])
    }

    func testFebruary29AppearsOnlyInALeapYear() {
        // 2028 is a leap year and 2026 is not. In a common year nobody
        // observes the date, so a countdown to it would count to nothing.
        let leap = UpcomingDates.next(3, from: day(2028, 2, 27), calendar: utc)
        XCTAssertTrue(leap.contains(CalendarDate(month: 2, day: 29)!))

        let common = UpcomingDates.next(3, from: day(2026, 2, 27), calendar: utc)
        XCTAssertFalse(common.contains(CalendarDate(month: 2, day: 29)!))
        XCTAssertTrue(common.contains(CalendarDate(month: 3, day: 1)!))
    }

    func testAWindowLongerThanAYearDoesNotAskTwice() {
        // A duplicate is a wasted clause in the query rather than a wrong
        // answer, but the query is built from this list so it should not have
        // any.
        let dates = UpcomingDates.next(400, from: day(2026, 5, 1), calendar: utc)
        XCTAssertEqual(dates.count, Set(dates).count)
        XCTAssertLessThanOrEqual(dates.count, 366)
    }

    func testZeroDaysIsJustToday() {
        XCTAssertEqual(UpcomingDates.next(0, from: day(2026, 9, 6), calendar: utc),
                       [CalendarDate(month: 9, day: 6)!])
        XCTAssertEqual(UpcomingDates.next(-1, from: day(2026, 9, 6), calendar: utc), [])
    }
}
