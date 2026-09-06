import SwiftUI

/// `FR-027` and `NFR-061`. Names the sources and states the license each is
/// used under.
///
/// Rewritten shorter. The first version was four paragraphs of licence prose in
/// a grouped list, which is the correct information presented as badly as
/// possible. Nobody reads a wall of terms; they want to know where this came
/// from and whether it is legitimate.
struct AttributionsView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    source(
                        name: "Wikidata",
                        what: "Every name, year and description.",
                        licence: "Creative Commons Zero, a public domain dedication.",
                        link: URL(string: "https://www.wikidata.org")!,
                        linkLabel: "wikidata.org",
                        licenceLink: URL(string: "https://creativecommons.org/publicdomain/zero/1.0/")!
                    )

                    source(
                        name: "Wikipedia",
                        what: "The order people appear in, from how often each article is read, and the number one song, album and film for every chart week.",
                        licence: "Creative Commons Attribution ShareAlike. Every chart week carries the page it was read from.",
                        link: URL(string: "https://www.wikipedia.org")!,
                        linkLabel: "wikipedia.org",
                        licenceLink: URL(string: "https://creativecommons.org/licenses/by-sa/4.0/")!
                    )

                    source(
                        name: "Google Gemini",
                        what: "The things found about the day you were born. A model that searches the web is asked about a date and a place, never about you, and every fact it returns shows the page it came from.",
                        licence: "Facts are not owned by anyone. The page under each one is credited on the fact itself.",
                        link: URL(string: "https://ai.google.dev")!,
                        linkLabel: "ai.google.dev",
                        licenceLink: URL(string: "https://birthed.app/privacy/")!,
                        licenceLabel: "How this works"
                    )

                    Text("Birthed is not affiliated with Wikipedia, Wikidata, the Wikimedia Foundation or Google.")
                        .font(.footnote)
                        .foregroundStyle(.tertiary)
                        .padding(.top, 4)
                }
                .padding(20)
            }
            .background(Theme.canvas)
            .navigationTitle("Sources")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    /// The link label is given rather than derived, because deriving it from
    /// the name worked only while every source was named after its own domain.
    private func source(
        name: String,
        what: String,
        licence: String,
        link: URL,
        linkLabel: String,
        licenceLink: URL,
        licenceLabel: String = "Licence"
    ) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(name)
                .font(Theme.display(.title2, weight: .bold))

            Text(what)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Text(licence)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            HStack(spacing: 18) {
                Link(linkLabel, destination: link)
                Link(licenceLabel, destination: licenceLink)
            }
            .font(.footnote.weight(.semibold))
            .padding(.top, 3)
        }
        .birthedCard(padding: 18)
    }
}

#Preview {
    AttributionsView()
}
