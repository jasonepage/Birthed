import SwiftUI

/// A feed row for a story with no timeline row of its own.
///
/// The day's news is all of these, and so is anything the worker filed that
/// `DayFeed` did not draw. Everything with a birthday on a date is a pixel,
/// docs/the-wall.md section 13, and this is what a pixel looks like when the
/// reader has no age to put on it.
///
/// It carries no count. The control under it does, so the number is in one
/// place on the row rather than two.
struct HiveStoryRow: View {
    let story: WallStory
    let palette: StagePalette
    let onOpen: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                Text(kicker)
                    .font(.system(size: 10, weight: .heavy))
                    .kerning(1.6)
                    .foregroundStyle(HivePalette.amber)
                Spacer(minLength: 8)
            }

            Button(action: onOpen) {
                Text(story.headline)
                    .font(.system(size: 19, weight: .semibold, design: .serif))
                    .foregroundStyle(palette.type)
                    .fixedSize(horizontal: false, vertical: true)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the receipt: every source, every quotation, every check.")

            HStack(spacing: 6) {
                Text(story.outlet)
                WallChip(tier: story.tier)
                if story.status == .shownFalse {
                    Text("SHOWN FALSE")
                        .font(.system(size: 9, weight: .heavy))
                        .kerning(0.5)
                }
            }
            .font(.caption)
            .foregroundStyle(palette.type.opacity(0.55))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// A story with no subject came from the news feeds, and it is the one
    /// thing on this page that happened today rather than on this date in
    /// another year.
    private var kicker: String {
        HiveFeed.subjectKey(story) == nil ? "TODAY" : "ON THIS DATE"
    }
}

/// The one verb, under any feed row the worker filed a story for.
///
/// The button spends the buzz and the headline above opens the receipt: two
/// acts, two controls, decided September 10, 2026 after the first person to
/// use the hive on the website could not find the receipt and did not want to
/// spend a tap to look.
///
/// A story this install has already backed shows the mark instead. One story
/// takes one buzz from one install, section 14, so there is nothing left for
/// the button to do.
struct HiveRowBuzz: View {
    let story: WallStory
    /// The date the tab is showing, so a reload asks for the page the reader
    /// is on. Taken rather than derived from the story: a story knows the
    /// wall it is on and a failable conversion here would need a fallback,
    /// and a fallback date is a wrong page drawn confidently.
    let date: CalendarDate
    let palette: StagePalette
    let onOpen: () -> Void

    @Environment(WallService.self) private var wall

    private var voice: HiveVoice { wall.voice }
    private var count: String? { HiveCopy.count(story.support, voice: voice) }

    var body: some View {
        let live = wall.phase == .live && story.status != .shownFalse
        let buzzed = wall.hasBuzzed(story)
        HStack(spacing: 8) {
            if buzzed {
                Text(voice.mark)
                    .font(.caption.weight(.heavy))
                    .foregroundStyle(HivePalette.amber)
            } else if live {
                Button {
                    Task { await cast() }
                } label: {
                    Text(voice.button)
                        .font(.caption.weight(.heavy))
                        .padding(.horizontal, 11)
                        .padding(.vertical, 5)
                        .background(HivePalette.amber, in: Capsule())
                        .foregroundStyle(HivePalette.ink)
                }
                .buttonStyle(.plain)
                .disabled(wall.isBuzzing(story))
                .opacity(wall.isBuzzing(story) ? 0.5 : 1)
                .accessibilityLabel("\(voice.button): \(story.headline)")
                .sensoryFeedback(.impact(weight: .light), trigger: story.support)
            }
            if let count {
                Text(count)
                    .font(.caption.weight(.bold).monospacedDigit())
                    .foregroundStyle(palette.type.opacity(0.55))
                    .contentTransition(.numericText())
            }
            Spacer(minLength: 0)
        }
        .padding(.top, 8)
        .animation(.spring(duration: 0.3), value: story.support)
    }

    private func cast() async {
        do {
            try await wall.buzz(story: story)
            await wall.load(date: date)
        } catch {
            // The row has no room to explain a refusal and the receipt does,
            // and the service is holding the sentence for it.
            onOpen()
        }
    }
}
