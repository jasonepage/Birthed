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

    // MARK: The other numbers
    //
    // Four shapes of number that a birth date answers exactly and that cost
    // nothing to work out: no network, no table to keep current, no page to
    // check. They are here rather than on a screen because where they belong
    // on a screen is a separate question, and Mine was cut to five things
    // above the fold this morning for a reason.
    //
    // Every one of them says how sure it is. A billion seconds lands on a day
    // and not on a moment, because nobody told this app what time they were
    // born. A count of full moons is an average and says so. The other two
    // are exact and take no hedging.

    /// The number of seconds in a billion, expressed as whole days and a
    /// remainder. 1,000,000,000 / 86,400 is 11,574 days and about 1 hour
    /// 46 minutes.
    static let daysInABillionSeconds = 11_574

    /// The day this person is a billion seconds old, or nil without a year.
    ///
    /// It is the best of these four numbers, because it is large enough to
    /// sound impossible, it happens once, and it lands in the early thirties
    /// where nothing else is being celebrated.
    ///
    /// The day, not the moment. The moment needs a time of birth and this app
    /// only ever asks for a date, and the remaining hour and three quarters
    /// means somebody born in the evening crosses it on the following day.
    ///
    /// Counted in calendar days rather than in seconds, which is the rule
    /// everywhere in this file, and which is right here for a reason worth
    /// writing down: a billion seconds is absolute time and calendar days are
    /// not, so daylight saving pulls the two apart. Over the thirty one years
    /// this spans the clock changes cancel out to within an hour, which is
    /// well inside the uncertainty the unknown birth time already carries.
    func billionSecondsDay(for birthday: CalendarBirthday) -> Date? {
        date(whenDaysAlive: Self.daysInABillionSeconds, for: birthday)
    }

    /// The mean length of a lunar month in days, which is what "a month" was
    /// before it was a square on a wall.
    static let synodicMonthDays = 29.530588853

    /// About how many full moons this person has been here for.
    ///
    /// About, and the name says so. Real full moons are not evenly spaced:
    /// the moon's orbit is elliptical and the interval swings either side of
    /// this average by up to seven hours, so a count built on the mean can be
    /// one out. It is close enough for a sentence that begins "about" and it
    /// would be dishonest in one that did not.
    func approximateFullMoons(for birthday: CalendarBirthday, on reference: Date) -> Int? {
        guard let alive = birthdays.daysAlive(birthday, on: reference), alive >= 0 else { return nil }
        return Int(Double(alive) / Self.synodicMonthDays)
    }

    /// The next year in which this person's birthday falls on the same day of
    /// the week they were born on, and how far away that is.
    ///
    /// Exact, and pleasing because the answer is never the same twice: the
    /// pattern runs 6, 11, 5, 6 and then repeats, bent by which leap years
    /// the run crosses, so nobody can guess it and everybody can check it.
    struct WeekdayReturn: Equatable {
        let year: Int
        let weekday: Int
        let yearsAway: Int
    }

    /// Searches forward rather than working the pattern out, because the
    /// pattern has exceptions at the century leap years and a loop of at most
    /// a dozen turns cannot get them wrong.
    func nextWeekdayReturn(for birthday: CalendarBirthday, from reference: Date) -> WeekdayReturn? {
        guard let birthWeekday = birthdays.birthWeekday(birthday) else { return nil }
        let thisYear = calendar.component(.year, from: reference)
        let today = calendar.startOfDay(for: reference)
        // Forty is far more than the longest gap, which is eleven years, and
        // it is a bound rather than an expectation: a loop with no bound in a
        // date routine is how one bad birthday hangs a screen.
        for ahead in 0...40 {
            let year = thisYear + ahead
            let observed = birthdays.observedDate(for: birthday, in: year)
            var components = DateComponents()
            components.year = year
            components.month = observed.month
            components.day = observed.day
            guard let date = calendar.date(from: components) else { continue }
            // Strictly ahead, so the answer on somebody's own birthday is the
            // next one rather than the one they are standing on.
            guard calendar.startOfDay(for: date) > today else { continue }
            guard calendar.component(.weekday, from: date) == birthWeekday else { continue }
            return WeekdayReturn(year: year, weekday: birthWeekday, yearsAway: year - thisYear)
        }
        return nil
    }

    /// A planet, and how long its year is in Earth days.
    ///
    /// Sidereal orbital periods, which is the length of one trip round the
    /// sun. Earth is in the list at 365.256 rather than 365, because leaving
    /// it out would invite somebody to divide by 365 and get a different
    /// number for the one row they can check against their own age.
    enum Planet: String, CaseIterable, Equatable {
        case mercury = "Mercury"
        case venus = "Venus"
        case earth = "Earth"
        case mars = "Mars"
        case jupiter = "Jupiter"
        case saturn = "Saturn"

        var yearInEarthDays: Double {
            switch self {
            case .mercury: return 87.969
            case .venus: return 224.701
            case .earth: return 365.256
            case .mars: return 686.980
            case .jupiter: return 4332.59
            case .saturn: return 10759.22
            }
        }
    }

    /// This person's age in one planet's years.
    ///
    /// Mars is the one worth showing. Mercury turns everybody into a number
    /// too large to feel anything about, Saturn makes most readers younger
    /// than three, and Mars puts a person in their thirties at about sixteen,
    /// which is the only one of these that lands as a fact about a life.
    func age(on planet: Planet, for birthday: CalendarBirthday, on reference: Date) -> Double? {
        guard let alive = birthdays.daysAlive(birthday, on: reference), alive >= 0 else { return nil }
        return Double(alive) / planet.yearInEarthDays
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
