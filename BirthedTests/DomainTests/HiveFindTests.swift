import XCTest
@testable import BirthedDomain

/// "Find it for me", docs/the-wall.md section 15 past the miss: when the
/// button is offered, exactly what it sends, what the server's rows become,
/// and what the reader is told.
///
/// The privacy tests are the point of this file. The sentence the privacy
/// page makes depends on the body having two keys and on the button being
/// offered only on a miss, and both are pinned here so neither can drift
/// without a test saying so.
///
/// Not run. Neither the container this was written in nor the shell on the
/// Mac has a Swift toolchain, so every assertion here is unexecuted until
/// somebody runs `swift test`.
final class HiveFindTests: XCTestCase {

    private let wallDate = WallDate(year: 2026, month: 9, day: 10)!

    private func at(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        guard let date = f.date(from: iso) else { fatalError("bad instant \(iso)") }
        return date
    }

    private func story(_ id: String, _ headline: String, _ address: String, outlet: String = "example.org") -> WallStory {
        WallStory(id: id, wallDate: wallDate, submittedAt: at("2026-09-10T12:00:00Z"),
                  headline: headline, url: URL(string: address)!, outlet: outlet,
                  status: .pool, tier: .claimed, support: 0, placedAt: nil, rect: nil,
                  falseAt: nil, falseNote: nil, sources: [])
    }

    private func row(title: String? = "A page", outlet: String? = "example.org",
                     url: String? = "https://example.org/story", quote: String? = "Something happened.") -> [String: Any] {
        var out: [String: Any] = [:]
        if let title { out["title"] = title }
        if let outlet { out["outlet"] = outlet }
        if let url { out["url"] = url }
        if let quote { out["quote"] = quote }
        return out
    }

    // MARK: When it is offered

    func testTheButtonIsOfferedOnAMissAndOnNothingElse() {
        let match = HiveSearch.Match(story: story("s", "Oil hits $100", "https://bbc.com/oil"), coverage: 1, exact: 1)
        XCTAssertTrue(HiveFind.offers(.miss))
        XCTAssertFalse(HiveFind.offers(.blank), "a blank never asked anything, so nothing may leave the phone from it")
        XCTAssertFalse(HiveFind.offers(.one(match)))
        XCTAssertFalse(HiveFind.offers(.several([match, match])))
    }

    // MARK: What leaves the phone

    func testTheBodyIsTheWordsAndTheDateAndNothingElse() {
        let request = HiveFind.request(query: "Charlie Kirk", wallDate: wallDate)
        XCTAssertNotNil(request)
        XCTAssertEqual(request?.body, ["phrase": "Charlie Kirk", "wall_date": "2026-09-10"])
        // The keys, by name, so a third one cannot be added quietly. The
        // privacy page's sentence rests on this assertion.
        XCTAssertEqual(Set(request?.body.keys.map { $0 } ?? []), ["phrase", "wall_date"])
    }

    func testThePhraseIsFoldedTrimmedAndCappedAndNotOtherwiseChanged() {
        XCTAssertEqual(HiveFind.phrase("  Charlie   Kirk \n shot "), "Charlie Kirk shot")
        // Case and punctuation are the reader's and stay theirs.
        XCTAssertEqual(HiveFind.phrase("NASA's Chandra, X-Ray!"), "NASA's Chandra, X-Ray!")
        let long = String(repeating: "abcdefghij", count: 20)
        XCTAssertEqual(HiveFind.phrase(long).count, HiveFind.phraseLimit)
        XCTAssertEqual(HiveFind.request(query: long, wallDate: wallDate)?.phrase.count, HiveFind.phraseLimit)
    }

    func testNothingWorthSendingIsNotSent() {
        for query in ["", "   ", "a", "the", "a the of and", "the thing"] {
            XCTAssertNil(HiveFind.request(query: query, wallDate: wallDate), "\"\(query)\" should not be sent")
        }
        XCTAssertNotNil(HiveFind.request(query: "the oil thing", wallDate: wallDate), "one real word is a search")
    }

    // MARK: What comes back

    func testTheServersRowsBecomeCandidatesInOrder() {
        let rows = [
            row(title: "First", url: "https://a.example/1", quote: "one"),
            row(title: "Second", url: "https://b.example/2", quote: "two"),
        ]
        let found = HiveFind.candidates(from: rows)
        XCTAssertEqual(found.map(\.title), ["First", "Second"])
        XCTAssertEqual(found.map(\.outlet), ["example.org", "example.org"])
        XCTAssertEqual(found.first?.url, URL(string: "https://a.example/1"))
        XCTAssertEqual(found.first?.quotation, "one")
    }

    func testARowMissingATitleAnAddressOrAQuotationIsDroppedNotShownThin() {
        XCTAssertEqual(HiveFind.candidates(from: [row(title: nil)]), [])
        XCTAssertEqual(HiveFind.candidates(from: [row(title: "  ")]), [])
        XCTAssertEqual(HiveFind.candidates(from: [row(url: nil)]), [])
        XCTAssertEqual(HiveFind.candidates(from: [row(url: "not an address")]), [])
        XCTAssertEqual(HiveFind.candidates(from: [row(url: "ftp://example.org/x")]), [])
        XCTAssertEqual(HiveFind.candidates(from: [row(quote: nil)]), [])
        XCTAssertEqual(HiveFind.candidates(from: [row(quote: "")]), [])
        // And a good row beside a bad one survives it.
        XCTAssertEqual(HiveFind.candidates(from: [row(url: nil), row(title: "Kept")]).map(\.title), ["Kept"])
    }

    func testTheSamePageTwiceIsOneCandidateAndAtMostThreeAreShown() {
        let rows = [
            row(title: "One", url: "https://example.org/story?utm_source=x", quote: "q"),
            row(title: "One again", url: "https://www.example.org/story/", quote: "q"),
            row(title: "Two", url: "https://example.org/2", quote: "q"),
            row(title: "Three", url: "https://example.org/3", quote: "q"),
            row(title: "Four", url: "https://example.org/4", quote: "q"),
        ]
        XCTAssertEqual(HiveFind.candidates(from: rows).map(\.title), ["One", "Two", "Three"])
        XCTAssertEqual(HiveFind.candidates(from: rows, limit: 1).map(\.title), ["One"])
    }

    func testTheOutletFallsBackToTheHostWithoutWww() {
        let found = HiveFind.candidates(from: [row(outlet: nil, url: "https://www.BBC.com/news/1")])
        XCTAssertEqual(found.first?.outlet, "bbc.com")
    }

    func testTheOutcomeIsTheStatusAndAnUnknownStatusIsAFailureNotAGuess() {
        XCTAssertEqual(HiveFind.outcome(status: "found", rows: [row()]).candidatesCount, 1)
        XCTAssertEqual(HiveFind.outcome(status: "found", rows: []), .nothing, "found with nothing in it is nothing")
        XCTAssertEqual(HiveFind.outcome(status: "found", rows: nil), .nothing)
        XCTAssertEqual(HiveFind.outcome(status: "nothing", rows: nil), .nothing)
        XCTAssertEqual(HiveFind.outcome(status: "paused", rows: nil), .paused)
        XCTAssertEqual(HiveFind.outcome(status: nil, rows: nil), .failed)
        XCTAssertEqual(HiveFind.outcome(status: "started", rows: nil), .failed)
    }

    // MARK: Already on the date

    func testAPageAlreadyFiledIsThatStoryByTheAddressKey() {
        let filed = [
            story("oil", "Oil hits $100", "https://www.bbc.com/news/oil?utm_campaign=rss"),
            story("gauff", "Gauff wins", "https://aljazeera.com/sports/gauff/"),
        ]
        let same = HiveFind.Candidate(title: "Oil", outlet: "bbc.com",
                                      url: URL(string: "https://bbc.com/news/oil")!, quotation: "q")
        XCTAssertEqual(HiveFind.filed(same, in: filed)?.id, "oil")
        let other = HiveFind.Candidate(title: "Gauff", outlet: "aljazeera.com",
                                       url: URL(string: "https://aljazeera.com/sports/gauff?page=2")!, quotation: "q")
        XCTAssertNil(HiveFind.filed(other, in: filed), "a parameter that changes the page is a different page")
    }

    func testTheAddressKeyIsTheWorkersRule() {
        func key(_ s: String) -> String { HiveFind.addressKey(URL(string: s)!) }
        XCTAssertEqual(key("http://WWW.Example.org/a/"), "https://example.org/a")
        XCTAssertEqual(key("https://example.org/"), "https://example.org")
        XCTAssertEqual(key("https://example.org/a?utm_source=x&fbclid=y#top"), "https://example.org/a")
        XCTAssertEqual(key("https://example.org/a?b=2&a=1"), "https://example.org/a?a=1&b=2")
        XCTAssertEqual(key("https://x.com/u/status/1?s=20"), "https://x.com/u/status/1")
        XCTAssertEqual(key("https://example.org/a?s=20"), "https://example.org/a?s=20", "s is only tracking on x.com")
        XCTAssertEqual(key("https://youtube.com/watch?v=abc"), "https://youtube.com/watch?v=abc")
        XCTAssertEqual(key("https://example.org:8443/a"), "https://example.org:8443/a")
        XCTAssertEqual(key("https://example.org:443/a"), "https://example.org/a")
    }

    // MARK: The words

    func testNothingTheFindSaysSaysWallSquareBoostOrRemember() {
        var sentences: [String] = [
            HiveCopy.findForMe, HiveCopy.findWillSearch(dateName: "September 10"), HiveCopy.finding,
            HiveCopy.findNothing(dateName: "September 10"), HiveCopy.findPaused, HiveCopy.findFailed,
            HiveCopy.findFiling,
        ]
        for voice in [HiveVoice.bee, .plain] {
            sentences.append(HiveCopy.findFound(voice: voice))
            sentences.append(HiveCopy.findPickHint(voice: voice))
        }
        for sentence in sentences {
            let lower = sentence.lowercased()
            for banned in ["wall", "square", "boost", "remember"] {
                XCTAssertFalse(lower.contains(banned), "\"\(sentence)\" says \(banned)")
            }
            XCTAssertFalse(sentence.contains("\u{2014}"), "\"\(sentence)\" has an em dash")
        }
        // The one sentence that says text is about to leave the phone says
        // what leaves and that nothing is kept. The privacy page relies on it.
        let warning = HiveCopy.findWillSearch(dateName: "September 10")
        XCTAssertTrue(warning.contains("sends the words you typed"))
        XCTAssertTrue(warning.contains("September 10"))
        XCTAssertTrue(warning.contains("nothing else"))
        XCTAssertTrue(warning.contains("Nothing you type is kept"))
        XCTAssertEqual(HiveCopy.findFound(voice: .bee),
                       "Found. Pick one and it is filed for the date in the page's own words. No buzz is spent until you say so.")
        XCTAssertEqual(HiveCopy.findPickHint(voice: .plain),
                       "Files this page for the date. The headline comes from the page. No tap is spent.")
        XCTAssertEqual(HiveCopy.refusal("the search did not answer"), HiveCopy.findFailed)
    }
}

private extension HiveFind.Outcome {
    var candidatesCount: Int? {
        if case let .found(list) = self { return list.count }
        return nil
    }
}
