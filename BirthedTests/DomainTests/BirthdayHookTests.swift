import XCTest
@testable import BirthedDomain

/// The line from somebody's day that goes into their message: where it goes,
/// what it says, and that no hook leaves the pinned drafts untouched.
final class BirthdayHookTests: XCTestCase {
    private let song = BirthdayHook.song(title: "I Don't Want to Miss a Thing", artist: "Aerosmith")

    func testTheHookGoesAfterTheFirstSentence() {
        XCTAssertEqual(
            BirthdayHook.insert(song, into: "Happy 28th, Sam! Hope it's a good one."),
            "Happy 28th, Sam! You were born the week I Don't Want to Miss a Thing by Aerosmith was number one. Hope it's a good one."
        )
    }

    func testAOneSentenceDraftGetsTheHookAtTheEnd() {
        XCTAssertEqual(BirthdayHook.insert(.twin(name: "Will Smith"), into: "Happy birthday, Mum."),
                       "Happy birthday, Mum. You share a birthday with Will Smith.")
        XCTAssertEqual(BirthdayHook.insert(.twin(name: "Will Smith"), into: "Happy birthday"),
                       "Happy birthday. You share a birthday with Will Smith.")
    }

    func testNoHookIsTheDraftUnchanged() {
        XCTAssertEqual(BirthdayHook.insert(nil, into: "Happy 28th, Sam! Hope it's a good one."),
                       "Happy 28th, Sam! Hope it's a good one.")
    }

    func testTheOfferIsTheSongThenOneTwin() {
        XCTAssertEqual(BirthdayHook.offered(songTitle: "Stutter", songArtist: "Joe featuring Mystikal",
                                            twins: ["Mark Carney", "Alexandra Daddario"]),
                       [.song(title: "Stutter", artist: "Joe featuring Mystikal"), .twin(name: "Mark Carney")])
        XCTAssertEqual(BirthdayHook.offered(songTitle: nil, songArtist: nil, twins: []), [])
    }
}
