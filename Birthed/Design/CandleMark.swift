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
struct CandleMark: View {
    var height: CGFloat = 200

    private var flameHeight: CGFloat { height * 0.46 }
    private var bodyWidth: CGFloat { height * 0.20 }

    var body: some View {
        VStack(spacing: -flameHeight * 0.05) {
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
            .frame(width: flameHeight * 0.5, height: flameHeight)

            stripedBody
        }
    }

    private var stripedBody: some View {
        Rectangle()
            .fill(LinearGradient(
                colors: [Theme.wax, Theme.waxLight, Theme.wax],
                startPoint: .leading, endPoint: .trailing
            ))
            .overlay(stripes)
            .frame(width: bodyWidth, height: height * 0.58)
            .clipShape(UnevenRoundedRectangle(
                topLeadingRadius: bodyWidth * 0.18,
                bottomLeadingRadius: 0,
                bottomTrailingRadius: 0,
                topTrailingRadius: bodyWidth * 0.18,
                style: .continuous
            ))
    }

    private var stripes: some View {
        GeometryReader { proxy in
            let step = proxy.size.width * 0.62
            Path { path in
                var y = -proxy.size.height
                while y < proxy.size.height * 2 {
                    path.addRect(CGRect(x: -proxy.size.width * 2, y: y,
                                        width: proxy.size.width * 5, height: step * 0.42))
                    y += step
                }
            }
            .fill(Theme.cream.opacity(0.94))
            .rotationEffect(.degrees(-36), anchor: .center)
        }
    }
}

#Preview {
    ZStack { Theme.ink.ignoresSafeArea(); CandleMark(height: 300) }
}
