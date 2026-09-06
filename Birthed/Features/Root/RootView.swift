import SwiftUI

/// Onboarding, or the tabs.
///
/// Three destinations, but not the three `FR-015` named. Me was a settings
/// form, and settings is a thing you do once and leave rather than a place you
/// go, so it is a cog. People took its slot, because it is the only screen in
/// the product that gives somebody a reason to open the app in a month that is
/// not their own. Recorded in `CLAUDE.md` section 5.
///
/// `FR-033` still holds: inside the birthday window the app opens on the
/// user's own day rather than on today's page.
struct RootView: View {
    @Environment(ProfileStore.self) private var profileStore
    @Environment(AccountService.self) private var account
    @Environment(PeopleStore.self) private var peopleStore
    @Environment(NotificationService.self) private var notifications
    @Environment(FactsService.self) private var facts
    @Environment(BirthdayInbox.self) private var inbox
    @Environment(\.scenePhase) private var scenePhase

    let repository: DayPageRepository

    @State private var tab: Tab = .today
    @State private var showingSettings = false
    @State private var replayingReveal = false
    /// Set by Settings, acted on once the sheet has gone. Presenting a full
    /// screen cover while a sheet is still dismissing is dropped on the floor
    /// by the system, so the two are sequenced through onDismiss.
    @State private var replayRequested = false
    /// A birthday that arrived from a link, waiting to be confirmed.
    @State private var arriving: ArrivingBirthday?
    /// Somebody whose birthday is today, with the composer open for them.
    @State private var saying: Person?

    enum Tab: Hashable { case today, mine, people }

    var body: some View {
        Group {
            if let profile = profileStore.profile {
                tabs(for: profile)
            } else {
                OnboardingView(repository: repository) { profile in
                    profileStore.save(profile)
                    Task {
                        await account.ensureAccount()
                        await account.pushProfile(profile)
                    }
                    tab = openingTab(for: profile)
                }
            }
        }
        // On the outer Group rather than inside the tabs, so a link tapped
        // before onboarding is finished is still caught rather than dropped.
        .onOpenURL { url in
            guard let incoming = PersonLink.incoming(from: url) else { return }
            arriving = ArrivingBirthday(incoming: incoming)
        }
        .sheet(item: $arriving, onDismiss: {
            // Whatever they chose, the copy on the server is dealt with, and
            // the next one in the queue is offered.
            offerNext()
        }) { arrival in
            IncomingBirthdaySheet(
                incoming: arrival.incoming,
                note: arrival.replyID == nil ? nil
                    : "\(arrival.incoming.name ?? "Somebody") sent you their birthday. What do you call them?"
            ) { person in
                peopleStore.add(person)
                // Kept, so the copy waiting on the server has done its job and
                // stops existing. Declining leaves it there for next time.
                if let replyID = arrival.replyID { inbox.clear(id: replyID) }
                tab = .people
                Task { await refreshReminders() }
            }
        }
        .sheet(item: $saying) { person in
            SaySomethingView(person: person)
        }
        .onChange(of: notifications.opened) { _, opened in
            act(on: opened)
        }
        .sheet(isPresented: $showingSettings, onDismiss: {
            if replayRequested {
                replayRequested = false
                replayingReveal = true
            }
        }) {
            SettingsView(onReplayReveal: { replayRequested = true })
        }
        .fullScreenCover(isPresented: $replayingReveal) {
            OnboardingView(repository: repository, starting: profileStore.profile) { profile in
                profileStore.save(profile)
                Task { await account.pushProfile(profile) }
                replayingReveal = false
            }
        }
        .task {
            // FR-010. Silent, on first launch, with no screen and no action.
            await account.ensureAccount()
            if let profile = profileStore.profile {
                tab = openingTab(for: profile)
                await account.pushProfile(profile)
            }
            await refreshReminders()
            await collectArrivals()
            // A tap that started the app cold can land before this view was
            // watching for changes, so whatever is waiting is acted on here.
            act(on: notifications.opened)
        }
        .onChange(of: scenePhase) { _, phase in
            // Counting what was on screen is held until a screen goes away,
            // and the app being backgrounded is the other way that happens.
            if phase != .active {
                Task { await facts.flushSeen() }
                return
            }
            // FR-011. Retry on every foreground until it takes.
            Task {
                await account.ensureAccount()
                // FR-074. Rebuilding the whole schedule on every foreground is
                // cheaper than watching for a time zone change and cannot
                // miss one.
                await refreshReminders()
                // The whole of the delivery mechanism. No push, no background
                // fetch, nothing running while the app is closed: a birthday
                // is at worst a year away, so the next time somebody opens
                // Birthed is soon enough, and it keeps the claim that this app
                // has no server that can reach anybody's phone.
                await collectArrivals()
            }
        }
    }

    private func tabs(for profile: Profile) -> some View {
        TabView(selection: $tab) {
            DayPageView(
                date: CalendarDate.today(),
                repository: repository,
                onOpenSettings: { showingSettings = true }
            )
            .tabItem { Label("Today", systemImage: "calendar") }
            .tag(Tab.today)

            MyDayView(
                profile: profile,
                repository: repository,
                onOpenSettings: { showingSettings = true }
            )
            .tabItem { Label("Mine", systemImage: "flame") }
            .tag(Tab.mine)

            PeopleView(repository: repository, onOpenSettings: { showingSettings = true })
                .tabItem { Label("People", systemImage: "person.2") }
                .tag(Tab.people)
        }
        .tint(Theme.accent)
    }

    /// Reads the inbox and, if the reader is not already being asked about
    /// something, offers the first thing in it.
    private func collectArrivals() async {
        await inbox.collect()
        offerNext()
    }

    /// One at a time. Five birthdays arriving at once is five sheets in a row
    /// if they are presented together, so the queue is walked as each one is
    /// dealt with.
    private func offerNext() {
        guard arriving == nil, let next = inbox.next else { return }
        // Set aside at the moment it is offered, not when it is answered. A
        // dismissed sheet says nothing about why it was dismissed, so waiting
        // for an answer would mean re-presenting the same birthday the instant
        // the sheet closed.
        inbox.putAside(id: next.id)
        arriving = ArrivingBirthday(incoming: next.incoming, replyID: next.id)
    }

    /// What a tapped notification opens. The birthday itself opens the
    /// composer, because the notification said "say something" and this is
    /// where that is done. The three day warning opens the People tab, since
    /// a message three days early is not what anybody meant. The user's own
    /// notifications open Mine.
    private func act(on opened: PlannedNotification.Opened?) {
        guard let opened else { return }
        notifications.opened = nil
        switch opened {
        case .ownBirthday, .ownCountdown:
            tab = .mine
        case let .personBirthday(personID):
            tab = .people
            if let person = peopleStore.people.first(where: { $0.id == personID }), person.isUsable {
                saying = person
            }
        case .personSoon:
            tab = .people
        }
    }

    private func refreshReminders() async {
        guard let profile = profileStore.profile else { return }
        await notifications.reschedule(birthday: profile.birthday, people: peopleStore.people)
    }

    private func openingTab(for profile: Profile) -> Tab {
        BirthdayCalendar().isInWindow(profile.birthday, on: Date()) ? .mine : .today
    }
}
