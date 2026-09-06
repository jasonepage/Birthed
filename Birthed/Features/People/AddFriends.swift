import SwiftUI

/// Getting other people's birthdays in, without typing them one at a time.
///
/// The People tab is the only thing in this product that gives somebody a
/// reason to open it in a month that is not their own, and it only works when
/// it has people in it. One name at a time is where that dies, so there are
/// two ways in and neither of them asks for a permission or sends anything to
/// a server.
///
/// Paste is for the list that already exists. Every friend group has one
/// somewhere, in a pinned message or a shared note, and it is never in a tidy
/// format. `BirthdayText` reads it and this screen shows what it read next to
/// the line it read it from, because a reader can only check what they can see.
///
/// The link is for the birthdays that do not exist anywhere yet. It carries a
/// date in the part of an address that browsers never send, so nothing about
/// anybody reaches birthed.app, and it carries no name at all, because this
/// app does not ask people their names and whoever adds you was going to
/// label you their own way regardless.
struct AddFriendsView: View {
    @Environment(ProfileStore.self) private var profileStore
    @Environment(\.dismiss) private var dismiss

    let onAdd: ([Person]) -> Void

    @State private var pasted = ""
    @State private var skipped: Set<Int> = []

    private var candidates: [BirthdayText.Candidate] {
        BirthdayText.candidates(in: pasted)
    }

    private var chosen: [BirthdayText.Candidate] {
        candidates.filter { !skipped.contains($0.id) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    paste
                    if !candidates.isEmpty { found }
                    myLink
                }
                .padding(20)
            }
            .background(Theme.canvas)
            .navigationTitle("Add friends")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                if !chosen.isEmpty {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Add \(chosen.count)") {
                            onAdd(chosen.map { Person(name: $0.name, birthday: $0.birthday) })
                            dismiss()
                        }
                        .fontWeight(.semibold)
                    }
                }
            }
        }
        .tint(Theme.accent)
    }

    // MARK: Paste

    private var paste: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("PASTE A LIST")
                .font(.caption.weight(.heavy))
                .kerning(2.5)
                .foregroundStyle(Theme.accent)

            Text("A group chat message, a shared note, anything with names and dates in it. It is read on your phone and nothing is sent anywhere.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            TextEditor(text: $pasted)
                .font(.body)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 140)
                .padding(10)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(alignment: .topLeading) {
                    if pasted.isEmpty {
                        Text("Sam 3/14\nPriya - March 14\nAlex: 14 March 2003")
                            .font(.body)
                            .foregroundStyle(.tertiary)
                            .padding(.horizontal, 15)
                            .padding(.vertical, 18)
                            .allowsHitTesting(false)
                    }
                }
        }
    }

    /// What was read, next to what it was read from. The row is the control:
    /// tap one to leave it out, tap it again to put it back.
    private var found: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("\(candidates.count) FOUND")
                .font(.caption.weight(.heavy))
                .kerning(2.5)
                .foregroundStyle(Theme.accent)

            ForEach(candidates) { candidate in
                let keeping = !skipped.contains(candidate.id)
                Button {
                    if keeping { skipped.insert(candidate.id) } else { skipped.remove(candidate.id) }
                } label: {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: keeping ? "checkmark.circle.fill" : "circle")
                            .font(.title3)
                            .foregroundStyle(keeping ? Theme.accent : Color.secondary)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(candidate.name)
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text(readingOf(candidate))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            // What the line said, so a wrong reading is
                            // visible rather than silently added.
                            Text(candidate.line)
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .opacity(keeping ? 1 : 0.5)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func readingOf(_ candidate: BirthdayText.Candidate) -> String {
        let date = candidate.birthday.date.displayName()
        guard let year = candidate.birthday.year else { return date }
        return "\(date), \(String(year))"
    }

    // MARK: The link

    @ViewBuilder
    private var myLink: some View {
        if let profile = profileStore.profile,
           let url = PersonLink.url(forMyBirthday: profile.birthday) {
            VStack(alignment: .leading, spacing: 10) {
                Text("OR SEND YOURS")
                    .font(.caption.weight(.heavy))
                    .kerning(2.5)
                    .foregroundStyle(Theme.accent)

                Text("Drop this in the group chat. Anyone who taps it can add your birthday, and add theirs back the same way. It carries the date and nothing else, not even your name.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                ShareLink(item: url) {
                    Label("Share my birthday link", systemImage: "square.and.arrow.up")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 18)
                        .padding(.vertical, 12)
                        .background(Theme.accent, in: Capsule())
                        .foregroundStyle(Theme.cream)
                }
            }
        }
    }
}

/// A link that arrived, wrapped so a sheet can be presented from it.
struct ArrivingBirthday: Identifiable {
    let id = UUID()
    let incoming: PersonLink.Incoming
}

/// Somebody's birthday came in from a link. Confirm who they are and keep it.
///
/// The name field is empty when the link carried no name, which is the normal
/// case for somebody sharing their own, and that is the right way round: you
/// file people under what you call them.
struct IncomingBirthdaySheet: View {
    let incoming: PersonLink.Incoming
    let onAdd: (Person) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @FocusState private var naming: Bool

    private var trimmed: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                CandleMark(height: 120)
                    .frame(height: 120)

                Text(incoming.birthday.date.displayName())
                    .font(.system(size: 40, weight: .black, design: .serif))
                    .lineLimit(2)
                    .minimumScaleFactor(0.6)
                    .multilineTextAlignment(.center)

                Text("Somebody shared this birthday with you. What do you call them?")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 30)

                TextField("Their name", text: $name)
                    .textFieldStyle(.plain)
                    .font(.title3)
                    .multilineTextAlignment(.center)
                    .focused($naming)
                    .padding(14)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .padding(.horizontal, 20)

                Spacer(minLength: 0)
            }
            .padding(.top, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.canvas)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Not now") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        onAdd(Person(name: trimmed, birthday: incoming.birthday))
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .disabled(trimmed.isEmpty)
                }
            }
            .onAppear {
                name = incoming.name ?? ""
                naming = incoming.name == nil
            }
        }
        .tint(Theme.accent)
        .presentationDetents([.medium])
    }
}
