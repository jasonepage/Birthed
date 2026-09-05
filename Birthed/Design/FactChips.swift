import SwiftUI

/// Lays its children out left to right and wraps to a new line when the row
/// is full, the way words wrap. Used for the little facts under the counters,
/// which are a different number of chips for every person.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        return place(in: width, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let placed = place(in: bounds.width, subviews: subviews)
        for (index, origin) in placed.origins.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y),
                proposal: .unspecified
            )
        }
    }

    private func place(in width: CGFloat, subviews: Subviews) -> (size: CGSize, origins: [CGPoint]) {
        var origins: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var widest: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            origins.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            widest = max(widest, x - spacing)
        }
        return (CGSize(width: widest, height: y + rowHeight), origins)
    }
}

/// One small true thing, with a label saying what kind of thing it is.
struct FactChip: View {
    let label: String
    let value: String
    var palette: StagePalette

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .heavy))
                .kerning(1.2)
                .foregroundStyle(palette.type.opacity(0.45))
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(palette.type)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(palette.type.opacity(0.07), in: Capsule())
    }
}
