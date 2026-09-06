# Brief: redesign the Mine screen

Written September 6, 2026, at the end of a session that trimmed this screen
and then looked at it on a real phone in light mode and found it still flat.

This is a **visual and layout brief only**. Not a feature brief. Nothing below
asks for new data, new sections, or new content. Everything on this screen is
already true, already sourced, and already tested. What it is not is designed.

---

## 1. Read these first, in this order

1. `CLAUDE.md` sections 5, 6 and 10. Section 5 is what is decided and must not
   be reopened. Section 10 is the house rules for anything written.
2. `docs/first-five-minutes.md`, the table under "Every feature, judged", and
   the build order at the foot of it. This screen was cut to five things above
   the fold on September 6 by that table. That cut stands.
3. `Birthed/Features/MyDay/MyDayView.swift`. The whole file. The stage is the
   part above the fold and it is one `VStack` in `stage`.
4. `Birthed/Design/Theme.swift`. The entire colour vocabulary is here and it is
   already richer than this screen uses.

Then ask Jason to build and send a screenshot before changing anything, so you
are looking at the same screen this brief was written about.

---

## 2. What is actually wrong

This is a diagnosis, not a wish list. Each item is visible in a screenshot of
the current build.

**One treatment, repeated six times.** Pink capitals with wide letter spacing,
then a large black serif line, then a grey line. YOUR DAY, NUMBER ONE THE WEEK
YOU WERE BORN, FORTNITE, THE WORLD WHEN YOU ARRIVED, MINECRAFT, IPHONE. Six
pink kickers fit on one screen. A kicker that appears six times is not a
kicker, it is a texture, and it has stopped telling anybody what matters.

**Nothing groups.** In light mode the whole screen is one shade of cream with
black text on it. There are no surfaces, no cards, no dividers above the fold.
So the song, the counters and the Fortnite line are three unrelated things
sitting at the same left margin with air between them, and the reader has to
work out the grouping from the words.

**A dead band in the middle.** Roughly a hundred points of nothing between the
chart attribution line and the "363". It is not breathing room, it is the gap
left when the album and the film were removed and nothing took the space.

**The two numbers tie.** "363 days to go" and "8,768 days old" are rendered
identically, so neither wins, and the second is the more interesting one. The
day count is the one number in the product, per the feature table. It does not
look like it.

**The candle is the worst thing on the screen, and making it whole did not fix
it.** Earlier in the same session it was being sliced through the middle by the
stage's bottom edge, and that was fixed by setting its drop to zero. It is now
uncut and still ugly, which is worth being clear about, because uncut was never
the goal.

What is wrong with it now is placement and rendering, not geometry. It is a
flat purple and white striped cylinder with a hard flat bottom, floating in the
middle of a cream page. It rests on nothing. It casts no shadow. It has no
ground line, no surface, no holder, no plate, nothing that explains why it is
there or what it is standing on. The only depth anywhere near it is a soft pink
blob behind the flame, which on cream reads as a smudge rather than as light.

It is also competing rather than composing. It sits immediately to the right of
the older-than sentence at the same optical weight, so the eye does not know
whether it is illustration or content. `CandleMark` is a good drawing. It is
the same bezier as the app icon and it works on the icon and on the share card,
because both of those are a bounded, coloured field and the candle is the
subject of them. Here it is an unbounded sticker on a page of text.

Any redesign that leaves the candle sitting loose on cream has not addressed
the thing Nathan has now pointed at twice. Either give it a world to be in, or
change what it is on this screen.

**The screen changes language halfway down.** Above the fold is a poster: flush
left, no surfaces, big serif. Below it is a list app: hairline rules, circular
share buttons, source hostnames. They do not look like the same product.

**A real bug: the floating tab bar eats content.** The last section on the
screen runs underneath it and is cut in half. The scroll content has
`.padding(.bottom, 36)` and that is not enough clearance. Fix this whatever
else you do.

---

## 3. What "Roblox developer style" means here, and what it does not

Nathan asked for this screen to be made "100x better, Roblox developer style".
Take the instinct seriously and translate it rather than copying it.

**What is right about the instinct.** Game interface designers are unusually
good at four things this screen is bad at: making the single most important
number unmissable, making objects look like objects, using depth and light so
a flat panel has a front and a back, and making a number feel earned rather
than reported. "8,768 days old" should feel like a stat somebody screenshots.
Right now it reads like a field in a form.

**What would be wrong.** This is a Lifestyle app whose whole differentiator is
that it is calm, sourced, and does not lie to you. Its nearest competitor is
Famous Birthdays. Neon, heavy gradients everywhere, glowing borders on
everything and an animated shimmer would make it look like a different and
cheaper product, and it would fight the app icon, the share cards and the
website, which are all one restrained vocabulary already.

**So the target is:** the same vocabulary, given depth, hierarchy and one hero.
Cream, ink, the pink, the ember, Georgia. Add surfaces, layering, light, and a
clear first, second and third place. Take away sameness.

The colours already exist and this screen uses almost none of them. `Theme`
has `ember`, `emberLight`, `emberDeep`, `wax`, `waxLight`, `accentSoft`,
`accentDeep`, a `celebration` gradient and a `bloom` radial gradient. The
stage uses the accent for kickers and nothing else. There is a whole warm
range in there that belongs to the candle and is currently unused.

---

## 4. Rules you cannot break

**You have no compiler.** Jason builds in Xcode and sends back errors and
screenshots. Write Swift carefully, keep changes reviewable, and expect a
round trip. Say in the commit message that it is not compiled.

**The five things above the fold stay five.** The date and weekday, the number
one song, the two counters, the one older-than sentence, and the candle. You
may re-rank them, re-weight them, group them, or give any of them a surface.
You may not add a sixth, and you may not bring back the album, the film, the
milestone line, the birthstone or the birth flower. Those were removed on
purpose hours before this brief and the reasons are in the feature table.

**Do not touch anything under `Birthed/Domain/`.** It is pure Swift with no
framework imports and it carries nearly all of the correctness risk in the
product. This is a view job.

**Every empty state has to survive it.** The screen has four shapes, not one,
and a redesign that only looks right in the screenshot will break three of
them:
- No birth year. No song block, no older-than line, and a nudge in their place.
- Birth year but no chart week for it. Song block absent, everything else present.
- The reader's actual birthday. Different kicker, "Happy birthday" instead of
  the date, a 300 point candle instead of 230, and confetti over the whole
  stage.
- February 29 in a non leap year, which adds a note below the stage.

**Light and dark both.** `StagePalette.forScheme` is the only switch and there
is no second palette to maintain. Anything you hard code in one scheme is a bug
in the other. The complaint that started this was specifically about light mode.

**House rules.** No em dashes anywhere, including code comments and commit
messages. Write an abbreviation out before using it. Cite requirement
identifiers in commits where one applies. Commit finished work as it lands,
authored as Jason Page with the Claude co-author trailer. Ask before anything a
commit cannot undo.

---

## 5. Things worth trying, none of them mandatory

Offered so you do not start from nothing. Argue with any of them.

- **Make the day count the hero.** One enormous number, the candle beside it,
  everything else smaller. It is the one number and it currently ties for
  second.
- **Solve the candle first, and let the rest of the layout follow from it.** It
  is the app's mark, it is on the icon, and on this screen it is the problem.
  Four directions, in rough order of how much they change:

  1. **Give it a field to live in.** The candle works on the icon and the share
     card because both are a bounded, coloured panel with the candle as the
     subject. Put the stage on a real surface, a deep wax panel or a warm
     gradient, and the candle is suddenly standing in something rather than on
     nothing. This also fixes the grouping problem and the six kickers problem
     in the same move, because a panel gives everything inside it a boundary.
  2. **Give it a ground.** A shadow, a plate, a holder, a table edge, a pool of
     light on a surface. Cheapest of the four. It stops the floating without
     changing the screen's structure.
  3. **Let it run off an edge again, but a real one.** It is drawn with no base
     specifically to bleed off the bottom of whatever holds it. Give it
     something to bleed off, whether that is a panel, the bottom of the screen,
     or a card, and put its drop back.
  4. **Demote it.** Make it small and deliberate rather than large and
     unexplained, and give the hero slot to the day count instead. The candle
     is the app's mark; it does not have to be the biggest object on every
     screen.

- **Let the candle light the screen.** Its glow already exists and is aimed at
  the flame, and nothing else on the screen responds to it. A warm fall off
  across the stage, using the ember colours that are sitting unused in `Theme`,
  would turn the glow from a pink smudge into an actual light source and would
  tie the whole composition to the one object that is supposed to be the app.
- **Stop using the kicker six times.** Pick one thing that gets a kicker and
  find another way to label the rest.
- **Close the dead band.** Either fill it or remove it.
- **Make the two sections below the fold look like they belong to the screen
  above them,** or deliberately separate them with a boundary that says the
  poster has ended.

---

## 6. How to know it worked

- Jason builds it and sends a screenshot in light mode and in dark mode.
- The most important number on the screen is obvious in a glance from arm's
  length.
- Nothing runs under the tab bar.
- All four shapes in section 4 are screenshotted, not reasoned about.
- The smallest phone the app supports is checked, not assumed. The older-than
  sentence sits next to the candle and is the first thing that will collide.
- It still looks like the same product as the app icon, the share card and
  birthed.app.

---

## 7. What this is not blocking

TestFlight. Build order items 1 through 4 are done and the only thing the repo
says stands between here and submitting is instrumenting four numbers, which
Nathan is setting up himself. A redesign of this screen is worth doing and is
not a reason to hold the build.
