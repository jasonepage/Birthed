import SwiftUI

/// The card somebody shares about their own day.
///
/// Not the same thing as `ShareCardView`. That one is about a date and is
/// deliberately anonymous, because it is generated for any date whether or not
/// it is yours. This one is about the person holding the phone, so it carries
/// the day of the week they were born, the song that week, and how many days
/// they have been here.
///
/// Everything on it implies a birth year, and that is the point rather than an
/// oversight: a card that would not say which year is a card with nothing on
/// it. What makes that acceptable is that it does not exist until somebody
/// taps share. Nothing here is ever posted, uploaded, or shown to anybody the
/// user did not hand it to, and the name is not on it, because the name is the
/// one thing that turns a fact about a day into a fact about a person.
///
/// Rendered on device, so it works with the network switched off. `FR-117`.
/// The candle is drawn still: `ImageRenderer` takes one frame of an
/// animation and the card should not depend on which one.
struct MyDayShareCard: View {
    let date: CalendarDate
    /// "Sunday", when the year is known.
    let weekdayName: String?
    let song: ChartWeek?
    var album: ChartWeek? = nil
    var film: ChartWeek? = nil
    let daysAlive: Int?
    /// Ink or cream, to match whichever face the Mine tab is showing. The
    /// screen and the export are meant to be the same picture.
    var palette: StagePalette = .ink

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            palette.ground

            // The light the candle casts, centred on the flame. The stack is
            // bottom trailing, so an unoffset circle this size sits at
            // (560, 830) and the flame of a 560 point candle offset by
            // (-64, 80) sits at (873, 1006).
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

                Spacer().frame(height: 84)

                Text(date.displayName())
                    .font(.system(size: 112, weight: .black, design: .serif))
                    .foregroundStyle(palette.type)
                    .lineLimit(2)
                    .minimumScaleFactor(0.45)

                if let weekdayName {
                    Spacer().frame(height: 8)
                    Text("born on a \(weekdayName)")
                        .font(.system(size: 34, weight: .regular))
                        .foregroundStyle(palette.type.opacity(0.55))
                }

                if let song {
                    Spacer().frame(height: 62)

                    Rectangle()
                        .fill(Theme.accent.opacity(0.7))
                        .frame(width: 120, height: 3)

                    Spacer().frame(height: 52)

                    Text("THE WEEK I WAS BORN")
                        .font(.system(size: 26, weight: .heavy))
                        .kerning(5)
                        .foregroundStyle(Theme.accent)

                    Spacer().frame(height: 26)

                    Text(song.song)
                        .font(.system(size: 62, weight: .black, design: .serif))
                        .foregroundStyle(palette.type)
                        .lineLimit(2)
                        .minimumScaleFactor(0.5)

                    Spacer().frame(height: 12)

                    Text(song.artist)
                        .font(.system(size: 32, weight: .regular))
                        .foregroundStyle(palette.type.opacity(0.55))
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)

                    Spacer().frame(height: 16)

                    // The issue date is on here for the same reason it is on
                    // the card in the app: it is what makes the claim
                    // checkable rather than something Birthed asserts.
                    Text(song.attribution())
                        .font(.system(size: 24, weight: .regular))
                        .foregroundStyle(palette.type.opacity(0.32))
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }

                ForEach([album, film].compactMap { $0 }, id: \.self) { week in
                    Spacer().frame(height: 34)

                    Text("NUMBER ONE \(week.kind?.noun.uppercased() ?? "")")
                        .font(.system(size: 22, weight: .heavy))
                        .kerning(4)
                        .foregroundStyle(Theme.accent)

                    Spacer().frame(height: 10)

                    Text(week.song)
                        .font(.system(size: 42, weight: .bold, design: .serif))
                        .foregroundStyle(palette.type)
                        .lineLimit(2)
                        .minimumScaleFactor(0.6)

                    if week.kind?.hasCredit == true, !week.artist.isEmpty {
                        Spacer().frame(height: 6)
                        Text(week.artist)
                            .font(.system(size: 28, weight: .regular))
                            .foregroundStyle(palette.type.opacity(0.55))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                }

                Spacer(minLength: 40)

                if let daysAlive {
                    Text("\(daysAlive.formatted()) days old")
                        .font(.system(size: 52, weight: .black, design: .serif))
                        .foregroundStyle(palette.type)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)

                    Spacer().frame(height: 14)
                }

                Text("birthed.app")
                    .font(.system(size: 24, weight: .semibold))
                    .kerning(1.2)
                    .foregroundStyle(palette.type.opacity(0.42))
            }
            .padding(.horizontal, 78)
            .padding(.vertical, 76)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(width: 1080, height: 1350)
        .clipped()
    }
}

#Preview {
    MyDayShareCard(
        date: CalendarDate(month: 9, day: 4)!,
        weekdayName: "Sunday",
        song: ChartWeek(
            date: CalendarDate(month: 9, day: 10)!,
            year: 2005,
            song: "We Belong Together",
            artist: "Mariah Carey"
        ),
        daysAlive: 7671
    )
    .scaleEffect(0.28)
}
