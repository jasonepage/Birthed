import Foundation

/// A person's birthday: a calendar date, an optional year, and what to do in a
/// year that has no February 29.
///
/// The year is optional and separate because `FR-003` says no version 1.0
/// feature may require it. It is used only for working out an age when
/// somebody asks.
struct CalendarBirthday: Equatable, Hashable {
    let date: CalendarDate
    let year: Int?
    let leapObservance: LeapObservance

    init(date: CalendarDate, year: Int? = nil, leapObservance: LeapObservance = .february28) {
        self.date = date
        self.year = year
        self.leapObservance = leapObservance
    }

    /// Convenience for the common case, and it fails rather than clamping.
    init?(month: Int, day: Int, year: Int? = nil, leapObservance: LeapObservance = .february28) {
        guard let date = CalendarDate(month: month, day: day) else { return nil }
        self.init(date: date, year: year, leapObservance: leapObservance)
    }

    /// The only birthday for which `leapObservance` means anything.
    var isLeapDay: Bool { date.month == 2 && date.day == 29 }
}
