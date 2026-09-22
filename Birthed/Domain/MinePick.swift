import Foundation

/// The top card on the Mine panel: one thing at a time, dealt fresh on every
/// launch, instead of the same song and the same game every time the tab
/// opens.
///
/// Decided by Jason on September 22, 2026: the song the week you were born is
/// a fact you read once, and a screen that shows it on every launch is a
/// screen you stop looking at. The pool is what the fact finder already found
/// about this exact birthday, the found facts, plus the charts (the song and
/// the best selling game) as one card. Nothing here asks a model for anything
/// new or spends anything: the facts are the ones already searched, cached
/// and paid for.
///
/// The first card on a launch is always a found fact when there is one. The
/// charts are dealt in somewhere after it, so they come round on a tap rather
/// than leading every time. Facts with enough likes to count still come
/// first, by `FactOrder`, so what people who share the birthday liked is
/// what a reader sees first.
enum MinePick: Equatable, Identifiable {
    case fact(BirthFact)
    case charts

    var id: String {
        switch self {
        case let .fact(fact): return "fact:\(fact.id)"
        case .charts: return "charts"
        }
    }

    /// The deal for one launch. The same salt always gives the same order, so
    /// the card does not jump while the screen is open; a new salt on the
    /// next launch gives a new one.
    static func deal(facts: [BirthFact], hasCharts: Bool, salt: UInt64) -> [MinePick] {
        var picks = FactOrder.order(facts, salt: salt).map(MinePick.fact)
        guard hasCharts else { return picks }
        guard !picks.isEmpty else { return [.charts] }
        var state = salt ^ 0x9E37_79B9_7F4A_7C15
        let slot = 1 + Int(FactOrder.next(&state) % UInt64(picks.count))
        picks.insert(.charts, at: min(slot, picks.count))
        return picks
    }
}
