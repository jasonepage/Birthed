import Foundation

/// Reads identity content straight from the Supabase REST interface.
///
/// Slice 1 deliberately carries no client library. There are no accounts, no
/// realtime and no storage yet, so the whole data layer is one authenticated
/// GET, and a dependency that is not needed is a dependency that cannot break
/// the build. `CLAUDE.md` section 3 commits to `supabase-swift`, and slice 2
/// is where it earns its place, because that is where the silent anonymous
/// account arrives. When it does, only this file is replaced.
struct SupabaseRestDayPageRepository: DayPageRepository {
    private let baseURL: URL
    private let anonKey: String
    private let session: URLSession

    init(
        baseURL: URL = Secrets.supabaseURL,
        anonKey: String = Secrets.supabaseAnonKey,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.anonKey = anonKey
        self.session = session
    }

    /// The shape the server sends. It stays private to this file so the column
    /// names never leak upward into the domain.
    private struct Row: Decodable {
        let wikidata_qid: String
        let name: String
        let birth_year: Int?
        let death_year: Int?
        let short_description: String?
        let source_url: String
        let content_license: String
    }

    func notablePeople(bornOn date: CalendarDate, limit: Int) async throws -> [NotablePerson] {
        var components = URLComponents(
            url: baseURL.appending(path: "rest/v1/notable_people"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "select", value: "wikidata_qid,name,birth_year,death_year,short_description,source_url,content_license"),
            URLQueryItem(name: "birth_month", value: "eq.\(date.month)"),
            URLQueryItem(name: "birth_day", value: "eq.\(date.day)"),
            URLQueryItem(name: "order", value: "notability_score.desc"),
            URLQueryItem(name: "limit", value: String(limit)),
        ]

        guard let url = components?.url else { throw DayPageError.malformedResponse }

        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 15

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw DayPageError.offline
        }

        guard let http = response as? HTTPURLResponse else {
            throw DayPageError.malformedResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw DayPageError.server(http.statusCode)
        }

        let rows: [Row]
        do {
            rows = try JSONDecoder().decode([Row].self, from: data)
        } catch {
            throw DayPageError.malformedResponse
        }

        return rows.compactMap { row in
            guard let sourceURL = URL(string: row.source_url) else { return nil }
            return NotablePerson(
                id: row.wikidata_qid,
                name: row.name,
                birthYear: row.birth_year,
                deathYear: row.death_year,
                shortDescription: row.short_description,
                sourceURL: sourceURL,
                contentLicense: row.content_license
            )
        }
    }
}
