import SwiftUI

/// The day page. The core object of the product, rendered.
///
/// `FR-020` through `FR-027` and `FR-030`. Names, years, descriptions,
/// attribution that is visible on the page rather than buried, and the ability
/// to walk to another date.
struct DayPageView: View {
    @State private var model: DayPageViewModel
    @State private var showingAttributions = false
    @State private var shareImage: Image?

    init(date: CalendarDate, repository: DayPageRepository) {
        _model = State(initialValue: DayPageViewModel(date: date, repository: repository))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    header
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
        .padding(.top, 12)
        .padding(.bottom, 22)
    }

    private var stepper: some View {
        HStack(spacing: 4) {
            Button {
                Task { await move(-1) }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.footnote.weight(.bold))
                    .frame(width: 34, height: 34)
            }
            .accessibilityLabel("Previous day")

            Button {
                Task { await move(1) }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.bold))
                    .frame(width: 34, height: 34)
            }
            .accessibilityLabel("Next day")
        }
        .buttonStyle(.bordered)
        .buttonBorderShape(.circle)
    }

    private var subtitle: String {
        switch model.state {
        case .loading:
            return "Looking up who shares it."
        case let .loaded(people):
            return people.count == 1
                ? "1 notable person shares this day."
                : "\(people.count) notable people share this day."
        case .empty:
            return "Nobody imported yet."
        case .failed:
            return "This day did not load."
        }
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
            LazyVStack(spacing: 10) {
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
        shareImage = renderShareCard()
    }

    private func move(_ days: Int) async {
        shareImage = nil
        await model.move(byDays: days)
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
    let person: NotablePerson

    var body: some View {
        // FR-024. Every entry links to the record it came from.
        Link(destination: person.sourceURL) {
            HStack(alignment: .top, spacing: 14) {
                yearBadge

                VStack(alignment: .leading, spacing: 3) {
                    Text(person.name)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .fixedSize(horizontal: false, vertical: true)

                    if let description = person.shortDescription, !description.isEmpty {
                        Text(description)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    if let died = person.deathYear {
                        Text("died \(String(died))")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "arrow.up.forward")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
            .padding(16)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(person.name), \(person.lifespan). Opens the source record.")
    }

    private var yearBadge: some View {
        Text(person.birthYear.map { String($0) } ?? "?")
            .font(.footnote.weight(.bold).monospacedDigit())
            .foregroundStyle(Theme.accent)
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(Theme.accent.opacity(0.12), in: Capsule())
    }
}
