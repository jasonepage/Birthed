import Foundation

/// The next few calendar dates, for asking who has a birthday soon.
///
/// Its own function in the domain rather than a few lines inside the network
/// layer, because the interesting cases are all calendar cases and they are
/// only testable here: the turn of a month, the turn of a year, and February
/// 29, which exists as a date to ask about even in a year that does not have
/// one.
enum UpcomingDates {

    /// Today and the next `days` days, in order, as calendar dates.
    ///
    /// Today is included, because somebody whose birthday is today is the most
    /// interesting person to be offered, not the least.
    ///
    /// February 29 is produced by walking real dates forward, so in a common
    /// year it simply never appears, which is correct: nobody observes it that
    /// year and a row counting down to it would be counting to nothing. In a
    /// leap year it appears like any other day.
    static func next(_ days: Int, from now: Date = Date(), calendar: Calendar = .current) -> [CalendarDate] {
        guard days >= 0 else { return [] }
        var dates: [CalendarDate] = []
        var seen: Set<CalendarDate> = []

        for offset in 0...days {
            guard let moved = calendar.date(byAdding: .day, value: offset, to: now) else { continue }
            let parts = calendar.dateComponents([.month, .day], from: moved)
            guard let month = parts.month, let day = parts.day,
                  let date = CalendarDate(month: month, day: day) else { continue }
            // A window longer than a year would ask about the same date twice,
            // which is a wasted clause in the query rather than a wrong answer.
            if seen.insert(date).inserted { dates.append(date) }
        }
        return dates
    }
}
