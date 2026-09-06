import Foundation

/// Spreading a recommendation list across kinds of person.
///
/// Ordering young public figures by how often they are looked up returns
/// footballers. Not mostly footballers: the first six for a birth year of 2003
/// were Haaland, Bellingham, Sinner, Cucurella, Paredes and Zverev. Athletes
/// carry enormous encyclopedia traffic and all of them have an Instagram, so
/// every signal that says "young and on the internet and looked up" says
/// footballer loudest.
///
/// That is the same failure the day page ranking already hit once, recorded in
/// the migration that replaced sitelink counts: a list that is technically
/// correct and reads like a team sheet. Popularity picks who belongs on the
/// list. This decides how many of each kind get on it, so somebody is offered
/// a musician and an actor before they are offered a fifth midfielder.
///
/// The kind is read from the one sentence Wikidata already writes about
/// somebody. That is coarse and it is meant to be: it is deciding a running
/// order, not filing a career.
enum NotableMix {

    enum Kind: CaseIterable {
        case internetNative
        case music
        case screen
        case sport
        case everybodyElse
    }

    /// Checked in this order, because the terms overlap and the earlier ones
    /// are more specific. Somebody described as a YouTuber and a singer is
    /// offered as a YouTuber, since that is the more surprising half.
    private static let terms: [(Kind, [String])] = [
        (.internetNative, ["youtuber", "tiktoker", "streamer", "influencer", "internet personality",
                           "social media", "podcaster", "twitch", "content creator", "vlogger"]),
        (.music, ["singer", "rapper", "musician", "songwriter", "band", "dj", "record producer"]),
        (.screen, ["actor", "actress", "film", "television", "comedian", "director"]),
        (.sport, ["footballer", "football", "soccer", "basketball", "tennis", "athlete", "cricketer",
                  "baseball", "boxer", "swimmer", "gymnast", "racing driver", "skier", "sport"]),
    ]

    static func kind(of description: String?) -> Kind {
        guard let text = description?.lowercased(), !text.isEmpty else { return .everybodyElse }
        for (kind, words) in terms where words.contains(where: text.contains) {
            return kind
        }
        return .everybodyElse
    }

    /// The list, reordered so no one kind runs away with the top of it.
    ///
    /// Round robin across the kinds, each kind keeping its own popularity
    /// order. A kind that runs out simply stops taking turns, so a list of
    /// nothing but athletes still returns athletes rather than returning
    /// short. Order within a kind is never changed, because that order is the
    /// number of people who actually looked them up and this has no better
    /// idea than that.
    static func spread(_ matches: [NotableMatch], limit: Int) -> [NotableMatch] {
        var queues: [Kind: [NotableMatch]] = [:]
        for match in matches {
            queues[kind(of: match.person.shortDescription), default: []].append(match)
        }

        var out: [NotableMatch] = []
        var cursors: [Kind: Int] = [:]
        // Rotating over a fixed order rather than over whichever kinds happen
        // to be present keeps the result stable for the same input.
        let order = Kind.allCases
        var exhausted = false
        while out.count < limit && !exhausted {
            exhausted = true
            for kind in order {
                guard out.count < limit else { break }
                let index = cursors[kind, default: 0]
                guard let queue = queues[kind], index < queue.count else { continue }
                out.append(queue[index])
                cursors[kind] = index + 1
                exhausted = false
            }
        }
        return out
    }
}
