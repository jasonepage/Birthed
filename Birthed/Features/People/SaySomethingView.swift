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
/// The draft is made once, when the sheet opens, and kept in `text`. It is
/// not remade when the person changes underneath, because the user may have
/// started editing.
struct SaySomethingView: View {
    let person: Person

    @Environment(\.dismiss) private var dismiss
    @State private var text: String
    @State private var messaging = false
    @FocusState private var editing: Bool

    private let canUseMessages: Bool

    init(person: Person, now: Date = Date()) {
        self.person = person
        let calendar = BirthdayCalendar()
        let age = calendar.ageOnNextBirthday(person.birthday, from: now)
        let year = calendar.calendar.component(.year, from: now)
        let draft = BirthdayMessage.draft(
            for: person,
            age: age,
            dateName: person.birthday.date.displayName(),
            seed: BirthdayMessage.seed(year: year, person: person)
        )
        _text = State(initialValue: draft ?? "")
        // A public figure cannot be texted, so the only way out is the share
        // sheet, whoever the user turns out to want to send it to.
        canUseMessages = !person.isPublicFigure && MFMessageComposeViewController.canSendText()
    }

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

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
                    .frame(minHeight: 140)
                    .padding(14)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                Text(person.isPublicFigure
                     ? "Something to send to a friend. Nothing is shared until you share it."
                     : "Written on your phone from your own note about them. Nothing is sent until you send it.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

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
            } else {
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
            // Sent or cancelled, the composer is done either way. Whether the
            // text went is between the user and Messages, and Birthed does not
            // record it.
            onFinish()
        }
    }
}
