import Foundation

/// What the feature layer is allowed to ask for.
///
/// This is a protocol rather than a concrete type so that the network client
/// underneath can change without anything above it moving. `SDS.md` section 3
/// puts the data layer at the swap point on purpose.
protocol DayPageRepository {
    func notablePeople(bornOn date: CalendarDate, limit: Int) async throws -> [NotablePerson]

    /// The number one song the week somebody was born, or nil when there is
    /// no chart covering that week. Nil is the ordinary answer for a birth
    /// before the chart began, and callers show nothing rather than a guess.
    func numberOneSong(theWeekOf birthDate: CalendarDate, birthYear: Int) async throws -> ChartWeek?
}

enum DayPageError: LocalizedError {
    case offline
    case server(Int)
    case malformedResponse

    var errorDescription: String? {
        switch self {
        case .offline:
            return "No connection, so today's page could not load."
        case let .server(code):
            return "The server answered with an error (\(code))."
        case .malformedResponse:
            return "The server sent something this version of the app could not read."
        }
    }
}
