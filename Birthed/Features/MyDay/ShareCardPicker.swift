import SwiftUI

/// One card to share, described rather than drawn, so the picker can list
/// them and render each only when it is on screen.
struct ShareCardChoice: Identifiable {
    let id: String
    /// "The song", "Your day". What the row is called.
    let label: String
    let card: AnyView

    init<Card: View>(id: String, label: String, @ViewBuilder card: () -> Card) {
        self.id = id
        self.label = label
        self.card = AnyView(card())
    }
}

/// The sheet behind the share button: every card this person can make,
/// side by side, each with its own share button.
///
/// Every card is rendered on the device, at the moment it scrolls into
/// view, and handed straight to the system share sheet. Nothing is
/// uploaded anywhere by Birthed. `FR-117`.
struct ShareCardPicker: View {
    let choices: [ShareCardChoice]
    let subject: String

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView(.horizontal) {
                LazyHStack(alignment: .top, spacing: 18) {
                    ForEach(choices) { choice in
                        ShareCardCell(choice: choice, subject: subject)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
            .scrollIndicators(.hidden)
            .background(Theme.canvas)
            .navigationTitle("Share")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
    }
}

/// One card in the row: a scaled preview, its name, and a share button that
/// appears once the full size image has been drawn.
private struct ShareCardCell: View {
    let choice: ShareCardChoice
    let subject: String

    @State private var image: Image?

    /// 1080 wide, shown at 270. Whatever the phone, the preview is the
    /// picture the person will actually send.
    private let scale: CGFloat = 0.25

    var body: some View {
        VStack(spacing: 12) {
            choice.card
                .frame(width: 1080, height: 1350)
                .scaleEffect(scale, anchor: .topLeading)
                .frame(width: 1080 * scale, height: 1350 * scale, alignment: .topLeading)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .shadow(color: .black.opacity(0.18), radius: 12, y: 6)

            Text(choice.label)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)

            if let image {
                ShareLink(item: image, preview: SharePreview(subject, image: image)) {
                    Label("Share", systemImage: "square.and.arrow.up")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 9)
                        .background(Theme.accent, in: Capsule())
                        .foregroundStyle(Theme.cream)
                }
            } else {
                ProgressView()
                    .frame(height: 36)
            }
        }
        .frame(width: 1080 * scale)
        .task { image = render() }
    }

    /// Drawn at twice 1080 by 1350, the same as the cards always were.
    @MainActor
    private func render() -> Image? {
        let renderer = ImageRenderer(content: choice.card)
        renderer.scale = 2
        guard let rendered = renderer.uiImage else { return nil }
        return Image(uiImage: rendered)
    }
}
