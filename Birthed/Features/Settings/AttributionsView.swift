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
                        licenceLink: URL(string: "https://creativecommons.org/publicdomain/zero/1.0/")!
                    )

                    source(
                        name: "Wikipedia",
                        what: "The order people appear in, from how often each article is read.",
                        licence: "Article text is not used in this version.",
                        link: URL(string: "https://www.wikipedia.org")!,
                        licenceLink: URL(string: "https://creativecommons.org/licenses/by-sa/4.0/")!
                    )

                    Text("Birthed is not affiliated with Wikipedia, Wikidata or the Wikimedia Foundation.")
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

    private func source(
        name: String, what: String, licence: String, link: URL, licenceLink: URL
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
                Link(name.lowercased() + ".org", destination: link)
                Link("Licence", destination: licenceLink)
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
