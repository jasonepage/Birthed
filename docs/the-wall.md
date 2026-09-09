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
