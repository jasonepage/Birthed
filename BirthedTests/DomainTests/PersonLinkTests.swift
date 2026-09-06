import XCTest
@testable import BirthedDomain

final class PersonLinkTests: XCTestCase {

    private func birthday(_ month: Int, _ day: Int, _ year: Int? = nil,
                          _ observance: LeapObservance = .february28) -> CalendarBirthday {
        CalendarBirthday(month: month, day: day, year: year, leapObservance: observance)!
    }

    // MARK: What travels

    func testALinkSurvivesTheRoundTrip() {
        let url = PersonLink.url(name: "Sam", birthday: birthday(3, 14, 2003))
        let read = url.flatMap(PersonLink.incoming(from:))
        XCTAssertEqual(read?.name, "Sam")
        XCTAssertEqual(read?.birthday.date.month, 3)
        XCTAssertEqual(read?.birthday.date.day, 14)
        XCTAssertEqual(read?.birthday.year, 2003)
    }

    func testYourOwnLinkCarriesNoName() {
        // The privacy page says Birthed never asks your name, and it does not.
        // A link you share about yourself is a date. Whoever adds you writes
        // what they call you, which is what they were going to do anyway.
        let url = PersonLink.url(forMyBirthday: birthday(9, 4))
        XCTAssertNotNil(url)
        XCTAssertFalse(url?.absoluteString.contains("n=") ?? true)

        let read = url.flatMap(PersonLink.incoming(from:))
        XCTAssertNil(read?.name)
        XCTAssertEqual(read?.birthday.date.month, 9)
        XCTAssertEqual(read?.birthday.date.day, 4)
    }

    func testAnEmptyNameIsTheSameAsNoName() {
        let url = PersonLink.url(name: "   ", birthday: birthday(4, 4))
        XCTAssertNotNil(url, "an empty name is a nameless link, not a broken one")
        XCTAssertNil(url.flatMap(PersonLink.incoming(from:))?.name)
    }

    // MARK: Where the data sits

    func testTheBirthdayNeverReachesTheServer() {
        // The whole design rests on this. Everything is after the hash, which
        // a browser does not send, so opening the link tells birthed.app that
        // somebody opened /add and nothing whatsoever about who.
        let url = PersonLink.url(name: "Sam Lee", birthday: birthday(3, 14))
        XCTAssertNotNil(url)
        XCTAssertNil(url?.query, "a query would be sent to the server")
        XCTAssertEqual(url?.path, "/add")
        XCTAssertNotNil(url?.fragment)
        XCTAssertFalse(url?.absoluteString.contains("?") ?? true)
    }

    func testATwoWordNameProducesAValidAddress() {
        // A literal space is not allowed in an address, so an unescaped name
        // makes the whole link nil and the feature silently does nothing for
        // most people.
        let url = PersonLink.url(name: "Sam Lee", birthday: birthday(3, 14))
        XCTAssertNotNil(url)
        XCTAssertFalse(url?.absoluteString.contains(" ") ?? true)
        XCTAssertEqual(url.flatMap(PersonLink.incoming(from:))?.name, "Sam Lee")
    }

    func testAnAmpersandInANameDoesNotCutTheNameInHalf() {
        let url = PersonLink.url(name: "Ben & Jerry", birthday: birthday(5, 5))
        let read = url.flatMap(PersonLink.incoming(from:))
        XCTAssertEqual(read?.name, "Ben & Jerry")
        XCTAssertEqual(read?.birthday.date.month, 5)
    }

    func testAnEmojiNameSurvives() {
        let url = PersonLink.url(name: "Sam 🎂", birthday: birthday(1, 2))
        XCTAssertEqual(url.flatMap(PersonLink.incoming(from:))?.name, "Sam 🎂")
    }

    // MARK: The optional parts

    func testTheYearIsOptionalInBothDirections() {
        let url = PersonLink.url(name: "Alex", birthday: birthday(7, 1))
        XCTAssertFalse(url?.absoluteString.contains("y=") ?? true)
        XCTAssertNil(url.flatMap(PersonLink.incoming(from:))?.birthday.year)
    }

    func testFebruary29CarriesItsObservanceAndOtherDatesDoNot() {
        let leap = PersonLink.url(name: "Robin", birthday: birthday(2, 29, nil, .march1))
        XCTAssertTrue(leap?.absoluteString.contains("o=mar_01") ?? false)
        XCTAssertEqual(leap.flatMap(PersonLink.incoming(from:))?.birthday.leapObservance, .march1)

        let ordinary = PersonLink.url(name: "Robin", birthday: birthday(3, 1, nil, .march1))
        XCTAssertFalse(ordinary?.absoluteString.contains("o=") ?? true,
                       "the observance means nothing on a date that is not February 29")
    }

    func testAVeryLongNameIsCutRatherThanRefused() {
        let long = String(repeating: "a", count: 500)
        let url = PersonLink.url(name: long, birthday: birthday(4, 4))
        XCTAssertEqual(url.flatMap(PersonLink.incoming(from:))?.name?.count, PersonLink.maxNameLength)
    }

    // MARK: What is refused

    func testTheAppSchemeIsAcceptedWithAQuery() {
        // The web page hands off to the app through birthed://, and a scheme
        // link has no server to hide a fragment from, so the query is read too.
        let url = URL(string: "birthed://add?n=Sam&m=3&d=14")!
        XCTAssertEqual(PersonLink.incoming(from: url)?.name, "Sam")
    }

    func testSomebodyElsesLinkIsRefused() {
        XCTAssertNil(PersonLink.incoming(from: URL(string: "https://example.com/add#n=Sam&m=1&d=1")!))
        XCTAssertNil(PersonLink.incoming(from: URL(string: "https://birthed.app/september-4/#n=Sam&m=1&d=1")!))
    }

    func testAnImpossibleDateIsRefusedRatherThanCorrected() {
        XCTAssertNil(PersonLink.incoming(from: URL(string: "https://birthed.app/add#n=Sam&m=13&d=1")!))
        XCTAssertNil(PersonLink.incoming(from: URL(string: "https://birthed.app/add#n=Sam&m=1&d=99")!))
    }

    func testALinkWithNoDateIsNothing() {
        XCTAssertNil(PersonLink.incoming(from: URL(string: "https://birthed.app/add#n=Sam")!))
        XCTAssertNil(PersonLink.incoming(from: URL(string: "https://birthed.app/add")!))
    }
}

/// The day page address, which is the only thing Birthed has worth sending
/// somebody who does not have the app.
final class DayPageLinkTests: XCTestCase {

    func testTheSlugIsTheWebsitesOwnNameForTheDate() {
        XCTAssertEqual(CalendarDate(month: 12, day: 17)!.slug, "december-17")
        XCTAssertEqual(CalendarDate(month: 9, day: 4)!.slug, "september-4")
        XCTAssertEqual(CalendarDate(month: 2, day: 29)!.slug, "february-29")
        XCTAssertEqual(CalendarDate(month: 1, day: 1)!.slug, "january-1")
    }

    /// No leading zero and no padding, because the website's addresses have
    /// none. A slug of "september-04" is a 404.
    func testASingleDigitDayIsNotPadded() {
        XCTAssertEqual(CalendarDate(month: 9, day: 4)!.slug, "september-4")
        XCTAssertNotEqual(CalendarDate(month: 9, day: 4)!.slug, "september-04")
    }

    func testTheAddressIsBuiltFromTheSlug() {
        let url = PersonLink.dayPage(for: CalendarDate(month: 12, day: 17)!)
        XCTAssertEqual(url?.absoluteString, "https://birthed.app/december-17/")
    }

    /// The month names are fixed rather than read from the device. A phone set
    /// to French would otherwise build birthed.app/décembre-17, which is not a
    /// page, and nothing on screen would say why the link was dead.
    func testTheMonthNamesAreNotTheDevicesOwn() {
        XCTAssertEqual(CalendarDate.englishMonths.count, 12)
        XCTAssertEqual(CalendarDate.englishMonths.first, "January")
        XCTAssertEqual(CalendarDate.englishMonths.last, "December")
    }
}
