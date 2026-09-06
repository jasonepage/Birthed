# Handoff, September 6, 2026

For the next session taking over the Birthed interface and the fact finder.
Read this, then `DESIGN-BRIEF.md`, then `CLAUDE.md` sections 5 and 6. This
file wins where it disagrees with the brief, because it is newer.

## How to work with Nathan and Jason

- Nathan (the account) directs. Jason builds in Xcode and sends back
  screenshots and errors. You have no compiler: the shell you get on the Mac
  is a Linux virtual machine with node but no Xcode and no swift, and no route
  to Wikipedia, Supabase or Google. Write carefully, ask for builds.
- Use gut judgment on most decisions. When a decision is really theirs, ask
  with the multiple choice tool, two to four options, one recommended. Do not
  send lists of open questions.
- Plain full sentences, seventh grade reading level, no em dashes anywhere,
  no abbreviations without the full term first. Commit when asked, with
  `-c user.name="Jason Page" -c user.email="jasonpage@users.noreply.github.com"`
  and the Claude co-author trailer. The Mac shell needs delete permission
  once per session before git can write its lock file.
- The bar for every screen: would a nineteen year old screenshot this.
- Nathan's verdict on the app before tonight's last change: underwhelming,
  because every fact was about the date, not the person. The fact finder
  below is the answer to that and it is the priority.

## State of the repository, all committed on main

Commits tonight, oldest first: `336f9f0` onboarding, candle, Mine stage,
icon, album and film charts, date facts. `52e819e` replay the reveal.
`b94b425` website front door, support, privacy, favicon. `d1ddc2a` share
card variants. `cd6acd6` fact finder plus token refresh. `5cb24f9` TestFlight
button and retry. Check `git log` for anything after.

What exists and is believed to work (Jason built once and the Mine screen
and share card rendered correctly; later commits are unbuilt):

- Onboarding: two screens. Day wheel answers with countdown, sign, stone and
  who shares the date. Year wheel answers live with weekday, Chinese animal,
  day count, then the number one song, album and film. Skip is a button.
  Place screen removed from onboarding, still in Settings.
- `Design/CandleMark.swift` flickers, glows, blows out. `Design/Motion.swift`
  has `CountingNumber` and `ConfettiBurst`. `Design/FactChips.swift` has
  `FlowLayout` and `FactChip`. `Theme.swift` has `StagePalette` (ink in dark,
  cream in light).
- Mine tab is the share card live: date, weekday, song, album, film, counters
  that count up, milestone line, chips. Birthday state with confetti and a
  candle you hold to blow out. Share button opens `ShareCardPicker` with
  `MyDayShareCard` plus `FocusCard` variants.
- Settings has "Play the reveal again" (full screen cover sequenced through
  the sheet's onDismiss).
- `Domain/DateFacts.swift` with tests: day of year, milestones, zodiac,
  Chinese animal, birthstone, flower. 97 domain tests pass.
- Worker: `charts.ts`, `import-charts.ts --chart songs|albums|films`.
  Database has Hot 100 from 1959, Billboard 200 from 1964, US box office from
  1946. `ChartWeek.Chart` enum, `repository.numberOne(on:theWeekOf:birthYear:)`.
- Website: landing page with date index, `/support/`, `/privacy/`, favicon,
  TestFlight button (`TESTFLIGHT_URL` in `web/src/pages.ts`, `APP_STORE_URL`
  empty until launch). `support@birthed.app` is set up and forwards.
- App icon regenerated bold; `CandleMark` ratios match it.
- `AccountService.freshAccessToken()` refreshes the session token. Before
  tonight nothing did, so pushes and deletion died after an hour.

## The fact finder, half done, top priority

Nathan rejected hand curated fact types ("naive") and asked for AI to find
facts about a specific birthday by itself. Decisions he made: run it as a
Supabase Edge Function on demand; trust Gemini's grounding, no page check;
facts appear on Mine when ready. He also asked for caching per date and per
date plus year, and likes so the best fact for exact birthday sharers rises.

Built and deployed:
- Migrations `20260906010000_birth_facts.sql` and
  `20260906013000_birth_facts_any_year_and_likes.sql`, applied. Tables
  `birth_facts`, `birth_fact_runs`, `birth_fact_likes`. Row level security
  on; only `verified` facts readable; likes insert and delete only your own.
- Edge Function `find-facts` (`supabase/functions/find-facts/index.ts`),
  deployed, version 3. POST `{month, day, year?, region?}`. Year absent means
  year 0, the calendar day across history. Runs one shared search and one
  regional search, answers at once, searches in the background with
  `EdgeRuntime.waitUntil`, retries a failed run after two minutes.
- `Data/FactsService.swift` (ask, read with likes count, poll, toggle like)
  and `Domain/Models/BirthFact.swift`.

Blocked: the `GEMINI_API_KEY` secret in Supabase is rejected by Google with
"API key not valid" on two runs, including one after Nathan said he fixed it.
Get a key from Google AI Studio (aistudio.google.com, Get API key), save it
under Supabase, Edge Functions, Secrets, then test without leaving the
database, since no shell here can reach Supabase. `pg_net` is enabled:

    delete from birth_fact_runs;
    select net.http_post(
      url := 'https://lunqqhjwqrpbujwxwdzk.supabase.co/functions/v1/find-facts',
      headers := '{"Content-Type":"application/json","apikey":"<anon key>","Authorization":"Bearer <anon key>"}'::jsonb,
      body := '{"month":9,"day":4,"year":2002,"region":"Salem, Oregon"}'::jsonb);
    -- wait a minute, then
    select * from birth_fact_runs; select fact, source_url from birth_facts;

The anon key comes from the Supabase MCP `get_publishable_keys`. A demo run
of the same idea done by a research agent for September 4, 2002 found: the
Oakland A's 20th straight win that day, Kelly Clarkson crowned first American
Idol that night, 74 degrees and dry in Salem, a false "new moon" found the day
before, gas at $1.44, older than Animal Crossing, Kingdom Hearts, Xbox Live.
That is the standard the model output should be judged against.

Not yet written, in order:
1. Wire `FactsService` into `BirthedApp` and `RootView` (environment, built
   with the `AccountService`).
2. Mine: a "Found about your day" section under the stage. Each fact as a
   row with a small source link and a thumbs up with the count, most liked
   first. While searching, "Looking into September 4, 2002" with a small
   candle; facts slide in. Local facts (region key not empty) marked as such.
   Start the load in Mine's `.task`.
3. Share: top facts as `FocusCard`s in the picker (needs a smaller title
   size parameter, sentences are long).
4. Privacy page: one sentence that the date, year and region are sent to
   Google's Gemini service to find facts, nothing identifying with them.
   Also the App Store privacy answers may need "Other data" reviewed.
5. Then the two remaining data stages from earlier: most watched TV show by
   season, and historical events on the day (the `historical_events` table
   has been empty since slice 1). Both may be redundant now that Gemini
   finds events; decide with Nathan.

## Things Jason still has to do or test

- Build and screenshot: fresh onboarding to 2002; Mine dark and light; the
  share sheet with the card row; the birthday state (set the date to
  September 4) with the candle hold; "Play the reveal again" from Settings.
- `worker`: `node dist/src/import-day.js 1 1 --dry-run --print`, then
  without `--dry-run`. January 1 is the one date with nobody on it because
  Wikidata files year only birth dates there; the precision filter makes it
  safe. Redeploy the site after.
- App Store Connect: category should be Lifestyle, not Finance (CLAUDE.md
  still says Finance from the rewards era). Listing copy was given in chat;
  it is not in the repo yet, worth adding as `docs/app-store-listing.md`.
- Reddit: `rarest-birthdays-heatmap.png` and the ranked chart were made
  from the FiveThirtyEight birth file; they live in the chat outputs, not the
  repo. Consider committing them under `docs/growth/`.

## Rules that bit tonight

- A 600 point view inside a `ZStack` makes the whole stage 600 wide; put
  decoration in `.background` and `.overlay`.
- `ImageRenderer` draws one frame of a `TimelineView`; share cards use
  `CandleMark(animated: false)`.
- Presenting a full screen cover while a sheet is dismissing is dropped;
  sequence it through `onDismiss`.
- The `chart_weeks` migration was missing from the repo; it is there now.
  Never let a migration exist only in the database.
- Nothing in the app or site may claim data stays on the phone. The people
  list does; the birthday, year and region do not.
