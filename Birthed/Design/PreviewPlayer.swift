import AVFoundation
import Combine
import Observation

/// Plays the thirty second preview Apple publishes for a chart title, one at
/// a time.
///
/// One at a time is the whole reason this is an object rather than a player
/// held by each row. A feed can show a dozen covers and a reader who taps a
/// second one means "this instead", never "both at once". Holding the player
/// here makes that the only thing that can happen.
///
/// The previews are streamed rather than downloaded. The website copies every
/// cover onto its own domain because it sends a strict image policy and names
/// the companies a reader meets; an app has neither, is already talking to
/// Apple to exist, and a gigabyte of audio in the bundle would be a very
/// expensive way to avoid a request that only happens when somebody presses
/// play.
///
/// On the main actor, because every caller is a view and the one piece of
/// state here is read while a row is being drawn.
@MainActor
@Observable
final class PreviewPlayer {
    /// What is playing, or nil. Read by a row to decide which mark to draw.
    private(set) var nowPlaying: URL?

    @ObservationIgnored private var player: AVPlayer?
    /// The watch on "this finished by itself".
    ///
    /// A Combine cancellable rather than the token NotificationCenter hands
    /// back from its block based observer. The token is an NSObjectProtocol,
    /// which is not Sendable, so a main actor class cannot reach it from
    /// deinit to tear it down and the compiler is right to refuse. An
    /// AnyCancellable cancels itself when this object goes, so there is
    /// nothing to tear down and no deinit at all.
    @ObservationIgnored private var endWatch: AnyCancellable?

    /// Start this one, or stop it if it is the one already going.
    func toggle(_ url: URL) {
        if nowPlaying == url {
            stop()
            return
        }
        start(url)
    }

    func stop() {
        endWatch?.cancel()
        endWatch = nil
        player?.pause()
        player = nil
        nowPlaying = nil
    }

    private func start(_ url: URL) {
        stop()

        // Ambient rather than playback, and never taking the session away from
        // whatever the reader already had going. Somebody listening to their
        // own music who opens a birthday app has not asked for it to stop, and
        // a thirty second sample is not worth interrupting an album for. It
        // also means the sample is silenced by the ring switch, which is the
        // behaviour a person expects from a sound a screen makes.
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)

        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        // The preview is a sample, not the record, so it arrives a little
        // under the phone's own sounds rather than over them.
        player.volume = 0.85
        self.player = player

        // Thirty seconds later it ends on its own and the mark has to go back
        // to a play arrow. Without this the row would sit showing a pause mark
        // over silence.
        endWatch = NotificationCenter.default
            .publisher(for: AVPlayerItem.didPlayToEndTimeNotification, object: item)
            .sink { [weak self] _ in
                Task { @MainActor in self?.stop() }
            }

        nowPlaying = url
        player.play()
    }
}
