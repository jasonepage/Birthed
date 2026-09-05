import XCTest
@testable import BirthedDomain

/// The three offer shapes slice 3 exists to prove, from
/// `docs/research/reward-terms.md`. If the model handles these it handles the
/// other 147.
///
/// These are fixtures, not catalog data. Nothing here claims to be a quotation
/// from a brand, because a rule without its supporting sentence cannot be
/// published, and inventing one to make a test read nicely would be inventing
/// exactly the thing the whole pipeline exists to prevent.
final class QualificationEngineTests: XCTestCase {

    private var engine: QualificationEngine {
        QualificationEngine(cycleCalculator: CycleCalculator(birthdayCalendar: calendarIn(losAngeles)))
    }
    private var september4: CalendarBirthday { birthday(9, 4) }

    // Advance signup of 7 days, plus a prior purchase that recurs annually,
    // plus a tier dependent window that is display only.
    private var starbucksShape: [OfferRule] {
        [
            .accountRequired,
            .advanceSignupFixedDays(days: 7),
            .priorPurchaseRequired(lookbackMonths: nil, category: nil, recursAnnually: true),
            .informational(kind: .tierDependentWindow, detail: nil),
            .informational(kind: .itemCategoryExclusion, detail: nil),
        ]
    }

    // A birthday month window and a minimum spend that differs by channel,
    // with no advance signup deadline at all.
    private var sephoraShape: [OfferRule] {
        [
            .accountRequired,
            .redemptionWindow(anchor: .birthdayMonth, days: nil),
            .minimumSpend(channel: .brandWeb, cents: 2500),
            .minimumSpend(channel: .inStore, cents: 0),
            .informational(kind: .inventoryContingent, detail: nil),
        ]
    }

    // An app requirement and a window anchored to collection rather than to
    // the birthday.
    private var dutchBrosShape: [OfferRule] {
        [
            .accountRequired,
            .appRequired,
            .redemptionWindow(anchor: .collectionDate, days: 30),
            .informational(kind: .singleUse, detail: nil),
        ]
    }

    // The birth date has to be on file before the birthday month begins.
    private var ultaShape: [OfferRule] {
        [
            .accountRequired,
            .birthdateOnFileRequired,
            .advanceSignupRelativePeriod(before: .birthdayMonth),
            .redemptionWindow(anchor: .birthdayMonth, days: nil),
        ]
    }

    // MARK: Starbucks shape

    func testAFixedDayDeadlineIsCountedBackFromTheBirthday() {
        let status = engine.evaluate(rules: starbucksShape, states: [:],
                                     birthday: september4,
                                     on: instant(2026, 8, 1, zone: losAngeles))
        guard case let .actionNeeded(next, by) = status else {
            return XCTFail("expected action needed, got \(status)")
        }
        XCTAssertEqual(next, .account)
        assertDay(by, 2026, 8, 28)   // September 4 minus 7
    }

    func testAMissedSignupDeadlineEndsTheCycleRatherThanNaggingAboutIt() {
        let status = engine.evaluate(rules: starbucksShape, states: [:],
                                     birthday: september4,
                                     on: instant(2026, 9, 1, zone: losAngeles))
        guard case let .notEligibleThisCycle(requirement, lapsed) = status else {
            return XCTFail("expected not eligible, got \(status)")
        }
        XCTAssertEqual(requirement, .account)
        assertDay(lapsed, 2026, 8, 28)
    }

    func testAPriorPurchaseIsDueTheDayBeforeTheBirthday() {
        let status = engine.evaluate(rules: starbucksShape,
                                     states: [.account: .done],
                                     birthday: september4,
                                     on: instant(2026, 9, 1, zone: losAngeles))
        guard case let .actionNeeded(next, by) = status else {
            return XCTFail("expected action needed, got \(status)")
        }
        XCTAssertEqual(next, .priorPurchase)
        assertDay(by, 2026, 9, 3)
    }

    func testEverythingDoneIsQualified() {
        let status = engine.evaluate(rules: starbucksShape,
                                     states: [.account: .done, .priorPurchase: .done],
                                     birthday: september4,
                                     on: instant(2026, 9, 1, zone: losAngeles))
        XCTAssertEqual(status, .qualified)
    }

    func testNotApplicableCountsAsSatisfied() {
        // FR-060. Both done and not applicable are satisfied; only not started
        // is outstanding.
        let status = engine.evaluate(rules: starbucksShape,
                                     states: [.account: .notApplicable, .priorPurchase: .done],
                                     birthday: september4,
                                     on: instant(2026, 9, 1, zone: losAngeles))
        XCTAssertEqual(status, .qualified)
    }

    func testTheCycleThatIsJudgedIsTheOneYouAreIn() {
        // Twelve days past the birthday and still inside the window. The
        // deadline that matters is this cycle's, which has gone, not next
        // year's, which is 350 days away. An engine that reached for the next
        // birthday would cheerfully say action needed here.
        let status = engine.evaluate(rules: starbucksShape, states: [:],
                                     birthday: september4,
                                     on: instant(2026, 9, 16, zone: losAngeles))
        guard case let .notEligibleThisCycle(_, lapsed) = status else {
            return XCTFail("expected not eligible, got \(status)")
        }
        assertDay(lapsed, 2026, 8, 28)
    }

    // MARK: Ulta shape, the one that is easy to get backwards

    func testBeforeTheBirthdayMonthMeansTheLastDayOfTheMonthBefore() {
        // September 1 is inside the birthday month, so the deadline has gone.
        // An implementation that read this as "the first of the birthday
        // month" would mark this person qualified, which is the specific bug
        // SDS section 7 warns about.
        let status = engine.evaluate(rules: ultaShape,
                                     states: [.account: .done],
                                     birthday: september4,
                                     on: instant(2026, 9, 1, zone: losAngeles))
        guard case let .notEligibleThisCycle(requirement, lapsed) = status else {
            return XCTFail("expected not eligible, got \(status)")
        }
        XCTAssertEqual(requirement, .birthdateOnFile)
        assertDay(lapsed, 2026, 8, 31)
    }

    func testThereIsStillTimeBeforeTheBirthdayMonthBegins() {
        let status = engine.evaluate(rules: ultaShape,
                                     states: [.account: .done],
                                     birthday: september4,
                                     on: instant(2026, 8, 20, zone: losAngeles))
        guard case let .actionNeeded(next, by) = status else {
            return XCTFail("expected action needed, got \(status)")
        }
        XCTAssertEqual(next, .birthdateOnFile)
        assertDay(by, 2026, 8, 31)
    }

    func testAJanuaryBirthdayReachesBackIntoThePreviousYear() {
        let status = engine.evaluate(rules: ultaShape,
                                     states: [.account: .done],
                                     birthday: birthday(1, 9),
                                     on: instant(2026, 12, 1, zone: losAngeles))
        guard case let .actionNeeded(_, by) = status else {
            return XCTFail("expected action needed, got \(status)")
        }
        assertDay(by, 2026, 12, 31)
    }

    // MARK: Sephora shape

    func testARequirementWithNoDeadlineHasNoDate() {
        let status = engine.evaluate(rules: sephoraShape, states: [:],
                                     birthday: september4,
                                     on: instant(2026, 9, 1, zone: losAngeles))
        guard case let .actionNeeded(next, by) = status else {
            return XCTFail("expected action needed, got \(status)")
        }
        XCTAssertEqual(next, .account)
        XCTAssertNil(by, "Sephora states no advance enrollment deadline, so the app must not invent one")
    }

    func testMinimumSpendAndWindowsDoNotChangeStatus() {
        let status = engine.evaluate(rules: sephoraShape,
                                     states: [.account: .done],
                                     birthday: september4,
                                     on: instant(2026, 9, 1, zone: losAngeles))
        XCTAssertEqual(status, .qualified)
    }

    // MARK: Dutch Bros shape

    func testAnAppRequirementIsARequirementLikeAnyOther() {
        let outstanding = engine.evaluate(rules: dutchBrosShape,
                                          states: [.account: .done],
                                          birthday: september4,
                                          on: instant(2026, 9, 1, zone: losAngeles))
        guard case let .actionNeeded(next, by) = outstanding else {
            return XCTFail("expected action needed, got \(outstanding)")
        }
        XCTAssertEqual(next, .app)
        XCTAssertNil(by)

        let done = engine.evaluate(rules: dutchBrosShape,
                                   states: [.account: .done, .app: .done],
                                   birthday: september4,
                                   on: instant(2026, 9, 1, zone: losAngeles))
        XCTAssertEqual(done, .qualified)
    }

    func testACollectionAnchoredWindowIsNotAQualificationRule() {
        // The window cannot be evaluated before collection, and it must not
        // stop the offer qualifying. FR-090 handles the window itself.
        let rules: [OfferRule] = [.redemptionWindow(anchor: .collectionDate, days: 30)]
        XCTAssertEqual(
            engine.evaluate(rules: rules, states: [:], birthday: september4,
                            on: instant(2026, 9, 1, zone: losAngeles)),
            .qualified
        )
    }

    // MARK: Shape of the model itself

    func testAnOfferThatAsksNothingIsQualified() {
        XCTAssertEqual(
            engine.evaluate(rules: [], states: [:], birthday: september4,
                            on: instant(2026, 9, 1, zone: losAngeles)),
            .qualified
        )
    }

    func testOnlyFiveRuleTypesAreRequirements() {
        let requirements = [
            OfferRule.accountRequired, .appRequired, .marketingConsentRequired,
            .birthdateOnFileRequired,
            .priorPurchaseRequired(lookbackMonths: 12, category: nil, recursAnnually: true),
        ]
        XCTAssertEqual(requirements.compactMap(\.requirementKey).count, 5)

        let notRequirements: [OfferRule] = [
            .advanceSignupFixedDays(days: 7),
            .advanceSignupRelativePeriod(before: .birthdayMonth),
            .redemptionWindow(anchor: .birthdayDate, days: nil),
            .minimumSpend(channel: .inStore, cents: 0),
            .rewardIsPoints(amount: 72, unit: "Shore Points", expiryDays: 365),
            .informational(kind: .noResale, detail: nil),
        ]
        XCTAssertTrue(notRequirements.compactMap(\.requirementKey).isEmpty)
    }

    // MARK: Helper

    private func assertDay(_ date: Date?, _ year: Int, _ month: Int, _ day: Int,
                           file: StaticString = #filePath, line: UInt = #line) {
        guard let date else {
            return XCTFail("expected a date and got none", file: file, line: line)
        }
        var gregorian = Calendar(identifier: .gregorian)
        gregorian.timeZone = losAngeles
        let parts = gregorian.dateComponents([.year, .month, .day], from: date)
        XCTAssertEqual(parts.year, year, file: file, line: line)
        XCTAssertEqual(parts.month, month, file: file, line: line)
        XCTAssertEqual(parts.day, day, file: file, line: line)
    }
}
