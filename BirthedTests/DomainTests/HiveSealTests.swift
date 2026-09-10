import XCTest
@testable import BirthedDomain

/// What became of a buzz, and the one thing the reader hears about it after.
/// docs/the-wall.md section 15: a buzz had no consequence at either end, and
/// this is the end of it.
///
/// Every one of these is arithmetic on a clock or on a list, which is why it
/// is here and not on a phone: "does a reader in Tokyo get told before the
/// hive has actually sealed" is a question with an answer today rather than
/// one somebody notices in a bug report.
final class HiveSealTests: XCTestCase {

    private func at(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        guard let date = f.date(from: iso) else { fatalError("bad instant \(iso)") }
        return date
    }

    private let ninth = WallDate(year: 2026, month: 9, day: 9)!

    private func story(_ id: String, support: Int, placed: Bool = true, submitted: String = "2026-09-09T12:00:00Z") -> WallStory {
        WallStory(id: id, wallDate: ninth, submittedAt: at(submitted), headline: "Headline \(id)",
                  url: URL(string: "https://example.org/\(id)")!, outlet: "example.org",
                  status: placed ? .placed : .pool, tier: .claimed, support: support, placedAt: nil,
                  rect: placed ? WallRect(mx: 0, my: 0, w: 4, h: 3) : nil,
                  falseAt: nil, falseNote: nil, sources: [])
    }

    private func day(_ stories: [WallStory], closedAt: Date? = nil) -> WallDay {
        WallDay(wallDate: ninth,
                opensAt: at("2026-09-08T04:00:00Z"),
                liveAt: at("2026-09-09T04:00:00Z"),
                closesAt: at("2026-09-11T04:00:00Z"),
                closedAt: closedAt,
                stories: stories)
    }

    // MARK: Where a story came

    func testAPlaceIsAmongTheHivesOwnStoriesAndNothingElse() {
        let stories = [
            story("a", support: 9),
            story("b", support: 12),
            story("c", support: 3),
            // In the feed, not on the hive. It is not last on the hive; it was
            // never in that race, so it has no place at all.
            story("d", support: 40, placed: false),
        ]
        let d = day(stories)

        XCTAssertEqual(HiveStanding.place(of: "b", in: d), HivePlace(rank: 1, outOf: 3))
        XCTAssertEqual(HiveStanding.place(of: "a", in: d), HivePlace(rank: 2, outOf: 3))
        XCTAssertEqual(HiveStanding.place(of: "c", in: d), HivePlace(rank: 3, outOf: 3))
        XCTAssertNil(HiveStanding.place(of: "d", in: d), "a story in the feed has no place on the hive")
        XCTAssertNil(HiveStanding.place(of: "nobody", in: d))
    }

    func testATieIsBrokenTheWayTheFeedBreaksIt() {
        // Same support, so arrival decides, which is the order the reader
        // could have seen for themselves in the feed.
        let d = day([
            story("late", support: 5, submitted: "2026-09-09T18:00:00Z"),
            story("early", support: 5, submitted: "2026-09-09T06:00:00Z"),
        ])
        XCTAssertEqual(HiveStanding.place(of: "early", in: d)?.rank, 1)
        XCTAssertEqual(HiveStanding.place(of: "late", in: d)?.rank, 2)
    }

    // MARK: What the note holds

    func testANoteIsFiledOnABuzzAndCorrectedWhenTheDateIsReadAgain() {
        var notes = HiveNotes()
        let seals = at("2026-09-11T04:00:00Z")
        notes.record(storyID: "a", headline: "Headline a", on: ninth, sealsAt: seals)

        guard let filed = notes.note(on: ninth) else { return XCTFail("nothing was filed") }
        XCTAssertEqual(filed.storyID, "a")
        XCTAssertNil(filed.place, "a rank is not a fact at the moment of the buzz")
        XCTAssertFalse(filed.settled)

        // Read while the hive is still open: the rank lands and can still move.
        let open = day([story("a", support: 2), story("b", support: 7)])
        notes.reconcile(with: open, now: at("2026-09-09T20:00:00Z"))
        XCTAssertEqual(notes.note(on: ninth)?.place, HivePlace(rank: 2, outOf: 2))
        XCTAssertFalse(notes.note(on: ninth)?.settled ?? true, "an open hive is not settled")

        // Read after it sealed: the rank is final and is written down as such.
        let sealed = day([story("a", support: 9), story("b", support: 7)])
        notes.reconcile(with: sealed, now: at("2026-09-11T05:00:00Z"))
        XCTAssertEqual(notes.note(on: ninth)?.place, HivePlace(rank: 1, outOf: 2))
        XCTAssertTrue(notes.note(on: ninth)?.settled ?? false)

        // And a settled note is never touched again. A sealed hive cannot
        // change, so a later reading that disagreed would be a worse reading
        // rather than a newer fact.
        let nonsense = day([story("a", support: 0), story("b", support: 99)])
        notes.reconcile(with: nonsense, now: at("2026-09-12T05:00:00Z"))
        XCTAssertEqual(notes.note(on: ninth)?.place, HivePlace(rank: 1, outOf: 2))
    }

    func testABuzzTakenBackTakesItsNoteWithIt() {
        var notes = HiveNotes()
        notes.record(storyID: "a", headline: "Headline a", on: ninth, sealsAt: at("2026-09-11T04:00:00Z"))
        // Another story's undo leaves this note alone.
        notes.forget(storyID: "somebody-else", on: ninth)
        XCTAssertNotNil(notes.note(on: ninth))
        notes.forget(storyID: "a", on: ninth)
        XCTAssertNil(notes.note(on: ninth), "nothing wakes somebody to tell them about a vote they undid")
        XCTAssertTrue(notes.isEmpty)
    }

    func testNotesSurviveBeingStoredAndReadBackAndOutliveTheirOwnAnniversary() {
        var notes = HiveNotes()
        notes.record(storyID: "a", headline: "Headline a", on: ninth, sealsAt: at("2026-09-11T04:00:00Z"))
        notes.reconcile(with: day([story("a", support: 3)]), now: at("2026-09-11T05:00:00Z"))
        XCTAssertEqual(HiveNotes(notes: notes.all), notes)

        // Long enough to reach an anniversary. A reader who buzzes every day
        // would otherwise have lost last September by February.
        XCTAssertGreaterThan(HiveNotes.datesKept, 366)

        // The oldest fall off rather than growing forever. One note per year
        // is enough to make distinct keys in order without inventing a
        // February 31.
        var many = HiveNotes()
        let years = 1600..<(1600 + HiveNotes.datesKept + 5)
        for year in years {
            many.record(storyID: "s", headline: "h", on: WallDate(year: year, month: 1, day: 1)!,
                        sealsAt: at("2026-09-11T04:00:00Z"))
        }
        XCTAssertEqual(many.all.count, HiveNotes.datesKept)
        XCTAssertNil(many.note(on: WallDate(year: 1600, month: 1, day: 1)!), "the oldest went")
        XCTAssertNotNil(many.note(on: WallDate(year: years.upperBound - 1, month: 1, day: 1)!), "the newest stayed")
    }

    // MARK: What the banner says

    func testTheBannerSaysOnlyWhatIsKnown() {
        XCTAssertEqual(HiveCopy.sealedTitle(dateName: "September 9"), "Your September 9 hive sealed")

        // Settled: a sealed hive cannot change, so it is said flatly.
        XCTAssertEqual(
            HiveCopy.sealedBody(place: HivePlace(rank: 3, outOf: 12), settled: true, headline: "H", voice: .bee),
            "The story you buzzed came third of twelve."
        )
        // Not settled: it can still move, so it is said as what it was.
        XCTAssertEqual(
            HiveCopy.sealedBody(place: HivePlace(rank: 3, outOf: 12), settled: false, headline: "H", voice: .bee),
            "The story you buzzed was third of twelve when you last looked."
        )
        // No place: no number is invented for a race the story was not in.
        XCTAssertEqual(
            HiveCopy.sealedBody(place: nil, settled: true, headline: "A thing that happened", voice: .bee),
            "The story you buzzed: A thing that happened"
        )
        // A solemn date does not make the pun here either.
        XCTAssertEqual(
            HiveCopy.sealedBody(place: HivePlace(rank: 1, outOf: 2), settled: true, headline: "H", voice: .plain),
            "The story you backed came first of two."
        )
        for line in [HiveCopy.sealedTitle(dateName: "September 11"),
                     HiveCopy.sealedBody(place: HivePlace(rank: 1, outOf: 2), settled: true, headline: "H", voice: .plain),
                     HiveCopy.sealedBody(place: nil, settled: false, headline: "H", voice: .plain)] {
            for banned in ["wall", "square", "boost", "remember"] {
                XCTAssertFalse(line.lowercased().contains(banned), "\"\(line)\" says \(banned)")
            }
        }
    }

    func testNumbersPastWhatAHiveHoldsAreNotGivenWrongWords() {
        XCTAssertEqual(HiveCopy.ordinal(1), "first")
        XCTAssertEqual(HiveCopy.ordinal(12), "twelfth")
        XCTAssertEqual(HiveCopy.count(12), "twelve")
        // A board that grows one day must not start saying "the thirteenth"
        // wrongly, so past what the words cover it uses numerals.
        XCTAssertEqual(HiveCopy.ordinal(13), "number 13")
        XCTAssertEqual(HiveCopy.count(20), "20")
        XCTAssertEqual(HiveCopy.ordinal(0), "number 0")
    }
}
