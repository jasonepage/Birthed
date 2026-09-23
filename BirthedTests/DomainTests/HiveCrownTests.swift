import XCTest
@testable import BirthedDomain

/// The crown, docs/the-wall.md section 30. Every sentence asserted here was
/// printed by the website's own tests (web/test/crown.test.ts), so the app
/// and the site cannot say different things about who wore it.
///
/// Not run as of September 23, 2026: neither shell in that session had a
/// Swift toolchain. Jason builds.
final class HiveCrownTests: XCTestCase {

    private let a = "aaaaaaaa-0000-4000-8000-000000000001"
    private let b = "bbbbbbbb-0000-4000-8000-000000000002"
    private let c = "cccccccc-0000-4000-8000-000000000003"
    private let notOnDate = "dddddddd-0000-4000-8000-000000000004"

    private func at(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        guard let date = f.date(from: iso) else { fatalError("bad instant \(iso)") }
        return date
    }

    private func story(_ id: String, _ headline: String, kind: String? = "person", status: WallStoryStatus = .placed) -> WallStory {
        WallStory(id: id, wallDate: WallDate(year: 2026, month: 9, day: 23)!,
                  submittedAt: at("2026-09-22T04:00:00Z"), headline: headline,
                  url: URL(string: "https://example.org/\(id)")!, outlet: "example.org",
                  status: status, tier: .claimed, support: 0, placedAt: nil,
                  rect: WallRect(mx: 0, my: 0, w: 4, h: 3),
                  falseAt: nil, falseNote: nil, sources: [],
                  priority: 1, subjectKind: kind, subjectID: kind == nil ? nil : id)
    }

    private func buzz(_ id: Int, _ storyID: String, _ iso: String, units: Int = 1) -> WallBoost {
        WallBoost(id: id, storyID: storyID, units: units, castAt: at(iso))
    }

    private func day(_ boosts: [WallBoost], falseB: Bool = false, closed: Bool = false) -> WallDay {
        var day = WallDay(wallDate: WallDate(year: 2026, month: 9, day: 23)!,
                          opensAt: at("2026-09-22T04:00:00Z"), liveAt: at("2026-09-23T04:00:00Z"),
                          closesAt: at("2026-09-25T04:00:00Z"), closedAt: closed ? at("2026-09-25T04:00:00Z") : nil,
                          stories: [
                            story(a, "Typhoid Mary, infected houseworker in New York City, born 1869"),
                            story(b, "Bruce Springsteen, American rock singer (born 1949), born 1949", status: falseB ? .shownFalse : .placed),
                            story(c, "Major news outlets banned by Trump will have their day in court", kind: nil),
                          ])
        day.boosts = boosts
        return day
    }

    private func names(_ day: WallDay) -> (String) -> String {
        let table = Dictionary(uniqueKeysWithValues: day.stories.map { ($0.id, HiveCrown.name(for: $0)) })
        return { table[$0] ?? "a story in the feed" }
    }

    // MARK: The replay

    func testNoBuzzesNoCrown() {
        let crown = HiveCrown.crown(for: day([]))
        XCTAssertNil(crown.holder)
        XCTAssertEqual(crown.count, 0)
        XCTAssertEqual(crown.changes, [])
    }

    func testOneBuzzTakesTheCrownFromNobody() {
        let d = day([buzz(1, a, "2026-09-23T08:27:57Z")])
        let crown = HiveCrown.crown(for: d)
        XCTAssertEqual(crown.holder, a)
        XCTAssertEqual(crown.count, 1)
        XCTAssertEqual(crown.changes, [HiveCrown.Change(at: at("2026-09-23T08:27:57Z"), to: a, from: nil)])
        // Printed by the website's test.
        XCTAssertEqual(HiveCrown.line(crown.changes[0], nameOf: names(d)), "4:27 am Eastern: Typhoid Mary took the crown.")
    }

    func testThreeBuzzesOnThreeStoriesAreATieAndTheFirstKeepsIt() {
        // September 23, 2026 as the live table stood.
        let crown = HiveCrown.crown(for: day([
            buzz(1, a, "2026-09-23T08:27:57Z"),
            buzz(2, c, "2026-09-23T15:25:00Z"),
            buzz(3, b, "2026-09-23T15:25:08Z"),
        ]))
        XCTAssertEqual(crown.holder, a)
        XCTAssertEqual(crown.count, 1)
        XCTAssertEqual(crown.changes.count, 1)
    }

    func testStrictlyMoreTakesItAndTheLineSaysFromWhom() {
        let d = day([
            buzz(1, a, "2026-09-23T08:27:57Z"),
            buzz(2, b, "2026-09-23T15:25:08Z"),
            buzz(3, b, "2026-09-23T19:12:00Z"),
        ])
        let crown = HiveCrown.crown(for: d)
        XCTAssertEqual(crown.holder, b)
        XCTAssertEqual(crown.count, 2)
        XCTAssertEqual(crown.changes.count, 2)
        XCTAssertEqual(crown.changes[1], HiveCrown.Change(at: at("2026-09-23T19:12:00Z"), to: b, from: a))
        XCTAssertEqual(HiveCrown.line(crown.changes[1], nameOf: names(d)), "3:12 pm Eastern: Bruce Springsteen took the crown from Typhoid Mary.")
        XCTAssertEqual(HiveCrown.said(crown.changes[1], nameOf: names(d)), "Bruce Springsteen took the crown from Typhoid Mary.")
        XCTAssertEqual(HiveCrown.back("Typhoid Mary"), "The crown is back with Typhoid Mary.")
    }

    func testTheHolderAddingToItsLeadIsNotAChangeOfHands() {
        let crown = HiveCrown.crown(for: day([
            buzz(1, a, "2026-09-23T08:00:00Z"), buzz(2, a, "2026-09-23T09:00:00Z"), buzz(3, a, "2026-09-23T10:00:00Z"),
        ]))
        XCTAssertEqual(crown.holder, a)
        XCTAssertEqual(crown.count, 3)
        XCTAssertEqual(crown.changes.count, 1)
    }

    func testAThreeUnitAppBuzzPassesTwoOnes() {
        let crown = HiveCrown.crown(for: day([
            buzz(1, a, "2026-09-23T08:00:00Z"), buzz(2, a, "2026-09-23T09:00:00Z"), buzz(3, b, "2026-09-23T10:00:00Z", units: 3),
        ]))
        XCTAssertEqual(crown.holder, b)
        XCTAssertEqual(crown.count, 3)
        XCTAssertEqual(crown.changes.map(\.to), [a, b])
    }

    func testTheReplayIsInCastOrderWhateverOrderTheRowsArriveIn() {
        let crown = HiveCrown.crown(for: day([
            buzz(3, b, "2026-09-23T19:12:00Z"), buzz(1, a, "2026-09-23T08:27:57Z"), buzz(2, b, "2026-09-23T15:25:08Z"),
        ]))
        XCTAssertEqual(crown.changes.map(\.to), [a, b])
        XCTAssertEqual(crown.changes[0].at, at("2026-09-23T08:27:57Z"))
    }

    func testTwoBuzzesInTheSameInstantFallToTheRowID() {
        let rows = [buzz(20, b, "2026-09-23T08:00:00Z"), buzz(10, a, "2026-09-23T08:00:00Z")]
        XCTAssertEqual(HiveCrown.crown(for: day(rows)).holder, a)
        XCTAssertEqual(HiveCrown.crown(for: day(Array(rows.reversed()))).holder, a)
    }

    func testABuzzTakenBackWasNeverATakeover() {
        XCTAssertEqual(HiveCrown.crown(for: day([
            buzz(1, a, "2026-09-23T08:00:00Z"), buzz(2, b, "2026-09-23T09:00:00Z"), buzz(3, b, "2026-09-23T09:00:10Z"),
        ])).holder, b)
        let after = HiveCrown.crown(for: day([buzz(1, a, "2026-09-23T08:00:00Z"), buzz(2, b, "2026-09-23T09:00:00Z")]))
        XCTAssertEqual(after.holder, a)
        XCTAssertEqual(after.changes.count, 1)
    }

    func testAStoryStampedFalseCannotWearIt() {
        let crown = HiveCrown.crown(for: day([
            buzz(1, b, "2026-09-23T08:00:00Z"), buzz(2, b, "2026-09-23T08:01:00Z"), buzz(3, a, "2026-09-23T09:00:00Z"),
        ], falseB: true))
        XCTAssertEqual(crown.holder, a)
        XCTAssertEqual(crown.count, 1)
        XCTAssertEqual(crown.changes.map(\.from), [nil])
    }

    func testABuzzOffTheDateOrARowThatIsNotABuzzIsSkipped() {
        let crown = HiveCrown.crown(for: day([
            buzz(1, notOnDate, "2026-09-23T07:00:00Z"), buzz(2, notOnDate, "2026-09-23T07:01:00Z"),
            buzz(3, a, "2026-09-23T08:00:00Z"),
            buzz(4, b, "2026-09-23T08:01:00Z", units: 0), buzz(5, b, "2026-09-23T08:02:00Z", units: 4),
        ]))
        XCTAssertEqual(crown.holder, a)
        XCTAssertEqual(crown.count, 1)
    }

    func testARowFromTheServerIsReadWithoutTheBoosterAndDroppedWhenItIsNotABuzz() {
        let read = WallRows.boost(["id": 7, "story_id": a, "units": 1, "cast_at": "2026-09-23T08:00:00.123456+00:00", "booster_id": "never"])
        XCTAssertEqual(read?.id, 7)
        XCTAssertEqual(read?.storyID, a)
        XCTAssertEqual(read?.units, 1)
        XCTAssertNil(WallRows.boost(["id": "x", "story_id": a, "units": 1, "cast_at": "2026-09-23T08:00:00Z"]))
        XCTAssertNil(WallRows.boost(["id": 1, "story_id": a, "units": 9, "cast_at": "2026-09-23T08:00:00Z"]))
        XCTAssertNil(WallRows.boost(["id": 1, "story_id": a, "units": 1, "cast_at": "not a time"]))
        XCTAssertNil(WallRows.boost(["id": 1, "headline": "a story row, not a buzz"]))
    }

    // MARK: The words

    func testTheTimeIsTheEasternClock() {
        XCTAssertEqual(HiveCrown.clock(at("2026-09-23T15:25:08Z")), "11:25 am Eastern")
        XCTAssertEqual(HiveCrown.clock(at("2026-09-23T08:27:57Z")), "4:27 am Eastern")
        XCTAssertEqual(HiveCrown.clock(at("2026-09-23T19:12:00Z")), "3:12 pm Eastern")
        XCTAssertEqual(HiveCrown.clock(at("2026-09-23T16:00:00Z")), "12:00 pm Eastern")
        XCTAssertEqual(HiveCrown.clock(at("2026-09-23T04:05:00Z")), "12:05 am Eastern")
        XCTAssertEqual(HiveCrown.clock(at("2026-12-23T20:12:00Z")), "3:12 pm Eastern")
    }

    func testACrownLineCallsAPersonByNameASongByItsTitleAndAnythingElseByItsHeadline() {
        XCTAssertEqual(HiveCrown.name(for: story(a, "Bruce Springsteen, American rock singer (born 1949), born 1949")), "Bruce Springsteen")
        XCTAssertEqual(HiveCrown.name(for: story(a, "Ray Charles, American singer, born 1930, died 2004")), "Ray Charles")
        XCTAssertEqual(HiveCrown.name(for: story(a, "Somebody with no years")), "Somebody with no years")
        XCTAssertEqual(HiveCrown.name(for: story(a, "1992: \"End of the Road\" by Boyz II Men was the number one song", kind: "song")), "\"End of the Road\" by Boyz II Men")
        XCTAssertEqual(HiveCrown.name(for: story(a, "1975: Blood on the Tracks by Bob Dylan was the number one album", kind: "album")), "Blood on the Tracks by Bob Dylan")
        XCTAssertEqual(HiveCrown.name(for: story(a, "1993: Jurassic Park was the number one film at the box office", kind: "film")), "Jurassic Park")
        XCTAssertEqual(HiveCrown.name(for: story(a, "1956: The dike around the Dutch polder East Flevoland is closed.", kind: "historical_event")), "1956: The dike around the Dutch polder East Flevoland is closed.")
        XCTAssertEqual(HiveCrown.name(for: story(a, "Oil hits $100 a barrel for first time since July", kind: nil)), "Oil hits $100 a barrel for first time since July")
    }

    func testALongNameIsCutAtAWordTheWayTheWebsiteCutsIt() {
        let long = "Nineteen members of al-Qaeda execute the September 11 attacks, a series of coordinated terrorist attacks"
        let line = HiveCrown.line(HiveCrown.Change(at: at("2026-09-23T19:12:00Z"), to: a, from: nil), nameOf: { _ in long })
        XCTAssertEqual(line, "3:12 pm Eastern: Nineteen members of al-Qaeda execute the September 11\u{2026} took the crown.")
        XCTAssertEqual(HiveCrown.short("Typhoid Mary"), "Typhoid Mary")
    }

    func testTheEmptyLineSpeaksTheBoardsVoice() {
        XCTAssertEqual(HiveCrown.none(voice: .bee), "No crown yet. The first buzz on this hive takes it.")
        XCTAssertEqual(HiveCrown.none(voice: .plain), "No crown yet. The first tap on this hive takes it.")
        XCTAssertEqual(HiveCopy.crownSub(phase: .live, voice: .bee), "The most buzzed story wears it. Every time it changes hands today:")
        XCTAssertEqual(HiveCopy.crownSub(phase: .closed, voice: .bee), "The most buzzed story wore it. Every time it changed hands before the seal:")
    }

    func testADayReadWithoutBoostsHasNoCrownNotACrash() {
        let d = WallDay(wallDate: WallDate(year: 2026, month: 9, day: 23)!,
                        opensAt: at("2026-09-22T04:00:00Z"), liveAt: at("2026-09-23T04:00:00Z"),
                        closesAt: at("2026-09-25T04:00:00Z"), closedAt: nil, stories: [])
        XCTAssertEqual(d.boosts, [])
        XCTAssertEqual(HiveCrown.crown(for: d), .empty)
    }
}
