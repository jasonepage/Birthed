import Foundation

/// A calendar date with no year and no time zone.
///
/// September 4 is not a moment in time. It is a label that recurs, so it is
/// stored and passed around as two small integers and never as a `Date`, a
/// timestamp, or anything that has been through a time zone. `SDS.md` section
/// 5.1 and `NFR-001`.
///
/// Note for slice 2: the domain layer should be marked `nonisolated` once the
/// test target exists, so these types can be exercised off the main actor.
struct CalendarDate: Equatable, Hashable {
    let month: Int
    let day: Int

    /// Fails rather than clamping, because a silently corrected date is the
    /// kind of bug that shows up months later on one user's birthday.
    init?(month: Int, day: Int) {
        guard (1...12).contains(month), (1...31).contains(day) else { return nil }
        self.month = month
        self.day = day
    }

    /// Today, read from the calendar rather than computed from a coordinated
    /// universal time offset. `NFR-002`.
    static func today(calendar: Calendar = .current, now: Date = Date()) -> CalendarDate {
        let parts = calendar.dateComponents([.month, .day], from: now)
        return CalendarDate(month: parts.month ?? 1, day: parts.day ?? 1)
            ?? CalendarDate(month: 1, day: 1)!
    }

    /// The calendar date `days` away from this one, wrapping around the year.
    ///
    /// The walk happens inside a leap year so that February 29 exists and the
    /// cycle is all 366 days. It moves by day components rather than by
    /// seconds, because some days are 23 or 25 hours long. `NFR-004`.
    func advanced(byDays days: Int, calendar: Calendar = .current) -> CalendarDate {
        var components = DateComponents()
        components.year = 2024
        components.month = month
        components.day = day
        guard let base = calendar.date(from: components),
              let moved = calendar.date(byAdding: .day, value: days, to: base)
        else { return self }
        let parts = calendar.dateComponents([.month, .day], from: moved)
        return CalendarDate(month: parts.month ?? month, day: parts.day ?? day) ?? self
    }

    /// The English month names, fixed rather than read from the device.
    ///
    /// `displayName` below uses the calendar's own names, which is right for
    /// anything a person reads. This is for the two jobs where the words are
    /// data rather than language: reading the "On September 4, 2002," prefix
    /// off a fact the fact finder wrote in English, and building the address
    /// of a day page on birthed.app, whose paths are English whoever is
    /// looking at them. Both would silently stop working on a phone set to
    /// French, and neither would say so.
    static let englishMonths = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]

    /// "december-17", the day page's own name for this date on the website.
    /// Nil for a month this type should never hold.
    var slug: String? {
        guard month >= 1, month <= Self.englishMonths.count else { return nil }
        return "\(Self.englishMonths[month - 1].lowercased())-\(day)"
    }

    /// "September 4", in the calendar's own month names.
    func displayName(calendar: Calendar = .current) -> String {
        let names = calendar.monthSymbols
        guard month >= 1, month <= names.count else { return "\(month)/\(day)" }
        return "\(names[month - 1]) \(day)"
    }
}
