import XCTest
@testable import BirthedDomain

final class DateFactsTests: XCTestCase {
    private var subject: DateFacts { DateFacts(calendar: Calendar(identifier: .gregorian), timeZone: losAngeles) }

    // MARK: Day of the year

    func testDayOfYearMovesByOneAfterFebruaryInALeapYear() {
        XCTAssertEqual(subject.dayOfYear(birthday(9, 4), in: 2023), 247)
        XCTAssertEqual(subject.dayOfYear(birthday(9, 4), in: 2024), 248)
        XCTAssertEqual(subject.dayOfYear(birthday(1, 1), in: 2024), 1)
        XCTAssertEqual(subject.dayOfYear(birthday(12, 31), in: 2024), 366)
    }

    func testDayOfYearForALeaplingFollowsTheObservance() {
        XCTAssertEqual(subject.dayOfYear(birthday(2, 29), in: 2024), 60)
        XCTAssertEqual(subject.dayOfYear(birthday(2, 29, observance: .february28), in: 2023), 59)
        XCTAssertEqual(subject.dayOfYear(birthday(2, 29, observance: .march1), in: 2023), 60)
    }

    // MARK: Milestones

    func testTenThousandDaysLandsOnTheRightDay() {
        // 2002-09-04 plus 10,000 days is 2030-01-20. Counted across seven
        // leap days and fifty six daylight saving changes.
        let born = birthday(9, 4, year: 2002)
        let expected = instant(2030, 1, 20, zone: losAngeles)
        let landing = subject.date(whenDaysAlive: 10_000, for: born)
        XCTAssertEqual(landing.map { subject.calendar.startOfDay(for: $0) },
                       subject.calendar.startOfDay(for: expected))
    }

    func testNextMilestoneIsTheNextThousand() {
        let born = birthday(9, 4, year: 2002)
        let reference = instant(2026, 9, 5, zone: losAngeles)   // 8,767 days old
        let milestone = subject.nextMilestone(for: born, from: reference)
        XCTAssertEqual(milestone?.days, 9_000)
        XCTAssertEqual(milestone?.daysAway, 233)
    }

    func testAMilestoneTodayIsTodayNotNextTime() {
        let born = birthday(1, 1, year: 2000)
        guard let day = subject.date(whenDaysAlive: 9_000, for: born) else { return XCTFail("no date") }
        let milestone = subject.nextMilestone(for: born, from: day)
        XCTAssertEqual(milestone?.days, 9_000)
        XCTAssertEqual(milestone?.daysAway, 0)
    }

    func testNoYearMeansNoMilestone() {
        XCTAssertNil(subject.nextMilestone(for: birthday(9, 4), from: Date()))
    }

    // MARK: Zodiac

    func testZodiacBoundaries() {
        func sign(_ m: Int, _ d: Int) -> DateFacts.ZodiacSign { subject.zodiacSign(for: CalendarDate(month: m, day: d)!) }
        XCTAssertEqual(sign(1, 19), .capricorn)
        XCTAssertEqual(sign(1, 20), .aquarius)
        XCTAssertEqual(sign(2, 18), .aquarius)
        XCTAssertEqual(sign(2, 19), .pisces)
        XCTAssertEqual(sign(2, 29), .pisces)
        XCTAssertEqual(sign(3, 21), .aries)
        XCTAssertEqual(sign(9, 4), .virgo)
        XCTAssertEqual(sign(9, 22), .virgo)
        XCTAssertEqual(sign(9, 23), .libra)
        XCTAssertEqual(sign(12, 21), .sagittarius)
        XCTAssertEqual(sign(12, 22), .capricorn)
        XCTAssertEqual(sign(12, 31), .capricorn)
    }

    func testChineseAnimalTurnsAtChineseNewYearNotJanuaryFirst() {
        XCTAssertEqual(subject.chineseAnimal(for: birthday(9, 4, year: 2002)), .horse)
        // 2002's new year was February 12. January 10 is still the Snake.
        XCTAssertEqual(subject.chineseAnimal(for: birthday(1, 10, year: 2002)), .snake)
        XCTAssertEqual(subject.chineseAnimal(for: birthday(2, 12, year: 2002)), .horse)
        XCTAssertEqual(subject.chineseAnimal(for: birthday(6, 1, year: 2000)), .dragon)
        XCTAssertEqual(subject.chineseAnimal(for: birthday(6, 1, year: 1984)), .rat)
        XCTAssertNil(subject.chineseAnimal(for: birthday(6, 1)))
    }

    func testTraditionalListsAreByMonth() {
        XCTAssertEqual(subject.birthstone(for: CalendarDate(month: 9, day: 4)!), "Sapphire")
        XCTAssertEqual(subject.birthFlower(for: CalendarDate(month: 9, day: 4)!), "Aster")
        XCTAssertEqual(subject.birthstone(for: CalendarDate(month: 12, day: 25)!), "Turquoise")
    }
}
