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
                // The field first, and only while the date takes buzzes: its
                // whole purpose is to spend one, and on any other phase it
                // would find a story and have nothing to offer.
                if day.phase(now: wall.now) == .live {
                    HiveField(day: day, date: date, palette: palette,
                              onOpen: { selected = $0 }, onAdd: { submitting = true })
                }
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
                    Text(HiveCopy.addWithLink)
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

// MARK: - The field

/// The typed field, docs/the-wall.md section 15: ask what mattered about the
/// date and find it among the stories already filed, instead of asking the
/// reader to shop a list of two hundred headlines.
///
/// Three parts and each does a job. The field, with up to three chips under
/// it drawn from the top of the board, because a blank box with a cursor
/// intimidates people and the chips give somebody with no answer a way in.
/// The result, which is never silent: what was found, its outlet and its
/// tier. And the confirmation, which is not optional, because a buzz is
/// scarce, permanent and irreversible and nothing may be spent without it.
///
/// A miss is not an error. It says so plainly and offers the link flow, so
/// the field is the front door to submission rather than requiring a
/// uniform resource locator in hand.
///
/// The matching, the chips, the ranking and every sentence are
/// `HiveSearch` and `HiveCopy` in the domain, where they are tested against
/// real headlines. This draws, and it holds the one rule a view has to hold:
/// the buzz is cast only from the confirmation.
private struct HiveField: View {
    let day: WallDay
    let date: CalendarDate
    let palette: StagePalette
    let onOpen: (WallStory) -> Void
    let onAdd: () -> Void

    @Environment(WallService.self) private var wall

    @State private var query = ""
    /// The query the reader actually asked, as distinct from what is in the
    /// field. The answer follows this rather than every keystroke, so a
    /// miss is said once the reader has finished saying the thing and not
    /// halfway through a word.
    @State private var asked: String?
    /// The story awaiting confirmation. Set by a tap on a result or a chip,
    /// never by the search itself.
    @State private var picked: WallStory?
    @State private var working = false
    @State private var spent = false
    @State private var refusal: String?

    private var voice: HiveVoice { wall.voice }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            field
            if let picked {
                confirmation(picked)
            } else if let asked {
                result(HiveSearch.answer(query: asked, in: day.stories))
            } else {
                chips
            }
        }
        .padding(14)
        .background(palette.type.opacity(0.05), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .onChange(of: query) { _, _ in
            // The answer on screen was for the words that were there. Once
            // they change it is for nothing, and the chips come back until
            // the reader asks again. A story already picked is left alone.
            if picked == nil { asked = nil }
        }
    }

    // MARK: The field

    private var field: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(HiveCopy.ask(dateName: date.displayName()))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(palette.type)
            HStack(spacing: 8) {
                TextField(HiveCopy.askPlaceholder, text: $query)
                    .textFieldStyle(.roundedBorder)
                    // Names and places are what gets typed here, and
                    // autocorrect rewrites those into words it knows.
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .onSubmit { ask() }
                Button {
                    ask()
                } label: {
                    Text(HiveCopy.find)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(HivePalette.ink)
                }
                .buttonStyle(.borderedProminent)
                .tint(HivePalette.amber)
                .disabled(query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            Text(HiveCopy.askHint(voice: voice))
                .font(.caption)
                .foregroundStyle(palette.type.opacity(0.45))
        }
    }

    private func ask() {
        picked = nil
        spent = false
        refusal = nil
        asked = query
    }

    // MARK: The chips

    @ViewBuilder
    private var chips: some View {
        let top = HiveSearch.chips(from: day.stories)
        if !top.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text(HiveCopy.orStartFrom)
                    .font(.caption)
                    .foregroundStyle(palette.type.opacity(0.45))
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(top) { story in
                            Button {
                                pick(story)
                            } label: {
                                Text(story.headline)
                                    .font(.caption.weight(.semibold))
                                    .lineLimit(1)
                                    .truncationMode(.tail)
                                    .frame(maxWidth: 220)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(HivePalette.fill(story.tier), in: Capsule())
                                    .foregroundStyle(HivePalette.type(story.tier))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(story.headline). \(story.outlet). \(story.tier.label).")
                        }
                    }
                }
            }
        }
    }

    private func pick(_ story: WallStory) {
        spent = false
        refusal = nil
        picked = story
    }

    // MARK: The result

    @ViewBuilder
    private func result(_ answer: HiveSearch.Answer) -> some View {
        switch answer {
        case .blank:
            Text(HiveCopy.tooCommon)
                .font(.footnote)
                .foregroundStyle(palette.type.opacity(0.6))
        case .miss:
            VStack(alignment: .leading, spacing: 8) {
                Text(HiveCopy.miss(dateName: date.displayName()))
                    .font(.footnote)
                    .foregroundStyle(palette.type.opacity(0.6))
                Button(action: onAdd) {
                    HStack(spacing: 8) {
                        Image(systemName: "link")
                        Text(HiveCopy.addWithLink)
                            .font(.subheadline.weight(.semibold))
                    }
                }
                .buttonStyle(.plain)
                .foregroundStyle(HivePalette.amber)
            }
        case let .one(match):
            VStack(alignment: .leading, spacing: 8) {
                Text(HiveCopy.found)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(palette.type.opacity(0.6))
                candidate(match.story)
            }
        case let .several(matches):
            VStack(alignment: .leading, spacing: 8) {
                Text(HiveCopy.severalFound)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(palette.type.opacity(0.6))
                ForEach(matches) { match in
                    candidate(match.story)
                }
            }
        }
    }

    /// One found story: the headline, the outlet and the tier, and the mark
    /// when this install already backed it. A tap picks it for confirmation
    /// and spends nothing.
    private func candidate(_ story: WallStory) -> some View {
        Button {
            pick(story)
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text(story.headline)
                    .font(.system(size: 15, weight: .semibold, design: .serif))
                    .foregroundStyle(palette.type)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 6) {
                    Text(story.outlet)
                    WallChip(tier: story.tier)
                    if wall.hasBuzzed(story) {
                        Text(voice.mark)
                            .fontWeight(.heavy)
                            .foregroundStyle(HivePalette.amber)
                    }
                }
                .font(.caption)
                .foregroundStyle(palette.type.opacity(0.55))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(story.headline). \(story.outlet). \(story.tier.label).")
        .accessibilityHint("Shows it for confirmation. Nothing is spent yet.")
    }

    // MARK: The confirmation

    /// The one place a buzz is cast from. The story, its outlet and its tier
    /// are shown back before anything is spent, the same three things the
    /// receipt shows, and the button says what it costs.
    private func confirmation(_ story: WallStory) -> some View {
        let live = wall.phase == .live
        let left = wall.unitsLeft ?? 0
        let buzzed = wall.hasBuzzed(story)
        let canBuzz = live && story.status != .shownFalse && left > 0 && !buzzed && !spent
        return VStack(alignment: .leading, spacing: 8) {
            Text(HiveCopy.confirm(voice: voice).uppercased())
                .font(.caption.weight(.heavy))
                .kerning(2.0)
                .foregroundStyle(HivePalette.amber)

            // The headline opens the receipt, the way it does everywhere
            // else, so a reader who wants the sources before spending has
            // them one tap away.
            Button {
                onOpen(story)
            } label: {
                Text(story.headline)
                    .font(.system(size: 17, weight: .semibold, design: .serif))
                    .foregroundStyle(palette.type)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the receipt: every source, every quotation, every check.")

            HStack(spacing: 6) {
                Text(story.outlet)
                WallChip(tier: story.tier)
            }
            .font(.caption)
            .foregroundStyle(palette.type.opacity(0.55))
            Text(story.tier.meaning)
                .font(.caption2)
                .foregroundStyle(palette.type.opacity(0.5))

            Text(story.status == .shownFalse
                 ? HiveCopy.takesNone(voice: voice)
                 : buzzed
                    ? HiveCopy.alreadyBacked(voice: voice)
                    : HiveCopy.allowance(left, allowance: wall.allowance, phase: wall.phase ?? .live, voice: voice))
                .font(.footnote.weight(canBuzz ? .regular : .semibold))
                .foregroundStyle(palette.type.opacity(0.6))
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
                .accessibilityLabel("\(voice.button): \(story.headline)")
                Text(HiveCopy.irreversible)
                    .font(.caption2)
                    .foregroundStyle(palette.type.opacity(0.5))
            }

            if spent {
                Text(HiveCopy.counted)
                    .font(.footnote)
                    .foregroundStyle(palette.type.opacity(0.6))
            }

            if let refusal {
                Text(refusal)
                    .font(.footnote)
                    .foregroundStyle(palette.type.opacity(0.6))
            }

            Button {
                picked = nil
                spent = false
                refusal = nil
            } label: {
                Text(HiveCopy.notThisOne)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(HivePalette.amber)
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
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
            // The service holds the sentence in the reader's terms, and the
            // error carries the same one; either is shown here rather than
            // sending the reader to the receipt to read it.
            refusal = wall.lastRefusal ?? error.localizedDescription
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
