import Foundation

/// A public figure found by looking rather than by browsing to a date.
///
/// `NotablePerson` has no birthday on it, and that is correct: it is only ever
/// read off a day page, where the date is the thing you navigated to. Somebody
/// found by searching has no such context, and their date is the entire reason
/// you would keep them, so it travels with them here.
struct NotableMatch: Identifiable, Equatable {
    let person: NotablePerson
    let birthDate: CalendarDate

    var id: String { person.id }

    /// Ready to keep. The Wikidata identifier is what marks them as somebody
    /// followed rather than known, which is what spares a friend's
    /// notification when the plan is trimmed.
    ///
    /// The year comes along, because it is the difference between a row that
    /// says June 26 and one that says turning 33, and for somebody public it
    /// is a matter of record rather than something you have to remember to
    /// ask.
    ///
    /// The year they died comes with it, and it is the more important of the
    /// two. Without it the app counts down to a dead man's birthday and then
    /// tells you to say something to him. With it, everything about the day
    /// is worded as remembering rather than wishing.
    func asPerson() -> Person {
        Person(
            name: person.name,
            birthday: CalendarBirthday(date: birthDate, year: person.birthYear),
            note: person.shortDescription,
            wikidataID: person.id,
            deathYear: person.deathYear
        )
    }
}
