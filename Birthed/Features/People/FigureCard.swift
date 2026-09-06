import Foundation
import SwiftUI

/// What a public figure's birthday produces, now that it does not produce a
/// message.
///
/// The composer was the wrong artifact for somebody you follow, and the reason
/// is structural rather than a matter of wording. A composer is a thing you
/// edit and send to somebody, and a public figure has no somebody:
/// `SaySomethingView` already knew it and turned Messages off for them, which
/// left a large empty text box, one flat sentence, and nowhere for it to go.
/// The screen was asking what you wanted to say to Idris Elba and the honest
/// answer is nothing.
///
/// A card is the right artifact, because a card is a thing you post rather
/// than a thing you send. And the line on it is not their age.
///
/// "Idris Elba turns 54 today" is a fact anybody can look up in four seconds,
/// which is why sharing it feels thin. "Idris Elba was 30 when I was born" is
/// the same two birth years arranged so the reader is in the sentence, and
/// that is the one move this whole product is built on: the Fortnite line in
/// the Mine panel, the Today feed's "you were 7", the day count. Applied to a
/// person instead of to a video game it needs no new data, no network and no
/// model, because both years are already on the phone.
enum FigureCard {

    /// How old this figure was on the day the reader was born, or how much
    /// younger they are.
    ///
    /// Nil when either birth year is missing, which is the only reason this
    /// returns an optional: without both years there is no comparison to make
    /// and the caller falls back to the plain line rather than guessing one.
    ///
    /// The month and day matter and are not decoration. Somebody born in
    /// December 1972 had not had their birthday yet when a reader arrived in
    /// February 2002, so they were 29 that day and not 30, and a card that
    /// said 30 would be wrong in the one direction this app has promised not
    /// to be wrong in.
    static func comparison(for person: Person, reader: CalendarBirthday?) -> String? {
        guard let reader,
              let theirYear = person.birthday.year,
              let readerYear = reader.year
        else { return nil }

        let name = person.trimmedName
        var gap = readerYear - theirYear
        // Their birthday had not come round yet in the year the reader was
        // born, so they were a year younger than the difference suggests.
        if (reader.date.month, reader.date.day) < (person.birthday.date.month, person.birthday.date.day) {
            gap -= 1
        }

        if gap > 0 {
            return "\(name) was \(gap) when I was born."
        }
        if gap < 0 {
            let years = -gap
            return "\(name) is \(years) year\(years == 1 ? "" : "s") younger than me."
        }
        return "\(name) and I were born in the same year."
    }

    /// The line for a reader with no birth year, and for a figure whose own
    /// year Wikidata does not carry. Absent beats wrong applies here as
    /// everywhere: with no age at all the card states the date and stops.
    static func plainLine(for person: Person, age: Int?) -> String {
        let name = person.trimmedName
        if let age, !person.isRemembered {
            return "\(name) turns \(age) today."
        }
        return "\(name) was born on \(person.birthday.date.displayName())."
    }

    /// One card, not a picker, per the first five minutes document: the card
    /// is the thing they just looked at, so there is no choice to make.
    ///
    /// Somebody who has died is stated and wished nothing, which is the same
    /// rule `BirthdayMessage` follows and the reason the age is only computed
    /// for the living.
    static func shareChoice(
        for person: Person,
        reader: CalendarBirthday?,
        now: Date = Date(),
        palette: StagePalette = .wax
    ) -> ShareCardChoice {
        let calendar = BirthdayCalendar()
        let age = person.isRemembered ? nil : calendar.ageOnNextBirthday(person.birthday, from: now)
        let comparison = comparison(for: person, reader: reader)
        let title = comparison ?? plainLine(for: person, age: age)

        // Only when the title is the comparison, because the plain line
        // already says the age and a card should not say it twice.
        let subtitle: String? = {
            guard comparison != nil else { return nil }
            if let age { return "Turns \(age) today" }
            if let born = person.birthday.year, let died = person.deathYear {
                return "\(String(born)) to \(String(died))"
            }
            return nil
        }()

        return ShareCardChoice(id: "figure", label: person.trimmedName) {
            FocusCard(
                kicker: person.birthday.date.displayName().uppercased(),
                title: title,
                subtitle: subtitle,
                palette: palette,
                // A sentence rather than a song title, so well under the 104
                // the face size defaults to. Below 80 the card allows eight
                // lines instead of four, which is what a long name needs.
                titleSize: 78
            )
        }
    }
}
