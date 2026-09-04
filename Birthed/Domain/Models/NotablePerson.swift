import Foundation

/// Someone born on a calendar date.
///
/// A plain value. No `Codable` conformance to the database shape and no
/// persistence attributes, so the domain never learns what the server's column
/// names happen to be this week. The data layer maps into this at the boundary.
struct NotablePerson: Identifiable, Equatable {
    /// The Wikidata identifier, for example Q42.
    let id: String
    let name: String
    let birthYear: Int?
    let deathYear: Int?
    let shortDescription: String?
    let sourceURL: URL
    let contentLicense: String

    /// "1961 to 2004", or "born 1991", or an empty string when the year is
    /// unknown. Never a guess.
    var lifespan: String {
        switch (birthYear, deathYear) {
        case let (born?, died?): return "\(born) to \(died)"
        case let (born?, nil): return "born \(born)"
        default: return ""
        }
    }
}
