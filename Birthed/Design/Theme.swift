import SwiftUI

/// The visual vocabulary of the app, in one place.
///
/// Honey, amber and warm dark brown, the same palette as the live hive on the
/// website (`HIVE_LIVE_STYLE` in `web/src/hive-live.ts`), so the two products
/// are one picture. Moved from pink and violet on September 22, 2026, per
/// `notes/ios-honey-brief.md`. The names below are the old names on purpose:
/// they are read in dozens of places, and changing what they point to moves
/// every screen at once without renaming anything.
enum Theme {
    /// The accent, in two shades. Bright honey in dark mode, deep honey in
    /// light mode, because honey on white is 1.8 to 1 and body text needs 4.5.
    /// The two values live in `AccentColor.colorset`, which is also what
    /// system controls read, so the tint and this token cannot drift apart.
    /// Dark F4B740, light 9A4E08.
    static let accent = Color("AccentColor")
    static let accentSoft = Color(red: 1.0, green: 0.812, blue: 0.420)   // FFCF6B, honey light
    static let accentDeep = Color(red: 0.604, green: 0.306, blue: 0.031) // 9A4E08, deep honey
    /// What goes on top of an `accent` fill. Dark brown on bright honey in
    /// dark mode (10.8 to 1), cream on deep honey in light mode (5.5 to 1).
    /// White on bright honey is 1.8 to 1, which is why this exists.
    static let onAccent = Color("OnAccentColor")
    /// Bright honey in both appearances, for glow and bloom on dark grounds,
    /// where the light mode shade of `accent` would read as mud.
    static let honey = Color(red: 0.957, green: 0.718, blue: 0.251)      // F4B740
    /// The old accent, kept as one small spark: the wordmark and the song.
    static let spark = Color(red: 0.937, green: 0.337, blue: 0.502)      // EF5680
    static let ember = Color(red: 1.0, green: 0.761, blue: 0.290)         // FFC24A
    static let emberLight = Color(red: 1.0, green: 0.878, blue: 0.541)    // FFE08A
    static let emberDeep = Color(red: 1.0, green: 0.541, blue: 0.239)     // FF8A3D
    /// The dark card, the website's cell. Also the candle's body.
    static let wax = Color(red: 0.118, green: 0.090, blue: 0.063)         // 1E1710
    static let waxLight = Color(red: 0.227, green: 0.180, blue: 0.110)    // 3A2E1C
    /// The darkest ground, the website's page behind the hive.
    static let ink = Color(red: 0.071, green: 0.051, blue: 0.031)         // 120D08
    /// Text on a dark ground.
    static let cream = Color(red: 1.0, green: 0.953, blue: 0.878)         // FFF3E0
    /// Quiet text on a dark ground. 7.3 to 1 on `wax`.
    static let dim = Color(red: 0.718, green: 0.643, blue: 0.533)         // B7A488
    /// A hairline on a dark ground.
    static let line = Color(red: 0.227, green: 0.180, blue: 0.110)        // 3A2E1C

    /// System groupings for ordinary surfaces, so light and dark both work
    /// without maintaining a second palette. NFR-053.
    static let canvas = Color(uiColor: .systemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)

    /// The celebration field: onboarding, and the birthday itself.
    ///
    /// Deep honey running into dark brown rather than bright honey, because
    /// every screen that uses this sets cream type on it. Cream on bright
    /// honey is about 1.6 to 1; cream on every stop here is 5.5 or better.
    static var celebration: LinearGradient {
        LinearGradient(
            colors: [
                accentDeep,
                Color(red: 0.369, green: 0.184, blue: 0.024),  // 5E2F06
                Color(red: 0.165, green: 0.102, blue: 0.031),  // 2A1A08
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    /// A warm bloom, the same one the icon puts behind its flame.
    static var bloom: RadialGradient {
        RadialGradient(
            colors: [honey.opacity(0.34), honey.opacity(0.10), .clear],
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
    /// The accent on this ground. Bright honey on the dark grounds and deep
    /// honey on cream, whatever the phone's appearance. `Theme.accent`
    /// follows the appearance instead, which is wrong on the wax panel: it is
    /// dark in light mode too, and deep honey on it is 2.9 to 1.
    let accent: Color

    static let ink = StagePalette(ground: Theme.ink, type: Theme.cream, glow: Theme.honey, accent: Theme.honey)
    static let cream = StagePalette(ground: Theme.cream, type: Theme.ink, glow: Theme.honey, accent: Theme.accentDeep)

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
    static let wax = StagePalette(ground: Theme.wax, type: Theme.cream, glow: Theme.ember, accent: Theme.honey)
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
            // The one pink left in the app. CLAUDE.md, "The Mine panel": the
            // song keeps the kicker. Pale honey vanished on cream.
            return spark
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
