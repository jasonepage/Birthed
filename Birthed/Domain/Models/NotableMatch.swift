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
    func asPerson() -> Person {
        Person(
            name: person.name,
            birthday: CalendarBirthday(date: birthDate),
            note: person.shortDescription,
            wikidataID: person.id
        )
    }
}
