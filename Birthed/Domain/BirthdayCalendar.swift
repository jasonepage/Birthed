import Foundation

/// Every "when" question in the product goes through this type.
///
/// Three rules govern the whole file, and all three exist because of a real
/// defect rather than a preference. `SDS.md` section 5.2.
///
/// One. Never move between days by adding seconds. Some days are 23 or 25
/// hours long, so everything here moves by day components. `NFR-004`.
///
/// Two. "Is it my birthday" compares calendar components, never instants. A
/// stored date is never compared against `Date()`.
///
/// Three. February 29 resolves at read time, never at write time. The stored
/// birthday stays February 29 forever.
struct BirthdayCalendar {
    /// `FR-032`. The window runs from 45 days before the birthday through 30
    /// days after it.
    static let daysBeforeWindowOpens = 45
    static let daysAfterWindowCloses = 30

    let calendar: Calendar
    let timeZone: TimeZone

    /// The calendar and the time zone are handed in rather than read from
    /// `Calendar.current` inside, which is what makes every case below
    /// testable without a simulator.
    init(calendar: Calendar = .current, timeZone: TimeZone = .current) {
        var working = calendar
        working.timeZone = timeZone
        self.calendar = working
        self.timeZone = timeZone
    }

    // MARK: Leap years

    /// Asked of the calendar rather than computed, so a non-Gregorian calendar
    /// does not silently get Gregorian answers.
    func isLeapYear(_ year: Int) -> Bool {
        var components = DateComponents()
        components.year = year
        components.month = 2
        components.day = 1
        guard let february = calendar.date(from: components),
              let range = calendar.range(of: .day, in: .month, for: february)
        else { return false }
        return range.count == 29
    }

    /// The month and day this birthday is actually observed on in a given year.
    /// For everyone except a February 29 birthday this is the stored date.
    func observedDate(for birthday: CalendarBirthday, in year: Int) -> CalendarDate {
        guard birthday.isLeapDay, !isLeapYear(year) else { return birthday.date }
        switch birthday.leapObservance {
        case .february28: return CalendarDate(month: 2, day: 28) ?? birthday.date
        case .march1: return CalendarDate(month: 3, day: 1) ?? birthday.date
        }
    }

    // MARK: Occurrences

    func startOfDay(_ reference: Date) -> Date {
        calendar.startOfDay(for: reference)
    }

    private func day(month: Int, day: Int, year: Int) -> Date? {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        return calendar.date(from: components)
    }

    /// The next time this birthday comes around, today included.
    func nextOccurrence(of birthday: CalendarBirthday, from reference: Date) -> Date {
        let today = startOfDay(reference)
        let thisYear = calendar.component(.year, from: today)
        for year in [thisYear, thisYear + 1] {
            let observed = observedDate(for: birthday, in: year)
            if let candidate = day(month: observed.month, day: observed.day, year: year),
               candidate >= today {
                return candidate
            }
        }
        return today
    }

    /// The most recent time it came around, today included.
    func previousOccurrence(of birthday: CalendarBirthday, onOrBefore reference: Date) -> Date {
        let today = startOfDay(reference)
        let thisYear = calendar.component(.year, from: today)
        for year in [thisYear, thisYear - 1] {
            let observed = observedDate(for: birthday, in: year)
            if let candidate = day(month: observed.month, day: observed.day, year: year),
               candidate <= today {
                return candidate
            }
        }
        return today
    }

    /// Whole local days from today to the next occurrence. `FR-034`.
    func daysUntil(_ birthday: CalendarBirthday, from reference: Date) -> Int {
        let today = startOfDay(reference)
        let next = nextOccurrence(of: birthday, from: reference)
        return calendar.dateComponents([.day], from: today, to: next).day ?? 0
    }

    func daysSinceLastOccurrence(of birthday: CalendarBirthday, on reference: Date) -> Int {
        let today = startOfDay(reference)
        let previous = previousOccurrence(of: birthday, onOrBefore: reference)
        return calendar.dateComponents([.day], from: previous, to: today).day ?? 0
    }

    /// `FR-035` and `FR-036`. Compares components, never instants.
    func isBirthdayToday(_ birthday: CalendarBirthday, on reference: Date) -> Bool {
        let parts = calendar.dateComponents([.year, .month, .day], from: reference)
        guard let year = parts.year else { return false }
        let observed = observedDate(for: birthday, in: year)
        return parts.month == observed.month && parts.day == observed.day
    }

    /// `FR-032`.
    func isInWindow(_ birthday: CalendarBirthday, on reference: Date) -> Bool {
        daysUntil(birthday, from: reference) <= Self.daysBeforeWindowOpens
            || daysSinceLastOccurrence(of: birthday, on: reference) <= Self.daysAfterWindowCloses
    }

    /// The age the person turns on their next birthday, when a year is known.
    func ageOnNextBirthday(_ birthday: CalendarBirthday, from reference: Date) -> Int? {
        guard let birthYear = birthday.year else { return nil }
        let next = nextOccurrence(of: birthday, from: reference)
        return calendar.component(.year, from: next) - birthYear
    }
}
