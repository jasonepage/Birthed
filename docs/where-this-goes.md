# Where this goes

An honest read of the project on 8 September 2026, written at the end of a long
night of work, by somebody who has now read most of the code and all of the
docs and looked at every number in the database.

It is not an encouraging document. It is meant to be a useful one.

---

## 1. What is actually true today

- **The thesis is real.** "Wikipedia records what happened, Birthed records what
  stuck" is a genuinely new idea. Nobody is measuring transmission. That
  sentence is worth more than everything built around it.
- **The measurement does not exist yet.** There are 22 answers in the entire
  database and three of them were the developer's. The thing the site is for
  has not happened once.
- **One month of twelve has content.** 333 of 345 published culture rows are
  September. 354 dates have never had a generator pointed at them.
- **Nobody is here.** Zero users is not a stage, it is the whole situation, and
  every design decision in this project has been made without a single stranger
  ever having used it.
- **The craft is exceptional.** The documentation is better than most funded
  companies produce. The code is careful. The rules are argued rather than
  asserted.

That last one is a warning, not a compliment. Read on.

## 2. The uncomfortable part

**The quality of the engineering is where the energy is going, and engineering
is not the bottleneck.**

One night of work fixed a card that never rotated, a privacy claim that was
false, plurals missing from a word screen, a feed sorted the wrong way, and a
release-calendar dump that was 92 percent of the culture content. Every one of
those was a real defect and worth fixing. Not one of them brings a single
person to the site.

A project with beautiful internals and no users is a project that has been
choosing the comfortable problem. The comfortable problem here is craft, and it
is comfortable precisely because it is the one the builder is best at.

**The second uncomfortable thing: the payoff is twelve months away.** Everything
that makes this project different from a poll arrives in September 2027, when a
date takes a second set of answers and the difference between them is a
measurement of forgetting. That is the good idea. It is also a twelve month gap
with no reward, and most projects die in that gap.

**The third: the core loop has not been shown to be fun.** The one person who
has used it in anger said answering felt like less than placing a pixel. That
is the most important piece of feedback the project has received and it is a
sample of one. Nobody knows whether "do you remember this" is a thing a stranger
wants to do ten times, because no stranger has done it.

## 3. The structural problem, named plainly

**One person in 366 has their birthday today.** The site's natural audience
arrives one day a year and there is no reason for them to come back for 364.

That is not a marketing problem to be solved with better copy. It is the shape
of the thing. Every consumer product that has beaten this shape did it the same
way: it stopped being a place you visit and became a thing that arrives.

Which means the notification in the app is not a feature on a list. It is the
distribution channel, and it is the only one this project has that is not
somebody else's platform. `docs/opus-worklist.md` item 8 says exactly this and
calls it the most important item in the file. It is still not built.

## 4. Four honest futures

**A. The annual ritual.** Lean all the way into the seal. This is not a website,
it is a thing that happens on your birthday, once, and then closes. Rituals
distribute because they have a deadline and a next time. The whole site becomes
a landing page for one day a year. Smallest, most defensible, least like
everything else.

**B. The tool that arrives.** The app, the birthday, the notification, the
three day window. Retention is solved by the calendar rather than by habit. This
is the version most likely to have real users in a year, and it makes the
website the marketing rather than the product.

**C. The source.** A date indexed, sourced timeline of internet culture does not
exist anywhere. `docs/internet-culture.md` already knows this and says so. That
is a reference other people would link to, cite and build on, and it is valuable
whether or not anybody ever answers a single question. It is also a completely
different product from the memory game, run by an editor rather than a crowd,
and it is the one with the clearest path to being genuinely useful to strangers.

**D. Park it.** It costs money, it makes none, and it is one person's evenings.
That is a legitimate answer and it should be said out loud rather than being the
thing that happens by accident over six quiet months.

These are not exclusive, but **B and C pull in different directions and the
project cannot do both well right now.** B is a consumer app with a retention
loop. C is a reference work with an editorial standard. Choosing is the strategic
act. Not choosing is what the last three months have been.

## 5. What is next, if it is one thing

**Get a hundred real answers on one date.**

Not 366 dates of content. Not a better card. Not more rows. One date, one
hundred strangers, and then look at what they did.

Everything downstream needs answers and does not work without them. The seal has
nothing to seal. The reorder has nothing to reorder. The year two measurement
has no year one. The reader signal that is supposed to steer the prompt has a
floor of 5,000 impressions and sits at 22 answers. Every clever thing in this
codebase is waiting on a number that has not moved.

A hundred answers also settles the question nobody can settle by thinking: is
the loop any good. If a hundred people each answer two rows and leave, the
mechanic is wrong and it is better to know that in September 2026 than in
September 2027. If a hundred people spend their ten, there is a product here.

**September 7 seals tomorrow night with almost nothing on it. That is the first
real test and it is being allowed to happen quietly.**

## 6. The asset that is being undervalued

The best thing produced tonight was not code. It was finding that on 8 September
2008 a six year old bankruptcy story reappeared undated, Google News stamped it
as that morning, and United Airlines lost three quarters of its value before
lunch.

That is a post. It is specific, checkable, weird, and it is exactly the kind of
thing that gets read and shared. The research is the strongest asset this
project has and it is currently being used only as row 14 of a page nobody
visits.

There are 366 of those waiting to be found and each one is a reason for somebody
to arrive.

## 7. What not to do

- **Do not generate 1,400 more rows before anybody has answered 100 questions.**
  It is thirty dollars and four hours of review spent making a page nobody reads
  slightly longer.
- **Do not redesign the first screen again.** It has been redesigned twice in
  two days by two different sessions and no stranger has seen either version.
- **Do not add a score.** It is the one thing that would make this the same as
  everything else, and the pressure to add it will come back every time growth
  is slow.
- **Do not post to Reddit until the privacy page and the footer have been read
  by somebody who is looking for a reason to disbelieve them.** That was the
  last launch and it is now fixed, which means the next launch spends its one
  first impression on the mechanic instead of on a cookie.

## 8. The one sentence

The idea is good, the craft is ahead of the evidence, and the next honest move
is to find out whether a stranger enjoys this before building another thing for
them.
