import Foundation

/// The small facts the People tab says about somebody's day. All arithmetic,
/// no network, and every one of them is a sentence people actually say:
/// which day of the week the birthday lands on this year, which day they were
/// born on, and how far apart the two of you are.
///
/// Written for the People tab redesign of September 22, 2026, where the next
/// person gets the Mine treatment and a tap on anybody opens their own day.
struct PersonDay {
    let calendar: BirthdayCalendar

    init(calendar: BirthdayCalendar = BirthdayCalendar()) {
        self.calendar = calendar
    }

    /// The day of the week the next birthday lands on, Sunday as 1. The
    /// observed date, so a February 29 birthday in a common year names the
    /// day it is actually kept on.
    func nextWeekday(of birthday: CalendarBirthday, from reference: Date) -> Int {
        calendar.calendar.component(.weekday, from: calendar.nextOccurrence(of: birthday, from: reference))
    }

    /// "Friday". `Calendar` numbers weekdays from one and its symbols from
    /// zero, which is the off by one this exists to get right once.
    static func weekdayName(_ weekday: Int, calendar: Calendar = .current) -> String? {
        let names = calendar.weekdaySymbols
        guard weekday >= 1, weekday <= names.count else { return nil }
        return names[weekday - 1]
    }

    /// How far apart the reader and this person are, said from the reader's
    /// side: "Sam was 3 when you were born", or "You were 3 when Sam was
    /// born". Nil when either year is missing, because absent beats wrong.
    ///
    /// The month and day count. Somebody born in December 1998 had not had a
    /// birthday yet when a reader arrived in September 2002, so they were 3
    /// that day and not 4, the same rule `FigureCard` follows.
    static func ageGap(name: String, theirs: CalendarBirthday, reader: CalendarBirthday?) -> String? {
        guard let reader, let theirYear = theirs.year, let readerYear = reader.year else { return nil }
        let them = (theirYear, theirs.date.month, theirs.date.day)
        let you = (readerYear, reader.date.month, reader.date.day)
        if them == you {
            return "You and \(name) were born on the same day."
        }
        if them < you {
            let age = years(from: them, to: you)
            return age == 0
                ? "\(name) was not yet one when you were born."
                : "\(name) was \(age) when you were born."
        }
        let age = years(from: you, to: them)
        return age == 0
            ? "You were not yet one when \(name) was born."
            : "You were \(age) when \(name) was born."
    }

    /// Whole years from one birth date to a later one.
    private static func years(from earlier: (Int, Int, Int), to later: (Int, Int, Int)) -> Int {
        var years = later.0 - earlier.0
        if (later.1, later.2) < (earlier.1, earlier.2) { years -= 1 }
        return max(0, years)
    }

    /// "Sam", for "SAM'S DAY" and "the week Sam was born". The first word of
    /// the name, because "Sam Rivera's day" is a form and "Sam's day" is a
    /// sentence. A name that is one word is itself.
    static func shortName(_ name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.split(separator: " ").first.map(String.init) ?? trimmed
    }

    /// "SAM'S", or "JAMES'" for a name ending in s.
    static func possessive(_ name: String) -> String {
        let short = shortName(name)
        return short.lowercased().hasSuffix("s") ? "\(short)'" : "\(short)'s"
    }
}
