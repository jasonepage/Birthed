import Foundation

/// The words that keep a sentence off a screen, in three named strengths.
///
/// This file exists because the same refusal was already written twice, once
/// in Swift for the Today feed and once in TypeScript for the website's share
/// cards, and the two copies had already drifted apart. The Swift copy was
/// missing war, battle, siege and a few word endings. Two lists that are meant
/// to agree and live in different files will always end up disagreeing, and
/// the disagreement is invisible from either file.
///
/// There are three strengths rather than one because the three jobs are not
/// the same job.
///
/// `heavy` is the loosest and it only ever moves a row. The Today tab is a
/// record of what happened on a date, 41 percent of the 19,734 imported events
/// match this list, and filtering the whole feed would take September 11 off
/// September 11 and Pearl Harbor off December 7. A history feed emptied of
/// history is not safer, it is broken.
///
/// `notOnACard` is stricter and it removes rather than moves. A card or a
/// reveal line is one sentence, it is a celebration rather than a record, and
/// it travels into places nobody chose. A false refusal costs one line, and
/// the screen is complete without it, so this list is deliberately broad and
/// deliberately stupid. It does not understand anything. It only refuses.
///
/// `encyclopedic` is the extra pass for Wikipedia's own sentences. Two lists
/// rather than one, because the two sources have very different base rates and
/// there is no sense punishing the curated one for the other's habits. 3.6
/// percent of the researched facts match `notOnACard`. 41 percent of the
/// Wikipedia events do, because an encyclopedia's date article is a list of
/// wars, coups, disasters and elections, which is what an encyclopedia is for
/// and is not what a birthday screen is for.
///
/// What none of these can do is screen a person. An event's sentence describes
/// the thing being refused. A person's description does not: Wikidata calls
/// Bashar al-Assad a politician and Andrew Tate a businessman. That asymmetry
/// is the whole reason the names were cut from the cards rather than filtered,
/// and it is why nothing in this file is ever pointed at a name.
enum Screening {

    /// Moves a row. The Today feed's list, unchanged, so that feed behaves
    /// exactly as it did before this file existed.
    static func heavy(_ text: String) -> Bool {
        matches(text, pattern: heavyPattern)
    }

    /// Removes a line. Everything `heavy` refuses, plus the words an
    /// encyclopedia uses for the same events in the past tense of a country
    /// rather than of a person.
    static func notOnACard(_ text: String) -> Bool {
        matches(text, pattern: notOnACardPattern)
    }

    /// The second pass, for a sentence that came from Wikipedia rather than
    /// from the fact finder.
    static func encyclopedic(_ text: String) -> Bool {
        matches(text, pattern: encyclopedicPattern)
    }

    // MARK: The lists

    /// Kept as a list of words rather than as a hand written regular
    /// expression, because a list is what somebody will read and add to, and
    /// a wall of pipes is not.
    static let heavyWords = [
        "kill", "killed", "kills", "killing", "massacre", "shooting", "shot",
        "murder", "murdered", "bomb", "bombing", "bombed", "attack", "attacked",
        "dies", "died", "death", "deaths", "dead", "crash", "crashed", "crashes",
        "earthquake", "hurricane", "tsunami", "famine", "executed", "execution",
        "assassinated", "assassination", "rape", "raped", "slaughter", "genocide",
        "terrorist", "terrorism", "hostage", "riot", "riots", "invasion",
        "disaster", "sank", "sinking", "sunk", "explosion", "exploded",
        "epidemic", "pandemic", "plague", "suicide", "abducted", "torture",
    ]

    /// The website's birthday card list, word for word. The endings are open
    /// on purpose: `assassinat` covers assassinate, assassinated,
    /// assassination and assassinating without four entries that somebody has
    /// to remember to keep in step.
    static let notOnACardWords = [
        "kill", "killed", "kills", "killing", "massacre", "shooting", "shoots",
        "shot", "murder", "murdered", "bomb", "bombing", "bombed", "attack",
        "attacked", "dies", "died", "death", "deaths", "dead", "crash",
        "crashed", "crashes", "earthquake", "hurricane", "tsunami", "famine",
        "war", "battle", "siege", "executed", "execution", "assassinat[a-z]*",
        "rape", "raped", "slaughter", "genocide", "terror[a-z]*", "hostage",
        "riot", "riots", "invasion", "invades", "invaded", "disaster", "sank",
        "sinking", "sunk", "explosion", "exploded", "epidemic", "pandemic",
        "plague", "suicide", "abduct[a-z]*", "torture[a-z]*",
    ]

    static let encyclopedicWords = [
        "deposed", "revolt", "rebellion", "coup", "troops", "army", "armies",
        "military", "nazi", "holocaust", "massacred", "uprising", "mutiny",
        "purge", "famine", "refugees", "persecution",
    ]

    // MARK: Matching

    /// One pattern per list, joined once, rather than one regular expression
    /// run per word per sentence. The word boundaries are what stop "war" from
    /// firing on "warm" and "shot" from firing on "shotgun wedding", and they
    /// are the reason this cannot be a plain `contains`.
    private static let heavyPattern = pattern(from: heavyWords)
    private static let notOnACardPattern = pattern(from: notOnACardWords)
    private static let encyclopedicPattern = pattern(from: encyclopedicWords)

    private static func pattern(from words: [String]) -> String {
        "\\b(?:" + words.joined(separator: "|") + ")\\b"
    }

    private static func matches(_ text: String, pattern: String) -> Bool {
        text.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }
}
