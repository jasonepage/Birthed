import SwiftUI

/// The Today tab: everything about a date, in one feed, with the reader's age
/// on each item.
///
/// `FR-020` through `FR-027` and `FR-030` still hold: names and years,
/// attribution on the page, and two arrows to walk to another date. What
/// changed is that the names are one kind of row among five. The order and
/// the age labels come from `DayFeed` in the domain, where they are tested;
/// this file only draws rows.
struct DayPageView: View {
    @Environment(FactsService.self) private var factsService
    @Environment(ProfileStore.self) private var profileStore
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.openURL) private var openURL

    @State private var model: DayPageViewModel
    @State private var showingAttributions = false
    @State private var shareImage: Image?
    @State private var sharingFact: BirthFact?
    /// A day can carry a hundred and fifty rows. It opens with the first
    /// dozen and the reader asks for the rest.
    @State private var showingAll = false

    let onOpenSettings: () -> Void

    init(date: CalendarDate, repository: DayPageRepository, onOpenSettings: @escaping () -> Void) {
        self.onOpenSettings = onOpenSettings
        _model = State(initialValue: DayPageViewModel(date: date, repository: repository))
    }

    private var readerBirthYear: Int? { profileStore.profile?.birthday.year }
    private var palette: StagePalette { .forScheme(colorScheme) }

    private var feed: [DayFeed.Item] {
        model.feed(facts: factsService.dayFacts, readerBirthYear: readerBirthYear)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    header
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
            .sheet(item: $sharingFact) { fact in
                ShareCardPicker(
                    choices: [FoundFactsSection.shareChoice(
                        for: fact, dateName: nil, palette: palette
                    )],
                    subject: model.date.displayName()
                )
            }
            .task { await reload() }
            .onDisappear { Task { await factsService.flushSeen() } }
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

            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if !feed.isEmpty { counts }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 4)
        .padding(.bottom, 18)
    }

    /// What the day holds, before any of it. The same three counts the
    /// website prints under its heading, and the same job: a reader can see
    /// the size of the day without scrolling it.
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

    /// The one line under the date. With a birth year it says what the feed
    /// is: this date, in the reader's years. Without one it is the one place
    /// in the app after onboarding that makes the case for adding it.
    private var subtitle: String {
        switch model.state {
        case .loading:
            return "Looking up this day."
        case .failed:
            return "This day did not load."
        case .empty, .loaded:
            if readerBirthYear != nil {
                return "What happened on this day, and how old you were."
            }
            return "What happened on this day. Add your birth year in Settings to see how old you were."
        }
    }

    // MARK: The feed

    @ViewBuilder
    private var content: some View {
        let items = feed
        // Bound outside the switch, the way `items` already is, because a
        // result builder is not the place to work anything out.
        let shown = showingAll ? items : Array(items.prefix(Self.firstLook))
        switch model.state {
        case .loading where items.isEmpty:
            ProgressView()
                .controlSize(.large)
                .frame(maxWidth: .infinity, minHeight: 220)

        case let .failed(message) where items.isEmpty:
            // NFR-021: a failed request explains itself and offers a retry.
            messageCard(symbol: "wifi.exclamationmark", title: "This day did not load", body: message) {
                Button("Try again") { Task { await reload() } }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.accent)
            }

        case .empty where items.isEmpty:
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
            ForEach(Array(shown.enumerated()), id: \.element.id) { index, item in
                VStack(alignment: .leading, spacing: 0) {
                    if index > 0 { hairline }
                    FeedRow(item: item, palette: palette, isLead: index == 0,
                            onLike: { fact in Task { await factsService.toggleLike(fact) } },
                            onShare: { fact in
                                sharingFact = fact
                                Task { await factsService.recordShareOpen(fact.id) }
                            },
                            onOpen: { url in openURL(url) })
                }
                .padding(.horizontal, 22)
                .onAppear { if let fact = item.fact { factsService.noteSeen(fact.id) } }
            }

            if !showingAll, items.count > Self.firstLook {
                moreButton(hidden: items.count - Self.firstLook)
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
        // Two awaits in a row rather than two child tasks. Both callees live
        // on the main actor, so running them as children would carry nothing
        // Sendable and buy no time.
        await model.load(readerBirthYear: readerBirthYear)
        await factsService.readDay(month: model.date.month, day: model.date.day)
        shareImage = renderShareCard()
    }

    private func move(_ days: Int) async {
        shareImage = nil
        // The arrows do not go through `reload`, so this has to be said in
        // both places or a date walked to opens already expanded.
        showingAll = false
        await model.move(byDays: days, readerBirthYear: readerBirthYear)
        await factsService.readDay(month: model.date.month, day: model.date.day)
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
    let onLike: (BirthFact) -> Void
    let onShare: (BirthFact) -> Void
    let onOpen: (URL) -> Void

    var body: some View {
        // The cover sits beside the row rather than above it. A chart row is
        // three short lines, and a square the height of three short lines is
        // the one place it fits without pushing everything else down a screen.
        HStack(alignment: .top, spacing: 13) {
            if let art = item.artworkURL {
                cover(art)
            }
            rowText
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
        .frame(width: 64, height: 64)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(palette.type.opacity(0.12), lineWidth: 0.75)
        )
        .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .onTapGesture { if let store = item.storeURL { onOpen(store) } }
        .accessibilityHidden(true)
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
