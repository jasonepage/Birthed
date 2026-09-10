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
    /// The date the Today tab is showing. Today, until a link says otherwise.
    ///
    /// Birthed writes addresses like birthed.app/september-4/ whenever a date
    /// is shared, and the website has all 366 of them indexed. Before this,
    /// tapping one opened a web page next to an installed app that had that
    /// date already built. Build order item 4.
    @State private var showingDate: CalendarDate = .today()
    /// A date carried in a link, waiting for onboarding to ask about it.
    /// Only ever set when there is no profile yet.
    @State private var arrivingDate: CalendarDate?
    /// Set when a link picked the tab, so the rule below does not overrule it.
    ///
    /// `FR-033` opens the app on the reader's own day inside their birthday
    /// window, which is right when nobody asked for anything else. Somebody
    /// who just tapped a link at a named date did ask.
    @State private var tabChosenByLink = false

    enum Tab: Hashable { case today, mine, people }

    var body: some View {
        Group {
            if let profile = profileStore.profile {
                tabs(for: profile)
            } else {
                OnboardingView(repository: repository, arriving: arrivingDate) { profile in
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
            // A birthday to keep and a date to look at are two different
            // links. The birthday is read first because /add carries a date
            // as well and only the person on it is the point.
            if let incoming = PersonLink.incoming(from: url) {
                arriving = ArrivingBirthday(incoming: incoming)
                return
            }
            guard let date = PersonLink.date(from: url) else { return }
            if profileStore.profile == nil {
                // Nobody has said when their day is yet, so the date becomes
                // onboarding's opening answer rather than a page to read.
                arrivingDate = date
            } else {
                showingDate = date
                tab = .today
                tabChosenByLink = true
            }
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
        // A friend gets the composer. Somebody you follow gets a card. They
        // no longer arrive here from a notification, because they no longer
        // get one, but their row on the People tab still opens this.
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
                SaySomethingView(person: person)
            }
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
                // A cold launch from a link can run this after the link has
                // already chosen, and the birthday window rule must not undo
                // the tap that started the app.
                if !tabChosenByLink { tab = openingTab(for: profile) }
                await account.pushProfile(profile)
            }
            await refreshReminders()
            await pushCounts()
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
                // After the rebuild, never before it: rebuilding the schedule
                // is what notices that a reminder's moment has passed.
                await pushCounts()
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
                date: showingDate,
                repository: repository,
                onOpenSettings: { showingSettings = true }
            )
            // The date is read once, in the view's own init, so a new date
            // has to be a new view. Without this the tab would keep showing
            // the date it was first built with and the link would look like
            // it had done nothing.
            .id(showingDate)
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
        case .hiveSealed:
            // The Today tab, which is where the hive is. The date itself is
            // in the identifier and is deliberately not acted on: the tab
            // shows today's date and a sealed hive is two days behind it, so
            // opening the tab on a date the reader cannot buzz on would leave
            // them somewhere they did not ask to be with no way back but the
            // one they came in by. Taking them to a sealed hive is worth
            // doing and is not a line of routing: it needs a screen that can
            // show a date that is over, and that is the archive, which is not
            // built. docs/the-wall.md section 13 lists it as still ahead.
            tab = .today
        }
    }

    /// The four numbers from `docs/first-five-minutes.md`, sent on the profile
    /// row the app already writes.
    ///
    /// Always after `refreshReminders`, because rebuilding the schedule is
    /// what notices a reminder's moment has passed, and a push before it would
    /// report yesterday's total.
    ///
    /// There is no analytics kit here and there is not going to be one. `Tally`
    /// says what is counted and, at more length, what is deliberately not.
    private func pushCounts() async {
        guard let profile = profileStore.profile else { return }
        await account.pushProfile(profile, counts: ProfileCounts.current(
            peopleAdded: peopleStore.people.count,
            permissionGranted: notifications.permission == .granted
        ))
    }

    private func refreshReminders() async {
        guard let profile = profileStore.profile else { return }
        await notifications.reschedule(birthday: profile.birthday, people: peopleStore.people)
    }

    private func openingTab(for profile: Profile) -> Tab {
        BirthdayCalendar().isInWindow(profile.birthday, on: Date()) ? .mine : .today
    }
}
