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

## The fact finder, working, unbuilt in the app

Nathan rejected hand curated fact types ("naive") and asked for AI to find
facts about a specific birthday by itself. Decisions he made: run it as a
Supabase Edge Function on demand; facts appear on Mine when ready; cache per
date and per date plus year; likes so the best fact for exact birthday
sharers rises.

Proved on September 4, 2002, Salem, Oregon. Shared date: eight searches, ten
facts, nine with links that resolve, twenty seven seconds. Salem: five
searches, four facts, two that survived, twenty one seconds. The Salem run
returns a high of 74 degrees Fahrenheit and a low of 44 with no rain, and the
Salem-Keizer Volcanoes finishing 41 and 35 that day, which is the standard the
demo run set.

### What it took, and what not to undo

- **The `GEMINI_API_KEY` secret held a Supabase JSON Web Token**, not a Google
  key. That was the "API key not valid" for two nights. The function now
  refuses to start a run when the secret begins with `ey` and says so.
- **Grounded search is a paid feature.** On the free tier every model
  generates fine and every model returns 429 on the search tool. Billing is on.
  Google gives 5,000 grounded searches a month before charging, then $14 per
  1,000. One date plus one region cost thirteen searches, about eighteen cents.
  The `searches` column on `birth_fact_runs` records the real count per run,
  which is the only honest way to know what a date costs.
- **Two calls, not one.** Asking for the facts and for a JSON array in the
  same prompt made the model skip searching and answer from memory, with
  invented page addresses that looked right, including two different NASA
  addresses for the same picture. The first call only researches, search on,
  prose out. The second only reshapes those notes into JSON, no search, and is
  told to copy addresses rather than correct them. Do not merge them back.
- **`gemini-3.7-flash`, deliberately, not the newest.** Given the identical
  research prompt, 3.7 ran six targeted searches, 3.6 ran one, and 3.8 ran
  none and wrote from memory. Whether the model reaches for the tool is the
  whole job. Gemini 2.5 is closed to keys made after it shipped.
- **A run that reports zero searches is thrown away** and asked again, up to
  three times, with the nudge that it did not search. A call that ran no
  searches is not billed for any, so the retry costs nothing that matters.
- **Every cited page is opened before its fact is shown.** `verified` is what
  the read policy exposes, and a page that does not answer does not get it.
  That threw out three of fourteen on the proving run, including one whose
  fact was true. The known gap: this asks whether the page answers, not
  whether it agrees. One fact cites a real Postal Service page about the board
  of governors to support the price of a stamp. The quotation is stored on
  every row, so reading the page for it is the next level of strictness and
  needs no migration.
- **The regional prompt asks a different question.** Asked the same one, it
  returned eight duplicates out of twelve, which is a doubled bill and the
  same fact twice on screen. It now asks only for what the shared search
  cannot know: the weather there, the local paper, the local team, and it is
  told that two real local facts beat six padded ones.

### In the app, written tonight, unbuilt

- `BirthedApp` builds `AccountService` and `FactsService` together in `init`,
  because the second signs every call with the first's token.
- `Features/MyDay/FoundFactsSection.swift`, new. The section under the stage:
  category kicker, the sentence in serif, the source host, a thumbs up with
  the count, a NEAR YOU pill on regional facts, hairlines rather than cards.
  While a first search runs it is a lit candle and "Looking into <date>".
- `MyDayView` starts the load in a `.task`, puts the section directly under
  the stage, and adds the three most liked facts to the share picker.
- `FocusCard` gained `titleSize`, because a song title is three words and a
  found fact is a whole sentence. Facts use 58 against the default 104.
- The privacy page has a "Finding things about your day" section, the Sources
  screen has a Google Gemini card, and the Wikipedia card there no longer
  claims article text is unused, which stopped being true when chart weeks
  were parsed from it.

### Decided, September 6, 2026

The historical events stage is cut and its empty table goes with it, because
the fact finder covers events on the day better and puts a source on each one.
Most watched television show by season stays and is built as its own lookup,
the way the number one song is, because it is keyed to a year and a chart
rather than to a day, which is the one shape a search for a single date does
not reliably return. Recorded in `CLAUDE.md` section 5. Neither is built yet.

## The date pages, September 6

The facts are on birthed.app now, not only in the app. This is the half of the
distribution plan that search actually reaches, and until tonight those pages
carried nothing but a list of names, which is the one thing every competitor
in this category already has.

- **281 of the 366 dates are searched**, 2,751 facts, 3,169 searches. The
  remaining 85 stopped on a Google guardrail: a new billing account has a cap
  on spending rate, not only on requests per minute, and no batch size gets
  past it on the same night. `docs/backfilling-date-facts.md` is the top up,
  written to be run again whenever, and it skips whatever is already done.
  A date with no facts simply has no section, and the first person in the app
  with that birthday fills it in themselves.
- **These facts name the date rather than the reader.** "On January 5, 1914,
  the Ford Motor Company announced that factory wages would increase to five
  dollars per day." The first pilot wrote "on your birthday in 1914", which is
  right in the app and false on a public page, so `voiceFor` in the Edge
  Function now picks the voice from whether a birth year was given. A test in
  `web/test/render.test.ts` asserts no second person survives into the section,
  because that is the kind of thing that quietly comes back.
- `web/src/facts.ts` reads them, paged a thousand at a time for the same
  reason the chart weeks are. `renderDayPage` takes them as a third argument
  and puts the section above the songs and below the people, and the page
  description leads with them.
- The section is not cards. A sentence is the content, so it is set in serif
  at 19 points to be read, with a hairline between and the source host under
  each one.

**Not decided, and worth deciding.** `isReady` still gates noindex and the
sitemap on eight people with pageviews. That rule was written when a date page
was only a list of names, and it is why a page can be held back for thinness.
A page with ten sourced facts on it is not thin any more. Whether facts should
count toward readiness is Nathan's call and it is in `CLAUDE.md` section 5.

## The Today tab, September 6

The design brief called this the fifth weakness and the reason was that the
screen was ten names, which is the one thing Famous Birthdays already wins at.
It now opens with what happened on that date, and the names follow.

- `FoundFactsSection` is reused rather than copied, with a settable heading,
  so the Today tab says WHAT HAPPENED ON THIS DAY instead of claiming a date
  the reader is only visiting is theirs.
- **It reads and never asks.** `FactsService.readDay` has no POST in it. A
  search costs real money for every date it has not seen, and this screen
  walks from date to date with two arrows, so a reader flicking through a
  month must not be able to spend a month of searches. Dates nobody has
  searched simply have no section, and nothing announces the absence.
- `FactsService` now keeps two lists, the reader's own and the date being
  browsed, because the Today tab moves and Mine does not. A like moves both,
  since the same fact can be on screen twice when a reader is looking at their
  own date on the Today tab.
- **The first fact in any section is set at 27 points against 19.** The list
  is ordered by likes, so the top row is the one the crowd chose, and a
  section where every row is the same size gives the eye nothing to land on.

## The night the credits ran out, and the ceiling that came from it

The backfill stopped at 283 dates because Google started answering "Your
prepayment credits are depleted". Before that it was a spend rate limit; then
it was the balance. 3,182 grounded searches and about 570 model calls were
spent getting there.

What was wrong in the estimate: the 5,000 free searches a month figure came
off Google's pricing page but from the table for Gemini 3.1 Flash Live
Preview, which said the allowance was shared across Gemini 3.x models. That
was extrapolated to 3.7 Flash rather than read for it. Whether the allowance
applies here or the token spend drained the balance separately is not visible
from a session; the usage page in AI Studio has the real number.

**`fact_search_budget` is the answer and it is now enforced.** One row, one
number, currently 3,000 searches a month. `fact_searches_left()` derives what
is left from `birth_fact_runs.searches`, so the meter cannot drift away from
the work that was actually done, and the Edge Function refuses to start any
run once it reaches zero. It answers `"paused"`, which the app already treats
as one more thing that is not "started" or "running", so it stops waiting and
shows what it has. A paused date is **not** written down as a failed run, on
purpose: the date is not the problem and caching a verdict about the budget
against it would be wrong.

Raise it by changing `monthly_limit` in that table. That is deliberately a
value somebody sets while looking at a bill rather than a deploy.

## What readers respond to

`docs/what-readers-respond-to.md` is the whole argument. In short: likes alone
cannot steer this, because a year specific bucket is shared by about one user
in five thousand five hundred and collects no votes until the app is very
large. What generalises is the shape of a fact, not the fact, so the app now
records impressions and share opens as well as likes, and
`fact_category_performance` turns those into rates with priors. Below 5,000
total impressions nothing steers anything, which is why every category
currently reads identical. That is the system working.

Every fact row now carries its own share control rather than only the top
three appearing in the picker. That was a product improvement and a
measurement one at once: with only the top three shareable, the only facts
anybody could send were the ones already winning, which is a ranking that
feeds itself.

The honest limits are in that document and they matter: share opens are not
completed shares, impressions are not eyes, the lead fact collects likes for
being large, and the counters are inflatable by anyone holding the key that
ships in the app. They rank a prompt and nothing else, and that is the only
reason those limits are acceptable.

## Things Jason still has to do or test

- **`docs/test-pass-september-6.md` is the list**, written for him, in order,
  saying what to screenshot and what right looks like. It covers the new
  section in both appearances, the searching state, the like surviving a
  restart, the reordering, the share cards, and a quick pass over the screens
  tonight could have broken by accident.
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
- A model given a search tool does not have to use it, and will not say that
  it did not. The list of queries Google reports back is the only proof, and
  checking it is what turned two nights of plausible looking invented sources
  into a run that works.
- Nothing in the app or site may claim data stays on the phone. The people
  list does; the birthday, year and region do not.
