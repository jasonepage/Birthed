import SwiftUI

/// The small amount of visual vocabulary the app has so far.
///
/// The accent is the pink straw from the founding observation in `PRD.md`
/// section 2, which is as good a reason for a brand color as most.
enum Theme {
    static let accent = Color(red: 0.94, green: 0.35, blue: 0.50)

    /// System groupings rather than fixed values, so light and dark both work
    /// without a second palette. NFR-053.
    static let canvas = Color(uiColor: .systemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)
}
