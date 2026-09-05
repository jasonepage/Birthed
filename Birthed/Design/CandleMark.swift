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
/// Every fraction below is measured off the icon rather than chosen, so the
/// mark on the share card is the same object as the mark on the home screen.
/// In `design/app-icon/birthed-icon.svg` the flame is a 100 by 95 box scaled
/// by 7, which is 700 wide by 665 tall, sitting on a candle 250 wide whose
/// top edge is 26 points above the bottom of the flame. Those four numbers are
/// the whole of what follows. The icon runs its body off the bottom edge, so
/// how much body shows here is a choice, not a measurement: `height` is the
/// flame plus about as much body again.
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

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// 424 of the 876 points from the top of the flame to the bottom of the
    /// candle body in the icon.
    private var flameHeight: CGFloat { height * 0.484 }
    private var flameWidth: CGFloat { flameHeight * (100.0 / 95.0) }
    /// 250 wide against a flame 665 tall.
    private var bodyWidth: CGFloat { flameHeight * 0.376 }
    private var bodyHeight: CGFloat { height * 0.534 }
    /// The 26 points the flame sits over the candle, against a flame 665 tall.
    private var overlap: CGFloat { flameHeight * 0.039 }

    private var moves: Bool { animated && !reduceMotion }

    var body: some View {
        VStack(spacing: -overlap) {
            flameSlot
                .frame(width: flameWidth, height: flameHeight)
                // The icon draws the flame over the candle, not behind it. A
                // VStack draws in order, so without this the wax covers the
                // base of the fire and the candle looks unlit.
                .zIndex(1)

            stripedBody
        }
        .animation(.easeInOut(duration: 0.35), value: lit)
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

    private var stripedBody: some View {
        Rectangle()
            .fill(LinearGradient(
                colors: [Theme.wax, Theme.waxLight, Theme.wax],
                startPoint: .leading, endPoint: .trailing
            ))
            .overlay(stripes)
            .frame(width: bodyWidth, height: bodyHeight)
            .clipShape(UnevenRoundedRectangle(
                topLeadingRadius: bodyWidth * 0.1867,
                bottomLeadingRadius: 0,
                bottomTrailingRadius: 0,
                topTrailingRadius: bodyWidth * 0.1867,
                style: .continuous
            ))
    }

    /// Eleven stripes 54 wide, 126 apart, turned 36 degrees, on a body 150
    /// wide. Here that is a step of 0.84 of the width and a stripe 0.4286 of
    /// the step, drawn wider and taller than the body because the rotation
    /// swings the ends of each stripe outside it.
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
            .fill(Theme.cream.opacity(0.94))
            .rotationEffect(.degrees(-36), anchor: .center)
        }
    }
}

#Preview("Lit") {
    ZStack { Theme.ink.ignoresSafeArea(); CandleMark(height: 300) }
}

#Preview("Out") {
    ZStack { Theme.cream.ignoresSafeArea(); CandleMark(height: 300, lit: false) }
}
