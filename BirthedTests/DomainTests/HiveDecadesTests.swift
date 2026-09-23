import XCTest
@testable import BirthedDomain

/// Decade teams, docs/the-wall.md section 30. The sentences here were printed
/// by web/test/decades.test.ts, so the app and the site say the same thing.
///
/// Not run as of September 23, 2026: no Swift toolchain in that session.
/// Jason builds.
final class HiveDecadesTests: XCTestCase {

    private func at(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        guard let date = f.date(from: iso) else { fatalError("bad instant \(iso)") }
        return date
    }

    private func story(_ id: String, _ headline: String, kind: String? = "person", support: Int = 0, status: WallStoryStatus = .placed, date: WallDate = WallDate(year: 2026, month: 9, day: 23)!) -> WallStory {
        WallStory(id: id, wallDate: date,
                  submittedAt: at("2026-09-22T04:00:00Z"), headline: headline,
                  url: URL(string: "https://example.org/\(id)")!, outlet: "example.org",
                  status: status, tier: .claimed, support: support, placedAt: nil,
                  rect: WallRect(mx: 0, my: 0, w: 4, h: 3),
                  falseAt: nil, falseNote: nil, sources: [],
                  priority: 1, subjectKind: kind, subjectID: kind == nil ? nil : id)
    }

    private func day(_ stories: [WallStory]) -> WallDay {
        WallDay(wallDate: WallDate(year: 2026, month: 9, day: 23)!,
                opensAt: at("2026-09-22T04:00:00Z"), liveAt: at("2026-09-23T04:00:00Z"),
                closesAt: at("2026-09-25T04:00:00Z"), closedAt: nil, stories: stories)
    }

    func testEveryKindOfTileCarriesAYearAndTheNewsIsThisYear() {
        XCTAssertEqual(HiveDecades.year(of: story("a", "Bruce Springsteen, American rock singer (born 1949), born 1949")), 1949)
        XCTAssertEqual(HiveDecades.decade(of: story("a", "Typhoid Mary, infected houseworker in New York City, born 1869")), 1860)
        XCTAssertEqual(HiveDecades.decade(of: story("a", "1956: The dike around the Dutch polder East Flevoland is closed.", kind: "historical_event")), 1950)
        XCTAssertEqual(HiveDecades.decade(of: story("a", "1992: \"End of the Road\" by Boyz II Men was the number one song", kind: "song")), 1990)
        XCTAssertEqual(HiveDecades.decade(of: story("a", "On September 21, 1784, the Pennsylvania Packet began publishing as the first successful daily newspaper in the United States.", kind: "birth_fact")), 1780)
        XCTAssertEqual(HiveDecades.decade(of: story("a", "Major news outlets banned by Trump will have their day in court", kind: nil)), 2020)
        XCTAssertNil(HiveDecades.decade(of: story("a", "Somebody with no year at all")))
    }

    func testZeroOneAndThreeBuzzesAndATie() {
        let mary = story("a", "Typhoid Mary, infected houseworker in New York City, born 1869")
        let bruce = story("b", "Bruce Springsteen, American rock singer (born 1949), born 1949")
        let news = story("c", "Major news outlets banned by Trump will have their day in court", kind: nil)
        XCTAssertEqual(HiveDecades.line(for: day([mary, bruce, news]), dateName: "September 23", voice: .bee, sealed: false), "")
        XCTAssertEqual(HiveDecades.standing(for: day([mary, bruce, news])), .empty)
        let one = day([mary, story("b", bruce.headline, support: 1), news])
        XCTAssertEqual(HiveDecades.line(for: one, dateName: "September 23", voice: .bee, sealed: false), "The 1940s (Boomers) lead September 23 with the only buzz so far.")
        let three = day([story("a", mary.headline, support: 1), story("b", bruce.headline, support: 2), news])
        XCTAssertEqual(HiveDecades.line(for: three, dateName: "September 23", voice: .bee, sealed: false), "The 1940s (Boomers) lead September 23 with 2 of 3 buzzes.")
        XCTAssertEqual(HiveDecades.standing(for: three).teams, [HiveDecades.Team(decade: 1940, buzzes: 2, generation: "Boomers"), HiveDecades.Team(decade: 1860, buzzes: 1)])
        let tie = day([story("a", mary.headline, support: 1), story("b", bruce.headline, support: 1), news])
        XCTAssertEqual(HiveDecades.line(for: tie, dateName: "September 23", voice: .bee, sealed: false), "The 1860s and 1940s (Boomers) are level on September 23, 1 buzz each.")
        XCTAssertEqual(HiveDecades.standing(for: tie).leaders, [1860, 1940])
        XCTAssertEqual(HiveDecades.line(for: tie, dateName: "September 23", voice: .plain, sealed: true), "The 1860s and 1940s (Boomers) were level on September 23, 1 tap each.")
    }

    func testTheLiveBoardsAsTheyStood() {
        let s21 = day([
            story("a", "On September 21, 1784, the Pennsylvania Packet began publishing as the first successful daily newspaper in the United States.", kind: "birth_fact", support: 2),
            story("b", "1965: The Gambia, Maldives and Singapore are admitted as members of the United Nations.", kind: "historical_event", support: 1),
            story("c", "1993: A Transair Georgian Airlines Tu-134 is shot down by a missile in the Black Sea near Sokhumi, Georgia.", kind: "historical_event", support: 1),
            story("d", "Paramount settles lawsuit blocking $110 billion Warner Bros. merger", kind: nil, support: 1),
        ])
        XCTAssertEqual(HiveDecades.line(for: s21, dateName: "September 21", voice: .bee, sealed: true), "The 1780s led September 21 with 2 of 5 buzzes.")
        let s22 = day([
            story("a", "Trump seeks ‘massive’ Belarus fertiliser deal amid Canada trade war", kind: nil, support: 1, date: WallDate(year: 2026, month: 9, day: 22)!),
            story("b", "Matthew McConaughey Exposed Himself to Jimmy Kimmel in the Emmys Bathroom and Woody Harrelson Saw the Whole Thing", kind: nil, support: 1, date: WallDate(year: 2026, month: 9, day: 22)!),
            story("c", "Taiwan Creative Content Fest Adds Spotlight Screenings to Court International Buyers", kind: nil, support: 1, date: WallDate(year: 2026, month: 9, day: 22)!),
            story("d", "Robert Wadlow, tallest person in recorded history, born 1918"),
        ])
        XCTAssertEqual(HiveDecades.line(for: s22, dateName: "September 22", voice: .bee, sealed: false), "The 2020s lead September 22 with all 3 buzzes so far.")
        let s23 = day([
            story("a", "Typhoid Mary, infected houseworker in New York City, born 1869", support: 1),
            story("b", "Bruce Springsteen, American rock singer (born 1949), born 1949", support: 1),
            story("c", "Major news outlets banned by Trump will have their day in court", kind: nil, support: 1, status: .pool),
        ])
        XCTAssertEqual(HiveDecades.line(for: s23, dateName: "September 23", voice: .bee, sealed: false), "The 1860s, 1940s (Boomers) and 2020s are level on September 23, 1 buzz each.")
    }

    func testAGenerationIsNamedForPeopleOnlyWhenTheyAreAllOne() {
        XCTAssertEqual(HiveDecades.generation(of: 1949), "Boomers")
        XCTAssertEqual(HiveDecades.generation(of: 1945), "Silent Generation")
        XCTAssertEqual(HiveDecades.generation(of: 1965), "Gen X")
        XCTAssertEqual(HiveDecades.generation(of: 1996), "Millennials")
        XCTAssertEqual(HiveDecades.generation(of: 1997), "Gen Z")
        XCTAssertEqual(HiveDecades.generation(of: 2013), "Gen Alpha")
        XCTAssertNil(HiveDecades.generation(of: 1869))
        XCTAssertNil(HiveDecades.born(of: story("a", "1977: Star Wars was the number one film at the box office", kind: "film")))
        let bruce = story("a", "Bruce Springsteen, American rock singer (born 1949), born 1949", support: 1)
        let film = story("b", "1949: The Third Man was the number one film at the box office", kind: "film", support: 1)
        let silent = story("c", "Somebody Else, singer, born 1943", support: 1)
        XCTAssertEqual(HiveDecades.line(for: day([bruce]), dateName: "September 23", voice: .bee, sealed: false), "The 1940s (Boomers) lead September 23 with the only buzz so far.")
        XCTAssertEqual(HiveDecades.line(for: day([bruce, film]), dateName: "September 23", voice: .bee, sealed: false), "The 1940s lead September 23 with all 2 buzzes so far.")
        XCTAssertEqual(HiveDecades.line(for: day([bruce, silent]), dateName: "September 23", voice: .bee, sealed: false), "The 1940s lead September 23 with all 2 buzzes so far.")
    }

    func testAFalseStoryCountsForNoTeamAndAStoryWithNoYearForNone() {
        let d = day([
            story("a", "Typhoid Mary, infected houseworker in New York City, born 1869", support: 5, status: .shownFalse),
            story("b", "Somebody with no year", support: 1),
            story("c", "1956: The dike around the Dutch polder East Flevoland is closed.", kind: "historical_event", support: 1, status: .pool),
        ])
        XCTAssertEqual(HiveDecades.line(for: d, dateName: "September 23", voice: .bee, sealed: false), "The 1950s lead September 23 with the only buzz so far.")
    }
}
