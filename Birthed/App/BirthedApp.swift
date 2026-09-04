//
//  BirthedApp.swift
//  Birthed
//
//  Created by Jason Page on 9/4/26.
//

import SwiftUI

@main
struct BirthedApp: App {
    // Slice 1 wires one repository by hand. There is no dependency container
    // yet because there is nothing yet to inject into.
    private let repository = SupabaseRestDayPageRepository()

    var body: some Scene {
        WindowGroup {
            DayPageView(date: CalendarDate.today(), repository: repository)
        }
    }
}
