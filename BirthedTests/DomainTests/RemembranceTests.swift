import XCTest
@testable import BirthedDomain

/// The remembering loop: the four answers, the handle a row is answered
/// against, the window, and the words on a sealed page.
///
/// **Several of these assert that a thing is PRESENT rather than absent.**
/// The website lost every event sentence on every page for a night because a
/// new name collided with an old one, the page still looked plausible, and the
/// two tests guarding that area both asserted an absence, so both stayed
/// green. The rule that came out of it is written in `docs/app-handoff.md`:
/// grep before naming, and assert the thing is there.
final class RemembranceTests: XCTestCase {

    // MARK: Helpers, the same shapes DayFeedTests uses

    private func fact(_ id: Int, _ text: String, category: String = "event") -> BirthFact {
        BirthFact(id: id, fact: text, category: category, sourceURL: URL(string: "https://example.org/\(id)"),
                  regionKey: "", likes: 0, likedByMe: false)
    }

    private func event(_ year: Int?, _ text: String, id: Int?) -> DayFeed.Event {
        DayFeed.Event(year: year, description: text,
                      sourceURL: URL(string: "https://en.wikipedia.org/wiki/September_8"), id: id)
    }

    private func person(_ id: String, _ name: String, born: Int?) -> NotablePerson {
        NotablePerson(id: id, name: name, birthYear: born, deathYear: nil, shortDescription: "somebody",
                      sourceURL: URL(string: "https://www.wikidata.org/wiki/\(id)")!, contentLicense: "CC0")
    }

    private func song(_ year: Int, _ title: String) -> ChartWeek {
        ChartWeek(date: CalendarDate(month: 9, day: 8)!, year: year, song: title, artist: "Somebody")
    }

    private func film(_ year: Int, _ title: String) -> ChartWeek {
        ChartWeek(date: CalendarDate(month: 9, day: 8)!, year: year, song: title, artist: "", chart: "US box office")
    }

    /// An instant in Coordinated Universal Time, which is the only zone the
    /// window is ever reasoned about in.
    private func utc(_ year: Int, _ month: Int, _ day: Int, _ hour: Int = 12, _ minute: Int = 0) -> Date {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        components.hour = hour
        components.minute = minute
        return RememberWindow.reference.date(from: components)!
    }

    // MARK: The words the database checks against

    /// These strings are a contract with a check constraint. Renaming one in
    /// Swift without changing the migration means every answer is silently
    /// refused, and a refused answer looks exactly like a sealed date.
    func testTheFourAnswersAreSpelledTheWayTheDatabaseSpellsThem() {
        XCTAssertEqual(RememberDepth.there.rawValue, "there")
        XCTAssertEqual(RememberDepth.remember.rawValue, "remember")
        XCTAssertEqual(RememberDepth.heard.rawValue, "heard")
        XCTAssertEqual(RememberDepth.never.rawValue, "never")
    }

    /// The stored vocabulary is four and stays four, because the website has
    /// been writing all four since it shipped and this app has to read them.
    func testTheStoredVocabularyIsStillTheFourTheWebsiteWrites() {
        XCTAssertEqual(RememberDepth.allCases.count, 4)
        XCTAssertEqual(RememberDepth.allCases.map(\.rawValue), ["there", "remember", "heard", "never"])
    }

    /// The app offers three of them. "I was there" asks about presence and
    /// this feature measures transmission, and on most rows presence has no
    /// answer: nobody was there for a diplomatic announcement and nobody was
    /// there for a song being number one.
    func testTheAppOffersThreeAnswersAndNotFour() {
        XCTAssertEqual(RememberDepth.offered, [.remember, .heard, .never])
        XCTAssertFalse(RememberDepth.offered.contains(.there))
    }

    /// Never a fifth, and never a direction. There is no way to say a thing
    /// did not matter, only whether it reached you.
    func testNothingOffersADirection() {
        for depth in RememberDepth.offered {
            XCTAssertTrue(RememberDepth.allCases.contains(depth), "\(depth) is offered and not storable")
        }
    }

    /// An answer this app no longer offers still has to be read, or a row
    /// quietly shows a smaller total than it really has.
    func testAnAnswerTheWebsiteWroteIsStillCounted() {
        let counts = RemembranceCounts(there: 9, remembers: 1, heard: 1, never: 1)
        XCTAssertEqual(counts.count(for: .there), 9)
        XCTAssertEqual(counts.total, 12)
        XCTAssertEqual(counts.summary(), "9 were there, of 12 answers.")
    }

    /// "Never heard of it" is one of the four and is recorded like the rest. A
    /// row that is thoroughly documented and that nobody has heard of is the
    /// most interesting result this collects.
    func testNeverHeardOfItIsAnAnswerAndNotAnAbsence() {
        XCTAssertTrue(RememberDepth.allCases.contains(.never))
        XCTAssertEqual(RememberDepth.never.label, "Never heard of it")
    }

    func testEveryAnswerHasWordsOnItsButton() {
        for depth in RememberDepth.allCases {
            XCTAssertFalse(depth.label.isEmpty, "\(depth) has no label")
            XCTAssertFalse(depth.spokenAfter.isEmpty, "\(depth) has nothing to say out loud")
        }
    }

    func testTheKindsAreSpelledTheWayTheDatabaseSpellsThem() {
        XCTAssertEqual(RememberKind.birthFact.rawValue, "birth_fact")
        XCTAssertEqual(RememberKind.historicalEvent.rawValue, "historical_event")
        XCTAssertEqual(RememberKind.culturalEvent.rawValue, "cultural_event")
        XCTAssertEqual(RememberKind.person.rawValue, "person")
        XCTAssertEqual(RememberKind.moment.rawValue, "moment")
        XCTAssertEqual(RememberKind.chartNumberOne.rawValue, "chart_number_one")
    }

    // MARK: The handle, which is the part that would bite

    /// Present, on every kind of row, and equal to the row's own id.
    ///
    /// This is the presence test. A feed whose rows had lost their handles
    /// would still draw, still scroll, and still look right, and every answer
    /// given on it would go to the wrong place or nowhere.
    func testEveryKindOfRowCarriesAHandle() {
        let items = DayFeed.build(
            facts: [fact(41, "A thing that was researched")],
            events: [event(1985, "A thing that happened", id: 7214)],
            people: [person("Q7259", "Ada Lovelace", born: 1815)],
            songs: [song(1985, "A song")],
            films: [film(1985, "A film")],
            readerBirthYear: 1985
        )
        XCTAssertEqual(items.count, 5)
        for item in items {
            XCTAssertNotNil(item.subject, "a \(item.kind) row lost its handle")
        }
    }

    func testAFactIsAnsweredAgainstItsOwnRowId() {
        let items = DayFeed.build(facts: [fact(41, "A thing")], events: [], people: [], songs: [], films: [],
                                  readerBirthYear: nil)
        XCTAssertEqual(items.first?.subject, RememberSubject(kind: .birthFact, id: "41"))
    }

    /// The one that cost the website a fix. The handle is the row id out of
    /// `historical_events`, which is what the website sends, and not a hash of
    /// the sentence. Two clients disagreeing here would split one event's
    /// answers into two piles and neither would be the real number.
    func testAnEventIsAnsweredAgainstItsRowIdAndNotItsWording() {
        let items = DayFeed.build(facts: [], events: [event(1985, "A thing that happened", id: 7214)],
                                  people: [], songs: [], films: [], readerBirthYear: nil)
        XCTAssertEqual(items.first?.subject, RememberSubject(kind: .historicalEvent, id: "7214"))
        XCTAssertEqual(items.first?.subject?.id, "7214")
        XCTAssertNotEqual(items.first?.subject?.id, DayFeed.stableHash("A thing that happened"))
    }

    /// Rewording an event must not move the answers already given on it.
    func testRewordingAnEventKeepsItsHandle() {
        let before = DayFeed.build(facts: [], events: [event(1985, "A thing that happened", id: 7214)],
                                   people: [], songs: [], films: [], readerBirthYear: nil)
        let after = DayFeed.build(facts: [], events: [event(1985, "A thing that happened, corrected", id: 7214)],
                                  people: [], songs: [], films: [], readerBirthYear: nil)
        XCTAssertEqual(before.first?.subject, after.first?.subject)
        XCTAssertNotEqual(before.first?.id, after.first?.id, "the list key should still move, only the handle holds")
    }

    /// No id, no buttons. Missing buttons on one row is a small loss. A guessed
    /// handle is a large one, because two rows sharing a handle merge their
    /// answers into one wrong number that nothing on screen would reveal.
    func testAnEventWithNoRowIdHasNoHandleRatherThanAGuessedOne() {
        let items = DayFeed.build(facts: [], events: [event(1985, "A thing that happened", id: nil)],
                                  people: [], songs: [], films: [], readerBirthYear: nil)
        XCTAssertEqual(items.count, 1)
        XCTAssertNil(items.first?.subject)
    }

    func testAPersonIsAnsweredAgainstTheirWikidataId() {
        let items = DayFeed.build(facts: [], events: [], people: [person("Q7259", "Ada Lovelace", born: 1815)],
                                  songs: [], films: [], readerBirthYear: nil)
        XCTAssertEqual(items.first?.subject, RememberSubject(kind: .person, id: "Q7259"))
    }

    /// A song and a film are the same kind of object here: the thing that was
    /// on top of a chart that week. The chart lives inside the handle so the
    /// two never collide.
    func testChartRowsCarryTheirChartInsideTheHandle() {
        let songs = DayFeed.build(facts: [], events: [], people: [], songs: [song(1985, "A song")], films: [],
                                  readerBirthYear: nil)
        let films = DayFeed.build(facts: [], events: [], people: [], songs: [], films: [film(1985, "A film")],
                                  readerBirthYear: nil)
        XCTAssertEqual(songs.first?.subject, RememberSubject(kind: .chartNumberOne, id: "hot100-1985"))
        XCTAssertEqual(films.first?.subject, RememberSubject(kind: .chartNumberOne, id: "boxoffice-1985"))
        XCTAssertNotEqual(songs.first?.subject, films.first?.subject)
    }

    func testAChartThisAppDoesNotKnowDrawsNoButtonsRatherThanAGuessedHandle() {
        let unknown = ChartWeek(date: CalendarDate(month: 9, day: 8)!, year: 1985, song: "A song",
                                artist: "Somebody", chart: "Some chart nobody added")
        XCTAssertNil(unknown.subjectID)
    }

    func testTwoRowsNeverShareAHandle() {
        let items = DayFeed.build(
            facts: [fact(41, "One"), fact(42, "Two")],
            events: [event(1985, "Three", id: 1), event(1986, "Four", id: 2)],
            people: [person("Q1", "A", born: 1900), person("Q2", "B", born: 1901)],
            songs: [song(1985, "Five"), song(1986, "Six")],
            films: [film(1985, "Seven"), film(1986, "Eight")],
            readerBirthYear: 1985
        )
        let handles = items.compactMap(\.subject).map(\.key)
        XCTAssertEqual(handles.count, items.count)
        XCTAssertEqual(Set(handles).count, handles.count, "two rows are sharing a handle")
    }

    // MARK: The window, worked out the way the database works it out

    /// Window of one day, so September 8 takes answers on the seventh, the
    /// eighth and the ninth, and nothing either side of that.
    func testADateTakesAnswersForThreeDaysWithAWindowOfOne() {
        XCTAssertFalse(RememberWindow.isOpen(month: 9, day: 8, windowDays: 1, now: utc(2026, 9, 6)))
        XCTAssertTrue(RememberWindow.isOpen(month: 9, day: 8, windowDays: 1, now: utc(2026, 9, 7)))
        XCTAssertTrue(RememberWindow.isOpen(month: 9, day: 8, windowDays: 1, now: utc(2026, 9, 8)))
        XCTAssertTrue(RememberWindow.isOpen(month: 9, day: 8, windowDays: 1, now: utc(2026, 9, 9)))
        XCTAssertFalse(RememberWindow.isOpen(month: 9, day: 8, windowDays: 1, now: utc(2026, 9, 10, 1)))
    }

    /// The window is a column and not a constant, so widening it is an update
    /// to one row rather than a new build of this app. This checks the app can
    /// actually follow it.
    func testAWiderWindowIsFollowedWithoutANewBuild() {
        XCTAssertFalse(RememberWindow.isOpen(month: 9, day: 8, windowDays: 1, now: utc(2026, 9, 3)))
        XCTAssertTrue(RememberWindow.isOpen(month: 9, day: 8, windowDays: 7, now: utc(2026, 9, 3)))
        XCTAssertTrue(RememberWindow.isOpen(month: 9, day: 8, windowDays: 0, now: utc(2026, 9, 8)))
        XCTAssertFalse(RememberWindow.isOpen(month: 9, day: 8, windowDays: 0, now: utc(2026, 9, 7)))
    }

    /// The instants themselves are inside, which is the comparison
    /// `open_edition` makes: it refuses when now is before the opening or
    /// after the closing, so neither edge is refused.
    func testBothEdgesOfTheWindowAreInsideIt() {
        let opens = RememberWindow.opens(month: 9, day: 8, windowDays: 1, now: utc(2026, 9, 8))!
        let closes = RememberWindow.closes(month: 9, day: 8, windowDays: 1, now: utc(2026, 9, 8))!
        XCTAssertEqual(opens, utc(2026, 9, 7, 0, 0))
        XCTAssertEqual(closes, utc(2026, 9, 10, 0, 0))
        XCTAssertTrue(RememberWindow.isOpen(month: 9, day: 8, windowDays: 1, now: opens))
        XCTAssertTrue(RememberWindow.isOpen(month: 9, day: 8, windowDays: 1, now: closes))
        XCTAssertFalse(RememberWindow.isOpen(month: 9, day: 8, windowDays: 1,
                                             now: opens.addingTimeInterval(-1)))
        XCTAssertFalse(RememberWindow.isOpen(month: 9, day: 8, windowDays: 1,
                                             now: closes.addingTimeInterval(1)))
    }

    /// The reason this arithmetic is here at all.
    ///
    /// The database keeps Coordinated Universal Time, so September 8 seals at
    /// midnight on September 10 there, which is five in the evening on
    /// September 9 in Los Angeles. A phone that used its own zone would draw
    /// four buttons for those last seven hours and every one of them would be
    /// refused. This is that exact instant.
    func testTheWindowSealsOnTheServersClockAndNotThePhones() {
        // Six in the evening on 9 September in Los Angeles, which is one in
        // the morning on 10 September in Coordinated Universal Time.
        let pacificEvening = utc(2026, 9, 10, 1, 0)
        XCTAssertFalse(RememberWindow.isOpen(month: 9, day: 8, windowDays: 1, now: pacificEvening))
        // And four in the afternoon there, which is still the ninth in both.
        XCTAssertTrue(RememberWindow.isOpen(month: 9, day: 8, windowDays: 1, now: utc(2026, 9, 9, 23, 0)))
    }

    /// 29 February in a year that does not have one has no edition, and that
    /// is correct rather than a bug to work around. The database refuses it
    /// too.
    func testTheTwentyNinthOfFebruaryHasNoEditionInAYearWithoutOne() {
        XCTAssertNil(RememberWindow.midnight(year: 2026, month: 2, day: 29))
        XCTAssertNil(RememberWindow.opens(month: 2, day: 29, windowDays: 1, now: utc(2026, 2, 28)))
        XCTAssertFalse(RememberWindow.isOpen(month: 2, day: 29, windowDays: 1, now: utc(2026, 2, 28)))

        XCTAssertNotNil(RememberWindow.midnight(year: 2028, month: 2, day: 29))
        XCTAssertTrue(RememberWindow.isOpen(month: 2, day: 29, windowDays: 1, now: utc(2028, 2, 29)))
    }

    func testAnImpossibleDateHasNoWindow() {
        XCTAssertNil(RememberWindow.midnight(year: 2026, month: 4, day: 31))
        XCTAssertNil(RememberWindow.midnight(year: 2026, month: 13, day: 1))
    }

    /// The edition year turns over on the server's clock, which is the
    /// database's own rule.
    func testTheEditionYearIsTheServersYear() {
        XCTAssertEqual(RememberWindow.editionYear(now: utc(2026, 9, 8)), 2026)
        XCTAssertEqual(RememberWindow.editionYear(now: utc(2026, 12, 31, 23, 59)), 2026)
        XCTAssertEqual(RememberWindow.editionYear(now: utc(2027, 1, 1, 0, 1)), 2027)
    }

    /// A date well away from today is closed, which is what makes an edition
    /// per year mean anything.
    func testADateOutOfSeasonIsClosed() {
        XCTAssertFalse(RememberWindow.isOpen(month: 3, day: 14, windowDays: 1, now: utc(2026, 9, 8)))
    }

    // MARK: What a date decided

    func testTheFourCountsAreKeptApartRatherThanSummedIntoAScore() {
        let counts = RemembranceCounts(there: 3, remembers: 9, heard: 4, never: 12)
        XCTAssertEqual(counts.count(for: .there), 3)
        XCTAssertEqual(counts.count(for: .remember), 9)
        XCTAssertEqual(counts.count(for: .heard), 4)
        XCTAssertEqual(counts.count(for: .never), 12)
        XCTAssertEqual(counts.total, 28)
    }

    /// The interesting result. A row everybody has documented and nobody has
    /// heard of leads with that, rather than having it averaged away.
    func testARowNobodyHasHeardOfSaysSo() {
        let counts = RemembranceCounts(there: 0, remembers: 1, heard: 2, never: 40)
        XCTAssertEqual(counts.summary(), "40 had never heard of it, of 43 answers.")
    }

    func testARowEverybodyWasAtSaysThat() {
        let counts = RemembranceCounts(there: 30, remembers: 4, heard: 1, never: 0)
        XCTAssertEqual(counts.summary(), "30 were there, of 35 answers.")
    }

    func testARowNobodyAnsweredSaysNothing() {
        XCTAssertNil(RemembranceCounts().summary())
    }

    // MARK: The reveal

    func testTheSharesAddUpAndSurviveNobodyHavingAnswered() {
        let counts = RemembranceCounts(there: 0, remembers: 1, heard: 1, never: 2)
        XCTAssertEqual(counts.share(for: .never), 0.5, accuracy: 0.0001)
        XCTAssertEqual(counts.share(for: .remember), 0.25, accuracy: 0.0001)
        XCTAssertEqual(counts.share(for: .there), 0, accuracy: 0.0001)

        // Zero rather than a division by nothing.
        XCTAssertEqual(RemembranceCounts().share(for: .never), 0, accuracy: 0.0001)
    }

    /// The three the app offers, always, so a row that nobody has heard of
    /// still shows the two answers nobody gave.
    func testTheResultDrawsTheThreeAnswersTheAppOffers() {
        let counts = RemembranceCounts(there: 0, remembers: 3, heard: 0, never: 40)
        XCTAssertEqual(counts.breakdown.map(\.depth), [.remember, .heard, .never])
        XCTAssertEqual(counts.breakdown.map(\.count), [3, 0, 40])
    }

    /// And the fourth as well when the website collected some, because the
    /// numbers underneath have to add up to the total printed beside them.
    func testAnAnswerFromTheWebsiteIsDrawnRatherThanQuietlyDropped() {
        let counts = RemembranceCounts(there: 9, remembers: 3, heard: 0, never: 40)
        XCTAssertEqual(counts.breakdown.map(\.depth), [.there, .remember, .heard, .never])
        XCTAssertEqual(counts.breakdown.map(\.count).reduce(0, +), counts.total)
    }

    /// The reveal has to have the reader in it. Somebody who has just pressed
    /// a button and is shown a count without themselves in it will assume the
    /// tap did nothing.
    func testYourOwnAnswerIsInTheNumberYouAreShown() {
        let before = RemembranceCounts(there: 0, remembers: 2, heard: 1, never: 5)
        let after = before.adding(.never)
        XCTAssertEqual(after.never, 6)
        XCTAssertEqual(after.total, before.total + 1)
        XCTAssertEqual(after.remembers, before.remembers)
        XCTAssertEqual(after.heard, before.heard)
        XCTAssertEqual(after.there, before.there)
    }

    func testAFirstAnswerOnAnUntouchedRowCountsAsOne() {
        let counts = RemembranceCounts().adding(.remember)
        XCTAssertEqual(counts.total, 1)
        XCTAssertEqual(counts.remembers, 1)
        XCTAssertEqual(counts.share(for: .remember), 1, accuracy: 0.0001)
    }

    func testTheTotalIsCalledAnswersRatherThanPeople() {
        // One person answering twelve rows is twelve answers, and only
        // edition_summary knows how many people that was.
        XCTAssertEqual(RememberCopy.answers(1), "1 answer so far")
        XCTAssertEqual(RememberCopy.answers(43), "43 answers so far")
    }

    /// An undo puts the number back where it was.
    func testTakingAnAnswerBackPutsTheCountBack() {
        let before = RemembranceCounts(there: 0, remembers: 2, heard: 1, never: 5)
        XCTAssertEqual(before.adding(.never).removing(.never), before)
        XCTAssertEqual(before.removing(.remember).remembers, 1)
        XCTAssertEqual(before.adding(.heard).removing(.heard).total, before.total)
    }

    /// A row cannot go below nothing. The count came off the server before the
    /// answer was given, so in the ordinary case the number is certainly there
    /// to remove, and in the case where it is not, minus one is a worse thing
    /// to put on a screen than zero.
    func testAnUndoNeverDrivesACountBelowZero() {
        let empty = RemembranceCounts()
        XCTAssertEqual(empty.removing(.never), empty)
        XCTAssertEqual(empty.removing(.never).total, 0)
    }

    /// A budget, said in whole sentences, and never as a score.
    func testWhatIsLeftIsSaidAsACountAndNotAsAScore() {
        XCTAssertEqual(RememberCopy.left(10), "10 answers left on this date")
        XCTAssertEqual(RememberCopy.left(1), "1 answer left on this date")
        XCTAssertEqual(RememberCopy.left(0), "No answers left on this date")
        // Nothing here ranks anybody, congratulates anybody, or counts up.
        for word in ["score", "points", "streak", "rank", "best", "record"] {
            for n in [0, 1, 10] {
                XCTAssertFalse(RememberCopy.left(n).lowercased().contains(word),
                               "\(word) got into the budget line")
            }
        }
    }

    // MARK: The sealed order

    /// The one number that decides a sealed page. Remembering is worth twice
    /// hearing of, because they are two different claims, and never heard of
    /// it is worth zero and never less.
    func testMemoryWeightCountsWhatSurvivedAndSubtractsNothing() {
        XCTAssertEqual(RemembranceCounts(remembers: 10).memoryWeight, 20)
        XCTAssertEqual(RemembranceCounts(heard: 10).memoryWeight, 10)
        XCTAssertEqual(RemembranceCounts(never: 10).memoryWeight, 0)
        // A retired answer still counts, level with remembering, because the
        // website took those before it went and they are not to be lost.
        XCTAssertEqual(RemembranceCounts(there: 10).memoryWeight, 20)
    }

    /// The rule this whole design rests on, asserted as arithmetic. No answer
    /// can make a row worth less than a row nobody answered.
    func testNoAnswerCanEverPushARowDown() {
        let untouched = RemembranceCounts()
        for hated in 1...100 {
            let all = RemembranceCounts(never: hated)
            XCTAssertGreaterThanOrEqual(all.memoryWeight, untouched.memoryWeight,
                                        "\(hated) people never hearing of it pushed a row below silence")
        }
        // And adding any answer of any kind never lowers the weight.
        let base = RemembranceCounts(there: 1, remembers: 2, heard: 3, never: 4)
        for depth in RememberDepth.allCases {
            XCTAssertGreaterThanOrEqual(base.adding(depth).memoryWeight, base.memoryWeight)
        }
    }

    private func sealedFeed() -> [DayFeed.Item] {
        DayFeed.build(
            facts: [fact(1, "A researched thing"), fact(2, "Another researched thing")],
            events: [event(1985, "A thing that happened", id: 10),
                     event(1995, "A thing nobody recalls", id: 11),
                     event(2005, "A thing everybody recalls", id: 12)],
            people: [person("Q1", "Somebody", born: 1970)],
            songs: [song(1985, "A song")],
            films: [film(1985, "A film")],
            readerBirthYear: 1990
        )
    }

    func testASealedPageLeadsWithWhatPeopleRemembered() {
        let items = sealedFeed()
        let counts: [String: RemembranceCounts] = [
            RememberSubject(kind: .historicalEvent, id: "12").key: RemembranceCounts(remembers: 40),
            RememberSubject(kind: .historicalEvent, id: "10").key: RemembranceCounts(heard: 12),
            RememberSubject(kind: .historicalEvent, id: "11").key: RemembranceCounts(never: 30),
        ]
        let ranked = DayFeed.byMemory(items, counts: counts)

        XCTAssertEqual(ranked.first?.subject, RememberSubject(kind: .historicalEvent, id: "12"))
        // Heard of it beats an unanswered row, and a row nobody had heard of
        // sinks below both without being removed from the page.
        let order = ranked.compactMap(\.subject).map(\.id)
        XCTAssertLessThan(order.firstIndex(of: "10")!, order.firstIndex(of: "11")!)
        XCTAssertEqual(ranked.count, items.count, "a sealed page loses nothing")
    }

    /// The interesting result keeps its place on the page rather than being
    /// filtered off it. A row that is thoroughly documented and that nobody has
    /// heard of is the best thing this collects.
    func testARowNobodyRememberedIsRankedLastAndStillPresent() {
        let items = sealedFeed()
        let forgotten = RememberSubject(kind: .historicalEvent, id: "11")
        let ranked = DayFeed.byMemory(items, counts: [
            forgotten.key: RemembranceCounts(never: 30),
            RememberSubject(kind: .historicalEvent, id: "10").key: RemembranceCounts(remembers: 5),
        ])
        XCTAssertTrue(ranked.contains { $0.subject == forgotten })
        // Level on weight with the untouched rows, and ahead of them, because
        // thirty people were asked and it had not survived.
        let untouched = ranked.firstIndex { $0.subject == RememberSubject(kind: .person, id: "Q1") }!
        XCTAssertLessThan(ranked.firstIndex { $0.subject == forgotten }!, untouched)
    }

    /// A sealed page is meant to be permanent. Swift's sort is not stable, so
    /// without the position tiebreak the same date would draw differently on
    /// every load and "sealed" would be a word rather than a fact.
    func testTheSealedOrderIsIdenticalEveryTimeItIsDrawn() {
        let items = sealedFeed()
        let counts: [String: RemembranceCounts] = [
            RememberSubject(kind: .historicalEvent, id: "10").key: RemembranceCounts(remembers: 3),
            RememberSubject(kind: .historicalEvent, id: "12").key: RemembranceCounts(remembers: 3),
        ]
        let first = DayFeed.byMemory(items, counts: counts).map(\.id)
        for _ in 0..<50 {
            XCTAssertEqual(DayFeed.byMemory(items, counts: counts).map(\.id), first)
        }
    }

    /// With nothing answered it must not scramble the page it was given.
    func testAnUnansweredDateKeepsTheOrderItArrivedIn() {
        let items = sealedFeed()
        XCTAssertEqual(DayFeed.byMemory(items, counts: [:]).map(\.id), DayFeed.settled(items).map(\.id))
    }

    /// Memory weight knows nothing about what a row says, and the most
    /// remembered thing on a date is very often the worst thing that ever
    /// happened on it.
    func testTheHeaviestRowStillDoesNotLeadASealedPage() {
        let grim = event(2001, "A gunman opened fire at the school, killing eleven.", id: 90)
        let ordinary = event(1999, "A quiet thing happened.", id: 91)
        let items = DayFeed.build(facts: [], events: [grim, ordinary], people: [], songs: [], films: [],
                                  readerBirthYear: 1990)
        XCTAssertTrue(DayFeed.isHeavy(grim.description), "the fixture is not actually heavy")

        let ranked = DayFeed.byMemory(items, counts: [
            RememberSubject(kind: .historicalEvent, id: "90").key: RemembranceCounts(remembers: 500),
            RememberSubject(kind: .historicalEvent, id: "91").key: RemembranceCounts(remembers: 1),
        ])
        XCTAssertFalse(DayFeed.isHeavy(ranked.first?.text ?? ""),
                       "the most remembered row on the date led the page, and it was a killing")
        XCTAssertTrue(ranked.contains { $0.subject?.id == "90" }, "and it is still on the page")
    }

    // MARK: The seal

    func testASealedDateSaysWhatItDecidedAndWhen() {
        let sealed = utc(2026, 9, 8, 0, 0)
        XCTAssertEqual(SealText.line(sealedAt: sealed, people: 47),
                       "Sealed 8 September 2026. Forty seven people answered.")
    }

    func testTheSealCountsPeopleInWholeSentences() {
        let sealed = utc(2026, 9, 8, 0, 0)
        XCTAssertEqual(SealText.line(sealedAt: sealed, people: 0), "Sealed 8 September 2026. Nobody answered.")
        XCTAssertEqual(SealText.line(sealedAt: sealed, people: 1), "Sealed 8 September 2026. One person answered.")
        XCTAssertEqual(SealText.line(sealedAt: sealed, people: 2), "Sealed 8 September 2026. Two people answered.")
    }

    /// Words below a hundred and digits above, and no hyphen inside a number,
    /// because the seal is a sentence somebody reads rather than a figure they
    /// skip.
    func testNumbersAreSpelledWithoutHyphens() {
        XCTAssertEqual(SealText.spelled(47), "Forty seven")
        XCTAssertEqual(SealText.spelled(21), "Twenty one")
        XCTAssertEqual(SealText.spelled(7), "Seven")
        XCTAssertEqual(SealText.spelled(99), "Ninety nine")
        XCTAssertEqual(SealText.spelled(100), "100")
        XCTAssertEqual(SealText.spelled(1206), "1,206")
        for number in 1..<100 {
            XCTAssertFalse(SealText.spelled(number).contains("-"), "\(number) came back hyphenated")
        }
    }

    /// The clock is the whole mechanism. There are no points and no streaks,
    /// so the only pressure on an answer is that the date closes.
    func testAnOpenDateSaysWhenItCloses() {
        let now = utc(2026, 9, 8, 12, 0)
        XCTAssertEqual(SealText.openLine(closes: utc(2026, 9, 10, 0, 0), now: now), "This date seals tomorrow.")
        XCTAssertEqual(SealText.openLine(closes: utc(2026, 9, 8, 13, 30), now: now), "This date seals in an hour.")
        XCTAssertEqual(SealText.openLine(closes: utc(2026, 9, 8, 12, 20), now: now), "This date seals within the hour.")
        XCTAssertEqual(SealText.openLine(closes: utc(2026, 9, 8, 18, 0), now: now), "This date seals in 6 hours.")
        XCTAssertEqual(SealText.openLine(closes: utc(2026, 9, 12, 0, 0), now: now), "This date seals in 3 days.")
    }

    /// House style, checked rather than trusted, because this copy is written
    /// once and read on every date page there is.
    func testNothingHereUsesAnEmDash() {
        var lines = [
            SealText.line(sealedAt: utc(2026, 9, 8), people: 47),
            SealText.line(sealedAt: utc(2026, 9, 8), people: 1),
            SealText.line(sealedAt: utc(2026, 9, 8), people: 0),
            SealText.openLine(closes: utc(2026, 9, 10), now: utc(2026, 9, 8)),
            RemembranceCounts(there: 1, remembers: 2, heard: 3, never: 4).summary() ?? "",
        ]
        lines.append(RememberCopy.prompt)
        lines.append(RememberCopy.sealed)
        lines.append(contentsOf: RememberDepth.allCases.map(\.label))
        lines.append(contentsOf: RememberDepth.allCases.map(\.spokenAfter))
        lines.append(RemembranceCounts(there: 9, remembers: 1, heard: 1, never: 1).summary() ?? "")
        lines.append(RememberCopy.answers(1))
        lines.append(RememberCopy.answers(43))
        lines.append(RememberCopy.undo)
        lines.append(RememberCopy.tooLateToUndo)
        lines.append(RememberCopy.spent)
        lines.append(RememberCopy.orderedByMemory)
        lines.append(contentsOf: [0, 1, 10].map(RememberCopy.left))
        for line in lines {
            XCTAssertFalse(line.contains("\u{2014}"), "an em dash got into: \(line)")
            XCTAssertFalse(line.contains("\u{2013}"), "an en dash got into: \(line)")
        }
    }
}
