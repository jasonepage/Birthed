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

    // MARK: The other numbers

    /// A fixed instant to measure from, so none of these move with the clock.
    private var now: Date {
        var components = DateComponents()
        components.year = 2026
        components.month = 9
        components.day = 6
        components.timeZone = losAngeles
        return Calendar(identifier: .gregorian).date(from: components)!
    }

    private func ymd(_ date: Date) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = losAngeles
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return "\(parts.year!)-\(parts.month!)-\(parts.day!)"
    }

    func testABillionSecondsIsElevenThousandFiveHundredAndSeventyFourDays() {
        // The arithmetic this rests on, stated rather than assumed:
        // 1,000,000,000 seconds divided by 86,400 seconds in a day.
        XCTAssertEqual(DateFacts.daysInABillionSeconds, 1_000_000_000 / 86_400)
        XCTAssertEqual(DateFacts.daysInABillionSeconds, 11_574)
    }

    func testTheBillionthSecondLandsInTheEarlyThirties() {
        // Born September 4, 1990. 11,574 days later is May 13, 2022, and
        // that is the whole claim: a day, not a moment.
        let date = subject.billionSecondsDay(for: birthday(9, 4, year: 1990))
        XCTAssertNotNil(date)
        XCTAssertEqual(ymd(date!), "2022-5-13")
    }

    func testTheBillionthSecondNeedsAYear() {
        XCTAssertNil(subject.billionSecondsDay(for: birthday(9, 4)))
    }

    func testFebruary29GetsItsBillionthSecondFromTheObservedDay() {
        // The stored birthday stays February 29 forever and the observance is
        // consulted at read time, so this has to come back with something
        // rather than nil.
        XCTAssertNotNil(subject.billionSecondsDay(for: birthday(2, 29, year: 1992)))
    }

    func testFullMoonsAreCountedOnTheAverageAndSayAbout() {
        // Born on the reference day itself, so nothing has gone round yet.
        let newborn = subject.approximateFullMoons(for: birthday(9, 6, year: 2026), on: now)
        XCTAssertEqual(newborn, 0, "born today, so none yet")

        // Born September 4, 1990, which is 13,151 days before the reference.
        // 13,151 / 29.530588853 is 445.3, so 445.
        let grown = subject.approximateFullMoons(for: birthday(9, 4, year: 1990), on: now)
        XCTAssertEqual(grown, 445)
    }

    func testFullMoonsNeedAYearAndNeverGoNegative() {
        XCTAssertNil(subject.approximateFullMoons(for: birthday(9, 4), on: now))
        // Somebody not born yet is nil rather than a negative count.
        XCTAssertNil(subject.approximateFullMoons(for: birthday(9, 4, year: 2030), on: now))
    }

    func testTheWeekdayReturnIsTheSameWeekdayTheyWereBornOn() {
        // September 4, 1990 was a Tuesday.
        let subject4 = birthday(9, 4, year: 1990)
        let returned = subject.nextWeekdayReturn(for: subject4, from: now)
        XCTAssertNotNil(returned)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = losAngeles
        XCTAssertEqual(returned!.weekday, calendarIn(losAngeles).birthWeekday(subject4))
        // And the year it names really does put the birthday on that weekday.
        var components = DateComponents()
        components.year = returned!.year
        components.month = 9
        components.day = 4
        components.timeZone = losAngeles
        let landed = calendar.date(from: components)!
        XCTAssertEqual(calendar.component(.weekday, from: landed), returned!.weekday)
    }

    func testTheWeekdayReturnIsStrictlyAhead() {
        // Asked on somebody's own birthday, the answer is the next one and
        // not the day they are standing on.
        let onTheDay = subject.nextWeekdayReturn(for: birthday(9, 6, year: 1990), from: now)
        XCTAssertNotNil(onTheDay)
        XCTAssertGreaterThan(onTheDay!.yearsAway, 0)
    }

    func testTheWeekdayReturnNeedsAYear() {
        XCTAssertNil(subject.nextWeekdayReturn(for: birthday(9, 4), from: now))
    }

    func testTheWeekdayReturnAlwaysArrivesWithinElevenYears() {
        // The gap runs 6, 11, 5, 6 and repeats, bent by the leap years it
        // crosses. Nothing should ever be further out than eleven, and a
        // bound that silently returned nil would look like a missing feature
        // rather than a bug.
        for year in 1950...2020 {
            for (month, day) in [(1, 1), (2, 28), (3, 15), (7, 4), (9, 4), (12, 31)] {
                let value = subject.nextWeekdayReturn(for: birthday(month, day, year: year), from: now)
                XCTAssertNotNil(value, "\(month)/\(day)/\(year) found none")
                XCTAssertLessThanOrEqual(value!.yearsAway, 11, "\(month)/\(day)/\(year)")
            }
        }
    }

    func testEarthIsInThePlanetsAndAgreesWithTheOrdinaryAge() {
        // The one row a reader can check against the age they already know,
        // which is why Earth is in the list rather than left out.
        let years = subject.age(on: .earth, for: birthday(9, 4, year: 1990), on: now)
        XCTAssertNotNil(years)
        XCTAssertEqual(years!, 36.0, accuracy: 0.05)
    }

    func testMarsIsTheOneWorthShowing() {
        // A person of 36 is about 19 on Mars, which is the only one of these
        // that reads as a fact about a life.
        let mars = subject.age(on: .mars, for: birthday(9, 4, year: 1990), on: now)
        XCTAssertNotNil(mars)
        XCTAssertEqual(mars!, 19.1, accuracy: 0.2)
    }

    func testEveryPlanetsYearIsLongerThanTheOneBeforeIt() {
        // The list is in order out from the sun, and a transposed pair would
        // otherwise be invisible.
        let periods = DateFacts.Planet.allCases.map(\.yearInEarthDays)
        XCTAssertEqual(periods, periods.sorted())
    }

    func testAgeOnAPlanetNeedsAYear() {
        XCTAssertNil(subject.age(on: .mars, for: birthday(9, 4), on: now))
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
