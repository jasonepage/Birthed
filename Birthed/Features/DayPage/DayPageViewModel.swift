import Foundation
import Observation

@Observable
final class DayPageViewModel {
    enum State {
        case loading
        case loaded([NotablePerson])
        case empty
        case failed(String)
    }

    private(set) var date: CalendarDate
    private(set) var state: State = .loading

    private let repository: DayPageRepository
    private let limit: Int

    init(date: CalendarDate, repository: DayPageRepository, limit: Int = 50) {
        self.date = date
        self.repository = repository
        self.limit = limit
    }

    var people: [NotablePerson] {
        if case let .loaded(people) = state { return people }
        return []
    }

    var isToday: Bool { date == CalendarDate.today() }

    func load() async {
        state = .loading
        do {
            let people = try await repository.notablePeople(bornOn: date, limit: limit)
            // A list that resolves to nothing gets an explanation, never a
            // blank screen. NFR-021.
            state = people.isEmpty ? .empty : .loaded(people)
        } catch {
            let message = (error as? LocalizedError)?.errorDescription
                ?? "Something went wrong loading this day."
            state = .failed(message)
        }
    }

    /// FR-030. Browsing to another date is the same screen with a different
    /// day, which is what makes the calendar day the core object rather than
    /// the user.
    func move(byDays days: Int) async {
        date = date.advanced(byDays: days)
        await load()
    }
}
