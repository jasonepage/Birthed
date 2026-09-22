# The seal, as a movement. Designed, not built.

Written 9 September 2026, with the motion work. `notes/animation-brief.md`
asked for this to be designed and left unbuilt, because the first date seals
tonight with three answers from one person and there is nothing yet to show.

## What it is

When a date seals, its rows leave the order they happened in and take the
order its own people remembered them in. That is the whole thesis of the site
in one movement, and today it is invisible: it happens between two builds and
a reader who comes back sees a page that is simply different.

The movement is: the feed is drawn in the old order, and each row travels to
its new place. Rows that were remembered rise. Rows nobody remembered sink.
Rows nobody answered do not move relative to each other. It plays once, on
the first visit after the seal, and never again for that reader.

## Why it is buildable with no script

The build knows both orders. `buildTimeline` gives the chronological order
and `byMemory` in `timeline.ts` gives the remembered one, and the build calls
both for a sealed date. So the build can compute, for every row, how many
rows it moved and which way, and write that as one number on the row:

```
<li class="lead sealedlead" style="--i:0;--from:4">
```

where `--from` is the row's old index minus its new index. A row that rose
four places has `--from: 4`. A row that sank two has `--from: -2`. A row that
stayed has no variable and the default of zero means it does not move.

The distance in pixels is the problem, because rows are not the same height.
Two honest options.

**Option A, uniform rows.** During the movement every row is drawn at one
fixed height, `--rowh`, say 96 pixels on a phone, clamped text, and the
movement is one keyframe for all rows:

```
@keyframes settle {
  from { transform: translateY(calc(var(--from, 0) * var(--rowh))); }
  to   { transform: none; }
}
```

The row starts displaced by exactly the distance it travelled and settles to
where it is. One keyframe, one variable per row, and the distance is exact
because every row is the same height while it moves. After the animation the
clamp is released and rows take their real height. That release is a jump
cut, so it should be the last frame, under the row content, not a second
motion.

**Option B, measured rows.** The build knows the text of every row and could
estimate heights, but an estimate that is wrong by a line makes a row land
short and then snap, which reads as a bug. Do not do this. Option A is worse
looking for a hundred milliseconds and honest for the whole second.

## Timing

The same system as everything else: `cubic-bezier(0.22, 0.61, 0.36, 1)`, the
45 millisecond stagger, and 460 milliseconds for a one place move. A row
that travels further should take longer, or it arrives at the same instant as
a row that moved one place and the eye reads no distance. So

```
animation-duration: calc(460ms + abs(var(--from, 0)) * 90ms);
```

capped by construction, since a page has at most six rows in the feed and
the drawer is not animated. `abs()` is in every current engine; where it is
not, the fallback is the still page, which is the page the reader has today.

## Where it plays and where it does not

It plays only on the first visit after the seal. There is no script and no
storage on the reader's side, so "first visit" has to come from the server:
the request after the seal that carries a token which answered this date. The
server already writes a per-reader style block (`myMarks` in `serve.ts`).
That block can carry one more rule, `.feed{--settle:1}`, and the animation is
written so it only runs when `--settle` is set:

```
@media (prefers-reduced-motion: no-preference) {
  .feed[style*="--settle"] li { animation: settle ... }
}
```

A reader who did not answer this date sees the sealed order as the still page
it is. They did not watch it happen, so nothing pretends they did. A reader
who did answer sees the thing they took part in resolve, once. The server
knows which by the token, and it knows "once" by a second column on the
edition, or by a cookie the redirect sets, whichever is cheaper. The cookie
is cheaper.

## What must not move

- **No counts in motion.** The `.tally` line under a sealed row is written
  in words and it appears with the row. It does not count up.
- **No heavy row rising with a flourish.** A row that fails `mayLeadWords` in
  `highlight.ts` moves with the same easing as every other row, and gets no
  highlight, no glow and no pause at the top. If the row that its people
  remembered most is a massacre, it rises at the same speed as a song would,
  and the page treats it as what it is: the thing that stuck.
- **No row climbs while you watch.** The movement is between two fixed orders
  the build already decided. Nothing is live, nothing is polling, and the
  page a second reader sees is the same page.
- **Nothing implies direction.** A row that sinks is a row that was not
  remembered, not a row that was voted down. The easing is the same both
  ways and there is no colour for either.

## What to build first, when there is something to show

1. `--from` on each sealed row, from the build. That is ten lines in
   `feedSection` and it is inert until a stylesheet reads it.
2. The keyframe and the uniform-height clamp, gated on `--settle`.
3. The server rule, in `myMarks`, for a token that answered a sealed date on
   its first visit after the seal.
4. A test that walks the sheet and finds `settle` inside the motion block
   and nowhere else, using the same walker the motion test uses.

Then look at it on a real sealed date with real answers from more than one
person, at 375 wide, and decide whether it is the thesis in one movement or
a page that wobbles. If it wobbles, it is a page that wobbles, and the still
page is fine.
