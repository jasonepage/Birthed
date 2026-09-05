import Foundation

/// What February 29 means in a year that does not have one.
///
/// The stored birthday stays February 29 forever. This setting is consulted
/// every time an occurrence is computed, which is why a user who moves from
/// 2027 into 2028 sees the behaviour change with no data migration.
/// `SDS.md` section 5.2 and `FR-036`, `FR-037`.
enum LeapObservance: String, CaseIterable, Equatable {
    case february28 = "feb_28"
    case march1 = "mar_01"
}
