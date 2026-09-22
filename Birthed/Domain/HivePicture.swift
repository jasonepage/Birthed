import Foundation

/// A picture the project holds for a tile on the hive: the lead picture of
/// the article a history row is about, a freely licensed file copied from
/// Wikimedia Commons into the project's public `pictures` bucket by the
/// worker's `npm run pictures` (docs/the-wall.md section 19).
///
/// Event pictures only, decided by Jason on September 22, 2026. The news
/// sites' own preview pictures, which the website also draws, belong to the
/// publishers and are not shown in the app. Faces of people born on the date
/// are not either: they are files on the website, not rows in the project,
/// and `CLAUDE.md` section 5 still says no celebrity photographs in 1.0.
///
/// The app asks the project for these and nobody else, which is what the
/// privacy page already says of the website's event pictures: Supabase is
/// asked, Wikimedia is not.
struct HivePicture: Equatable, Sendable {
    /// The stored copy, on the project's own address.
    let url: URL
    /// The credit line, the same words `creditLine` prints on the website.
    let credit: String
    /// The file's own page on Commons, where the full credit and licence live.
    let commonsURL: URL?

    /// The storage bucket the worker writes to.
    static let bucket = "pictures"

    /// The key a picture is filed under, the website's `pictureKeyOf`: the
    /// story's subject. Only a history row has one of these; a news story has
    /// no subject and gets no picture.
    static func key(subjectKind: String?, subjectID: String?) -> String? {
        guard subjectKind == "historical_event", let subjectID, !subjectID.isEmpty else { return nil }
        return "historical_event:\(subjectID)"
    }

    /// The public address of a stored picture.
    static func publicURL(project: URL, path: String) -> URL? {
        var base = project.absoluteString
        while base.hasSuffix("/") { base.removeLast() }
        let trimmed = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let escaped = trimmed.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? trimmed
        return URL(string: "\(base)/storage/v1/object/public/\(bucket)/\(escaped)")
    }

    /// "Picture: Gail Halvorsen.jpg, by U.S. Air Force, Public domain, from
    /// Wikimedia Commons." Held to the website's `creditLine` word for word.
    static func creditLine(file: String, artist: String?, license: String?) -> String {
        let by = artist.map { ", by \($0)" } ?? ""
        let under = license.map { ", \($0)" } ?? ""
        return "Picture: \(file.replacingOccurrences(of: "_", with: " "))\(by)\(under), from Wikimedia Commons."
    }

    /// One row of `event_pictures` as the automatic interface sends it. A row
    /// with no path is a file the worker could not copy, and draws nothing.
    static func from(row: [String: Any], project: URL) -> (key: String, picture: HivePicture)? {
        let id: String
        if let number = row["event_id"] as? Int {
            id = String(number)
        } else if let text = row["event_id"] as? String, !text.isEmpty {
            id = text
        } else {
            return nil
        }
        guard let path = row["path"] as? String, !path.isEmpty,
              let file = row["file"] as? String,
              let key = key(subjectKind: "historical_event", subjectID: id),
              let url = publicURL(project: project, path: path)
        else { return nil }
        let credit = creditLine(file: file,
                                artist: (row["artist"] as? String).flatMap { $0.isEmpty ? nil : $0 },
                                license: (row["license"] as? String).flatMap { $0.isEmpty ? nil : $0 })
        let commons = (row["commons_url"] as? String).flatMap(URL.init(string:))
        return (key, HivePicture(url: url, credit: credit, commonsURL: commons))
    }
}

extension WallStory {
    /// Where this story's picture is filed, or nil when it can have none.
    var pictureKey: String? { HivePicture.key(subjectKind: subjectKind, subjectID: subjectID) }
}
