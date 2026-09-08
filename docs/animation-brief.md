# Brief: make it move

Paste this into a fresh session. Everything needed is here.

---

You are adding motion to birthed.app. Read `web/src/render.ts` for the
stylesheet and the markup, and `docs/first-impression-brief.md` sections 4 and
7 for the rules that cannot break. Do not read the whole repo first; the class
names you need are listed below.

## The hard constraints

**No JavaScript at all.** The Content Security Policy is `default-src 'none'`.
Everything is CSS. No libraries, no CDN, nothing loaded from another origin.

**The pages are baked.** All 366 are rendered at build time and served off
disk. Anything that must vary per reader comes from one of exactly three
places: `today.css`, which is generated on every request and is the only thing
that knows what day it is; `:target`, which reveals one of several baked
sentences after a form posts; or a per request `<style>` block the server
appends, which is how a reader's own answers are marked (see `myMarks` in
`serve.ts`).

**Every animation is inside `@media (prefers-reduced-motion: no-preference)`,**
and the page must be correct and complete with all of it switched off. That is
not a nicety here, it is how the existing three already work.

## Use the vocabulary that exists, do not start a second one

There are already three keyframes in `render.ts` and they are good. Extend
them before inventing anything.

- `burn` — the fuse under the state line. A 259200 second (72 hour) linear
  animation with a negative delay set from the real clock by `today.css`, so
  the bar is genuinely at the right point the instant the page loads. This is
  the best thing on the site and the model for everything else: it moves
  because it is carrying information, not because motion is nice.
- `rise` — a 460ms entrance on `cubic-bezier(0.22, 0.61, 0.36, 1)`, staggered
  by `calc(var(--i) * 45ms)`. Already on `ol.covers li` and `ul.feed li`, where
  the build writes `style="--i:0"` on the first six or twelve.
- `rail` — the people marquee.

**Reuse 460ms, that easing curve, and the 45ms stagger.** A second timing
system is how a site stops feeling like one thing.

## What to animate, in the order I would do it

**1. The answer landing.** The most important one. A reader taps, the page
redirects, and the result and their own mark appear fully formed as if they had
always been there. Nothing acknowledges that a person just did something. Give
`.rres` (the result bars), `.mine` (their own mark, revealed by the server) and
the `.afterword` sentence revealed by `:target` a short arrival: rise plus fade,
staggered, under 500ms total. This is the one motion on the site that a reader
causes rather than watches, and it is the whole reason this brief exists.

**2. The ask card.** `.ask` is revealed by `today.css` on the three open dates
and it is the first thing anybody is asked to do. Its parts can arrive in
order: `.asklab`, `.askyr`, `.askart`, `.asksaid`, then `.rem button`. Small
and quick. The buttons already have a hover state; give them a press.

**3. The state line and the dot.** `.state .dot` is lit blue by `today.css` on
an open date. A slow, quiet pulse would say "this is live right now" without
any number moving. Keep it slow. A fast pulse is an alarm.

**4. The calendar.** `.cal .days a` and `.cell` in the year grid. Today's date
already gets an outline from `today.css`. The grid could arrive in a wave and
hover could lift a cell. This is the most decorative item on the list and the
most fun; do it last and keep it cheap.

**5. The year picker and its replacement.** `.yearask` and `.yearset` swap
based on a cookie, and `:target` brings the picker back. That swap should feel
like a fold rather than a jump cut.

## What must never move

- **Nothing may fake activity.** No counter that ticks up, no row that climbs
  while you watch, nothing that implies people are here right now. The site has
  22 answers. A moving number would be a lie and it is also forbidden outright.
- **Nothing that reads as a direction.** No row rising above another under its
  own steam. This site carries the September 11 attacks, the 1973 Chile coup
  and the Birmingham church bombing, and anything that looks like a score
  moving is a brigading target and worse than no motion.
- **A heavy row does not get a flourish.** `mayLeadWords` in `highlight.ts` is
  the existing screen for this. Whatever you do to a row, check what it looks
  like on a row about a massacre. If it would be tasteless there, it is
  tasteless.
- **Do not animate the fuse differently.** It is telling the truth about a
  clock and it is already right.

## The bar

Every animation has to answer: what does this tell the reader that the static
page does not? Arriving, changing state, and confirming something a person did
are all real answers. "It looks nice" is not, on a site whose credibility comes
from restraint and which has twice been called a database with a nice skin.

If you are unsure about one, leave it out. The page with three good motions
beats the page with eleven.

## One thing to design and not build

When a date seals, its rows rearrange into the order its own people remembered
them. That is the entire thesis of this project happening in one movement and
it is currently invisible: it happens between two builds, so nothing tells a
reader anything moved.

It is buildable without JavaScript, because the build knows both the
chronological order and the remembered one and can emit a per row keyframe with
the exact distance each row travels. Write down how you would do it. Do not
build it yet: the first date seals tonight with three answers from one person,
so there is nothing yet for it to reveal.

## Verify by rendering

`npm test` in `web/`, and look at a real page at 375 wide. Every animation off
under reduced motion, and the page still correct. Commit each one on its own
with the trailer from `docs/handoff.md`. No em dashes.
