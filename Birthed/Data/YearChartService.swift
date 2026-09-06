import Foundation
import Observation

/// The number one for a whole year, where the number one for a week does not
/// exist.
///
/// Games have no usable weekly chart. There is no free, licensed, historical
/// week by week list the way Wikipedia carries the Hot 100, and the idea is
/// shakier than it looks anyway, because game sales split by country, by
/// platform and by physical against digital in a way song charts never did.
/// What does exist is one best seller per year for the United States, which is
/// keyed to a year and a chart rather than to a day.
///
/// `CLAUDE.md` already decided that shape gets its own lookup, when it said so
/// about the most watched television show. This is that lookup, and television
/// can move in beside games with no change here beyond a chart key.
///
/// It is not put in `chart_weeks`, and that is the important part. A chart week
/// is found by asking for the first issue dated on or after a birth date, and
/// `ChartWeek.covers` refuses an answer more than six days later, which is the
/// one control stopping a 1943 birthday being handed the January 1959 chart as
/// fact. A yearly chart has no issue date for that rule to hold on to, and
/// inventing one would defeat the control rather than satisfy it.
@Observable
final class YearChartService {

    /// The best selling game of the reader's birth year, or nothing.
    ///
    /// Nothing before 1980, because the page starts there, and nothing when
    /// the reader gave no birth year. Absent beats wrong, as everywhere.
    private(set) var game: Entry?

    /// One row. `note` is what the interface must show beside the claim, and
    /// it comes from the server so a better wording does not need an app
    /// release.
    struct Entry: Equatable, Decodable {
        let year: Int
        let title: String
        let credit: String?
        let note: String?
    }

    static let gameChart = "us_best_selling_game"

    private let account: AccountService
    private let baseURL: URL
    private let anonKey: String
    private let session: URLSession
    /// So a second appearance of the same screen does not ask again.
    private var loadedYear: Int?

    init(account: AccountService,
         baseURL: URL = Secrets.supabaseURL,
         anonKey: String = Secrets.supabaseAnonKey,
         session: URLSession = .shared) {
        self.account = account
        self.baseURL = baseURL
        self.anonKey = anonKey
        self.session = session
    }

    func load(year: Int?) async {
        guard let year else { return }
        guard loadedYear != year else { return }

        var components = URLComponents(
            url: baseURL.appending(path: "rest/v1/year_charts"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "select", value: "year,title,credit,note"),
            URLQueryItem(name: "chart", value: "eq.\(Self.gameChart)"),
            URLQueryItem(name: "year", value: "eq.\(year)"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        guard let url = components?.url else { return }

        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        if let token = await account.freshAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.timeoutInterval = 15

        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let rows = try? JSONDecoder().decode([Entry].self, from: data)
        else { return }

        // A year with no row is a year with no row, and it is remembered as
        // answered so the screen does not ask again every time it appears.
        loadedYear = year
        game = rows.first
    }
}
