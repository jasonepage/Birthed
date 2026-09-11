# Measuring the hive

One question decides whether the hive works: **of the people who buzz once, how
many buzz again on a different day.** Everything in this file exists to answer
that one question and to say honestly how wrong each answer could be.

Every number here is a count of rows that already exist. Nothing was added to
the database to make any of it possible, no event stream was built, and nothing
identifies a person beyond the random token that was already there. That is the
rule in `CLAUDE.md` section 5, "How Birthed measures", and this file lives under
it rather than beside it.

The four queries below are the whole of it. They are run against the database
and the answers are shown, to Jason alone, at `/admin/numbers/`.

---

## What a booster is, and what it is not

`wall_boosts.booster_id` is one of two things, told apart by
`wall_boosts.authenticated_by`:

- `web_token`: the random string in the `bt` cookie a browser gets the first
  time it buzzes, in a scrambled form that cannot be turned back into it. Call
  it a **browser token**.
- `attested`: the anonymous account the app makes on first launch, which has
  passed Apple's App Attest check. Call it an **install**.
- `seed_tool`: a row the test seed wrote with the service role. There are none
  of these today.

**A booster is not a person.** One person with the app and a browser is two
boosters. One person who clears cookies is a new booster the next day. One
household on one computer is one booster. There is no honest way around this
without an account, and reading must never require one, so the trade is taken
on purpose and stated here rather than forgotten.

---

## The day the site counts by

A buzz is stamped in Coordinated Universal Time, which is what the column
holds. Every question below about "a different day" converts that stamp to the
calendar day in United States Eastern time, because Eastern midnight is already
what decides when a date opens, goes live and seals. One clock for the whole
site, or the archive means two different things.

---

## Query 1. How many boosters buzzed at all

```sql
select
  count(distinct booster_id)                                                  as boosters_all,
  count(distinct booster_id) filter (where authenticated_by = 'web_token')    as browser_tokens,
  count(distinct booster_id) filter (where authenticated_by = 'attested')     as app_installs,
  count(distinct booster_id) filter (where authenticated_by = 'seed_tool')    as seeded,
  count(*)                                                                    as boost_rows
from wall_boosts;
```

**Answer on September 11, 2026:** 4 boosters, of which 3 browser tokens and 1
install, across 13 boost rows.

**What would make this number lie.** It counts boosters, not people, for the
reason above, so it is an over count of humans and an under count of interest.
It also counts only buzzes that still stand: a buzz taken back inside its
thirty second window is deleted outright and leaves nothing behind, by design,
so somebody whose only buzz was a misclick they undid is invisible here.

---

## Query 2. How many buzzed on two or more different days

```sql
with cast_days as (
  select booster_id,
         (cast_at at time zone 'America/New_York')::date as cast_day
  from wall_boosts
  group by 1, 2
),
per_booster as (
  select booster_id, count(*) as days_buzzed
  from cast_days
  group by 1
)
select
  count(*)                                    as boosters_with_any_buzz,
  count(*) filter (where days_buzzed >= 2)    as came_back_on_another_day,
  max(days_buzzed)                            as most_days_by_one_booster
from per_booster;
```

**Answer on September 11, 2026:** 4 boosters buzzed at all, 2 of them buzzed on
a second day, and no booster has buzzed on more than 2 days.

**This is the number the whole mechanic rests on, and today it rests on four
rows.** Two out of four is not a rate. It is four people, almost certainly the
two of us and two browsers, and it would read the same if it were an accident.

**What would make this number lie.** A browser that loses its cookie between
one day and the next comes back as a stranger, so this is a floor and never a
ceiling. In the other direction, one person using the app on Tuesday and a
browser on Wednesday is two boosters who each came once, which also pushes the
floor down. A shared computer pushes it up. And the hive's three day window
caps what is even possible: a booster can only come back while something is
open to come back to.

---

## Query 3. The days between a first buzz and a second

```sql
with cast_days as (
  select booster_id,
         (cast_at at time zone 'America/New_York')::date as cast_day
  from wall_boosts
  group by 1, 2
),
ranked as (
  select booster_id, cast_day,
         row_number() over (partition by booster_id order by cast_day) as nth
  from cast_days
),
gaps as (
  select f.booster_id,
         (s.cast_day - f.cast_day) as days_between
  from ranked f
  join ranked s on s.booster_id = f.booster_id and f.nth = 1 and s.nth = 2
)
select
  count(*)                       as boosters_with_a_second_day,
  min(days_between)              as shortest_gap_days,
  max(days_between)              as longest_gap_days,
  round(avg(days_between), 1)    as mean_gap_days,
  array_agg(days_between order by days_between) as every_gap
from gaps;
```

**Answer on September 11, 2026:** 2 boosters have a second day, and both gaps
are 1 day. Shortest 1, longest 1, mean 1.0.

**What would make this number lie.** A gap of one day is what you would expect
from a site that has existed for a few days, not evidence of a daily habit. The
longest gap this query can ever report is the age of the oldest buzz, so the
number will drift upward on its own for months whatever anybody does. It also
looks only at the first two days and ignores everything after, so a booster who
came on four days is counted the same as one who came on two.

---

## Query 4. How many stories on each hive had a buzz

```sql
select
  s.wall_date,
  count(*)                                              as stories,
  count(*) filter (where b.story_id is not null)        as stories_with_a_buzz,
  coalesce(sum(b.boost_rows), 0)                        as buzz_rows_on_this_hive
from wall_stories s
left join (
  select story_id, count(*) as boost_rows
  from wall_boosts
  group by story_id
) b on b.story_id = s.id
group by s.wall_date
order by s.wall_date;
```

**Answer on September 11, 2026:**

| Hive | Stories | Stories with a buzz | Buzz rows |
|---|---|---|---|
| September 8, 2026 | 109 | 0 | 0 |
| September 9, 2026 | 385 | 7 | 7 |
| September 10, 2026 | 713 | 4 | 6 |
| September 11, 2026 | 234 | 0 | 0 |

**What would make this number lie.** The story count is the seeder's output,
not the reader's appetite, and it climbs all day, so the share of stories with
a buzz falls through the day even when buzzing never slows. Comparing one hive
to another mostly compares how much the worker filed. The count also stops at
one: a story with a single buzz and a story with a hundred both count once, on
purpose, because the question is coverage of the board and not the size of the
pile. September 11 shows zero because the day had barely begun when this ran.

---

## What none of this can do

No funnel, no cohort, no retention curve, and no question nobody thought to ask
before the rows were written. Current rows are not events. That is the same
trade `CLAUDE.md` section 5 already took for the app's four numbers, and it is
still the right one. Wanting more later is a decision to reopen with the
privacy page open beside it.
