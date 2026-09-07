import SwiftUI

/// A whole number that counts up to its value the first time it is shown,
/// and again whenever the value changes.
///
/// Eased, so it lands rather than stops. With Reduce Motion on it shows the
/// final value at once. The digits are monospaced so the width does not
/// jitter while they roll.
///
/// The rule this is built on, after it got this wrong in public: **the number
/// on screen is the value, and the animation is a temporary exception to
/// that.** Not the other way round.
///
/// The first version had it backwards. It drew `value` scaled by how much
/// wall clock time had passed, on a timeline it paused itself by watching a
/// condition from inside its own frame closure. That makes the digits a frame
/// of an animation rather than a fact, and a frame is only correct if the
/// animation is still running. A `TimelineView(.animation)` stops when its
/// view is off screen, when the app is not active, and during a launch or a
/// tab change, and any of those landed the count wherever it happened to be.
/// Reopening the app showed 1,211 days lived instead of 8,768, which is that
/// curve about sixty seven milliseconds in, and it stayed there because
/// nothing was ever going to come back and finish it.
///
/// So now there is no paused state and no condition to miss. `start` is the
/// whole state: non nil means an animation is in flight, nil means show the
/// true number. A single task owns the clock, and every way that task can end,
/// finishing, the value changing, the view going away, cancellation, runs the
/// same line and puts the true number on screen. There is no path that leaves
/// a partial one there.
struct CountingNumber: View {
    let value: Int
    var duration: Double = 1.4

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// When this animation began, or nil when the true value is what shows.
    @State private var start: Date?

    var body: some View {
        Group {
            if let start, !reduceMotion {
                TimelineView(.animation) { context in
                    let elapsed = context.date.timeIntervalSince(start)
                    let progress = min(1.0, max(0.0, elapsed / duration))
                    let eased = 1 - pow(1 - progress, 3)
                    Text(Int((Double(value) * eased).rounded()).formatted())
                        .monospacedDigit()
                }
            } else {
                Text(value.formatted())
                    .monospacedDigit()
            }
        }
        // Keyed on the value, so a new number counts to itself rather than
        // carrying on from the last one's clock. Cancelled when the view goes
        // away, and `try?` swallows that cancellation on purpose: the line
        // after it is the one that guarantees the true number is what is left
        // on screen, so it has to run on the way out too.
        .task(id: value) {
            guard !reduceMotion else {
                start = nil
                return
            }
            start = .now
            try? await Task.sleep(for: .seconds(duration))
            start = nil
        }
        // The number is a fact and a stuck animation must not hide it, so the
        // reader is always told the real one whatever is on screen.
        .accessibilityLabel(value.formatted())
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
