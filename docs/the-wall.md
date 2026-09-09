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
years. Reading needs no account and never asks for one. Signing in is requested
only at the moment somebody first submits or boosts, which is the
"plus Sign in with Apple later" already written into the stack.

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
