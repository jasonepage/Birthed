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
