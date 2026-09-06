import XCTest
@testable import BirthedDomain

/// What version of the world somebody was born into.
final class WorldThenTests: XCTestCase {

    private func text(_ lines: [WorldThen.Line], _ kicker: String) -> String? {
        lines.first { $0.kicker == kicker }?.text
    }

    // MARK: Day arithmetic

    func testWholeYearsBetweenDays() {
        let born = WorldThen.Day(2002, 9, 4)
        XCTAssertEqual(born.years(until: WorldThen.Day(2017, 9, 26)), 15)
        XCTAssertEqual(born.years(until: WorldThen.Day(2003, 9, 3)), 0)
        XCTAssertEqual(born.years(until: WorldThen.Day(2003, 9, 4)), 1)
        XCTAssertEqual(WorldThen.Day(1998, 9, 4).years(until: born), 4)
        XCTAssertEqual(born.years(until: WorldThen.Day(1998, 9, 4)), -4)
    }

    func testMonthsUnderAYear() {
        let born = WorldThen.Day(2010, 3, 10)
        XCTAssertEqual(born.months(until: WorldThen.Day(2010, 10, 6)), 6)
        XCTAssertEqual(born.months(until: WorldThen.Day(2010, 10, 12)), 7)
    }

    // MARK: Older than

    func testSomebodyBornIn2002IsOlderThanFortniteMinecraftAndInstagram() {
        let lines = WorldThen.lines(month: 9, day: 4, year: 2002, limit: 20)
        XCTAssertEqual(text(lines, "FORTNITE"), "You are 15 years older than Fortnite.")
        XCTAssertEqual(text(lines, "MINECRAFT"), "You are 6 years older than Minecraft.")
        XCTAssertEqual(text(lines, "INSTAGRAM"), "You are 8 years older than Instagram.")
        XCTAssertEqual(text(lines, "CHATGPT"), "You are 20 years older than ChatGPT.")
    }

    func testTheSmallestGapLeads() {
        // A gap under a year jumps the queue: three months older than the
        // iPhone is the best sentence somebody born in March 2007 will get.
        // After that the listed order, Fortnite then Minecraft.
        let lines = WorldThen.lines(month: 3, day: 1, year: 2007, limit: 3)
        XCTAssertEqual(lines.map(\.kicker), ["IPHONE", "FORTNITE", "MINECRAFT"])
        XCTAssertEqual(lines.first?.text, "You are 3 months older than the iPhone.")
        XCTAssertTrue(lines.allSatisfy(\.readerIsOlder))
    }

    func testUnderAYearIsSaidInMonths() {
        let lines = WorldThen.lines(month: 3, day: 10, year: 2010, limit: 20)
        XCTAssertEqual(text(lines, "INSTAGRAM"), "You are 6 months older than Instagram.")
    }

    // MARK: Versions

    func testMinecraftVersionOnTheDay() {
        XCTAssertEqual(text(WorldThen.lines(month: 8, day: 1, year: 2010, limit: 20), "MINECRAFT"),
                       "Minecraft was on Alpha the day you were born.")
        XCTAssertEqual(text(WorldThen.lines(month: 2, day: 14, year: 2012, limit: 20), "MINECRAFT"),
                       "Minecraft was on 1.1 the day you were born.")
        XCTAssertEqual(text(WorldThen.lines(month: 6, day: 13, year: 2024, limit: 20), "MINECRAFT"),
                       "Minecraft was on 1.21, Tricky Trials the day you were born.")
    }

    func testFortniteSeasonOnTheDay() {
        XCTAssertEqual(text(WorldThen.lines(month: 1, day: 1, year: 2020, limit: 20), "FORTNITE"),
                       "Fortnite was in Chapter 2 Season 1 the day you were born.")
        XCTAssertEqual(text(WorldThen.lines(month: 9, day: 26, year: 2017, limit: 20), "FORTNITE"),
                       "Fortnite was in its first weeks, before Season 1 the day you were born.")
    }

    func testTheNewestPhoneAndConsole() {
        let lines = WorldThen.lines(month: 12, day: 25, year: 2011, limit: 20)
        XCTAssertEqual(text(lines, "IPHONE"), "The newest iPhone was the iPhone 4S the day you were born.")
        XCTAssertEqual(text(lines, "PLAYSTATION"), "The newest PlayStation was the PlayStation 3 the day you were born.")
    }

    func testHowOldSomethingWasWhenTheyArrived() {
        let lines = WorldThen.lines(month: 9, day: 4, year: 2002, limit: 20)
        XCTAssertEqual(text(lines, "GOOGLE"), "Google was 4 years old when you were born.")
        XCTAssertEqual(text(lines, "WIKIPEDIA"), "Wikipedia was 1 year old when you were born.")
    }

    // MARK: Absent beats wrong

    func testABirthAfterTheKnownEndOfATimelineGetsNoVersion() {
        let lines = WorldThen.lines(month: 1, day: 1, year: 2026, limit: 20)
        XCTAssertNil(text(lines, "FORTNITE"))
        XCTAssertNil(text(lines, "MINECRAFT"))
        // Arrivals have no end: a 2026 baby is younger than everything here.
        XCTAssertEqual(text(lines, "CHATGPT"), "ChatGPT was 3 years old when you were born.")
    }

    func testEveryTimelineIsInDateOrderAndEndsBeforeItsKnownThrough() {
        for timeline in WorldThen.timelines {
            let days = timeline.versions.map(\.from)
            XCTAssertEqual(days, days.sorted(), timeline.subject)
            XCTAssertTrue(days.last! <= timeline.knownThrough, timeline.subject)
        }
    }

    func testTheLimitHolds() {
        XCTAssertEqual(WorldThen.lines(month: 9, day: 4, year: 2002).count, 5)
    }
}
