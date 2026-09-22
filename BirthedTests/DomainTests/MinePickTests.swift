import XCTest
@testable import BirthedDomain

/// The Mine panel's top card, dealt per launch. The rules that matter: a found
/// fact leads whenever there is one, the charts still come round, every
/// fact appears exactly once, and a salt is a promise the card will not move
/// while the screen is open.
final class MinePickTests: XCTestCase {
    private func fact(_ id: Int, likes: Int = 0) -> BirthFact {
        BirthFact(id: id, fact: "Fact \(id).", category: "event", sourceURL: nil,
                  regionKey: "", likes: likes, likedByMe: false)
    }

    func testAFoundFactLeadsAndTheChartsStillComeRound() {
        let facts = (1...6).map { fact($0) }
        for salt in UInt64(0)..<200 {
            let picks = MinePick.deal(facts: facts, hasCharts: true, salt: salt)
            XCTAssertEqual(picks.count, 7)
            XCTAssertNotEqual(picks.first, .charts, "salt \(salt): the chart card led")
            XCTAssertEqual(picks.filter { $0 == .charts }.count, 1)
            XCTAssertEqual(Set(picks.map(\.id)).count, 7, "every card once")
        }
    }

    func testTheSameSaltDealsTheSameOrder() {
        let facts = (1...6).map { fact($0) }
        XCTAssertEqual(MinePick.deal(facts: facts, hasCharts: true, salt: 42),
                       MinePick.deal(facts: facts, hasCharts: true, salt: 42))
    }

    func testDifferentLaunchesLeadWithDifferentFacts() {
        let facts = (1...6).map { fact($0) }
        let leads = Set((UInt64(0)..<50).map { MinePick.deal(facts: facts, hasCharts: true, salt: $0).first?.id })
        XCTAssertGreaterThan(leads.count, 3, "a new launch should usually mean a new first card")
    }

    func testALikedFactLeads() {
        let facts = [fact(1), fact(2, likes: 9), fact(3)]
        XCTAssertEqual(MinePick.deal(facts: facts, hasCharts: true, salt: 7).first, .fact(fact(2, likes: 9)))
    }

    func testWithNothingFoundTheChartsAreTheCard() {
        XCTAssertEqual(MinePick.deal(facts: [], hasCharts: true, salt: 1), [.charts])
        XCTAssertEqual(MinePick.deal(facts: [], hasCharts: false, salt: 1), [])
    }
}
