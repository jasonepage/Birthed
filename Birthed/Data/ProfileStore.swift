import Foundation
import Observation

/// Where the profile lives on the device.
///
/// `FR-011` requires the app to complete onboarding and render content with no
/// network at all, so the local copy is the source of truth for the interface
/// and the server copy is a mirror pushed when it can be.
///
/// Deliberately not SwiftData. A profile is five scalars, not a cache, and
/// `docs/specs/SDS.md` section 4 reserves SwiftData for the catalog and the day pages.
@Observable
final class ProfileStore {
    private enum Key {
        static let profile = "birthed.profile.v1"
    }

    /// The shape written to disk. The domain types stay free of Codable so
    /// they never learn the storage format, per the layering rule in
    /// `CLAUDE.md` section 4.
    private struct Stored: Codable {
        var month: Int
        var day: Int
        var year: Int?
        var leapObservance: String
        var regionCode: String?
    }

    private let defaults: UserDefaults
    private(set) var profile: Profile?

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.profile = Self.load(from: defaults)
    }

    var hasCompletedOnboarding: Bool { profile != nil }

    func save(_ profile: Profile) {
        self.profile = profile
        let stored = Stored(
            month: profile.birthday.date.month,
            day: profile.birthday.date.day,
            year: profile.birthday.year,
            leapObservance: profile.birthday.leapObservance.rawValue,
            regionCode: profile.regionCode
        )
        if let data = try? JSONEncoder().encode(stored) {
            defaults.set(data, forKey: Key.profile)
        }
    }

    func clear() {
        profile = nil
        defaults.removeObject(forKey: Key.profile)
    }

    private static func load(from defaults: UserDefaults) -> Profile? {
        guard let data = defaults.data(forKey: Key.profile),
              let stored = try? JSONDecoder().decode(Stored.self, from: data),
              let date = CalendarDate(month: stored.month, day: stored.day)
        else { return nil }

        let observance = LeapObservance(rawValue: stored.leapObservance) ?? .february28
        return Profile(
            birthday: CalendarBirthday(date: date, year: stored.year, leapObservance: observance),
            regionCode: stored.regionCode
        )
    }
}
