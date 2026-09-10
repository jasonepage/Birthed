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

// MARK: People you follow

// Following public figures must never cost somebody a friend's birthday. iOS
// keeps 64 pending requests and drops the rest without saying so, which makes
// this a failure nobody can see: a notification that was never registered does
// not announce itself, it simply never arrives.

extension NotificationPlannerTests {

    private func followed(_ month: Int, _ day: Int, name: String = "Figure") -> Person {
        Person(name: name, birthday: birthday(month, day), wikidataID: "Q\(month)\(day)")
    }

    private func kinds(_ plan: [PlannedNotification], soon: Bool) -> [PlannedNotification] {
        plan.filter {
            switch $0.kind {
            case .personSoon: return soon
            case .personBirthday: return !soon
            default: return false
            }
        }
    }

    func testAPublicFigureGetsTheDayItselfAndNoRunUp() {
        let plan = planner().plan(
            for: birthday(6, 1),
            people: [followed(9, 5, name: "Freddie Mercury")],
            from: instant(2026, 1, 10, zone: losAngeles)
        )
        XCTAssertEqual(kinds(plan, soon: false).count, 1)
        XCTAssertTrue(kinds(plan, soon: true).isEmpty,
                      "nobody needs three days to wish a stranger a happy birthday")
    }

    func testSomebodyYouKnowStillGetsBoth() {
        let plan = planner().plan(
            for: birthday(6, 1),
            people: [person(9, 5, name: "Mum")],
            from: instant(2026, 1, 10, zone: losAngeles)
        )
        XCTAssertEqual(kinds(plan, soon: false).count, 1)
        XCTAssertEqual(kinds(plan, soon: true).count, 1)
    }

    func testFollowingACrowdCannotPushAFriendOffThePhone() {
        // The friend's birthday is in December and every followed person is in
        // January, February or March, so on date order alone the friend would
        // be trimmed away and never told about.
        var crowd: [Person] = []
        for month in 1...3 {
            for day in 1...28 { crowd.append(followed(month, day)) }
        }
        let mum = person(12, 20, name: "Mum")

        let plan = planner().plan(
            for: birthday(6, 1),
            people: crowd + [mum],
            from: instant(2026, 1, 10, zone: losAngeles)
        )

        XCTAssertLessThanOrEqual(plan.count, NotificationPlanner.systemLimit)
        let hers = plan.filter { $0.identifier.contains(mum.id.uuidString) }
        XCTAssertEqual(hers.count, 2, "the one person she knows keeps both, ahead of 84 she follows")

        let theirs = plan.filter { notification in
            crowd.contains { notification.identifier.contains($0.id.uuidString) }
        }
        XCTAssertLessThan(theirs.count, crowd.count, "the trim fell on the followed, which is the point")
    }

    func testTheUsersOwnBirthdayStillOutranksEverybody() {
        var crowd: [Person] = []
        for month in 1...3 {
            for day in 1...28 { crowd.append(followed(month, day)) }
        }
        let plan = planner().plan(
            for: birthday(6, 1),
            people: crowd,
            from: instant(2026, 1, 10, zone: losAngeles)
        )
        let own = plan.filter {
            switch $0.kind {
            case .ownBirthday, .ownCountdown: return true
            default: return false
            }
        }
        XCTAssertFalse(own.isEmpty, "a hundred followed people cannot cost you your own birthday")
        XCTAssertLessThanOrEqual(plan.count, NotificationPlanner.systemLimit)
    }

    // MARK: Reading an identifier back

    func testEveryIdentifierThePlannerWritesCanBeReadBack() {
        let friend = person(9, 4, name: "Sarah", id: UUID(uuidString: "11111111-1111-1111-1111-111111111111")!)
        let plan = planner().plan(for: birthday(3, 1), people: [friend], from: instant(2026, 1, 10, zone: losAngeles))
        XCTAssertFalse(plan.isEmpty)
        for planned in plan {
            let opened = PlannedNotification.opened(fromIdentifier: planned.identifier)
            switch planned.kind {
            case .ownBirthday:
                XCTAssertEqual(opened, .ownBirthday, planned.identifier)
            case .ownCountdown:
                XCTAssertEqual(opened, .ownCountdown, planned.identifier)
            case let .personBirthday(personID):
                XCTAssertEqual(opened, .personBirthday(personID: personID), planned.identifier)
            case let .personSoon(personID, _):
                XCTAssertEqual(opened, .personSoon(personID: personID), planned.identifier)
            }
        }
    }

    func testAnUnknownIdentifierReadsAsNothing() {
        XCTAssertNil(PlannedNotification.opened(fromIdentifier: ""))
        XCTAssertNil(PlannedNotification.opened(fromIdentifier: "person.not-a-uuid.birthday.2026"))
        XCTAssertNil(PlannedNotification.opened(fromIdentifier: "own.something.2026"))
        XCTAssertNil(PlannedNotification.opened(fromIdentifier: "com.apple.something"))
    }
}

// MARK: - The morning after a hive seals

/// docs/the-wall.md section 15. A hive seals at midnight United States
/// Eastern, which is nine at night in Oregon and one in the afternoon in
/// Tokyo, so "the next morning" is a different day depending on where the
/// reader is standing. These are the cases nobody would find by using the app.
extension NotificationPlannerTests {

    private func note(_ key: String, sealsAt: Date) -> HiveNote {
        HiveNote(wallDate: key, storyID: "s", headline: "Headline", sealsAt: sealsAt)
    }

    /// Midnight Eastern ending September 11, which is when the hive for
    /// September 10 seals: five in the morning coordinated universal time.
    private var sealOfTheTenth: Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: "2026-09-12T04:00:00Z")!
    }

    func testAReaderWestOfEasternIsToldTheFollowingMorning() {
        // The seal lands at nine at night on September 11 in Oregon, so the
        // next reminder hour is eight the following morning: September 12.
        let plan = planner(losAngeles).plan(
            for: birthday(3, 3),
            hives: [note("2026-09-10", sealsAt: sealOfTheTenth)],
            from: instant(2026, 9, 10, zone: losAngeles)
        )
        guard let sealed = plan.first(where: { $0.kind == .hiveSealed(wallDate: WallDate(key: "2026-09-10")!) }) else {
            return XCTFail("nothing was planned for the sealed hive")
        }
        XCTAssertEqual(fire(sealed).0, 2026)
        XCTAssertEqual(fire(sealed).1, 9)
        XCTAssertEqual(fire(sealed).2, 12)
        XCTAssertEqual(fire(sealed).3, 8)
        XCTAssertEqual(sealed.identifier, "hive.2026-09-10")
    }

    func testAReaderEastOfEasternIsNeverToldBeforeTheHiveHasActuallySealed() {
        // The seal lands at one in the afternoon on September 12 in Tokyo, so
        // eight that morning is too early and the reminder waits a day. This
        // is the case a reminder worked out as "the date plus two" gets wrong,
        // and it would tell somebody a hive had sealed five hours before it
        // did.
        let tokyo = timeZoneNamed("Asia/Tokyo")
        let plan = planner(tokyo).plan(
            for: birthday(3, 3),
            hives: [note("2026-09-10", sealsAt: sealOfTheTenth)],
            from: instant(2026, 9, 10, zone: tokyo)
        )
        guard let sealed = plan.first(where: { $0.kind == .hiveSealed(wallDate: WallDate(key: "2026-09-10")!) }) else {
            return XCTFail("nothing was planned for the sealed hive")
        }
        XCTAssertEqual(fire(sealed).2, 13, "the morning after the seal, not the morning of it")
        XCTAssertEqual(fire(sealed).3, 8)

        // And whatever the zone, the reminder is after the seal. That is the
        // property, and the two days above are two examples of it.
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = tokyo
        XCTAssertGreaterThan(calendar.date(from: sealed.fireDate)!, sealOfTheTenth)
    }

    func testAHiveWhoseMorningHasGoneIsNotScheduledBehindTheClock() {
        let plan = planner(losAngeles).plan(
            for: birthday(3, 3),
            hives: [note("2026-09-10", sealsAt: sealOfTheTenth)],
            // A fortnight later. That morning is long past, and a notification
            // scheduled behind the clock either fires at once or never.
            from: instant(2026, 9, 26, zone: losAngeles)
        )
        XCTAssertFalse(plan.contains { $0.kind == .hiveSealed(wallDate: WallDate(key: "2026-09-10")!) })
    }

    func testOldSealedHivesNeverPileUpAndNeverCrowdOutAFriendsBirthday() {
        // The bug this pins. The first version measured the morning after
        // from whichever was later, the seal or now, so every hive a reader
        // had ever buzzed on found a fire hour in the future and every one of
        // them was rescheduled for tomorrow morning, every morning, forever.
        // Past sixty of them they fill the sixty four slots and every
        // friend's birthday is silently dropped.
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        var old: [HiveNote] = []
        for day in 1...28 {
            old.append(HiveNote(wallDate: "2026-06-\(String(format: "%02d", day))",
                                storyID: "s", headline: "H",
                                sealsAt: f.date(from: "2026-06-\(String(format: "%02d", day))T04:00:00Z")!))
        }
        let people = (1...40).map { person(9, ($0 % 28) + 1, name: "P\($0)") }
        let plan = planner(losAngeles).plan(
            for: birthday(3, 3),
            people: people,
            hives: old,
            // Months later. Every one of those mornings is long gone.
            from: instant(2026, 9, 10, zone: losAngeles)
        )
        XCTAssertFalse(plan.contains { if case .hiveSealed = $0.kind { return true } else { return false } },
                       "a morning that has gone by is not rescheduled")
        XCTAssertTrue(plan.contains { if case .personBirthday = $0.kind { return true } else { return false } },
                      "and the friends are still there")
    }

    func testAMisshapenNoteIsDroppedRatherThanGuessedAt() {
        let plan = planner(losAngeles).plan(
            for: birthday(3, 3),
            hives: [note("not-a-date", sealsAt: sealOfTheTenth)],
            from: instant(2026, 9, 10, zone: losAngeles)
        )
        XCTAssertFalse(plan.contains { if case .hiveSealed = $0.kind { return true } else { return false } })
    }

    func testASealedHiveNeverCostsTheReaderTheirOwnDay() {
        // A hundred dates buzzed on and a hundred people, against sixty four
        // slots. The reader's own birthday is placed first and is not trimmed,
        // and nothing here may cost them it.
        let seal = sealOfTheTenth
        var hives: [HiveNote] = []
        for day in 1...28 {
            hives.append(HiveNote(wallDate: "2026-09-\(String(format: "%02d", day))",
                                  storyID: "s", headline: "H", sealsAt: seal))
        }
        let people = (1...100).map { person(6, ($0 % 28) + 1, name: "P\($0)") }
        let plan = planner(losAngeles).plan(
            for: birthday(9, 4),
            people: people,
            hives: hives,
            from: instant(2026, 9, 10, zone: losAngeles)
        )
        XCTAssertLessThanOrEqual(plan.count, NotificationPlanner.systemLimit)
        XCTAssertEqual(plan.filter { $0.kind == .ownBirthday }.count, 2, "the reader's own day is never trimmed")
        XCTAssertTrue(plan.contains { $0.kind == .ownCountdown(daysBefore: 45) })
        // The own reminders come first in the plan, ahead of everything.
        XCTAssertTrue(plan.prefix(3).allSatisfy {
            if case .ownBirthday = $0.kind { return true }
            if case .ownCountdown = $0.kind { return true }
            return false
        })
    }

    func testAnIdentifierIsReadBackAsTheDateItNames() {
        XCTAssertEqual(PlannedNotification.opened(fromIdentifier: "hive.2026-09-10"),
                       .hiveSealed(wallDate: WallDate(key: "2026-09-10")!))
        XCTAssertNil(PlannedNotification.opened(fromIdentifier: "hive.nonsense"))
        XCTAssertNil(PlannedNotification.opened(fromIdentifier: "hive"))
        XCTAssertNil(PlannedNotification.opened(fromIdentifier: "hive.2026-09-10.extra"))
        // The identifiers that were already read back still are.
        XCTAssertEqual(PlannedNotification.opened(fromIdentifier: "own.birthday.2027"), .ownBirthday)
    }
}
