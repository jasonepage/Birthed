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

    private let repository = SupabaseRestDayPageRepository()

    init() {
        let account = AccountService()
        _account = State(initialValue: account)
        _facts = State(initialValue: FactsService(account: account))
    }

    var body: some Scene {
        WindowGroup {
            RootView(repository: repository)
                .environment(profileStore)
                .environment(account)
                .environment(people)
                .environment(notifications)
                .environment(facts)
        }
    }
}
