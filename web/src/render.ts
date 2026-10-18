// Rendering a date page. Pure string in, string out, so it can be tested
// without a network and without a browser.

import { monthName, neighbours, slug, everyDate } from "./model.js";
import { SHARE_STYLE, shareBlock } from "./share-button.js";
import { MASCOT_STYLE } from "./mascot.js";
import { THEME } from "./theme.js";
import { WALL_STYLE, hivePath, pictureRules, recordStanding, storyBody, voiceFor, wallSection, type Picture, type RecordRow, type ReceiptOptions, type Voice, type WallDay, type WallStory } from "./wall.js";
import { calendar } from "./calendar.js";

export const SITE = "https://birthed.app";

/**
 * The iPhone app, in beta. TestFlight is Apple's free app for trying an app
 * before it is on the App Store. Here rather than in pages.ts because the bar
 * and the footer on every page carry it, and pages.ts imports this file.
 * Nathan and Jason, September 22, 2026: until then the only way to the app
 * from the website was one line at the foot of the About page.
 */
export const TESTFLIGHT_URL = "https://testflight.apple.com/join/hzm6Mhhm";
const INK = "var(--bg)";
const ACCENT = "var(--honey)";
/* The wordmark alone. theme.ts says why nothing else is pink. */
const PINK = "var(--pink)";
/* Today, in the calendar. A second hue rather than a second shade of the
   accent, because the accent already means "here" everywhere else on the page
   and two pinks a square apart is not a distinction anybody makes at a
   glance. Blue is far enough from it to read instantly on the plum ground and
   is used for nothing else. Exported because serve.ts writes the rule that
   uses it and the two must not drift. */
export const TODAY = "var(--ember)";
/**
 * The quietest text on the site is allowed to be.
 *
 * Measured, not chosen. ${QUIET} was the old value and it sits at 3.53 to one
 * against the ink, which fails the 4.5 that normal sized body text has to
 * clear, and ${QUIET} at 4.28 failed it too. Both were used for things a
 * reader genuinely needs: the source credit under a section, the host under a
 * fact, the "died 2020" line, the labels under the counts.
 *
 * 4.65 clears it with a little room and stays well under the 6.51 of the
 * secondary grey and the 9.27 of a lede, so the four steps of the hierarchy
 * are still four steps. Quiet was always the intent; unreadable was not.
 */
const QUIET = "var(--dimmer)";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLE = `

/* The first screen, decided September 8, 2026. notes/first-impression-proposal.md.

   The state line is the first thing after the bar. Four sentences are baked
   into every page and one is shown: the sealed one by default, so a page with
   no today.css says the safe thing, and today.css turns on one of the other
   three for the three dates that are open. The Yesterday, Today and Tomorrow
   chips this replaces were coloured by href rather than by date, so a sealed
   page lit "Today" in blue and said answering was open under it. */
.state { margin: 20px 0 0; font-size: 14px; font-weight: 600; color: var(--cream-2); line-height: 1.4; }
.state .dot {
  display: inline-block; width: 9px; height: 9px; border-radius: 999px;
  background: var(--line); margin: 0 8px 1px 0; vertical-align: middle;
}

.senshut { display: inline; }

/* The fuse. A two pixel line exactly as long as the part of the three days
   that has gone. Its length is one custom property, --gone, which today.css
   sets from the real clock on every request, so it is true to the second the
   page loaded without a script. Where motion is allowed the same line creeps:
   the animation is 72 hours long and today.css starts it however far in we
   already are. It counts nothing and nobody. It is only the clock. */
.fuse { display: none; height: 2px; margin: 10px 0 0; background: var(--line); border-radius: 2px; overflow: hidden; }
.fuse span {
  display: block; height: 100%; width: calc(var(--gone, 0) * 100%);
  background: ${TODAY}; border-radius: 2px;
}
@media (prefers-reduced-motion: no-preference) {
  .fuse span { animation: burn 259200s linear forwards; animation-delay: calc(var(--gone, 0) * -259200s); }
}
@keyframes burn { from { width: 0 } to { width: 100% } }
/* The mechanic, in two sentences under the date. Two versions, because "say
   which ones you remember" is a lie on a page that refuses answers, and 363
   of the 366 do. */
.mechanic { margin: 0 0 4px; color: var(--dim); font-size: 15px; line-height: 1.4; max-width: 58ch; text-wrap: pretty; }
.mechanic b { color: var(--cream); font-weight: 600; }
/* The other open dates, as one quiet line. today.css hides the link to the
   page you are on, so the sentence names the other two. */
.also { margin: 0; font-size: 13px; color: var(--dimmer); }
/* The name. A polished site with no owner, no price and no advertising is read
   by a suspicious stranger as a business that has not shown its hand yet, and
   silence is taken as the answer rather than as the absence of one. The top
   comment on the September 6 Reddit post said the site existed to sell
   birthdays to advertisers. A name is the cheapest thing that accusation
   cannot survive contact with, so it is above the fold and not on a policy
   page. Set at the size of the line above it, because a signature that shouts
   is a claim and a signature that sits there is a fact.

   Hidden here and revealed by today.css on today's date only, which is the
   author's call and a reasonable one: a person's name printed on all 366 pages
   of an almanac reads as a byline over an encyclopedia somebody else wrote.

   It sat under the mechanic on the first screen for one morning and that was
   too loud for the person whose name it is, which is the only vote that counts
   on this one. It is now the last line of the page, above the credits, at the
   size of a credit, which is where a reader who wants to know who made
   something goes looking anyway. The About page still carries it in full and
   is one tap from every page in the bar. */
.signed { display: none; margin: 30px 0 0; font-size: 11.5px; color: var(--dimmer); }
.signed a { color: var(--dim); text-decoration: none; border-bottom: 1px solid var(--line); }
.signed a:hover { color: var(--cream-2); }
.also a { color: var(--dim); text-decoration: none; border-bottom: 1px solid var(--line); }
.also a:hover { color: var(--cream); }

/* The first ask. One row from this date with the three answers at full size,
   above the fold on a phone. Drawn only on the three open dates, by today.css.
   The sleeve on it is the number one record of that year on this date, which
   is not the thing being asked about: the year is the question and a sleeve
   says a year faster than a number does. */
/* One of these is revealed per request by today.css, out of up to ASK_SLOTS
   baked into the page. See askSection for why the card is dealt rather than
   fixed. */
.ask {
  display: none; margin: 16px 0 0; border-radius: 18px; overflow: hidden;
  background: linear-gradient(168deg, var(--cell) 0%, var(--cell) 62%);
  box-shadow: inset 0 0 0 1px rgba(255, 243, 224, .10);
}

/* Same three words every row further down uses, bigger here, once, because
   this is where the mechanic is taught. */
.ask .rem { gap: 8px; margin: 0; padding: 12px 16px 4px; }
.ask .rem button {
  font-size: 14.5px; font-weight: 600; min-height: 42px; padding: 11px 15px;
  background: rgba(255, 243, 224, .06); color: var(--cream); border-color: rgba(255, 243, 224, .18);
}
.ask .rem button:hover { border-color: var(--day-soft, var(--honey-lite)); background: rgba(255, 207, 107, .14); }
.ask .mine { padding: 6px 16px 0; margin: 0; }

/* The row the ask was taken from, where it sits in the feed. Hidden by
   today.css on the three open dates, so a row is on the page once: at the top
   while the date is open, in its place once it has sealed. */
.alsolab { margin: 30px 0 10px; font-size: 10.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--dimmer); }
/* Drawn only on a date that is open, by today.css, which is generated per
   request and is the only thing on this site that knows what day it is. The
   buttons are therefore never shown on a page that would refuse them. */
.rem { display: none; }

/* Your own mark on this date, and the reason it is empty here.
   A reader answers ten rows, the page looks identical afterwards, and there is
   no trace of them when they come back. On r/place you saw your own colour go
   on the grid and it was still there tomorrow, and that difference is the
   whole of why answering here felt like less than placing a pixel.
   So the server writes one style block naming the rows this browser answered,
   and the words arrive with it rather than being baked 150 times over. Nothing
   about anybody else is ever in that block: no counts, no totals, no score.
   See myMarks in serve.ts. */
.mine { display: none; margin: 6px 0 0; font-size: 12.5px; color: var(--ember); }
/* A count of a room, on a sealed date, once there are enough people in it to
   be worth counting. Not a rating: see rememberedLine. */
.tally { margin: 8px 0 0; font-size: 12.5px; color: var(--day-soft, var(--honey-lite)); }

/* Remembering. Three buttons, no script, no downvote.

   The class below is called afterword and not "said", which is what I called
   it first. The class "said" has been the event sentence in ul.feed, the line
   in the year dial, the fact text and the song title since long before this
   feature, so hiding it blanked every event on the site. docs/handoff.md
   already says class name collisions have bitten twice, .here in the calendar
   and .when in the render, and that the rule is to grep before naming a class.
   This was the third time. The test below now asserts the sentences are
   present, because both earlier collisions were caught by a test asserting the
   absence of something and this one reached production instead. */
.rem { flex-wrap: wrap; gap: 6px; margin: 10px 0 0; }
.rem button {
  font: inherit; font-size: 12.5px; line-height: 1; cursor: pointer;
  background: none; color: var(--dim); border: 1px solid var(--line);
  border-radius: 999px; padding: 7px 11px;
}
.rem button:hover { color: var(--cream); border-color: var(--day-soft, var(--honey-lite)); }

/* The result, written in by the server on the request after an answer. Baked
   in empty on every row, so a page that nobody has answered draws none of
   them. No colour on any of it: every date has at least one row where a
   coloured chart under a killing would be grotesque, so the reader's own
   answer is not singled out here at all and the shape does the talking. */
/* Said above a sealed date's list, because the page has visibly rearranged and
   nothing else on it explains why. */
/* The date's history, folded. A details element rather than anything with a
   script: it opens on a tap in every browser, a crawler reads what is inside
   it, and the server marks it open on the one request that lands a reader on
   a row inside it. */
.rest { margin: 34px 0 0; border-top: 1px solid var(--line); padding-top: 6px; }
.rest > summary {
  cursor: pointer; list-style: none; padding: 12px 0; font-family: var(--serif);
  font-weight: 800; font-size: 19px; line-height: 1.3; color: var(--cream);
}
.rest > summary::-webkit-details-marker { display: none; }
.rest > summary::before { content: "+"; display: inline-block; width: 22px; color: var(--dim); font-weight: 700; }
.rest[open] > summary::before { content: "\\2212"; }
.rest > summary:hover { color: var(--honey-lite); }

.wlist .rem { display: none; margin: 0 0 0 6px; vertical-align: middle; }
.wlist .mine { display: none; margin: 4px 0 0; font-size: 12px; font-weight: 700; color: var(--honey); }
.wlist .mine::after { content: ""; }
.state { margin: 26px 0 0; }

.barend { display: flex; align-items: center; gap: 8px; }
/* Three of the same thing. One height, one border, one type size, an icon
   each; the word next to the icon, because an icon alone is a riddle to a
   first visit. */
.pill {
  display: inline-flex; align-items: center; gap: 6px; text-decoration: none;
  font-size: 13px; line-height: 1; white-space: nowrap;
  color: var(--dim); border: 1px solid var(--line); border-radius: 999px;
  padding: 7px 12px 7px 10px; min-height: 30px; box-sizing: border-box;
}
.pill:hover { color: var(--cream); border-color: var(--day-soft, var(--honey-lite)); }
.pill .ic { display: block; flex: none; }
/* The card page: the picture as wide as the column, never wider. */
.cardimg { display: block; width: 100%; max-width: 540px; height: auto; margin: 16px 0 0; border-radius: 14px; background: var(--cell); }
.cardsave { margin-top: 12px; }
/* A photograph is not square. A head sits in the top third of almost every one
   of these, so a square crop takes foreheads off. */
img.face {
  width: 100%; aspect-ratio: 4 / 5; object-fit: cover; object-position: 50% 16%;
  border-radius: 10px; margin-bottom: 11px; display: block; background: var(--cell);
}
/* On a phone the words come off and the three icons stay, each still
   carrying its label for a screen reader and a long press. */
@media (max-width: 520px) { .pill span { display: none; } .pill { padding: 7px 8px; min-width: 32px; justify-content: center; } }
/* Five pills and a stepper on a phone: everything a little tighter, so the
   bar fits 390 pixels with nothing cut off at the right edge. */
@media (max-width: 440px) {
  .daybar { gap: 6px; }
  .daybar .mark { font-size: 17px; letter-spacing: 0.12em; }
  .barnav { gap: 2px; }
  .barnav .here { min-width: 44px; font-size: 12px; padding: 0 2px; }
  .arrow { width: 28px; height: 28px; }
  .barend { gap: 4px; }
  .pill { padding: 6px 6px; min-width: 30px; min-height: 28px; }
}

/* The opening band.
   Three tiles, each a picture with its caption UNDERNEATH it on solid ground.
   The first version laid the words over the image with a gradient veil, which
   is fine over a portrait and unreadable over album art, because a cover is
   designed to be the loudest thing in any frame. Nothing here is set over an
   image any more. The variety comes from what is in the picture, a face, a
   record sleeve, a number, not from three different ways of hiding text. */
/* Demoted, September 8, 2026. These were the first screen and are now the
   second: same three tiles, one row, about a third of the size, under a label
   saying what they are. A face, a sleeve and a year with no verb near them is
   a search result, which is what the page read as. */
.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0; }
.tile {
  display: flex; flex-direction: column; text-decoration: none;
  background: var(--cell); border: 1px solid var(--cell); border-radius: 14px; overflow: hidden;
}
a.tile:hover { border-color: var(--day-soft, var(--honey-lite)); }

/* What came out, above what happened. */
.culture { list-style: none; margin: 0; padding: 0; }

@media (min-width: 760px) {
  .tiles { gap: 14px; }

}
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0; color: var(--cream);
  background: var(--bg) radial-gradient(140% 900px at 50% -20%, var(--bg-glow) 0%, var(--bg) 100%) no-repeat;
  font: 17px/1.5 var(--sans);
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; }
.wrap { max-width: 720px; margin: 0 auto; padding: 32px 20px 72px; }
.kicker {
  font-size: 12px; font-weight: 800; letter-spacing: 0.22em;
  color: ${ACCENT}; text-transform: uppercase; margin: 0 0 10px;
}
/* Smaller than it was on the date pages. A reader who came here knows what
   date they asked for, and sixty points of it was the loudest thing on the
   page saying the least. */
h1 {
  font-family: var(--serif); font-weight: 800;
  font-size: clamp(38px, 9vw, 64px); line-height: 1.05; margin: 0 0 10px;
}
.day h1 { font-size: clamp(30px, 7.5vw, 48px); line-height: 1.02; margin: 10px 0 6px; letter-spacing: -.01em; }
.lede { color: var(--dim); margin: 0 0 30px; }
/* The hidden attribute has to beat every display rule below it. A browser
   hides [hidden] with its own stylesheet, and any author rule that sets
   display wins over that, so .btn made the two buttons on /add ignore being
   hidden and the page offered both at once. Anything switched on and off from
   a script depends on this line. */
[hidden] { display: none !important; }
ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
li {
  background: var(--cell); border-radius: 14px; padding: 13px 15px;
  display: flex; gap: 13px; align-items: flex-start;
}
.year {
  color: ${ACCENT}; font-variant-numeric: tabular-nums; font-weight: 600;
  font-size: 14px; width: 50px; min-width: 50px; padding-top: 2px;
}
.who { min-width: 0; }
.name { font-weight: 600; margin: 0; }
.name a { text-decoration: none; }
.name a:hover { text-decoration: underline; }
.what { color: var(--dim); font-size: 15px; margin: 2px 0 0; }
.died { color: ${QUIET}; font-size: 13px; margin: 3px 0 0; }
h2.section {
  font-family: var(--serif); font-weight: 800;
  font-size: clamp(24px, 5vw, 32px); line-height: 1.15; margin: 46px 0 6px;
}
/* The songs are a wall of covers. Sixty-odd of them on a page, so they are
   lazily loaded and sized to the grid: 300 pixels covers a retina screen at
   the width they draw and nothing bigger is worth the weight. */
ol.covers {
  list-style: none; margin: 0; padding: 0;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 22px 14px;
}
/* Landing on /september-5/#1990 must not put the tile flush against the top
   edge of the window with the heading scrolled away above it. */
/* Everything here has to be said, and none of it is decoration. The bare "li"
   rule near the top of this stylesheet sets display:flex, a background, a
   radius and padding, for the people and the facts. A tile is none of those
   things: left as a flex row it lays the cover, the year, the title and the
   artist side by side inside a 132 pixel column, every word wraps one letter
   at a time, and the cover collapses to nothing because a flex item with no
   width gives aspect-ratio nothing to work with. That shipped. */
ol.covers li {
  display: block; background: none; border-radius: 0; padding: 0;
  scroll-margin-top: 22px; min-width: 0;
}
/* Jump to a decade.
   Sixty eight covers is seventeen rows on a phone, and almost nobody wants to
   read seventeen rows: they want the year they were born, or the years they
   were at school. Every year is already an anchor, so this is eight links to
   anchors that exist.

   One quiet line, in the shape the footer's own links already use. The first
   version drew eight filled pills, which wrapped onto a second row and gave a
   block of navigation the same weight as the records underneath it. This is
   navigation. It should be findable and then get out of the way. */
p.decades {
  margin: 12px 0 0; font-size: 13px; color: ${QUIET};
  overflow-wrap: anywhere;
}
p.decades a {
  color: ${ACCENT}; text-decoration: none; font-weight: 600;
  font-variant-numeric: tabular-nums;
}
p.decades a:hover, p.decades a:focus-visible { text-decoration: underline; }
ol.covers .art {
  display: block; position: relative; aspect-ratio: 1; border-radius: 12px;
  overflow: hidden; background: var(--cell);
  box-shadow: 0 6px 18px rgba(0,0,0,0.45);
  transition: transform 160ms ease, box-shadow 160ms ease;
}
a.art:hover { transform: translateY(-3px); box-shadow: 0 12px 26px rgba(0,0,0,0.55); }
ol.covers .art img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* A recording with no cover. Made rather than missing. */
ol.covers .none {
  display: flex; align-items: center; justify-content: center; height: 100%;
  padding: 10px; text-align: center;
  background: linear-gradient(140deg, var(--cell-2), var(--cell));
}
/* Held to five lines inside the square.
   Billboard's title for the 1981 number one is the medley's whole track
   listing: "Medley: Intro 'Venus'/Sugar, Sugar/No Reply/I'll Be Back/..." and
   so on for a hundred and thirty characters. Printed whole it overflowed the
   tile and was cut off mid word, which looks like a bug rather than like a
   long name. The clamp cuts it with an ellipsis instead, which reads as a
   decision. */
ol.covers .none span {
  display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical;
  overflow: hidden; text-wrap: balance;
  font-family: var(--serif); font-weight: 800;
  font-size: 15px; line-height: 1.2; color: var(--cream);
}
ol.covers .y { margin: 9px 0 0; font-size: 13px; color: var(--dim); }
ol.covers .y a { color: inherit; text-decoration: none; }
ol.covers .y a:hover { color: ${ACCENT}; }
/* Three lines, then an ellipsis, for the same reason and a worse symptom: a
   grid row is as tall as its tallest cell, so one medley title set the height
   of the three records beside it and left a hole most of a screen deep. The
   whole title is still in the markup, on the element's own tooltip, so
   nothing is lost to anybody who wants it. */
ol.covers .t {
  margin: 2px 0 0; font-weight: 600; font-size: 15px; line-height: 1.25;
  overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
  overflow: hidden;
}
ol.covers .a { margin: 1px 0 0; color: var(--dim); font-size: 13px; overflow-wrap: anywhere; }
ol.covers li:target .art { box-shadow: 0 0 0 2px ${ACCENT}, 0 6px 18px rgba(0,0,0,0.45); }
ol.covers li:target .y a { color: ${ACCENT}; }
/* Motion, in CSS and nowhere else. The site sends default-src 'none', so no
   page here may run a script at all, and a page that tried would be silently
   dropped by the browser exactly as /add was for weeks. Style is allowed, so
   the motion lives in style. */
@media (prefers-reduced-motion: no-preference) {
  ol.covers li { animation: rise 460ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards; }
  ol.covers li[style] { animation-delay: calc(var(--i) * 45ms); }
}
@keyframes rise {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}
p.credit { color: ${QUIET}; font-size: 13px; margin: 14px 0 0; }

.mon { display: none; }
.mon { color: var(--dim); font-size: 12px; }

/* The rest of the wall, shut.
   Sixty-odd covers is a long scroll to get past on the way to the people, and
   the dial above answers the question most of them were being scrolled for.
   A details element does this with no script, and it is still one anchor per
   year underneath, so /september-7/#1996 keeps working whether it is open or
   shut: a browser opens the details to reach a target inside it. */
details.more { margin: 20px 0 0; }
details.more > summary {
  cursor: pointer; list-style: none; display: inline-flex; align-items: center; gap: 9px;
  font-size: 14px; color: ${ACCENT}; padding: 11px 0;
}
details.more > summary::-webkit-details-marker { display: none; }
details.more > summary::after { content: "+"; font-size: 16px; }
details.more[open] > summary::after { content: "\\2212"; }
details.more > summary:hover { color: var(--cream); }
details.more ol.covers { margin-top: 16px; }
details.more > summary .n {
  color: ${QUIET}; font-size: 12px; font-weight: 400; letter-spacing: 0.04em;
}

/* Read aloud but never drawn. The hive's kind marks carry one of these behind
   the icon, so a screen reader says "sport" where an eye sees a shape. */
.sr {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}
/* What happened. Not the rounded rectangles the people and the songs use: a
   sentence is the content here, so it is set to be read rather than scanned,
   and a hairline is enough to separate one from the next.
   The year sits in the margin, the width the people and the songs use, so all
   three lists on the page hang off the same column and the eye can run down
   the years without reading a word. It used to be inside the sentence, which
   printed the page's own date once per row. */
ul.facts { list-style: none; margin: 0; padding: 0; }
ul.facts li {
  background: none; border-radius: 0; padding: 16px 0; border-top: 1px solid var(--line);
  display: flex; gap: 13px; align-items: baseline;
}
ul.facts li:first-child { border-top: none; padding-top: 6px; }
ul.facts .said { min-width: 0; }
ul.facts .what {
  font-family: var(--serif); font-size: 19px; line-height: 1.42;
  color: var(--cream); margin: 0;
}
ul.facts .src { margin: 7px 0 0; font-size: 13px; }
ul.facts .src a { color: ${QUIET}; text-decoration: none; }
ul.facts .src a:hover { color: ${ACCENT}; text-decoration: underline; }

footer { margin: 40px 0 0; color: ${QUIET}; font-size: 13px; }
footer .nothing { color: var(--dim); }
footer a { color: var(--dim); }
/* The year as twelve calendars. Seven columns, so a row is a week and the page
   reads the way a wall calendar does instead of as a column of 366 lines. */
.cal h3 {
  font-family: var(--serif); font-weight: 800;
  font-size: 19px; margin: 0 0 8px;
}
.cal .dow, .cal .days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.cal .dow { margin: 0 0 5px; padding: 0 0 6px; border-bottom: 1px solid var(--line); }
.cal .dow span {
  font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-align: center;
  color: ${QUIET}; text-transform: uppercase;
}
.cal .days a, .cal .days .pad {
  display: flex; align-items: center; justify-content: center;
  aspect-ratio: 1 / 1; border-radius: 8px;
  font-size: 13px; font-variant-numeric: tabular-nums;
}
/* A floor under the tap target. aspect-ratio keeps them square but says
   nothing about how small square is allowed to get, and three columns of
   seven on a narrow tablet lands under the size a thumb can hit. */
@media (pointer: coarse) { .cal .days a, .cal .days .pad { min-height: 40px; } }
p.calnote { color: ${QUIET}; font-size: 13px; margin: 22px 0 0; }
footer .sitelinks { color: var(--dim); font-size: 14px; }
footer .sitelinks a { color: ${ACCENT}; text-decoration: none; }
.btn {
  display: inline-block; margin: 6px 0 0; padding: 12px 20px; border-radius: 999px;
  background: var(--honey); color: var(--on-honey); font-weight: 700; text-decoration: none; font-size: 15px;
}
.cal { scroll-margin-top: 24px; }
html { scroll-behavior: smooth; }
.soon { display: inline-block; margin: 6px 0 0; padding: 12px 20px; border-radius: 999px; border: 1px solid var(--line); color: var(--dim); font-size: 15px; }
h2.plain { font-family: var(--serif); font-weight: 800; font-size: clamp(22px, 5vw, 28px); margin: 40px 0 8px; }
.prose p, .prose li { color: var(--cream-2); }
/* The global li is a flex row built for the lists of people, and inside a
   paragraph of prose it split every bold lead, sentence and cookie name into
   its own column. Prose list items are plain blocks of text. */
.prose ul { list-style: none; padding: 0; margin: 12px 0 16px; display: grid; gap: 8px; }
.prose li { display: block; line-height: 1.6; padding: 12px 16px; }
.prose li strong { color: var(--cream-2); }
.prose li code { font-size: 14px; padding: 1px 6px; border-radius: 6px; background: var(--line); color: var(--cream-2); }
.prose h3 { margin: 26px 0 4px; font-size: 17px; }
.prose h2 { margin: 40px 0 4px; font-size: 22px; padding-top: 14px; border-top: 1px solid var(--line); }
.prose h2:first-child { margin-top: 8px; padding-top: 0; border-top: 0; }
.forget { margin: 10px 0 0; }
.forget button { font: inherit; font-size: 14px; font-weight: 700; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--line); background: var(--cell); color: var(--cream); cursor: pointer; }
.forget button:hover { border-color: var(--honey-lite); }
.prose .updated { color: ${QUIET}; font-size: 13px; }

/* ---- The form on /add ----------------------------------------------------

   The one page on this site that asks for something rather than telling you
   something, and it asked with the browser's own controls: a grey text box,
   two grey dropdowns and a link. On a page this dark that reads as a form
   somebody forgot to finish, and it is the first thing a person ever sees of
   Birthed, because a friend sent them the link before they had the app.

   The chevron on a dropdown is drawn with two borders rather than with a
   background image, and that is not a preference. The security header for
   this path says img-src 'self', so a data: URI is an image and it is
   refused. A refused background image leaves no chevron and no error that
   anybody would think to look for, which is the exact shape of the two bugs
   this page has already had. Nothing in this block loads anything.

   Every control is 16px or larger. iOS Safari zooms the whole page in when a
   field smaller than that takes focus, and a page that jumps when you tap it
   feels broken however good it looks.
*/
.form { margin: 30px 0 0; }
.field { margin: 0 0 24px; }
.label {
  display: block; margin: 0 0 9px;
  font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--dim);
}
.hint { display: block; margin: 9px 0 0; font-size: 13px; color: ${QUIET}; }
.input, .select > select {
  appearance: none; -webkit-appearance: none; -moz-appearance: none;
  display: block; width: 100%; margin: 0;
  font-family: inherit; font-size: 16px; line-height: 1.4; color: var(--cream);
  background: rgba(255, 243, 224, 0.055);
  border: 1px solid var(--line); border-radius: 14px; padding: 15px 16px;
  transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
}
.input::placeholder { color: ${QUIET}; }
.input:hover, .select > select:hover { border-color: var(--line); }
.input:focus, .select > select:focus {
  outline: none; border-color: ${ACCENT};
  background: rgba(255, 243, 224, 0.085);
  /* ACCENT at 22 percent. Written out, because a hex colour cannot be given
     an alpha by another rule. */
  box-shadow: 0 0 0 3px rgba(244, 183, 64, 0.22);
}
.dates { display: grid; grid-template-columns: 1.7fr 1fr 1.2fr; gap: 10px; }
/* Measured rather than guessed. At 375 points, which is the narrowest phone
   Apple still sells, three columns hold the word September with room to
   spare and the date reads as one thing. Below 360 the month would start to
   crowd its own chevron, so the year drops to its own row instead of the
   month being clipped. */
@media (max-width: 360px) {
  .dates { grid-template-columns: 1fr 1fr; }
  .dates .year { grid-column: 1 / -1; }
}
/* A select is a replaced element and cannot carry ::after, so the chevron
   hangs off the wrapper around it. */
.select { position: relative; display: block; }
.select > select { padding-right: 40px; cursor: pointer; }
.select::after {
  content: ""; position: absolute; right: 17px; top: 50%;
  width: 8px; height: 8px;
  border-right: 2px solid var(--dim); border-bottom: 2px solid var(--dim);
  transform: translateY(-72%) rotate(45deg);
  pointer-events: none;
}
.select:hover::after { border-color: var(--cream); }
/* The open menu is drawn by the operating system and inherits almost nothing
   from here, so its rows are told their colours. Without this, some browsers
   open a white list out of a dark control. */
.select option { background: var(--cell); color: var(--cream); }
/* The spinner arrows are for a quantity, and a year is not one. */
.input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
.input[type="number"]::-webkit-outer-spin-button,
.input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
/* The one thing to press. The .btn class stays the quiet cream pill the day
   pages and the store button use; this is the same pill with the brand on it,
   and it is only ever the single action a screen is asking for. A second class
   rather than a change to .btn, because the pages that are not asking for
   anything must not start shouting. */
.btn.primary {
  display: block; width: 100%; text-align: center;
  margin: 30px 0 0; padding: 17px 24px; font-size: 17px;
  background: linear-gradient(135deg, var(--honey-lite), var(--honey));
  color: var(--cream);
  box-shadow: 0 12px 30px rgba(244, 183, 64, 0.26);
}
.btn.primary:hover { filter: brightness(1.06); }
.btn.primary:active { transform: translateY(1px); box-shadow: 0 6px 16px rgba(244, 183, 64, 0.24); }
/* Only the buttons. A field already answers focus with an accent border and a
   glow, and adding an outline on top of that drew two rings around one box. */
.btn:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 3px; }
/* What went wrong, and what came out. The muted .lede grey is for prose a
   reader may skip, and neither of these is skippable. */
.problem { margin: 16px 0 0; font-size: 15px; color: var(--ember); }
.result { margin: 18px 0 0; font-size: 15px; overflow-wrap: anywhere; }
.result a { color: ${ACCENT}; }

/* ---- The front door ------------------------------------------------------

   Everything below here is the home page and only the home page. It asks for
   itself by name, through the "home" class that "head" puts on the body,
   rather than every other page being told to opt out of it. A date page is a
   document and is read at the measure prose is read at; the front door is a
   landing page and needs a wider one for the calendar and a louder one
   everywhere else, and those two things should not have to argue.

   Nothing here runs. The site sends default-src 'none' and this page has no
   script in it at all, so every piece of behaviour on it is either a link the
   server answers, a fragment the browser resolves, or a rule in this
   stylesheet. That is a real constraint and it is also why the interactions
   are honest: there is no state to get out of step with what is on screen.
*/

/* The light behind the heading. On the body rather than on an element, because
   a decorative layer behind content wants a negative z-index and a negative
   z-index paints behind the page's own background, which is the oldest way to
   make a glow that nobody can see. A background image on the body has no such
   problem. Left to scroll with the page rather than fixed: a fixed attachment
   is repainted on every frame of a scroll on iOS and it shows. */
/* body.home had three radial washes of its own, pink and violet. Gone,
   September 22, 2026: the About page wears the same page as every date. */
/* The calendar wants room and prose does not, so the page is wide and the
   words inside it are not. */
.wrap.home { max-width: 1120px; padding-top: 24px; }
.home .col { max-width: 720px; margin-inline: auto; }

/* The old .topbar and .quick strip is gone, September 22, 2026: every page
   draws siteBar. */
/* The name is the way home. A touch bigger than the rest of the bar, one
   line on a phone, and it answers a hover the way every other link here does,
   so nobody has to guess that it goes somewhere. */
.mark {
  font-size: 20px; font-weight: 800; letter-spacing: 0.2em; white-space: nowrap;
  color: ${PINK}; text-transform: uppercase; text-decoration: none;
  transition: color 140ms ease;
}
.mark:hover, .mark:focus-visible {
  color: var(--cream); text-decoration: underline; text-underline-offset: 6px; text-decoration-thickness: 2px;
}

/* One column. The app icon that used to float here is gone: it bobbed up and
   down beside a headline that now has a job to do, and an icon is what a page
   leads with when it has nothing to say yet. */
.home .hero { margin: 8px 0 0; max-width: 760px; }
.home .hero h1 { font-size: clamp(35px, 6.6vw, 60px); letter-spacing: -0.012em; }
.herotext { min-width: 0; }
/* The cake moment from design/hero, October 18, 2026, above the headline.
   Width and height on the img hold its place while it loads. */
.herobanner { display: block; margin: 4px 0 22px; border-radius: 20px; overflow: hidden; border: 1px solid var(--line); background: #0E0A06; aspect-ratio: 16 / 9; }
.herobanner img { display: block; width: 100%; height: 100%; object-fit: cover; }
/* The second half of the sentence, in honey italic: the live hive's own
   headline, "September 22. What will still matter?", said the same way. It
   was a pink to violet gradient clipped to the type, the one thing every
   generated landing page has, September 22, 2026. */
.glow { color: var(--honey); font-style: italic; font-weight: 600; }

/* Four beats, numbered, because what this site does is a sequence and a reader
   who does not already know it needs the order more than the detail.

   "display: block" is not tidiness here, it is the whole rule. There is a
   bare "li" rule a few hundred lines up that sets display to flex, written
   for the people and song lists where a year sits beside a name, and it
   applies to every list item on the site. Without the override the number,
   the heading and the
   paragraph became three flex columns, so every heading wrapped one word to a
   line down a narrow gutter. Nothing failed and nothing logged. It simply
   looked like it had not been designed.

   Numbered by the list rather than by hand, so a beat cannot be added in the
   middle and leave the numbers lying. */
.how { margin: 44px 0 0; }
.beats {
  list-style: none; counter-reset: beat; margin: 20px 0 0; padding: 0;
  display: grid; gap: 14px;
}
@media (min-width: 720px) { .beats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; } }
.beats li {
  display: block; counter-increment: beat;
  background: var(--cell); border: 1px solid var(--line); border-radius: 18px;
  padding: 20px 22px 22px;
}
.beats li::before {
  content: counter(beat);
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; margin: 0 0 13px;
  border-radius: 999px; background: rgba(244, 183, 64, 0.14);
  color: ${ACCENT}; font-size: 12.5px; font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.beats h3 { margin: 0 0 8px; font-size: 17px; line-height: 1.3; letter-spacing: -0.005em; }
.beats p { margin: 0; color: var(--dim); font-size: 14.5px; line-height: 1.62; }

.actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 22px 0 0; }
/* A small hive on the About page, so a stranger sees what a tile and a buzz
   are before reading a word about them. Drawn with the board's own rules,
   which is the point: it is not a picture of the hive, it is the hive, with
   nothing to press. September 22, 2026. */
.wboard.wsample { max-width: 360px; margin: 26px 0 0; pointer-events: none; }
.wsample .wtile { cursor: default; }
.wsample .wtile .wh { font-size: clamp(12px, calc(38cqi / var(--side, 8) * var(--fit, 1)), 22px); }
.wsample .wtile.big { justify-content: flex-end; gap: 10px; }
.wsamplesay { margin: 8px 0 0; font-size: 13px; color: var(--dim); max-width: 520px; }
.actions .btn { margin: 0; }
.btn.brand {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 14px 24px; font-size: 16px;
  background-image: linear-gradient(135deg, var(--honey-lite), var(--honey));
  color: var(--cream);
  box-shadow: 0 14px 34px rgba(244, 183, 64, 0.30);
  transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;
}
.btn.brand:hover {
  filter: brightness(1.07); transform: translateY(-2px);
  box-shadow: 0 20px 44px rgba(244, 183, 64, 0.40);
}
.btn.brand:active { transform: translateY(0); }

.fine { color: ${QUIET}; font-size: 13px; margin: 14px 0 0; max-width: 46ch; }
/* The About page as a how to play, September 22, 2026. Honey, the hive's
   own colour, for the three pieces that are the game: the button into it,
   the three buzzes and the rules. */
.btn.play {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 14px 26px; font-size: 16px; font-weight: 800; border-radius: 999px;
  background: linear-gradient(180deg, var(--honey-lite), var(--honey)); color: var(--on-honey); text-decoration: none;
  box-shadow: 0 12px 30px rgba(244, 183, 64, 0.28);
  transition: transform 140ms ease, filter 140ms ease;
}
.btn.play:hover { filter: brightness(1.06); transform: translateY(-2px); }
.bzz { display: inline-flex; gap: 5px; margin: 0 8px 0 0; vertical-align: -1px; }
.bzz i { display: inline-block; width: 11px; height: 11px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, var(--honey-lite), var(--honey)); box-shadow: 0 0 8px rgba(244, 183, 64, 0.5); }
.rules { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.rules li { display: inline-flex; align-items: baseline; gap: 6px; padding: 10px 16px; border-radius: 999px; background: var(--cell); border: 1px solid var(--line-strong); color: var(--cream-2); font-size: 14.5px; }
.rules li b { color: var(--honey-lite); }


.hl { display: block; text-decoration: none; color: inherit; flex: 1; }

.months {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px; margin: 22px 0 0; padding: 0;
}
.cal {
  min-width: 0; border-radius: 18px; padding: 15px 15px 12px;
  box-shadow: inset 0 0 0 1px transparent;
  transition: background 260ms ease, box-shadow 260ms ease;
}
/* The month that was jumped to, lit. This is the whole answer to a real
   problem: tapping a month scrolled the page a long way and landed on twelve
   identical grids with nothing saying which one had been asked for, so the one
   interactive thing on the page gave no sign at all that it had worked. A
   fragment is the only state a page with no script has, and ":target" is how
   it is read. */
.cal:target {
  background: rgba(244, 183, 64, 0.07);
  box-shadow: inset 0 0 0 1px rgba(244, 183, 64, 0.42), 0 22px 50px rgba(244, 183, 64, 0.12);
}
.cal:target h3 { color: var(--honey-lite); }
.cal:target .dow { border-bottom-color: rgba(244, 183, 64, 0.30); }
.cal .days a {
  background: rgba(255, 243, 224, 0.055); color: var(--cream-2); text-decoration: none; font-weight: 600;
  box-shadow: inset 0 0 0 1px rgba(255, 243, 224, 0.05);
  transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease, color 120ms ease;
}
.cal .days a:hover, .cal .days a:focus-visible {
  background-image: linear-gradient(140deg, var(--honey-lite), var(--honey));
  background-color: ${ACCENT};
  color: var(--on-honey); transform: translateY(-2px) scale(1.07);
  box-shadow: 0 10px 20px rgba(244, 183, 64, 0.38);
}
.cal .days a:focus-visible { outline: 2px solid var(--cream); outline-offset: 2px; }
/* February 29 in a year that does not have one. It still has a page, so it
   still has a square, marked rather than quietly dropped. */
.cal .days a.leap {
  background: none; color: ${QUIET};
  box-shadow: inset 0 0 0 1px rgba(244, 183, 64, 0.30);
}
.cal .days a.leap:hover, .cal .days a.leap:focus-visible {
  color: var(--on-honey); box-shadow: 0 10px 20px rgba(244, 183, 64, 0.38);
}
/* The square you are standing on, and the square today is.
   Named thispage rather than here, because .here is already the date label in
   the day bar and two unrelated things under one name is how a later edit to
   one of them quietly moves the other.
   Filled for this page and outlined for today, rather than two rings in two
   colours, so that the day they land on the same square both still read: a
   filled pink cell inside a blue ring. Two rings would have become one ring
   of an ambiguous colour.
   Today's rule is not here. It is in /today.css, generated per request,
   because these pages are baked into a deploy and a today written at build
   time is wrong by the next morning. */
.cal .days a.thispage {
  background-image: linear-gradient(140deg, var(--honey-lite), var(--honey));
  background-color: ${ACCENT}; color: var(--on-honey); font-weight: 700;
  box-shadow: 0 8px 18px rgba(244, 183, 64, 0.34);
}
p.calkey {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin: 20px 0 0; font-size: 12px; color: var(--dim);
}
p.calkey .sw {
  width: 12px; height: 12px; border-radius: 4px; display: inline-block;
}
p.calkey .sw + .sw { margin-left: 14px; }
p.calkey .sw.thispage { background: ${ACCENT}; }
p.calkey .sw.today { background: none; box-shadow: inset 0 0 0 2px ${TODAY}; }
@media (max-width: 900px) { .months { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

@media (max-width: 600px) {
  .months { grid-template-columns: 1fr; gap: 10px; }
  .cal .days a { font-size: 16px; border-radius: 12px; }
  .home .hero { margin-top: 4px; }
  .wrap.home { padding-left: 16px; padding-right: 16px; }

}

/* Nothing on this page needs to move for it to work. */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }

  .btn.brand, .cal, .cal .days a {
    transition: none;
  }
  .btn.brand:hover, .cal .days a:hover { transform: none; }
  .rem button { transition: none; }
  .rem button:active { transform: none; }
}

/* ---- The date page as a feed ---------------------------------------------

   Everything below here belongs to a date page. It is the half of the
   redesign that is not the covers: a bar you can move dates from, a count of
   what the page holds, six things picked out of everything, and the people as
   a row you push rather than a column you scroll.

   Nothing here runs. Same rule as the rest of the site: default-src 'none',
   so the drawer is <details>, the row is scroll snapping, and the motion is
   a keyframe. A script would be dropped by the browser with nothing drawn.
*/

/* The month's own colour, set per page on the wrapper. September is violet
   and March is not, so 366 pages that share a layout do not share a face.
   Only ever a second colour: the pink is the brand and it does not move. */
.day { --day: var(--honey); --day-soft: var(--honey-lite); }

/* The bar runs the whole width of the window, the way the live hive's
   always has, and lets the page's warm glow through. Nathan, September 22,
   2026: a near black strip the width of the column, sitting on the lighter
   top of the page, read as a dark slab with the pills on it. The bleed is
   the column's own margins negated and padded back, so the wordmark and
   the pills stay lined up with everything under them. */
.daybar {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 11px max(20px, calc(50vw - 50%)) 10px; margin: 0 calc(50% - 50vw) 4px;
  background: rgba(18, 13, 8, 0.78);
  -webkit-backdrop-filter: saturate(140%) blur(14px);
  backdrop-filter: saturate(140%) blur(14px);
  box-shadow: 0 1px 0 rgba(244, 183, 64, 0.18);
}
.daybar .mark {
  font-size: 20px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase;
  white-space: nowrap; color: ${PINK}; text-decoration: none;
  transition: color 140ms ease;
}
.daybar .mark:hover, .daybar .mark:focus-visible {
  color: var(--cream); text-decoration: underline; text-underline-offset: 6px; text-decoration-thickness: 2px;
}
.barnav { display: flex; align-items: center; gap: 4px; }
.barnav .here {
  font-size: 13px; font-weight: 700; color: var(--dim); padding: 0 4px;
  min-width: 52px; text-align: center; font-variant-numeric: tabular-nums; white-space: nowrap;
}
.arrow {
  width: 32px; height: 32px; flex: none; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  color: var(--dim); text-decoration: none; font-size: 15px;
  box-shadow: inset 0 0 0 1px rgba(255, 243, 224, 0.12);
  transition: color 140ms ease, background 140ms ease, box-shadow 140ms ease;
}
.arrow:hover {
  color: var(--cream); background: rgba(244, 183, 64, 0.16);
  box-shadow: inset 0 0 0 1px rgba(244, 183, 64, 0.55);
}
/* Was a filled pink pill with a glow under it, which is the single loudest
   thing a page can put in its top right corner and the one every generated
   landing page has. This page is a reference now, so the app is a word. */
.daybar .get {
  font-size: 13px; text-decoration: none; color: var(--dim);
  border-bottom: 1px solid transparent; padding-bottom: 1px;
}
.daybar .get:hover { color: var(--cream); border-bottom-color: var(--dimmer); }

/* The reader's own panel, injected by serve.ts for a reader who has given a
   birth year. It is the birthday payoff, so it reads warm and sits at the top. */
.me { margin: 4px 0 26px; padding: 22px; background: var(--cell); border: 1px solid var(--line); border-radius: 16px; }

@media (max-width: 400px) { .barnav .here { min-width: 44px; font-size: 12px; } .mark, .daybar .mark { font-size: 18px; letter-spacing: 0.16em; } }

/* The six. A card here is a card because it is one thing to read, not because
   every block on the page got the same rectangle. */
ul.feed { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 12px; }
ul.feed li {
  display: block; border-radius: 18px; padding: 16px 18px;
  background: linear-gradient(180deg, rgba(255, 243, 224, 0.055), rgba(255, 243, 224, 0.022));
  box-shadow: inset 0 0 0 1px rgba(255, 243, 224, 0.09);
  transition: box-shadow 180ms ease, background 180ms ease;
}
ul.feed li:hover {
  background: linear-gradient(180deg, rgba(244, 183, 64, 0.10), rgba(255, 243, 224, 0.03));
  box-shadow: inset 0 0 0 1px rgba(244, 183, 64, 0.42), 0 18px 38px rgba(0, 0, 0, 0.34);
}
ul.feed .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
ul.feed .tag {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase;
}
ul.feed .tag::before { content: ""; width: 6px; height: 6px; border-radius: 2px; background: currentColor; }

ul.feed .yr {
  font-family: var(--serif); font-size: 15px; font-weight: 700; color: ${QUIET};
  font-variant-numeric: tabular-nums;
}
ul.feed .said {
  font-family: var(--serif); font-size: 18px; line-height: 1.4;
  margin: 10px 0 0; text-wrap: pretty;
}
ul.feed .src { margin: 11px 0 0; font-size: 12px; }
ul.feed .src a { color: ${QUIET}; text-decoration: none; }
ul.feed .src a:hover { color: ${ACCENT}; text-decoration: underline; }
/* The oldest thing on the date, given the room to be the thing you read. */
ul.feed li.lead { padding: 22px 20px 20px; }
ul.feed li.lead .said { font-size: 23px; line-height: 1.28; }
ul.feed li.lead .yr { font-size: 30px; color: var(--day-soft); }

/* The rest, behind one tap. Present in the HTML, so it is still indexed and
   still answers a search: closed is a display state, not a missing page. */
details.more {
  margin: 12px 0 0; border-radius: 16px; overflow: hidden;
  background: rgba(255, 243, 224, 0.035);
  box-shadow: inset 0 0 0 1px rgba(255, 243, 224, 0.09);
}
details.more > summary {
  cursor: pointer; list-style: none; padding: 14px 18px;
  font-size: 14px; font-weight: 700; color: var(--cream);
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
}
details.more > summary::-webkit-details-marker { display: none; }
details.more > summary::after { content: "+"; color: ${ACCENT}; font-size: 17px; font-weight: 700; }
details.more[open] > summary::after { content: "\\2212"; }
details.more > summary:hover { background: rgba(244, 183, 64, 0.10); }
details.more .inner { padding: 2px 18px 16px; }
details.more ul { list-style: none; margin: 0; padding: 0; }
details.more ul li {
  display: flex; gap: 12px; align-items: baseline; background: none; border-radius: 0;
  padding: 12px 0; border-top: 1px solid var(--line);
}
details.more ul li:first-child { border-top: none; }
details.more .y {
  color: ${ACCENT}; font-weight: 700; font-size: 13px; width: 44px; flex: none;
  font-variant-numeric: tabular-nums;
}
details.more .x { font-family: var(--serif); font-size: 16px; line-height: 1.4; margin: 0; color: var(--cream-2); }
details.more .src { margin: 6px 0 0; font-size: 12px; }
details.more .src a { color: ${QUIET}; text-decoration: none; }

.who {
  width: 138px; border-radius: 16px; padding: 14px 13px 13px;
  background: linear-gradient(180deg, rgba(255, 243, 224, 0.055), rgba(255, 243, 224, 0.02));
  box-shadow: inset 0 0 0 1px rgba(255, 243, 224, 0.09);
  text-decoration: none; color: inherit; display: block;
  transition: box-shadow 160ms ease;
}
.who:hover { box-shadow: inset 0 0 0 1px rgba(244, 183, 64, 0.45), 0 16px 32px rgba(0, 0, 0, 0.4); }
.face {
  width: 54px; height: 54px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--serif); font-size: 20px; font-weight: 700; color: var(--on-honey);
  background-image: linear-gradient(140deg, var(--honey-lite), var(--honey));
}
/* Four so the row is not one colour, dealt by position and nothing else. No
   meaning is claimed by which face gets which. */
.who:nth-child(4n+2) .face { background-image: linear-gradient(140deg, var(--day-soft), var(--day)); }
.who:nth-child(4n+3) .face { background-image: linear-gradient(140deg, var(--ember), var(--honey)); }
.who:nth-child(4n+4) .face { background-image: linear-gradient(140deg, var(--cream-2), var(--honey-lite)); }
.who .n { font-weight: 700; font-size: 14px; margin: 11px 0 0; line-height: 1.25; }
.who .w { color: ${QUIET}; font-size: 12px; margin: 4px 0 0; line-height: 1.3; }
.who .b { color: ${ACCENT}; font-size: 11px; font-weight: 700; margin: 8px 0 0; font-variant-numeric: tabular-nums; }
.who .d { color: ${QUIET}; font-size: 11px; margin: 2px 0 0; }

@media (prefers-reduced-motion: no-preference) {
  ul.feed li { animation: rise 460ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards; }
  ul.feed li[style] { animation-delay: calc(var(--i) * 45ms); }
}

/* ---- Motion ---------------------------------------------------------------

   One timing system: 460 milliseconds, the curve the covers and the feed
   already rise on, and a 45 millisecond stagger. Every animation below is
   inside the no-preference media query and the page is complete with all of
   it off. Nothing here counts, climbs or ticks. The fuse is the model: a
   thing moves because it carries information the still page does not.

   1. The answer landing. A reader taps, the server redirects to the row, and
   the result, their own mark and the sentence at the top appear fully formed
   as if they had always been there. This is the only motion a reader causes
   rather than watches, so it is the one that matters most. The result bars
   draw out to their real width, which is the answer arriving; the reader's
   own words follow one beat later; the afterword at the top of the page
   rises when it is the target. Only the row just answered is the :target and
   only it carries a non-empty result, so nothing else on the page moves. */
@media (prefers-reduced-motion: no-preference) {
  :target .mine { animation: rise 460ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards; animation-delay: 270ms; }

  /* 2. The ask card, on the three open dates. Its parts arrive in reading
     order, label, year, sleeve, sentence, then the three buttons one beat
     apart, so the eye is led to the thing to do. The card itself does not
     move: it is the page, not a visitor to it. The ask never carries a heavy
     row, because mayLead in highlight.ts chose it. */
  .ask .rem button {
    animation: rise 460ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards;
  }

  .ask .rem button:nth-child(5) { animation-delay: 225ms; }
  .ask .rem button:nth-child(6) { animation-delay: 270ms; }
  .ask .rem button:nth-child(7) { animation-delay: 315ms; }

  /* 3. The dot. Baked here is only the shape of the breath; today.css
     starts it, and only on the three open dates, because a grey dot
     breathing on a sealed page would say the page is live when it is not.
     Four seconds. A fast pulse is an alarm. */
  .rem button { transition: transform 120ms ease, color 140ms ease, border-color 140ms ease, background 140ms ease; }

}
@keyframes breathe {
  0%, 100% { box-shadow: 0 0 0 4px rgba(111, 165, 222, .18); }
  50% { box-shadow: 0 0 0 7px rgba(111, 165, 222, .08); }
}
/* Where the redirect lands after an answer. The bar is sticky and 56 pixels
   tall, and a row scrolled flush to the top of the window sits under it, so
   the thing that just arrived is the one thing hidden. Not motion, but it is
   the landing, so it lives with the landing. */
.ask, ul.feed li, details.more li { scroll-margin-top: 72px; }
/* A press, felt. Not in the media query: a transform on :active is a state,
   not a motion, and the transition that softens it is switched off below. */
.rem button:active { transform: scale(.96); }
`;

/**
 * The top of every page.
 *
 * `bodyClass` is how one page gets a look the others do not. The front door
 * is the only page on the site that is a landing page rather than a document,
 * so it is the only one that gets the wider column and the light behind the
 * heading, and it asks for those by name rather than by every other page
 * being told to opt out of them.
 */
/**
 * The picture a link preview shows, and how big it is.
 *
 * A plain address still means the wide card, which is what most pages have
 * and what every platform crops a preview to. A date whose hive has tiles on
 * it hands in the square instead, and the width and height have to travel
 * with it: a 1080 by 1080 picture announced as 1200 by 630 is a card that
 * lays out wrong before anybody has looked at it.
 */
export type PreviewImage = string | { url: string; width: number; height: number };

/**
 * The side of the square, repeated here rather than imported.
 *
 * share.ts already imports this file, so importing it back makes a cycle, and
 * a cycle around a constant read at module load is the kind of undefined that
 * only shows up in one of the two entry points. A test asserts this number
 * and `SQUARE_SIDE` are the same, so the copy cannot drift in silence.
 */
const SQUARE = 1080;

/**
 * The stylesheet as it is sent: the three sources with their comments taken
 * out. The comments are the reasoning behind each rule and belong in the
 * source; on the wire they were 39 of every page's 109 kilobytes of style,
 * September 22, 2026. Computed once. No rule on this site puts a comment
 * opener inside a string, and a test holds it to that.
 */
export function stripCss(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n\s*\n+/g, "\n").replace(/^[ \t]+/gm, "").trim();
}

const PAGE_STYLE = stripCss(`${THEME}${STYLE}${WALL_STYLE}${SHARE_STYLE}${MASCOT_STYLE}`);

export function head(
  title: string,
  description: string,
  canonical: string,
  image?: PreviewImage,
  noindex = false,
  bodyClass = "",
  // Anything one kind of page needs in its head and the others do not. A
  // seventh positional argument is not lovely, but the alternative was for
  // every page to carry a field that only date pages ever fill.
  extraHead = "",
): string {
  const picture = typeof image === "string" ? { url: image, width: 1200, height: 630 } : image;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/today.css">
${noindex ? '<meta name="robots" content="noindex">\n' : ""}
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
${picture ? `<meta property="og:image" content="${picture.url}">
<meta property="og:image:width" content="${picture.width}">
<meta property="og:image:height" content="${picture.height}">
<meta name="twitter:image" content="${picture.url}">` : ""}
<meta name="twitter:card" content="summary_large_image">
${extraHead}<style>${PAGE_STYLE}</style>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}><div class="wrap${bodyClass ? ` ${bodyClass}` : ""}">`;
}

const CREDIT = `<p>Names, years and descriptions come from <a href="https://www.wikidata.org">Wikidata</a>, released under <a href="https://creativecommons.org/publicdomain/zero/1.0/">Creative Commons Zero</a>. Credit to Wikipedia and Wikidata.</p>
<p>Birthed is not affiliated with Wikipedia, Wikidata or the Wikimedia Foundation.</p>`;

const SITELINKS = `<p class="sitelinks"><a href="/">Today</a> · <a href="/about/">About</a> · <a href="/support/">Support</a> · <a href="/privacy/">Privacy</a></p>`;

/**
 * The footer, and the one sentence on it that is not a credit.
 *
 * A page that collects nothing looks exactly like a page that collects
 * something, because what is missing is the part nobody can see. The site was
 * posted to Reddit on September 6 and the top comment, at 28 points, was that
 * it exists to harvest birthdays and sell them to advertisers, above copy on
 * the front door that already promised the opposite. More promising was never
 * going to answer that.
 *
 * So the line is short, it is on every page rather than on a policy nobody
 * opens, and every clause in it is something a reader can check in the
 * network tab in five seconds rather than something they have to believe.
 * That is why it does not say "we respect your privacy" and does not say
 * "your data is safe with us", which are claims about intentions and are what
 * a site that did collect would also say.
 *
 * It stops short of "runs no scripts", though that is nearly true, because
 * every date page carries one script element holding the structured data a
 * search engine reads. Nothing executes it and the policy header would refuse
 * it if anything tried. Writing the stronger sentence would hand the one
 * reader who opens the source a reason to disbelieve the rest of it, and the
 * whole point of the line is that it survives being checked.
 *
 * **It said "this page sets no cookies" until 8 September 2026, and answering
 * made that false.** A POST to record an answer comes back with a one year
 * `bt` cookie, so the sentence written to survive the network tab was refuted
 * by the network tab, on 366 pages, in the exact place a suspicious reader
 * looks first. "Nothing to fill in" went the same way when the answer buttons
 * and the birth year picker arrived. The rule this breaks is not a style rule:
 * a checkable claim that is false is worse than no claim, because the reader
 * who checks is the reader who was going to defend the site in the comments.
 * So the cookie is now named in the line itself rather than admitted on a
 * policy page. Anything that later stores something new about a reader has to
 * be added here in the same commit, or this sentence is a lie again.
 */
export const FOOT = `<footer>
${SITELINKS}
<p class="nothing">No account, no sign up, and nothing on this page is loaded from another company. Buzz something and one random string is kept in a cookie, so the same browser gets its few buzzes a day and no more. That is the whole of what is kept about you.</p>
${CREDIT}
</footer>`;

/**
 * The footer for /add, which is the one page the sentence above is false on.
 *
 * /add exists to hand a birthday from somebody who has the app to somebody who
 * does not. It has a form, it runs a script, and it posts to the project. It
 * is the only page on the site with its own widened policy header for exactly
 * that reason, and it is the only page that must not carry a line saying there
 * is nothing to fill in.
 */
export const FOOT_ADD = `<footer>
${SITELINKS}
${CREDIT}
</footer>
</div></body></html>`;

/**
 * The month's own colour.
 *
 * By month rather than by date, so September is violet on all thirty of its
 * pages and a reader moving between neighbouring days is not repainted every
 * tap. Twelve hues around the wheel, kept away from the brand pink so the two
 * never argue, and given to the page as a custom property rather than to any
 * one rule.
 */
export function dayHue(_month: number): { day: string; soft: string } {
  // Until September 22, 2026 every month had its own hue, 30 degrees apart,
  // so that 366 pages sharing a layout did not share a face. That gave the
  // site twelve second colours on top of the two it already had. One look
  // now, the hive's: every date is honey. The function stays because six
  // call sites write the pair into a style attribute and the rules read it,
  // and a month is still passed so the twelve faces can come back as tints
  // of honey one day without touching the callers.
  return { day: "var(--honey)", soft: "var(--honey-lite)" };
}

/**
 * Where a person's photograph lives on birthed.app.
 *
 * Named from the Wikidata identifier rather than from the person's name,
 * because a name is not unique, changes spelling between sources, and contains
 * characters a filesystem argues about. The identifier is stable forever.
 *
 * Copied onto this domain rather than pointed at Commons, for exactly the
 * reason download-covers.ts gives about Apple: the site sends `img-src 'self'`
 * and the privacy page names Supabase and Render as the only companies that
 * see anything about a reader. Hotlinking would mean widening that header and
 * announcing every visitor to the Wikimedia Foundation in exchange for a
 * thumbnail.
 */
export function faceName(qid: string): string {
  return qid.replace(/[^A-Za-z0-9]/g, "");
}

// The three marks in the bar's end. Our own line drawings, one stroke weight,
// the same box, so the three read as a set. Not emoji: an emoji is drawn by
// whichever phone or computer is looking, and looks like three different
// sets on three different screens.
const INFO = `<svg class="ic" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2"/><circle cx="12" cy="7.9" r="0.9" fill="currentColor" stroke="none"/></svg>`;

const TODAY_ICON = `<svg class="ic" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3.4" y="5" width="17.2" height="15.6" rx="3.6"/><path d="M3.4 10.2h17.2M8.2 3.2v3.6M15.8 3.2v3.6"/><circle cx="12" cy="15.4" r="1.6" fill="currentColor" stroke="none"/></svg>`;

/**
 * The bar's end: Today and About, as two matching pills. Every date and
 * Random came off on October 18, 2026, docs/strip-to-the-hive.md: most
 * dates have no hive yet, so both led to an empty promise. Before that it
 * was Today, Every date, Random and About, as four matching pills. The app pill came off on September 22, 2026: the way to the app
 * is the About page's one quiet line, and nowhere else. They used to be one pill and two bare words, which is
 * three controls that look like three different kinds of thing. Nathan,
 * September 10, 2026: same size, same border, an icon each, and the word
 * kept next to it so nobody has to guess what a die does.
 *
 * The same five, in the same order, on every page since September 22, 2026.
 * The date page said Random, Every date, About; the About page said Today,
 * Every date, Random day; the live hive said Back to the day. One set of
 * words in one order is what makes a site read as one site.
 */
function barEnd(): string {
  return `<span class="barend">
<a class="pill" href="/today/" title="Today's date" aria-label="Today's date">${TODAY_ICON}<span>Today</span></a>
<a class="pill" href="/about/" title="About Birthed" aria-label="About Birthed">${INFO}<span>About</span></a>
</span>`;
}

/**
 * The one bar, on every page: the wordmark, whatever the page puts in the
 * middle (a date stepper, or the date a hive or comb belongs to, or
 * nothing), then the five pills.
 */
export function siteBar(middle: string = ""): string {
  return `<div class="daybar">
<a class="mark" href="/" title="Birthed home">Birthed</a>
${middle}${barEnd()}
</div>`;
}

/**
 * A date page, October 18, 2026, docs/strip-to-the-hive.md: the hive for
 * the date and nothing else. The song prompt, the archive (history, Born on,
 * Number ones by year), the comb, the birthday box and the suggestion box
 * came off, and none of it is baked for search either: the search experiment
 * is over. What is left is the game: the board, what a reader has left to
 * spend, the crown and when the date seals.
 *
 * `wall` is the newest hive the month and day have, or null for a date that
 * has not had one yet, which draws the promise of when it opens. `pictures`
 * are the pictures the build holds for the tiles on that board.
 */
export function renderDayPage(
  date: { month: number; day: number },
  wall: WallDay | null = null,
  pictures: Picture[] = [],
): string {
  const name = `${monthName(date.month)} ${date.day}`;
  const canonical = `${SITE}/${slug(date.month, date.day)}/`;
  const { previous, next } = neighbours(date.month, date.day);
  // The square where the date has a board, the wide card everywhere else.
  const hived = hasBoard(wall);
  const image: PreviewImage = hived
    ? { url: `${SITE}/og/${slug(date.month, date.day)}-square.png`, width: SQUARE, height: SQUARE }
    : `${SITE}/og-home.png`;
  const description = hived
    ? `The hive for ${name}: what people buzzed as the things that will still matter in ten years, sealed at midnight Eastern.`
    : `The hive for ${name}. Every day, people buzz what will still matter in ten years, and at midnight Eastern the day seals for good.`;
  const sequence = `<link rel="prev" href="${SITE}/${slug(previous.month, previous.day)}/">
<link rel="next" href="${SITE}/${slug(next.month, next.day)}/">
`;
  const hue = dayHue(date.month);
  const shortName = `${monthName(date.month).slice(0, 3)} ${date.day}`;

  // noindex until the date has a board: an empty promise is not a page
  // worth a search result.
  return `${head(`The hive for ${name}`, description, canonical, image, !hived, "", sequence)}
<div class="day on-${slug(date.month, date.day)}" style="--day:${hue.day};--day-soft:${hue.soft}">
${siteBar(`<span class="barnav">
<a class="arrow" href="/${slug(previous.month, previous.day)}/" title="${monthName(previous.month)} ${previous.day}" aria-label="${monthName(previous.month)} ${previous.day}">&lsaquo;</a>
<span class="here">${shortName}</span>
<a class="arrow" href="/${slug(next.month, next.day)}/" title="${monthName(next.month)} ${next.day}" aria-label="${monthName(next.month)} ${next.day}">&rsaquo;</a>
</span>
`)}
<h1>${name}</h1>
${pictureRules(pictures)}
${wallSection(wall, name, Date.now(), { date: { month: date.month, day: date.day } })}
</div>
<p class="signed">Made by <a href="/about/">Jason Evan Page</a>, one person. No ads, nothing for sale.</p>
${FOOT}`;
}

/** Whether a hive has anything on its board: a placed tile, or one stamped false. */
export function hasBoard(wall: WallDay | null): boolean {
  return wall !== null && wall.stories.some((s) => s.rect !== null && (s.status === "placed" || s.status === "false"));
}

/**
 * The receipt page for one story on the wall. docs/the-wall.md section 5:
 * every source, every quotation, every check, kept and visible. It is plain
 * on purpose, and it carries noindex because a receipt is for a reader who
 * followed a tile, not for a search result.
 */
export function renderStoryPage(story: WallStory, day: WallDay, now: number = Date.now(), options: ReceiptOptions = {}): string {
  const name = `${monthName(day.month)} ${day.day}`;
  const canonical = `${SITE}/${slug(day.month, day.day)}/wall/${story.id}/`;
  const hue = dayHue(day.month);
  return `${head(`${story.headline}, on the hive for ${name}, ${day.year}`,
    `A story on the Birthed hive for ${name}, ${day.year}, with its sources, quotations and every check run on them.`,
    canonical, undefined, true)}
<div class="day wstory" style="--day:${hue.day};--day-soft:${hue.soft}">
${siteBar()}
${storyBody(story, day, now, options)}
</div>
${FOOT}`;
}

/**
 * A reader's card for a date, with a way to send it. Hana's walkthrough,
 * September 22, 2026: "Save your card" opened a bare picture, which a phone
 * can keep but cannot hand to anybody without three more steps.
 *
 * The picture is the same one address as before, /<date>/yours.png, chosen by
 * the reader's cookie and never by the address, so this page names no year
 * either. What it adds is the share control, which is one of the two pages
 * on the site allowed to run the share script (share-button.ts), and a plain
 * save link for everybody else. What is shared is the picture when the phone
 * can take one, and the date page's address otherwise: never this page's,
 * which is one reader's own.
 */
export function renderCardPage(month: number, day: number, mine: boolean): string {
  const name = `${monthName(month)} ${day}`;
  const at = slug(month, day);
  const hue = dayHue(month);
  const heading = mine ? `Your card for ${name}` : `The card for ${name}`;
  return `${head(heading, `A picture of ${name} on Birthed, to keep or send.`, `${SITE}/${at}/card/`, undefined, true)}
<div class="day wstory wcard" style="--day:${hue.day};--day-soft:${hue.soft}">
${siteBar()}
<p class="wback"><a href="/${at}/">&larr; ${escapeHtml(name)}</a></p>
<h1 class="wtitle">${escapeHtml(heading)}</h1>
<p class="wnote">${mine ? "Made for you from the birthday you gave this browser. The picture carries no name and no year." : `The hive for ${escapeHtml(name)}. Give the site your birthday on the date page and this becomes your own version.`}</p>
<img class="cardimg" src="/${at}/yours.png" alt="${escapeHtml(heading)}" width="1080" height="1080">
${shareBlock({ url: `${SITE}/${at}/`, title: `${name} on Birthed`, file: `/${at}/yours.png` })}
<p class="wnote cardsave"><a href="/${at}/yours.png" download="birthed-${at}.png">Save the picture</a>. On a phone you can also press and hold it.</p>
</div>
${FOOT}`;
}

/**
 * This browser's own record: every story it has buzzed, and what became of
 * each one. docs/the-wall.md section 25.
 *
 * A list and never a total. No count, no rank, no streak, no score, and
 * nothing at all about anybody else: the anniversary block's rules, widened
 * from one calendar date to all of them. The headline and the date are
 * already public on the date page and so is the verdict; the only thing
 * this page adds is that this browser buzzed these things, and it adds it
 * only for that browser.
 *
 * Rendered per request and answered `no-store`, noindex, and running no
 * script. It needs no widening of the security policy and must never
 * acquire one.
 *
 * An empty page is not an error. A reader who cleared the cookie has an
 * empty record and buzzes that still count, and the page says so rather
 * than leaving them to think the buzzes were lost. A read that failed is
 * the one case that must not answer "nothing", and `failed` is how it says
 * so instead.
 */
export function renderRecord(rows: RecordRow[], failed = false): string {
  const canonical = `${SITE}/yours/`;
  const list = failed
    ? `<p class="wnote wyoursnone">This page could not be read just now, and that was this end rather than yours. Nothing about your buzzes has changed. Try it again in a minute.</p>`
    : rows.length === 0
    ? `<p class="wnote wyoursnone">Nothing here yet. A story you buzz turns up on this page, with what became of it.</p>
<p class="wnote">If you have buzzed something before, this browser has forgotten which: the page is read from the one random string in the cookie described on the <a href="/privacy/">privacy page</a>, so clearing it empties this list. The buzzes themselves are still on their hives and still count. There is no account here to sign in to and get them back, and there is not going to be one.</p>`
    : `<ul class="wyourslist">
${rows.map((row) => {
      const { month, day } = partsOf(row.wallDate);
      const name = `${monthName(month)} ${day}, ${row.wallDate.slice(0, 4)}`;
      return `<li><a href="/${slug(month, day)}/wall/${row.storyId}/">${escapeHtml(row.headline)}</a>`
        + `<span class="wyoursmeta"><span class="wyourswhen">${escapeHtml(name)}</span>`
        + `<span class="wyoursstate">${escapeHtml(recordStanding(row))}</span></span></li>`;
    }).join("\n")}
</ul>
<p class="wnote">Open means the date is still taking buzzes. On the board and In the pool are how the story ended when its date sealed. Held, Forgotten and Shown false are what became of it afterwards, and the first two cannot exist before September 9, 2027.</p>`;
  return `${head("Everything you have buzzed",
    "The stories this browser has buzzed on Birthed, and what became of each one. Private to this browser.",
    canonical, undefined, true)}
<div class="day wstory" style="--day:${dayHue(9).day};--day-soft:${dayHue(9).soft}">
${siteBar()}
<h1 class="wyourshead">Everything you have buzzed</h1>
<p class="wnote">Only you can see this page. It is read from this browser and it is not a score: there is no number on it, no rank, and nothing about anybody else.</p>
${list}
</div>
${FOOT}`;
}

/** The month and day of a wall date, for a page that only ever gets good ones from the database. */
function partsOf(wallDate: string): { month: number; day: number } {
  const [, m = "1", d = "1"] = wallDate.split("-");
  return { month: Number(m), day: Number(d) };
}

/**
 * The hive alone, as big as the window. docs/the-wall.md section 13:
 * the canvas is the product, and a canvas drawn at half a column is not one.
 * Baked with the wall the build saw and swapped live by serve.ts on the
 * three open dates, the same as the date page. noindex, because it is a
 * view of the date page and not a second page about the date.
 */
export function renderHivePage(day: WallDay, month: number, d: number, pictures: Picture[] = []): string {
  const name = `${monthName(month)} ${d}`;
  const canonical = `${SITE}${hivePath(month, d)}`;
  const hue = dayHue(month);
  return `${head(`The hive for ${name}, ${day.year}`,
    `The Birthed hive for ${name}, ${day.year}: what people think will still matter about it, sized by how many buzzed each story.`,
    canonical, `${SITE}/og/${slug(month, d)}.png`, true, "hivepage")}
<div class="day wsq on-${slug(month, d)}" style="--day:${hue.day};--day-soft:${hue.soft}">
${siteBar(`<span class="barnav"><a class="here" href="/${slug(month, d)}/">${escapeHtml(name)}</a></span>
`)}
${pictureRules(pictures)}
${wallSection(day, name, Date.now(), { hive: true, date: { month, day: d } })}
</div>
${FOOT}`;
}

/**
 * The index of all 366, on its own page. It sat at the foot of every date
 * page, which made every date page a calendar with a date on top. The top
 * bar links here from everywhere.
 */
export function renderCalendarPage(year: number): string {
  return `${head("Every day of the year", "Pick a date and see its hive, who shares it and what happened on it.", `${SITE}/calendar/`, undefined, false, "calendarpage")}
<div class="day">
${siteBar()}
<section class="everyday">
<h1>Every day of the year</h1>
<p class="lede">Pick a date and see its hive, who shares it and what happened on it. The weeks are laid out the way they fall in ${year}.</p>
${calendar(year)}
</section>
</div>
${FOOT}`;
}

/**
 * The page Render serves for a path that is not one of the 366. Static hosts
 * answer an unknown path with whatever 404.html holds, and without one they
 * answer with a page that says 200, which is how a site teaches a crawler
 * that every misspelling is a real page.
 *
 * noindex, because this page is a dead end and there is nothing on it worth
 * having in an index.
 */
export function renderNotFound(): string {
  return `${head("Not a date", "That is not one of the 366.", `${SITE}/`, undefined, true)}
<p class="kicker">Birthed</p>
<h1>Not a date</h1>
<p class="lede">There are 366 of them and that was not one. <a href="/">Pick one</a>.</p>
${FOOT}`;
}

/**
 * Only the pages that are ready.
 *
 * A sitemap is a claim that these are the pages worth having. Listing a page
 * that says noindex is a contradiction, and a crawler that is handed 366 URLs
 * and finds 234 of them empty draws the obvious conclusion about the other
 * 132.
 */
export function renderSitemap(ready?: Array<{ month: number; day: number }>): string {
  const dates = ready ?? everyDate();
  const urls = [`${SITE}/`, `${SITE}/support/`, `${SITE}/privacy/`, ...dates.map((d) => `${SITE}/${slug(d.month, d.day)}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `<url><loc>${url}</loc><changefreq>monthly</changefreq></url>`).join("\n")}
</urlset>`;
}

export function renderRobots(): string {
  // /random/ and /today/ are redirects, not pages. A crawler that followed
  // them would find one of the 366 under a second address and have to work
  // out that it already had it, and /today/ would answer differently every
  // night. Neither is worth a crawl budget, and neither is a page anybody
  // should arrive at from a search result.
  //
  // /yours is one browser's own record, docs/the-wall.md section 25. A
  // crawler carries no cookie, so the only page it could file is the empty
  // one, and that page has no business in anybody's index. The page itself
  // also carries noindex, because a rule in a file is a request and the tag
  // is on the page.
  return `User-agent: *\nAllow: /\nDisallow: /random\nDisallow: /today\nDisallow: /yours\n\nSitemap: ${SITE}/sitemap.xml\n`;
}

