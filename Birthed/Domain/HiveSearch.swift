import Foundation

/// The typed field on the hive, docs/the-wall.md section 15.
///
/// The first real board was ten tiles of wire copy, and the reaction was
/// that the mechanic was broken. It was not: a person handed that ballot and
/// asked to spend a permanent vote on it answers correctly by spending
/// nothing. The candidates were the problem, and a list of two hundred
/// headlines is a recognition task that needs a good list. This turns it
/// into a recall task, which does not: ask what mattered about the date and
/// find the story the reader means among what is already filed for it.
///
/// **No model, no network, no new stored data.** Plain word matching over
/// rows the app has already loaded. Nothing leaves the phone that was not
/// already leaving it and nothing new is written anywhere, which is the whole
/// reason this can ship. Section 15 leaves room for a model on the hard
/// cases, "the thing with Russia and the drones", picking from a closed list
/// with grounded search off and returning an identifier; that would sit
/// behind `answer` and hand back a story identifier from the same list, and
/// it is not built. What is stored of what people type is Nathan's call.
///
/// **A miss is an answer, and a wrong match is a spent buzz.** A buzz is
/// scarce, permanent and irreversible, so a weak best match is worse than an
/// honest miss: the miss is the front door to submission and the only
/// editorial signal here that comes from a person, and the wrong match costs
/// something that cannot be given back. Every rule below leans that way.
///
/// Pure Swift, Foundation only, and tested against the real headlines filed
/// for September 9, 2026 in `HiveSearchTests`.
enum HiveSearch {

    /// One story the query found, and how well.
    struct Match: Equatable, Identifiable {
        let story: WallStory
        /// How much of the query the story answers, 0 to 1. Scored on the
        /// query's side rather than the headline's: a two word query fully
        /// met by a long headline is a good match, and a long headline is not
        /// a worse answer for saying more.
        let coverage: Double
        /// How many of the query's words were met by the same word rather
        /// than by the front of a longer one.
        let exact: Int

        var id: String { story.id }
    }

    /// What the field says back.
    enum Answer: Equatable {
        /// The query had no words worth searching on. Not a miss: "the" does
        /// not fail to match, it never asked.
        case blank
        /// Nothing filed for the date says that.
        case miss
        /// One story, and it stands alone.
        case one(Match)
        /// A few stories say that, best first. Which is the reader's to say.
        case several([Match])
    }

    // MARK: The rules

    /// The least of the query a story must answer to be offered at all. Half:
    /// a two word query with one word met is offered, because "oil prices"
    /// means the oil story, and a three word query with one word met is not,
    /// because one word in three is a coincidence more often than a meaning.
    static let floor: Double = 0.5

    /// What the front of a longer word is worth against a whole one. "moldov"
    /// finds "Moldovan" and "moldova" finds "Moldovan", and both should, and
    /// neither should outrank a story that says the word itself.
    static let prefixWeight: Double = 0.7

    /// The shortest query word that may match the front of a longer one. Under
    /// this, "us" would find "used" and "die" would find "diet", which is the
    /// substring problem back in a different coat.
    static let prefixMinimum = 4

    /// How many stories the field offers when several say the same thing.
    static let shown = 3

    /// Words that carry no meaning worth matching on. "the oil thing" is the
    /// oil story, and "the" on its own is not every story on the date.
    ///
    /// Deliberately short. "us" is not here because on a news headline it is
    /// the United States far more often than a pronoun, and "open" is not
    /// here because it is the US Open. A word left off this list costs a
    /// looser match on one query; a word wrongly on it makes a query blind to
    /// a headline that says it.
    static let stopWords: Set<String> = [
        "a", "an", "the", "of", "and", "or", "in", "on", "at", "to", "for", "with", "by", "from",
        "is", "was", "were", "are", "be", "been", "it", "its", "this", "that", "these", "those",
        "about", "what", "which", "who", "when", "how", "did", "does", "do", "as", "but", "so",
        "not", "no", "my", "me", "i", "you", "your", "he", "she", "they", "we", "our", "their",
        "his", "her", "him", "them", "thing", "things", "stuff", "one", "some", "any", "there",
        "here", "just", "like", "up", "out", "into", "over",
    ]

    // MARK: Words

    /// The apostrophes the feeds use. Half of them curl theirs, and a screen
    /// that treats "NASA’s" and "NASA's" as different words has already been
    /// a bug in this repository once tonight.
    private static let curlyApostrophes = ["\u{2019}", "\u{2018}", "\u{02BC}", "\u{2032}", "`"]

    /// Letters, digits and the apostrophe, which is kept through the split so
    /// a possessive can be recognised and then removed as one piece.
    private static let wordCharacters = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "'"))

    /// A text as the words in it: lowercased, accents folded, apostrophes
    /// straightened, possessives dropped, punctuation gone. Matching is on
    /// these whole words and never on substrings, so "oil" does not find
    /// "spoiled".
    ///
    /// The possessive comes off both sides the same way, so "Britain’s" and
    /// "britain" are one word. A reader who types "devils" for "Devil’s" is
    /// not caught by this and is not guessed at either: the other words in
    /// the query carry it or the answer is a miss.
    static func words(_ text: String) -> [String] {
        var folded = text.folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: nil)
        for mark in curlyApostrophes {
            folded = folded.replacingOccurrences(of: mark, with: "'")
        }
        return folded.components(separatedBy: wordCharacters.inverted).compactMap { piece -> String? in
            var word = piece
            if word.hasSuffix("'s") {
                word = String(word.dropLast(2))
            } else if word.hasSuffix("s'") {
                word = String(word.dropLast())
            }
            word = word.replacingOccurrences(of: "'", with: "")
            return word.isEmpty ? nil : word
        }
    }

    /// The query's words with the stop words gone. Empty when nothing is left,
    /// and an empty query matches nothing rather than everything.
    static func queryWords(_ text: String) -> [String] {
        words(text).filter { !stopWords.contains($0) }
    }

    /// An outlet as the labels of its host, without the top level domain and
    /// without "www". "bbc.com" is the one word "bbc", and "en.wikipedia.org"
    /// is "en" and "wikipedia". An outlet that is not a host, "The Guardian",
    /// is simply its words.
    static func outletWords(_ outlet: String) -> [String] {
        var labels = outlet.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            .split(separator: ".").map(String.init)
        if labels.count > 1 { labels.removeLast() }
        labels.removeAll { $0 == "www" }
        return labels.flatMap { words($0) }
    }

    // MARK: Scoring

    struct Score: Equatable {
        let coverage: Double
        let exact: Int
    }

    /// What one query word is worth against a story: the whole word in the
    /// headline or the outlet, the front of a longer headline word, or
    /// nothing.
    ///
    /// The outlet is treated one step more loosely than the headline: a label
    /// like "theguardian" or "sciencedaily" is two words run together rather
    /// than prose, so a query word found anywhere inside it counts at the
    /// prefix weight. The headline is prose and gets no such thing, because
    /// that is exactly where "oil" would find "spoiled".
    static func weight(of word: String, headline: [String], outlet: [String]) -> Double {
        if headline.contains(word) || outlet.contains(word) { return 1 }
        guard word.count >= prefixMinimum else { return 0 }
        if headline.contains(where: { $0.hasPrefix(word) }) { return prefixWeight }
        if outlet.contains(where: { $0.contains(word) }) { return prefixWeight }
        return 0
    }

    /// How much of the query the story answers. Each query word takes its
    /// best weight and the mean is the coverage, so the score is about the
    /// query and not about the headline's length.
    static func score(query: [String], headline: [String], outlet: [String]) -> Score {
        guard !query.isEmpty else { return Score(coverage: 0, exact: 0) }
        var total = 0.0
        var exact = 0
        for word in query {
            let value = weight(of: word, headline: headline, outlet: outlet)
            total += value
            if value == 1 { exact += 1 }
        }
        return Score(coverage: total / Double(query.count), exact: exact)
    }

    /// The headline and the outlet, and deliberately not the quotation.
    ///
    /// The quotation is the source's own paragraph and it is prose: it is
    /// where "today", "died", "people" and "said" live, and a query that only
    /// meets a story there meets it on words the reader never saw on a tile.
    /// The headline is what the hive shows and what a reader recognises, and
    /// the cost of a wrong match is a permanent buzz, so the search is held
    /// to what the reader could have meant.
    static func score(query: [String], story: WallStory) -> Score {
        score(query: query, headline: words(story.headline), outlet: outletWords(story.outlet))
    }

    /// Best first: most of the query answered, then answered with whole words
    /// rather than fronts of words, then the feed's own order, which ends on
    /// the identifier so two runs of one query give one order.
    static func before(_ a: Match, _ b: Match) -> Bool {
        if a.coverage != b.coverage { return a.coverage > b.coverage }
        if a.exact != b.exact { return a.exact > b.exact }
        return HiveFeed.before(a.story, b.story)
    }

    // MARK: Asking

    /// Every story that answers enough of the query, best first, at most
    /// `limit` of them. Empty for an empty query, a query of stop words, and
    /// a query nothing says.
    static func matches(query: String, in stories: [WallStory], limit: Int = HiveSearch.shown) -> [Match] {
        let wanted = queryWords(query)
        guard !wanted.isEmpty else { return [] }
        var found: [Match] = []
        for story in stories {
            let result = score(query: wanted, story: story)
            guard result.coverage >= floor else { continue }
            found.append(Match(story: story, coverage: result.coverage, exact: result.exact))
        }
        found.sort(by: before)
        return Array(found.prefix(max(0, limit)))
    }

    /// The field's answer.
    ///
    /// One story is offered alone when it is the only one that clears the
    /// floor, or when it answers the whole query and nothing else does:
    /// "russia" is the drone war at the border before it is the Siege of
    /// Sevastopol, whose headline says "Russian". Anything closer than that
    /// is a few candidates and the reader's choice, because "us" is the oil
    /// strikes, the US Open and the terrorist designation all at once and no
    /// score can say which the reader meant.
    static func answer(query: String, in stories: [WallStory], limit: Int = HiveSearch.shown) -> Answer {
        guard !queryWords(query).isEmpty else { return .blank }
        let found = matches(query: query, in: stories, limit: limit)
        guard let first = found.first else { return .miss }
        if found.count == 1 { return .one(first) }
        let second = found[1]
        if first.coverage >= 1 && second.coverage < 1 { return .one(first) }
        return .several(found)
    }

    // MARK: The chips

    /// The stories offered under the field to somebody with no answer of
    /// their own: the top of the board, in the feed's order, filled from the
    /// pool when the board is short. A story shown false takes no buzz and is
    /// not offered.
    static func chips(from stories: [WallStory], limit: Int = HiveSearch.shown) -> [WallStory] {
        let takes = stories.filter { $0.status != .shownFalse }
        var out = Array(WallBoard.tiles(takes).sorted(by: HiveFeed.before).prefix(max(0, limit)))
        let used = Set(out.map(\.id))
        for story in HiveFeed.waiting(takes) where !used.contains(story.id) {
            if out.count >= limit { break }
            out.append(story)
        }
        return out
    }
}
