# What readers respond to, and what that can honestly change

The app records three things about every fact it shows, and one of them is
allowed to steer the next search. This is what each is, what it is worth, and
where it lies to you.

## The three signals

| | What it is | What it costs the reader | Where it is |
|---|---|---|---|
| Likes | A thumbs up on a fact | One tap | `birth_fact_likes`, one row per account per fact |
| Impressions | The fact was in a list that was drawn | Nothing | `birth_facts.impressions` |
| Share opens | The reader opened the share sheet on that fact | Real effort | `birth_facts.share_opens` |

Impressions exist to be a denominator. Without one, a like is a raw count, and
a mediocre fact shown to fifty people beats a great one shown to five.

## Why likes alone could never do this

Facts are cached per date, per year and per region. A calendar date bucket is
shared by everybody born on that date in any year, roughly one user in 366, so
at ten thousand users that is about twenty seven people per date and the votes
add up slowly but they do add up.

A year specific bucket is shared only by people born on that exact date and
that exact year. For a teens and twenties audience that is maybe fifteen birth
years, so about one user in five thousand five hundred. At ten thousand users
that is under two people per bucket. Nobody is voting. Those lists sit in the
order they were found in and will keep sitting there until the app is roughly
ten times larger.

So the like signal is strongest on the generic facts and absent on the
personal ones, which is backwards from where the value is. That is not a bug to
fix, it is arithmetic, and it is the reason the feedback loop is built at the
category level instead.

## What actually generalises

Not the fact. Nobody born on September 5 cares which September 4 fact won.
What carries from one date to another is the SHAPE: whether "you are older
than Kingdom Hearts" beats "a United Nations summit concluded in Johannesburg".

`fact_category_performance` is that aggregate. It is a rate, not a count, and
it carries priors, so a category with nine impressions and one share cannot
read as a runaway winner. With no data at all every category comes out
identical, which is the correct answer to "what do readers like" before anybody
has read anything.

## What the model is actually told

`readerPreference` in the Edge Function reads that view and, if it clears the
floor, appends one sentence to the research prompt naming the three shapes
readers share most and the two they share least.

That is the whole of it. There is no fine tuning, no model that learns, no
weights anywhere. Calling it learning would make it sound more reliable than
it is. It is a SQL aggregate turned into a line of a prompt, and it is worth
having precisely because it is that simple.

Two guards on it:

- **The floor.** Nothing steers anything until facts have been seen 5,000
  times in total. Below that the numbers are the priors talking.
- **Advice, not a quota.** The line says outright that a real finding of an
  unpopular kind beats a stretched one of a popular kind, and that a date with
  none of the popular kinds should not have them invented. Without that, a
  prompt weighted toward sport eventually produces sport for dates that had
  none.

## Where these numbers lie to you

**Position bias.** The first fact in a section is set at 27 points and the rest
at 19. It will collect likes for being first, not for being better. Nothing
here corrects for that, and it is why the prompt is ranked on share opens
rather than on likes: opening a share sheet takes deliberate effort and is far
less driven by which row happened to be at the top.

**Share opens are not shares.** iOS does not tell an app whether anything was
actually sent. The column is named for what is really observed. Do not report
it as shares anywhere a person will read it.

**Impressions are not eyes.** The section is a plain stack, not a lazy one, so
every fact in a list that was drawn counts as seen even if the reader never
scrolled to it. That is fine for a denominator, because every fact in a given
list gets the same treatment, but it is not a viewability number and must not
be used as one.

**They are inflatable.** `record_fact_events` is callable with the key that
ships inside the app, so anybody who pulls that key can run the counters up.
That is true of every client reported metric. It is acceptable only because
nothing is ever shown to a reader from these numbers and no money is spent on
them. They rank a prompt. If either of those stops being true, this needs a
real events table with per account rate limiting rather than counters.

## Reading it

```sql
select * from fact_category_performance order by shares_per_thousand desc;
```

Before the floor is cleared, expect every row to be identical. That is the
system working.
