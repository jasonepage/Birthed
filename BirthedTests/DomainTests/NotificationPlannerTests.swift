import XCTest
@testable import BirthedDomain

/// `FR-072` through `FR-075`, answered today rather than in 2027.
final class NotificationPlannerTests: XCTestCase {

    private func planner(_ zone: TimeZone = losAngeles) -> NotificationPlanner {
        NotificationPlanner(calendar: calendarIn(zone))
    }

    private func person(_ month: Int, _ day: Int, name: String = "Sarah", id: UUID = UUID()) -> Person {
        Person(id: id, name: name, birthday: birthday(month, day))
    }

    private func fire(_ notification: PlannedNotification) -> (Int, Int, Int, Int, Int) {
        let parts = notification.fireDate
        return (parts.year ?? -1, parts.month ?? -1, parts.day ?? -1, parts.hour ?? -1, parts.minute ?? -1)
    }

    // MARK: The user's own day

    func testTheBirthdayNotificationIsOnTheDayAtTheConfiguredHour() {
        let plan = planner().plan(
            for: birthday(9, 4),
            from: instant(2026, 1, 10, zone: losAngeles)
        )
        let own = plan.filter { $0.kind == .ownBirthday }
        XCTAssertEqual(own.count, 2, "two years ahead, so one is always pending")
        XCTAssertEqual(fire(own[0]).0, 2026)
        XCTAssertEqual(fire(own[0]).1, 9)
        XCTAssertEqual(fire(own[0]).2, 4)
        XCTAssertEqual(fire(own[0]).3, 8, "FR-073 defaults to eight in the morning")
        XCTAssertEqual(fire(own[1]).0, 2027)
    }

    func testTheHourIsConfigurable() {
        var subject = planner()
        subject.hour = 19
        subject.minute = 30
        let plan = subject.plan(for: birthday(9, 4), from: instant(2026, 1, 10, zone: losAngeles))
        let own = plan.first { $0.kind == .ownBirthday }
        XCTAssertEqual(fire(own!).3, 19)
        XCTAssertEqual(fire(own!).4, 30)
    }

    /// FR-073's own test, written out.
    func testAFebruary29UserIsToldOnFebruary28InANonLeapYear() {
        let plan = planner().plan(
            for: birthday(2, 29, observance: .february28),
            from: instant(2027, 1, 5, zone: losAngeles)
        )
        let own = plan.filter { $0.kind == .ownBirthday }
        XCTAssertEqual(fire(own[0]).0, 2027)
        XCTAssertEqual(fire(own[0]).1, 2)
        XCTAssertEqual(fire(own[0]).2, 28, "2027 has no February 29")
        XCTAssertEqual(fire(own[1]).0, 2028)
        XCTAssertEqual(fire(own[1]).2, 29, "2028 does")
    }

    func testAFebruary29UserWhoChoseMarch1IsToldOnMarch1() {
        let plan = planner().plan(
            for: birthday(2, 29, observance: .march1),
            from: instant(2027, 1, 5, zone: losAngeles)
        )
        let own = plan.filter { $0.kind == .ownBirthday }
        XCTAssertEqual(fire(own[0]).1, 3)
        XCTAssertEqual(fire(own[0]).2, 1)
    }

    // MARK: The run up

    func testTheCountdownLandsTheRightNumberOfDaysBefore() {
        let plan = planner().plan(
            for: birthday(9, 4),
            from: instant(2026, 1, 10, zone: losAngeles)
        )
        let countdown = plan.first { $0.kind == .ownCountdown(daysBefore: 45) }
        // 45 days before September 4 2026 is July 21 2026.
        XCTAssertEqual(fire(countdown!).1, 7)
        XCTAssertEqual(fire(countdown!).2, 21)
    }

    func testACountdownThatHasAlreadyPassedIsNotScheduledInThePast() {
        // Ten days out, so this year's 45 day mark is long gone. The one for
        // next year is still ahead and should survive.
        let plan = planner().plan(
            for: birthday(9, 4),
            from: instant(2026, 8, 25, zone: losAngeles)
        )
        let countdowns = plan.filter {
            if case .ownCountdown = $0.kind { return true }
            return false
        }
        XCTAssertEqual(countdowns.count, 1)
        XCTAssertEqual(fire(countdowns[0]).0, 2027)
    }

    // MARK: Other people

    func testEachPersonGetsTheDayItselfAndAWarning() {
        let sarah = person(3, 15)
        let plan = planner().plan(
            for: birthday(9, 4),
            people: [sarah],
            from: instant(2026, 1, 10, zone: losAngeles)
        )
        let onTheDay = plan.first { $0.kind == .personBirthday(personID: sarah.id) }
        let warning = plan.first { $0.kind == .personSoon(personID: sarah.id, daysBefore: 3) }
        XCTAssertNotNil(onTheDay)
        XCTAssertNotNil(warning)
        XCTAssertEqual(fire(onTheDay!).2, 15)
        XCTAssertEqual(fire(warning!).2, 12)
    }

    func testSomebodyWithNoNameIsNotScheduled() {
        let nameless = Person(name: "   ", birthday: birthday(3, 15))
        let plan = planner().plan(
            for: birthday(9, 4),
            people: [nameless],
            from: instant(2026, 1, 10, zone: losAngeles)
        )
        XCTAssertEqual(plan.filter { $0.kind == .personBirthday(personID: nameless.id) }.count, 0)
    }

    func testOtherPeopleComeSoonestFirst() {
        let december = person(12, 25, name: "Dec")
        let february = person(2, 1, name: "Feb")
        let plan = planner().plan(
            for: birthday(9, 4),
            people: [december, february],
            from: instant(2026, 1, 10, zone: losAngeles)
        )
        let others = plan.filter {
            switch $0.kind {
            case .personBirthday, .personSoon: return true
            default: return false
            }
        }
        let dates = others.compactMap { $0.instant(in: calendarIn(losAngeles).calendar) }
        XCTAssertEqual(dates, dates.sorted(), "otherwise the ones the system keeps are arbitrary")
    }

    // MARK: The system's ceiling

    func testTheUsersOwnBirthdayIsNeverTrimmedByOtherPeople() {
        // Sixty people is 120 requests, well past what iOS keeps.
        let crowd = (0..<60).map { index in person(1 + index % 12, 1 + index % 28, name: "Person \(index)") }
        let plan = planner().plan(
            for: birthday(9, 4),
            people: crowd,
            from: instant(2026, 1, 10, zone: losAngeles)
        )
        XCTAssertLessThanOrEqual(plan.count, NotificationPlanner.systemLimit)
        XCTAssertEqual(plan.filter { $0.kind == .ownBirthday }.count, 2,
                       "a crowded contacts list must not push somebody's own birthday off their phone")
    }

    func testIdentifiersAreUniqueSoNothingIsScheduledTwice() {
        let crowd = (0..<20).map { index in person(1 + index % 12, 1 + index % 28, name: "Person \(index)") }
        let plan = planner().plan(
            for: birthday(9, 4),
            people: crowd,
            from: instant(2026, 1, 10, zone: losAngeles)
        )
        XCTAssertEqual(Set(plan.map(\.identifier)).count, plan.count)
    }

    func testIdentifiersAreStableAcrossRunsSoReschedulingReplaces() {
        let sarah = person(3, 15)
        let first = planner().plan(for: birthday(9, 4), people: [sarah],
                                   from: instant(2026, 1, 10, zone: losAngeles))
        let second = planner().plan(for: birthday(9, 4), people: [sarah],
                                    from: instant(2026, 1, 11, zone: losAngeles))
        XCTAssertEqual(Set(first.map(\.identifier)), Set(second.map(\.identifier)))
    }

    // MARK: Time zones and daylight saving

    func testTheFireTimeCarriesNoTimeZone() {
        // FR-074 and FR-075. Components without a zone are resolved by the
        // device at fire time, which is what keeps eight in the morning at
        // eight in the morning after a flight or a clock change. Baking an
        // instant in here is the bug this asserts against.
        let plan = planner().plan(for: birthday(9, 4), from: instant(2026, 1, 10, zone: losAngeles))
        for notification in plan {
            XCTAssertNil(notification.fireDate.timeZone)
            XCTAssertNotNil(notification.fireDate.hour)
        }
    }

    func testADateOnTheFarSideOfASpringForwardKeepsItsHour() {
        // March 14 2027 is the United States spring forward. A birthday just
        // after it must still say eight in the morning.
        let plan = planner().plan(
            for: birthday(3, 20),
            from: instant(2027, 1, 5, zone: losAngeles)
        )
        let own = plan.first { $0.kind == .ownBirthday }
        XCTAssertEqual(fire(own!).1, 3)
        XCTAssertEqual(fire(own!).2, 20)
        XCTAssertEqual(fire(own!).3, 8)
    }

    func testThePlanIsTheSameShapeInEveryTimeZone() {
        for zone in ["America/Los_Angeles", "Pacific/Auckland", "Asia/Tokyo", "UTC"] {
            let subject = NotificationPlanner(calendar: calendarIn(timeZoneNamed(zone)))
            let plan = subject.plan(
                for: birthday(9, 4),
                from: instant(2026, 1, 10, zone: timeZoneNamed(zone))
            )
            let own = plan.first { $0.kind == .ownBirthday }
            XCTAssertEqual(fire(own!).1, 9, "month, in \(zone)")
            XCTAssertEqual(fire(own!).2, 4, "day, in \(zone)")
            XCTAssertEqual(fire(own!).3, 8, "hour, in \(zone)")
        }
    }
}
