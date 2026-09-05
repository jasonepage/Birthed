import SwiftUI

/// Two screens, no sign-in, no permission prompts, and something true about
/// the person on every one of them before they are asked for the next thing.
///
/// `FR-007` caps this at four screens and forbids a sign-in screen. `FR-002`
/// and `FR-003` make the year optional and keep every feature working
/// without it. The place screen is gone: with the catalog cut, nothing on any
/// screen reads the region, so it lives in Settings where it costs nobody a
/// tap on the way in. `FR-005` and `FR-006` still hold, since the operating
/// system's location prompt is nowhere near here.
///
/// The screens are not forms. The day wheel answers with how far away the day
/// is and who shares it. The year wheel answers, as it turns, with the day of
/// the week and how many days that has been, and once it settles, with the
/// number one song that week. That is the best fact in the product, it needs
/// the year, and the year is the field people skip. So it is paid for on the
/// spot.
///
/// The lookups use only the anonymous key, the same as every other read in
/// the app, and the profile is not saved until the last button. Offline, the
/// wheel still answers with the weekday and the day count, and the song is
/// simply absent rather than an error.
struct OnboardingView: View {
    enum Step: Int, CaseIterable {
        case day, year
    }

    let repository: DayPageRepository
    let onFinish: (Profile) -> Void

    @State private var step: Step = .day
    @State private var month = 9
    @State private var day = 4
    @State private var observance: LeapObservance = .february28
    @State private var year: Int = OnboardingView.thisYear - 19

    @State private var twins: [NotablePerson] = []
    @State private var song: ChartWeek?
    @State private var album: ChartWeek?
    @State private var film: ChartWeek?
    @State private var twinsTask: Task<Void, Never>?
    @State private var songTask: Task<Void, Never>?

    private let calendar = BirthdayCalendar()
    private let facts = DateFacts()

    private static let thisYear = Calendar.current.component(.year, from: Date())
    private static let oldestYear = thisYear - 110

    private var chosenDate: CalendarDate {
        CalendarDate(month: month, day: day) ?? CalendarDate(month: 1, day: 1)!
    }

    /// The birthday as the wheels currently describe it. Both screens read
    /// from this so the year screen's facts are already right if somebody
    /// goes back and changes the day.
    private func birthday(withYear: Bool) -> CalendarBirthday {
        CalendarBirthday(date: chosenDate, year: withYear ? year : nil, leapObservance: observance)
    }

    var body: some View {
        ZStack {
            Theme.celebration.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                header
                Spacer(minLength: 10)
                card
                Spacer(minLength: 10)
                controls
            }
            .padding(.horizontal, 24)
            .padding(.top, 18)
            .padding(.bottom, 24)
        }
        .foregroundStyle(Theme.cream)
        .animation(.easeInOut(duration: 0.25), value: step)
        .sensoryFeedback(.selection, trigger: chosenDate)
        .sensoryFeedback(.selection, trigger: year)
        .sensoryFeedback(.success, trigger: song) { _, found in found != nil }
        .task { lookUpTwins() }
        .onChange(of: chosenDate) { _, _ in
            lookUpTwins()
            if step == .year { lookUpSong() }
        }
        .onChange(of: year) { _, _ in lookUpSong() }
        .onChange(of: step) { _, newStep in
            if newStep == .year { lookUpSong() }
        }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .bottom, spacing: 10) {
                CandleMark(height: 44)
                    .padding(.bottom, 2)
                Text("BIRTHED")
                    .font(.caption.weight(.heavy))
                    .kerning(4)
                    .opacity(0.8)
                    .padding(.bottom, 6)
                Spacer()
            }

            Text(title)
                .font(Theme.display(.largeTitle))
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .fixedSize(horizontal: false, vertical: true)
                .contentTransition(.opacity)

            Text(subtitle)
                .font(.subheadline)
                .opacity(0.88)
                .fixedSize(horizontal: false, vertical: true)
                .contentTransition(.opacity)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var title: String {
        switch step {
        case .day: return "When is your day?"
        case .year: return "Which year?"
        }
    }

    /// Two rules for this copy. It says what the field buys, because a field
    /// with no stated reason gets skipped. And it does not overclaim: the
    /// birthday and the year are both sent to the Birthed account, so nothing
    /// here says or implies they stay on the phone. What is true, and what
    /// the second line says, is that no card Birthed makes carries a name.
    private var subtitle: String {
        switch step {
        case .day:
            return "This is the only thing Birthed needs."
        case .year:
            return "Optional. It turns on the number one song the week you were born, and the day of the week it was. Your name is never on anything Birthed makes."
        }
    }

    // MARK: The card

    @ViewBuilder
    private var card: some View {
        VStack(spacing: 0) {
            switch step {
            case .day:
                BirthdayPicker(month: $month, day: $day, observance: $observance)
                    .tint(Theme.accentDeep)
                dayReveal
            case .year:
                YearWheel(year: $year, newest: Self.thisYear, oldest: Self.oldestYear)
                yearReveal
            }
        }
        .foregroundStyle(Color.primary)
        .padding(.horizontal, 18)
        .padding(.top, 8)
        .padding(.bottom, 18)
        .frame(maxWidth: .infinity)
        .background(Theme.cream, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .colorScheme(.light)
    }

    /// What the day wheel gives back: the countdown, which is offline and
    /// instant, and the three people the date is best known for, which
    /// arrives a beat after the wheel settles.
    private var dayReveal: some View {
        let until = calendar.daysUntil(birthday(withYear: false), from: Date())

        return VStack(alignment: .leading, spacing: 10) {
            Divider().padding(.bottom, 4)

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(until == 0 ? "Today" : "\(until)")
                    .font(Theme.display(.title))
                    .foregroundStyle(Theme.accentDeep)
                    .contentTransition(.numericText(value: Double(until)))
                    .monospacedDigit()
                Text(until == 0 ? "is your day" : (until == 1 ? "day away" : "days away"))
                    .font(.headline)
                    .foregroundStyle(.secondary)
            }
            .animation(.snappy, value: until)

            HStack(spacing: 6) {
                let sign = facts.zodiacSign(for: chosenDate)
                Text("\(sign.symbol) \(sign.rawValue)")
                Text("·").foregroundStyle(.tertiary)
                Text(facts.birthstone(for: chosenDate))
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.secondary)
            .contentTransition(.opacity)
            .animation(.snappy, value: chosenDate)

            if !twins.isEmpty {
                VStack(alignment: .leading, spacing: 3) {
                    Text("You share it with")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(twins.map(\.name).joined(separator: ", "))
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(2)
                        .minimumScaleFactor(0.85)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(.spring(duration: 0.45), value: twins)
    }

    /// What the year wheel gives back. The weekday and the day count follow
    /// the wheel live and need no network. The song lands once the wheel
    /// stops, with the candle beside it.
    private var yearReveal: some View {
        let known = birthday(withYear: true)
        let daysAlive = calendar.daysAlive(known, on: Date())
        let weekdayName = calendar.birthWeekday(known).flatMap { number -> String? in
            let names = Calendar.current.weekdaySymbols
            guard number >= 1, number <= names.count else { return nil }
            return names[number - 1]
        }

        return VStack(alignment: .leading, spacing: 12) {
            Divider().padding(.bottom, 2)

            if let weekdayName, let daysAlive {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("Born on a")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                    Text(weekdayName)
                        .font(Theme.display(.title2))
                        .foregroundStyle(Theme.accentDeep)
                        .contentTransition(.opacity)
                }

                if let animal = facts.chineseAnimal(for: known) {
                    Text("Year of the \(animal.rawValue)")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .contentTransition(.opacity)
                }

                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(daysAlive.formatted())
                        .font(Theme.display(.title2))
                        .foregroundStyle(Theme.accentDeep)
                        .monospacedDigit()
                        .contentTransition(.numericText(value: Double(daysAlive)))
                    Text("days ago")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                }
            } else {
                Text("That day has not happened yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            if let song {
                HStack(alignment: .top, spacing: 14) {
                    CandleMark(height: 58)
                        .padding(.top, 2)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("NUMBER ONE THAT WEEK")
                            .font(.caption2.weight(.heavy))
                            .kerning(2)
                            .foregroundStyle(Theme.accentDeep)
                        Text(song.song)
                            .font(Theme.display(.title3, weight: .bold))
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                        Text(song.artist)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        if album != nil || film != nil {
                            Text(alsoNumberOne)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                                .padding(.top, 4)
                                .transition(.opacity)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .padding(.top, 2)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(.snappy, value: daysAlive)
        .animation(.snappy, value: weekdayName)
        .animation(.spring(duration: 0.5), value: song)
        .animation(.easeInOut(duration: 0.3), value: album)
        .animation(.easeInOut(duration: 0.3), value: film)
    }

    /// "Album: Nellyville, Nelly. Film: Signs." One line, so the song stays
    /// the headline and the card does not grow past a small screen.
    private var alsoNumberOne: String {
        var parts: [String] = []
        if let album { parts.append("Album: \(album.song), \(album.artist)") }
        if let film { parts.append("Film: \(film.song)") }
        return parts.joined(separator: "  ")
    }

    // MARK: Controls

    private var controls: some View {
        VStack(spacing: 12) {
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
                Text(step == .year ? "Start" : "Continue")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(Theme.cream, in: Capsule())
                    .foregroundStyle(Theme.accentDeep)
            }

            if step == .year {
                Button("Skip the year", action: finishWithoutYear)
                    .font(.subheadline.weight(.semibold))
                    .opacity(0.9)
            } else {
                Text(chosenDate.displayName())
                    .font(.subheadline.weight(.semibold))
                    .opacity(0.9)
            }
        }
    }

    // MARK: Actions

    private func advance() {
        switch step {
        case .day:
            step = .year
        case .year:
            finish(with: birthday(withYear: true))
        }
    }

    private func finishWithoutYear() {
        finish(with: birthday(withYear: false))
    }

    private func finish(with birthday: CalendarBirthday) {
        twinsTask?.cancel()
        songTask?.cancel()
        onFinish(Profile(birthday: birthday, regionCode: nil))
    }

    /// Waits for the wheel to stop before asking, so a flick through six
    /// months is one request rather than six.
    private func lookUpTwins() {
        twinsTask?.cancel()
        let date = chosenDate
        twinsTask = Task {
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            let people = (try? await repository.notablePeople(bornOn: date, limit: 3)) ?? []
            guard !Task.isCancelled else { return }
            twins = people
        }
    }

    private func lookUpSong() {
        songTask?.cancel()
        let date = chosenDate
        let year = year
        song = nil
        album = nil
        film = nil
        songTask = Task {
            try? await Task.sleep(for: .milliseconds(450))
            guard !Task.isCancelled else { return }
            // try? on a call that already returns an optional gives a double
            // optional, and the flatten is what keeps that from being a
            // warning and a song that never shows.
            let found = (try? await repository.numberOneSong(theWeekOf: date, birthYear: year)) ?? nil
            guard !Task.isCancelled else { return }
            song = found
            let foundAlbum = (try? await repository.numberOne(on: .billboard200, theWeekOf: date, birthYear: year)) ?? nil
            guard !Task.isCancelled else { return }
            album = foundAlbum
            let foundFilm = (try? await repository.numberOne(on: .boxOffice, theWeekOf: date, birthYear: year)) ?? nil
            guard !Task.isCancelled else { return }
            film = foundFilm
        }
    }
}

/// A year, newest first, with no "rather not say" row: skipping is a button,
/// not a wheel position, so the wheel is always sitting on a real year and
/// always has something true to say about it.
private struct YearWheel: View {
    @Binding var year: Int
    let newest: Int
    let oldest: Int

    var body: some View {
        Picker("Year", selection: $year) {
            ForEach(Array((oldest...newest).reversed()), id: \.self) { value in
                Text(String(value)).tag(value)
            }
        }
        .pickerStyle(.wheel)
        .frame(height: 150)
    }
}
