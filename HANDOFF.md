# Handoff, September 6, 2026, small hours

For the next session. Read this, then `CLAUDE.md` sections 5 and 6, then
`docs/first-five-minutes.md`. This section wins where it disagrees with
anything under it, because it is newer. Everything below is still true about
how to work with Nathan and Jason.

## Start here tomorrow

**The paste box becomes the front door of an empty People tab.** It is item 1
of the build order in `docs/first-five-minutes.md`, it has been item 1 all
along, and it is still not built. Nathan arrived at it independently tonight by
comparing Birthed to ReciMe, whose whole trick was that the content already
existed somewhere else and getting it in felt like nothing. `BirthdayText`
already does that trick: paste a group chat message or a pinned note and it
reads names and dates out of text that was never tidy, showing the line each
one came from. Right now it is the third item in an overflow menu.

An empty recipe box and an empty People tab fail the same way. Everything else
below can wait behind this.

## Where things stand

Fifteen commits on `main` since `28b35dd`, all pushed. `swift test` passes,
including the new `UpcomingDatesTests` and the four new `DayFeedTests`. The app
builds; Jason confirmed `contentMargins` and the three way `async let`. The web
suite is 89 for 89. The site is deployed and the day pages, the year anchors
and the `/add` page were all checked live in a browser.

## What was built, oldest first

1. **The one permission.** A row under the first person on the People list,
   switched on, with the system prompt held until the reader leaves the screen.
   Rewrites `FR-070`. Turning it off is an answer and the row does not come
   back.
2. **The website ran none of its own script.** `/add` had been blank in every
   browser since it was written, because the security header said
   `default-src 'none'` and nothing said otherwise. Fixed per path. A second
   bug in the same page showed both buttons at once, because `.btn` sets
   `display` and beats the browser's own rule for `hidden`. Both were invisible
   from the files they lived in, which is why both tests read the header and the
   stylesheet rather than the page.
3. **The events importer ran for real.** 19,734 events across all 366 dates,
   years 4 to 2026. It now removes what it no longer reads, so a re-run replaces
   a date rather than doubling it, and it counts lines before the common era
   apart from lines with no year.
4. **The day pages carry those events**, merged with the researched facts into
   one list ordered by year. September 4 went from 13 things to 60. Seven of
   the thirteen were the same event twice and are deduplicated by comparing the
   carrying words of two sentences in the same year.
5. **Every song year is linkable.** `/september-5/#1990` is a real address, which
   is the cheap half of the long tail. The expensive half, a page per day and
   year, is about 24,500 pages of four lines each and is what Google's spam
   policy calls scaled content abuse.
6. **The share cards say what happened**, and say nothing else. See below.
7. **The Today feed never leads with a mass casualty**, and is otherwise
   untouched.
8. **The follow sheet became six carousels** behind the "Add someone" menu,
   with a 20,000 monthly view floor on who can appear.

## The thing worth reading twice

Two surfaces show people, and they failed the same way for the same reason:
the lists are ordered by how much attention somebody gets, and infamy is
attention.

The share card said "You share it with Bashar al-Assad" on September 11, led
with Ted Bundy on November 24 and Charles Manson on November 12, and had Hitler
second on April 20. **A word list cannot fix this.** Wikidata calls Assad a
politician, Andrew Tate a businessman, and the December 17 lead an influencer.
Reading the 85 leading names by eye found three the keyword search had missed,
after the keyword search had already been written.

The fix was to stop needing the names. A card that has something that happened
on it shows no names at all, and a date with no researched fact falls back to a
screened Wikipedia line rather than to the names. All 366 dates now carry a
line and none falls through: 278 from a fact, 88 from an event.

An event's sentence describes the thing being refused. A person's description
does not. That asymmetry is why screening works on one and not the other, and
it is the single most useful thing learned tonight.

**This is not fixed in the app.** The onboarding line about who shares your
date has the card's celebratory framing rather than the day page's factual one,
and nobody has looked at how it is ordered. If it is ordered the same way, a
reader born on November 24 finishes onboarding and is told they share their
birthday with Ted Bundy. Check it before TestFlight.

## What Jason has to do, in order

1. Nothing is waiting on him from tonight. Everything is pushed, built and
   deployed.
2. `swift test` after the next change, as always.
3. Test pass item 30, the reminder loop on a real device. **Nobody has ever
   received a birthday reminder from this app and sent the message.** It is the
   central claim of the product and it is untested.
4. Test pass item 47, the five `WorldThen` dates, still written from memory.
   Blocks TestFlight.

## Decisions Nathan made tonight

All recorded in `CLAUDE.md` section 5 with the reasoning, and in the documents
they change. In short: notification permission moves to the People row; the
Today tab stays a tab and build order item 5 is dropped, because that verdict
was made about a screen that was ten names; the suggested public figures stay on
the empty People tab; the importer prunes on every run; discovery lives behind
the "Add someone" menu and not on the People tab; and finished work gets
committed without asking, with pushing still Jason's.

## Open, and honest

- **85 dates have no researched facts** and the budget to fix that is spent.
  `fact_searches_left()` is 0 against a 3,000 monthly limit with 3,182 used.
  Raising `monthly_limit` is a decision made looking at a bill, and it does
  nothing if the Google prepaid balance is still empty. Those dates are covered
  by the event fallback in the meantime, so this is no longer urgent.
- **Search Console was verified tonight and the sitemap submitted.** Give it two
  or three weeks. The Performance tab decides the `<title>` format, and it
  decides whether the 85 dates are worth topping up, rather than either of us
  guessing.
- **Nothing is measured in the app.** The four numbers named in
  `docs/first-five-minutes.md` are year entered, one person added, permission
  granted, and messages sent per reminder delivered. None exist. The last one is
  the whole product in one ratio. Before building it, work out where those
  events are recorded, because the privacy page makes specific promises about
  what leaves the phone and it must not be quietly softened afterwards.
- **The Today tab is kept on probation.** Its risk is that a third tab which is
  genuinely good becomes what the app is about, and this app is about the people
  you know. If people open Today and never add a person, item 5 comes back.

## Rules that bit tonight

- A header or a stylesheet can contradict a file that is completely correct, and
  nothing in that file will ever show it. Two bugs tonight were of this shape.
  Test the header, not the page.
- A word list written against a sample will miss the cases the sample did not
  contain. Both times tonight, looking at real output found what the list
  missed. Render the thing and look at it.
- `--env-file` overrides the shell environment, so a `.env` with a blank value
  is worse than no `.env` at all.
- The Linux shell on the Mac reaches GitHub but not Supabase, has no git
  credentials, and has no Swift. Jason pushes, Jason runs the toolchain.
- PostgREST answers at most a thousand rows and says nothing about the rest.
  Every read of a whole table here is paged for that reason.

---

# Handoff, September 6, 2026, late

For the next session. Read this section, then `CLAUDE.md` sections 5 and 6,
then the documents named below. This section wins where it disagrees with
anything under it, because it is newer. The older handoff below is still
true about how to work with Nathan and Jason and about the fact finder.

## Where things stand

Eleven commits on main since `17f025a`, all unpushed until Jason pushes,
`swift test` at 185 passing plus twelve `WorldThenTests` and three new
`DayFeedTests` not yet run. Jason has built the app in Xcode once since the
composer and the Today feed landed, so those compile; the world timelines,
the follow fix and the dealt feed have not met a compiler yet.

What was built tonight, oldest first:

1. **The birthday message.** Tapping "It is Sarah's birthday" opens a
   composer with two sentences already in it; the user edits and sends
   through Messages or the share sheet. `Domain/BirthdayMessage.swift`,
   four decisions rather than templates, judged on one hundred messages in
   `docs/birthday-messages.md` (two embarrassing, both the same known
   limit). `NotificationTapHandler` in `NotificationService` is the
   notification centre delegate. The pink card on People opens the same
   composer.
2. **The first five minutes.** `docs/first-five-minutes.md`: what activated
   means (year entered and one person added, first session), the one loop
   (reminder, composer, sent), and a keep, simplify, later, delete verdict
   on every feature. **One decision is Nathan's and is still open:** asking
   for notification permission from a row under the first added person
   rather than the Settings switch. That changes `FR-070`.
3. **The Today tab is a feed.** `docs/today-in-your-years.md`. Found facts,
   Wikipedia events, thirty people, and the number one song and film in
   every year of the reader's life, ranked by the reader's age at the time
   ("You were 7"), kinds taking turns, dealt inside a rank on every load.
   `Domain/DayFeed.swift`. Two migrations applied and checked in
   (`historical_events.fingerprint`, `chart_on_date`). `worker/src/
   import-events.ts` reads Wikipedia date articles and **has never been run
   against a real page**, because neither machine can reach Wikipedia.
   Until Jason runs it, the feed has no ON THIS DAY rows.
4. **The found facts are dealt, not ranked.** `Domain/FactOrder.swift`:
   likes count only from five; below that a seeded shuffle, new seed per
   load and per date change, never per poll. Pull down on Mine deals again.
5. **The Edge Function looks at a date again weekly** (deployed, version
   16), told what it already found, never with the last five hundred
   searches, and a failed second look leaves the date done.
6. **Follow fixes.** `PersonEditor` used to drop `wikidataID` and `deathYear`
   on save, so opening a followed person turned them into a friend. Fixed;
   the store refuses a second row for one identifier; the follow sheet
   deals a different twenty each open and leaves out people already
   followed.
7. **The world when you arrived.** `Domain/WorldThen.swift`: Fortnite
   seasons, Minecraft versions, iPhones, PlayStations, Pokémon generations,
   and arrival dates for ChatGPT, Instagram and others. "You are 15 years
   older than Fortnite." Five lines on Mine under the candle, each with a
   share. **The dates were written from memory** and are flagged for
   checking against the linked pages before TestFlight (test pass item 47).
8. **The site** has a "Born in" month strip under the TestFlight button.
   Needs a Render redeploy to appear.

## What Jason has to do, in order

`docs/test-pass-september-6.md` items 27 to 48, and the order matters:

1. `swift test`. Should be 200 for 200.
2. `cd worker && npm test`, then
   `node dist/src/import-events.js --dry --print --month 9 --day 5`. Send
   the output. This is the parser's first real page.
3. If it reads well, `node dist/src/import-events.js` for all 366 dates.
4. Build. Screenshots of the Today feed top and bottom, the People card
   with the paper plane and the composer, Mine with the new section.
5. Check five `WorldThen` dates against their Wikipedia pages (item 47).
6. Redeploy the site on Render.

## The question that was open when the session ended

Nathan asked, just before this handoff: the app is "giving vibecode", so
how would a Native American in the 1930s critique it, how spiritual is it,
how connected is it to the limited time we have on earth. It was not
answered. It deserves a real answer, not a feature. The honest starting
point: almost everything on Mine describes the world, and only two things
measure the person's time in it, the day count and the milestone. The
People tab and the remembered state for the dead are the most human parts
of the app. Place, season and the land somebody was born on are absent
entirely. Answer it in conversation first; do not turn it into a sprint.

## Rules that bit tonight, added to the ones below

- A representable's stored property cannot be called `body`; it is taken as
  the `View` requirement.
- An `async let` may only capture what is `Sendable`; copy `self`'s fields
  to locals first. `DayPageRepository` is `Sendable` for this reason.
- `nonisolated final class` for a delegate the system calls off the main
  actor, with only a `String` crossing back.
- `Hasher` is seeded per launch; anything that must be stable across loads
  uses its own hash (`DayFeed.stableHash`, `BirthdayMessage.seed`).
- The Linux shell on the Mac has node and no swift; Jason's own terminal
  has swift. `swift test` is his two second loop.
- Neither machine reaches Wikipedia or Google. Anything that reads them is
  written blind and proved by Jason's first run.

---

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

**Settled, September 6.** The pageview run finished and the site now builds
366 ready and 0 carrying noindex, up from 194. The readiness rule did not need
changing and was not the problem: 171 dates had about fifty people each and no
pageviews, so they were ordered by how many languages have an article. March 31
now opens Jack Antonoff, Ewan McGregor, Christopher Walken, with Bach ninth.
Under the old ordering Bach was first on that page by a mile.

January 1 is the single exception and always will be. Wikidata files every
birth date known only to a year on January 1, so that query is enormous and
times out at their gateway with a 504 after four attempts, and even when it
answers the importer's precision filter correctly refuses every row. It has no
people and never will. It is ready on its twelve facts instead, which is what
the one carve out in `isReady` is for. Do not spend time trying to import it.

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

## What the facts are made of, and the one thing not yet proved

The first full backfill came back 26 percent space and science: 720 of 2,751
facts about comets, probes and discoveries. All true, all sourced, all shaped
like an encyclopedia rather than like something a nineteen year old
screenshots. The model reaches for that because it is where the clean
citations are, and nothing was telling it not to.

`TASTE` in the Edge Function is the correction. It names who is reading, names
the internet explicitly, caps space and science at two per date, and steers
internet citations at the encyclopedia article or the platform's own page and
away from posts that will not open when logged out, since those fail the link
check and take a good fact down with them. The birth year run must now return
at least three things the reader is older than, with the date each arrived.

That last one matters more than it looks. "You are older than Kingdom Hearts"
is the strongest sentence the product has, because it is the only one that
measures the world against the reader rather than describing it, and it was 4
facts out of 2,751. A calendar date run cannot produce one at all: there is no
birth year to compare against. It only exists on the birth year path.

**None of this is verified.** The Gemini credits emptied before any search ran
against the new prompt. The first run after a top up is the test, not the
prompt reading well. Check it with:

```sql
select category, count(*) from birth_facts
where verified and generated_at > now() - interval '1 hour'
group by category order by count(*) desc;
```

Science and space should be at most two per date, and `older_than` should be
the top category on a birth year run rather than a rounding error.

### Decided, September 6

The number one album and the number one film stay on the Mine tab as they are
for now. Nathan called the chart data filler and he is right about those two
and wrong about the song, which is the one thing the design brief says people
read out loud. The decision is to wait for Jason's screenshots before moving
them, because nobody has seen that stack with a facts section underneath it
and the answer may be obvious once somebody has.

## Getting friends' birthdays in, September 6

The People tab is the only screen that gives somebody a reason to open the app
in a month that is not their own, and it only works when it has people in it.
One name at a time is where that dies. Two ways in now, and neither asks for a
permission or sends anything to a server.

**Paste.** `Domain/BirthdayText.swift` reads names and dates out of whatever
was pasted: a pinned message, a shared note, a numbered list. Line based,
because that text is never in a tidy format and never will be. Every candidate
carries the line it came from and the screen shows it, because a reader can
only check a reading they can see. 13 tests, including that a phone number is
not a birthday, which the obvious version of the number rule gets wrong.

**The link.** `Domain/PersonLink.swift` puts a date in the fragment of a
birthed.app address, which is the part browsers never send, so a birthday
moves between two phones without birthed.app learning that anybody exists. 14
tests, one of which only exists because the first version left a space in the
allowed character set and every two word name would have produced a nil link.

**The link carries no name, and that is not laziness.** The privacy page says
Birthed never asks your name, and it does not. A link about yourself is a date.
Whoever adds you writes what they call you, which is what they were going to do
anyway, because nobody files a friend under their legal name. A name only
travels when somebody typed it about themselves on the web page, which is them
volunteering it rather than this app collecting it. Do not add a name field to
the app to "improve" this.

**The web page at /add** does both halves: it shows an arriving birthday and
hands off to `birthed://`, or, with nothing after the hash, it is a form that
builds a link to send back. It carries noindex, because it is a handover
between two people and not something anybody should find in a search.

**The privacy page lost a sentence it could no longer support.** It said the
site runs no scripts. One page now does, so it says which page, what the script
reads, and why that specific design is the reason no birthday reaches the
server. A privacy page that is wrong about something checkable is worse than
one that explains itself.

**Jason has one manual step.** The `birthed://` scheme has to be registered in
Xcode by hand, because this project generates its Info.plist and a URL type is
an array of dictionaries that `INFOPLIST_KEY_` settings cannot express. It is
in the test list at the top. Without it the link items do nothing and it looks
like broken code.

## Following public figures, September 6

You can now add somebody out of Birthed's own list to the People tab, from a
search or from a suggestion list. They sit in the same countdown, marked by
carrying a `wikidataID`.

**The notification rule is the part with teeth.** iOS keeps 64 pending
requests and drops the rest silently, so following people could quietly cost
somebody a friend's birthday and nothing would say so. A public figure gets the
morning of, and not the three days before, because the run up is for buying
something and having it arrive. And people you know fill the plan before people
you follow, whatever the dates. Four tests, one of which follows 84 people in
January to February and checks a friend in December still keeps both of hers.

**The suggestions are a query, not a model, and Nathan asked for a model.**
`has_social` already exists and its own comment describes it as the signal that
somebody exists on the internet rather than only in an encyclopedia, which is
the internet versus real life axis. Born near you is subtraction. For a birth
year of 2003 that is 2,107 candidates, 999 genuinely looked up. A model would
cost money per request, could name somebody who does not exist, and would not
order them better than the number of people who looked them up.

**But the straight sort was wrong and shipping it would have been bad.** The
first real query returned Haaland, Bellingham, Sinner, Cucurella, Paredes and
Zverev. Six of six athletes, because they carry enormous encyclopedia traffic
and all have an Instagram, so every signal says footballer loudest. That is the
same failure the day page ranking hit before sitelinks were replaced.
`Domain/NotableMix.swift` fixes it by reading a coarse kind off the one
sentence Wikidata writes and rotating between kinds, so popularity still picks
who is on the list and this decides how many of each. Six tests.

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
