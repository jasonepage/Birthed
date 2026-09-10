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
- **Today, Mine, People.** `FR-015` named Today, Mine and Me. Me was a settings
  form, and a tab is a place you go while settings is a thing you do once and
  leave, so it is a cog in the toolbar. People took the slot, because other
  people's birthdays are the only mechanic in this category that produces a
  recurring reason to open the app: yours comes round once a year, somebody
  you know has one most weeks. It also reverses the deferral of friends to
  version 1.5 in `PRD.md` section 12, deliberately.
- **No second button to make the first one work.** A row showing a value with a
  "Change" button under it is two controls doing one control's job. The row is
  the control, text is edited in place and saved as you type, and a screen
  whose every state is valid has nothing to confirm and nothing to cancel.
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
- **App Store category:** Lifestyle primary. Finance was the primary in the rewards era and is wrong now; the secondary is still set to Finance in App Store Connect and should become Entertainment, which is where this audience browses and where Famous Birthdays sits. Reference is the alternative, less crowded and easier to chart in.
- **The profile is stored in `UserDefaults`, not SwiftData.** It is five scalars, not a cache, and `SDS.md` section 4 reserves SwiftData for the catalog and the day pages. The session token is in the keychain, because it is a bearer credential.
- **`twin_count` is deliberately callable by the anonymous role.** Supabase's security advisor flags every `security definer` function that anonymous clients can execute, and it is right to. This one is intentional: it is the only way `FR-026` can return a count without exposing anybody's row, the privacy floor from `NFR-033` is applied inside it, and its search path is pinned. Do not "fix" the warning by revoking execute, or the twin count stops working.
- **Free tier:** all identity content, the birthday morning notification (`FR-073`), one summary notification 45 days out (`FR-072`), and the day plan during the user's first birthday window only (`FR-141b`). **Paid tier:** qualification tracking, the per offer deadline ladder (`FR-071`), the day plan in every later cycle, and the catalog beyond a curated free 15.

### The number one song, decided September 5, 2026

- **A chart week is the first issue dated on or after the birth date, and no more than six days after it.** Billboard's issue date is not the week it measured: the tracking week ends more than a week before the date printed on the cover, and the convention has changed several times since 1958. There is no rule here that is true in every sense, so the app picks the simple one, shows the issue date next to the song, and lets the reader check it. `ChartWeek.covers` enforces the six days, and it is not decoration: the server is asked for the first chart on or after a date and always answers, so without it a 1943 birthday gets the January 1959 chart presented as fact.
- **1958 is not imported.** The Hot 100 began with the issue dated August 4, 1958, but that year's Wikipedia page redirects to a combined article carrying several different charts, and guessing which table is the Hot 100 could file the Best Sellers number one under the wrong name. A 1958 birthday shows no song. Absent beats wrong.
- **Chart facts are parsed from Wikipedia's rendered HTML, not its wikitext.** Sixty years of year lists were written by hundreds of people using different templates in different decades, and the rendered HTML is what all of those expand to. The reader in `worker/src/html.ts` fills in rowspans, which is not optional: the tables write a song once and span it down its whole run.
- **Which record was number one on a given date is a fact and cannot be owned.** The compiled list is Wikipedia's, under Creative Commons Attribution ShareAlike, and every row carries the page it came from. Birthed is not affiliated with Billboard, Penske Media or Wikipedia.

### Reminders, decided September 5, 2026

- **`FR-072` loses its offers.** It asked for a notification 45 days out "summarizing how many offers need action", and the catalog is cut. The 45 day run up survives as a plain countdown, because six weeks is still about when somebody starts making plans, but it counts nothing.
- **A notification type the `SRS` does not have: other people's birthdays.** Everybody in the People tab gets one on the day and one three days before. This is the retention loop for the product the pivot actually chose, and the research the pivot came from said so: the money in birthdays is other people's birthdays. Three days is chosen to be long enough to order something and have it arrive.
- **The fire time is date components with no time zone.** That is `FR-074` and `FR-075` satisfied by never converting to an instant: components without a zone are resolved by the device at fire time, so eight in the morning survives a flight and a daylight saving change. A test asserts the time zone is absent, because adding one back would look like a fix.
- **The plan is trimmed to 64, soonest first, and the user's own birthday is never trimmed.** iOS keeps 64 pending requests and silently drops the rest. A crowded People tab must not push somebody's own birthday off their own phone.
- **The notification centre is called through its completion handler methods, not its async ones.** `UNNotificationSettings` and `UNNotificationRequest` are not `Sendable`, and this target builds with `MainActor` default isolation, so awaiting them hands a non-`Sendable` object across an actor boundary. Resuming a continuation with only the enum, or only the count, is the fix. Do not "simplify" these back to `await`.
- **The user's own switch is stored separately from the system permission.** Revoking permission in the iOS Settings app must not be silently re-enabled the next time the app opens.

### What the app tells the user about their data, decided September 5, 2026

- **The birthday, the birth year and the region are all sent to the Birthed account.** `AccountService.pushProfile` writes all three into `profiles`. Onboarding used to say the year "is never sent to anyone else", which was false. Copy anywhere in the product may say that nothing shared out of the app carries the year, which `ShareCardView` enforces, and that the device's location is never used or sent, which is true. It may not say or imply that these values stay on the phone.

### The fact finder, decided September 6, 2026

- **Facts about a specific day are found by a model that searches, not by a
  curated list of fact types.** A curated list caps out at whatever the curator
  thought of. Run on demand as a Supabase Edge Function, cached per date, per
  date and year, and per region, with likes deciding the order for everybody
  who shares the exact birthday.
- **The research and the formatting are two separate calls and must stay
  separate.** Asked for facts and for a JSON array in one prompt, the model
  stops searching and answers from memory, with page addresses that look real
  and are not. The first call researches with search on and writes prose, the
  second reshapes those notes with no search and is told to copy addresses
  rather than correct them.
- **The model is `gemini-3.7-flash` because it is the one that searches.**
  Given the identical research prompt, 3.7 ran six targeted searches, 3.6 ran
  one, and 3.8 ran none. Being a generation newer is worth less than reaching
  for the tool. Grounded search is a paid feature on every model; the free
  tier returns 429 for all of them.
- **A run that reports no searches is discarded, not stored.** The list of
  queries Google reports back is the only evidence the tool was used, because
  a model that answered from memory will not say so.
- **A cited page has to answer before its fact is shown.** `verified` is what
  the read policy exposes and an address that does not resolve does not get
  it. The quotation is stored on every row so a stricter check that reads the
  page can be added later without a migration.
- **The historical events stage is cut and the television show stays.** The
  `historical_events` table has been empty since slice 1 and the fact finder
  covers events on the day better, with a source on each. Most watched
  television show by season is built as its own lookup like the number one
  song, because it is keyed to a year and a chart rather than to a day, which
  is the one shape a search for a single date does not reliably return.

### The birthday message, decided September 6, 2026

- **Tapping a birthday notification opens a composer with a message already
  in it, and the app never sends it.** The user edits and sends through
  Messages or the share sheet. No network call, no model at runtime, no
  recipient stored. The privacy page's claim that the people list stays on
  the phone depends on this and it is not negotiable.
- **It is four decisions, not a template with slots.** What to call them,
  which register the note puts them in, whether the age is safe to say, and
  one plain closing line. The note is classified and never quoted. The
  design, the reasons and the hundred messages it was judged on are in
  `docs/birthday-messages.md`, and the hundred are pinned in
  `BirthdayMessageTests`. The acceptance bar is five embarrassing messages in
  a hundred; it scored two, both the same known limit, a two word name whose
  first word is not the given name. If a change makes the count go up, the
  fix is the generator, not more templates.
- **Facts about the date stay out of the message.** They are about the
  calendar, not the person, and they live on the server.
- **A public figure gets a line about them, not to them.** "Beyoncé turns 45
  today." Somebody who has died is stated and wished nothing.
- **The message uses contractions where the app's own copy does not.** It is
  the user's text to a friend, and "hope it is a good one" is a sentence
  nobody types.

### The Today tab, decided September 6, 2026

- **Today is a feed of everything about the date, ranked by the reader's
  age, not a list of names.** Found facts, events from Wikipedia's date
  article, people born, the number one song and film in every year, mixed so
  the kinds take turns, each row carrying the reader's age that year: "You
  were 7." `DayFeed` in the domain decides the order and is tested. The
  specification is `docs/today-in-your-years.md`.
- **No model runs for this tab.** Songs and films are `chart_weeks`, people
  are `notable_people`, and events are Wikipedia's own date articles, imported
  once by the worker into the `historical_events` table that was cut for
  being empty. The shared date facts appear at the year they carry and
  nothing on this tab may start a search.
- **The order is arithmetic.** The wheel opens on the year the reader was
  most likely to remember, by an age band, because likes cannot steer
  anything at this size and the research document says so.

### The order of the found facts, decided September 6, 2026

- **Likes do not count until a fact has five of them.** The first row is set
  large, so it collected the likes, so it stayed first. Below five likes the
  facts are dealt by a seeded shuffle in `FactOrder`, and the seed changes on
  every load and every change of date, never on a poll, so the list is stable
  while it is on screen and different the next time. Pulling down on Mine
  deals again.
- **A date is searched again once a week, when opened, told what it already
  found.** `REFRESH_AFTER_MS` in the Edge Function. It never takes the last
  five hundred searches of the month, and another look that fails leaves the
  date done rather than failed, so it cannot retry itself into the budget.
  A date nobody opens is never searched twice. A date opened weekly costs
  about seventy cents a month.
- **The Today feed is dealt on every load too.** `DayFeed.build` takes a salt;
  the rank never moves, the order inside a rank and kind does. Fresh on every
  pull costs nothing, because the pool under it is a hundred rows a date
  from tables. The model is the top up, not the feed.
- **What could be paid for, later, not now.** "Look again now" on a date
  outside the weekly window, the regional facts, and looks past a monthly
  allowance. All three are things the budget table already meters, so a
  paid tier is a per user allowance in front of a meter that exists. Not
  built, and not before there are users to charge.

### The world when you arrived, decided September 6, 2026

- **"You are 15 years older than Fortnite" comes from a table, not a model.**
  `WorldThen` in the domain holds a handful of dated timelines this audience
  knows by heart (Fortnite seasons, Minecraft versions, iPhones,
  PlayStations, Pokémon generations) and a list of arrivals (ChatGPT,
  Instagram, YouTube and so on), and answers what was current on a birth
  date or how much older the reader is. No network, no cost, never varies.
  It is the sentence the fact finder was asked for and produced six times in
  2,751 facts.
- **Every timeline stops at `knownThrough`.** A birth after that gets no line.
  Extending a timeline means adding rows and moving the date, and the dates
  are checked against the page linked on each timeline, not remembered.
- **The dates in the first version were written from memory** and are to be
  checked against their pages before TestFlight. Absent beats wrong, and a
  wrong version number is the kind of wrong this audience notices first.

### Two verdicts reversed, September 6, 2026

- **The Today tab stays a tab.** `docs/first-five-minutes.md` had it becoming a
  screen reached from a person, and that verdict was made about a screen that
  was ten names. The feed replaced that screen hours later and the verdict was
  never revisited. An outside review of the built screen called it the
  strongest surface in the product. The risk the verdict named, not wanting to
  browse other dates on your own birthday, is already handled by `FR-033`. If
  people open Today and never add a person, it comes back.
- **The suggested public figures stay on the empty People tab.** Half the
  reason for cutting them, that they spend the sixty four notification slots,
  is already solved in `NotificationPlanner`, which puts people you know ahead
  of people you follow whatever the dates. An empty People tab with only an
  instruction on it is where this app dies.
- **The order of work is settled and is not features.** Prove the reminder loop
  on a real device, verify what was written from memory, instrument four
  numbers, finish build order items 1 to 4, then TestFlight. Arrived at twice
  independently. The famous people search waits behind all of it.

### The one permission, decided September 6, 2026

- **Notification permission is asked from a row under the first person on the
  People list, not from the switch in Settings.** The row reads "Remind me the
  morning of and three days before", it is switched on when it appears, and
  the system prompt comes when the user leaves the screen with it still on.
  This rewrites `FR-070`, which put the prompt behind a Settings switch. A
  permission asked from a switch nobody visits is a permission never granted,
  and the reminder is the whole loop. The reasoning is
  `docs/first-five-minutes.md`.
- **Under the first person, never above the list.** A row above the list is a
  banner asking for notifications, which is the one thing the last two minutes
  of that document say must not happen.
- **Turning the row off is an answer.** It is written down and the row does not
  come back; Settings is then the only place reminders live. Nothing is asked
  of iOS in that case, because we have already been told.

### The site's own security policy, decided September 6, 2026

- **`/add` is the one page that may run a script and reach the project, and it
  says so per path.** The site sends `default-src 'none'`, which covers scripts
  and network calls, so from the day `/add` gained a script the browser dropped
  it and drew an empty page, in every browser, with nothing on screen to say
  why. `securityFor` in `web/src/serve.ts` widens the policy for that path
  alone, to `script-src 'unsafe-inline'` and a `connect-src` of the Supabase
  project, and a test in `web/test/serve.test.ts` asserts no other path gets
  either. A header that contradicts the page is invisible from the file on
  disk, which is why the test reads the header rather than the page.

### How Birthed measures, decided September 6, 2026

- **There is no analytics kit in this app and there is not going to be one.**
  The live privacy page says Birthed contains no advertising and no third party
  code that reports on you, on a page that opens by saying it was written from
  what the app does rather than from a template. Dropping in PostHog or
  anything like it would make that false on the day it ships. The handoff note
  planned exactly that and also said the privacy promises must not be quietly
  softened, and nobody had put those two sentences next to each other. If a
  future session reaches for an analytics service, this is the entry that says
  no.
- **The four numbers ride on the profile row the app already writes.** One
  request, no event stream, no device identifier beyond the random account
  token already in the keychain, no session, no screen names, no timestamps.
  `Tally` in the data layer holds the two that must survive a launch and says
  at length what is deliberately not counted.
- **The first of the four was already free.** `birth_year` is on `profiles`, so
  how many people entered a year is a count of rows where it is not null. It
  needed no code and no column.
- **A count is not a list.** `people_added_count` is the length of the People
  list and carries no name, date or note, so the promise that the list stays on
  the phone survives it whole. That is the line this design walks and it is
  worth checking any future number against it.
- **Deliveries are counted from the schedule, not from Notification Centre.**
  Asking iOS what is sitting in Notification Centre undercounts every time
  somebody swipes their notifications away, and the people most likely to do
  that are the people most likely to have acted on one.
- **Messages sent undercounts on purpose and the number must be read knowing
  it.** Only the iOS Messages composer reports back, so a share sheet send and
  a friend texted from their own thread are both invisible. Messages sent for
  every reminder delivered is a floor, not a rate. A low floor is a reason to
  measure better before it is a reason to conclude nothing happened.
- **The privacy page is edited in the same commit as the code, never after.**
  That is the whole discipline here, and it is why the "What Birthed never
  does" bullet now says what is true rather than what used to be.
- **What this cannot do.** Current totals are not events. No funnel, no cohort,
  no retention curve, and no question that nobody thought to ask in advance.
  That is the trade, it is the right one for four numbers, and wanting more
  later is a decision to reopen with the privacy page open beside it.

### What a public figure is for, decided September 6, 2026

- **Somebody you follow gets no notification of any kind.** A notification is a
  promise that something is worth doing when it arrives, and there is nothing
  to do about a celebrity's birthday. The feature table cut following in the
  first place for spending the sixty four slots on people who will never text
  back, and the reversal on the same day that kept public figures argued only
  that an empty People tab with nothing on it but an instruction is where this
  app dies. That is an argument for their being on the tab. It was never an
  argument for their waking anybody's phone. `SettingsView` already gave them
  no three day warning, which was the same instinct half applied. This
  supersedes that half measure.
- **The filter is in `NotificationService.reachable`, not in the planner and
  not at the call sites.** Four places call `reschedule`, and a filter every
  caller has to remember is a filter one caller will forget.
  `NotificationPlanner` still ranks people you know above people you follow,
  and its tests still pass, because it is fed directly and knows nothing about
  this.
- **Tapping a public figure gives a card, not a composer.** A composer is a
  thing you edit and send to somebody, and a public figure has no somebody:
  `SaySomethingView` already turned Messages off for them, which left a large
  empty text box, one flat sentence, and nowhere to send it. That is why it
  read as thin.
- **The line on that card puts the reader in it.** Not "Idris Elba turns 54
  today", which anybody can look up in four seconds and nobody posts, but
  "Idris Elba was 30 when I was born", which is the same two birth years
  arranged so the sentence is about the reader. It is the move the whole
  product is built on, applied to a person instead of to a video game, and it
  needs no new data, no network and no model. `FigureCard` in the People
  feature.
- **The month and day are part of that arithmetic and are not decoration.**
  Somebody born in December 1972 had not had their birthday yet when a reader
  arrived in February 2002, so they were 29 that day and not 30. Absent beats
  wrong, and so does one year out.
- **The rehearsal harness in Settings offers friends only.** It has already
  made the mistake of offering a reminder the app correctly refuses to send,
  and answering "nothing in the plan matches that" is the harness being wrong
  and the app being right, which is the wrong way round for a test to fail.

### The Mine panel, decided September 6, 2026

- **The stage is a panel, not a page, and the candle stands on its bottom
  edge.** `CandleMark` works on the app icon and on the share card and failed
  on this screen, and the difference was never the drawing: the first two are a
  bounded warm field with the candle as the subject, and this screen was an
  unbounded cream page with the candle loose on it. The fix was to reproduce
  the condition the object already succeeds in rather than to invent a plate, a
  holder or a table edge, none of which exist anywhere else in the app's
  vocabulary. `candleDrop` is back above zero because there is a real edge to
  run off again.
- **`StagePalette.wax` is the same in light and dark, and only the page around
  the panel follows the appearance.** The complaint that started this was about
  light mode, and the reason light mode was flat is physical rather than a
  matter of taste: cream is already close to white, so a glow laid on it has
  nowhere to go and reads as a stain, which is what the bloom behind the flame
  looked like. Wax is dark enough for warm light to fall across, so the glow is
  ember here rather than accent. It also means there is one set of colours
  inside the panel to keep right instead of two.
- **`StagePalette.forScheme` was not touched.** Seven files read it, including
  the Today tab and both share cards, and changing it would have redesigned
  screens nobody asked about.
- **One pink kicker above the fold, and it belongs to the song.** There were
  six on one screen, which is a texture rather than a kicker. The song keeps
  the one because it is the only thing up there whose label is itself the fact:
  nobody says "my day" out loud and people do say "the number one song the week
  I was born". A panel is a boundary and a boundary is a label, so nothing else
  needs a line of capitals to say what it is.
- **One number wins by a factor of five rather than by argument.** Eighty four
  points against fifteen. The day count takes the slot on ordinary days and the
  age takes it on the birthday, because "31 today" is the event and a day count
  is not, which is a deliberate small disagreement with the feature table. With
  no birth year the countdown stands in, so the slot is never empty.
- **The fixed 540 point minimum height is gone, and that is what the dead band
  was.** It was a height chosen when the album and the film were on this screen
  and it was still holding the stack open after they came off. The floor comes
  from the bottom band, which is as tall as the candle because it is the band
  the candle stands in. That space has an object in it, which is the difference
  between it and the hole it replaces.
- **The older than sentence is the control.** Tapping it swaps in the next line
  and the choice is stored by subject, not by position or by sentence, so it
  survives the sentence changing from fifteen years to sixteen on the reader's
  next birthday. It is the sentence itself and not a button beside it, per the
  rule about a second control doing the first control's job. The cycle glyph is
  set inline after the last word, inside the same tap target.
- **Every card exported from Mine is the panel's palette now.** The screen and
  the export are meant to be the same picture, so a reader in light mode must
  not share a cream card of a wax screen.
- **The shadow is cast by a plain shape behind the panel, not by the panel.**
  The panel contains a flame that redraws every frame, and a shadow on it would
  put that animation through an offscreen pass sixty times a second for a soft
  edge that never changes.

### The wall leads the date page, decided September 10, 2026

- **A date page opens with its name and the wall.** The wall is the main
  mechanic on birthed.app now. The three "also on this date" cards follow it,
  then the remembrance question as its own section, and then what happened,
  what came out, the number one song and who shares the date, folded into one
  details element under a line that counts what is inside. Nothing was
  deleted: the imported history is the search plan (a page with fewer than
  eight people is already kept out of the index) and it is the wall's own
  context, what did matter about the date under what will. A crawler reads
  the folded text; a reader sees the wall and one line.
- **Reading and voting are two controls on a tile.** The headline opens the
  receipt, because that is what a headline does everywhere else, and a small
  Buzz button spends the unit. The first version made the headline the vote
  and nobody could find the receipt.
- **The unit is a buzz, except on solemn dates.** The mascot is a bee.
  `Voice` in `web/src/wall.ts` is the one place the word lives and
  `PLAIN_DATES` is the list of dates that speak plainly instead. The list is
  a start and is meant to be edited by a person.
- **No honey, no karma.** A reward for backing stories that last was raised
  and refused, because `docs/the-wall.md` sections 6 and 8 refuse any score
  and the outcomes that would feed one are a year away. If it is ever built
  it is a private mark on the sealed page, never a number.
- **Open, and not a layout question:** the page runs two games with two
  clocks, remembrance answers sealed for a year and buzzes sealed for good.
  The honest long term shape may be one mechanic with two faces. That changes
  the year two measurement and belongs to Nathan and Jason. Settled the same
  night, below.

### One feed, one verb, and the hive, decided September 10, 2026

- **Everything with a birthday on a date is a pixel.** What happened on it,
  who was born on it, what came out on it and the day's news are all wall
  stories in one pool, they take the same three buzzes a day, and any of them
  can take the board. `worker/src/wall/history.ts` files the imported rows as
  stories when a date opens, with the row's own link and the row's own
  sentence, and marks the source `imported` so the checker leaves it alone
  and the receipt says what was read. `docs/the-wall.md` section 13.
- **The three answer remembrance game is off the page.** No separate budget,
  no "I remember it", no birth year question, no "What people remember".
  Nothing of it is dropped from the database and `/remember` still answers;
  no page sends it anything. One feed, one button, one word.
- **The board is the hive.** On the page, in the copy and in the path
  (`/<date>/hive/`). "Square" was the allocator's word and it leaked.
- **The date's biggest history goes on first.** `wall_stories.priority`: 3 for
  a row Wikipedia's editors picked or somebody wrote a lead line for, 2 for
  the three most looked up people, 1 for other history, 0 for the news feeds.
  The allocator and the feed order use it only among stories with equal
  support. One buzz beats any priority.
- **The whole feed is on the page, no fold.** Most buzzed first, then
  priority, then arrival, the way a reddit reads its feed. The number one
  songs are the one thing still behind a line, because a song is keyed to a
  year and a chart rather than a day and is not a pixel yet.
- **Before the worker has filed a date, the baked history stands in.** Plain
  rows without buttons under the promise on a date with no hive, and in place
  of the feed on a hive with nothing filed yet. The moment the worker files
  them they are stories with the button, and the baked rows are not drawn
  twice.

### The hive on iOS, decided September 10, 2026

- **One tap is one unit in the app too.** Nathan's call, and
  `docs/the-wall.md` section 4 was edited before the code that depended on
  it, because the document wins. The one, two or three unit conviction sizing
  is gone from the product. The database still accepts one to three and no
  client sends more than one.
- **One story takes one buzz from one install, and that rule is the client's.**
  The budget trigger counts units against the day and does not care which
  story they land on, so without this the three taps could all land on one
  story and the conviction sizing would be back through the side door.
  `WallService.buzz` refuses it and the tap never leaves the phone. The
  website's `already` is the same rule in the same kind of place.
- **The mark is the device's own memory.** `wall_boosts.booster_id` is
  revoked from the app's role on purpose, `wall_units_left` returns a number,
  and `wall_web_standing` is the website's browser token and refuses an
  authenticated caller. So `HiveMarks` lives in `UserDefaults`, the way this
  account's own remembrance answers already do. A reinstall forgets the mark
  and never the vote. Making it survive means a `wall_my_boosts` migration
  that was not written. Do not reach for `wall_web_standing`.
- **The window on the board is a port and is held to the website's answers.**
  `WallBoard.viewport` is `viewportFor` from `web/src/wall.ts`, halved in
  floating point because that is what the website does. `HiveTests` asserts
  values printed from that function, including a spread whose centre lands on
  a half module, where whole number division gives a different origin. If the
  website's rule changes, both change together or neither does.
- **One feed on the Today tab, and it is `DayFeed` with the buzz hung off
  it.** This year's news at the top, the reader's own timeline in its own
  order with a count and a button on any row the worker filed a story for,
  then anything filed the timeline did not draw. A story on the hive is not
  repeated below it; its tile carries the reader's age line instead, which is
  the one thing this app has that the website does not.
- **The board is the hive and a unit is a buzz, except on the eight dates in
  `HiveDates`.** `HiveCopy` holds every sentence and each takes a voice.
  `WallCopy` was retired rather than renamed so an old sentence cannot survive
  by being referenced. A story nobody backed shows no count, never a nought. A
  test sweeps every reachable sentence for wall, square, boost and remember.
- **`HivePalette` is the honey, and `StagePalette.forScheme` was not touched.**
  Seven files including both share cards read that one.
- **The three answer game came off the Today tab, and so did its clock.**
  Taking only the buttons would have left a second clock and a second budget
  ticking beside the hive's, which is the thing section 13 named. Nothing is
  dropped from the database and `/remember` still answers.
- **Open:** a sealed date still reorders by memory and the sentence that
  explained it said "remembered", so it came off and nothing replaced it.
  Either that order needs a sentence in the hive's words or it belongs to the
  archive rather than to Today.
- **Nothing in that session was compiled.** No Swift toolchain in the
  container or in the shell on the Mac, and the proxy refuses
  `download.swift.org`. Every rule has a test and not one has been run.

### The ballot, not the button, September 10, 2026

- **A board of ticket guides and console opinion is a ballot nobody should
  spend on.** The wall shipped and the first real board was ten beige tiles,
  three from one video game site, none about the date. The mechanic was
  working as built. Everything below follows from the candidates being the
  problem rather than the button.
- **The history seeder threw on every tick from the day it shipped.**
  `cultural_events.event_date` is a date column and the read asked PostgREST
  for `event_date=like.*-09-09`, which Postgres answers 42883, no
  `date ~~ text` operator. The 400 took out the whole `Promise.all`, and
  `tick.ts` logged one line and carried on to the news. So section 13's
  promise that everything with a birthday on a date is a pixel was never once
  true in production. **Never send LIKE to a date column through the
  automatic interface.** The date is screened in code now.
- **A stage that fails every run looks like one that failed once.** The only
  record of a full day of failure was a Render cron log. Nothing in the
  product can answer "has the history seeder ever succeeded." Not fixed.
- **Variety is a rule now, in `varied` in the allocator.** Order alone was
  choosing the board, and fixing the seeder would have flipped it from eight
  news tiles to eight encyclopedia events. At most three unbacked tiles are
  the day's news, at most two of those from one outlet, at most three are any
  one kind of history. History is not capped by outlet on purpose: every
  event cites the same encyclopedia. **One buzz beats every one of these
  caps**, and a slot the caps cannot fill is filled in plain order rather
  than left empty.
- **The news seeder screens headlines that are not a thing that happened.**
  Opinion, question headlines, listicles, where-to-buy, release dates,
  reviews, both apostrophes. Written against the 129 real headlines the live
  feeds filed for September 9 and pinned in `wall-news.test.ts`: twelve it
  must catch, sixteen it must not. Narrow on purpose, because a false
  positive costs the day's news and the junk costs one tile.
- **Open: the tier palette is decorative.** Every seeded story is `claimed`
  forever because nothing adds a second source, so the three tones of honey
  are one tone. Clustering the same story across the independently owned
  feeds would make `reported` real and turn corroboration into free editorial
  judgment. Not built: a wrong merge puts two different events under one
  receipt, and that needs a rule argued on real headlines.
- **Open: the typed field is the better answer.** Ask what mattered about the
  date and find it in the pool, rather than asking somebody to shop a list of
  forty. If a model is used it picks from a closed list with grounded search
  off and returns an identifier, never words. The miss is the valuable case:
  it becomes the front door to submission. What is stored of what people type
  is Nathan's call, not a session's.
- **Nothing in that session was run against the live feeds.** The worker's
  291 tests pass on fixtures and on headlines copied out of the database. The
  next tick is the test.

### Search, decided September 5, 2026

- **A date page with fewer than eight people carries `noindex` and stays out of the sitemap.** It is still built and still loads. A new domain that hands a crawler 366 URLs with most of them empty teaches the crawler that the site is thin, and that judgement is made once and is expensive to undo. The threshold is eight rather than `FR-022`'s ten because a few real dates have fewer people with English Wikipedia articles.

### Hosting, decided September 5, 2026

- **birthed.app runs as a Render web service on the Starter plan, not a static site.** Render has no Starter plan for static sites; static hosting is their free product and Starter is a plan for services. `web/src/serve.ts` is that service: it reads the already rendered pages off disk and sets headers, with no dependencies and no database connection, so a Supabase outage cannot take the site down.
- **The pages are baked into each deploy.** After the importer adds people, redeploy or the site keeps serving what it was built with.

### A data change needs a manual deploy, September 6, 2026

- **Render's buildFilter means pushing a data fix deploys nothing.**
  `render.yaml` rebuilds only when something under `web/**` changes, which is
  right for code and wrong for data. The pages are baked at build time, so a
  change that lives entirely in the database or in `worker/` never triggers the
  build that would publish it. The push succeeds, Render reports nothing, and
  the site keeps serving the old pages with no error anywhere to notice it by.
- **This was hit the day the adult performer fix and the event screen landed.**
  Both were correct in the database, the iOS app had them immediately because
  it reads live, and birthed.app served the previous build for another hour.
- **So after any importer run, any screen, or any hand edit to the data:
  Render dashboard, birthed-web, Manual Deploy, Deploy latest commit.** There
  is no way around it short of widening the filter, and widening it means the
  iOS target and the specs rebuild the site, which is what the filter is there
  to prevent.

### Vercel, evaluated and rejected, September 6, 2026

- **birthed.app is on Render and stays there.** A Vercel project was created
  from this repository on September 6 and every URL on it returned 404. It was
  pointed at the repository root, which has no `package.json`, no `index.html`
  and no framework, so Vercel built nothing and had nothing to serve.
- **Pointing it at `web/` would not have fixed it.** `web/src/serve.ts` is a
  long running Node process and `render.yaml` starts it with
  `node dist/src/serve.js`. Vercel serves static files and serverless
  functions and has nowhere to put a start command. Making it work means
  building to static output and moving every header out of `serve.ts` and into
  a `vercel.json`.
- **The header move is the trap, and it is the real reason this is not a small
  job.** `securityFor` widens the policy for `/add` alone. On Vercel
  `serve.ts` never runs, so `/add` would get `default-src 'none'`, the browser
  would drop its script, and the page would come up empty with nothing on
  screen to say why: the exact bug the security policy decision above already
  records. Worse, `web/test/serve.test.ts` would still pass, because it reads
  the header out of `serve.ts` rather than off the live site. The test suite
  would report a healthy site while `/add` was broken.
- **The missing environment variables were a third problem, not the cause.**
  `web/out/` is gitignored, so any host builds the 366 pages itself and
  `build.ts` throws without `SUPABASE_ANON_KEY`. Render already holds it.
  Setting it on Vercel would not have fixed the 404.
- **Render is healthy and was verified on September 6.** The home page, a date
  page and `/add` all render, and `/add` draws its own controls, which means
  the policy exception is working.
- **If a Vercel project is ever created again, remove its GitHub app access to
  this repository when tearing it down**, or it builds a broken deployment on
  every push to main and sends mail about each one. That is cleanup after the
  fact, not the reason it was rejected.

---

## 6. Rules that prevent specific known bugs

Each of these exists because of something real, not as a style preference.

**Never use `UNTimeIntervalNotificationTrigger`.** Use `UNCalendarNotificationTrigger` built from `DateComponents` including hour and minute. An interval trigger scheduled 40 days out lands an hour off if daylight saving changes in between. A competitor's public reviews contain exactly this complaint.

**Never use `addingTimeInterval` for day arithmetic.** Use `calendar.date(byAdding: .day, value:to:)`. Some days are 23 or 25 hours long.

**Resolve February 29 at read time, never at write time.** The stored birthday stays February 29 forever. The observance setting is consulted every time the next occurrence is computed. And when scheduling the birthday notification, build the trigger from the **observed** date, not the stored one, or a February 29 user gets no notification in three years out of four.

**A calendar birthday is two integers, `birth_month` and `birth_day`.** Never a `Date`, never a timestamp, never passed through a time zone.

**A chart date is the exception, and it still is not a `Date`.** `ChartWeek` carries a year because a chart week happens once and never recurs. It reasons in a fixed coordinated universal time calendar rather than the reader's, so the answer does not change with the reader's time zone, and it parses `yyyy-mm-dd` by hand rather than with a `DateFormatter`, because a formatter reads the reader's locale and calendar and can return a different year for the same eight digits.

**No reward rule may exist without the sentence from the source that supports it.** `offer_rules.source_quote` is `not null` with a minimum length. The extraction pipeline checks every quotation by exact string match against the archived page before a human ever sees it. A model that paraphrases produces a quotation that is not present, and the row is discarded. This is the single most important control in the system.

**The app never states a rule the source did not state.** Where information is absent, display "Not stated by the brand." Never display an assumed default.

**Never send precise coordinates to the Birthed backend.** Location is used on device and passed to WeatherKit only.

**MapKit does not expose store hours.** This is verified, not assumed. Typical hours live on the `brands` row, curated by the pipeline, and must be labeled in the interface as typical for the brand rather than confirmed for that location.

**The events import writes what is true now and removes what is no longer true.** Every row's fingerprint covers its sentence, so an edited sentence on Wikipedia is a new row rather than a changed one, and without a prune the old wording and the new wording of the same event sit one above the other on the Today feed. Each run stamps `imported_at` with the run's own start, and afterwards deletes rows for that date from before it. It prunes **only dates that read successfully and returned events**, so a failed fetch never empties a date: nothing is deleted on the strength of an absence, only on the strength of a good read that no longer contains it.

**A line before the common era is refused, not filed under the same number.** "44 BC" would otherwise reach the database as the year 44, which is wrong by two millennia and looks perfectly reasonable in a list. The importer counts these apart from lines with no year at all, because the report used to call both a missing year and they are not the same problem.

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
- **Commit finished work without being asked, September 6, 2026.** Nathan's instruction. Work that is written, reviewed and passing its tests gets committed as it lands, in coherent commits rather than one heap, with the author configuration in section 10 below. Pushing stays Jason's. The older rule was to commit only when asked, and waiting for permission on every change turned out to cost more than it protected.
- **Commit as `-c user.name="Jason Page" -c user.email="jasonpage@users.noreply.github.com"`**, with the Claude co-author trailer, and split by what changed rather than by when it was written. A document touched by three pieces of work belongs in three commits, one section each.
- **Ask before writing code that cannot be undone by a commit**, which in practice means anything that deletes from the live database or spends money at Google. Writing Swift, TypeScript or documentation is not in that category.

---

## 11. Where the risk actually is

Not in SwiftUI. Four pure Swift types carry nearly all of the product's correctness risk: `BirthdayCalendar`, `QualificationEngine`, `DayPlanBuilder` and `CycleCalculator`. They have no dependencies and no excuses. Test them exhaustively.

The other risk is not code at all. It is the freshness of the reward catalog, against brands that explicitly reserve the right to change their terms without notice. The controls are automatic downgrade after 180 days, the archived-page change watcher, and one-tap problem reports from users. If those decay, the product's only real differentiator goes with them.
