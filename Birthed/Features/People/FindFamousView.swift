import SwiftUI

/// Finding somebody public to follow, out of Birthed's own list.
///
/// With nothing typed this is a suggestion list, and the suggestions are a
/// database query rather than a model: people born near the reader who carry a
/// social identifier in Wikidata, ordered by how many people actually look
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
    @State private var suggestions: [NotableMatch] = []
    @State private var searching = false
    @State private var failed = false

    private var showing: [NotableMatch] {
        query.trimmingCharacters(in: .whitespaces).isEmpty ? suggestions : results
    }

    var body: some View {
        NavigationStack {
            List {
                if showing.isEmpty && !searching {
                    Section { emptyLine }
                } else {
                    Section {
                        ForEach(showing) { match in
                            row(match)
                        }
                    } header: {
                        Text(query.trimmingCharacters(in: .whitespaces).isEmpty
                             ? "People around your age" : "Results")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Follow someone")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Search by name")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .overlay {
                if searching && showing.isEmpty { ProgressView() }
            }
            .task { await loadSuggestions() }
            .task(id: query) { await runSearch() }
        }
        .tint(Theme.accent)
    }

    @ViewBuilder
    private var emptyLine: some View {
        if failed {
            Text("Could not reach the list just now.")
                .foregroundStyle(.secondary)
        } else if !query.trimmingCharacters(in: .whitespaces).isEmpty {
            Text("Nobody by that name.")
                .foregroundStyle(.secondary)
        } else {
            Text("Nobody to suggest yet.")
                .foregroundStyle(.secondary)
        }
    }

    private func row(_ match: NotableMatch) -> some View {
        FollowRow(match: match)
    }

    /// A different twenty every time the sheet opens.
    ///
    /// The pool is the eighty most looked up people near the reader's age.
    /// Everybody in it is popular enough to be offered, so the pool is dealt
    /// before it is spread across kinds: the same six names at the top of
    /// every open would make the list read as the whole list. People already
    /// followed are left out, since a row that only says "done" is a row
    /// somebody has to scroll past.
    private func loadSuggestions() async {
        guard suggestions.isEmpty else { return }
        searching = true
        defer { searching = false }
        do {
            let found = try await repository.recommended(
                bornNear: profileStore.profile?.birthday.year, limit: 80)
            let fresh = found.filter { !store.follows($0) }
            suggestions = NotableMix.spread(fresh.shuffled(), limit: 20)
        } catch {
            failed = true
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

/// One public figure, offered. Shared by the search screen and by the empty
/// People tab, so following somebody is the same gesture wherever it is met.
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
                    .foregroundStyle(already ? Color.secondary : Theme.cream)
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
