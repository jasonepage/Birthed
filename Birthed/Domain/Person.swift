import Foundation

/// Somebody whose birthday you want to be told about.
///
/// The smallest shape that works. A name, a calendar date, an optional year,
/// an optional note. No relationships, no photographs, nothing that turns
/// another person's data into a profile, because they did not choose to give
/// it to us.
struct Person: Identifiable, Equatable, Hashable {
    let id: UUID
    var name: String
    var birthday: CalendarBirthday
    /// What you call them, if the name alone is not enough. "Mum", "work".
    var note: String?
    /// The Wikidata identifier, when this person came out of Birthed's own
    /// list rather than being typed in.
    ///
    /// Its presence is the whole difference between somebody you know and
    /// somebody you follow, and that difference has to exist because of a hard
    /// limit: iOS keeps 64 pending notifications and drops the rest silently.
    /// Following twenty people must never cost somebody a friend's birthday,
    /// so a public figure gets one notification rather than two and is the
    /// first thing dropped when the plan is trimmed.
    var wikidataID: String?

    /// The year they died, for somebody followed who has.
    ///
    /// Birthed counts down to their birthday either way, because people do
    /// mark these and choose to follow them knowing full well. What it must
    /// not do is address them as though they were here: "say something" and
    /// "turns 28" are both wrong, and wrong in a way that is worse than a
    /// missing feature. Everything about this person's day is worded off this
    /// one value.
    var deathYear: Int?

    init(
        id: UUID = UUID(),
        name: String,
        birthday: CalendarBirthday,
        note: String? = nil,
        wikidataID: String? = nil,
        deathYear: Int? = nil
    ) {
        self.id = id
        self.name = name
        self.birthday = birthday
        self.note = note
        self.wikidataID = wikidataID
        self.deathYear = deathYear
    }

    var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    var isUsable: Bool { !trimmedName.isEmpty }

    /// Somebody you follow rather than somebody you know.
    var isPublicFigure: Bool { wikidataID != nil }

    /// Their day is a remembrance rather than a birthday.
    ///
    /// Read by every place that puts words around a date: the row, the
    /// celebrating card and the notification. Somebody typed in by hand can
    /// never be this, because nobody fills in a death year for a friend, so
    /// the flag only ever arrives with a person from Birthed's own list.
    var isRemembered: Bool { deathYear != nil }
}
