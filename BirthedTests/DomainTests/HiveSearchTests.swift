import XCTest
@testable import BirthedDomain

/// The typed field, docs/the-wall.md section 15: what it finds, what it
/// refuses to find, and the order it answers in.
///
/// The fixture is the sixteen real headlines filed for September 9, 2026 in
/// the live database, copied out rather than invented, in the repository's
/// habit of pinning a rule to real rows. Several of them curl their
/// apostrophes, one has a dollar sign and one has a hyphenated pair of
/// countries, and every one of those shapes has been a bug somewhere in
/// this product already.
///
/// Not run. Neither the container this was written in nor the shell on the
/// Mac has a Swift toolchain, so every assertion here is unexecuted until
/// somebody runs `swift test`.
final class HiveSearchTests: XCTestCase {

    private func at(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        guard let date = f.date(from: iso) else { fatalError("bad instant \(iso)") }
        return date
    }

    private func story(
        _ id: String,
        _ headline: String,
        _ outlet: String,
        support: Int = 0,
        status: WallStoryStatus = .pool,
        rect: WallRect? = nil,
        minute: Int = 0
    ) -> WallStory {
        WallStory(id: id, wallDate: WallDate(year: 2026, month: 9, day: 9)!,
                  submittedAt: at("2026-09-09T12:00:00Z").addingTimeInterval(Double(minute) * 60),
                  headline: headline, url: URL(string: "https://example.org/\(id)")!, outlet: outlet,
                  status: status, tier: .claimed, support: support, placedAt: nil, rect: rect,
                  falseAt: nil, falseNote: nil, sources: [])
    }

    /// September 9, 2026, as the live database holds it.
    private lazy var filed: [WallStory] = [
        story("oil", "Oil hits $100 a barrel for first time since July after US and Houthi strikes", "bbc.com", minute: 1),
        story("moldova", "Two die at Moldovan border as Russia-Ukraine drone war rages", "bbc.com", minute: 2),
        story("westbank", "Land in limbo: BBC visits West Bank village in area earmarked by Israel for settlement", "bbc.com", minute: 3),
        story("gauff", "Gauff beats Andreeva to reach US Open semifinals in comeback win", "aljazeera.com", minute: 4),
        story("methane", "Chinese scientists find a hidden atomic structure that unlocks methane", "sciencedaily.com", minute: 5),
        story("arrows", "Devil’s Arrows: Ancient builders hauled 55,000-pound stones 11 miles for Britain’s tallest stone row", "sciencedaily.com", minute: 6),
        story("ecuador", "Notorious Ecuadorian crime gang designated a terrorist group by US", "theguardian.com", minute: 7),
        story("nasa", "NASA’s Chandra Unveils Mysterious X-Ray Objects", "nasa.gov", minute: 8),
        story("cohen", "Trump says he would consider pardon for former attorney Michael Cohen", "theguardian.com", minute: 9),
        story("iphone", "Apple unveils first-ever foldable iPhone Duo", "aljazeera.com", minute: 10),
        story("sandler", "Adam Sandler, American actor and comedian, born 1966", "wikidata.org", minute: 11),
        story("williams", "Michelle Williams, American actress (born 1980), born 1980", "wikidata.org", minute: 12),
        story("crimea", "1855: Crimean War: The Siege of Sevastopol comes to an end when Russian forces abandon the city.", "en.wikipedia.org", minute: 13),
        story("u2", "2014: The album Songs of Innocence by U2 is digitally released at no charge to all customers of the iTunes Music Store", "en.wikipedia.org", minute: 14),
        story("bug", "1947: First case of a computer bug being found", "en.wikipedia.org", minute: 15),
        story("spore", "2008: Spore shipped with copy protection that allowed three installs.", "heraldnet.com", minute: 16),
    ]

    private func ids(_ matches: [HiveSearch.Match]) -> [String] {
        matches.map(\.story.id)
    }

    // MARK: What it finds

    func testEveryQueryAReaderWouldTypeFindsTheStoryTheyMean() {
        let expected: [(String, String)] = [
            ("oil", "oil"),
            ("oil prices", "oil"),
            ("the oil thing", "oil"),
            ("moldova", "moldova"),
            ("gauff", "gauff"),
            ("sandler", "sandler"),
            ("adam sandler", "sandler"),
            ("foldable iphone", "iphone"),
            ("u2 album", "u2"),
            ("crimean war", "crimea"),
            ("nasa", "nasa"),
            ("spore", "spore"),
            ("computer bug", "bug"),
            ("ecuador gang", "ecuador"),
        ]
        for (query, id) in expected {
            let found = HiveSearch.matches(query: query, in: filed)
            XCTAssertEqual(found.first?.story.id, id, "\"\(query)\" should find \(id) first")
            // And offered alone, so the reader is shown one thing to confirm
            // rather than asked to choose.
            guard case let .one(match) = HiveSearch.answer(query: query, in: filed) else {
                XCTFail("\"\(query)\" should be one answer, got \(HiveSearch.answer(query: query, in: filed))")
                continue
            }
            XCTAssertEqual(match.story.id, id, "\"\(query)\"")
        }
    }

    func testAQueryFullyMetByALongHeadlineIsAFullMatch() {
        // Two words against the longest headline on the date. Coverage is
        // about the query, not the headline, so this is 1 and not 2 of 22.
        let found = HiveSearch.matches(query: "songs innocence", in: filed)
        XCTAssertEqual(found.first?.story.id, "u2")
        XCTAssertEqual(found.first?.coverage, 1.0)
        XCTAssertEqual(found.first?.exact, 2)
    }

    func testTheFrontOfALongerWordCountsAndCountsForLess() {
        let short = HiveSearch.matches(query: "moldov", in: filed)
        XCTAssertEqual(short.first?.story.id, "moldova", "moldov finds Moldovan")
        XCTAssertEqual(short.first?.coverage, HiveSearch.prefixWeight)
        XCTAssertEqual(short.first?.exact, 0)

        // "Russia" is the drone war and "Russian" is the Siege of Sevastopol.
        // Both are found, the whole word first, and because only one answers
        // the whole query it is offered alone.
        let russia = HiveSearch.matches(query: "russia", in: filed)
        XCTAssertEqual(ids(russia), ["moldova", "crimea"])
        XCTAssertEqual(russia[0].coverage, 1.0)
        XCTAssertEqual(russia[1].coverage, HiveSearch.prefixWeight)
        guard case let .one(match) = HiveSearch.answer(query: "russia", in: filed) else {
            return XCTFail("russia should be one answer")
        }
        XCTAssertEqual(match.story.id, "moldova")
    }

    func testAShortWordDoesNotMatchTheFrontOfAnything() {
        // "die" is a word on the date and "died" is not, and a reader whose
        // grandmother died is not asking about the Moldovan border.
        XCTAssertEqual(HiveSearch.weight(of: "died", headline: HiveSearch.words("Two die at Moldovan border"), outlet: ["bbc"]), 0)
        // Under the prefix minimum a word matches only itself.
        XCTAssertEqual(HiveSearch.weight(of: "die", headline: HiveSearch.words("Two die at Moldovan border"), outlet: ["bbc"]), 1)
        XCTAssertEqual(HiveSearch.weight(of: "di", headline: HiveSearch.words("Two die at Moldovan border"), outlet: ["bbc"]), 0)
    }

    // MARK: What it refuses to find

    func testAQueryNothingSaysIsAMissAndNeverTheNearestThing() {
        for query in ["zzzzzz", "my grandmother died today"] {
            XCTAssertEqual(HiveSearch.matches(query: query, in: filed), [], "\"\(query)\" should match nothing")
            XCTAssertEqual(HiveSearch.answer(query: query, in: filed), .miss, "\"\(query)\" is a miss")
        }
    }

    func testAQueryWithNoWordsInItIsBlankRatherThanEveryStory() {
        for query in ["", "   ", "the", "a the of and", "the thing"] {
            XCTAssertEqual(HiveSearch.matches(query: query, in: filed), [], "\"\(query)\" should match nothing")
            XCTAssertEqual(HiveSearch.answer(query: query, in: filed), .blank, "\"\(query)\" is blank")
        }
    }

    func testAWordInsideAnotherWordIsNotAMatch() {
        // "age" sits inside "rages" and "village" and is neither.
        XCTAssertEqual(HiveSearch.matches(query: "age", in: filed), [])
        // "died" is longer than "die" and is not it.
        XCTAssertEqual(HiveSearch.matches(query: "died", in: filed), [])
    }

    func testOneWordInThreeIsNotEnough() {
        // "war" is on the date twice, and a query that is mostly about
        // something else is not answered by it.
        XCTAssertEqual(HiveSearch.matches(query: "cold war spies", in: filed), [])
        // One word in two is, because "oil prices" is the oil story.
        XCTAssertEqual(ids(HiveSearch.matches(query: "oil prices", in: filed)), ["oil"])
    }

    // MARK: Words

    func testBothApostrophesAreOneApostropheAndAPossessiveComesOff() {
        XCTAssertEqual(HiveSearch.words("Devil’s Arrows"), ["devil", "arrows"])
        XCTAssertEqual(HiveSearch.words("Devil's Arrows"), ["devil", "arrows"])
        XCTAssertEqual(HiveSearch.words("NASA’s Chandra"), ["nasa", "chandra"])
        XCTAssertEqual(HiveSearch.words("Britain’s tallest"), ["britain", "tallest"])
        XCTAssertEqual(HiveSearch.words("the builders’ stones"), ["the", "builders", "stones"])
        XCTAssertEqual(HiveSearch.words("don’t"), ["dont"])
        // Straight or curled, the reader finds the same story.
        XCTAssertEqual(HiveSearch.matches(query: "devil's arrows", in: filed).first?.story.id, "arrows")
        XCTAssertEqual(HiveSearch.matches(query: "devil’s arrows", in: filed).first?.story.id, "arrows")
        XCTAssertEqual(HiveSearch.matches(query: "nasa's chandra", in: filed).first?.story.id, "nasa")
    }

    func testPunctuationCaseAndAccentsAreFolded() {
        XCTAssertEqual(HiveSearch.words("Oil hits $100 a barrel"), ["oil", "hits", "100", "a", "barrel"])
        XCTAssertEqual(HiveSearch.words("Russia-Ukraine drone war"), ["russia", "ukraine", "drone", "war"])
        XCTAssertEqual(HiveSearch.words("X-Ray Objects"), ["x", "ray", "objects"])
        XCTAssertEqual(HiveSearch.words("  Land   in\tlimbo:  "), ["land", "in", "limbo"])
        XCTAssertEqual(HiveSearch.words("Café Zürich"), ["cafe", "zurich"])
        XCTAssertEqual(HiveSearch.words("1855: Crimean War"), ["1855", "crimean", "war"])
    }

    func testStopWordsComeOffTheQueryAndNeverLeaveItEmptyByAccident() {
        XCTAssertEqual(HiveSearch.queryWords("the oil thing"), ["oil"])
        XCTAssertEqual(HiveSearch.queryWords("what happened with the iphone"), ["happened", "iphone"])
        XCTAssertEqual(HiveSearch.queryWords("a the of and"), [])
        // "us" and "open" are headline words on this date and are not stop words.
        XCTAssertEqual(HiveSearch.queryWords("us open"), ["us", "open"])
    }

    func testAnOutletIsItsHostWithoutTheTopLevelDomain() {
        XCTAssertEqual(HiveSearch.outletWords("bbc.com"), ["bbc"])
        XCTAssertEqual(HiveSearch.outletWords("en.wikipedia.org"), ["en", "wikipedia"])
        XCTAssertEqual(HiveSearch.outletWords("www.theguardian.com"), ["theguardian"])
        XCTAssertEqual(HiveSearch.outletWords("The Guardian"), ["the", "guardian"])
        XCTAssertEqual(HiveSearch.outletWords("nasa.gov"), ["nasa"])
    }

    func testTheOutletIsSearchedAndARunTogetherLabelCountsAsAPrefix() {
        // Three encyclopedia rows, exactly, by the outlet alone.
        let wikipedia = HiveSearch.matches(query: "wikipedia", in: filed)
        XCTAssertEqual(Set(ids(wikipedia)), ["crimea", "u2", "bug"])
        XCTAssertEqual(wikipedia.first?.coverage, 1.0)
        // "guardian" inside "theguardian" is worth a prefix, not a whole word.
        let guardian = HiveSearch.matches(query: "guardian", in: filed)
        XCTAssertEqual(Set(ids(guardian)), ["ecuador", "cohen"])
        XCTAssertEqual(guardian.first?.coverage, HiveSearch.prefixWeight)
        // And it narrows a headline query rather than replacing it.
        XCTAssertEqual(ids(HiveSearch.matches(query: "bbc oil", in: filed)).first, "oil")
        guard case let .one(match) = HiveSearch.answer(query: "bbc oil", in: filed) else {
            return XCTFail("bbc oil should be one answer")
        }
        XCTAssertEqual(match.story.id, "oil")
    }

    // MARK: The order

    func testSeveralStoriesComeBackBestFirstAndInTheSameOrderEveryTime() {
        // Three from one outlet, told apart only by support, which is the
        // feed's own first tie break: what people backed comes first.
        var stories = filed
        stories[0] = story("oil", stories[0].headline, "bbc.com", support: 1, minute: 1)
        stories[2] = story("westbank", stories[2].headline, "bbc.com", support: 2, minute: 3)
        let first = HiveSearch.matches(query: "bbc", in: stories)
        XCTAssertEqual(ids(first), ["westbank", "oil", "moldova"])
        let second = HiveSearch.matches(query: "bbc", in: stories)
        XCTAssertEqual(first, second, "the same query twice gives the same order")
        // Fed in a different order, the answer is the same order.
        XCTAssertEqual(ids(HiveSearch.matches(query: "bbc", in: Array(stories.reversed()))), ["westbank", "oil", "moldova"])
        XCTAssertEqual(HiveSearch.answer(query: "bbc", in: stories), .several(first))
    }

    func testAWholeWordOutranksTheFrontOfOneAndMoreOfTheQueryOutranksBoth() {
        // "crimean war" is the whole query for the siege and half of it for
        // the drone war, so the siege is first and alone.
        let war = HiveSearch.matches(query: "crimean war", in: filed)
        XCTAssertEqual(ids(war), ["crimea", "moldova"])
        XCTAssertEqual(war[0].coverage, 1.0)
        XCTAssertEqual(war[1].coverage, 0.5)
        guard case let .one(match) = HiveSearch.answer(query: "crimean war", in: filed) else {
            return XCTFail("crimean war should be one answer")
        }
        XCTAssertEqual(match.story.id, "crimea")
    }

    func testAWordThatSeveralStoriesSayIsTheReadersChoice() {
        // "US" is the oil strikes, the US Open and the terrorist designation,
        // and no score can say which was meant.
        let us = HiveSearch.matches(query: "us", in: filed)
        XCTAssertEqual(Set(ids(us)), ["oil", "gauff", "ecuador"])
        guard case let .several(matches) = HiveSearch.answer(query: "us", in: filed) else {
            return XCTFail("us should be several")
        }
        XCTAssertEqual(matches.count, 3)
        XCTAssertEqual(matches, us)
    }

    func testTheLimitHoldsAndTheBestSurviveIt() {
        // Three stories say "US"; two is the best two of them.
        let two = HiveSearch.matches(query: "us", in: filed, limit: 2)
        XCTAssertEqual(two.count, 2)
        XCTAssertEqual(ids(two), Array(ids(HiveSearch.matches(query: "us", in: filed)).prefix(2)))
        XCTAssertEqual(HiveSearch.matches(query: "us", in: filed, limit: 0), [])
    }

    // MARK: The chips

    func testTheChipsAreTheTopOfTheBoardFilledFromThePool() {
        var stories = filed
        // Two on the hive, the second better backed, and one shown false.
        stories[0] = story("oil", stories[0].headline, "bbc.com", support: 1, status: .placed,
                           rect: WallRect(mx: 2, my: 2, w: 4, h: 3), minute: 1)
        stories[3] = story("gauff", stories[3].headline, "aljazeera.com", support: 3, status: .placed,
                           rect: WallRect(mx: 8, my: 2, w: 4, h: 3), minute: 4)
        stories[7] = story("nasa", stories[7].headline, "nasa.gov", support: 5, status: .shownFalse,
                           rect: WallRect(mx: 2, my: 8, w: 4, h: 3), minute: 8)
        let chips = HiveSearch.chips(from: stories)
        XCTAssertEqual(chips.count, 3)
        XCTAssertEqual(chips[0].id, "gauff", "the best backed tile first")
        XCTAssertEqual(chips[1].id, "oil")
        XCTAssertEqual(chips[2].id, "moldova", "the pool's first in the feed's order fills the third")
        XCTAssertFalse(chips.contains { $0.id == "nasa" }, "a story shown false takes no buzz and is not offered")
    }

    func testAnEmptyDateOffersNoChips() {
        XCTAssertEqual(HiveSearch.chips(from: []), [])
        XCTAssertEqual(HiveSearch.chips(from: filed, limit: 0), [])
    }

    // MARK: The words on the field

    func testNothingTheFieldSaysSaysWallSquareBoostOrRemember() {
        var sentences: [String] = [
            HiveCopy.ask(dateName: "September 9"), HiveCopy.askPlaceholder, HiveCopy.find,
            HiveCopy.orStartFrom, HiveCopy.found, HiveCopy.severalFound, HiveCopy.tooCommon,
            HiveCopy.miss(dateName: "September 9"), HiveCopy.addWithLink, HiveCopy.irreversible,
            HiveCopy.notThisOne, HiveCopy.counted,
        ]
        for voice in [HiveVoice.bee, .plain] {
            sentences.append(HiveCopy.askHint(voice: voice))
            sentences.append(HiveCopy.confirm(voice: voice))
            sentences.append(HiveCopy.takesNone(voice: voice))
            sentences.append(HiveCopy.alreadyBacked(voice: voice))
        }
        for sentence in sentences {
            let lower = sentence.lowercased()
            for banned in ["wall", "square", "boost", "remember"] {
                XCTAssertFalse(lower.contains(banned), "\"\(sentence)\" says \(banned)")
            }
        }
        XCTAssertEqual(HiveCopy.confirm(voice: .bee), "Spend one buzz on this?")
        XCTAssertEqual(HiveCopy.confirm(voice: .plain), "Spend one tap on this?")
        XCTAssertEqual(HiveCopy.alreadyBacked(voice: .plain), "You backed this. One story takes one tap from this account.")
    }
}
