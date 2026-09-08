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

    /// The cover, on Apple's image server, or nil when nothing was matched.
    ///
    /// Pointed at rather than copied, which is the opposite of what the
    /// website does. The site copies every cover onto birthed.app because it
    /// sends img-src 'self' and its privacy page names the two companies that
    /// see a reader. An app has no such header and is already talking to
    /// Apple to exist, so shipping thirty megabytes of covers inside the
    /// binary would cost the reader a longer download to avoid a request they
    /// are already making.
    let artworkURL: URL?
    /// The record on Apple Music, when one was matched. The link out is the
    /// other half of the arrangement the art is published under.
    let storeURL: URL?
    /// Apple's thirty second sample, when there is one. About four in five
    /// matched titles have one; the rest are records Apple carries but does
    /// not sample.
    let previewURL: URL?

    init(
        date: CalendarDate,
        year: Int,
        song: String,
        artist: String,
        chart: String = "Billboard Hot 100",
        artworkURL: URL? = nil,
        storeURL: URL? = nil,
        previewURL: URL? = nil
    ) {
        self.date = date
        self.year = year
        self.song = song
        self.artist = artist
        self.chart = chart
        self.artworkURL = artworkURL
        self.storeURL = storeURL
        self.previewURL = previewURL
    }
}

extension ChartWeek {

    /// The handle this chart week is remembered by: a chart and a year.
    ///
    /// A chart week has no row id a client can see, and it does not need one.
    /// The pair is already its identity everywhere else in this app, it is
    /// stable against every edit anybody could make to a title or an artist,
    /// and putting the chart inside it means "hot100-1985" and
    /// "boxoffice-1985" never collide and a third chart needs no migration.
    ///
    /// Nil when the chart name is one this type does not know, which can only
    /// happen if a row arrives naming a chart that has not been added here. An
    /// unknown chart draws no answer buttons rather than inventing a handle.
    var subjectID: String? {
        guard let known = Chart(rawValue: chart) else { return nil }
        return "\(known.key)-\(year)"
    }

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
    init?(
        isoDate: String,
        song: String,
        artist: String,
        chart: String = "Billboard Hot 100",
        artworkURL: URL? = nil,
        storeURL: URL? = nil,
        previewURL: URL? = nil
    ) {
        let parts = isoDate.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3,
              let year = Int(parts[0]), parts[0].count == 4,
              let month = Int(parts[1]),
              let day = Int(parts[2]),
              let date = CalendarDate(month: month, day: day),
              Self.instant(year: year, month: month, day: day) != nil
        else { return nil }
        self.init(date: date, year: year, song: song, artist: artist, chart: chart,
                  artworkURL: artworkURL, storeURL: storeURL, previewURL: previewURL)
    }

    var isoDate: String {
        String(format: "%04d-%02d-%02d", year, date.month, date.day)
    }
}

extension ChartWeek {
    /// The charts the app reads, by the exact `chart_name` each is stored
    /// under. Named once here rather than spelled out at each call site,
    /// because a typo in a chart name silently returns nothing at all.
    ///
    /// Each one is the same shape in the table: an issue date, a title and a
    /// credit. The film chart has no credit and stores an empty string, which
    /// `hasCredit` lets the interface leave out rather than draw a blank line.
    enum Chart: String, CaseIterable, Equatable {
        case hot100 = "Billboard Hot 100"
        case billboard200 = "Billboard 200"
        case boxOffice = "US box office"

        /// "song", "album", "film". What the entry is a number one of.
        var noun: String {
            switch self {
            case .hot100: return "song"
            case .billboard200: return "album"
            case .boxOffice: return "film"
            }
        }

        var hasCredit: Bool { self != .boxOffice }

        /// A short name with no spaces in it, for use inside an identifier.
        ///
        /// Deliberately not the raw value. The raw value is the chart's
        /// printed name and it is allowed to be reworded, and an identifier
        /// that changed when somebody tidied a label would orphan every answer
        /// already given on it.
        var key: String {
            switch self {
            case .hot100: return "hot100"
            case .billboard200: return "billboard200"
            case .boxOffice: return "boxoffice"
            }
        }

        /// How the issue date should be read out. A Billboard issue date is
        /// the date printed on the cover; a box office date is the end of
        /// the weekend the film topped.
        var dateLabel: String {
            switch self {
            case .hot100, .billboard200: return "issue dated"
            case .boxOffice: return "weekend ending"
            }
        }
    }

    var kind: Chart? { Chart(rawValue: chart) }

    /// "Number one on the Billboard Hot 100, issue dated September 7, 2002."
    func attribution(calendar: Calendar = .current) -> String {
        let label = kind?.dateLabel ?? "dated"
        return "Number one on the \(chart), \(label) \(displayDate(calendar: calendar))"
    }
}
