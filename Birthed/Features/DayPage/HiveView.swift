import SwiftUI
import Combine

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
/// **The board is the product, and the section above it is one question.**
/// The first drawing of this put thirteen blocks between the top of the
/// screen and the board: a kicker, a seal sentence, the allowance, a lede,
/// the question again, a bordered field, two lines of terms, a chip label
/// and the chips. Most of them said what another one said. What is left
/// above the board is the question and the line to answer it on. The
/// allowance is one quiet line under the board, beside the link to the full
/// screen hive. The seal clock and the cost are on the confirmation, which
/// is the moment they matter. The chips come when the field is focused, the
/// moment the keyboard hides the board and somebody with no answer needs
/// one. The kicker is gone: the board is a bounded dark field, a boundary
/// is a label, and the Mine panel already settled that one kicker above the
/// fold is the most a screen wants.
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
        VStack(alignment: .leading, spacing: 12) {
            if let day = wall.day {
                let phase = day.phase(now: wall.now)
                // The field first, and only while the date takes buzzes: its
                // whole purpose is to spend one, and on any other phase it
                // would find a story and have nothing to offer. On those
                // phases a line says what state the hive is in instead.
                if phase == .live {
                    HiveField(day: day, date: date, palette: palette,
                              onOpen: { selected = $0 }, onAdd: { submitting = true })
                } else {
                    quietHeading(day, phase: phase)
                }
                HiveBoard(day: day, date: date, ageLines: ageLines, onOpen: { selected = $0 })
                if !day.onHive.isEmpty {
                    underTheBoard(phase: phase)
                    // No key on a one tier board, the same as the website:
                    // three chips explaining one colour is noise.
                    if Set(day.onHive.map(\.tier)).count > 1 {
                        legend
                    }
                }
                anniversary
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

    // MARK: The anniversary, docs/the-wall.md section 15

    /// What this install backed on this day in earlier years.
    ///
    /// A memory, shown to the one person who made it, and never a number.
    /// Sections 6 and 8 refuse every score and this is not one: there is no
    /// count on it, no rank, no total, and nothing about anybody else. It is
    /// the last thing under the hive rather than the first thing on the
    /// screen, because it is about a date that is over and the screen is
    /// about one that is not.
    ///
    /// It reads what is on the phone and asks the network nothing. The tap
    /// opens the receipt, which is still there: a story keeps its own page
    /// after a newer hive takes the date.
    @ViewBuilder
    private var anniversary: some View {
        let notes = wall.anniversaries
        if !notes.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text(HiveCopy.anniversaryHead.uppercased())
                    .font(.caption.weight(.heavy))
                    .kerning(2.0)
                    .foregroundStyle(palette.accent)
                Text(HiveCopy.anniversaryNote)
                    .font(.caption2)
                    .foregroundStyle(palette.type.opacity(0.45))
                // Not a link, and that is a difference from the website,
                // named rather than left to be found. The website links to
                // the receipt because that page is a file that is still on
                // disk years later. Here `WallStoryView` resolves a story out
                // of the day that is loaded, which is this year's, so a story
                // from an earlier year would draw "no longer filed for this
                // date", and its buzz control reads this year's clock and
                // would offer a button on a hive that sealed a year ago. What
                // it needs is a read for one story by identifier and a
                // receipt that knows the story's own date decides whether it
                // takes a buzz. Until then this says what the reader backed
                // and does not pretend to be a door.
                ForEach(notes, id: \.wallDate) { note in
                    if let from = note.date, let to = wall.day?.wallDate {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(HiveCopy.anniversaryLine(from: from, to: to, voice: voice).uppercased())
                                .font(.system(size: 10, weight: .heavy))
                                .kerning(1.4)
                                .foregroundStyle(palette.accent)
                            Text(note.headline)
                                .font(.system(size: 16, weight: .semibold, design: .serif))
                                .foregroundStyle(palette.type)
                                .multilineTextAlignment(.leading)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(11)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            .padding(.top, 6)
        }
    }

    // MARK: Above the board, when the field is not there

    /// A sealed date, a date that has not opened, or a date taking stories
    /// but not yet buzzes. The field is absent on all three, so one line says
    /// what state the hive is in and one says what the board is. On a live
    /// date the field is the heading and this is not drawn.
    private func quietHeading(_ day: WallDay, phase: WallDay.Phase) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(HiveCopy.state(phase: phase, ending: sealName(day), voice: voice))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(palette.type.opacity(0.7))
            Text(HiveCopy.quietLede(dateName: date.displayName(), phase: phase, voice: voice))
                .font(.footnote)
                .foregroundStyle(palette.type.opacity(0.45))
        }
    }

    /// The name of the day the hive seals at the end of, for the sentence
    /// that says so.
    private func sealName(_ day: WallDay) -> String {
        WallBudget.dayAfter(day.wallDate).flatMap(\.calendarDate)?.displayName() ?? ""
    }

    // MARK: Under the board

    /// One row: the allowance on the left, the way into the full screen hive
    /// on the right. The allowance used to be the third line above the
    /// board; it belongs beside the thing it is spent on.
    private func underTheBoard(phase: WallDay.Phase) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            if phase == .live, let left = wall.unitsLeft {
                Text(HiveCopy.allowance(left, allowance: wall.allowance, phase: phase, voice: voice))
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(palette.type.opacity(0.6))
                    .contentTransition(.numericText())
            }
            Spacer(minLength: 8)
            fullScreenLink
        }
    }

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
            .foregroundStyle(palette.accent)
        }
        .buttonStyle(.plain)
    }

    /// The three tiers in one row, and under them the one sentence that says
    /// a colour is a tier and a tier is not a verdict. It was four lines, one
    /// per tier and one for the sentence; each tier's meaning is a tap away
    /// on any receipt, and the board wants the space more than the legend.
    private var legend: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                ForEach([WallTier.seenDirect, .reported, .claimed], id: \.rawValue) { tier in
                    WallChip(tier: tier)
                        // The meaning came off the screen and not off the
                        // reader who cannot see the colour.
                        .accessibilityLabel("\(tier.label): \(tier.meaning)")
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
/// Three parts and each does a job. The question and the line to answer it
/// on, with up to three chips under it while it is focused, drawn from the
/// top of the board, because a blank line with a cursor intimidates people
/// and the chips give somebody with no answer a way in. The result, which is
/// never silent: what was found, its outlet and its tier. And the
/// confirmation, which is not optional, because a buzz is scarce, permanent
/// and irreversible and nothing may be spent without it.
///
/// **It is a prompt, not a form.** No panel, no bold label, no bordered box,
/// no terms. The question is set in the page's own serif, the answer goes on
/// a rule under it, and Return asks. There is no Find button: the field is
/// the control and a button beside it would be a second control doing the
/// field's job, the rule the Mine panel's older than sentence was built
/// under. What typing costs, which is nothing, is said while the field is
/// focused, and what a buzz costs is said on the confirmation, which is the
/// only place one can be spent from.
///
/// **The chips come with the keyboard.** When the field is focused the
/// keyboard covers the board, and the board was the other way in. So the
/// three biggest things on the board follow the reader up to the field, at
/// full length, one under another, and go away when the keyboard does. At
/// rest the board is the list of things to buzz and does not need a second
/// list above it.
///
/// A miss is not an error. It says so plainly and offers the link flow, so
/// the field is the front door to submission rather than requiring a
/// uniform resource locator in hand.
///
/// **A miss also offers "Find it for me", and that button is the one place
/// text leaves the phone.** Typing sends nothing and Return searches only
/// what is already loaded. The button says, before it is tapped, that it
/// sends the words and the date to a web search and nothing else. What
/// comes back is two or three real pages with the page's own title and a
/// quotation the function found on the page; a tap on one files it through
/// `WallService.submit`, the same path as a pasted link, and then shows the
/// filed story on the confirmation. Nothing is filed and nothing is spent
/// without that tap. The rules are `HiveFind` in the domain.
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
    @Environment(NotificationService.self) private var notifications
    @Environment(ProfileStore.self) private var profileStore
    @Environment(PeopleStore.self) private var peopleStore

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
    /// A second hand, running only while a buzz can still be taken back, so
    /// the Undo button on the confirmation comes down on its own. The same
    /// clock the board keeps, and for the same reason: SwiftUI redraws when
    /// what it reads changes, and it cannot read the time.
    @State private var tick = Date()
    /// Whether the keyboard is up for this field. The chips and the hint
    /// are drawn only then.
    @FocusState private var typing: Bool

    /// The web search, after a miss. `finding` while it runs, `found` once
    /// it answered, `filing` while a pick is being read by the submit path.
    /// All three are cleared when the words change, because an answer was
    /// for the words that were there.
    @State private var finding = false
    @State private var found: HiveFind.Outcome?
    @State private var filing: HiveFind.Candidate?
    @State private var findRefusal: String?

    private var voice: HiveVoice { wall.voice }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            field
            if let picked {
                confirmation(picked)
            } else if let asked {
                result(HiveSearch.answer(query: asked, in: day.stories))
            } else if typing {
                Text(HiveCopy.askHint(dateName: date.displayName(), voice: voice))
                    .font(.caption)
                    .foregroundStyle(palette.type.opacity(0.45))
                chips
            }
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { now in
            if wall.undoable != nil { tick = now }
        }
        .onChange(of: query) { _, _ in
            // The answer on screen was for the words that were there. Once
            // they change it is for nothing, and the chips come back until
            // the reader asks again. A story already picked is left alone.
            if picked == nil {
                asked = nil
                found = nil
                findRefusal = nil
            }
        }
    }

    // MARK: The field

    /// The question, in the page's own face, and a rule to answer it on.
    /// The rule is the field's whole boundary: it brightens to amber while
    /// the reader is writing on it and fades when they are not.
    private var field: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(HiveCopy.ask(dateName: date.displayName()))
                .font(.system(.title3, design: .serif, weight: .semibold))
                .foregroundStyle(palette.type)
                .fixedSize(horizontal: false, vertical: true)
            TextField(HiveCopy.askPlaceholder, text: $query)
                .textFieldStyle(.plain)
                .font(.body)
                .foregroundStyle(palette.type)
                // Names and places are what gets typed here, and
                // autocorrect rewrites those into words it knows.
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($typing)
                .onSubmit { ask() }
                .padding(.vertical, 8)
            Rectangle()
                .fill(typing ? HivePalette.amber : palette.type.opacity(0.25))
                .frame(height: 1)
                .animation(.easeOut(duration: 0.15), value: typing)
        }
        .accessibilityElement(children: .contain)
    }

    /// Return asks. An empty line asks nothing: the Find button used to be
    /// disabled on empty text and this is the same rule without the button.
    private func ask() {
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        picked = nil
        spent = false
        refusal = nil
        found = nil
        findRefusal = nil
        asked = query
    }

    // MARK: The chips

    /// Up to three, one under another, each headline at its full length.
    /// The first drawing put them in a sideways scroll that cut every one of
    /// them off mid-word at the screen edge and gave no sign it scrolled.
    /// Either a chip fits or it is not a chip, and they are only drawn while
    /// the keyboard is hiding the board, so they have the room.
    @ViewBuilder
    private var chips: some View {
        let top = HiveSearch.chips(from: day.stories)
        if !top.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text(HiveCopy.orStartFrom)
                    .font(.caption)
                    .foregroundStyle(palette.type.opacity(0.45))
                ForEach(top) { story in
                    Button {
                        pick(story)
                    } label: {
                        Text(story.headline)
                            .font(.caption.weight(.semibold))
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(HivePalette.fill(story.tier), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .foregroundStyle(HivePalette.type(story.tier))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(story.headline). \(story.outlet). \(story.tier.label).")
                }
            }
        }
    }

    /// A pick puts the keyboard away: the confirmation is the next thing to
    /// read and the keyboard would be covering the board under it.
    private func pick(_ story: WallStory) {
        spent = false
        refusal = nil
        picked = story
        typing = false
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
                if HiveFind.offers(answer) {
                    findSection
                }
                Button(action: onAdd) {
                    HStack(spacing: 8) {
                        Image(systemName: "link")
                        Text(HiveCopy.addWithLink)
                            .font(.subheadline.weight(.semibold))
                    }
                }
                .buttonStyle(.plain)
                .foregroundStyle(palette.accent)
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
                            .foregroundStyle(palette.accent)
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

    // MARK: Find it for me

    /// The request the button would send, or nil when there is nothing
    /// worth sending. The button is drawn only when this is not nil, so a
    /// query of stop words never reaches a web search either.
    private var findRequest: HiveFind.Request? {
        guard let asked else { return nil }
        return HiveFind.request(query: asked, wallDate: day.wallDate)
    }

    /// Under the miss: the button and its sentence, the wait, the answer,
    /// or the refusal. One of these at a time.
    @ViewBuilder
    private var findSection: some View {
        if let filing {
            HStack(spacing: 8) {
                ProgressView().controlSize(.small)
                Text("\(HiveCopy.findFiling): \(filing.title)")
                    .font(.footnote)
                    .foregroundStyle(palette.type.opacity(0.6))
                    .lineLimit(2)
            }
        } else if finding {
            HStack(spacing: 8) {
                ProgressView().controlSize(.small)
                Text(HiveCopy.finding)
                    .font(.footnote)
                    .foregroundStyle(palette.type.opacity(0.6))
            }
        } else if let found {
            findResult(found)
        } else if findRequest != nil {
            if let findRefusal {
                Text(findRefusal)
                    .font(.footnote)
                    .foregroundStyle(palette.type.opacity(0.6))
            }
            findButton
            Text(HiveCopy.findWillSearch(dateName: date.displayName()))
                .font(.caption)
                .foregroundStyle(palette.type.opacity(0.45))
        }
    }

    /// The one control that sends text off the phone. It says so in the
    /// sentence under it, and it is never tapped by anything but a finger.
    private var findButton: some View {
        Button {
            Task { await find() }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                Text(HiveCopy.findForMe)
                    .font(.subheadline.weight(.semibold))
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(palette.accent)
        .disabled(finding || filing != nil)
        .accessibilityHint(HiveCopy.findWillSearch(dateName: date.displayName()))
    }

    private func find() async {
        guard !finding, filing == nil, let request = findRequest else { return }
        finding = true
        findRefusal = nil
        found = nil
        defer { finding = false }
        do {
            found = try await wall.find(request)
        } catch {
            findRefusal = wall.lastRefusal ?? error.localizedDescription
        }
    }

    @ViewBuilder
    private func findResult(_ outcome: HiveFind.Outcome) -> some View {
        switch outcome {
        case let .found(candidates):
            VStack(alignment: .leading, spacing: 8) {
                Text(HiveCopy.findFound(voice: voice))
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(palette.type.opacity(0.6))
                ForEach(candidates) { candidate in
                    candidateRow(candidate)
                }
                if let findRefusal {
                    Text(findRefusal)
                        .font(.footnote)
                        .foregroundStyle(palette.type.opacity(0.6))
                }
            }
        case .nothing:
            Text(HiveCopy.findNothing(dateName: date.displayName()))
                .font(.footnote)
                .foregroundStyle(palette.type.opacity(0.6))
        case .paused:
            Text(HiveCopy.findPaused)
                .font(.footnote)
                .foregroundStyle(palette.type.opacity(0.6))
        case .failed:
            Text(HiveCopy.findFailed)
                .font(.footnote)
                .foregroundStyle(palette.type.opacity(0.6))
            findButton
        }
    }

    /// One page the search found: its own title, its outlet, and the
    /// quotation the function found on it. A tap files it; the headline the
    /// hive shows is read off the page by the submit path, not from here.
    private func candidateRow(_ candidate: HiveFind.Candidate) -> some View {
        Button {
            Task { await file(candidate) }
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text(candidate.title)
                    .font(.system(size: 15, weight: .semibold, design: .serif))
                    .foregroundStyle(palette.type)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Text(candidate.outlet)
                    .font(.caption)
                    .foregroundStyle(palette.type.opacity(0.55))
                Text(candidate.quotation)
                    .font(.system(.caption, design: .serif))
                    .italic()
                    .foregroundStyle(palette.type.opacity(0.7))
                    .multilineTextAlignment(.leading)
                    .lineLimit(3)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(filing != nil)
        .accessibilityLabel("\(candidate.title). \(candidate.outlet).")
        .accessibilityHint(HiveCopy.findPickHint(voice: voice))
    }

    /// The pick, through the ordinary submit path. A page already on the
    /// date is that story and is shown for confirmation without a write.
    /// Otherwise the server reads the page, takes its own headline and
    /// quotation, and the story it hands back goes to the confirmation,
    /// where the receipt is one tap away and a buzz can be cast or not.
    private func file(_ candidate: HiveFind.Candidate) async {
        guard filing == nil, !finding else { return }
        if let story = HiveFind.filed(candidate, in: day.stories) {
            found = nil
            pick(story)
            return
        }
        filing = candidate
        findRefusal = nil
        defer { filing = nil }
        do {
            let preview = try await wall.submit(url: candidate.url, wallDate: day.wallDate)
            await wall.load(date: date)
            found = nil
            pick(wall.story(preview.story.id) ?? preview.story)
        } catch {
            findRefusal = wall.lastRefusal ?? error.localizedDescription
        }
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
                .foregroundStyle(palette.accent)

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
                // The terms, here and not over an empty field: that a buzz
                // cannot be taken back and when the hive seals. A warning
                // about a cost shown before the reader has done anything
                // made an easy thing feel heavy.
                Text(HiveCopy.terms(ending: sealName, voice: voice))
                    .font(.caption2)
                    .foregroundStyle(palette.type.opacity(0.5))
            }

            if spent {
                Text(HiveCopy.counted)
                    .font(.footnote)
                    .foregroundStyle(palette.type.opacity(0.6))
                // The same window the tile gets, on the surface a buzz from
                // the feed or the typed field is actually cast from. This is
                // the app's "That counts", so it is where the way back out
                // belongs. docs/the-wall.md, the last entry in section 16.
                if wall.canUndo(story, now: tick) {
                    Button(action: { Task { await takeBack(story) } }) {
                        Text(HiveCopy.undo)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(palette.accent)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 7)
                            .overlay(Capsule().strokeBorder(HivePalette.amber.opacity(0.6), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(working)
                    .accessibilityHint(HiveCopy.undoWindow)
                    Text(HiveCopy.undoWindow)
                        .font(.caption2)
                        .foregroundStyle(palette.type.opacity(0.5))
                } else if let line = wall.lastUndo {
                    Text(line)
                        .font(.footnote)
                        .foregroundStyle(palette.type.opacity(0.6))
                }
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
                    .foregroundStyle(palette.accent)
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    /// The name of the day the hive seals at the end of, for the terms.
    private var sealName: String {
        WallBudget.dayAfter(day.wallDate).flatMap(\.calendarDate)?.displayName() ?? ""
    }

    /// Takes the buzz back, inside its thirty second window. The database
    /// decides; every word it can answer with is a sentence the confirmation
    /// already has room for, and the button comes down either way.
    private func takeBack(_ story: WallStory) async {
        guard !working else { return }
        working = true
        defer { working = false }
        do {
            try await wall.undo(story: story)
            tick = Date()
            await wall.load(date: date)
            await registerSealReminders(notifications, profileStore, peopleStore)
        } catch {
            refusal = wall.lastRefusal ?? error.localizedDescription
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
            tick = Date()
            await wall.load(date: date)
            await registerSealReminders(notifications, profileStore, peopleStore)
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
    @Environment(NotificationService.self) private var notifications
    @Environment(ProfileStore.self) private var profileStore
    @Environment(PeopleStore.self) private var peopleStore

    /// A second hand, running only while a buzz can still be taken back.
    ///
    /// SwiftUI redraws when something it reads changes, and the thing that
    /// changes here is the time, which it cannot read. So the window needs a
    /// clock or the Undo button would sit on the tile until something else
    /// happened to redraw the board, which on a quiet screen is never. The
    /// timer runs only while there is a window open, so an idle hive costs
    /// nothing.
    @State private var tick = Date()

    var body: some View {
        let tiles = WallBoard.tiles(day.stories)
        let view = WallBoard.viewport(forStories: day.stories)
        // A tile's heat is its buzzes against the most buzzed tile, the
        // website's --heat. Nought on a board nobody has buzzed.
        let hottest = Double(tiles.map(\.support).max() ?? 0)
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
                                 // The window on the tile that was just
                                 // tapped, and on no other tile. It is
                                 // recomputed on the tick below, which is
                                 // what takes the button down when the
                                 // thirty seconds are up.
                                 undoable: wall.canUndo(story, now: tick),
                                 ageLine: HiveFeed.ageLine(for: story, lines: ageLines),
                                 heat: hottest > 0 ? Double(story.support) / hottest : 0,
                                 picture: story.pictureKey.flatMap { wall.pictures[$0]?.url },
                                 onOpen: { onOpen(story) },
                                 onBuzz: { Task { await cast(story) } },
                                 onUndo: { Task { await takeBack(story) } })
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
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { now in
            // Only while a window is open. Assigning the same value would
            // redraw the board every second for nothing.
            if wall.undoable != nil { tick = now }
        }
    }

    private func cast(_ story: WallStory) async {
        do {
            try await wall.buzz(story: story)
            tick = Date()
            await wall.load(date: date)
            await registerSealReminders(notifications, profileStore, peopleStore)
        } catch {
            // A tile is too small to explain anything, and the story is one
            // tap from the page that can. The service is holding the sentence.
            onOpen(story)
        }
    }

    /// Takes the buzz back. A refusal is not worth a sheet: the word from the
    /// database means the buzz stands, the button comes down either way, and
    /// the reader can open the story to read what happened to it.
    private func takeBack(_ story: WallStory) async {
        do {
            try await wall.undo(story: story)
            tick = Date()
            await wall.load(date: date)
            await registerSealReminders(notifications, profileStore, peopleStore)
        } catch {
            onOpen(story)
        }
    }
}

// MARK: - One tile

/// A tile: the headline, the reader's age when there is one, and a footer
/// carrying the control, the count and the outlet.
///
/// **Nothing on a tile is cut off mid-word except the headline.** The first
/// drawing had "22 YEARS BEFORE Y..." and "en.wikipedia...." on tiles
/// eighty points wide. A line that does not fit is not drawn: the age line
/// is offered on a big tile only, and `ViewThatFits` drops it when even a
/// big tile is too narrow for it; the footer offers itself with the outlet,
/// then without it, then as the control alone. The headline is the one
/// thing that must appear and it ends in an ellipsis when the rectangle is
/// smaller than the sentence, the same way it does on the website, and the
/// whole of it is one tap away on the receipt.
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
    /// This buzz is still inside its thirty second window, so the footer
    /// offers to take it back instead of showing the mark.
    let undoable: Bool
    let ageLine: String?
    /// Nought to one: this tile's buzzes against the most buzzed tile.
    let heat: Double
    /// The event's lead picture, when the project holds one.
    let picture: URL?
    let onOpen: () -> Void
    let onBuzz: () -> Void
    let onUndo: () -> Void

    private var type: Color { HivePalette.cellType }
    private var corner: CGFloat { 5 }
    private var count: String? { HiveCopy.count(story.support, voice: voice) }
    private var takes: Bool { live && story.status != .shownFalse }

    /// The website's live tile: a dark cell with a hairline edge, a stripe
    /// for the tier, cream type, and a warm glow that grows with the tile's
    /// share of the buzzes. The reader's own tile is outlined in honey.
    var body: some View {
        let shape = RoundedRectangle(cornerRadius: corner, style: .continuous)
        ZStack(alignment: .topLeading) {
            // The picture is an overlay on the cell rather than a layer of its
            // own, so a filled image can never make the tile bigger than the
            // frame the board gave it.
            shape
                .fill(HivePalette.cell)
                .overlay {
                    if let picture {
                        TilePicture(url: picture)
                    }
                }
            if heat > 0 {
                shape
                    .strokeBorder(HivePalette.heat.opacity(0.55 * heat), lineWidth: 5)
                    .blur(radius: 4)
                    .allowsHitTesting(false)
            }
            if let stripe = HivePalette.stripe(story.tier) {
                Rectangle()
                    .fill(stripe)
                    .frame(height: 2)
                    .allowsHitTesting(false)
            }
            words
                .padding(5)
            if story.status == .shownFalse {
                VStack {
                    Spacer(minLength: 0)
                    Text("SHOWN FALSE")
                        .font(.system(size: 7, weight: .heavy))
                        .kerning(0.5)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 1)
                        .background(Theme.emberDeep)
                        .foregroundStyle(HivePalette.buzzInk)
                }
            }
        }
        .clipShape(shape)
        .opacity(story.status == .shownFalse ? 0.55 : 1)
        .overlay {
            shape.strokeBorder(buzzed ? HivePalette.cellMark : HivePalette.cellEdge,
                               lineWidth: buzzed ? 1.5 : 0.75)
        }
        .shadow(color: HivePalette.heat.opacity(0.30 * heat), radius: 6 * heat)
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
                        smallWords
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

                // The reader's age, on a big tile, when the tile is wide
                // enough for the whole line. A mid tile is four things in
                // sixty points and something had to give; the age line is
                // the one thing this app has that nothing else does, so it
                // stays where there is room for it rather than coming off.
                // `ViewThatFits` measures the line at its full width and
                // takes the empty fallback when it would have had to cut
                // the line. The fallback is a zero-size clear view rather
                // than `EmptyView`, because an `EmptyView` contributes no
                // child to choose.
                if let ageLine, WallBoard.size(of: rect) == .big {
                    ViewThatFits(in: .horizontal) {
                        Text(ageLine.uppercased())
                            .font(.system(size: 7, weight: .heavy))
                            .kerning(0.4)
                            .lineLimit(1)
                            .foregroundStyle(type.opacity(0.7))
                        Color.clear.frame(width: 0, height: 0)
                    }
                }

                Spacer(minLength: 0)
                footer
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    /// A small tile is about fifty points square on a phone. It used to show
    /// only its outlet, so a board of them read "en.wikip..." forty times.
    /// The website puts the headline there, and so does this: two lines and
    /// the control when the tile is tall enough, three lines alone when not.
    private var smallWords: some View {
        ViewThatFits(in: .vertical) {
            VStack(alignment: .leading, spacing: 2) {
                smallHeadline(lines: 2)
                Spacer(minLength: 0)
                HStack(spacing: 4) {
                    control
                    countText
                }
            }
            smallHeadline(lines: 3)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func smallHeadline(lines: Int) -> some View {
        Text(story.headline)
            .font(.system(size: 8.5, weight: .bold, design: .serif))
            .lineLimit(lines)
            .multilineTextAlignment(.leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .foregroundStyle(type)
    }

    /// The control first, then the count it changes, then the outlet. No tier
    /// chip: the tile's colour is its tier and the legend says so, and a chip
    /// beside the outlet was what pushed a phone tile down to one line of
    /// headline on the website.
    ///
    /// Three shapes, widest first, and the first that fits is drawn: with
    /// the outlet, without it, and the control alone. None of the three has
    /// a `maxWidth` of its own, on purpose: a child that stretches to the
    /// proposed width always fits and `ViewThatFits` would never look past
    /// it. The stretch is applied to the chosen one, outside.
    private var footer: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 5) {
                control
                countText
                outletText
            }
            HStack(spacing: 5) {
                control
                countText
            }
            control
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var control: some View {
        if undoable {
            // For thirty seconds after a buzz lands, the tile offers the way
            // back out instead of the mark. docs/the-wall.md, the last entry
            // in section 16: it is a window for a misclick, so it is on the
            // tile that was just tapped and it goes when the window does. An
            // outline rather than a filled capsule, because the buzz is the
            // thing this board wants pressed and the undo is the thing that
            // should be findable and never inviting.
            Button(action: onUndo) {
                Text(HiveCopy.undo)
                    .font(.system(size: 8, weight: .heavy))
                    .lineLimit(1)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .overlay(Capsule().strokeBorder(HivePalette.cellMark, lineWidth: 1))
                    .foregroundStyle(HivePalette.cellMark)
            }
            .buttonStyle(.plain)
            .disabled(working)
            .opacity(working ? 0.5 : 1)
            .accessibilityLabel("\(HiveCopy.undo) that \(voice.one): \(story.headline)")
            .accessibilityHint(HiveCopy.undoWindow)
        } else if buzzed {
            Text(voice.mark)
                .font(.system(size: 8, weight: .heavy))
                .lineLimit(1)
                .foregroundStyle(HivePalette.cellMark)
        } else if takes {
            Button(action: onBuzz) {
                Text(voice.button)
                    .font(.system(size: 8, weight: .heavy))
                    .lineLimit(1)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background(
                        LinearGradient(colors: [HivePalette.buzzTop, HivePalette.buzzBottom],
                                       startPoint: .top, endPoint: .bottom),
                        in: Capsule()
                    )
                    .foregroundStyle(HivePalette.buzzInk)
            }
            .buttonStyle(.plain)
            .disabled(working)
            .opacity(working ? 0.5 : 1)
            .accessibilityLabel("\(voice.button): \(story.headline)")
        }
    }

    @ViewBuilder
    private var countText: some View {
        if let count {
            Text(count)
                .font(.system(size: 8, weight: .bold))
                .lineLimit(1)
                .foregroundStyle(HivePalette.cellMark)
                .contentTransition(.numericText())
        }
    }

    private var outletText: some View {
        Text(story.outlet)
            .font(.system(size: 8))
            .lineLimit(1)
            .foregroundStyle(HivePalette.cellDim)
    }

    private var label: String {
        var line = "\(story.headline). \(story.outlet). \(story.tier.label)."
        if let count { line += " \(count)." }
        if let ageLine { line += " \(ageLine)." }
        if buzzed { line += " \(voice.mark)." }
        if undoable { line += " \(HiveCopy.undoWindow)" }
        if story.status == .shownFalse { line += " Later shown false." }
        return line
    }
}

// MARK: - A tile's picture

/// The lead picture under a tile's words, the website's `.wcell::before`: the
/// picture at nine tenths, darkened towards the bottom where the words are,
/// so cream type holds on any photograph. Nothing is drawn until it arrives
/// and nothing replaces it if it never does; the cell is the fallback.
private struct TilePicture: View {
    let url: URL

    var body: some View {
        AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.25))) { phase in
            if let image = phase.image {
                ZStack {
                    image
                        .resizable()
                        .scaledToFill()
                        .opacity(0.9)
                    LinearGradient(
                        colors: [HivePalette.cell.opacity(0.35), HivePalette.cell.opacity(0.88)],
                        startPoint: .top, endPoint: .bottom
                    )
                }
                .transition(.opacity)
            } else {
                Color.clear
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

// MARK: - The hive, full screen

/// The hive alone, as the website's live page draws it: the dark ground in
/// both appearances, the date and its question over the board, and the board
/// itself twice the width of the phone so a tile has room for its headline
/// and its button. The reader pans across it; one button fits it back to the
/// screen. The same page `/<date>/hive/` is on the website.
///
/// It used to be the inline board again on a light sheet, the same size, so
/// opening it gave the reader nothing the Today tab had not.
private struct HiveFullScreenView: View {
    let date: CalendarDate
    /// The palette of the screen it was opened from. Not used here: this page
    /// is dark whatever the phone's appearance, so it reads `stage` instead.
    let palette: StagePalette
    let ageLines: [String: String]

    @Environment(WallService.self) private var wall
    @Environment(\.dismiss) private var dismiss

    @State private var selected: WallStory?
    /// Twice the screen, so a small tile is about a hundred points and draws
    /// its headline with its button. Off fits the board to the width.
    @State private var zoomed = true

    private let stage = StagePalette.ink

    var body: some View {
        NavigationStack {
            GeometryReader { outer in
                let fit = max(0, outer.size.width - 32)
                let side = zoomed ? max(fit * 2, 640) : fit
                let axes: Axis.Set = zoomed ? [.horizontal, .vertical] : .vertical
                VStack(alignment: .leading, spacing: 10) {
                    heading
                        .padding(.horizontal, 16)
                    if let day = wall.day {
                        ScrollView(axes) {
                            HiveBoard(day: day, date: date, ageLines: ageLines, onOpen: { selected = $0 })
                                .frame(width: side, height: side)
                                .padding(16)
                        }
                        .scrollIndicators(.hidden)
                        Text(HiveCopy.legend)
                            .font(.caption)
                            .foregroundStyle(stage.type.opacity(0.5))
                            .padding(.horizontal, 16)
                            .padding(.bottom, 8)
                    } else {
                        Text(HiveCopy.noHive)
                            .font(.subheadline)
                            .foregroundStyle(stage.type.opacity(0.5))
                            .padding(.horizontal, 16)
                        Spacer(minLength: 0)
                    }
                }
            }
            .background(HivePalette.board.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(HivePalette.board, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        withAnimation(.snappy) { zoomed.toggle() }
                    } label: {
                        Image(systemName: zoomed ? "arrow.down.right.and.arrow.up.left"
                                                 : "arrow.up.left.and.arrow.down.right")
                    }
                    .accessibilityLabel(zoomed ? "Fit the hive to the screen" : "Make the hive bigger")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(item: $selected) { story in
                WallStoryView(storyID: story.id, date: date, palette: stage)
            }
        }
        .preferredColorScheme(.dark)
    }

    /// "September 22. What will still matter?", the website's live heading,
    /// with the allowance and the one line of what the hive is for under it.
    @ViewBuilder
    private var heading: some View {
        let dateText = Text("\(date.displayName()).").foregroundStyle(stage.type)
        let question = Text(HiveCopy.question).italic().foregroundStyle(stage.accent)
        VStack(alignment: .leading, spacing: 6) {
            Text("\(dateText) \(question)")
                .font(.system(size: 28, weight: .heavy, design: .serif))
                .fixedSize(horizontal: false, vertical: true)
            if let day = wall.day {
                let phase = day.phase(now: wall.now)
                Text(phase == .live
                     ? HiveCopy.lede(dateName: date.displayName(), voice: wall.voice)
                     : HiveCopy.quietLede(dateName: date.displayName(), phase: phase, voice: wall.voice))
                    .font(.footnote)
                    .foregroundStyle(HivePalette.cellDim)
                    .fixedSize(horizontal: false, vertical: true)
                if let left = wall.unitsLeft {
                    Text(HiveCopy.allowance(left, allowance: wall.allowance, phase: phase, voice: wall.voice))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(stage.type.opacity(0.8))
                        .contentTransition(.numericText())
                }
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

// MARK: - Registering the morning after

/// Rebuilds the reminder schedule after a buzz lands or is taken back.
///
/// docs/the-wall.md section 15: the reminder is scheduled at buzz time from
/// what the phone already knows, because at fire time there is no network and
/// there should not need to be. `RootView` rebuilds the schedule on every
/// foreground, but that happens before a buzz rather than after one, so a
/// reader who buzzes and then puts the phone down for two days would have
/// nothing pending when the hive sealed. A reminder that was never registered
/// does not announce itself. It simply never arrives.
///
/// Its own free function rather than a method on either view, because two
/// views in this file cast a buzz and both need it. `WallService` has already
/// written the note by the time this is called; `NotificationService` reads it
/// from the shared store.
///
/// The people list is handed over in full, and that is not incidental.
/// `reschedule` clears every pending reminder and rebuilds the plan from what
/// it is given, so calling it with an empty list would delete every birthday
/// reminder on the phone in order to add one about a hive. The people are the
/// promise this app makes; the hive is a layer on top of it.
@MainActor
func registerSealReminders(
    _ notifications: NotificationService,
    _ profileStore: ProfileStore,
    _ peopleStore: PeopleStore
) async {
    guard let profile = profileStore.profile else { return }
    await notifications.reschedule(birthday: profile.birthday, people: peopleStore.people)
}
