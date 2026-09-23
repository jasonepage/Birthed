import XCTest
@testable import BirthedDomain

/// Buzzes that refill through the day, docs/the-wall.md section 30. The
/// instants are the ones migration 20260923010000_buzzes_that_refill.sql was
/// tested against inside a rolled back transaction on September 23, 2026,
/// and the ones web/test/refills.test.ts asserts, so the app, the site and
/// the database agree at every one.
///
/// Not run as of September 23, 2026: no Swift toolchain in that session.
/// Jason builds.
final class RefillsTests: XCTestCase {

    private let d = WallDate(year: 2026, month: 9, day: 23)!

    private func at(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        guard let date = f.date(from: iso) else { fatalError("bad instant \(iso)") }
        return date
    }

    func testTheAppSaysNothingAboutRefillsUntilTheMigrationIsApplied() {
        XCTAssertFalse(Refills.on, "flip with the migration, docs/the-wall.md section 30")
        XCTAssertEqual(Refills.nextWords(now: at("2026-09-23T05:00:00Z"), wallDate: d, allowance: 3), "")
        XCTAssertEqual(HiveCopy.left(3, allowance: 3, voice: .bee, next: ""), "Three buzzes left today.")
    }

    func testWhatHasArrivedByAnInstantIsTheDatabasesAnswer() {
        XCTAssertEqual(Refills.arrived(by: at("2026-09-23T04:00:00Z"), wallDate: d), 1)
        XCTAssertEqual(Refills.arrived(by: at("2026-09-23T11:59:59Z"), wallDate: d), 1)
        XCTAssertEqual(Refills.arrived(by: at("2026-09-23T12:00:00Z"), wallDate: d), 2)
        XCTAssertEqual(Refills.arrived(by: at("2026-09-23T19:59:59Z"), wallDate: d), 2)
        XCTAssertEqual(Refills.arrived(by: at("2026-09-23T20:00:00Z"), wallDate: d), 3)
        XCTAssertEqual(Refills.arrived(by: at("2026-09-24T03:59:59Z"), wallDate: d), 3)
        XCTAssertEqual(Refills.arrived(by: at("2026-09-24T04:00:00Z"), wallDate: d), 1)
        XCTAssertEqual(Refills.arrived(by: at("2026-09-24T21:00:00Z"), wallDate: d), 1)
        XCTAssertEqual(Refills.arrived(by: at("2026-09-23T03:59:59Z"), wallDate: d), 0)
        XCTAssertEqual(Refills.arrived(by: at("2026-09-25T04:00:00Z"), wallDate: d), 0)
    }

    func testStandardTime() {
        let dec = WallDate(year: 2026, month: 12, day: 23)!
        XCTAssertEqual(Refills.arrived(by: at("2026-12-23T12:59:59Z"), wallDate: dec), 1)
        XCTAssertEqual(Refills.arrived(by: at("2026-12-23T13:00:00Z"), wallDate: dec), 2)
        XCTAssertEqual(Refills.arrived(by: at("2026-12-23T21:00:00Z"), wallDate: dec), 3)
        XCTAssertEqual(Refills.next(after: at("2026-12-23T05:00:00Z"), wallDate: dec), at("2026-12-23T13:00:00Z"))
    }

    func testTheNextRefillAndTheWords() {
        XCTAssertEqual(Refills.next(after: at("2026-09-23T04:00:00Z"), wallDate: d), at("2026-09-23T12:00:00Z"))
        XCTAssertEqual(Refills.next(after: at("2026-09-23T12:00:00Z"), wallDate: d), at("2026-09-23T20:00:00Z"))
        XCTAssertNil(Refills.next(after: at("2026-09-23T20:00:00Z"), wallDate: d), "after 4 pm nothing more arrives today; the midnight is the day changing")
        XCTAssertNil(Refills.next(after: at("2026-09-24T05:00:00Z"), wallDate: d), "the day after has its one and no refill")
        XCTAssertEqual(Refills.words(at("2026-09-23T12:00:00Z")), "8 am Eastern")
        XCTAssertEqual(Refills.words(at("2026-09-23T20:00:00Z")), "4 pm Eastern")
        XCTAssertEqual(Refills.nextWords(now: at("2026-09-23T05:00:00Z"), wallDate: d, allowance: 3, on: true), "8 am Eastern")
        XCTAssertEqual(Refills.nextWords(now: at("2026-09-23T13:00:00Z"), wallDate: d, allowance: 3, on: true), "4 pm Eastern")
        XCTAssertEqual(Refills.nextWords(now: at("2026-09-23T21:00:00Z"), wallDate: d, allowance: 3, on: true), "")
        XCTAssertEqual(Refills.nextWords(now: at("2026-09-24T13:00:00Z"), wallDate: d, allowance: 1, on: true), "")
    }

    func testTheDayTheClocksGoBack() {
        let fall = WallDate(year: 2026, month: 11, day: 1)!
        XCTAssertEqual(Refills.next(after: at("2026-11-01T04:00:00Z"), wallDate: fall), at("2026-11-01T13:00:00Z"), "8 am Eastern Standard Time")
        XCTAssertEqual(Refills.arrived(by: at("2026-11-01T12:30:00Z"), wallDate: fall), 1)
        XCTAssertEqual(Refills.arrived(by: at("2026-11-01T13:00:00Z"), wallDate: fall), 2)
    }

    func testTheCountSentenceWithRefillsOnIsTheWebsites() {
        XCTAssertEqual(HiveCopy.left(0, allowance: 3, voice: .bee, next: "4 pm Eastern"), "No buzzes left right now. The next one arrives at 4 pm Eastern.")
        XCTAssertEqual(HiveCopy.left(1, allowance: 3, voice: .bee, next: "8 am Eastern"), "One buzz left right now. The next one arrives at 8 am Eastern.")
        XCTAssertEqual(HiveCopy.left(2, allowance: 3, voice: .plain, next: "4 pm Eastern"), "Two taps left right now. The next one arrives at 4 pm Eastern.")
        XCTAssertEqual(HiveCopy.allowance(0, allowance: 3, phase: .live, voice: .bee, next: "4 pm Eastern"), "No buzzes left right now. The next one arrives at 4 pm Eastern.")
        XCTAssertEqual(HiveCopy.allowance(0, allowance: 3, phase: .closed, voice: .bee, next: "4 pm Eastern"), "This hive has sealed and is permanent now.")
    }
}
