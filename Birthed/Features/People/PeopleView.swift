import SwiftUI

/// The people whose birthdays you keep forgetting.
///
/// The only screen in the app that gives somebody a reason to open it in a
/// month that is not their own. Sorted by who is next, never alphabetically:
/// the question this screen answers is "who is coming up", and an alphabetical
/// list answers a question nobody asked.
struct PeopleView: View {
    @Environment(PeopleStore.self) private var store
    let onOpenSettings: () -> Void

    @State private var editing: Person?
    @State private var adding = false
    @State private var addingMany = false

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
                        Button { adding = true } label: {
                            Label("Type one in", systemImage: "square.and.pencil")
                        }
                    } label: {
                        Label("Add someone", systemImage: "plus")
                    }
                }
            }
            .sheet(isPresented: $addingMany) {
                AddFriendsView { people in
                    for person in people { store.add(person) }
                }
            }
            .sheet(isPresented: $adding) {
                PersonEditor(person: nil) { store.add($0); adding = false } onCancel: { adding = false }
            }
            .sheet(item: $editing) { person in
                PersonEditor(person: person) { store.update($0); editing = nil } onCancel: { editing = nil }
                    .onDisappear { editing = nil }
            }
        }
        .tint(Theme.accent)
    }

    // MARK: Empty

    private var empty: some View {
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
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
            editing = person
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text("TODAY")
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
            .foregroundStyle(Theme.cream)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(Theme.celebration, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
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

    private func subtitle(for person: Person, isToday: Bool) -> String {
        var parts: [String] = [person.birthday.date.displayName()]
        if let age = agenda.calendar.ageOnNextBirthday(person.birthday, from: now) {
            parts.append(isToday ? "turning \(age)" : "turns \(age)")
        }
        if let note = person.note?.trimmingCharacters(in: .whitespaces), !note.isEmpty {
            parts.append(note)
        }
        return parts.joined(separator: " · ")
    }
}
