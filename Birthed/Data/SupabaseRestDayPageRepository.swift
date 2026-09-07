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

    // MARK: One request

    /// Every read goes through here, so the header, the timeout and the four
    /// ways a request can fail are written once.
    private func fetch<Row: Decodable>(
        from table: String,
        query: [URLQueryItem]
    ) async throws -> [Row] {
        var components = URLComponents(
            url: baseURL.appending(path: "rest/v1/\(table)"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = query
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

        do {
            return try JSONDecoder().decode([Row].self, from: data)
        } catch {
            throw DayPageError.malformedResponse
        }
    }

    // MARK: People

    /// The shape the server sends. It stays private to this file so the column
    /// names never leak upward into the domain.
    private struct MatchRow: Decodable {
        let wikidata_qid: String
        let name: String
        let birth_year: Int?
        let death_year: Int?
        let short_description: String?
        let source_url: String
        let content_license: String
        let birth_month: Int
        let birth_day: Int
    }

    private struct PersonRow: Decodable {
        let wikidata_qid: String
        let name: String
        let birth_year: Int?
        let death_year: Int?
        let short_description: String?
        let source_url: String
        let content_license: String
    }

    func notablePeople(bornOn date: CalendarDate, limit: Int) async throws -> [NotablePerson] {
        let rows: [PersonRow] = try await fetch(
            from: "notable_people",
            query: [
                URLQueryItem(name: "select", value: "wikidata_qid,name,birth_year,death_year,short_description,source_url,content_license"),
                URLQueryItem(name: "birth_month", value: "eq.\(date.month)"),
                URLQueryItem(name: "birth_day", value: "eq.\(date.day)"),
                URLQueryItem(name: "order", value: "notability_score.desc"),
                URLQueryItem(name: "limit", value: String(limit)),
            ]
        )

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

    // MARK: What happened

    private struct EventRow: Decodable {
        let event_year: Int?
        let description: String
        let source_url: String
    }

    func events(on date: CalendarDate, limit: Int) async throws -> [DayFeed.Event] {
        let rows: [EventRow] = try await fetch(
            from: "historical_events",
            query: [
                URLQueryItem(name: "select", value: "event_year,description,source_url"),
                URLQueryItem(name: "event_month", value: "eq.\(date.month)"),
                URLQueryItem(name: "event_day", value: "eq.\(date.day)"),
                URLQueryItem(name: "order", value: "event_year.desc.nullslast"),
                URLQueryItem(name: "limit", value: String(limit)),
            ]
        )
        return rows.map { row in
            DayFeed.Event(year: row.event_year, description: row.description, sourceURL: URL(string: row.source_url))
        }
    }

    // MARK: The researched facts about a date

    private struct DayFactRow: Decodable {
        let id: Int
        let fact: String
        let category: String
        let source_url: String
        let region_key: String
    }

    /// The shared date facts only. `birth_year` of zero and an empty
    /// `region_key` are how the fact finder stores the ones that are about the
    /// date itself rather than about one person's year or one person's town,
    /// and they are the only ones a reader who has not finished onboarding
    /// could possibly be shown.
    ///
    /// `verified` is required, the same as every other read of this table. An
    /// unverified fact has not had its source opened.
    func birthFacts(on date: CalendarDate, limit: Int) async throws -> [BirthFact] {
        let rows: [DayFactRow] = try await fetch(
            from: "birth_facts",
            query: [
                URLQueryItem(name: "select", value: "id,fact,category,source_url,region_key"),
                URLQueryItem(name: "birth_month", value: "eq.\(date.month)"),
                URLQueryItem(name: "birth_day", value: "eq.\(date.day)"),
                URLQueryItem(name: "birth_year", value: "eq.0"),
                // The proven spelling. `FactsService` filters the empty
                // region this way, and an `eq.` with nothing after it is the
                // kind of thing that works until a PostgREST upgrade.
                URLQueryItem(name: "region_key", value: "in.(\"\")"),
                URLQueryItem(name: "verified", value: "eq.true"),
                URLQueryItem(name: "order", value: "id.asc"),
                URLQueryItem(name: "limit", value: String(limit)),
            ]
        )
        return rows.map { row in
            BirthFact(
                id: row.id,
                fact: row.fact,
                category: row.category,
                sourceURL: URL(string: row.source_url),
                regionKey: row.region_key,
                likes: 0,
                likedByMe: false
            )
        }
    }

    // MARK: Number ones by year

    private struct ChartYearRow: Decodable {
        let year: Int
        let chart_date: String
        let song: String
        let artist: String
    }

    /// One call to the `chart_on_date` function rather than one request per
    /// year. The function is `stable`, so PostgREST accepts it as a GET, and
    /// it applies the six day rule itself.
    func numberOnes(on chart: ChartWeek.Chart, weekOf date: CalendarDate, fromYear: Int, toYear: Int) async throws -> [ChartWeek] {
        guard fromYear <= toYear else { return [] }
        let rows: [ChartYearRow] = try await fetch(
            from: "rpc/chart_on_date",
            query: [
                URLQueryItem(name: "p_chart", value: chart.rawValue),
                URLQueryItem(name: "p_month", value: String(date.month)),
                URLQueryItem(name: "p_day", value: String(date.day)),
                URLQueryItem(name: "p_from_year", value: String(fromYear)),
                URLQueryItem(name: "p_to_year", value: String(toYear)),
            ]
        )
        return rows.compactMap { row in
            ChartWeek(isoDate: row.chart_date, song: row.song, artist: row.artist, chart: chart.rawValue)
        }
    }

    // MARK: Finding somebody

    private static let matchColumns =
        "wikidata_qid,name,birth_year,death_year,short_description,source_url,content_license,birth_month,birth_day"

    /// How near counts as near, in years either side.
    ///
    /// Wide enough that a nineteen year old is offered people in their late
    /// twenties, narrow enough that they are not offered a Victorian.
    private static let nearYears = 9

    /// How many people have to look somebody up before we offer them.
    ///
    /// `has_social` says somebody exists on the internet and this says anybody
    /// has noticed. Without it the lists fill with people who satisfy both
    /// other conditions and that nobody has heard of: a British sprinter and a
    /// reserve footballer are both on the internet and both born near you.
    ///
    /// 20,000 a month keeps 5,447 people, which is about fifteen for every
    /// date of the year, and that is enough for every list on the follow sheet
    /// including the one scoped to a single day. Dropping to any views at all
    /// keeps 8,948 and adds only the tail. Raising it to 50,000 keeps 2,770,
    /// which is seven or eight per date and starts to leave the single day
    /// list short on quiet dates.
    private static let minimumViews = 20_000

    private func matches(_ query: [URLQueryItem]) async throws -> [NotableMatch] {
        let rows: [MatchRow] = try await fetch(from: "notable_people", query: query)
        return rows.compactMap { row in
            guard let sourceURL = URL(string: row.source_url),
                  let date = CalendarDate(month: row.birth_month, day: row.birth_day)
            else { return nil }
            return NotableMatch(
                person: NotablePerson(
                    id: row.wikidata_qid,
                    name: row.name,
                    birthYear: row.birth_year,
                    deathYear: row.death_year,
                    shortDescription: row.short_description,
                    sourceURL: sourceURL,
                    contentLicense: row.content_license
                ),
                birthDate: date
            )
        }
    }

    func search(name query: String, limit: Int) async throws -> [NotableMatch] {
        // Commas, brackets and stars are how PostgREST separates and wildcards
        // its own filters, so a name containing one would not be a search, it
        // would be a different query. They are dropped rather than escaped,
        // because none of them appear in a name anybody is looking for.
        let cleaned = query
            .components(separatedBy: CharacterSet(charactersIn: ",()*%\"'"))
            .joined()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleaned.count >= 2 else { return [] }

        return try await matches([
            URLQueryItem(name: "select", value: Self.matchColumns),
            URLQueryItem(name: "name", value: "ilike.*\(cleaned)*"),
            URLQueryItem(name: "order", value: "notability_score.desc"),
            URLQueryItem(name: "limit", value: String(limit)),
        ])
    }

    func recommended(bornNear year: Int?, limit: Int) async throws -> [NotableMatch] {
        var query = [
            URLQueryItem(name: "select", value: Self.matchColumns),
            URLQueryItem(name: "has_social", value: "is.true"),
            URLQueryItem(name: "monthly_views", value: "gte.\(Self.minimumViews)"),
            URLQueryItem(name: "order", value: "monthly_views.desc"),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        if let year {
            query.append(URLQueryItem(name: "birth_year", value: "gte.\(year - Self.nearYears)"))
            query.append(URLQueryItem(name: "birth_year", value: "lte.\(year + Self.nearYears)"))
        }
        return try await matches(query)
    }

    /// Whose birthday is on one of these days.
    ///
    /// One request with an `or` of month and day pairs rather than a request
    /// per day. The pairs come from `UpcomingDates`, so the turn of a month and
    /// the turn of a year are already handled and this only has to ask.
    ///
    /// The same two conditions as the suggestions: somebody who exists on the
    /// internet rather than only in an encyclopedia, and somebody people
    /// actually look up. Ordered by that second one, because on any given week
    /// there are hundreds of birthdays and the question is which of them
    /// somebody would recognise.
    func celebrating(on dates: [CalendarDate], limit: Int) async throws -> [NotableMatch] {
        guard !dates.isEmpty else { return [] }
        let pairs = dates
            .map { "and(birth_month.eq.\($0.month),birth_day.eq.\($0.day))" }
            .joined(separator: ",")
        return try await matches([
            URLQueryItem(name: "select", value: Self.matchColumns),
            URLQueryItem(name: "or", value: "(\(pairs))"),
            URLQueryItem(name: "has_social", value: "is.true"),
            URLQueryItem(name: "monthly_views", value: "gte.\(Self.minimumViews)"),
            URLQueryItem(name: "order", value: "monthly_views.desc"),
            URLQueryItem(name: "limit", value: String(limit)),
        ])
    }

    // MARK: The number ones

    private struct ChartRow: Decodable {
        let chart_date: String
        let song: String
        let artist: String
        /// Both are null until the chart media importer has looked this title
        /// up, and stay null when Apple does not carry the record. A row
        /// without them is normal and still a perfectly good chart week.
        let artwork_url: String?
        let store_url: String?
    }

    /// The chart week covering the week somebody was born, or nil.
    ///
    /// The server is asked for the first issue dated on or after the birth
    /// date, and it will always find one as long as there is anything later in
    /// the table, including for a birth date from before the chart existed.
    /// Deciding whether that answer is actually about that week is the
    /// domain's job and not the network's, so the row is handed to
    /// `ChartWeek.covers` and dropped when it does not hold.
    func numberOne(on chart: ChartWeek.Chart, theWeekOf birthDate: CalendarDate, birthYear: Int) async throws -> ChartWeek? {
        let onOrAfter = String(format: "%04d-%02d-%02d", birthYear, birthDate.month, birthDate.day)

        let rows: [ChartRow] = try await fetch(
            from: "chart_weeks",
            query: [
                URLQueryItem(name: "select", value: "chart_date,song,artist,artwork_url,store_url"),
                URLQueryItem(name: "chart_name", value: "eq.\(chart.rawValue)"),
                URLQueryItem(name: "chart_date", value: "gte.\(onOrAfter)"),
                URLQueryItem(name: "order", value: "chart_date.asc"),
                URLQueryItem(name: "limit", value: "1"),
            ]
        )

        guard let row = rows.first,
              let week = ChartWeek(
                  isoDate: row.chart_date,
                  song: row.song,
                  artist: row.artist,
                  chart: chart.rawValue,
                  artworkURL: row.artwork_url.flatMap(URL.init(string:)),
                  storeURL: row.store_url.flatMap(URL.init(string:))
              ),
              week.covers(birthYear: birthYear, birthDate: birthDate)
        else { return nil }

        return week
    }
}
