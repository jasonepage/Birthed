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

**One tap is one unit, on the web and in the app.** Decided September 10, 2026
by Nathan, and it replaces the rule this section carried until that evening,
that units were spendable one, two or three on a single story as a way of
saying somebody was certain rather than merely interested. The web shipped one
unit a tap that day and section 13 recorded that the conviction sizing stayed
in the app. It does not. Two products with two rules for the same button is not
the dead simple thing this was asked to be, and a reader who moves between the
phone and the site should not have to learn the same button twice. What is lost
is the way somebody said they were certain; what stands in its place is that
they had three taps that day and chose to spend one here. Section 14 records
the app catching up.

**The limit is server authoritative.** Scarcity is the engine of the whole
thing, and a limit the client enforces is not a limit. The database still
accepts one, two or three units in a single call, because `wall_cast_boost` and
the budget trigger were built that way and narrowing them would edit a written
history for nothing. No client sends more than one.

**A buzz is irreversible after thirty seconds.** Added September 10, 2026,
and it is the one amendment to the word permanent this section carries. A
buzz can be removed for thirty seconds after it is cast, by the person who
cast it, on a date that has not sealed, and the unit goes back to that day's
budget because the budget counts the rows that exist. It is a window for a
misclick and it is far too short to be a way of changing your mind. The
argument, and what it costs, are the last entry in section 16.

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

Immutably, with one exception added September 10, 2026 and enforced by the
same trigger: a boost removed inside its thirty second window by the person
who cast it, which is a misclick and not history. Nothing else can update or
delete a row in `wall_boosts`, and nothing is written to record that an undo
happened. Section 4, and the last entry in section 16.

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
this site carries September 11. `notes/first-impression-brief.md` forbids the
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
anything, with the single exception added September 10, 2026: your own buzz,
by you, for thirty seconds, on a date that has not sealed. No story, no
source, no check and no sealed square is ever deleted by anybody.

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
outward changes nothing anybody drew. Withdrawn September 11, 2026: the board
is a pie now and a tile's size is its share, section 18. On the seeded September 5 the two seen
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

**Added September 21, 2026: a feed that points at other people's pages.**
The list above is fourteen newsrooms, and the sentence that justifies it is
that the feed list is the vetting and the outlet published it under its own
name. Hacker News is neither of those things. It publishes nothing. Its front
page is a list of other people's pages, ranked by its readers. It is on the
list anyway, for the reason the September 21 handoff gives: the people most
likely to find this product early read that page, and a board seeded from
NPR, the BBC, Variety and Billboard carries nothing they would recognise.

Three rules follow, and every one of them is settled by the address rather
than by taste, which is what keeps the receipt honest:

- **The outlet is the page's own host and never the aggregator's.** The feed
  entry carries an empty outlet and the address decides. A tile whose link
  goes to a research paper names the paper's host, because that is who
  published it and those are the words the receipt quotes. `outletOf` was
  already there and already did this for a link a person pastes.
- **An item pointing back at the aggregator is not a story.** An "Ask Hacker
  News" thread is a conversation on the site itself, and the only words it
  has to quote are its own page title. It would verify, which is worse than
  failing: a receipt for a discussion about the day is not a receipt for the
  day. The rule is by host, so it needs no headline pattern and catches every
  shape of the thing.
- **A headline ending in a year in brackets is an old page resurfaced.** That
  front page marks an article from 2019 "(2019)" by its own convention, and
  filing it on today's hive says it happened today. It joins the screen in
  section 15 rather than becoming a rule of its own, because it answers the
  same question that screen asks.

**What this costs, stated.** The cap on how many unbacked tiles one outlet
may hold counts hosts, so an aggregator is not restrained by it: both of the
board's news tiles could have arrived by way of one front page, under two
different hosts. That is accepted rather than fixed, because one buzz beats
every cap and the pool is what a board is chosen from. Many of these links
will also never leave the pool, because a paper, a code repository or a
personal page often carries no description the checker can match, and a story
whose quotation does not verify is never placed. That is the existing control
doing its job rather than a fault to work around.

**Ars Technica is the outlet beside it.** It publishes under its own name,
it carries a short description on every item, which is what the quotation
needs, and it is read by the same people. The Verge and Polygon were already
on the list and stay.

**Open, and the first tick is the test.** "Show Hacker News" items are let
through, because the screen in section 15 lets a headline through when in
doubt and somebody shipping a thing is a thing that happened. Whether a board
is better or worse for them is not a judgment anybody can make on fixtures.
Unmeasured as well: the date an item lands on is the moment it was submitted
to that front page, so an article published the evening before lands on the
next morning's hive.

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

**One feed, one verb, decided by Nathan the same night, and the name is the
hive.** The two open questions above are settled: there is one game. Everything
with a birthday on a date is a pixel. What happened on it, who was born on it,
what came out on it and the day's news are all wall stories in the one pool,
they take the same three buzzes a day, and any of them can take the hive.
There is no separate remembrance budget, no three answers, no birth year
question: the three answer game is off the page, and nothing of it is dropped
from the database. The square is called the hive, on the page and in the
path (`/<date>/hive/`), because a bee's board is a hive and "square" was the
allocator's word leaking into the copy.

How the history gets on. `worker/src/wall/history.ts` runs at the start of
every tick, before the news seeder, and files each open date's rows from
`historical_events`, `birth_facts`, `cultural_events` and `notable_people` as
wall stories, submitted by nobody, with the row's own link as the story's
one source and the row's own sentence as its quotation. The source is marked
`imported`, so the checker leaves it alone and the receipt says the importer
read it rather than claiming a check that never ran. The story's `url_key` is
its subject rather than its page, which is what keeps forty events that share
one Wikipedia article distinct and what keeps a row from being filed twice.

What goes first. The hive holds eight stories nobody has backed, and section
13 above left them to whichever feed item was read first. Now they are the
date's biggest history: `priority` on `wall_stories`, 3 for a row Wikipedia's
editors picked for the date or somebody wrote a lead line for, 2 for the three
most looked up people, 1 for the rest of the history, 0 for the news feeds.
The allocator considers higher priority first among stories with equal
support and decides nothing else; one buzz still beats any priority. The feed
under the hive is in the same order: most buzzed first, then priority, then
arrival, all of it, with no fold, because a reddit reads its feed and so does
this. The people are twelve a date, the most looked up, and a person whose
name and description make less than a sentence is skipped rather than filed
as a headline with nothing under it.

What the page draws before the worker has filed anything. A date with no hive
yet lists its history as plain rows under the promise, without buttons, and a
hive the worker has not filed a story for yet shows the same rows standing in
for the feed. The moment the worker files them they are stories, with the one
button, and the baked rows are not drawn beside the stories they became. The
number one songs stay behind one line, because a song is keyed to a year and a
chart rather than to a day and is not a pixel yet.

What did not change. The budget is section 4, unchanged. The tiers are
section 3, unchanged: a history story is claimed, like every other story with
one source, and its tile is wax. A tier is not a verdict and this document
still says so on every page. `DayFeed`, the remembrances table, the yearly
seal and four direction growth were not touched.

---

## 14. Decided in the fourth build session, September 10, 2026

The iOS app caught up to the date page in one session: the hive, the honey,
one buzz a tap and one feed on the Today tab. These are the calls it made
that the sections above do not settle, recorded the way sections 10, 12 and
13 are. Nothing in sections 1 to 9 was changed except section 4, which is the
first entry below, and which was changed before any code that depended on it.

**One tap is one unit in the app too, and section 4 says so now.** Nathan's
call, asked as the brief's first question. Section 4 carried the one, two or
three unit conviction sizing and section 13 re-affirmed that it stayed in the
app, so the document was edited first and the code followed it, which is the
house rule about which of the two wins. What is lost is the way somebody said
they were certain rather than merely interested. What stands in its place is
that they had three taps that day and chose to spend one here. The database
still accepts one to three, because `wall_cast_boost` and the budget trigger
were built that way and narrowing them would edit a written history for
nothing; no client sends more than one.

**One story takes one buzz from one install, and that rule is the app's, not
the database's.** The website answers a second tap on a story the same
browser already backed with `already`, and the app had nothing equivalent:
its request identifier stops a double tap and a retry and does nothing about
a third deliberate tap. Without this, three taps a day could all land on one
story, which is the conviction sizing arriving through the back door on the
same evening it was removed through the front. So `WallService.buzz` refuses
a second buzz on a story this install has already buzzed, and that tap never
leaves the phone. The budget trigger still counts units against the day and
still does not care which story they land on; this is a client rule, and it is
the same class of rule as the website's, held in the same kind of place.

**The mark is the device's own memory, because the database will not say.**
`wall_boosts.booster_id` is revoked from the app's role by the column grant in
section 12, recorded and not published. `wall_units_left` answers with a
number and nothing else. `wall_web_standing` takes a browser token and refuses
an authenticated caller, which is the brief's fourth question answered: the
app keeps its own read and nothing reaches for the web function. So `HiveMarks`
in the domain holds the story identifiers this install has buzzed, by date, and
`UserDefaults` keeps it between launches, which is exactly what
`RememberService` already does with this account's own answers and for exactly
the same reason. The oldest dates fall off at a hundred and twenty.

The trade, named, and it is the website's trade in a different coat. A
reinstall forgets the mark and a second device never knew it, so a reader who
restores a phone can buzz a story they had already buzzed. The buzz itself is
in the database forever either way, so what is lost is the mark and never the
vote, and the day's budget is still the database's and still three. Making
this survive a reinstall means a `wall_my_boosts(wall_date)` returning the
calling account's story identifiers, granted to `authenticated` only. That is
a migration, it was not written, and it is named here so the next session does
not have to rediscover why the mark is where it is.

**The window on the board is ported, not reinvented.** `viewportFor` from
`web/src/wall.ts` is now `WallBoard.viewport` with the same rules: the
smallest square that holds the placed tiles, never under eight modules across,
never over the board, the stored rectangles untouched. The halving is done in
floating point because that is what the website does, and a port that halved
in whole numbers answers a different origin on any spread whose centre lands
on a half module. Every expectation in `HiveTests` for it was printed from the
website's own function and pasted in, including that case, which is the only
thing standing between the two products drifting. The app also gains the full
screen hive that `/<date>/hive/` is on the site, reached from one link under
the board.

**One feed, and the app's feed is its own timeline rather than the website's
list.** The brief offered three shapes and Nathan chose the expensive one.
`DayFeed` keeps its order, which is arithmetic on the reader's age and is the
best surface in the product, and the buzz hangs off it: a row whose subject the
worker filed as a story carries that story's count and its button. The day's
news has no subject and no place in an order ranked by the reader's age, so it
sits at the top as this year's rows, in the feed's own order, most buzzed
first. Anything the worker filed that the timeline did not draw sits below the
timeline, because a filed story with nowhere to be buzzed is not one feed. A
row the worker filed nothing for draws no button, and the number one songs are
the standing case: a song is keyed to a year and a chart rather than to a day
and is not a pixel yet, exactly as section 13 says.

**A story on the hive is not drawn again in the feed, and its tile carries the
age line.** The website does not repeat a tile as a row and neither does this,
but the app had something to lose by copying that: the dozen stories the hive
promotes are the date's biggest history, and they are the rows whose "You were
7" is worth the most. So the line follows the story onto the tile.
`HiveFeed.ageLines` hands back the reader's age for every subject the timeline
drew and the tile asks for its own. A reader with no birth year lends no lines,
because `DayFeed` leaves the label nil and nothing downstream may invent one.

**One small difference from the website, on purpose.** The website's feed is
every story whose status is `pool` or `overflow`. The app's is every story
that is not on the hive, which is the same set plus two shapes that should
not exist: a story marked placed that holds no rectangle, and a story stamped
false that holds none either. The website drops those silently and the app
lists them without a button. The brief asked for every wall story not on the
hive and that is what this is, and a story the database holds that no screen
will draw is the kind of thing nobody finds until it matters.

**The words.** THE HIVE, and a unit is a buzz. `HiveVoice` and `HiveDates` port
`Voice` and `PLAIN_DATES`, so the same eight solemn dates speak plainly in the
app and on the site, September 11 among them, and a test asserts each one.
`HiveCopy` holds every sentence and every one of them takes a voice.
`WallCopy` was retired rather than renamed, so a sentence in the old words
cannot survive by being referenced from somewhere nobody looked. A story
nobody has backed shows no count at all rather than a nought, on the tile, on
the row and on the receipt. One test sweeps every sentence a reader can reach
and fails if any of them says wall, square, boost or remember, which is the
brief's acceptance written down as a test rather than as a hope.

**The honey is a palette of its own.** `HivePalette`, ported from the
website's stylesheet: pale wax for claimed, amber for reported, deep honey for
seen directly, with the ink that reads on each and a button colour that
inverts on the dark tile. `Theme` and `StagePalette.forScheme` were not
touched, which the brief asked for and which matters because seven files
including both share cards read the second one. The tier chip came off the
tile, so the headline gets its lines back, and the legend carries the sentence
that a tile's colour is its tier and a tier is not a verdict.

**The second clock came off the Today tab with the three answers.** The brief
asked for `RememberRow` and its three answers not to be drawn, and taking only
the buttons would have left the date's remembrance clock ticking beside the
hive's, its own budget counting down beside the hive's, and a line saying the
page was in the order the people who were here remembered it. Section 13 named
two clocks on one page as the problem and the same night settled that there is
one game. So the clock, the budget line and that sentence went too. Nothing is
dropped from the database, `RememberService` still loads, `RememberRow` and
the tables are untouched, and `/remember` still answers.

**Open, and named rather than guessed:** a sealed date still draws in the
order its own people remembered it, through `DayFeed.byMemory`, which section
13 says was not touched. The one sentence that explained that rearrangement to
a reader said "remembered", which the acceptance forbids on this screen, so it
came off and nothing replaced it. A page that visibly reorders with no reason
given is a small dishonesty, and rewording the sentence to dodge the one
forbidden word would be a larger one. Either the sealed order needs a sentence
that is true in the hive's vocabulary, or the sealed reordering belongs to the
archive rather than to the Today tab. That is Nathan's and Jason's, not a
layout decision.

**Found, not fixed: nothing here was compiled.** Neither this session's
container nor the shell on Jason's machine has a Swift toolchain, and the
proxy in front of both refuses `download.swift.org`, so `swift test` was not
run once. Every rule added here has a test written for it and not one of them
has been executed. The domain is pure and Foundation only and the tests assert
values printed from the website's own functions, which is the most that could
be done from here, and it is not the same as green. Jason builds in Xcode and
runs `swift test` on the Mac, and the first run will say.

**What did not change.** The budget's shape is section 4: three on the date,
one the day after, none the day before, server authoritative. The tiers are
section 3. The allocator, the checker, the worker, the close job, the archive
and the website were not touched. The app's read path is unchanged except for
three columns added to one select. `DayFeed`'s ranking, the yearly seal and
the sealed lead are as they were. Nothing was deleted from the live database
and no migration was written.

---

## 15. The ballot, not the button, September 10, 2026

The wall shipped to a phone and to a browser and then somebody looked at it.
The board was ten beige rectangles carrying a Professor Layton release date,
a column about jumping in Zelda, where to buy Kacey Musgraves tickets and a
question about whether the Seahawks can repeat. Three of the ten were from
one video game site. None of the ten were about September 9. Under it, a
feed of forty more of the same.

The reaction was that the mechanic was not working. It was working exactly
as built. A person handed that ballot and asked to spend one of three
permanent, irreversible votes on what will still matter years from now
answers correctly by spending nothing. **The scarcity was never the problem.
The candidates were.** Everything in this section follows from that sentence.

**The history seeder had thrown on every tick since the day it shipped.**
This is the whole of why the board was wire copy.
`cultural_events.event_date` is a date column and `readHistory` asked the
automatic interface for `event_date=like.*-09-09`, which builds
`event_date LIKE '%-09-09'`, which Postgres refuses outright: there is no
`date ~~ text` operator, so it answers 42883. The 400 threw out of the
`Promise.all` holding all five reads, took the whole date's history with it,
and `tick.ts` caught it, wrote one line to a cron log and carried on to the
news. On September 9 that is 129 stories in the pool, every one of them from
a news feed, against 40 events, 72 people, 10 facts and 11 cultural rows
sitting in the tables unread. Section 13's promise that everything with a
birthday on a date is a pixel has never once been true in production.

The date is screened in code now. Three hundred and ninety three published
rows in the whole table, so reading them and keeping this month and day
costs less than being clever, and it cannot ask a date column to match text
again. The schema, the unique index the upsert needs, the `wall_days`
trigger and the whole write path were checked against the live project
during the diagnosis and are all correct. The seeder never reached them.

**A stage that fails on every run looks exactly like a stage that failed
once.** `tick.ts` is right to let one half fail without stopping the other,
and that is not the same as this being visible. The only record of a day of
total failure was a log line in a Render cron job that nobody reads. Nothing
in the product could answer "has the history seeder ever succeeded." That is
the second bug and it is not fixed here.

**Variety is now a rule, because order alone was deciding the board.** The
allocator took the eight unbacked tiles in support then priority then
arrival order, and priority for a news story is zero, so among seventy news
stories the eight biggest things about the date were chosen by which feed
item was parsed first. Fixing the history seeder makes this worse before
better: history carries priority 1 to 3, so the board would have flipped
from eight news tiles to eight encyclopedia events and today would have
vanished from a wall whose entire reason for staying open three days is
today.

So `varied` in the allocator: at most three unbacked tiles are the day's
news, at most two of those from one outlet, and at most three are any one
kind of history. The date's history is deliberately not capped by outlet,
because every event on a date cites the same encyclopedia and that says
nothing about whether a board is varied; eight birthdays in a row does, and
the kind cap is what catches it. Two rules keep these rules from doing harm:
**one buzz beats all of them**, the same way it already beats every
priority, so nothing anybody chose is ever held off the board; and a slot
the caps cannot fill is filled in plain order rather than left empty,
because a varied board is worth something and an empty one is not. `varied`
decides order and never refusal, so a story it moves down still lands on a
quiet date.

**A ticket-buying guide is not a thing that happened.** The news seeder now
screens headline shapes that are never an answer to the question the board
asks: an opinion column, a question headline, a listicle, service
journalism about where to buy something, a release date, a review. Both
apostrophes, because half these feeds curl theirs and a screen that misses
"Here's Where to Buy" is not a screen.

It was written against the hundred and twenty nine headlines the live feeds
actually filed for September 9, 2026, and both lists are pinned in
`worker/test/wall-news.test.ts`: twelve it must catch and sixteen it must
not. It catches every one of the first and none of the second. It is
deliberately narrow because the costs are not symmetric: the junk costs one
tile and a false positive costs the day's news, so in doubt it lets a
headline through. This is not a deletion and nothing is removed from any
table. Section 11 says the feed list is the vetting; this is the same
vetting one level finer, applied before a row is written.

**Fourteen feeds at five a date is seventy candidates, and that is still the
open half of this.** The feed list grew from the six general ones section 12
named to fourteen, including sports, entertainment, gaming and technology.
The screen and the caps make the board survivable. They do not make a
seventy item pool curated, and the feed list itself has never been argued
about since it grew.

### Designed and not built

**Corroboration should decide the tier, and it would make the palette mean
something.** Every one of the 129 stories on September 9 is `claimed`,
because the news seeder files one source and nothing ever adds a second, and
section 12 already recorded that nobody can. So the three tones of honey are
decorative: a board drawn in the tier's colour is one colour, by accident,
forever. But six independently owned feeds all running the Moldova story is
the literal definition of `reported` in section 5, and `wall_outlet_owners`
and `ownerOf` are already built to answer it. Clustering the same story
across the feeds at seed time would give the board amber and deep honey,
make the receipts real, and produce editorial judgment from a count rather
than from a taste: how many independent newsrooms ran it is the most honest
free proxy for whether a day mattered.

It is not built here because a wrong merge is worse than a grey board. The
schema already carries a headline and a quotation per source, so a merge
fabricates no wording, but attaching a second outlet's story to the wrong
event puts a receipt on the page whose two sources are about different
things, and this document's entire discipline is that a receipt is exact.
It needs a similarity rule argued on real headlines and pinned the way the
headline screen now is, not a threshold somebody guessed at.

**The typed field, and it is the better answer to all of this.** Jason's,
September 10. Instead of "which of these forty things mattered," a field
that asks "what mattered about September 9?" and finds the story the person
means in the date's own pool. It turns a recognition task, which needs a
good list, into a recall task, which does not: everybody has an answer
before they open the app, and three buzzes stops being "pick three tiles"
and becomes "say three things about today, permanently."

The shape: a field, three chips under it drawn from the top of the board so
somebody with no answer still has one, and a confirmation showing the story,
its outlet and its tier before anything is spent. The confirmation is not
optional. A buzz is scarce, permanent and irreversible, and a silent wrong
match spends it on something the reader did not mean.

Most matches are word overlap and need no model. The model earns its place
on "the thing with Russia and the drones", and when it is called the fact
finder's discipline applies exactly: **grounded search off**, because it is
picking from a closed list rather than going to find things; it returns an
identifier and never words, so the wording on the hive stays the source's;
and an identifier not in the list it was handed is a miss rather than a
match. It adjudicates nothing, so nothing here says a model decided what is
true.

The miss is the most valuable case and should be built on purpose. Somebody
types something the feeds did not carry, and the app offers to add it with a
link, which makes the field the front door to submission instead of
requiring a URL in hand. And the unmatched phrases are the only editorial
signal in this design that comes from a person: if people keep typing about
something six feeds missed, the feed list is wrong and no weighting scheme
would have found that out.

Two things in it belong to Nathan and Jason rather than to a session. What
happens to the text a person types, which is free text going to Google and
attached to an account token, and whether unmatched phrases are kept at all.
The second is genuinely close to the line the entry in `CLAUDE.md` about
there being no analytics draws, and it should be argued with the privacy
page open rather than slid in.

**A buzz still has no consequence at either end.** The tile does not move
for fifteen minutes, by design and honestly documented, and the date seals
and the reader never hears about it again. The app can animate a tile toward
its next size on the tap while the real rectangle settles on the tick,
because it owns its view layer in a way the website does not. And the
anniversary is the payoff this mechanic has been missing: what you backed on
September 9, 2026, shown to you on September 9, 2027. Not a score and not
karma, which sections 6 and 8 refuse. A memory, shown only to the person who
made it, which is the private mark on the sealed page section 13 already
allows. It is also what makes a buzz worth spending today, because it stops
being a vote and becomes a time capsule with the reader's name on it.

**Nothing in this section was run against the live feeds.** The worker's 291
tests pass and the container this was written in cannot reach Supabase or
any news page, so the seeder fix, the variety pass and the headline screen
have been tested on fixtures and on real headlines copied out of the
database, and not once against a tick. The next tick after this deploys is
the test, and the thing to look at is whether September 9 gains history
stories at all.

---

## 16. The starved board, September 10, 2026

Section 15 fixed the candidates. The next morning the board was still
sports, entertainment and gaming, and the reason was upstream of the
allocator: most of the world desk could not verify. Counted on the open
walls, sources the checker fetches: theguardian.com 30 sources, 0 verified.
variety.com 15 and 0. npr.org 9 and 0. theverge.com 5 and 0. nasa.gov 7
and 1. Against bbc.com 17 of 17 and aljazeera.com 24 of 25. A story with no
verified source never leaves the pool, section 12, so 66 stories from five
outlets could not reach the board however much they mattered.

**It was three failures, and two of them were ours.** The Guardian's feed
escapes its description as entities, and `plain` in `news.ts` stripped tags
before decoding them, so every Guardian quotation was stored as
`<p>Lambie, a veteran and Tasmanian senator ...`. No article page contains
`<p>`. Variety, The Verge and NASA send an excerpt ending in `[…]`, and the
page has the words and never the mark, so the exact match failed on three
characters. Neither was the page's fault and neither was the match rule's.
The third is npr.org: the feed host answers the worker at once and the
article host never answers within fifteen seconds, which is the shape of a
host screening by user agent, and is not proven.

**The quotation is taken from the page, at seed time, by the submit rule.**
`quotationFor` in `news.ts`: the feed's own description when the page
contains it, because the lede reads best on a receipt; otherwise the page's
own description; otherwise the page's own headline. That is what
`wall_submit_story` already does with a link a person pastes. Every
candidate is held to `pageContains` before it is stored, the same exact
match with whitespace folded that the checker runs a quarter hour later, so
nothing is stored the checker could disagree with. A page that could not be
read keeps the feed's words and the checker retries; a page with nothing
quotable keeps the feed's words and fails, which is right. A trailing
truncation mark comes off an excerpt first, fewer of the source's words and
never different ones, the rule `fitHeadline` already applies. Only a page
not already on the date is read. **The match rule in `page.ts` was not
touched and is not to be touched for this.** Weakening it to make outlets
pass would be the worst change available to this system.

**Pages are asked for the way a browser asks.** `PAGE_HEADERS` in
`page.ts`: a browser identification that still names Birthed at the end,
and an Accept-Language. The worker's configured agent, which names
node-fetch, stays for Wikidata, which asks to be told who is calling. And a
host that answers nothing twice in one run is left alone for the rest of
it, `HostSilence`: nine npr.org sources were costing every tick over two
minutes to learn the same thing nine times. A page left unread gets no
check row and is asked again next run. Whether npr.org now answers is
unknown until a tick on Render says; if it still does not after a day, the
honest choices are to drop its two feeds or to take the headless browser
decision, and pretending a source that cannot be read is a source is not
one of them.

**The Charlie Kirk row was never dropped by the seeder.** It was
`suppressed`, the events importer's word screen, which `readHistory`
excluded. On the three open dates that flag held back 26 of 66, 18 of 48
and 47 of 85 events; the count dropped for a missing link or a short
quotation was nought on all three. The screen exists for the date page and
the share card, where a birthday reader should not be handed a plane
crash. The hive asks what mattered, and the screen was holding back the
answer. Nathan's call: a suppressed event files like any other history, at
the ordinary priority and never as a pick, since `mayLead` already keeps a
killing out of the first eight. The date page and the share card are
unchanged. And a row the seeder does leave out is now counted per date and
per reason in the log, so a drop is never silent again.

**The sixty six stale rows were left alone.** Rewriting a stored quotation
under checks that were run against other words is the quiet edit this
document forbids. The clean repair is to delete the never verified, never
boosted news stories from those five outlets on the open dates so the next
tick re-files them; the query was written, shown, and not run, because it
deletes.

**Nothing in this section was run against a tick.** Three hundred and
twenty one worker tests pass, on fixtures that include a real Guardian
address, its real feed description as sent, and a page body that does not
contain it. The next tick is the test. Look for Guardian, Variety, Verge
and NASA sources verifying, and for the line naming `www.npr.org` as a
silent host.

### Pictures on the hive, later the same day

Nathan looked at the site and asked for two things: the three controls in
the bar to be one kind of thing, and pictures on the board. The first is a
line of style. The second turned out to be mostly built already: the site
has had every number one's cover from Apple and a face for anybody Wikidata
has one for, downloaded onto this domain by `download-covers.ts` and
`download-faces.ts` for the reason those files give, and had never put
them on a tile.

**The number ones are pixels now.** Section 13 left them behind a line
because a song is keyed to a year and a chart rather than a day. The
history seeder files, on each open date, the number one in every year that
has one, keyed by the issue date, with Wikipedia's year list as the
receipt, at the news's priority so sixty of them do not take every unbacked
slot ahead of the date's events. One buzz beats that, as it beats
everything. Under the feed they are a strip of covers with the year on
each rather than sixty rows, most backed first, then newest year. Same
pool, same button, same three a day; nothing in section 13 moves.

**A picture reaches a tile through a style rule the build bakes, not a
column.** The live section swapped in by `serve.ts` knows nothing about
what is on disk, and the build knows everything. So a story carries the
subject the worker filed it under as `data-subject`, and `pictureRules`
writes two rules per date beside the wall region: a `--pic` for every
subject with a picture on disk, and one shared rule for the light type and
the scrim a headline needs over a photograph. Whatever section is in the
page, the tile for that subject draws its picture. No migration, no new
host, `img-src 'self'` untouched.

**Faces are next and are not built.** `notable_people.image_file` is empty
for all 25,741 rows and `static/faces` was never downloaded. The rule and
the tile are ready for `person:<Wikidata identifier>`. What is missing is
an importer run to fill the column and a decision about where a few
thousand pictures live: in the repository beside the covers, which is a
large commit, or in Supabase Storage, which is a company already named on
the privacy page and would mean widening `img-src` to the project's host.
That is a decision, not a session's guess.

**News pictures are not built either, and they run into a promise.** A
page's own preview picture is the accepted way to show a link, but it lives
on the outlet's host, and the privacy page says Supabase and Render are the
only companies that see anything about a reader. Hotlinking announces every
visitor to the Guardian and NPR in exchange for a thumbnail, and copying the
pictures here is re-hosting a newspaper's photographs. Both are decisions
with the privacy page open beside them, and neither was made.

**The feed takes turns and folds at a dozen.** Nathan, the same evening,
after scrolling it: a hundred and fifty rows in one order is not a feed
anybody spends a buzz from. Most backed first, still and always. Under that
`takeTurns` in `web/src/wall.ts` deals the kinds in rotation, the day's news,
then something that happened, then somebody born, then a fact, then a
release, so the first dozen rows are a sample of the day; then one line,
"Show all 150", and the rest behind it. No model orders the feed. A model
ranking was raised and set aside: it costs on every open date every quarter
hour, it sits close to the line section 5 draws about a model deciding, and
the typed field already answers "I do not want to scroll." If the turn
taking feed still reads as a wall, that is the next thing to argue, with
Jason in the room.

### Every person on the date, later the same day

Nathan looked at the Today tab on the phone and saw a Buzz button on Jack
Ma and none on Cynthia Lennon, José Feliciano or Chris Columbus. Section 13
capped the people the seeder files at twelve a date, the most looked up, and
the phone only hangs a button on a row the worker filed a story for, so
eighteen of the thirty people on September 10 could not be buzzed at all. A
hive that is meant to find out who the most famous birthday is cannot start
by taking names off the ballot. **The cap is gone: every person on the date
is filed**, most looked up first, the first three still at the person
priority. Faces are a different question, a folder size rather than a vote,
so `worker/src/portraits.ts` fetches a face for the twelve most looked up on
each date and no more.

**Suggesting a person is not built.** A person can already add a story with
a link in the app, and a Wikipedia page about somebody works as a link, but
it files as news with no subject, so it is not a person born on the date,
takes no face, and does not add anybody to `notable_people`. Doing it
properly means matching a name to a Wikidata identifier and a row in that
table, which is a schema and product decision for Nathan and Jason.

### Thirty seconds to take a misclick back, later the same day

A buzz is permanent. It stays permanent. What this adds is a window thirty
seconds wide in which a tap that was never meant can be removed, and the
window is deliberately far too short to be a way of changing your mind.

**The window is for the finger, not for the opinion.** This is the argument
`supabase/migrations/20260908090000_forget.sql` already made about the
remembrance answers, and it holds here for the same reason and one more. A
misclick is noticed at once: the wrong tile, the row above the one you meant,
a thumb on a phone. Second thoughts take longer than half a minute. And the
hazard a longer window would create is the one this whole document is built
to avoid: the count is on the screen by the time a buzz has landed, so
somebody who could undo an hour later could watch what everybody else backed
and move to it. That is the conformity problem coming back in through the
exit door, and it is worse than voting under a visible count, because the
change would be caused by the number rather than merely coloured by it.
Thirty seconds is short enough that nothing on the board has moved: sizes
settle on the quarter hour, section 13, so a reader who undoes has learned
nothing in the meantime except what they themselves just did.

**Section 4 said irreversible and now says irreversible after thirty
seconds.** The sentence is edited rather than quietly worked around, because
the house rule is that the document wins and is changed first. Section 6 says
a boost is recorded permanently and immutably, and that still holds with one
exception written into the same trigger that enforces it: `wall_boosts`
refuses every update and every delete from everybody, the service role and
the dashboard included, and permits exactly one delete, the one
`wall_forget_boost` makes, flagged by a transaction local setting the way
`authenticated_by` is flagged. A row nobody flagged cannot be removed by any
caller by any route. The ledger is still a ledger; a row that was never meant
to be in it is not history.

**A removed buzz leaves nothing behind, and that is the point.** The unit
goes back to the day's budget, because the budget counts the rows that exist
and a deleted row is not one, so the refund is the delete rather than a
second piece of arithmetic that could disagree with it. The story's `support`
comes down by the same trigger arithmetic that put it up. Nothing is written
to say a buzz was taken back: an undo record would be a record of a mistake
attached to a person, and the reason the window is thirty seconds is that
what happened inside it was not a decision worth keeping.

**A sealed hive takes nothing back.** The function refuses on a date that has
closed, exactly as `forget` refuses on a sealed edition, even inside the
thirty seconds. Midnight is the one thing in this document that is final, and
a square that is permanent from midnight cannot lose a module at ten past.
The cost is a reader who buzzes in the last half minute of a date and cannot
undo it, which is a real if rare unfairness and is the smaller of the two.

**One function, both ends.** `wall_forget_boost(story, token)` takes a
browser token or, with no token, the calling account, so the website and the
app remove a buzz through one set of rules rather than through two copies of
them. It answers in one word the way `wall_cast_web_boost` does: `undone`,
`too_late`, `closed`, `no_story`, `bad_token`. `too_late` covers a buzz older
than the window and a story this caller never buzzed alike, because from a
page those are the same answer, which is the reasoning `forget` gives for
returning false in both cases.

**Where the button is drawn.** On the website, only on the page that follows
a buzz that counted, beside the sentence that says it counted, and nowhere
else: a page somebody is merely reading never carries one. That means the
word and the story both, on the date page and on the receipt alike. The
receipt's first version read the story out of the query string on its own,
which drew the button for anybody handed the address on a page they had
tapped nothing on. The database refused them, so it was a lying control
rather than a hole, and a lying control is still the thing this paragraph
forbids. On the phone it is
on the tile that was just tapped and it goes when the window does. Neither
client checks the clock for permission; both draw the button for thirty
seconds and the database decides, because a window a client can argue with is
not a window.

**The app's undo is attested like every other write it makes.** It goes
through `wall-write` as an `unboost` action, which costs a challenge and an
assertion before the call, seconds inside a window of thirty. Granting the
function to `authenticated` and letting the app call it directly would be
faster and would give away nothing, since the function can only ever reach
the caller's own row inside the window. It was not done, because one write
path is worth more than two seconds. If the round trip turns out to eat the
window on a slow connection, the direct grant is the fix and it is safe.

### The morning after, on the phone, later the same day

Section 15 named this as the thing the mechanic was missing: a buzz has no
consequence at either end. The tile does not move for fifteen minutes, which
is honest and documented, and then the date seals and the reader never hears
about it again. So when a date somebody buzzed on seals, the phone tells them
once, the next morning, at the hour their other reminders arrive: "Your
September 10 hive sealed. The story you buzzed came third of twelve."

**It is not a score and nothing about it is kept as a total.** Sections 6 and
8 refuse every accuracy, karma, reputation and influence formula, and this is
none of them. It is what happened to one story on one date, told once to the
one person who backed it, compared with nobody, added to nothing, and shown
to no other reader ever. The one number in it is a place on one sealed hive,
and it exists only in that sentence.

**Where the number comes from, and when it is a fact.** A place is among the
stories that took a place on the hive, in `HiveFeed`'s order, which is the
order the reader could have seen for themselves. Not among the date's
hundred and fifty: "forty seventh of a hundred and fifty" is a number that
means nothing. A story that never reached the hive has no place at all, and
the notification says what the reader backed instead of inventing a rank for
a race the story was not in.

**A rank read before the seal and a rank read after it are two different
claims, and they are said differently.** This is the whole of the honesty
here. The reminder is scheduled at buzz time from what the phone already
knows, because at fire time there is no network and there should not need to
be, and at buzz time the hive has two days left to run. So a place read while
the hive was open says "was third of twelve when you last looked", which is
true and is still worth telling somebody. Only a reading taken after the hive
sealed says "came third of twelve", because only that one cannot change
again. Every time the app opens a date it corrects the note and, once the
hive has sealed, marks it settled and never touches it again.

The cost, named: a reader who buzzes and does not open the app again before
the hive seals gets the "when you last looked" sentence rather than the final
one. The alternative was to state the last known rank flatly and be wrong
sometimes, which on a permanent record is the worse of the two. The other
alternative, saying no number at all until a reading after the seal, would
mean most readers never get one. **This is Jason's to overrule** and the
three shapes are written down here so it can be argued rather than
rediscovered.

**A morning that has gone by is not rescheduled, and getting that wrong
compounds.** The first version worked the morning out from whichever was
later, the seal or now, which meant every hive a reader had ever buzzed on
found an hour in the future and every one of them was rescheduled for
tomorrow morning, every morning, forever. Thirty old dates is thirty banners
a day about hives that sealed weeks ago, and past sixty they fill the sixty
four slots and every friend's birthday is silently dropped, which is the
promise this app is actually for. The morning is measured from the seal and
never from now, and one already past is nothing at all.

**It counts against the sixty four like everything else, and it never
displaces the reader's own day.** The plan places the reader's own birthday
and countdown first and does not trim them, then sealed hives, then people
you know, then people you follow. Hives go ahead of other people's birthdays
because a birthday recurs and comes back next year, and a hive seals once and
the moment is over; there are never many, because a reader can only have
buzzed on a handful of dates that have not sealed yet.

**The morning after is worked out and not assumed.** A hive seals at midnight
Eastern, which is nine at night in Oregon and one in the afternoon in Tokyo,
so the next morning is a different day depending on where the reader is
standing. The reminder is the first time the reminder hour comes round
strictly after the seal, which is right everywhere and is why a reader in
Tokyo is not told at eight in the morning that a hive has sealed five hours
before it does. The seal instant itself is the server's `closes_at`, copied
onto the note, rather than this phone's arithmetic about Eastern midnight,
which would be a second place for it to be wrong.

**The note lives on the device, like the mark, and for the same reason.**
`HiveNotes` beside `HiveMarks`: the marks answer "did I buzz this" for every
story on a date, and the notes answer "what became of what I buzzed" for one
story a date with more about it. It is `HiveMarks`' trade in a different
coat, a reinstall forgets and a second device never knew, and what is lost is
a banner and never a vote. It is read through `HiveNoteStore` rather than
handed to `reschedule` by its callers, because that method clears everything
pending and rebuilds, so a call site that forgot the notes would silently
drop every sealed hive reminder a reader had waiting. That is the reasoning
`NotificationService` already gives for keeping the public figure filter
inside itself.

**Tapping the banner opens the Today tab and no further.** The date is in the
identifier and is deliberately not acted on: a sealed hive is two days behind
today, and taking a reader to a date they cannot buzz on needs a screen that
can show a date that is over. That is the archive, and it is not built.
Section 13 already lists it as still ahead.

### The anniversary, later the same day

Section 15 designed this and this is it: what you backed a year ago today,
shown to you and to nobody else, never as a number. It is the other end of
the same thing the morning after opened. A buzz stops being a vote and
becomes a time capsule with the reader's own name on it, which is what makes
one worth spending today.

**No new table.** The boost row already has the wall date on it, and a wall
date is a real calendar date with a year, so the same month and day in an
earlier year is a query. On the website it is one more answer from
`wall_web_standing`, which is already called once for any reader carrying a
token and already answers "what has this browser done here"; on the phone it
is the notes `HiveNotes` already keeps.

**It is not a score and it is nobody else's.** Sections 6 and 8 refuse every
accuracy, karma, reputation and influence formula, and section 13's line
about what the reversal does not license still holds. There is no count on
it, no rank, no total, and nothing about another reader. A test on each side
sweeps the block and fails if a digit reaches it.

**February 29 is asked about as a month and a day.** Both sides match the
month and the day and compare the years, rather than subtracting a year from
the date, because a year before February 29, 2028 is a date that does not
exist and the reader born on it is exactly the reader this product is for.

**On the website it is drawn into the section, not written over it, and that
is a departure from what this was asked for.** The brief said one more rule
in `wallMarks`. `wallMarks` writes a style block, and a headline is the
source's own wording: inside a CSS `content:` string `escapeHtml` does not
apply, and a headline carrying the characters that end a style element would
end the stylesheet and spill the rest of the page. `foundBlock` already draws
one reader's own stories into this section on a request answered `no-store`,
and this is that same shape. The count and the marks stay in `wallMarks`,
where what they write is generated text and never a source's words. This
reordered one pair of awaits in serve.ts: the reader's standing is read
before the section rather than after it, and the wall date it needs comes
from the clock, which is where `liveWall` gets it too, so it costs no extra
round trip.

**Two differences between the phone and the website, named rather than
found.** The website shows every buzz this browser cast on the date in
earlier years, because the database has every one. The phone shows one a
date, because that is what a note holds: the newest buzz on that date.
Widening a note to carry all three is what closes it. And the website's
headline is a link to the story's receipt, which is a file the build keeps
after a newer wall takes the hive on the date page; the phone's is not,
because `WallStoryView` resolves a story out of the day that is loaded, so a
story from an earlier year would draw "no longer filed for this date", and
its buzz control reads this year's clock and would offer a button on a hive
that sealed a year ago. What that needs is a read for one story by
identifier and a receipt that takes the story's own date as the one that
decides whether it takes a buzz. Neither difference is deliberate design and
both are small; both are here so the next session does not have to work out
why.

**A reader with an anniversary and nothing else gets their own page.** The
date page is shared and cached for twenty seconds, and one reader's own
memory is not shareable, so a request carrying one is answered `no-store`
like every other request that draws something only its reader may see. Before
this, only marks, a tap or a find did that; an anniversary now does too,
because on the day it appears it may be the whole of what the reader came
back for.

---

## 17. The remembrance routes came off, September 11, 2026

The question "were you there" came off the page on September 10, 2026 when the
hive took the date page's lead. The server kept answering it for a day longer,
which is how dead code always stays: nothing broke, so nothing said it was
dead. Cut now.

**Gone from `web/src/serve.ts`.** The handler that took an answer, `/forget`
which took one back, the query string that permitted one database read on the
way back, and the four helpers behind them: `readAnswer`, `record`,
`tallyFor`, `unrecord`, `keptFrom` and `withResult`. Gone from
`web/src/render.ts`: `resultMarkup`, `undoForm`, `resultId`, the `Remembered`
shape, the rules in the stylesheet that only those drew, and the `draw`
keyframes nothing names any more. No page has posted to any of it since the
buttons came off, and `posts` in `serve.ts` now refuses both paths with a 405
rather than accepting them.

**Nothing was dropped from the database.** `remembrances`, `day_editions`,
`remember_settings` and the `remember_status`, `remembrance_tally` and
`forget` functions are all exactly where they were, with every answer anybody
gave still in them. That is not tidiness deferred, it is the point: section 6
says a year of real outcomes is the only thing that can choose a formula, and
an answer thrown away to keep a source tree neat cannot be got back. The build
still reads those answers, in `timeline.ts`, to put a sealed date's rows in
the order its own people remembered them.

**The cookies outlived the question.** `bt` and `by` were the remembrance
question's and are the wall's now, which is why `web/test/remember.test.ts`
still exists under that name with the token, limit and year tests in it.

**The privacy page was already right about this** and said so on September 10:
the answers are kept as they were and the question is no longer asked. It
needed no edit for this cut, which is the first time that has been true, and
only because the page was edited on the day the buttons came off rather than
afterwards.

---

## 18. What takes the board, and how big, September 11, 2026

Two answers were close to random on September 11, 2026 and this section is
what was found and what changed. Which twelve of two hundred stories take
the hive, and how much of it each one gets.

**The one number that separates history rows was never collected, and
could not be.** `article_reach` records how many people look a thing up on
its date, which the curation panel calls the big signal. It had no rows.
Two faults stacked. The function had never finished a run, and it could not
have measured history if it had: every one of the 19,734 rows in
`historical_events` cited the Wikipedia date page it was read from, 366
distinct addresses for 19,734 rows, and `measure-reach` rightly refuses a
date page, because the date page is the same number on every line of the
date. The importer had kept the sentence and thrown the links away.

**Every history row now names the article it is about.** Wikipedia's own
markup links the subject of each line. `worker/src/subject.ts` picks that
one link: only the first sentence is read; a war used as a prefix ("World
War I: Australia invades...") is context and an event used as a prefix
("Battle of Stirling Bridge: Scots jointly led by...") is the subject; among
what is left, one link shaped like an event is the subject and two is a
refusal; with no event, the first link that names its own article is taken
unless it is a country, a place, a polity, an organisation, an acronym, or
where or whose something happened. It refuses rather than guesses, because
a wrong article here is a city's pageviews ranking a skirmish above the
thing everybody remembers. On the real September 11 page it names 72 of 85
lines and refuses 13; the lines are pinned in `worker/test/subject.test.ts`
from three real pages, and `historical_events.subject_url` holds the answer,
null meaning "nothing to measure" and not "not yet". `source_url` is
untouched: the receipt still says where the sentence came from.

**The spike is the lower of two anniversaries, in views, not a ratio.**
Measured by hand on the 72 September 11 subjects before any table was
filled, the ratio of the date's views to the median day put the Des Moines
speech first at 341 times and the Battle of Bita Paka second at 136; the
September 11 attacks were twelfth. Both leaders were one year's number, 840
then 16,224 and 590 then 8,659: Wikipedia's main page featured them that
day. A main page feature is editors choosing, made visible in views, which
is the thing this component exists to be different from. A thing people
remember spikes every year, so the lower of the two anniversaries keeps it
and drops the feature. And every article linked from the date page gets a
few hundred visits on its date from readers of the date page, which is fifty
times the median of an article nobody reads, so the excess is counted in
views rather than multiples and under a thousand earns nothing. With that,
September 11 reads: the attacks, the Pentagon, the Chilean coup, Benghazi,
Teutoburg, the Hope Diamond, Stirling Bridge. July 20 reads Apollo 11, Neil
Armstrong, the Turkish invasion of Cyprus, the 20 July plot. September 4
reads Mark Spitz, and then almost nothing, because almost nothing happened
on September 4 that people remember, which is also an answer.

**The panel's points break the tie on the hive.** `priority` was four
buckets, and on September 11 a hundred and sixty four history stories tied
at 1, so the board among them was arrival order under the variety caps, and
the 2001 attacks lost a lottery to the theft of the Hope Diamond. New
stories now sort by support, then by the panel's points for the row, then
priority, then arrival. `worker/src/wall/points.ts` is the worker's copy of
the history part of the panel's formula, held to the panel's copy by a test
that reads it off disk, the way the word screens are copied from
`highlight.ts`. One buzz beats every score, as it beats every priority. On
the September 11 stories as they stand, a fresh board by priority and
arrival opened with Menelik II's generals, the Hope Diamond and the Scottish
referendum; by points it opens with the attacks, Benghazi and the Chilean
coup. People, songs, facts and the news carry no points yet and sort as
nought among themselves by priority, which is an open question below.

**Priority 3 was empty on 364 dates and the document said otherwise.**
Section 13 gave the top bucket to a row Wikipedia's editors picked for the
date or one somebody wrote a lead line for. `selected_anniversaries` holds
18 rows, all on September 7 and 8, the two dates the anniversaries importer
was ever run for; `lead_lines` holds none. So the ranking had two levels in
practice, people and everything else, on every date but two. The points
already carry both inputs, ten for a pick and fifteen for a line, so the
bucket is redundant where points exist and stays as the tie break where
they do not.

**The board is a pie, and it is always full. Decided by Nathan, September
11, 2026.** Until now a tile only grew, from a minimum, so a quiet date left
a large empty corner and no buzz ever took anything from anything. From now
a tile's size is its share of the date's buzzes. The board is sixteen by
sixteen, 256 modules. Every placed story keeps the minimum of four by
three, twelve modules, because a tile below that cannot hold a headline.
Twelve tiles at the minimum are 144 modules, so 112 remain, and those are
handed out in proportion to each story's share of the date's buzzes. A date
with no buzzes yet splits them by the points instead, so the board is full
and meaningful from the moment it opens. When the date seals the shares
freeze and the board is permanent, as it always was.

**What this breaks, said plainly.** Section 9 promised that a tile never
shrinks and never gives up a module it holds, and that the rectangle out of
a run always contains the one that went in. Section 13 promised that
stored rectangles are laid down first and never displaced. Both promises
are withdrawn. An early backer can watch their tile thin as others are
backed, and a tile placed at the first tick can lose its place to a story
somebody backed later. What replaces them: the board is honest about shares
rather than about arrival, it is always full, and a buzz visibly moves the
picture, which is the thing the mechanic has never had. Nothing about a buzz
changes: it is still permanent, still one unit, still counted by the same
trigger. A third promise goes with them and was not in the brief: section
5 said a claimed story is capped in size however much support it has, so a
rumour can be loud and cannot be big, and section 10 set the cap at
twenty four modules, forty eight for a confirmed story. A pie that is always
full cannot keep it, because every imported history story is claimed, one
source, and eight of them capped at twenty four leave a quarter of the
board empty on every date with no news. So the pie has no ceiling. What is
left of the protection is the tier colour on the tile and the three a day
budget, and the fact that the stories a rumour would compete with are the
whole of the date's history rather than an empty corner. If a cap is wanted
back, the shape that fits a full board is a share cap on stories a person
submitted, say no single source submission over a quarter of the board,
with the rest going to the date's history. That is Nathan's to decide and
is not built. A story stamped false keeps its rectangle exactly as section 5
requires, takes a fixed share and is grown by nothing; on a date carrying
one, the rest of the board is laid out around it by the old growth rules,
because a pie with a hole in it was not designed in this session and is
named as open below.

**How the pie is cut.** The stories that earn a place are chosen as before,
backed first and then by points under the variety caps, twelve at most,
eight at most unbacked. Each gets twelve modules plus its share of the rest,
rounded so the areas sum to 256. Then the tiles are laid in horizontal bands
across the full width, biggest first, at most four to a band and at most
five bands, band heights in proportion to the area in them and never under
three, widths in a band in proportion to the tiles and never under four,
every band exactly sixteen wide and the bands exactly sixteen tall. The
partition into bands is chosen from every partition of the sorted tiles
that fits, by the one whose tiles land nearest their shares. The minimums
mean a tile can hold a few more modules than its share when the board is
crowded with small tiles; the pie is honest to the module where it can be
and honest to the headline where it cannot.

**Open, for Nathan and Jason.** Whether people, songs, facts and the news
should carry points too, so a famous birthday can outrank a dull event
rather than sitting behind every scored one; a person has pageviews, a
song has a chart position, and both would fit the same formula. The pie
around a stamped false story. Whether a wall opened under the old rules,
the live September 11, 2026 hive with its eight tiles chosen by lottery,
should be re-laid before it seals, which is an edit to the live database
and a person's call. And why the news seeder filed nothing on September 11,
2026, so that hive opened with no news at all and the board held eight tiles
rather than twelve.

## 19. Pictures on the event tiles, September 11, 2026

Jason looked at the first full pie and asked for more pictures, so the
board reads as a mural. The tiles for songs already drew their cover and
the tiles for people already drew their face; the tiles for events, which
are most of the board, drew a colour and a headline.

**What was decided.** Every history row that names its article, section
18, can have that article's lead picture. The worker's `npm run pictures`
asks Wikipedia's page image service which file leads the article, asking
for freely licensed pictures only, so an article whose lead picture is fair
use gets no picture at all rather than a picture the site may not use. It
asks Wikimedia Commons who made the file and under what licence, fetches the
file at tile width, 640 pixels, and stores the copy in the project's own
public bucket, `pictures`, migration 20260911080000. The table
`event_pictures` records the path and the credit. Twelve events a date, the
best scored by the same points that choose the board, which is every tile
that can reach it and none that cannot; about 4,400 pictures for the year.

**What the page does.** The build reads `event_pictures` whole and writes
one style rule per pictured event beside the wall, the same rule that puts a
cover on a song tile, so a live swapped wall and a baked one both draw the
picture. The receipt prints the credit in plain words, with the file's page
on Commons and its licence linked, because the tile has no room for words
and the receipt is where the words already go. The site's image policy
names the project's address beside its own and nothing else. No page asks
Wikipedia, Commons or any news site for a picture, and the privacy page says
so.

**What is lost.** A tile with a picture over it gets a scrim, light type and
a smaller field for the headline, so a long headline on a small pictured
tile is tighter than before. A lead picture is Wikipedia's editors' choice,
not ours, and on a few articles it is a map or a flag rather than a scene; a
person can delete the row in `event_pictures` and the tile draws its colour
again, and the next run will not fetch it again unless the row is gone.
Pictures are copies, so a file Commons later deletes stays on the site until
somebody removes it here.

**Open.** Pictures for the news tiles, which cannot be copied the way free
Commons files can and cannot be hotlinked under the privacy promise. A
picture for a song tile whose cover never downloaded. Whether the twelve a
date should follow the board's own choice after each seal, so a story that
reached the board by buzz alone gets its picture next year.

## 20. Pictures on the news tiles, September 11, 2026

Section 19 gave the event tiles a picture and left the news tiles, which
are the biggest block on most boards, drawing a colour. News pictures
cannot be copied from Wikimedia the way a free Commons file can, and the
privacy promise forbids a page asking a news site for anything. So the news
tiles stayed bare, and a board that is half news read as half empty.

**What was decided.** A news page carries an og:image tag, the picture the
publisher offers for a link card on Facebook, X, iMessage or Slack. A tile
on the hive is a link card. The worker reads that one tag with the same
fetch the checker already makes, copies the picture once into the project's
public `pictures` bucket, and records the story, the page, the picture's
address and the outlet in `story_pictures`, migration 20260911090000. The
receipt says the picture is the article's own preview, from the outlet, and
that it belongs to the publisher. No page on the site asks the publisher's
server for anything, so the privacy promise holds: a reader's browser asks
Supabase for the copy and the publisher for nothing.

A story with a subject of its own, an event or a song or a person, gets its
picture from that subject the way section 19 describes. This is only for the
stories with no subject, which is the news and reader submissions. A tile is
keyed by its subject when it has one and by the story itself, `story:<id>`,
when it does not, and one style rule finds it either way.

**Where it runs.** In the tick, after the news seeder so this run's new
stories get a picture, before the checker so the pictures are not waiting on
the slowest page. Once per story: a page read and found to carry no picture
is recorded with an empty path so it is not read again. A copy that fails
records nothing, so a later tick tries again.

**What is lost.** A preview picture is the publisher's choice, and some are a
logo or a stock photograph rather than the scene. The copy is a copy, so a
picture the publisher later changes on their own page does not change here.
A publisher who wants a picture off the site writes to the address on the
privacy page: the row is deleted, the tile draws its colour again, and the
page is added to the worker's silence list if it should stay off. Because
these are other people's pictures and not freely licensed, a copy is a
courtesy the way a link card is, and it comes down on request. The tile
still carries the same scrim and lighter type as any pictured tile, so a
long headline on a small news tile is tighter than before.

**Open.** A picture for the film and album tiles, whose posters and covers on
Wikipedia are almost always fair use and so return nothing from the free
service; the iTunes artwork the song covers already use could serve them.
Whether a submission's picture should be shown at all before a person has
looked at it, since a submitter chooses the page.

## 21. The hive moves live, September 11, 2026

Until now the hive was a picture that changed on the quarter hour, when
the worker ran. Section 7 promised a reader watches the day take shape and
section 15 named the cost of the wait: a buzz had no consequence at either
end. From now the full screen hive of an open date, `/<date>/hive/`, is a
live board. A buzz grows and lights its tile the instant it lands, the
board reflows around it, and other people's buzzes arrive over Supabase
Realtime within a second or two. Every other page is exactly what it was.

**What was decided before the session and is not reopened here.** Real
time is Supabase Realtime, not polling. The live board is only the full
screen hive, and only for open dates; sealed and future dates keep the
static page, and the 366 date pages, the birthday flow and everything else
run no script. The board lays itself out in the browser by running the
real pie allocator from live counts, so a tile resizes when a buzz lands
rather than when the worker ticks; the worker still bakes the authoritative
sealed layout at midnight, unchanged. Music on tap only. The design to
match was the prototype Nathan approved: a warm dark hive on a faint
honeycomb, cells that backlight brighter the more buzzed they are, a gold
ripple from the point of each buzz, an "Overtook" flag, Fraunces for the
headlines, the source tier as a stripe on the left, a countdown to the
seal, a swarm line of who just buzzed, and three buzzes for the reader.

**Which pages, exactly.** The hive of a date that is taking buzzes: today's
and yesterday's by the Eastern clock, the two dates section 4 gives a
budget on. Tomorrow's hive is open for submissions and takes no buzz, so it
runs nothing and stays the static page. `liveHiveDates` in `serve.ts` is
the one rule, and both the header and the render read it, so a page that
carries the script is a page allowed to run it and a page that is not
allowed carries none.

**The allocator is a copy, held to the original by a test.** The site
inlines everything and has no bundler, so the pie cannot be imported into
a page; `web/src/hive-allocator.ts` holds it as a plain JavaScript string,
`HIVE_ALLOCATOR_JS`, written into the page as it is.
`worker/test/wall-allocator-web.test.ts` reads that file off disk,
evaluates the string, and runs both engines on four hundred generated
boards and two hundred sets of shares, bands and variety passes, the way
`wall-points.test.ts` holds the worker's points to the panel's. The first
run of that test found the copy placing one story eight times, a `var`
left over from the last pass of the fill loop, which is exactly the kind
of drift the test exists to catch. If the two ever disagree the board a
reader watches jumps the moment the tick re-bakes it.

**The pie is cut from the same numbers the worker cut it with.** The
allocator's inputs are support, the panel's points, priority, arrival,
kind and outlet. Everything but the points is on the story row. The points
are computed by the worker at tick time from tables the page has no
business reading, so the worker now writes them onto its snapshot,
`board.scores` by story id, and `serve.ts` reads them off the newest
snapshot for the date, cached for the same twenty seconds as the wall. No
schema change: the snapshot is `jsonb`, an older snapshot has no scores,
and a story with no score is nought in both engines. The stories handed to
the page's allocator are the ones the worker's `settle` hands its own:
every story that has earned a place, placed and overflow. A story still in
the pool is data for the swarm line and nothing else; a buzz on one shows
in the feed, and its graduation to the board waits for the tick, as it
always did. That is the one thing the tick still changes on screen and it
is a change the worker makes and the page follows, never the other way.

**A date carrying a story stamped false is not cut in the browser.** The
port answers null for it, the page keeps the rectangles the worker stored,
moves nothing and updates the counts. Section 18 named the pie with a hole
in it as open and it still is.

**A buzz from the page goes through `POST /boost`, not the function.** The
brief offered either. The `bt` cookie is `HttpOnly`, which the privacy page
promises, so no script can read the token and no script should: the page
posts the same three fields to the same address with `Accept:
application/json`, and `serve.ts` answers with the database's word, the
story's count, the reader's standing and the boost row's identifier
instead of a redirect. Same cookie, same per address limit, same word. The
page bumps the count before the answer comes and sets it to the answer
when it does. The publishable key on the page is used for the socket and
for one read after a reconnect, and for nothing that writes. `/unboost`
answers JSON the same way, so the thirty second Undo of section 16 works
from the live page with the database still deciding.

**A reader's own buzz arrives twice and is counted once.** The row a buzz
inserts comes back over the socket as well as in the answer, sometimes
first. The page remembers which story it has a buzz in flight on, and a
row for that story arriving while one is pending is taken to be it. The
row's identifier from the answer is then remembered so the same row is
never counted again. What this costs: somebody else's buzz on that same
story inside that second is folded into the reader's own, and the answer's
count, which is the database's, sets it right.

**The socket is spoken by hand.** No library, because nothing on this site
loads a script from anywhere and the site inlines everything. It is
Phoenix's version 1 protocol: one join on a channel for the date carrying
a `postgres_changes` subscription on `wall_boosts` filtered to the date,
plus one on deletes for the undo, a heartbeat every thirty seconds, and a
reconnect that waits longer each time up to thirty seconds. A buzz that
landed while the socket was down never arrives, so after a reconnect, and
only then, the page reads every story's count once from the project. That
read is a reconcile, not a poll, and the test pins that the script has
exactly two intervals, the heartbeat and the clock.

**Migration `20260911100000_the_hive_moves_live` adds `wall_boosts` to the
`supabase_realtime` publication, and nothing else.** The publication
exists on the project and carried no table. Run inside a transaction on
the live project and rolled back: the table appeared in the publication
and was gone after the rollback. Applied when Jason says. Until it is, the
page joins its channel, is told nothing, and the board still moves for the
reader's own buzzes; the site needs a redeploy after the migration for
nothing, since the page subscribes on every load. What a subscriber is
sent is the row minus `booster_id`, because Realtime sends the columns the
role may select and the column grant of section 12 stands. That is read
from Realtime's own documentation of its row level security check and not
yet seen on a live payload: **the first live run should open the socket in
a browser's network tab and confirm `booster_id` is absent.** If it is
present, the fix is a view or a stricter grant and not a change to what is
recorded.

**The look is the prototype's, on this page only.** Dark cells with a
four pixel stripe on the left carrying the tier, the glow of each cell set
from its share of the biggest count on the board, the leader edged in
honey. The static hive and the date page keep the honey tiles of section
13; two looks for one board would be wrong if they were side by side, and
they are not: the full screen page is a different room. Fraunces is
served from this origin under `/fonts`, the two latin weight axis files
from Fontsource with the Open Font License beside them, and the header
for the live hive path alone allows `font-src 'self'`; no other page names
the face and no page loads a font from a font company. The honeycomb is an
SVG file from this origin, because `img-src` names this origin and the
project and a data address is refused, which is the same reason the empty
board is gradients.

**The swarm names nobody.** "Someone buzzed" and the headline, six lines,
newest first, and "You buzzed" for the reader's own. The row carries no
reader and the page is shown none. It is a count of buzzes and never a
count of people, which section 7's line about what the reversal does not
license still forbids.

**Pictures on a tile the pie brings onto the board.** The baked hive page
carries a picture rule for every event on the date and every story the
build saw, outside the swapped region, so most tiles the pie promotes draw
their picture at once. A news story filed since the deploy draws its
colour until the next tick's live section or the next deploy. The live
section's own picture rules are still the placed stories' only, as before.

**The header.** `securityFor` widens for the live hive path alone:
`script-src 'unsafe-inline'`, `connect-src 'self'` and the project over
`https:` and `wss:`, `font-src 'self'`, `form-action 'self'` kept so the
buzz form still posts if the script is off. `default-src 'none'` stays on
every other page, and `web/test/serve.test.ts` reads the header for the
live hive, yesterday's hive, tomorrow's hive, a sealed hive, a date page, a
receipt and the root, and asserts which get a script and which get none.

**Where the script cannot help.** Membership changes made by the tick, a
story graduating from the pool or a story's tier changing, reach the page
on its next load. A reader who keeps the page open across midnight sees the
clock reach zero, the buttons go dark and the socket close, and the sealed
board the worker bakes on their next load. Neither is polled for.

**Not run against the live site.** The web's 321 tests and the worker's
425 pass on the Mac (four of the worker's skipped for want of a database),
with the live route served against a mocked project and the migration
inside a rolled back transaction. What a person has to
see: on an open date, opening the full screen hive shows the board
building, a buzz grows and lights its tile with a ripple and, when it
climbs, a flag, a buzz from a second browser appears within a second or
two, and after the next tick the layout is the one the page already
showed. The song tile's chord is a tap and nothing else.

## 22. What your buzz did, September 21, 2026

**The problem.** Jason's judgment of the live hive after two weeks: the tap
feels like nothing. Three buzzes on a board is a small number, the tile
grows a little, and nothing says what the tap changed. Sections 6 and 8
refuse a score, karma or leaderboard, and that stands. What was missing was
not a reward but feedback: the tap has to be visible as a tap and legible as
a change.

**The tile answers the reader's own tap.** Over the ripple every buzz gets,
the reader's own buzz swells the tile and flashes its glow for under a
second, and the count on it pops. Somebody else's buzz still only ripples
and reflows; the eye is asked for nothing it did not do. Both animations
stop under `prefers-reduced-motion`.

**The line says what it moved, in the one number a tile is.** A tile's size
is its share of the date's buzzes, so the sentence under the board is the
share the tap moved: "Your buzz took this tile from 8% to 12% of the hive."
A tile that had none: "Your buzz put this tile at 9% of the hive." The first
buzz on the date: "The first buzz on this hive. This tile is all of it until
somebody else buzzes." Whole points, because three buzzes on a small board
move a tile by whole points and that is the thing this sentence exists to
make felt; one decimal only when the whole numbers would not move, so a
buzz on a board of a thousand still reads as a change. `HiveShare` in
`web/src/hive-live.ts` is the one copy, run by the page and by the test.
The baked page's sentence, that the hive redraws on the quarter hour, was
false on the live page, where the tile has already grown by the time it
shows, and the live page no longer says it.

**What this is not.** No number about the reader is kept or shown. The share
is a fact about the tile, computed on the page from counts the page already
had, and sent nowhere. A private record of a reader's buzzes, and after the
seal whether the one they backed held, is the next thing and is a separate
decision: the-wall.md section 8 already allows a private mark on the sealed
page and nothing more, and that is the boundary it would be built inside.

**Not run against the live site.** The web's 326 tests pass on the Mac. What
a person has to see: on an open date, a buzz swells and flashes its tile,
the count pops, and the sentence under the board names two percentages that
match the tile's share before and after. A buzz arriving from a second
browser ripples and does neither.

## 23. Hindsight, September 21, 2026

**The scenario, Jason's.** A paper goes up on June 12, 2017 and gets two
buzzes, because on the day it is one of forty machine learning papers. Eight
years later every large language model descends from it. The sealed board
for June 12, 2017 says the paper barely registered, and that is true and
stays. What the product owes the reader is the second half: what turned out
to matter, drawn over what people thought would.

**The sealed board never changes.** Section 3 and section 6.3 say so and
this section does not touch them. Hindsight is a second layer on the sealed
page, not a re-cut of the pie. A story keeps the tile it earned that day,
however small, and gets a mark for how it aged.

**Three outcomes, as section 6 already said: held, false, forgotten.**
Section 9 left what "held" means undecided, because the first anniversary
was a year away and the signal was going to reach into the reputation
question. This is the answer, and it stays out of reputation:

- **False** is the checker's stamp, already on the row. Nothing new.
- **Held** means the same page came back in the pool on a later year's hive
  for the same calendar date, and somebody buzzed it there, on or before the
  anniversary. Hindsight in the product's own currency. The paper that got
  two buzzes in 2017 and gets thirty on June 12, 2023 held; the board of
  2017 still shows the two.
- **Forgotten** is neither: on the board that day, never buzzed again since.
  True but forgotten, and the doc's own reason for a third outcome stands:
  folding it into wrong would make every number dishonest.

Recorded at one, five and ten years, in `wall_outcomes`, once per story and
anniversary, by the worker's tick. Only stories that were on the sealed
board, `placed` or `false`, get an outcome; a story that never left the pool
was never a claim.

**The mechanism that makes "held" possible: stories return.** Everything
imported already comes back every year, because the history seeder files
the same subject with the same `url_key` on each year's hive. The day's news
and the submitted stories did not: a page filed on September 9, 2026 was
gone on September 9, 2027 unless somebody submitted it again. Now, when a
date's hive opens, `worker/src/wall/hindsight.ts` refiles every news or
submitted story that ended on an earlier year's sealed board for that date,
same page, same headline, same `url_key`, the outlet carrying the year it
was first filed ("npr.org, 2026"), at history priority so it sits with the
date's own past and behind that day's picks, with its sources copied and
marked imported so the checker leaves them alone. A story that was stamped
false does not return. Nothing is refiled twice: the unique on
`(wall_date, url_key)` is the whole guard.

So a reader on September 9, 2027 sees last year's board sealed, and in this
year's pool the stories that were on it, each one buzzable again. Buzzing
one is the reader saying it still matters. That buzz is what "held" counts.

**What is not the signal, and why.** Wikipedia reach (`article_reach`,
section 18) was the other candidate: a subject read far more on its fifth
anniversary than its first has aged up. Two reasons it is not used here.
The table keeps one measurement per page, overwritten, so there is nothing
to compare an anniversary against without a second table and a job that
has not been written. And most of what lands on a board as news has no
Wikipedia article at all, the paper in the scenario included, so reach
would score the encyclopedia's half of the board and leave the other half
unjudged. Buzzes on a later year's hive cover every story the same way.
Reach can come in later as a second signal with its own note; the row has
the column.

**What the sealed page shows.** A tile with an outcome carries a small mark
in its corner, "Held", "Forgotten" or the existing "Shown false", and under
the board one line: "One year on: two held, one forgotten." Nothing is
drawn until an outcome exists, so every sealed board today is unchanged and
the first line appears on September 9, 2027. The receipt says which later
hive the buzz that held it was on.

**What this is not.** No number about a reader. `wall_outcomes` carries a
story and a verdict and no person. Section 8's allowance, a private mark on
the sealed page, "you backed this and it held," is the natural next step and
is a separate decision (section 22 says the same). No score, no leaderboard,
no re-cut pie.

**Not run against a live anniversary, because there is none.** The first
sealed hive is September 9, 2026 and its first anniversary is September 9,
2027. The returning stories can be seen the first time a date's second hive
opens, which is also a year off. Both are tested on fixtures.

## 24. The rally link, September 21, 2026

**What made r/place work was not teams inside the site.** It was people
organising outside it, in subreddits and group chats, to defend one pixel.
The hive's version needs no accounts, no contact and no new table: a link
that points at one tile and asks for a buzz.

**The link is the hive's own address with the tile's id after the hash.**
`/september-22/hive/#w-<story id>`. A browser never sends the part after
the hash to a server, the same fact `/add` is built on, so the link carries
nobody, nothing is stored when it is made and nothing is logged when it is
opened beyond that somebody opened the hive. Every tile on the live hive
has a small Rally button that copies the link to the clipboard and says so
in the sentence under the board; where the clipboard is refused, the
sentence shows the link to copy by hand. No button on a sealed hive or on
a story shown false, because there is nothing to ask for.

**Arriving by it lights the tile and says why.** "Somebody sent you here to
buzz this: <headline>", above the board, with the tile outlined in ember
and its Buzz button focused. On a sealed hive the line says the hive has
sealed and the tile stands as it is. A baked page has no script, so there
the hash does what a hash does anywhere: the browser scrolls to the tile,
and `:target` outlines it.

**What this is for.** The post that launches a date needs a verb. "Here is
the board" is a noun. "Here is the story I think matters, go buzz it" is
what gets posted in a group chat and a subreddit, and the coordination
happens where people already are rather than in a feature this product
refuses to build.

**Not seen in a browser.** Web tests 328 of 328. What a person has to see:
Rally on a tile copies a link; opening that link in a second browser
scrolls to the tile, outlines it, shows the line, and a buzz there counts
as any buzz does.

## 25. The private record, September 21, 2026

**What it is.** One page, `/yours/`, listing the stories this browser has
buzzed, newest first, with what became of each one. Nobody else can see it.
Section 8 refuses a leaderboard, a public profile and any karma formula, and
this is none of the three: it is the anniversary block from section 15
widened from one calendar date to all of them, and that block's rules carry
over whole. Sections 22 and 23 both named it as the next thing and left it
to a decision of its own. This is the decision.

**The rules it inherits, and they are not up for negotiation.**

- **It is a list and never a total.** No count of your buzzes, no rank, no
  streak, no score, no "you have backed 14 stories". The anniversary already
  promises on the live privacy page that it carries no number of any kind,
  and a number here would make that false on the day it shipped. A reader
  who wants to know how many can count the rows.
- **Nothing about anybody else is on it.** Not how many other people buzzed
  the same story, not who they were, not how this reader compares to them.
- **It states one new fact and no others.** The headline and the date are
  already public on the date page, and so is the story's outcome. The only
  thing this page adds is that this browser buzzed these things, and it adds
  it only for that browser.
- **No script.** A page the server renders and answers `no-store`, like
  every page that carries one reader's own words. It needs no exception in
  the security policy and it must never acquire one.

**What a row says.** The headline, linked to its receipt, the date it was
on, and one word for where the story stands:

- **Open**, while the date is still taking buzzes.
- **On the board** or **In the pool**, once the date has sealed: whether the
  story took a tile or never left the pool. That is a fact about the story
  and it is on the sealed page for everybody.
- **Held**, **Forgotten** or **Shown false**, once the story has an outcome
  from section 23. The first of those cannot exist before September 9, 2027,
  so every row on this page today stops at the line above.

The ladder runs in that order and a later fact replaces an earlier one
rather than sitting beside it, so a row stays one sentence.

**Where the identity comes from, and what that costs.** The `bt` cookie,
which is the token every one of those buzzes was cast with and the one the
anniversary is already read by. So the record follows the cookie and not the
person. Clear it and the page is empty, while the buzzes it named are still
in the database and still counted, and there is no honest way around that
without an account, which reading here must never require. It is the same
trade section 13 named for the buzz itself. The page says this on it in one
line, because a reader who cleared a cookie and found an empty page should
be told why rather than left thinking the buzzes were lost.

**The read is one function, and it is the anniversary's shape.**
`wall_web_record(voter_token_in text)`: security definer, search path
pinned, revoked from everybody but the anonymous role, hashing the token
through `wall_web_booster_id` exactly as `wall_web_standing` does, and
answering an empty list for a token under sixteen characters rather than
looking anything up. Bounded to the two hundred most recent, because a page
is not a scroll and a browser that spends three buzzes a day for a year has
a thousand of them.

A function of its own rather than another field on `wall_web_standing`,
which is the opposite of what section 15 decided for the anniversary, and
for the opposite reason: the anniversary rides on that function because the
date page was calling it anyway, and this page calls nothing else at all.
It takes no wall date, because the whole point is that it is not about one.

**Where the link is.** Under the board on a date page or a hive, for a
browser carrying the token and for no other, because the only thing that
ever mints that token is tapping Buzz. Any request that draws the link is
answered `no-store`, on the rule that already covers the reader's marks and
their Undo button: a page carrying anything that is one reader's own is
never stored. Nothing links to it for anybody else, and `robots.txt` refuses
it, so it is neither in the index nor in the sitemap. The privacy page names
the address in prose, which is the other way to find it, and the privacy
page is edited in the same commit as the code, as always.

**What it is not, said again because this is the page most likely to grow
one.** Not a profile: it holds no name, no birth year, no setting and no
preference. Not a step toward one. Not shared and not shareable, and it has
no picture. It does not tell a reader they were early, or right, or better
at this than anybody. If a future session finds itself adding a number to
this page, the number is the thing to cut.

**The app's version is not built.** Per install rather than per browser, and
read from the marks the phone already keeps in `HiveMarks` plus a fetch for
the headlines, which are not on the phone. Same design, same rules, same
ladder. Nathan's call on September 21, 2026 was to do the web alone this
time rather than add to the Swift that has not been compiled since
September 10.

**Not seen in a browser, and the migration is not applied.**
`20260921010000_the_private_record` is written and has never been run
anywhere, not even in a rolled back transaction, so `wall_web_record` does
not exist on the live project and the page answers 503 with its own "could
not be read" line until somebody applies it. `docs/going-public.md` section
6 carries that row with the others.

Once it is applied, what a person has to see: buzz something, find the link
under the board, open it and find that story on it with the date and the
word Open; a browser that has never buzzed gets no link and, at the address
itself, the empty page and its one line; and a sealed date's row reads On
the board or In the pool.

## 26. The type on a tile, September 21, 2026

**Written after the code, which is the wrong way round.** The rule in
`CLAUDE.md` section 10 is that this document is edited first. It was not,
because until the board was rendered and looked at nobody knew there was a
decision here rather than a bug. The render is the reason the rest of this
section can give numbers.

**What the board actually looked like.** Nathan's judgment of the live hive
for September 21 was that it was underwhelming. Rendering that exact board
at 645 pixels and looking at it showed two faults, and they are the same
fault twice:

- The 1993 tile, sixteen modules wide and three tall, took type sized for
  sixteen modules, asked for three lines of it, and the third line was cut
  through the middle of the letters with the footer sitting on top of it.
- The 1784 tile, ten by seven, held a short sentence at the top and left the
  bottom half of the biggest tile on the board empty.

**The cause.** The size scaled with the tile's width alone, the line budget
came from its height alone, and neither knew the other or knew how long the
headline was. A wide short tile got big type and more lines than its height
held. A tall tile got type sized for its width and no more, whatever room
was under it.

**The rule now: the type is fitted to the box and to the sentence.**
`fitType` in `web/src/wall.ts` walks the sizes upward and keeps the largest
whose whole headline still fits in the room the footer leaves. It answers in
modules rather than pixels, so a board twice the size draws the same tile
twice as large with the same words in it, which is what retired the two
container queries that used to add a line on a wider screen.

**Four constants, measured rather than guessed, and that is what makes this
arithmetic instead of a guess.** Read off the rendered board: a line height
of exactly 1.2, a baseline of 0.38 modules, chrome of 0.80 modules on a 645
pixel board and 1.03 on a 390 pixel one, and an average glyph advance
between 0.55 and 0.71 of the size depending on how early the long words
break. The glyph figure is set at the high end on purpose: a line narrower
than the guess costs a little white space, and one wider costs a whole line,
which is the thing that gets sliced in half. If the typeface or the footer
changes, these are what change with it, and they are measured again rather
than adjusted by eye.

**Two rules in the stylesheet hold whatever the arithmetic gets wrong.** The
headline takes the room the footer leaves and no more, and its height is
capped at its own line count in ems. The second is not redundant: the line
clamp draws its ellipsis in the right place and still paints the line after
it, which is exactly what put half a sentence across the footer of three
tiles. A headline may be cut. It may never cross the footer.

**The limit, named.** On a phone the size clamp's floor of ten pixels beats
this arithmetic on the smallest tiles, so a four by three tile there holds
about four lines where the arithmetic asked for five. The extra line is cut
by the box rather than by the clamp, so it loses its ellipsis. It does not
spill and it does not cross the footer, and the sentence it belongs to was
never going to fit in a tile that size. The real answer is a short written
form for small tiles, which does not exist and is not built. A second
arithmetic in pixels is not the answer.

**Seen, for once.** The board for September 21 was rendered from its real
rows and screenshotted at 645 and 390 pixels, before and after. Not seen on
the live site, which needs a deploy.

## 27. The mural, September 22, 2026

**Nathan's judgment, and the numbers behind it.** The hive was underwhelming:
it fit two or three stories a reader could actually read, and a date is
supposed to be a mural. He is right, and it is arithmetic rather than taste.
For September 21 there were **744 stories in the pool and eleven on the
board**. Eleven is not a coincidence and it was not `MAX_PLACED`, which
allowed twelve. It was `UNBACKED_PLACED`, which allowed **eight** tiles to
hold a story nobody had buzzed, plus the three somebody had. Eight plus
three. A wall with seven hundred pieces left in the box is not a wall.

**Two numbers did it, and they were both right once.** `UNBACKED_PLACED` of
eight was right for a board that held twelve tiles, and twelve was all it
could hold because **the smallest tile was sized to hold a sentence**. Four
by three on a sixteen module board is four across and five down. Everything
else, including the emptiness, follows from that one number.

**So the smallest tile is a picture, and it is two by two.** A cover or a
face reads at forty pixels. A sentence does not. This is the whole decision
and the rest is consequence:

- **The smallest tile is two modules by two**, which makes the board hold
  tens of tiles instead of eleven. `MAX_PLACED` rises to sixty and
  `UNBACKED_PLACED` to forty. The reason for holding any back is unchanged
  and still good: the feeds qualify forty stories at the first tick, tiles
  never shrink, and a board the seeder filled could never be joined by
  anything a person later chose.
- **Forty rather than more, and the square is why.** Forty eight minimum
  tiles hold 192 of the board's 256 modules and leave the rest in fragments,
  and a backed story needs six modules in one piece: at forty eight, the
  test that puts five backed stories onto a seeded board could place one.
  Forty leaves ninety six modules and all five land.
- **The group shares keep their shape and grow with the board**: eight news,
  ten events, ten people, ten releases, two of whatever is left. News stays
  below the others on purpose, because it is the group with hundreds of rows
  a day and the only one that is not about the date, so on its own weight it
  would be the whole mural.

**What it produces, on the real shape.** Run against September 21's actual
pool, 400 news, 209 releases, 75 people and 53 events with three of them
buzzed: **43 tiles, the board full to all 256 modules**, thirteen events,
ten people, ten releases and ten news, the most buzzed story holding 48
modules and the smallest holding four.
- **A small tile draws its picture and no words.** The headline is the
  receipt's job and the big tiles' job.
- **A tile with no picture leads with its year, set large.** "1862" reads at
  any size and a sentence does not. A date board is about years, so the year
  is the one word every tile can always say.
- **A caption appears only where there is room for one.** On a narrow board
  the small cells are pictures alone. A caption nobody can read is what made
  the old board feel empty, not what saved it.

**What this does not change, and the list matters.** The board is still
sixteen modules square, so every stored rectangle, every anchor and the
pixel coordinates section 9 promised are untouched, and **every sealed board
is exactly as it was**. The pie from section 18 is untouched: a tile's size
is still its share of the date's buzzes, and one buzz still beats every
priority and every cap. What changes is the floor under that pie. A story
nobody backed used to need a twelfth of the board to exist at all, so most of
them could not exist; now it needs a sixty-fourth, and the ones people chose
still tower over them.

**The ceilings stop being multiples of the minimum.** `CLAIMED_CEILING` and
`CONFIRMED_CEILING` were written as twice and four times a twelve module
floor. Read that way against a four module floor they would shrink the
biggest tile on the board to a quarter of what it was, which is the opposite
of the point: the buzzed tiles should still be large and readable. They are
absolute numbers now, and the comments say so.

**Where the pictures come from, and the cap that was the real bottleneck.**
Nothing new has to be invented. On September 22, 2026 the project held 1,157
chart covers and 4,307 faces on disk and 395 publisher pictures for a single
date's news. For the history, `PICTURES_PER_DATE` in `worker/src/pictures.ts`
was set to twelve with the comment "every tile that can reach the board",
which was true of an eleven tile board and is the reason the mural was
starved. It had also only ever been run on 36 of the 366 dates, and about
85 percent of what it asked for came back: 369 pictures from roughly 432
attempts. There are 19,750 history rows and 15,148 of them name their
article. The cap rises to the new board and the job is run everywhere.

**Generated pictures are refused, for now and with a reason.** Nathan raised
drawing cartoons for the events that have no photograph, which is a real gap
and a fair idea. It is not taken, because every tile on this board carries a
source and a colour saying how well sourced it is, and that is the only thing
separating this from any other content wall. A generated picture of a real
event has no source, and a tile is a thing people screenshot: a drawing of
the Taiping Rebellion, cropped off this board, is a fake historical image
with birthed.app on it. The 1993 tile is the sharpest case, where the drawing
would be a civilian airliner being shot down.

If it is ever built, these are its edges, and they are narrow on purpose: no
real identifiable person, no scene of a real event, nothing about a death, a
disaster or a war; openly a graphic rather than a picture, a mark for the
subject and not a depiction of it; a visible sign on the tile that it is a
drawing, the way the tier chips work; named in the receipt and on the about
page in the same commit. Until then the year, set large, is the answer, and
Commons has paintings, engravings and maps for the old events, which are real
artifacts rather than illustrations of one.

**Whose call this was.** Nathan's, handed over on September 22, 2026, after
two rounds of looking at rendered boards. The picture that decided it was
made from this date's real rows and its real covers and faces, and it is the
reason the rest of this section is specific.

**Two lines on the page, September 22, 2026.** Nathan, looking at the live
September 22 hive:

- **The sentence above the board is gone.** "Buzz what you think will still
  matter about September 22 years from now." The line above it already says
  the hive is open and when it seals, the line under it already says what a
  buzz does, and the board is between them, so this was the third telling and
  it pushed the board down a line on a phone. Section 13 cut it from every
  page but the open one on September 10; this finishes that.
- **"get Birthed" pointed at `/add/`, which is the wrong page.** `/add/` is
  where somebody hands you their birthday, not where you get the app. It
  points at `/about/`, which is the page carrying the download. A test now
  says it may never point at `/add/` again.

## 28. What the day agreed on, September 22, 2026

Muse, Meta's model, read the site and said the feed is not a feed, it is a
firehose. That is correct, and the measurement says how correct.

September 22 filed 736 stories, 394 of them the day's news read off fourteen
public feeds. The feed under the hive rotates the kinds so the first dozen rows
are a sample of the day rather than seventy headlines in a row, and that
rotation was the whole of the curation. Inside a kind the order is priority,
then arrival, which for news means the order the feeds happened to be read in.
A reader with three buzzes to spend was being handed three headlines chosen by
nothing at all.

The measurement. Take each news headline, lowercase it, keep the words of five
letters or more, drop a list of common ones, and count how many other outlets
on the same wall carry a headline sharing two or more of those words:

    carried by one outlet only    233
    and one other                  97
    and two others                 45
    and three others               19

A tenth of the day is carried by three outlets or more, and that tenth is the
day: the Sri Lanka Easter bombing verdict, Apple's music venue under its London
headquarters, Ella Langley breaking the Hot 100 record, the school shooting in
Turkiye, the Asian Games final. The 233 are the firehose. One of them is "Early
bets for Week 3: Three games to target right away".

Agreement across outlets is the ranking the feed never had, and it is the one
ranking this site is already about. Every story carries a tier saying how well
it is sourced, and the About page argues that the colour is how well a story is
sourced rather than whether it is true. A story four desks carried is better
sourced than a story one desk carried. The feed can say so with no model, no
score anybody has to trust and no request to anybody's API. It is counting.

The second half of the firehose is that those four desks are four rows. The
verdict arrives as NPR's headline, the BBC's, Al Jazeera's and the Guardian's,
each with its own button, so a reader who wants to back the verdict picks a
newspaper first and the buzzes split four ways. That is worse than noise. It is
the wall disagreeing with itself about what one story is.

So the feed collapses a cluster into one row. The row is the member with the
best tier, then the shortest headline, because the shortest statement of a
story is usually the plainest one. Under it, the other outlets by name. One
story, one button, four sources.

What the collapse never touches is a story somebody has already backed. Support
is counted per story, and folding a backed story into somebody else's row would
hide a buzz that was spent. A backed story is its own row, above the clusters,
as it always was.

Why the dropped words are a list and not a frequency count: 394 headlines is
not enough text to learn the common words from, and a list that is wrong in
public is easier to see and fix than a threshold that is wrong quietly.

### Not built here

The board still takes its unbacked news by priority and arrival, so the mural
can still draw the same verdict twice and can still lead with the Week 3 bets.
The same clustering answers that and it is the next commit. It is separate
because the feed can be read against the live day and the board cannot be until
a deploy lands.

## 29. Does it look like history, September 22, 2026

Section 28 ranked the feed by how many desks carried a story. Nathan pushed
back on the sentence under it, which said the ranking needed no model and
treated that as a virtue. He was right to. The no script rule on this site is
about the reader's browser, and it was carried somewhere it does not belong.

Counting desks measures what newsrooms covered today. This site asks what will
still matter in twenty years. Those are different questions, and the second one
is the whole product. Fourteen desks covering a speech at the United Nations
says nothing about 2046.

### The corpus nobody else has

The database holds 19,750 rows in `historical_events`, from the year 4 to
2026, one for every thing Wikipedia still lists under a date. That is not a
list of news. It is a list of what survived. Every row is an event that was
still worth writing down a decade or a century after the day it happened.

A news aggregator has today's stories. This one has today's stories sitting
next to twenty thousand labelled examples of durability, on the same 366
dates. Nothing else in the design is as valuable and it has never been used.

So: score a story by how much it rhymes with the things that lasted.

### The three signals

None of them alone is enough, and all three are computed in the worker, which
runs every fifteen minutes with nobody waiting on it. Nothing here happens
while a reader loads a page. The page reads a number the worker already wrote.

**One, the rhyme.** Every historical event is embedded once. Every story is
embedded when the importer files it. A story's lasting score is its mean
similarity to its nearest historical neighbours. The claim underneath is that
history repeats in kind: a coup, a treaty, a first flight, a verdict after a
massacre, a bridge opening. A story close to many things that lasted is of a
kind that lasts. A story with no close neighbour anywhere in twenty thousand
years of record is "Early bets for Week 3: Three games to target right away".

The nearest single event is kept and shown, because it is the best part. A
tile that says what it rhymes with is doing something no news site does, and it
is checkable, which is the only kind of claim this site makes.

**Two, the centre of the day.** Section 28 counts desks, which misses the case
where one event throws off five differently worded stories that share no words.
So the day is a graph: every story a node, every pair an edge weighted by how
similar they are, and PageRank over it. PageRank rewards being connected to
other central stories rather than merely having many neighbours, which is
exactly the difference between five desks repeating a press release and a day
that genuinely revolved around one thing.

**Three, the judgment.** One model call per cluster, and it is given the
rhymes as evidence rather than asked to guess. It returns two things: one plain
sentence saying what happened, in this site's voice rather than the outlet's,
and a verdict on whether it lasts, with a reason. The sentence is the visible
win. The feed today prints "Hayden Panettiere's Cause of Death Revealed",
which tells a reader nothing, and it should print what happened.

The model is one component of three, and the two under it are arithmetic over
real data. It is not asked what it thinks from nothing. It is asked to judge
against a corpus.

### What is kept, and what is never kept

The worker writes the sentence, the score, the rhyme and the reason onto the
story row. The outlet's own headline is never overwritten and never thrown
away: it is what the checker matches the source page against, and the receipt
page shows it. A written sentence carries the model's name and the date it was
written, the same way a suppressed historical event already does.

Nothing about a reader is sent anywhere. The only text that leaves this
project is a public headline and a public description that were already
published by a newspaper.

### Where embeddings come from

In the worker, on the worker's own machine, with no vendor and no key. Twenty
thousand events is minutes of processor time once, and four hundred stories a
day is seconds. A second outside service for embeddings would be a second
thing to be down, a second bill and a second privacy sentence, for a job that
runs fine locally.

The one outside call is the judgment, and it needs one key.

### Not built yet

This section is written before the code, which is the house rule. Nothing in it
exists. The order is the schema, then the embeddings and the rhyme, then
PageRank, then the model call, and each lands on its own.

## 30. Drama, decided September 23, 2026

**The numbers that started it.** From the first buzz on September 9 to
September 23, the live table held **36 buzzes from 13 boosters, and 2 of those
boosters buzzed on a second day**. On September 22, the day of the Hacker News
post, one booster buzzed. Nathan asked how to make the hive feel like r/place,
with more drama and more reason to come back, and whether it could be more
intuitive. Muse, Meta's model, had read the site and said the same about
intuitive.

**The honest limit first.** Drama needs a crowd. No rule makes a fight happen
between two people. What the rules can do is make one reader's visit feel like
a contest, give a reason to come back more than once a day, and give people
something worth posting. Everything below is aimed at those three and none of
it pretends to be a crowd.

**What r/place had that the hive does not.** A visible takeover, where your
work covers somebody else's. A short wait that pulled people back all day.
Teams fighting over space. A hard end. The hive has the hard end and, since
section 24, the rally link. It is missing the takeover and the wait.

**Nathan's calls, all four, plus the front door:**

1. **The crown.** The biggest tile on an open hive wears a crown. When another
   tile passes it, the board says so in one line, for example "3:12 pm: Bruce
   Springsteen took the crown from Ray Charles", and a short list under the
   board keeps every lead change of the day. It is a fact about tiles, never
   about a person, so sections 6 and 8 stand: no score, no leaderboard, no
   name. A sealed hive keeps its last crown and its list.
2. **This or that.** Two tiles side by side and one question: which will
   people still care about in ten years. One tap spends one buzz and the next
   pair comes up. This is the way in for a stranger, who today has to shop
   forty tiles to spend one tap. The pairs come from the board's own order;
   how they are drawn is for the build to argue.
3. **Buzzes that refill through the day.** Still three a day, but one arrives
   every eight hours rather than three at midnight Eastern. The daily total is
   unchanged, so the scarcity section 4 calls the engine is unchanged. What
   changes is that spending all three takes three visits. The limit stays
   server authoritative, which means the budget trigger changes and so does a
   migration.
4. **Decade teams.** Every tile already carries a year. The board shows which
   decade holds the most of the hive, for example "The 1940s lead September
   23". Teams with no accounts and no membership: a reader rallies for a
   decade by buzzing it, and nothing records which decade a reader favoured.
5. **The board comes first.** The date page opens with the hive and one line
   above it: "Tap what people will still care about in 10 years. 3 taps a day.
   Locks at midnight." The birthday picker moves below the board. This is the
   trust fix the "What the first strangers hit" entry in CLAUDE.md named and
   left open.

**Order.** The front door and the crown first, because they are the cheapest
and the crown is the most drama for the work. This or that second. Then the
refill, because it needs a migration Jason applies. Decade teams last.

**What this does not license.** No fake buzzes, same as the editor entry.
No live count of people here now, same as section 7. No number about a reader,
anywhere. No double value for a late buzz: one buzz is one unit at every hour.

**The Hacker News repost waits for this.** The September 22 post went up as
"Birthed", linking to the GitHub repository, at 5:01 pm Pacific on a Tuesday,
and scored 2 points. `docs/hn-launch.md` has the new post and it goes up after
the crown or this or that is live.

**Not built.** This section is written before the code, which is the house
rule. Nothing in it exists yet. The entries below record each piece as it
lands.

### The crown, built September 23, 2026

**The tie rule, Nathan's call.** The crown is held until another story has
strictly more buzzes, and on a tie the holder keeps it. The brief offered the
board's own order for equal counts, and it was not taken: that order breaks a
tie by the editor's score, so a crown following it could move on a tie, which
would say a story was passed when nothing passed it, and the score is not on
the date page at all, so the two pages could disagree about who wore it. The
crown depends on the buzz rows and on nothing else. On September 23, 2026 the
live table was the proof: three stories with one buzz each, and under the
board's order the editor would have picked the one wearing it.

**Derived, not stored.** `web/src/crown.ts` replays the day's `wall_boosts`
rows in `cast_at` order, then by row id for two in the same instant, and
keeps every change of hands. No table records a takeover. A buzz taken back
inside its thirty seconds is a row that no longer exists, so it was never a
takeover and the list does not say it was. The website's role reads
`wall_boosts` through the column grant in
`20260909120000_the_wall_writes.sql`, which allows `id`, `story_id`,
`wall_date`, `units`, `cast_at`, `tier_at_cast` and `support_before` and
refuses `booster_id`; the read asks for four of those and never the booster,
and a row not shaped like a buzz (units outside one to three, a time that
does not parse) is dropped wherever it came from. A story stamped false
cannot wear the crown and its buzzes count for nothing, the same way the pie
gives it no share. A story that is not on the date counts for nothing.

**One copy of the rule.** `HIVE_CROWN_JS` is plain JavaScript; the server
evaluates it to draw the baked page and every sealed hive, the live hive
runs it in the browser on every change, and the test runs the same string.
The live page keeps the day's rows, appends each buzz as it lands here or
over the socket, removes one taken back, and reads the whole log again after
a reconnect, because a buzz that landed while the socket was down never
arrives.

**What the reader sees.** The holder's tile carries a small crown mark in its
top corner and a honey edge, on the date page, the full screen hive and the
sealed hive alike, and a story leading from the feed carries it on its row
until the tick gives it a tile. Under the board, "The crown", and a list:
"4:27 am Eastern: Typhoid Mary took the crown." then "3:12 pm Eastern:
Bruce Springsteen took the crown from Typhoid Mary." The first crown of the
day is taken from nobody and the line says so by saying nothing. A person is
named, a song is its title and artist, and anything else is its headline cut
at a word (`crownName` in `wall.ts`). An open board nobody has buzzed says
"No crown yet. The first buzz on this hive takes it." A sealed board with no
buzzes shows no list, because the line under it already says nobody buzzed.
On the live hive the crown moves to the new tile the moment its buzz lands
and a status line under the board says the takeover; a buzz taken back that
hands it back says "The crown is back with Typhoid Mary." The mark's arrival
is animated and stops under `prefers-reduced-motion`.

**The live hive's leader edge is the crown now.** It followed the pie's
first tile, which is the board's order and so the editor's tie break; a
board with one leader by the crown's rule and another by the pie's would be
two answers to one question. `wlead` is gone.

**The time of day is the time of a buzz.** Every line shows when an
anonymous buzz landed, which the live hive already shows as it happens and
the row already carries for any reader of the project. The privacy page was
edited in the same commit to say the crown list shows those times and names
nobody.

**Tested, and tried against.** Zero, one and three buzzes; a tie; a three
unit app buzz passing two ones; rows arriving out of order; two rows in the
same instant; an undo that unmakes a takeover; a false story; a story off
the date; rows with units of nought, four and one and a half; a headline
carrying the characters that end a list or a style block. The live page was
driven in a headless browser with a faked socket and a faked `/boost`: a tie
over the socket left the holder, the reader's own buzz took the crown and
was not counted twice when the socket echoed it, an undo handed it back, a
three unit buzz passed everything, bent rows counted for nothing, and a
reconnect re-read the log. Web tests: 414. Not run against the live project.

**The iOS port, the same day.** `Birthed/Domain/HiveCrown.swift` is the
app's copy of the rule, `WallDay.boosts` carries the rows, `WallService`
reads them with the website's four columns, the holder's tile draws the
crown in its corner with the honey edge, and the list sits under the board
in the day page. `HiveCrownTests` asserts the sentences the website's tests
printed, so the two cannot drift apart without a failure. Not compiled and
not run: neither shell in the session had a Swift toolchain. Jason builds.
The app has no live socket, so the crown moves on the next load rather than
as a buzz lands, which is how the app's board already behaves.

**Not yet.** The comb page does not mark the holder's cell.

**The sentence that answers the tap says it too, Jason's call the same
day.** On the plain date page and on the pick page, "That counts." is
followed by "Bruce Springsteen took the crown from Typhoid Mary." when the
buzz that just counted moved the crown: the last change of hands is to that
story and landed inside the last minute. A buzz on the story already wearing
it says nothing, and the same address opened ten minutes later says nothing.
`crownTook` in `wall.ts`.

### This or that, built September 23, 2026

**Where it lives.** Its own page, `/<date>/pick/`, linked from the row of
pills under the board as "Pick between two" while a buzz can be spent. Not a
block on the date page: the date page opens with the board and one line, and
a second game above or below it would be the third telling the September 22
entry took off. A page with one question and two stories is the two second
thing on its own.

**What it is.** Two stories side by side under "Which will people still care
about in ten years?", each with one button, "This one". A tap is the same
plain form every tile carries, posting to `/boost` with `v=pick` and the
pair's index, and the server sends the reader back to the same pair with
the word in the query, the way every other tap comes back. "That counts.
Here is the next pair." with the Undo button, then the next pair, which is
the loser against the next story down. "Skip this pair" is a link to the
next index and spends nothing. No script; the page runs under the default
policy like the date page, and a test reads the header.

**How the pairs are drawn, pinned in `web/test/pick.test.ts`.** The day's
stories, the news collapsed to one row per story as the feed does, in the
comb's order: buzzes, then the editor's score, then priority, then desks,
then arrival. A story stamped false is out and a story this browser already
buzzed is out. Then top down, each story takes the next one below it that it
may face, and two news stories from one outlet may not: that is a newsroom
against itself. A story with nobody to face is left out. A story never faces
itself. With zero buzzes the top pair is the two most interesting stories;
with one, the winner is gone and the loser faces the third; with three, the
top three are gone and the list runs from the fourth.

**Drawn per request and never stored.** Which pairs a reader sees depends on
which stories their browser has buzzed, so the page reads this browser's
standing and is answered `no-store`, like the record page. A browser with no
cookie gets the allowance and the top of the list. The Undo button is drawn
only when the standing says this browser backed that story; the date page
gates it on the word alone and the database refuses a stranger either way.
On a date that is not taking buzzes the address sends the reader to the date
page, where the board says why.

**A hand made address cannot break it.** The pair index is a whole number
from nought to 9,999 and anything else is the top of the list; past the last
pair the page says every pair has been seen and offers the top or the board.
Nothing about the index reaches the database. The buzz itself is the buzz
the tiles send, with the same cookie, the same limit and the same word, and
the privacy page's description of a buzz is unchanged.

**Tested.** Zero, one and three buzzes; the same outlet rule; the reader's
own buzzes left out; one story left; the last pair; past the end; no buzzes
left; the outcome sentences; the crown sentence on a buzz that took it; a
tap from the second pair coming back to the second pair with its word and
its cookie; a stranger handed the address getting no undo; a closed date
sent to the date page. Web tests: 426. Not run against the live project.

**Not built.** No iOS pick screen; the app's hive already hands a reader the
board at tile size and the phone is where the tap is cheap. If the web page
earns its place, the app follows.

### Buzzes that refill through the day, written September 23, 2026

**The times, Nathan's call.** Midnight, 8 am and 4 pm Eastern, kept Eastern
rather than moved to Pacific hours: the hive opens and seals on the Eastern
clock and one site keeps one clock. Still three on the date and one on the
day after, section 4; unspent ones carry over inside the day, because the
allowance at any instant is how many have arrived so far and the day's
spend counts against that. A reader who opens the site at 5 pm with nothing
spent has three; at 9 am with one spent at 1 am, one.

**The migration, `20260923010000_buzzes_that_refill.sql`, is written and
NOT applied.** Two new functions, `wall_boost_allowance(instant, date)` for
what has arrived and `wall_next_refill(instant, date)` for when the next
one comes, and four replaced: the budget trigger, which is the authority and
now reads what has arrived by `cast_at`; `wall_units_left` for the app;
`wall_web_standing` for the website, which now also answers `next_at`; and
`wall_cast_web_boost`'s early check so it still answers in a word. Nothing
about a buzz row changes and one buzz is one unit at every hour. It was run
inside a transaction on the live project and rolled back, with twenty nine
checks inside it: the count at every boundary in daylight time and in
standard time, the next refill at each, and the trigger itself refusing a
second unit at 1 am and taking it at 8 am, refusing a third at 8:01 and
taking it at 4 pm, refusing a fourth, refusing a three unit app buzz at 1
am and taking one at 5 pm, and giving the day after its one and no more.
The live project was read afterwards and had neither function, the old
trigger and thirty six rows.

**The pages, gated.** `web/src/refills.ts` and `Refills` in
`Birthed/Domain/Wall.swift` are the page's copy of the same arithmetic,
pinned to the same instants, and both carry a flag that is off. With it on
the count says what has arrived and when the next one comes: "No buzzes
left right now. The next one arrives at 4 pm Eastern." The live hive adds a
unit when a refill lands while the page is open, on the seal clock's tick
and no second timer. The day after is unchanged and says what it said. The
order matters and is written on the migration: apply it, then flip the two
flags in the same deploy. Web tests: 433.

**Not decided, for Nathan.** The three dots under the live board draw the
day's allowance with the spent ones dark; with refills on, a dot for a unit
that has not arrived yet looks the same as one spent. A third look for
"coming" is a design call and was not made here.

### Decade teams, built September 23, 2026

**Nathan's calls, made on the three live boards.** On September 21 the
news was nine of forty four tiles and held one buzz of five; the 1780s,
the Pennsylvania Packet, held two. On September 22 all three buzzes fell
on the news. On September 23 the 1860s and the 1940s had one each. So: the
news counts as the 2020s, because a buzz on today's news is a buzz on this
decade and a line that said "the 1940s lead" on September 22 would have
been a half truth. Counted by buzzes, which is what the pie already cuts
the hive by, so the news does not lead on tile count alone. With no buzzes
there is no line, the same rule as the crown: a decade leads only because
somebody buzzed it.

**What the reader sees.** One line under the board, above the crown list:
"The 1940s lead September 23 with 2 of 3 buzzes." With one buzz on the
hive, "with the only buzz so far"; with every buzz on one decade, "with all
3 buzzes so far"; sealed, "led" and no "so far". A tie is a tie: "The
1860s and 1940s are level on September 23, 1 buzz each." Under the line,
the top three decades with their counts. On the live hive the line moves
as buzzes land. Every tile carries `data-decade` in its markup.

**How a tile gets its decade.** `decadeOf` in `web/src/decades.ts`, the
same in `HiveDecades` on iOS: a history row, a number one and a fact from
their leading year, a person from "born YYYY", the news from the wall
date's year. A story with no year is on no team, and a story stamped false
counts for none. A pooled story with a buzz counts, because the pie counts
it.

**What is not recorded.** Nothing. The standing is a sum over the story
rows the page already has, the line is generated text, and there is no
table, column or cookie for a reader's decade.

**Tested.** Zero, one and three buzzes, the tie, the three live boards
pinned as fixtures, a false story, a story with no year, the block before
the date opens, the sealed tense, the page's copy against the server's, and
bent rows into the page's own sum. Web tests: 440. iOS `HiveDecadesTests`
written and not run.

