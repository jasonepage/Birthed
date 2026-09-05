import Foundation

/// The number one song for one chart week.
///
/// Everywhere else in this app a calendar date is two integers with no year
/// and no time zone, because a birthday recurs. A chart week is the opposite:
/// it is one particular week in one particular year and it never comes round
/// again, so this one does carry a year.
///
/// It still does not carry a `Date`. The comparison that matters is "is this
/// the chart week that covers that birth date", and doing that on instants
/// would make the answer depend on which side of midnight the reader is
/// standing. `SDS.md` section 5 and `NFR-001`.
struct ChartWeek: Equatable, Hashable {
    /// The issue date printed on the chart, month and day.
    let date: CalendarDate
    let year: Int
    let song: String
    let artist: String

    /// The name of the chart, so a second chart can be added without every
    /// caller having to learn about it.
    let chart: String

    init(date: CalendarDate, year: Int, song: String, artist: String, chart: String = "Billboard Hot 100") {
        self.date = date
        self.year = year
        self.song = song
        self.artist = artist
        self.chart = chart
    }
}

extension ChartWeek {
    /// The fixed calendar this type reasons in.
    ///
    /// Coordinated universal time on purpose, and never the reader's own zone.
    /// A chart date is a label printed on a magazine, not a moment, so the
    /// answer must not change because somebody opened the app in Tokyo.
    private static var reference: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        return calendar
    }

    private static func instant(year: Int, month: Int, day: Int) -> Date? {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        let calendar = reference
        guard let date = calendar.date(from: components) else { return nil }
        // Reject a date the month does not have, rather than let the calendar
        // roll February 30 forward into March.
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        guard parts.year == year, parts.month == month, parts.day == day else { return nil }
        return date
    }

    /// Whole days from a birth date to this issue date. Negative when the
    /// chart came out first.
    func daysAfter(birthYear: Int, birthDate: CalendarDate) -> Int? {
        guard let born = Self.instant(year: birthYear, month: birthDate.month, day: birthDate.day),
              let issued = Self.instant(year: year, month: date.month, day: date.day)
        else { return nil }
        return Self.reference.dateComponents([.day], from: born, to: issued).day
    }

    /// Whether this is the chart week that covers a birth date.
    ///
    /// The rule is the first issue dated on or after the day somebody was
    /// born, which is at most six days later because the chart is weekly.
    ///
    /// This guard is the whole reason the lookup is safe to ask blindly. The
    /// server is asked for the first chart on or after a date and always has
    /// an answer, so somebody born in 1943 would be handed the issue of
    /// January 1959 and told it was the song the week they were born. Six days
    /// is the difference between a fact and a fabrication.
    func covers(birthYear: Int, birthDate: CalendarDate) -> Bool {
        guard let days = daysAfter(birthYear: birthYear, birthDate: birthDate) else { return false }
        return (0...6).contains(days)
    }

    /// "September 17, 2005", in the reader's own month names.
    func displayDate(calendar: Calendar = .current) -> String {
        "\(date.displayName(calendar: calendar)), \(year)"
    }
}

extension ChartWeek {
    /// Reads the shape the server sends: yyyy-mm-dd.
    ///
    /// Parsed by hand rather than with a formatter, because a formatter reads
    /// the reader's locale and calendar, and this string is neither. In a
    /// Buddhist or Japanese calendar locale a formatter can return a different
    /// year for the same eight digits.
    init?(isoDate: String, song: String, artist: String, chart: String = "Billboard Hot 100") {
        let parts = isoDate.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3,
              let year = Int(parts[0]), parts[0].count == 4,
              let month = Int(parts[1]),
              let day = Int(parts[2]),
              let date = CalendarDate(month: month, day: day),
              Self.instant(year: year, month: month, day: day) != nil
        else { return nil }
        self.init(date: date, year: year, song: song, artist: artist, chart: chart)
    }

    var isoDate: String {
        String(format: "%04d-%02d-%02d", year, date.month, date.day)
    }
}
