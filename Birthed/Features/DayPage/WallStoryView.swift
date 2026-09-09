import SwiftUI

/// One story and its whole receipt: every source, its quotation, every
/// check ever run, and the boost control. docs/the-wall.md section 5: every
/// story has a receipt, kept and visible, and nothing here decides what is
/// true.
///
/// The boost control shows how many units are left on this date, offers
/// one, two or three, and says plainly when the budget is spent or the date
/// has closed. A double tap is one request: the service holds the request
/// identifier while the first is in flight and the database returns the
/// first boost for a repeat.
///
/// No name, no score, nothing about who submitted or boosted. Section 6.
struct WallStoryView: View {
    let storyID: String
    let date: CalendarDate
    let palette: StagePalette

    @Environment(WallService.self) private var wall
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var refusal: String?
    @State private var working = false
    @State private var lastSpent: Int?

    private var story: WallStory? { wall.story(storyID) }

    var body: some View {
        NavigationStack {
            Group {
                if let story {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            headline(story)
                            boostControl(story)
                            sources(story)
                        }
                        .padding(20)
                    }
                } else {
                    Text("This story is no longer on this date's wall.")
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
                    .foregroundStyle(Theme.accent)
                    .multilineTextAlignment(.leading)
            }
            .buttonStyle(.plain)
            HStack(spacing: 8) {
                WallChip(tier: story.tier)
                Text(story.tier.meaning)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text(WallCopy.tierNote)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text("\(WallCopy.boosts(story.support)). Submitted \(eastern(story.submittedAt))."
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

    // MARK: Boosting

    private func boostControl(_ story: WallStory) -> some View {
        let phase = wall.phase ?? .closed
        let left = wall.unitsLeft ?? 0
        let canBoost = phase == .live && story.status != .shownFalse && left > 0
        return VStack(alignment: .leading, spacing: 8) {
            Text("BOOST")
                .font(.caption.weight(.heavy))
                .kerning(2.0)
                .foregroundStyle(Theme.accent)
            Text(story.status == .shownFalse
                 ? "This story has been shown false and takes no boosts."
                 : WallCopy.unitsLeft(left, phase: phase))
                .font(.footnote.weight(left == 0 || !canBoost ? .semibold : .regular))
                .foregroundStyle(.secondary)
                .contentTransition(.numericText())
            if canBoost {
                HStack(spacing: 8) {
                    ForEach(1...3, id: \.self) { units in
                        Button {
                            Task { await cast(story, units: units) }
                        } label: {
                            Text(units == 1 ? "1 boost" : "\(units) boosts")
                                .font(.subheadline.weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Theme.accent)
                        .disabled(working || wall.isBoosting(story) || !WallBudget.canSpend(units, left: left))
                    }
                }
                Text("Spend more on a story you are certain will still matter. What is spent cannot be taken back.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            if let lastSpent {
                Text(lastSpent == 1 ? "1 boost placed." : "\(lastSpent) boosts placed.")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.accent)
            }
            if let refusal {
                Text(refusal)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func cast(_ story: WallStory, units: Int) async {
        guard !working else { return }
        working = true
        refusal = nil
        defer { working = false }
        do {
            try await wall.boost(story: story, units: units)
            lastSpent = units
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
            Text(WallCopy.receiptNote)
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
                    .foregroundStyle(Theme.accent)
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
                    Rectangle().fill(Theme.accent).frame(width: 3)
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
                            .foregroundStyle(check.passed ? Theme.accent : Color.secondary)
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
