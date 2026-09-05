import Foundation

/// Which birthday cycle a moment belongs to.
///
/// A cycle runs from 45 days before an occurrence through 30 days after it,
/// matching the window in `FR-032`, and its year is the calendar year the
/// occurrence falls in, not the current calendar year. A September 4 birthday
/// is in cycle 2026 from July 21, 2026 through October 4, 2026, and enters
/// cycle 2027 on October 5, 2026.
///
/// This is the whole of `FR-065`, and it works without any scheduled reset
/// job. An annually recurring requirement is looked up under the current cycle
/// year, finds no row, and reads as not started. It resets by not existing. A
/// requirement that carries over forever is written under the sentinel below
/// and is found in every cycle.
///
/// **Nothing else may decide which of the two a row is written under.**
/// If the write path and the read path ever disagree, an annual requirement
/// silently becomes permanent, or a permanent one resets every year, and
/// neither failure shows up anywhere in the interface. `SDS.md` section 6.5.
struct CycleCalculator {
    /// Written on requirements that carry over forever, such as having created
    /// an account.
    static let carryOverSentinel = 0

    let birthdayCalendar: BirthdayCalendar

    init(birthdayCalendar: BirthdayCalendar = BirthdayCalendar()) {
        self.birthdayCalendar = birthdayCalendar
    }

    func cycleYear(for birthday: CalendarBirthday, on reference: Date) -> Int {
        let daysSince = birthdayCalendar.daysSinceLastOccurrence(of: birthday, on: reference)
        if daysSince <= BirthdayCalendar.daysAfterWindowCloses {
            let previous = birthdayCalendar.previousOccurrence(of: birthday, onOrBefore: reference)
            return birthdayCalendar.calendar.component(.year, from: previous)
        }
        let next = birthdayCalendar.nextOccurrence(of: birthday, from: reference)
        return birthdayCalendar.calendar.component(.year, from: next)
    }

    /// The first day of the cycle the reference date sits in.
    func windowStart(for birthday: CalendarBirthday, on reference: Date) -> Date? {
        let occurrence = occurrenceOfCycle(for: birthday, on: reference)
        return birthdayCalendar.calendar.date(
            byAdding: .day, value: -BirthdayCalendar.daysBeforeWindowOpens, to: occurrence
        )
    }

    /// The last day of the cycle the reference date sits in.
    func windowEnd(for birthday: CalendarBirthday, on reference: Date) -> Date? {
        let occurrence = occurrenceOfCycle(for: birthday, on: reference)
        return birthdayCalendar.calendar.date(
            byAdding: .day, value: BirthdayCalendar.daysAfterWindowCloses, to: occurrence
        )
    }

    private func occurrenceOfCycle(for birthday: CalendarBirthday, on reference: Date) -> Date {
        let daysSince = birthdayCalendar.daysSinceLastOccurrence(of: birthday, on: reference)
        return daysSince <= BirthdayCalendar.daysAfterWindowCloses
            ? birthdayCalendar.previousOccurrence(of: birthday, onOrBefore: reference)
            : birthdayCalendar.nextOccurrence(of: birthday, from: reference)
    }
}
