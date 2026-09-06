import XCTest
@testable import BirthedDomain

/// Asking somebody for their birthday, as opposed to being sent one.
///
/// The code is the only thing in this app that a stranger types into a form on
/// the open web, so the tests here are mostly about it being unambiguous to
/// read and impossible to confuse with something it is not.
final class BirthdayRequestTests: XCTestCase {

    // MARK: The code

    func testACodeIsAlwaysTheAgreedShape() {
        for _ in 0..<200 {
            let code = BirthdayRequest.newCode()
            XCTAssertEqual(code.count, BirthdayRequest.codeLength)
            XCTAssertTrue(BirthdayRequest.isWellFormed(code), "generated \(code)")
        }
    }

    func testACodeNeverContainsACharacterSomebodyWouldMisread() {
        // O and 0, I and 1 and l. Somebody is going to read one of these off a
        // screenshot, and those pairs are the entire reason that fails.
        let forbidden = Set("O0I1L")
        for _ in 0..<200 {
            let code = BirthdayRequest.newCode()
            XCTAssertTrue(code.allSatisfy { !forbidden.contains($0) }, "generated \(code)")
        }
    }

    func testCodesAreNotAllTheSame() {
        let many = Set((0..<200).map { _ in BirthdayRequest.newCode() })
        XCTAssertGreaterThan(many.count, 190, "the generator is not varying")
    }

    func testTheShapeCheckRejectsWhatTheWebPageWouldReject() {
        XCTAssertFalse(BirthdayRequest.isWellFormed(""))
        XCTAssertFalse(BirthdayRequest.isWellFormed("ABC"), "too short")
        XCTAssertFalse(BirthdayRequest.isWellFormed("ABCDEFGHJKMNP"), "too long")
        XCTAssertFalse(BirthdayRequest.isWellFormed("abcdefgh"), "lower case is not our shape")
        XCTAssertFalse(BirthdayRequest.isWellFormed("ABCD 234"), "a space is not our shape")
        XCTAssertFalse(BirthdayRequest.isWellFormed("ABCDEF01"), "zero and one are not in the alphabet")
        XCTAssertTrue(BirthdayRequest.isWellFormed("ABCD2345"))
    }

    // MARK: The link

    func testTheLinkCarriesTheCodeInTheFragment() {
        let url = BirthdayRequest.url(code: "ABCD2345")
        XCTAssertEqual(url?.fragment, "c=ABCD2345")
        // The same rule as everywhere else here: nothing about anybody in the
        // part of the address a browser would send to the server.
        XCTAssertNil(url?.query)
        XCTAssertEqual(url?.host, PersonLink.host)
    }

    func testAnAskerCanPutTheirNameOnItWithoutBreakingTheAddress() {
        let url = BirthdayRequest.url(code: "ABCD2345", from: "Nathan Page")
        XCTAssertNotNil(url, "a two word name must not return nil")
        XCTAssertEqual(url?.fragment, "c=ABCD2345&r=Nathan%20Page")
    }

    func testANamelessAskIsStillAnAsk() {
        let url = BirthdayRequest.url(code: "ABCD2345", from: "   ")
        XCTAssertEqual(url?.fragment, "c=ABCD2345")
    }

    func testALongNameIsCutRatherThanRefused() {
        let url = BirthdayRequest.url(code: "ABCD2345", from: String(repeating: "a", count: 200))
        XCTAssertNotNil(url)
        let written = url?.fragment?.replacingOccurrences(of: "c=ABCD2345&r=", with: "") ?? ""
        XCTAssertEqual(written.count, BirthdayRequest.maxAskerLength)
    }

    func testAMalformedCodeMakesNoLinkAtAll() {
        // Better nothing than a link that quietly cannot be answered.
        XCTAssertNil(BirthdayRequest.url(code: "nope"))
        XCTAssertNil(BirthdayRequest.url(code: ""))
    }

    func testAnAskLinkIsNotMistakenForASharedBirthday() {
        // Both land on the same page and the same app. The one thing that must
        // never happen is the app reading an ask as though somebody had sent
        // their birthday, and adding a person out of a request for one.
        let url = BirthdayRequest.url(code: "ABCD2345", from: "Nathan")
        XCTAssertNotNil(url)
        XCTAssertNil(url.flatMap(PersonLink.incoming(from:)))
    }
}
