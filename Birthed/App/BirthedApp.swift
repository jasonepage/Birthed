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
    @State private var account = AccountService()
    @State private var people = PeopleStore()

    private let repository = SupabaseRestDayPageRepository()

    var body: some Scene {
        WindowGroup {
            RootView(repository: repository)
                .environment(profileStore)
                .environment(account)
                .environment(people)
        }
    }
}
