import SwiftUI

/// Your day, set like the card you would share about it.
///
/// This screen and `MyDayShareCard` are the same picture on purpose: the
/// same ground, the same candle in the same corner, the same facts in the
/// same order. What somebody screenshots is what the share button exports.
///
/// The picture is a panel rather than a page, and that is the September 6
/// redesign in one sentence. The candle succeeds on the app icon and on the
/// share card and failed here, and the difference was never the drawing: both
/// of those are a bounded warm field with the candle as the subject, and this
/// screen was an unbounded cream page with the candle loose on it. So the
/// stage became the field. Everything inside it is grouped by the panel's own
/// edge, the candle stands on the panel's bottom edge and runs off it the way
/// it was drawn to, and the flame finally has a dark enough surface to light.
/// The page behind the panel still follows the system appearance. The panel
/// does not, so there is one set of colours inside it rather than two.
///
/// `FR-034` counts in whole local days. `FR-035` switches to a distinct state
/// on the birthday rather than showing a zero. `FR-036` says so out loud when
/// a February 29 birthday is being observed on another date.
struct MyDayView: View {
    let profile: Profile
    let repository: DayPageRepository
    let onOpenSettings: () -> Void

    @Environment(\.colorScheme) private var colorScheme
    /// For the sleeve, when there is no sample and it opens Apple Music.
    @Environment(\.openURL) private var openURL
    /// The thirty second sample, when there is one.
    @State private var preview = PreviewPlayer()
    /// Named for what it is rather than for what it holds, because `facts`
    /// on this screen is already the arithmetic one.
    @Environment(FactsService.self) private var factsService
    /// The best selling game of the birth year. Nothing before 1980 and
    /// nothing without a year, and the panel is complete without it.
    @Environment(YearChartService.self) private var yearCharts

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

    /// Which of the world-when-you-arrived lines the reader wants standing in
    /// the panel, held by subject rather than by position or by sentence.
    ///
    /// The subject is the only stable handle of the three. Position changes
    /// when a timeline is extended, and the sentence changes on every
    /// birthday, because "fifteen years older than Fortnite" becomes sixteen.
    /// An empty string means nobody has chosen, and the first line stands.
    @AppStorage("mine.preferredWorldLine") private var preferredWorldSubject = ""
    /// The deal for the panel's top card. New when the screen is made, which
    /// is once a launch, so every launch leads with something different.
    @State private var pickSalt = FactOrder.newSalt()
    /// How far through the deal the reader has tapped.
    @State private var pickIndex = 0

    private let calendar = BirthdayCalendar()
    private let facts = DateFacts()
    private var now: Date { Date() }
    /// The page the panel sits on. This is the one thing on the screen that
    /// still follows the system appearance.
    private var palette: StagePalette { .forScheme(colorScheme) }
    /// The panel, and every card this screen exports. The same in both
    /// appearances, for the reason written over `StagePalette.wax`.
    private let stagePalette = StagePalette.wax

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
    /// Read here rather than inside the section that shows them, because one
    /// of them is promoted into the panel and the rest sit below it, and two
    /// places that both worked them out would each reach for the same one and
    /// print it twice.
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

    /// The line standing in the panel: whichever one the reader last chose,
    /// or the loudest if they have not chosen. A chosen subject that no
    /// longer produces a line, because a timeline was retired or the reader
    /// changed their birth year, falls back rather than showing nothing.
    private var leadLine: WorldThen.Line? {
        if let chosen = worldThen.first(where: { $0.kicker == preferredWorldSubject }) {
            return chosen
        }
        return worldThen.first
    }

    /// Everything else, for the section below the panel. Filtered by identity
    /// rather than dropped from the front, because the promoted line is no
    /// longer always the first one.
    private var restLines: [WorldThen.Line] {
        guard let leadLine else { return worldThen }
        return worldThen.filter { $0.id != leadLine.id }
    }

    /// The panel's top card, dealt once a launch from what was already found
    /// about this birthday plus the charts. `MinePick` has the rules.
    private var picks: [MinePick] {
        MinePick.deal(facts: factsService.facts,
                      hasCharts: song != nil || yearCharts.game != nil,
                      salt: pickSalt)
    }

    private var pick: MinePick? {
        picks.isEmpty ? nil : picks[pickIndex % picks.count]
    }

    /// The fact standing in the panel, which the list below leaves out so it
    /// is not read twice.
    private var pickedFactID: Int? {
        if case let .fact(fact) = pick { return fact.id }
        return nil
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    stage
                    // What was found about this person's day, first, because
                    // it is the only thing on the screen that is about them
                    // rather than about every day.
                    foundFacts
                    // The table's "older than" lines, under the found facts
                    // and out of the panel since September 22, 2026: they are
                    // the same every launch and they were not chosen by
                    // anybody. They stay because they are free, certain and
                    // shareable.
                    WorldThenSection(lines: worldThen, palette: palette) { line in
                        sharingLine = line
                    }
                    // Below the fold, and two chips shorter. Greeting card
                    // content, for an audience that does not send greeting
                    // cards, on the screen they came to see themselves on.
                    chips
                    if happened != nil { happenedCard }
                    leapNote
                    sources
                }
                .padding(.bottom, 24)
            }
            // The tab bar floats over the content, and 36 points of padding
            // was not clearance: the last section on the screen was being cut
            // through the middle by it. This is a margin on the scroll
            // content rather than more padding on the stack, so the gap
            // belongs to the scroll view that owns the problem.
            .contentMargins(.bottom, 72, for: .scrollContent)
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
            .task { await yearCharts.load(year: profile.birthday.year) }
            .task { await factsService.load(for: profile) }
            .sheet(isPresented: $showingShare) {
                ShareCardPicker(choices: shareChoices, subject: profile.birthday.date.displayName())
            }
            .sheet(item: $sharingLine) { line in
                ShareCardPicker(
                    choices: [WorldThenSection.shareChoice(for: line, palette: stagePalette)],
                    subject: profile.birthday.date.displayName()
                )
            }
            .sheet(item: $sharingFact) { fact in
                ShareCardPicker(
                    choices: [FoundFactsSection.shareChoice(
                        for: fact,
                        dateName: profile.birthday.year == nil ? nil : searchedDateName,
                        palette: stagePalette
                    )],
                    subject: profile.birthday.date.displayName()
                )
            }
            .sensoryFeedback(.impact(weight: .heavy), trigger: lit) { _, isLit in !isLit }
            .sensoryFeedback(.selection, trigger: preferredWorldSubject)
        }
        .tint(Theme.accent)
    }

    // MARK: The panel

    /// The poster, on a surface.
    ///
    /// The text column is the only thing that takes layout space. The glow,
    /// the candle and the confetti ride in a background and an overlay, so
    /// nothing here can be wider than the screen: a 600 point circle inside
    /// the stack was making the whole stage 600 wide, and the scroll view was
    /// centring it and cutting the left edge off the date.
    ///
    /// The old fixed minimum of 540 points is gone. It was what manufactured
    /// the hundred point dead band in the middle of the screen: when the
    /// album and the film came off, nothing took their space and the stack
    /// was still being held open to a height chosen when they were there.
    /// The floor now comes from the bottom band, which is as tall as the
    /// candle because it is the band the candle stands in.
    private var stage: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            Spacer().frame(height: 24)

            if let pick {
                pickCard(pick)
                    .id(pick.id)
                    .transition(.opacity.combined(with: .move(edge: .trailing)))
            } else if profile.birthday.year == nil {
                yearNudge
            }

            if pick != nil || profile.birthday.year == nil {
                Spacer().frame(height: 26)
            }

            heroNumber

            // Anything left over lands here rather than in the middle of the
            // screen, which is the other half of closing the dead band.
            Spacer(minLength: 24)

            bottomBand
        }
        .padding(.horizontal, 22)
        .padding(.top, 24)
        .padding(.bottom, 24)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background { panelFill }
        .overlay(alignment: .bottomTrailing) { candle }
        .overlay {
            if isBirthday {
                ConfettiBurst()
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
        // A hairline in the panel's own type colour, which is what stops a
        // dark panel on a cream page reading as a hole cut in the page.
        .overlay {
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .strokeBorder(stagePalette.type.opacity(0.10), lineWidth: 1)
        }
        // The shadow is cast by a plain shape behind the panel rather than
        // by the panel itself. The panel contains a flame that redraws every
        // frame, and a shadow on it would put that animation through an
        // offscreen pass sixty times a second for a soft edge that never
        // changes. This background sits outside the clip, so it is not
        // clipped away.
        .background {
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .fill(Theme.wax)
                .shadow(color: Theme.wax.opacity(0.26), radius: 22, x: 0, y: 12)
        }
        .padding(.horizontal, 16)
        .animation(.spring(duration: 0.6), value: song)
        .animation(.spring(duration: 0.6), value: yearCharts.game)
    }

    /// The date is the label of the panel rather than the news on it, so it
    /// is set at a quarter of what it was. The news is the number below.
    @ViewBuilder
    private var header: some View {
        if isBirthday {
            Text("Happy birthday")
                .font(.system(size: 40, weight: .black, design: .serif))
                .foregroundStyle(stagePalette.type)
                .lineLimit(2)
                .minimumScaleFactor(0.6)
            // "Your Bee Day", the website's name for the reader's own
            // birthday, as the line under the headline rather than a kicker
            // over it: the one kicker above the fold belongs to the song.
            Text("Your Bee Day, \(observed.displayName())")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(stagePalette.type.opacity(0.65))
                .padding(.top, 6)
        } else {
            Text(profile.birthday.date.displayName())
                .font(.system(size: 27, weight: .bold, design: .serif))
                .foregroundStyle(stagePalette.type)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if let birthWeekdayName {
                Text("born on a \(birthWeekdayName)")
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(stagePalette.type.opacity(0.55))
                    .padding(.top, 4)
            }
        }
    }

    // MARK: The one number

    /// What the hero slot holds, and what sits under it in small type.
    ///
    /// One number wins by a factor of five rather than by argument. The two
    /// counters used to be rendered identically, so neither won, and the day
    /// count is the one number in the product per the feature table.
    private struct Hero {
        let value: Int
        let label: String
        let caption: String?
    }

    /// On the birthday the age takes the slot, because "31 today" is the
    /// event and a day count is not, and the day count drops to the caption.
    /// On the other 364 days the day count takes it. With no birth year
    /// neither exists and the countdown stands in, so the slot is never
    /// empty on a screen that has anything to say at all.
    private var hero: Hero? {
        let countdown = daysAway == 1 ? "1 day to your next birthday"
                                      : "\(daysAway.formatted()) days to your next birthday"
        if isBirthday {
            guard let age = calendar.ageOnNextBirthday(profile.birthday, from: now) else { return nil }
            return Hero(value: age, label: "today",
                        caption: daysAlive.map { "\($0.formatted()) days old" })
        }
        if let daysAlive {
            return Hero(value: daysAlive, label: "days old", caption: countdown)
        }
        return Hero(value: daysAway, label: daysAway == 1 ? "day to go" : "days to go", caption: nil)
    }

    @ViewBuilder
    private var heroNumber: some View {
        if let hero {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    CountingNumber(value: hero.value)
                        .font(.system(size: 84, weight: .black, design: .serif))
                        .foregroundStyle(stagePalette.type)
                        .lineLimit(1)
                        .minimumScaleFactor(0.4)
                    Text(hero.label)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(stagePalette.type.opacity(0.6))
                }
                if let caption = hero.caption {
                    Text(caption)
                        .font(.system(size: 15, weight: .regular))
                        .foregroundStyle(stagePalette.type.opacity(0.5))
                }
            }
        }
    }

    // MARK: The bottom band

    /// The band the candle stands in.
    ///
    /// It is at least as tall as the candle is, less the drop and the panel's
    /// own bottom padding, which is what keeps the flame away from the number
    /// above it without anybody having to guess a margin. The one sentence
    /// that sits in here is aligned to the bottom, next to the candle's body
    /// rather than its flame, which is why it only needs a hundred points of
    /// clearance instead of the hundred and sixty the flame would want.
    ///
    /// Empty for a reader with no birth year, and still this tall, because
    /// the candle is in it. That is the difference between this and the dead
    /// band it replaces: this space has something standing in it.
    private var bottomBand: some View {
        VStack(alignment: .leading, spacing: 12) {
            if isBirthday {
                Text("Hold the candle to blow it out")
                    .font(.footnote)
                    .foregroundStyle(stagePalette.type.opacity(0.45))
            }
        }
        .padding(.trailing, 100)
        .frame(maxWidth: .infinity,
               minHeight: candleHeight - candleDrop - 24,
               alignment: .bottomLeading)
    }


    // MARK: The candle, and the light it throws

    private var candleHeight: CGFloat { isBirthday ? 300 : 230 }

    /// How far the candle hangs below the panel, and so how much of it the
    /// panel clips off.
    ///
    /// Zero, and this time not as a revert.
    ///
    /// The history is worth keeping because it is the argument. `CandleMark`
    /// was drawn with no base, so it had to run off the bottom of something
    /// or show a hard flat cut where the wax ended. On the icon and on a share
    /// card that is right, because both have an edge. The stage did not, so a
    /// zero drop left a striped cylinder with a flat bottom floating on cream.
    /// The panel gave the edge back and the drop came back with it, and that
    /// worked, but it was still the panel hiding the problem rather than the
    /// candle not having one.
    ///
    /// The candle has a holder now. It ends in a dish and casts a shadow onto
    /// what it is standing on, so there is nothing left to hide and no reason
    /// to push it through the floor. Everything the drop was worth is now
    /// being done by the thing it was working around.
    private var candleDrop: CGFloat { 0 }

    /// The light the candle throws, centred on its flame.
    ///
    /// Ember rather than accent, and lightened rather than painted on. On
    /// cream this was a pink circle sitting on top of a pale page, which read
    /// as a smudge because there is nothing lighter than cream for light to
    /// make. On wax it has somewhere to go. In a background it takes no
    /// layout space, so it can be any size without moving the text.
    private var glow: some View {
        let candleHeight = self.candleHeight
        let drop = candleDrop
        let flameHeight = candleHeight * 0.484
        let flameWidth = flameHeight * (100.0 / 95.0)
        // Where the flame's centre sits, measured from the panel's bottom
        // trailing corner: the candle is padded 42 from the edge and pushed
        // down by `drop`, and the flame's centre is about 55 percent of the
        // way down the flame.
        let centreUp = candleHeight - flameHeight * 0.55 - drop
        let centreIn = 42 + flameWidth / 2
        let size: CGFloat = 460
        return Circle()
            .fill(RadialGradient(
                colors: [
                    Theme.ember.opacity(0.24),
                    Theme.emberDeep.opacity(0.09),
                    .clear,
                ],
                center: .center, startRadius: 10, endRadius: size / 2
            ))
            .frame(width: size, height: size)
            .offset(x: size / 2 - centreIn, y: size / 2 - centreUp)
            .blendMode(.plusLighter)
            .allowsHitTesting(false)
    }

    /// The field the candle stands in.
    ///
    /// Wax on an ordinary day, with a light top corner and a dark bottom one
    /// so the panel has a front and a back rather than being a flat colour.
    /// The celebration gradient on the birthday, which is the app icon's own
    /// field and is reserved by `Theme` for the days the product is
    /// celebrating rather than informing.
    private var panelFill: some View {
        ZStack {
            if isBirthday {
                Theme.celebration
            } else {
                LinearGradient(
                    colors: [Theme.waxLight, Theme.wax],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
            glow
        }
        .compositingGroup()
    }

    /// Padded 42 from the trailing edge rather than 28, so the panel's
    /// rounded corner does not take a bite out of the candle's bottom corner
    /// on its way past.
    private var candle: some View {
        CandleMark(height: candleHeight, lit: lit, holder: true, on: stagePalette)
            .padding(.trailing, 42)
            .offset(y: candleDrop)
            .onLongPressGesture(minimumDuration: 0.5, perform: { blowOut() })
            .accessibilityLabel(lit ? "A lit candle. Hold to blow it out." : "A candle, blown out")
            .animation(.spring(duration: 0.6), value: isBirthday)
    }

    // MARK: What is in the panel

    /// A record sleeve, at the size the title beside it is tall.
    ///
    /// Loaded from Apple rather than shipped, and nothing is drawn in the
    /// square until it arrives. A grey placeholder that never resolves reads
    /// as broken, and a card with no sleeve is a state this screen already
    /// has for every year Apple does not carry.
    private func cover(_ url: URL, store: URL?, sample: URL?) -> some View {
        AsyncImage(url: url) { phase in
            if case let .success(image) = phase {
                image.resizable().aspectRatio(contentMode: .fill)
            } else {
                stagePalette.type.opacity(0.06)
            }
        }
        .frame(width: 84, height: 84)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(stagePalette.type.opacity(0.14), lineWidth: 0.75)
        )
        .shadow(color: .black.opacity(0.34), radius: 10, y: 5)
        // The sample when there is one, the store page when there is not.
        .overlay {
            if sample != nil {
                ZStack {
                    Circle()
                        .fill(.black.opacity(0.42))
                        .frame(width: 32, height: 32)
                    Image(systemName: preview.nowPlaying == sample ? "pause.fill" : "play.fill")
                        .font(.system(size: 13, weight: .black))
                        .foregroundStyle(.white)
                        .offset(x: preview.nowPlaying == sample ? 0 : 1.5)
                }
            }
        }
        .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .onTapGesture {
            if let sample {
                preview.toggle(sample)
            } else if let store {
                openURL(store)
            }
        }
        .accessibilityLabel(sample != nil
                            ? (preview.nowPlaying == sample ? "Stop the sample" : "Play a sample")
                            : "Open on Apple Music")
        .accessibilityAddTraits(.isButton)
    }

    /// The one pink kicker left above the fold.
    ///
    /// There were six on one screen, which is not a kicker, it is a texture,
    /// and it had stopped telling anybody what mattered. The song keeps it
    /// because the song is the only thing up here whose label is itself the
    /// fact: nobody says "my day" out loud, and people do say "the number one
    /// song the week I was born". Everything else is labelled by size, by
    /// position, or by the sentence containing its own subject.
    ///
    /// Soft rather than full accent, because full accent on wax is louder
    /// than it was on cream and this is meant to glow, not shout.
    private func kicker(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.heavy))
            .kerning(3)
            .foregroundStyle(Theme.accentSoft)
    }

    /// One card from the deal, and under it the way to the next one. The
    /// control is its own small row rather than the whole card, because the
    /// chart card already has a cover to play and a store to open.
    @ViewBuilder
    private func pickCard(_ pick: MinePick) -> some View {
        VStack(alignment: .trailing, spacing: 8) {
            switch pick {
            case .charts:
                chartBlock
            case let .fact(fact):
                factPick(fact)
            }
            if picks.count > 1 {
                Button {
                    withAnimation(.snappy) { pickIndex += 1 }
                } label: {
                    HStack(spacing: 6) {
                        Text("Another")
                            .font(.footnote.weight(.semibold))
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(stagePalette.type.opacity(0.5))
                    .padding(.vertical, 4)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint("Shows something else about your day")
            }
        }
        .sensoryFeedback(.selection, trigger: pickIndex)
    }

    /// A found fact as the panel's card: what kind of thing it is, the
    /// sentence, where it came from, and the like.
    private func factPick(_ fact: BirthFact) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(FoundFactsSection.label(for: fact.category))
                    .font(.caption.weight(.heavy))
                    .kerning(2.5)
                    .foregroundStyle(stagePalette.accent)
                Spacer(minLength: 8)
                Button {
                    Task { await factsService.toggleLike(fact) }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: fact.likedByMe ? "hand.thumbsup.fill" : "hand.thumbsup")
                        if fact.likes > 0 { Text("\(fact.likes)") }
                    }
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(fact.likedByMe ? stagePalette.accent : stagePalette.type.opacity(0.5))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(fact.likedByMe ? "Liked" : "Like")
            }

            Text(fact.fact)
                .font(.system(size: 22, weight: .bold, design: .serif))
                .foregroundStyle(stagePalette.type)
                .fixedSize(horizontal: false, vertical: true)

            if let source = fact.sourceURL {
                Button {
                    openURL(source)
                } label: {
                    Text((source.host() ?? source.absoluteString) + " \u{2197}")
                        .font(.caption)
                        .foregroundStyle(stagePalette.type.opacity(0.45))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(stagePalette.type.opacity(0.08))
        )
        .onAppear { factsService.noteSeen(fact.id) }
    }

    /// The one fact on this screen that somebody would read out loud to a
    /// friend, so it is set like a title rather than like a row, and it sits
    /// on a faint surface of its own so it reads as one object instead of
    /// four unrelated lines. It needs a birth year, and it shows nothing at
    /// all when there is no chart covering that week rather than reaching for
    /// the nearest one.
    /// One surface for what was on top when the reader arrived.
    ///
    /// The song and the game together rather than two thin blocks, because
    /// they are the same kind of claim about the same year and the panel is
    /// allowed five things, not six. The kicker is still the only pink one
    /// above the fold: the game labels itself in its own line, which also
    /// carries the year, so nothing is ambiguous when the song is missing and
    /// the game is not.
    ///
    /// The game is not in `chart_weeks` and the reason matters. A chart week
    /// is found by asking for the first issue on or after a birth date, and
    /// `ChartWeek.covers` refuses an answer more than six days later, which is
    /// the control that stops a 1943 birthday being handed a 1959 chart. A
    /// yearly best seller has no issue date for that rule to hold, so it lives
    /// in `year_charts` and is read separately.
    @ViewBuilder
    private var chartBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            kicker(song != nil ? "NUMBER ONE THE WEEK YOU WERE BORN" : "THE YEAR YOU WERE BORN")

            if let song {
                // The cover beside the title rather than above it. This card
                // is the top of the screen and the title is the loudest thing
                // on it; a full width sleeve over the top would make the
                // record the subject and the reader's day the caption.
                HStack(alignment: .top, spacing: 14) {
                    if let art = song.artworkURL {
                        cover(art, store: song.storeURL, sample: song.previewURL)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text(song.song)
                            .font(.system(size: song.artworkURL == nil ? 30 : 25,
                                          weight: .black, design: .serif))
                            .foregroundStyle(stagePalette.type)
                            .lineLimit(3)
                            .minimumScaleFactor(0.6)
                            .fixedSize(horizontal: false, vertical: true)

                        Text(song.artist)
                            .font(.system(size: 17, weight: .regular))
                            .foregroundStyle(stagePalette.type.opacity(0.6))
                            .lineLimit(2)
                    }
                }

                // The issue date is here because it is what makes the claim
                // checkable rather than something Birthed asserts.
                Text(song.attribution())
                    .font(.caption2)
                    .foregroundStyle(stagePalette.type.opacity(0.42))
                    .padding(.top, 2)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let game = yearCharts.game {
                if song != nil {
                    Rectangle()
                        .fill(stagePalette.type.opacity(0.12))
                        .frame(height: 1)
                        .padding(.vertical, 12)
                }

                Text(game.title)
                    .font(.system(size: 22, weight: .bold, design: .serif))
                    .foregroundStyle(stagePalette.type)
                    .lineLimit(3)
                    .minimumScaleFactor(0.6)
                    .fixedSize(horizontal: false, vertical: true)

                Text("the best selling game of \(String(game.year))")
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(stagePalette.type.opacity(0.6))

                // The same job the song's issue date does. A year is not a
                // week and United States sales are not world sales, and a
                // claim that does not say so is a claim Birthed is asserting
                // rather than reporting.
                if let note = game.note {
                    Text(note)
                        .font(.caption2)
                        .foregroundStyle(stagePalette.type.opacity(0.42))
                        .padding(.top, 2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(stagePalette.type.opacity(0.08))
        )
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
                    .foregroundStyle(Theme.accentSoft)
                Text("Add your birth year to see the number one song the week you were born.")
                    .font(.subheadline)
                    .foregroundStyle(stagePalette.type.opacity(0.7))
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(stagePalette.type.opacity(0.08))
            )
        }
        .buttonStyle(.plain)
    }

    // The next milestone, "9,000 days old on April 26, 2027", used to sit
    // under the counters. Two numbers stacked make neither of them the one
    // number. It is good notification material and it keeps its share card,
    // so the arithmetic in `facts.nextMilestone` stays where it is.

    // MARK: Below the panel

    /// The small true things, below the fold.
    ///
    /// Three of them, not five. The birthstone and the birth flower are gone:
    /// they are entries in traditional lists rather than facts about the
    /// person, and they are greeting card content for an audience that does
    /// not send greeting cards. `DateFacts` keeps both, because onboarding
    /// still shows a birthstone and the lists are tested.
    ///
    /// The sign stays because it is the one of the five anybody says out
    /// loud, and it is down here rather than in the panel for the same
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
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 22)
    }

    /// "September 4, 2002", or just the date when no year was given. What the
    /// app says it is looking into, and the kicker on a shared fact.
    private var searchedDateName: String {
        guard let year = profile.birthday.year else { return profile.birthday.date.displayName() }
        return "\(profile.birthday.date.displayName()), \(String(year))"
    }

    private var foundFacts: some View {
        FoundFactsSection(
            facts: factsService.facts.filter { $0.id != pickedFactID },
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
        .onDisappear {
            // A sample must not keep playing into whatever the reader opened
            // next.
            preview.stop()
            Task { await factsService.flushSeen() }
        }
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
                        .foregroundStyle(palette.accent)
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
                    .foregroundStyle(palette.accent)
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

    /// FR-117. Every card is rendered on device, and every one of them is the
    /// panel's own palette rather than the page's.
    ///
    /// That is a change, and it is the same decision as the panel. The screen
    /// and the export are meant to be the same picture, so when the picture
    /// stopped following the system appearance the cards had to stop too, or
    /// a reader in light mode would share a cream card of a wax screen. It
    /// also means the thing people post is the app's own field with the
    /// candle in it, which is what the icon is.
    ///
    /// The whole day first, then one card per fact, in the order the facts
    /// sit on the screen. Anything this person does not have, no year and so
    /// no song, is simply not a card.
    private var shareChoices: [ShareCardChoice] {
        let date = profile.birthday.date
        let palette = stagePalette
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
        // The line the reader chose to have standing in the panel, not
        // whichever one the table ranked first.
        if let lead = leadLine {
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
