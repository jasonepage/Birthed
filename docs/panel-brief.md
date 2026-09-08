# Brief: the curation panel

Paste into a fresh session. Everything needed is here.

Read `docs/curation-panel.md` for what the panel is for and what it must never
become, `docs/scan-a-day.md` for the scan contract and its prompt, and
`docs/internet-culture.md` for what a row may claim. The panel is
`web/src/admin.ts`, one file, no client library, plain fetch.

---

## The one rule everything else hangs off

**A model proposes. A person presses a key. Nothing else writes to a page.**

Every feature below is the same shape: something is suggested, it lands
somewhere a curator can see it, and it stays inert until somebody agrees. The
tables for this already exist and already work this way:

- `cultural_events.status` — candidate, published, rejected
- `birth_facts.verified` and `reviewed_at` — on the page, and whether a person
  decided
- `day_scans` — verdicts about existing rows, with `agreed` recording whether
  the curator overruled the model
- `lead_lines` — a written sentence for a timeline row
- `selected_anniversaries` — Wikipedia's own pick of each day's biggest

Keep the overruled verdicts. A model that loses most of its arguments has a bad
prompt, and that is invisible unless the disagreements are written down.

## What is missing, in the order it hurts

### 1. Write a sentence, with a draft to argue with

A row marked "needs a sentence" is one line away from being on the page and
there is no way to write that line without leaving the panel.

Build: a **Draft** button on any row with no sentence. It calls an edge
function that returns **two or three candidate sentences**, not one, plus the
source text it drew from. The curator picks one, edits it in place, and presses
a key. Nothing saves until they do.

Two or three rather than one on purpose. One suggestion is a thing you accept
or reject; three is a thing you choose between, and choosing is faster and
better than judging. The same trick is why the queue shows the rest of a date
underneath the row being reviewed.

The voice is in `docs/lead-lines.md`. Name the thing, say what happened, stop.
The sentence must stand alone, because the page prints it and never prints the
title.

**Two fields, one job, and this is a trap.** A culture row's sentence is
`cultural_events.context_string`. A timeline row's is `lead_lines.line`. They
do the same thing for different tables. The panel should show one control and
work out which table it is writing to.

### 2. Scan a day

Fully specified in `docs/scan-a-day.md`, including the prompt. The table and
the panel display are built and September 8 is scanned by hand as a worked
example. What is missing is the edge function and the button.

Contract: POST `{ month, day }`, service role, `verify_jwt` on, `is_admin()`
checked. Loads the date's published culture rows, verified facts and
unsuppressed Wikipedia lines. Sends the prompt. Writes one `day_scans` row per
verdict. **Writes nothing anywhere else, ever.**

### 3. Propose new rows, aimed

`find-culture` exists and the panel already has a focus box that steers it. Two
things it lacks: the proposals come back into a queue rather than onto the date
you were looking at, and there is no way to aim it at a person.

Add presets that are aimed at a reader rather than at a category. "Things
somebody who was twelve in 2009 would recognise." "The thing that broke
containment on this date, not the thing that was announced." Read
`docs/researching-a-date.md` first: searching a date finds nothing, and the
method that works is to search a memory and then check the date. The prompt
should say so.

### 4. The score, which is the interesting one

## A points system, done the way osu! does it

The useful part of osu! performance points is not the number. It is four
properties, and all four transfer.

**One. Computed from stored inputs, never hand set.** Every component is a
column or a count. Nobody types a score. When the formula changes, everything
recomputes and that is normal rather than a crisis.

**Two. Comparable across objects.** A row on September 8 and a row on March 2
are scored the same way, so dates can be ranked against each other.

**Three. The top few dominate.** osu! weights your best play at 100 percent,
your next at 95, then 90.25, and so on. Spamming easy maps gets you nothing.
**This is the property that matters most here** and it is the answer to "which
of 366 dates do I work on next": a date's score is the decayed sum of its rows,
so a date with three excellent rows outranks one with forty mediocre ones, and
adding a fifth dull row to a date moves it almost not at all. Fixing the top row
moves it a lot.

**Four. It ranks, it does not judge.** A pp number says where a play sits, not
whether the map was good.

### What goes into a row's weight

Each component is measurable and each is worth points. Suggested weights;
argue with them, but keep every one of them checkable.

| Component | Up to | Where it comes from |
|---|---|---|
| Wikipedia's editors selected it | 40 | `selected_anniversaries`, already imported |
| Reach | 30 | Wikipedia pageviews of the cited article, log scaled. Free API, no key |
| Living memory | 20 | A curve on the year, peaking roughly 1985 to 2015 |
| Somebody wrote it | 10 | A real sentence, not a bare title |
| Sourcing | 10 | Primary or archive 10, news within days 7, encyclopedia 4, circa 0 |

Subtract for the failures the flags already catch: release calendar shape,
explains the joke, thin. Those are in `admin.ts` as `flagsFor` and
`factFlagsFor`.

**Reach is the component to get right.** Pageviews on the article a row cites
are the closest thing to an objective measure of whether anybody cares about
the thing, they are free, and they are the same measurement for a game as for a
coronation. It is osu!'s star rating: a property of the object, not an opinion
about it.

### The rule that keeps this honest

**A reader answer replaces the estimate. It does not average with it.**

The whole score is a guess standing in for a measurement this site is built to
collect. The moment a row has real answers, the guess has been superseded and
must get out of the way. A row that forty of fifty people remembered has a
value; nothing a model estimated about it is still interesting.

Write that into the function, not just the comment. It is the difference
between a scoring system and a scoring system that quietly starts believing
itself.

### Show the parts, not just the total

A number a curator cannot take apart is a number they have to trust. Every
score in the panel breaks out: selected 40, reach 12, living memory 20, written
0, sourcing 7, thin minus 15. Then a curator disagrees with **reach**, which is
a conversation, instead of disagreeing with **58**, which is not.

### Where it may never appear

**Not on a public page. Not in an API a reader can reach. Not in the share
card.** This site carries the September 11 attacks, the 1973 Chile coup and the
Birmingham church bombing. A number rating any of them, whoever computed it, is
indefensible the moment somebody screenshots it, and it is a brigading target
the moment anybody can move it.

The public site has exactly one number and it is a count of what people said:
"eleven of the fourteen people who answered this remembered it", on sealed
dates, above a floor of ten answers. That is a fact about a room. A score is an
opinion wearing a number. Do not confuse them and do not let this one leak.

## What the panel should feel like when you are done

Click a date. One screen. Everything on that date, ranked, with what is wrong
with each row named in a sentence and scored in parts. Four buttons: draft a
sentence, scan the day, propose new rows, and a keyboard path through all of it
that never needs the trackpad. A curator who has to reach for a mouse between
decisions does about thirty an hour. One who does not does several hundred.

And a list at the top of the weakest dates by decayed score, so the answer to
"what do I do tonight" is on the screen instead of in somebody's head.

## Verify by rendering

`npm test` in `web/`. The panel is a scripted page: after any change, render it
and parse the script, because a syntax error there is a blank screen and the
tests do not run it.

```
node --input-type=module -e "
const m = await import('./dist/src/admin.js');
const h = m.renderAdmin({url:'https://x.supabase.co', key:'k'});
const s = h.slice(h.indexOf('<script>')+8, h.lastIndexOf('</script>'));
new Function(s); console.log('parses', s.length);
"
```

Commit each piece on its own with the trailer from `docs/handoff.md`. No em
dashes.
