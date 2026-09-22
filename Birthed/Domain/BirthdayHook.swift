import Foundation

/// One line from somebody's day, dropped into the birthday message after its
/// first sentence: "Happy 28th, Sam! You were born the week I Don't Want to
/// Miss a Thing by Aerosmith was number one. Hope it's a good one."
///
/// Two kinds and no more, because both are about the person: the number one
/// song the week they were born, and somebody famous who shares their
/// birthday. Facts about the date stay out of the message, per the decision
/// in `CLAUDE.md` ("The birthday message"): they are about the calendar, not
/// the person.
///
/// The hooks come from what the person's day already loaded. Opening the
/// composer never asks the network for anything, which is the promise the
/// message decision is built on.
enum BirthdayHook: Equatable, Identifiable {
    case song(title: String, artist: String)
    case twin(name: String)

    var id: String {
        switch self {
        case let .song(title, artist): return "song:\(title):\(artist)"
        case let .twin(name): return "twin:\(name)"
        }
    }

    /// What the chip says.
    var label: String {
        switch self {
        case .song: return "The song"
        case let .twin(name): return name
        }
    }

    /// The sentence itself, in the contractions a text to a friend uses.
    var sentence: String {
        switch self {
        case let .song(title, artist):
            return "You were born the week \(title) by \(artist) was number one."
        case let .twin(name):
            return "You share a birthday with \(name)."
        }
    }

    /// The hooks a person's day offers, song first. At most one famous twin,
    /// because a message that lists three celebrities is a quiz.
    static func offered(songTitle: String?, songArtist: String?, twins: [String]) -> [BirthdayHook] {
        var hooks: [BirthdayHook] = []
        if let title = songTitle, let artist = songArtist, !title.isEmpty, !artist.isEmpty {
            hooks.append(.song(title: title, artist: artist))
        }
        if let first = twins.first(where: { !$0.isEmpty }) {
            hooks.append(.twin(name: first))
        }
        return hooks
    }

    /// The draft with the hook after its first sentence, or the draft as it
    /// was when there is no hook.
    static func insert(_ hook: BirthdayHook?, into draft: String) -> String {
        guard let hook else { return draft }
        let characters = Array(draft)
        for (index, character) in characters.enumerated() where ".!?".contains(character) {
            let next = index + 1
            if next == characters.count {
                return draft + " " + hook.sentence
            }
            if characters[next] == " " {
                let head = String(characters[...index])
                let tail = String(characters[next...]).trimmingCharacters(in: .whitespaces)
                return tail.isEmpty ? head + " " + hook.sentence : head + " " + hook.sentence + " " + tail
            }
        }
        // A draft with no sentence ending at all, which the generator never
        // writes but an edited text could: close it before adding another.
        let trimmed = draft.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? hook.sentence : trimmed + ". " + hook.sentence
    }
}
