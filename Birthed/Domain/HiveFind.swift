import Foundation

/// "Find it for me": what the typed field does when it misses, docs/the-wall.md
/// section 15, built out. A reader typed "Charlie Kirk" on September 10 and
/// the field said nothing filed for the date says that, and offered to add a
/// story with a link. That is a dead end unless they happen to have a web
/// address in hand, and it meant the hive could only ever contain what six
/// news feeds and one encyclopedia importer happened to catch.
///
/// **What this is.** On a miss, one more button. On an explicit tap of it,
/// and never while typing, the words and the date go to the `hive-find` Edge
/// Function, which searches the web and answers with two or three real pages:
/// the page's own title, its outlet, its address and a quotation the page
/// actually contains. The reader picks one and it is filed through the same
/// submit path a pasted link takes, so the story gets a real receipt from a
/// real fetched page and the wording on the hive is the page's own.
///
/// **What the model never does.** It never writes a headline and never writes
/// the quotation that is stored. It finds addresses. The title shown here is
/// read off the page by the function, the quotation it reports is checked
/// against the fetched page by exact match before it is shown, and the
/// headline and quotation that reach the database come from the submit path
/// reading the page itself, the way they do for every story. CLAUDE.md
/// section 6 calls the quotation rule the most important control in the
/// system, and nothing here touches it.
///
/// **What leaves the phone.** `Request.body`, and nothing else: the phrase and
/// the date. No account detail, no birthday, no location, no name. It leaves
/// only on the tap, the service never sends it on a keystroke, and the
/// function stores nothing it was sent. `HiveFindTests` pins the body's keys
/// so a field cannot be added to it without a test saying so.
///
/// **What is spent.** Nothing on the reader's side until they pick. A search
/// costs money at Google; the function refuses when the month's search
/// budget is spent, and that comes back as `.paused` rather than as an
/// error, because the date has done nothing wrong.
///
/// Pure Swift, Foundation only. The rules about what is offered, what is sent
/// and what the server's rows become live here and are tested. The view
/// draws and the service carries.
enum HiveFind {

    /// One page the search found, as the function read it.
    struct Candidate: Equatable, Identifiable {
        /// The page's own title, from its Open Graph title or its title
        /// element. Never a sentence the model wrote.
        let title: String
        /// The host with no www, the way every story names its outlet.
        let outlet: String
        let url: URL
        /// A quotation the function found on the fetched page, exactly. It is
        /// shown so the reader can tell the pages apart and it is not what
        /// is stored: the submit path reads the page again and takes its own.
        let quotation: String

        var id: String { url.absoluteString }
    }

    /// What the function said back.
    enum Outcome: Equatable {
        /// Two or three pages, best first as the search returned them.
        case found([Candidate])
        /// The search ran and nothing it found held up.
        case nothing
        /// The month's search budget is spent. Not a failure of the date.
        case paused
        /// The function did not answer, or answered in a shape this does not
        /// read. Shown as a plain sentence; nothing is retried on its own.
        case failed
    }

    // MARK: The rules

    /// The most of a phrase that leaves the phone. A search query is a few
    /// words, and a long paste is not a search.
    static let phraseLimit = 120

    /// The fewest characters worth sending. One letter is not a thing that
    /// happened.
    static let phraseMinimum = 2

    /// How many candidates are offered. Two or three; more is the ballot the
    /// field exists to replace.
    static let shown = 3

    /// The button is offered on a miss and only on a miss. A blank query
    /// never asked anything, a found story needs no search, and nothing
    /// leaves the phone from a state that did not say it would.
    static func offers(_ answer: HiveSearch.Answer) -> Bool {
        answer == .miss
    }

    // MARK: What is sent

    /// What is sent, and it is all that is sent.
    struct Request: Equatable {
        let phrase: String
        let wallDate: WallDate

        /// The whole body. Two keys. A test asserts there is no third.
        var body: [String: String] {
            ["phrase": phrase, "wall_date": wallDate.key]
        }
    }

    /// The phrase as it will be sent: whitespace folded to single spaces,
    /// ends trimmed, cut at `phraseLimit`. Nothing else is changed, so what
    /// the reader typed is what is searched.
    static func phrase(_ text: String) -> String {
        let folded = text
            .split(whereSeparator: { $0.isWhitespace || $0.isNewline })
            .joined(separator: " ")
        return String(folded.prefix(phraseLimit))
    }

    /// The request for a query, or nil when there is nothing worth sending:
    /// a blank, a phrase under the minimum, or a query of stop words alone,
    /// which `HiveSearch` already refuses to search on locally and which a
    /// web search would answer with anything at all.
    static func request(query: String, wallDate: WallDate) -> Request? {
        let text = phrase(query)
        guard text.count >= phraseMinimum else { return nil }
        guard !HiveSearch.queryWords(text).isEmpty else { return nil }
        return Request(phrase: text, wallDate: wallDate)
    }

    // MARK: What comes back

    /// The function's answer into an outcome. Any status this does not know,
    /// and any body with no status, is a failure rather than a guess.
    static func outcome(status: String?, rows: [[String: Any]]?) -> Outcome {
        switch status {
        case "found":
            let list = candidates(from: rows ?? [])
            return list.isEmpty ? .nothing : .found(list)
        case "nothing": return .nothing
        case "paused": return .paused
        default: return .failed
        }
    }

    /// The server's rows into candidates: at most `limit`, in the order
    /// given, each with a web address, a title and a quotation, and no two
    /// for the same page.
    ///
    /// A row missing any of the three is dropped rather than shown with a
    /// blank, because a candidate with no quotation is a page the function
    /// did not check and this must never offer one of those.
    static func candidates(from rows: [[String: Any]], limit: Int = HiveFind.shown) -> [Candidate] {
        var out: [Candidate] = []
        var seen: Set<String> = []
        for row in rows {
            guard let address = row["url"] as? String,
                  let url = URL(string: address.trimmingCharacters(in: .whitespacesAndNewlines)),
                  let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https",
                  url.host != nil
            else { continue }
            let title = fold(row["title"] as? String ?? "")
            let quotation = fold(row["quote"] as? String ?? "")
            guard !title.isEmpty, !quotation.isEmpty else { continue }
            let key = addressKey(url)
            guard !seen.contains(key) else { continue }
            seen.insert(key)
            let outlet = fold(row["outlet"] as? String ?? "").lowercased()
            out.append(Candidate(title: title, outlet: outlet.isEmpty ? outletOf(url) : outlet,
                                 url: url, quotation: quotation))
            if out.count >= limit { break }
        }
        return out
    }

    /// A candidate that is already a story on the date is that story, and
    /// the reader is shown it for confirmation rather than asked to file it
    /// twice. Same page by the address key, which is the rule the server
    /// applies to refuse a second copy.
    static func filed(_ candidate: Candidate, in stories: [WallStory]) -> WallStory? {
        let key = addressKey(candidate.url)
        return stories.first { addressKey($0.url) == key }
    }

    // MARK: Addresses

    /// Parameters that only say where a click came from. The same list as
    /// `TRACKING` in worker/src/wall/url.ts.
    static let trackingParameters: Set<String> = [
        "fbclid", "gclid", "msclkid", "igshid", "mc_cid", "mc_eid",
        "ref", "ref_src", "cmpid", "si", "spm",
    ]

    /// Hosts on which `s` is a share tracking parameter and nothing else.
    static let hostsWhereSIsTracking: Set<String> = ["x.com", "twitter.com"]

    /// The host with no www, which is what a story calls its outlet.
    static func outletOf(_ url: URL) -> String {
        let host = (url.host ?? "").lowercased()
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }

    /// Two spellings of one page to one key. A port of `normalizeUrl` in
    /// worker/src/wall/url.ts, which is also `wall_url_key` in the database:
    /// lowercase the host, drop a leading www, force https, drop the
    /// fragment, remove every parameter starting utm_ and the tracking
    /// parameters, remove s only on x.com and twitter.com, sort what is
    /// left, strip one trailing slash. A parameter that changes which page
    /// you see stays.
    static func addressKey(_ url: URL) -> String {
        let host = outletOf(url)
        var kept: [(String, String)] = []
        if let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems {
            for item in items {
                let name = item.name.lowercased()
                if name.hasPrefix("utm_") { continue }
                if trackingParameters.contains(name) { continue }
                if name == "s" && hostsWhereSIsTracking.contains(host) { continue }
                kept.append((item.name, item.value ?? ""))
            }
        }
        kept.sort { a, b in
            if a.0 != b.0 { return a.0 < b.0 }
            return a.1 < b.1
        }
        var query = URLComponents()
        query.queryItems = kept.map { URLQueryItem(name: $0.0, value: $0.1) }
        let queryText = kept.isEmpty ? "" : (query.percentEncodedQuery ?? "")
        let port = url.port.map { $0 == 80 || $0 == 443 ? "" : ":\($0)" } ?? ""
        var path = url.path
        if path.count > 1 && path.hasSuffix("/") { path.removeLast() }
        if path == "/" { path = "" }
        return "https://\(host)\(port)\(path)" + (queryText.isEmpty ? "" : "?\(queryText)")
    }

    /// Runs of whitespace folded to one space, ends trimmed.
    static func fold(_ text: String) -> String {
        text.split(whereSeparator: { $0.isWhitespace || $0.isNewline }).joined(separator: " ")
    }
}
