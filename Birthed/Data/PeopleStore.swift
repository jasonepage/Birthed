import Foundation
import Observation

/// Where other people's birthdays live on the device.
///
/// Local first, like the profile: the interface reads this, and the server is a
/// mirror. A birthday list that stops working on a train is not a birthday
/// list.
///
/// UserDefaults rather than SwiftData, for now. This is a name and two integers
/// per person, and somebody with two hundred people in it is still under fifty
/// kilobytes. If it ever grows beyond that, or needs querying rather than
/// loading whole, this is the file to change and nothing above it moves.
@Observable
final class PeopleStore {
    private enum Key { static let people = "birthed.people.v1" }

    private struct Stored: Codable {
        var id: UUID
        var name: String
        var month: Int
        var day: Int
        var year: Int?
        var leapObservance: String
        var note: String?
        /// Optional on purpose. A list written before this existed decodes
        /// with nil here rather than failing, so nobody loses their people to
        /// a schema change. Everything already on a phone is somebody known.
        var wikidataID: String?
        /// Optional for the same reason. Somebody followed before this existed
        /// decodes as alive, which is the old behaviour rather than a crash,
        /// and is corrected the next time they are followed.
        var deathYear: Int?
    }

    private let defaults: UserDefaults
    private(set) var people: [Person] = []

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.people = Self.load(from: defaults)
    }

    func add(_ person: Person) {
        guard person.isUsable else { return }
        // A public figure is followed once. Two rows for one person would be
        // two notifications on the same morning and two cards on the day.
        if let id = person.wikidataID, people.contains(where: { $0.wikidataID == id }) { return }
        people.append(person)
        persist()
    }

    /// Whether this public figure is already in the list.
    ///
    /// By identifier, and failing that by name and date, because a row saved
    /// by an earlier build may carry no identifier and still be them.
    func follows(_ match: NotableMatch) -> Bool {
        people.contains { person in
            if let id = person.wikidataID { return id == match.person.id }
            return person.trimmedName.caseInsensitiveCompare(match.person.name) == .orderedSame
                && person.birthday.date == match.birthDate
        }
    }

    func update(_ person: Person) {
        guard let index = people.firstIndex(where: { $0.id == person.id }) else { return }
        people[index] = person
        persist()
    }

    func remove(_ person: Person) {
        people.removeAll { $0.id == person.id }
        persist()
    }

    func remove(atOffsets offsets: IndexSet, in ordered: [Person]) {
        let doomed = offsets.compactMap { ordered.indices.contains($0) ? ordered[$0].id : nil }
        people.removeAll { doomed.contains($0.id) }
        persist()
    }

    private func persist() {
        let stored = people.map {
            Stored(
                id: $0.id,
                name: $0.name,
                month: $0.birthday.date.month,
                day: $0.birthday.date.day,
                year: $0.birthday.year,
                leapObservance: $0.birthday.leapObservance.rawValue,
                note: $0.note,
                wikidataID: $0.wikidataID,
                deathYear: $0.deathYear
            )
        }
        if let data = try? JSONEncoder().encode(stored) {
            defaults.set(data, forKey: Key.people)
        }
    }

    private static func load(from defaults: UserDefaults) -> [Person] {
        guard let data = defaults.data(forKey: Key.people),
              let stored = try? JSONDecoder().decode([Stored].self, from: data)
        else { return [] }

        return stored.compactMap { row in
            guard let date = CalendarDate(month: row.month, day: row.day) else { return nil }
            return Person(
                id: row.id,
                name: row.name,
                birthday: CalendarBirthday(
                    date: date,
                    year: row.year,
                    leapObservance: LeapObservance(rawValue: row.leapObservance) ?? .february28
                ),
                note: row.note,
                wikidataID: row.wikidataID,
                deathYear: row.deathYear
            )
        }
    }
}
