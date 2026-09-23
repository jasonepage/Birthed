import XCTest
@testable import BirthedDomain

/// The hive's rules: which word a date speaks, what the count says, what the
/// window on the board is, whose mark a mark is, and the order of the one
/// feed. docs/the-wall.md sections 4, 13 and 14.
///
/// Several of these assert a value taken from the website rather than one
/// worked out here, because the app is catching up to the web and two ports
/// of one rule that disagree are two rules. Where that is so it is said on
/// the line.
final class HiveTests: XCTestCase {

    private func at(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        guard let date = f.date(from: iso) else { fatalError("bad instant \(iso)") }
        return date
    }

    private func story(
        _ id: String,
        support: Int = 0,
        priority: Int = 0,
        status: WallStoryStatus = .pool,
        rect: WallRect? = nil,
        submitted: String = "2026-09-09T12:00:00Z",
        subject: (String, String)? = nil
    ) -> WallStory {
        WallStory(id: id, wallDate: WallDate(year: 2026, month: 9, day: 9)!,
                  submittedAt: at(submitted), headline: "Headline \(id)",
                  url: URL(string: "https://example.org/\(id)")!, outlet: "example.org",
                  status: status, tier: .claimed, support: support, placedAt: nil, rect: rect,
                  falseAt: nil, falseNote: nil, sources: [],
                  priority: priority, subjectKind: subject?.0, subjectID: subject?.1)
    }

    private func item(_ id: String, subject: RememberSubject? = nil) -> DayFeed.Item {
        DayFeed.Item(id: id, kind: .event, kicker: "ON THIS DAY", year: 1999,
                     ageLabel: "You were 7", text: "Something happened", detail: "1999",
                     sourceURL: nil, fact: nil, subject: subject)
    }

    // MARK: The voice

    func testEveryDateSaysBuzzIncludingSeptemberEleven() {
        XCTAssertEqual(HiveDates.voice(month: 9, day: 11), .bee)
        XCTAssertEqual(HiveDates.voice(month: 9, day: 11).button, "Buzz")
        XCTAssertEqual(HiveDates.voice(month: 9, day: 11).mark, "You buzzed this")
        XCTAssertEqual(HiveDates.voice(month: 9, day: 9), .bee)
        XCTAssertEqual(HiveDates.voice(month: 9, day: 9).button, "Buzz")
        XCTAssertEqual(HiveDates.voice(month: 9, day: 9).mark, "You buzzed this")
        // No date is solemn any more: one product, one voice.
        XCTAssertEqual(HiveDates.plainDates.count, 0)
        // The key is unpadded, the same shape wallKey makes on the website.
        XCTAssertEqual(HiveDates.key(month: 9, day: 11), "9-11")
        XCTAssertEqual(HiveDates.key(month: 12, day: 7), "12-7")
    }

    func testTheVoiceReachesADateThroughEitherKindOfDate() {
        XCTAssertEqual(HiveDates.voice(for: WallDate(year: 2026, month: 9, day: 11)!), .bee)
        XCTAssertEqual(HiveDates.voice(for: CalendarDate(month: 9, day: 11)!), .bee)
        XCTAssertEqual(HiveDates.voice(for: WallDate(year: 2001, month: 9, day: 11)!), .bee,
                       "the year has nothing to do with it")
    }

    // MARK: What the count says

    func testAStoryNobodyHasBackedShowsNoCountAtAll() {
        XCTAssertNil(HiveCopy.count(0, voice: .bee), "never 0 buzzes")
        XCTAssertNil(HiveCopy.count(-1, voice: .bee))
        XCTAssertEqual(HiveCopy.count(1, voice: .bee), "1 buzz")
        XCTAssertEqual(HiveCopy.count(3, voice: .bee), "3 buzzes")
        XCTAssertEqual(HiveCopy.count(1, voice: .plain), "1 tap")
        XCTAssertEqual(HiveCopy.count(12, voice: .plain), "12 taps")
    }

    /// Every sentence here is the website's own answer, printed from
    /// web/src/wall.ts and pasted in, so the two products count alike.
    func testTheRemainingCountReadsTheWayTheWebsiteSaysIt() {
        XCTAssertEqual(HiveCopy.left(3, allowance: 3, voice: .bee), "Three buzzes left today.")
        XCTAssertEqual(HiveCopy.left(1, allowance: 3, voice: .bee), "One buzz left today.")
        XCTAssertEqual(HiveCopy.left(0, allowance: 3, voice: .bee), "No buzzes left today.")
        XCTAssertEqual(HiveCopy.left(2, allowance: 3, voice: .plain), "Two taps left today.")
        // The day after the date, where the allowance is one and the reader
        // may still have three on today's own date.
        XCTAssertEqual(HiveCopy.left(1, allowance: 1, voice: .bee),
                       "One buzz left today on this date. It closes tonight.")
        XCTAssertEqual(HiveCopy.left(0, allowance: 1, voice: .bee), "No buzzes left today on this date.")
        // A count past the words it has still reads as a sentence.
        XCTAssertEqual(HiveCopy.left(9, allowance: 3, voice: .bee), "Four buzzes left today.")
    }

    func testThePhaseDecidesWhetherThereIsACountToShowAtAll() {
        XCTAssertEqual(HiveCopy.allowance(3, allowance: 3, phase: .live, voice: .bee), "Three buzzes left today.")
        XCTAssertEqual(HiveCopy.allowance(3, allowance: 0, phase: .notYetOpen, voice: .bee),
                       "This hive has not opened yet.")
        XCTAssertEqual(HiveCopy.allowance(3, allowance: 0, phase: .submissionsOnly, voice: .bee),
                       "Stories only until the date arrives. Buzzes start then.")
        XCTAssertEqual(HiveCopy.allowance(3, allowance: 0, phase: .submissionsOnly, voice: .plain),
                       "Stories only until the date arrives. Taps start then.")
        XCTAssertEqual(HiveCopy.allowance(0, allowance: 0, phase: .closed, voice: .bee),
                       "This hive has sealed and is permanent now.")
    }

    func testNothingAReaderCanReachSaysWallSquareBoostOrRemember() {
        let dateName = "September 9"
        var sentences: [String] = [
            HiveCopy.legend, HiveCopy.noHive, HiveCopy.receiptNote, HiveCopy.openTheHive,
            HiveCopy.nothingWaiting(dateName: dateName),
            HiveCopy.lede(dateName: dateName, voice: .bee),
            HiveCopy.lede(dateName: dateName, voice: .plain),
            HiveCopy.undo, HiveCopy.undoWindow,
            HiveCopy.undone(voice: .bee), HiveCopy.undone(voice: .plain),
            HiveCopy.tooLate(voice: .bee), HiveCopy.tooLate(voice: .plain),
            HiveCopy.crown, HiveCopy.wearsTheCrown,
            HiveCrown.none(voice: .bee), HiveCrown.none(voice: .plain),
            HiveCrown.back("Typhoid Mary"),
        ]
        for phase in [WallDay.Phase.notYetOpen, .submissionsOnly, .live, .closed] {
            for voice in [HiveVoice.bee, .plain] {
                sentences.append(HiveCopy.crownSub(phase: phase, voice: voice))
                sentences.append(HiveCopy.allowance(2, allowance: 3, phase: phase, voice: voice))
                sentences.append(HiveCopy.allowance(0, allowance: 3, phase: phase, voice: voice, next: "4 pm Eastern"))
                sentences.append(HiveCopy.quietLede(dateName: dateName, phase: phase, voice: voice))
                sentences.append(HiveCopy.feedNote(dateName: dateName, phase: phase, voice: voice))
                sentences.append(HiveCopy.empty(phase: phase, voice: voice))
            }
        }
        for message in ["wall: the wall for 2026-09-07 has closed",
                        "wall: the wall for 2026-09-10 takes no boosts until the day arrives",
                        "wall: 0 left on 2026-09-09 today, not 1",
                        "wall: ten submissions a day, and today's ten are spent",
                        "this device could not be verified",
                        "something unexpected"] {
            sentences.append(HiveCopy.refusal(message, voice: .bee))
            sentences.append(HiveCopy.refusal(message, voice: .plain))
        }
        for sentence in sentences {
            let lower = sentence.lowercased()
            for banned in ["wall", "square", "boost", "remember"] {
                XCTAssertFalse(lower.contains(banned), "\"\(sentence)\" says \(banned)")
            }
        }
    }

    func testARefusalFromTheServerComesBackInThisDatesOwnWord() {
        XCTAssertEqual(HiveCopy.refusal("wall: 0 left on 2026-09-09 today, not 1", voice: .bee),
                       "Your buzzes on this date are spent for today.")
        XCTAssertEqual(HiveCopy.refusal("wall: 0 left on 2026-09-09 today, not 1", voice: .plain),
                       "Your taps on this date are spent for today.")
        XCTAssertEqual(HiveCopy.refusal("wall_boosts: 2 units on 2026-09-09 from 2026-09-09 would exceed the budget of 3 for that day (already 2)", voice: .bee),
                       "Your buzzes on this date are spent for today.")
        XCTAssertEqual(HiveCopy.refusal("wall: the wall for 2026-09-10 takes no boosts until the day arrives", voice: .bee),
                       "Buzzes for this date start when the day arrives, Eastern time.")
        XCTAssertEqual(HiveCopy.refusal("wall: the wall for 2026-09-10 takes no boosts until the day arrives", voice: .plain),
                       "Taps for this date start when the day arrives, Eastern time.")
        XCTAssertEqual(HiveCopy.refusal("wall: the wall for 2026-09-07 has closed", voice: .bee),
                       "This hive has sealed. Nothing more can be added to it.")
        XCTAssertEqual(HiveCopy.refusal("wall: story is marked shown false", voice: .bee),
                       "That story has been shown false and takes no buzzes.")
        XCTAssertEqual(HiveCopy.refusal("wall: ten submissions a day, and today's ten are spent", voice: .bee),
                       "Ten stories a day, and today's ten are spent.")
        XCTAssertEqual(HiveCopy.refusal("this device could not be verified", voice: .bee),
                       "This device could not be verified. Adding to the hive needs a real device.")
        XCTAssertEqual(HiveCopy.refusal("something unexpected", voice: .bee),
                       "The hive refused that. Try again in a moment.")
    }

    // MARK: The window on the board

    /// Every expected value below was printed by `viewportFor` in
    /// web/src/wall.ts and pasted in. The last case is the one that matters
    /// most: the website halves in floating point, and a port that halved in
    /// whole numbers would answer 1 where the website answers 0.
    func testTheWindowIsTheSmallestSquareThatHoldsTheTilesAndMatchesTheWebsite() {
        func view(_ rects: [WallRect]) -> HiveViewport { WallBoard.viewport(for: rects) }

        XCTAssertEqual(view([]), HiveViewport(ox: 0, oy: 0, side: 8), "no tiles is still a square")
        XCTAssertEqual(view([WallRect(mx: 6, my: 6, w: 4, h: 3)]), HiveViewport(ox: 4, oy: 3, side: 8))
        XCTAssertEqual(view([WallRect(mx: 0, my: 0, w: 16, h: 16)]), HiveViewport(ox: 0, oy: 0, side: 16),
                       "never larger than the board")
        XCTAssertEqual(view([WallRect(mx: 13, my: 13, w: 3, h: 3)]), HiveViewport(ox: 8, oy: 8, side: 8),
                       "a corner tile pulls the window back onto the board")
        XCTAssertEqual(view([WallRect(mx: 0, my: 0, w: 2, h: 2)]), HiveViewport(ox: 0, oy: 0, side: 8),
                       "and off the other edge too")
        XCTAssertEqual(view([WallRect(mx: 1, my: 1, w: 4, h: 3), WallRect(mx: 10, my: 9, w: 4, h: 3)]),
                       HiveViewport(ox: 1, oy: 0, side: 13))
        XCTAssertEqual(view([WallRect(mx: 1, my: 0, w: 4, h: 3), WallRect(mx: 9, my: 10, w: 4, h: 3)]),
                       HiveViewport(ox: 0, oy: 0, side: 13),
                       "halved in floating point, the way the website halves it")
    }

    func testEveryTileFitsInsideTheWindowTheWindowChose() {
        let sets: [[WallRect]] = [
            [WallRect(mx: 6, my: 6, w: 4, h: 3)],
            [WallRect(mx: 13, my: 13, w: 3, h: 3)],
            [WallRect(mx: 0, my: 0, w: 2, h: 2)],
            [WallRect(mx: 1, my: 1, w: 4, h: 3), WallRect(mx: 10, my: 9, w: 4, h: 3)],
            [WallRect(mx: 1, my: 0, w: 4, h: 3), WallRect(mx: 9, my: 10, w: 4, h: 3)],
            [WallRect(mx: 0, my: 0, w: 16, h: 16)],
        ]
        for rects in sets {
            let view = WallBoard.viewport(for: rects)
            XCTAssertGreaterThanOrEqual(view.side, WallBoard.viewMin)
            XCTAssertLessThanOrEqual(view.side, WallBoard.modules)
            XCTAssertGreaterThanOrEqual(view.ox, 0)
            XCTAssertGreaterThanOrEqual(view.oy, 0)
            XCTAssertLessThanOrEqual(view.ox + view.side, WallBoard.modules)
            XCTAssertLessThanOrEqual(view.oy + view.side, WallBoard.modules)
            for rect in rects {
                XCTAssertGreaterThanOrEqual(rect.mx, view.ox, "\(rect) starts before the window")
                XCTAssertGreaterThanOrEqual(rect.my, view.oy, "\(rect) starts above the window")
                XCTAssertLessThanOrEqual(rect.mx + rect.w, view.ox + view.side, "\(rect) runs off the window")
                XCTAssertLessThanOrEqual(rect.my + rect.h, view.oy + view.side, "\(rect) runs off the window")
            }
        }
    }

    func testAWindowMakesItsTilesBiggerWithoutMovingThemOnTheBoard() {
        let rect = WallRect(mx: 6, my: 6, w: 4, h: 3)
        let view = WallBoard.viewport(for: [rect])
        let zoomed = WallBoard.frame(of: rect, in: view, side: 320, gap: 2)
        // A window eight modules across on a 320 point square is a 40 point
        // module, against 20 for the whole board, so a tile is twice the size
        // and the rectangle the server stored has not changed.
        XCTAssertEqual(zoomed.width, 4 * 40 - 2, accuracy: 0.001)
        XCTAssertEqual(zoomed.height, 3 * 40 - 2, accuracy: 0.001)
        XCTAssertEqual(zoomed.x, Double(6 - view.ox) * 40 + 1, accuracy: 0.001)
        XCTAssertEqual(zoomed.y, Double(6 - view.oy) * 40 + 1, accuracy: 0.001)
        // The whole board, for comparison, is the old drawing.
        let whole = WallBoard.frame(of: rect, side: 320, gap: 2)
        XCTAssertEqual(whole.width, 4 * 20 - 2, accuracy: 0.001)
    }

    func testTheWindowIsBuiltFromTheStoriesActuallyOnTheHive() {
        let placed = story("a", status: .placed, rect: WallRect(mx: 6, my: 6, w: 4, h: 3))
        let pooled = story("b", status: .pool)
        XCTAssertEqual(WallBoard.viewport(forStories: [placed, pooled]),
                       HiveViewport(ox: 4, oy: 3, side: 8),
                       "a story in the pool has no rectangle and cannot widen the window")
        XCTAssertEqual(WallBoard.viewport(forStories: [pooled]), HiveViewport(ox: 0, oy: 0, side: 8))
    }

    // MARK: This account's own buzzes

    func testAMarkIsOnlyOnTheStoriesThisAccountBuzzedOnTheDateItBuzzedThem() {
        let ninth = WallDate(year: 2026, month: 9, day: 9)!
        let tenth = WallDate(year: 2026, month: 9, day: 10)!
        var marks = HiveMarks()
        XCTAssertTrue(marks.isEmpty)
        XCTAssertFalse(marks.has(storyID: "a", on: ninth))

        marks.add(storyID: "a", on: ninth)
        XCTAssertTrue(marks.has(storyID: "a", on: ninth))
        XCTAssertFalse(marks.has(storyID: "b", on: ninth), "another story on the same date")
        XCTAssertFalse(marks.has(storyID: "a", on: tenth), "the same story on another date")
        XCTAssertEqual(marks.storyIDs(on: ninth), ["a"])
        XCTAssertEqual(marks.storyIDs(on: tenth), [])

        // Twice is once. The database returns the first boost for a repeat and
        // so does this.
        marks.add(storyID: "a", on: ninth)
        XCTAssertEqual(marks.storyIDs(on: ninth), ["a"])
    }

    func testMarksSurviveBeingStoredAndReadBackAndRefuseWhatIsMisshapen() {
        let ninth = WallDate(year: 2026, month: 9, day: 9)!
        var marks = HiveMarks()
        marks.add(storyID: "b", on: ninth)
        marks.add(storyID: "a", on: ninth)
        XCTAssertEqual(marks.stored["2026-09-09"], ["a", "b"], "sorted, so an unchanged write is unchanged")
        XCTAssertEqual(HiveMarks(stored: marks.stored), marks)

        let junk = HiveMarks(stored: ["not-a-date": ["a"], "2026-09-09": [""], "2026-09-10": ["c"]])
        XCTAssertFalse(junk.has(storyID: "a", on: ninth))
        XCTAssertTrue(junk.has(storyID: "c", on: WallDate(year: 2026, month: 9, day: 10)!))
        XCTAssertEqual(junk.stored.count, 1, "a key that is not a date and a date with no stories are both dropped")
    }

    func testTheOldestDatesFallOffRatherThanGrowingForever() {
        var marks = HiveMarks()
        let years = 1900..<(1900 + HiveMarks.datesKept + 10)
        for year in years {
            marks.add(storyID: "a", on: WallDate(year: year, month: 1, day: 1)!)
        }
        XCTAssertEqual(marks.stored.count, HiveMarks.datesKept)
        XCTAssertFalse(marks.has(storyID: "a", on: WallDate(year: 1900, month: 1, day: 1)!), "the oldest went")
        XCTAssertTrue(marks.has(storyID: "a", on: WallDate(year: years.upperBound - 1, month: 1, day: 1)!),
                      "the newest stayed")
    }

    func testTakingAMarkOffLeavesTheStoreExactlyAsItWasBeforeTheBuzz() {
        let ninth = WallDate(year: 2026, month: 9, day: 9)!
        let tenth = WallDate(year: 2026, month: 9, day: 10)!
        var marks = HiveMarks()
        let empty = marks.stored

        marks.add(storyID: "a", on: ninth)
        marks.add(storyID: "b", on: ninth)
        marks.add(storyID: "c", on: tenth)

        // One mark off leaves its neighbours and every other date alone.
        marks.remove(storyID: "a", on: ninth)
        XCTAssertFalse(marks.has(storyID: "a", on: ninth))
        XCTAssertTrue(marks.has(storyID: "b", on: ninth))
        XCTAssertTrue(marks.has(storyID: "c", on: tenth))

        // A date left holding nothing goes, so undoing the only buzz of a day
        // leaves the store byte for byte what it was before that buzz.
        marks.remove(storyID: "c", on: tenth)
        XCTAssertNil(marks.stored["2026-09-10"])
        marks.remove(storyID: "b", on: ninth)
        XCTAssertEqual(marks.stored as NSDictionary, empty as NSDictionary)
        XCTAssertTrue(marks.isEmpty)

        // Removing what is not there, on a date that is not there, changes
        // nothing and does not create one.
        marks.remove(storyID: "nobody", on: ninth)
        XCTAssertTrue(marks.isEmpty)
    }

    // MARK: Thirty seconds to take a misclick back

    func testTheUndoWindowIsOpenForThirtySecondsAndShutsJustBeforeTheDatabases() {
        let cast = Date(timeIntervalSince1970: 1_000_000)

        XCTAssertTrue(HiveUndo.open(castAt: cast, now: cast), "the moment it lands")
        XCTAssertTrue(HiveUndo.open(castAt: cast, now: cast.addingTimeInterval(28.9)))

        // A hair short of the database's thirty on purpose: a button drawn in
        // the last second sends a request that arrives after the window and
        // comes back "that one stands", which is a right answer to a question
        // the screen should not have asked.
        XCTAssertFalse(HiveUndo.open(castAt: cast, now: cast.addingTimeInterval(29)))
        XCTAssertFalse(HiveUndo.open(castAt: cast, now: cast.addingTimeInterval(30)))
        XCTAssertFalse(HiveUndo.open(castAt: cast, now: cast.addingTimeInterval(600)))
        XCTAssertLessThan(HiveUndo.seconds - 1, HiveUndo.seconds,
                          "the drawn window is never wider than the database's")

        // A clock that went backwards is not an open window. A phone whose
        // time is corrected between the buzz and the next redraw would
        // otherwise draw the button forever.
        XCTAssertFalse(HiveUndo.open(castAt: cast, now: cast.addingTimeInterval(-1)))

        XCTAssertEqual(HiveUndo.endsAt(castAt: cast), cast.addingTimeInterval(30))
        XCTAssertEqual(HiveUndo.secondsLeft(castAt: cast, now: cast), 30)
        XCTAssertEqual(HiveUndo.secondsLeft(castAt: cast, now: cast.addingTimeInterval(10.4)), 19)
        XCTAssertEqual(HiveUndo.secondsLeft(castAt: cast, now: cast.addingTimeInterval(90)), 0,
                       "never below zero")
    }

    func testTheUndoSentencesTakeTheDatesOwnVoice() {
        XCTAssertEqual(HiveCopy.undone(voice: .bee), "Taken back. That buzz is gone and you have it again.")
        XCTAssertEqual(HiveCopy.undone(voice: .plain), "Taken back. That tap is gone and you have it again.")
        XCTAssertTrue(HiveCopy.tooLate(voice: .bee).contains("thirty seconds"))
        XCTAssertTrue(HiveCopy.tooLate(voice: .plain).contains("tap"))
        XCTAssertFalse(HiveCopy.tooLate(voice: .plain).contains("buzz"),
                       "a solemn date does not make the pun, here either")
        XCTAssertEqual(HiveCopy.undo, "Buzzkill")
        XCTAssertEqual(HiveCopy.stung, "Stung")
    }

    // MARK: The order of the feed

    func testTheFeedIsMostBuzzedThenBiggestHistoryThenArrivalThenIdentifier() {
        let backed = story("backed", support: 1, priority: 0, submitted: "2026-09-09T18:00:00Z")
        let picked = story("picked", support: 0, priority: 3, submitted: "2026-09-09T17:00:00Z")
        let other = story("other", support: 0, priority: 1, submitted: "2026-09-09T16:00:00Z")
        let earlyNews = story("a-news", support: 0, priority: 0, submitted: "2026-09-09T10:00:00Z")
        let lateNews = story("z-news", support: 0, priority: 0, submitted: "2026-09-09T11:00:00Z")
        let tied = story("b-news", support: 0, priority: 0, submitted: "2026-09-09T10:00:00Z")

        let order = HiveFeed.waiting([lateNews, other, tied, picked, earlyNews, backed]).map(\.id)
        XCTAssertEqual(order, ["backed", "picked", "other", "a-news", "b-news", "z-news"])
        XCTAssertEqual(order.first, "backed", "one buzz beats any priority")
    }

    func testAStoryOnTheHiveIsNotInTheFeedUnderIt() {
        let onHive = story("hive", status: .placed, rect: WallRect(mx: 6, my: 6, w: 4, h: 3))
        let pooled = story("pool")
        let spilled = story("spill", status: .overflow)
        XCTAssertEqual(HiveFeed.waiting([onHive, pooled, spilled]).map(\.id), ["pool", "spill"])
    }

    func testASubjectKeyIsTheSameStringTheTimelineMakes() {
        let s = story("x", subject: ("historical_event", "4821"))
        XCTAssertEqual(HiveFeed.subjectKey(s), "historical_event:4821")
        XCTAssertEqual(HiveFeed.subjectKey(s), RememberSubject(kind: .historicalEvent, id: "4821").key)
        XCTAssertEqual(HiveFeed.subjectKey(story("y", subject: ("person", "Q42"))),
                       RememberSubject(kind: .person, id: "Q42").key)
        XCTAssertNil(HiveFeed.subjectKey(story("news")), "the day's news stands for no imported row")
    }

    func testTheOneFeedPutsTodaysNewsFirstKeepsTheTimelinesOrderAndLosesNothing() {
        let quietNews = story("news-quiet", support: 0, submitted: "2026-09-09T10:00:00Z")
        let buzzedNews = story("news-buzzed", support: 2, submitted: "2026-09-09T11:00:00Z")
        let onHive = story("hist-hive", status: .placed, rect: WallRect(mx: 6, my: 6, w: 4, h: 3),
                           subject: ("historical_event", "1"))
        let filed = story("hist-filed", subject: ("person", "Q42"))
        let orphan = story("hist-orphan", subject: ("birth_fact", "9"))

        let promoted = item("event-1", subject: RememberSubject(kind: .historicalEvent, id: "1"))
        let person = item("person-Q42", subject: RememberSubject(kind: .person, id: "Q42"))
        let song = item("song-1999", subject: RememberSubject(kind: .chartNumberOne, id: "cw-1"))
        let plain = item("fact-7")

        let rows = HiveFeed.build(items: [promoted, person, song, plain],
                                 stories: [quietNews, buzzedNews, onHive, filed, orphan])

        XCTAssertEqual(rows.map(\.id),
                       ["story-news-buzzed", "story-news-quiet", "person-Q42", "song-1999", "fact-7", "story-hist-orphan"])

        // This year's rows first, most buzzed of them first.
        XCTAssertEqual(rows[0].story?.id, "news-buzzed")
        XCTAssertNil(rows[0].item, "the day's news has no place in a timeline ranked by the reader's age")

        // The promoted row is on the hive above and is not drawn twice.
        XCTAssertFalse(rows.contains { $0.item?.id == "event-1" })
        XCTAssertFalse(rows.contains { $0.story?.id == "hist-hive" })

        // A timeline row the worker filed carries its story and its age line.
        let personRow = rows.first { $0.id == "person-Q42" }
        XCTAssertEqual(personRow?.story?.id, "hist-filed")
        XCTAssertEqual(personRow?.item?.ageLabel, "You were 7")
        XCTAssertTrue(personRow?.takesBuzz == true)

        // A song is keyed to a year and a chart rather than to a day, so it is
        // not a pixel yet and its row takes no buzz.
        let songRow = rows.first { $0.id == "song-1999" }
        XCTAssertNil(songRow?.story)
        XCTAssertFalse(songRow?.takesBuzz == true)
        XCTAssertNil(rows.first { $0.id == "fact-7" }?.story)

        // A story the worker filed that the timeline never drew is still in
        // the feed, or it is a story nobody could ever buzz.
        XCTAssertEqual(rows.last?.story?.id, "hist-orphan")
    }

    func testAStoryShownFalseKeepsItsRowAndTakesNothing() {
        let stamped = story("false", status: .shownFalse)
        let rows = HiveFeed.build(items: [], stories: [stamped])
        XCTAssertEqual(rows.count, 1)
        XCTAssertFalse(rows[0].takesBuzz)
    }

    func testTheTimelineIsNotReorderedByTheHive() {
        let a = item("a", subject: RememberSubject(kind: .person, id: "Q1"))
        let b = item("b", subject: RememberSubject(kind: .person, id: "Q2"))
        // The story under b has more support than the one under a, and the
        // timeline's order still stands: the rank is the reader's age and the
        // hive above is where support decides anything.
        let rows = HiveFeed.build(items: [a, b], stories: [
            story("sa", support: 0, subject: ("person", "Q1")),
            story("sb", support: 9, subject: ("person", "Q2")),
        ])
        XCTAssertEqual(rows.map(\.id), ["a", "b"])
    }

    func testTheAgeLineFollowsAPromotedStoryOntoItsTile() {
        let items = [
            item("event-1", subject: RememberSubject(kind: .historicalEvent, id: "1")),
            item("person-Q42", subject: RememberSubject(kind: .person, id: "Q42")),
            item("fact-7"),
        ]
        let lines = HiveFeed.ageLines(items: items)
        XCTAssertEqual(lines["historical_event:1"], "You were 7")
        XCTAssertEqual(lines["person:Q42"], "You were 7")
        XCTAssertEqual(lines.count, 2, "a row with no subject cannot lend its line to a tile")

        let promoted = story("hist", status: .placed, rect: WallRect(mx: 6, my: 6, w: 4, h: 3),
                             subject: ("historical_event", "1"))
        XCTAssertEqual(HiveFeed.ageLine(for: promoted, lines: lines), "You were 7")
        XCTAssertNil(HiveFeed.ageLine(for: story("news"), lines: lines), "the day's news has no age")
        XCTAssertNil(HiveFeed.ageLine(for: story("other", subject: ("person", "Q9")), lines: lines),
                     "a subject the timeline did not draw")
    }

    func testAReaderWithNoBirthYearLendsNoAgeLines() {
        // DayFeed leaves ageLabel nil when there is no birth year, and nothing
        // downstream may invent one.
        let bare = DayFeed.Item(id: "event-1", kind: .event, kicker: "ON THIS DAY", year: 1999,
                                ageLabel: nil, text: "Something happened", detail: "1999",
                                sourceURL: nil, fact: nil,
                                subject: RememberSubject(kind: .historicalEvent, id: "1"))
        XCTAssertTrue(HiveFeed.ageLines(items: [bare]).isEmpty)
    }

    // MARK: The three columns the app did not read

    func testARowCarriesItsPriorityAndItsSubjectAndAnOlderRowStillReads() {
        var row: [String: Any] = [
            "id": "11111111-1111-1111-1111-111111111111",
            "wall_date": "2026-09-09",
            "submitted_at": "2026-09-09T14:02:00.123456+00:00",
            "headline": "1969: Apollo 12 launches",
            "url": "https://en.wikipedia.org/wiki/Apollo_12",
            "outlet": "en.wikipedia.org",
            "status": "pool", "tier": "claimed", "support": 0,
            "priority": 3, "subject_kind": "historical_event", "subject_id": "4821",
        ]
        guard let filed = WallRows.story(row) else { return XCTFail("the row did not read") }
        XCTAssertEqual(filed.priority, 3)
        XCTAssertEqual(filed.subjectKind, "historical_event")
        XCTAssertEqual(filed.subjectID, "4821")
        XCTAssertEqual(HiveFeed.subjectKey(filed), "historical_event:4821")

        // A row written before the history migration, or a select that did not
        // ask for the columns. The lowest priority and no subject, which is
        // exactly a news story, and never a crash or a dropped row.
        row["priority"] = nil
        row["subject_kind"] = nil
        row["subject_id"] = nil
        guard let older = WallRows.story(row) else { return XCTFail("an older row must still read") }
        XCTAssertEqual(older.priority, 0)
        XCTAssertNil(older.subjectKind)
        XCTAssertNil(older.subjectID)

        // Null rather than absent, which is what the automatic interface sends.
        row["priority"] = NSNull()
        row["subject_kind"] = NSNull()
        row["subject_id"] = NSNull()
        guard let nulled = WallRows.story(row) else { return XCTFail("a null row must still read") }
        XCTAssertEqual(nulled.priority, 0)
        XCTAssertNil(nulled.subjectKind)

        // Half a subject is no subject. The database keeps the pair whole with
        // a constraint, and half a pair here would be a row nothing can match.
        row["subject_kind"] = "person"
        row["subject_id"] = NSNull()
        guard let half = WallRows.story(row) else { return XCTFail("a half row must still read") }
        XCTAssertNil(half.subjectKind)
        XCTAssertNil(half.subjectID)
        XCTAssertNil(HiveFeed.subjectKey(half))
    }
}
