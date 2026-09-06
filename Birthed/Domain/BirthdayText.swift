import Foundation

/// Birthdays read out of whatever somebody pasted in.
///
/// A friend group's birthdays already exist somewhere: a pinned message, a
/// shared note, a screenshot of a shared note that somebody typed back out.
/// They are never in a tidy format and they are never going to be. So this
/// reads lines rather than parsing a schema, finds a date anywhere in the
/// line, and treats whatever is left as the name.
///
/// Nothing here is clever about people. It is deliberately eager to find a
/// date and deliberately unwilling to invent one: every candidate is handed
/// back with the line it came from, because the screen that shows these makes
/// the reader tick each one, and a reader can only check what they can see.
///
/// Pure and dateless except for the two digit year rule, which needs to know
/// roughly when now is, so `now` is a parameter rather than a call to the
/// clock.
enum BirthdayText {
    struct Candidate: Equatable, Identifiable {
        /// The line it was found on, which is stable for one parse of one text.
        let id: Int
        let name: String
        let birthday: CalendarBirthday
        /// Exactly what was on that line, so somebody can check the reading.
        let line: String
    }

    /// More than any real friend group, and a ceiling on a pasted novel.
    static let maxCandidates = 200

    private static let months: [String: Int] = {
        let full = ["january", "february", "march", "april", "may", "june",
                    "july", "august", "september", "october", "november", "december"]
        var map: [String: Int] = [:]
        for (index, name) in full.enumerated() {
            map[name] = index + 1
            map[String(name.prefix(3))] = index + 1
        }
        map["sept"] = 9
        return map
    }()

    /// February is 29 here on purpose. A February 29 birthday is real and the
    /// stored date stays February 29 forever; what to do in other years is
    /// `LeapObservance`, decided at read time, not here.
    private static let daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

    private static let monthNames = months.keys.sorted { $0.count > $1.count }.joined(separator: "|")

    /// Month name first: "March 14", "Mar 14th, 2003".
    private static let monthFirst = try? NSRegularExpression(
        pattern: "\\b(\(monthNames))\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s*(\\d{4})\\b)?",
        options: [.caseInsensitive])

    /// Day first: "14 March", "14th of March 2003".
    private static let dayFirst = try? NSRegularExpression(
        pattern: "\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(\(monthNames))\\.?\\b(?:\\s*,?\\s*(\\d{4})\\b)?",
        options: [.caseInsensitive])

    /// All numbers: "3/14", "3-14-2003", "12.25.99".
    private static let numeric = try? NSRegularExpression(
        pattern: "\\b(\\d{1,2})\\s*[/.\\-]\\s*(\\d{1,2})\\b(?:\\s*[/.\\-]\\s*(\\d{2,4})\\b)?",
        options: [])

    static func candidates(in text: String, now: Date = Date()) -> [Candidate] {
        var found: [Candidate] = []
        var seen: Set<String> = []

        for (index, rawLine) in text.components(separatedBy: .newlines).enumerated() {
            if found.count >= maxCandidates { break }
            let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !line.isEmpty else { continue }
            guard let read = readLine(line, now: now) else { continue }

            // The same person twice in one paste is one person. Different
            // people sharing a date are not, so the date is part of the key.
            let key = "\(read.name.lowercased())|\(read.birthday.date.month)|\(read.birthday.date.day)"
            guard seen.insert(key).inserted else { continue }

            found.append(Candidate(id: index, name: read.name, birthday: read.birthday, line: line))
        }
        return found
    }

    // MARK: One line

    private static func readLine(_ line: String, now: Date) -> (name: String, birthday: CalendarBirthday)? {
        let whole = NSRange(line.startIndex..., in: line)

        // Named months first. They cannot be ambiguous, and a line carrying one
        // should never be read by the number rule instead.
        for (expression, monthIsFirst) in [(monthFirst, true), (dayFirst, false)] {
            guard let expression, let match = expression.firstMatch(in: line, range: whole) else { continue }
            guard let monthText = text(line, match, monthIsFirst ? 1 : 2),
                  let dayText = text(line, match, monthIsFirst ? 2 : 1),
                  let month = months[monthText.lowercased()],
                  let day = Int(dayText)
            else { continue }
            let year = text(line, match, 3).flatMap { Int($0) }
            return assemble(line: line, match: match, month: month, day: day, year: year, now: now)
        }

        guard let numeric, let match = numeric.firstMatch(in: line, range: whole),
              let firstText = text(line, match, 1), let first = Int(firstText),
              let secondText = text(line, match, 2), let second = Int(secondText)
        else { return nil }

        // "14/3" can only be day then month. "3/14" can only be month then day.
        // "5/6" is genuinely ambiguous and this picks month first, which is the
        // American reading, because that is where the audience is. A reader who
        // meant June 5 sees May 6 on the confirm screen and can fix it, which
        // is the entire reason that screen shows the line it read.
        let month: Int
        let day: Int
        if first > 12 && second <= 12 {
            day = first
            month = second
        } else {
            month = first
            day = second
        }

        let year = text(line, match, 3).flatMap { Int($0) }
        return assemble(line: line, match: match, month: month, day: day, year: year, now: now)
    }

    private static func assemble(
        line: String, match: NSTextCheckingResult,
        month: Int, day: Int, year: Int?, now: Date
    ) -> (name: String, birthday: CalendarBirthday)? {
        guard (1...12).contains(month), day >= 1, day <= daysInMonth[month - 1] else { return nil }

        let name = nameAround(line, match: match)
        guard !name.isEmpty else { return nil }

        guard let birthday = CalendarBirthday(month: month, day: day, year: year.map { fullYear($0, now: now) })
        else { return nil }
        return (name, birthday)
    }

    /// Two digits are a century short. Ninety nine is 1999 and oh three is
    /// 2003, and the line between them is this year, because nobody pasting a
    /// birthday list means a date in the future.
    private static func fullYear(_ value: Int, now: Date) -> Int {
        guard value < 100 else { return value }
        let currentTwoDigits = Calendar.current.component(.year, from: now) % 100
        return value <= currentTwoDigits ? 2000 + value : 1900 + value
    }

    /// Whatever the line says other than the date.
    private static func nameAround(_ line: String, match: NSTextCheckingResult) -> String {
        guard let range = Range(match.range, in: line) else { return "" }
        let remainder = line.replacingCharacters(in: range, with: " ")
        // En dash and em dash by escape rather than by character: people paste
        // them, this file does not contain them.
        let junk = CharacterSet(charactersIn: "-\u{2013}\u{2014}:;,.*\u{2022}\u{00B7}|()[]{}<>\"' \t")
        let trimmed = remainder.trimmingCharacters(in: junk)
        // A list marker leaves "1." at the front on a numbered list.
        let withoutMarker = trimmed.replacingOccurrences(
            of: "^\\d+[.)]\\s*", with: "", options: .regularExpression)
        let collapsed = withoutMarker.replacingOccurrences(
            of: "\\s+", with: " ", options: .regularExpression)
        let name = collapsed.trimmingCharacters(in: junk)
        // A leftover that is only digits was part of the date, not a person.
        return name.allSatisfy({ $0.isNumber }) ? "" : name
    }

    private static func text(_ line: String, _ match: NSTextCheckingResult, _ group: Int) -> String? {
        guard group < match.numberOfRanges,
              let range = Range(match.range(at: group), in: line) else { return nil }
        return String(line[range])
    }
}
