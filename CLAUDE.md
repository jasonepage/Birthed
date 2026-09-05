# Birthed: working instructions

Read this before doing anything in this repository. It is the handoff document for a fresh session.

---

## 1. What Birthed is, in five lines

An iOS app about birthdays. The core object is the **calendar day**, not the user. A day page shows who was born on that date, what happened on it, and what rewards are available to people born on it. The user's own day adds a countdown, a checklist of what they must do to qualify for birthday rewards, and on the day itself, a plan. Identity content is free and is the front door. Reward qualification is paid and is the retention engine.

**The one sentence that decides arguments:** Famous Birthdays tells you who was born today, Freebird tells you what is free, Birthed is the only one that knows the day is yours.

---

## 2. Read these, in this order

1. `PRD.md` sections 5, 10, 11 for what the product is and, more importantly, what it refuses to be. Section 4.4 if you want to know why the direction is what it is.
2. `SRS.md` for numbered requirements. Every feature traces to an `FR-nnn`. Cite them in commit messages.
3. `SDS.md` sections 5, 6, 7 before writing a single line of date or qualification code. These three sections contain the entire correctness risk of the product.
4. `docs/research/reward-terms.md` section B if you touch the reward schema. It is 30 real rule categories pulled from real brand terms, and it is why the schema looks the way it does.

Do not re-derive product decisions. They are made. Section 5 below lists them.

---

## 3. The stack

### iOS application

| Piece | Choice | Note |
|---|---|---|
| Language | Swift 6 | Strict concurrency on |
| Interface | SwiftUI | `@Observable`, not `ObservableObject` |
| Minimum target | iOS 17.0 | Buys Observation, SwiftData, current WeatherKit |
| Local storage | SwiftData | Cache only. Never in the Domain layer |
| Backend client | `supabase-swift` via Swift Package Manager | Official Supabase package. Slice 1 reads the REST interface with `URLSession` instead, because it has no accounts and no realtime, so the package would add a dependency and buy nothing. It arrives in slice 2 with the anonymous account, and replaces one file |
| Payments | StoreKit 2 | One annual auto-renewing subscription. No receipt server |
| Weather | WeatherKit | Included with the developer program. Degrees Fahrenheit only |
| Maps | MapKit, `MKLocalSearch` | Nearest branch only. **It does not return store hours**, see section 6 |
| Notifications | `UNUserNotificationCenter`, local only | No push infrastructure in version 1.0 |

### Backend

| Piece | Choice | Note |
|---|---|---|
| Database | Supabase Postgres | Schema in `SDS.md` section 6 |
| Auth | Supabase anonymous sign-in, plus Sign in with Apple later | Silent, no sign-in screen ever |
| Authorization | Row level security | Policies in `SDS.md` section 6.6 |
| Light scheduled jobs | Supabase Edge Functions, Deno and TypeScript | Short tasks only |
| Migrations | Supabase CLI, checked into `supabase/migrations/` | Never edit the database by hand |

### Pipeline worker

| Piece | Choice | Note |
|---|---|---|
| Runtime | Node 22 and TypeScript | |
| Container | Docker | |
| Hosting | Render, as a scheduled Cron Job | Nightly |
| Page fetching | plain request first, Playwright with headless Chromium on failure | |
| Extraction | Anthropic API | Must return verbatim quotations, see section 6 |

**Why there is a separate worker instead of only Edge Functions.** Two of the fourteen brands in our own research, Firehouse Subs and Texas Roadhouse, have terms pages that only exist after JavaScript runs. Reading them needs a headless browser, which needs hundreds of megabytes of Chromium and a long-lived process. Edge Functions cannot host that. Everything else stays in Supabase.

### Deliberately not used

Redis. A message queue. A separate application server. Firebase. CloudKit. Any paid places or business-hours data service. Third party analytics. Advertising software development kits. If you find yourself reaching for one of these, the answer is almost certainly no.

---

## 4. Repository layout

The Xcode project already exists. Create the rest as you go.

```
Birthed.xcodeproj
Birthed/
  App/                  BirthedApp.swift, root TabView
  Domain/               PURE SWIFT. Imports Foundation and nothing else.
    BirthdayCalendar.swift
    QualificationEngine.swift
    DayPlanBuilder.swift
    CycleCalculator.swift
    Models/             plain structs, no @Model, no Codable-to-database
  Data/
    Supabase/           client, generated types, sync coordinator
    Persistence/        SwiftData @Model types, cache policies
    Mapping/            persistence and network types into Domain values
  Features/
    DayPage/  MyDay/  Catalog/  DayPlan/  Settings/
  Resources/            bundled seed content, assets
BirthedTests/
  DomainTests/          the tests that actually matter
supabase/
  migrations/
  functions/
worker/
  Dockerfile
  src/
docs/research/
PRD.md  SRS.md  SDS.md  CLAUDE.md
```

**The Domain folder is load-bearing.** Nothing in it may import SwiftUI, SwiftData, MapKit, WeatherKit, or a networking library. If a type in Domain needs data, it takes it as a parameter. This is what makes exhaustive testing possible without a simulator.

**Running the domain tests.** `Package.swift` at the repository root points a Swift package target at `Birthed/Domain` and a test target at `BirthedTests/DomainTests`, so the tests run from a terminal with no Xcode target and no package linked into the app:

```
swift test
```

The app compiles the same files through the synchronised folder in the Xcode project. Two build systems, one set of sources, on purpose: the domain carries nearly all of the correctness risk and it needs a feedback loop measured in seconds. If a domain file ever imports a framework, `swift test` is what fails first.

---

## 5. Decided. Do not relitigate

### Direction change, September 5, 2026

**Identity is the product now, not the front door to a rewards business.**
Growth first, revenue later. Three pieces of our own research pointed the same
way and were being ignored: Famous Birthdays' traffic behaves like search
rather than habit, at 2.91 pages and 78 seconds a visit; the proven money in
birthdays is other people's birthdays, where hip holds 270 times the entire
freebie category's ratings; and a subscription aimed at people who organise
their year around free things is the hardest sale available.

What this changes:

- **The 150 brand catalog is cut.** The schema and the qualification engine are
  built and tested and stay in the repository, unused, because they cost
  nothing to keep and re-deriving them would cost weeks. No catalog build-out.
- **No paywall.** Slice 7 is off. Everything is free until there is a reason to
  charge for something.
- **Distribution is the work.** Date pages on birthed.app for search, short
  form video for reach. They compound: video points at pages, pages keep
  working after the video stops, and one script fills both from the same data.
- **The day page being good is now the entire product.** Whoever appears at the
  top of September 4 is not a tuning detail any more. It is the thing.

The reward specifications in `PRD.md` sections 10.3 to 10.6, `SRS.md` sections
6 and 7, and `SDS.md` sections 6.3 and 7 are accurate and unbuilt. Treat them
as a shelf, not a plan.

- **Name** is Birthed. Domain is birthed.app. Bundle identifier `app.birthed.ios`.
- **Identity content is the front door, rewards are the retention engine.** Not the other way round.
- **No user-to-user contact of any kind** in version 1.0. No messaging, matching, rooms, feeds, following, or wishes. `PRD.md` section 4.4 has the evidence, which is three shipped competitors with two combined ratings.
- **Silent anonymous account** on first launch. No sign-in wall in front of anything, ever.
- **50 or more brands at the Verified tier is the gate to ship.** The catalog grows toward 150 or more after launch, published from the server with no application release, per `FR-138` and `FR-052a`. The three-tier confidence model, Verified, Reported and Unconfirmed, is unchanged. Unconfirmed offers ship, clearly marked, with qualification tracking switched off.
- **Full day plan** with weather and routing is in version 1.0.
- **Identity content from Wikidata**, not Wikipedia article text, for licensing reasons in `SDS.md` section 8.1. **Credit both anyway.**
- **No celebrity photographs** in version 1.0. Names, years and descriptions only.
- **App Store category:** Finance primary, Lifestyle secondary.
- **The profile is stored in `UserDefaults`, not SwiftData.** It is five scalars, not a cache, and `SDS.md` section 4 reserves SwiftData for the catalog and the day pages. The session token is in the keychain, because it is a bearer credential.
- **`twin_count` is deliberately callable by the anonymous role.** Supabase's security advisor flags every `security definer` function that anonymous clients can execute, and it is right to. This one is intentional: it is the only way `FR-026` can return a count without exposing anybody's row, the privacy floor from `NFR-033` is applied inside it, and its search path is pinned. Do not "fix" the warning by revoking execute, or the twin count stops working.
- **Free tier:** all identity content, the birthday morning notification (`FR-073`), one summary notification 45 days out (`FR-072`), and the day plan during the user's first birthday window only (`FR-141b`). **Paid tier:** qualification tracking, the per offer deadline ladder (`FR-071`), the day plan in every later cycle, and the catalog beyond a curated free 15.

---

## 6. Rules that prevent specific known bugs

Each of these exists because of something real, not as a style preference.

**Never use `UNTimeIntervalNotificationTrigger`.** Use `UNCalendarNotificationTrigger` built from `DateComponents` including hour and minute. An interval trigger scheduled 40 days out lands an hour off if daylight saving changes in between. A competitor's public reviews contain exactly this complaint.

**Never use `addingTimeInterval` for day arithmetic.** Use `calendar.date(byAdding: .day, value:to:)`. Some days are 23 or 25 hours long.

**Resolve February 29 at read time, never at write time.** The stored birthday stays February 29 forever. The observance setting is consulted every time the next occurrence is computed. And when scheduling the birthday notification, build the trigger from the **observed** date, not the stored one, or a February 29 user gets no notification in three years out of four.

**A calendar birthday is two integers, `birth_month` and `birth_day`.** Never a `Date`, never a timestamp, never passed through a time zone.

**No reward rule may exist without the sentence from the source that supports it.** `offer_rules.source_quote` is `not null` with a minimum length. The extraction pipeline checks every quotation by exact string match against the archived page before a human ever sees it. A model that paraphrases produces a quotation that is not present, and the row is discarded. This is the single most important control in the system.

**The app never states a rule the source did not state.** Where information is absent, display "Not stated by the brand." Never display an assumed default.

**Never send precise coordinates to the Birthed backend.** Location is used on device and passed to WeatherKit only.

**MapKit does not expose store hours.** This is verified, not assumed. Typical hours live on the `brands` row, curated by the pipeline, and must be labeled in the interface as typical for the brand rather than confirmed for that location.

**Row level security is enabled on every table in the public schema, with no exceptions.** A policy written against a table that does not have it enabled does nothing at all, and Supabase publishes every public table through its automatic interface to the anonymous key that ships inside the app. Tables nothing should read, such as `events` and `terms_snapshots`, get row level security enabled and no policy, so only the service role can touch them.

**Read birth date precision from the full statement, never from the truthy property.** Wikidata stores a birth date known only to the year as January 1 of that year with a precision value of 9. The truthy property `wdt:P569` hands that value back with no precision attached, so a month and day filter over it would put every year-only person on January 1. The importer walks `p:P569/psv:P569` and requires `wikibase:timePrecision` of 11.

**A collection anchored redemption window has no end date until collection is recorded.** Dutch Bros runs 30 days from the day the reward was collected, which on the birthday morning has not happened yet. The window stays open until a collection date exists, and only then does the clock start. Anchoring it to the birthday instead drops the reward out of the day plan on the one day it is certainly available.

**`CycleCalculator` is the only thing that decides `cycle_year`.** Carry-over requirements are written under the sentinel 0 and annually recurring ones under the real cycle year, and that choice comes from the offer's rules. Duplicating the decision anywhere else is how an annual requirement silently becomes permanent.

---

## 7. Slice 1, the current task

**One calendar date, end to end.** Nothing else.

Build:

1. A Supabase project with `notable_people` and `historical_events`, created through a checked-in migration.
2. A worker script that pulls people born on September 4 from the Wikidata query service and upserts them.
3. An iOS day page that fetches and renders September 4: names, years, descriptions, and visible attribution.
4. A share image rendered on device with `ImageRenderer`.

Do **not** build in this slice: accounts, offers, the catalog, notifications, the day plan, the paywall, or the other two tabs.

**Acceptance criteria**

- The migration runs clean on a fresh database.
- The importer inserts more than 10 rows for September 4, every row has a source and a license recorded, and no row has a birth date lacking day precision.
- The day page renders in under 2 seconds from the network. The 300 millisecond figure in `NFR-011` is not a slice 1 criterion, because slice 1 builds no cache.
- The share image generates with the network disabled.
- Attribution to Wikipedia and Wikidata is reachable within two taps.

**Starting query, expected to need tuning.** This filters every entity carrying a date of birth, which will likely time out on the public endpoint. If it does, the fallbacks are to narrow by sitelink count first, to slice by birth year, or to import from a Wikidata dump instead. **Test this before assuming the plan works.** It is open technical question 1 in `SDS.md` section 17 and it is the only unknown that could change the approach.

```sparql
SELECT ?person ?personLabel ?personDescription ?birth ?death ?sitelinks WHERE {
  ?person wdt:P569 ?birth .
  ?person wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks > 20)
  FILTER(MONTH(?birth) = 9 && DAY(?birth) = 4)
  OPTIONAL { ?person wdt:P570 ?death . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT 50
```

`P569` is date of birth and `P570` is date of death. Send a descriptive user agent with contact information, and respect the endpoint's rate limits.

**The likely fix if it times out.** `MONTH()` and `DAY()` are computed over every entity in Wikidata carrying a birth date, which cannot use an index, against a 60 second limit. Stop computing them. Bind exact dates instead: one query per calendar date carrying a `VALUES` list of roughly 150 exact year values, which the index serves directly. Untested as of this writing, so test it before anything else. The shipped importer also reads precision from `p:P569/psv:P569` rather than from `wdt:P569`, for the January 1 reason in section 6.

---

## 8. Then, in order

**Slice 2.** The Domain module and its full test suite from `SRS.md` NFR-003, plus onboarding, the anonymous account and the countdown. Nothing here is visually hard, and every future date bug is prevented in this slice.

**Slice 3.** Three offers with deliberately different rule shapes: **Starbucks** for advance signup plus an annually recurring prior purchase plus a tier-dependent window, **Sephora** for a birthday-month anchor plus per-channel minimum spend, and **Dutch Bros** for an app requirement plus a window anchored to collection rather than to the birthday. Full schema, qualification engine, catalog screen. If the model handles these three it handles the other 147.

**Slice 4.** The notification ladder on top of slice 3.

**Slice 5.** The pipeline worker and the catalog build-out. Review the first 20 brands in the Supabase table editor. Build a purpose-made review screen only past roughly 100 rules.

**Slice 6.** The day plan, including hours, `MKLocalSearch` and WeatherKit.

**Slice 7.** Entitlements, paywall, submission.

---

## 9. Setup

Environment variables, never committed:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=            # iOS app, safe to ship
SUPABASE_SERVICE_ROLE_KEY=    # worker only, never in the app
ANTHROPIC_API_KEY=            # worker only
```

The iOS app uses only the anonymous key and relies on row level security. **If the service role key ever appears in the app target, that is a security incident, not a bug.**

**Where each one lives.** The worker reads them from `worker/.env`, which is gitignored, and `worker/.env.example` shows the shape. The iOS app reads them from `Birthed/Config/Secrets.swift`, which is also gitignored, and which is one enum:

```swift
enum Secrets {
    static let supabaseURL = URL(string: "https://<project>.supabase.co")!
    static let supabaseAnonKey = "<anonymous key>"
}
```

**The project.** Supabase project `Birthed`, reference `lunqqhjwqrpbujwxwdzk`, region us-west-1, created September 4, 2026. Neither the reference nor the project address is secret. The keys are in the dashboard under Project Settings, API Keys.

Apple capabilities needed: WeatherKit, Sign in with Apple, Push Notifications not required.

---

## 10. House rules for anything written

- **No em dashes.** Not in code comments, not in commit messages, not in user-facing copy, not in documentation. Use commas, colons or separate sentences.
- **Write out an abbreviation before using it.** "Uniform resource locator" before "URL", and prefer the plain full term throughout.
- **Degrees Fahrenheit only.** Never Celsius.
- **Cite requirement identifiers in commits**, for example `feat(dayplan): order by redemption window close (FR-092)`.
- **Say what is unknown rather than guessing.** If a design question is not answered in the specs, ask rather than inventing an answer and burying it in code.
- **Ask Jason before writing code in this repository**, even when the work was requested. He has approved slice 1.

---

## 11. Where the risk actually is

Not in SwiftUI. Four pure Swift types carry nearly all of the product's correctness risk: `BirthdayCalendar`, `QualificationEngine`, `DayPlanBuilder` and `CycleCalculator`. They have no dependencies and no excuses. Test them exhaustively.

The other risk is not code at all. It is the freshness of the reward catalog, against brands that explicitly reserve the right to change their terms without notice. The controls are automatic downgrade after 180 days, the archived-page change watcher, and one-tap problem reports from users. If those decay, the product's only real differentiator goes with them.
