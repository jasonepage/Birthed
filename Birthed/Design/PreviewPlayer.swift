import AVFoundation
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
@Observable
final class PreviewPlayer {
    /// What is playing, or nil. Read by a row to decide which mark to draw.
    private(set) var nowPlaying: URL?

    @ObservationIgnored private var player: AVPlayer?
    @ObservationIgnored private var endObserver: NSObjectProtocol?

    deinit {
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
    }

    /// Start this one, or stop it if it is the one already going.
    func toggle(_ url: URL) {
        if nowPlaying == url {
            stop()
            return
        }
        start(url)
    }

    func stop() {
        player?.pause()
        player = nil
        clearEndObserver()
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
        // The preview is a sample, not the record. Half volume so it does not
        // arrive louder than the phone's own sounds.
        player.volume = 0.85
        self.player = player

        // Thirty seconds later it ends on its own, and the mark has to go back
        // to a play arrow when it does. Without this the row would sit showing
        // a pause mark over silence.
        endObserver = NotificationCenter.default.addObserver(
            forName: AVPlayerItem.didPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            self?.stop()
        }

        nowPlaying = url
        player.play()
    }

    private func clearEndObserver() {
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        endObserver = nil
    }
}
