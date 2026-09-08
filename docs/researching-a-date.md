# Researching a date

How to find what actually mattered on one date, why the obvious method fails,
and what a run costs. Written 8 September 2026 after doing September 8 by hand.

Read `docs/internet-culture.md` first. That says what a row may be. This says
how to go and find one.

---

## 1. Two ways to research, and only one of them works

Nathan proposed both. They are not equal and the difference is worth writing
down before anybody spends money on the wrong one.

**Today's news.** Search what happened today and file the good parts. Tried on
8 September 2026. Everything that came back was a release calendar: a week of
game releases, a Gamescom recap, a State of Play recap, a PC Gamer list of
September release dates. Not one of those clears the ten year rule, which asks
whether a row would still earn its place on this page in ten years. Most of any
given day's news is a schedule, and a schedule is exactly the filler this site
exists to replace.

That does not make today worthless. It means the yield is low and the run has
to be cheap, so it belongs in a nightly job that proposes one or two rows and
usually proposes none, not in a research session.

**The same date across past years.** Tried on the same afternoon and it
produced three rows worth having in about twenty minutes. Ten to twenty years
back is where the memory is, because a thing that is still being talked about
years later has already passed the test the ten year rule is trying to apply.

**Do the second one. The first one is a cron job, not a method.**

## 2. The mistake that wastes the first ten minutes

Searching the date. "September 8 internet history", "September 8 viral moment",
"September 8 memes". Every one of those returns a listicle about memes in
general, because no page on the web is organised the way this site is. That is
the whole reason the site is worth building and it is also why searching by
date finds nothing.

**Search the memory, then check the date.** Think of things people bring up
unprompted, guess which might land on this date, and verify each one. It feels
backwards and it is the only thing that works.

Worked example, September 8, in the order it happened:

1. *Guess:* United Airlines and the old bankruptcy story. *Search:* "United
   Airlines 2008 bankruptcy Google News old article stock crash". *Result:* a
   Forbes piece dated 8 September 2008 and a Register piece dated the 10th,
   agreeing on every number. **Kept.**
2. *Guess:* the Queen died on this date. *Search:* confirmed, 8 September 2022.
   **Kept, and flagged, see section 4.**
3. *Guess:* Star Trek first aired on this date, so did Google ever make a
   doodle of it. *Search:* an interactive doodle ran 8 September 2012 for the
   forty sixth anniversary. **Kept**, and it is a better row than the 1966
   broadcast because the doodle is a thing people did rather than watched.
4. *Guess:* the Ray Rice elevator video. *Search:* TMZ published it 8 September
   2014. **Left out on purpose, see section 4.**

Four guesses, three rows. That ratio is what to expect.

## 3. Two sources or it does not go in

`docs/internet-culture.md` sets the sourcing order. In practice the rule that
does the work is this: **the date has to come from a page published within days
of it, and a second page has to agree.** The Forbes piece is dated the 8th and
the Register piece is dated the 10th, and both give the same fall from twelve
dollars to three. That is a row. One blog post recalling something years later
is not.

A page's own URL is often the best date stamp on it. `/2008/09/08/` in a Forbes
address is a stronger claim than any sentence in the article, which is exactly
the failure the United story itself is about.

## 4. What to leave out, and why that is a judgement

Two heavy rows landed on this date and they are not the same.

**Queen Elizabeth II, filed as a candidate.** It is the biggest shared moment
of that decade, it is dated to the hour, and the word screens already stop it
leading a card, which is the protection that matters. It goes in the queue and
a person decides. That is what the queue is for.

**The Ray Rice elevator video, not filed at all.** Also dated, also sourced,
also a genuine turning point in how a tabloid site could force a league's hand.
It is footage of a man knocking a woman unconscious, and a page whose job is to
ask somebody what they remember of their birthday does not need it. Nobody has
to argue that one at two in the morning, so it is written down here instead.

The general rule: a death that a whole country watched is a shared memory. A
recording of violence against a named private person is not the same thing, and
"it is sourced and it is dated" does not settle it.

## 5. What one date costs

Doing September 8 by hand: about twenty minutes, six searches, three page
fetches, three rows. No model spend, because the searching was the thinking.

The generator, from `culture_search_runs`: three to nine searches a date, three
to six rows written, at roughly 1.3 cents a search. Call it eight cents and
four rows a date, so filling the 354 dates with no curated row is around thirty
dollars and about 1,400 rows to review.

Those two methods are not competing. The generator is how the calendar gets
covered. Doing it by hand is how a date that matters gets done properly. Use
the generator for the year and do it by hand for the dates people will actually
land on.

## 6. What went into the queue for September 8

Three candidates, nothing published, drafted by a model and waiting on a
person. `vibe_model` on each says so.

| Year | Row | Why it is here |
|---|---|---|
| 2008 | Google News dated a 2002 story as that morning | An algorithm mis-dated an old article and took 75 percent off a company before lunch. Two sources agreeing, and the site's own subject. |
| 2012 | The Star Trek doodle was playable | A thing people played at work, not a broadcast they watched. Dated by Google's own archive. |
| 2022 | Queen Elizabeth II died | The biggest shared afternoon of the decade. Heavy, screened out of the card automatically, and a person still has to say yes. |

Before this, September 8 had sixteen culture rows and eleven of them were the
words "is released" after a game's name.
