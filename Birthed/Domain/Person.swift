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

    init(id: UUID = UUID(), name: String, birthday: CalendarBirthday, note: String? = nil) {
        self.id = id
        self.name = name
        self.birthday = birthday
        self.note = note
    }

    var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    var isUsable: Bool { !trimmedName.isEmpty }
}
