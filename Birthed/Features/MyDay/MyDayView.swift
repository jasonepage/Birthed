import SwiftUI

/// Your day, set like the card you would share about it.
///
/// This screen and `MyDayShareCard` are the same picture on purpose: the
/// same ground, the same candle in the same corner, the same facts in the
/// same order. What somebody screenshots is what the share button exports.
/// The ground follows the system appearance, ink in dark and cream in light,
/// and the export follows the screen.
///
/// `FR-034` counts in whole local days. `FR-035` switches to a distinct state
/// on the birthday rather than showing a zero. `FR-036` says so out loud when
/// a February 29 birthday is being observed on another date.
struct MyDayView: View {
    let profile: Profile
    let repository: DayPageRepository
    let onOpenSettings: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    @State private var twins: [NotablePerson] = []
    @State private var song: ChartWeek?
    /// The other number ones that week, by chart. Loaded alongside the song
    /// and shown under it; each is absent rather than guessed when no chart
    /// week covers the birth date.
    @State private var others: [ChartWeek.Chart: ChartWeek] = [:]
    @State private var shareImage: Image?
    @State private var lit = true
    @State private var relightTask: Task<Void, Never>?

    private let calendar = BirthdayCalendar()
    private let facts = DateFacts()
    private var now: Date { Date() }
    private var palette: StagePalette { .forScheme(colorScheme) }

    private var isBirthday: Bool { calendar.isBirthdayToday(profile.birthday, on: now) }
    private var daysAway: Int { calendar.daysUntil(profile.birthday, from: now) }
    private var daysAlive: Int? { calendar.daysAlive(profile.birthday, on: now) }
    private var observed: CalendarDate {
        calendar.observedDate(for: profile.birthday,
                              in: Calendar.current.component(.year, from: now))
    }

    /// "Sunday", when the year is known. `Calendar` numbers weekdays from one
    /// and its symbols from zero, which is the off by one this line exists to
    /// get right in one place.
    private var birthWeekdayName: String? {
        guard let weekday = calendar.birthWeekday(profile.birthday) else { return nil }
        let names = Calendar.current.weekdaySymbols
        guard weekday >= 1, weekday <= names.count else { return nil }
        return names[weekday - 1]
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    stage
                    if !twins.isEmpty { twinsCard }
                    leapNote
                    sources
                }
                .padding(.bottom, 36)
            }
            .background(palette.ground.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if let shareImage {
                        ShareLink(
                            item: shareImage,
                            preview: SharePreview(profile.birthday.date.displayName(), image: shareImage)
                        ) {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                        .tint(palette.type)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: onOpenSettings) {
                        Label("Settings", systemImage: "gearshape")
                    }
                    .tint(palette.type)
                }
            }
            // Separate tasks, so no request waits on another.
            .task { await loadTwins() }
            .task { await loadSong() }
            .task { await loadOthers() }
            .onChange(of: colorScheme) { _, _ in shareImage = renderShareCard() }
            .sensoryFeedback(.impact(weight: .heavy), trigger: lit) { _, isLit in !isLit }
        }
        .tint(Theme.accent)
    }

    // MARK: The stage

    /// The text column is the only thing that takes layout space. The glow,
    /// the candle and the confetti ride in a background and an overlay, so
    /// nothing here can be wider than the screen: a 600 point circle inside
    /// the stack was making the whole stage 600 wide, and the scroll view was
    /// centring it and cutting the left edge off the date.
    private var stage: some View {
        VStack(alignment: .leading, spacing: 0) {
            kicker(isBirthday ? "TODAY" : "YOUR DAY")

            Spacer().frame(height: 8)

            if isBirthday {
                Text("Happy birthday")
                    .font(.system(size: 54, weight: .black, design: .serif))
                    .foregroundStyle(palette.type)
                    .lineLimit(2)
                    .minimumScaleFactor(0.6)
                Text(observed.displayName())
                    .font(Theme.display(.title2))
                    .foregroundStyle(palette.type.opacity(0.7))
                    .padding(.top, 4)
            } else {
                Text(profile.birthday.date.displayName())
                    .font(.system(size: 54, weight: .black, design: .serif))
                    .foregroundStyle(palette.type)
                    .lineLimit(2)
                    .minimumScaleFactor(0.5)
            }

            if let birthWeekdayName {
                Text("born on a \(birthWeekdayName)")
                    .font(.title3)
                    .foregroundStyle(palette.type.opacity(0.55))
                    .padding(.top, 6)
            }

            Spacer().frame(height: 30)

            if let song {
                songBlock(song)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            } else if profile.birthday.year == nil {
                yearNudge
            }

            otherNumberOnes

            Spacer().frame(height: 40)

            counters

            milestoneLine

            Spacer().frame(height: 22)

            chips

            if isBirthday {
                Text("Hold the candle to blow it out")
                    .font(.footnote)
                    .foregroundStyle(palette.type.opacity(0.45))
                    .padding(.top, 14)
            }
        }
        .padding(.horizontal, 22)
        .padding(.top, 6)
        .padding(.bottom, 30)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .frame(minHeight: isBirthday ? 600 : 540, alignment: .top)
        .animation(.spring(duration: 0.6), value: song)
        .background(alignment: .bottomTrailing) { glow }
        .overlay(alignment: .bottomTrailing) { candle }
        .overlay {
            if isBirthday {
                ConfettiBurst()
            }
        }
        .clipped()
    }

    /// The light the candle throws, centred on its flame. In a background it
    /// takes no layout space, so it can be any size without moving the text.
    private var glow: some View {
        let candleHeight: CGFloat = isBirthday ? 300 : 230
        let drop: CGFloat = isBirthday ? 34 : 52
        let flameHeight = candleHeight * 0.484
        let flameWidth = flameHeight * (100.0 / 95.0)
        // Where the flame's centre sits, measured from the stage's bottom
        // trailing corner: the candle is padded 28 from the edge and pushed
        // down by `drop`, and the flame's centre is about 55 percent of the
        // way down the flame.
        let centreUp = candleHeight - flameHeight * 0.55 - drop
        let centreIn = 28 + flameWidth / 2
        let size: CGFloat = 340
        return Circle()
            .fill(RadialGradient(
                colors: [palette.glow.opacity(0.28), palette.glow.opacity(0.05), .clear],
                center: .center, startRadius: 6, endRadius: size / 2
            ))
            .frame(width: size, height: size)
            .offset(x: size / 2 - centreIn, y: size / 2 - centreUp)
            .allowsHitTesting(false)
    }

    private var candle: some View {
        CandleMark(height: isBirthday ? 300 : 230, lit: lit)
            .padding(.trailing, 28)
            .offset(y: isBirthday ? 34 : 52)
            .onLongPressGesture(minimumDuration: 0.5, perform: { blowOut() })
            .accessibilityLabel(lit ? "A lit candle. Hold to blow it out." : "A candle, blown out")
            .animation(.spring(duration: 0.6), value: isBirthday)
    }

    private func kicker(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.heavy))
            .kerning(3)
            .foregroundStyle(Theme.accent)
    }

    /// The one fact on this screen that somebody would read out loud to a
    /// friend, so it is set like a title rather than like a row. It needs a
    /// birth year, and it shows nothing at all when there is no chart
    /// covering that week rather than reaching for the nearest one.
    private func songBlock(_ song: ChartWeek) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            kicker("NUMBER ONE THE WEEK YOU WERE BORN")

            Text(song.song)
                .font(.system(size: 40, weight: .black, design: .serif))
                .foregroundStyle(palette.type)
                .lineLimit(3)
                .minimumScaleFactor(0.6)
                .fixedSize(horizontal: false, vertical: true)

            Text(song.artist)
                .font(.title3)
                .foregroundStyle(palette.type.opacity(0.6))
                .lineLimit(2)

            // The issue date is here because it is what makes the claim
            // checkable rather than something Birthed asserts.
            Text(song.attribution())
                .font(.caption)
                .foregroundStyle(palette.type.opacity(0.4))
                .padding(.top, 2)
        }
        .padding(.trailing, 36)
    }

    /// The album and the film, under the song. Smaller, because the song is
    /// the one people read out loud, but the same shape so the screen reads
    /// as one list of what was number one that week.
    private var otherNumberOnes: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach([ChartWeek.Chart.billboard200, .boxOffice], id: \.rawValue) { chart in
                if let week = others[chart] {
                    VStack(alignment: .leading, spacing: 2) {
                        kicker("NUMBER ONE \(chart.noun.uppercased())")
                        Text(week.song)
                            .font(Theme.display(.title3, weight: .bold))
                            .foregroundStyle(palette.type)
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                            .fixedSize(horizontal: false, vertical: true)
                        if chart.hasCredit, !week.artist.isEmpty {
                            Text(week.artist)
                                .font(.subheadline)
                                .foregroundStyle(palette.type.opacity(0.6))
                                .lineLimit(1)
                        }
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .padding(.top, others.isEmpty ? 0 : 18)
        .padding(.trailing, 36)
        .animation(.spring(duration: 0.6), value: others)
    }

    /// The row is the control: tapping the sentence opens Settings, where the
    /// year is edited in place.
    private var yearNudge: some View {
        Button(action: onOpenSettings) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "music.note")
                    .foregroundStyle(Theme.accent)
                Text("Add your birth year to see the number one song the week you were born.")
                    .font(.subheadline)
                    .foregroundStyle(palette.type.opacity(0.65))
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .buttonStyle(.plain)
        .padding(.trailing, 120)
    }

    private var counters: some View {
        VStack(alignment: .leading, spacing: 10) {
            if isBirthday {
                if let age = calendar.ageOnNextBirthday(profile.birthday, from: now) {
                    counter(age, label: "today")
                }
            } else {
                counter(daysAway, label: daysAway == 1 ? "day to go" : "days to go")
            }
            if let daysAlive {
                counter(daysAlive, label: "days old")
            }
        }
        .padding(.trailing, 130)
    }

    /// "9,000 days old on April 26, 2027." Arithmetic, so it never needs the
    /// network and it changes the day it lands.
    @ViewBuilder
    private var milestoneLine: some View {
        if let milestone = facts.nextMilestone(for: profile.birthday, from: now) {
            let when = milestone.daysAway == 0
                ? "today"
                : "on \(milestone.date.formatted(.dateTime.month(.wide).day().year()))"
            Text("\(milestone.days.formatted()) days old \(when)")
                .font(.subheadline)
                .foregroundStyle(palette.type.opacity(0.55))
                .padding(.top, 6)
                .padding(.trailing, 130)
        }
    }

    /// The small true things. Each one is labelled with what it is, and the
    /// two that come from traditional lists say so, because a birthstone is
    /// an entry in a list, not a fact about the person.
    private var chips: some View {
        let date = profile.birthday.date
        let sign = facts.zodiacSign(for: date)
        let thisYear = Calendar.current.component(.year, from: now)

        return FlowLayout(spacing: 8) {
            FactChip(label: "Sign", value: "\(sign.symbol) \(sign.rawValue)", palette: palette)
            if let animal = facts.chineseAnimal(for: profile.birthday) {
                FactChip(label: "Chinese zodiac", value: "Year of the \(animal.rawValue)", palette: palette)
            }
            if let dayNumber = facts.dayOfYear(profile.birthday, in: profile.birthday.year ?? thisYear) {
                FactChip(label: "Day of the year", value: "\(dayNumber) of \(calendar.isLeapYear(profile.birthday.year ?? thisYear) ? 366 : 365)", palette: palette)
            }
            FactChip(label: "Birthstone", value: facts.birthstone(for: date), palette: palette)
            FactChip(label: "Birth flower", value: facts.birthFlower(for: date), palette: palette)
        }
        .padding(.trailing, 110)
    }

    private func counter(_ value: Int, label: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            CountingNumber(value: value)
                .font(.system(size: 50, weight: .black, design: .serif))
                .foregroundStyle(palette.type)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            Text(label)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(palette.type.opacity(0.55))
        }
    }

    // MARK: Below the stage

    private var twinsCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("You share \(profile.birthday.date.displayName()) with")
                .font(.headline)
                .foregroundStyle(palette.type)

            ForEach(twins) { person in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text(person.birthYear.map { String($0) } ?? "")
                        .font(.footnote.weight(.bold).monospacedDigit())
                        .foregroundStyle(Theme.accent)
                        .frame(width: 46, alignment: .leading)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(person.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(palette.type)
                        if let description = person.shortDescription, !description.isEmpty {
                            Text(description)
                                .font(.caption)
                                .foregroundStyle(palette.type.opacity(0.55))
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: 0)
                }
            }

            Text("The full list is on the Today tab, at your date.")
                .font(.caption)
                .foregroundStyle(palette.type.opacity(0.45))
        }
        .stageCard(palette)
        .padding(.horizontal, 20)
    }

    @ViewBuilder
    private var leapNote: some View {
        // FR-036. When the app is standing in another day for February 29 it
        // has to say so rather than quietly moving the birthday.
        if profile.birthday.isLeapDay, observed != profile.birthday.date {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "calendar.badge.exclamationmark")
                    .foregroundStyle(Theme.accent)
                Text("There is no February 29 this year, so Birthed is using \(observed.displayName()). You can change that in Settings.")
                    .font(.footnote)
                    .foregroundStyle(palette.type.opacity(0.65))
            }
            .stageCard(palette)
            .padding(.horizontal, 20)
        }
    }

    private var sources: some View {
        Text("Names from Wikidata. Chart weeks from Wikipedia. Credit to both.")
            .font(.caption2)
            .foregroundStyle(palette.type.opacity(0.35))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.top, 8)
    }

    // MARK: Actions

    /// One breath puts it out. It relights on its own, because a dark candle
    /// is a state to visit, not a state to live in.
    private func blowOut() {
        guard lit else { return }
        lit = false
        relightTask?.cancel()
        relightTask = Task {
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            lit = true
        }
    }

    private func loadTwins() async {
        twins = (try? await repository.notablePeople(bornOn: profile.birthday.date, limit: 3)) ?? []
    }

    private func loadSong() async {
        // The card is drawn on the way out either way, so somebody with no
        // birth year still gets one, just without the song on it.
        defer { shareImage = renderShareCard() }
        guard let year = profile.birthday.year else { return }
        // try? on a call that already returns an optional gives a double
        // optional, and the flatten is what stops that being a warning and a
        // card that never appears.
        song = (try? await repository.numberOneSong(
            theWeekOf: profile.birthday.date,
            birthYear: year
        )) ?? nil
    }

    private func loadOthers() async {
        guard let year = profile.birthday.year else { return }
        for chart in [ChartWeek.Chart.billboard200, .boxOffice] {
            let found = (try? await repository.numberOne(
                on: chart, theWeekOf: profile.birthday.date, birthYear: year
            )) ?? nil
            if let found { others[chart] = found }
        }
        shareImage = renderShareCard()
    }

    /// FR-117. Rendered on device, so it works with the network switched off.
    /// Drawn in the palette the screen is showing, so the export matches the
    /// screenshot.
    @MainActor
    private func renderShareCard() -> Image? {
        let renderer = ImageRenderer(content: MyDayShareCard(
            date: profile.birthday.date,
            weekdayName: birthWeekdayName,
            song: song,
            album: others[.billboard200],
            film: others[.boxOffice],
            daysAlive: daysAlive,
            palette: palette
        ))
        renderer.scale = 2
        guard let rendered = renderer.uiImage else { return nil }
        return Image(uiImage: rendered)
    }
}
