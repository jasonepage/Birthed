import SwiftUI

/// The Today tab: the hive, then everything about a date in one feed, with
/// the reader's age on each item.
///
/// **One feed and one verb.** docs/the-wall.md section 13 and section 14:
/// everything with a birthday on a date is a pixel. The day's news sits at
/// the top as this year's rows, the reader's own timeline follows in the
/// order `DayFeed` put it in, and a row whose subject the worker filed as a
/// story carries that story's count and its Buzz button. A story that took a
/// place on the hive is not repeated here; its tile carries the age line.
///
/// **The three answer remembrance game is off this tab.** No "I remember it",
/// no birth year question, no counts. `RememberRow`, `RememberService` and
/// the tables are untouched and nothing is dropped from the database; this
/// screen simply does not draw them.
///
/// `FR-020` through `FR-027` and `FR-030` still hold: names and years,
/// attribution on the page, and two arrows to walk to another date. What
/// changed is that the names are one kind of row among five. The order and
/// the age labels come from `DayFeed` in the domain, where they are tested;
/// this file only draws rows.
struct DayPageView: View {
    @Environment(FactsService.self) private var factsService
    @Environment(ProfileStore.self) private var profileStore
    /// What this date is remembered for, and whether it is still taking
    /// answers. See `RememberService`.
    @Environment(RememberService.self) private var remember
    /// The wall for this date, the live layer above the feed. See
    /// `WallService` and docs/the-wall.md section 2.
    @Environment(WallService.self) private var wall
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.openURL) private var openURL

    @State private var model: DayPageViewModel
    @State private var showingAttributions = false
    @State private var shareImage: Image?
    @State private var sharingFact: BirthFact?
    /// A day can carry a hundred and fifty rows. It opens with the first
    /// dozen and the reader asks for the rest.
    @State private var showingAll = false
    /// One player for the whole feed, so a second tap means "this instead"
    /// rather than "both at once".
    @State private var preview = PreviewPlayer()
    /// The story whose receipt is open, from a tap on a feed row.
    @State private var openingStory: WallStory?

    let onOpenSettings: () -> Void

    init(date: CalendarDate, repository: DayPageRepository, onOpenSettings: @escaping () -> Void) {
        self.onOpenSettings = onOpenSettings
        _model = State(initialValue: DayPageViewModel(date: date, repository: repository))
    }

    private var readerBirthYear: Int? { profileStore.profile?.birthday.year }
    private var palette: StagePalette { .forScheme(colorScheme) }

    /// The page, and on a sealed date the page its own people made.
    ///
    /// While a date is open this is arithmetic: the reader's age band, then a
    /// deal. It has to be, because an order that moved with the answers would
    /// show every reader the popular answer before they gave their own.
    ///
    /// Once it seals nobody can answer again, so the order cannot influence
    /// anything, and it is free to say what happened. That is the only place
    /// in this product where what readers did changes what a page looks like,
    /// and it is the whole payoff: two editions of the same date are two
    /// visibly different pages.
    private var feed: [DayFeed.Item] {
        let base = model.feed(facts: factsService.dayFacts, readerBirthYear: readerBirthYear)
        guard remember.edition?.isSealed == true else { return base }
        return DayFeed.byMemory(base, counts: remember.counts)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    header
                    // The hive, above the feed, and it is handed the age
                    // lines because a story it promoted is not drawn again
                    // below and its "You were 7" goes on the tile instead.
                    HiveView(date: model.date, palette: palette,
                             ageLines: HiveFeed.ageLines(items: feed))
                    // The three counts sit over the feed they count, not
                    // under the date. When the hive came between them they
                    // were the size of something two screens down, and they
                    // were the fourth block between the top of the screen
                    // and the board. Here they are the feed's heading and
                    // the hive section's bottom edge.
                    if !feed.isEmpty {
                        counts
                            .padding(.horizontal, 20)
                            .padding(.bottom, 18)
                    }
                    content
                    attribution
                }
                .padding(.bottom, 32)
            }
            .background(Theme.canvas)
            // Swiping sideways walks to another date, which is what the two
            // arrows do and what a finger reaches for first.
            //
            // A gesture on the scroll view rather than a paging TabView. A
            // real pager keeps three days alive at once, and FactsService
            // holds exactly one day of facts for the whole app, so the two
            // pages either side of this one would draw today's facts under
            // yesterday's date until they settled. That is a data change, not
            // a view change, and it is not worth making for a swipe.
            .simultaneousGesture(
                DragGesture(minimumDistance: 24)
                    .onEnded { drag in
                        // Only a clearly sideways flick. This list scrolls up
                        // and down and pulls to refresh, and a gesture that
                        // fired on a diagonal would steal both.
                        let sideways = abs(drag.translation.width)
                        let upright = abs(drag.translation.height)
                        guard sideways > 60, sideways > upright * 1.6 else { return }
                        Task { await move(drag.translation.width < 0 ? 1 : -1) }
                    }
            )
            // The date changed under a finger that did not press anything, so
            // the phone says so.
            .sensoryFeedback(.selection, trigger: model.date)
            .refreshable { await reload() }
            .navigationTitle("Birthed")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if let shareImage {
                        ShareLink(
                            item: shareImage,
                            preview: SharePreview(model.date.displayName(), image: shareImage)
                        ) {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingAttributions = true
                    } label: {
                        Label("Sources", systemImage: "info.circle")
                    }
                }
            }
            .sheet(isPresented: $showingAttributions) {
                AttributionsView()
            }
            .sheet(item: $openingStory) { story in
                WallStoryView(storyID: story.id, date: model.date, palette: palette)
            }
            .sheet(item: $sharingFact) { fact in
                ShareCardPicker(
                    choices: [FoundFactsSection.shareChoice(
                        for: fact, dateName: nil, palette: palette
                    )],
                    subject: model.date.displayName()
                )
            }
            .task { await reload() }
            .onDisappear {
                // A sample must not keep playing into whatever the reader
                // opened next.
                preview.stop()
                Task { await factsService.flushSeen() }
            }
        }
        .tint(Theme.accent)
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Text(model.isToday ? "TODAY" : "THIS DAY")
                    .font(.caption.weight(.heavy))
                    .kerning(2.5)
                    .foregroundStyle(Theme.accent)

                Spacer()

                stepper
            }

            Text(model.date.displayName())
                .font(.system(.largeTitle, design: .serif, weight: .heavy))
                .foregroundStyle(.primary)
                .lineLimit(2)
                .minimumScaleFactor(0.6)
                .contentTransition(.opacity)

            // Only when the line says something the page does not already
            // show. With a birth year, "how old you were" is on every row
            // below and the hive's question is the next thing on the
            // screen; a subtitle between them was one more block before the
            // board. Without one, this is the one place after onboarding
            // that makes the case for adding it, and it stays.
            if let subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            // The date's own clock, its own budget and its sentence about
            // what people remembered all came off this tab with the three
            // answers. The page ran two games on two clocks, and section 14
            // settles that there is one game and the hive's clock is it.
            // Nothing is dropped from the database: `RememberService` still
            // loads and the sealed order below is still the sealed order. The
            // sentence that used to explain that rearrangement is a named
            // open question rather than a reworded dodge of the one word the
            // acceptance forbids.
            //
            // The three counts used to close the header. They are over the
            // feed now, in `body`, because that is what they count.
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 4)
        .padding(.bottom, 14)
    }

    /// What the day holds, before any of it. The same three counts the
    /// website prints under its heading, and the same job: a reader can see
    /// the size of the day before scrolling it. Drawn over the feed, under
    /// the hive.
    private var counts: some View {
        let items = feed
        let cells = [
            CountCell(label: "things", number: items.filter { $0.kind == .fact || $0.kind == .event }.count),
            CountCell(label: "charts", number: items.filter { $0.kind == .song || $0.kind == .film }.count),
            CountCell(label: "people", number: items.filter { $0.kind == .person }.count),
        ].filter { $0.number > 0 }

        return HStack(spacing: 0) {
            ForEach(cells) { cell in
                VStack(spacing: 5) {
                    Text(String(cell.number))
                        .font(.system(.title3, design: .serif, weight: .heavy))
                        .monospacedDigit()
                        .foregroundStyle(palette.type)
                    Text(cell.label.uppercased())
                        .font(.system(size: 10, weight: .semibold))
                        .kerning(1.0)
                        .foregroundStyle(palette.type.opacity(0.45))
                }
                .frame(maxWidth: .infinity)
                .overlay(alignment: .leading) {
                    if cell.id != cells.first?.id {
                        Rectangle()
                            .fill(palette.type.opacity(0.12))
                            .frame(width: 1)
                    }
                }
            }
        }
        .padding(.vertical, 14)
        .overlay(alignment: .top) { rule }
        .overlay(alignment: .bottom) { rule }
        .padding(.top, 8)
    }

    private var rule: some View {
        Rectangle().fill(palette.type.opacity(0.12)).frame(height: 1)
    }

    private struct CountCell: Identifiable {
        let label: String
        let number: Int
        var id: String { label }
    }

    private var stepper: some View {
        HStack(spacing: 4) {
            Button {
                Task { await move(-1) }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .frame(width: 40, height: 34)
            }
            .accessibilityLabel("Previous day")

            Button {
                Task { await move(1) }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .frame(width: 40, height: 34)
            }
            .accessibilityLabel("Next day")
        }
        .buttonStyle(.plain)
        .foregroundStyle(.secondary)
    }

    /// The one line under the date, when there is something to say. While
    /// the day loads or fails it says so. Without a birth year it is the one
    /// place in the app after onboarding that makes the case for adding it.
    /// With one, nil: "how old you were" is on every row of the feed and
    /// does not need announcing above the hive.
    private var subtitle: String? {
        switch model.state {
        case .loading:
            return "Looking up this day."
        case .failed:
            return "This day did not load."
        case .empty, .loaded:
            if readerBirthYear != nil {
                return nil
            }
            return "What happened on this day. Add your birth year in Settings to see how old you were."
        }
    }

    // MARK: The feed

    @ViewBuilder
    private var content: some View {
        let items = feed
        // The one feed: this year's news, then the timeline, then anything
        // the worker filed that the timeline did not draw. `HiveFeed` decides
        // all of it and is tested; nothing here works anything out.
        let rows = wall.feed(items: items)
        // Bound outside the switch, the way `rows` already is, because a
        // result builder is not the place to work anything out.
        let shown = showingAll ? rows : Array(rows.prefix(Self.firstLook))
        switch model.state {
        case .loading where items.isEmpty && rows.isEmpty:
            ProgressView()
                .controlSize(.large)
                .frame(maxWidth: .infinity, minHeight: 220)

        case let .failed(message) where items.isEmpty && rows.isEmpty:
            // NFR-021: a failed request explains itself and offers a retry.
            messageCard(symbol: "wifi.exclamationmark", title: "This day did not load", body: message) {
                Button("Try again") { Task { await reload() } }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.accent)
            }

        case .empty where items.isEmpty && rows.isEmpty:
            messageCard(
                symbol: "calendar",
                title: "Nothing here yet",
                body: "Birthed has not imported anything for \(model.date.displayName()) yet."
            ) {
                EmptyView()
            }

        default:
            // Straight into the lazy stack, so a feed of a hundred and fifty
            // rows builds the ones on screen and not the ones below it.
            //
            // And it no longer offers all hundred and fifty. Printing
            // everything is what made the website read as generated, and this
            // screen was doing the same thing. Nothing is dropped: the rest is
            // one tap away and the tap is the only thing standing in front of
            // it.
            ForEach(Array(shown.enumerated()), id: \.element.id) { index, row in
                VStack(alignment: .leading, spacing: 0) {
                    if index > 0 { hairline }
                    if let item = row.item {
                        FeedRow(item: item, palette: palette, isLead: index == 0,
                                // The front page lead, and only on a date that
                                // has sealed. On an open date nothing has
                                // earned the top of the page yet, and setting
                                // a row large because it happened to be dealt
                                // first would be putting a headline on a story
                                // nobody chose.
                                isSealedLead: index == 0 && remember.edition?.isSealed == true,
                                onLike: { fact in Task { await factsService.toggleLike(fact) } },
                                onShare: { fact in
                                    sharingFact = fact
                                    Task { await factsService.recordShareOpen(fact.id) }
                                },
                                onOpen: { url in openURL(url) },
                                playing: item.kind != .film && item.previewURL != nil
                                         && item.previewURL == preview.nowPlaying,
                                onPlay: { url in preview.toggle(url) })
                    } else if let story = row.story {
                        // A story with no timeline row of its own: the day's
                        // news, and anything the worker filed that the
                        // timeline did not draw.
                        HiveStoryRow(story: story, palette: palette,
                                     onOpen: { openingStory = story })
                    }
                    // The one verb, on any row the worker filed a story for.
                    if let story = row.story {
                        HiveRowBuzz(story: story, date: model.date, palette: palette,
                                    onOpen: { openingStory = story })
                    }
                }
                .padding(.horizontal, 22)
                .onAppear { if let fact = row.item?.fact { factsService.noteSeen(fact.id) } }
            }

            if !showingAll, rows.count > Self.firstLook {
                moreButton(hidden: rows.count - Self.firstLook)
            }
        }
    }

    /// How much of a day is shown before the reader asks for the rest.
    private static let firstLook = 12

    private func moreButton(hidden: Int) -> some View {
        Button {
            withAnimation(.easeOut(duration: 0.25)) { showingAll = true }
        } label: {
            HStack(spacing: 10) {
                Text("Everything else on this day")
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 8)
                Text("\(hidden) more")
                    .font(.subheadline)
                    .foregroundStyle(palette.type.opacity(0.5))
                Image(systemName: "plus")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(Theme.accent)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 15)
            .background(palette.type.opacity(0.05), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .foregroundStyle(palette.type)
        .padding(.horizontal, 22)
        .padding(.top, 24)
    }

    private var hairline: some View {
        Rectangle()
            .fill(palette.type.opacity(0.09))
            .frame(height: 1)
            .padding(.vertical, 16)
    }

    private func messageCard<Action: View>(
        symbol: String,
        title: String,
        body message: String,
        @ViewBuilder action: () -> Action
    ) -> some View {
        VStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 34))
                .foregroundStyle(Theme.accent)
            Text(title)
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            action()
        }
        .frame(maxWidth: .infinity)
        .padding(28)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding(.horizontal, 20)
    }

    // MARK: Attribution

    /// FR-027. Attribution is on the page, and the full text is one tap away.
    private var attribution: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Names, years and descriptions come from Wikidata. What happened on this day and the chart weeks come from Wikipedia.")
            Text("Facts marked with a source were found by Google's Gemini searching the web, and each carries the page it came from.")
            Text("Credit to Wikipedia and Wikidata. Charts are Billboard's and the box office is as reported; Birthed is not affiliated with either.")
            Button("Read the full attribution") {
                showingAttributions = true
            }
            .font(.caption.weight(.semibold))
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 28)
    }

    // MARK: Actions

    private func reload() async {
        // A new date is a new day's worth of rows, so it opens at its own
        // first dozen rather than inheriting the last date's expansion.
        showingAll = false
        openingStory = nil
        // Two awaits in a row rather than two child tasks. Both callees live
        // on the main actor, so running them as children would carry nothing
        // Sendable and buy no time.
        await model.load(readerBirthYear: readerBirthYear)
        await factsService.readDay(month: model.date.month, day: model.date.day)
        await remember.load(month: model.date.month, day: model.date.day)
        await wall.load(date: model.date)
        shareImage = renderShareCard()
    }

    private func move(_ days: Int) async {
        shareImage = nil
        preview.stop()
        // The arrows do not go through `reload`, so this has to be said in
        // both places or a date walked to opens already expanded.
        showingAll = false
        openingStory = nil
        await model.move(byDays: days, readerBirthYear: readerBirthYear)
        await factsService.readDay(month: model.date.month, day: model.date.day)
        await remember.load(month: model.date.month, day: model.date.day)
        await wall.load(date: model.date)
        shareImage = renderShareCard()
    }

    /// FR-117. Rendered on device, so it works with the network switched off.
    private func renderShareCard() -> Image? {
        let people = model.people
        guard !people.isEmpty else { return nil }
        let renderer = ImageRenderer(
            content: ShareCardView(date: model.date, people: Array(people.prefix(6)))
        )
        renderer.scale = 2
        guard let rendered = renderer.uiImage else { return nil }
        return Image(uiImage: rendered)
    }
}

// MARK: - One row

/// One item of the feed: the kind, the age, the thing, and where it came from.
///
/// The same shape as a found fact row on Mine, because the found facts are in
/// this feed too and a reader should not be able to tell which rows a model
/// found and which a table held. The age label is the one thing every row
/// has that no other app's row does.
private struct FeedRow: View {
    let item: DayFeed.Item
    let palette: StagePalette
    var isLead: Bool = false
    /// The one row a sealed date decided was its lead.
    ///
    /// Set large, with its artwork above the text rather than beside it, so
    /// the page has a front page rather than a hundred and fifty rows of
    /// identical weight. The hierarchy is real: it was not chosen by an
    /// editor, a model or a vote, it is the row the date's own people said
    /// they remembered, and it only exists once the date can never take
    /// another answer.
    var isSealedLead: Bool = false
    let onLike: (BirthFact) -> Void
    let onShare: (BirthFact) -> Void
    let onOpen: (URL) -> Void
    var playing: Bool = false
    var onPlay: (URL) -> Void = { _ in }

    var body: some View {
        if isSealedLead {
            lead
        } else {
            // The cover sits beside the row rather than above it. A chart row
            // is three short lines, and a square the height of three short
            // lines is the one place it fits without pushing everything else
            // down a screen.
            HStack(alignment: .top, spacing: 13) {
                if let art = item.artworkURL {
                    cover(art)
                }
                rowText
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// The lead: artwork the width of the page, then the sentence, set large.
    ///
    /// The opposite arrangement to every other row, on purpose. Everywhere
    /// else the picture is a thumbnail beside three short lines, because a
    /// hundred and fifty full width images is a scroll nobody finishes. Here
    /// there is exactly one, and it is the whole point of a front page: the
    /// eye lands on it before it reads anything.
    private var lead: some View {
        VStack(alignment: .leading, spacing: 14) {
            if let art = item.artworkURL {
                AsyncImage(url: art) { phase in
                    if case let .success(image) = phase {
                        image.resizable().aspectRatio(contentMode: .fill)
                    } else {
                        palette.type.opacity(0.06)
                    }
                }
                // Square for a sleeve, two by three for a poster, which is
                // what a film poster has been since before anybody reading
                // this was born.
                .aspectRatio(item.kind == .film ? 2.0 / 3.0 : 1, contentMode: .fit)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(palette.type.opacity(0.12), lineWidth: 0.75)
                )
                .overlay(alignment: .bottomTrailing) {
                    if item.previewURL != nil, item.kind != .film {
                        ZStack {
                            Circle().fill(.black.opacity(0.5)).frame(width: 44, height: 44)
                            Image(systemName: playing ? "pause.fill" : "play.fill")
                                .font(.system(size: 17, weight: .black))
                                .foregroundStyle(.white)
                                .offset(x: playing ? 0 : 2)
                        }
                        .padding(14)
                    }
                }
                .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .onTapGesture {
                    if let sample = item.previewURL, item.kind != .film {
                        onPlay(sample)
                    } else if let store = item.storeURL {
                        onOpen(store)
                    }
                }
            }

            leadText
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 6)
    }

    /// The lead's words. The same parts as any other row, at the size a lead
    /// is set in, and with the kicker saying what put it here.
    private var leadText: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(alignment: .center, spacing: 8) {
                Text(item.kicker)
                    .font(.system(size: 10, weight: .heavy))
                    .kerning(1.6)
                    .foregroundStyle(Theme.kicker(kind: item.kind, category: item.fact?.category))

                if let age = item.ageLabel {
                    Text(age.uppercased())
                        .font(.system(size: 9, weight: .heavy))
                        .kerning(1.2)
                        .foregroundStyle(palette.type.opacity(0.55))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(palette.type.opacity(0.09), in: Capsule())
                }

                Spacer(minLength: 8)

                if let fact = item.fact {
                    shareButton(fact)
                    likeButton(fact)
                }
            }

            Text(item.text)
                .font(.system(size: 32, weight: .heavy, design: .serif))
                .lineSpacing(3)
                .foregroundStyle(palette.type)
                .fixedSize(horizontal: false, vertical: true)
                .multilineTextAlignment(.leading)

            detailLine
        }
    }

    /// A sleeve is square and a poster is not.
    ///
    /// Two by three is what a film poster has been since before anybody
    /// reading this was born, and cropping one into a square takes the title
    /// treatment off the bottom of it, which is most of what a poster is for.
    /// Both shapes are the same height, so a row of songs and a row of films
    /// still line up down the page.
    private var artSize: CGSize {
        item.kind == .film ? CGSize(width: 44, height: 66) : CGSize(width: 64, height: 64)
    }

    /// The cover, at the size three lines of text are tall.
    ///
    /// Pointed at Apple's image server rather than bundled. Nothing is drawn
    /// into the square until it arrives: a grey box that never fills in is
    /// worse than a row that simply has no picture, and this feed already has
    /// rows with no picture, so an empty square is a state it knows how to be.
    private func cover(_ url: URL) -> some View {
        AsyncImage(url: url) { phase in
            if case let .success(image) = phase {
                image.resizable().aspectRatio(contentMode: .fill)
            } else {
                palette.type.opacity(0.06)
            }
        }
        .frame(width: artSize.width, height: artSize.height)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(palette.type.opacity(0.12), lineWidth: 0.75)
        )
        // The sample when there is one, the store page when there is not.
        // Four in five matched titles have a sample, so tapping a cover
        // usually plays and occasionally opens Apple Music, and the mark on
        // the sleeve says which before it is touched.
        .overlay {
            // Films are excluded on purpose. Apple's preview for a film is a
            // trailer, which is a minute of a different thing, not thirty
            // seconds of the thing itself, and a play mark on a poster would
            // promise the wrong medium.
            if item.previewURL != nil, item.kind != .film {
                ZStack {
                    Circle()
                        .fill(.black.opacity(0.42))
                        .frame(width: 26, height: 26)
                    Image(systemName: playing ? "pause.fill" : "play.fill")
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(.white)
                        .offset(x: playing ? 0 : 1)
                }
            }
        }
        .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .onTapGesture {
            if let sample = item.previewURL, item.kind != .film {
                onPlay(sample)
            } else if let store = item.storeURL {
                onOpen(store)
            }
        }
        .accessibilityLabel(item.previewURL != nil && item.kind != .film
                            ? (playing ? "Stop the sample" : "Play a sample of \(item.text)")
                            : "Open \(item.text) on Apple")
        .accessibilityAddTraits(.isButton)
    }

    private var rowText: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                Text(item.kicker)
                    .font(.system(size: 10, weight: .heavy))
                    .kerning(1.6)
                    .foregroundStyle(Theme.kicker(kind: item.kind, category: item.fact?.category))

                if let age = item.ageLabel {
                    Text(age.uppercased())
                        .font(.system(size: 9, weight: .heavy))
                        .kerning(1.2)
                        .foregroundStyle(palette.type.opacity(0.55))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(palette.type.opacity(0.09), in: Capsule())
                } else if let year = item.year, item.kind != .song, item.kind != .film {
                    Text(String(year))
                        .font(.system(size: 9, weight: .heavy))
                        .kerning(1.2)
                        .foregroundStyle(palette.type.opacity(0.55))
                }

                if let fact = item.fact, fact.isLocal {
                    Text("NEAR YOU")
                        .font(.system(size: 9, weight: .heavy))
                        .kerning(1.2)
                        .foregroundStyle(palette.type.opacity(0.55))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(palette.type.opacity(0.09), in: Capsule())
                }

                Spacer(minLength: 8)

                if let fact = item.fact {
                    shareButton(fact)
                    likeButton(fact)
                }
            }

            Text(item.text)
                // A lead row with a cover beside it has about a third less
                // width to play with, so the largest size would set two words
                // per line. It steps down when it is sharing the row.
                .font(.system(size: isLead && item.artworkURL == nil ? 27 : 19,
                              weight: isLead ? .bold : .semibold, design: .serif))
                .lineSpacing(isLead ? 2 : 0)
                .foregroundStyle(palette.type)
                .fixedSize(horizontal: false, vertical: true)
                .multilineTextAlignment(.leading)

            detailLine
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The description under a name, the artist under a song, the host
    /// under a sentence. One line, quiet, and a link when there is a page.
    @ViewBuilder
    private var detailLine: some View {
        switch item.kind {
        case .fact:
            if let url = item.sourceURL, let host = FoundFactsSection.host(of: url) {
                sourceLink(host, url)
            }
        case .event:
            if let url = item.sourceURL {
                sourceLink("en.wikipedia.org", url)
            }
        case .person:
            HStack(spacing: 6) {
                if let detail = item.detail, !detail.isEmpty {
                    Text(detail)
                        .lineLimit(2)
                }
                if let url = item.sourceURL {
                    Button { onOpen(url) } label: {
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 9, weight: .bold))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Open the source record for \(item.text)")
                }
            }
            .font(.caption)
            .foregroundStyle(palette.type.opacity(0.55))
        case .song, .film:
            if let detail = item.detail {
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(palette.type.opacity(0.55))
            }
        }
    }

    private func sourceLink(_ host: String, _ url: URL) -> some View {
        Button { onOpen(url) } label: {
            HStack(spacing: 4) {
                Text(host)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 9, weight: .bold))
            }
            .font(.caption)
            .foregroundStyle(palette.type.opacity(0.42))
        }
        .buttonStyle(.plain)
    }

    private func shareButton(_ fact: BirthFact) -> some View {
        Button {
            onShare(fact)
        } label: {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(palette.type.opacity(0.45))
                .padding(.horizontal, 9)
                .padding(.vertical, 6)
                .background(palette.type.opacity(0.07), in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Share this fact")
    }

    private func likeButton(_ fact: BirthFact) -> some View {
        Button {
            onLike(fact)
        } label: {
            HStack(spacing: 5) {
                Image(systemName: fact.likedByMe ? "hand.thumbsup.fill" : "hand.thumbsup")
                    .font(.system(size: 12, weight: .semibold))
                if fact.likes > 0 {
                    Text(fact.likes.formatted())
                        .font(.caption.weight(.bold).monospacedDigit())
                        .contentTransition(.numericText())
                }
            }
            .foregroundStyle(fact.likedByMe ? Theme.accent : palette.type.opacity(0.45))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                fact.likedByMe ? Theme.accent.opacity(0.15) : palette.type.opacity(0.07),
                in: Capsule()
            )
        }
        .buttonStyle(.plain)
        .animation(.spring(duration: 0.3), value: fact.likes)
        .sensoryFeedback(.impact(weight: .light), trigger: fact.likedByMe)
        .accessibilityLabel(fact.likedByMe ? "Liked, tap to undo" : "Like this fact")
    }
}
