import SwiftUI

/// Month and day, and nothing else unless the day needs it.
///
/// `FR-001` requires February 29 to be selectable, so the day list is built
/// from the longest possible month rather than from this year's calendar.
/// When February 29 is chosen, `FR-037` gets its question, right there rather
/// than buried in settings.
struct BirthdayPicker: View {
    @Binding var month: Int
    @Binding var day: Int
    @Binding var observance: LeapObservance
    /// Whether to say the chosen date in words above the wheels. On for
    /// screens that do not already show it somewhere larger.
    var showsChoice: Bool = false

    /// Gregorian for the calendar, the reader's locale for the words.
    ///
    /// `Calendar(identifier:)` comes with no locale at all, and month symbols
    /// on a calendar with no locale are the root locale's: M01, M02, M03. That
    /// shipped, and it was on the first screen of onboarding. The identifier is
    /// still pinned so that somebody whose phone is on a non Gregorian calendar
    /// is choosing the same twelve months everybody else is, but the names of
    /// those months are theirs.
    private let monthNames: [String] = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = .current
        return calendar.monthSymbols
    }()

    private var daysInMonth: Int {
        switch month {
        case 2: return 29                      // always, see FR-001
        case 4, 6, 9, 11: return 30
        default: return 31
        }
    }

    private var isLeapDay: Bool { month == 2 && day == 29 }

    /// "March 14", from the same place every other screen gets it.
    private var chosen: String {
        CalendarDate(month: month, day: day)?.displayName() ?? ""
    }

    var body: some View {
        VStack(spacing: 14) {
            if showsChoice {
                // Two wheels are a control, not an answer. This is the answer,
                // and it reads the same way the rest of the app writes a date.
                Text(chosen)
                    .font(Theme.display(.title2, weight: .bold))
                    .foregroundStyle(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentTransition(.opacity)
                    .animation(.easeInOut(duration: 0.15), value: chosen)
            }

            HStack(spacing: 0) {
                Picker("Month", selection: $month) {
                    ForEach(1...12, id: \.self) { value in
                        Text(monthNames[value - 1]).tag(value)
                    }
                }
                .pickerStyle(.wheel)
                .frame(maxWidth: .infinity)

                Picker("Day", selection: $day) {
                    ForEach(1...daysInMonth, id: \.self) { value in
                        Text(String(value)).tag(value)
                    }
                }
                .pickerStyle(.wheel)
                .frame(width: 110)
            }
            .frame(height: 170)
            .onChange(of: month) { _, _ in
                if day > daysInMonth { day = daysInMonth }
            }

            if isLeapDay {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Three years in four, February 29 does not happen. Which day should Birthed use instead?")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Picker("Observed day", selection: $observance) {
                        Text("February 28").tag(LeapObservance.february28)
                        Text("March 1").tag(LeapObservance.march1)
                    }
                    .pickerStyle(.segmented)
                }
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: isLeapDay)
    }
}
