# The hive on iOS: a brief for a fresh session

Written September 10, 2026, for a session that has not seen the web work.
Read it whole before writing Swift. Everything here is a description of what
already exists or a question with a recommendation; the decisions that are
already made are in the documents named in the read order and are not
reopened here.

## 1. Read these, in this order

1. `CLAUDE.md`, all of section 5, and especially the three entries dated
   September 10, 2026: "The wall leads the date page", "One feed, one verb,
   and the hive", and the house rules in section 10. No em dashes anywhere.
   Write out an abbreviation before using it. Commit as Jason Page.
2. `docs/the-wall.md` sections 10 to 13. Section 13 is the record of what
   the web did this week and why. Its product rules win over this brief; if
   this brief and that document disagree, do what the document says and say
   so in your final message.
3. `web/src/wall.ts` and `web/src/render.ts`. This is the target. The web is
   ahead of the app now and the app is catching up to it, not the reverse.
4. `Birthed/Domain/Wall.swift`, `Birthed/Data/WallService.swift`,
   `Birthed/Features/DayPage/WallView.swift`, `WallStoryView.swift`,
   `WallSubmitView.swift`, `DayPageView.swift` and `RememberRow.swift`. This
   is what you are changing.
5. `supabase/migrations/20260910010000_boosting_from_the_web.sql` and
   `20260910030000_history_on_the_hive.sql`, for the columns the app does
   not read yet.

## 2. Where the web is, in plain words

A date page on birthed.app is now one thing under the date's name: the hive,
then one feed.

- **The hive** is the sixteen by sixteen board, drawn zoomed to its tiles
  (the smallest square that holds them, never under eight modules across,
  never over the board). Every tile is a headline in the source's words, in
  three tones of honey by evidence tier: pale wax for claimed, amber for
  reported, deep honey for seen directly. A tile is never smaller than four
  modules by three, so a headline always fits. The board holds at most
  twelve tiles, eight of which may be stories nobody has backed yet.
- **The feed** under it is every wall story that is not on the hive. Most
  buzzed first, then the date's own history ahead of the news feeds, then
  arrival. All of it, no fold, the way a reddit reads its feed.
- **Everything with a birthday on the date is a pixel.** The worker files
  what happened on the date, who was born on it and what came out on it as
  wall stories at the start of every tick, alongside the day's news. They
  live in the same pool, take the same buzzes, and can take the hive.
- **One verb.** The button says Buzz. One tap is one unit. Three buzzes a
  day on the date itself, one on the day after, none the day before: the
  budget in section 4 of the wall document, unchanged. The count says
  "Two buzzes left today." The mark says "You buzzed this." On a short list
  of solemn dates (`PLAIN_DATES` in `web/src/wall.ts`, September 11 among
  them) the same controls speak plainly: "Back this", "You backed this".
- **The three answer remembrance game is off the page.** No "I remember it",
  "Heard of it", "Never heard of it"; no birth year question; no "What
  people remember". Nothing was dropped from the database.
- **The headline opens the receipt; the button votes.** Two controls, two
  acts. The receipt shows every source, every quotation and every check,
  and on an open date it carries the Buzz button too, so a reader who came
  to check the sources does not have to go back to vote.
- **Copy.** "Buzz what you think will still matter about September 9 years
  from now. Each buzz makes it bigger on the hive, and you get a few a
  day." Nothing says boost. Nothing says a model decided anything. A story
  nobody backed shows no count at all, never "0 buzzes".

## 3. Where the app is

The Today tab draws, top to bottom: the header, `WallView`, then the
`DayFeed` content (events, people, songs, ranked by the reader's age, "You
were 7"), then attribution.

`WallView` says THE WALL, draws the board from stored rectangles, lists "In
the pool, not on the wall" and "Earned a place, found no room", and offers
an add button. `WallStoryView` is the receipt, with a BOOST control offering
one, two or three units. The feed rows below carry `RememberRow`, the three
answer buttons. The palette is the app's pink accent and grey cards, not
honey. The words are wall, square, boost, pool.

`WallStory` in the domain has no `priority`, no `subjectKind`, no
`subjectID`. `WallService` reads
`id,wall_date,submitted_at,headline,url,outlet,status,tier,support,placed_at,anchor_mx,anchor_my,w_modules,h_modules,false_at,false_note`
and the sources under each. The allocator's new minimum tile size and cap
are server side, so `WallBoard` already draws readable tiles with no change.

## 4. Scope

Make the Today tab read the way the date page reads. Specifically:

1. **Name and voice.** THE WALL becomes THE HIVE. Boost becomes buzz
   everywhere a reader sees it: the button, the count, the mark, the
   refusals in `WallCopy`. Port `PLAIN_DATES` and the plain voice from
   `web/src/wall.ts` into the domain so the same dates speak plainly in the
   app, and test that September 11 does. Never print "0 buzzes".
2. **Palette.** The tiles take the honey tones the web uses:
   claimed `#EFE0B8` with dark ink, reported `#E7A83A`, seen directly
   `#B05A0C` with `#FFF3DC` ink. The legend keeps its one line and gains
   that a tile's colour is its tier and a tier is not a verdict. Keep the
   candle's wax as the site does; do not touch `StagePalette.forScheme`.
3. **Two controls on a tile.** Tapping the headline opens the receipt.
   A small Buzz button on the tile spends the unit. A tile that this account
   has buzzed shows "You buzzed this" and an outline.
4. **The feed under the hive.** Every wall story not on the hive, sorted
   most buzzed first, then `priority` descending, then `submittedAt`, then
   id. Each row: headline as a link to the receipt, outlet, count when there
   is one, and the Buzz button while the date is live. No fold, no "In the
   pool" and "Earned a place" headings; the receipt still says which it is.
   Read `priority`, `subject_kind` and `subject_id` into `WallStory` and
   into `WallRows`.
5. **The remembrance buttons come off the Today tab.** `RememberRow` and
   its three answers are not drawn. Leave the files, the service and the
   tables; delete nothing from the database. The `DayFeed` rows themselves
   are a question, below.
6. **The receipt carries the Buzz control.** Already does, as BOOST; rename
   and re-voice it. Whether it offers one, two or three units is a question
   below.
7. **Domain first.** Every new rule (voice by date, feed order, what the
   count says, whether a tile shows a count) goes in `Birthed/Domain/Wall.swift`
   or beside it, imports Foundation only, and is tested under `swift test`.
   The views draw.

## 5. Not in scope

The close job, snapshots, the archive page, the shareable image,
leaderboards, honey as karma, comments, analytics. `DayFeed`'s ranking by
age. `WallSubmitView` beyond renaming its words. The Mine and People tabs.
The web. Anything that deletes from the live database.

## 6. Questions, with a recommendation each

Ask Nathan these before drawing, as multiple choice. Do not decide them in
code.

**Q1. One buzz per tap, or one, two or three units?** The web is one unit a
tap, three taps a day. The app offers one to three units at once, and
`docs/the-wall.md` section 4 and section 13 say that stays in the app.
Recommendation: one buzz per tap, three taps a day, the same as the web,
because "dead simple" was the instruction and two products with two rules
for the same button is not that. This changes section 4 of the wall
document, so it is Nathan's call and the document changes first.

**Q2. What happens to the DayFeed rows?** The web has one feed: the wall
stories. The app has `DayFeed`, the reader's own timeline with "You were 7"
on every row, which is the app's best surface and is not on the web at all.
Three shapes:
(a) Replace `DayFeed` with the wall story feed, exactly as the web.
(b) Keep `DayFeed` as it is under the hive, with the remembrance buttons
removed and no Buzz on its rows, and put the wall story feed between the
hive and it. Two lists of overlapping things.
(c) One feed: `DayFeed` rows stay, keep their age line, and a row whose
subject the worker has filed as a wall story (`subject_kind` and
`subject_id` match) shows that story's count and the Buzz button. The day's
news stories, which have no subject, sit at the top as this year's rows.
Recommendation: (c). It is why the subject columns exist, it keeps the
thing the app does that nothing else does, and it is still one feed and one
verb. It is more work than (a).

**Q3. Zoom the board to its tiles, as the web does?** The app draws the whole
sixteen by sixteen board scaled to the phone's width, so ten tiles in the
middle are small. The web draws the smallest square that holds the tiles.
Recommendation: yes, port `viewportFor` from `web/src/wall.ts` into
`WallBoard` with the same rules and the same tests, and add a full screen
view of the hive reached from the board, as `/<date>/hive/` is on the web.

**Q4. Does the app read the wall through PostgREST or through
`wall_web_standing`?** The app's own count of units left comes from its own
query today. `wall_web_standing` is for the web's token and refuses an
authenticated caller; the app should keep its own read. No change
recommended; named so nobody reaches for the web function.

## 7. Tests

- `swift test` stays green. Every rule in section 4 has a domain test:
  voice by date including September 11, feed order with ties, "You buzzed
  this" only for this account's stories, no count on an unbacked story, the
  viewport if Q3 is yes.
- `WallRows` parses `priority`, `subject_kind` and `subject_id`, and a row
  without them still parses (older rows are null).
- `WallCopy.refusal` maps the server's sentences to buzz sentences.

## 8. Commits and the final message

Commit as work lands, `-c user.name="Jason Page"
-c user.email="jasonpage@users.noreply.github.com"`, with the Claude
co-author trailer, split by what changed: domain, service, views, docs.
Cite requirement identifiers where one applies. Append what you decided to
`docs/the-wall.md` as a new numbered section 14, in the same register as
section 13. Add the short form to `CLAUDE.md` section 5.

The final message lists what a human must do by hand (Jason builds in
Xcode and sends back errors and screenshots; there is no compiler in the
session), and anything found ambiguous. Ask questions and give
recommendations rather than guessing.

## 9. Acceptance

On a device on an open date: the Today tab shows THE HIVE in honey with a
Buzz button on every tile and every feed row, one tap adds one, the count
under the heading goes down, the fourth tap of the day is refused in one
plain sentence, the tapped story says "You buzzed this", the headline opens
the receipt and the receipt offers the same button. On September 11 the
same screen says back and backed. Nothing on the screen says wall, square,
boost, remember, or that a model decided anything.
