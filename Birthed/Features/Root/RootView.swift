import SwiftUI

/// Onboarding, or the two tabs.
///
/// It was three. The third was called Me and it was a settings form, which is
/// not a destination: it is a thing you do once and leave. It is a cog now.
/// `FR-015` said exactly three top-level destinations and this is a deliberate
/// departure from it, recorded in `CLAUDE.md` section 5.
///
/// `FR-033` still holds: inside the birthday window the app opens on the
/// user's own day rather than on today's page.
struct RootView: View {
    @Environment(ProfileStore.self) private var profileStore
    @Environment(AccountService.self) private var account
    @Environment(\.scenePhase) private var scenePhase

    let repository: DayPageRepository

    @State private var tab: Tab = .today
    @State private var showingSettings = false

    enum Tab: Hashable { case today, mine }

    var body: some View {
        Group {
            if let profile = profileStore.profile {
                tabs(for: profile)
            } else {
                OnboardingView { profile in
                    profileStore.save(profile)
                    Task {
                        await account.ensureAccount()
                        await account.pushProfile(profile)
                    }
                    tab = openingTab(for: profile)
                }
            }
        }
        .sheet(isPresented: $showingSettings) { SettingsView() }
        .task {
            // FR-010. Silent, on first launch, with no screen and no action.
            await account.ensureAccount()
            if let profile = profileStore.profile {
                tab = openingTab(for: profile)
                await account.pushProfile(profile)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            // FR-011. Retry on every foreground until it takes.
            guard phase == .active else { return }
            Task { await account.ensureAccount() }
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
        }
        .tint(Theme.accent)
    }

    private func openingTab(for profile: Profile) -> Tab {
        BirthdayCalendar().isInWindow(profile.birthday, on: Date()) ? .mine : .today
    }
}
