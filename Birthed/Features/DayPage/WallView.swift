import SwiftUI

/// The wall, at the top of the Today tab, above the feed. docs/the-wall.md
/// section 2: the wall is the live layer, the feed underneath it is that
/// date's history.
///
/// One square, sixteen by sixteen modules, drawn from the anchors and sizes
/// the server stored. Every tile sits where the allocator put it, at the
/// size it gave it, and the phone only scales the picture. Never a layout
/// that reflows. Tapping a tile opens the story with its whole receipt.
///
/// Thin on purpose. Which dates are open, how many units are left, where a
/// tile goes and what the sentences say all come from `Wall.swift` in the
/// domain, where they are tested. This file draws.
struct WallView: View {
    let date: CalendarDate
    let palette: StagePalette

    @Environment(WallService.self) private var wall

    @State private var selected: WallStory?
    @State private var submitting = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            heading
            if let day = wall.day {
                square(day)
                legend
                if day.onWall.isEmpty {
                    Text(WallCopy.empty)
                        .font(.footnote)
                        .foregroundStyle(palette.type.opacity(0.5))
                }
                list("In the pool, not on the wall", note: WallCopy.poolNote, stories: day.inPool)
                list("Earned a place, found no room", note: WallCopy.overflowNote, stories: day.overflow)
                addButton
            } else if wall.failed {
                Text("The wall did not load.")
                    .font(.footnote)
                    .foregroundStyle(palette.type.opacity(0.5))
            } else {
                Text("No wall for this date yet.")
                    .font(.footnote)
                    .foregroundStyle(palette.type.opacity(0.5))
                addButton
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 22)
        .sheet(item: $selected) { story in
            WallStoryView(storyID: story.id, date: date, palette: palette)
        }
        .sheet(isPresented: $submitting) {
            WallSubmitView(date: date, palette: palette)
        }
    }

    // MARK: Heading

    private var heading: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("THE WALL")
                .font(.caption.weight(.heavy))
                .kerning(2.5)
                .foregroundStyle(Theme.accent)
            if let day = wall.day {
                Text(stateLine(day))
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(palette.type.opacity(0.6))
                if let left = wall.unitsLeft, let phase = wall.phase {
                    Text(WallCopy.unitsLeft(left, phase: phase))
                        .font(.footnote)
                        .foregroundStyle(palette.type.opacity(0.45))
                        .contentTransition(.numericText())
                }
            }
            Text(WallCopy.lede)
                .font(.footnote)
                .foregroundStyle(palette.type.opacity(0.45))
        }
    }

    private func stateLine(_ day: WallDay) -> String {
        let ending = WallBudget.dayAfter(day.wallDate).flatMap(\.calendarDate)?.displayName() ?? ""
        switch day.phase(now: wall.now) {
        case .closed: return "Closed at midnight Eastern ending \(ending). This wall is permanent."
        case .notYetOpen: return "Not open yet."
        case .submissionsOnly: return "Open for stories. Boosts start when the day arrives, Eastern time."
        case .live: return "Open. Closes at midnight Eastern ending \(ending), and is then permanent."
        }
    }

    // MARK: The square

    private func square(_ day: WallDay) -> some View {
        GeometryReader { geometry in
            let side = geometry.size.width
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Theme.ink)
                ForEach(WallBoard.tiles(day.stories)) { story in
                    if let rect = story.rect {
                        let frame = WallBoard.frame(of: rect, side: side)
                        tile(story, rect: rect)
                            .frame(width: frame.width, height: frame.height)
                            .offset(x: frame.x, y: frame.y)
                    }
                }
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("The wall, a square of \(day.onWall.count) stories")
    }

    private func tile(_ story: WallStory, rect: WallRect) -> some View {
        Button {
            selected = story
        } label: {
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .fill(fill(for: story.tier))
                tileWords(story, size: WallBoard.size(of: rect))
                    .padding(4)
                if story.status == .shownFalse {
                    VStack {
                        Spacer(minLength: 0)
                        Text("SHOWN FALSE")
                            .font(.system(size: 7, weight: .heavy))
                            .kerning(0.5)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 1)
                            .background(Theme.cream)
                            .foregroundStyle(Theme.ink)
                    }
                }
            }
            .opacity(story.status == .shownFalse ? 0.55 : 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(story.headline). \(story.outlet). \(story.tier.label), \(WallCopy.boosts(story.support))."
                            + (story.status == .shownFalse ? " Later shown false." : ""))
    }

    @ViewBuilder
    private func tileWords(_ story: WallStory, size: WallBoard.Size) -> some View {
        let ink = story.tier == .seenDirect ? Theme.ink : Theme.cream
        switch size {
        case .tiny:
            Text(String(story.support))
                .font(.system(size: 8, weight: .bold))
                .foregroundStyle(ink.opacity(0.85))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .small:
            HStack(spacing: 3) {
                Text(story.outlet).lineLimit(1).opacity(0.8)
                Text(String(story.support)).fontWeight(.bold)
            }
            .font(.system(size: 8))
            .foregroundStyle(ink)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        case .mid, .big:
            VStack(alignment: .leading, spacing: 2) {
                Text(story.headline)
                    .font(.system(size: size == .big ? 12 : 10, weight: .bold, design: .serif))
                    .lineLimit(size == .big ? 4 : 3)
                Spacer(minLength: 0)
                Text("\(story.outlet)  \(WallCopy.boosts(story.support))")
                    .font(.system(size: 8))
                    .lineLimit(1)
                    .opacity(0.85)
            }
            .foregroundStyle(ink)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    private func fill(for tier: WallTier) -> Color {
        switch tier {
        case .claimed: return Theme.waxLight
        case .reported: return Theme.accent
        case .seenDirect: return Theme.accentSoft
        }
    }

    // MARK: Legend and lists

    private var legend: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach([WallTier.seenDirect, .reported, .claimed], id: \.rawValue) { tier in
                HStack(spacing: 6) {
                    WallChip(tier: tier)
                    Text(tier.meaning)
                        .font(.caption2)
                        .foregroundStyle(palette.type.opacity(0.5))
                }
            }
            Text(WallCopy.tierNote)
                .font(.caption2)
                .foregroundStyle(palette.type.opacity(0.5))
        }
    }

    @ViewBuilder
    private func list(_ title: String, note: String, stories: [WallStory]) -> some View {
        if !stories.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.system(.subheadline, design: .serif, weight: .heavy))
                    .padding(.top, 8)
                Text(note)
                    .font(.caption2)
                    .foregroundStyle(palette.type.opacity(0.5))
                ForEach(stories) { story in
                    Button {
                        selected = story
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(story.headline)
                                .font(.subheadline.weight(.semibold))
                                .multilineTextAlignment(.leading)
                            HStack(spacing: 6) {
                                Text(story.outlet)
                                WallChip(tier: story.tier)
                                Text(WallCopy.boosts(story.support))
                            }
                            .font(.caption2)
                            .foregroundStyle(palette.type.opacity(0.55))
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                        .background(palette.type.opacity(0.05), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(palette.type)
                }
            }
        }
    }

    /// Only while the date takes stories: the day before, the day and the day
    /// after. On a closed date there is nothing to add and no button to say so.
    @ViewBuilder
    private var addButton: some View {
        let phase = wall.phase ?? (WallClock.openWall(for: date, now: wall.now) == nil ? .closed : .submissionsOnly)
        if phase == .live || phase == .submissionsOnly {
            Button {
                submitting = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "link")
                    Text("Add a story with a link")
                        .font(.subheadline.weight(.semibold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(palette.type.opacity(0.05), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
            .foregroundStyle(palette.type)
            .padding(.top, 6)
        }
    }
}

/// The tier, as a chip. Never a verdict.
struct WallChip: View {
    let tier: WallTier

    var body: some View {
        Text(tier.label.uppercased())
            .font(.system(size: 9, weight: .bold))
            .kerning(0.4)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(background, in: Capsule())
            .foregroundStyle(foreground)
    }

    private var background: Color {
        switch tier {
        case .claimed: return Theme.waxLight
        case .reported: return Theme.accent
        case .seenDirect: return Theme.accentSoft
        }
    }

    private var foreground: Color {
        tier == .seenDirect ? Theme.ink : Theme.cream
    }
}
