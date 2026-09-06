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

    /// Long enough for any real name and short enough that the link still
    /// looks like a link in a message rather than a wall of characters.
    static let maxNameLength = 60

    /// Everything that is safe unescaped inside one fragment value.
    ///
    /// Not `&`, `=`, `#` or `%`, which are what would break the parse, and not
    /// a space either: a literal space in an address is not a valid address,
    /// and setting one would make the whole link come back nil. Every name
    /// with two words in it goes through here, so that is most of them.
    private static let valueSafe: CharacterSet = {
        var set = CharacterSet.alphanumerics
        set.insert(charactersIn: "-._~")
        return set
    }()

    // MARK: Writing

    static func url(name: String?, birthday: CalendarBirthday) -> URL? {
        var pairs: [String] = []
        let trimmed = String((name ?? "").trimmingCharacters(in: .whitespacesAndNewlines).prefix(maxNameLength))
        if !trimmed.isEmpty {
            guard let encoded = trimmed.addingPercentEncoding(withAllowedCharacters: valueSafe) else { return nil }
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
