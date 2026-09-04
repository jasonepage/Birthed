import SwiftUI

/// FR-027 and NFR-061. Names the sources, states the license each is used
/// under, and links to the license text.
///
/// Version 1.0 displays Wikidata statements only, which are released under a
/// public domain dedication that compels no attribution. Wikipedia is credited
/// anyway, because crediting the source is the right thing to do whether or
/// not a license requires it. `SDS.md` section 8.1.
struct AttributionsView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Wikidata") {
                    Text("Names, birth dates, death dates and the one line description on every entry come from Wikidata.")
                    Text("Wikidata statements are released under Creative Commons Zero, a public domain dedication.")
                        .foregroundStyle(.secondary)
                    Link("wikidata.org", destination: URL(string: "https://www.wikidata.org")!)
                    Link("Creative Commons Zero 1.0", destination: URL(string: "https://creativecommons.org/publicdomain/zero/1.0/")!)
                }

                Section("Wikipedia") {
                    Text("The notability ordering counts how many Wikipedia language editions cover a person. Wikipedia article text is not used in this version.")
                    Text("Wikipedia text is licensed Creative Commons Attribution ShareAlike 4.0.")
                        .foregroundStyle(.secondary)
                    Link("wikipedia.org", destination: URL(string: "https://www.wikipedia.org")!)
                    Link("Creative Commons Attribution ShareAlike 4.0", destination: URL(string: "https://creativecommons.org/licenses/by-sa/4.0/")!)
                }

                Section {
                    Text("Birthed is not affiliated with Wikipedia, Wikidata or the Wikimedia Foundation.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Sources")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

#Preview {
    AttributionsView()
}
