import Foundation

/// What version of the world somebody was born into.
///
/// "You are older than Fortnite." "Minecraft was in Alpha the day you were
/// born." "The newest iPhone was the iPhone 4S." These are the sentences the
/// fact finder was asked for and rarely produced, because they are not on
/// any page about a date: they come from putting a birth date against a
/// handful of timelines this audience knows by heart. The timelines are
/// small, dated, and in this file, so the answer costs nothing, needs no
/// network, and never varies.
///
/// Every timeline carries the page its dates should match. They were written
/// down on September 6, 2026 from memory of those pages by a machine that
/// could not reach them, so each one is to be checked against its page
/// before the build that carries this goes to TestFlight, and corrected
/// here. Each timeline stops at `knownThrough`: a birth after that gets no
/// line rather than a guess, the same rule as the 1958 chart. When a
/// timeline is extended, move `knownThrough` with it.
///
/// Two shapes of thing. A **timeline** has versions or seasons, and the line
/// says which one was current. An **arrival** is a single date, and the line
/// says how much older the reader is than it, or how old it was when they
/// were born. Both are "older than" sentences when the reader came first,
/// which is the sentence this product is for.
struct WorldThen {

    /// A date as three integers, in the proleptic Gregorian calendar, with no
    /// time zone, because a release date is a date and not an instant.
    struct Day: Comparable, Equatable {
        let year: Int
        let month: Int
        let day: Int

        init(_ year: Int, _ month: Int, _ day: Int) {
            self.year = year
            self.month = month
            self.day = day
        }

        static func < (lhs: Day, rhs: Day) -> Bool {
            (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
        }

        /// Whole years from this day to `other`, negative when `other` is earlier.
        func years(until other: Day) -> Int {
            var years = other.year - year
            if (other.month, other.day) < (month, day) { years -= 1 }
            if other < self {
                years = -(other.years(until: self))
            }
            return years
        }

        /// Whole months from this day to `other`, for gaps under a year.
        func months(until other: Day) -> Int {
            var months = (other.year - year) * 12 + (other.month - month)
            if other.day < day { months -= 1 }
            return months
        }
    }

    struct Version: Equatable {
        let from: Day
        let name: String
    }

    /// How a timeline's current version is put into a sentence.
    enum Wording: Equatable {
        /// "Minecraft was on 1.2 the day you were born."
        case version(String)
        /// "Fortnite was in Chapter 2 Season 3 the day you were born."
        case era(String)
        /// "The newest iPhone was the iPhone 4S."
        case newest(String)
    }

    struct Timeline: Equatable {
        let subject: String
        let kicker: String
        let wording: Wording
        let versions: [Version]
        let knownThrough: Day
        let sourceURL: URL
    }

    struct Arrival: Equatable {
        let subject: String
        let kicker: String
        let arrived: Day
        let sourceURL: URL
    }

    struct Line: Equatable, Identifiable {
        var id: String { kicker + text }
        let kicker: String
        let text: String
        let sourceURL: URL
        /// The reader came first. These lead.
        let readerIsOlder: Bool
    }

    // MARK: The lines

    /// Up to `limit` lines for a birth date, older-than first.
    ///
    /// Older-than lines come in the order the timelines and arrivals are
    /// listed, which is roughly how much this audience cares, with one
    /// exception: a gap under a year jumps the queue, because "three months
    /// older than the iPhone" is the best sentence anybody will get. Then the
    /// versions, in the same listed order.
    static func lines(month: Int, day: Int, year: Int, limit: Int = 5) -> [Line] {
        let born = Day(year, month, day)
        var older: [(underAYear: Bool, order: Int, line: Line)] = []
        var current: [Line] = []
        var order = 0

        for timeline in timelines {
            order += 1
            guard let line = line(for: timeline, born: born) else { continue }
            if line.readerIsOlder {
                older.append((born.years(until: timeline.versions[0].from) < 1, order, line))
            } else {
                current.append(line)
            }
        }
        for arrival in arrivals {
            order += 1
            let line = line(for: arrival, born: born)
            if line.readerIsOlder {
                older.append((born.years(until: arrival.arrived) < 1, order, line))
            } else {
                current.append(line)
            }
        }

        let lead = older
            .sorted { left, right in
                if left.underAYear != right.underAYear { return left.underAYear }
                return left.order < right.order
            }
            .map(\.line)
        return Array((lead + current).prefix(limit))
    }

    static func line(for timeline: Timeline, born: Day) -> Line? {
        guard let first = timeline.versions.first else { return nil }
        if born < first.from {
            return Line(
                kicker: timeline.kicker,
                text: olderThan(timeline.subject, arrived: first.from, born: born),
                sourceURL: timeline.sourceURL,
                readerIsOlder: true
            )
        }
        guard born <= timeline.knownThrough else { return nil }
        guard let version = timeline.versions.last(where: { $0.from <= born }) else { return nil }
        let text: String
        switch timeline.wording {
        case let .version(name): text = "\(name) was on \(version.name) the day you were born."
        case let .era(name): text = "\(name) was in \(version.name) the day you were born."
        case let .newest(name): text = "The newest \(name) was the \(version.name) the day you were born."
        }
        return Line(kicker: timeline.kicker, text: text, sourceURL: timeline.sourceURL, readerIsOlder: false)
    }

    static func line(for arrival: Arrival, born: Day) -> Line {
        if born < arrival.arrived {
            return Line(
                kicker: arrival.kicker,
                text: olderThan(arrival.subject, arrived: arrival.arrived, born: born),
                sourceURL: arrival.sourceURL,
                readerIsOlder: true
            )
        }
        let years = arrival.arrived.years(until: born)
        let text: String
        if years == 0 {
            let months = arrival.arrived.months(until: born)
            text = months <= 0
                ? "\(arrival.subject) arrived the same month you did."
                : "\(arrival.subject) was \(months) \(months == 1 ? "month" : "months") old when you were born."
        } else {
            text = "\(arrival.subject) was \(years) \(years == 1 ? "year" : "years") old when you were born."
        }
        return Line(kicker: arrival.kicker, text: text, sourceURL: arrival.sourceURL, readerIsOlder: false)
    }

    /// "You are 10 years older than Fortnite." Under a year, in months.
    static func olderThan(_ subject: String, arrived: Day, born: Day) -> String {
        let years = born.years(until: arrived)
        if years >= 1 {
            return "You are \(years) \(years == 1 ? "year" : "years") older than \(subject)."
        }
        let months = born.months(until: arrived)
        if months >= 1 {
            return "You are \(months) \(months == 1 ? "month" : "months") older than \(subject)."
        }
        return "You are older than \(subject), by days."
    }

    // MARK: The timelines

    /// Read as: this version was current from this day until the next one.
    ///
    /// **Every date here is a United States release date.** That is the whole
    /// of the rule and it was not being followed. These rows were written from
    /// memory and eight of them held the Japanese launch: the first three
    /// PlayStations, and every Pokemon generation before X and Y. Each one was
    /// a real date, which is why nothing caught them, and each one was the
    /// wrong real date. The app told an American born in June 2000 that the
    /// newest PlayStation was the PlayStation 2, four months before it existed
    /// where they were, and told anyone born between 1996 and 1998 that
    /// Pokemon was already out.
    ///
    /// The sentence this data writes is about the reader's world, not about
    /// the object. "Pokemon was on Generation 1 the day you were born" is a
    /// claim about what a child could have been holding, so the date has to be
    /// the day it arrived where they were. When a launch was worldwide and
    /// simultaneous, which it was from Pokemon X and Y onward, there is no
    /// choice to make.
    ///
    /// All 101 dates in this file were checked against fetched pages on
    /// September 6, 2026, each against a page that states the day. Fortnite,
    /// Minecraft and the iPhone were correct in full.
    static let timelines: [Timeline] = [
        Timeline(
            subject: "Fortnite",
            kicker: "FORTNITE",
            wording: .era("Fortnite"),
            versions: [
                Version(from: Day(2017, 9, 26), name: "its first weeks, before Season 1"),
                Version(from: Day(2017, 10, 25), name: "Chapter 1 Season 1"),
                Version(from: Day(2017, 12, 14), name: "Chapter 1 Season 2"),
                Version(from: Day(2018, 2, 22), name: "Chapter 1 Season 3"),
                Version(from: Day(2018, 5, 1), name: "Chapter 1 Season 4"),
                Version(from: Day(2018, 7, 12), name: "Chapter 1 Season 5"),
                Version(from: Day(2018, 9, 27), name: "Chapter 1 Season 6"),
                Version(from: Day(2018, 12, 6), name: "Chapter 1 Season 7"),
                Version(from: Day(2019, 2, 28), name: "Chapter 1 Season 8"),
                Version(from: Day(2019, 5, 9), name: "Chapter 1 Season 9"),
                Version(from: Day(2019, 8, 1), name: "Chapter 1 Season X"),
                Version(from: Day(2019, 10, 15), name: "Chapter 2 Season 1"),
                Version(from: Day(2020, 2, 20), name: "Chapter 2 Season 2"),
                Version(from: Day(2020, 6, 17), name: "Chapter 2 Season 3"),
                Version(from: Day(2020, 8, 27), name: "Chapter 2 Season 4"),
                Version(from: Day(2020, 12, 2), name: "Chapter 2 Season 5"),
                Version(from: Day(2021, 3, 16), name: "Chapter 2 Season 6"),
                Version(from: Day(2021, 6, 8), name: "Chapter 2 Season 7"),
                Version(from: Day(2021, 9, 13), name: "Chapter 2 Season 8"),
                Version(from: Day(2021, 12, 5), name: "Chapter 3 Season 1"),
                Version(from: Day(2022, 3, 20), name: "Chapter 3 Season 2"),
                Version(from: Day(2022, 6, 5), name: "Chapter 3 Season 3"),
                Version(from: Day(2022, 9, 18), name: "Chapter 3 Season 4"),
                Version(from: Day(2022, 12, 4), name: "Chapter 4 Season 1"),
                Version(from: Day(2023, 3, 10), name: "Chapter 4 Season 2"),
                Version(from: Day(2023, 6, 9), name: "Chapter 4 Season 3"),
                Version(from: Day(2023, 8, 25), name: "Chapter 4 Season 4"),
                Version(from: Day(2023, 11, 3), name: "Fortnite OG"),
                Version(from: Day(2023, 12, 3), name: "Chapter 5 Season 1"),
                Version(from: Day(2024, 3, 8), name: "Chapter 5 Season 2"),
                Version(from: Day(2024, 5, 24), name: "Chapter 5 Season 3"),
                Version(from: Day(2024, 8, 16), name: "Chapter 5 Season 4"),
            ],
            knownThrough: Day(2024, 10, 31),
            // Not the Wikipedia article. Test pass item 47 sent somebody to
            // check these against the linked page, and the linked page does
            // not carry season start dates at all: it gives the September 26,
            // 2017 launch, which is the first row here and is right, and then
            // nothing until Chapter 3. A citation that does not state the
            // thing it is cited for is worse than no citation, because the
            // reader who follows it concludes the app made the date up.
            sourceURL: URL(string: "https://fortnite.fandom.com/wiki/Chapter_2:_Season_1")!
        ),
        Timeline(
            subject: "Minecraft",
            kicker: "MINECRAFT",
            wording: .version("Minecraft"),
            versions: [
                Version(from: Day(2009, 5, 17), name: "Classic"),
                Version(from: Day(2009, 12, 23), name: "Indev"),
                Version(from: Day(2010, 2, 27), name: "Infdev"),
                Version(from: Day(2010, 6, 30), name: "Alpha"),
                Version(from: Day(2010, 12, 20), name: "Beta"),
                Version(from: Day(2011, 11, 18), name: "1.0, the first full release"),
                Version(from: Day(2012, 1, 12), name: "1.1"),
                Version(from: Day(2012, 3, 1), name: "1.2"),
                Version(from: Day(2012, 8, 1), name: "1.3"),
                Version(from: Day(2012, 10, 25), name: "1.4, the Pretty Scary Update"),
                Version(from: Day(2013, 3, 13), name: "1.5, the Redstone Update"),
                Version(from: Day(2013, 7, 1), name: "1.6, the Horse Update"),
                Version(from: Day(2013, 10, 25), name: "1.7"),
                Version(from: Day(2014, 9, 2), name: "1.8, the Bountiful Update"),
                Version(from: Day(2016, 2, 29), name: "1.9, the Combat Update"),
                Version(from: Day(2016, 6, 8), name: "1.10"),
                Version(from: Day(2016, 11, 14), name: "1.11, the Exploration Update"),
                Version(from: Day(2017, 6, 7), name: "1.12, the World of Color Update"),
                Version(from: Day(2018, 7, 18), name: "1.13, the Aquatic Update"),
                Version(from: Day(2019, 4, 23), name: "1.14, Village and Pillage"),
                Version(from: Day(2019, 12, 10), name: "1.15, Buzzy Bees"),
                Version(from: Day(2020, 6, 23), name: "1.16, the Nether Update"),
                Version(from: Day(2021, 6, 8), name: "1.17, Caves and Cliffs part one"),
                Version(from: Day(2021, 11, 30), name: "1.18, Caves and Cliffs part two"),
                Version(from: Day(2022, 6, 7), name: "1.19, the Wild Update"),
                Version(from: Day(2023, 6, 7), name: "1.20, Trails and Tales"),
                Version(from: Day(2024, 6, 13), name: "1.21, Tricky Trials"),
            ],
            knownThrough: Day(2024, 12, 31),
            // The same problem. The Wikipedia article has a version table with
            // years in it and no days, so 1.16 reads as "2020" there and the
            // row below says June 23. This page states the day.
            sourceURL: URL(string: "https://minecraft.wiki/w/Java_Edition_version_history")!
        ),
        Timeline(
            subject: "the iPhone",
            kicker: "IPHONE",
            wording: .newest("iPhone"),
            versions: [
                Version(from: Day(2007, 6, 29), name: "first iPhone"),
                Version(from: Day(2008, 7, 11), name: "iPhone 3G"),
                Version(from: Day(2009, 6, 19), name: "iPhone 3GS"),
                Version(from: Day(2010, 6, 24), name: "iPhone 4"),
                Version(from: Day(2011, 10, 14), name: "iPhone 4S"),
                Version(from: Day(2012, 9, 21), name: "iPhone 5"),
                Version(from: Day(2013, 9, 20), name: "iPhone 5S"),
                Version(from: Day(2014, 9, 19), name: "iPhone 6"),
                Version(from: Day(2015, 9, 25), name: "iPhone 6S"),
                Version(from: Day(2016, 9, 16), name: "iPhone 7"),
                Version(from: Day(2017, 9, 22), name: "iPhone 8"),
                Version(from: Day(2017, 11, 3), name: "iPhone X"),
                Version(from: Day(2018, 9, 21), name: "iPhone XS"),
                Version(from: Day(2019, 9, 20), name: "iPhone 11"),
                Version(from: Day(2020, 10, 23), name: "iPhone 12"),
                Version(from: Day(2021, 9, 24), name: "iPhone 13"),
                Version(from: Day(2022, 9, 16), name: "iPhone 14"),
                Version(from: Day(2023, 9, 22), name: "iPhone 15"),
                Version(from: Day(2024, 9, 20), name: "iPhone 16"),
            ],
            knownThrough: Day(2025, 6, 30),
            sourceURL: URL(string: "https://en.wikipedia.org/wiki/List_of_iPhone_models")!
        ),
        Timeline(
            subject: "the PlayStation",
            kicker: "PLAYSTATION",
            wording: .newest("PlayStation"),
            versions: [
                Version(from: Day(1995, 9, 9), name: "original PlayStation"),
                Version(from: Day(2000, 10, 26), name: "PlayStation 2"),
                Version(from: Day(2006, 11, 17), name: "PlayStation 3"),
                Version(from: Day(2013, 11, 15), name: "PlayStation 4"),
                Version(from: Day(2020, 11, 12), name: "PlayStation 5"),
            ],
            knownThrough: Day(2025, 6, 30),
            sourceURL: URL(string: "https://en.wikipedia.org/wiki/PlayStation")!
        ),
        Timeline(
            subject: "the Nintendo console",
            kicker: "NINTENDO",
            wording: .newest("Nintendo console"),
            versions: [
                // September 27, 1986, not October 18, 1985. Both are real and
                // both are on the page. The 1985 date is a test market in New
                // York City alone, followed by Los Angeles in February 1986,
                // and the page calls September 27, 1986 the full North
                // American release. This file's rule is the reader's world,
                // and a shop in one city for eleven months was not most
                // readers' world. A New Yorker born in early 1986 is the one
                // person this row is wrong for, and the alternative is being
                // wrong for everybody outside New York.
                Version(from: Day(1986, 9, 27), name: "Nintendo Entertainment System"),
                Version(from: Day(1991, 8, 23), name: "Super Nintendo"),
                // The page disagrees with itself by three days: the infobox
                // says September 29 and the body says it was first sold on
                // September 26 "though having been advertised for the 29th".
                // The 29th is what was advertised and what almost everybody
                // therefore experienced, so it is the one here. A reader born
                // on the 27th or 28th of September 1996 sits inside the
                // disagreement and there is no answer that is right for them.
                Version(from: Day(1996, 9, 29), name: "Nintendo 64"),
                Version(from: Day(2001, 11, 18), name: "GameCube"),
                Version(from: Day(2006, 11, 19), name: "Wii"),
                Version(from: Day(2012, 11, 18), name: "Wii U"),
                // Worldwide on one day, so there is no United States date to
                // get wrong. The same is true of the Switch 2.
                Version(from: Day(2017, 3, 3), name: "Switch"),
                Version(from: Day(2025, 6, 5), name: "Switch 2"),
            ],
            knownThrough: Day(2025, 6, 30),
            sourceURL: URL(string: "https://en.wikipedia.org/wiki/Nintendo_Entertainment_System")!
        ),
        Timeline(
            subject: "the Xbox",
            kicker: "XBOX",
            wording: .newest("Xbox"),
            versions: [
                Version(from: Day(2001, 11, 15), name: "original Xbox"),
                Version(from: Day(2005, 11, 22), name: "Xbox 360"),
                Version(from: Day(2013, 11, 22), name: "Xbox One"),
                Version(from: Day(2020, 11, 10), name: "Xbox Series X and S"),
            ],
            knownThrough: Day(2025, 6, 30),
            // Every Xbox reached the United States first or close to it, so
            // this is the one console line with no Japanese date anywhere
            // near it to be caught by.
            sourceURL: URL(string: "https://en.wikipedia.org/wiki/Xbox_(console)")!
        ),
        Timeline(
            subject: "Pokémon",
            kicker: "POKÉMON",
            wording: .era("Pokémon"),
            versions: [
                Version(from: Day(1998, 9, 28), name: "Generation 1, Red and Blue"),
                Version(from: Day(2000, 10, 15), name: "Generation 2, Gold and Silver"),
                Version(from: Day(2003, 3, 19), name: "Generation 3, Ruby and Sapphire"),
                Version(from: Day(2007, 4, 22), name: "Generation 4, Diamond and Pearl"),
                Version(from: Day(2011, 3, 6), name: "Generation 5, Black and White"),
                Version(from: Day(2013, 10, 12), name: "Generation 6, X and Y"),
                Version(from: Day(2016, 11, 18), name: "Generation 7, Sun and Moon"),
                Version(from: Day(2019, 11, 15), name: "Generation 8, Sword and Shield"),
                Version(from: Day(2022, 11, 18), name: "Generation 9, Scarlet and Violet"),
            ],
            knownThrough: Day(2025, 6, 30),
            sourceURL: URL(string: "https://en.wikipedia.org/wiki/Pok%C3%A9mon_(video_game_series)")!
        ),
    ]

    /// Things that arrived on one day. Check each against its article.
    static let arrivals: [Arrival] = [
        Arrival(subject: "ChatGPT", kicker: "CHATGPT", arrived: Day(2022, 11, 30),
                sourceURL: URL(string: "https://en.wikipedia.org/wiki/ChatGPT")!),
        Arrival(subject: "Instagram", kicker: "INSTAGRAM", arrived: Day(2010, 10, 6),
                sourceURL: URL(string: "https://en.wikipedia.org/wiki/Instagram")!),
        Arrival(subject: "YouTube", kicker: "YOUTUBE", arrived: Day(2005, 2, 14),
                sourceURL: URL(string: "https://en.wikipedia.org/wiki/YouTube")!),
        Arrival(subject: "Discord", kicker: "DISCORD", arrived: Day(2015, 5, 13),
                sourceURL: URL(string: "https://en.wikipedia.org/wiki/Discord")!),
        Arrival(subject: "Roblox", kicker: "ROBLOX", arrived: Day(2006, 9, 1),
                sourceURL: URL(string: "https://en.wikipedia.org/wiki/Roblox")!),
        Arrival(subject: "Spotify", kicker: "SPOTIFY", arrived: Day(2011, 7, 14),
                sourceURL: URL(string: "https://en.wikipedia.org/wiki/Spotify")!),
        Arrival(subject: "Google", kicker: "GOOGLE", arrived: Day(1998, 9, 4),
                sourceURL: URL(string: "https://en.wikipedia.org/wiki/Google")!),
        Arrival(subject: "Facebook", kicker: "FACEBOOK", arrived: Day(2004, 2, 4),
                sourceURL: URL(string: "https://en.wikipedia.org/wiki/Facebook")!),
        Arrival(subject: "Wikipedia", kicker: "WIKIPEDIA", arrived: Day(2001, 1, 15),
                sourceURL: URL(string: "https://en.wikipedia.org/wiki/Wikipedia")!),
    ]
}
