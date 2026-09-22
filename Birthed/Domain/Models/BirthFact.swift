import Foundation

/// One thing found about a birth date, with where it came from.
///
/// Found by a model that searches as it answers, cached per date, year and
/// region, and shown as returned. The source is kept on every fact so a
/// wrong one can be traced and pulled. Likes are counted across everyone who
/// shares the exact birthday, which is what sorts the list.
struct BirthFact: Identifiable, Equatable, Hashable {
    let id: Int
    let fact: String
    /// event, release, older_than, sport, science, price, weather, local, record.
    let category: String
    let sourceURL: URL?
    /// Empty when the fact is about the date for everyone; the region key
    /// when it is about the place the person named.
    let regionKey: String
    var likes: Int
    var likedByMe: Bool
    /// The editor's score, one to ten: would somebody born on this day tell
    /// a friend. Only facts at 7 and above are published, so on the phone this
    /// separates the good from the best. Nil before the editor has read it.
    /// supabase/functions/_shared/editor.ts.
    var interest: Int? = nil

    var isLocal: Bool { !regionKey.isEmpty }
}
