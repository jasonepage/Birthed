import Foundation

/// One notification the app intends to register.
///
/// Deliberately a plain value with no copy in it. What to say is a question
/// about the product and belongs in the feature layer; when to fire is a
/// question about calendars and belongs here, where it can be tested against a
/// fixed clock instead of by waiting a year.
struct PlannedNotification: Equatable, Hashable {
    enum Kind: Equatable, Hashable {
        /// The morning of the user's own observed birthday. `FR-073`.
        case ownBirthday
        /// A run up to the user's own birthday. `FR-072`.
        case ownCountdown(daysBefore: Int)
        /// Somebody in the People tab has a birthday today.
        case personBirthday(personID: UUID)
        /// Somebody in the People tab has a birthday soon enough to do
        /// something about it.
        case personSoon(personID: UUID, daysBefore: Int)
        /// A date this install buzzed on has sealed, and the reader is told
        /// the morning after. docs/the-wall.md section 15: a buzz had no
        /// consequence at either end, and this is the end of it.
        case hiveSealed(wallDate: WallDate)
    }

    let kind: Kind
    /// Stable across runs, so rescheduling replaces a request rather than
    /// stacking a second copy of it on top.
    let identifier: String
    /// Year, month, day, hour and minute, and deliberately no time zone.
    ///
    /// `UNCalendarNotificationTrigger` resolves components without a zone
    /// against the device's calendar at fire time, which is what makes
    /// `FR-074` and `FR-075` hold: the notification stays at eight in the
    /// morning local through a flight to Tokyo and through a daylight saving
    /// change, because the hour was never converted to an instant.
    let fireDate: DateComponents

    /// The moment this resolves to in a given calendar, for ordering and for
    /// tests. Not what is handed to the notification centre.
    func instant(in calendar: Calendar) -> Date? {
        calendar.date(from: fireDate)
    }
}

/// Works out every notification the app should have pending.
///
/// Pure. The whole point is that "does a February 29 user get told on
/// February 28 in 2027" is a question with an answer today rather than in
/// 2027.
struct NotificationPlanner {
    /// iOS keeps at most 64 pending requests per app and silently drops the
    /// rest, so the plan is trimmed here, soonest first, rather than being
    /// discovered as missing birthdays much later.
    static let systemLimit = 64

    let calendar: BirthdayCalendar

    /// `FR-073` defaults to eight in the morning and says it is configurable.
    var hour: Int = 8
    var minute: Int = 0

    /// `FR-072`. The number is the reward window's, and it survives the
    /// catalog being cut because six weeks is still about when somebody starts
    /// making plans.
    var ownCountdownDaysBefore: Int = 45

    /// Enough warning to actually buy something and have it arrive.
    var personDaysBefore: Int = 3

    /// Two years of the user's own birthday, so there is always one pending
    /// even if the app is never opened again.
    var ownYearsAhead: Int = 2

    init(calendar: BirthdayCalendar = BirthdayCalendar()) {
        self.calendar = calendar
    }

    /// Everything that should be pending, soonest first, already trimmed to
    /// what the system will actually keep.
    ///
    /// The user's own birthday is placed first and never trimmed. A hundred
    /// contacts should not be able to push somebody's own birthday off their
    /// own phone.
    ///
    /// People you know fill the remaining room before people you follow, for
    /// the same reason one step down. Following twenty public figures must not
    /// quietly cost somebody a friend's birthday, and the failure would be
    /// invisible: a notification that was never registered does not announce
    /// itself, it just never arrives.
    func plan(
        for birthday: CalendarBirthday,
        people: [Person] = [],
        hives: [HiveNote] = [],
        from reference: Date
    ) -> [PlannedNotification] {
        let own = ownNotifications(for: birthday, from: reference)

        // Sealed hives next, and there are never many: a reader can have
        // buzzed on at most a handful of dates that have not sealed yet, and
        // each of these fires once and is gone. They go ahead of other
        // people's birthdays because a birthday recurs and comes back next
        // year, and a hive seals once and the moment is over.
        //
        // They never reach the reader's own day, which is placed first above
        // and is not trimmed. Somebody's own birthday is the promise this app
        // makes and nothing here may cost them it.
        let sealed = soonestFirst(hiveNotifications(hives, from: reference))

        let known = people.filter { !$0.isPublicFigure }
        let followed = people.filter(\.isPublicFigure)
        let byDate = soonestFirst(peopleNotifications(known, from: reference))
            + soonestFirst(peopleNotifications(followed, from: reference))

        let room = max(0, Self.systemLimit - own.count)
        let hivesKept = Array(sealed.prefix(room))
        let left = max(0, room - hivesKept.count)
        return own + hivesKept + byDate.prefix(left)
    }

    // MARK: A date that sealed

    /// One reminder per date this install buzzed on, the morning after its
    /// hive sealed.
    ///
    /// The morning after, in the reader's own calendar, and worked out rather
    /// than assumed. A hive seals at midnight Eastern, which is nine at night
    /// in Oregon and one in the afternoon in Tokyo, so "the next morning" is
    /// a different day depending on where the reader is standing. This takes
    /// the first time the reminder hour comes round strictly after the seal,
    /// which is right everywhere: the reader is never told a hive has sealed
    /// before it has.
    ///
    /// A seal already in the past gets nothing. A notification scheduled
    /// behind the clock either fires at once or never, depending on the
    /// operating system's mood, and neither is a thing to wake somebody with.
    private func hiveNotifications(_ notes: [HiveNote], from reference: Date) -> [PlannedNotification] {
        var planned: [PlannedNotification] = []
        for note in notes {
            guard let date = note.date else { continue }
            guard let components = morningAfter(note.sealsAt, from: reference) else { continue }
            planned.append(PlannedNotification(
                kind: .hiveSealed(wallDate: date),
                identifier: "hive.\(note.wallDate)",
                fireDate: components
            ))
        }
        return planned
    }

    /// The first reminder hour strictly after `moment`, and after now.
    ///
    /// Walks days rather than adding seconds, for the reason section 6 of
    /// CLAUDE.md gives: some days are 23 or 25 hours long, and a reminder
    /// worked out with `addingTimeInterval` lands an hour off across a
    /// daylight saving change.
    private func morningAfter(_ moment: Date, from reference: Date) -> DateComponents? {
        let after = max(moment, reference)
        var day = after
        // Two days is always enough: the reminder hour comes round once every
        // day, so the first or the second is the one. The bound is a bound and
        // not a rule, so a calendar that surprises us stops rather than loops.
        for _ in 0..<3 {
            if let components = fireComponents(on: day),
               let candidate = calendar.calendar.date(from: components),
               candidate > after {
                return components
            }
            guard let next = calendar.calendar.date(byAdding: .day, value: 1, to: day) else { return nil }
            day = next
        }
        return nil
    }

    // MARK: The user's own day

    private func ownNotifications(
        for birthday: CalendarBirthday,
        from reference: Date
    ) -> [PlannedNotification] {
        var planned: [PlannedNotification] = []

        for occurrence in calendar.nextOccurrences(of: birthday, from: reference, count: ownYearsAhead) {
            let year = calendar.calendar.component(.year, from: occurrence)

            if let components = fireComponents(on: occurrence) {
                planned.append(PlannedNotification(
                    kind: .ownBirthday,
                    identifier: "own.birthday.\(year)",
                    fireDate: components
                ))
            }

            // The run up. Skipped when it has already gone by, rather than
            // scheduled in the past where it would either fire at once or not
            // at all depending on the operating system's mood.
            if let earlier = calendar.calendar.date(byAdding: .day, value: -ownCountdownDaysBefore, to: occurrence),
               let components = fireComponents(on: earlier),
               isFuture(components, from: reference) {
                planned.append(PlannedNotification(
                    kind: .ownCountdown(daysBefore: ownCountdownDaysBefore),
                    identifier: "own.countdown.\(year)",
                    fireDate: components
                ))
            }
        }

        return planned
    }

    private func soonestFirst(_ notifications: [PlannedNotification]) -> [PlannedNotification] {
        notifications.sorted { left, right in
            let leftDate = left.instant(in: calendar.calendar) ?? .distantFuture
            let rightDate = right.instant(in: calendar.calendar) ?? .distantFuture
            if leftDate != rightDate { return leftDate < rightDate }
            return left.identifier < right.identifier
        }
    }

    // MARK: Other people

    private func peopleNotifications(_ people: [Person], from reference: Date) -> [PlannedNotification] {
        var planned: [PlannedNotification] = []

        for person in people where person.isUsable {
            guard let occurrence = calendar.nextOccurrences(of: person.birthday, from: reference, count: 1).first
            else { continue }
            let year = calendar.calendar.component(.year, from: occurrence)

            if let components = fireComponents(on: occurrence) {
                planned.append(PlannedNotification(
                    kind: .personBirthday(personID: person.id),
                    identifier: "person.\(person.id.uuidString).birthday.\(year)",
                    fireDate: components
                ))
            }

            // Nobody needs three days' warning to wish a stranger a happy
            // birthday. The run up is for buying something and having it
            // arrive, which is a thing you do for people you know.
            if !person.isPublicFigure,
               personDaysBefore > 0,
               let earlier = calendar.calendar.date(byAdding: .day, value: -personDaysBefore, to: occurrence),
               let components = fireComponents(on: earlier),
               isFuture(components, from: reference) {
                planned.append(PlannedNotification(
                    kind: .personSoon(personID: person.id, daysBefore: personDaysBefore),
                    identifier: "person.\(person.id.uuidString).soon.\(year)",
                    fireDate: components
                ))
            }
        }

        return planned
    }

    // MARK: Components

    /// The date part of `day` with the configured hour and minute on it.
    private func fireComponents(on day: Date) -> DateComponents? {
        let parts = calendar.calendar.dateComponents([.year, .month, .day], from: day)
        guard let year = parts.year, let month = parts.month, let dayOfMonth = parts.day else {
            return nil
        }
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = dayOfMonth
        components.hour = hour
        components.minute = minute
        return components
    }

    private func isFuture(_ components: DateComponents, from reference: Date) -> Bool {
        guard let moment = calendar.calendar.date(from: components) else { return false }
        return moment > reference
    }
}

// MARK: Reading an identifier back

extension PlannedNotification {
    /// What a delivered notification was about, read back from its identifier.
    ///
    /// The identifier is the only thing that survives the round trip through
    /// the notification centre unchanged, so it is the only thing the tap
    /// handler has to go on. The formats are the ones `NotificationPlanner`
    /// writes: `own.birthday.2027`, `own.countdown.2027`,
    /// `person.<uuid>.birthday.2027` and `person.<uuid>.soon.2027`.
    enum Opened: Equatable {
        case ownBirthday
        case ownCountdown
        case personBirthday(personID: UUID)
        case personSoon(personID: UUID)
        /// A sealed hive, opened. The date is in the identifier, which is the
        /// only thing that survives the round trip through the notification
        /// centre unchanged.
        case hiveSealed(wallDate: WallDate)
    }

    static func opened(fromIdentifier identifier: String) -> Opened? {
        let parts = identifier.split(separator: ".").map(String.init)
        switch parts.first {
        case "hive":
            // "hive.2026-09-10". Two parts, because the date's own hyphens
            // are not dots.
            guard parts.count == 2, let date = WallDate(key: parts[1]) else { return nil }
            return .hiveSealed(wallDate: date)
        case "own":
            guard parts.count == 3 else { return nil }
            switch parts[1] {
            case "birthday": return .ownBirthday
            case "countdown": return .ownCountdown
            default: return nil
            }
        case "person":
            guard parts.count == 4, let id = UUID(uuidString: parts[1]) else { return nil }
            switch parts[2] {
            case "birthday": return .personBirthday(personID: id)
            case "soon": return .personSoon(personID: id)
            default: return nil
            }
        default:
            return nil
        }
    }
}
