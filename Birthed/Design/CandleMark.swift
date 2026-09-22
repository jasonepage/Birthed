import SwiftUI

/// The candle from the app icon, drawn in SwiftUI so the share card, the icon
/// and the web card are all the same object rather than three drawings that
/// resemble each other.
///
/// The geometry is the same bezier as `design/app-icon/birthed-icon.svg`, in a
/// 100 by 95 box, scaled into whatever frame it is given.
struct FlameShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let unitX = rect.width / 100
        let unitY = rect.height / 95
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * unitX, y: rect.minY + y * unitY)
        }

        path.move(to: point(50, 3))
        path.addCurve(to: point(68, 40), control1: point(53, 20), control2: point(63, 28))
        path.addCurve(to: point(73, 65), control1: point(73, 51), control2: point(73, 58))
        path.addCurve(to: point(50, 95), control1: point(73, 81), control2: point(63, 95))
        path.addCurve(to: point(27, 65), control1: point(37, 95), control2: point(27, 81))
        path.addCurve(to: point(39, 39), control1: point(27, 55), control2: point(33, 47))
        path.addCurve(to: point(46, 48), control1: point(41, 43), control2: point(43, 46))
        path.addCurve(to: point(50, 3), control1: point(46, 34), control2: point(46, 17))
        path.closeSubpath()
        return path
    }
}

/// The hot core, which is what stops the flame reading as a leaf.
struct FlameCoreShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let unitX = rect.width / 100
        let unitY = rect.height / 95
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * unitX, y: rect.minY + y * unitY)
        }

        path.move(to: point(50, 40))
        path.addCurve(to: point(60, 68), control1: point(52, 52), control2: point(60, 58))
        path.addCurve(to: point(49, 87), control1: point(60, 80), control2: point(55, 87))
        path.addCurve(to: point(38, 69), control1: point(43, 87), control2: point(38, 80))
        path.addCurve(to: point(50, 40), control1: point(38, 59), control2: point(47, 52))
        path.closeSubpath()
        return path
    }
}

/// A lit birthday candle, running off the bottom of whatever it is placed in.
///
/// Every fraction below is shared with the icon, so the mark on the share
/// card is the same object as the candle on the home screen. Since September
/// 22, 2026 the icon is a honey cake with this candle standing on it, and
/// `design/app-icon/make-icon.py` draws that candle from these same ratios:
/// a flame 250 tall on a body 94 wide whose top edge is 10 points above the
/// bottom of the flame. The cake hides the bottom of the body, so how much
/// body shows here is a choice, not a measurement: `height` is the flame plus
/// about as much body again.
///
/// The candle is cream with pink stripes, the one pink left in the app, the
/// same as the icon.
///
/// The flame frame keeps the drawing's own 100 by 95 aspect. Giving it any
/// other aspect stretches the bezier, and a stretched flame reads as a taper
/// rather than as a fire.
///
/// The flame moves. It sways and breathes off a few overlapping sine waves,
/// which is enough to read as fire without ever repeating visibly, and it
/// casts a glow that breathes with it. `animated: false` freezes it at its
/// rest pose, which is what a share card needs: `ImageRenderer` draws one
/// frame of a `TimelineView` and a card should not depend on which one.
/// `lit: false` replaces the flame with a wick and a little smoke, for the
/// moment on the birthday when it has just been blown out.
struct CandleMark: View {
    var height: CGFloat = 200
    var lit: Bool = true
    var animated: Bool = true
    /// A dish for the candle to stand in, and a contact shadow under it.
    ///
    /// Off by default, and that is the point. The candle is the app icon, and
    /// the icon has no holder: it runs its body off the bottom edge of a
    /// bounded square, where being cut off reads as deliberate. Everywhere the
    /// mark is small or standing in for the app, it should stay the mark. The
    /// holder is for the one place the candle is large and standing on a
    /// surface a reader can see the bottom of, where running off the edge
    /// reads as clipped rather than as chosen.
    var holder: Bool = false
    /// The ground this is standing on, which decides the colour of every edge
    /// drawn below.
    ///
    /// Not the system appearance. The panel this candle usually stands on is
    /// the same dark brown in light and dark on purpose, so an edge that followed
    /// the appearance would turn black while the thing behind it stayed dark,
    /// and be invisible half the time. The candle appears on the wax panel, on
    /// the system card in People and Add Friends, and on ink and cream in the
    /// share cards, and it has to hold on all of them. `palette.type` is cream
    /// on a dark ground and ink on a light one, which is the whole rule.
    var on: StagePalette = .wax

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The flame is a little under half the mark, and the body is the rest.
    /// Chosen when the first icon ran the body off its bottom edge, and kept
    /// because the Mine panel and the share cards are laid out around it.
    private var flameHeight: CGFloat { height * 0.484 }
    private var flameWidth: CGFloat { flameHeight * (100.0 / 95.0) }
    /// 94 wide against a flame 250 tall.
    private var bodyWidth: CGFloat { flameHeight * 0.376 }
    private var bodyHeight: CGFloat { max(0, height * 0.534 - holderRise) }
    /// The 10 points the flame sits over the candle, against a flame 250 tall.
    private var overlap: CGFloat { flameHeight * 0.039 }

    // The holder's proportions are chosen rather than measured, because there
    // is no holder in the icon to measure one off. They are written against
    // the body's width so the dish stays in proportion at every size the mark
    // is drawn at, which in this app runs from 34 points to 620.
    private var dishWidth: CGFloat { bodyWidth * 2.6 }
    private var dishHeight: CGFloat { bodyWidth * 0.62 }
    /// How far the dish reaches below where the body alone would have ended.
    /// Taken off the body so the whole mark still occupies exactly `height`
    /// and no caller has to know whether it has a holder.
    private var holderRise: CGFloat { holder ? dishHeight * 0.62 : 0 }

    /// A hairline that never disappears at 34 points and never thickens into
    /// a border at 620.
    private var edgeWidth: CGFloat { max(0.75, height * 0.004) }
    private var edge: Color { on.type.opacity(0.34) }

    private var moves: Bool { animated && !reduceMotion }

    var body: some View {
        VStack(spacing: -overlap) {
            flameSlot
                .frame(width: flameWidth, height: flameHeight)
                // The icon draws the flame over the candle, not behind it. A
                // VStack draws in order, so without this the wax covers the
                // base of the fire and the candle looks unlit.
                .zIndex(1)

            if holder {
                seatedBody
            } else {
                stripedBody
            }
        }
        .animation(.easeInOut(duration: 0.35), value: lit)
    }

    /// The candle standing in its dish.
    ///
    /// The dish is one ellipse drawn twice: the half above its widest point
    /// behind the candle, and the half below it in front. That is the whole
    /// trick, and the first version did not do it. Laying the whole ellipse in
    /// front of the body, with a second ring on top to hide the join, gave two
    /// hard edged circles around a cylinder, which reads as ripples in water
    /// with something dropped in them rather than as a candle in a holder.
    /// Split, the near rim passes in front of the wax and the far rim passes
    /// behind it, and that alone is what makes it a bowl instead of a ring.
    ///
    /// Both halves are the same ellipse at the same size with no offset, so
    /// they meet exactly at the widest point, where an ellipse's edge runs
    /// vertically and the seam has nothing to show.
    ///
    /// The body's base sits a little below that line rather than on it, so
    /// the near rim overlaps the bottom of the wax. A candle resting exactly
    /// on the centre line is standing on the dish; one sunk slightly past it
    /// is standing in it.
    private var seatedBody: some View {
        ZStack(alignment: .bottom) {
            Ellipse()
                .fill(Color.black.opacity(0.30))
                .frame(width: dishWidth * 0.92, height: dishHeight * 0.44)
                .blur(radius: dishHeight * 0.26)
                .offset(y: dishHeight * 0.12)
                .allowsHitTesting(false)

            dishFace
                .mask(alignment: .top) { Rectangle().frame(height: dishHeight / 2) }

            stripedBody
                .padding(.bottom, dishHeight * 0.28)

            dishFace
                .mask(alignment: .bottom) { Rectangle().frame(height: dishHeight / 2) }
        }
        .frame(width: dishWidth)
    }

    /// The saucer, drawn whole. `seatedBody` shows one half of it at a time.
    ///
    /// The edge is quieter than the candle's own, because at this size a rim
    /// drawn at the same weight as the wax stops being the lip of a bowl and
    /// becomes a circle somebody drew around the candle.
    ///
    /// The inside of it is lit, because there is a flame directly above it and
    /// the one thing that would give this away as assembled rather than drawn
    /// is a holder that ignores its own candle. The light goes out with the
    /// flame.
    private var dishFace: some View {
        ZStack {
            Ellipse()
                .fill(LinearGradient(
                    colors: [on.type.opacity(0.26), on.type.opacity(0.11), on.type.opacity(0.20)],
                    startPoint: .leading, endPoint: .trailing
                ))
                .overlay(Ellipse().stroke(on.type.opacity(0.24), lineWidth: edgeWidth))

            Ellipse()
                .fill(Theme.ember.opacity(lit ? 0.24 : 0))
                .frame(width: dishWidth * 0.66, height: dishHeight * 0.40)
                .blur(radius: dishHeight * 0.32)
                .offset(y: -dishHeight * 0.10)
                .allowsHitTesting(false)
        }
        .frame(width: dishWidth, height: dishHeight)
    }

    @ViewBuilder
    private var flameSlot: some View {
        if lit {
            if moves {
                TimelineView(.animation) { context in
                    flame(at: context.date.timeIntervalSinceReferenceDate)
                }
            } else {
                flame(at: 0)
            }
        } else {
            wickAndSmoke
        }
    }

    /// One frame of fire. At `t == 0` every wave is at zero, so the rest pose
    /// is exactly the icon.
    private func flame(at t: TimeInterval) -> some View {
        let sway = sin(t * 5.1) * 0.5 + sin(t * 13.7) * 0.3 + sin(t * 29.3) * 0.2
        let breathe = sin(t * 3.7) * 0.5 + sin(t * 11.1) * 0.5

        return ZStack {
            Ellipse()
                .fill(RadialGradient(
                    colors: [
                        Theme.ember.opacity(0.42 + 0.12 * breathe),
                        Theme.accent.opacity(0.14),
                        .clear,
                    ],
                    center: .center, startRadius: 0, endRadius: flameHeight * 0.95
                ))
                .frame(width: flameWidth * 2.6, height: flameHeight * 2.2)
                .offset(y: flameHeight * 0.12)
                .allowsHitTesting(false)

            ZStack {
                FlameShape()
                    .fill(LinearGradient(
                        colors: [Theme.emberLight, Theme.ember, Theme.emberDeep],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                FlameCoreShape()
                    .fill(LinearGradient(
                        colors: [.white, Theme.cream],
                        startPoint: .top, endPoint: .bottom
                    ))
            }
            .frame(width: flameWidth, height: flameHeight)
            .scaleEffect(x: 1 + 0.05 * breathe, y: 1 + 0.08 * breathe + 0.03 * sway, anchor: .bottom)
            .rotationEffect(.degrees(sway * 4), anchor: .bottom)
        }
        .transition(.scale(scale: 0.2, anchor: .bottom).combined(with: .opacity))
    }

    /// What is left after a breath: the wick, and smoke that rises and thins.
    private var wickAndSmoke: some View {
        ZStack(alignment: .bottom) {
            if moves {
                TimelineView(.animation) { context in
                    let t = context.date.timeIntervalSinceReferenceDate
                    Canvas { graphics, size in
                        for index in 0..<3 {
                            let phase = (t * 0.45 + Double(index) / 3).truncatingRemainder(dividingBy: 1)
                            let y = size.height - phase * size.height * 0.9
                            let drift = sin(t * 2 + Double(index) * 2.1) * size.width * 0.08 * phase
                            let x = size.width / 2 + drift
                            let radius = size.width * (0.035 + 0.11 * phase)
                            graphics.opacity = (1 - phase) * 0.35
                            graphics.fill(
                                Path(ellipseIn: CGRect(x: x - radius, y: y - radius,
                                                       width: radius * 2, height: radius * 2)),
                                with: .color(Theme.waxLight)
                            )
                        }
                    }
                }
            }

            Capsule()
                .fill(Theme.wax)
                .frame(width: flameWidth * 0.06, height: flameHeight * 0.14)
        }
        .transition(.opacity)
    }

    /// The body's outline, kept as one value because it is both the mask and
    /// the edge and those two must not drift apart.
    private var bodyShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: bodyWidth * 0.1867,
            bottomLeadingRadius: 0,
            bottomTrailingRadius: 0,
            topTrailingRadius: bodyWidth * 0.1867,
            style: .continuous
        )
    }

    private var stripedBody: some View {
        Rectangle()
            .fill(LinearGradient(
                colors: [
                    Color(red: 0.910, green: 0.839, blue: 0.722),  // E8D6B8
                    Theme.cream,
                    Color(red: 0.878, green: 0.800, blue: 0.671),  // E0CCAB
                ],
                startPoint: .leading, endPoint: .trailing
            ))
            .overlay(stripes)
            .frame(width: bodyWidth, height: bodyHeight)
            .clipShape(bodyShape)
            // On a light ground the cream body is close to the colour behind
            // it, so without this it has no edges and the mark reads as pink
            // stripes floating under a flame. On the dark panel the same line
            // is cream instead, which is the whole reason it is taken from the
            // palette rather than from the appearance.
            .overlay(bodyShape.stroke(edge, lineWidth: edgeWidth))
    }

    /// A step of 0.84 of the width and a stripe 0.4286 of the step, turned 36
    /// degrees, the same as the icon. Drawn wider and taller than the body
    /// because the rotation swings the ends of each stripe outside it.
    private var stripes: some View {
        GeometryReader { proxy in
            let step = proxy.size.width * 0.84
            Path { path in
                var y = -proxy.size.height
                while y < proxy.size.height * 2 {
                    path.addRect(CGRect(x: -proxy.size.width * 2, y: y,
                                        width: proxy.size.width * 5, height: step * 0.4286))
                    y += step
                }
            }
            .fill(Theme.spark)
            .rotationEffect(.degrees(-36), anchor: .center)
        }
    }
}

#Preview("On the panel, held") {
    ZStack {
        StagePalette.wax.ground.ignoresSafeArea()
        CandleMark(height: 300, holder: true, on: .wax)
    }
}

#Preview("On the panel, as the icon draws it") {
    ZStack {
        StagePalette.wax.ground.ignoresSafeArea()
        CandleMark(height: 300, on: .wax)
    }
}

#Preview("On a light card") {
    ZStack {
        StagePalette.cream.ground.ignoresSafeArea()
        CandleMark(height: 300, holder: true, on: .cream)
    }
}

#Preview("On ink") {
    ZStack {
        StagePalette.ink.ground.ignoresSafeArea()
        CandleMark(height: 300, holder: true, on: .ink)
    }
}

#Preview("Blown out, held") {
    ZStack {
        StagePalette.wax.ground.ignoresSafeArea()
        CandleMark(height: 300, lit: false, holder: true, on: .wax)
    }
}

#Preview("Small, the sizes People uses") {
    ZStack {
        StagePalette.cream.ground.ignoresSafeArea()
        HStack(alignment: .bottom, spacing: 24) {
            CandleMark(height: 34, on: .cream)
            CandleMark(height: 54, on: .cream)
            CandleMark(height: 96, holder: true, on: .cream)
            CandleMark(height: 120, holder: true, on: .cream)
        }
    }
}
