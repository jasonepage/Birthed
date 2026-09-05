import SwiftUI

/// Three screens, no sign-in, no permission prompts.
///
/// `FR-007` caps this at four screens and forbids a sign-in screen.
/// `FR-002` and `FR-003` make the year optional and keep every feature working
/// without it. `FR-005` and `FR-006` make the location optional and keep the
/// operating system's location prompt out of onboarding entirely.
struct OnboardingView: View {
    enum Step: Int, CaseIterable {
        case day, year, place
    }

    let onFinish: (Profile) -> Void

    @State private var step: Step = .day
    @State private var month = 9
    @State private var day = 4
    @State private var observance: LeapObservance = .february28
    @State private var year: Int?
    @State private var region = ""
    @FocusState private var regionFocused: Bool

    private var chosenDate: CalendarDate {
        CalendarDate(month: month, day: day) ?? CalendarDate(month: 1, day: 1)!
    }

    var body: some View {
        ZStack {
            Theme.celebration.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                header
                Spacer(minLength: 12)
                card
                Spacer(minLength: 12)
                controls
            }
            .padding(.horizontal, 26)
            .padding(.vertical, 28)
        }
        .foregroundStyle(Theme.cream)
        .animation(.easeInOut(duration: 0.25), value: step)
    }

    // MARK: Pieces

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("BIRTHED")
                .font(.caption.weight(.heavy))
                .kerning(4)
                .opacity(0.75)

            Text(title)
                .font(Theme.display(.largeTitle))
                .lineLimit(3)
                .minimumScaleFactor(0.7)
                .fixedSize(horizontal: false, vertical: true)

            Text(subtitle)
                .font(.subheadline)
                .opacity(0.85)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var title: String {
        switch step {
        case .day: return "When is your day?"
        case .year: return "Which year?"
        case .place: return "Where are you?"
        }
    }

    /// Two rules for this copy. It says what the field buys, because a field
    /// with no stated reason gets skipped. And it does not overclaim, because
    /// the birthday, the year and the region are all sent to the Birthed
    /// account: the old line here said the year "is never sent to anyone
    /// else", which was not true of a value that goes straight into the
    /// profiles table. What is true is that nothing shared out of the app
    /// carries it, which `ShareCardView` enforces.
    private var subtitle: String {
        switch step {
        case .day:
            return "This is the only thing Birthed actually needs."
        case .year:
            return "Optional, but it is what turns on the number one song the week you were born, and the day of the week it was. Nothing you share out of Birthed ever shows it."
        case .place:
            return "Optional. A postal code or a city is enough, and it is the only location Birthed has: your device's location is never sent anywhere."
        }
    }

    @ViewBuilder
    private var card: some View {
        Group {
            switch step {
            case .day:
                BirthdayPicker(month: $month, day: $day, observance: $observance)
                    .tint(Theme.accentDeep)
            case .year:
                YearPicker(year: $year)
            case .place:
                TextField("97301, or Salem, Oregon", text: $region)
                    .textFieldStyle(.plain)
                    .font(.title3)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .focused($regionFocused)
                    .padding(.vertical, 44)
            }
        }
        .foregroundStyle(Color.primary)
        .padding(18)
        .frame(maxWidth: .infinity)
        .background(Theme.cream, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .colorScheme(.light)
    }

    private var controls: some View {
        VStack(spacing: 14) {
            HStack(spacing: 7) {
                ForEach(Step.allCases, id: \.rawValue) { value in
                    Capsule()
                        .fill(Theme.cream.opacity(value == step ? 1 : 0.35))
                        .frame(width: value == step ? 22 : 7, height: 7)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .animation(.easeInOut(duration: 0.25), value: step)

            Button(action: advance) {
                Text(step == .place ? "Start" : "Continue")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(Theme.cream, in: Capsule())
                    .foregroundStyle(Theme.accentDeep)
            }

            if step != .day {
                Button("Skip this", action: advance)
                    .font(.subheadline.weight(.semibold))
                    .opacity(0.9)
            } else {
                Text(chosenDate.displayName())
                    .font(.subheadline.weight(.semibold))
                    .opacity(0.9)
            }
        }
    }

    private func advance() {
        regionFocused = false
        switch step {
        case .day: step = .year
        case .year: step = .place
        case .place:
            let trimmed = region.trimmingCharacters(in: .whitespacesAndNewlines)
            onFinish(Profile(
                birthday: CalendarBirthday(date: chosenDate, year: year, leapObservance: observance),
                regionCode: trimmed.isEmpty ? nil : trimmed
            ))
        }
    }
}

/// A year, or no year at all, which is the default.
private struct YearPicker: View {
    @Binding var year: Int?

    private let years: [Int] = {
        let thisYear = Calendar(identifier: .gregorian).component(.year, from: Date())
        return Array((thisYear - 110)...thisYear).reversed()
    }()

    var body: some View {
        Picker("Year", selection: $year) {
            Text("Rather not say").tag(Int?.none)
            ForEach(years, id: \.self) { value in
                Text(String(value)).tag(Int?.some(value))
            }
        }
        .pickerStyle(.wheel)
        .frame(height: 170)
    }
}
