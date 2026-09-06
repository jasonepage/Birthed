import XCTest
@testable import BirthedDomain

/// The one line a screen says about a date, so that it never has to say a name.
final class DayLineTests: XCTestCase {

    private let november12 = CalendarDate(month: 11, day: 12)!
    private let september4 = CalendarDate(month: 9, day: 4)!

    private func fact(_ id: Int, _ text: String) -> BirthFact {
        BirthFact(id: id, fact: text, category: "event", sourceURL: URL(string: "https://example.org/\(id)"),
                  regionKey: "", likes: 0, likedByMe: false)
    }

    private func event(_ year: Int?, _ text: String) -> DayFeed.Event {
        DayFeed.Event(year: year, description: text, sourceURL: URL(string: "https://en.wikipedia.org/wiki/November_12"))
    }

    // MARK: Taking the date off the front of a fact

    func testTheDatePrefixComesOffAndTheYearComesOut() {
        let line = DayLine.splitDatePrefix("On September 4, 2002, the Salem-Keizer Volcanoes finished 41 and 35.", on: september4)
        XCTAssertEqual(line?.year, 2002)
        XCTAssertEqual(line?.text, "The Salem-Keizer Volcanoes finished 41 and 35.")
    }

    /// Only the very first letter of the sentence is raised. A name that
    /// starts small keeps its shape anywhere else in the line, which is the
    /// reason this is not `capitalized`.
    func testOnlyTheVeryFirstLetterIsRaised() {
        let line = DayLine.splitDatePrefix("On September 4, 1998, Google was founded, and eBay was two.", on: september4)
        XCTAssertEqual(line?.text, "Google was founded, and eBay was two.")

        let lower = DayLine.splitDatePrefix("On September 4, 2007, the iPhone reached one million sales.", on: september4)
        XCTAssertEqual(lower?.text, "The iPhone reached one million sales.")
    }

    func testAFactForAnotherDateIsNotSplit() {
        XCTAssertNil(DayLine.splitDatePrefix("On September 5, 2002, something happened.", on: september4))
        XCTAssertNil(DayLine.splitDatePrefix("On November 4, 2002, something happened.", on: september4))
    }

    func testAFactWithNoDateInFrontOfItIsNotSplit() {
        XCTAssertNil(DayLine.splitDatePrefix("The Sydney Opera House opened.", on: september4))
        XCTAssertNil(DayLine.splitDatePrefix("On September 4, something happened.", on: september4))
        XCTAssertNil(DayLine.splitDatePrefix("On September 4, 02, something happened.", on: september4))
        XCTAssertNil(DayLine.splitDatePrefix("On September 4, 2002, ", on: september4))
    }

    // MARK: Choosing

    func testAResearchedFactIsPreferredOverWikipedia() {
        let line = DayLine.choose(
            facts: [fact(1, "On November 12, 2020, the PlayStation 5 went on sale in North America.")],
            events: [event(1990, "A shorter line.")],
            on: november12
        )
        XCTAssertEqual(line?.year, 2020)
        XCTAssertEqual(line?.text, "The PlayStation 5 went on sale in North America.")
    }

    func testTheShortestPassingLineWins() {
        let line = DayLine.choose(
            facts: [
                fact(1, "On November 12, 1990, a considerably longer sentence about the day was written down here."),
                fact(2, "On November 12, 1980, a short one."),
                fact(3, "On November 12, 1970, a medium length sentence about the day."),
            ],
            events: [],
            on: november12
        )
        XCTAssertEqual(line?.text, "A short one.")
    }

    /// The same date has to give the same line every time it is looked at, or
    /// the screen changes for no reason between two openings of the app.
    func testTiesBreakByYearSoTheAnswerIsStable() {
        let same = "Four words exactly here."
        let line = DayLine.choose(
            facts: [
                fact(1, "On November 12, 1999, \(same)"),
                fact(2, "On November 12, 1975, \(same)"),
            ],
            events: [],
            on: november12
        )
        XCTAssertEqual(line?.year, 1975)
    }

    func testALineLongerThanTheScreenIsRefused() {
        let long = String(repeating: "a", count: DayLine.longestLine + 1)
        XCTAssertNil(DayLine.choose(facts: [fact(1, "On November 12, 1999, \(long)")], events: [], on: november12))
        XCTAssertNil(DayLine.choose(facts: [], events: [event(1999, long)], on: november12))
    }

    // MARK: What this exists to stop

    /// November 12 is the date that led with Charles Manson on the website.
    /// The screened event for it is a console launch, and the point of the
    /// whole exercise is that nothing here ever had to know who Manson was.
    func testTheHeavyEventIsRefusedAndTheOrdinaryOneIsTaken() {
        let line = DayLine.choose(
            facts: [],
            events: [
                event(1970, "A cyclone killed hundreds of thousands of people in East Pakistan."),
                event(2020, "The PlayStation 5 was released in North America."),
            ],
            on: november12
        )
        XCTAssertEqual(line?.year, 2020)
        XCTAssertEqual(line?.text, "The PlayStation 5 was released in North America.")
    }

    /// The heavy one is shorter, so a chooser that only sorted by length
    /// would take it. This is the test that would fail if the screening were
    /// ever dropped from the events branch.
    func testAShortHeavyEventStillLosesToALongerOrdinaryOne() {
        let line = DayLine.choose(
            facts: [],
            events: [
                event(1970, "Many were killed."),
                event(2020, "The PlayStation 5 was released in North America."),
            ],
            on: november12
        )
        XCTAssertEqual(line?.year, 2020)
    }

    /// A researched fact is screened too. The fact finder is steered away from
    /// this, but steered away is not the same as cannot happen.
    func testAHeavyResearchedFactIsRefusedAndTheEventsAreUsedInstead() {
        let line = DayLine.choose(
            facts: [fact(1, "On November 12, 1970, a cyclone killed many people.")],
            events: [event(2020, "The PlayStation 5 was released in North America.")],
            on: november12
        )
        XCTAssertEqual(line?.year, 2020)
    }

    /// Wikipedia's sentences get the second pass that the researched facts do
    /// not, because an encyclopedia's date article is mostly coups and armies.
    func testTheEncyclopediaPassAppliesToEventsAndNotToFacts() {
        let sentence = "The military government resigned."
        XCTAssertNil(DayLine.choose(facts: [], events: [event(1974, sentence)], on: november12))
        let fromFact = DayLine.choose(facts: [fact(1, "On November 12, 1974, the military government resigned.")], events: [], on: november12)
        XCTAssertEqual(fromFact?.year, 1974)
    }

    // MARK: Nothing is an answer, and a name is never one

    func testADateWithNothingThatPassesGivesNothing() {
        let line = DayLine.choose(
            facts: [fact(1, "On November 12, 1970, a cyclone killed many people.")],
            events: [
                event(1944, "The battleship Tirpitz was sunk."),
                event(1948, "Seven leaders were sentenced after the war."),
            ],
            on: november12
        )
        XCTAssertNil(line)
    }

    func testNothingAtAllGivesNothing() {
        XCTAssertNil(DayLine.choose(facts: [], events: [], on: november12))
    }

    /// An event with no year is dropped rather than printed with a blank
    /// beside it. The year is half of what makes the line worth reading.
    func testAnEventWithNoYearIsNotALine() {
        XCTAssertNil(DayLine.choose(facts: [], events: [event(nil, "Something happened.")], on: november12))
    }

    func testAnEmptyEventIsNotALine() {
        XCTAssertNil(DayLine.choose(facts: [], events: [event(1999, "   ")], on: november12))
    }
}
