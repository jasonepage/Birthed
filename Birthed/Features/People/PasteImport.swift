import SwiftUI

/// The paste box, written once and shown in two places.
///
/// This is the front door of an empty People tab and it is also the top of the
/// "Add friends" sheet, which is why it is a view of its own rather than a
/// section inside either of them. Two copies of a box that reads names out of
/// untidy text would be two things to keep in step, and the last thing this
/// repository needed was another pair of files that are meant to agree.
///
/// The design comes from watching what ReciMe actually does. Its trick is not
/// the parser, it is that the content already exists somewhere else and
/// getting it in feels like nothing. Everybody's friend group has the list in
/// a pinned message or a shared note. So the fastest possible path is: copy
/// that message, open Birthed, one tap. That tap is the paste control, and it
/// is deliberately the first thing on the screen.
///
/// The paste control rather than reading the clipboard directly. Reading it in
/// code raises the system's own permission alert and then a banner saying
/// Birthed pasted from Messages, which is two interruptions to do the thing
/// the reader came to do. The control has no prompt and no banner, because the
/// tap on it is the permission. Typing into the box still works for anybody
/// who would rather.
///
/// Nothing here is sent anywhere. `BirthdayText` runs on the phone, and the
/// privacy page's claim that the people list stays on the phone depends on
/// that staying true.
struct PasteImport: View {
    /// Off on the People tab, where the screen's own words already said what
    /// this is, and on inside the sheet, where it is one section among others.
    ///
    /// Declared before the closure so that the closure can be written as a
    /// trailing one at both call sites.
    var showsHeading = true

    /// The people the reader kept. The host decides what happens next, which
    /// is adding them to the store on the People tab, and adding them and then
    /// closing on the sheet.
    let onAdd: ([Person]) -> Void

    @State private var pasted = ""
    @State private var skipped: Set<Int> = []

    private var candidates: [BirthdayText.Candidate] {
        BirthdayText.candidates(in: pasted)
    }

    private var chosen: [BirthdayText.Candidate] {
        candidates.filter { !skipped.contains($0.id) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if showsHeading {
                Text("PASTE A LIST")
                    .font(.caption.weight(.heavy))
                    .kerning(2.5)
                    .foregroundStyle(Theme.accent)

                Text("A group chat message, a shared note, anything with names and dates in it. It is read on your phone and nothing is sent anywhere.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Above the box, not beside it. This is the whole point of the
            // screen and it has to be the thing the eye lands on.
            PasteButton(payloadType: String.self) { strings in
                guard let text = strings.first, !text.isEmpty else { return }
                pasted = pasted.isEmpty ? text : pasted + "\n" + text
            }
            .buttonBorderShape(.capsule)
            .tint(Theme.accent)

            box

            if !candidates.isEmpty {
                found
                addButton
            }
        }
    }

    private var box: some View {
        TextEditor(text: $pasted)
            .font(.body)
            .scrollContentBackground(.hidden)
            .frame(minHeight: 120)
            .padding(10)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(alignment: .topLeading) {
                if pasted.isEmpty {
                    Text("Sam 3/14\nPriya - March 14\nAlex: 14 March 2003")
                        .font(.body)
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal, 15)
                        .padding(.vertical, 18)
                        .allowsHitTesting(false)
                }
            }
    }

    /// What was read, next to what it was read from. The row is the control:
    /// tap one to leave it out, tap it again to put it back. A reader can only
    /// check what they can see, so the line each reading came from is on it.
    private var found: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("\(candidates.count) FOUND")
                .font(.caption.weight(.heavy))
                .kerning(2.5)
                .foregroundStyle(Theme.accent)

            ForEach(candidates) { candidate in
                let keeping = !skipped.contains(candidate.id)
                Button {
                    if keeping { skipped.insert(candidate.id) } else { skipped.remove(candidate.id) }
                } label: {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: keeping ? "checkmark.circle.fill" : "circle")
                            .font(.title3)
                            .foregroundStyle(keeping ? Theme.accent : Color.secondary)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(candidate.name)
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text(readingOf(candidate))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Text(candidate.line)
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .opacity(keeping ? 1 : 0.5)
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// Under the names rather than up in a toolbar. The button confirms the
    /// list, so it belongs at the end of the list. In the sheet it used to sit
    /// in the top corner, a thumb's width from nothing it referred to.
    @ViewBuilder
    private var addButton: some View {
        if chosen.isEmpty {
            Text("Tap a name to leave it out. Tap it again to put it back.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        } else {
            Button {
                onAdd(chosen.map { Person(name: $0.name, birthday: $0.birthday) })
                pasted = ""
                skipped = []
            } label: {
                Text(chosen.count == 1 ? "Add 1 person" : "Add \(chosen.count) people")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Theme.accent, in: Capsule())
                    .foregroundStyle(Theme.cream)
            }
            .buttonStyle(.plain)
        }
    }

    private func readingOf(_ candidate: BirthdayText.Candidate) -> String {
        let date = candidate.birthday.date.displayName()
        guard let year = candidate.birthday.year else { return date }
        return "\(date), \(String(year))"
    }
}
