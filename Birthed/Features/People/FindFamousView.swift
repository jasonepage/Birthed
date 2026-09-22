import SwiftUI

/// Finding somebody public to follow, out of Birthed's own list.
///
/// This lives behind the "Add someone" menu and not on the People tab itself.
/// `docs/first-five-minutes.md` is specific about why: a list of strangers in
/// front of somebody who has not yet added their mother teaches them the app
/// is about celebrities, and the People tab has exactly one job, which is
/// getting real people into it. Somebody who opens this sheet has already
/// decided they want a public figure, so the whole screen can be about that.
///
/// With nothing typed it is two carousels. With something typed it is a list
/// of results, because a search result is read one at a time and a row is the
/// shape for that.
///
/// The suggestions are a database query rather than a model: people who carry
/// a social identifier in Wikidata, ordered by how many people actually look
/// them up, then spread across kinds so it does not come back as six
/// footballers. That last part is not a flourish. The straight popularity
/// order for a birth year of 2003 was Haaland, Bellingham, Sinner, Cucurella,
/// Paredes and Zverev, and a list like that answers a question nobody asked.
struct FindFamousView: View {
    @Environment(PeopleStore.self) private var store
    @Environment(ProfileStore.self) private var profileStore
    @Environment(\.dismiss) private var dismiss

    let repository: DayPageRepository

    @State private var query = ""
    @State private var results: [NotableMatch] = []
    /// The carousels, in the order they are shown. Built once per opening.
    @State private var strips: [Strip] = []
    @State private var searching = false
    @State private var failed = false

    /// One carousel. Its own type rather than a tuple, because `ForEach` needs
    /// an identity and the heading is the one thing that is always unique.
    struct Strip: Identifiable {
        let id: String
        let heading: String
        let people: [NotableMatch]
    }

    private var typing: Bool {
        !query.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var nothingToShow: Bool {
        typing ? results.isEmpty : strips.isEmpty
    }

    var body: some View {
        NavigationStack {
            Group {
                if typing {
                    resultsList
                } else {
                    discovery
                }
            }
            .background(Theme.canvas)
            .navigationTitle("Follow someone")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Search by name")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .overlay {
                if searching && nothingToShow { ProgressView() }
                else if nothingToShow && !searching { emptyLine }
            }
            .task { await loadDiscovery() }
            .task(id: query) { await runSearch() }
        }
        .tint(Theme.accent)
    }

    // MARK: Nothing typed

    /// Two carousels, most useful first.
    ///
    /// Whose birthday is coming up leads, because following somebody pays off
    /// on their birthday and this is the only list where that is days away
    /// rather than months. Born around your year is the browse for when
    /// nothing in the first one lands.
    private var discovery: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 28) {
                ForEach(strips) { strip in
                    carousel(strip)
                }
            }
            .padding(.top, 14)
            .padding(.bottom, 34)
        }
    }

    private func carousel(_ strip: Strip) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(strip.heading)
                .font(.caption.weight(.heavy))
                .kerning(2.5)
                .foregroundStyle(Theme.accent)
                .padding(.horizontal, 20)

            ScrollView(.horizontal) {
                LazyHStack(spacing: 12) {
                    ForEach(strip.people) { match in
                        FollowCard(match: match)
                    }
                }
                .scrollTargetLayout()
            }
            // The inset belongs to the scroll view, not to the row inside it.
            // As padding on the stack, the first card starts at the edge and
            // only looks inset until somebody scrolls, which is why the left
            // card was being clipped.
            .contentMargins(.horizontal, 20, for: .scrollContent)
            .scrollTargetBehavior(.viewAligned)
            .scrollIndicators(.hidden)
        }
    }

    // MARK: Something typed

    private var resultsList: some View {
        List {
            Section {
                ForEach(results) { match in
                    FollowRow(match: match)
                }
            } header: {
                Text("Results")
            }
        }
        .listStyle(.insetGrouped)
    }

    @ViewBuilder
    private var emptyLine: some View {
        if failed {
            Text("Could not reach the list just now.")
                .foregroundStyle(.secondary)
        } else if typing {
            Text("Nobody by that name.")
                .foregroundStyle(.secondary)
        } else {
            Text("Nobody to suggest yet.")
                .foregroundStyle(.secondary)
        }
    }

    // MARK: Loading

    /// Both carousels, once per opening of the sheet.
    ///
    /// Run together rather than one after the other, since neither needs the
    /// other's answer and this sheet is opened by somebody waiting to look at
    /// it. The week is asked for by date rather than by a number of days,
    /// because the turn of a month and February 29 are calendar problems and
    /// they are solved in `UpcomingDates`, where they are tested.
    ///
    /// A different twenty every time for the year list. The pool is the eighty
    /// most looked up people near the reader's age; everybody in it is popular
    /// enough to be offered, so it is dealt before it is spread across kinds,
    /// because the same six names at the top of every open would make the list
    /// read as the whole list. People already followed are left out, since a
    /// card that only says "done" is a card somebody has to scroll past.
    private func loadDiscovery() async {
        guard strips.isEmpty else { return }
        searching = true
        defer { searching = false }

        let profile = profileStore.profile
        let ownDate = profile?.birthday.date
        // The reader's own day is asked for on its own, so it is taken out of
        // the week. Otherwise the same person leads two carousels in a row.
        let week = UpcomingDates.next(6).filter { $0 != ownDate }

        async let nearby = repository.recommended(bornNear: profile?.birthday.year, limit: 200)
        async let upcoming = repository.celebrating(on: week, limit: 60)
        async let sharing = repository.celebrating(on: ownDate.map { [$0] } ?? [], limit: 30)

        do {
            let (found, thisWeek, twins) = try await (nearby, upcoming, sharing)
            strips = assemble(sharing: twins, thisWeek: thisWeek, nearby: found)
        } catch {
            failed = true
        }
    }

    /// The carousels, in order, with nobody appearing in two of them.
    ///
    /// Ordered by how much the row is about the reader. Sharing an exact
    /// birthday is the most personal thing this screen can say and it is the
    /// app's whole premise, so it leads. The week is next, because following
    /// somebody pays off on their birthday and here that is days away. The
    /// rest are people near the reader's age, split by kind.
    ///
    /// Split rather than mixed, which is the curation. One row of twenty
    /// mixed people is a pile and reads as an arbitrary list. Four rows of a
    /// few musicians, a few people from the internet, a few actors and a few
    /// athletes reads as somewhere to browse, and it means a reader who does
    /// not care about football can skip a row instead of scrolling past six
    /// footballers one at a time.
    ///
    /// A row of one or two is a row not worth its heading, so it is dropped.
    private func assemble(
        sharing: [NotableMatch],
        thisWeek: [NotableMatch],
        nearby: [NotableMatch]
    ) -> [Strip] {
        var spoken: Set<String> = []

        func take(_ from: [NotableMatch], _ limit: Int) -> [NotableMatch] {
            var picked: [NotableMatch] = []
            for match in from {
                guard !store.follows(match), !spoken.contains(match.person.id) else { continue }
                picked.append(match)
                spoken.insert(match.person.id)
                if picked.count == limit { break }
            }
            return picked
        }

        var built: [Strip] = [
            Strip(id: "shares", heading: "SHARES YOUR BIRTHDAY", people: take(sharing, 12)),
            Strip(id: "week", heading: "BIRTHDAYS THIS WEEK", people: take(thisWeek, 12)),
        ]

        // Dealt before splitting, so the same faces are not at the front of
        // every row on every opening. Everybody in the pool is above the view
        // threshold already, so there is nothing lost by shuffling it.
        let pool = nearby.shuffled()
        for kind in NotableMix.Kind.allCases {
            guard let heading = Self.heading(for: kind) else { continue }
            let ofThatKind = pool.filter { NotableMix.kind(of: $0.person.shortDescription) == kind }
            built.append(Strip(id: "kind-\(heading)", heading: heading, people: take(ofThatKind, 12)))
        }

        return built.filter { $0.people.count >= 3 }
    }

    /// Nil for the leftover bucket. "Everybody else" is what a row is called
    /// when nobody decided what it is for, and it is the one kind that cannot
    /// be given an honest heading.
    private static func heading(for kind: NotableMix.Kind) -> String? {
        switch kind {
        case .internetNative: return "ON THE INTERNET"
        case .music: return "MUSICIANS YOUR AGE"
        case .screen: return "ON SCREEN, YOUR AGE"
        case .sport: return "ATHLETES YOUR AGE"
        case .everybodyElse: return nil
        }
    }

    private func runSearch() async {
        let text = query.trimmingCharacters(in: .whitespaces)
        guard text.count >= 2 else { results = []; return }
        // Typing is faster than the network, so a pause is waited out rather
        // than sending a request per keystroke.
        try? await Task.sleep(for: .milliseconds(300))
        guard !Task.isCancelled else { return }

        searching = true
        defer { searching = false }
        failed = false
        do {
            results = try await repository.search(name: text, limit: 30)
        } catch {
            failed = true
            results = []
        }
    }
}

/// One public figure in a carousel.
///
/// The same gesture as `FollowRow` in a shape that scrolls sideways: a fixed
/// width, because cards of different widths in a horizontal row have no
/// rhythm and the eye cannot find the next one.
struct FollowCard: View {
    @Environment(PeopleStore.self) private var store
    let match: NotableMatch

    private var already: Bool { store.follows(match) }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(match.birthDate.displayName())
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.accent)

            Text(match.person.name)
                .font(.headline)
                .foregroundStyle(.primary)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)

            if let description = match.person.shortDescription, !description.isEmpty {
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }

            Spacer(minLength: 6)

            Button {
                store.add(match.asPerson())
            } label: {
                Label(already ? "Following" : "Follow",
                      systemImage: already ? "checkmark" : "plus")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(already ? Color.secondary : Theme.onAccent)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(already ? Color.clear : Theme.accent, in: Capsule())
            }
            .buttonStyle(.plain)
            .disabled(already)
            .accessibilityLabel(already ? "Already following \(match.person.name)"
                                        : "Follow \(match.person.name)")
        }
        .frame(width: 168, height: 150, alignment: .topLeading)
        .padding(14)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

/// One public figure, offered as a row. Used by the search results and by the
/// empty People tab, so following somebody is the same gesture wherever it is
/// met.
struct FollowRow: View {
    @Environment(PeopleStore.self) private var store
    let match: NotableMatch

    private var already: Bool { store.follows(match) }

    /// "June 26, 1993", or "September 5, 1946 to 1991" for somebody who has
    /// died, or just the day when the year is not known. Never a guess: a
    /// missing year is left missing rather than filled in from the
    /// description, which is prose and often says something else.
    private var whenBorn: String {
        let day = match.birthDate.displayName()
        guard let born = match.person.birthYear else { return day }
        guard let died = match.person.deathYear else { return "\(day), \(born)" }
        return "\(day), \(born) to \(died)"
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(match.person.name)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(whenBorn)
                    .font(.subheadline)
                    .foregroundStyle(Theme.accent)
                if let description = match.person.shortDescription, !description.isEmpty {
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            .multilineTextAlignment(.leading)

            Spacer(minLength: 0)

            Button {
                store.add(match.asPerson())
            } label: {
                Image(systemName: already ? "checkmark" : "plus")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(already ? Color.secondary : Theme.onAccent)
                    .frame(width: 34, height: 34)
                    .background(already ? Color.clear : Theme.accent, in: Circle())
            }
            .buttonStyle(.plain)
            .disabled(already)
            .accessibilityLabel(already ? "Already following \(match.person.name)"
                                        : "Follow \(match.person.name)")
        }
        .padding(.vertical, 4)
    }
}
