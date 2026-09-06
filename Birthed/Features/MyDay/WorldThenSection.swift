import SwiftUI

/// What version of the world the reader was born into, under the found facts
/// on Mine.
///
/// Five lines from `WorldThen`, the same hairline rows as the found facts, so
/// a reader cannot tell which sentences a model searched for and which came
/// from a table in the app. The difference is that these are certain, cost
/// nothing, and need no network, which is why the section is there before
/// the facts have loaded. Only shown when the year is known: every line here
/// is about the year.
struct WorldThenSection: View {
    let birthday: CalendarBirthday
    let palette: StagePalette
    let onShare: (WorldThen.Line) -> Void

    private var lines: [WorldThen.Line] {
        guard let year = birthday.year else { return [] }
        return WorldThen.lines(month: birthday.date.month, day: birthday.date.day, year: year)
    }

    var body: some View {
        if !lines.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                Text("THE WORLD WHEN YOU ARRIVED")
                    .font(.caption.weight(.heavy))
                    .kerning(3)
                    .foregroundStyle(Theme.accent)
                    .padding(.bottom, 20)

                ForEach(Array(lines.enumerated()), id: \.element.id) { index, line in
                    if index > 0 { hairline }
                    row(line, isLead: index == 0)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 8)
        }
    }

    private func row(_ line: WorldThen.Line, isLead: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                Text(line.kicker)
                    .font(.system(size: 10, weight: .heavy))
                    .kerning(1.6)
                    .foregroundStyle(Theme.accent)

                Spacer(minLength: 8)

                Button {
                    onShare(line)
                } label: {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(palette.type.opacity(0.45))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 6)
                        .background(palette.type.opacity(0.07), in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Share this")
            }

            Text(line.text)
                .font(.system(size: isLead ? 27 : 19, weight: isLead ? .bold : .semibold, design: .serif))
                .lineSpacing(isLead ? 2 : 0)
                .foregroundStyle(palette.type)
                .fixedSize(horizontal: false, vertical: true)
                .multilineTextAlignment(.leading)

            if let host = FoundFactsSection.host(of: line.sourceURL) {
                Link(destination: line.sourceURL) {
                    HStack(spacing: 4) {
                        Text(host)
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 9, weight: .bold))
                    }
                    .font(.caption)
                    .foregroundStyle(palette.type.opacity(0.42))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var hairline: some View {
        Rectangle()
            .fill(palette.type.opacity(0.09))
            .frame(height: 1)
            .padding(.vertical, 18)
    }

    /// The card for one line. The sentence is written to the reader ("you
    /// are older than Fortnite"), and a card is read by everybody else, so it
    /// is turned round to the first person before it goes out.
    static func shareChoice(for line: WorldThen.Line, palette: StagePalette) -> ShareCardChoice {
        ShareCardChoice(id: "world-\(line.kicker)", label: line.kicker.capitalized) {
            FocusCard(
                kicker: line.kicker,
                title: firstPerson(line.text),
                footnote: FoundFactsSection.host(of: line.sourceURL),
                palette: palette,
                titleSize: 58
            )
        }
    }

    /// "You are 15 years older than Fortnite." to "I am 15 years older than
    /// Fortnite." Only the openings `WorldThen` writes, nothing cleverer.
    static func firstPerson(_ text: String) -> String {
        var out = text
        let swaps: [(String, String)] = [
            ("You are ", "I am "),
            (" the day you were born.", " the day I was born."),
            (" when you were born.", " when I was born."),
            (" the same month you did.", " the same month I did."),
        ]
        for (from, to) in swaps { out = out.replacingOccurrences(of: from, with: to) }
        return out
    }
}
