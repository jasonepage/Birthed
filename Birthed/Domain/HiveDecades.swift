// Decade teams, docs/the-wall.md section 30, decided September 23, 2026.
//
// Every tile carries a year and the board says which decade holds the most
// of the hive, by buzzes: "The 1940s lead September 23 with 2 of 3 buzzes."
// Nathan's calls, made on the live boards: the news counts as the 2020s,
// counted by buzzes rather than tiles, and with no buzzes there is no line.
// Teams with no accounts and no membership; nothing records which decade a
// reader favoured. This is the app's copy of web/src/decades.ts, and
// HiveDecadesTests asserts the sentences the website's tests printed.

import Foundation

enum HiveDecades {
    struct Team: Equatable {
        let decade: Int
        let buzzes: Int
        /// The generation named on the line when the decade's buzzed people
        /// are all one: "Boomers" for a 1940s led by Springsteen. Nil when
        /// the buzzes are on events, songs or news, which belong to no
        /// generation, or when its people straddle two. Nathan's call,
        /// September 23, 2026: people get a generation, everything else
        /// stays a decade.
        var generation: String? = nil
    }

    /// The Pew Research Center's boundaries for Silent through Generation
    /// Z, and the common ones either side. The website's GENERATIONS.
    static let generations: [(name: String, from: Int, to: Int)] = [
        ("Lost Generation", 1883, 1900),
        ("Greatest Generation", 1901, 1927),
        ("Silent Generation", 1928, 1945),
        ("Boomers", 1946, 1964),
        ("Gen X", 1965, 1980),
        ("Millennials", 1981, 1996),
        ("Gen Z", 1997, 2012),
        ("Gen Alpha", 2013, 2024),
    ]

    static func generation(of born: Int?) -> String? {
        guard let born else { return nil }
        return generations.first { born >= $0.from && born <= $0.to }?.name
    }

    /// A person's birth year, for the generation; nil for anything that is not a person.
    static func born(of story: WallStory) -> Int? {
        story.subjectKind == "person" ? year(of: story) : nil
    }

    struct Standing: Equatable {
        /// Every decade with a buzz, most first, the older decade first on a tie.
        let teams: [Team]
        let total: Int
        /// The decades sharing the top count. One is a leader; more is a tie.
        let leaders: [Int]

        static let empty = Standing(teams: [], total: 0, leaders: [])
    }

    /// The year a story is about: a history row's, a number one's, a person's
    /// birth year, a birth fact's, and the wall date's year for the news.
    static func year(of story: WallStory) -> Int? {
        guard story.subjectKind != nil else { return story.wallDate.year }
        let h = story.headline
        if let m = h.firstMatch(of: #/^(\d{3,4}): /#) { return Int(m.1) }
        if story.subjectKind == "person", let m = h.firstMatch(of: #/\bborn (\d{3,4})\b/#) { return Int(m.1) }
        if let m = h.firstMatch(of: #/^On [A-Z][a-z]+ \d{1,2}, (\d{3,4}),/#) { return Int(m.1) }
        return nil
    }

    /// The decade as its first year, 1940 for the 1940s, or nil.
    static func decade(of story: WallStory) -> Int? {
        year(of: story).map { ($0 / 10) * 10 }
    }

    /// The teams as a day's stories stand: every story on the date that is
    /// not stamped false, by its decade, counting its buzzes.
    static func standing(for day: WallDay) -> Standing {
        var by: [Int: Int] = [:]
        var gens: [Int: Set<String>] = [:]
        var total = 0
        for story in day.stories where story.status != .shownFalse && story.support >= 1 {
            guard let decade = decade(of: story) else { continue }
            by[decade, default: 0] += story.support
            total += story.support
            // Every buzzed person's generation, and "" for a buzzed story
            // that is not a person, which belongs to none.
            gens[decade, default: []].insert(generation(of: born(of: story)) ?? "")
        }
        let teams = by.map { decade, buzzes -> Team in
            let seen = gens[decade] ?? []
            let one = seen.count == 1 ? seen.first : nil
            return Team(decade: decade, buzzes: buzzes, generation: one == "" ? nil : one)
        }
            .sorted { a, b in a.buzzes != b.buzzes ? a.buzzes > b.buzzes : a.decade < b.decade }
        let top = teams.first?.buzzes ?? 0
        return Standing(teams: teams, total: total, leaders: teams.filter { $0.buzzes == top }.map(\.decade))
    }

    static func name(_ decade: Int) -> String { "\(decade)s" }

    private static func named(_ team: Team) -> String {
        name(team.decade) + (team.generation.map { " (\($0))" } ?? "")
    }

    private static func team(in s: Standing, _ decade: Int) -> Team {
        s.teams.first { $0.decade == decade } ?? Team(decade: decade, buzzes: 0)
    }

    private static func units(_ n: Int, _ voice: HiveVoice) -> String {
        n == 1 ? "1 \(voice.one)" : "\(n) \(voice.many)"
    }

    private static func list(_ names: [String]) -> String {
        guard names.count > 1 else { return names.joined() }
        return names.dropLast().joined(separator: ", ") + " and " + names[names.count - 1]
    }

    /// The line under the board, or "" with no buzzes. Past tense once sealed.
    /// The website's HiveDecades.line, word for word.
    static func line(_ s: Standing, dateName: String, voice: HiveVoice, sealed: Bool) -> String {
        guard s.total > 0, let first = s.teams.first, !s.leaders.isEmpty else { return "" }
        let top = first.buzzes
        let sofar = sealed ? "" : " so far"
        if s.leaders.count == 1 {
            let with: String
            if top == s.total {
                with = s.total == 1 ? "the only \(voice.one)\(sofar)" : "all \(units(s.total, voice))\(sofar)"
            } else {
                with = "\(top) of \(units(s.total, voice))"
            }
            return "The \(named(team(in: s, s.leaders[0])))\(sealed ? " led " : " lead ")\(dateName) with \(with)."
        }
        return "The \(list(s.leaders.map { named(team(in: s, $0)) }))\(sealed ? " were level on " : " are level on ")\(dateName), \(units(top, voice)) each."
    }

    static func line(for day: WallDay, dateName: String, voice: HiveVoice, sealed: Bool) -> String {
        line(standing(for: day), dateName: dateName, voice: voice, sealed: sealed)
    }
}
