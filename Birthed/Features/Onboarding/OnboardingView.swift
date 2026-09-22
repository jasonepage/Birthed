import SwiftUI

/// The first five minutes: your day, your year, and one person whose birthday
/// you keep forgetting. No sign-in, no permission prompts, and something true
/// on every screen before the next thing is asked for.
///
/// Redrawn on September 22, 2026 on the same dark honey stage as Mine and
/// People, so the app looks like itself from the first second rather than
/// from the second tab. `docs/first-five-minutes.md` says a person is
/// activated when they have entered a year and added one other person in the
/// first session. The first half was always here; the second was hidden in
/// the People tab, so it is the third screen now, and it can be skipped.
///
/// `FR-007` caps this at four screens and forbids a sign-in screen. `FR-002`
/// and `FR-003` make the year optional and keep every feature working without
/// it. The region lives in Settings, where it costs nobody a tap on the way
/// in, and the operating system's location prompt is nowhere near here.
///
/// The screens are not forms. The day wheel answers with how far away the day
/// is, which weekday it lands on, and one true thing that happened on it. The
/// year wheel answers with the day of the week, how many days that has been,
/// and, once it settles, the number one song that week, with its cover and a
/// sample a tap away. That is the best fact in the product and the year is the
/// field people skip, so it is paid for on the spot.
///
/// The day screen must never show who shares the date. That list led with
/// Ted Bundy and Charles Manson on the website's old share card; see
/// `DayLine` for why names were cut rather than filtered.
///
/// The lookups use only the anonymous key, the same as every other read in
/// the app, and the profile is not saved until the last button. The friend's
/// name is saved to the phone like every other person and goes nowhere else.
struct OnboardingView: View {
    enum Step: Int, CaseIterable {
        case day, year, person
    }

    let repository: DayPageRepository
    let onFinish: (Profile) -> Void

    @Environment(PeopleStore.self) private var people

    @State private var step: Step = .day
    @State private var confirming: Bool
    @State private var month: Int
    @State private var day: Int
    @State private var observance: LeapObservance
    @State private var year: Int
    /// Whether the reader kept the year. Decided on the year screen and
    /// saved with the profile after the person screen.
    @State private var keepsYear = true

    /// A replay from Settings is somebody looking at their own day again, so
    /// it ends after the year and never asks for a person.
    private let isFirstRun: Bool

    /// The one person, on the third screen.
    @State private var friendName = ""
    @State private var friendMonth: Int
    @State private var friendDay: Int
    @State private var friendObservance: LeapObservance = .february28
    @State private var pastingList = false
    @FocusState private var nameFocused: Bool

    @State private var region: String?

    @State private var happened: DayLine?
    @State private var song: ChartWeek?
    @State private var lineTask: Task<Void, Never>?
    @State private var songTask: Task<Void, Never>?
    @State private var preview = PreviewPlayer()

    private let calendar = BirthdayCalendar()
    private let stage = StagePalette.wax

    private static let thisYear = Calendar.current.component(.year, from: Date())
    private static let oldestYear = thisYear - 110

    /// A first run starts on September 4 and nineteen years ago. A replay
    /// starts on the day and year already saved. A first run that came from a
    /// link starts on the date the link named, with the wheel put away until
    /// somebody says the date is wrong. A link never applies to a replay.
    init(
        repository: DayPageRepository,
        starting profile: Profile? = nil,
        arriving: CalendarDate? = nil,
        onFinish: @escaping (Profile) -> Void
    ) {
        self.repository = repository
        self.onFinish = onFinish
        isFirstRun = profile == nil
        let birthday = profile?.birthday
        let arrived = profile == nil ? arriving : nil
        _confirming = State(initialValue: arrived != nil)
        _month = State(initialValue: birthday?.date.month ?? arrived?.month ?? 9)
        _day = State(initialValue: birthday?.date.day ?? arrived?.day ?? 4)
        _observance = State(initialValue: birthday?.leapObservance ?? .february28)
        _year = State(initialValue: birthday?.year ?? (OnboardingView.thisYear - 19))
        _region = State(initialValue: profile?.regionCode)
        // The friend's wheels start a week from today, which is the date
        // somebody is most likely to be worried about.
        let soon = Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
        _friendMonth = State(initialValue: Calendar.current.component(.month, from: soon))
        _friendDay = State(initialValue: Calendar.current.component(.day, from: soon))
    }

    private var steps: [Step] { isFirstRun ? Step.allCases : [.day, .year] }

    private var chosenDate: CalendarDate {
        CalendarDate(month: month, day: day) ?? CalendarDate(month: 1, day: 1)!
    }

    private func birthday(withYear: Bool) -> CalendarBirthday {
        CalendarBirthday(date: chosenDate, year: withYear ? year : nil, leapObservance: observance)
    }

    private var friendDate: CalendarDate {
        CalendarDate(month: friendMonth, day: friendDay) ?? CalendarDate(month: 1, day: 1)!
    }

    private var trimmedFriendName: String {
        friendName.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: The screen

    var body: some View {
        ZStack {
            background
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    Group {
                        switch step {
                        case .day: dayScreen
                        case .year: yearScreen
                        case .person: personScreen
                        }
                    }
                    .padding(.top, 20)
                }
                .padding(.horizontal, 24)
                .padding(.top, 12)
                .padding(.bottom, 12)
            }
            .scrollDismissesKeyboard(.interactively)
            .safeAreaInset(edge: .bottom) { controls }
        }
        .foregroundStyle(stage.type)
        .preferredColorScheme(.dark)
        .animation(.easeInOut(duration: 0.25), value: step)
        .sensoryFeedback(.selection, trigger: chosenDate)
        .sensoryFeedback(.selection, trigger: year)
        .sensoryFeedback(.success, trigger: song) { _, found in found != nil }
        .task { lookUpDayLine() }
        .onChange(of: chosenDate) { _, _ in
            lookUpDayLine()
            if step == .year { lookUpSong() }
        }
        .onChange(of: year) { _, _ in lookUpSong() }
        .onChange(of: step) { _, newStep in
            preview.stop()
            if newStep == .year { lookUpSong() }
        }
        .sheet(isPresented: $pastingList) {
            AddFriendsView { added in
                for person in added { people.add(person) }
                if !added.isEmpty { finish() }
            }
        }
    }

    /// The stage: the darkest ground with the honey glow in the top corner,
    /// the same light the Mine panel and the Next up card carry.
    private var background: some View {
        ZStack {
            Theme.ink
            RadialGradient(colors: [Theme.honey.opacity(0.20), .clear],
                           center: UnitPoint(x: 0.9, y: 0.05), startRadius: 0, endRadius: 520)
        }
        .ignoresSafeArea()
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            if step == .day {
                HStack(alignment: .bottom, spacing: 10) {
                    CandleMark(height: 44, on: stage)
                        .padding(.bottom, 2)
                    Text("BIRTHED")
                        .font(.caption.weight(.heavy))
                        .kerning(4)
                        .foregroundStyle(Theme.spark)
                        .padding(.bottom, 6)
                    Spacer()
                }
                .padding(.bottom, 8)
            } else {
                Text(kicker)
                    .font(.caption.weight(.heavy))
                    .kerning(2.8)
                    .foregroundStyle(stage.accent)
                    .padding(.top, 8)
            }

            Text(title)
                .font(.system(size: 40, weight: .heavy, design: .serif))
                .lineLimit(3)
                .minimumScaleFactor(0.7)
                .fixedSize(horizontal: false, vertical: true)
                .contentTransition(.opacity)

            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(stage.type.opacity(0.6))
                .fixedSize(horizontal: false, vertical: true)
                .contentTransition(.opacity)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var kicker: String {
        switch step {
        case .day: return ""
        case .year: return chosenDate.displayName().uppercased()
        case .person: return "ONE MORE"
        }
    }

    private var title: String {
        switch step {
        case .day:
            guard confirming else { return "When is your birthday?" }
            return chosenDate == CalendarDate.today() ? "Is today your birthday?" : "Is this your day?"
        case .year: return "Which year?"
        case .person: return "Whose birthday do you always forget?"
        }
    }

    private var subtitle: String {
        switch step {
        case .day:
            guard confirming else { return "The only thing Birthed needs." }
            return "Somebody sent you \(chosenDate.displayName()). If it is yours, that is the only thing Birthed needs."
        case .year:
            return "Optional. Your name is never on anything Birthed makes."
        case .person:
            return "Birthed reminds you the morning of and three days before. Their name stays on this phone."
        }
    }

    // MARK: Screen one, your day

    private var dayScreen: some View {
        VStack(alignment: .leading, spacing: 0) {
            if confirming {
                panel {
                    Text(chosenDate.displayName())
                        .font(.system(size: 46, weight: .black, design: .serif))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(20)
                }
            } else {
                panel {
                    BirthdayPicker(month: $month, day: $day, observance: $observance)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                }
            }

            countdown(to: birthday(withYear: false), label: { days in
                days == 0 ? "is your day" : (days == 1 ? "day away" : "days away")
            })
            .padding(.top, 22)

            if let happened {
                card {
                    kickerText("ON \(chosenDate.displayName().uppercased())", color: stage.accent)
                    Text("In \(String(happened.year)), \(lowercasedFirst(happened.text))")
                        .font(.system(size: 17, weight: .bold, design: .serif))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 16)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.45), value: happened)
    }

    /// The big number and the weekday under it, for your day and for theirs.
    private func countdown(to birthday: CalendarBirthday, label: (Int) -> String) -> some View {
        let now = Date()
        let days = calendar.daysUntil(birthday, from: now)
        let next = calendar.nextOccurrence(of: birthday, from: now)
        let weekday = PersonDay.weekdayName(calendar.calendar.component(.weekday, from: next))
        let nextYear = calendar.calendar.component(.year, from: next) > calendar.calendar.component(.year, from: now)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(days == 0 ? "Today" : String(days))
                    .font(.system(size: 64, weight: .black, design: .serif))
                    .monospacedDigit()
                    .contentTransition(.numericText(value: Double(days)))
                Text(label(days))
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(stage.type.opacity(0.6))
            }
            .animation(.snappy, value: days)
            if days > 0, let weekday {
                (Text("Lands on a ") + honey(weekday) + Text(nextYear ? " next year" : " this year"))
                    .font(.system(size: 16))
            }
        }
    }

    // MARK: Screen two, the year

    private var yearScreen: some View {
        let known = birthday(withYear: true)
        let daysAlive = calendar.daysAlive(known, on: Date())
        let weekday = calendar.birthWeekday(known).flatMap { PersonDay.weekdayName($0) }
        return VStack(alignment: .leading, spacing: 0) {
            panel {
                YearWheel(year: $year, newest: Self.thisYear, oldest: Self.oldestYear)
                    .padding(.horizontal, 8)
            }

            if let weekday, let daysAlive {
                (Text("Born on a ") + honey(weekday))
                    .font(.system(size: 17))
                    .padding(.top, 20)
                    .contentTransition(.opacity)
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(daysAlive.formatted())
                        .font(.system(size: 64, weight: .black, design: .serif))
                        .monospacedDigit()
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                        .contentTransition(.numericText(value: Double(daysAlive)))
                    Text("days old")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(stage.type.opacity(0.6))
                }
                .animation(.snappy, value: daysAlive)
            } else {
                Text("That day has not happened yet.")
                    .font(.subheadline)
                    .foregroundStyle(stage.type.opacity(0.6))
                    .padding(.top, 20)
            }

            if let song {
                card {
                    // The one pink kicker, the song's, as on Mine.
                    kickerText("NUMBER ONE THE WEEK YOU WERE BORN", color: Theme.spark)
                    HStack(spacing: 12) {
                        cover(song)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(song.song)
                                .font(.system(size: 20, weight: .heavy, design: .serif))
                                .lineLimit(2)
                                .minimumScaleFactor(0.7)
                            Text(song.artist)
                                .font(.footnote)
                                .foregroundStyle(HivePalette.cellDim)
                                .lineLimit(1)
                        }
                    }
                }
                .padding(.top, 14)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.5), value: song)
    }

    /// The cover, with the sample a tap away. Never played on its own: sound
    /// nobody asked for is the fastest way to be put face down on a table.
    private func cover(_ song: ChartWeek) -> some View {
        ZStack {
            AsyncImage(url: song.artworkURL) { phase in
                if case let .success(image) = phase {
                    image.resizable().aspectRatio(contentMode: .fill)
                } else {
                    LinearGradient(colors: [Color(red: 0.42, green: 0.29, blue: 0.16), HivePalette.cell],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                }
            }
            if song.previewURL != nil {
                Circle().fill(.black.opacity(0.42)).frame(width: 30, height: 30)
                Image(systemName: preview.nowPlaying == song.previewURL ? "pause.fill" : "play.fill")
                    .font(.system(size: 13, weight: .black))
                    .foregroundStyle(.white)
            }
        }
        .frame(width: 64, height: 64)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .onTapGesture {
            if let sample = song.previewURL { preview.toggle(sample) }
        }
        .accessibilityLabel(song.previewURL == nil ? song.song : "Play a sample of \(song.song)")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: Screen three, one person

    private var personScreen: some View {
        VStack(alignment: .leading, spacing: 0) {
            TextField("", text: $friendName, prompt: Text("Their name").foregroundStyle(stage.type.opacity(0.35)))
                .font(.system(size: 19))
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .submitLabel(.done)
                .focused($nameFocused)
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(HivePalette.cell, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(nameFocused || !trimmedFriendName.isEmpty ? Theme.honey : HivePalette.cellEdge, lineWidth: 1.5)
                )

            panel {
                BirthdayPicker(month: $friendMonth, day: $friendDay, observance: $friendObservance)
                    .padding(.horizontal, 8)
            }
            .padding(.top, 12)

            let friend = CalendarBirthday(date: friendDate, leapObservance: friendObservance)
            let days = calendar.daysUntil(friend, from: Date())
            let weekday = PersonDay.weekdayName(PersonDay(calendar: calendar).nextWeekday(of: friend, from: Date()))
            Group {
                if days == 0 {
                    Text("That is today.")
                } else {
                    (Text("In ") + honey(days == 1 ? "1 day" : "\(days) days")
                        + Text(weekday == nil ? "" : ", on a ") + honey(weekday ?? ""))
                }
            }
            .font(.system(size: 16))
            .padding(.top, 14)
        }
    }

    // MARK: Pieces

    /// The honey panel the wheels sit on: the Mine panel's ground and glow,
    /// with the wheels drawn in the dark appearance so they read on it.
    private func panel<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        content()
            .frame(maxWidth: .infinity)
            .background {
                ZStack {
                    stage.ground
                    RadialGradient(colors: [Theme.honey.opacity(0.22), .clear],
                                   center: UnitPoint(x: 0.85, y: 0.05), startRadius: 0, endRadius: 300)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(HivePalette.cellEdge, lineWidth: 1))
            .environment(\.colorScheme, .dark)
    }

    private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8, content: content)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HivePalette.cell, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(HivePalette.cellEdge, lineWidth: 1))
    }

    private func kickerText(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption.weight(.heavy))
            .kerning(2.4)
            .foregroundStyle(color)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func honey(_ text: String) -> Text {
        Text(text).foregroundColor(Theme.accentSoft).fontWeight(.bold)
    }

    /// "In 1998, the Beatles..." rather than "In 1998, The Beatles...". Only
    /// the articles are lowered; a sentence that opens with a name keeps it.
    private func lowercasedFirst(_ text: String) -> String {
        for article in ["The ", "A ", "An "] where text.hasPrefix(article) {
            return article.lowercased() + text.dropFirst(article.count)
        }
        return text
    }

    // MARK: Controls

    private var controls: some View {
        VStack(spacing: 12) {
            Button(action: advance) {
                Text(primaryLabel)
                    .font(.headline)
                    .foregroundStyle(HivePalette.buzzInk)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        LinearGradient(colors: [HivePalette.buzzTop, HivePalette.buzzBottom],
                                       startPoint: .top, endPoint: .bottom),
                        in: Capsule()
                    )
                    .opacity(primaryDisabled ? 0.45 : 1)
            }
            .buttonStyle(.plain)
            .disabled(primaryDisabled)

            secondary
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(stage.type.opacity(0.6))

            HStack(spacing: 7) {
                ForEach(steps, id: \.rawValue) { value in
                    Capsule()
                        .fill(value == step ? Theme.honey : HivePalette.cellEdge)
                        .frame(width: value == step ? 22 : 7, height: 7)
                }
            }
            .animation(.easeInOut(duration: 0.25), value: step)
        }
        .padding(.horizontal, 24)
        .padding(.top, 10)
        .padding(.bottom, 8)
        .background(Theme.ink.opacity(0.94).ignoresSafeArea(edges: .bottom))
    }

    @ViewBuilder
    private var secondary: some View {
        switch step {
        case .day:
            if confirming {
                Button("No, my day is another one") { confirming = false }
            } else {
                Text(" ")
            }
        case .year:
            Button("Skip the year") {
                keepsYear = false
                goOnFromYear()
            }
        case .person:
            HStack {
                Button("Paste a list instead") { pastingList = true }
                Spacer()
                Button("Later") { finish() }
            }
        }
    }

    private var primaryLabel: String {
        switch step {
        case .day: return confirming ? "Yes, that is my day" : "Continue"
        case .year: return "That's me"
        case .person:
            return trimmedFriendName.isEmpty ? "Add them" : "Add \(PersonDay.shortName(trimmedFriendName))"
        }
    }

    private var primaryDisabled: Bool {
        step == .person && trimmedFriendName.isEmpty
    }

    private func advance() {
        switch step {
        case .day:
            step = .year
        case .year:
            keepsYear = true
            goOnFromYear()
        case .person:
            guard !trimmedFriendName.isEmpty else { return }
            people.add(Person(
                name: trimmedFriendName,
                birthday: CalendarBirthday(date: friendDate, leapObservance: friendObservance)
            ))
            finish()
        }
    }

    private func goOnFromYear() {
        if isFirstRun {
            step = .person
        } else {
            finish()
        }
    }

    private func finish() {
        lineTask?.cancel()
        songTask?.cancel()
        preview.stop()
        onFinish(Profile(birthday: birthday(withYear: keepsYear), regionCode: region))
    }

    // MARK: Lookups

    private func lookUpDayLine() {
        lineTask?.cancel()
        // Copied out before the task is made, because a child task may only
        // carry what is Sendable and a view is not.
        let date = chosenDate
        let repository = self.repository
        // Cleared at once, because a line about September 4 under a countdown
        // to September 12 is wrong rather than merely late.
        happened = nil
        lineTask = Task {
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }

            let facts = (try? await repository.birthFacts(on: date, limit: 30)) ?? []
            guard !Task.isCancelled else { return }
            if let line = DayLine.choose(facts: facts, events: [], on: date) {
                happened = line
                return
            }

            let events = (try? await repository.events(on: date, limit: 150)) ?? []
            guard !Task.isCancelled else { return }
            // Nil when the date has nothing that passes, and nil is shown as
            // nothing. It is never shown as a name.
            happened = DayLine.choose(facts: [], events: events, on: date)
        }
    }

    private func lookUpSong() {
        songTask?.cancel()
        let date = chosenDate
        let year = year
        let repository = self.repository
        song = nil
        songTask = Task {
            try? await Task.sleep(for: .milliseconds(450))
            guard !Task.isCancelled else { return }
            // try? on a call that already returns an optional gives a double
            // optional, and the flatten is what keeps that from being a
            // warning and a song that never shows.
            let found = (try? await repository.numberOneSong(theWeekOf: date, birthYear: year)) ?? nil
            guard !Task.isCancelled else { return }
            song = found
        }
    }
}

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
        .frame(height: 170)
    }
}
