import XCTest
@testable import BirthedDomain

/// The three strengths of refusal, and the boundary between them.
final class ScreeningTests: XCTestCase {

    // MARK: The loosest list, which only moves a row

    func testHeavyCatchesWhatTheTodayFeedMustNotLeadWith() {
        XCTAssertTrue(Screening.heavy("A gunman killed 17 people at a school in Parkland, Florida."))
        XCTAssertTrue(Screening.heavy("An earthquake struck Mexico City."))
        XCTAssertTrue(Screening.heavy("Princess Diana died in Paris."))
    }

    func testHeavyLeavesAnOrdinaryDayAlone() {
        XCTAssertFalse(Screening.heavy("The PlayStation 5 was released in North America."))
        XCTAssertFalse(Screening.heavy("Google was founded in Menlo Park, California."))
    }

    /// The behaviour `DayFeed` had before the list moved into this file. If
    /// this test and `DayFeedTests` ever disagree, the delegation broke.
    func testDayFeedStillAsksTheSameQuestion() {
        for sentence in ["Somebody was killed", "The PlayStation 5 was released"] {
            XCTAssertEqual(DayFeed.isHeavy(sentence), Screening.heavy(sentence), sentence)
        }
    }

    // MARK: The stricter list, which removes a line

    /// The six words the Swift copy was missing while the website had them.
    /// This is the drift the shared file exists to stop.
    func testTheCardListCatchesWhatTheFeedListLetThrough() {
        for sentence in [
            "The Second World War began in Europe.",
            "The Battle of Hastings was fought.",
            "The siege of Leningrad began.",
            "A soldier shoots at a crowd.",
            "Germany invaded Poland.",
            "The army invades the capital.",
        ] {
            XCTAssertTrue(Screening.notOnACard(sentence), sentence)
            XCTAssertFalse(Screening.heavy(sentence), "the feed list was never meant to catch: \(sentence)")
        }
    }

    /// The open endings, which exist so nobody has to keep four spellings of
    /// one word in step by hand.
    func testTheOpenEndingsCoverTheWholeFamily() {
        XCTAssertTrue(Screening.notOnACard("The president was assassinated."))
        XCTAssertTrue(Screening.notOnACard("An assassination attempt failed."))
        XCTAssertTrue(Screening.notOnACard("A terrorist group claimed it."))
        XCTAssertTrue(Screening.notOnACard("The terrorism charge was dropped."))
        XCTAssertTrue(Screening.notOnACard("She was abducted from her home."))
        XCTAssertTrue(Screening.notOnACard("An abduction was reported."))
        XCTAssertTrue(Screening.notOnACard("Prisoners were tortured."))
    }

    /// Word boundaries are the whole reason this cannot be a plain contains
    /// check, and these are the words that would fire without them.
    func testAWordInsideAnotherWordIsNotAMatch() {
        XCTAssertFalse(Screening.notOnACard("The warm front reached the coast."))
        XCTAssertFalse(Screening.notOnACard("The award was presented in Warsaw."))
        XCTAssertFalse(Screening.notOnACard("A shotgun wedding, said the papers."))
        XCTAssertFalse(Screening.notOnACard("Deadline day came and went."))
        XCTAssertFalse(Screening.notOnACard("The battleship museum opened."))
        XCTAssertFalse(Screening.notOnACard("Bombay was renamed Mumbai."))
    }

    func testTheCardListDoesNotCareAboutCase() {
        XCTAssertTrue(Screening.notOnACard("KILLED"))
        XCTAssertTrue(Screening.notOnACard("A Massacre took place."))
    }

    // MARK: The extra pass for an encyclopedia's own sentences

    func testTheEncyclopediaListCatchesThePastTenseOfACountry() {
        XCTAssertTrue(Screening.encyclopedic("The president was deposed in a coup."))
        XCTAssertTrue(Screening.encyclopedic("Troops entered the city."))
        XCTAssertTrue(Screening.encyclopedic("The uprising spread to three provinces."))
        XCTAssertTrue(Screening.encyclopedic("Nazi Germany annexed the region."))
    }

    func testTheEncyclopediaListLeavesAProductLaunchAlone() {
        XCTAssertFalse(Screening.encyclopedic("The PlayStation 5 was released in North America."))
        XCTAssertFalse(Screening.encyclopedic("The Sydney Opera House opened."))
    }

    /// A sentence about an army passes the card list and is caught by this
    /// one, which is the entire reason there are two.
    func testTheTwoListsCatchDifferentThings() {
        let sentence = "The military government resigned."
        XCTAssertFalse(Screening.notOnACard(sentence))
        XCTAssertTrue(Screening.encyclopedic(sentence))
    }

    func testAnEmptySentenceIsNotRefused() {
        XCTAssertFalse(Screening.heavy(""))
        XCTAssertFalse(Screening.notOnACard(""))
        XCTAssertFalse(Screening.encyclopedic(""))
    }
}
