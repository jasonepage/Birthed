import SwiftUI

/// The visual vocabulary of the app, in one place.
///
/// The accent is the pink straw from the founding observation in `PRD.md`
/// section 2, and it is the same value as the app icon and the share card. If
/// one changes they all change.
enum Theme {
    static let accent = Color(red: 0.937, green: 0.337, blue: 0.502)      // EF5680
    static let accentSoft = Color(red: 1.0, green: 0.533, blue: 0.659)    // FF88A8
    static let accentDeep = Color(red: 0.659, green: 0.149, blue: 0.353)  // A8265A
    static let ember = Color(red: 1.0, green: 0.761, blue: 0.290)         // FFC24A
    static let emberLight = Color(red: 1.0, green: 0.878, blue: 0.541)    // FFE08A
    static let emberDeep = Color(red: 1.0, green: 0.541, blue: 0.239)     // FF8A3D
    static let wax = Color(red: 0.141, green: 0.063, blue: 0.192)         // 241031
    static let waxLight = Color(red: 0.290, green: 0.141, blue: 0.337)    // 4A2456
    static let ink = Color(red: 0.055, green: 0.047, blue: 0.086)         // 0E0C16
    static let cream = Color(red: 1.0, green: 0.969, blue: 0.933)         // FFF7EE

    /// System groupings for ordinary surfaces, so light and dark both work
    /// without maintaining a second palette. NFR-053.
    static let canvas = Color(uiColor: .systemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)

    /// The pink field from the app icon. Used anywhere the app is celebrating
    /// rather than informing: onboarding, and the birthday itself.
    static var celebration: LinearGradient {
        LinearGradient(
            colors: [accentSoft, accent, accentDeep],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    /// A warm bloom, the same one the icon puts behind its flame.
    static var bloom: RadialGradient {
        RadialGradient(
            colors: [accent.opacity(0.34), accent.opacity(0.10), .clear],
            center: .center, startRadius: 8, endRadius: 320
        )
    }

    /// The display face. Serif, because the product is about a date having
    /// weight rather than about a utility having chrome.
    static func display(_ style: Font.TextStyle, weight: Font.Weight = .heavy) -> Font {
        .system(style, design: .serif, weight: weight)
    }
}

/// The ground the Mine tab and both share cards stand on.
///
/// One object, two faces. The screen on the phone and the image it exports
/// are meant to be the same picture, so they read the same palette. Dark mode
/// gets ink under cream type, light mode gets cream under ink type, and the
/// candle and its bloom are the same on both.
struct StagePalette: Equatable {
    let ground: Color
    /// Type at full strength. Everything quieter is this at an opacity.
    let type: Color
    /// What the bloom behind the candle is made of.
    let glow: Color

    static let ink = StagePalette(ground: Theme.ink, type: Theme.cream, glow: Theme.accent)
    static let cream = StagePalette(ground: Theme.cream, type: Theme.ink, glow: Theme.accent)

    static func forScheme(_ scheme: ColorScheme) -> StagePalette {
        scheme == .dark ? .ink : .cream
    }
}

extension View {
    /// A card in the app's ordinary, informational register.
    func birthedCard(padding: CGFloat = 18) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    /// A card sitting on a stage rather than on the system background: a
    /// faint lift in the stage's own type colour, so it belongs to the picture
    /// instead of interrupting it.
    func stageCard(_ palette: StagePalette, padding: CGFloat = 18) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(palette.type.opacity(0.06), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}
