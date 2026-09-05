import SwiftUI

/// The shareable image for a day.
///
/// `FR-115` through `FR-118`. Date, the people most looked up on it, the
/// Birthed name and the source credit. No name, no age, no birth year of the
/// user and no location, because the default for every personal field is off.
///
/// Same composition as the card the website puts on a link, so a date shared
/// from the app and a date shared from a browser look like the same product.
struct ShareCardView: View {
    let date: CalendarDate
    let people: [NotablePerson]
    /// Ink or cream. Defaults to ink, which is what the website card uses.
    var palette: StagePalette = .ink

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            palette.ground

            // The bloom the candle actually casts, centred on the flame
            // rather than floating in the corner above it. The stack is bottom
            // trailing, so an unoffset circle this size sits at (560, 830) and
            // the flame is at (852, 976).
            Circle()
                .fill(RadialGradient(
                    colors: [palette.glow.opacity(0.38), palette.glow.opacity(0.06), .clear],
                    center: .center, startRadius: 20, endRadius: 520
                ))
                .frame(width: 1040, height: 1040)
                .offset(x: 292, y: 146)

            CandleMark(height: 620, animated: false)
                .offset(x: -70, y: 96)

            VStack(alignment: .leading, spacing: 0) {
                Text("BIRTHED")
                    .font(.system(size: 30, weight: .heavy))
                    .kerning(9)
                    .foregroundStyle(Theme.accent)

                Spacer().frame(height: 54)

                Text(date.displayName())
                    .font(.system(size: 104, weight: .black, design: .serif))
                    .foregroundStyle(palette.type)
                    .lineLimit(2)
                    .minimumScaleFactor(0.45)

                Spacer().frame(height: 10)

                Text("You share it with")
                    .font(.system(size: 30, weight: .medium))
                    .foregroundStyle(palette.type.opacity(0.6))

                Spacer().frame(height: 34)

                VStack(alignment: .leading, spacing: 22) {
                    ForEach(people) { person in
                        HStack(alignment: .firstTextBaseline, spacing: 24) {
                            Text(person.birthYear.map { String($0) } ?? "")
                                .font(.system(size: 30, weight: .bold, design: .monospaced))
                                .foregroundStyle(Theme.accent)
                                .frame(width: 108, alignment: .leading)

                            Text(person.name)
                                .font(.system(size: 40, weight: .semibold))
                                .foregroundStyle(palette.type)
                                .lineLimit(1)
                                .minimumScaleFactor(0.55)
                        }
                    }
                }

                Spacer(minLength: 30)

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
    ShareCardView(
        date: CalendarDate(month: 9, day: 4)!,
        people: [
            NotablePerson(id: "Q1", name: "Beyoncé", birthYear: 1981, deathYear: nil,
                          shortDescription: "American singer",
                          sourceURL: URL(string: "https://www.wikidata.org/wiki/Q1")!,
                          contentLicense: "CC0-1.0"),
            NotablePerson(id: "Q2", name: "Damon Wayans", birthYear: 1960, deathYear: nil,
                          shortDescription: "American comedian",
                          sourceURL: URL(string: "https://www.wikidata.org/wiki/Q2")!,
                          contentLicense: "CC0-1.0"),
            NotablePerson(id: "Q3", name: "Anton Bruckner", birthYear: 1824, deathYear: 1896,
                          shortDescription: "Austrian composer",
                          sourceURL: URL(string: "https://www.wikidata.org/wiki/Q3")!,
                          contentLicense: "CC0-1.0"),
        ]
    )
    .scaleEffect(0.28)
}
