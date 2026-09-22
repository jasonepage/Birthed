import Foundation

/// What the feature layer is allowed to ask for.
///
/// This is a protocol rather than a concrete type so that the network client
/// underneath can change without anything above it moving. `docs/specs/SDS.md` section 3
/// puts the data layer at the swap point on purpose.
/// `Sendable`, because the day page reads four things at once with `async let`
/// and a child task may only capture what it is allowed to carry.
protocol DayPageRepository: Sendable {
    func notablePeople(bornOn date: CalendarDate, limit: Int) async throws -> [NotablePerson]

    /// The number one on a chart the week somebody was born, or nil when
    /// there is no chart week covering that week. Nil is the ordinary answer
    /// for a birth before the chart began, and callers show nothing rather
    /// than a guess.
    func numberOne(on chart: ChartWeek.Chart, theWeekOf birthDate: CalendarDate, birthYear: Int) async throws -> ChartWeek?

    /// People whose name contains what was typed, most looked up first.
    func search(name query: String, limit: Int) async throws -> [NotableMatch]

    /// Who somebody is likely to care about, without asking a model.
    ///
    /// Two signals already in the table do this job. `has_social` is whether
    /// Wikidata carries a TikTok, Instagram or YouTube identifier for them,
    /// which separates somebody who exists on the internet from somebody who
    /// exists only in an encyclopedia. And being born near the reader is
    /// subtraction. For a birth year of 2003 that is over two thousand
    /// candidates, a thousand of them genuinely looked up, ordered by how
    /// often. A model would cost money per request, could name somebody who
    /// does not exist, and would not order them better than the number of
    /// people who actually looked them up.
    ///
    /// A nil year means no year was given, and the answer falls back to the
    /// most looked up people who are on the internet at all.
    func recommended(bornNear year: Int?, limit: Int) async throws -> [NotableMatch]

    /// Public figures whose birthday falls on one of these dates.
    ///
    /// The dates are passed in rather than a number of days, so the calendar
    /// arithmetic stays in the domain where it is tested and this layer only
    /// asks the question.
    func celebrating(on dates: [CalendarDate], limit: Int) async throws -> [NotableMatch]

    /// The researched facts about a calendar date, the ones that belong to
    /// everybody who shares it rather than to one birth year or one place.
    ///
    /// This reads and it never asks. A search costs real money per date, and
    /// the caller is the onboarding wheel, which walks across dates as fast as
    /// a thumb can flick. A reader must not be able to spend a month of
    /// searches by scrolling through a month.
    ///
    /// The likes are not read, because the one caller wants a single line and
    /// not a list to sort. Every fact comes back with no likes and not liked.
    /// Anything that needs the real counts uses `FactsService`.
    func birthFacts(on date: CalendarDate, limit: Int) async throws -> [BirthFact]

    /// What happened on a calendar date, from Wikipedia's date article, every
    /// year it lists. Empty until the events import has run for that date.
    func events(on date: CalendarDate, limit: Int) async throws -> [DayFeed.Event]

    /// The number one on a chart in the week of this date, for every year in
    /// the range, in one request. Years before the chart began, and years
    /// where no issue falls within six days, are simply missing.
    func numberOnes(on chart: ChartWeek.Chart, weekOf date: CalendarDate, fromYear: Int, toYear: Int) async throws -> [ChartWeek]
}

extension DayPageRepository {
    /// The number one song the week somebody was born. The original call,
    /// kept so nothing that reads the Hot 100 has to change.
    func numberOneSong(theWeekOf birthDate: CalendarDate, birthYear: Int) async throws -> ChartWeek? {
        try await numberOne(on: .hot100, theWeekOf: birthDate, birthYear: birthYear)
    }
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
