# Strip to the hive, and the first drama set

Written October 18, 2026. A plan, not a build. No code has changed. Nathan's
directive the same day: pause the slices of the October 14 pivot that point
the hive at artificial intelligence news, keep the site general, and strip
the date page down to the game. Then pressure test four drama ideas and pick
one first set. Nothing here is built until Nathan says go.

## What the live numbers say, read October 18, 2026

Read from the live project with plain counts, nothing written.

- 99 buzzes in all, from 25 boosters (browser tokens or app installs, never
  people), on 25 dates. 5 boosters ever buzzed on a second day.
- The last 14 days: 21 buzzes from **2 boosters**.
- The busiest day ever held 9 buzzes.
- Song answers ever: 4. **Suggestions ever: 0.**
- Every open board from October 12 to October 18 held 8 to 12 tiles, and all
  but two were the day's news. Each date also carries about 390 filed history
  and people stories, which reach the board only when somebody buzzes one.
- The refill migration (`20260923010000_buzzes_that_refill.sql`) is still not
  applied. `wall_boost_allowance` does not exist on the live project.

Everything below is judged against those numbers. There is no crowd yet, and
section 30 of `docs/the-wall.md` already said the honest part: no rule makes
a fight happen between two people.

## Part 1. The strip

**Built October 18, 2026, on Nathan's go.** What landed, and how it differs
from the plan below, is in the CLAUDE.md entry "The pivot paused, and the
strip". In short: as planned, except that the faces and covers a board
draws are still copied (only those), and the share picture step in `og.ts`
was left for a later pass.

### What goes from the rendered date page

| Module | Where it lives now | What happens |
|---|---|---|
| The song prompt, "What song is in your head today?" | `songSection` in `wall.ts`, `song-prompt.ts`, `song-apple.ts`, the search script, `/cover/` | Not drawn. Its routes answer by sending the reader to the date page. |
| The archive: history, Born on, Number ones by year | `museumSection` and its groups in `render.ts`, `museumMarks` and `museumKey` in `wall.ts` | Not drawn. Not baked either: no closed details, nothing for a crawler. |
| The comb | `combPreview` on the date page, `renderCombPage` for `/<date>/comb/` | Both gone. `/<date>/comb/` sends the reader to the date page. |
| The birthday box, "You have been alive for 24 years" | `renderMePanel`, `withMe`, `renderBirthdayModal`, `ageMark`, `songMark`, `yoursMark` | Gone, and so is the birth year cookie behind it. |
| "What else mattered today?" | `suggestSection`, `suggest.ts`, `find.ts`, `wall_suggest_topic` | **Goes.** Not load bearing, see below. |

**Why the suggestion box goes.** It has filed zero stories since it shipped on
October 5. The board does not need it to get new tiles: the news feeds fill
up to 8 unbuzzed tiles every day on their own (`NEWS_UNBACKED` in the
allocator), and the 390 filed history stories a date still reach the board
through Pick between two, which draws from every story on the date
(`pickList` in `pick.ts`). With the archive gone, Pick is the only way history
reaches the board, which is the reason Pick stays.

### What stays

The page becomes, top to bottom: the site bar, the date, the hive heading
with the seal countdown (`stateLine`), the one line of how to play
(`HOW_TO`), your buzzes left (`countLine`), the board, the crown and its list
of lead changes (`crownBlock`), and one row of ways on: Pick between two, the
full screen hive, How the hive works, Everything you have buzzed.

Also staying, because they are part of the loop rather than modules on the
page: the receipt behind every headline, the Undo inside thirty seconds, the
full screen live hive, the sealed picture, and `/yours/`.

### What breaks, and what has to change with it

1. **The privacy page.** It describes the song search, the suggestion
   search, the two scripts on today's page, and the birth year cookie. All of
   that stops being true, so it changes in the same commit, per the house
   rule. It gets shorter, which is the good kind of change.
2. **The 366 date pages lose most of their content.** A date page is keyed by
   month and day, and only dates since September 9 have a hive. A date with no
   hive yet becomes "Opens at midnight Eastern" and nothing else. Gut call:
   keep every dated address alive, because shared links point at them and
   every date gets a hive within the year, but take Every date and Random out
   of the site bar until there are sealed days worth browsing. The bar
   becomes Today, Past days (the sealed hives only), About.
3. **Search.** The JavaScript Object Notation for Linked Data block lists the
   date's people and goes with them. The description stops naming people and
   songs. The sitemap shrinks to Today, About and the sealed hives, or goes;
   either is fine once search is not the plan.
4. **Where a buzz lands.** `keptAt` knows about museum rows, song rows,
   suggestion rows and comb cells. Those branches go, leaving the tile and the
   sentence.
5. **The board's empty line** says "Suggest something below, or buzz anything
   in the museum." It needs new words: "The day's news lands here as it
   breaks. Pick between two to bring something else up."
6. **The worker keeps filing history.** `history.ts` still files about 390
   stories a date. They are now the ballot that only Pick shows. Keep it, or
   Pick runs out of pairs on a slow news day.
7. **The sealed picture** keeps its slots for songs and suggestions. They are
   empty lists and the picture already handles that. No change needed.
8. **Tests.** About 440 lines across 9 web test files name the cut modules
   (museum 61, suggest 230, comb 92, song 23, the birthday panel 14, plus the
   people and number one groups). Most are deleted with the code they test.
   `render.test.ts` and `wall.test.ts` need their "order of the game on the
   page" tests rewritten for the new order. New tests: the page carries no
   archive, no song prompt, no birthday box, no suggestion box and no comb,
   and the first screen at 390 pixels wide holds a Buzz button.
9. **Not affected.** The iOS app, which comes down in slice 6 anyway. The
   database: nothing is dropped, every cut table and function stays where it
   is, and the song and suggestion functions simply stop being called.

### The new build cost

Measured on the build as it is, estimated for after.

- **Database reads at build time.** Today: 732 people queries (two per
  date), plus chart weeks, facts, events, culture rows, lead lines, Wikipedia
  selections, stored pictures, sealed memory and the walls. After: the walls
  and stored pictures. Most of the build's network time goes.
- **The static copy.** `static/faces` is 138 megabytes and `static/covers` is
  38 megabytes, and the build copies both into every deploy. They exist for
  the archive and for picture tiles of people and songs. After the strip they
  only serve a person or number one tile that somebody brought up through
  Pick. Gut call: stop copying them, and let those few tiles draw the made
  picture the way a tile with no picture already does. That takes about 176
  megabytes off every deploy.
- **The pages.** A date page was about 167 kilobytes in the last local build
  (September 7, stale, so read it as a size class, not a figure). With the
  archive, the song strip and the birthday modal gone, a page should be the
  board and its style sheet, a small fraction of that. Measure it on the first
  build after the strip.
- **The share pictures.** 732 today (a wide card and a square per date),
  already skipped when unchanged. The wide card is built from people and
  songs. After: the square for dates with a hive and one shared picture for
  the rest.
- **Modules that can leave the build entirely:** `song-prompt.ts`,
  `song-apple.ts`, `suggest.ts`, `find.ts`. Probably `timeline.ts`,
  `highlight.ts`, `culture` and `lead` wiring too, once the About page and the
  share cards stop reading them. That is checked during the build, not
  assumed here.

## Part 2. The four drama ideas, pressure tested

The frame: patch notes for Earth, voted by the players, sealed at midnight.
The problem: drama, meaning the fight and not just the vote.

### 1. An opposition verb, buzz up and sting down

**What it does well.** It is the most direct answer to "the fight". It lets a
reader say "this will not matter in ten years", which is an honest answer to
the question the hive asks, and a lot of the day's news deserves it.

**Where it breaks.**

- **The crowd is two people.** With 2 boosters in 14 days, one sting can wipe
  a tile off the board. A fight needs two sides, and right now a sting is one
  person deleting the other person's vote.
- **The web has no phone check.** A website buzz is guarded by a cookie and a
  per address limit. Buzz abuse is visible: a tile grows, and the receipt is
  public. Sting abuse is invisible: a tile quietly shrinks. A script with
  fresh tokens could bury any story, and burying is the attack people want.
- **It reverses a written decision.** `docs/creative-direction.md` says the
  site has no up or down vote "precisely so that a crowd cannot fight on it",
  because politics will try to get in. A down verb is exactly what a political
  crowd wants. That is Nathan's call to reverse, and it should be made knowing
  this is the line it crosses.
- **It changes what a sealed board means.** Today a sealed board is what
  people backed. With stings it is what was left after people fought. Both are
  defensible, but the receipt and the About page would need to say which.
- **Crown rule.** If stings exist, the crown has to go to the highest net
  count, or stings do nothing to the one thing worth fighting over. Highest
  net means a holder can be knocked off without anybody backing the
  challenger, which is a takedown, not a takeover.
- **Cost.** `wall_boosts` is immutable and its trigger guards every row. A
  sting needs a sign on the row, the budget trigger, the crown replay, the
  pie, both copies of the allocator held together by the 400 board test, the
  sealed picture and the privacy page. It is the most expensive of the four.

**Verdict: not in the first set.** Revisit when the number in
`docs/measuring.md` has a real month behind it. If it ever ships: a sting
spends from the same three a day, only works on a tile already on the board,
and the sealed receipt shows both counts.

### 2. Crown fights

**What already exists.** The crown, the list of every lead change, the
"took the crown from" sentence after a buzz, the honey edge, the tie rule
(the holder keeps it on a tie). All built September 23.

**What is missing is a reason to care, and a visible way to swing it.**

- **Streaks do not fit.** A story belongs to one date, so it cannot hold a
  crown across days. A streak for a reader is a number about a reader, which
  section 30 refuses, and there is no account to hold it.
- **The challenger does fit, and it is the big one.** Show the second place
  story next to the holder with one line: "Ray Charles is 1 buzz from the
  crown." With tiny crowds this is true almost all day, which turns the small
  crowd from a weakness into the hook: **every single buzz decides
  something.** Backing the challenger is the opposition move, with no down
  verb needed. It is r/place's takeover: your work covers somebody else's.
- **Dethrone events need a stage.** The lead change list is buried under the
  board. A takeover should be the line at the top of the board for the next
  hour: "11:52 pm: Ray Charles took the crown. 8 minutes to the seal."
- **The prize is the seal.** Whoever wears the crown at midnight becomes the
  headline of that day's patch notes: the first line of the sealed board, the
  top of the sealed picture, and the title of the day in Past days. "Held the
  crown for 14 hours" and "4 lead changes" are facts about tiles, so they are
  allowed.

**Verdict: in the first set. It is cheap, it is mostly built, and it is the
only one of the four that makes a fight with the crowd we actually have.**

### 3. Founding status, numbered badges 0 to 99

**What it does well.** Scarcity and status are real pulls, and "founder"
gives the first strangers a reason to come now rather than later.

**Where it breaks.**

- **It reverses section 6 of `docs/the-wall.md`.** "No public handle, no
  profile page anybody else can open, and no way to point at a tile and say
  that one is mine." A badge on a profile and on a sealed receipt is all
  three. Showing which founder backed a story on a receipt also means reading
  `booster_id`, which the website's role is refused on purpose.
- **There is nothing to hang it on.** A website booster is a browser token.
  Clear cookies and founder number 12 is gone, and a new token is a new
  person. A badge that can be lost by clearing a browser is a badge that
  produces support email, not status.
- **The first 25 are mostly us.** 25 boosters have already buzzed and 2 were
  active in the last two weeks. Numbering from the live table hands most of
  the low numbers to Jason's and Nathan's own browsers.
- **The honest version needs a lasting identity.** That means an optional
  account, which the "no sign in screen, at any point" rule refuses, or a
  claim code a reader saves, which is a new table and a new line on the
  privacy page.

**Verdict: not in the first set.** If it comes later, the shape that fits the
rules is a founder number a reader can see only on their own `/yours/` page,
and an aggregate on the receipt ("3 founders backed this"), never a name.

### 4. The 30 second rule

**This is a test, not a feature, and it passes after the strip.** Today, on a
phone 390 pixels wide, the first screen is the song prompt and nothing else.
After the strip, the first screen is the date, the countdown, one line of how
to play, and the top of the board. Every tile has a Buzz button. A tap is one
form post and the page comes back with "That counts."

**The risk that remains:** on a phone a small tile shows its year, not its
headline, so a stranger sees buttons on tiles they cannot read. The title
fight below fixes that by putting two readable stories with two big buttons
at the top. Keep the rule as an acceptance test in the build: at 390 pixels
wide, a Buzz button sits inside the first screen, with no scroll.

## The recommended first set

**One set, three pieces, all on top of what exists. No new table.**

1. **The title fight.** Above the board, the holder and the challenger side
   by side under one line, "Ray Charles is 1 buzz from the crown", each with a
   Buzz button. With no crown yet: "No crown yet. The first buzz takes it."
   with the top two stories. This is Pick between two aimed at the crown. It
   is also the first thing a stranger sees, so it carries the 30 second rule.
2. **The takeover on stage.** The last change of hands is the top line of the
   board for an hour after it happens, with the minutes to the seal in the
   last hour of the day. The full screen live hive already moves the crown as
   a buzz lands; the date page gets the same line on load.
3. **The crown becomes the patch note.** The sealed day is titled by its
   crown: "October 18: Ray Charles held the crown for 14 hours, 4 lead
   changes, 9 buzzes from 6 boosters." That line leads the sealed board, the
   sealed picture and the Past days list.

**Optional fourth, and the cheapest of all: turn on the refills.** The
migration is written and was tested in a rolled back transaction on
September 23. One buzz every eight hours makes the title fight a fight across
three visits instead of one, which is the comeback r/place had and the hive
does not. It needs Jason to apply the migration and flip two flags in the
same deploy. The open design question from September 23 still stands: a dot
for a buzz that has not arrived yet looks like a spent one.

**Why this set.** It is the only set that creates a fight with two active
boosters, because at that size one buzz really does flip the crown, and the
page saying so is true rather than staged. It needs no reversal of a written
rule: no down vote, no profile, no number about a reader. It needs no
migration unless refills are switched on. And it gives the frame its shape:
every day is a patch, the crown is its headline, and the seal is the release.

**What it does not fix.** Traffic. None of this brings people. It makes the
first visit land and gives a returning reader something to come back for.
The number to judge it by is the one already chosen, repeat buzzing on a
second day, and that clock still starts when real traffic does.

## Open for Nathan

- Go on the strip as written, including taking out the suggestion box.
- Whether the site bar loses Every date and Random until Past days exists.
- Whether to stop copying the faces and covers, and accept made pictures on
  the few person and number one tiles Pick brings up.
- The first set as recommended, and whether refills go with it.
