# The pixel problem

Written 8 September 2026, after ten answers on September 8 produced the
sentence "That is your ten for this date" and the reaction: I felt like I did
less than place a pixel.

That reaction is the most useful thing anybody has said about this site and it
names a real hole. This is what the hole is and the three things that fill it.

---

## 1. What r/place actually did, mechanically

Not "it was collaborative". Three specific things, in order of how much they
mattered:

1. **You saw your own mark appear.** Instantly, in your colour, at coordinates
   you chose. You could point at it.
2. **It was still there when you came back.** Or it was not, and that was the
   drama.
3. **Everyone was on the same canvas at the same time.**

Birthed has none of the three today.

You answer ten rows. The page says a sentence back and then looks exactly as it
did before. You come back tomorrow and there is no trace you were ever there.
What you gave is real and it is invisible, and it stays invisible for a year.

**The seal is a beautiful idea with a twelve month feedback loop.** No product
survives a twelve month feedback loop at zero users, and the answer is not to
weaken the seal. It is to give the reader something back today that is honestly
theirs.

## 2. Fix one: your own answers, on the page, when you come back

This is the pixel, and it is the smallest of the three.

The site already knows. A token cookie identifies the browser for a year,
`remembrances` holds every answer against it, and the tally already comes back
on the one request that follows an answer. The only thing missing is that a
reader who returns to a date they answered is shown nothing.

So: on a page view, if the reader carries a token and the date is one they have
answered, mark their rows. Not a score, not a count of other people, not a
league table. Three words on the rows they chose: *you remembered this*.

That is their colour on the grid. It is the truest thing the site can show,
because it is nothing but what they themselves said.

**What it costs.** One database call on a page view, for readers with a token
only. That bends the rule that an ordinary page view calls nothing, and the
rule exists for resilience rather than for purity, so it bends rather than
breaks: if the call fails the page serves exactly as baked and the reader sees
the ordinary page. A Supabase outage still cannot take the site down.

**Why it is first.** It is the only one of the three that needs no new content,
no new moderation and no new risk.

## 3. Fix two: let strangers put something on the page

Right now two people in the world can add a row. Everybody else can only answer
questions about a list somebody else wrote. That is a survey, not a canvas.

The pitch changes completely if a stranger can add the thing they remember:

> Answer what you remember of your birthday.

versus

> Add the thing you remember to your birthday. It opens for three days a year.

The second is a reason to post about it. The first is a reason to close the tab.

**The gate already exists.** `cultural_events` has candidate, published and
rejected, and nothing reaches a page until a curator presses a key. A public
submission lands as a candidate exactly like a generated one, so the worst a
bad actor achieves is a row in a queue that a person then rejects, and the
rejection is kept the way every rejection is kept.

**What it needs that does not exist:** a rate limit that survives somebody
deciding to be a problem, a way to submit without an account that is not also a
way to flood, and a plain answer to what happens to a submission, on the form,
before anybody types. The token cookie and the ten answer budget are the shape
of the answer.

**The thing to decide first, and it is not technical:** whether a submission is
signed. r/place pixels were anonymous and the canvas was the only credit.
Anonymous is the right default here for the same reason the answers are, and it
means nobody can ever point at a row and say that is mine, which costs some of
the pixel feeling back. Anonymous, and the reward is that the row is on the
page. That is the trade and it is the honest one.

## 4. Fix three: the canvas everyone is on, and why it is dangerous

The third r/place property is that everybody was on one canvas at one time.
Birthed's version already exists and is not being used: **today's date is where
everybody is today.** One in 366 people has their birthday today and the front
door already serves today's page.

The tempting version of this breaks the site. A live count of people here now,
a row climbing while you watch, anything that ticks. `docs/first-impression-brief.md`
forbids all of it, and it is right: a number that moves is a direction, a
direction is a weapon, and this site carries September 11.

The version that does not break it is quieter. The date shuts tomorrow night
and then it is fixed for a year, and that deadline is the shared moment. The
fuse under the state line is already the only honest live thing on the page.
Everything else about today should come from the seal, the morning after, when
the page has visibly rearranged and can say so.

**So: do not build a live canvas. Build the morning after.** A sealed date is
the artifact worth passing around and it does not exist yet: no share card, no
"here is what this date turned out to be", nothing. `docs/opus-worklist.md`
item 9 says the same thing and it is still true.

## 5. The order

1. **Your own answers, visible.** Small, no new risk, fixes the exact thing that
   prompted this document.
2. **The sealed page as an artifact.** Nothing to moderate, and it is the thing
   people would post. September 7 is the first date that will ever seal.
3. **Public submission.** The biggest change to what this site is, and the one
   that needs the abuse thinking done before a line is written.

Generating more rows is not on this list. There are 354 dates with nothing on
them and that is a real problem, but it is not this problem: a page with forty
good rows that still gives you nothing back is the same page as one with four.

## 6. What this does not change

The seal. The three answers. No score, no direction, no leaderboard, no count
on the first screen. Every fix above is inside those rules and any version that
needs them relaxed is the wrong version, however good it feels in a mockup.
