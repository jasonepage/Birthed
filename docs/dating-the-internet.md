# Dating the internet

How Birthed gets dates for things that have no authoritative date, and why the
mechanic is a guess rather than a vote.

Read `docs/internet-culture.md` first. That document decides what a row is and
what it may claim. This one decides where the dates come from.

---

## 1. The one sentence

Nobody can tell you when a meme was posted, but the people who were there are
the only thing on earth that can tell you when it spread, so stop asking them
to check a date and start asking them to guess it.

---

## 2. What is actually scarce

Not facts. Facts are cheap and there are two piles of them already.

Wikidata holds the publication date of every notable film, game and album, and
importing them produces an encyclopedia in a different costume. That was tried
on September 7 and eleven of the twelve rows it returned for that date were
films, dated to festival premieres: Memento on the day it showed at Venice,
eight months before anybody in America could buy a ticket.

What is scarce is a **checked date for something with no authority**. When the
dress was, when Vine actually shut down, the week the Harlem Shake stopped
being a thing three people had seen. Those answers are scattered across Know
Your Meme, deleted accounts and Reddit threads, and none of it is indexed by
date. That index does not exist. That is the whole opportunity and it is also
exactly why it does not exist yet: it is slow, and it cannot be scraped.

---

## 3. Three tiers, three different producers

| Tier | Who makes it | What it is worth |
|---|---|---|
| Proposed | A model, with a citation | Cheap, high volume, not trusted |
| Checked | A machine, from the artifact | Exact, and the reason any of this is credible |
| Dated by readers | The crowd, as a distribution | The only evidence that exists for most of it |

**Proposed** already exists. The fact finder searches, cites a page, and the
row survives only if that page says what the row says.

**Checked** does not exist yet and is the piece that matters. It means the date
comes off the artifact rather than out of prose about the artifact. A YouTube
video carries its upload timestamp in the interface. A tweet carries its own. A
dead page carries a first capture date in the Wayback Machine. No model asserts
anything at this tier, which is the point: a model that is asked for a date
will produce one whether or not it knows.

**Dated by readers** is section 4 and is the new thing.

---

## 4. The mechanic: guess, do not confirm

The obvious design is a thumbs up under every row. It is what everybody builds
and it is wrong here for three reasons.

It is boring, so almost nobody taps it. It is anchored, because showing
somebody a date and asking whether it is right gets a yes from most people who
have no idea. And it is thin: a yes and a no cannot tell you what the date
actually was, only that somebody objected.

So the question is not "is this right". The question is:

> **When do you think this happened?**

The reader picks a year, or a season and a year, before being shown the answer.
Then they see how close they were, and where their guess sits against everybody
else's.

This is better on every axis at once.

**It is a game.** Guessing with a score is a thing people do for fun.
Confirming is a chore people do as a favour.

**It is unanchored.** A guess made before seeing the answer is evidence. A
confirmation made after seeing it is mostly an echo.

**It is a distribution, not a tally.** Five hundred guesses give a shape: where
the mass sits, how wide it is, whether there are two clusters. A tally of yes
and no gives a number that cannot locate anything.

**It exposes a wrong proposal without anybody reporting it.** If the crowd
clusters tightly eleven months away from the date on the row, the row is wrong
and the data says so with no report, no moderation queue and no argument.

**It has no submission surface.** Nobody types anything. There is nothing to
spam, nothing to moderate, and no way to inject a slur into the database, which
is the failure mode of every open contribution system run by one person.

**It is shareable in the way that actually works.** "I got the Harlem Shake
within eleven days" is a thing somebody sends to a friend. "I confirmed a date"
is not.

---

## 5. What the crowd is measuring, and it is not what you think

This is the most important section and it is the one that would be easiest to
get wrong.

A crowd cannot tell you when something was posted. Memory does not work that
way. People remember when *they* encountered a thing, which is later than its
origin, and compresses toward the present the further back it goes. Five
hundred guesses about the Harlem Shake will centre on when it reached ordinary
people, not on the day the first video went up.

That is not a flaw to correct. It is a second measurement, of a different
thing, that no source anywhere records.

`docs/internet-culture.md` already has the vocabulary for it and calls the
qualifier the interesting part rather than a hedge:

- **posted** is exact and comes from the artifact. Tier two.
- **went viral** is a spread, and until now the honest answer was a shrug or a
  Know Your Meme approximation. Tier three measures it.

So the two tiers do not compete and the crowd never overrules the machine. A
row can carry both, and the pair is a better sentence than either:

> Posted 2 February 2013. Most people met it that March.

Nothing else on the internet can print the second half of that.

---

## 6. Weighting, with one extra tap

After guessing, one optional question: **were you there?**

That splits every distribution in two. People who say they were there are
measuring memory. People who say they were not are measuring inference, which
is a different and much weaker signal, and mixing them silently would blur the
one number worth having.

It is also the flex that makes the first tap worth making. "I was there" is an
identity claim, and identity claims are the reason people engage with this
material at all.

Never gate anything on the answer, and never show it back as a badge or a
score. It is a weight in a calculation, not a status, and the moment it becomes
a status people start lying to earn it.

---

## 7. Where this lives

**The iOS app, not the website.**

birthed.app sends `default-src 'none'` and runs no script on any page but one.
That is the strongest claim on the privacy page, it is checkable in five
seconds, and it is what answers the accusation the Reddit launch drew. A
guessing game needs a script and a place to keep a score, so putting it on the
web would cost the one thing the web version has.

The app already has what this needs: a silent anonymous account on first
launch, so there is a stable identity for a guess with no sign up, no email and
no name.

The website still shows the result. A finished row with a crowd date on it is
just a row, and rows are static.

---

## 8. The cold start, honestly

There are no users, so tier three produces nothing on day one. Anybody who
tells you a crowd mechanic bootstraps itself is selling something.

Which means tier two has to carry the product alone at the start, and the
question is what seeds it. The answer is the canonical viral videos: a few
hundred of them, everybody knows them, and every one carries an exact upload
timestamp in the YouTube interface. That is a seed that is neither hand written
nor scraped out of an encyclopedia, and it is enough to have something to guess
at on the day the first hundred people arrive.

The order is therefore: seed from timestamps, ship the guess, and let tier
three fill in behind it over months. Not the other way around.

---

## 9. Abuse, in the two places it can happen

**Ballot stuffing.** `rpc_throttle` and `rate_limit_ok` already exist and
already protect `leave_birthday` and `record_fact_events` per calling network
address. A guess goes through the same door. One guess per account per row, and
the row's distribution is a median rather than a mean, so a run of identical
extreme guesses moves it very little.

**The other one is not abuse and is worse.** A row proposed with a wrong date
teaches the crowd the wrong answer if the date is shown first. So the guess is
always taken before the answer is revealed, on every row, forever. That is not
a nicety of game design, it is the thing that keeps the data worth having.

---

## 10. What not to build

No leaderboard. It selects for people who play a lot rather than people who
were there, and those are different populations with different memories.

No streaks that punish. A guessing game about your own childhood should not
make anybody feel they owe it a visit.

No public profiles, no follower counts, no comments under rows. Comments are a
moderation queue, and there is one person here.

No accuracy score shown next to somebody's name. The moment being right is a
status, guessing stops being honest.

---

## 11. Honest limits

**The crowd date is a perception and must always be printed as one.** "Most
people met it that March" is honest. "It went viral in March" is a claim the
data does not support, because the sample is whoever uses this app, which is
not a sample of anybody.

**Sample sizes will be tiny for a long time.** A distribution over nine guesses
is not a distribution. There has to be a floor below which nothing is shown at
all, in the same shape as the 5,000 impression floor already used before reader
preference is allowed to steer anything.

**Recall is skewed young.** The people most likely to use this are the people
who were online after about 2010, so rows from the 1990s will get thin and
unreliable crowds for years, if ever.

**Nobody knows if this is fun.** It reads as fun. So did the milestone stacking
in `docs/milestones.md`, until it was computed and turned out to fire for 1.4%
of people. Section 12 exists because of that.

---

## 12. The test, before any code

Same shape as the milestone test, which cost twenty minutes and took a feature
apart before it was built.

Pick ten internet moments across 2007 to 2022. Find each one's exact date from
its artifact, so there is a right answer. Then ask ten people, in a group chat,
to guess each date before seeing it.

Three things come out of that and all three are decisions:

1. How wide is a real crowd? If ten people spread over four years, the median
   is not measuring anything and the whole tier is decoration.
2. Is the skew real and which way? If guesses land systematically later than
   the posting date, section 5 is right and "when it spread" is a product. If
   they scatter, it is not.
3. Did anybody enjoy it? Ask. If nobody asks for another round, the mechanic is
   not fun and no amount of scoring will fix that.

Do not write the table, the endpoint or the screen until those ten guesses
exist on paper.
