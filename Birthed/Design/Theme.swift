import SwiftUI

/// The visual vocabulary of the app, in one place.
///
/// The accent is the pink straw from the founding observation in `docs/specs/PRD.md`
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

extension StagePalette {
    /// The panel the Mine tab stands on, and the ground of every card it
    /// exports.
    ///
    /// It is the same in light and dark, which is the point rather than an
    /// oversight. The candle works on the app icon and on the share card and
    /// fails on the Mine screen, and the difference between those places is
    /// that the first two are a bounded warm field with the candle as the
    /// subject and the third was an unbounded cream page. This is that field.
    ///
    /// It also gives the flame something to light. Cream is already close to
    /// white, so a glow laid on it has nowhere to go and reads as a stain,
    /// which is what the pink bloom behind the flame looked like in light
    /// mode. Wax is dark enough for warm light to fall across, so the glow is
    /// ember here rather than accent: candlelight rather than a pink smudge.
    ///
    /// Only the page around the panel follows the system appearance. Inside
    /// it there is one set of colours to keep right instead of two.
    static let wax = StagePalette(ground: Theme.wax, type: Theme.cream, glow: Theme.ember)
}


// MARK: - The colour of a kicker

extension Theme {
    /// The nine kinds of thing a day can hold, in the colours the website
    /// gives them.
    ///
    /// Every row used to carry the same pink heading, which made a screen of
    /// them read as one undifferentiated list. The category is already on
    /// every researched fact and was only being printed as a word.
    ///
    /// The values are mid-tones rather than the website's exact ones. The site
    /// is dark only; this screen is not, and the site's pale lilac on a cream
    /// ground is unreadable. These four hold on both grounds.
    static let amber = Color(red: 0.784, green: 0.541, blue: 0.165)  // C88A2A
    static let teal  = Color(red: 0.180, green: 0.620, blue: 0.525)  // 2E9E86
    static let sky   = Color(red: 0.298, green: 0.498, blue: 0.878)  // 4C7FE0
    static let lilac = Color(red: 0.545, green: 0.420, blue: 0.839)  // 8B6BD6

    static func kicker(kind: DayFeed.Kind, category: String?) -> Color {
        switch kind {
        case .person:
            return accent
        case .song, .film:
            return accentSoft
        case .fact, .event:
            switch (category ?? "").lowercased() {
            case "release", "local":
                return teal
            case "sport", "record", "weather":
                return sky
            case "science", "older_than":
                return lilac
            default:
                // "event", "price", and anything a future importer invents.
                return amber
            }
        }
    }
}
