import Foundation
import Observation

/// Loads everything the database holds about one calendar date.
///
/// Four reads, all of tables or a stable function, none of which can start a
/// search or cost anything per date. They run together and the screen shows
/// what came back; one of them failing loses its kind and not the page.
@Observable
final class DayPageViewModel {
    enum State: Equatable {
        case loading
        case loaded
        case empty
        case failed(String)
    }

    private(set) var date: CalendarDate
    private(set) var state: State = .loading

    private(set) var people: [NotablePerson] = []
    private(set) var events: [DayFeed.Event] = []
    private(set) var songs: [ChartWeek] = []
    private(set) var films: [ChartWeek] = []

    private let repository: DayPageRepository
    private let peopleLimit: Int
    private let eventsLimit: Int

    /// Thirty people rather than six. The old screen was a list of names and
    /// six was the most it could carry before it read like a roster. In a feed
    /// where the kinds take turns, a name every fifth row is texture.
    init(date: CalendarDate, repository: DayPageRepository, peopleLimit: Int = 30, eventsLimit: Int = 150) {
        self.date = date
        self.repository = repository
        self.peopleLimit = peopleLimit
        self.eventsLimit = eventsLimit
    }

    var isToday: Bool { date == CalendarDate.today() }

    /// The feed for this reader, built from what has loaded plus the facts
    /// the caller holds, because likes on facts live in `FactsService` and
    /// change under the screen.
    func feed(facts: [BirthFact], readerBirthYear: Int?) -> [DayFeed.Item] {
        DayFeed.build(facts: facts, events: events, people: people, songs: songs, films: films,
                      readerBirthYear: readerBirthYear)
    }

    /// The first year the charts are asked for. The reader's birth year when
    /// there is one, because the feed is about their years; otherwise the
    /// first year with a Hot 100.
    func load(readerBirthYear: Int?, now: Date = Date()) async {
        state = .loading
        let thisYear = Calendar.current.component(.year, from: now)
        let fromYear = readerBirthYear ?? 1959
        // Copied out before the child tasks are made, because an `async let`
        // may only carry what is Sendable, and `self` is not.
        let date = self.date
        let repository = self.repository
        let peopleLimit = self.peopleLimit
        let eventsLimit = self.eventsLimit

        async let peopleRead: [NotablePerson]? = try? repository.notablePeople(bornOn: date, limit: peopleLimit)
        async let eventsRead: [DayFeed.Event]? = try? repository.events(on: date, limit: eventsLimit)
        async let songsRead: [ChartWeek]? = try? repository.numberOnes(on: .hot100, weekOf: date, fromYear: fromYear, toYear: thisYear)
        async let filmsRead: [ChartWeek]? = try? repository.numberOnes(on: .boxOffice, weekOf: date, fromYear: fromYear, toYear: thisYear)

        let (peopleResult, eventsResult, songsResult, filmsResult) = await (peopleRead, eventsRead, songsRead, filmsRead)

        // A slow answer for one date landing after the reader has moved to
        // the next is dropped, not shown under the wrong heading.
        guard date == self.date else { return }

        people = peopleResult ?? []
        events = eventsResult ?? []
        songs = songsResult ?? []
        films = filmsResult ?? []

        let everythingFailed = peopleResult == nil && eventsResult == nil && songsResult == nil && filmsResult == nil
        if everythingFailed {
            state = .failed(DayPageError.offline.errorDescription ?? "This day did not load.")
        } else if people.isEmpty && events.isEmpty && songs.isEmpty && films.isEmpty {
            state = .empty
        } else {
            state = .loaded
        }
    }

    /// FR-030. Browsing to another date is the same screen with a different
    /// day, which is what makes the calendar day the core object rather than
    /// the user.
    func move(byDays days: Int, readerBirthYear: Int?) async {
        date = date.advanced(byDays: days)
        people = []
        events = []
        songs = []
        films = []
        await load(readerBirthYear: readerBirthYear)
    }
}
