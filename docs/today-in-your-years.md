# Today, in your years

The specification for the Today tab. Written September 6, 2026. It replaces
the list of ten names with a time machine for today's date, indexed by the
reader's own age. `CLAUDE.md` section 5 records the decision; this file is
the how.

## 1. The one sentence

Every "on this day" product answers what happened on September 6. Birthed is
the only one that knows the reader's birthday and birth year, so it answers a
question nobody else can: **what happened on this date while you were alive,
and how old were you.**

"In 2008, Google released Chrome" is a history app. "You were 6. Google
released Chrome today" is a mirror. The mirror is what gets screenshotted.
This is the same finding the fact finder already made once, that "you are
older than Kingdom Hearts" was the strongest sentence in the product, applied
to every day of the year instead of one.

## 2. What is on the screen

**Built September 6, 2026 as a feed, not a wheel.** The first draft of this
section put the years on a wheel. Nathan's ask was a feed: events, people,
songs, films, the found facts, everything about the day mixed together the way
a timeline is, so that is what `DayPageView` is. The wheel idea survives as
the ranking underneath it.

Today's date at the top with the two arrows, then one list, with a hairline
between rows and no cards. Every row has a small heading saying what kind of
thing it is, and beside it the reader's age that year in a pill: YOU WERE 7,
THE YEAR YOU WERE BORN, 4 YEARS BEFORE YOU. The first row is set large, the
way the lead fact is on Mine.

Five kinds of row, from `DayFeed.Kind`:

1. **Found facts.** The rows the fact finder already stores for the date, with
   their category as the heading, the source host under, and the share and
   like controls they have on Mine. Older-than leads the whole feed when one
   exists.
2. **On this day.** A sentence from Wikipedia's date article, verbatim, with
   the year and a link to the article.
3. **Born today.** A name and Wikidata's one line about them, with the year
   they were born and the reader's age that year.
4. **Number one song** in the week of this date in a given year, with the
   artist.
5. **Number one film** the same way.

The order is `DayFeed.build`, in the domain and tested: rank by the score in
section 4, then inside a rank the kinds take turns so no kind runs away with a
stretch of the screen, then inside a kind the newest year first. For a
September 4, 2002 reader that puts 2007 to 2017 at the top with a song, a
film, an event and a person taking turns, and the Roman Empire at the bottom.

**No birth year.** The feed still builds. Nothing carries an age, the charts
run from 1959, recent years rank first, and the line under the date says to
add the year in Settings. It is the one screen after onboarding that makes
the case for the year.

## 3. Where the material comes from, and what it costs

| Material | Source | Cost per date | State |
|---|---|---|---|
| Number one song, by week | `chart_weeks`, Hot 100 from 1959 | Nothing, a query | In the database |
| Number one film, by week | `chart_weeks`, box office from 1946 | Nothing, a query | In the database |
| Events on this date, by year | Wikipedia's date article, Events section | Nothing, one worker run for all 366 dates | **Not built.** `historical_events` exists and is empty |
| People born today, by year | `notable_people` | Nothing | In the database |
| Shared date facts with a year | `birth_facts` | Already paid for on 281 dates | In the database |

**No model runs for this tab.** The fact finder is not asked for anything new.
The one place a model already spent money, the shared date facts, is shown at
the year it belongs to and nowhere else. A tab that people flick through
cannot be allowed to spend a search per flick, which is the rule
`FactsService.readDay` already enforces, and this design needs nothing that
would break it.

### The events import

`worker/src/import-events.ts`, new. For each of the 366 dates it fetches the
rendered HTML of the English Wikipedia article for that date, the way
`charts.ts` fetches a year list, and reads the Events section. Each line is a
year, an en dash, and a sentence. The rows go into `historical_events` as they
are, with `source_url` the article and `content_license`
`CC BY-SA 4.0`, through `upsert.ts`.

Rules for the reader:

- Only the Events section. Births and Deaths are already covered by
  `notable_people`, and Holidays are not events.
- Keep the sentence verbatim, with the wiki links stripped to their text. Do
  not summarise, do not rephrase. A sentence somebody else wrote and a
  thousand people checked is worth more than a smoother one nobody did.
- Drop any line whose year does not parse as a whole number between 1 and
  this year. Wikipedia's date pages have "c. 1200" and "1400s" lines; absent
  beats wrong, the same rule as the 1958 chart.
- Store the year exactly. Every line on those pages has one.
- `--dry-run --print` first, on one date, and read the output before running
  the lot. The date pages have decades of hand editing in them and the reader
  will meet a table shape the year lists never had.
- Running it again replaces a date rather than adding to it. Every row carries
  the start of the run that wrote it, and after writing, a date that read
  successfully has its older rows deleted. A date whose fetch failed is left
  alone. This is what makes fixing the reader safe: without it, every
  correction would leave the old sentence on screen beside the new one.

**What the first full run found, September 6, 2026.** 19,734 events across all
366 dates, years 4 to 2026, every row with a year, a source on English
Wikipedia and a licence. About 125 lines were refused across the year, which
is under one percent, and they are the two kinds the rule was written for:
lines before the common era and lines whose year is "c. 1200" or "1400s".
Nothing before the common era reached the table, which was checked rather than
assumed. One line in 19,734 arrived carrying a footnote marker somebody had
typed as text rather than written as a reference, which `cellText` could not
see because there was no `sup` element to remove; the line reader now takes a
trailing marker off.

Expected size: the pages carry between 40 and 120 events each, so 20,000 to
40,000 rows. Small.

### One database function

Fetching the song for each of a twenty year old's twenty years is twenty
requests. It should be one. A migration adds:

```sql
create or replace function chart_on_date(
  p_chart text, p_month int, p_day int, p_from_year int, p_to_year int
) returns table (year int, chart_date date, song text, artist text)
language sql stable security invoker set search_path = public as $$
  select y.year, w.chart_date, w.song, w.artist
  from generate_series(p_from_year, p_to_year) as y(year)
  cross join lateral (
    select chart_date, song, artist from chart_weeks
    where chart_name = p_chart
      and chart_date >= make_date(y.year, p_month, p_day)
    order by chart_date asc limit 1
  ) w
  where w.chart_date <= make_date(y.year, p_month, p_day) + 6;
$$;
grant execute on function chart_on_date to anon, authenticated;
```

The `+ 6` is `ChartWeek.covers` in SQL: the first issue on or after the date
and no more than six days after it, for the reason in `CLAUDE.md` section 5.
`make_date` will raise on February 29 in a non leap year, so the app passes
the observed date for each year, resolved through `BirthdayCalendar` the way
everything else is. Security invoker, not definer, because `chart_weeks` is
already readable by anonymous clients and the function needs no extra rights.

The same function serves the film chart with a different `p_chart`.

## 4. Ranking without likes

The research document says nothing can be steered by likes below 5,000
impressions, and there are 25 users. So the order is arithmetic, and it is
different for every reader without a single vote.

**The wheel opens on the year with the highest score, where the score is
the reader's age that year mapped like this:** ages 5 to 15 score 3, ages 0
to 4 and 16 to 25 score 2, everything else 1. Ties go to the year with the
most material (events plus people plus facts). Years before birth score 0
and never open first.

Within a year, events are shown in the order Wikipedia lists them, which is
chronological within the day where known and otherwise editorial. Do not
reorder them. People are most looked up first, as everywhere else.

The age band is a guess about nostalgia and it is the one number in this
design that should be tuned once there are share counts to tune it against.
Record which year each share card was made from; that is the signal.

## 5. The two cards

Both 1080 by 1350, both rendered on device with `ImageRenderer`, both
nameless like every card the app exports, both carrying the year but never
the date of birth in a form that gives the day away beyond the date already
on the card. The date is on the card; that is the point of the card.

**Every year of your life** (not built yet). Today's date at the top. Then a column: the year
down the left, the number one song and artist to its right, one row per year
from birth to now. Twenty rows for a twenty year old, set small enough to
fit, serif. Footer: "Number one on this day, every year I have been alive"
and the Wikipedia and Billboard credit line. This card needs no new data and
is the first thing to build.

**Today, when I was 7** (not built yet). The age large, one event sentence under it, the year
and the date small, the source host smaller. Made from any event row by its
own share control, the way facts already have one.

## 6. What this replaces and what it keeps

- The list of ten names as the tab's body: **gone.** They are one kind of row
  in the feed, thirty of them rather than six, each at its birth year.
- `FoundFactsSection` on Today with the heading WHAT HAPPENED ON THIS DAY:
  **folded into the feed** as the fact rows, with their like and share.
- The two date arrows: **kept.**
- The anonymous `ShareCardView` for a date, six names: **kept** as the card
  for a date with no reader year, which is the case when the profile has no
  year.
- `FactsService.readDay`, reads and never asks: **kept and relied on.**

## 7. Acceptance

- `import-events` on `--dry-run --print` for September 6 shows sentences with
  years, no "c." lines, no Births or Deaths, no wiki markup.
- The full run inserts more than 20,000 rows and every row has a year,
  a source and a licence.
- `chart_on_date('Billboard Hot 100', 9, 6, 2002, 2026)` returns 25 rows in
  one request, and the 2002 row matches what Mine shows for a September 6,
  2002 profile.
- On a phone with a September 4, 2002 profile, the top of the Today feed is
  rows from 2007 to 2017 with YOU WERE pills, and the kinds take turns. Rows
  from before 2002 read N YEARS BEFORE YOU and sit at the bottom.
- Walking the date with the arrows makes no network request that is not a
  read of a table or the `chart_on_date` function.
  `birth_fact_runs` does not gain a row from anything done on this tab.
- Both cards render with the network off, given data already loaded.
- No name, no day of birth beyond today's date, on either card.

## 9. The events on the web pages, September 6, 2026

The same events are on birthed.app, merged with the researched facts into one
list ordered by year rather than sitting in a section of their own. September 4
went from 13 things to 60.

**Seven of the thirteen were already there.** Both sources answer the same
question and neither knows about the other, so the founding of Google, the
opening of Pearl Street Station and five more were about to be printed twice.
`saysTheSameThing` in `web/src/timeline.ts` compares the carrying words of two
sentences in the same year, measured against the shorter of the two, and the
threshold is set from the twelve real pairs on September 4 where a fact and an
event share a year. Seven of those are the same event and score 0.50 to 0.80;
five are different events and score 0.00 to 0.14. The tests use those exact
sentences rather than invented ones.

The researched fact wins a collision, because it is the one whose cited page
was opened and checked, and because it is already serving searches. Dropping
by year alone would have been simpler and would have lost the Little Rock
Crisis, which shares 1957 with the Edsel launch.

**The date came off the front of every fact.** They are written naming the
date on purpose, so the same sentence works for somebody born on it and for a
stranger who searched it. On a page already titled with that date it was
printed once per row, and the year, which every other list on the page puts in
the margin, was buried mid sentence. `splitDatePrefix` moves it, and only ever
strips the page's own date.

**The Wikipedia rows carry one credit rather than fifty four.** Their source is
the same article every time, so it is credited at the foot the way the chart
weeks are. The researched facts keep a link each, because their sources are all
different and the link is the point.

## 10. The share cards say what happened, September 6, 2026

The card for a date used to be the date and three names. It now leads with one
thing that happened, and takes two names instead of three, because a third name
is one more of the thing every competitor already has and the line about the
date is the half none of them can print.

**It comes from the researched facts, never from the Wikipedia events, and that
is the whole design.** 41 percent of the 19,734 imported events match a list of
words like killed, bombing, massacre and crash. Every one of the 366 dates has
at least one that does. If the card took the most recent event for its date,
then 134 of the 366 cards would carry a killing, a bombing or a crash, and
September 4's would be a school shooting. The fact finder is already steered
toward things somebody would screenshot, so it is the curated set; an
encyclopedia's date article is not, and never claimed to be.

A word filter runs over the facts as a second guard, the shortest passing line
wins so the card has one readable line and the same one every build, and a date
with nothing that passes gets no line at all. 277 of the 366 dates carry one.
The rest keep the card they have today, which already works.

**And the names came off entirely, which was the bigger find.** The word
filter worked on September 11 and gave the card the Carol Burnett Show. The
card then said, underneath it, "You share it with Bashar al-Assad", because the
name list is ordered by how much attention somebody gets and infamy is
attention. Searching only for descriptions that say so outright, thirteen dates
carry a serial killer, dictator or war criminal in their top three, and five of
those led the card: John Wayne Gacy on March 17, Mussolini on July 29, Ed Gein
on August 27, Charles Manson on November 12, Ted Bundy on November 24, with
Hitler and Göring second on two more.

That search is a floor and not a count, and Assad is the proof: Wikidata calls
him a politician, so no word list would have found him. There is no field in
the data meaning "not on a birthday card". So a card that has something that
happened on it now shows no names at all. It needs no list, nothing can slip
through it, and it was the better card anyway, since the names are what every
competitor already has. The 89 dates with no researched fact still show names,
because names are all they have, and the fix for those is to finish searching
the 85 dates the backfill never reached rather than to start keeping a list of
people.

**Then the names went entirely, because a screened event beats them.** The
targeted backfill that would have given the worst dates a researched fact could
not run: `fact_searches_left()` is 0 against a 3,000 monthly limit with 3,182
already spent, so the Edge Function refuses every run. The free route was to
fall back to Wikipedia's own line for the date rather than to the names, run
through the same word list plus a stricter one for the habits of an
encyclopedia. November 12 becomes the PlayStation 5 being released instead of
Charles Manson, and November 24 becomes the Atlantis launch instead of Ted
Bundy.

**All 366 dates now carry a line and none falls through to names**: 278 from a
researched fact, 88 from a screened event. The names branch stays in the code
for a date that has neither, which no date currently is.

The reason screening works on events and cannot work on people is worth
keeping: an event's sentence describes the thing being refused, and a person's
description does not. Wikidata calls Assad a politician and Tate a
businessman. That asymmetry is the whole argument.

**This is not fixed anywhere else.** The day pages still list these people, and
there the case is different, because a list of who was born on a date is a
record rather than a celebration and Wikipedia does the same. The app is the
one to look at: the onboarding line about who shares your date has the card's
celebratory framing, not the page's, and nobody has checked it.

**What the filter does not do.** The three dates I spot checked that came back
with no line, November 22, December 7 and December 25, have no researched facts
at all: they are among the 85 dates the backfill never reached, so their cards
are unchanged for a reason that has nothing to do with the filter. Whether the
filter would have caught November 22 and December 7 on its own is untested,
because there is nothing there yet to test it against.

## 8. Honest limits

- This is a recombination, not an invention. Timehop did "this day in your
  photos" and there are web pages that give the number one song on a
  birthday. Nobody has put the general record of a date on a dial indexed by
  the reader's age, and only an app that knows the birthday can. It is an
  edge, not a moat. The moat, if one comes, is the reminder loop.
- The events are Wikipedia's selection, so they lean the way Wikipedia
  leans: wars, elections, disasters, launches. The `TASTE` correction in the
  fact finder was written because the model did the same thing. For this tab
  the correction is the age ranking rather than a prompt: a nineteen year old
  sees the years they remember first, and the events from those years are
  the ones they lived through.
- The song chart is American. So is the film chart. A reader in Bristol sees
  the American number one. That is the data the app has, and it is labelled
  as Billboard's.
- Nothing here makes the tab a habit. It makes it good on the days somebody
  opens the app, which is the days a friend's birthday brings them in.
