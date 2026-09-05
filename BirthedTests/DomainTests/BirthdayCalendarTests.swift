import XCTest
@testable import BirthedDomain

/// The cases NFR-003 names, plus the ones around them.
final class BirthdayCalendarTests: XCTestCase {

    // MARK: February 29, leap year

    func testLeapDayBirthdayInALeapYearFallsOnFebruary29() {
        let subject = calendarIn(losAngeles)
        let leapling = birthday(2, 29)
        let reference = instant(2028, 2, 1, zone: losAngeles)

        XCTAssertTrue(subject.isLeapYear(2028))
        XCTAssertEqual(subject.observedDate(for: leapling, in: 2028), CalendarDate(month: 2, day: 29))
        XCTAssertEqual(subject.daysUntil(leapling, from: reference), 28)
        XCTAssertTrue(subject.isBirthdayToday(leapling, on: instant(2028, 2, 29, zone: losAngeles)))
    }

    func testLeapDayBirthdayIgnoresTheObservanceSettingInALeapYear() {
        let subject = calendarIn(losAngeles)
        let marchLeapling = birthday(2, 29, observance: .march1)

        XCTAssertEqual(subject.observedDate(for: marchLeapling, in: 2028), CalendarDate(month: 2, day: 29))
        XCTAssertTrue(subject.isBirthdayToday(marchLeapling, on: instant(2028, 2, 29, zone: losAngeles)))
        XCTAssertFalse(subject.isBirthdayToday(marchLeapling, on: instant(2028, 3, 1, zone: losAngeles)))
    }

    // MARK: February 29, common year, both observances

    func testLeapDayBirthdayObservedOnFebruary28InACommonYear() {
        let subject = calendarIn(losAngeles)
        let leapling = birthday(2, 29, observance: .february28)

        XCTAssertFalse(subject.isLeapYear(2027))
        XCTAssertEqual(subject.observedDate(for: leapling, in: 2027), CalendarDate(month: 2, day: 28))
        XCTAssertEqual(subject.daysUntil(leapling, from: instant(2027, 2, 1, zone: losAngeles)), 27)
        XCTAssertTrue(subject.isBirthdayToday(leapling, on: instant(2027, 2, 28, zone: losAngeles)))
        XCTAssertFalse(subject.isBirthdayToday(leapling, on: instant(2027, 3, 1, zone: losAngeles)))
    }

    func testLeapDayBirthdayObservedOnMarch1InACommonYear() {
        let subject = calendarIn(losAngeles)
        let leapling = birthday(2, 29, observance: .march1)

        XCTAssertEqual(subject.observedDate(for: leapling, in: 2027), CalendarDate(month: 3, day: 1))
        XCTAssertEqual(subject.daysUntil(leapling, from: instant(2027, 2, 1, zone: losAngeles)), 28)
        XCTAssertFalse(subject.isBirthdayToday(leapling, on: instant(2027, 2, 28, zone: losAngeles)))
        XCTAssertTrue(subject.isBirthdayToday(leapling, on: instant(2027, 3, 1, zone: losAngeles)))
    }

    func testTheStoredBirthdayIsNeverRewritten() {
        // Read time resolution means the same value answers differently in
        // different years, with no migration in between.
        let subject = calendarIn(losAngeles)
        let leapling = birthday(2, 29)

        XCTAssertEqual(leapling.date, CalendarDate(month: 2, day: 29))
        XCTAssertEqual(subject.observedDate(for: leapling, in: 2027), CalendarDate(month: 2, day: 28))
        XCTAssertEqual(subject.observedDate(for: leapling, in: 2028), CalendarDate(month: 2, day: 29))
        XCTAssertEqual(leapling.date, CalendarDate(month: 2, day: 29))
    }

    // MARK: Year rollover

    func testDecember31RollsOverIntoJanuary1() {
        let subject = calendarIn(losAngeles)
        XCTAssertEqual(subject.daysUntil(birthday(1, 1), from: instant(2026, 12, 31, zone: losAngeles)), 1)
    }

    func testABirthdayJustGoneIsAlmostAFullYearAway() {
        let subject = calendarIn(losAngeles)
        // 2027 is a common year, so December 31 is 364 days after January 1.
        XCTAssertEqual(subject.daysUntil(birthday(12, 31), from: instant(2027, 1, 1, zone: losAngeles)), 364)
    }

    func testTodayCountsAsZeroDaysAway() {
        let subject = calendarIn(losAngeles)
        XCTAssertEqual(subject.daysUntil(birthday(9, 4), from: instant(2026, 9, 4, zone: losAngeles)), 0)
    }

    // MARK: Daylight saving, both directions

    func testCountdownIsCorrectAcrossSpringForward() {
        // Daylight saving begins in Los Angeles on March 14, 2027.
        let subject = calendarIn(losAngeles)
        XCTAssertEqual(subject.daysUntil(birthday(3, 14), from: instant(2027, 3, 13, zone: losAngeles)), 1)
        XCTAssertEqual(subject.daysUntil(birthday(3, 14), from: instant(2027, 2, 1, zone: losAngeles)), 41)
    }

    func testCountdownIsCorrectAcrossFallBack() {
        // Daylight saving ends in Los Angeles on November 7, 2027.
        let subject = calendarIn(losAngeles)
        XCTAssertEqual(subject.daysUntil(birthday(11, 7), from: instant(2027, 11, 6, zone: losAngeles)), 1)
        XCTAssertEqual(subject.daysUntil(birthday(11, 7), from: instant(2027, 10, 1, zone: losAngeles)), 37)
    }

    func testADayIsNotAlwaysEightySixThousandFourHundredSeconds() {
        // The whole point of NFR-004. A naive implementation adding 86,400
        // seconds returns 0 or 2 for one of these.
        let subject = calendarIn(losAngeles)
        for (month, day) in [(3, 14), (11, 7)] {
            let eve = instant(2027, month, day - 1, zone: losAngeles)
            XCTAssertEqual(subject.daysUntil(birthday(month, day), from: eve), 1,
                           "countdown wrong across the \(month)/\(day) transition")
        }
    }

    // MARK: Extreme time zones

    func testBirthdayIsJudgedInTheUsersOwnLocalDay() {
        // One instant. In Kiritimati it is already September 4. Eleven hours
        // behind coordinated universal time, in Pago Pago, it is still
        // September 3. The answer has to differ.
        let sameInstant = instant(2026, 9, 4, zone: kiritimati)
        let theirBirthday = birthday(9, 4)

        XCTAssertTrue(calendarIn(kiritimati).isBirthdayToday(theirBirthday, on: sameInstant))
        XCTAssertFalse(calendarIn(pagoPago).isBirthdayToday(theirBirthday, on: sameInstant))
    }

    func testCountdownHoldsAtCoordinatedUniversalTimePlus14() {
        let subject = calendarIn(kiritimati)
        XCTAssertEqual(subject.daysUntil(birthday(9, 6), from: instant(2026, 9, 4, zone: kiritimati)), 2)
        XCTAssertTrue(subject.isBirthdayToday(birthday(9, 4), on: instant(2026, 9, 4, zone: kiritimati)))
    }

    func testCountdownHoldsAtCoordinatedUniversalTimeMinus11() {
        let subject = calendarIn(pagoPago)
        XCTAssertEqual(subject.daysUntil(birthday(9, 6), from: instant(2026, 9, 4, zone: pagoPago)), 2)
        XCTAssertTrue(subject.isBirthdayToday(birthday(9, 4), on: instant(2026, 9, 4, zone: pagoPago)))
    }

    // MARK: The window

    func testWindowOpens45DaysBeforeAndClosesThirtyDaysAfter() {
        let subject = calendarIn(losAngeles)
        let theirBirthday = birthday(9, 4)

        XCTAssertTrue(subject.isInWindow(theirBirthday, on: instant(2026, 7, 21, zone: losAngeles)))
        XCTAssertFalse(subject.isInWindow(theirBirthday, on: instant(2026, 7, 20, zone: losAngeles)))
        XCTAssertTrue(subject.isInWindow(theirBirthday, on: instant(2026, 9, 4, zone: losAngeles)))
        XCTAssertTrue(subject.isInWindow(theirBirthday, on: instant(2026, 10, 4, zone: losAngeles)))
        XCTAssertFalse(subject.isInWindow(theirBirthday, on: instant(2026, 10, 5, zone: losAngeles)))
    }

    // MARK: Age

    func testAgeIsOnlyOfferedWhenTheYearIsKnown() {
        let subject = calendarIn(losAngeles)
        XCTAssertNil(subject.ageOnNextBirthday(birthday(9, 4), from: instant(2026, 1, 1, zone: losAngeles)))
        XCTAssertEqual(
            subject.ageOnNextBirthday(birthday(9, 4, year: 1981), from: instant(2026, 1, 1, zone: losAngeles)),
            45
        )
    }
}

// MARK: Days alive

extension BirthdayCalendarTests {
    func testDaysAliveNeedsAYear() {
        let subject = calendarIn(losAngeles)
        XCTAssertNil(subject.daysAlive(birthday(9, 4), on: instant(2026, 9, 4, zone: losAngeles)))
    }

    func testDaysAliveIsCountedInDaysNotIntervals() {
        let subject = calendarIn(losAngeles)
        // 2002-09-04 to 2026-09-04 is 24 years, six of them leap: 2004, 2008,
        // 2012, 2016, 2020, 2024. So 24 times 365 plus 6.
        XCTAssertEqual(
            subject.daysAlive(birthday(9, 4, year: 2002), on: instant(2026, 9, 4, zone: losAngeles)),
            24 * 365 + 6
        )
    }

    func testAFutureBirthYearIsNotANegativeAge() {
        let subject = calendarIn(losAngeles)
        XCTAssertNil(subject.daysAlive(birthday(9, 4, year: 2030), on: instant(2026, 9, 4, zone: losAngeles)))
    }

    func testALeapDayBirthCountsFromTheObservedDay() {
        let subject = calendarIn(losAngeles)
        // Born February 29, 2000, which existed. One day later is one day.
        XCTAssertEqual(
            subject.daysAlive(birthday(2, 29, year: 2000), on: instant(2000, 3, 1, zone: losAngeles)),
            1
        )
    }
}
