import SwiftUI

/// The shareable image for a day.
///
/// FR-115 through FR-118. It carries the date, the notable people who share
/// it, the Birthed name and the source credit. It carries no name, no age, no
/// birth year of the user and no location, because slice 1 has no user and
/// because the default for every personal field is off.
///
/// Fixed colors rather than semantic ones, so the rendered image looks the
/// same whoever shares it and whatever appearance their phone is set to.
struct ShareCardView: View {
    let date: CalendarDate
    let people: [NotablePerson]

    private let ink = Color(red: 0.07, green: 0.07, blue: 0.10)
    private let paper = Color(red: 0.98, green: 0.97, blue: 0.94)
    private let accent = Color(red: 0.97, green: 0.45, blue: 0.60)

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("BIRTHED")
                .font(.system(size: 32, weight: .heavy, design: .default))
                .kerning(10)
                .foregroundStyle(accent)

            Spacer().frame(height: 56)

            Text(date.displayName())
                .font(.system(size: 104, weight: .black, design: .serif))
                .foregroundStyle(paper)
                .lineLimit(2)
                .minimumScaleFactor(0.5)

            Spacer().frame(height: 12)

            Text("You share this day with")
                .font(.system(size: 32, weight: .medium))
                .foregroundStyle(paper.opacity(0.65))

            Spacer().frame(height: 44)

            VStack(alignment: .leading, spacing: 26) {
                ForEach(people) { person in
                    HStack(alignment: .firstTextBaseline, spacing: 22) {
                        Text(person.birthYear.map { String($0) } ?? "")
                            .font(.system(size: 30, weight: .semibold, design: .monospaced))
                            .foregroundStyle(accent)
                            .frame(width: 110, alignment: .leading)

                        Text(person.name)
                            .font(.system(size: 40, weight: .semibold))
                            .foregroundStyle(paper)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    }
                }
            }

            Spacer(minLength: 40)

            Text("Names and dates from Wikidata. Credit to Wikipedia and Wikidata.")
                .font(.system(size: 22, weight: .regular))
                .foregroundStyle(paper.opacity(0.45))
        }
        .padding(76)
        .frame(width: 1080, height: 1350, alignment: .topLeading)
        .background(ink)
    }
}

#Preview {
    ShareCardView(
        date: CalendarDate(month: 9, day: 4)!,
        people: [
            NotablePerson(
                id: "Q1",
                name: "Beyoncé",
                birthYear: 1981,
                deathYear: nil,
                shortDescription: "American singer",
                sourceURL: URL(string: "https://www.wikidata.org/wiki/Q1")!,
                contentLicense: "CC0-1.0"
            )
        ]
    )
    .scaleEffect(0.3)
}
