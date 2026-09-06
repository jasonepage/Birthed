import Foundation

/// A birthday carried in a link, and nothing else carried with it.
///
/// The whole point is where the data sits in the address. Everything after the
/// hash is the fragment, and a browser never sends a fragment to the server, so
///
///     https://birthed.app/add#n=Sam&m=3&d=14&y=2003
///
/// can be opened, read and turned into a person without birthed.app ever
/// learning that Sam exists. The privacy page says the people list stays on the
/// phone. This is how that stays literally true for a feature whose entire job
/// is moving a birthday between two phones.
///
/// One person per link, deliberately. A link that carried your whole list would
/// be handing somebody else's birthday to a third party who was never asked,
/// and `Person` says in its own comment that this app does not turn another
/// person's data into a profile. Pasting a list is different: that text is
/// already in the reader's possession.
///
/// The name is optional, and that is not a convenience. The privacy page says
/// Birthed never asks your name, and it does not, so a link you share about
/// yourself carries a date and nothing else. Whoever adds you writes what they
/// call you, which is what they were going to do anyway: nobody stores a
/// friend under their legal name, they store them under "Sam" or "Mum". A name
/// only travels when somebody typed it about themselves on the web page, which
/// is them volunteering it rather than this app collecting it.
///
/// No identifier, no note, no device information, no timestamp.
enum PersonLink {
    static let host = "birthed.app"
    static let path = "/add"
    /// The scheme the app registers, for the hand off from the web page.
    static let scheme = "birthed"

    /// The website's page for one calendar date, which is the only address
    /// Birthed has that is worth sending somebody who does not have the app.
    ///
    /// It carries no name and never can: the page is about the date. That is
    /// what makes it the right thing to share about somebody you follow. The
    /// share card the receiving app draws for this link comes from the site's
    /// own image for that date, which was rebuilt to say what happened rather
    /// than who was born, so the candle ends up next to an event and not next
    /// to a person.
    static func dayPage(for date: CalendarDate) -> URL? {
        guard let slug = date.slug else { return nil }
        return URL(string: "https://\(host)/\(slug)/")
    }

    /// The date a link points at, or nil when it points at no date.
    ///
    /// The other direction of `dayPage(for:)`. Birthed has been writing these
    /// addresses since public figures became shareable, and the website has
    /// 366 of them indexed, so they arrive from messages, from search results
    /// and from anybody who pasted one. Until now the app could write one and
    /// not read one, and tapping birthed.app/september-4/ opened a web page
    /// beside an installed app that had that date already built.
    ///
    /// This is the whole of build order item 4, "the one tap today entry from
    /// a link": a reader with the app lands on the date rather than on the
    /// web, and a reader without it lands on onboarding with the date already
    /// filled in and one button to press.
    ///
    /// Accepts both spellings for the same reason `incoming(from:)` does. The
    /// web address is what gets shared, and the custom scheme is how the web
    /// page hands off to the app.
    ///
    ///     https://birthed.app/september-4/     birthed://september-4
    ///
    /// It refuses anything it does not recognise rather than reaching for the
    /// nearest date. "/septmber-4" is a typo, not September 4, and answering
    /// a typo with a confident date is how a reader ends up looking at the
    /// wrong day and believing it.
    static func date(from url: URL) -> CalendarDate? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }

        let isWebLink = components.host?.lowercased() == host
        let isAppLink = components.scheme?.lowercased() == scheme
        guard isWebLink || isAppLink else { return nil }

        // A scheme link carries the slug as the host, because birthed://x has
        // no path at all. A web link carries it as the one path segment.
        let candidate: String?
        if isWebLink {
            let parts = components.path.split(separator: "/")
            candidate = parts.count == 1 ? String(parts[0]) : nil
        } else {
            candidate = components.host ?? components.path.split(separator: "/").first.map(String.init)
        }
        guard let slug = candidate?.lowercased(), !slug.isEmpty else { return nil }

        // Split on the last hyphen, not the first: no English month name has
        // one in it today, and a split on the first would still be the line
        // that broke if one ever did.
        guard let hyphen = slug.lastIndex(of: "-") else { return nil }
        let monthWord = String(slug[slug.startIndex..<hyphen])
        guard let day = Int(slug[slug.index(after: hyphen)...]) else { return nil }
        guard let month = CalendarDate.englishMonths
            .firstIndex(where: { $0.lowercased() == monthWord })
            .map({ $0 + 1 })
        else { return nil }

        // CalendarDate takes any day from 1 to 31 in any month, on purpose: a
        // birthday there is two integers and nothing else. An address is not.
        // The website publishes exactly 366 pages, so this reader accepts
        // exactly those 366, and /february-30/ comes back as nothing rather
        // than as a page nobody can have been born on and the site has never
        // built. February gets 29, because February 29 has a page in every
        // year whether or not that year has the day.
        guard day <= Self.daysIn(month: month) else { return nil }
        return CalendarDate(month: month, day: day)
    }

    /// The length of a month for the purpose of reading an address, with
    /// February at its longest. Not a calendar calculation: an address names
    /// one of the 366 calendar dates and carries no year to be leap or not.
    static func daysIn(month: Int) -> Int {
        let lengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        guard month >= 1, month <= lengths.count else { return 0 }
        return lengths[month - 1]
    }

    /// Long enough for any real name and short enough that the link still
    /// looks like a link in a message rather than a wall of characters.
    static let maxNameLength = 60

    /// Everything that is safe unescaped inside one fragment value.
    ///
    /// Not `&`, `=`, `#` or `%`, which are what would break the parse, and not
    /// a space either: a literal space in an address is not a valid address,
    /// and setting one would make the whole link come back nil. Every name
    /// with two words in it goes through here, so that is most of them.
    static let valueSafe: CharacterSet = {
        var set = CharacterSet.alphanumerics
        set.insert(charactersIn: "-._~")
        return set
    }()

    /// One value, ready to sit in a fragment. Shared rather than repeated,
    /// because the space is the part that is easy to get wrong and it only
    /// shows up on names with two words in them, which is most of them.
    static func encode(_ value: String) -> String? {
        value.addingPercentEncoding(withAllowedCharacters: valueSafe)
    }

    // MARK: Writing

    static func url(name: String?, birthday: CalendarBirthday) -> URL? {
        var pairs: [String] = []
        let trimmed = String((name ?? "").trimmingCharacters(in: .whitespacesAndNewlines).prefix(maxNameLength))
        if !trimmed.isEmpty {
            guard let encoded = encode(trimmed) else { return nil }
            pairs.append("n=\(encoded)")
        }
        pairs.append(contentsOf: ["m=\(birthday.date.month)", "d=\(birthday.date.day)"])
        if let year = birthday.year { pairs.append("y=\(year)") }
        // Only ever written for the one birthday it means anything for.
        if birthday.isLeapDay { pairs.append("o=\(birthday.leapObservance.rawValue)") }

        var components = URLComponents()
        components.scheme = "https"
        components.host = host
        components.path = path
        components.percentEncodedFragment = pairs.joined(separator: "&")
        return components.url
    }

    static func url(for person: Person) -> URL? {
        url(name: person.trimmedName, birthday: person.birthday)
    }

    /// Your own birthday, with no name on it.
    static func url(forMyBirthday birthday: CalendarBirthday) -> URL? {
        url(name: nil, birthday: birthday)
    }

    /// What arrived. The name is absent when the sender did not say.
    struct Incoming: Equatable {
        let name: String?
        let birthday: CalendarBirthday
    }

    // MARK: Reading

    /// What a link carries, or nil for anything that is not one of ours.
    ///
    /// Accepts the data in the fragment, which is how the shared link carries
    /// it, and also in the query, because the web page hands off to the app
    /// through a custom scheme and a scheme link has no server to hide the
    /// fragment from. Both are read the same way.
    static func incoming(from url: URL) -> Incoming? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }

        let isWebLink = components.host?.lowercased() == host
            && components.path.lowercased().hasPrefix(path)
        let isAppLink = components.scheme?.lowercased() == scheme
        guard isWebLink || isAppLink else { return nil }

        // percentEncodedFragment rather than fragment: the decoded form would
        // have already turned an escaped ampersand inside a name into a real
        // one, and the split below would then cut the name in half.
        let raw = components.percentEncodedFragment ?? components.percentEncodedQuery
        guard let raw, !raw.isEmpty else { return nil }

        var values: [String: String] = [:]
        for pair in raw.split(separator: "&") {
            let parts = pair.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
            guard parts.count == 2 else { continue }
            let key = String(parts[0])
            // A plus is a space in a form encoded value and literal in a
            // fragment. Names are written with %20, so a plus stays a plus.
            let value = String(parts[1]).removingPercentEncoding ?? String(parts[1])
            values[key] = value
        }

        guard let month = values["m"].flatMap(Int.init),
              let day = values["d"].flatMap(Int.init)
        else { return nil }

        let year = values["y"].flatMap(Int.init)
        let observance = values["o"].flatMap(LeapObservance.init(rawValue:)) ?? .february28

        guard let birthday = CalendarBirthday(
            month: month, day: day, year: year, leapObservance: observance
        ) else { return nil }

        let name = values["n"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        let usable = (name?.isEmpty == false) ? String(name!.prefix(maxNameLength)) : nil
        return Incoming(name: usable, birthday: birthday)
    }
}
