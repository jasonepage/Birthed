import Foundation

/// Whose birthday is next.
///
/// Pure, so the ordering that the whole People tab depends on can be tested
/// against a fixed clock rather than by waiting a year.
struct BirthdayAgenda {
    let calendar: BirthdayCalendar

    init(calendar: BirthdayCalendar = BirthdayCalendar()) {
        self.calendar = calendar
    }

    /// Soonest first, today included, ties broken by name so the order is
    /// stable rather than whatever the array happened to hold.
    func soonestFirst(_ people: [Person], on reference: Date) -> [Person] {
        people.sorted { left, right in
            let leftDays = calendar.daysUntil(left.birthday, from: reference)
            let rightDays = calendar.daysUntil(right.birthday, from: reference)
            if leftDays != rightDays { return leftDays < rightDays }
            return left.trimmedName.localizedCaseInsensitiveCompare(right.trimmedName) == .orderedAscending
        }
    }

    /// Everybody whose birthday is today, in the user's own local day.
    func celebratingToday(_ people: [Person], on reference: Date) -> [Person] {
        people.filter { calendar.isBirthdayToday($0.birthday, on: reference) }
    }

    /// Everybody inside the next `days` days, today included.
    func within(_ days: Int, of people: [Person], on reference: Date) -> [Person] {
        soonestFirst(people, on: reference)
            .filter { calendar.daysUntil($0.birthday, from: reference) <= days }
    }
}
