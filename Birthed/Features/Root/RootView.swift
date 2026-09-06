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
    @Environment(\.scenePhase) private var scenePhase

    let repository: DayPageRepository

    @State private var tab: Tab = .today
    @State private var showingSettings = false
    @State private var replayingReveal = false
    /// Set by Settings, acted on once the sheet has gone. Presenting a full
    /// screen cover while a sheet is still dismissing is dropped on the floor
    /// by the system, so the two are sequenced through onDismiss.
    @State private var replayRequested = false

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

            PeopleView(onOpenSettings: { showingSettings = true })
                .tabItem { Label("People", systemImage: "person.2") }
                .tag(Tab.people)
        }
        .tint(Theme.accent)
    }

    private func refreshReminders() async {
        guard let profile = profileStore.profile else { return }
        await notifications.reschedule(birthday: profile.birthday, people: peopleStore.people)
    }

    private func openingTab(for profile: Profile) -> Tab {
        BirthdayCalendar().isInWindow(profile.birthday, on: Date()) ? .mine : .today
    }
}
