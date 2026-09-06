import Foundation

/// The words the composer opens with when somebody's birthday comes round.
///
/// This is not a writer. It makes four small decisions and puts two short
/// sentences together from them, and everything it knows comes from what the
/// user already typed: the person's name, the note about them, the age they
/// are turning if the year is known, whether they are somebody followed, and
/// whether they have died. Nothing is looked up, nothing leaves the phone, and
/// nothing is sent until the user sends it.
///
/// The four decisions:
///
/// 1. **What to call them.** "Happy birthday Mum", not "Happy birthday Karen",
///    when the note says Mum. The first name out of a pasted full name. Both
///    words of "Big Dave", "Dr Ahmed" and "Auntie Carol", because the first
///    word alone is not a name.
/// 2. **Which register.** Family, partner, polite, distant, casual or plain,
///    read off the note. The note is only ever classified, never quoted: "the
///    tall one" and "owes me twenty quid" are for the user, and a message that
///    repeated them would be the embarrassing kind.
/// 3. **Whether to say the age.** Only where nobody would mind: children,
///    the ages people celebrate, round numbers, and friends under thirty.
///    Never to a partner, never to anybody addressed by title, never at work.
/// 4. **One closing line**, from three plain ones per register, chosen by the
///    year so it changes annually and stays put within a day.
///
/// A public figure cannot be texted, so their line is written about them
/// rather than to them, and somebody who has died is never wished anything.
///
/// The hundred cases in `BirthdayMessageTests` are the acceptance test for
/// this file. If a change makes one of them read worse, the change is wrong.
struct BirthdayMessage {

    // MARK: Words the note can contain

    /// What people call a parent or grandparent, and text them as. When the
    /// note is exactly one of these, it is also the name to use.
    static let parentTerms: Set<String> = [
        "mum", "mom", "mummy", "mommy", "mam", "ma", "mama", "mother",
        "dad", "father", "daddy", "pa", "papa", "pops",
        "grandma", "granny", "gran", "nan", "nana", "nanna", "nanny", "grandmother",
        "grandpa", "grandad", "granddad", "gramps", "grandfather",
        "nonna", "nonno", "abuela", "abuelo", "oma", "opa",
    ]

    static let familyWords: [String] = [
        "sister", "brother", "sis", "bro", "son", "daughter", "aunt", "auntie",
        "aunty", "uncle", "cousin", "niece", "nephew", "grandson", "granddaughter",
        "godmother", "godfather", "godson", "goddaughter", "stepmum", "stepmom",
        "stepdad", "stepsister", "stepbrother", "twin", "family", "in law", "in-law",
        "mother in law", "father in law", "sister in law", "brother in law",
    ]

    static let partnerWords: Set<String> = [
        "boyfriend", "girlfriend", "bf", "gf", "husband", "wife", "partner",
        "fiance", "fiancé", "fiancee", "fiancée", "hubby", "wifey", "bae", "babe",
        "my love", "love",
    ]

    static let politeWords: [String] = [
        "work", "boss", "manager", "coworker", "co-worker", "co worker", "colleague",
        "client", "customer", "office", "team lead", "supervisor", "intern", "hr",
        "landlord", "landlady", "accountant", "dentist", "doctor", "dr", "teacher",
        "professor", "prof", "tutor", "lecturer", "coach", "neighbour", "neighbor",
        "vet", "hairdresser", "barber", "mechanic", "pastor", "priest", "vicar",
        "church", "mentor", "principal", "headteacher", "nurse", "therapist",
        "physio", "trainer", "instructor", "agent", "recruiter", "contact",
        "linkedin", "networking", "conference",
    ]

    static let distantWords: [String] = [
        "ex", "old", "used to", "back home", "years ago", "lost touch",
        "havent seen", "not seen", "in years", "in ages", "moved away", "primary school",
        "elementary", "from school", "high school", "childhood", "former",
        "acquaintance", "friend of a friend", "met once", "met at",
    ]

    /// Words that come before a name and are not a name on their own.
    static let honorifics: Set<String> = [
        "mr", "mrs", "ms", "miss", "dr", "coach", "aunt", "auntie", "aunty", "uncle",
        "grandma", "grandpa", "nan", "nana", "gran", "mama", "papa", "professor",
        "prof", "sir", "pastor", "father", "mother", "sister", "brother", "captain",
        "mx",
    ]

    static let nicknamePrefixes: Set<String> = ["big", "little", "lil", "wee", "old", "young", "baby", "the"]

    /// Titles that make the whole address formal.
    static let formalTitles: Set<String> = [
        "mr", "mrs", "ms", "miss", "dr", "professor", "prof", "sir", "coach", "pastor", "captain", "mx",
    ]

    /// Titles that make the whole address family.
    static let familyTitles: Set<String> = [
        "aunt", "auntie", "aunty", "uncle", "grandma", "grandpa", "nan", "nana", "gran",
        "granny", "grandad", "granddad", "nonna", "nonno", "mama", "papa",
    ]

    // MARK: Register

    enum Register: Equatable {
        case family, partner, polite, distant, casual, plain
    }

    /// Three plain closings per register. Deliberately close to one another:
    /// the recipient sees one, and what actually differs between registers
    /// is the address, the comma, the age and the "love you", not this line.
    static func closings(for register: Register) -> [String] {
        switch register {
        case .family: return ["Hope you have a lovely day.", "Hope it's a good one.", "Hope you have a good day."]
        case .partner: return ["Love you.", "Love you. Hope today is a good one.", "Love you."]
        case .polite: return ["Hope you have a good day.", "Hope you get to enjoy it.", "Hope it's a good one."]
        case .distant: return ["Hope you're doing well.", "Hope you're well.", "Hope things are good with you."]
        case .casual: return ["Hope it's a good one.", "Hope you have a good day.", "Hope you have a good one."]
        case .plain: return ["Hope it's a good one.", "Hope you have a good day.", "Hope it's a good day."]
        }
    }

    // MARK: The message

    /// The draft for this person, or nil when there is nothing to say, which
    /// is a person with no name.
    ///
    /// `age` is the age they turn today, from `BirthdayCalendar`, or nil when
    /// the year is not known. `dateName` is the calendar date as the app
    /// displays it, used only in the line about somebody who has died.
    /// `seed` picks the closing line; pass the year, so it changes annually.
    static func draft(for person: Person, age: Int?, dateName: String, seed: Int) -> String? {
        if person.isPublicFigure {
            return line(about: person, age: age, dateName: dateName)
        }
        return message(name: person.name, note: person.note, age: age, seed: seed)
    }

    /// A message to somebody the user knows.
    static func message(name: String, note: String?, age: Int?, seed: Int) -> String? {
        let term = addressTerm(name: name, note: note ?? "")
        guard !term.isEmpty else { return nil }
        let tone = register(note: note ?? "", term: term)
        let withAge = saysAge(age, in: tone)

        let opening: String
        if withAge, let age, age <= 12 {
            opening = "Happy \(ordinal(age)) birthday \(term)."
        } else if withAge, let age {
            opening = "Happy \(ordinal(age)) \(term)."
        } else if tone == .polite {
            opening = "Happy birthday, \(term)."
        } else {
            opening = "Happy birthday \(term)."
        }

        return "\(opening) \(pick(closings(for: tone), seed: seed))"
    }

    /// A line about a public figure. Not addressed to them, because the user
    /// cannot send it to them; it is something to send to a friend or post.
    /// Somebody who has died is stated as a fact of record and wished nothing.
    static func line(about person: Person, age: Int?, dateName: String) -> String? {
        let who = person.trimmedName
        guard !who.isEmpty else { return nil }
        if person.isRemembered {
            if let year = person.birthday.year {
                return "\(who) was born on \(dateName), \(year)."
            }
            return "\(who) was born on \(dateName)."
        }
        if let age, age > 0 {
            return "\(who) turns \(age) today."
        }
        return "It's \(who)'s birthday today."
    }

    // MARK: Decision 1, what to call them

    static func addressTerm(name: String, note: String) -> String {
        if let fromNote = parentTerm(in: note) { return capitalise(fromNote) }
        if let fromName = parentTerm(in: name) { return capitalise(fromName) }

        var tokens = name.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        // "Sarah (work)", "Sam - gym": drop anything after a bracket or dash.
        if let cut = tokens.firstIndex(where: { token in
            guard let first = token.first else { return false }
            return "([-\u{2013}:".contains(first)
        }), cut > 0 {
            tokens = Array(tokens[..<cut])
        }
        guard !tokens.isEmpty else { return "" }

        // "Sam and Alex" share a birthday, or at least a card.
        if tokens.count == 3, ["and", "&"].contains(tokens[1].lowercased()) {
            return tokens.joined(separator: " ")
        }

        let first = trimmingPunctuation(tokens[0])
        let firstLower = first.lowercased()
        var picked: String
        if tokens.count >= 2, honorifics.contains(firstLower) || nicknamePrefixes.contains(firstLower) {
            picked = first + " " + trimmingPunctuation(tokens[1])
        } else {
            picked = first
        }

        // SAM JONES and sam both become Sam.
        if isAllCaps(picked) || picked == picked.lowercased() {
            picked = picked.split(separator: " ").map { capitalise($0.lowercased()) }.joined(separator: " ")
        }
        return picked
    }

    /// "Mum", "my mum" and "mum." all name the person the way the user says
    /// it. Anything longer, like "mum's friend", does not.
    static func parentTerm(in text: String) -> String? {
        let stripped = strippingMy(text)
        return parentTerms.contains(stripped) ? stripped : nil
    }

    // MARK: Decision 2, which register

    static func register(note: String, term: String) -> Register {
        let termFirst = term.split(separator: " ").first.map { $0.lowercased() } ?? ""
        let titled = term.contains(" ") && formalTitles.contains(termFirst)
        let familyTitled = term.contains(" ") && familyTitles.contains(termFirst)

        if parentTerms.contains(term.lowercased()) || familyTitled { return .family }
        // "Dr Ahmed" and "Mrs Thompson" are addressed by title, and nobody
        // addressed by title is told their age.
        if titled { return .polite }
        if normalise(note).isEmpty { return .plain }
        // "Sarah's boyfriend", "mum's friend": the word after the possessive
        // is about somebody else, not about the user.
        if isThroughSomebodyElse(note) { return .plain }

        // Partner only when the whole note is the word, so "boyfriend's mate"
        // and the like fall through to casual.
        if partnerWords.contains(strippingMy(note)) { return .partner }
        if familyWords.contains(where: { contains(phrase: $0, in: note) }) { return .family }
        if distantWords.contains(where: { contains(phrase: $0, in: note) }) { return .distant }
        if politeWords.contains(where: { contains(phrase: $0, in: note) }) { return .polite }
        return .casual
    }

    // MARK: Decision 3, whether to say the age

    /// The rule is about who would mind.
    static func saysAge(_ age: Int?, in register: Register) -> Bool {
        guard let age, age > 0 else { return false }
        switch register {
        case .partner, .polite, .distant: return false
        case .family, .casual, .plain: break
        }
        if age <= 12 { return true }
        if [13, 16, 18, 21].contains(age) { return true }
        if age % 10 == 0 { return true }
        if register == .casual || register == .family { return age < 30 }
        return false
    }

    static func ordinal(_ number: Int) -> String {
        let mod100 = number % 100
        if (11...13).contains(mod100) { return "\(number)th" }
        switch number % 10 {
        case 1: return "\(number)st"
        case 2: return "\(number)nd"
        case 3: return "\(number)rd"
        default: return "\(number)th"
        }
    }

    // MARK: Decision 4, the closing line

    static func pick(_ options: [String], seed: Int) -> String {
        let count = options.count
        return options[((seed % count) + count) % count]
    }

    /// The seed for this person's day: the year, offset by something stable
    /// about the person so two people on one day do not get identical lines.
    /// The identifier's bytes rather than its hash, because `Hasher` is
    /// seeded differently every launch and the line must not change between
    /// opening the composer and opening it again.
    static func seed(year: Int, person: Person) -> Int {
        let bytes = person.id.uuid
        let sum = Int(bytes.0) + Int(bytes.1) + Int(bytes.2) + Int(bytes.3)
        return year + sum
    }

    // MARK: Text helpers

    /// Lower case, apostrophes removed so "haven't" and "Sarah's" stay one
    /// word each, other punctuation turned to spaces, spaces collapsed.
    static func normalise(_ text: String) -> String {
        var out = ""
        for character in text.lowercased() {
            if character == "'" || character == "\u{2019}" { continue }
            if ".,!?()[]\"".contains(character) { out.append(" ") } else { out.append(character) }
        }
        return out.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    }

    static func words(_ text: String) -> [String] {
        normalise(text).split(separator: " ").map(String.init)
    }

    static func contains(phrase: String, in text: String) -> Bool {
        let haystack = words(text)
        let needle = phrase.split(separator: " ").map(String.init)
        guard !needle.isEmpty, haystack.count >= needle.count else { return false }
        for start in 0...(haystack.count - needle.count) {
            if Array(haystack[start..<(start + needle.count)]) == needle { return true }
        }
        return false
    }

    static func strippingMy(_ text: String) -> String {
        let parts = words(text)
        if parts.count > 1, parts[0] == "my" { return parts.dropFirst().joined(separator: " ") }
        return parts.joined(separator: " ")
    }

    /// A possessive anywhere in the note: "Sarah's", "mum's", "the twins' ".
    static func isThroughSomebodyElse(_ text: String) -> Bool {
        let characters = Array(text)
        for index in characters.indices {
            let character = characters[index]
            guard character == "'" || character == "\u{2019}" else { continue }
            let next: Character? = index + 1 < characters.count ? characters[index + 1] : nil
            let previous: Character? = index > 0 ? characters[index - 1] : nil
            // "'s" followed by the end or by something that is not a letter.
            if next == "s" {
                if index + 2 >= characters.count { return true }
                let after = characters[index + 2]
                if !(after.isLetter || after.isNumber) { return true }
            }
            // "s'" followed by white space.
            if previous == "s", let next, next.isWhitespace { return true }
        }
        return false
    }

    static func trimmingPunctuation(_ token: String) -> String {
        var out = token
        while let last = out.last, last == "," || last == "." { out.removeLast() }
        return out
    }

    static func capitalise(_ word: String) -> String {
        guard let first = word.first else { return word }
        return String(first).uppercased() + String(word.dropFirst())
    }

    static func isAllCaps(_ text: String) -> Bool {
        text == text.uppercased() && text != text.lowercased()
    }
}
