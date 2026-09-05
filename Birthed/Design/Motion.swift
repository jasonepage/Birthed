import SwiftUI

/// A whole number that counts up to its value the first time it is shown,
/// and again whenever the value changes.
///
/// Eased, so it lands rather than stops. With Reduce Motion on it shows the
/// final value at once. The digits are monospaced so the width does not
/// jitter while they roll.
struct CountingNumber: View {
    let value: Int
    var duration: Double = 1.4

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date.now
    @State private var finished = false

    var body: some View {
        TimelineView(.animation(paused: finished)) { context in
            let elapsed = context.date.timeIntervalSince(start)
            let progress = reduceMotion ? 1.0 : min(1.0, max(0.0, elapsed / duration))
            let eased = 1 - pow(1 - progress, 3)
            let shown = Int((Double(value) * eased).rounded())

            Text(shown.formatted())
                .monospacedDigit()
                .onChange(of: progress >= 1) { _, done in
                    if done { finished = true }
                }
        }
        .onAppear {
            start = .now
            finished = false
        }
        .onChange(of: value) { _, _ in
            start = .now
            finished = false
        }
    }
}

/// A short burst of confetti falling from the top of whatever it is laid
/// over, then gone.
///
/// Drawn in a `Canvas` off a fixed seed, so it costs nothing to keep on
/// screen and looks the same every time it is asked for. It stops its own
/// clock once it is done, so an idle birthday screen is not animating an
/// empty view. Hit testing is off: it is decoration, not a control.
struct ConfettiBurst: View {
    var duration: Double = 3.4
    var count: Int = 80

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date.now
    @State private var finished = false

    private struct Piece {
        let x: Double
        let delay: Double
        let speed: Double
        let drift: Double
        let width: Double
        let height: Double
        let spin: Double
        let color: Color
    }

    private var pieces: [Piece] {
        var generator = SeededGenerator(seed: 0x4249_5254_4845_44)
        let colors = [Theme.accent, Theme.accentSoft, Theme.ember, Theme.emberLight, Theme.accentDeep]
        return (0..<count).map { index in
            Piece(
                x: Double.random(in: 0...1, using: &generator),
                delay: Double.random(in: 0...0.9, using: &generator),
                speed: Double.random(in: 260...520, using: &generator),
                drift: Double.random(in: -60...60, using: &generator),
                width: Double.random(in: 6...11, using: &generator),
                height: Double.random(in: 10...18, using: &generator),
                spin: Double.random(in: -6...6, using: &generator),
                color: colors[index % colors.count]
            )
        }
    }

    var body: some View {
        let pieces = pieces
        TimelineView(.animation(paused: finished || reduceMotion)) { context in
            let t = context.date.timeIntervalSince(start)
            Canvas { graphics, size in
                guard !reduceMotion, t < duration else { return }
                for piece in pieces {
                    let age = t - piece.delay
                    guard age > 0 else { continue }
                    let y = -20 + piece.speed * age + 180 * age * age
                    guard y < size.height + 30 else { continue }
                    let x = piece.x * size.width + piece.drift * sin(age * 2.2)
                    let fade = max(0, min(1, (duration - t) / 0.6))
                    var context = graphics
                    context.opacity = fade
                    context.translateBy(x: x, y: y)
                    context.rotate(by: .radians(piece.spin * age))
                    let rect = CGRect(x: -piece.width / 2, y: -piece.height / 2,
                                      width: piece.width, height: piece.height)
                    context.fill(Path(roundedRect: rect, cornerRadius: 2), with: .color(piece.color))
                }
            }
        }
        .allowsHitTesting(false)
        .task {
            try? await Task.sleep(for: .seconds(duration + 0.1))
            finished = true
        }
    }
}

/// Deterministic randomness for decoration, so a confetti burst is the same
/// shape in a preview, in the simulator and on a phone.
nonisolated struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed
    }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

#Preview("Counting") {
    CountingNumber(value: 7140)
        .font(.system(size: 96, weight: .black, design: .serif))
}

#Preview("Confetti") {
    ZStack {
        Theme.ink.ignoresSafeArea()
        ConfettiBurst()
    }
}
