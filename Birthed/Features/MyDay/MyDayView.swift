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
    /// Named for what it is rather than for what it holds, because `facts`
    /// on this screen is already the arithmetic one.
    @Environment(FactsService.self) private var factsService

    /// One thing that happened on this date, or nothing.
    ///
    /// This used to be the three people the date is best known for, and it had
    /// the same hole the website's share card had: that list is ordered by how
    /// much attention somebody gets, infamy is attention, and this is the
    /// screen people screenshot. See `DayLine`.
    @State private var happened: DayLine?
    @State private var song: ChartWeek?
    /// The other number ones that week, by chart. Loaded alongside the song
    /// and shown under it; each is absent rather than guessed when no chart
    /// week covers the birth date.
    @State private var others: [ChartWeek.Chart: ChartWeek] = [:]
    @State private var showingShare = false
    /// The one fact the reader tapped share on. A separate sheet from the
    /// whole day picker, because it is one card and not a choice of eight.
    @State private var sharingFact: BirthFact?
    /// A line from the world-when-you-arrived section, being shared.
    @State private var sharingLine: WorldThen.Line?
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

    /// What version of the world this reader arrived into, loudest first.
    ///
    /// Read here rather than inside the section that shows them, because the
    /// first line is promoted into the stage and the rest sit below it, and
    /// two places that both worked them out would each reach for the first
    /// one and print it twice.
    ///
    /// Empty without a birth year, because every line here is about the year.
    private var worldThen: [WorldThen.Line] {
        guard let year = profile.birthday.year else { return [] }
        return WorldThen.lines(
            month: profile.birthday.date.month,
            day: profile.birthday.date.day,
            year: year
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    stage
                    // The rest of the world they arrived into. The loudest of
                    // these lines is in the stage above, so this picks up at
                    // the second one.
                    WorldThenSection(lines: Array(worldThen.dropFirst()), palette: palette) { line in
                        sharingLine = line
                    }
                    // Under the world, because these are the only facts on
                    // this screen that are about this person's day rather
                    // than about every day.
                    foundFacts
                    // Below the fold, and two chips shorter. Greeting card
                    // content, for an audience that does not send greeting
                    // cards, on the screen they came to see themselves on.
                    chips
                    if happened != nil { happenedCard }
                    leapNote
                    sources
                }
                .padding(.bottom, 36)
            }
            .background(palette.ground.ignoresSafeArea())
            // Pulling down deals the facts again and, once a month, asks the
            // server for another look at the date. Neither costs anything
            // the server has not already decided to spend.
            .refreshable { await factsService.load(for: profile) }
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showingShare = true
                    } label: {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                    .tint(palette.type)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: onOpenSettings) {
                        Label("Settings", systemImage: "gearshape")
                    }
                    .tint(palette.type)
                }
            }
            // Separate tasks, so no request waits on another.
            .task { await loadDayLine() }
            .task { await loadSong() }
            .task { await loadOthers() }
            .task { await factsService.load(for: profile) }
            .sheet(isPresented: $showingShare) {
                ShareCardPicker(choices: shareChoices, subject: profile.birthday.date.displayName())
            }
            .sheet(item: $sharingLine) { line in
                ShareCardPicker(
                    choices: [WorldThenSection.shareChoice(for: line, palette: palette)],
                    subject: profile.birthday.date.displayName()
                )
            }
            .sheet(item: $sharingFact) { fact in
                ShareCardPicker(
                    choices: [FoundFactsSection.shareChoice(
                        for: fact,
                        dateName: profile.birthday.year == nil ? nil : searchedDateName,
                        palette: palette
                    )],
                    subject: profile.birthday.date.displayName()
                )
            }
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

            Spacer().frame(height: 40)

            counters

            olderThanLine

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

    // The album and the film used to sit under the song here. They are filler
    // beside the one thing anybody reads out loud, and they are gone from the
    // screen. The data stays: `others` is still loaded and the share picker
    // still offers a card for each of them.

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

    // The next milestone, "9,000 days old on April 26, 2027", used to sit
    // under the counters. Two numbers stacked make neither of them the one
    // number, and the days alive counter is the one number. It is good
    // notification material and it keeps its share card, so the arithmetic in
    // `facts.nextMilestone` stays where it is.

    /// The small true things, below the fold.
    ///
    /// Three of them, not five. The birthstone and the birth flower are gone:
    /// they are entries in traditional lists rather than facts about the
    /// person, and they are greeting card content for an audience that does
    /// not send greeting cards. `DateFacts` keeps both, because onboarding
    /// still shows a birthstone and the lists are tested.
    ///
    /// The sign stays because it is the one of the five anybody says out
    /// loud, and it is down here rather than in the stage for the same
    /// reason: saying it out loud is not why anybody opened the app.
    private var chips: some View {
        let sign = facts.zodiacSign(for: profile.birthday.date)
        let thisYear = Calendar.current.component(.year, from: now)

        return FlowLayout(spacing: 8) {
            FactChip(label: "Sign", value: "\(sign.symbol) \(sign.rawValue)", palette: palette)
            if let animal = facts.chineseAnimal(for: profile.birthday) {
                FactChip(label: "Chinese zodiac", value: "Year of the \(animal.rawValue)", palette: palette)
            }
            if let dayNumber = facts.dayOfYear(profile.birthday, in: profile.birthday.year ?? thisYear) {
                FactChip(label: "Day of the year", value: "\(dayNumber) of \(calendar.isLeapYear(profile.birthday.year ?? thisYear) ? 366 : 365)", palette: palette)
            }
        }
        // It used to inherit the stage's margin. Out here it needs its own,
        // and it no longer has to leave room for a candle.
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 22)
    }

    /// The one sentence in the app that measures the world against the reader
    /// rather than describing their date.
    ///
    /// "You are fifteen years older than Fortnite" is the mirror, and it was
    /// four screens down under a section header. It comes from a table, so it
    /// is certain, costs nothing and needs no network, which is why it can
    /// stand in the stage next to things the reader can see are true.
    ///
    /// Nothing at all without a birth year, and nothing for a birth after the
    /// last date any of the timelines is checked through. Absent beats wrong.
    @ViewBuilder
    private var olderThanLine: some View {
        if let lead = worldThen.first {
            VStack(alignment: .leading, spacing: 8) {
                kicker(lead.kicker)
                Text(lead.text)
                    .font(.system(size: 25, weight: .bold, design: .serif))
                    .foregroundStyle(palette.type)
                    .fixedSize(horizontal: false, vertical: true)
                    .multilineTextAlignment(.leading)
            }
            // Clear of the candle, the same margin the chips used to keep.
            .padding(.trailing, 110)
            // Its own gap above it, so a reader with no birth year and no
            // line does not get the gap on its own.
            .padding(.top, 24)
        }
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

    /// "September 4, 2002", or just the date when no year was given. What the
    /// app says it is looking into, and the kicker on a shared fact.
    private var searchedDateName: String {
        guard let year = profile.birthday.year else { return profile.birthday.date.displayName() }
        return "\(profile.birthday.date.displayName()), \(String(year))"
    }

    private var foundFacts: some View {
        FoundFactsSection(
            facts: factsService.facts,
            status: factsService.status,
            dateName: searchedDateName,
            palette: palette,
            onLike: { fact in Task { await factsService.toggleLike(fact) } },
            onSeen: { factsService.noteSeen($0.id) },
            onShare: { fact in
                sharingFact = fact
                Task { await factsService.recordShareOpen(fact.id) }
            }
        )
        .onDisappear { Task { await factsService.flushSeen() } }
    }

    /// What happened on this date, set the way the day pages set it: the year
    /// in the accent colour, then the sentence. No names, on a screen that
    /// exists to be screenshotted.
    @ViewBuilder
    private var happenedCard: some View {
        if let happened {
            VStack(alignment: .leading, spacing: 14) {
                Text("On \(profile.birthday.date.displayName())")
                    .font(.headline)
                    .foregroundStyle(palette.type)

                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text(String(happened.year))
                        .font(.footnote.weight(.bold).monospacedDigit())
                        .foregroundStyle(Theme.accent)
                        .frame(width: 46, alignment: .leading)
                    Text(happened.text)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(palette.type)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }

                Text("Everything else about this date is on the Today tab.")
                    .font(.caption)
                    .foregroundStyle(palette.type.opacity(0.45))
            }
            .stageCard(palette)
            .padding(.horizontal, 20)
        }
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
        Text("Names from Wikidata. Chart weeks from Wikipedia. What was found about your day was searched for by Google's Gemini, and each fact carries the page it came from.")
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

    /// The researched facts first, the screened Wikipedia events only if there
    /// are none. The same order and the same reason as onboarding, written out
    /// in `lookUpDayLine` there: on most dates the second read never happens.
    private func loadDayLine() async {
        let date = profile.birthday.date
        let facts = (try? await repository.birthFacts(on: date, limit: 30)) ?? []
        if let line = DayLine.choose(facts: facts, events: [], on: date) {
            happened = line
            return
        }
        let events = (try? await repository.events(on: date, limit: 150)) ?? []
        // Nothing is shown as nothing. It is never shown as a name.
        happened = DayLine.choose(facts: [], events: events, on: date)
    }

    private func loadSong() async {
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
    }

    /// FR-117. Every card is rendered on device, in the palette the screen is
    /// showing, so what is shared is what was on screen. The whole day first,
    /// then one card per fact, in the order the facts sit on the screen.
    /// Anything this person does not have, no year and so no song, is simply
    /// not a card.
    private var shareChoices: [ShareCardChoice] {
        let date = profile.birthday.date
        let palette = palette
        var choices: [ShareCardChoice] = []

        // The whole day card is meant to be the screen they just saw, so it
        // carries what that screen carries. The album and the film came off
        // the screen, so they come off this card. Both still have a card of
        // their own further down this list for anybody who wants one.
        choices.append(ShareCardChoice(id: "day", label: "Your day") {
            MyDayShareCard(
                date: date,
                weekdayName: birthWeekdayName,
                song: song,
                daysAlive: daysAlive,
                palette: palette
            )
        })

        if let song {
            choices.append(ShareCardChoice(id: "song", label: "The song") {
                FocusCard(kicker: "NUMBER ONE THE WEEK I WAS BORN", title: song.song,
                          subtitle: song.artist, footnote: song.attribution(), palette: palette)
            })
        }
        if let film = others[.boxOffice] {
            choices.append(ShareCardChoice(id: "film", label: "The film") {
                FocusCard(kicker: "THE NUMBER ONE FILM THE WEEK I WAS BORN", title: film.song,
                          footnote: film.attribution(), palette: palette)
            })
        }
        if let album = others[.billboard200] {
            choices.append(ShareCardChoice(id: "album", label: "The album") {
                FocusCard(kicker: "THE NUMBER ONE ALBUM THE WEEK I WAS BORN", title: album.song,
                          subtitle: album.artist, footnote: album.attribution(), palette: palette)
            })
        }
        if let daysAlive {
            let weekday = birthWeekdayName.map { "born on a \($0)" }
            choices.append(ShareCardChoice(id: "days", label: "Days old") {
                FocusCard(kicker: "I HAVE BEEN HERE", title: "\(daysAlive.formatted()) days",
                          subtitle: weekday, footnote: date.displayName(), palette: palette)
            })
        }
        if let milestone = facts.nextMilestone(for: profile.birthday, from: now) {
            let when = milestone.daysAway == 0 ? "TODAY" : "ON \(milestone.date.formatted(.dateTime.month(.wide).day().year()).uppercased())"
            choices.append(ShareCardChoice(id: "milestone", label: "Next milestone") {
                FocusCard(kicker: when, title: "\(milestone.days.formatted()) days old",
                          subtitle: milestone.daysAway == 0 ? nil : "\(milestone.daysAway.formatted()) days from now",
                          footnote: date.displayName(), palette: palette)
            })
        }
        if let year = profile.birthday.year,
           let lead = WorldThen.lines(month: date.month, day: date.day, year: year, limit: 1).first {
            choices.append(WorldThenSection.shareChoice(for: lead, palette: palette))
        }
        // The sign and the animal, which are the two the screen still shows.
        // The birthstone and the flower were on this card as well and are not
        // any more, for the reason written over `chips`.
        let sign = facts.zodiacSign(for: date)
        let animal = facts.chineseAnimal(for: profile.birthday).map { "Year of the \($0.rawValue)" }
        choices.append(ShareCardChoice(id: "sign", label: "Your sign") {
            FocusCard(kicker: date.displayName().uppercased(), title: "\(sign.symbol) \(sign.rawValue)",
                      subtitle: animal, footnote: "Traditional dates", palette: palette)
        })

        return choices
    }
}
