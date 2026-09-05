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

    private let monthNames = Calendar(identifier: .gregorian).monthSymbols

    private var daysInMonth: Int {
        switch month {
        case 2: return 29                      // always, see FR-001
        case 4, 6, 9, 11: return 30
        default: return 31
        }
    }

    private var isLeapDay: Bool { month == 2 && day == 29 }

    var body: some View {
        VStack(spacing: 14) {
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
            .frame(height: 150)
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
