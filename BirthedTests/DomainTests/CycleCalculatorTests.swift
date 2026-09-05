import XCTest
@testable import BirthedDomain

/// The cycle year is what makes FR-065 work with no scheduled reset job, so
/// getting its boundary wrong silently turns an annual requirement permanent.
final class CycleCalculatorTests: XCTestCase {
    private let subject = CycleCalculator(
        birthdayCalendar: BirthdayCalendar(calendar: Calendar(identifier: .gregorian),
                                           timeZone: zone("America/Los_Angeles"))
    )
    private let september4 = birthday(9, 4)

    func testTheCycleYearIsTheYearTheOccurrenceFallsIn() {
        XCTAssertEqual(subject.cycleYear(for: september4, on: instant(2026, 9, 4, zone: losAngeles)), 2026)
    }

    func testTheCycleStartsFortyFiveDaysBeforeTheBirthday() {
        XCTAssertEqual(subject.cycleYear(for: september4, on: instant(2026, 7, 21, zone: losAngeles)), 2026)
    }

    func testTheCycleHoldsUntilThirtyDaysAfterTheBirthday() {
        XCTAssertEqual(subject.cycleYear(for: september4, on: instant(2026, 10, 4, zone: losAngeles)), 2026)
    }

    func testTheCycleRollsOverTheDayAfterTheWindowCloses() {
        XCTAssertEqual(subject.cycleYear(for: september4, on: instant(2026, 10, 5, zone: losAngeles)), 2027)
    }

    func testTimeWellOutsideAnyWindowBelongsToTheNextCycle() {
        XCTAssertEqual(subject.cycleYear(for: september4, on: instant(2026, 1, 1, zone: losAngeles)), 2026)
        XCTAssertEqual(subject.cycleYear(for: september4, on: instant(2026, 11, 30, zone: losAngeles)), 2027)
    }

    func testTheCarryOverSentinelIsZeroAndIsNeverAValidCycleYear() {
        XCTAssertEqual(CycleCalculator.carryOverSentinel, 0)
        XCTAssertNotEqual(subject.cycleYear(for: september4, on: instant(2026, 9, 4, zone: losAngeles)), 0)
    }

    func testWindowBoundsMatchTheCycleTheDateSitsIn() {
        let inside = instant(2026, 9, 10, zone: losAngeles)
        let calendar = subject.birthdayCalendar

        guard let start = subject.windowStart(for: september4, on: inside),
              let end = subject.windowEnd(for: september4, on: inside) else {
            return XCTFail("window bounds should exist for a valid birthday")
        }
        XCTAssertEqual(calendar.calendar.dateComponents([.month, .day], from: start).month, 7)
        XCTAssertEqual(calendar.calendar.dateComponents([.month, .day], from: start).day, 21)
        XCTAssertEqual(calendar.calendar.dateComponents([.month, .day], from: end).month, 10)
        XCTAssertEqual(calendar.calendar.dateComponents([.month, .day], from: end).day, 4)
    }

    func testALeapDayCycleFollowsTheObservedDate() {
        let leapling = birthday(2, 29, observance: .february28)
        // In 2027 the observed date is February 28, so the cycle closes on
        // March 30 and rolls over on March 31.
        XCTAssertEqual(subject.cycleYear(for: leapling, on: instant(2027, 3, 30, zone: losAngeles)), 2027)
        XCTAssertEqual(subject.cycleYear(for: leapling, on: instant(2027, 3, 31, zone: losAngeles)), 2028)
    }
}
