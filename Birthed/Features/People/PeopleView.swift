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
    @Environment(NotificationService.self) private var notifications
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.colorScheme) private var colorScheme
    let repository: DayPageRepository
    let onOpenSettings: () -> Void

    @State private var editing: Person?
    /// Whose day is open. A tap on a person opens their day now, not the
    /// editor; the editor is one tap further, on their day.
    @State private var opened: Person?
    /// Lines from the next person's day for their message, read when the
    /// panel shows them, so Say something on the panel opens with one.
    @State private var nextHooks: (id: Person.ID, hooks: [BirthdayHook])?
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
    /// Whether the reminder row has already had its answer. Written when the
    /// user leaves the screen, so a no is a no: the row asks once and then
    /// the switch in Settings is the only place it lives.
    @AppStorage("birthed.reminders.asked.v1") private var reminderRowAnswered = false
    /// Guards the two ways of leaving from both asking at once.
    @State private var answering = false

    /// Who is ticked while the list is selecting. Identifiers rather than
    /// people, because a row can be edited or have its countdown tick over
    /// while it is selected and the tick must not lose the selection.
    @State private var selected: Set<Person.ID> = []

    /// Owned here rather than read out of the environment.
    ///
    /// `EditButton` writes into whatever edit mode binding it finds, and
    /// reading that same value back in the view that installed the toolbar is
    /// the kind of thing that works until it does not. Holding the state and
    /// writing it from a plain button means the value the toolbar reads and
    /// the value the list obeys are the same one, and it is visible in this
    /// file.
    @State private var editMode: EditMode = .inactive

    private var isEditing: Bool { editMode == .active }

    /// Which group holds the first person on screen, so the reminder row can
    /// sit under them wherever they happen to be.
    private enum Slot { case today, friends, following }

    private let agenda = BirthdayAgenda()
    private var now: Date { Date() }

    private var ordered: [Person] { agenda.soonestFirst(store.people, on: now) }
    /// The page follows the appearance; the next person's panel does not.
    private var palette: StagePalette { .forScheme(colorScheme) }
    private var today: [Person] { agenda.celebratingToday(store.people, on: now) }
    /// The friend the panel is about: somebody whose birthday is today, or
    /// else the next one.
    private var nextFriend: Person? {
        today.first { !$0.isPublicFigure } ?? ordered.first { !$0.isPublicFigure }
    }

    var body: some View {
        NavigationStack {
            Group {
                if store.people.isEmpty { empty } else { list }
            }
            .background(palette.ground.ignoresSafeArea())
            .navigationTitle("People")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(item: $opened) { person in
                PersonDayView(personID: person.id, fallback: person, repository: repository)
            }
            .toolbar {
                // The title is the serif heading at the top of the list, so
                // the bar carries only its buttons. The title is still set,
                // for the back button on a person's day.
                ToolbarItem(placement: .principal) { Text("") }
                ToolbarItem(placement: .topBarLeading) {
                    Button(action: onOpenSettings) {
                        Label("Settings", systemImage: "gearshape")
                    }
                    .tint(.primary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    // One slot, two jobs. Adding somebody while ticking people
                    // to delete is not a thing anybody does, and two live
                    // buttons plus a Done is more than a top bar should carry.
                    if isEditing {
                        Button(role: .destructive) {
                            deleteSelected()
                        } label: {
                            Text(selected.isEmpty ? "Delete" : "Delete \(selected.count)")
                        }
                        .disabled(selected.isEmpty)
                        .tint(.red)
                    } else {
                        // A menu rather than two buttons. Most people arrive
                        // with a list somewhere and a few arrive with one
                        // name, and the list is the one that makes this tab
                        // work at all, so it is first.
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
                ToolbarItem(placement: .topBarTrailing) {
                    // "Select" rather than "Edit", because the only thing this
                    // mode does is tick people and remove them. Editing one
                    // person is still a tap on them. Hidden while the list is
                    // empty, since there is nothing to select.
                    if !store.people.isEmpty {
                        Button(isEditing ? "Done" : "Select") { toggleSelecting() }
                    }
                }
            }
            .task(id: nextFriend) { await loadNextHooks() }
            .task {
                // Before the row can be shown, because it only shows on
                // .notAsked and the service starts on .unknown.
                await notifications.refresh()
                await loadSuggestions()
            }
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
            // A friend gets the composer. Somebody you follow gets a card,
            // because a composer is a thing you send to somebody and a public
            // figure has no somebody. See FigureCard.
            .sheet(item: $saying) { person in
                if person.isPublicFigure {
                    ShareCardPicker(
                        choices: [FigureCard.shareChoice(
                            for: person,
                            reader: profileStore.profile?.birthday
                        )],
                        subject: person.trimmedName
                    )
                } else {
                    SaySomethingView(person: person,
                                     hooks: nextHooks?.id == person.id ? nextHooks?.hooks ?? [] : [])
                }
            }
            .sheet(item: $editing) { person in
                PersonEditor(person: person) { store.update($0); editing = nil } onCancel: { editing = nil }
                    .onDisappear { editing = nil }
            }
        }
        .tint(Theme.accent)
        // The two ways somebody leaves this screen. Whichever happens first
        // does the asking; the second finds the question already answered.
        .onDisappear { Task { await answerReminderRow() } }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { Task { await answerReminderRow() } }
        }
    }

    /// Only ever asked for when there is nobody in the list, because that is
    /// the only screen it is shown on and nobody should pay for a request they
    /// will not see the answer to.
    /// The song the week the next friend was born and one famous twin, the
    /// same two reads their day makes. A date is all that is asked about.
    private func loadNextHooks() async {
        guard let person = nextFriend else { nextHooks = nil; return }
        var title: String?
        var artist: String?
        if let year = person.birthday.year,
           let song = (try? await repository.numberOneSong(theWeekOf: person.birthday.date, birthYear: year)) ?? nil {
            title = song.song
            artist = song.artist
        }
        let twins = (try? await repository.notablePeople(bornOn: person.birthday.date, limit: 4)) ?? []
        let own = person.trimmedName.lowercased()
        nextHooks = (person.id, BirthdayHook.offered(
            songTitle: title, songArtist: artist,
            twins: twins.map(\.name).filter { $0.lowercased() != own }
        ))
    }

    private func loadSuggestions() async {
        guard store.people.isEmpty, suggestions.isEmpty else { return }
        let found = try? await repository.recommended(
            bornNear: profileStore.profile?.birthday.year, limit: 40)
        // Dealt before spreading, so an empty tab does not offer the same
        // three people every time it is opened.
        suggestions = NotableMix.spread((found ?? []).shuffled(), limit: 3)
    }

    // MARK: Empty

    /// The paste box, and then everything else.
    ///
    /// This screen decides whether the People tab is worth anything, and until
    /// now the strongest button on it was the slowest path: a filled "Add
    /// someone" that opened a form for typing one person at a time, with the
    /// paste box behind a smaller outline button above it. Two buttons doing
    /// one job, and the loud one pointed the wrong way.
    ///
    /// Nathan arrived at the fix by comparing Birthed to ReciMe, whose whole
    /// trick was that the content already existed somewhere else and getting
    /// it in felt like nothing. Every friend group's birthdays are already in
    /// a pinned message or a shared note. So the box is on this screen rather
    /// than behind a button to a sheet with three sections in it, and the
    /// paste control is the first thing under the sentence.
    ///
    /// Typing one in is still in the toolbar menu where it has always been.
    /// It is not repeated here, because a second button to make the first one
    /// work is two controls doing one control's job.
    ///
    /// Scrolls, because it is taller than a phone. The bounce is left off when
    /// the content happens to fit, so on a big screen it still behaves like
    /// the fixed panel it looks like.
    private var empty: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(spacing: 10) {
                    CandleMark(height: 96)
                        .frame(height: 96)

                    Text("Nobody yet")
                        .font(Theme.display(.title2, weight: .bold))

                    Text("Paste the list you already have. A group chat message, a note, anything with names and dates in it. Birthed reads it on your phone and counts down to each one.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 12)
                }
                .frame(maxWidth: .infinity)

                PasteImport(showsHeading: false) { people in
                    for person in people { store.add(person) }
                }

                // Quiet, and one link rather than two headed sections. The
                // sheet still holds asking for theirs and sending yours, and
                // this is the door to it, but neither of them is what somebody
                // does first and neither should be competing with the box.
                Button { addingMany = true } label: {
                    Text("Or ask somebody for theirs")
                        .font(.footnote.weight(.semibold))
                }
                .frame(maxWidth: .infinity)

                // Offered, not added. Putting somebody in a list nobody asked
                // for means notifications about people they never chose, and
                // this list is theirs. One tap is the same outcome and it is
                // their tap.
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
                    .padding(.top, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 14)
            .padding(.bottom, 40)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    // MARK: List

    /// Two groups, because they are two different things.
    ///
    /// Somebody you know and somebody you follow were in one flat list ordered
    /// by who is next, so Mum sat between two YouTubers. The countdown is the
    /// same question for both, but the answer means something different: one
    /// is a person who will notice whether you said anything, and the other is
    /// a date you thought was fun. `Person.isPublicFigure` already tells them
    /// apart, because `NotificationPlanner` has to know the difference to
    /// protect a friend's reminder from twenty follows against the 64 slot
    /// limit. This is the same line drawn on screen.
    ///
    /// Anybody celebrating today stays pinned above both, in a section with no
    /// heading, because the card already says TODAY in type the size of the
    /// heading and the day is the day whichever group they are in.
    ///
    /// Headings only appear when both groups have somebody in them. A heading
    /// over the only group there is names nothing, which is a label doing no
    /// work.
    /// The next person first, as a panel, then the next thirty days as a
    /// strip, then everybody else. While selecting there is no panel and no
    /// strip, because the only thing that mode does is tick rows, and the
    /// person in the panel has to be tickable too.
    private var list: some View {
        let celebrants = today
        let hero: Person? = isEditing ? nil
            : (celebrants.first { !$0.isPublicFigure } ?? ordered.first { !$0.isPublicFigure })
        let otherCelebrants = celebrants.filter { $0.id != hero?.id }
        let rest = ordered.filter { person in !celebrants.contains(person) && person.id != hero?.id }
        let friends = rest.filter { !$0.isPublicFigure }
        let followed = rest.filter { $0.isPublicFigure }
        let upcoming = isEditing ? [] : agenda.within(UpcomingStrip.window, of: store.people.filter { !$0.isPublicFigure }, on: now)
        let friendsHeading: String? = hero != nil ? "LATER" : (!followed.isEmpty ? "FRIENDS" : nil)
        let followedHeading: String? = (hero != nil || !friends.isEmpty) ? "PUBLIC FIGURES" : nil
        let reminderIn: Slot = !otherCelebrants.isEmpty ? .today : (friends.isEmpty ? .following : .friends)

        return List(selection: $selected) {
            Text("People")
                .font(.system(size: 34, weight: .heavy, design: .serif))
                .foregroundStyle(palette.type)
                .listRowInsets(EdgeInsets(top: 0, leading: 22, bottom: 8, trailing: 20))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .selectionDisabled()

            if let hero {
                NextUpCard(person: hero, now: now,
                           onOpen: { opened = hero },
                           onSay: { saying = hero })
                    .listRowInsets(rowInsets)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .selectionDisabled()
                    .contextMenu {
                        Button("Edit") { editing = hero }
                        Button("Remove", role: .destructive) { remove(hero) }
                    }

                if showsReminderRow {
                    reminderRow
                        .listRowInsets(rowInsets)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .selectionDisabled()
                }

                if !upcoming.isEmpty {
                    sectionLabel("NEXT \(UpcomingStrip.window) DAYS")
                    UpcomingStrip(people: upcoming, now: now) { opened = $0 }
                        .listRowInsets(rowInsets)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .selectionDisabled()
                }
            }

            peopleSection(nil, otherCelebrants, isToday: true, carriesReminder: hero == nil && reminderIn == .today)
            peopleSection(friendsHeading, friends, isToday: false, carriesReminder: hero == nil && reminderIn == .friends)
            peopleSection(followedHeading, followed, isToday: false, carriesReminder: hero == nil && reminderIn == .following)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(palette.ground)
        .contentMargins(.bottom, 72, for: .scrollContent)
        // Applied to the list rather than left to `EditButton`, so the value
        // the list obeys is the one this file holds.
        .environment(\.editMode, $editMode)
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.heavy))
            .kerning(2.6)
            .foregroundStyle(palette.type.opacity(0.55))
            .listRowInsets(EdgeInsets(top: 18, leading: 24, bottom: 4, trailing: 20))
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .selectionDisabled()
    }

    /// A section, with a heading or without one. Written as two branches
    /// rather than one section with a conditional heading, because a heading
    /// that resolves to nothing still leaves a gap where it would have been.
    @ViewBuilder
    private func peopleSection(_ heading: String?, _ people: [Person], isToday: Bool, carriesReminder: Bool) -> some View {
        if !people.isEmpty {
            if let heading {
                Section {
                    rows(people, isToday: isToday, carriesReminder: carriesReminder)
                } header: {
                    Text(heading)
                        .font(.caption.weight(.heavy))
                        .kerning(2.6)
                        .foregroundStyle(palette.type.opacity(0.55))
                        .textCase(nil)
                        .listRowInsets(EdgeInsets(top: 18, leading: 20, bottom: 6, trailing: 20))
                        .listRowBackground(Color.clear)
                }
            } else {
                Section {
                    rows(people, isToday: isToday, carriesReminder: carriesReminder)
                }
            }
        }
    }

    /// The first person, then the reminder row if this is where it goes, then
    /// everybody else. Split rather than interleaved inside one `ForEach`,
    /// because a row that is not a person has no identifier to select and must
    /// not pretend to have one.
    @ViewBuilder
    private func rows(_ people: [Person], isToday: Bool, carriesReminder: Bool) -> some View {
        if let first = people.first {
            personRow(first, isToday: isToday)

            if carriesReminder && showsReminderRow {
                reminderRow
                    .listRowInsets(rowInsets)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    // It is a question, not a person. Ticking it would put an
                    // empty identifier into the set that Delete reads.
                    .selectionDisabled()
            }

            ForEach(people.dropFirst()) { person in
                personRow(person, isToday: isToday)
            }
        }
    }

    /// One row, tagged with the person it is, dressed so the list still looks
    /// like the cards it looked like before it was a list.
    ///
    /// `allowsHitTesting` is the whole trick for selecting. The card is a
    /// button, and a button inside a list row swallows the tap that would have
    /// ticked it, so while the list is selecting the card stops taking hits
    /// and the row underneath gets them. Disabling the button instead would
    /// have dimmed it, which reads as a row you are not allowed to choose.
    private func personRow(_ person: Person, isToday: Bool) -> some View {
        Group {
            if isToday {
                celebrating(person)
            } else {
                row(person)
            }
        }
        .allowsHitTesting(!isEditing)
        .tag(person.id)
        .listRowInsets(rowInsets)
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) { remove(person) } label: {
                Label("Remove", systemImage: "trash")
            }
        }
    }

    /// Four above and four below makes the eight the cards had between them
    /// when this was a stack, and twenty at the sides matches every other
    /// screen.
    private var rowInsets: EdgeInsets {
        EdgeInsets(top: 4, leading: 20, bottom: 4, trailing: 20)
    }

    // MARK: Selecting, and removing several at once

    private func toggleSelecting() {
        withAnimation {
            if isEditing {
                editMode = .inactive
                selected = []
            } else {
                editMode = .active
            }
        }
    }

    /// Removes everybody ticked, in one go.
    ///
    /// The schedule is rebuilt here rather than left to the next foreground.
    /// It is rebuilt on every foreground anyway, per `FR-074`, but anyway is
    /// not soon enough: somebody who removes a person whose birthday is
    /// tomorrow and then puts the phone down still has that person's
    /// notification sitting in the queue, and it would arrive.
    private func deleteSelected() {
        let doomed = store.people.filter { selected.contains($0.id) }
        guard !doomed.isEmpty else { return }
        withAnimation {
            for person in doomed { store.remove(person) }
            selected = []
            if store.people.isEmpty { editMode = .inactive }
        }
        rescheduleReminders()
    }

    /// One person, from a swipe or from the menu on a card. Same rebuild, same
    /// reason.
    private func remove(_ person: Person) {
        withAnimation { store.remove(person) }
        if store.people.isEmpty { editMode = .inactive }
        rescheduleReminders()
    }

    private func rescheduleReminders() {
        guard let profile = profileStore.profile else { return }
        let people = store.people
        Task { await notifications.reschedule(birthday: profile.birthday, people: people) }
    }

    // MARK: The one permission

    /// `FR-070`. Under the first person on the list, which in the session this
    /// was written for is the person they have just added.
    ///
    /// Not above the list. A row above the list is a banner, and a banner
    /// asking for notifications is the one thing `docs/first-five-minutes.md`
    /// says the last two minutes must not contain. Under the person, it reads
    /// as what happens next about that person, which is what it is.
    private var showsReminderRow: Bool {
        !store.people.isEmpty && notifications.permission == .notAsked && !reminderRowAnswered
    }

    /// Switched on when it appears, and nothing is asked while they look at
    /// it.
    ///
    /// On, because they have just added somebody to a list whose only purpose
    /// is being told about them, and starting it off would be pretending not
    /// to know that. Nothing asked yet, because the system prompt on top of
    /// the screen they are still reading is the interruption this design is
    /// avoiding: it comes when they leave.
    private var reminderRow: some View {
        Toggle(isOn: Binding(
            get: { notifications.isEnabled },
            set: { notifications.isEnabled = $0 }
        )) {
            // The same two columns a person row has, so the list keeps one
            // left rail. Without this the text started where a person's
            // countdown starts and every name on the screen looked indented
            // from it by accident.
            HStack(alignment: .center, spacing: 14) {
                Image(systemName: "bell.badge")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Theme.accent)
                    // The width a countdown badge takes, so the bell sits in
                    // the column the numbers are in.
                    .frame(width: 52)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Remind me the morning of and three days before")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("For everybody on this list. Nothing else.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .tint(Theme.accent)
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        // Not `Theme.card`. On the same white card as the people around it,
        // with nothing in the countdown column, this read as a fourth person
        // wedged into the list rather than as a question about the list. A
        // wash of the accent and a hairline of it say "this is a control" in
        // a way that does not need a heading, and it stays under the first
        // person, which is the part that was decided and is not the problem.
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Theme.accent.opacity(0.10))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Theme.accent.opacity(0.28), lineWidth: 1)
                )
        )
    }

    /// The system prompt, on the way out.
    ///
    /// It asks once. A person who turned the row off has answered the question
    /// already, and putting the iOS prompt in front of them anyway would be
    /// asking something we have been told.
    private func answerReminderRow() async {
        guard showsReminderRow, !answering else { return }
        answering = true
        defer { answering = false }

        guard notifications.isEnabled else {
            reminderRowAnswered = true
            return
        }

        let granted = await notifications.askPermission()
        reminderRowAnswered = true
        guard granted, let profile = profileStore.profile else { return }
        await notifications.reschedule(birthday: profile.birthday, people: store.people)
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
            // Through the view rather than straight at the store, so the
            // notification schedule is rebuilt with them gone.
            Button("Remove", role: .destructive) { remove(person) }
        }
    }

    private func row(_ person: Person) -> some View {
        Button {
            opened = person
        } label: {
            HStack(alignment: .center, spacing: 14) {
                countdownBadge(person)

                VStack(alignment: .leading, spacing: 2) {
                    Text(person.trimmedName)
                        .font(.system(size: 16.5, weight: .bold))
                        .foregroundStyle(palette.type)
                        .lineLimit(1)
                    Text(subtitle(for: person, isToday: false))
                        .font(.footnote)
                        .foregroundStyle(palette.type.opacity(0.6))
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(palette.type.opacity(0.06), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(palette.type.opacity(0.08), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button("Edit") { editing = person }
            // Through the view rather than straight at the store, so the
            // notification schedule is rebuilt with them gone.
            Button("Remove", role: .destructive) { remove(person) }
        }
    }

    private func countdownBadge(_ person: Person) -> some View {
        let days = agenda.calendar.daysUntil(person.birthday, from: now)
        return VStack(spacing: 0) {
            Text(String(days))
                .font(.system(size: 24, weight: .black, design: .serif))
                .foregroundStyle(palette.accent)
                .monospacedDigit()
            Text(days == 1 ? "day" : "days")
                .font(.caption2)
                .foregroundStyle(palette.type.opacity(0.55))
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
        // "a Thursday": which day of the week it lands on this year, the one
        // thing a person planning around a birthday asks next.
        if !isToday, let weekday = PersonDay.weekdayName(PersonDay(calendar: agenda.calendar).nextWeekday(of: person.birthday, from: now)) {
            parts.append("a \(weekday)")
        }
        if let note = person.note?.trimmingCharacters(in: .whitespaces), !note.isEmpty {
            parts.append(note)
        }
        return parts.joined(separator: " · ")
    }
}
