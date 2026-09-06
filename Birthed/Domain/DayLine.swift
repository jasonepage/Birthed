import Foundation

/// The one true thing a screen can say about a calendar date, chosen so that
/// it never has to say a name.
///
/// This is the Swift half of the fix the website already shipped. Two surfaces
/// there showed people, and both failed the same way for the same reason: the
/// list of people born on a date is ordered by how much attention somebody
/// gets, and infamy is attention. The share card said "You share it with
/// Bashar al-Assad" on September 11, led with Ted Bundy on November 24 and
/// Charles Manson on November 12, and had Hitler second on April 20.
///
/// The app had the same hole in two more places, from the same query. The
/// onboarding day screen and the Mine tab both read the top three from
/// `notable_people` ordered by `notability_score`, which is the same table,
/// the same column and the same order the website's card used.
///
/// A word list cannot fix that. Wikidata calls Assad a politician, Andrew Tate
/// a businessman, and the December 17 lead an influencer, so there is no field
/// anywhere in the data that means "not on a birthday screen". A filter is a
/// list somebody has to keep adding to forever, and every miss ships.
///
/// So the fix is to stop needing the names. A screen with something that
/// happened on it shows no names at all, and this type is what finds that
/// something. It was the better screen regardless: the names are what every
/// competitor already has, and the line about the date is the half none of
/// them can print.
///
/// Pure. It is handed the rows and hands back one line. Nothing in here
/// fetches, and nothing in here may ever start a search, because the
/// onboarding wheel walks across dates and a search costs money per date.
struct DayLine: Equatable {
    /// The year it happened. Never nil: a line with no year is not a line
    /// this is willing to print, because the year is half of what makes it
    /// worth reading.
    let year: Int
    /// The sentence, with any "On September 4, 2002," prefix already taken
    /// off and the first letter put back into upper case.
    let text: String

    /// Long enough to say something, short enough to read at a glance. The
    /// same number the website uses, so a date does not get a line on one and
    /// not the other.
    static let longestLine = 110

    /// The line for a date, or nothing.
    ///
    /// The researched facts are preferred over Wikipedia's events, and that is
    /// the important part. The fact finder is already steered away from
    /// encyclopedia shaped content and toward things somebody would
    /// screenshot, so it is the curated set. Wikipedia's date articles lean
    /// the other way, toward wars, disasters and elections, because that is
    /// what an encyclopedia is for.
    ///
    /// The shortest passing line wins. Not because short means good, but
    /// because the screen has one line of room and the alternative is choosing
    /// at random. Ties break by year, so the same date always gives the same
    /// line and the screen does not change every time it is opened.
    ///
    /// Returns nil rather than reaching for something worse. A caller that
    /// gets nil shows nothing at all, which is already what every one of these
    /// screens does when it is offline. In practice nil should be rare: the
    /// app reads the facts with the same three filters the website's card uses
    /// (`birth_year` of 0, an empty `region_key`, verified), and against those
    /// the website reports a line on all 366 dates, 278 from a researched fact
    /// and 88 from a screened event. What a caller must never do is fall
    /// back to the names, because falling back to the names is the hole this
    /// exists to close.
    static func choose(facts: [BirthFact], events: [DayFeed.Event], on date: CalendarDate) -> DayLine? {
        var fromFacts: [DayLine] = []
        for fact in facts {
            if Screening.notOnACard(fact.fact) { continue }
            guard let split = splitDatePrefix(fact.fact, on: date) else { continue }
            if split.text.count > longestLine { continue }
            fromFacts.append(split)
        }
        if let chosen = shortest(fromFacts) { return chosen }

        // Nothing researched for this date, so rather than fall back to the
        // names, fall back to Wikipedia's own line for it, screened twice.
        //
        // An event's sentence, unlike a person's description, does describe
        // the thing being refused, which is why screening works here and does
        // not work on a person. November 12 stops being Charles Manson and
        // becomes the PlayStation 5 being released.
        var fromEvents: [DayLine] = []
        for event in events {
            guard let year = event.year else { continue }
            let text = event.description.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty || text.count > longestLine { continue }
            if Screening.notOnACard(text) { continue }
            if Screening.encyclopedic(text) { continue }
            fromEvents.append(DayLine(year: year, text: text))
        }
        return shortest(fromEvents)
    }

    /// Shortest wins, ties by year, so a screen reads well and never changes
    /// for no reason.
    static func shortest(_ lines: [DayLine]) -> DayLine? {
        lines.min { left, right in
            if left.text.count != right.text.count { return left.text.count < right.text.count }
            return left.year < right.year
        }
    }

    /// "On September 4, 2002, the Salem-Keizer Volcanoes finished 41 and 35"
    /// becomes 2002 and "The Salem-Keizer Volcanoes finished 41 and 35".
    ///
    /// The month names are written out here in English rather than read from
    /// the device's calendar. The fact finder writes English into the
    /// database, so on a phone set to French the calendar's month names would
    /// never match, the prefix would never come off, and every reader outside
    /// English would get no line at all. That is the kind of bug that is
    /// invisible from the file it lives in.
    ///
    /// Nil when there is no such prefix. A fact with no year in front of it is
    /// not refused for being bad, it simply has no year to print beside it,
    /// and this screen sets the year in its own colour.
    static func splitDatePrefix(_ fact: String, on date: CalendarDate) -> DayLine? {
        guard date.month >= 1, date.month <= englishMonths.count else { return nil }
        let trimmed = fact.trimmingCharacters(in: .whitespacesAndNewlines)
        let prefix = "On \(englishMonths[date.month - 1]) \(date.day), "
        guard trimmed.hasPrefix(prefix) else { return nil }

        var rest = Substring(trimmed.dropFirst(prefix.count))
        let digits = rest.prefix(4)
        guard digits.count == 4, digits.allSatisfy(\.isNumber), let year = Int(digits) else { return nil }
        rest = rest.dropFirst(4)
        guard rest.hasPrefix(", ") else { return nil }
        rest = rest.dropFirst(2)

        let sentence = rest.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let first = sentence.first else { return nil }
        // "the date never occurred" has to become "The date never occurred".
        // Only the very first letter of the sentence is touched, so a name
        // like iPhone or eBay anywhere else in it survives untouched.
        return DayLine(year: year, text: String(first).uppercased() + String(sentence.dropFirst()))
    }

    private static let englishMonths = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]
}
