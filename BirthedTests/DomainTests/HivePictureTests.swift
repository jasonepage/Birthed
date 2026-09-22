import XCTest
@testable import BirthedDomain

/// The event pictures on the hive. The credit line and the address are both
/// the website's, so each assertion is a value the website or the worker
/// already pins, copied rather than worked out here.
final class HivePictureTests: XCTestCase {
    private let project = URL(string: "https://lunqqhjwqrpbujwxwdzk.supabase.co")!

    func testCreditLineMatchesTheWorker() {
        // worker/test/pictures.test.ts
        XCTAssertEqual(
            HivePicture.creditLine(file: "WTC_smoking_on_9-11.jpeg", artist: "Michael Foran", license: "CC BY 2.0"),
            "Picture: WTC smoking on 9-11.jpeg, by Michael Foran, CC BY 2.0, from Wikimedia Commons."
        )
        XCTAssertEqual(
            HivePicture.creditLine(file: "Old.jpg", artist: nil, license: nil),
            "Picture: Old.jpg, from Wikimedia Commons."
        )
    }

    func testPublicAddressIsTheProjectsOwn() {
        XCTAssertEqual(
            HivePicture.publicURL(project: URL(string: "https://example.supabase.co/")!, path: "events/13857.jpg")?.absoluteString,
            "https://example.supabase.co/storage/v1/object/public/pictures/events/13857.jpg"
        )
    }

    func testOnlyAHistoryRowHasAKey() {
        XCTAssertEqual(HivePicture.key(subjectKind: "historical_event", subjectID: "13857"), "historical_event:13857")
        XCTAssertNil(HivePicture.key(subjectKind: nil, subjectID: nil), "a news story has no subject")
        XCTAssertNil(HivePicture.key(subjectKind: "notable_person", subjectID: "Q1"), "faces are not in this table")
    }

    func testARowWithNoPathDrawsNothing() {
        XCTAssertNil(HivePicture.from(row: ["event_id": 1, "path": NSNull(), "file": "A.jpg"], project: project))
        XCTAssertNil(HivePicture.from(row: ["event_id": 1, "path": "", "file": "A.jpg"], project: project))
    }

    func testARowReadsWhetherTheIdentifierIsANumberOrText() {
        let row: [String: Any] = ["event_id": 42, "path": "e/42.jpg", "file": "A_b.jpg",
                                  "artist": "", "license": "CC0", "commons_url": "https://commons.wikimedia.org/wiki/File:A_b.jpg"]
        let read = HivePicture.from(row: row, project: project)
        XCTAssertEqual(read?.key, "historical_event:42")
        XCTAssertEqual(read?.picture.credit, "Picture: A b.jpg, CC0, from Wikimedia Commons.", "an empty artist is no artist")
        XCTAssertEqual(HivePicture.from(row: ["event_id": "42", "path": "e/42.jpg", "file": "A.jpg"], project: project)?.key,
                       "historical_event:42")
    }
}
