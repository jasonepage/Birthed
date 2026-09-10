import Foundation

/// Where this install keeps what became of its own buzzes.
///
/// Its own type, and shared, for the reason `NotificationService` gives about
/// filtering public figures: a filter every caller has to remember is a filter
/// one caller will forget. `reschedule` clears every pending reminder and
/// rebuilds the whole plan, so a call that did not happen to be handed the
/// hive notes would silently drop every sealed hive reminder the reader had
/// pending, and a reminder that is not registered does not announce itself.
/// It simply never arrives. So neither the notes nor a parameter for them
/// travel through the four call sites: the service reads them here.
///
/// `UserDefaults`, on the precedent of `HiveMarks` and this account's own
/// remembrance answers. JSON rather than a plist dictionary, because a note is
/// a small record with a nested place in it and `Codable` already describes
/// that shape. Anything that will not decode reads as an empty store: a note
/// is a convenience, and a reader who loses one loses a banner and never a
/// buzz, which is in the database either way.
struct HiveNoteStore {
    static let key = "birthed.hive.notes"

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> HiveNotes {
        guard let data = defaults.data(forKey: Self.key),
              let list = try? JSONDecoder().decode([HiveNote].self, from: data)
        else { return HiveNotes() }
        return HiveNotes(notes: list)
    }

    func save(_ notes: HiveNotes) {
        guard let data = try? JSONEncoder().encode(notes.all) else { return }
        defaults.set(data, forKey: Self.key)
    }
}
