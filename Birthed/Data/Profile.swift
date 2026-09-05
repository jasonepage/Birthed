import Foundation

/// What the app knows about the person using it.
///
/// The birthday is a domain value. The region is a coarse string the user
/// typed, never a coordinate: precise location never reaches the Birthed
/// backend at all. `NFR-030`.
struct Profile: Equatable {
    var birthday: CalendarBirthday
    var regionCode: String?

    var hasRegion: Bool {
        guard let regionCode else { return false }
        return !regionCode.trimmingCharacters(in: .whitespaces).isEmpty
    }
}
