import XCTest
@testable import BirthedDomain

/// The wall's arithmetic: which dates are open, what a tap may spend, where
/// a tile sits, what the screen says, and how the server's rows are read.
/// docs/the-wall.md sections 3, 4 and 5.
///
/// Every instant here is built in Eastern time or Coordinated Universal Time
/// by hand, because the whole point of the clock is that the reader's own
/// zone never enters into it.
final class WallTests: XCTestCase {

    private func at(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        guard let date = f.date(from: iso) else { fatalError("bad instant \(iso)") }
        return date
    }

    private func wallDate(_ y: Int, _ m: Int, _ d: Int) -> WallDate {
        WallDate(year: y, month: m, day: d)!
    }

    // MARK: The clock

    func testEasternDateTurnsOverAtEasternMidnightNotUniversalMidnight() {
        // 03:59 Coordinated Universal Time on September 10 is 23:59 on September 9 in New York.
        XCTAssertEqual(WallClock.easternDate(of: at("2026-09-10T03:59:00Z")), wallDate(2026, 9, 9))
        XCTAssertEqual(WallClock.easternDate(of: at("2026-09-10T04:00:00Z")), wallDate(2026, 9, 10))
        // In January the offset is five hours.
        XCTAssertEqual(WallClock.easternDate(of: at("2026-01-10T04:59:00Z")), wallDate(2026, 1, 9))
        XCTAssertEqual(WallClock.easternDate(of: at("2026-01-10T05:00:00Z")), wallDate(2026, 1, 10))
    }

    func testTheOpenDatesAreYesterdayTodayAndTomorrowEastern() {
        XCTAssertEqual(WallClock.openDates(now: at("2026-09-09T20:00:00Z")),
                       [wallDate(2026, 9, 8), wallDate(2026, 9, 9), wallDate(2026, 9, 10)])
    }

    func testTheOpenDatesCrossAYearAndReachFebruary29OnlyInALeapYear() {
        XCTAssertEqual(WallClock.openDates(now: at("2026-12-31T20:00:00Z")),
                       [wallDate(2026, 12, 30), wallDate(2026, 12, 31), wallDate(2027, 1, 1)])
        XCTAssertEqual(WallClock.openDates(now: at("2028-02-28T20:00:00Z")),
                       [wallDate(2028, 2, 27), wallDate(2028, 2, 28), wallDate(2028, 2, 29)])
        XCTAssertEqual(WallClock.openDates(now: at("2027-02-28T20:00:00Z")),
                       [wallDate(2027, 2, 27), wallDate(2027, 2, 28), wallDate(2027, 3, 1)])
    }

    func testTheOpenWallForACalendarDateIsTheOneInTheWindowOrNothing() {
        let now = at("2026-09-09T20:00:00Z")
        XCTAssertEqual(WallClock.openWall(for: CalendarDate(month: 9, day: 10)!, now: now), wallDate(2026, 9, 10))
        XCTAssertEqual(WallClock.openWall(for: CalendarDate(month: 9, day: 8)!, now: now), wallDate(2026, 9, 8))
        XCTAssertNil(WallClock.openWall(for: CalendarDate(month: 9, day: 7)!, now: now))
        XCTAssertNil(WallClock.openWall(for: CalendarDate(month: 3, day: 9)!, now: now))
    }

    func testAWallDateKeyRoundTripsAndRefusesNonsense() {
        XCTAssertEqual(WallDate(key: "2026-09-09"), wallDate(2026, 9, 9))
        XCTAssertEqual(wallDate(2026, 9, 9).key, "2026-09-09")
        XCTAssertEqual(wallDate(2027, 1, 1).key, "2027-01-01")
        XCTAssertNil(WallDate(key: "2026-13-01"))
        XCTAssertNil(WallDate(key: "yesterday"))
        XCTAssertTrue(wallDate(2026, 9, 9) < wallDate(2026, 9, 10))
        XCTAssertTrue(wallDate(2026, 12, 31) < wallDate(2027, 1, 1))
    }

    // MARK: The budget

    func testThreeOnTheDayOneTheDayAfterNoneTheDayBefore() {
        let wall = wallDate(2026, 9, 9)
        XCTAssertEqual(WallBudget.allowance(castOn: wallDate(2026, 9, 9), wallDate: wall), 3)
        XCTAssertEqual(WallBudget.allowance(castOn: wallDate(2026, 9, 10), wallDate: wall), 1)
        XCTAssertEqual(WallBudget.allowance(castOn: wallDate(2026, 9, 8), wallDate: wall), 0)
        XCTAssertEqual(WallBudget.allowance(castOn: wallDate(2026, 9, 11), wallDate: wall), 0)
        // The day after December 31 is January 1 of the next year.
        XCTAssertEqual(WallBudget.allowance(castOn: wallDate(2027, 1, 1), wallDate: wallDate(2026, 12, 31)), 1)
        XCTAssertEqual(WallBudget.dayAfter(wallDate(2028, 2, 28)), wallDate(2028, 2, 29))
    }

    func testUnitsLeftCountsDownFromTheAllowanceAndNeverBelowZero() {
        let wall = wallDate(2026, 9, 9)
        let onTheDay = at("2026-09-09T20:00:00Z")
        XCTAssertEqual(WallBudget.unitsLeft(wallDate: wall, now: onTheDay, spentToday: 0), 3)
        XCTAssertEqual(WallBudget.unitsLeft(wallDate: wall, now: onTheDay, spentToday: 1), 2)
        XCTAssertEqual(WallBudget.unitsLeft(wallDate: wall, now: onTheDay, spentToday: 3), 0)
        XCTAssertEqual(WallBudget.unitsLeft(wallDate: wall, now: onTheDay, spentToday: 5), 0)
        // The day after, Eastern: one unit, whatever was spent yesterday.
        XCTAssertEqual(WallBudget.unitsLeft(wallDate: wall, now: at("2026-09-10T20:00:00Z"), spentToday: 0), 1)
        // The day before: nothing.
        XCTAssertEqual(WallBudget.unitsLeft(wallDate: wall, now: at("2026-09-08T20:00:00Z"), spentToday: 0), 0)
    }

    func testTheBoundaryWhereTwoIsRefusedBecauseOneIsSpent() {
        XCTAssertTrue(WallBudget.canSpend(2, left: 2))
        XCTAssertFalse(WallBudget.canSpend(2, left: 1))
        XCTAssertTrue(WallBudget.canSpend(1, left: 1))
        XCTAssertFalse(WallBudget.canSpend(1, left: 0))
        XCTAssertFalse(WallBudget.canSpend(4, left: 3))
        XCTAssertFalse(WallBudget.canSpend(0, left: 3))
    }

    // MARK: The window

    private func day(stories: [WallStory] = []) -> WallDay {
        WallDay(wallDate: wallDate(2026, 9, 9), opensAt: at("2026-09-08T04:00:00Z"), liveAt: at("2026-09-09T04:00:00Z"),
                closesAt: at("2026-09-11T04:00:00Z"), closedAt: nil, stories: stories)
    }

    func testThePhasesFollowTheStoredInstantsAndServerTimeDecides() {
        let d = day()
        XCTAssertEqual(d.phase(now: at("2026-09-08T03:59:59Z")), .notYetOpen)
        XCTAssertEqual(d.phase(now: at("2026-09-08T04:00:00Z")), .submissionsOnly)
        XCTAssertEqual(d.phase(now: at("2026-09-09T04:00:00Z")), .live)
        XCTAssertEqual(d.phase(now: at("2026-09-11T03:59:59Z")), .live)
        // The same second the date closes: closed. Server time decides.
        XCTAssertEqual(d.phase(now: at("2026-09-11T04:00:00Z")), .closed)
        let stamped = WallDay(wallDate: d.wallDate, opensAt: d.opensAt, liveAt: d.liveAt, closesAt: d.closesAt,
                              closedAt: at("2026-09-11T04:00:05Z"), stories: [])
        XCTAssertEqual(stamped.phase(now: at("2026-09-11T04:00:03Z")), .closed, "closes_at passed, whatever the stamp says")
    }

    // MARK: Idempotent boosting

    func testADoubleTapSendsOneIdentifierAndTheNextTapANewOne() {
        var ledger = WallBoostLedger()
        var made = 0
        let fresh = { () -> UUID in made += 1; return UUID() }
        let first = ledger.begin(storyID: "a", fresh: fresh)
        let again = ledger.begin(storyID: "a", fresh: fresh)
        XCTAssertEqual(first, again, "the second tap while the first is in flight is the same request")
        XCTAssertEqual(made, 1)
        XCTAssertTrue(ledger.isInFlight(storyID: "a"))
        let other = ledger.begin(storyID: "b", fresh: fresh)
        XCTAssertNotEqual(first, other)
        ledger.finish(storyID: "a")
        XCTAssertFalse(ledger.isInFlight(storyID: "a"))
        let next = ledger.begin(storyID: "a", fresh: fresh)
        XCTAssertNotEqual(first, next, "after the request finished, a new tap is a new request")
        XCTAssertEqual(made, 3)
    }

    // MARK: The hive

    private func story(_ id: String, rect: WallRect?, status: WallStoryStatus = .placed, support: Int = 5, tier: WallTier = .reported) -> WallStory {
        WallStory(id: id, wallDate: wallDate(2026, 9, 9), submittedAt: at("2026-09-09T12:00:00Z"),
                  headline: "Council approves the river crossing", url: URL(string: "https://example.org/\(id)")!,
                  outlet: "example.org", status: status, tier: tier, support: support, placedAt: nil, rect: rect,
                  falseAt: status == .shownFalse ? at("2026-09-09T13:00:00Z") : nil, falseNote: nil, sources: [])
    }

    func testATileIsDrawnAtItsStoredAnchorAndSizeScaledToTheBoard() {
        let frame = WallBoard.frame(of: WallRect(mx: 3, my: 5, w: 4, h: 3), side: 320, gap: 2)
        XCTAssertEqual(frame.x, 61, accuracy: 0.001)
        XCTAssertEqual(frame.y, 101, accuracy: 0.001)
        XCTAssertEqual(frame.width, 78, accuracy: 0.001)
        XCTAssertEqual(frame.height, 58, accuracy: 0.001)
        // A different square, the same picture.
        let bigger = WallBoard.frame(of: WallRect(mx: 3, my: 5, w: 4, h: 3), side: 640, gap: 2)
        XCTAssertEqual(bigger.x, 122, accuracy: 0.001)
        XCTAssertEqual(bigger.width, 158, accuracy: 0.001)
    }

    func testTheHiveDrawsPlacedAndFalseStoriesAndNothingFromThePool() {
        let placed = story("a", rect: WallRect(mx: 8, my: 7, w: 2, h: 1))
        let stamped = story("b", rect: WallRect(mx: 0, my: 0, w: 1, h: 1), status: .shownFalse)
        let pooled = story("c", rect: nil, status: .pool)
        let spilled = story("d", rect: nil, status: .overflow)
        let tiles = WallBoard.tiles([placed, stamped, pooled, spilled])
        XCTAssertEqual(tiles.map(\.id), ["a", "b"])
        let d = day(stories: [placed, stamped, pooled, spilled])
        XCTAssertEqual(d.onHive.map(\.id), ["a", "b"])
        XCTAssertEqual(d.inPool.map(\.id), ["c"])
        XCTAssertEqual(d.overflow.map(\.id), ["d"])
    }

    func testAnOverlappingRectangleIsNotDrawnOverAnEarlierOne() {
        let first = story("a", rect: WallRect(mx: 8, my: 7, w: 2, h: 2))
        let second = story("b", rect: WallRect(mx: 9, my: 8, w: 2, h: 2))
        XCTAssertEqual(WallBoard.tiles([first, second]).map(\.id), ["a"])
        XCTAssertTrue(WallRect(mx: 0, my: 0, w: 2, h: 2).overlaps(WallRect(mx: 1, my: 1, w: 2, h: 2)))
        XCTAssertFalse(WallRect(mx: 0, my: 0, w: 2, h: 2).overlaps(WallRect(mx: 2, my: 0, w: 2, h: 2)))
        XCTAssertTrue(WallRect(mx: 7, my: 6, w: 2, h: 2).contains(WallRect(mx: 8, my: 7, w: 1, h: 1)))
    }

    func testHowMuchATileCanSayFollowsItsShape() {
        XCTAssertEqual(WallBoard.size(of: WallRect(mx: 0, my: 0, w: 1, h: 1)), .tiny)
        XCTAssertEqual(WallBoard.size(of: WallRect(mx: 0, my: 0, w: 1, h: 8)), .tiny, "a column of letters is not a headline")
        XCTAssertEqual(WallBoard.size(of: WallRect(mx: 0, my: 0, w: 3, h: 1)), .small)
        XCTAssertEqual(WallBoard.size(of: WallRect(mx: 0, my: 0, w: 2, h: 2)), .small)
        XCTAssertEqual(WallBoard.size(of: WallRect(mx: 0, my: 0, w: 3, h: 2)), .mid)
        XCTAssertEqual(WallBoard.size(of: WallRect(mx: 0, my: 0, w: 6, h: 4)), .big)
    }

    // MARK: Words

    // The sentences moved to `HiveCopy` and to HiveTests when the unit became
    // a buzz. They are not asserted twice.


    func testTierWordsAreNeverAVerdict() {
        for tier in [WallTier.claimed, .reported, .seenDirect] {
            let words = (tier.label + " " + tier.meaning).lowercased()
            XCTAssertFalse(words.contains("true"))
            XCTAssertFalse(words.contains("verified"))
            XCTAssertFalse(words.contains("fact check"))
        }
        XCTAssertEqual(WallTier(rawValue: "seen_direct"), .seenDirect)
        XCTAssertEqual(WallStoryStatus(rawValue: "false"), .shownFalse)
    }

    func testTheSubmitPreviewHasNoWayToEditTheHeadline() {
        let s = story("a", rect: nil, status: .pool)
        let preview = WallSubmitPreview(story: s, existing: false)
        XCTAssertEqual(preview.story.headline, "Council approves the river crossing")
        XCTAssertTrue(WallSubmitPreview.headlineNote.contains("cannot be edited"))
        XCTAssertTrue(preview.line.contains("pool"))
        XCTAssertTrue(WallSubmitPreview(story: s, existing: true).line.contains("already"))
        // The preview is a `let` story and a `let` flag. A mirror finds no
        // other stored property, so there is nothing a view could bind a
        // text field to.
        XCTAssertEqual(Mirror(reflecting: preview).children.map { $0.label ?? "" }, ["story", "existing"])
    }

    // MARK: The server's rows

    func testRowsAreReadIntoValuesWithTheirSourcesAndChecksInOrder() {
        let row: [String: Any] = [
            "id": "11111111-1111-1111-1111-111111111111",
            "wall_date": "2026-09-09",
            "submitted_at": "2026-09-09T14:02:00.123456+00:00",
            "headline": "U.S. military says it destroyed 5 Iranian oil tankers",
            "url": "https://npr.org/2026/09/09/story",
            "outlet": "npr.org",
            "status": "placed",
            "tier": "reported",
            "support": 12,
            "placed_at": "2026-09-09T15:00:00+00:00",
            "anchor_mx": 8, "anchor_my": 7, "w_modules": 2, "h_modules": 1,
            "false_at": NSNull(), "false_note": NSNull(),
            "wall_sources": [
                [
                    "id": "s2", "url": "https://aljazeera.com/x", "outlet": "aljazeera.com", "owner": "Al Jazeera Media Network",
                    "headline": "US strikes 5 Iranian oil tankers", "quotation": "US military says it struck the five Iranian tankers after the IRGC targeted a US warship twice in two days.",
                    "verified_at": "2026-09-09T15:00:00+00:00", "added_at": "2026-09-09T14:30:00+00:00", "is_primary_doc": false,
                    "wall_checks": [
                        ["checked_at": "2026-09-09T15:00:00+00:00", "kind": "quotation", "passed": true, "http_status": 200, "detail": "exact"],
                        ["checked_at": "2026-09-09T14:59:00+00:00", "kind": "resolves", "passed": true, "http_status": 200, "detail": "200"],
                    ],
                ],
                [
                    "id": "s1", "url": "https://npr.org/2026/09/09/story", "outlet": "npr.org", "owner": "National Public Radio",
                    "headline": "U.S. military says it destroyed 5 Iranian oil tankers", "quotation": "The U.S. military said it destroyed five Iranian oil tankers on Tuesday.",
                    "verified_at": NSNull(), "added_at": "2026-09-09T14:02:00+00:00", "is_primary_doc": false,
                    "wall_checks": [],
                ],
            ],
        ]
        guard let story = WallRows.story(row) else { return XCTFail("the row did not read") }
        XCTAssertEqual(story.wallDate, wallDate(2026, 9, 9))
        XCTAssertEqual(story.status, .placed)
        XCTAssertEqual(story.tier, .reported)
        XCTAssertEqual(story.rect, WallRect(mx: 8, my: 7, w: 2, h: 1))
        XCTAssertTrue(story.isOnHive)
        XCTAssertEqual(story.sources.map(\.id), ["s1", "s2"], "sources in the order they were added")
        XCTAssertEqual(story.sources[1].checks.map(\.kind), [.resolves, .quotation], "checks oldest first")
        XCTAssertNil(story.sources[0].verifiedAt)
        XCTAssertNotNil(story.sources[1].verifiedAt)
        XCTAssertTrue(story.sources[0].verificationLine.contains("Not checked yet"))
        XCTAssertTrue(story.sources[1].verificationLine.contains("found on the page, exactly"))

        let dayRow: [String: Any] = [
            "wall_date": "2026-09-09", "opens_at": "2026-09-08T04:00:00+00:00", "live_at": "2026-09-09T04:00:00+00:00",
            "closes_at": "2026-09-11T04:00:00+00:00", "closed_at": NSNull(),
        ]
        guard let d = WallRows.day(dayRow, stories: [story]) else { return XCTFail("the day did not read") }
        XCTAssertEqual(d.phase(now: at("2026-09-09T20:00:00Z")), .live)
        XCTAssertEqual(d.onHive.count, 1)
    }

    func testARowMissingWhatMattersIsDroppedRatherThanGuessed() {
        XCTAssertNil(WallRows.story(["id": "x", "headline": "no date"]))
        XCTAssertNil(WallRows.check(["checked_at": "2026-09-09T15:00:00+00:00", "kind": "vibes", "passed": true]))
        XCTAssertNil(WallRows.day(["wall_date": "2026-09-09"], stories: []))
    }
}
