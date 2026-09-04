import SwiftUI

/// The day page. The core object of the product, rendered.
///
/// Slice 1 shows one date: names, years, descriptions, and attribution that is
/// visible on the page rather than buried. `FR-020` through `FR-027`.
struct DayPageView: View {
    @State private var model: DayPageViewModel
    @State private var showingAttributions = false
    @State private var shareImage: Image?

    init(date: CalendarDate, repository: DayPageRepository) {
        _model = State(initialValue: DayPageViewModel(date: date, repository: repository))
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle(model.date.displayName())
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
    }

    @ViewBuilder
    private var content: some View {
        switch model.state {
        case .loading:
            ProgressView()
                .controlSize(.large)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

        case let .failed(message):
            // NFR-021: a failed request explains itself and offers a retry.
            ContentUnavailableView {
                Label("This day did not load", systemImage: "wifi.exclamationmark")
            } description: {
                Text(message)
            } actions: {
                Button("Try again") {
                    Task { await reload() }
                }
                .buttonStyle(.borderedProminent)
            }

        case .empty:
            // NFR-021: an empty list names the reason rather than showing
            // nothing at all.
            ContentUnavailableView {
                Label("Nobody here yet", systemImage: "calendar")
            } description: {
                Text("Birthed has not imported anyone born on \(model.date.displayName()) yet.")
            }

        case let .loaded(people):
            peopleList(people)
        }
    }

    private func peopleList(_ people: [NotablePerson]) -> some View {
        List {
            Section {
                ForEach(people) { person in
                    PersonRow(person: person)
                }
            } header: {
                Text(people.count == 1
                     ? "1 person shares this day"
                     : "\(people.count) people share this day")
            }

            Section {
                attribution
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await reload() }
    }

    /// FR-027. Attribution is on the page, and the full text is one tap away.
    private var attribution: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Names, years and descriptions come from Wikidata.")
            Text("Credit to Wikipedia and Wikidata.")
            Button("Read the full attribution") {
                showingAttributions = true
            }
            .font(.footnote.weight(.semibold))
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
        .padding(.vertical, 2)
    }

    private func reload() async {
        await model.load()
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

private struct PersonRow: View {
    let person: NotablePerson

    var body: some View {
        // FR-024. Every entry links to the record it came from.
        Link(destination: person.sourceURL) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(person.name)
                        .font(.headline)
                        .foregroundStyle(.primary)

                    if !person.lifespan.isEmpty {
                        Text(person.lifespan)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    if let description = person.shortDescription, !description.isEmpty {
                        Text(description)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "arrow.up.forward.square")
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, 4)
        }
        .accessibilityLabel("\(person.name), \(person.lifespan). Opens the source record.")
    }
}
