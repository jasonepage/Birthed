import Foundation

/// Asking somebody for their birthday, rather than waiting for them to send it.
///
/// `PersonLink` moves a birthday that somebody already decided to share. This
/// is the other direction, and it is the one people actually need: you know
/// three friends' birthdays and you want the other twenty, and none of them
/// are going to open a web page and send you a link back unprompted. Here they
/// fill in a form, press send, and it turns up in your app.
///
/// The cost of that is a server. A birthday sent this way sits in a queue
/// under a code until the phone that asked collects it, which makes it the one
/// place in Birthed where somebody's data passes through us on the way to
/// somebody else. That is written on the privacy page in those words, the
/// queue holds nothing but a name and a date, and the row is deleted the
/// moment it is collected. The link route is still offered underneath, so
/// nobody is forced through the server to answer a question.
///
/// The code goes in the fragment, like everything else here, which keeps it
/// out of the website's access logs. It has to reach the database eventually,
/// but it reaches it as a request the sender made, not as a page view we
/// recorded.
enum BirthdayRequest {
    /// Eight characters out of thirty one is about eight hundred billion
    /// codes. The point is not secrecy in the cryptographic sense: the worst
    /// a guessed code buys is the ability to send a stranger a birthday they
    /// will be asked to confirm. It is long enough that nobody stumbles into
    /// one.
    static let codeLength = 8

    /// No O, I, L, or the digits they get read as. Somebody is going to read
    /// one of these out loud or copy it off a screenshot, and the pairs that
    /// look alike are the entire reason that fails.
    private static let alphabet = Array("ABCDEFGHJKMNPQRSTUVWXYZ23456789")

    /// What the sender may put on the link about themselves, in the same
    /// spirit as everywhere else: they type it, we never ask for it, and it
    /// is only ever used to say who is asking.
    static let maxAskerLength = 40

    static func newCode() -> String {
        String((0..<codeLength).map { _ in alphabet.randomElement()! })
    }

    /// Matches what the web page will accept. Kept next to the generator so
    /// the two cannot drift apart without somebody noticing.
    static func isWellFormed(_ code: String) -> Bool {
        guard (6...12).contains(code.count) else { return false }
        return code.allSatisfy { character in
            character.isASCII && (("A"..."Z").contains(character) || ("2"..."9").contains(character))
        }
    }

    /// The link to send. `from` is optional and unstored: it only decides
    /// whether the page says "Nathan wants your birthday" or "Somebody wants
    /// your birthday", and the second one is a fine thing for it to say.
    static func url(code: String, from name: String? = nil) -> URL? {
        guard isWellFormed(code) else { return nil }
        var pairs = ["c=\(code)"]
        let trimmed = String((name ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .prefix(maxAskerLength))
        if !trimmed.isEmpty {
            guard let encoded = PersonLink.encode(trimmed) else { return nil }
            pairs.append("r=\(encoded)")
        }

        var components = URLComponents()
        components.scheme = "https"
        components.host = PersonLink.host
        components.path = PersonLink.path
        components.percentEncodedFragment = pairs.joined(separator: "&")
        return components.url
    }
}
