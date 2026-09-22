import CryptoKit
import DeviceCheck
import Foundation
import Observation

/// The hive, as the app reads and writes it. docs/the-wall.md, and sections
/// 12 and 14 for what the app's own sessions decided.
///
/// **Reading needs nothing.** The square, the pool, the receipts and every
/// check are public rows, read through the automatic interface with the
/// publishable key, the same way the website reads them. No account, no
/// attestation, nothing in front of it.
///
/// **Writing rides the silent anonymous account** Birthed already creates on
/// first launch, `FR-010`, and never a sign in screen. Nothing ever sits in
/// front of reading, and the wall hangs off `profiles` through
/// `wall_joined_at`, which the database fills on the first write.
///
/// **App Attest guards writes only.** Once per install the device attests a
/// key; on every write it asserts. Both are checked by the `wall-write` Edge
/// Function, which then calls the database function as this account, and
/// the database consumes the grant the function wrote. A write that did not
/// come this way is refused by the database. The service role key is not in
/// this target and never will be; CLAUDE.md section 9 calls that an
/// incident.
///
/// **Server time decides.** `wall_clock` is asked before anything is drawn,
/// and the three open dates come from its answer. A buzz cast in the same
/// second a date closes is decided by the database's clock, never this
/// phone's.
///
/// **One tap is one unit and one story takes one buzz from one install.**
/// docs/the-wall.md section 4, as amended September 10, 2026, and section 14.
/// The budget itself is the database's, three on the date and one the day
/// after; this refuses early so a reader is not made to wait for a no.
///
/// **Which stories this account backed is remembered here, not fetched.**
/// `wall_boosts.booster_id` is revoked from this role on purpose, recorded
/// and not published, and `wall_units_left` answers with a number and
/// nothing else. `wall_web_standing` belongs to the website's browser token
/// and refuses an authenticated caller, so the app must not reach for it.
/// `HiveMarks` in the domain is the answer and `UserDefaults` is where it
/// lives, on the precedent of this account's own remembrance answers.
@Observable
final class WallService {

    // MARK: What the screen reads

    /// The wall for the date the Today tab is showing. Nil while loading, and
    /// nil for a date that has no wall at all.
    private(set) var day: WallDay?

    /// Which calendar date `day` belongs to, so a slow answer for one date
    /// is not drawn under the next.
    private var loadedFor: CalendarDate?

    /// Event pictures for the tiles on `day`, by `WallStory.pictureKey`.
    /// Empty until they arrive and on a date with none, which draws every
    /// tile as a plain cell. See `HivePicture` for which pictures and why.
    private(set) var pictures: [String: HivePicture] = [:]

    /// Units this account may still spend on `day`, by the server, or nil
    /// until the server has said. The only number the wall shows anybody
    /// before a date closes, and it is the reader's own.
    private(set) var unitsLeft: Int?

    /// Server time at the last read, and the phone's time then, so the phase
    /// can be worked out without asking again: server now is server-then plus
    /// however long has passed here.
    private var serverNow: Date?
    private var readAt: Date?

    /// Set when the wall could not be read at all.
    private(set) var failed = false

    /// Buzzes in flight, so a double tap is one request.
    private var ledger = WallBoostLedger()

    /// The stories this install has buzzed, by date. The mark on a tile and
    /// the reason a second tap on the same story spends nothing.
    private(set) var marks = HiveMarks()

    /// What this install knows about how its own buzzes turned out, by date.
    ///
    /// Written when a buzz lands and corrected every time that date is read,
    /// which is what lets the morning after notification be scheduled from
    /// what the phone already has and need no network at the moment it fires.
    /// docs/the-wall.md section 15.
    private(set) var notes = HiveNotes()

    /// The last refusal, in the reader's terms, for the sheet to show.
    private(set) var lastRefusal: String?

    /// The buzz that can still be taken back, and when it was cast.
    ///
    /// One at a time, and only the last one: docs/the-wall.md, the last entry
    /// in section 16, puts the button on the tile that was just tapped and
    /// nowhere else. A second buzz on another story replaces it, which is
    /// right, because the window on the first has all but run out by the time
    /// a reader has read another headline and decided about it.
    ///
    /// Not written to `UserDefaults`. A window this short does not survive
    /// the app being closed, and a button that came back on a tile a reader
    /// buzzed yesterday would be a lie the database would then have to tell
    /// them off for.
    private(set) var undoable: (storyID: String, castAt: Date)?

    /// What the screen says after an undo, in the reader's terms. Cleared by
    /// the next buzz or the next undo.
    private(set) var lastUndo: String?

    /// Whether the Undo button should be up for this story right now.
    ///
    /// The phone's own clock rather than the server's, on purpose: this
    /// measures a span of thirty seconds that began on this device a moment
    /// ago, and a span is the one thing a device's clock is reliable for. The
    /// database decides for real and this only decides what is drawn.
    func canUndo(_ story: WallStory, now: Date = Date()) -> Bool {
        guard let undoable, undoable.storyID == story.id else { return false }
        return HiveUndo.open(castAt: undoable.castAt, now: now)
    }

    // MARK: Setting up

    private let baseURL: URL
    private let anonKey: String
    private let session: URLSession
    private let account: AccountService
    private let attestor: WallAttestor
    private let defaults: UserDefaults

    /// Where this install's own buzzes are kept between launches.
    private static let marksKey = "birthed.hive.marks"

    /// And what became of them. A store of its own, shared with
    /// `NotificationService`, so the morning after reminder is built from the
    /// same rows this writes and no caller has to carry them across.
    private let noteStore: HiveNoteStore

    init(account: AccountService,
         baseURL: URL = Secrets.supabaseURL,
         anonKey: String = Secrets.supabaseAnonKey,
         session: URLSession = .shared,
         defaults: UserDefaults = .standard) {
        self.account = account
        self.baseURL = baseURL
        self.anonKey = anonKey
        self.session = session
        self.defaults = defaults
        self.attestor = WallAttestor()
        self.noteStore = HiveNoteStore(defaults: defaults)
        self.marks = Self.readMarks(from: defaults)
        self.notes = self.noteStore.load()
    }

    private static func readMarks(from defaults: UserDefaults) -> HiveMarks {
        guard let stored = defaults.dictionary(forKey: marksKey) as? [String: [String]] else { return HiveMarks() }
        return HiveMarks(stored: stored)
    }

    private func writeMarks() {
        defaults.set(marks.stored, forKey: Self.marksKey)
    }

    private func writeNotes() {
        noteStore.save(notes)
    }

    /// Server time now, as best this phone can say.
    var now: Date {
        guard let serverNow, let readAt else { return Date() }
        return serverNow.addingTimeInterval(Date().timeIntervalSince(readAt))
    }

    var phase: WallDay.Phase? {
        day?.phase(now: now)
    }

    /// The word this date uses for a unit. A handful of solemn dates speak
    /// plainly and every other date says buzz. `HiveDates` is the list.
    var voice: HiveVoice {
        if let day { return HiveDates.voice(for: day.wallDate) }
        if let loadedFor { return HiveDates.voice(for: loadedFor) }
        return .bee
    }

    /// What a fresh account would have on this date today: three on the date
    /// itself, one the day after, none before. The count sentence needs it to
    /// know whether to say "on this date".
    var allowance: Int {
        guard let day else { return 0 }
        return WallBudget.allowance(castOn: WallClock.easternDate(of: now), wallDate: day.wallDate)
    }

    /// What this install backed on the date being shown, in earlier years.
    ///
    /// docs/the-wall.md section 15. Read from what is already on the phone,
    /// so it costs no request: the note carries the headline, and the receipt
    /// for a story from an earlier year is still there. Shown to this install
    /// and to nobody else, and never as a number.
    var anniversaries: [HiveNote] {
        guard let date = day?.wallDate ?? loadedFor.flatMap({ calendar in
            // A date with no hive at all still has a year: today's, by the
            // server's clock, which is what an anniversary is measured back
            // from.
            WallDate(year: WallClock.easternDate(of: now).year, month: calendar.month, day: calendar.day)
        }) else { return [] }
        return notes.anniversaries(of: date)
    }

    /// True when this install has already buzzed the story, which is both the
    /// mark it shows and the reason another tap spends nothing.
    func hasBuzzed(_ story: WallStory) -> Bool {
        marks.has(storyID: story.id, on: story.wallDate)
    }

    /// The one feed under the hive: the reader's own timeline with the buzz
    /// hung off it, this year's news above it, and anything the worker filed
    /// that the timeline did not draw below it.
    func feed(items: [DayFeed.Item]) -> [HiveFeed.Row] {
        HiveFeed.build(items: items, stories: day?.stories ?? [])
    }

    // MARK: Reading

    /// Everything the wall for a date holds, and this account's units left.
    func load(date: CalendarDate) async {
        failed = false
        let clock = await readClock()
        if let clock {
            serverNow = clock
            readAt = Date()
        }
        let reference = clock ?? Date()

        // The open wall for this month and day, or the newest closed one.
        let wallDate: WallDate?
        if let open = WallClock.openWall(for: date, now: reference) {
            wallDate = open
        } else {
            wallDate = await newestWall(for: date)
        }
        guard let wallDate else {
            loadedFor = date
            day = nil
            unitsLeft = nil
            pictures = [:]
            return
        }

        // Two awaits in a row rather than two child tasks: both callees live
        // on the main actor, so children would carry nothing Sendable and
        // buy no time. The same reasoning DayPageView gives for its reload.
        let loaded = await readDay(wallDate)
        let left = await readUnitsLeft(wallDate)
        loadedFor = date
        failed = loaded == nil && !tableIsMissing
        day = loaded
        unitsLeft = left

        // After the board, never in front of it: a picture is decoration and
        // the tiles draw without one. A slow answer for an earlier date is
        // dropped rather than drawn on this one.
        let found = await readPictures(for: loaded)
        if loadedFor == date { pictures = found }

        // The reconciliation. A rank read while the hive was open can still
        // move and is corrected on the next read; one read after it sealed
        // cannot, and is written down as settled and never touched again.
        // This is why the notification's words are the freshest the phone has
        // seen rather than whatever was true at the moment of the buzz.
        if let loaded, notes.note(on: loaded.wallDate) != nil {
            let before = notes
            notes.reconcile(with: loaded, now: now)
            if notes != before { writeNotes() }
        }
    }

    /// The pictures for the history rows on a board, in one read. Its own
    /// request rather than `rows`, because a missing picture table is no
    /// pictures, not the missing wall that `tableIsMissing` records.
    private func readPictures(for day: WallDay?) async -> [String: HivePicture] {
        guard let day else { return [:] }
        let ids = Set(day.stories.compactMap { story -> String? in
            guard story.subjectKind == "historical_event", let id = story.subjectID,
                  !id.isEmpty, id.allSatisfy(\.isNumber) else { return nil }
            return id
        }).sorted()
        guard !ids.isEmpty else { return [:] }
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        components?.path = "/rest/v1/event_pictures"
        components?.percentEncodedQuery = "select=event_id,path,file,artist,license,commons_url"
            + "&path=not.is.null&event_id=in.(\(ids.joined(separator: ",")))"
        guard let url = components?.url else { return [:] }
        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 15
        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else { return [:] }
        var out: [String: HivePicture] = [:]
        for row in list {
            if let read = HivePicture.from(row: row, project: baseURL) { out[read.key] = read.picture }
        }
        return out
    }

    /// True after a read answered 404, which is the project before the wall
    /// migration ran: an empty wall, not an error.
    private var tableIsMissing = false

    private func readClock() async -> Date? {
        var request = URLRequest(url: baseURL.appending(path: "rest/v1/rpc/wall_clock"))
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data("{}".utf8)
        request.timeoutInterval = 10
        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return WallRows.date(object["now"])
    }

    private func rows(_ path: String) async -> [[String: Any]]? {
        // The path carries its own query, which `appending(path:)` would
        // escape, so it is set on the components instead.
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        let parts = path.split(separator: "?", maxSplits: 1).map(String.init)
        components?.path = "/rest/v1/" + (parts.first ?? "")
        components?.percentEncodedQuery = parts.count > 1 ? parts[1] : nil
        guard let url = components?.url else { return nil }
        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 15
        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse
        else { return nil }
        if http.statusCode == 404 {
            tableIsMissing = true
            return []
        }
        guard (200..<300).contains(http.statusCode),
              let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else { return nil }
        return list
    }

    /// The newest wall for a month and day that is not open right now: the
    /// year drawn on a closed date, the way the website draws it.
    private func newestWall(for date: CalendarDate) async -> WallDate? {
        guard let list = await rows("wall_days?select=wall_date&order=wall_date.desc&limit=2000") else { return nil }
        return list
            .compactMap { ($0["wall_date"] as? String).flatMap(WallDate.init(key:)) }
            .first { $0.month == date.month && $0.day == date.day }
    }

    private func readDay(_ wallDate: WallDate) async -> WallDay? {
        guard let days = await rows("wall_days?select=wall_date,opens_at,live_at,closes_at,closed_at&wall_date=eq.\(wallDate.key)"),
              let dayRow = days.first
        else { return nil }
        // priority, subject_kind and subject_id are the history migration's,
        // and they are what lets the timeline and the hive be one feed.
        let select = "id,wall_date,submitted_at,headline,url,outlet,status,tier,support,placed_at,anchor_mx,anchor_my,w_modules,h_modules,false_at,false_note,priority,subject_kind,subject_id,"
            + "wall_sources(id,story_id,url,outlet,owner,headline,quotation,verified_at,added_at,is_primary_doc,wall_checks(source_id,checked_at,kind,passed,http_status,detail))"
        guard let storyRows = await rows("wall_stories?select=\(select)&wall_date=eq.\(wallDate.key)&order=submitted_at.asc,id.asc&wall_sources.order=added_at.asc&wall_sources.wall_checks.order=checked_at.asc")
        else { return nil }
        return WallRows.day(dayRow, stories: storyRows.compactMap(WallRows.story))
    }

    private func readUnitsLeft(_ wallDate: WallDate) async -> Int? {
        guard let token = await account.freshAccessToken() else { return nil }
        var request = URLRequest(url: baseURL.appending(path: "rest/v1/rpc/wall_units_left"))
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["wall_date_in": wallDate.key])
        request.timeoutInterval = 10
        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let text = String(data: data, encoding: .utf8), let value = Int(text.trimmingCharacters(in: .whitespacesAndNewlines))
        else { return nil }
        return value
    }

    /// One story, read again, for the sheet after a boost or a submission.
    func story(_ id: String) -> WallStory? {
        day?.stories.first { $0.id == id }
    }

    // MARK: Writing

    enum WriteError: LocalizedError {
        case refused(String)
        case notReady

        var errorDescription: String? {
            switch self {
            case let .refused(line): return line
            case .notReady: return "The account is not ready yet. Try again in a moment."
            }
        }
    }

    /// Submits a pasted link to the wall for a date. What comes back is what
    /// the server extracted, and the headline in it cannot be edited.
    func submit(url: URL, wallDate: WallDate) async throws -> WallSubmitPreview {
        let payload: [String: Any] = ["action": "submit", "url": url.absoluteString, "wall_date": wallDate.key]
        let result = try await write(payload)
        guard let storyRow = result["story"] as? [String: Any], let story = WallRows.story(storyRow) else {
            throw WriteError.refused(HiveCopy.refusal("unreadable answer", voice: voice))
        }
        let existing = (result["existing"] as? Bool) ?? false
        return WallSubmitPreview(story: story, existing: existing)
    }

    // MARK: Find it for me

    /// Asks the `hive-find` Edge Function for a source, on an explicit tap
    /// and never on a keystroke. docs/the-wall.md section 15, past the miss.
    ///
    /// **What leaves the phone is `HiveFind.Request.body` and nothing else**:
    /// the words and the date. The account's token goes in the header, the
    /// same way it does for every write, because a search costs money and
    /// the key alone ships inside the app. No birthday, no region, no name.
    /// The function stores no words; it stores that this account ran one
    /// search on this date, which is what gives it five a day.
    ///
    /// Nothing here files anything. What comes back is a list of pages for
    /// the reader to pick from, and the pick goes through `submit(url:)`
    /// like a pasted link, so the story gets the same receipt from the same
    /// fetched page.
    ///
    /// A refusal is thrown in the reader's terms. "paused" is not one: it is
    /// an outcome, because the date and the reader have done nothing wrong.
    func find(_ request: HiveFind.Request) async throws -> HiveFind.Outcome {
        lastRefusal = nil
        guard let token = await account.freshAccessToken() else { throw WriteError.notReady }
        var urlRequest = URLRequest(url: baseURL.appending(path: "functions/v1/hive-find"))
        urlRequest.httpMethod = "POST"
        urlRequest.setValue(anonKey, forHTTPHeaderField: "apikey")
        urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONSerialization.data(withJSONObject: request.body)
        // Two model calls and up to four page reads. Well under a minute
        // usually; the ceiling is for the page that will not answer.
        urlRequest.timeoutInterval = 90
        let (data, response) = try await session.data(for: urlRequest)
        let object = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw refuse((object["error"] as? String) ?? "search did not answer")
        }
        return HiveFind.outcome(status: object["status"] as? String, rows: object["candidates"] as? [[String: Any]])
    }

    /// Spends one buzz on a story.
    ///
    /// One tap is one unit, docs/the-wall.md section 4. One story takes one
    /// buzz from one install, section 14, which is the website's rule and is
    /// enforced here rather than by the database: the database counts units
    /// against the day's budget and does not care which story they land on.
    /// The trade is the website's too. This install is what is known; a
    /// reinstall forgets, and the buzz itself is in the database either way.
    ///
    /// Idempotent twice over. A second tap while the first is in flight sends
    /// the same request identifier and the database returns the first buzz
    /// for it rather than making a second, and a tap on a story this install
    /// has already buzzed never leaves the phone.
    @discardableResult
    func buzz(story: WallStory) async throws -> Int {
        if hasBuzzed(story) {
            // Not a refusal to report. The button on a story already buzzed
            // is the mark, so this is a tap that should not have been offered.
            return story.support
        }
        if let left = unitsLeft, !WallBudget.canSpend(1, left: left) {
            let line = HiveCopy.allowance(left, allowance: allowance, phase: phase ?? .live, voice: voice)
            lastRefusal = line
            throw WriteError.refused(line)
        }
        let requestID = ledger.begin(storyID: story.id)
        defer { ledger.finish(storyID: story.id) }
        let payload: [String: Any] = [
            "action": "boost", "story_id": story.id, "units": 1, "request_id": requestID.uuidString.lowercased(),
        ]
        let result = try await write(payload)
        if let left = result["units_left"] as? Int { unitsLeft = left }
        // Written down only once the database has taken it, so a refused tap
        // does not leave a mark on a story nobody backed.
        marks.add(storyID: story.id, on: story.wallDate)
        writeMarks()
        // And the note the morning after is built from, filed here rather
        // than at fire time, because at fire time there is no network and
        // there should not need to be. The rank is not written yet: it is not
        // a fact until the hive seals, and reading the date fills it in.
        // docs/the-wall.md section 15.
        if let day, day.wallDate == story.wallDate {
            notes.record(storyID: story.id, headline: story.headline, on: story.wallDate, sealsAt: day.closesAt)
            notes.reconcile(with: day, now: now)
            writeNotes()
        }
        // The window opens when the database says the buzz landed, not when
        // the finger went down, so a slow write does not eat it.
        undoable = (storyID: story.id, castAt: Date())
        lastUndo = nil
        return (result["support"] as? Int) ?? story.support
    }

    /// Takes one buzz back, inside its thirty second window.
    ///
    /// docs/the-wall.md, the last entry in section 16. The window, the caller
    /// match and the sealed check all live in `wall_forget_boost`, so there is
    /// nothing here to get out of step with them, and this refuses early only
    /// where it already knows the answer.
    ///
    /// An app write like any other: it goes through `wall-write`, which is
    /// what makes it attested, and it consumes the grant that function writes.
    /// The database answers in one word rather than raising, so a refusal is a
    /// sentence for the reader rather than an error, and `too_late` is not a
    /// failure: the buzz simply stands.
    @discardableResult
    func undo(story: WallStory) async throws -> String {
        guard canUndo(story) else {
            let line = HiveCopy.tooLate(voice: voice)
            lastUndo = line
            return line
        }
        let payload: [String: Any] = ["action": "unboost", "story_id": story.id]
        let result = try await write(payload)
        let said = (result["result"] as? String) ?? ""
        // The mark comes off only on the word that says the row is gone. Any
        // other word leaves the buzz where it is, and so leaves the mark.
        if said == "undone" {
            marks.remove(storyID: story.id, on: story.wallDate)
            writeMarks()
            // A note about a buzz that no longer exists would wake somebody
            // two mornings later to tell them about a vote they took back.
            notes.forget(storyID: story.id, on: story.wallDate)
            writeNotes()
            undoable = nil
            lastUndo = HiveCopy.undone(voice: voice)
        } else {
            // Every other word means it stands, and the window is over either
            // way: the button comes down rather than inviting a second no.
            undoable = nil
            lastUndo = said == "closed"
                ? HiveCopy.allowance(0, allowance: 0, phase: .closed, voice: voice)
                : HiveCopy.tooLate(voice: voice)
        }
        return lastUndo ?? ""
    }

    func isBuzzing(_ story: WallStory) -> Bool {
        ledger.isInFlight(storyID: story.id)
    }

    /// The whole write path: a challenge, an attestation if the device has
    /// none yet, an assertion over the challenge and the request, and the
    /// Edge Function's answer.
    private func write(_ action: [String: Any]) async throws -> [String: Any] {
        lastRefusal = nil
        guard let token = await account.freshAccessToken() else { throw WriteError.notReady }

        // The payload is hashed byte for byte with the challenge, and the
        // server hashes the exact string it receives, so it is serialised
        // once and sent as that string.
        let payloadData = try JSONSerialization.data(withJSONObject: action, options: [.sortedKeys])
        guard let payloadText = String(data: payloadData, encoding: .utf8) else { throw refuse("could not be verified") }

        do {
            // Once per install. A challenge of its own, used by the attestation.
            try await attestor.ensureAttested(challengeIssuer: { [self] in
                let fresh = try await self.call(["kind": "challenge"], token: token)
                guard let text = fresh["challenge"] as? String, let bytes = Data(base64Encoded: text) else { throw self.refuse("could not be verified") }
                return (text, bytes)
            }, register: { [self] keyID, attestation, challengeText in
                _ = try await self.call(["kind": "attest", "key_id": keyID, "attestation": attestation, "challenge": challengeText], token: token)
            })

            // Then a challenge for this write, used once, within two minutes.
            let challenge = try await call(["kind": "challenge"], token: token)
            guard let challengeText = challenge["challenge"] as? String, let challengeBytes = Data(base64Encoded: challengeText) else {
                throw refuse("could not be verified")
            }
            let assertion = try await attestor.assert(challenge: challengeBytes, payload: Data(payloadText.utf8))
            return try await call([
                "kind": "write", "key_id": assertion.keyID, "assertion": assertion.assertion,
                "challenge": challengeText, "payload": payloadText,
            ], token: token)
        } catch let error as WallAttestor.Failure {
            let line = HiveCopy.refusal(error.message, voice: voice)
            lastRefusal = line
            throw WriteError.refused(line)
        }
    }

    private func refuse(_ message: String) -> WriteError {
        let line = HiveCopy.refusal(message, voice: voice)
        lastRefusal = line
        return .refused(line)
    }

    /// One call to the Edge Function. A refusal comes back as the server's
    /// own sentence, turned into the reader's.
    private func call(_ body: [String: Any], token: String) async throws -> [String: Any] {
        var request = URLRequest(url: baseURL.appending(path: "functions/v1/wall-write"))
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 30
        let (data, response) = try await session.data(for: request)
        let object = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let message = (object["error"] as? String) ?? "refused"
            throw refuse(message)
        }
        return object
    }
}

// MARK: - App Attest on the device

/// The device's half of App Attest. One key per install, kept by identifier
/// in the keychain, attested once, asserting on every write.
///
/// The Secure Enclave holds the private key; this type only ever sees its
/// identifier. Not supported on the simulator, in which case every write
/// fails with one plain sentence and reading is unaffected.
final class WallAttestor {
    struct Failure: Error {
        let message: String
    }

    struct Assertion {
        let keyID: String
        /// The CBOR assertion, base64.
        let assertion: String
    }

    private static let keyIDKey = "wall_attest_key_id"
    private static let attestedKey = "wall_attest_done"

    private let service = DCAppAttestService.shared

    /// Makes and attests a key when this install has none. `challengeIssuer`
    /// fetches a challenge from the server; `register` sends the attestation.
    func ensureAttested(
        challengeIssuer: () async throws -> (text: String, bytes: Data),
        register: (String, String, String) async throws -> Void
    ) async throws {
        guard service.isSupported else {
            throw Failure(message: "could not be verified: App Attest is not supported on this device")
        }
        if let existing = Keychain.get(Self.keyIDKey), Keychain.get(Self.attestedKey) == existing {
            return
        }
        let keyID = try await generateKey()
        let challenge = try await challengeIssuer()
        let clientDataHash = Data(SHA256.hash(data: challenge.bytes))
        let attestation: Data
        do {
            attestation = try await service.attestKey(keyID, clientDataHash: clientDataHash)
        } catch {
            throw Failure(message: "could not be verified: \(error.localizedDescription)")
        }
        try await register(keyID, attestation.base64EncodedString(), challenge.text)
        Keychain.set(keyID, for: Self.keyIDKey)
        Keychain.set(keyID, for: Self.attestedKey)
    }

    private func generateKey() async throws -> String {
        do {
            let keyID = try await service.generateKey()
            Keychain.set(keyID, for: Self.keyIDKey)
            Keychain.remove(Self.attestedKey)
            return keyID
        } catch {
            throw Failure(message: "could not be verified: \(error.localizedDescription)")
        }
    }

    /// An assertion over the challenge followed by the payload, which is
    /// exactly what the server hashes.
    func assert(challenge: Data, payload: Data) async throws -> Assertion {
        guard let keyID = Keychain.get(Self.keyIDKey), Keychain.get(Self.attestedKey) == keyID else {
            throw Failure(message: "not been attested")
        }
        var clientData = Data()
        clientData.append(challenge)
        clientData.append(payload)
        let clientDataHash = Data(SHA256.hash(data: clientData))
        do {
            let assertion = try await service.generateAssertion(keyID, clientDataHash: clientDataHash)
            return Assertion(keyID: keyID, assertion: assertion.base64EncodedString())
        } catch let error as DCError where error.code == .invalidKey {
            // The key is gone, which happens after a restore to a new phone.
            // Forget it so the next write attests afresh.
            Keychain.remove(Self.keyIDKey)
            Keychain.remove(Self.attestedKey)
            throw Failure(message: "could not be verified: the key is no longer valid, try again")
        } catch {
            throw Failure(message: "could not be verified: \(error.localizedDescription)")
        }
    }
}
