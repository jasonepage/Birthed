import SwiftUI

/// The person whose birthday is next, set the way Mine sets the reader's own
/// day: a dark honey panel, the countdown as the loudest thing on it, the day
/// of the week it lands on, and the one thing to do about it.
///
/// The panel is the same in light and dark, for the reason written over
/// `StagePalette.wax`: the candle and the glow need a warm dark field, and a
/// cream page has nowhere for the light to go.
struct NextUpCard: View {
    let person: Person
    let now: Date
    /// Opens their day.
    let onOpen: () -> Void
    /// Opens the message.
    let onSay: () -> Void

    private let stage = StagePalette.wax
    private let calendar = BirthdayCalendar()

    private var days: Int { calendar.daysUntil(person.birthday, from: now) }
    private var isToday: Bool { days == 0 }
    private var age: Int? { calendar.ageOnNextBirthday(person.birthday, from: now) }

    private var landsOn: String? {
        PersonDay.weekdayName(PersonDay(calendar: calendar).nextWeekday(of: person.birthday, from: now))
    }

    private var bornOn: String? {
        calendar.birthWeekday(person.birthday).flatMap { PersonDay.weekdayName($0) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(kicker)
                .font(.caption.weight(.heavy))
                .kerning(2.8)
                .foregroundStyle(stage.accent)

            Text(person.trimmedName)
                .font(.system(size: 30, weight: .heavy, design: .serif))
                .foregroundStyle(stage.type)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .padding(.top, 8)

            countdown
                .padding(.top, 2)

            Text(turnsLine)
                .font(.system(size: 16))
                .foregroundStyle(stage.type.opacity(0.9))
                .padding(.top, 8)

            if let bornLine {
                Text(bornLine)
                    .font(.footnote)
                    .foregroundStyle(stage.type.opacity(0.55))
                    .padding(.top, 3)
            }

            // Three days is chosen in the reminders decision as long enough to
            // order something and have it arrive, so the card says so in that
            // window and nowhere else.
            if !person.isRemembered, (2...4).contains(days) {
                Text("Order something today and it arrives in time.")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.emberDeep)
                    .padding(.top, 12)
            }

            Button(action: onSay) {
                Text(person.isRemembered ? "Share a line" : "Say something")
                    .font(.system(size: 15, weight: .heavy))
                    .foregroundStyle(HivePalette.buzzInk)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 11)
                    .background(
                        LinearGradient(colors: [HivePalette.buzzTop, HivePalette.buzzBottom],
                                       startPoint: .top, endPoint: .bottom),
                        in: Capsule()
                    )
            }
            .buttonStyle(.plain)
            .padding(.top, 14)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background { panel }
        .overlay(alignment: .bottomTrailing) {
            CandleMark(height: 78, on: stage)
                .padding(.trailing, 26)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .strokeBorder(HivePalette.cellEdge, lineWidth: 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .onTapGesture(perform: onOpen)
        .accessibilityElement(children: .contain)
        .accessibilityHint("Opens \(PersonDay.possessive(person.trimmedName)) day")
    }

    private var kicker: String {
        if person.isRemembered { return isToday ? "REMEMBERING TODAY" : "REMEMBERING" }
        return isToday ? "TODAY" : "NEXT UP"
    }

    @ViewBuilder
    private var countdown: some View {
        if isToday {
            Text("Today")
                .font(.system(size: 64, weight: .black, design: .serif))
                .foregroundStyle(stage.type)
        } else {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(String(days))
                    .font(.system(size: 84, weight: .black, design: .serif))
                    .foregroundStyle(stage.type)
                    .monospacedDigit()
                    .contentTransition(.numericText())
                Text(days == 1 ? "day" : "days")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(stage.type.opacity(0.6))
            }
        }
    }

    /// "Turns 28 on a Friday". Somebody who has died is never said to turn
    /// anything, the rule `subtitle(for:)` in the list already keeps.
    private var turnsLine: AttributedString {
        var line = AttributedString()
        func plain(_ text: String) { line += AttributedString(text) }
        func strong(_ text: String) {
            var part = AttributedString(text)
            part.foregroundColor = stage.accent
            part.font = Font.system(size: 16, weight: .bold)
            line += part
        }
        if person.isRemembered {
            if let age { plain("Would have been "); strong(String(age)) } else { plain("Their day") }
        } else if isToday {
            if let age { plain("Turning "); strong(String(age)); plain(" today") } else { plain("It is today") }
            return line
        } else if let age {
            plain("Turns "); strong(String(age))
        } else {
            plain("Their birthday")
        }
        if !isToday, let landsOn { plain(" on a "); strong(landsOn) }
        return line
    }

    /// "Born on a Friday, too. September 25, 1998".
    private var bornLine: String? {
        let date = person.birthday.date.displayName()
        guard let year = person.birthday.year else { return nil }
        guard let bornOn else { return "\(date), \(year)" }
        let too = !isToday && bornOn == landsOn ? ", too" : ""
        return "Born on a \(bornOn)\(too). \(date), \(year)"
    }

    private var panel: some View {
        ZStack {
            stage.ground
            RadialGradient(
                colors: [Theme.honey.opacity(0.24), Theme.honey.opacity(0.0)],
                center: UnitPoint(x: 0.85, y: 0.1), startRadius: 0, endRadius: 320
            )
        }
    }
}
