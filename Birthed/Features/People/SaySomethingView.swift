import MessageUI
import SwiftUI

/// The composer that opens when somebody's birthday is today.
///
/// It opens with two sentences already in it, written by `BirthdayMessage`
/// from what the user typed about this person and nothing else. The user
/// changes whatever they like and sends it through Messages or the share
/// sheet. This view has no way to send anything on its own, makes no network
/// call, and shows nothing that was not already on the People tab.
///
/// The drafts are made once, when the sheet opens, and the chosen one is kept
/// in `text`. They are not remade when the person changes underneath, because
/// the user may have started editing.
///
/// There is more than one, and that is the September 6 change. `BirthdayMessage`
/// already picks a closing line from three per register and only one of them
/// ever reached the screen, so somebody who did not like "hope it is a good
/// one" had a large empty text box and a typing job. Now the same generator is
/// asked for every distinct draft it can make for this person and "Try another"
/// walks them. No network, no model, no cost, and nothing new leaves the phone,
/// which matters because the whole claim that the people list stays on the
/// phone rests on this screen never calling anything.
///
/// Three is what the generator holds today. Widening it is adding strings to
/// `BirthdayMessage.closings`, and this screen picks them up with no change.
struct SaySomethingView: View {
    let person: Person

    @Environment(\.dismiss) private var dismiss
    @State private var text: String
    @State private var messaging = false
    /// Which of `drafts` is on screen. Not the text itself, so that swapping
    /// and editing cannot disagree about what is showing.
    @State private var variant = 0
    @FocusState private var editing: Bool

    private let canUseMessages: Bool

    /// Every distinct opening this generator can produce for this person, in
    /// the order the seed produces them. Usually three. One for a public
    /// figure, whose line ignores the seed, which is why the control below
    /// never appears for one.
    private let drafts: [String]

    init(person: Person, now: Date = Date()) {
        self.person = person
        let calendar = BirthdayCalendar()
        let age = calendar.ageOnNextBirthday(person.birthday, from: now)
        let year = calendar.calendar.component(.year, from: now)
        // The seed picks the closing line and nothing else, so walking it
        // collects the whole set. Eight passes rather than three, so that
        // adding a fourth closing to `BirthdayMessage` needs no change here,
        // and distinct only, so a generator that ignores the seed for
        // somebody yields one draft rather than eight copies of it.
        let base = BirthdayMessage.seed(year: year, person: person)
        var collected: [String] = []
        for offset in 0..<8 {
            guard let draft = BirthdayMessage.draft(
                for: person,
                age: age,
                dateName: person.birthday.date.displayName(),
                seed: base + offset
            ) else { continue }
            if !collected.contains(draft) { collected.append(draft) }
        }
        drafts = collected
        _text = State(initialValue: collected.first ?? "")
        // A public figure cannot be texted, so the only way out is the share
        // sheet, whoever the user turns out to want to send it to.
        canUseMessages = !person.isPublicFigure && MFMessageComposeViewController.canSendText()
    }

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// Whether what is on screen is still the draft this screen wrote.
    ///
    /// Read from the text rather than held in a flag, so deleting an edit back
    /// to the original brings the control back, which is what somebody who
    /// changed their mind would expect.
    private var isUnedited: Bool {
        drafts.indices.contains(variant) && text == drafts[variant]
    }

    /// Offered only while the words are still ours. Once the user has typed
    /// anything, their sentence outranks our next suggestion, and a control
    /// that would silently throw it away should not be on the screen. There is
    /// nothing to confirm and nothing to warn about, because the control is
    /// simply not there.
    private var canSwap: Bool { drafts.count > 1 && isUnedited }

    private func nextDraft() {
        guard canSwap else { return }
        variant = (variant + 1) % drafts.count
        text = drafts[variant]
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text(person.isRemembered ? "REMEMBERING" : "TODAY")
                    .font(.caption2.weight(.heavy))
                    .kerning(2)
                    .foregroundStyle(Theme.accent)

                // The message is the whole screen. Tap anywhere in it to
                // change it; there is no separate edit mode and nothing to
                // confirm, because every state of this text is a valid one.
                TextEditor(text: $text)
                    .font(.system(.title3, design: .default))
                    .scrollContentBackground(.hidden)
                    .focused($editing)
                    // A TextEditor takes every point it is offered, and the
                    // Spacer below collapses to nothing giving them to it, so
                    // `minHeight` alone bounded nothing: one sentence sat at
                    // the top of a grey box filling half the phone. The
                    // ceiling is what makes the layout below it real. A long
                    // message scrolls inside, which is ordinary.
                    .frame(minHeight: 140, maxHeight: 240)
                    .padding(14)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                // The footnote and the swap share a line, so the control
                // costs no vertical space and reads as a note about the
                // draft rather than as a second action competing with Send.
                //
                // A button here rather than the sentence itself, which is the
                // opposite of the rule the Mine panel follows. The reason is
                // that this sentence lives in a `TextEditor`: tapping it has
                // to put a caret in it, so the text cannot also be the swap.
                // Where a control has to exist, it is small, it sits beside
                // the thing it changes, and it disappears when it would do
                // harm.
                HStack(alignment: .top, spacing: 12) {
                    Text(person.isPublicFigure
                         ? "Something to send to a friend. Nothing is shared until you share it."
                         : "Written on your phone from your own note about them. Nothing is sent until you send it.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    Spacer(minLength: 0)

                    if canSwap {
                        Button(action: nextDraft) {
                            Label("Try another", systemImage: "arrow.triangle.2.circlepath")
                                .font(.footnote.weight(.semibold))
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(Theme.accent)
                        .fixedSize()
                        .accessibilityHint("Replaces the message with another wording")
                    }
                }
                .animation(.easeInOut(duration: 0.2), value: canSwap)

                Spacer(minLength: 0)

                actions
            }
            .padding(20)
            .background(Theme.canvas)
            .navigationTitle(person.trimmedName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Not now") { dismiss() }
                }
                ToolbarItem(placement: .keyboard) {
                    Button("Done") { editing = false }
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            }
            .sensoryFeedback(.selection, trigger: variant)
            .sheet(isPresented: $messaging) {
                MessagesComposer(messageBody: trimmed) {
                    messaging = false
                    dismiss()
                }
                .ignoresSafeArea()
            }
        }
        .tint(Theme.accent)
    }

    /// Messages first when it is there, because that is where a birthday
    /// message goes nine times in ten; the share sheet beside it for the
    /// tenth. Nothing here has a recipient: Birthed does not know one and
    /// does not want to.
    @ViewBuilder
    private var actions: some View {
        HStack(spacing: 12) {
            if canUseMessages {
                Button {
                    editing = false
                    messaging = true
                } label: {
                    Label("Send in Messages", systemImage: "message.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .disabled(trimmed.isEmpty)

                ShareLink(item: trimmed) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.headline)
                        .padding(.vertical, 14)
                        .padding(.horizontal, 18)
                }
                .buttonStyle(.bordered)
                .disabled(trimmed.isEmpty)
            } else if person.isPublicFigure, let page = PersonLink.dayPage(for: person.birthday.date) {
                // A link rather than the sentence on its own.
                //
                // Sharing a bare String means the receiving app has a String
                // and nothing else, so AirDrop wrote it to a text file called
                // textF787F04C40E31.txt containing one line. That is the
                // whole of what a person got.
                //
                // The link is the day page, which carries no name because it
                // is about the date, so Messages draws the site's own card for
                // it and the receiver lands somewhere real instead of on a
                // file. The sentence rides along as the message, so nothing
                // the user wrote is lost.
                ShareLink(
                    item: page,
                    subject: Text(person.trimmedName),
                    message: Text(trimmed)
                ) {
                    Label("Share", systemImage: "square.and.arrow.up")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .disabled(trimmed.isEmpty)
            } else {
                // A friend on a device with no Messages. The sentence is the
                // whole payload here and a link to a date page would be a
                // strange thing to send somebody about their own birthday.
                ShareLink(item: trimmed) {
                    Label("Share", systemImage: "square.and.arrow.up")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .disabled(trimmed.isEmpty)
            }
        }
    }
}

/// The system Messages composer with the text already in it and no recipient.
///
/// `MFMessageComposeViewController` rather than an `sms:` address, because
/// the view controller is documented to accept a body and the address form is
/// not, and because it comes back with a result the sheet can close on.
private struct MessagesComposer: UIViewControllerRepresentable {
    /// Not called `body`. A representable is a `View`, and a stored property
    /// named `body` is taken as its `body` requirement, which a `String`
    /// cannot satisfy.
    let messageBody: String
    let onFinish: () -> Void

    func makeUIViewController(context: Context) -> MFMessageComposeViewController {
        let controller = MFMessageComposeViewController()
        controller.body = messageBody
        controller.messageComposeDelegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: MFMessageComposeViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    final class Coordinator: NSObject, @preconcurrency MFMessageComposeViewControllerDelegate {
        let onFinish: () -> Void

        init(onFinish: @escaping () -> Void) {
            self.onFinish = onFinish
        }

        func messageComposeViewController(
            _ controller: MFMessageComposeViewController,
            didFinishWith result: MessageComposeResult
        ) {
            // Sent or cancelled, the composer is done either way.
            //
            // A count of the sent ones is recorded and the message is not.
            // This is the only place in the app that can know, and messages
            // sent for every reminder delivered is the one ratio that says
            // whether this product works. No recipient, no words, no time, no
            // person leaves the phone: a number does. `Tally` has the whole of
            // what is counted and the privacy page lists it.
            if result == .sent { Tally.noteMessageSent() }
            onFinish()
        }
    }
}
