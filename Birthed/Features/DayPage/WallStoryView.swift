import SwiftUI

/// One story and its whole receipt: every source, its quotation, every
/// check ever run, and the one control that spends a buzz. docs/the-wall.md
/// section 5: every story has a receipt, kept and visible, and nothing here
/// decides what is true.
///
/// **The receipt carries the button too.** A reader who came here to check
/// the sources should not have to go back to the hive to vote. One tap is one
/// unit, section 4 as amended, and a story this install has already backed
/// shows the mark where the button was.
///
/// A double tap is one request: the service holds the request identifier
/// while the first is in flight and the database returns the first buzz for a
/// repeat.
///
/// No name, no score, nothing about who submitted or backed it. Section 6.
struct WallStoryView: View {
    let storyID: String
    let date: CalendarDate
    let palette: StagePalette

    @Environment(WallService.self) private var wall
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var refusal: String?
    @State private var working = false
    @State private var spent = false

    private var story: WallStory? { wall.story(storyID) }
    private var voice: HiveVoice { wall.voice }

    var body: some View {
        NavigationStack {
            Group {
                if let story {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            if let picture = story.pictureKey.flatMap({ wall.pictures[$0] }) {
                                pictureHeader(picture)
                            }
                            headline(story)
                            buzzControl(story)
                            sources(story)
                        }
                        .padding(20)
                    }
                } else {
                    Text("This story is no longer filed for this date.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .padding()
                }
            }
            .background(Theme.canvas)
            .navigationTitle("The receipt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    // MARK: The picture

    /// The event's lead picture, and under it the credit Commons gives the
    /// file. A freely licensed picture is only free with its credit, so the
    /// picture is never drawn here without the line.
    private func pictureHeader(_ picture: HivePicture) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            AsyncImage(url: picture.url) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFill()
                } else {
                    Theme.card
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 170)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .accessibilityHidden(true)
            if let page = picture.commonsURL {
                Button {
                    openURL(page)
                } label: {
                    Text(picture.credit)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                        .underline()
                }
                .buttonStyle(.plain)
                .accessibilityHint("Opens the file's page on Wikimedia Commons.")
            } else {
                Text(picture.credit)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: The story

    private func headline(_ story: WallStory) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(story.headline)
                .font(.system(.title2, design: .serif, weight: .heavy))
            Button {
                openURL(story.url)
            } label: {
                Text(story.url.absoluteString)
                    .font(.footnote)
                    .foregroundStyle(palette.accent)
                    .multilineTextAlignment(.leading)
            }
            .buttonStyle(.plain)
            HStack(spacing: 8) {
                WallChip(tier: story.tier)
                Text(story.tier.meaning)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text(HiveCopy.legend)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text((HiveCopy.count(story.support, voice: voice).map { "\($0). " } ?? "")
                 + "Submitted \(eastern(story.submittedAt))."
                 + (story.placedAt.map { " Placed \(eastern($0))." } ?? ""))
                .font(.footnote)
                .foregroundStyle(.secondary)
            Text(story.standing)
                .font(.footnote)
                .foregroundStyle(.secondary)
            if story.status == .shownFalse, let note = story.falseNote {
                Text(note)
                    .font(.footnote)
                    .padding(10)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
    }

    // MARK: The one control that spends a buzz

    private func buzzControl(_ story: WallStory) -> some View {
        let phase = wall.phase ?? .closed
        let left = wall.unitsLeft ?? 0
        let buzzed = wall.hasBuzzed(story)
        let canBuzz = phase == .live && story.status != .shownFalse && left > 0 && !buzzed
        return VStack(alignment: .leading, spacing: 8) {
            Text(voice.button.uppercased())
                .font(.caption.weight(.heavy))
                .kerning(2.0)
                .foregroundStyle(palette.accent)

            Text(story.status == .shownFalse
                 ? HiveCopy.takesNone(voice: voice)
                 : buzzed
                    ? HiveCopy.alreadyBacked(voice: voice)
                    : HiveCopy.allowance(left, allowance: wall.allowance, phase: phase, voice: voice))
                .font(.footnote.weight(left == 0 || !canBuzz ? .semibold : .regular))
                .foregroundStyle(.secondary)
                .contentTransition(.numericText())

            if canBuzz {
                Button {
                    Task { await cast(story) }
                } label: {
                    Text(voice.button)
                        .font(.subheadline.weight(.semibold))
                        // The colour is on the words rather than on the
                        // button: a prominent button sets its own label
                        // white, and white on amber is not a contrast.
                        .foregroundStyle(HivePalette.ink)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.borderedProminent)
                .tint(HivePalette.amber)
                .disabled(working || wall.isBuzzing(story))

                Text(HiveCopy.irreversible)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            if spent {
                Text(HiveCopy.counted)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            if let refusal {
                Text(refusal)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .onAppear {
            // A tap on a tile that the service refused opens this page with
            // the sentence already made. Shown once, then cleared.
            if let line = wall.lastRefusal { refusal = line }
        }
    }

    private func cast(_ story: WallStory) async {
        guard !working else { return }
        working = true
        refusal = nil
        defer { working = false }
        do {
            try await wall.buzz(story: story)
            spent = true
            await wall.load(date: date)
        } catch {
            refusal = error.localizedDescription
        }
    }

    // MARK: Sources

    private func sources(_ story: WallStory) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Sources")
                .font(.system(.title3, design: .serif, weight: .heavy))
            Text(HiveCopy.receiptNote)
                .font(.caption)
                .foregroundStyle(.secondary)
            if story.sources.isEmpty {
                Text("No sources recorded.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            ForEach(Array(story.sources.enumerated()), id: \.element.id) { index, source in
                sourceBlock(source, index: index)
            }
        }
    }

    private func sourceBlock(_ source: WallSource, index: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Source \(index + 1): \(source.outlet)")
                .font(.headline)
            Button {
                openURL(source.url)
            } label: {
                Text(source.headline)
                    .font(.subheadline)
                    .foregroundStyle(palette.accent)
                    .multilineTextAlignment(.leading)
            }
            .buttonStyle(.plain)
            Text("Owned by \(source.owner). Added \(eastern(source.addedAt))."
                 + (source.isPrimaryDoc ? " Marked as the record itself." : ""))
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(source.quotation)
                .font(.system(.body, design: .serif))
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(alignment: .leading) {
                    Rectangle().fill(palette.accent).frame(width: 3)
                }
            Text(source.verificationLine)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text("Check history")
                .font(.subheadline.weight(.semibold))
                .padding(.top, 2)
            if source.checks.isEmpty {
                Text("No checks run yet.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            ForEach(Array(source.checks.enumerated()), id: \.offset) { _, check in
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(check.title)
                            .font(.caption.weight(.semibold))
                        Spacer()
                        Text(check.passed ? "Passed" : "Failed")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(check.passed ? palette.accent : Color.secondary)
                        if let status = check.httpStatus {
                            Text(String(status))
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                    Text(eastern(check.checkedAt) + (check.detail.map { ". \($0)" } ?? ""))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
                Divider()
            }
        }
    }

    /// A time as it reads in Eastern, because that is the clock the wall
    /// runs on.
    private func eastern(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeZone = TimeZone(identifier: "America/New_York")
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date) + " Eastern"
    }
}
