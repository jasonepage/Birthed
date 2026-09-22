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
    /// The lines to show, chosen by the caller rather than worked out here.
    ///
    /// Working them out here was right while this section was the only place
    /// they appeared. The lead line is now promoted into the stage above, so
    /// the caller reads them once and hands this one what is left. A section
    /// that recomputed them would print the promoted sentence a second time,
    /// a few inches further down the same screen.
    let lines: [WorldThen.Line]
    let palette: StagePalette
    let onShare: (WorldThen.Line) -> Void

    /// Totals by subject, and which ones this account has liked.
    ///
    /// The like is on the subject and never on the sentence, for the reason
    /// written at length over `WorldLikesService`: these sentences are
    /// computed from the reader's birth year, so two readers born on the same
    /// day in different years never see the same one and likes on it could
    /// not aggregate.
    @Environment(WorldLikesService.self) private var likes

    var body: some View {
        if !lines.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                Text("THE WORLD WHEN YOU ARRIVED")
                    .font(.caption.weight(.heavy))
                    .kerning(3)
                    .foregroundStyle(palette.accent)
                    .padding(.bottom, 20)

                ForEach(Array(lines.enumerated()), id: \.element.id) { index, line in
                    if index > 0 { hairline }
                    row(line)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 8)
            // Cheap, and it fails to nothing: an unreachable server leaves
            // empty hearts and no numbers, which is also what a brand new
            // account correctly sees.
            .task { await likes.load() }
        }
    }

    /// Every row the same weight. The first one used to be set large, because
    /// it was the loudest sentence in the section. The loudest sentence is in
    /// the stage now, and a second headline directly under the first one reads
    /// as the screen shouting twice.
    private func row(_ line: WorldThen.Line) -> some View {
        let subject = WorldLikesService.subject(for: line)

        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                Text(line.kicker)
                    .font(.system(size: 10, weight: .heavy))
                    .kerning(1.6)
                    .foregroundStyle(palette.accent)

                Spacer(minLength: 8)

                // No number until the subject has five, which is the floor
                // `FactOrder` uses and is here for the same reason: a heart
                // with a zero beside it is a report that nobody is here,
                // where a heart on its own is just a control.
                Button {
                    Task { await likes.toggle(subject) }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: likes.isLiked(subject) ? "heart.fill" : "heart")
                            .font(.system(size: 12, weight: .semibold))
                        if let count = likes.displayCount(for: subject) {
                            Text("\(count)")
                                .font(.system(size: 12, weight: .semibold))
                                .monospacedDigit()
                        }
                    }
                    .foregroundStyle(likes.isLiked(subject) ? palette.accent : palette.type.opacity(0.45))
                    .padding(.horizontal, 9)
                    .padding(.vertical, 6)
                    .background(palette.type.opacity(0.07), in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(likes.isLiked(subject)
                                    ? "Liked. Tap to take it back."
                                    : "Like \(line.kicker.capitalized)")

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
                .font(.system(size: 19, weight: .semibold, design: .serif))
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
