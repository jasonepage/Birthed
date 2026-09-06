import SwiftUI

/// A share card with one fact on it.
///
/// `MyDayShareCard` is the whole day on one card. This is the other kind: one
/// thing, set large, for the person who wants to post the song and only the
/// song, or the day they turn ten thousand days old. Same ground, same
/// candle, same corner, so a stack of them from one person still reads as one
/// product. No name on it, like every card Birthed makes.
///
/// Rendered on device, still candle, 1080 by 1350, like the others.
struct FocusCard: View {
    /// "NUMBER ONE THE WEEK I WAS BORN". Small, pink, spaced out.
    let kicker: String
    /// The fact. Set at up to 104 points and allowed to shrink to fit.
    let title: String
    /// "Nelly featuring Kelly Rowland". Optional.
    var subtitle: String? = nil
    /// The line that makes the claim checkable. Optional.
    var footnote: String? = nil
    var palette: StagePalette = .ink
    /// A song title is three words and a found fact is a whole sentence, so
    /// the one face size that suited the first is far too big for the second.
    var titleSize: CGFloat = 104

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            palette.ground

            Circle()
                .fill(RadialGradient(
                    colors: [palette.glow.opacity(0.38), palette.glow.opacity(0.06), .clear],
                    center: .center, startRadius: 20, endRadius: 520
                ))
                .frame(width: 1040, height: 1040)
                .offset(x: 313, y: 176)

            CandleMark(height: 560, animated: false)
                .offset(x: -64, y: 80)

            VStack(alignment: .leading, spacing: 0) {
                Text("BIRTHED")
                    .font(.system(size: 30, weight: .heavy))
                    .kerning(9)
                    .foregroundStyle(Theme.accent)

                Spacer(minLength: 60)

                Text(kicker)
                    .font(.system(size: 26, weight: .heavy))
                    .kerning(5)
                    .foregroundStyle(Theme.accent)
                    .fixedSize(horizontal: false, vertical: true)

                Spacer().frame(height: 28)

                Text(title)
                    .font(.system(size: titleSize, weight: .black, design: .serif))
                    .foregroundStyle(palette.type)
                    .lineLimit(titleSize < 80 ? 8 : 4)
                    .minimumScaleFactor(0.4)
                    .fixedSize(horizontal: false, vertical: true)

                if let subtitle {
                    Spacer().frame(height: 18)
                    Text(subtitle)
                        .font(.system(size: 38, weight: .regular))
                        .foregroundStyle(palette.type.opacity(0.6))
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if let footnote {
                    Spacer().frame(height: 22)
                    Text(footnote)
                        .font(.system(size: 24, weight: .regular))
                        .foregroundStyle(palette.type.opacity(0.35))
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 60)

                Text("birthed.app")
                    .font(.system(size: 24, weight: .semibold))
                    .kerning(1.2)
                    .foregroundStyle(palette.type.opacity(0.42))
            }
            // The candle takes the bottom right, so the text keeps clear of
            // it on the right and the footer sits to its left.
            .padding(.leading, 78)
            .padding(.trailing, 300)
            .padding(.vertical, 76)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(width: 1080, height: 1350)
        .clipped()
    }
}

#Preview {
    FocusCard(
        kicker: "NUMBER ONE THE WEEK I WAS BORN",
        title: "Dilemma",
        subtitle: "Nelly featuring Kelly Rowland",
        footnote: "Billboard Hot 100, issue dated September 7, 2002"
    )
    .scaleEffect(0.28)
}
