import Foundation

/// What the user still has to do to actually get one reward, and by when.
///
/// `FR-061` to `FR-064`. Pure, so it runs offline, needs no round trip, and is
/// testable against a fixed clock with fixture rules. `docs/specs/SDS.md` section 7.
struct QualificationEngine {
    let cycleCalculator: CycleCalculator

    init(cycleCalculator: CycleCalculator = CycleCalculator()) {
        self.cycleCalculator = cycleCalculator
    }

    private var calendar: Calendar { cycleCalculator.birthdayCalendar.calendar }

    func evaluate(
        rules: [OfferRule],
        states: [RequirementKey: RequirementState],
        birthday: CalendarBirthday,
        on reference: Date
    ) -> QualificationStatus {
        // 1. What does this offer actually ask of the person.
        let requirements = rules.compactMap(\.requirementKey)
        guard !requirements.isEmpty else { return .qualified }

        let today = cycleCalculator.birthdayCalendar.startOfDay(reference)
        let occurrence = cycleCalculator.occurrenceOfCycle(for: birthday, on: reference)
        let modifier = rules.first(where: \.isDeadlineModifier)

        // 2 and 3. Pair each outstanding requirement with its last valid day.
        var outstanding: [(key: RequirementKey, lastValidDay: Date?)] = []
        for key in requirements where !(states[key] ?? .notStarted).isSatisfied {
            outstanding.append((key, lastValidDay(for: key, modifier: modifier, occurrence: occurrence)))
        }

        // 5. Nothing left to do.
        if outstanding.isEmpty { return .qualified }

        // 6. A deadline that has already gone means this cycle is lost, and
        //    saying so plainly is better than showing a checklist that cannot
        //    be completed. FR-063 and FR-064.
        let lapsed = outstanding
            .compactMap { item -> (RequirementKey, Date)? in
                guard let day = item.lastValidDay, day < today else { return nil }
                return (item.key, day)
            }
            .sorted { $0.1 < $1.1 }

        if let first = lapsed.first {
            return .notEligibleThisCycle(requirement: first.0, lapsed: first.1)
        }

        // 7. Otherwise the soonest real deadline is the one to name.
        //    Requirements with no deadline sort last.
        let next = outstanding.sorted { left, right in
            switch (left.lastValidDay, right.lastValidDay) {
            case let (l?, r?): return l < r
            case (nil, _?): return false
            case (_?, nil): return true
            case (nil, nil): return left.key.rawValue < right.key.rawValue
            }
        }[0]

        return .actionNeeded(next: next.key, by: next.lastValidDay)
    }

    /// The last day on which a requirement can still be satisfied for this
    /// cycle, or nil when it can be done at any time up to the birthday.
    private func lastValidDay(
        for key: RequirementKey,
        modifier: OfferRule?,
        occurrence: Date
    ) -> Date? {
        if key == .priorPurchase {
            // Every source we verified says "prior to your birthday" rather
            // than "on", so the last valid day is the day before.
            return calendar.date(byAdding: .day, value: -1, to: occurrence)
        }

        guard key.isEnrollment, let modifier else { return nil }

        switch modifier {
        case let .advanceSignupFixedDays(days):
            return calendar.date(byAdding: .day, value: -days, to: occurrence)

        case let .advanceSignupRelativePeriod(before):
            switch before {
            case .birthday:
                return calendar.date(byAdding: .day, value: -1, to: occurrence)
            case .birthdayMonth:
                // The last day of the month BEFORE the birthday month, not the
                // first day of it. Ulta requires the birth date on file before
                // the birthday month begins, so acting on the first of that
                // month is already too late. Getting this backwards marks a
                // user Qualified who is not.
                var parts = calendar.dateComponents([.year, .month], from: occurrence)
                parts.day = 1
                guard let firstOfBirthdayMonth = calendar.date(from: parts) else { return nil }
                return calendar.date(byAdding: .day, value: -1, to: firstOfBirthdayMonth)
            }

        default:
            return nil
        }
    }
}

/// `FR-061`. Three states, and each one has to be sayable in a sentence.
enum QualificationStatus: Equatable {
    case qualified
    case actionNeeded(next: RequirementKey, by: Date?)
    case notEligibleThisCycle(requirement: RequirementKey, lapsed: Date)

    var isQualified: Bool { self == .qualified }
}
