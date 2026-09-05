import XCTest
@testable import BirthedDomain

final class ChartWeekTests: XCTestCase {
    private func week(_ iso: String, _ song: String = "Gold Digger", _ artist: String = "Kanye West") -> ChartWeek {
        guard let week = ChartWeek(isoDate: iso, song: song, artist: artist) else {
            fatalError("fixture \(iso) did not parse")
        }
        return week
    }

    private func date(_ month: Int, _ day: Int) -> CalendarDate {
        guard let date = CalendarDate(month: month, day: day) else {
            fatalError("fixture \(month)/\(day) did not build")
        }
        return date
    }

    // MARK: Reading what the server sends

    func testReadsTheServersDateShape() {
        let week = week("2005-09-17")
        XCTAssertEqual(week.year, 2005)
        XCTAssertEqual(week.date.month, 9)
        XCTAssertEqual(week.date.day, 17)
        XCTAssertEqual(week.isoDate, "2005-09-17")
    }

    func testRefusesADateTheCalendarDoesNotHave() {
        XCTAssertNil(ChartWeek(isoDate: "2005-02-30", song: "A", artist: "B"))
        XCTAssertNil(ChartWeek(isoDate: "2005-13-01", song: "A", artist: "B"))
        XCTAssertNil(ChartWeek(isoDate: "2005-09", song: "A", artist: "B"))
        XCTAssertNil(ChartWeek(isoDate: "", song: "A", artist: "B"))
        XCTAssertNil(ChartWeek(isoDate: "05-09-17", song: "A", artist: "B"))
    }

    func testFebruary29ParsesInALeapYearAndNotOtherwise() {
        XCTAssertNotNil(ChartWeek(isoDate: "2004-02-29", song: "A", artist: "B"))
        XCTAssertNil(ChartWeek(isoDate: "2003-02-29", song: "A", artist: "B"))
    }

    // MARK: The guard

    func testTheSameDayIsCovered() {
        XCTAssertTrue(week("2005-09-17").covers(birthYear: 2005, birthDate: date(9, 17)))
    }

    func testUpToSixDaysBeforeIsCovered() {
        let week = week("2005-09-17")
        XCTAssertTrue(week.covers(birthYear: 2005, birthDate: date(9, 11)))
        XCTAssertTrue(week.covers(birthYear: 2005, birthDate: date(9, 16)))
    }

    func testSevenDaysBeforeIsNotCovered() {
        // Seven days is the next chart's week, not this one's.
        XCTAssertFalse(week("2005-09-17").covers(birthYear: 2005, birthDate: date(9, 10)))
    }

    func testAChartBeforeTheBirthIsNotCovered() {
        XCTAssertFalse(week("2005-09-17").covers(birthYear: 2005, birthDate: date(9, 18)))
    }

    /// The failure this guard exists to stop. The server is asked for the
    /// first chart on or after a date and always answers, so without it
    /// somebody born before the Hot 100 began would be handed the first issue
    /// in the table and told it was the song the week they were born.
    func testABirthLongBeforeTheChartStartedIsNotCovered() {
        XCTAssertFalse(week("1959-01-05").covers(birthYear: 1943, birthDate: date(6, 2)))
    }

    func testCoverageWorksAcrossAYearBoundary() {
        let week = week("2005-01-01")
        XCTAssertTrue(week.covers(birthYear: 2004, birthDate: date(12, 27)))
        XCTAssertFalse(week.covers(birthYear: 2004, birthDate: date(12, 25)))
    }

    func testCoverageWorksAcrossALeapDay() {
        // February 29 2004 to March 6 2004 is six days, not five.
        let week = week("2004-03-06")
        XCTAssertTrue(week.covers(birthYear: 2004, birthDate: date(2, 29)))
        XCTAssertFalse(week.covers(birthYear: 2004, birthDate: date(2, 28)))
    }

    func testDaysAfterCountsCalendarDaysAndNotHours() {
        // Spanning the United States spring forward, when one day is 23 hours
        // long. Dividing an interval by 86400 gives 6.958 here, and rounding
        // that the wrong way would put this outside the window.
        let week = week("2005-04-09")
        XCTAssertEqual(week.daysAfter(birthYear: 2005, birthDate: date(4, 3)), 6)
        XCTAssertTrue(week.covers(birthYear: 2005, birthDate: date(4, 3)))
    }

    func testDisplayDateReadsLikeADate() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "en_US")
        XCTAssertEqual(week("2005-09-17").displayDate(calendar: calendar), "September 17, 2005")
    }
}
