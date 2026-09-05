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
    func plan(
        for birthday: CalendarBirthday,
        people: [Person] = [],
        from reference: Date
    ) -> [PlannedNotification] {
        let own = ownNotifications(for: birthday, from: reference)
        let others = peopleNotifications(people, from: reference)
            .sorted { left, right in
                let leftDate = left.instant(in: calendar.calendar) ?? .distantFuture
                let rightDate = right.instant(in: calendar.calendar) ?? .distantFuture
                if leftDate != rightDate { return leftDate < rightDate }
                return left.identifier < right.identifier
            }

        let room = max(0, Self.systemLimit - own.count)
        return own + others.prefix(room)
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

            if personDaysBefore > 0,
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
