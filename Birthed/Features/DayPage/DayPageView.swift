import SwiftUI

/// The day page. The core object of the product, rendered.
///
/// `FR-020` through `FR-027` and `FR-030`. Names, years, descriptions,
/// attribution that is visible on the page rather than buried, and the ability
/// to walk to another date.
struct DayPageView: View {
    @Environment(FactsService.self) private var factsService
    @Environment(\.colorScheme) private var colorScheme

    @State private var model: DayPageViewModel
    @State private var showingAttributions = false
    @State private var shareImage: Image?
    @State private var sharingFact: BirthFact?

    let onOpenSettings: () -> Void

    init(date: CalendarDate, repository: DayPageRepository, onOpenSettings: @escaping () -> Void) {
        self.onOpenSettings = onOpenSettings
        _model = State(initialValue: DayPageViewModel(date: date, repository: repository))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    header
                    // Above the names on purpose. Ten names is the part of
                    // this screen that every competitor already has, and a
                    // reader who has to scroll past them to reach the only
                    // unusual thing on the page mostly does not scroll.
                    found
                    content
                    attribution
                }
                .padding(.bottom, 32)
            }
            .background(Theme.canvas)
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
                // No date above the fact: a calendar date fact already names
                // the date in its own sentence.
                ShareCardPicker(
                    choices: [FoundFactsSection.shareChoice(
                        for: fact, dateName: nil, palette: .forScheme(colorScheme)
                    )],
                    subject: model.date.displayName()
                )
            }
            .task { await reload() }
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
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 4)
        .padding(.bottom, 18)
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

    private var subtitle: String {
        switch model.state {
        case .loading:
            return "Looking up who shares it."
        case .loaded:
            return factsService.dayFacts.isEmpty
                ? "The people most looked up on this day."
                : "What happened on it, and who shares it."
        case .empty:
            return factsService.dayFacts.isEmpty
                ? "Nobody imported yet."
                : "What happened on it."
        case .failed:
            return "This day did not load."
        }
    }

    // MARK: What happened

    /// The same section the Mine tab uses, reading the same rows, for a date
    /// the reader is only visiting rather than one that is theirs.
    ///
    /// This reads and never asks. A search costs money for each date it has
    /// never seen, and this screen walks from date to date, so a reader
    /// flicking through a month must not be able to spend a month of them. A
    /// date nobody has searched has no section here and nothing says so,
    /// because a heading over an empty space reads as a broken screen.
    private var found: some View {
        FoundFactsSection(
            facts: factsService.dayFacts,
            status: .done,
            dateName: model.date.displayName(),
            palette: .forScheme(colorScheme),
            onLike: { fact in Task { await factsService.toggleLike(fact) } },
            title: "WHAT HAPPENED ON THIS DAY",
            onSeen: { factsService.noteSeen($0.id) },
            onShare: { fact in
                sharingFact = fact
                Task { await factsService.recordShareOpen(fact.id) }
            }
        )
        .padding(.bottom, factsService.dayFacts.isEmpty ? 0 : 30)
        .onDisappear { Task { await factsService.flushSeen() } }
    }

    // MARK: Content

    @ViewBuilder
    private var content: some View {
        switch model.state {
        case .loading:
            ProgressView()
                .controlSize(.large)
                .frame(maxWidth: .infinity, minHeight: 220)

        case let .failed(message):
            // NFR-021: a failed request explains itself and offers a retry.
            messageCard(
                symbol: "wifi.exclamationmark",
                title: "This day did not load",
                body: message
            ) {
                Button("Try again") {
                    Task { await reload() }
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.accent)
            }

        case .empty:
            // NFR-021: an empty list names the reason rather than showing
            // nothing at all.
            messageCard(
                symbol: "calendar",
                title: "Nobody here yet",
                body: "Birthed has not imported anyone born on \(model.date.displayName()) yet."
            ) {
                EmptyView()
            }

        case let .loaded(people):
            LazyVStack(spacing: 8) {
                ForEach(people) { person in
                    PersonCard(person: person)
                }
            }
            .padding(.horizontal, 20)
        }
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
            Text("Names, years and descriptions come from Wikidata.")
            Text("What happened on this day was found by Google's Gemini searching the web, and each one carries the page it came from.")
            Text("Credit to Wikipedia and Wikidata.")
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
        await model.load()
        await factsService.readDay(month: model.date.month, day: model.date.day)
        shareImage = renderShareCard()
    }

    private func move(_ days: Int) async {
        shareImage = nil
        await model.move(byDays: days)
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

// MARK: - Person card

private struct PersonCard: View {
    @Environment(\.openURL) private var openURL
    let person: NotablePerson

    var body: some View {
        // FR-024. Every entry links to the record it came from. Deliberately a
        // plain button rather than a Link: a Link tints its whole label with
        // the accent colour and centres wrapped text, which turned every name
        // pink and every description into a greetings card.
        Button {
            openURL(person.sourceURL)
        } label: {
            HStack(alignment: .top, spacing: 12) {
                yearBadge

                VStack(alignment: .leading, spacing: 2) {
                    Text(person.name)
                        .font(.system(.headline, design: .default, weight: .semibold))
                        .foregroundStyle(.primary)

                    if let description = person.shortDescription, !description.isEmpty {
                        Text(description)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }

                    if let died = person.deathYear {
                        Text("died \(String(died))")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(person.name), \(person.lifespan). Opens the source record.")
    }

    private var yearBadge: some View {
        Text(person.birthYear.map { String($0) } ?? "?")
            .font(.caption.weight(.semibold).monospacedDigit())
            .foregroundStyle(Theme.accent)
            .frame(width: 42, alignment: .leading)
            .padding(.top, 2)
    }
}
