import Foundation

/// Things that are true about a birthday and need no data at all.
///
/// Every fact here falls out of the calendar. None of it is looked up, none
/// of it can be stale, and none of it is a claim about the person: a zodiac
/// sign is the name of a stretch of the calendar, a birthstone is an entry in
/// a traditional list, and a milestone is arithmetic. The interface labels
/// them that way.
///
/// The same three rules as `BirthdayCalendar` apply. Days are moved by day
/// components and never by seconds, a birthday is two integers, and February
/// 29 is resolved through the observance setting at read time.
struct DateFacts {
    let calendar: Calendar
    private let birthdays: BirthdayCalendar

    init(calendar: Calendar = .current, timeZone: TimeZone = .current) {
        var working = calendar
        working.timeZone = timeZone
        self.calendar = working
        self.birthdays = BirthdayCalendar(calendar: calendar, timeZone: timeZone)
    }

    // MARK: Day of the year

    /// "The 248th day of the year." Counted in the year given, because the
    /// answer differs by one after February in a leap year, and a number that
    /// is right in one year and wrong in the next should say which year it
    /// is right in.
    func dayOfYear(_ birthday: CalendarBirthday, in year: Int) -> Int? {
        let observed = birthdays.observedDate(for: birthday, in: year)
        var components = DateComponents()
        components.year = year
        components.month = observed.month
        components.day = observed.day
        guard let date = calendar.date(from: components) else { return nil }
        return calendar.ordinality(of: .day, in: .year, for: date)
    }

    // MARK: Milestones

    /// The day somebody turns `days` days old. Needs a birth year.
    func date(whenDaysAlive days: Int, for birthday: CalendarBirthday) -> Date? {
        guard let birthYear = birthday.year else { return nil }
        let observed = birthdays.observedDate(for: birthday, in: birthYear)
        var components = DateComponents()
        components.year = birthYear
        components.month = observed.month
        components.day = observed.day
        guard let born = calendar.date(from: components) else { return nil }
        return calendar.date(byAdding: .day, value: days, to: calendar.startOfDay(for: born))
    }

    /// A day count worth marking, and when it lands.
    struct Milestone: Equatable {
        let days: Int
        let date: Date
        /// Whole days from the reference date to the milestone. Zero on the
        /// day itself.
        let daysAway: Int
    }

    /// The next round number of days alive, on or after the reference day.
    ///
    /// Round means a multiple of `step`, which is 1,000 by default: 9,000
    /// days is a thing people post, 8,767 is not. Someone exactly on a
    /// multiple today gets today, so the interface can celebrate it rather
    /// than skip it.
    func nextMilestone(for birthday: CalendarBirthday, from reference: Date, step: Int = 1000) -> Milestone? {
        guard step > 0, let alive = birthdays.daysAlive(birthday, on: reference) else { return nil }
        let target = ((alive + step - 1) / step) * step
        let days = max(target, step)
        guard let date = date(whenDaysAlive: days, for: birthday) else { return nil }
        let today = calendar.startOfDay(for: reference)
        let away = calendar.dateComponents([.day], from: today, to: date).day ?? 0
        return Milestone(days: days, date: date, daysAway: away)
    }

    // MARK: Zodiac

    /// The twelve signs by the dates most commonly printed for them. The real
    /// boundary moves by up to a day from year to year with the sun's actual
    /// position, so the interface calls this the traditional date range and
    /// nothing more.
    enum ZodiacSign: String, CaseIterable, Equatable {
        case capricorn = "Capricorn"
        case aquarius = "Aquarius"
        case pisces = "Pisces"
        case aries = "Aries"
        case taurus = "Taurus"
        case gemini = "Gemini"
        case cancer = "Cancer"
        case leo = "Leo"
        case virgo = "Virgo"
        case libra = "Libra"
        case scorpio = "Scorpio"
        case sagittarius = "Sagittarius"

        var symbol: String {
            switch self {
            case .capricorn: return "♑︎"
            case .aquarius: return "♒︎"
            case .pisces: return "♓︎"
            case .aries: return "♈︎"
            case .taurus: return "♉︎"
            case .gemini: return "♊︎"
            case .cancer: return "♋︎"
            case .leo: return "♌︎"
            case .virgo: return "♍︎"
            case .libra: return "♎︎"
            case .scorpio: return "♏︎"
            case .sagittarius: return "♐︎"
            }
        }
    }

    /// Needs only the month and day. February 29 is Pisces whatever the
    /// observance setting says, because the sign is about the date the
    /// person was actually born on.
    func zodiacSign(for date: CalendarDate) -> ZodiacSign {
        switch (date.month, date.day) {
        case (1, ...19), (12, 22...): return .capricorn
        case (1, _), (2, ...18): return .aquarius
        case (2, _), (3, ...20): return .pisces
        case (3, _), (4, ...19): return .aries
        case (4, _), (5, ...20): return .taurus
        case (5, _), (6, ...20): return .gemini
        case (6, _), (7, ...22): return .cancer
        case (7, _), (8, ...22): return .leo
        case (8, _), (9, ...22): return .virgo
        case (9, _), (10, ...22): return .libra
        case (10, _), (11, ...21): return .scorpio
        default: return .sagittarius
        }
    }

    /// The twelve animals of the Chinese zodiac, in cycle order.
    enum ChineseAnimal: String, CaseIterable, Equatable {
        case rat = "Rat", ox = "Ox", tiger = "Tiger", rabbit = "Rabbit", dragon = "Dragon", snake = "Snake"
        case horse = "Horse", goat = "Goat", monkey = "Monkey", rooster = "Rooster", dog = "Dog", pig = "Pig"
    }

    /// The animal of the Chinese year the person was born in. Needs a year.
    ///
    /// The year turns at Chinese New Year, which falls anywhere from late
    /// January to late February, so a January birthday usually belongs to
    /// the previous animal. Foundation's Chinese calendar knows where every
    /// new year fell, so the boundary is asked of it rather than guessed.
    /// Its year component counts from one within the sixty year cycle, and
    /// year one of every cycle is a Rat year.
    func chineseAnimal(for birthday: CalendarBirthday) -> ChineseAnimal? {
        guard let birthYear = birthday.year else { return nil }
        var components = DateComponents()
        components.year = birthYear
        components.month = birthday.date.month
        components.day = birthday.date.day
        components.hour = 12
        guard let born = calendar.date(from: components) else { return nil }
        var chinese = Calendar(identifier: .chinese)
        chinese.timeZone = calendar.timeZone
        let cycleYear = chinese.component(.year, from: born)
        let animals = ChineseAnimal.allCases
        return animals[(cycleYear - 1) % animals.count]
    }

    // MARK: Traditional lists

    /// The modern United States birthstone list, one stone per month. Some
    /// months have alternates; this is the first named one for each.
    func birthstone(for date: CalendarDate) -> String {
        [
            "Garnet", "Amethyst", "Aquamarine", "Diamond", "Emerald", "Pearl",
            "Ruby", "Peridot", "Sapphire", "Opal", "Topaz", "Turquoise",
        ][date.month - 1]
    }

    /// The traditional birth flower list, one flower per month.
    func birthFlower(for date: CalendarDate) -> String {
        [
            "Carnation", "Violet", "Daffodil", "Daisy", "Lily of the valley", "Rose",
            "Larkspur", "Gladiolus", "Aster", "Marigold", "Chrysanthemum", "Narcissus",
        ][date.month - 1]
    }
}
