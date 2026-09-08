import SwiftUI

/// The four answers, under one row of the feed, folded away until asked for.
///
/// **One line by default, and the four only when somebody says yes.** The
/// first build put four buttons under every row, and on a date page carrying a
/// hundred and fifty rows that is six hundred buttons. The same eight words
/// repeating down a screen stop being a question and become wallpaper. It also
/// changed what the page was: a feed you read turned into a form you fill in,
/// and the rows themselves, which are the product, ended up as labels between
/// controls. So the row asks once, quietly, in one line, and opens only for
/// the row somebody actually stopped on.
///
/// **One row is open at a time.** The expansion is held by the page rather
/// than by the row, so opening a second one closes the first. Two sets of four
/// on screen is most of the way back to the problem this fixes.
///
/// **Three answers, and no direction.** There is no way to say a thing did not
/// matter, only whether it reached you. A direction is a weapon, and an up and
/// down score on a killing is a brigading target inside a week.
///
/// "I was there" was the fourth and is gone from the app. It asks about
/// presence, and this feature measures transmission, which is a different
/// question: nobody was there for a diplomatic announcement and nobody was
/// there for a song being number one. `RememberDepth.offered` is the three,
/// and the case itself stays in the type because the website still offers it
/// and its answers still have to be read.
///
/// **Nothing is shown before you answer. The result is shown the instant you
/// do.** A count in front of a reader who has not answered tells them what the
/// popular answer is, and an answer given after reading that is agreement
/// rather than memory. A reader who has answered cannot be biased any more,
/// and showing them nothing was the mistake in the first version of this: a
/// page that takes an answer and says nothing back is a form. The result is
/// the payoff and it is the only thing here that anybody would screenshot.
///
/// **No points, no streaks, no badges, no reputation and no leaderboard.** An
/// answer earns nothing at all. The only pressure on it is that the date
/// closes and does not reopen until next year, which is why the page says when
/// that is.
///
/// **The register is flat on purpose.** Every date has at least one row that
/// would be grotesque with a celebration next to it: 41 percent of the events
/// imported from Wikipedia match the list in `Screening`, and September 4's
/// most recent one is a school shooting. So there is no colour, no fill and no
/// applause. It is a quiet control that reads the same under a killing as
/// under a number one single.
struct RememberRow: View {
    let subject: RememberSubject
    let month: Int
    let day: Int
    let palette: StagePalette
    /// The one row on the page that is showing its answers, by handle. Held
    /// above this view so that opening one closes any other.
    @Binding var expanded: String?

    @Environment(RememberService.self) private var remember
    @Environment(ProfileStore.self) private var profileStore

    /// The answer given in this session, so the row changes without waiting
    /// for anything else on the page to reload.
    @State private var justAnswered: RememberDepth?
    @State private var sending = false
    /// Whether the answer just given can still be taken back.
    ///
    /// Only ever true for an answer given in this session, which is exactly
    /// the case an undo is for: a misclick is noticed at once. An answer from
    /// a previous launch is older than the window by definition, so nothing
    /// needs storing and no clock needs reading. The database decides anyway.
    @State private var canUndo = false
    /// Said once, when the window has closed under somebody's finger.
    @State private var tooLate = false
    /// This row's own refusal, so one sealed row does not put the message
    /// under every other row on the page.
    @State private var refused = false

    private var answered: RememberDepth? {
        justAnswered ?? remember.answer(for: subject, month: month, day: day)
    }

    private var isOpen: Bool { remember.isOpen(month: month, day: day) }
    private var isExpanded: Bool { expanded == subject.key }

    var body: some View {
        // A row that is neither open nor answered nor counted draws nothing at
        // all, which is most rows on most dates, and it takes up no space when
        // it does.
        if let answered {
            given(answered)
        } else if refused {
            note(RememberCopy.sealed)
        } else if isOpen {
            asking
        } else if let counts = remember.tally(for: subject, month: month, day: day),
                  let summary = counts.summary() {
            // A sealed date the reader did not answer gets the one line
            // version. The full result on a hundred and fifty rows they took
            // no part in is the wallpaper problem again, and the breakdown is
            // meant to be what answering buys.
            note(summary)
        }
    }

    // MARK: Asking

    @ViewBuilder
    private var asking: some View {
        if isExpanded {
            buttons
        } else {
            prompt
        }
    }

    /// The whole of the row's furniture when it has not been touched: one
    /// line, quieter than the source link above it, at the size of a caption.
    private var prompt: some View {
        Button {
            withAnimation(.easeOut(duration: 0.18)) { expanded = subject.key }
        } label: {
            HStack(spacing: 5) {
                Text(RememberCopy.prompt)
                    .font(.system(size: 12, weight: .medium))
                Image(systemName: "chevron.down")
                    .font(.system(size: 8, weight: .bold))
            }
            .foregroundStyle(palette.type.opacity(0.38))
            // A tap target the height of a finger, on a line of text that is
            // deliberately small. The padding does the reaching so the type
            // does not have to.
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.top, 4)
        .accessibilityLabel(RememberCopy.prompt)
        .accessibilityHint("Opens four answers about how close this was to you.")
    }

    /// Two and then one, rather than three across.
    ///
    /// "Never heard of it" is half again as long as the other two, so three
    /// equal columns would shrink it to fit and a button whose words have been
    /// squeezed is a button nobody presses. On its own line it is full width
    /// and set at the same size as the others, which also happens to be right:
    /// it is the answer this whole thing is most interested in and the one a
    /// reader is least likely to volunteer.
    ///
    /// The three are named here rather than looped out of
    /// `RememberDepth.offered`, because two and then one is a hand set layout
    /// and a loop over three would only pretend it was not. `offered` is still
    /// the list of record, and a test pins it to exactly these three so that
    /// changing one without the other fails rather than silently drawing a
    /// different set of answers than the domain says it offers.
    private var buttons: some View {
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                button(.remember)
                button(.heard)
            }
            button(.never)
        }
        .padding(.top, 10)
        .disabled(sending)
        .opacity(sending ? 0.5 : 1)
        .transition(.opacity)
    }

    private func button(_ depth: RememberDepth) -> some View {
        Button {
            send(depth)
        } label: {
            Text(depth.label)
                .font(.system(size: 13, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.85)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .background(palette.type.opacity(0.06), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(palette.type.opacity(0.12), lineWidth: 0.75)
                )
        }
        .buttonStyle(.plain)
        .foregroundStyle(palette.type.opacity(0.75))
        .accessibilityLabel(depth.label)
        .accessibilityHint("Records how close this was to you. It cannot be changed once given.")
    }

    private func send(_ depth: RememberDepth) {
        guard !sending else { return }
        sending = true
        Task {
            let kept = await remember.send(
                depth,
                for: subject,
                month: month,
                day: day,
                birthYear: profileStore.profile?.birthday.year
            )
            sending = false
            // Either way this row is finished, so the page's one open slot
            // goes back to nobody rather than staying on a row that is now
            // showing a result.
            if expanded == subject.key { expanded = nil }
            if kept {
                justAnswered = depth
                canUndo = true
                // Half a minute, and then the offer goes quietly. The real
                // limit is in the database; this only stops the interface
                // offering something that would be refused.
                Task {
                    try? await Task.sleep(for: .seconds(30))
                    canUndo = false
                }
            } else {
                // Refused means the date sealed, the window moved, or this
                // phone has already answered this row. Saying so is better
                // than a button that does nothing, which reads as broken.
                refused = true
            }
        }
    }

    // MARK: Answered

    /// What you said, and what the date decided if it has decided anything.
    ///
    /// An answer cannot be taken back, which is the one piece of consequence
    /// in the whole feature. r/place had no points either. It had a cooldown
    /// and a canvas that locked.
    private func given(_ depth: RememberDepth) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "checkmark")
                    .font(.system(size: 10, weight: .bold))
                Text(depth.label)
                    .font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(palette.type.opacity(0.6))

            if let counts = remember.tally(for: subject, month: month, day: day) {
                result(counts, mine: depth)
            }

            if canUndo {
                undoButton(depth)
            } else if tooLate {
                Text(RememberCopy.tooLateToUndo)
                    .font(.system(size: 11))
                    .foregroundStyle(palette.type.opacity(0.33))
            }
        }
        .padding(.top, 10)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibleResult(depth))
    }

    /// The result: one thin bar per answer, the reader's own set solid.
    ///
    /// A bar rather than the sentence that was here before, because the
    /// sentence said which answer won and this says how the room split, and
    /// how the room split is the whole point. "Forty of forty three had never
    /// heard of it, and you are one of them" is a fact about a date that
    /// exists nowhere else, and a reader can see it in the shape without
    /// reading a number.
    ///
    /// Still no colour. Every date has at least one row where a coloured chart
    /// under a killing would be grotesque, so the reader's own answer is
    /// marked by weight rather than by hue.
    private func result(_ counts: RemembranceCounts, mine: RememberDepth) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            ForEach(counts.breakdown, id: \.depth) { slice in
                HStack(spacing: 8) {
                    Text(slice.depth.label)
                        .font(.system(size: 11, weight: slice.depth == mine ? .bold : .regular))
                        .foregroundStyle(palette.type.opacity(slice.depth == mine ? 0.7 : 0.42))
                        .frame(width: 104, alignment: .leading)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)

                    GeometryReader { space in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(palette.type.opacity(0.07))
                            Capsule()
                                .fill(palette.type.opacity(slice.depth == mine ? 0.45 : 0.2))
                                // A row with answers in it never draws as
                                // nothing, because a bar of zero width and a
                                // bar that failed to draw look identical.
                                .frame(width: max(slice.count > 0 ? 3 : 0,
                                                  space.size.width * slice.share))
                        }
                    }
                    .frame(height: 5)

                    Text(slice.count.formatted())
                        .font(.system(size: 11, weight: .semibold).monospacedDigit())
                        .foregroundStyle(palette.type.opacity(slice.depth == mine ? 0.7 : 0.42))
                        .frame(width: 26, alignment: .trailing)
                }
            }

            Text(RememberCopy.answers(counts.total))
                .font(.system(size: 11))
                .foregroundStyle(palette.type.opacity(0.33))
        }
    }

    /// Taking it back, for half a minute.
    ///
    /// Set as quietly as everything else on this row. An undo that shouts is
    /// an undo people press by accident, which is the problem it was added to
    /// solve, arriving from the other direction.
    private func undoButton(_ depth: RememberDepth) -> some View {
        Button {
            Task {
                let gone = await remember.forget(depth, for: subject, month: month, day: day)
                canUndo = false
                if gone {
                    justAnswered = nil
                    tooLate = false
                } else {
                    // The window closed while they were reaching for it, or
                    // the date sealed. Either way the answer stands and the
                    // row says so once rather than doing nothing.
                    tooLate = true
                }
            }
        } label: {
            Text(RememberCopy.undo)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(palette.type.opacity(0.45))
                .padding(.vertical, 4)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Undo this answer")
        .accessibilityHint("Available for half a minute after answering.")
    }

    /// The result as one sentence, for somebody who is not looking at it.
    private func accessibleResult(_ depth: RememberDepth) -> String {
        guard let counts = remember.tally(for: subject, month: month, day: day) else {
            return depth.spokenAfter
        }
        let split = counts.breakdown
            .map { "\($0.depth.label), \($0.count)" }
            .joined(separator: ". ")
        return "\(depth.spokenAfter) \(split). \(RememberCopy.answers(counts.total))."
    }

    private func note(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12))
            .foregroundStyle(palette.type.opacity(0.45))
            .padding(.top, 10)
    }
}
