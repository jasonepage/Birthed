// The crown, docs/the-wall.md section 30, decided September 23, 2026.
//
// The most buzzed story on a hive wears a crown, and every time the crown
// changed hands is a short list under the board. Both come from the day's
// buzz rows replayed in the order they were cast, and from nothing else: no
// table records a takeover, and a buzz taken back in its thirty seconds is a
// row that no longer exists, so it was never a takeover.
//
// The tie rule, Nathan's call: the crown is held until another story has
// strictly more buzzes, and on a tie the holder keeps it. The pie's order
// breaks a tie by the editor's score, which is not a buzz. A crown is only
// ever won by a buzz, so nothing here reads a score, a priority or an
// arrival time.
//
// This is the app's copy of web/src/crown.ts. HiveCrownTests pins it to
// sentences printed by the website's own tests, the way HiveTests pins the
// viewport, so the two cannot drift without a test failing on one side.

import Foundation

/// One buzz row as the app may read it. The role cannot select the booster
/// and this value never carries one.
struct WallBoost: Equatable {
    let id: Int
    let storyID: String
    let units: Int
    let castAt: Date
}

enum HiveCrown {
    /// One change of hands. `from` is nil for the first crown of the day.
    struct Change: Equatable {
        let at: Date
        let to: String
        let from: String?
    }

    struct Crown: Equatable {
        /// The story wearing it, or nil when nobody has buzzed.
        let holder: String?
        /// Its buzzes. Nought when nobody has buzzed.
        let count: Int
        let changes: [Change]

        static let empty = Crown(holder: nil, count: 0, changes: [])
    }

    /// The longest a name in a line may be before it is cut at a word, the
    /// website's LIMIT.
    static let nameLimit = 60

    /// The replay. `eligible` is the stories that can hold the crown: the
    /// stories on the date that are not stamped false. A buzz on anything
    /// else counts for nothing, the same way the pie gives a false story no
    /// share whatever it was buzzed.
    static func replay(_ boosts: [WallBoost], eligible: Set<String>) -> Crown {
        let ordered = boosts
            .filter { (1...3).contains($0.units) }
            .sorted { a, b in
                if a.castAt != b.castAt { return a.castAt < b.castAt }
                return a.id < b.id
            }
        var counts: [String: Int] = [:]
        var holder: String? = nil
        var top = 0
        var changes: [Change] = []
        for b in ordered {
            guard eligible.contains(b.storyID) else { continue }
            let count = (counts[b.storyID] ?? 0) + b.units
            counts[b.storyID] = count
            if count > top {
                if holder != b.storyID { changes.append(Change(at: b.castAt, to: b.storyID, from: holder)) }
                holder = b.storyID
                top = count
            }
        }
        return Crown(holder: holder, count: top, changes: changes)
    }

    /// The crown as a day's rows stand.
    static func crown(for day: WallDay) -> Crown {
        replay(day.boosts, eligible: Set(day.stories.filter { $0.status != .shownFalse }.map(\.id)))
    }

    // MARK: Words

    /// What a story is called in a crown line: a person's name, a song's
    /// title with its artist, an album's or a film's title, and otherwise the
    /// headline. The website's crownName.
    static func name(for story: WallStory) -> String {
        let h = story.headline
        switch story.subjectKind ?? "" {
        case "person":
            if let m = h.firstMatch(of: #/^(.+?), .*\bborn \d{3,4}/#) { return String(m.1) }
        case "song":
            if let m = h.firstMatch(of: #/^\d{4}: (.+) was the number one song$/#) { return String(m.1) }
        case "album":
            if let m = h.firstMatch(of: #/^\d{4}: (.+) was the number one album$/#) { return String(m.1) }
        case "film":
            if let m = h.firstMatch(of: #/^\d{4}: (.+) was the number one film/#) { return String(m.1) }
        default:
            break
        }
        return h
    }

    /// A name cut at a word past the limit, the website's short().
    static func short(_ name: String) -> String {
        guard name.count > nameLimit else { return name }
        var cut = String(name.prefix(nameLimit))
        if let space = cut.lastIndex(of: " ") {
            cut = String(cut[..<space])
        }
        while let last = cut.last, last.isWhitespace { cut.removeLast() }
        return cut + "\u{2026}"
    }

    private static let clockFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "America/New_York")
        f.dateFormat = "h:mm a"
        f.amSymbol = "am"
        f.pmSymbol = "pm"
        return f
    }()

    /// "3:12 pm Eastern". The hive runs on the Eastern clock and so does this.
    static func clock(_ instant: Date) -> String {
        clockFormatter.string(from: instant) + " Eastern"
    }

    /// One line of the list under the board.
    static func line(_ change: Change, nameOf: (String) -> String) -> String {
        let from = change.from.map { " from " + short(nameOf($0)) } ?? ""
        return clock(change.at) + ": " + short(nameOf(change.to)) + " took the crown" + from + "."
    }

    /// The same change said the moment it lands, without the time.
    static func said(_ change: Change, nameOf: (String) -> String) -> String {
        let from = change.from.map { " from " + short(nameOf($0)) } ?? ""
        return short(nameOf(change.to)) + " took the crown" + from + "."
    }

    /// Said when a buzz taken back hands the crown back: nobody took it.
    static func back(_ name: String) -> String {
        "The crown is back with " + short(name) + "."
    }

    /// The line under an open board nobody has buzzed.
    static func none(voice: HiveVoice) -> String {
        "No crown yet. The first \(voice.one) on this hive takes it."
    }
}

extension WallRows {
    /// A buzz row, read with the columns the role may select. A row not
    /// shaped like a buzz is dropped rather than repaired: a story, one to
    /// three whole units, and a time that parses. The booster is never among
    /// the columns and never asked for.
    static func boost(_ row: [String: Any]) -> WallBoost? {
        guard let id = row["id"] as? Int,
              let storyID = row["story_id"] as? String,
              let units = row["units"] as? Int, (1...3).contains(units),
              let castAt = date(row["cast_at"])
        else { return nil }
        return WallBoost(id: id, storyID: storyID, units: units, castAt: castAt)
    }
}
