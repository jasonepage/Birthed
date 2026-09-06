import XCTest
@testable import BirthedDomain

/// Somebody followed who has died.
///
/// Written after a screenshot showed the app counting down a hundred and forty
/// days to XXXTentacion's birthday, with a notification waiting at the end of
/// it that said "Today. Say something." The countdown is fine and wanted. The
/// wording around it is not, and every place that words a day now has to ask
/// this question first.
final class RememberedPersonTests: XCTestCase {

    private func match(name: String, born: Int, died: Int?) -> NotableMatch {
        NotableMatch(
            person: NotablePerson(
                id: "Q1",
                name: name,
                birthYear: born,
                deathYear: died,
                shortDescription: "American rapper",
                sourceURL: URL(string: "https://www.wikidata.org/wiki/Q1")!,
                contentLicense: "CC0"
            ),
            birthDate: CalendarDate(month: 1, day: 23)!
        )
    }

    func testSomebodyLivingIsNotRemembered() {
        let person = match(name: "Ariana Grande", born: 1993, died: nil).asPerson()
        XCTAssertFalse(person.isRemembered)
        XCTAssertEqual(person.birthday.year, 1993)
        XCTAssertNil(person.deathYear)
    }

    func testSomebodyWhoHasDiedIsRemembered() {
        let person = match(name: "XXXTentacion", born: 1998, died: 2018).asPerson()
        XCTAssertTrue(person.isRemembered)
        XCTAssertEqual(person.deathYear, 2018)
    }

    func testTheBirthYearSurvivesDeath() {
        // It was dropped for a while, on the reasoning that the year only
        // exists to work out the age somebody is turning. That was the wrong
        // fix: the year is a matter of record and the app wanted it. What
        // changes is the sentence built from it, not whether it is kept.
        let person = match(name: "XXXTentacion", born: 1998, died: 2018).asPerson()
        XCTAssertEqual(person.birthday.year, 1998)
    }

    func testFollowingSomebodyStillMarksThemPublic() {
        // The notification plan trims followed people before friends, and that
        // has to keep working for the dead as well as the living.
        let person = match(name: "XXXTentacion", born: 1998, died: 2018).asPerson()
        XCTAssertTrue(person.isPublicFigure)
    }

    func testSomebodyTypedInByHandIsNeverRemembered() {
        // Nobody adds a friend and fills in a death year. The flag can only
        // ever arrive from the database, which is what keeps a friend's row
        // from being worded as a memorial by accident.
        let friend = Person(name: "Sam", birthday: CalendarBirthday(month: 3, day: 14, year: 2003)!)
        XCTAssertFalse(friend.isRemembered)
        XCTAssertFalse(friend.isPublicFigure)
    }
}
