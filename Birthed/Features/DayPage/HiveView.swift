import SwiftUI

/// The hive, at the top of the Today tab, above the one feed.
///
/// One square drawn from the anchors and sizes the server stored, zoomed to
/// its tiles the way the website zooms to them: the smallest square that
/// holds them, never under eight modules across, never over the board. Every
/// tile sits where the allocator put it and the phone only scales the
/// picture. Never a layout that reflows.
///
/// **Two controls on a tile.** The headline opens the receipt, because that
/// is what a headline does everywhere else, and a small button spends the
/// buzz. The first version of this on the website made the headline the vote
/// and the first person to use it could not find the receipt.
///
/// **A tile carries the reader's own age line** when the worker filed its
/// subject and the timeline drew it. A story on the hive is not repeated in
/// the feed below, so the line that would have been on its row is here. It is
/// the one thing this app has that the website does not, and it belongs on
/// the biggest thing on the screen.
///
/// Thin on purpose. The window, the words, the order and whose mark a mark is
/// all come from `Hive.swift` and `Wall.swift` in the domain, where they are
/// tested. This file draws.
struct HiveView: View {
    let date: CalendarDate
    let palette: StagePalette
    /// The reader's age for each subject the timeline drew, from
    /// `HiveFeed.ageLines`. Empty when the reader gave no birth year.
    var ageLines: [String: String] = [:]

    @Environment(WallService.self) private var wall

    @State private var selected: WallStory?
    @State private var submitting = false
    @State private var fullScreen = false

    private var voice: HiveVoice { wall.voice }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            heading
            if let day = wall.day {
                HiveBoard(day: day, date: date, ageLines: ageLines, onOpen: { selected = $0 })
                if !day.onHive.isEmpty {
                    fullScreenLink
                    legend
                }
                addButton
            } else if wall.failed {
                Text("The hive did not load.")
                    .font(.footnote)
                    .foregroundStyle(palette.type.opacity(0.5))
            } else {
                Text(HiveCopy.noHive)
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
        .sheet(isPresented: $fullScreen) {
            HiveFullScreenView(date: date, palette: palette, ageLines: ageLines)
        }
    }

    // MARK: Heading

    private var heading: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("THE HIVE")
                .font(.caption.weight(.heavy))
                .kerning(2.5)
                .foregroundStyle(HivePalette.amber)
            if let day = wall.day {
                let phase = day.phase(now: wall.now)
                Text(stateLine(day, phase: phase))
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(palette.type.opacity(0.6))
                if let left = wall.unitsLeft {
                    Text(HiveCopy.allowance(left, allowance: wall.allowance, phase: phase, voice: voice))
                        .font(.footnote)
                        .foregroundStyle(palette.type.opacity(0.45))
                        .contentTransition(.numericText())
                }
                Text(phase == .live
                     ? HiveCopy.lede(dateName: date.displayName(), voice: voice)
                     : HiveCopy.quietLede(dateName: date.displayName(), phase: phase, voice: voice))
                    .font(.footnote)
                    .foregroundStyle(palette.type.opacity(0.45))
            }
        }
    }

    private func stateLine(_ day: WallDay, phase: WallDay.Phase) -> String {
        let ending = WallBudget.dayAfter(day.wallDate).flatMap(\.calendarDate)?.displayName() ?? ""
        switch phase {
        case .closed: return "Sealed at midnight Eastern ending \(ending). Permanent."
        case .notYetOpen: return "Not open yet."
        case .submissionsOnly: return "Open for stories. \(voice.many.capitalizedFirst) start when the date arrives, Eastern time."
        case .live: return "Open. Seals at midnight Eastern ending \(ending), then permanent."
        }
    }

    // MARK: The rest of the section

    private var fullScreenLink: some View {
        Button {
            fullScreen = true
        } label: {
            HStack(spacing: 6) {
                Text(HiveCopy.openTheHive)
                    .font(.footnote.weight(.semibold))
                Image(systemName: "arrow.up.left.and.arrow.down.right")
                    .font(.system(size: 10, weight: .bold))
            }
            .foregroundStyle(HivePalette.amber)
        }
        .buttonStyle(.plain)
    }

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
            Text(HiveCopy.legend)
                .font(.caption2)
                .foregroundStyle(palette.type.opacity(0.5))
        }
    }

    /// Only while the date takes stories: the day before, the day and the day
    /// after. On a sealed date there is nothing to add and no button to say so.
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

// MARK: - The board

/// The square itself: the tiles, at the anchors and sizes the server stored,
/// inside the window the domain chose.
///
/// A view of its own rather than a method on `HiveView`, because the full
/// screen hive draws the same square and a method called on a view value
/// carries none of the environment the view would have had.
private struct HiveBoard: View {
    let day: WallDay
    let date: CalendarDate
    let ageLines: [String: String]
    let onOpen: (WallStory) -> Void

    @Environment(WallService.self) private var wall

    var body: some View {
        let tiles = WallBoard.tiles(day.stories)
        let view = WallBoard.viewport(forStories: day.stories)
        let phase = day.phase(now: wall.now)
        let voice = wall.voice
        GeometryReader { geometry in
            let side = geometry.size.width
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(HivePalette.board)
                ForEach(tiles) { story in
                    if let rect = story.rect {
                        let frame = WallBoard.frame(of: rect, in: view, side: side)
                        HiveTile(story: story,
                                 rect: rect,
                                 voice: voice,
                                 live: phase == .live,
                                 buzzed: wall.hasBuzzed(story),
                                 working: wall.isBuzzing(story),
                                 ageLine: HiveFeed.ageLine(for: story, lines: ageLines),
                                 onOpen: { onOpen(story) },
                                 onBuzz: { Task { await cast(story) } })
                            .frame(width: frame.width, height: frame.height)
                            .offset(x: frame.x, y: frame.y)
                    }
                }
                if tiles.isEmpty {
                    Text(HiveCopy.empty(phase: phase, voice: voice))
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Theme.cream.opacity(0.55))
                        .padding(22)
                        .frame(width: side, height: side)
                }
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("The hive, \(tiles.count) stories")
    }

    private func cast(_ story: WallStory) async {
        do {
            try await wall.buzz(story: story)
            await wall.load(date: date)
        } catch {
            // A tile is too small to explain anything, and the story is one
            // tap from the page that can. The service is holding the sentence.
            onOpen(story)
        }
    }
}

// MARK: - One tile

/// A tile: the headline, the reader's age when there is one, and a footer
/// carrying the control, the count and the outlet.
///
/// A stored rectangle too small for a headline is the whole tile as one link
/// to its receipt and takes no control. Those are rectangles from before the
/// allocator had a minimum size and they cannot grow, so they are drawn
/// honestly rather than crammed.
private struct HiveTile: View {
    let story: WallStory
    let rect: WallRect
    let voice: HiveVoice
    let live: Bool
    let buzzed: Bool
    let working: Bool
    let ageLine: String?
    let onOpen: () -> Void
    let onBuzz: () -> Void

    private var type: Color { HivePalette.type(story.tier) }
    private var count: String? { HiveCopy.count(story.support, voice: voice) }
    private var takes: Bool { live && story.status != .shownFalse }

    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(HivePalette.fill(story.tier))
            words
                .padding(4)
            if story.status == .shownFalse {
                VStack {
                    Spacer(minLength: 0)
                    Text("SHOWN FALSE")
                        .font(.system(size: 7, weight: .heavy))
                        .kerning(0.5)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 1)
                        .background(HivePalette.ink)
                        .foregroundStyle(HivePalette.pale)
                }
            }
        }
        .opacity(story.status == .shownFalse ? 0.55 : 1)
        .overlay {
            // The reader's own outline, on a story this install backed.
            if buzzed {
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .strokeBorder(HivePalette.markType(story.tier), lineWidth: 1.5)
            }
        }
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var words: some View {
        switch WallBoard.size(of: rect) {
        case .tiny, .small:
            Button(action: onOpen) {
                Group {
                    if WallBoard.size(of: rect) == .tiny {
                        Text(count ?? "")
                            .font(.system(size: 8, weight: .bold))
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        HStack(spacing: 3) {
                            Text(story.outlet).lineLimit(1).opacity(0.8)
                            if let count { Text(count).fontWeight(.bold) }
                        }
                        .font(.system(size: 8))
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                    }
                }
                .foregroundStyle(type)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(label + " Opens the receipt.")

        case .mid, .big:
            VStack(alignment: .leading, spacing: 2) {
                Button(action: onOpen) {
                    Text(story.headline)
                        .font(.system(size: WallBoard.size(of: rect) == .big ? 12 : 10,
                                      weight: .bold, design: .serif))
                        .lineLimit(WallBoard.size(of: rect) == .big ? 4 : 3)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .foregroundStyle(type)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(label + " Opens the receipt.")

                if let ageLine {
                    Text(ageLine.uppercased())
                        .font(.system(size: 7, weight: .heavy))
                        .kerning(0.6)
                        .lineLimit(1)
                        .foregroundStyle(type.opacity(0.7))
                }

                Spacer(minLength: 0)
                footer
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    /// The control first, then the count it changes, then the outlet. No tier
    /// chip: the tile's colour is its tier and the legend says so, and a chip
    /// beside the outlet was what pushed a phone tile down to one line of
    /// headline on the website.
    private var footer: some View {
        HStack(spacing: 5) {
            if buzzed {
                Text(voice.mark)
                    .font(.system(size: 8, weight: .heavy))
                    .lineLimit(1)
                    .foregroundStyle(HivePalette.markType(story.tier))
            } else if takes {
                Button(action: onBuzz) {
                    Text(voice.button)
                        .font(.system(size: 8, weight: .heavy))
                        .lineLimit(1)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(HivePalette.buttonFill(story.tier), in: Capsule())
                        .foregroundStyle(HivePalette.buttonType(story.tier))
                }
                .buttonStyle(.plain)
                .disabled(working)
                .opacity(working ? 0.5 : 1)
                .accessibilityLabel("\(voice.button): \(story.headline)")
            }
            if let count {
                Text(count)
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(type)
                    .contentTransition(.numericText())
            }
            Text(story.outlet)
                .font(.system(size: 8))
                .lineLimit(1)
                .truncationMode(.tail)
                .foregroundStyle(type.opacity(0.8))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var label: String {
        var line = "\(story.headline). \(story.outlet). \(story.tier.label)."
        if let count { line += " \(count)." }
        if let ageLine { line += " \(ageLine)." }
        if buzzed { line += " \(voice.mark)." }
        if story.status == .shownFalse { line += " Later shown false." }
        return line
    }
}

// MARK: - The hive, full screen

/// The hive alone, as big as the window, with its count and its legend and
/// nothing else. The same page `/<date>/hive/` is on the website.
private struct HiveFullScreenView: View {
    let date: CalendarDate
    let palette: StagePalette
    let ageLines: [String: String]

    @Environment(WallService.self) private var wall
    @Environment(\.dismiss) private var dismiss

    @State private var selected: WallStory?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if let day = wall.day {
                        let phase = day.phase(now: wall.now)
                        if let left = wall.unitsLeft {
                            Text(HiveCopy.allowance(left, allowance: wall.allowance, phase: phase, voice: wall.voice))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(palette.type.opacity(0.6))
                                .contentTransition(.numericText())
                        }
                        HiveBoard(day: day, date: date, ageLines: ageLines, onOpen: { selected = $0 })
                        Text(HiveCopy.legend)
                            .font(.caption)
                            .foregroundStyle(palette.type.opacity(0.5))
                    } else {
                        Text(HiveCopy.noHive)
                            .font(.subheadline)
                            .foregroundStyle(palette.type.opacity(0.5))
                    }
                }
                .padding(16)
            }
            .background(Theme.canvas)
            .navigationTitle(date.displayName())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(item: $selected) { story in
                WallStoryView(storyID: story.id, date: date, palette: palette)
            }
        }
    }
}

/// The tier, as a chip. Never a verdict. It comes off the tiles, where the
/// colour does the work, and stays in the legend and on the receipt where
/// there is room for the word.
struct WallChip: View {
    let tier: WallTier

    var body: some View {
        Text(tier.label.uppercased())
            .font(.system(size: 9, weight: .bold))
            .kerning(0.4)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(HivePalette.fill(tier), in: Capsule())
            .foregroundStyle(HivePalette.type(tier))
    }
}
