import SwiftUI

/// The people whose birthdays you keep forgetting.
///
/// The only screen in the app that gives somebody a reason to open it in a
/// month that is not their own. Sorted by who is next, never alphabetically:
/// the question this screen answers is "who is coming up", and an alphabetical
/// list answers a question nobody asked.
struct PeopleView: View {
    @Environment(PeopleStore.self) private var store
    @Environment(ProfileStore.self) private var profileStore
    let repository: DayPageRepository
    let onOpenSettings: () -> Void

    @State private var editing: Person?
    @State private var adding = false
    @State private var addingMany = false
    @State private var following = false
    /// Whose birthday is being written about. The celebrating card opens
    /// this rather than the editor, because on the day the thing to do about
    /// a person is say something, not correct their spelling.
    @State private var saying: Person?
    /// A couple of public figures to offer when the list is empty, so the
    /// screen that decides whether this tab is worth anything has something on
    /// it besides an instruction.
    @State private var suggestions: [NotableMatch] = []

    private let agenda = BirthdayAgenda()
    private var now: Date { Date() }

    private var ordered: [Person] { agenda.soonestFirst(store.people, on: now) }
    private var today: [Person] { agenda.celebratingToday(store.people, on: now) }

    var body: some View {
        NavigationStack {
            Group {
                if store.people.isEmpty { empty } else { list }
            }
            .background(Theme.canvas)
            .navigationTitle("People")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(action: onOpenSettings) {
                        Label("Settings", systemImage: "gearshape")
                    }
                    .tint(.primary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    // A menu rather than two buttons. Most people arrive with
                    // a list somewhere and a few arrive with one name, and the
                    // list is the one that makes this tab work at all, so it
                    // is first.
                    Menu {
                        Button { addingMany = true } label: {
                            Label("Paste a list or send a link", systemImage: "square.and.arrow.down.on.square")
                        }
                        Button { following = true } label: {
                            Label("Follow someone famous", systemImage: "star")
                        }
                        Button { adding = true } label: {
                            Label("Type one in", systemImage: "square.and.pencil")
                        }
                    } label: {
                        Label("Add someone", systemImage: "plus")
                    }
                }
            }
            .task { await loadSuggestions() }
            .sheet(isPresented: $following) {
                FindFamousView(repository: repository)
            }
            .sheet(isPresented: $addingMany) {
                AddFriendsView { people in
                    for person in people { store.add(person) }
                }
            }
            .sheet(isPresented: $adding) {
                PersonEditor(person: nil) { store.add($0); adding = false } onCancel: { adding = false }
            }
            .sheet(item: $saying) { person in
                SaySomethingView(person: person)
            }
            .sheet(item: $editing) { person in
                PersonEditor(person: person) { store.update($0); editing = nil } onCancel: { editing = nil }
                    .onDisappear { editing = nil }
            }
        }
        .tint(Theme.accent)
    }

    /// Only ever asked for when there is nobody in the list, because that is
    /// the only screen it is shown on and nobody should pay for a request they
    /// will not see the answer to.
    private func loadSuggestions() async {
        guard store.people.isEmpty, suggestions.isEmpty else { return }
        let found = try? await repository.recommended(
            bornNear: profileStore.profile?.birthday.year, limit: 40)
        suggestions = NotableMix.spread(found ?? [], limit: 3)
    }

    // MARK: Empty

    /// Scrolls, because it is taller than a phone.
    ///
    /// It was written as a centred column back when it held a candle and a
    /// sentence. Three people to follow later it runs off the bottom of a
    /// 6.1 inch screen, and the button underneath them was unreachable. The
    /// bounce is left off when the content happens to fit, so on a big screen
    /// it still behaves like the fixed panel it looks like.
    private var empty: some View {
        ScrollView {
            VStack(spacing: 14) {
                CandleMark(height: 140)
                    .frame(height: 140)
                    .padding(.bottom, 6)

                Text("Nobody yet")
                    .font(Theme.display(.title2, weight: .bold))

                Text("Add the people whose birthdays you keep forgetting. Birthed will count down to each one.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)

                Button { addingMany = true } label: {
                    Text("Paste a list or send a link")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(Theme.accent, in: Capsule())
                        .foregroundStyle(Theme.cream)
                }
                .padding(.top, 4)

                // Offered, not added. Putting somebody in a list nobody asked for
                // means notifications about people they never chose, and this list
                // is theirs. One tap is the same outcome and it is their tap.
                if !suggestions.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("OR FOLLOW SOMEBODY")
                            .font(.caption.weight(.heavy))
                            .kerning(2.5)
                            .foregroundStyle(Theme.accent)
                            .padding(.bottom, 2)

                        ForEach(suggestions) { match in
                            FollowRow(match: match)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 4)
                                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }

                        Button { following = true } label: {
                            Text("Find someone else")
                                .font(.footnote.weight(.semibold))
                        }
                        .padding(.top, 2)
                    }
                    .padding(.top, 26)
                    .padding(.horizontal, 20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    adding = true
                } label: {
                    Text("Add someone")
                        .font(.headline)
                        .padding(.horizontal, 26)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.accent)
                .padding(.top, 6)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 18)
            .padding(.bottom, 40)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    // MARK: List

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                if !today.isEmpty {
                    ForEach(today) { person in
                        celebrating(person)
                    }
                    .padding(.bottom, 6)
                }

                ForEach(ordered.filter { person in !today.contains(person) }) { person in
                    row(person)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
    }

    private func celebrating(_ person: Person) -> some View {
        Button {
            saying = person
        } label: {
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    // The same card, one word apart. A celebration block that says
                    // TODAY over the name of somebody who has died is the loudest
                    // possible version of the mistake.
                    Text(person.isRemembered ? "REMEMBERING" : "TODAY")
                        .font(.caption2.weight(.heavy))
                        .kerning(2)
                        .opacity(0.85)
                    Text(person.trimmedName)
                        .font(Theme.display(.title, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text(subtitle(for: person, isToday: true))
                        .font(.subheadline)
                        .opacity(0.9)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Where the tap goes. A message for somebody you know, a line
                // to share about somebody you follow.
                Image(systemName: person.isPublicFigure ? "square.and.arrow.up" : "paperplane.fill")
                    .font(.title3)
                    .opacity(0.9)
            }
            .foregroundStyle(Theme.cream)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(Theme.celebration, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button("Edit") { editing = person }
            Button("Remove", role: .destructive) { store.remove(person) }
        }
    }

    private func row(_ person: Person) -> some View {
        Button {
            editing = person
        } label: {
            HStack(alignment: .center, spacing: 14) {
                countdownBadge(person)

                VStack(alignment: .leading, spacing: 2) {
                    Text(person.trimmedName)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text(subtitle(for: person, isToday: false))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button("Edit") { editing = person }
            Button("Remove", role: .destructive) { store.remove(person) }
        }
    }

    private func countdownBadge(_ person: Person) -> some View {
        let days = agenda.calendar.daysUntil(person.birthday, from: now)
        return VStack(spacing: 0) {
            Text(String(days))
                .font(.system(.title3, design: .serif, weight: .heavy))
                .foregroundStyle(Theme.accent)
                .monospacedDigit()
            Text(days == 1 ? "day" : "days")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(width: 52)
    }

    /// The date, the age, and whatever you wrote about them.
    ///
    /// The age is the part that has to be careful. Somebody followed who has
    /// died still gets a countdown, because people mark those days on purpose
    /// and chose to follow them knowing. What they must never get is "turns
    /// 28", which is not a small mistake in tone, it is the app not knowing
    /// something everybody else in the room knows.
    private func subtitle(for person: Person, isToday: Bool) -> String {
        var parts: [String] = [person.birthday.date.displayName()]
        if let age = agenda.calendar.ageOnNextBirthday(person.birthday, from: now) {
            if person.isRemembered {
                parts.append("would have been \(age)")
            } else {
                parts.append(isToday ? "turning \(age)" : "turns \(age)")
            }
        }
        if let note = person.note?.trimmingCharacters(in: .whitespaces), !note.isEmpty {
            parts.append(note)
        }
        return parts.joined(separator: " · ")
    }
}
