import SwiftUI

/// The hive's colours: three tones of one hive, and the ink that reads on
/// each of them.
///
/// Decided September 10, 2026, docs/the-wall.md section 13, and ported here
/// from the website's stylesheet so the two products are one picture. Every
/// story the news seeder files is at the claimed tier, and claimed used to be
/// the dark grey, so a board of them was grey on black and said nothing. The
/// tiers are now pale wax, amber and deep honey. The colour still does the
/// tier's job and the legend still says so.
///
/// Separate from `Theme` on purpose. These are the tier colours and they do
/// the tier's job; `Theme` is the app's accent. Since September 22, 2026 the
/// app is honey too, so the two sit together, but a tier tone is never used
/// as the accent or the other way round.
enum HivePalette {

    /// Pale wax, the candle's own colour on the website. Claimed.
    static let wax = Color(red: 0.937, green: 0.878, blue: 0.722)        // EFE0B8
    /// Amber. Reported.
    static let amber = Color(red: 0.906, green: 0.659, blue: 0.227)      // E7A83A
    /// Deep honey. Seen directly.
    static let honey = Color(red: 0.690, green: 0.353, blue: 0.047)      // B05A0C

    /// The dark ink that reads on wax and on amber.
    static let ink = Color(red: 0.165, green: 0.102, blue: 0.031)        // 2A1A08
    /// The pale ink that reads on deep honey.
    static let pale = Color(red: 1.0, green: 0.953, blue: 0.863)         // FFF3DC
    /// The button's own pale, a shade warmer than the ink above it.
    static let button = Color(red: 1.0, green: 0.914, blue: 0.690)       // FFE9B0
    /// The reader's own mark on a light tile. Dark enough to read on wax.
    static let mark = Color(red: 0.541, green: 0.247, blue: 0.020)       // 8A3F05

    /// The board behind the tiles: the app's darkest ground, 120D08, the
    /// same as the website's page behind the hive.
    static let board = Theme.ink

    static func fill(_ tier: WallTier) -> Color {
        switch tier {
        case .claimed: return wax
        case .reported: return amber
        case .seenDirect: return honey
        }
    }

    /// What a headline is set in, on a tile of that tier.
    static func type(_ tier: WallTier) -> Color {
        tier == .seenDirect ? pale : ink
    }

    /// The buzz button's background, and the words on it.
    static func buttonFill(_ tier: WallTier) -> Color {
        tier == .seenDirect ? button : ink
    }

    static func buttonType(_ tier: WallTier) -> Color {
        tier == .seenDirect ? ink : button
    }

    /// "You buzzed this", on a tile of that tier.
    static func markType(_ tier: WallTier) -> Color {
        tier == .seenDirect ? button : mark
    }
}
