//
//  BirthedApp.swift
//  Birthed
//
//  Created by Jason Page on 9/4/26.
//

import SwiftUI

@main
struct BirthedApp: App {
    // Slice 2 still wires everything by hand. There is no dependency container
    // because there is still nothing that needs one.
    @State private var profileStore = ProfileStore()
    @State private var account: AccountService
    @State private var people = PeopleStore()
    @State private var notifications = NotificationService()
    /// The only one of these that needs another, because every call it makes
    /// is signed with the account's token, so the two are built together.
    @State private var facts: FactsService
    /// Which world-when-you-arrived subjects readers like, so that adding more
    /// lines like them is an informed decision rather than a guess.
    @State private var worldLikes: WorldLikesService
    /// The best selling game of the reader's birth year, which is keyed to a
    /// year rather than to a week and so cannot live in chart_weeks.
    @State private var yearCharts: YearChartService
    /// Also account-bound: the whole inbox is one row level security policy,
    /// so without a signed in account it has nothing to read.
    @State private var inbox: BirthdayInbox
    /// What each date is remembered for. Deliberately NOT account-bound: every
    /// function it calls is granted to anon, so remembering works on a phone
    /// whose silent account has not been created yet, and its token is its own
    /// random value rather than the user id. See `RememberService`.
    @State private var remember = RememberService()
    /// The wall. Reads with the publishable key like the website does, and
    /// writes as the silent account through the wall-write Edge Function,
    /// which checks App Attest. docs/the-wall.md sections 6 and 12.
    @State private var wall: WallService

    private let repository = SupabaseRestDayPageRepository()

    init() {
        let account = AccountService()
        _account = State(initialValue: account)
        _facts = State(initialValue: FactsService(account: account))
        _worldLikes = State(initialValue: WorldLikesService(account: account))
        _yearCharts = State(initialValue: YearChartService(account: account))
        _inbox = State(initialValue: BirthdayInbox(account: account))
        _wall = State(initialValue: WallService(account: account))
    }

    var body: some Scene {
        WindowGroup {
            RootView(repository: repository)
                .environment(profileStore)
                .environment(account)
                .environment(people)
                .environment(notifications)
                .environment(facts)
                .environment(worldLikes)
                .environment(yearCharts)
                .environment(inbox)
                .environment(remember)
                .environment(wall)
        }
    }
}
