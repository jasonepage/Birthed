import SwiftUI

/// Getting other people's birthdays in, without typing them one at a time.
///
/// The People tab is the only thing in this product that gives somebody a
/// reason to open it in a month that is not their own, and it only works when
/// it has people in it. One name at a time is where that dies, so there are
/// two ways in and neither of them asks for a permission or sends anything to
/// a server.
///
/// Paste is for the list that already exists. Every friend group has one
/// somewhere, in a pinned message or a shared note, and it is never in a tidy
/// format. `BirthdayText` reads it and this screen shows what it read next to
/// the line it read it from, because a reader can only check what they can see.
///
/// The link is for the birthdays that do not exist anywhere yet. It carries a
/// date in the part of an address that browsers never send, so nothing about
/// anybody reaches birthed.app, and it carries no name at all, because this
/// app does not ask people their names and whoever adds you was going to
/// label you their own way regardless.
struct AddFriendsView: View {
    @Environment(ProfileStore.self) private var profileStore
    @Environment(BirthdayInbox.self) private var inbox
    @Environment(\.dismiss) private var dismiss

    let onAdd: ([Person]) -> Void

    /// What the asker calls themselves on the link, so the page can say who is
    /// asking. Never stored and never sent to the account: it lives in the
    /// address bar of one link and nowhere else.
    @State private var askingAs = ""
    @State private var askLink: URL?
    @State private var makingLink = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    // The same box that is now the front door of an empty
                    // People tab, written once in `PasteImport`. This sheet is
                    // where somebody comes back to it once the list is no
                    // longer empty, and where the two link mechanisms live.
                    PasteImport { people in
                        onAdd(people)
                        dismiss()
                    }
                    askForTheirs
                    myLink
                }
                .padding(20)
            }
            .background(Theme.canvas)
            .navigationTitle("Add friends")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .tint(Theme.accent)
    }

    // MARK: Asking for theirs

    /// The other direction, and the one people actually need.
    ///
    /// Sending your own birthday assumes somebody wants it. Asking for theirs
    /// is the thing you do when you have four birthdays and want twenty, and
    /// until now it needed the other person to fill in a form, get a link
    /// back, and send that link on. Two of those three steps are where people
    /// stop. This link ends at a send button.
    ///
    /// The cost is the one honest compromise in this product: their answer
    /// waits on our server until this phone collects it. It is a queue holding
    /// a name and a date, it is emptied the moment the phone has it, and the
    /// privacy page says so in those words rather than burying it.
    private var askForTheirs: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("OR ASK FOR THEIRS")
                .font(.caption.weight(.heavy))
                .kerning(2.5)
                .foregroundStyle(Theme.accent)

            Text("Send this to anybody. They fill in their birthday and press send, and it turns up here the next time you open Birthed. They do not need the app.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            TextField("Your name, so they know who is asking", text: $askingAs)
                .textFieldStyle(.plain)
                .autocorrectionDisabled()
                .padding(12)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

            if let askLink {
                ShareLink(item: askLink) {
                    Label("Send the request", systemImage: "square.and.arrow.up")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 18)
                        .padding(.vertical, 12)
                        .background(Theme.accent, in: Capsule())
                        .foregroundStyle(Theme.onAccent)
                }
            } else {
                Button {
                    Task {
                        makingLink = true
                        askLink = await inbox.link(from: askingAs)
                        makingLink = false
                    }
                } label: {
                    HStack(spacing: 8) {
                        if makingLink { ProgressView().tint(Theme.onAccent) }
                        Text(makingLink ? "Making it" : "Make a request link")
                            .font(.subheadline.weight(.semibold))
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                    .background(Theme.accent, in: Capsule())
                    .foregroundStyle(Theme.onAccent)
                }
                .disabled(makingLink)
            }

            Text("Their answer passes through our server and is deleted as soon as your phone has it.")
                .font(.caption)
                .foregroundStyle(.tertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: The link

    @ViewBuilder
    private var myLink: some View {
        if let profile = profileStore.profile,
           let url = PersonLink.url(forMyBirthday: profile.birthday) {
            VStack(alignment: .leading, spacing: 10) {
                Text("OR SEND YOURS")
                    .font(.caption.weight(.heavy))
                    .kerning(2.5)
                    .foregroundStyle(Theme.accent)

                Text("Drop this in the group chat. Anyone who taps it can add your birthday, and add theirs back the same way. It carries the date and nothing else, not even your name.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                ShareLink(item: url) {
                    Label("Share my birthday link", systemImage: "square.and.arrow.up")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 18)
                        .padding(.vertical, 12)
                        .background(Theme.accent, in: Capsule())
                        .foregroundStyle(Theme.onAccent)
                }
            }
        }
    }
}

/// A birthday that arrived, wrapped so a sheet can be presented from it.
///
/// Two ways in and one sheet. A tapped link carries no `replyID`, because
/// there is nothing on a server to tidy up afterwards. One collected from the
/// inbox carries the row it came from, so that whatever the reader decides,
/// the copy sitting on our server stops existing.
struct ArrivingBirthday: Identifiable {
    let id = UUID()
    let incoming: PersonLink.Incoming
    var replyID: Int? = nil
}

/// Somebody's birthday came in from a link. Confirm who they are and keep it.
///
/// The name field is empty when the link carried no name, which is the normal
/// case for somebody sharing their own, and that is the right way round: you
/// file people under what you call them.
struct IncomingBirthdaySheet: View {
    let incoming: PersonLink.Incoming
    /// Replaces the middle line when the birthday was answered into a request
    /// rather than shared out of the blue. "Somebody shared this with you" is
    /// wrong for something you asked for and they took the trouble to send.
    var note: String?
    let onAdd: (Person) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @FocusState private var naming: Bool

    private var trimmed: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                CandleMark(height: 120)
                    .frame(height: 120)

                Text(incoming.birthday.date.displayName())
                    .font(.system(size: 40, weight: .black, design: .serif))
                    .lineLimit(2)
                    .minimumScaleFactor(0.6)
                    .multilineTextAlignment(.center)

                Text(note ?? "Somebody shared this birthday with you. What do you call them?")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    // Never compressed. This sheet is a medium detent with a
                    // candle, a large date and a field in it, and when the
                    // stack runs out of room the sentence with no line limit
                    // is the thing the layout gives up on: the first real one
                    // to arrive read "Jason sent you their birthday. What
                    // do..." and stopped. A question that is cut off before
                    // the question mark is worse than no question.
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 30)

                TextField("Their name", text: $name)
                    .textFieldStyle(.plain)
                    .font(.title3)
                    .multilineTextAlignment(.center)
                    .focused($naming)
                    .padding(14)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .padding(.horizontal, 20)

                Spacer(minLength: 0)
            }
            .padding(.top, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.canvas)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Not now") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        onAdd(Person(name: trimmed, birthday: incoming.birthday))
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .disabled(trimmed.isEmpty)
                }
            }
            .onAppear {
                name = incoming.name ?? ""
                naming = incoming.name == nil
            }
        }
        .tint(Theme.accent)
        .presentationDetents([.medium])
    }
}
