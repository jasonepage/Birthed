import SwiftUI

/// What a model that searches found about this exact day, under the stage.
///
/// The rest of the Mine tab is arithmetic and lookups: the same five kinds of
/// fact for everybody, filled in with different values. This section is the
/// answer to the verdict that the app was underwhelming because every fact
/// was about the date rather than about the person. It is a list of specific
/// things, most liked first, and the like is what decides the order for
/// everybody else born on the same day.
///
/// It sits on the stage's ground rather than in cards, because a stack of
/// rounded rectangles is what the Mine tab was already criticised for. Rows
/// are separated by a hairline in the stage's own type colour.
struct FoundFactsSection: View {
    let facts: [BirthFact]
    let status: FactsService.Status
    /// "September 4, 2002". What the app says it is looking into.
    let dateName: String
    let palette: StagePalette
    let onLike: (BirthFact) -> Void
    /// The heading. On the reader's own day these are about them; on the
    /// Today tab the same rows are about a date they are only visiting, and
    /// calling that "your day" would be a small lie on 365 of them.
    var title: String = "FOUND ABOUT YOUR DAY"
    /// One fact was drawn. The section does not decide what that is worth.
    var onSeen: (BirthFact) -> Void = { _ in }
    /// The reader wants to send this one. Every fact carries this, not only
    /// the ones that floated to the top: a share button on the top three only
    /// would mean the only facts anybody can send are the ones that were
    /// already winning, which is a ranking that feeds itself.
    var onShare: (BirthFact) -> Void = { _ in }

    /// While a first search is running there is a header and a candle and
    /// nothing else. Once a date has been searched and came back with
    /// nothing, the section is not there at all, because a heading over an
    /// empty space reads as a broken screen.
    private var isSearchingFirstTime: Bool {
        status == .searching && facts.isEmpty
    }

    var body: some View {
        if !facts.isEmpty || isSearchingFirstTime {
            VStack(alignment: .leading, spacing: 0) {
                Text(title)
                    .font(.caption.weight(.heavy))
                    .kerning(3)
                    .foregroundStyle(Theme.accent)
                    .padding(.bottom, isSearchingFirstTime ? 16 : 20)

                if isSearchingFirstTime {
                    looking
                } else {
                    ForEach(Array(facts.enumerated()), id: \.element.id) { index, fact in
                        if index > 0 { hairline }
                        // The first one is set large. The list is ordered by
                        // how many people liked it, so the top row is the one
                        // the crowd chose, and a section where every row is
                        // the same size has nothing to look at first.
                        FoundFactRow(fact: fact, palette: palette, isLead: index == 0,
                                     onLike: onLike, onShare: onShare)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                            .onAppear { onSeen(fact) }
                    }

                    if status == .searching {
                        hairline
                        stillLooking
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 8)
            .animation(.spring(duration: 0.55), value: facts)
        }
    }

    /// The category the model chose, in words a reader would use, set as a
    /// kicker. Anything unrecognised falls back to the plainest of them
    /// rather than showing a raw value from the server.
    static func label(for category: String) -> String {
        switch category {
        case "release": return "CAME OUT"
        case "older_than": return "YOU ARE OLDER"
        case "sport": return "SPORT"
        case "science": return "SCIENCE"
        case "price": return "WHAT IT COST"
        case "weather": return "WEATHER"
        // Neutral, because a fact can be filed under this both when it is
        // near the reader, where the pill already says so, and when it is
        // somewhere else entirely on the shared calendar date.
        case "local": return "A PLACE"
        case "record": return "A RECORD"
        default: return "THAT DAY"
        }
    }

    /// The same categories as the name of a row in the share picker, which is
    /// a list of things to send rather than a label on a fact.
    static func shareLabel(for category: String) -> String {
        switch category {
        case "release": return "What came out"
        case "older_than": return "Older than you"
        case "sport": return "The result"
        case "science": return "In the sky"
        case "price": return "What it cost"
        case "weather": return "The weather"
        case "local": return "A place"
        case "record": return "The record"
        default: return "That day"
        }
    }

    /// "en.wikipedia.org", without the leading www, so the reader can see
    /// whose page it is before deciding to open it.
    static func host(of url: URL?) -> String? {
        guard let host = url?.host() else { return nil }
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }

    private var hairline: some View {
        Rectangle()
            .fill(palette.type.opacity(0.09))
            .frame(height: 1)
            .padding(.vertical, 18)
    }

    private var looking: some View {
        HStack(alignment: .center, spacing: 14) {
            CandleMark(height: 54)
            Text("Looking into \(dateName)")
                .font(Theme.display(.title3, weight: .bold))
                .foregroundStyle(palette.type.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.bottom, 8)
    }

    private var stillLooking: some View {
        HStack(spacing: 10) {
            CandleMark(height: 34)
            Text("Still looking")
                .font(.subheadline)
                .foregroundStyle(palette.type.opacity(0.45))
        }
    }
}

/// One found fact: what kind of thing it is, the sentence, where it came
/// from, and the thumbs up that decides where it sits for everybody else.
private struct FoundFactRow: View {
    let fact: BirthFact
    let palette: StagePalette
    var isLead: Bool = false
    let onLike: (BirthFact) -> Void
    let onShare: (BirthFact) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                Text(FoundFactsSection.label(for: fact.category))
                    .font(.system(size: 10, weight: .heavy))
                    .kerning(1.6)
                    .foregroundStyle(Theme.accent)

                if fact.isLocal {
                    Text("NEAR YOU")
                        .font(.system(size: 9, weight: .heavy))
                        .kerning(1.2)
                        .foregroundStyle(palette.type.opacity(0.55))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(palette.type.opacity(0.09), in: Capsule())
                }

                Spacer(minLength: 8)

                shareButton
                likeButton
            }

            Text(fact.fact)
                .font(.system(size: isLead ? 27 : 19, weight: isLead ? .bold : .semibold, design: .serif))
                .lineSpacing(isLead ? 2 : 0)
                .foregroundStyle(palette.type)
                .fixedSize(horizontal: false, vertical: true)
                .multilineTextAlignment(.leading)

            if let url = fact.sourceURL, let host = FoundFactsSection.host(of: url) {
                Link(destination: url) {
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

    /// A share control on the row rather than only in the picker, because the
    /// moment somebody decides a fact is worth sending is the moment they read
    /// it, not two taps later on a different screen.
    private var shareButton: some View {
        Button {
            onShare(fact)
        } label: {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(palette.type.opacity(0.45))
                .padding(.horizontal, 9)
                .padding(.vertical, 6)
                .background(palette.type.opacity(0.07), in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Share this fact")
    }

    private var likeButton: some View {
        Button {
            onLike(fact)
        } label: {
            HStack(spacing: 5) {
                Image(systemName: fact.likedByMe ? "hand.thumbsup.fill" : "hand.thumbsup")
                    .font(.system(size: 12, weight: .semibold))
                if fact.likes > 0 {
                    Text(fact.likes.formatted())
                        .font(.caption.weight(.bold).monospacedDigit())
                        .contentTransition(.numericText())
                }
            }
            .foregroundStyle(fact.likedByMe ? Theme.accent : palette.type.opacity(0.45))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                fact.likedByMe ? Theme.accent.opacity(0.15) : palette.type.opacity(0.07),
                in: Capsule()
            )
        }
        .buttonStyle(.plain)
        .animation(.spring(duration: 0.3), value: fact.likes)
        .sensoryFeedback(.impact(weight: .light), trigger: fact.likedByMe)
        .accessibilityLabel(fact.likedByMe ? "Liked, tap to undo" : "Like this fact")
    }
}

extension FoundFactsSection {
    /// The card for one fact, built in one place so the Mine tab and the
    /// Today tab send exactly the same picture.
    ///
    /// `dateName` is passed only when the sentence does not already carry the
    /// date. A fact written to a reader with a birth year says "on the day you
    /// were born" and needs the date above it; a fact about a calendar date
    /// says "on September 4, 1957" and putting the date above says it twice.
    static func shareChoice(
        for fact: BirthFact,
        dateName: String?,
        palette: StagePalette
    ) -> ShareCardChoice {
        ShareCardChoice(id: "fact-\(fact.id)", label: shareLabel(for: fact.category)) {
            FocusCard(
                kicker: dateName?.uppercased() ?? label(for: fact.category),
                title: fact.fact,
                footnote: host(of: fact.sourceURL),
                palette: palette,
                titleSize: 58
            )
        }
    }
}
