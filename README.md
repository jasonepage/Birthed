# Birthed

Every calendar date has a page. It shows who was born on it, what happened on
it, the number one song, album and film for the week a reader was born, and a
board called the hive that the people there on the day fill in themselves.

Live at [birthed.app](https://birthed.app). The iPhone app is in beta on
[TestFlight](https://testflight.apple.com/join/hzm6Mhhm), Apple's free app
for trying apps before they are on the store.

Birthed is a website and an iPhone app about calendar dates. The central
object is the date, not the user. There is no revenue, no advertising,
nothing to buy, no company, and no analytics service or third party code of
any kind.

## How the hive works

Everything with a birthday on a date sits in one pool: that day's news,
historical events, people born on it, and works released on it. The rules are
in `docs/the-wall.md`, which is the authority for every rule below; the
database enforces them in `supabase/migrations/20260909040000_the_wall.sql`
and the migrations after it.

- A date opens the day before it happens, for submissions only.
- On its own day and the day after, a visitor gets buzzes to spend: three on
  the date itself, one on the day after. `wall_boost_budget` in the database
  is the only place that number lives.
- One tap is one buzz, and one story takes at most one buzz from one visitor.
- A tile's size on the board is its share of the date's buzzes. When nobody
  has buzzed, the panel's points decide, and one buzz beats every score.
  `worker/src/wall/allocator.ts` cuts the board; `web/src/hive-allocator.ts`
  is a plain JavaScript copy used by the live page, and a test holds the two
  to the same output on four hundred generated boards.
- At midnight United States Eastern time ending the day after the date, the
  date seals. `wall_boosts` is immutable: its trigger refuses every update and
  every delete. Migration `20260911010000_thirty_seconds_to_take_it_back`
  adds one exception, a buzz taken back within thirty seconds of casting it
  on a date that has not sealed; as of September 21, 2026 that migration is
  in the repository and not on the live database.
- The same calendar date opens a new hive the following year. The old ones
  remain.

The worker's tick, `worker/src/wall/tick.ts`, runs every fifteen minutes. It
files the date's imported history as stories, reads the public news feeds
listed in `worker/src/wall/news.ts`, checks every cited source, and writes a
snapshot of the board.

## What happens to a reader's birthday

On the website, nothing is stored.

- The month and day a reader picks only choose which page to send them to.
  They are never written down. The `/year` handler in `web/src/serve.ts`
  answers the form.
- The birth year, if given, goes into one cookie in the reader's own browser
  and nowhere else. It turns on the song strip and the day counts. Choosing
  the blank option deletes it.
- The website has no accounts. Two pages run a script, `/add` and the live
  hive of a date currently taking buzzes; `securityFor` in `web/src/serve.ts`
  sets the content security policy per path and `web/test/serve.test.ts`
  asserts that no other path may run one. Every other page sends
  `default-src 'none'`.
- The iPhone app creates a silent anonymous account with a random token on
  first launch. `AccountService.pushProfile` sends a month, a day, an optional
  birth year and an optional typed region to that account. The list of other
  people's birthdays a reader adds never leaves the phone; only its length is
  sent, as `people_added_count`.
- The device's location is never used or sent.

The full account is on the [privacy page](https://birthed.app/privacy/), which
is edited in the same commit as any code that changes what it describes.

## Repository layout

| Path | What is in it |
|---|---|
| `Birthed/` | The iPhone app. Swift 6 with strict concurrency, SwiftUI, minimum target iOS 17. |
| `Birthed/Domain/` | Pure Swift. It imports Foundation and nothing else, holds the date arithmetic, and carries nearly all of the correctness risk. |
| `BirthedTests/DomainTests/` | The domain tests. |
| `Birthed.xcodeproj` | The Xcode project. |
| `Package.swift` | A Swift package at the repository root that compiles `Birthed/Domain/` and its tests, so they run from a terminal. |
| `web/` | birthed.app. A Node service that bakes 366 date pages at build time and serves them from disk with no database connection. |
| `worker/` | The importers and the hive's tick. Node and TypeScript, run in a container on a schedule. |
| `supabase/migrations/` | Every change to the database, in order. The database is never edited by hand. |
| `supabase/functions/` | Edge Functions: account deletion, the fact finder, the source finder for the hive, the day scanner, the reach measurer and the one write path for the hive. |
| `ingestion/` | A Python pipeline for cultural events. Its own `README.md` says how to run it. |
| `design/` | The app icon source. |
| `docs/` | How each decision was reached, including the ones that turned out wrong. |
| `docs/research/` | The research the decisions rest on. |
| `PRD.md`, `SRS.md`, `SDS.md` | Product, requirements and design specifications. Large parts describe the reward catalog, which is built in the schema, tested, and unused. |
| `CLAUDE.md` | The working instructions and the decision record. It is blunt about what is broken and what has never been run. |
| `render.yaml` | The two Render services. |

## Requirements

- Node 22. `web/package.json` and `worker/package.json` declare `>=18.18.0`;
  Render runs 22.
- A Swift 5.9 toolchain or newer, for `swift test`. Xcode 16 or newer to
  build the app.
- Docker, only to build the worker's container the way Render does.
- The Supabase command line interface, only to apply migrations.
- Python 3, only for `ingestion/`.

## Building and running

### The website

```
cd web
npm install
npm run site
npm run serve
```

`npm run site` compiles the TypeScript and bakes the 366 date pages into
`web/out/`, which is not checked in. It reads the database through the
anonymous key, so it needs `SUPABASE_URL` and `SUPABASE_ANON_KEY` in
`web/.env`; `web/.env.example` shows the shape. `npm run serve` starts the
process that serves those pages. `npm run og` shoots the share images with
Playwright and needs a Chromium download.

### The worker

```
cd worker
npm install
npm run build
```

The worker is a set of scripts, each a script in `worker/package.json`:
`import:day`, `import:all`, `import:songs`, `import:albums`, `import:films`,
`import:events`, `import:culture`, `wall:seed`, `wall:news`, `wall:history`,
`wall:check`, `wall:tick`, `pictures` and others. Every one that writes needs
the service role key in `worker/.env`; `worker/.env.example` shows the shape.
The service role key bypasses row level security and must never appear in the
app target or in `web/`.

### The iPhone app

To try the built app without building it, join the beta on
[TestFlight](https://testflight.apple.com/join/hzm6Mhhm). To build it, open
`Birthed.xcodeproj` in Xcode. The app reads its two values from
`Birthed/Config/Secrets.swift`, which is not checked in:

```swift
enum Secrets {
    static let supabaseURL = URL(string: "https://<project>.supabase.co")!
    static let supabaseAnonKey = "<anonymous key>"
}
```

### The database

Migrations are applied with the Supabase command line interface, against a
project you own. `docs/going-public.md` lists migrations in this repository
that have been written and not applied to the live project.

## Running the tests

```
cd web && npm test
cd worker && npm test
swift test
```

Each `npm test` compiles the TypeScript and runs `node --test` over the
compiled test files. The web tests build a small site under `web/test-site/`
to serve it. `swift test` at the repository root compiles `Birthed/Domain/`
and `BirthedTests/DomainTests/` through `Package.swift`, with no Xcode
target. The app compiles the same domain files through the Xcode project. If
a domain file ever imports a framework, `swift test` is what fails first.

## How it is deployed

`render.yaml` describes two Render services in the Oregon region.

- `birthed-web`, a Node web service. Its build command installs dependencies,
  bakes the pages, and shoots the share images. It holds only the anonymous
  key. It rebuilds only when something under `web/` changes, so a change that
  lives in the database needs a manual deploy from the Render dashboard, or
  the site keeps serving the pages it was built with.
- `birthed-wall`, a cron job built from `worker/Dockerfile`, running
  `node dist/src/wall/tick.js` every fifteen minutes. It holds the service
  role key. Nothing on birthed.app depends on it running; a tick that fails
  leaves the hive as it was.

The Edge Functions under `supabase/functions/` are deployed with the Supabase
command line interface.

## Where the content comes from

- Names, birth and death years and one line descriptions of people come from
  Wikidata, under Creative Commons Zero. Every row records its source and
  license. Wikipedia article text is not used; `SDS.md` section 8.1 says why.
- Historical events come from Wikipedia's date articles, under Creative
  Commons Attribution ShareAlike, each with the page it came from.
- Chart weeks (the number one song, album and film) are parsed from
  Wikipedia's year lists, under Creative Commons Attribution ShareAlike, and
  every row carries the page it came from. The Hot 100 import begins with
  1959; a 1958 birthday shows no song, because that year's page could not be
  read without guessing.
- Event pictures are freely licensed files from Wikimedia Commons, copied at
  tile width. News pictures are the publisher's own preview image, recorded as
  belonging to the publisher and removed on request.
- The day's news comes from the public feeds listed in
  `worker/src/wall/news.ts`.
- Facts found about a specific date are found by a model that searches, run
  as an Edge Function, and each fact shows the page it cites. A run that
  reports no searches is discarded.
- The Fraunces typeface is served from `web/static/fonts/` under the SIL Open
  Font License, which is beside it.

Which record was number one on a given date is a fact and cannot be owned.
Birthed is not affiliated with Wikipedia, Wikidata, the Wikimedia Foundation,
Billboard, Penske Media or Google.

## Known limitations

- The reward catalog that an earlier version of this was built around is in
  the schema, tested, and unused. `CLAUDE.md` section 5 records the cut.
- The ordering of people on a date page is by English Wikipedia attention,
  which makes it American and entertainment heavy. Changing it is an open
  decision, recorded in `CLAUDE.md`.
- The iPhone app has not been compiled in every session that changed it.
  `CLAUDE.md` says which rules have a test that has not been run.
- Several dated tables in `Birthed/Domain/WorldThen.swift` were written from
  memory and are to be checked against their pages before release.
- The hive's one measurement, repeat buzzing, means nothing until a month of
  real traffic has passed, and that month had not started as of September
  2026; `docs/measuring.md` says why.
- A migration in this repository can be newer than the live database.
  `docs/going-public.md` lists the ones that are.

## License

This repository is under the GNU Affero General Public License version 3.0.
The `LICENSE` file is added through GitHub's license template so the text is
exact; until it is present, that is the intended license. Content imported
from Wikidata, Wikipedia and Wikimedia Commons keeps the license of its
source, recorded on every row.
