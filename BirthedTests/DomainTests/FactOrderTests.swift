import XCTest
@testable import BirthedDomain

/// The found facts are dealt, not ranked, until somebody has actually voted.
final class FactOrderTests: XCTestCase {

    private func fact(_ id: Int, likes: Int = 0) -> BirthFact {
        BirthFact(id: id, fact: "Fact \(id).", category: "event", sourceURL: nil,
                  regionKey: "", likes: likes, likedByMe: false)
    }

    func testTheSameSaltDealsTheSameOrder() {
        let facts = (1...12).map { fact($0) }
        XCTAssertEqual(FactOrder.order(facts, salt: 42).map(\.id),
                       FactOrder.order(facts, salt: 42).map(\.id))
    }

    func testTheOrderDoesNotDependOnHowTheServerSentTheRows() {
        let facts = (1...12).map { fact($0) }
        XCTAssertEqual(FactOrder.order(facts, salt: 7).map(\.id),
                       FactOrder.order(facts.reversed(), salt: 7).map(\.id))
    }

    func testDifferentSaltsDealDifferentLeads() {
        // Twelve facts and twenty salts. If the lead never changes the
        // shuffle is not a shuffle. One repeat is fine; eleven is a bug.
        let facts = (1...12).map { fact($0) }
        let leads = Set((1...20).map { FactOrder.order(facts, salt: UInt64($0) * 7919).first!.id })
        XCTAssertGreaterThan(leads.count, 4, "\(leads)")
    }

    func testAFewLikesDoNotCount() {
        // Four likes is what a fact collects for being set large. It buys
        // nothing.
        let facts = [fact(1), fact(2, likes: 4), fact(3), fact(4)]
        var ledBySecond = 0
        for salt in 1...30 where FactOrder.order(facts, salt: UInt64(salt)).first?.id == 2 { ledBySecond += 1 }
        XCTAssertLessThan(ledBySecond, 30)
    }

    func testEnoughLikesLeadWhateverTheSalt() {
        let facts = [fact(1), fact(2, likes: 5), fact(3, likes: 9), fact(4)]
        for salt in 1...30 {
            let ids = FactOrder.order(facts, salt: UInt64(salt)).map(\.id)
            XCTAssertEqual(Array(ids.prefix(2)), [3, 2], "salt \(salt)")
        }
    }

    func testNothingIsLostOrDoubled() {
        let facts = (1...9).map { fact($0, likes: $0 % 3 == 0 ? 6 : 0) }
        let dealt = FactOrder.order(facts, salt: 99)
        XCTAssertEqual(Set(dealt.map(\.id)), Set(1...9))
        XCTAssertEqual(dealt.count, 9)
    }

    func testOneOrNoneIsLeftAlone() {
        XCTAssertEqual(FactOrder.order([fact(1)], salt: 1).map(\.id), [1])
        XCTAssertTrue(FactOrder.order([], salt: 1).isEmpty)
    }
}
