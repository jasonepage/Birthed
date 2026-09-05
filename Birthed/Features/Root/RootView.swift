import SwiftUI

/// Onboarding, or the three tabs. Nothing else decides which.
///
/// `FR-015` fixes the shape at exactly three top-level destinations.
/// `FR-033` opens on the user's own day rather than on today's page when they
/// are inside their birthday window, because that is the fortnight when their
/// day is the thing they came for.
struct RootView: View {
    @Environment(ProfileStore.self) private var profileStore
    @Environment(AccountService.self) private var account
    @Environment(\.scenePhase) private var scenePhase

    let repository: DayPageRepository

    @State private var tab: Tab = .today

    enum Tab: Hashable { case today, mine, me }

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
            DayPageView(date: CalendarDate.today(), repository: repository)
                .tabItem { Label("Today", systemImage: "calendar") }
                .tag(Tab.today)

            MyDayView(profile: profile, repository: repository)
                .tabItem { Label("Mine", systemImage: "flame") }
                .tag(Tab.mine)

            MeView()
                .tabItem { Label("Me", systemImage: "person") }
                .tag(Tab.me)
        }
        .tint(Theme.accent)
    }

    private func openingTab(for profile: Profile) -> Tab {
        BirthdayCalendar().isInWindow(profile.birthday, on: Date()) ? .mine : .today
    }
}
