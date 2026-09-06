import Foundation

/// The order the found facts are shown in.
///
/// Likes were meant to decide this, and at scale they will. At twenty five
/// users they cannot, and worse than not helping they mislead: the first row
/// is set large, so it collects the likes, so it stays first, so it collects
/// more. `docs/what-readers-respond-to.md` names this and calls it acceptable
/// for ranking a prompt. It is not acceptable for ranking the screen.
///
/// So a like does not count until a fact has a few of them. Below that line
/// the facts are dealt by a seeded shuffle, and the seed changes on every
/// load, so the fact that leads on Tuesday is not the one that led on Monday
/// and nothing earns a like for its position. Above the line likes order the
/// facts, most first, because by then a few people chose it on purpose.
///
/// Seeded rather than `shuffled()`, for two reasons. The poll that runs while
/// a search is in progress reads the same list every eight seconds, and a
/// list that reshuffled on every poll would jump under the reader's thumb.
/// And a deterministic shuffle can be tested.
enum FactOrder {
    /// How many likes a fact needs before they mean anything.
    static let likesThatCount = 5

    static func order(_ facts: [BirthFact], salt: UInt64, likesThatCount: Int = FactOrder.likesThatCount) -> [BirthFact] {
        let chosen = facts.filter { $0.likes >= likesThatCount }
            .sorted { ($0.likes, -$0.id) > ($1.likes, -$1.id) }
        let rest = facts.filter { $0.likes < likesThatCount }
        return chosen + shuffle(rest, salt: salt)
    }

    /// A Fisher and Yates shuffle driven by a SplitMix64 generator, so the
    /// same salt always deals the same order and a different salt almost
    /// always deals a different one.
    static func shuffle(_ facts: [BirthFact], salt: UInt64) -> [BirthFact] {
        guard facts.count > 1 else { return facts }
        // Sorted by id first so the result depends on the salt and the set,
        // not on the order the server happened to send the rows in.
        var dealt = facts.sorted { $0.id < $1.id }
        var state = salt
        for index in stride(from: dealt.count - 1, to: 0, by: -1) {
            let swap = Int(next(&state) % UInt64(index + 1))
            dealt.swapAt(index, swap)
        }
        return dealt
    }

    /// SplitMix64. Small, fast, and good enough to deal a dozen cards. Shared
    /// with `DayFeed`, which deals a hundred.
    static func next(_ state: inout UInt64) -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }

    /// A fresh salt. Called once per load, never per poll.
    static func newSalt() -> UInt64 {
        UInt64.random(in: UInt64.min...UInt64.max)
    }
}
