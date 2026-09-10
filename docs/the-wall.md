# The wall

Written 9 September 2026. This is the decided shape of the daily news wall.
It supersedes section 4 of `docs/the-pixel-problem.md`, deliberately, and says
so in section 7 below.

---

## 1. What it is

Birthed already knows what happened on a date. The wall is where people write
what is happening on it now.

Every calendar date gets a wall. People submit news stories with a link, and the
wording comes from the source page, never from the person. People spend a small
number of boosts on the stories they think will still matter years from now.
Support decides how much of a fixed square each story takes up. Then the date
closes at midnight and that wall is permanent.

The question it asks is not what is popular today. It is what will be remembered
about today. That is the same question the rest of Birthed asks about 1994, and
this is the layer where a reader answers it about the present instead of reading
somebody else's answer about the past.

**Why it belongs in Birthed and not beside it.** Birthed already owns the 366
date pages, the search surface, the imported history and the reader's age
against a year. The wall for 9 September 2026 freezes tonight and becomes part
of what 9 September is, which is the thing this product was already built to
show. It closes on itself.

---

## 2. Where it lives

At the top of the Today tab, above the existing `DayFeed`. The wall is the live
layer, the ranked feed of people, songs, films and events underneath it is that
date's history. One surface, one date, two layers that explain each other. No
fourth tab.

---

## 3. The three day window

A date is workable for three days and then it is finished.

- It **opens the day before** it happens. Submissions only, no boosting. This
  is for things already known to be coming: an election, a launch, a verdict.
- It is **live on its own day**. Submitting and boosting both.
- It gets **one more day after**. Submitting and boosting both. News that broke
  at eleven at night is not lost, and a day whose meaning is only clear the next
  morning still gets its stories.
- It **closes at midnight ending that third day**, forever.

So on 9 September a reader can work on the 8th, the 9th and the 10th. The wall
for the 9th closes at the end of the 10th.

**Midnight means midnight United States Eastern time**, for everybody,
everywhere. One date has to mean one thing or a permanent archive is not
possible. Eastern was chosen over Coordinated Universal Time because midnight
Coordinated Universal Time is five in the afternoon in Oregon, which would flip
a wall from today to yesterday in the middle of our own readers' evening.
Eastern closes a wall at nine at night on the west coast and five in the morning
in London.

---

## 4. Boosts

Three units on today's date. One unit on yesterday's date. None on tomorrow's.

Because a date is live on its own day and again the day after, one person can
put at most four units on any single date across its whole life.

Units are spendable one, two or three on a single story, which is how somebody
says they are certain rather than just interested.

**The limit is server authoritative.** Scarcity is the engine of the whole
thing, and a limit the client enforces is not a limit.

---

## 5. Getting onto the wall

Submit, then hold, then place. Nothing a person submits appears on the wall
immediately.

A submitted story sits in a holding pool until it has enough evidence and enough
support. Evidence means either two sources under different corporate ownership,
or a set number of hours having passed. Support means at least one boost unit,
so the board never fills with tiles nobody asked for. Boosts may be cast on a
story while it is still in the pool, which is also correct on its own: backing
something before anybody confirmed it is being early, and the record shows the
evidence was thin at the time.

`cultural_events` already has candidate, published and rejected with a curator
gate. The wall's pool is the same shape and uses the same instinct. A public
submission lands as a candidate, and the worst a bad actor achieves is a row in
a queue that a person then rejects.

**A story on the wall carries an evidence tier, never a verdict.** Seen
directly, meaning video, a filing, a record or an official statement. Reported,
meaning two or more independently owned outlets. Claimed, meaning somebody said
it and nobody has confirmed it. A claimed story is capped in size however much
support it has, so a rumour can be loud and cannot be big.

**No model is ever presented as deciding what is true.** What the checking does
is narrow and genuinely solvable: confirm a link resolves, and confirm the page
actually says what the tile says, by exact string match of a quotation against
the fetched page. A paraphrase fails and is discarded. Interface copy may never
say verified truth or fact checked.

**Every story has a receipt.** Every source, every quotation, every check, kept
and visible.

**A story later shown false is stamped, never deleted.** It keeps its exact
rectangle on the frozen wall. The archive records both what people believed that
day and what turned out not to be so, which is better history than a clean wall.

---

## 6. Who a person is here

Anonymous to other readers. There is no public handle, no profile page anybody
else can open, and no way to point at a tile and say that one is mine. That
matches the decision already made about answers.

Behind it, a persistent private account, so behaviour can be measured over
years. Reading needs no account and never asks for one. **Writing rides the
silent anonymous account Birthed already creates on first launch, and there
is no sign in screen, at any point, for any reason.** Decided September 9,
2026 in the second build session, superseding the earlier sentence here that
had Sign in with Apple requested at the first submission or boost. Birthed's
shipped rule is that nothing ever sits in front of reading, and the first
session already hung the wall off `profiles` through `wall_joined_at`, which
the database fills on the first write. The anonymous account is the account.

What stands in front of writing instead is App Attest, Apple's proof that a
request came from a genuine copy of the app on a real device. It guards
writes only, it is checked on the server and never trusted from the client,
and reading needs nothing. Section 12.

**What is recorded, permanently and immutably, for every boost:** who, which
story, how many units, when, the evidence tier at that moment, and how much
support the story already had at that moment. None of those last three can be
reconstructed afterwards, which is why they are captured from the first version
even though nothing uses them yet.

**What is not built:** any accuracy, karma, reputation or influence formula.
Everyone has equal weight and nothing changes it. No leaderboard. No public
record page. No score shown to anybody, anywhere.

The distinction that makes both of those true at once is that recording is not
displaying. Birthed already records every answer against a token and shows
nobody a number. The right formula can only be chosen by looking at a year of
real outcomes, and every field one could need is already being kept, so turning
one on later is a view rather than a migration over history.

Outcomes are recorded on a story's anniversaries at one, five and ten years:
whether a correction stood, and whether it still held a place. Three outcomes,
not two. Held up, turned out false, and true but forgotten. Folding the third
into wrong would make every number dishonest.

---

## 7. The reversal, stated plainly

`docs/the-pixel-problem.md` section 4 says do not build a live canvas, and gives
the reason: a number that moves is a direction, a direction is a weapon, and
this site carries September 11. `docs/first-impression-brief.md` forbids the
same things.

**That is overruled for the wall.** The wall is live. Tiles resize while the
window is open and a reader watches the day take shape. Without it there is no
reason to come back today rather than next week, and the deadline is the whole
mechanic.

The reasoning in section 4 was not wrong, it was answering a different question.
It is about the reader's first screen and about counts attached to remembrance
answers. The wall is a different object with a different promise. Both documents
stay accurate about everything else they cover.

**What the reversal does not license.** No live count of people here now. No
ticking numbers anywhere outside the wall itself. Nothing on the Today tab
underneath the wall changes behaviour. The concern behind section 4 is real and
the handling of solemn dates is an open question in section 9.

---

## 8. Deliberately not built

Pixel art inside tiles. That is a later phase and the wall's Phase One mural is
the tiles themselves. Comments, replies, following, messaging or any user to
user contact. A leaderboard. A public profile. Any karma formula. Deleting
anything.

---

## 9. Open

**Solemn dates.** September 11 and dates like it. The reversal in section 7 is
about the ordinary case and does not settle this one. Options considered and not
yet chosen: a curated list of dates that render static, or a rule based on the
history already attached to a date.

**Early tiles boxed in, settled September 9, 2026 in the second build
session.** Section 10 found that growth went only right and down, so the
first stories on a busy day were surrounded by one module tiles within the
hour and could never grow whatever support they gathered. Growth now
considers all four directions: a whole free column on the right or the left,
a whole free row below or above, width still preferred while the tile is at
most one and a half times as wide as it is tall, right before left and down
before up. A tile still never shrinks and never gives up a module it holds;
the rectangle that comes out of a run always contains the one that went in,
and only its top left corner may move outward. Pixels, when they arrive, are
stored in board coordinates rather than tile coordinates, so a corner moving
outward changes nothing anybody drew. On the seeded September 5 the two seen
directly stories with 71 and 62 units now hold eight and twelve modules and
the claimed story with 38 still holds its four. The other two options section
10 listed, a placement margin and a reservation, were not taken: both spend
board on stories that may never earn it.

**The anniversary outcome job.** The table exists and stays empty. What counts
as a story surviving to its anniversary is undecided on purpose, because it
reaches into the reputation question that is deliberately deferred, and the
first anniversary is a year away.

---

## 10. Decided in the first build session, September 9, 2026

The data layer, the placement engine and the read only wall on the web date
pages were built in one session. These are the calls that session made that
the sections above do not settle. Sessions two and three should read this
before touching any of it.

**The hold is twelve hours.** Section 5 says a single source story leaves the
pool after "a set number of hours" and never set the number. It is twelve,
`HOLD_HOURS` in `worker/src/wall/pool.ts`: a story with one source is placed
by the following morning, and a rumour is not on the wall an hour after it
is posted. Two sources under different ownership still place at once.

**Pages bake at build time, the same as every other section.** A wall
appears on birthed.app after a deploy, and until then the page shows the
wall the build saw. This keeps the promise `serve.ts` makes, that an
ordinary page view calls nothing, and it is the right call while nothing can
submit or boost. It also means the live resizing promised in section 7 is
not yet true on the web. The session that adds boosting decides how the open
window's pages get fresh, and `withResult` in `serve.ts` is the precedent for
a request that reads the database and falls back to the baked page.

**A date page shows only the newest year's wall.** A page is a month and a
day; a wall is a date with a year. When September 9 has a 2026 wall and a
2027 wall, the page draws 2027 and nothing of 2026. Every story on every
year's wall keeps its receipt page at `/<date>/wall/<story id>/`, so the
older wall is not lost, it is just not drawn. Nathan chose this over the two
alternatives, older years drawn smaller below or every year stacked.

**The receipt page is under its date and carries noindex.** It is for a
reader who followed a tile, not for a search result, and a few hundred pages
of other outlets' quotations is not what this domain should be indexed for.

**Eastern midnight is computed by the database, never sent by a client.** A
trigger on `wall_days` fills `opens_at`, `live_at` and `closes_at` from
`wall_date` on every insert, and whatever the caller sent for those columns
is replaced. The window is stored rather than derived on read because time
zone rules are data that can change, and a stored instant is the one that
was true when the wall opened.

**The budget is a trigger on `wall_boosts`.** Three units on the date
itself, one the day after, none the day before, with "today" being the
Eastern calendar date at the moment of the boost. The same trigger fills
`tier_at_cast` and `support_before` from the story row at that instant, so a
caller cannot supply them and cannot get them wrong. A second trigger
refuses every update and delete, and triggers are not bypassed by the
service role, so the worker and the dashboard are bound by it too.

**`booster_id` is a value, not a foreign key.** A foreign key to `profiles`
would force either a cascade that deletes history or a set null that edits
it, and a boost row is never edited. When an account is deleted the row
keeps a random identifier that points at nothing, on the precedent of
`events.profile_id`. `wall_stories.submitted_by` is a foreign key with set
null, because a story is not immutable.

**`profiles` gained one column, `wall_joined_at`.** When the account first
submitted or boosted. Nothing else the wall needs lives on the person, and
nothing on the person is ever shown.

**Reads are public on every wall table, including `wall_boosts`.** That was
the instruction, and it means `booster_id` is readable through the automatic
interface by anybody with the publishable key. It is an opaque identifier
and names nobody, but it does let a reader see that the same account boosted
two stories. If that is unwelcome, the fix is a view or a column grant in
session two, not a change to what is recorded.

**`wall_stories.support` is a cache kept by the boost trigger.** It is the
sum of units and exists so the allocator and the page read one column. If it
ever disagrees with `sum(units)` the boosts are right.

**The placement engine.** `worker/src/wall/allocator.ts`, pure. Stories
already holding a rectangle are laid down first, all of them, before anything
grows, so a later story can never grow into an earlier anchor. Target size is
an area in modules, `clamp(1, ceiling, floor(support / 5))`. Growth adds a
column or a row at a time until the area reaches the target, and never takes
a step that would overshoot it: a six module tile with a target of eight adds
the row that makes eight, not the column that makes nine. A tile may
therefore stop short of a target its shape cannot reach exactly. Width is
preferred while `w <= h * 1.5`. A story that finds no free module is returned
as overflow, is tried again on the next run, and stays overflow in practice
because tiles never shrink and nothing is deleted.

**The tier comes from the sources, except seen directly.** Reported means
two sources under different owners with verified quotations. Seen directly
is a judgement about the kind of source, video, a filing, a record, an
official statement, and is passed in rather than guessed from a host name.
Anything else is claimed. `tierFor` in `pool.ts`.

**The seed is real articles and invented behaviour, and says so.** Every
story in `worker/src/wall/seed-stories.ts` is a real article from the public
feeds of NASA, NPR, Al Jazeera and ScienceDaily, with the outlet's own
headline and wording. Which date it lands on, who boosted it and when are
invented. Every check row the seed writes says the page was not fetched, so
a seeded receipt does not claim a check that never ran. The seed must never
run against the live project: a seeded wall on birthed.app would be a wall
of things nobody here said.

**Found, not decided: early tiles get boxed in.** New stories take the free
module nearest the centre, which is the module beside the last story placed,
and growth goes only right and down. So the first stories on a busy day are
surrounded by one module tiles within the hour and can never grow, whatever
support they gather. On the seeded September 5, two seen directly stories
with 71 and 62 units sit at one module each, while a claimed story with 38
units holds four. The rules in section 5 produce this exactly as written,
so nothing was changed. It belongs in section 9 with the solemn dates. Options not yet
chosen: growth in all four directions, placing a new story at the nearest
module that leaves a margin, or a tile reserving room when it is placed.

## 11. Decided September 9, 2026, after the second build session stalled

**A wall opens already carrying the day's news.** A square of sixteen tiles on
a day with four submissions is an empty room, and the thing this feature is
copying worked because the canvas was full. So each date's wall is seeded from
public news feeds when it opens, at the claimed or reported tier like any other
story, with the same receipts and the same checks. People then boost what they
think will last, and add what the feeds missed.

The cost is honest and worth stating: not every tile on the wall was somebody's
choice. What is somebody's choice is every tile's size, which is the part the
product actually measures. A seeded story with no boosts stays one module and
falls off the bottom of what anybody looks at.

**A seeded story is placed once its quotation verifies, and waits for nothing
else.** Neither the support rule in section 3.1 nor the twelve hour hold applies
to it.
That rule exists to stop the board filling with modules nobody asked for, and a
curated news feed is the asking. Applied to seeded stories it deadlocks the
wall before it opens: on September 9, 2026 the first live run put 72 stories in
the pool where every one of them waited for a boost, on a product with nobody
able to cast one. A story a person submitted still needs somebody other than
the submitter to agree it belongs. `isSeeded` in `worker/src/wall/pool.ts`, and
it means an explicitly null `submitted_by` and nothing else, so a caller that
forgets to read the column gets the stricter answer rather than the looser one.

The hold goes for the same reason. It exists so a rumour is not carved into
permanent history an hour after somebody posted it, and a story taken from
NPR's own feed is not that: the feed list is the vetting and the outlet
published it under its own name. Applied to a seeded story the hold does the
opposite of its job, because `submitted_at` is when the row was written rather
than when the thing happened, so today's news could not reach today's wall
until tomorrow. That is the one thing the wall exists to do.

Nothing that protects a reader is waived. One source still means the claimed
tier and a ceiling of four modules, and an unverified quotation still keeps a
story off the board completely.

This does not change the pool, the tiers, the receipts or the budget. A seeded
story is a submitted story whose submitter is the importer.

**`wall_sources.is_primary_doc` exists because the highest tier could not be
reached.** `tierFor` in `worker/src/wall/pool.ts` has always taken a
`seenDirect` argument and nothing in the schema recorded it, so it was always
false. The column is set by a person, never inferred from a host name, and a
primary document still has to verify its quotation like any other source.

**Open, and now urgent: the worker has no schedule.** `render.yaml` describes
one web service and nothing else. The checker, the seeding and the close job
all need to run on a clock, and two documents assume a worker cron service that
was never created. Either add one to `render.yaml` or decide the wall runs
another way, but it cannot stay unanswered past the next session.

---

## 12. Decided in the second build session, September 9, 2026

The write path, the checker, the news seeding, the fresh open date pages
and the wall on the Today tab were built in one session, in two sittings.
These are the calls that session made that the sections above do not
settle, recorded the way section 10 is.

**Identity is the anonymous account, and App Attest guards writes.** Section
6 now says so. The `wall-write` Edge Function issues a challenge, checks the
device's attestation once per install against Apple's App Attest root, and
checks an assertion over the challenge and the exact request on every write.
Apple's checks cannot be made in SQL, so after a good assertion the function
writes one short lived grant in `wall_attest_grants` with the service role
and calls the database function with the caller's own token. Both database
functions consume a grant first and refuse without one, so a call that
skipped the function is refused by the database rather than by anything a
client could argue with. The simulator does not support App Attest, so on a
simulator reading works and every write says so in one sentence.

**The database fetches the page, not the caller.** `wall_submit_story` takes
an address and nothing else. It normalizes it with the worker's key, written
again in SQL and held to the worker's answers by a test, returns the existing
story when that key is already on the date, and otherwise reads the page
itself through the `http` extension and takes the headline and outlet from
the Open Graph tags, falling back to the title element and the host. There is
no argument through which wording could arrive. The first source's quotation
is the page's own description, or its headline when the description is
shorter than twenty characters. A headline longer than the column is cut at
a word, fewer of the source's words and never different ones.

**Exact match means exact match, with whitespace folded.** The quotation
rule is written twice, in `wall_page_contains` for submission and in
`worker/src/wall/page.ts` for the checker, and `worker/test/wall-page.test.ts`
runs both on the same fixtures. The page is read as its visible text with
scripts, styles, comments and tags gone and entities decoded, and as its
markup with the same things gone, so a description carried in a meta tag
counts. Runs of whitespace fold to one space on both sides. Nothing else
about the quotation is changed and it is stored as extracted. Case differs,
a word differs, a paraphrase: fail.

**A story with no verified source never leaves the pool.** Section 5 says
evidence is two independently owned sources or a set number of hours, and
the hold in `pool.ts` would let a single source story through after twelve
hours whether or not its quotation was ever found. The checker requires at
least one verified source before the hold counts. A 404, a timeout, a
paywall or a rewritten page is not a source that waited long enough; it is
no source. `pool.ts` itself is unchanged.

**Every check is a row and verified_at follows the latest one.** The checker
writes a resolves row on every run, including runs that change nothing, then
a quotation row. A pass sets `verified_at` to that check; a fail clears it. A
page that changes after a pass gets a new failing row and the old row is never
edited. A page that could not be read is a failed quotation check too, so an
outage at the source clears the verification until the next run finds it
again.

**Owners come from a table, and an unknown domain is its own owner.**
`wall_outlet_owners` maps about a hundred and thirty news domains to their
owning group as of September 2026. `wall_owner_of` and `ownerOf` walk from
the host up through its parent domains, so `edition.cnn.com` resolves through
`cnn.com`. A host that matches nothing is its owner, never silently grouped
with anything and never silently separated from anything. The checker writes
the resolved owner back onto the source when it differs, so an edit to the
table reaches the receipts on the next run.

**Seen directly reaches the tier only through `is_primary_doc` with a
verified quotation.** Section 11's column, read by the checker and never
written by it.

**Ten submissions per account per Eastern day, and one to three units per
boost, both in the database.** The submission count is taken under an
advisory lock per account, so ten means ten under a burst. The boost budget
is still the first session's trigger, untouched; `wall_cast_boost` checks
units left first only to give a plainer sentence, and the trigger is the
authority.

**A boost carries a request identifier the app made for that tap.**
`wall_boost_requests` keys the first boost by it, and the same identifier
arriving again returns that boost and spends nothing, before a grant is
consumed and before the budget is asked. The app holds one identifier per
story while its request is in flight, `WallBoostLedger`, so a double tap is
one request and a retry after a lost answer is the same request.

**`booster_id` is recorded and not published.** A column grant on
`wall_boosts` leaves every other column readable by anybody and takes that
one away from the anonymous and authenticated roles. The row is exactly what
it was and the service role sees all of it. A client asking for every column
is refused and asks for the ones it may read; nothing in this repository
reads `wall_boosts` from a client.

**The helper functions are revoked from anon and authenticated by name.**
The project grants execute on every new function to both roles by default,
and revoking from public leaves those grants standing. `wall_fetch` in
particular must not be callable by a client. The first session's trigger and
window helpers are still granted by default; they are harmless and were left.

**Open date pages read the wall at request time, and only those.** Section 10
handed this to this session and named `withResult` as the precedent. For
yesterday, today and tomorrow in Eastern time, `serve.ts` reads the day's
wall with its sources and checks in two requests under a three second
deadline and swaps the fresh section in between markers `wallSection` now
writes on every date page. One read per open date per twenty seconds
whatever the traffic, a failure remembered for the same twenty seconds, and
when anything about the read fails the page is served exactly as built. A
closed date calls nothing. A Supabase outage costs a stale wall for a quarter
hour and never a site, which keeps the promise `serve.ts` makes.

**Growth in four directions.** Section 9 records it. The rectangle out of a
run always contains the one that went in; only the top left corner may move
outward. On the seeded September 5 the 71 and 62 unit stories now hold eight
and twelve modules.

**The worker has a clock.** `render.yaml` gains `birthed-wall`, a Render cron
service built from `worker/Dockerfile`, every fifteen minutes, running
`worker/src/wall/tick.ts`: the news seeder and then the checker. It carries
the service role key; the web service still does not. Section 11's open item
is closed. The close job, session three, runs there too.

**The news seeder is not the test seed.** `worker/src/wall/news.ts` reads six
public feeds, NPR, Al Jazeera, BBC World, The Guardian World, NASA news
releases and ScienceDaily, and files each item on the wall of the Eastern
date it was published, in the pool at the claimed tier, with the feed's own
headline, link and description and no boost, no check and no rectangle.
Eight items per feed per date. Its submitter is the importer, `submitted_by`
null. `seed.ts` still invents boosts and still must never run against the
live project.

**The wall on the Today tab sits between the date and the feed.** One square,
sixteen by sixteen, drawn from the stored anchors and sizes by `WallBoard` in
the domain and scaled to the width of the phone; never a layout that reflows.
Tapping a tile opens the receipt: every source, its quotation, every check
ever run. The boost control shows the server's count of units left, offers
one, two or three, and says plainly when the budget is spent, when boosts
start tomorrow, and when the date has closed. The submit flow takes a pasted
link and shows what the server extracted, with the headline drawn as text and
no field to edit it through. `WallClock`, `WallBudget`, `WallBoard`,
`WallBoostLedger`, `WallCopy` and `WallRows` are pure and tested under
`swift test`. Server time, from `wall_clock`, decides which three dates are
open and what phase a wall is in; the phone's clock is the fallback while the
answer is on its way.

**Found, not built: nobody can add a second source to a story.** Submitting
the same event from another outlet makes a different story under a different
address key, so the reported tier is reachable today only through source
rows a curator adds, or the test seed's two source stories. A "this is the
same story" flow belongs with the curation work and is not in this session.

**Found, not settled: the feeds were not fetched from here.** The session's
network could not reach the public feeds or any news page, so the six feed
addresses in `news.ts` and the fetch path in `check.ts` were tested on
fixtures and not against the live sites. The first tick on Render will say.

---

## 13. Decided in the third build session, September 10, 2026

Boosting from the web, and a board a person can read, were built in one
session. These are the calls it made that the sections above do not settle,
recorded the way sections 10 and 12 are. Nothing in sections 1 to 9 was
changed; where this session's instructions differed from them, the document
won and the difference is noted at the end.

**On the web a tap is a tap: one unit, always.** The one, two or three unit
conviction sizing in section 4 stays in the app. `wall_cast_web_boost` takes a
story and a token and inserts one unit; there is no argument through which a
size could arrive. A second tap on a story the same browser already backed is
answered `already` and spends nothing, which is what a double tap, a retry and
a change of mind all need, and it is why the web path carries no request
identifier the way the app path does.

**Identity is the token cookie the remembrance answers already use, hashed.**
The `bt` cookie serve.ts sets on a reader's first answer is now set on their
first tap too, and `wall_web_booster_id` turns it into the uuid shape
`booster_id` already has, so the same browser is the same booster every time
and the budget trigger counts it. The token itself never reaches a table and
nothing else about the person is recorded: no address, no profile, no
`wall_joined_at`, because there is no account to join with. Section 10's
decision that `booster_id` is a value and not a foreign key is what makes a
boost possible without an account existing.

**The trade, named.** A cookie is not a person. Anybody who clears one is a new
voter and can tap again, and there is no honest way around that without an
account, which section 6 says reading must never require and which the web
does not have. It is the same trade the answers already make, it is bounded by
the per address rate limit in serve.ts and by the budget trigger, and it is the
reason for the next decision.

**Every boost records how it was authenticated.** `wall_boosts.authenticated_by`
is `attested` for a boost that came through `wall_cast_boost` and consumed an
App Attest grant, `web_token` for one that came through `wall_cast_web_boost`,
and `seed_tool` for a row the test seed wrote directly with the service role.
The trigger fills it from a transaction local flag the two functions set just
before they insert; a value a caller sends in the column is discarded, and an
insert with no flag is refused unless it comes from the service role, which is
labelled as what it is. An attested boost and an unattested one count the same
today. The ledger knows which was which forever, so a future formula can weigh
them differently without a migration over history, which is the same reason
`tier_at_cast` and `support_before` were captured before anything used them.
App Attest is the anti-bot control and the web has no equivalent; this is what
makes opening the web safe rather than reckless.

**The app path is unchanged except for one line.** `wall_cast_boost` sets the
flag before its insert. The grant, the units, the request identifier and the
budget are exactly as section 12 left them. The migration was run against the
live project inside a transaction that was then rolled back, with the first
tap kept, the second on the same story answered `already`, the fourth of the
day answered `spent` by the database, one unit on the day after, `not_yet` on
the day before, and a direct insert labelled `seed_tool` with its supplied
value discarded.

**The route is /remember's shape, exactly.** `POST /boost` reads the story and
the date from a plain form, mints a token for a reader who has none, refuses a
malformed post as a 400 before anything is called, refuses a flood from one
address before the database is touched, calls the function, and answers with
a redirect to the date page carrying the database's word in the query string
and in the fragment. `?tapped=` permits the one wall read past the twenty
second cache, rate limited per address like `?kept=`, so the reader lands on
the count they moved. The fragment reveals one of seven sentences already on
the page, so the site answers without a script. A word the server does not
know is our failure and never a claim about the date.

**What a browser has done is written back to that browser and nobody else.**
`wall_web_standing` returns how many taps a token has left today and which
stories on the date it backed, and `wallMarks` in web/src/wall.ts turns that
into a style block appended to the page: "You backed this" on those stories,
an outline on the tile, and the remaining count rewritten through `::after`
content. The shared, cached section carries the allowance for a fresh browser
and the reader's own number lands on top. No totals, no other token's taps, no
count of people here, no direction. Section 7's line about what the reversal
does not license still holds.

**A tile is never smaller than a headline needs.** Four modules wide and three
tall, twelve modules, `MIN_W`, `MIN_H` and `MIN_MODULES` in the allocator. On
a phone that is about 84 by 62 pixels and three lines of headline; on a desktop
it is four. One module could hold a number and nothing else, and a diamond of
numbered squares was what birthed.app showed on September 9.

**The board holds twelve tiles, and eight of them may be stories nobody
backed.** `MAX_PLACED` and `UNBACKED_PLACED`. Twelve headlines is what a person
reads and twelve tiles at the minimum leave nearly half the square for growth.
The second number is the one that matters: the news seeder qualifies forty
stories at once, and a board it filled at the first tick could never be joined
by anything a person later chose, because tiles never shrink and nothing is
deleted. So the feeds fill eight tiles, four wait for stories people back, and
a tap on an unbacked tile makes room for one more from the feeds. Section 11's
promise that a wall opens carrying the day's news is kept; it no longer opens
finished. What qualifies and does not fit is overflow, in the list under the
board, which was already there and already said so.

**Among new stories, the most supported is placed first.** Then arrival, then
id, as before. A story people backed reaches the board ahead of one nobody did
when both arrive in the same run. Stored rectangles are still laid down first,
all of them, and are never displaced.

**One unit is one module.** `UNITS_PER_MODULE` goes from five to one. Five was
set when a boost could be worth three units; with a tap worth one, five taps
earned one module and the board never appeared to answer anybody. The target
is now the minimum plus one module per unit, capped at the tier ceiling, which
moves to twenty four for claimed and forty eight for confirmed so both sit
above the new minimum in the same proportions as before. A first tap takes a
tile from twelve modules to fifteen, four taps to twenty, nine to twenty four,
and a reported story reaches forty eight at twenty nine.

**The no overshoot rule bends where it has to.** Section 10 said a step that
would overshoot the target is not taken. With a minimum of four by three there
is no one module step, so a target one module past the tile could never be
reached and the first tap would be invisible, which is the exact thing the
retune exists to prevent. A step that does not overshoot is still taken first;
when every fitting step overshoots, the preferred one is taken. A story
stamped false is passed to the allocator as frozen and grown by nothing, so the
new minimum cannot quietly enlarge a rectangle section 5 says is kept exactly.

**Sizes still settle on the tick.** Rectangles are authoritative and the
allocator runs in the worker every quarter hour, so a tap changes the tile's
size within fifteen minutes and not on the page the reader lands on. What
changes on that page is the count, the story's tap count, and the reader's own
mark, and the sentence after a tap says so. Running the allocator on the web
server was considered and not done: it would make a page draw a wall the
database had not stored, which section 10 refused for the same reason.

**A baked page never carries a form.** Tap forms are drawn only in the section
serve.ts renders at request time, and only while the date is taking boosts by
the clock. So the fallback for a failed live read is a wall that can be read
and not tapped, which is the honest state when the database cannot be reached,
and a date that closed after a deploy never offers a tap the database would
refuse. The seven sentences are on every page, baked ones included, for the
reader whose tap arrives after midnight.

**Copy.** Nothing on the web page says boost. One sentence above the board says
what a tap is: tap the stories you think will still matter years from now,
each tap makes its story bigger on the square, and you get a few a day. The
count says what it means, "Two taps left today", and on the day after the date
"One tap left today on this date. It closes tonight." A story nobody has
backed says nothing about taps at all; "0 boosts" is gone from the tile, the
row and the receipt. The tier legend keeps its one line and gains that a tile's
colour is its tier, because the chip came off the tile to give the headline
its lines back. Nothing anywhere says a model decided anything.

**The privacy page moved in the same commit.** It now says the `bt` cookie is
set on a first tap as well as a first answer, and lists what a tap is: which
story, one tap, when, the tier and support at that moment, that it came from
the website rather than the app, and the token in a scrambled form. It says a
tap is kept for good and is shown to nobody as yours except the browser that
made it.

**Where the instructions and this document differed.** The session was asked
for "three a day, across all open dates". Section 4 says three units on the
date itself, one on the day after and none the day before, which lets one
browser spend four units in one Eastern day across two dates. The budget
trigger enforces section 4 and was not changed; the count on each page is that
page's. If three across all open dates is the intended rule, section 4 changes
first and the trigger follows.

**Found, not done: the live walls hold one module tiles.** September 8 and 9
were placed by the old allocator, twenty four and forty five tiles of one
module each, packed around the centre. The new allocator grows a stored
rectangle toward the minimum and never moves it, so on the next tick those
tiles try to grow into each other and the outer ring wins. No boost exists on
either date, so nothing anybody chose is in those rectangles. Returning the
unbacked placed stories on the open dates to the pool, with their rectangles
cleared, lets the next tick lay them out fresh under the new rules. That is an
edit to the live database and was left for a person to decide.

**Found, not settled: nothing here was run against the live site.** Neither
this session's shell nor the container it worked in could reach the project or
the public feeds, so the web path was tested against a mocked database and the
migration inside a rolled back transaction. The first deploy will say. The
acceptance in the session's brief, three taps on birthed.app with the count
going to zero and the fourth refused, is a person's to run after the migration
is applied and the site is redeployed.

**Not built, on purpose.** The close job, snapshots taken by anything new, the
permanent archive page, the shareable image: session three's prompt three, and
still ahead. Nothing writes to `wall_outcomes`. The iOS app was not touched:
`WallBoard` draws the stored rectangles and needs no change to draw the new
sizes, and its boost control still offers one, two or three units, which is
section 4 and stays.

**Revised the same evening, after the first real use.** Three things changed
once a person had used the wall on birthed.app.

The headline opens the receipt and a button spends the unit. The first
version made the headline the tap and the outlet name the link, and the first
person to use it could not find the receipt and did not want to spend a tap
to look. A headline opens the story because that is what a headline does
everywhere else, and the thing that votes now says what it is, in the footer
of every tile and at the end of every row. The rule in CLAUDE.md about a
second control doing the first one's job is about a value with a change
button under it; here reading and voting are two different acts and get two
controls.

The unit is a buzz. The mascot is a bee, so on the web the button says Buzz,
the count says "Two buzzes left today", and the mark says "You buzzed this".
`Voice` in web/src/wall.ts is the one place the word lives. `PLAIN_DATES` is
the list of dates that do not make the pun: September 11 and a handful of
others, where the wall still opens, still takes support and still seals, and
speaks plainly, "tap", "back this", "you backed this". This is the curated
list section 9 named as one of its two options, applied to the voice and to
nothing else; whether those dates should also render static stays open. The
list is a start and is meant to be edited by a person.

The tiles are honey. Every seeded story is at the claimed tier, and claimed
was the dark grey, so the square was grey on black. The three tiers are now
three tones of one hive: pale wax for claimed, amber for reported, deep honey
for seen directly. The colour still does the tier's job, the legend still says
so, and wax is the candle's own colour, so the site keeps one palette. Honey
as a reward for backing stories that last was raised and is not built: section
6 and section 8 refuse any score, and the anniversary outcomes that would feed
one are a year away. The shape that keeps the rule, if it is ever built, is a
private mark on the sealed page, "you backed this and it held", shown only to
the browser that made it and never as a number.

**The wall leads the date page.** Decided by Nathan the same evening. The page
opens with the date's name and the wall; the three "also on this date" cards
follow; the remembrance question is its own section with its clock and its
copy untouched; and what happened, what came out, the song and who shares the
date fold into one block a reader opens with a tap and a crawler reads whole,
under a line that counts what is inside. Nothing was deleted, because the
imported history is the search plan and the wall's context both. Two open
questions were named and not settled: the page now runs two games with two
clocks, and the honest long term shape may be one mechanic with two faces,
what will matter about today and what did matter about a past date. That
changes the year two measurement and is not a layout decision.

**The square is the product, decided by Nathan the same night.** A date page
is today's square, and every square this date has ever had. So: the page
zooms to its tiles (`viewportFor`, the smallest square that holds them,
never under eight modules, never over the board; the stored rectangles are
untouched and the sealed square is drawn whole); every date has a full
screen page at `/<date>/square/`; tomorrow draws an empty square with the
hour it opens rather than no section, and a date with no square yet says when
its first one opens; under the square only backed stories are listed and the
day's feed is one line a reader can open; the three card band, the day
before and after cards, and the calendar on every page are gone, the
calendar to its own page. The remembrance question keeps its section. The
lists and the band were where the page was a clusterfuck, in Nathan's word,
and none of them answered to the sentence.
