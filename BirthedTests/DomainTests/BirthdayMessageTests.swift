import XCTest
@testable import BirthedDomain

/// The words the composer opens with.
///
/// The hundred at the bottom is the acceptance test Nathan set on September 6,
/// 2026: generate one hundred messages across a realistic spread of names,
/// notes, ages and relationships, and count how many a person would be
/// embarrassed to send. The count was two when this was written, both the
/// same known limit, and the limit is recorded in `docs/birthday-messages.md`.
/// The hundred were generated on a machine with no Swift toolchain by a
/// JavaScript mirror of `BirthdayMessage`, so this test is also what proves the
/// Swift says the same thing. If it fails, the Swift is what changed.
final class BirthdayMessageTests: XCTestCase {

    private func person(_ name: String, note: String? = nil, year: Int? = nil,
                        wikidataID: String? = nil, deathYear: Int? = nil) -> Person {
        Person(id: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!,
               name: name, birthday: birthday(9, 4, year: year), note: note,
               wikidataID: wikidataID, deathYear: deathYear)
    }

    // MARK: What to call them

    func testTheNoteNamesAParent() {
        XCTAssertEqual(BirthdayMessage.addressTerm(name: "Karen", note: "Mum"), "Mum")
        XCTAssertEqual(BirthdayMessage.addressTerm(name: "Maria", note: "my mom"), "Mom")
        XCTAssertEqual(BirthdayMessage.addressTerm(name: "Steve Page", note: "dad."), "Dad")
    }

    func testAPastedFullNameBecomesAFirstName() {
        XCTAssertEqual(BirthdayMessage.addressTerm(name: "Priya Ramaswamy", note: ""), "Priya")
        XCTAssertEqual(BirthdayMessage.addressTerm(name: "SAM JONES", note: ""), "Sam")
        XCTAssertEqual(BirthdayMessage.addressTerm(name: "sam", note: ""), "Sam")
        XCTAssertEqual(BirthdayMessage.addressTerm(name: "Sarah (work)", note: ""), "Sarah")
        XCTAssertEqual(BirthdayMessage.addressTerm(name: "Sam - gym", note: ""), "Sam")
    }

    func testAFirstWordThatIsNotANameKeepsTheSecond() {
        // "Happy birthday Big" was in the first hundred. Once is enough.
        XCTAssertEqual(BirthdayMessage.addressTerm(name: "Big Dave", note: ""), "Big Dave")
        XCTAssertEqual(BirthdayMessage.addressTerm(name: "Lil Mo", note: ""), "Lil Mo")
        XCTAssertEqual(BirthdayMessage.addressTerm(name: "Dr Ahmed", note: ""), "Dr Ahmed")
        XCTAssertEqual(BirthdayMessage.addressTerm(name: "Auntie Carol", note: ""), "Auntie Carol")
    }

    func testACoupleIsAddressedTogether() {
        XCTAssertEqual(BirthdayMessage.addressTerm(name: "Sam and Alex", note: ""), "Sam and Alex")
        XCTAssertEqual(BirthdayMessage.addressTerm(name: "Sam & Alex", note: ""), "Sam & Alex")
    }

    // MARK: Register

    func testTheNoteIsClassifiedAndNeverQuoted() {
        let text = BirthdayMessage.message(name: "Ben", note: "owes me twenty quid", age: 29, seed: 0)!
        XCTAssertFalse(text.lowercased().contains("quid"))
        XCTAssertFalse(text.lowercased().contains("owes"))
    }

    func testSomebodyElsesBoyfriendIsNotLoved() {
        // "Sarah's boyfriend" produced "Love you." in the first run of the
        // hundred. A possessive in the note means the relationship word is
        // about somebody else.
        XCTAssertEqual(BirthdayMessage.register(note: "Sarah's boyfriend", term: "Ben"), .plain)
        XCTAssertEqual(BirthdayMessage.register(note: "mum's friend", term: "Ben"), .plain)
        XCTAssertEqual(BirthdayMessage.register(note: "boyfriend", term: "Ben"), .partner)
        XCTAssertEqual(BirthdayMessage.register(note: "my boyfriend", term: "Ben"), .partner)
    }

    func testATitleMakesTheMessageFormal() {
        XCTAssertEqual(BirthdayMessage.register(note: "", term: "Dr Ahmed"), .polite)
        XCTAssertEqual(BirthdayMessage.register(note: "", term: "Mrs Thompson"), .polite)
        XCTAssertEqual(BirthdayMessage.register(note: "", term: "Grandpa Joe"), .family)
    }

    func testAnApostropheDoesNotSplitAWord() {
        XCTAssertEqual(BirthdayMessage.register(note: "haven't seen in years", term: "Ben"), .distant)
    }

    // MARK: Age

    func testAgeIsSaidOnlyWhereNobodyWouldMind() {
        XCTAssertTrue(BirthdayMessage.saysAge(7, in: .plain))
        XCTAssertTrue(BirthdayMessage.saysAge(18, in: .plain))
        XCTAssertTrue(BirthdayMessage.saysAge(60, in: .family))
        XCTAssertTrue(BirthdayMessage.saysAge(26, in: .casual))
        XCTAssertFalse(BirthdayMessage.saysAge(26, in: .plain))
        XCTAssertFalse(BirthdayMessage.saysAge(43, in: .casual))
        XCTAssertFalse(BirthdayMessage.saysAge(40, in: .polite))
        XCTAssertFalse(BirthdayMessage.saysAge(21, in: .partner))
        XCTAssertFalse(BirthdayMessage.saysAge(30, in: .distant))
        XCTAssertFalse(BirthdayMessage.saysAge(nil, in: .family))
    }

    func testOrdinals() {
        XCTAssertEqual(BirthdayMessage.ordinal(1), "1st")
        XCTAssertEqual(BirthdayMessage.ordinal(2), "2nd")
        XCTAssertEqual(BirthdayMessage.ordinal(3), "3rd")
        XCTAssertEqual(BirthdayMessage.ordinal(11), "11th")
        XCTAssertEqual(BirthdayMessage.ordinal(12), "12th")
        XCTAssertEqual(BirthdayMessage.ordinal(13), "13th")
        XCTAssertEqual(BirthdayMessage.ordinal(21), "21st")
        XCTAssertEqual(BirthdayMessage.ordinal(100), "100th")
        XCTAssertEqual(BirthdayMessage.ordinal(111), "111th")
    }

    // MARK: Public figures and the dead

    func testAPublicFigureIsWrittenAboutNotTo() {
        let beyonce = person("Beyoncé", year: 1981, wikidataID: "Q36153")
        XCTAssertEqual(BirthdayMessage.draft(for: beyonce, age: 45, dateName: "September 4", seed: 0),
                       "Beyoncé turns 45 today.")
    }

    func testSomebodyWhoHasDiedIsWishedNothing() {
        let freddie = person("Freddie Mercury", year: 1946, wikidataID: "Q15869", deathYear: 1991)
        let line = BirthdayMessage.draft(for: freddie, age: 80, dateName: "September 5", seed: 0)!
        XCTAssertEqual(line, "Freddie Mercury was born on September 5, 1946.")
        XCTAssertFalse(line.lowercased().contains("happy"))
        XCTAssertFalse(line.contains("80"))
    }

    // MARK: The whole draft

    func testANamelessPersonProducesNothing() {
        XCTAssertNil(BirthdayMessage.message(name: "   ", note: nil, age: 20, seed: 0))
    }

    func testTheSeedIsStableAcrossLaunches() {
        let someone = person("Sam")
        XCTAssertEqual(BirthdayMessage.seed(year: 2026, person: someone),
                       BirthdayMessage.seed(year: 2026, person: someone))
        XCTAssertNotEqual(BirthdayMessage.seed(year: 2026, person: someone),
                          BirthdayMessage.seed(year: 2027, person: someone))
    }

    func testNoExclamationMarksNoEmojiNoEmDashes() {
        for item in Self.hundred {
            XCTAssertFalse(item.expected.contains("!"), item.expected)
            XCTAssertFalse(item.expected.contains("\u{2014}"), item.expected)
            XCTAssertFalse(item.expected.unicodeScalars.contains { $0.properties.isEmojiPresentation }, item.expected)
        }
    }

    // MARK: The hundred

    struct Case {
        let name: String
        let note: String?
        let age: Int?
        var isPublic = false
        var birthYear: Int? = nil
        var deathYear: Int? = nil
        var dateName = ""
        let seed: Int
        let expected: String
    }

    func testTheHundred() {
        XCTAssertEqual(Self.hundred.count, 100)
        for (index, item) in Self.hundred.enumerated() {
            let actual: String?
            if item.isPublic {
                let figure = person(item.name, year: item.birthYear, wikidataID: "Q1", deathYear: item.deathYear)
                actual = BirthdayMessage.draft(for: figure, age: item.age, dateName: item.dateName, seed: item.seed)
            } else {
                actual = BirthdayMessage.message(name: item.name, note: item.note, age: item.age, seed: item.seed)
            }
            XCTAssertEqual(actual, item.expected, "case \(index + 1): \(item.name), note \(item.note ?? "none")")
        }
    }

    static let hundred: [Case] = [
        Case(name: "Karen", note: "Mum", age: 58, seed: 0, expected: "Happy birthday Mum. Hope you have a lovely day."),
        Case(name: "Mum", note: nil, age: 60, seed: 1, expected: "Happy 60th Mum. Hope it's a good one."),
        Case(name: "Dad", note: nil, age: 63, seed: 2, expected: "Happy birthday Dad. Hope you have a good day."),
        Case(name: "Steve Page", note: "dad", age: 70, seed: 0, expected: "Happy 70th Dad. Hope you have a lovely day."),
        Case(name: "Nan", note: nil, age: 84, seed: 1, expected: "Happy birthday Nan. Hope it's a good one."),
        Case(name: "Grandpa Joe", note: nil, age: 90, seed: 2, expected: "Happy 90th Grandpa Joe. Hope you have a good day."),
        Case(name: "Maria", note: "my mom", age: 49, seed: 0, expected: "Happy birthday Mom. Hope you have a lovely day."),
        Case(name: "Ellie", note: "sister", age: 24, seed: 1, expected: "Happy 24th Ellie. Hope it's a good one."),
        Case(name: "Tom", note: "brother", age: 30, seed: 2, expected: "Happy 30th Tom. Hope you have a good day."),
        Case(name: "Jake", note: "little brother", age: 16, seed: 0, expected: "Happy 16th Jake. Hope you have a lovely day."),
        Case(name: "Auntie Carol", note: nil, age: 55, seed: 1, expected: "Happy birthday Auntie Carol. Hope it's a good one."),
        Case(name: "Carol", note: "aunt", age: 61, seed: 2, expected: "Happy birthday Carol. Hope you have a good day."),
        Case(name: "Uncle Pete", note: "dad's brother", age: 67, seed: 0, expected: "Happy birthday Uncle Pete. Hope you have a lovely day."),
        Case(name: "Leo", note: "nephew", age: 7, seed: 1, expected: "Happy 7th birthday Leo. Hope it's a good one."),
        Case(name: "Ava", note: "niece", age: 3, seed: 2, expected: "Happy 3rd birthday Ava. Hope you have a good day."),
        Case(name: "Noah", note: "godson", age: 12, seed: 0, expected: "Happy 12th birthday Noah. Hope you have a lovely day."),
        Case(name: "Priya", note: "cousin", age: 27, seed: 1, expected: "Happy 27th Priya. Hope it's a good one."),
        Case(name: "Raj", note: "cousin in Perth", age: 33, seed: 2, expected: "Happy birthday Raj. Hope you have a good day."),
        Case(name: "Sam", note: "twin", age: 19, seed: 0, expected: "Happy 19th Sam. Hope you have a lovely day."),
        Case(name: "Linda", note: "mother in law", age: 66, seed: 1, expected: "Happy birthday Linda. Hope it's a good one."),
        Case(name: "Grace", note: "stepmum", age: 52, seed: 2, expected: "Happy birthday Grace. Hope you have a good day."),
        Case(name: "Ollie", note: "cousin's kid", age: 5, seed: 0, expected: "Happy 5th birthday Ollie. Hope it's a good one."),
        Case(name: "Mum", note: "Mum", age: nil, seed: 1, expected: "Happy birthday Mum. Hope it's a good one."),
        Case(name: "Nonna", note: nil, age: 88, seed: 2, expected: "Happy birthday Nonna. Hope you have a good day."),
        Case(name: "Alex", note: "boyfriend", age: 22, seed: 0, expected: "Happy birthday Alex. Love you."),
        Case(name: "Jess", note: "girlfriend", age: 21, seed: 1, expected: "Happy birthday Jess. Love you. Hope today is a good one."),
        Case(name: "Chris", note: "husband", age: 41, seed: 2, expected: "Happy birthday Chris. Love you."),
        Case(name: "Dana", note: "wife", age: 40, seed: 0, expected: "Happy birthday Dana. Love you."),
        Case(name: "Sam", note: "partner", age: nil, seed: 1, expected: "Happy birthday Sam. Love you. Hope today is a good one."),
        Case(name: "Mia", note: "gf", age: 19, seed: 2, expected: "Happy birthday Mia. Love you."),
        Case(name: "Sarah", note: "best friend", age: 24, seed: 0, expected: "Happy 24th Sarah. Hope it's a good one."),
        Case(name: "Sarah", note: "from school", age: 24, seed: 1, expected: "Happy birthday Sarah. Hope you're well."),
        Case(name: "Sarah W", note: "work", age: 31, seed: 2, expected: "Happy birthday, Sarah. Hope it's a good one."),
        Case(name: "Sarah (work)", note: nil, age: nil, seed: 0, expected: "Happy birthday Sarah. Hope it's a good one."),
        Case(name: "Ben", note: "gym", age: 28, seed: 1, expected: "Happy 28th Ben. Hope you have a good day."),
        Case(name: "Ben", note: "uni", age: 22, seed: 2, expected: "Happy 22nd Ben. Hope you have a good one."),
        Case(name: "Ben", note: "roommate", age: 21, seed: 0, expected: "Happy 21st Ben. Hope it's a good one."),
        Case(name: "Ben", note: "footy", age: 35, seed: 1, expected: "Happy birthday Ben. Hope you have a good day."),
        Case(name: "Ben", note: "band", age: nil, seed: 2, expected: "Happy birthday Ben. Hope you have a good one."),
        Case(name: "Ben", note: "camp", age: 17, seed: 0, expected: "Happy 17th Ben. Hope it's a good one."),
        Case(name: "Ben", note: "the tall one", age: 26, seed: 1, expected: "Happy 26th Ben. Hope you have a good day."),
        Case(name: "Ben", note: "owes me twenty quid", age: 29, seed: 2, expected: "Happy 29th Ben. Hope you have a good one."),
        Case(name: "Ben", note: "Bristol", age: 43, seed: 0, expected: "Happy birthday Ben. Hope it's a good one."),
        Case(name: "Ben", note: "Sarah's boyfriend", age: 27, seed: 1, expected: "Happy birthday Ben. Hope you have a good day."),
        Case(name: "Ben", note: "mum's friend", age: 57, seed: 2, expected: "Happy birthday Ben. Hope it's a good day."),
        Case(name: "Ben", note: "kid from camp", age: 14, seed: 0, expected: "Happy 14th Ben. Hope it's a good one."),
        Case(name: "Ben", note: "met at Glasto", age: 25, seed: 1, expected: "Happy birthday Ben. Hope you're well."),
        Case(name: "Ben", note: "Tinder", age: 26, seed: 2, expected: "Happy 26th Ben. Hope you have a good one."),
        Case(name: "Ben", note: "ex", age: 25, seed: 0, expected: "Happy birthday Ben. Hope you're doing well."),
        Case(name: "Ben", note: "old flatmate", age: 34, seed: 1, expected: "Happy birthday Ben. Hope you're well."),
        Case(name: "Ben", note: "haven't seen in years", age: 47, seed: 2, expected: "Happy birthday Ben. Hope things are good with you."),
        Case(name: "Ben", note: "friend of a friend", age: 30, seed: 0, expected: "Happy birthday Ben. Hope you're doing well."),
        Case(name: "Ben", note: "mate", age: 18, seed: 1, expected: "Happy 18th Ben. Hope you have a good day."),
        Case(name: "Ben", note: "bestie", age: 13, seed: 2, expected: "Happy 13th Ben. Hope you have a good one."),
        Case(name: "Ben", note: "ride or die", age: 20, seed: 0, expected: "Happy 20th Ben. Hope it's a good one."),
        Case(name: "Ellie", note: "Sarah's mum", age: 55, seed: 1, expected: "Happy birthday Ellie. Hope you have a good day."),
        Case(name: "Ben", note: "book club", age: 64, seed: 2, expected: "Happy birthday Ben. Hope you have a good one."),
        Case(name: "Ben", note: "church", age: 75, seed: 0, expected: "Happy birthday, Ben. Hope you have a good day."),
        Case(name: "Mr Patel", note: "teacher", age: nil, seed: 1, expected: "Happy birthday, Mr Patel. Hope you get to enjoy it."),
        Case(name: "Dr Ahmed", note: nil, age: 50, seed: 2, expected: "Happy birthday, Dr Ahmed. Hope it's a good one."),
        Case(name: "Claire", note: "boss", age: 45, seed: 0, expected: "Happy birthday, Claire. Hope you have a good day."),
        Case(name: "Claire", note: "manager", age: 40, seed: 1, expected: "Happy birthday, Claire. Hope you get to enjoy it."),
        Case(name: "Claire", note: "coworker", age: 29, seed: 2, expected: "Happy birthday, Claire. Hope it's a good one."),
        Case(name: "Claire", note: "client", age: nil, seed: 0, expected: "Happy birthday, Claire. Hope you have a good day."),
        Case(name: "Claire", note: "neighbour", age: 72, seed: 1, expected: "Happy birthday, Claire. Hope you get to enjoy it."),
        Case(name: "Claire", note: "landlord", age: nil, seed: 2, expected: "Happy birthday, Claire. Hope it's a good one."),
        Case(name: "Claire", note: "coach", age: 36, seed: 0, expected: "Happy birthday, Claire. Hope you have a good day."),
        Case(name: "Claire", note: "old teacher", age: 60, seed: 1, expected: "Happy birthday Claire. Hope you're well."),
        Case(name: "Claire", note: "dentist", age: nil, seed: 2, expected: "Happy birthday, Claire. Hope it's a good one."),
        Case(name: "Claire", note: "team lead", age: 33, seed: 0, expected: "Happy birthday, Claire. Hope you have a good day."),
        Case(name: "Claire", note: "LinkedIn", age: 30, seed: 1, expected: "Happy birthday, Claire. Hope you get to enjoy it."),
        Case(name: "SAM JONES", note: nil, age: 24, seed: 2, expected: "Happy birthday Sam. Hope it's a good day."),
        Case(name: "sam", note: nil, age: 24, seed: 0, expected: "Happy birthday Sam. Hope it's a good one."),
        Case(name: "Priya Ramaswamy", note: nil, age: 26, seed: 1, expected: "Happy birthday Priya. Hope you have a good day."),
        Case(name: "Big Dave", note: nil, age: 45, seed: 2, expected: "Happy birthday Big Dave. Hope it's a good day."),
        Case(name: "J", note: nil, age: nil, seed: 0, expected: "Happy birthday J. Hope it's a good one."),
        Case(name: "Sam 🎉", note: nil, age: 21, seed: 1, expected: "Happy 21st Sam. Hope you have a good day."),
        Case(name: "Sam - gym", note: nil, age: 30, seed: 2, expected: "Happy 30th Sam. Hope it's a good day."),
        Case(name: "María José", note: nil, age: 23, seed: 0, expected: "Happy birthday María. Hope it's a good one."),
        Case(name: "Zhang Wei", note: "uni", age: 22, seed: 1, expected: "Happy 22nd Zhang. Hope you have a good day."),
        Case(name: "Ngozi Okafor-Bright", note: "work", age: nil, seed: 2, expected: "Happy birthday, Ngozi. Hope it's a good one."),
        Case(name: "Seán", note: nil, age: 31, seed: 0, expected: "Happy birthday Seán. Hope it's a good one."),
        Case(name: "Lil Mo", note: "cousin", age: 11, seed: 1, expected: "Happy 11th birthday Lil Mo. Hope it's a good one."),
        Case(name: "Mrs Thompson", note: "neighbour", age: 80, seed: 2, expected: "Happy birthday, Mrs Thompson. Hope it's a good one."),
        Case(name: "Coach Mike", note: nil, age: 54, seed: 0, expected: "Happy birthday, Coach Mike. Hope you have a good day."),
        Case(name: "Sam and Alex", note: "the couple upstairs", age: nil, seed: 1, expected: "Happy birthday Sam and Alex. Hope you have a good day."),
        Case(name: "Ellie", note: nil, age: nil, seed: 2, expected: "Happy birthday Ellie. Hope it's a good day."),
        Case(name: "Tom", note: nil, age: nil, seed: 0, expected: "Happy birthday Tom. Hope it's a good one."),
        Case(name: "Aisha", note: nil, age: 18, seed: 1, expected: "Happy 18th Aisha. Hope you have a good day."),
        Case(name: "Kai", note: nil, age: 1, seed: 2, expected: "Happy 1st birthday Kai. Hope it's a good day."),
        Case(name: "Ruth", note: nil, age: 100, seed: 0, expected: "Happy 100th Ruth. Hope it's a good one."),
        Case(name: "Dev", note: nil, age: 51, seed: 1, expected: "Happy birthday Dev. Hope you have a good day."),
        Case(name: "Beyoncé", note: nil, age: 45, isPublic: true, birthYear: 1981, deathYear: nil, dateName: "September 4", seed: 0, expected: "Beyoncé turns 45 today."),
        Case(name: "Freddie Mercury", note: nil, age: nil, isPublic: true, birthYear: 1946, deathYear: 1991, dateName: "September 5", seed: 2, expected: "Freddie Mercury was born on September 5, 1946."),
        Case(name: "XXXTentacion", note: nil, age: nil, isPublic: true, birthYear: 1998, deathYear: 2018, dateName: "January 23", seed: 0, expected: "XXXTentacion was born on January 23, 1998."),
        Case(name: "Keanu Reeves", note: nil, age: 62, isPublic: true, birthYear: 1964, deathYear: nil, dateName: "September 2", seed: 1, expected: "Keanu Reeves turns 62 today."),
        Case(name: "Johann Sebastian Bach", note: nil, age: nil, isPublic: true, birthYear: 1685, deathYear: 1750, dateName: "March 31", seed: 2, expected: "Johann Sebastian Bach was born on March 31, 1685."),
        Case(name: "Jack Antonoff", note: nil, age: 42, isPublic: true, birthYear: 1984, deathYear: nil, dateName: "March 31", seed: 0, expected: "Jack Antonoff turns 42 today."),
        Case(name: "Some Streamer", note: nil, age: nil, isPublic: true, birthYear: nil, deathYear: nil, dateName: "June 10", seed: 1, expected: "It's Some Streamer's birthday today."),
        Case(name: "Mac Miller", note: nil, age: nil, isPublic: true, birthYear: 1992, deathYear: 2018, dateName: "January 19", seed: 2, expected: "Mac Miller was born on January 19, 1992."),
    ]
}
