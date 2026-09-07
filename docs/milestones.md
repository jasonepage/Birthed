# Milestones

A birthday comes once a year. This is the reason to open Birthed in March.

Everything here is arithmetic on one birth date. No network, no model at
runtime, no location, and nothing new stored about anybody. That is not a
constraint somebody imposed on this feature. It is the reason the feature can
exist at all in an app whose privacy page says what this one's says.

---

## 1. The one sentence

A round number is a fact. Two rare things landing on the same day is a story,
and section 4 is about the day the arithmetic said the second one almost never
happens.

---

## 2. What the reader gets

Three to five lines on the Mine tab, soonest first, each one a date and a
distance. "Your 10,000th day is 19 days away." A notification a few days
before the next one, on the same schedule and through the same planner that
already carries other people's birthdays.

Not a wall of numbers on the birthday itself. The whole point is that these
land on ordinary days.

---

## 3. The pool, and what the frequencies did to it

Every candidate below was counted over 29,219 days, which is eighty years.
The column that decided everything is the last one.

| Candidate | How many in a life | One every | In |
|---|---|---|---|
| Round day counts (1k, 5k, 10k, 15k, 20k, 25k) | 6 | 4,869 days | Yes |
| Repeated digits (1111, 2222 … 22222) | 11 | 2,656 days | Yes |
| Birthday on the weekday you were born | 11 | about 7 years | Yes |
| Golden birthday | 1 | once | Yes |
| Palindromic day counts (12321) | 282 | 103 days | No |
| Prime day counts | 3,008 | 9 days | No |

**Palindromes are out and this was the surprise.** They feel rare and they are
not. There are exactly ninety four-digit palindromes, and they all fall between
age 2.7 and age 27.4, so through the whole of childhood and youth one arrives
every hundred days. A thing that happens to you three times a year is not a
milestone, it is a Tuesday with a nice number on it.

**Prime days are out for the same reason, harder.** Around fifteen thousand,
roughly one number in ten is prime. Somewhere between one and two prime days
arrive every fortnight for your entire life. No scoring rescues a candidate
that is not rare.

**Unit variants are not separate events.** A thousand weeks is seven thousand
days. A hundred thousand hours is 4,166 days. They are the same instant wearing
a different label, so they may be a nicer way to *say* a milestone but they
must never be counted as a second one. Counting them twice is how a pool
inflates without a single new rare day in it.

**Moon phase, meteor showers and eclipses are decoration, not members.** A full
moon comes every 29.5 days, so the odds your 10,000th day is one are about one
in thirty. Of a thousand readers, thirty-four get it. Meteor showers are annual
and land on nearly fixed dates. These can be printed on a milestone that
already qualifies. They cannot be the reason one qualifies.

Eclipses have a second problem on top of the first: a total eclipse is total
along a narrow path, not globally. Telling somebody in Oregon there is a total
eclipse on their birthday when the path crosses the Indian Ocean is exactly the
error this audience catches, and it cannot be fixed by checking where they are,
because the privacy page says the device's location is never used or sent. If
eclipses ever ship they ship as "there is an eclipse somewhere on earth that
day", which is a weaker sentence, honestly labelled.

---

## 4. Stacking, and the number that changed the design

Two rare things on one day is the feature. Here is how often that actually
happens.

A life holds about 29 genuinely rare days from the table above. That is 406
possible pairs, against 29,219 days to land in.

| Two rare milestones land | Share of people it ever happens to |
|---|---|
| On the same day | 1.4% |
| In the same week | 9.7% |
| In the same month | 43.1% |

**A same-day stack is a once-in-seventy-lives event.** Build the feature around
it and 98.6% of readers never see the thing the feature is for. That is not a
tuning problem, it is the arithmetic of thirty events in thirty thousand days,
and no amount of widening the pool fixes it without also destroying the rarity
that made a stack worth printing.

So the collision window is a week, not a day, and the sentence says so plainly:
"Your 10,000th day falls in the same week as your golden birthday." One reader
in ten gets one of those in a lifetime, which is rare enough to be a real
surprise and common enough to be a feature. A same-day collision, when it does
happen, is scored far higher and gets its own wording.

A month is too wide. Two things in the same month is a coincidence nobody
feels, and it happens to nearly half of everybody, which is another way of
saying it is not a coincidence.

---

## 5. Scoring

Three inputs, multiplied, no learned weights and nothing to tune later:

- **Rarity.** How many of this kind arrive in a life. Six beats eleven beats
  282, and 282 did not make the table.
- **Stacking.** A multiplier, not a member. Same week counts. Same day counts
  much more.
- **Proximity.** A milestone forty years out is not news. One three weeks out
  is. This is what makes the list change through the year, which is the whole
  retention argument.

Rarity and stacking are properties of the date. Proximity is the only one that
moves, so the ranking is stable and the order still changes as the year goes
by, which is the behaviour the Mine tab wants.

---

## 6. Where the comparisons come from

A table, not a model, and not retrieval.

`WorldThen` already holds dated timelines and arrivals and answers "you are
fifteen years older than Fortnite" with no network and no cost. Milestone
comparisons are the same shape and belong in the same place: a stretch of days
with a name the reader already holds. "You have been alive longer than the
Soviet Union existed."

Two reasons this is not a retrieval augmented generation problem, and both are
already written down in this repository.

`WorldThen` exists because the fact finder produced that kind of sentence six
times in 2,751 facts, so the sentence was built as a table instead. Nothing
about milestones changes that result.

And the fact finder's own notes say a model asked to research and to format in
one call stops searching and answers from memory, with page addresses that look
real and are not. Numbers are the one kind of content where an invented
comparison is unrecoverable, because a reader checks it in four seconds.

There is also a plainer problem with the comparison in the original sketch.
25,000 days is 68.4 years, and almost any pair of historical events 68 years
apart will fit, so the fact carries no information even though it feels like
it does. A comparison earns its place by being anchored to something the reader
already has a feeling about, not by matching a number.

---

## 7. Deliberately not used

Retrieval augmented generation. A model at runtime. Any network call. The
device's location. Eclipse paths. Prime numbers. Palindromes. A second copy of
the day arithmetic anywhere outside `Birthed/Domain`.

A model is genuinely useful here exactly once, offline: writing the sentence
for each kind of milestone, and helping curate the comparison table. Not per
reader and not per milestone.

---

## 8. The 64 slots

iOS holds 64 pending notification requests and silently drops the rest. Two
things already claim them and one of them has a written decision behind it:
the reader's own birthday is never trimmed, people you know rank above people
you follow, and people you follow get no notification at all.

Milestones are a third claimant. The order is:

1. The reader's own birthday. Never trimmed, per the existing rule.
2. Birthdays of people they added.
3. Milestones, soonest first.

Milestones are the newest of the three and the only one nobody is waiting for,
so they yield. This belongs in `NotificationService.reachable` beside the
existing filter rather than at the call sites, for the reason already recorded
there: a filter every caller has to remember is a filter one caller forgets.

---

## 9. Where this lives, and where it cannot

iOS only.

birthed.app deliberately does not ask for a birth date. That is the entire
point of the September 7 pivot, and the top comment on the Reddit launch was an
accusation of harvesting birthdays under copy that already promised nothing is
collected. A milestone needs a birth date, so the web cannot compute one
without asking for the thing the site just stopped asking for. It also sends
`default-src 'none'` and runs no script, so it could not compute one in the
browser either.

This is an app feature. Nothing about it goes on the website.

---

## 10. Honest limits

**Nobody knows whether this retains anyone.** The reasoning that milestones
give the app a reason to exist in March is sound and it is still reasoning. It
is not evidence, and there is no way to get evidence before it ships.

**The cheapest test costs an afternoon and comes before the build.** Compute
the next three milestones for ten real birthdays, print the actual sentences,
and read them. If you would not send one of them to somebody, the scoring is
not the problem and neither is the pool.

**Eighty years is an assumption.** Every frequency here is counted over 29,219
days. A reader who is nineteen has seen almost none of these and has most of
them ahead; a reader who is sixty has the opposite problem and a thinner list
in front of them. The proximity term handles this on its own, but the tables
above describe a whole life and not the next five years of one.

**The stack rate is a population figure.** 9.7% of people get a same-week stack
at some point in eighty years. It says nothing about whether a particular
reader has one coming, and the feature has to read well for the nine in ten
who never get one. That is the real design bar: the ordinary milestone has to
carry the feature, and the stack is the bonus.

---

## 11. Acceptance

- Every milestone type is pure Swift in `Birthed/Domain`, takes its inputs as
  parameters, imports nothing but Foundation, and is tested against a fixed
  clock with no simulator.
- Day arithmetic uses `calendar.date(byAdding:)`, never `addingTimeInterval`.
  Some days are 23 or 25 hours long and this feature is entirely made of day
  counting.
- February 29 resolves at read time, through `LeapObservance`, exactly as
  birthdays already do.
- A reader with no birth year gets no milestones and no empty section.
- Nothing in the feature reaches the network, and a test asserts it.
- The list is computed for a reader who is 19 and for one who is 60, and both
  are read out loud before anybody writes a view.

---

## 12. The test was run, and it reversed section 4. September 7, 2026

Section 10 said the cheapest test was to compute real milestones for real
birthdays and read the sentences. It cost twenty minutes and it took the
feature apart. Five birth dates, ages 19 to 60, two year horizon.

**The stacking arithmetic in section 4 is wrong, and the error is mine.**
Every one of the five had exactly one same-week stack in their entire life,
and in all five it was the same one: the 9,999th day next to the 10,000th day.
Those are one day apart by construction. Section 3 counted repeated digits and
round numbers as independent kinds and they are not independent at all, they
are both "numbers that look nice in base ten" and they cluster hard. Remove
that artifact and the real same-week stack rate is not 9.7%, it is about zero.

Stacking was the reason this feature was interesting. It does not work.

**One reader in five has nothing.** The 35 year old had no milestone of any
kind in the next two years. Not a thin list, an empty one. A running calendar
that is blank for two years is not a calendar, and the fix cannot be a wider
pool, because section 3 is the record of what widening the pool does to
rarity.

**The golden birthday is always in the past.** It fires at the age that matches
the day of the month, so between 1 and 31. Everybody over 31 has already had
theirs, and the 19 year old in the test had hers at 14. It never appeared in a
single upcoming list. It is a fact about somebody's past, which the Mine tab
can print, and it is not a milestone.

**The surviving lines are thin.** In full:

```
in 137 days   your 9,999th day alive
in 179 days   your 22,222th day alive
in  80 days   your 45th birthday, on a Thursday again
```

The third has something in it. The first two are trivia with a comma.

### What this changes

The number is not the milestone. The comparison is.

The one line worth reading was not a big round number, it was a fact about the
calendar repeating itself. What generalises from that is not "find rarer
numbers", it is that a reader has a feeling about a Thursday in 1981 and has no
feeling whatsoever about 22,222.

So the running calendar is built on **durations**, not on day counts:

> Today you have been alive longer than the Soviet Union existed.

This fixes the density problem that killed the numeric version. A life holds
about thirty rare numbers and that is fixed by arithmetic. Durations are not
scarce: two hundred of them spread between a few months and ninety years means
a reader crosses two or three every year, at any age, forever. The cadence is
roughly flat across a life instead of clustering in childhood, which is exactly
backwards from how the numeric pool behaved.

`WorldThen` is the right home and is half built for it. It holds 104 dated
versions and 9 arrivals, and all of them answer "what was true when you were
born", which is a fact that never changes and therefore never arrives. A
duration table is the missing half and it is the half that ticks.

The numeric milestones stay, demoted. They cost nothing, they are already
arithmetic, and 10,000 days is genuinely worth one line on the day. They are
not the feature and they cannot carry a notification schedule on their own.

### What is now unbuilt and unwritten

The duration table does not exist. Nothing in this document specifies what
belongs in it, how a duration earns a place, or how to keep it from becoming
the same arbitrary comparison section 6 already rejected. "You have been alive
longer than the Beatles were a band" works. "You have been alive longer than
the gap between two events nobody connects" is the 25,000 days problem wearing
a new coat, and the line between them is not written down yet.

That is the next document, and it should be written before any Swift.
