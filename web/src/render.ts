// Rendering a date page. Pure string in, string out, so it can be tested
// without a network and without a browser.

import { DayPage, Person, monthName, neighbours, slug, everyDate } from "./model.js";
import { SHARE_STYLE, shareBlock } from "./share-button.js";
import { MASCOT_STYLE } from "./mascot.js";
import { THEME } from "./theme.js";
import { WALL_STYLE, combPath, hivePath, pictureRules, recordStanding, storyBody, wallSection, type Picture, type RecordRow, type ReceiptOptions, type WallDay, type WallStory } from "./wall.js";
import { CHART_NAME, coverName, SongOfTheYear } from "./songs.js";
import { calendar } from "./calendar.js";
import { type CulturalEvent, textOf } from "./culture.js";
import { Fact, hostOf } from "./facts.js";
import { buildTimeline, byMemory, pickHighlights, theRest, type DayEvent, type MemoryCount, type TimelineRow } from "./timeline.js";
import { mayAsk, mayLeadWords } from "./highlight.js";
import { leadKey } from "./lead.js";
import { bestMatch, selectedKey, type Selected } from "./selected.js";

/**
 * How many people a date page needs before it is worth putting in front of a
 * search engine.
 *
 * A new domain that publishes 366 pages, 234 of which are thin or half
 * imported, teaches Google that this site is thin. That judgement is expensive
 * to undo and it is made once. So a page that is not ready is still built and
 * still reachable by anybody who types the address, and it carries noindex and
 * stays out of the sitemap until it has something on it.
 *
 * FR-022 asks for at least ten. Eight is the line here rather than ten because
 * a handful of real dates genuinely have fewer people with English articles,
 * and holding those back forever would be worse than showing eight.
 */
export const READY_PEOPLE = 8;

/**
 * Enough people, and evidence that they were actually ranked.
 *
 * Counting people alone was not enough, and the way it failed is instructive.
 * The dates imported before pageviews existed have their full ten and are
 * ordered by how many languages have an article about somebody, which is
 * coverage rather than attention, and it fills a page with footballers. Those
 * pages pass a head count and are exactly the ones that should not be handed
 * to a search engine, because they are the worst version of the thing this
 * site is for.
 *
 * So a page is ready when it has the people and at least one of them carries
 * pageviews. This is the same test the worker's --only-missing uses, for the
 * same reason.
 */
export function isReady(page: DayPage, facts: Fact[] = []): boolean {
  // January 1, and only January 1. Wikidata files a birth date known only to
  // the year as January 1 with a precision of 9, so the importer's precision
  // filter correctly refuses every one of them and this date has nobody on it
  // and never will. It is also one of the most searched dates of the year.
  // A page with a dozen sourced facts, the number one song for every year
  // since 1959, and an honest line saying nobody is imported yet, is not a
  // thin page, and holding it back forever on a head count it can never meet
  // is the rule misfiring rather than working.
  if (page.people.length === 0) return facts.length >= READY_PEOPLE;
  if (page.people.length < READY_PEOPLE) return false;
  return page.people.some((person) => person.monthlyViews > 0);
}

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

// Only the birth year goes in the column. A range wraps, and a wrapped range
// shoves every name on the page out of alignment with the ones above it.
function birthYearLabel(person: Person): string {
  return person.birthYear ? String(person.birthYear) : "";
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
.sen { display: none; }
.senshut { display: inline; }
.sen b { color: var(--cream); font-weight: 700; }
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
.askhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px 0; }
.asklab { font-size: 10.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--day-soft, var(--honey-lite)); }
.askyr { font-family: var(--serif); font-size: 26px; font-weight: 700; color: var(--day-soft, var(--honey-lite)); line-height: 1; }
.askbody { display: grid; grid-template-columns: 64px 1fr; gap: 14px; padding: 10px 16px 0; align-items: start; }
.askbody.noart { grid-template-columns: 1fr; }
.askart { width: 64px; aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: var(--cell); box-shadow: 0 6px 18px rgba(0, 0, 0, .45); }
.askart img { width: 100%; height: 100%; object-fit: cover; display: block; }
.asksaid {
  margin: 0; font-family: var(--serif);
  font-size: clamp(17px, 4.4vw, 22px); line-height: 1.3; text-wrap: pretty;
}
.askcap { grid-column: 1 / -1; font-size: 11.5px; color: var(--dimmer); line-height: 1.35; margin: 4px 0 0; }
.askcap b { color: var(--dim); font-weight: 600; }
/* The row's own sentence, under a line somebody wrote for it. Its own block
   rather than a run of the caption, because it is a different kind of thing
   from the record sleeve note beside it: that is context, this is the source
   text the question was written from. */
.askrec { display: block; margin: 0 0 3px; color: var(--dim); }
.askcap a { color: var(--dimmer); text-decoration: none; }
.askcap a:hover { color: ${ACCENT}; text-decoration: underline; }
/* Same three words every row further down uses, bigger here, once, because
   this is where the mechanic is taught. */
.ask .rem { gap: 8px; margin: 0; padding: 12px 16px 4px; }
.ask .rem button {
  font-size: 14.5px; font-weight: 600; min-height: 42px; padding: 11px 15px;
  background: rgba(255, 243, 224, .06); color: var(--cream); border-color: rgba(255, 243, 224, .18);
}
.ask .rem button:hover { border-color: var(--day-soft, var(--honey-lite)); background: rgba(255, 207, 107, .14); }
.ask .mine { padding: 6px 16px 0; margin: 0; }
.askrule { margin: 0; padding: 6px 16px 14px; font-size: 12.5px; color: var(--dimmer); line-height: 1.45; }
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
.wlist li.hist { display: flex; gap: 12px; align-items: baseline; }
.wlist .fyr { flex: none; width: 46px; font-family: var(--serif); font-size: 17px; color: var(--honey); font-variant-numeric: tabular-nums; }
.wlist .fbody { min-width: 0; flex: 1; }
.wlist .fbody a, .wlist .ftext { font-weight: 600; text-decoration: none; }
.wlist .fbody a:hover { text-decoration: underline; }
.wlist .fbody .wmeta { margin-left: 4px; }
.wlist .rem { display: none; margin: 0 0 0 6px; vertical-align: middle; }
.wlist .mine { display: none; margin: 4px 0 0; font-size: 12px; font-weight: 700; color: var(--honey); }
.wlist .mine::after { content: ""; }
.state { margin: 26px 0 0; }
.memorynote {
  margin: 26px 0 -8px; font-size: 13px; color: ${QUIET};
  border-left: 2px solid var(--day-soft, var(--honey-lite)); padding-left: 12px;
}
/* The one thing this site asks a reader about themselves.

   Decade, then year. Two taps, nothing to scroll, and every option on screen
   at the size of a finger.

   The version before this was one strip of ninety years that scrolled
   sideways, which was wrong for everybody and worst for the people most likely
   to have a year worth collecting. A horizontal scroller is a poor control on
   a phone and a genuinely bad one with a mouse, and finding 1955 in it meant
   dragging through seventy numbers to get there.

   No script, as everywhere else on this site. Ten hidden radios hold the only
   state there is, and the checked one reveals its own row of years through a
   sibling selector. That is the same mechanism the song year dial already
   runs on. */
.yearask { display: none; margin: 26px 0 30px; }
/* Once the year is in a cookie, the question is answered and asking it again
   on every date page is the site not listening. The server knows: it set that
   cookie and it reads it on the way back, so it hides the picker and shows this
   line instead, with the decade written in by the same style block that carries
   a reader's own marks.

   Not simply hidden, because hiding it is the only way back to it. The link
   targets the picker and :target brings it out again, which is a way to change
   your mind that needs no script and no second page. */
.yearset { display: none; margin: 26px 0 30px; font-size: 13px; color: var(--dimmer); }
.yearset a { color: var(--dim); text-decoration: none; border-bottom: 1px solid var(--line); }
.yearset a:hover { color: var(--cream); }
.yearsetv { color: var(--cream-2); }
.yearlede { margin: 0 0 12px; font-size: 14px; color: var(--cream-2); }
.yearlede b { color: var(--cream); font-weight: 700; }
.yearask form { margin: 0; }
.decpick { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

.yeardecs, .yg { display: flex; flex-wrap: wrap; gap: 8px; }
.yeardecs label, .yg button {
  font: inherit; font-size: 15px; font-weight: 700; line-height: 1; cursor: pointer;
  padding: 13px 15px; border-radius: 12px; border: 1px solid var(--line);
  background: var(--cell); color: var(--cream-2); font-variant-numeric: tabular-nums;
}
.yeardecs label:hover, .yg button:hover { color: var(--cream); border-color: var(--day-soft, var(--honey-lite)); }
.decpick:focus-visible ~ .yeardecs label[for] { outline: 2px solid ${ACCENT}; outline-offset: 2px; }

/* Nothing is shown until a decade is picked, which is why the years are
   display:none rather than merely hidden: an empty row that took up space
   would read as a control that had failed. */
.yg { display: none; margin: 10px 0 0; }
.yearyears { min-height: 0; }
#dec2020:checked ~ .yearyears .yg2020 { display: flex; }
#dec2020:checked ~ .yeardecs label[for="dec2020"] { background: ${ACCENT}; border-color: ${ACCENT}; color: var(--on-honey); }
#dec2010:checked ~ .yearyears .yg2010 { display: flex; }
#dec2010:checked ~ .yeardecs label[for="dec2010"] { background: ${ACCENT}; border-color: ${ACCENT}; color: var(--on-honey); }
#dec2000:checked ~ .yearyears .yg2000 { display: flex; }
#dec2000:checked ~ .yeardecs label[for="dec2000"] { background: ${ACCENT}; border-color: ${ACCENT}; color: var(--on-honey); }
#dec1990:checked ~ .yearyears .yg1990 { display: flex; }
#dec1990:checked ~ .yeardecs label[for="dec1990"] { background: ${ACCENT}; border-color: ${ACCENT}; color: var(--on-honey); }
#dec1980:checked ~ .yearyears .yg1980 { display: flex; }
#dec1980:checked ~ .yeardecs label[for="dec1980"] { background: ${ACCENT}; border-color: ${ACCENT}; color: var(--on-honey); }
#dec1970:checked ~ .yearyears .yg1970 { display: flex; }
#dec1970:checked ~ .yeardecs label[for="dec1970"] { background: ${ACCENT}; border-color: ${ACCENT}; color: var(--on-honey); }
#dec1960:checked ~ .yearyears .yg1960 { display: flex; }
#dec1960:checked ~ .yeardecs label[for="dec1960"] { background: ${ACCENT}; border-color: ${ACCENT}; color: var(--on-honey); }
#dec1950:checked ~ .yearyears .yg1950 { display: flex; }
#dec1950:checked ~ .yeardecs label[for="dec1950"] { background: ${ACCENT}; border-color: ${ACCENT}; color: var(--on-honey); }
#dec1940:checked ~ .yearyears .yg1940 { display: flex; }
#dec1940:checked ~ .yeardecs label[for="dec1940"] { background: ${ACCENT}; border-color: ${ACCENT}; color: var(--on-honey); }
#dec1930:checked ~ .yearyears .yg1930 { display: flex; }
#dec1930:checked ~ .yeardecs label[for="dec1930"] { background: ${ACCENT}; border-color: ${ACCENT}; color: var(--on-honey); }
.yearnote { font-size: 11.5px; color: ${QUIET}; margin: 10px 0 0; }
/* Said only after the server has redirected here, revealed by :target, which
   is how this page says anything back without running a script. */
.afterword {
  display: none; margin: 14px 0 0; padding: 13px 15px; border-radius: 12px;
  background: var(--cell); border: 1px solid var(--line); color: var(--cream-2);
  font-size: 14px; line-height: 1.5;
}
.afterword:target { display: block; }

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
.tpic { display: block; position: relative; aspect-ratio: 1 / 1; overflow: hidden; }
.tpic img, .tpic .tbg { width: 100%; height: 100%; object-fit: cover; display: block; }
.tpic .tbg { object-position: 50% 18%; }
/* The monogram is a placeholder and should read as one. It was set at ninety
   points in the most valuable slot on the page, which made the least
   interesting thing on it the loudest. */
.tbg.noface {
  display: grid; place-items: center;
  font-family: var(--serif); font-size: 34px; font-weight: 700;
  letter-spacing: .04em; color: rgba(255, 243, 224, .5);
  background: linear-gradient(160deg, var(--line), var(--cell));
}
.t-person { border-bottom: 2px solid var(--honey); }
.t-music { border-bottom: 2px solid var(--day, var(--honey)); }
.t-moment {
  border-bottom: 2px solid var(--dim); background: var(--bg);
  display: grid; place-items: center;
}
.tyr {
  font-family: var(--serif); font-size: 54px; line-height: 1;
  color: rgba(159, 182, 201, .5); letter-spacing: -.02em;
}
.tin { display: block; padding: 12px 13px 14px; }
.tlab {
  display: block; font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase;
  font-weight: 700; margin-bottom: 6px; color: var(--dimmer);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tbig {
  display: block; font-family: var(--serif);
  font-size: 17px; line-height: 1.22; color: var(--cream);
}
.tsub { display: block; color: var(--dim); font-size: 13px; margin-top: 5px; }
@media (max-width: 700px) {
  .tbg.noface { font-size: 26px; }
  .tyr { font-size: 34px; }
  .tin { padding: 9px 10px 11px; }
  .tlab { font-size: 9px; margin-bottom: 4px; white-space: normal; }
  .tbig { font-size: 14px; }
  .tsub { font-size: 12px; margin-top: 3px; }
}

/* What came out, above what happened. */
.culture { list-style: none; margin: 0; padding: 0; }
.cul {
  display: flex; gap: 14px; align-items: baseline; padding: 11px 0 11px 14px;
  border-bottom: 1px solid var(--cell); border-left: 2px solid var(--day, var(--honey));
}
.cul .cyr {
  font-family: var(--serif); font-size: 21px; color: var(--day-soft, var(--honey-lite));
  width: 58px; flex: none; font-variant-numeric: tabular-nums; line-height: 1.3;
}
.cul .ctx {
  margin: 0; font-family: var(--serif);
  font-size: 17px; line-height: 1.4; color: var(--cream);
}
/* The tag and the source belong on one quiet line under the sentence, not
   stacked as two more paragraphs with a link underlined like a footnote. */
.cul .meta { display: flex; gap: 10px; align-items: center; margin-top: 5px; }
.cul .meta .src { margin: 0; }
.cul .meta .src a { color: var(--dimmer); text-decoration: none; font-size: 11px; }
.cul .meta .src a:hover { color: var(--dim); }
@media (min-width: 760px) {
  .tiles { gap: 14px; }
  .tin { padding: 14px 16px 16px; }
  .tbg.noface { font-size: 54px; }
  .tbig { font-size: 18px; }
  .tyr { font-size: 64px; }
  .cul { gap: 20px; padding-left: 16px; }
  .cul .cyr { width: 68px; font-size: 24px; }
  .cul .ctx { font-size: 18px; }
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
p.datenote { color: ${QUIET}; font-size: 12.5px; margin: 7px 0 0; font-style: italic; }
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
details.more > summary .n, .shelfhead .n {
  color: ${QUIET}; font-size: 12px; font-weight: 400; letter-spacing: 0.04em;
}
.shelf { scroll-margin-top: 68px; }
.shelfhead {
  margin: 22px 0 14px; font-size: 14px; font-weight: 700; color: var(--cream);
  display: flex; align-items: baseline; gap: 9px;
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
nav.pager { display: flex; justify-content: space-between; gap: 12px; margin: 34px 0 0; font-size: 15px; }
nav.pager a { color: ${ACCENT}; text-decoration: none; }
.cta {
  margin: 34px 0 0; padding: 20px; border-radius: 16px;
  background: linear-gradient(135deg, var(--honey-lite), var(--honey));
  color: var(--cream);
}
.cta h2 { font-family: var(--serif); margin: 0 0 6px; font-size: 22px; }
.cta p { margin: 0; opacity: 0.92; font-size: 15px; }
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
/* The second half of the sentence, in honey italic: the live hive's own
   headline, "September 22. What will still matter?", said the same way. It
   was a pink to violet gradient clipped to the type, the one thing every
   generated landing page has, September 22, 2026. */
.glow { color: var(--honey); font-style: italic; font-weight: 600; }
/* The name, underlined rather than emboldened. The headline was Georgia at 800
   and Georgia ships one bold, so there was no weight left to reach for and
   asking for more only gets a browser's synthetic smear.

   text-decoration-color is set explicitly and that is not tidiness. The rule
   above paints this text with a gradient and sets color to transparent, and an
   underline defaults to currentColor, so without naming a colour here the line
   is drawn in transparent and there is simply nothing under the word. It would
   have looked like the underline had not been applied at all. */
.brandword {
  text-decoration: underline;
  text-decoration-color: #EF5680;
  text-decoration-thickness: 0.055em;
  text-underline-offset: 0.085em;
}

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
.btn.ghost {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 14px 20px; font-size: 15px;
  background: transparent; color: var(--cream-2);
  box-shadow: inset 0 0 0 1px rgba(255, 243, 224, 0.20);
  transition: color 140ms ease, background 140ms ease, box-shadow 140ms ease, transform 140ms ease;
}
.btn.ghost:hover {
  color: var(--cream); background: rgba(244, 183, 64, 0.10);
  box-shadow: inset 0 0 0 1px rgba(244, 183, 64, 0.60);
  transform: translateY(-2px);
}
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

/* Pick your month. A band rather than a line of small links, because this is
   the one thing on the page a visitor who knows what they want is looking for,
   and it used to be six words of grey text. */
.picker {
  margin: 34px 0 0; padding: 18px 20px 20px; border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 243, 224, 0.06), rgba(255, 243, 224, 0.02));
  box-shadow: inset 0 0 0 1px rgba(255, 243, 224, 0.09);
}
.pickerlabel {
  margin: 0 0 13px; font-family: inherit;
  font-size: 12px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--dim);
}
.bornin { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
.bornin a {
  display: flex; align-items: center; justify-content: center;
  padding: 12px 4px; border-radius: 13px;
  font-size: 14px; font-weight: 700; color: var(--cream-2); text-decoration: none;
  background: rgba(255, 243, 224, 0.05);
  box-shadow: inset 0 0 0 1px rgba(255, 243, 224, 0.10);
  transition: color 140ms ease, background 140ms ease, box-shadow 140ms ease, transform 140ms ease;
}
.bornin a:hover, .bornin a:focus-visible {
  color: var(--on-honey); background-image: linear-gradient(135deg, var(--honey-lite), var(--honey));
  box-shadow: 0 10px 22px rgba(244, 183, 64, 0.34);
  transform: translateY(-2px);
}
@media (max-width: 560px) { .bornin { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

/* The rail of real facts, moving.

   It moves without a script, because default-src 'none' means nothing on this
   page may run one. The track is a keyframe animation, the pause is a hover
   rule, and the loop is seamless because the track is written out twice: the
   first copy slides exactly its own width plus the gap, by which point the
   second copy is standing where the first one started.

   The distance has to be its own width plus one gap and not just its width.
   The two tracks are laid out side by side inside a flex row with a gap
   between them, so a copy that only travelled 100 percent would stop one gap
   short and the rail would jump by that much, once a minute, forever.

   Cards are a fixed width rather than a share of the rail. A share of what:
   the track is wider than the screen by design, so a percentage would be a
   percentage of a number nobody chose. Fixed also means the whole track is a
   known length, which is what lets one duration read as one steady speed.
*/
.proof { margin: 46px 0 0; }
.rail {
  overflow: hidden; display: flex; gap: 14px; margin: 24px 0 0;
  /* Fades the cards in and out at both ends instead of cutting them off at a
     hard edge, which is what makes it read as a wheel turning past rather
     than as a list that has been clipped. A gradient, not an image: the
     security header for this page says img-src 'self' and would refuse one. */
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent);
}
.railtrack { display: flex; gap: 14px; flex: none; list-style: none; margin: 0; padding: 0; }
/* Gated here rather than switched off later, so that every animation on the
   site sits behind the same question and a test can walk the sheet and check. */
@media (prefers-reduced-motion: no-preference) { .railtrack { animation: rail 72s linear infinite; } }
@keyframes rail { to { transform: translateX(calc(-100% - 14px)); } }
/* Hold it still to read one. Focus as well as hover, because a keyboard is
   how somebody reaches these without a pointer and a link that keeps sliding
   out from under the focus ring is unusable. */
.rail:hover .railtrack, .rail:focus-within .railtrack { animation-play-state: paused; }
.railtrack li.hlcard {
  flex: none; width: 320px;
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, rgba(255, 243, 224, 0.055), rgba(255, 243, 224, 0.022));
  box-shadow: inset 0 0 0 1px rgba(255, 243, 224, 0.09);
  border-radius: 18px; padding: 16px 18px 14px;
  transition: box-shadow 160ms ease, background 160ms ease;
}
.railtrack li.hlcard:hover {
  background: linear-gradient(180deg, rgba(244, 183, 64, 0.13), rgba(255, 243, 224, 0.03));
  box-shadow: inset 0 0 0 1px rgba(244, 183, 64, 0.50), 0 20px 40px rgba(0, 0, 0, 0.34);
}
.hl { display: block; text-decoration: none; color: inherit; flex: 1; }
.hlhead { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.hldate {
  font-size: 11px; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase;
  color: ${ACCENT};
}
.hlyear {
  font-size: 13px; font-weight: 700; color: ${QUIET}; font-variant-numeric: tabular-nums;
}
.hltext {
  display: block; margin: 9px 0 0;
  font-family: var(--serif); font-size: 17px; line-height: 1.42;
  color: var(--cream);
}
.hlsrc { margin: 11px 0 0; font-size: 12px; }
.hlsrc a { color: ${QUIET}; text-decoration: none; }
.hlsrc a:hover { color: ${ACCENT}; text-decoration: underline; }
.proof .credit { margin-top: 18px; }

/* What is on a day. Six of them in two columns, hung off a hairline each,
   because six rounded rectangles in a row is the shape of a page that has run
   out of things to say. */
.features {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 26px; margin: 22px 0 0; padding: 0; list-style: none;
}
.features li {
  display: block; background: none; border-radius: 0;
  padding: 15px 0 4px; border-top: 1px solid rgba(255, 243, 224, 0.11);
}
.features h3 { margin: 0 0 5px; font-size: 16px; }
.features h3::before {
  content: ""; display: inline-block; vertical-align: 0.12em;
  width: 7px; height: 7px; border-radius: 2px; margin-right: 9px;
  background-image: linear-gradient(135deg, var(--honey-lite), var(--honey));
}
.features p { margin: 0; color: var(--dim); font-size: 15px; }
.features a { color: ${ACCENT}; }
@media (max-width: 560px) { .features { grid-template-columns: 1fr; } }

/* The year as twelve calendars, in the full width of the page rather than in
   the width of a paragraph. Seven columns, so a row is a week and it reads the
   way a wall calendar does instead of as a column of 366 lines. */
.allyear { margin-top: 52px; }
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
@media (max-width: 560px) { .railtrack li.hlcard { width: 74vw; } }
@media (max-width: 600px) {
  .months { grid-template-columns: 1fr; gap: 10px; }
  .cal .days a { font-size: 16px; border-radius: 12px; }
  .home .hero { margin-top: 4px; }
  .wrap.home { padding-left: 16px; padding-right: 16px; }
  .picker { padding: 16px 15px 17px; }
}

/* Nothing on this page needs to move for it to work. */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  /* Nothing moves on its own, so the rail becomes one the reader pushes, and
     the second copy of the track is dropped rather than left sitting there as
     twelve cards nobody asked for twice. */
  .railtrack { animation: none; }
  .railtrack[aria-hidden="true"] { display: none; }
  .rail {
    overflow-x: auto; scroll-snap-type: x mandatory;
    scrollbar-width: none; padding-bottom: 4px;
  }
  .rail::-webkit-scrollbar { display: none; }
  .railtrack li.hlcard { scroll-snap-align: start; }
  .btn.brand, .btn.ghost, .bornin a, .railtrack li.hlcard, .cal, .cal .days a {
    transition: none;
  }
  .btn.brand:hover, .btn.ghost:hover, .bornin a:hover, .cal .days a:hover { transform: none; }
  .rem button, .yeardecs label, .yg button { transition: none; }
  .rem button:active, .yeardecs label:active, .yg button:active { transform: none; }
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

/* The birthday picker. The slim one lives under a date title; .bbig is the
   home hero. Native selects, styled to sit in the dark rather than to hide
   that they are selects: a reader knows how to open one and no script is
   needed to. */
.bbar { margin: 2px 0 22px; }
.bbar .bbarq { margin: 0 0 8px; font-size: 15px; font-weight: 600; color: var(--cream-2); }
.bbarrow { display: flex; flex-wrap: wrap; gap: 8px; align-items: stretch; }
.bbar select {
  appearance: none; -webkit-appearance: none; font: inherit; font-size: 15px;
  color: var(--cream); background: var(--cell); border: 1px solid var(--line); border-radius: 10px;
  padding: 10px 30px 10px 12px; cursor: pointer; min-width: 0;
  background-image: linear-gradient(45deg, transparent 50%, var(--dim) 50%), linear-gradient(135deg, var(--dim) 50%, transparent 50%);
  background-position: right 14px center, right 9px center; background-size: 5px 5px, 5px 5px; background-repeat: no-repeat;
}
.bbar select:hover, .bbar input:hover { border-color: var(--day-soft, var(--honey-lite)); }
.bbar select:focus-visible, .bbar input:focus-visible { outline: 2px solid var(--honey-lite); outline-offset: 1px; }
.bbar input {
  appearance: none; font: inherit; font-size: 15px; color: var(--cream); background: var(--cell);
  border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; width: 6.5em; min-width: 0;
}
.bbar input::placeholder { color: var(--dim); }
.bbar button {
  font: inherit; font-size: 15px; font-weight: 700; color: var(--on-honey);
  background: var(--honey-lite); border: none; border-radius: 10px; padding: 10px 18px; cursor: pointer; flex: 1 0 auto;
}
.bbar button:hover { background: var(--honey-lite); }
.bbig { margin: 8px 0 26px; padding: 22px; background: var(--cell); border: 1px solid var(--line); border-radius: 16px; }
.bbig .bbarq { font-size: 22px; color: var(--cream); }
.bbig .bbarsub { margin: 12px 0 0; font-size: 14px; color: var(--dim); line-height: 1.5; }

/* The trigger that opens the popup on a date page. */
.bopenrow { margin: 2px 0 18px; }
.bopen {
  display: inline-block; font-size: 14px; font-weight: 600; color: var(--honey-lite);
  text-decoration: none; padding: 7px 14px; border: 1px solid var(--line); border-radius: 999px;
}
.bopen:hover { border-color: var(--honey-lite); background: var(--line); }
/* On a phone the bar has no room for a fourth pill, so the way to the app
   stands beside the birthday button instead. On anything wider it is in the
   bar and this one stays hidden. September 22, 2026. */
/* The way to the app is on the About page and nowhere else. Nathan,
   September 22, 2026: it was a pill in every bar and a button under every
   date's title, and the site is the product. */

/* The popup itself. Hidden until its id is the page's target, which a link
   sets and the close links clear, all without a script. */
.bmodal { position: fixed; inset: 0; z-index: 60; display: none; }
.bmodal:target { display: flex; align-items: center; justify-content: center; padding: 20px; }
.bscrim { position: absolute; inset: 0; background: rgba(10, 6, 14, .72); backdrop-filter: blur(2px); }
.bcard {
  position: relative; z-index: 1; width: 100%; max-width: 420px; margin: 0;
  background: var(--cell); border: 1px solid var(--line); border-radius: 16px; padding: 26px 24px;
}
.bcard .bbarq { font-size: 20px; color: var(--cream); }
.bcard .bbarsub { margin: 12px 0 0; font-size: 13px; color: var(--dim); line-height: 1.5; }
.bx {
  position: absolute; top: 8px; right: 12px; font-size: 26px; line-height: 1; color: var(--dim);
  text-decoration: none; padding: 4px 8px; border-radius: 8px;
}
.bx:hover { color: var(--cream); background: var(--line); }

/* The reader's own panel, injected by serve.ts for a reader who has given a
   birth year. It is the birthday payoff, so it reads warm and sits at the top. */
.me { margin: 4px 0 26px; padding: 22px; background: var(--cell); border: 1px solid var(--line); border-radius: 16px; }
.me .mekicker { margin: 0 0 8px; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--honey-lite); }
.me .meage { margin: 0 0 10px; font-family: var(--serif); font-size: 30px; font-weight: 700; color: var(--cream); line-height: 1.15; }
.me .meworld { margin: 0 0 12px; font-size: 16px; color: var(--cream-2); line-height: 1.5; }
.me .menote { margin: 0; font-size: 13px; color: var(--dim); line-height: 1.5; }
.me .menote a { color: var(--honey-lite); text-decoration: none; border-bottom: 1px solid var(--line); }
.me .menote a:hover { border-color: var(--honey-lite); }
@media (max-width: 460px) {
  .bbarrow { display: grid; grid-template-columns: 1fr 1fr; }
  .bbar button { grid-column: 1 / -1; }
}
@media (max-width: 400px) { .barnav .here { min-width: 44px; font-size: 12px; } .mark, .daybar .mark { font-size: 18px; letter-spacing: 0.16em; } }

/* What the page holds, as one object rather than three sentences. */


.hrow { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.hrow h2.section { margin-bottom: 0; }
.hrow a { font-size: 13px; color: ${ACCENT}; text-decoration: none; font-weight: 600; white-space: nowrap; }

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
/* One hue per kind of thing, so the badge carries information rather than
   colour. Every value the researcher is allowed to return has a line here.
   Fixed colours, deliberately not the month's: a badge that is violet in
   September and green in March tells a reader nothing at all. */
.k-event { color: var(--honey); }
.k-release { color: #3FBFA3; }
.k-sport { color: var(--ember); }
.k-science { color: var(--honey-lite); }
.k-record { color: var(--ember); }
.k-price { color: var(--honey); }
.k-weather { color: var(--ember); }
.k-local { color: #3FBFA3; }
.k-older { color: var(--honey-lite); }
.k-tech { color: #3FBFA3; }
.k-music { color: var(--honey-lite); }
.k-cinema { color: var(--honey); }
/* Two hues that nothing else on the page uses, for the two categories that
   are the reason the curated table exists. */
.k-gaming { color: #9BE07A; }
.k-meme { color: #F58BC8; }
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

/* The front page lead, and only on a date that has sealed.
   On an open date nothing has earned the top of the page, and setting a row
   large because it happened to be first would be putting a headline on a story
   nobody chose. Once a date seals, the row at the top is the one its own
   people said they remembered, and the hierarchy is real. */
ul.feed li.sealedlead {
  padding: 30px 28px 26px;
  background: linear-gradient(168deg, var(--cell) 0%, var(--cell) 62%);
  border-color: var(--line);
}
ul.feed li.sealedlead .said {
  font-size: clamp(28px, 4.6vw, 44px); line-height: 1.14; font-weight: 800;
  letter-spacing: -0.015em; margin: 14px 0 0;
}
ul.feed li.sealedlead .yr { font-size: 40px; }
ul.feed li.sealedlead .leadmark {
  display: inline-flex; align-items: center; gap: 7px; margin: 0 0 4px;
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--day-soft, var(--honey-lite));
}
ul.feed li.sealedlead .leadmark::before {
  content: ""; width: 18px; height: 2px; border-radius: 2px;
  background: var(--day-soft, var(--honey-lite));
}
@media (max-width: 560px) { ul.feed li.sealedlead { padding: 22px 18px 20px; } }

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

/* The people, as a row you push. Ten boxes stacked down a page is ten
   scrolls; ten cards in a row is one gesture. */
.rail {
  display: flex; gap: 10px; margin: 16px 0 0; padding: 2px 20px 12px;
  margin-left: -20px; margin-right: -20px;
  overflow-x: auto; scroll-snap-type: x mandatory;
  scrollbar-width: none; -webkit-overflow-scrolling: touch;
}
.rail::-webkit-scrollbar { display: none; }
.rail > * { scroll-snap-align: start; flex: none; }
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

/* The two dates either side, as somewhere to go rather than two arrows. */
nav.pager.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
nav.pager.cards a {
  display: block; padding: 14px 16px; border-radius: 16px; text-decoration: none; color: inherit;
  background: linear-gradient(180deg, rgba(255, 243, 224, 0.05), rgba(255, 243, 224, 0.02));
  box-shadow: inset 0 0 0 1px rgba(255, 243, 224, 0.09);
  transition: background 160ms ease, box-shadow 160ms ease;
}
nav.pager.cards a:hover {
  background: rgba(244, 183, 64, 0.10);
  box-shadow: inset 0 0 0 1px rgba(244, 183, 64, 0.45), 0 16px 32px rgba(0, 0, 0, 0.34);
}
nav.pager.cards .dir {
  font-size: 10px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase;
  color: ${QUIET}; margin: 0;
}
nav.pager.cards .when {
  font-family: var(--serif); font-size: 19px; font-weight: 700; margin: 6px 0 0; color: ${ACCENT};
}
nav.pager.cards .after { text-align: right; }

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
  .afterword:target { animation: rise 460ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards; }

  /* 2. The ask card, on the three open dates. Its parts arrive in reading
     order, label, year, sleeve, sentence, then the three buttons one beat
     apart, so the eye is led to the thing to do. The card itself does not
     move: it is the page, not a visitor to it. The ask never carries a heavy
     row, because mayLead in highlight.ts chose it. */
  .asklab, .askyr, .askart, .asksaid, .askcap, .ask .rem button, .askrule {
    animation: rise 460ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards;
  }
  .askyr { animation-delay: 45ms; }
  .askart { animation-delay: 90ms; }
  .asksaid { animation-delay: 135ms; }
  .askcap { animation-delay: 180ms; }
  .ask .rem button:nth-child(5) { animation-delay: 225ms; }
  .ask .rem button:nth-child(6) { animation-delay: 270ms; }
  .ask .rem button:nth-child(7) { animation-delay: 315ms; }
  .askrule { animation-delay: 360ms; }

  /* 3. The dot. Baked here is only the shape of the breath; today.css
     starts it, and only on the three open dates, because a grey dot
     breathing on a sealed page would say the page is live when it is not.
     Four seconds. A fast pulse is an alarm. */
  .rem button, .yeardecs label, .yg button { transition: transform 120ms ease, color 140ms ease, border-color 140ms ease, background 140ms ease; }

  /* 5. The year picker and the line that replaces it. :target brings the
     picker back and a checked decade reveals its years; both arrive rather
     than appear. The line that gives way cannot fade, because :target is a
     cut, so the thing arriving is what carries the transition. */
  .yearask:target, .yg { animation: rise 460ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards; }
}
@keyframes breathe {
  0%, 100% { box-shadow: 0 0 0 4px rgba(111, 165, 222, .18); }
  50% { box-shadow: 0 0 0 7px rgba(111, 165, 222, .08); }
}
/* Where the redirect lands after an answer. The bar is sticky and 56 pixels
   tall, and a row scrolled flush to the top of the window sits under it, so
   the thing that just arrived is the one thing hidden. Not motion, but it is
   the landing, so it lives with the landing. */
.ask, ul.feed li, details.more li, .cul { scroll-margin-top: 72px; }
/* A press, felt. Not in the media query: a transform on :active is a state,
   not a motion, and the transition that softens it is switched off below. */
.rem button:active, .yeardecs label:active, .yg button:active { transform: scale(.96); }
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

const SITELINKS = `<p class="sitelinks"><a href="/">Today</a> · <a href="/calendar/">Every date</a> · <a href="/about/">About</a> · <a href="/support/">Support</a> · <a href="/privacy/">Privacy</a></p>`;

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
<p class="nothing">No account, no sign up, and nothing on this page is loaded from another company. Buzz something and one random string is kept in a cookie, so the same browser gets its few buzzes a day and no more. Tell the site your birthday and it is kept in a second cookie, in your browser, to draw your own page. That is the whole of what is kept about you.</p>
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

/** Structured data, so a search engine knows this is a list of people. */
function jsonLd(page: DayPage, canonical: string): string {
  const items = page.people.slice(0, 25).map((person, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Person",
      name: person.name,
      // Tidied like the visible row, because this is the copy handed to
      // search engines and it carried the same contradiction: Wikidata says
      // Rishi Kapoor was born in 1952 and its description said 1951.
      ...(person.description && tidyDescription(person.description)
        ? { description: tidyDescription(person.description) }
        : {}),
      sameAs: `https://www.wikidata.org/wiki/${person.qid}`,
    },
  }));
  const payload = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `People born on ${monthName(page.month)} ${page.day}`,
    url: canonical,
    itemListElement: items,
  };
  return `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
}

/**
 * What happened on this date, with the page each one came from.
 *
 * Put above the people rather than below them. The names are what somebody
 * searched for, but they are also the part every competitor already has, and
 * a reader who scrolls past ten names to reach the only unusual thing on the
 * page mostly does not scroll. Nothing here is written in the second person,
 * because a stranger who typed this date into a search box was not born on it.
 */
/**
 * Takes a trailing year range off a Wikidata description.
 *
 * "American actor and martial artist (1973-2022)" arrives on a row that
 * already prints 1973 in the margin and "died 2022" underneath, so the same
 * two numbers appear three times in one card, on every person who has died,
 * on all 366 pages.
 *
 * It also fixes a contradiction rather than only tidying one. Wikidata's own
 * data disagrees with itself on Rishi Kapoor: the birth date says 1952 and the
 * description says (1951-2020), so the page printed 1952 beside 1951 and
 * looked wrong to anybody reading it. We print the structured year, which is
 * the one the whole site is ordered by, and drop the prose copy of it.
 *
 * Only a parenthetical made of nothing but years, dashes and the word "born"
 * is removed. "Apollo 11 (1969 mission)" keeps its bracket, because the
 * bracket is saying something.
 */
export function tidyDescription(description: string): string {
  return description
    .replace(/\s*\((?:born\s+)?\d{3,4}\s*(?:[\u2013\u2014-]\s*\d{3,4})?\)\s*$/u, "")
    .trim();
}

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
 * What kind of day a row's date actually is, said out loud.
 *
 * A bare year claims the same confidence whether the timestamp came off the
 * post itself or off a magazine writing about something that had already been
 * going round for a fortnight. Those are different claims. Every competitor
 * prints them identically and this one does not, which is the entire argument
 * of docs/internet-culture.md rule two: the limitation is the differentiator,
 * so do not hide it.
 *
 * "happened" is deliberately absent. It is the ordinary case, it is what a
 * reader already assumes a dated row means, and printing it on most of the
 * page would turn the labels into wallpaper and cost the two that matter all
 * of their weight.
 */
const WHEN: Record<string, string> = {
  posted: "the exact day it was posted",
  went_viral: "when it spread, not when it was posted",
  ended: "the day it ended",
};

function whenOf(dateKind: string | null | undefined): string | null {
  if (typeof dateKind !== "string") return null;
  return WHEN[dateKind] ?? null;
}

/**
 * The things worth stopping on, and a drawer holding all the others.
 *
 * The whole list is still in the HTML. A closed drawer is a display state, so
 * a search engine reads every line and a reader is not handed forty three of
 * them at once. That is the entire idea: nothing is thrown away, one thing is
 * put in front.
 */
/**
 * Who found what, under the history. Not decoration: Wikipedia's text is
 * quoted under Creative Commons Attribution ShareAlike and the credit is the
 * licence's condition, and a person's checked sentence must never be
 * counted as something a model turned up.
 */
export function feedCredits(rows: TimelineRow[], name: string, searched: number, fromWikipedia: number, curated: number): string {
  const spread = rows.filter((row) => row.dateKind === "went_viral").length;

  const credits = [
    spread > 0
      ? `<p class="credit">${spread === 1 ? "One row says" : `${spread} rows say`} "when it spread, not when it was posted". That means the original posting is gone or was never recorded, and the date is the week it broke out, taken from something published at the time. Printing that instead of a confident year is deliberate.</p>`
      : "",
    searched > 0
      ? `<p class="credit">The ${searched} with a source link under them were found by Google's Gemini searching the web, and kept only when the page each one cites answered. Birthed is not affiliated with Google.</p>`
      : "",
    curated > 0
      ? `<p class="credit">${curated === 1 ? "One of them was" : `${curated} of them were`} written and checked by hand, against the page ${curated === 1 ? "it links" : "each one links"}.</p>`
      : "",
    fromWikipedia > 0
      ? `<p class="credit">${searched + curated > 0
        ? `The other ${fromWikipedia} ${fromWikipedia === 1 ? "is" : "are"}`
        : fromWikipedia === 1 ? "The one without a link under it is" : `The ${fromWikipedia} without a link under them are`} from the ${escapeHtml(name)} article on Wikipedia, quoted as written and released under Creative Commons Attribution ShareAlike. Birthed is not affiliated with Wikipedia or the Wikimedia Foundation.</p>`
      : "",
  ].filter((line) => line !== "").join("\n");
  return credits;
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

/**
 * The date's history as plain rows: what happened, who was born, what came
 * out. No buttons. On a date with a hive the worker files each of these as a
 * wall story and the feed under the hive draws them with the one button, so
 * these rows are for the date that has no hive yet, under its promise, and
 * for a hive the worker has not filed yet. The same shape as a feed row, on
 * purpose, because to a reader they are the same thing: something with a
 * birthday today.
 */
/**
 * The number ones as a strip of covers, baked, with no buttons: the stand in
 * for the strip the wall draws from the song stories, on a date the worker
 * has not filed yet. Same shape, same classes, so the picture rules find
 * the covers by data-subject either way. Every year is its own address,
 * "/september-5/#1990", because "number one song on September 5 1990" is a
 * thing people type and the answer is on this page.
 */
export function songStrip(songs: SongOfTheYear[], name: string): string {
  if (songs.length === 0) return "";
  const rows = songs.map((song) => `<li id="${song.year}" data-subject="song:${escapeHtml(song.chartDate)}">
<a class="wart" href="#${song.year}" title="${escapeHtml(song.song)} by ${escapeHtml(song.artist)}"><span class="wyr">${song.year}</span></a>
<span class="wsongt">&quot;${escapeHtml(song.song)}&quot; by ${escapeHtml(song.artist)}</span>
</li>`).join("\n");
  return `<h3 class="wsub small">The number one song on ${escapeHtml(name)}, every year</h3>
<p class="wnote">The week's number one on this date, ${songs[songs.length - 1]?.year} to ${songs[0]?.year}. When the hive opens, every one of these takes buzzes too.</p>
<ul class="wsongs">
${rows}
</ul>`;
}

export function historyRows(rows: TimelineRow[], people: Person[], songs: SongOfTheYear[] = [], name: string = ""): string {
  const events = rows.map((row) => `<li id="r-${row.kind}-${escapeHtml(row.id)}" class="hist">
<span class="fyr">${row.year === null ? "" : row.year}</span>
<span class="fbody">${row.sourceUrl
    ? `<a href="${escapeHtml(row.sourceUrl)}" rel="nofollow noopener">${escapeHtml(row.leadLine ?? row.text)}</a>`
    : `<span class="ftext">${escapeHtml(row.leadLine ?? row.text)}</span>`}
<span class="wmeta">${row.sourceUrl ? escapeHtml(hostOf(row.sourceUrl)) : ""}${whenOf(row.dateKind) ? ` ${escapeHtml(whenOf(row.dateKind) ?? "")}` : ""}</span>
</span>
</li>`);
  const born = people.map((person) => `<li id="r-person-${escapeHtml(person.qid)}" class="hist">
<span class="fyr">${person.birthYear ?? ""}</span>
<span class="fbody"><a href="https://www.wikidata.org/wiki/${escapeHtml(person.qid)}" rel="nofollow noopener">${escapeHtml(person.name)}</a>
<span class="wmeta">born today${person.description && tidyDescription(person.description) ? `, ${escapeHtml(tidyDescription(person.description))}` : ""}${person.deathYear ? `, died ${person.deathYear}` : ""}</span>
</span>
</li>`);
  const all = [...events, ...born];
  const strip = songStrip(songs, name);
  if (all.length === 0) return strip;
  return `<ul class="wlist hist">
${all.join("\n")}
</ul>
${strip}`;
}

/**
 * How far back the first ask looks. The lead row should be one a large share
 * of living adults can answer with more than "never heard of it", and twenty
 * five years back is a year most adults today were somewhere between five and
 * sixty. One number, in one place, stable across builds so the card for a
 * date does not change every deploy.
 */
const ASK_YEARS_BACK = 25;

/**
 * How many rows are baked as ask cards, and how many slots today.css picks
 * from. One number, because a card carries the slot numbers that land on it
 * and the arithmetic only works if both ends agree.
 */
export const ASK_SLOTS = 5;

/**
 * The window a row's year has to fall in to be first choice.
 *
 * Wider than the single year ASK_YEARS_BACK named, and it replaces it as the
 * thing that decides. Nearest to one year is a rule that reliably picks the
 * routine over the memorable, because routine things get written down every
 * year and memorable ones do not happen on schedule. Anything inside this
 * window is treated as equally answerable and the tie is broken on evidence
 * and on length instead.
 */
const ASK_FROM = 1985;
const ASK_TO = 2015;

/**
 * How good a lead this row would be, higher is better.
 *
 * Evidence first, because a row somebody wrote and checked is a row a person
 * chose, and Wikipedia's date article is everything anybody ever added. Then
 * the window, then shortness, because the card is read in about a second.
 */
function askScore(row: TimelineRow): number {
  const year = row.year ?? 0;
  let score = 0;
  // A person wrote a card for this row, so a person already made the judgement
  // this function is a poor substitute for. It wins outright, and it wins by
  // more than any combination of the rest, so a date with five written lines
  // fills its rotation with them and nothing else.
  if (row.leadLine !== undefined) score += 5_000;
  // Somebody arguing on Wikipedia thought this was one of the day's biggest.
  // Below a written line, because a person writing eight words for this site is
  // a stronger signal than an editor picking a headline for a different one,
  // and well above everything mechanical underneath.
  if (row.selected === true) score += 1_000;
  if (row.curated === true) score += 400;
  else if (row.sourceUrl !== null) score += 200;
  if (year >= ASK_FROM && year <= ASK_TO) score += 120;
  else score -= Math.min(100, Math.abs(year - (year < ASK_FROM ? ASK_FROM : ASK_TO)));
  score -= Math.min(60, Math.floor(row.text.length / 4));
  return score;
}

/**
 * Up to ASK_SLOTS rows to open the page on, best first.
 *
 * **Why more than one.** A single fixed card is one chance to hook a stranger,
 * and on September 8 the old rule spent it on a routine space station resupply
 * flight, because that is what "nearest to twenty five years back, with a
 * source" picks. It is also the same card every time a reader comes back, on a
 * site whose whole promise is that the date changes under them. today.css
 * reveals one of these per request, so the page is dealt rather than fixed.
 *
 * **Why the years are spread.** Two candidates from the same decade are one
 * candidate as far as a reader is concerned, since the question the card asks
 * is really about a time in their life. A decade is taken at most once while
 * there is anything left to take, and only then does the list fill up.
 */
export function askCandidates(rows: TimelineRow[], limit: number = ASK_SLOTS): TimelineRow[] {
  // Screened on what the card would actually show. A row whose own sentence is
  // three lines of encyclopedia becomes a candidate the moment somebody writes
  // eight words for it, which is the entire point of writing one: the length
  // limit exists because the card has a size, not because a long row is a bad
  // row. The word screens still read the row's own sentence as well, because a
  // gentle line over a killing is exactly the thing they exist to refuse.
  const passing = rows.filter((row) =>
    // 1958 is where the chart data starts, so a record can sit beside the card.
    // A selected row does not need one: it is the day's biggest, and refusing
    // it for being old is why September 8 could ask about a resupply flight and
    // never about Michelangelo's David, New Amsterdam becoming New York, or the
    // first season of the Football League. On most dates the biggest things are
    // older than the charts, and a sleeve is decoration.
    row.year !== null && (row.year >= 1958 || row.selected === true) &&
    // Length, on what the card would actually show.
    mayAsk(row.leadLine ?? row.text) &&
    // Subject, on the row's own sentence as well, always. A written line is
    // eight words and could be gentle about anything; the record underneath it
    // is what says what the card is really about.
    mayLeadWords(row.text));
  const ranked = [...passing].sort((a, b) => {
    const gap = askScore(b) - askScore(a);
    // Year descending on a tie, so the order is stable across builds rather
    // than dependent on whatever order the two tables came back in.
    return gap !== 0 ? gap : (b.year ?? 0) - (a.year ?? 0);
  });
  const out: TimelineRow[] = [];
  const decades = new Set<number>();
  for (const row of ranked) {
    if (out.length >= limit) break;
    const decade = Math.floor((row.year ?? 0) / 10);
    if (decades.has(decade)) continue;
    decades.add(decade);
    out.push(row);
  }
  for (const row of ranked) {
    if (out.length >= limit) break;
    if (!out.includes(row)) out.push(row);
  }
  return out;
}

/**
 * The best single ask, or null. Kept because a caller that wants one row
 * should not have to know about slots.
 */
export function firstAsk(rows: TimelineRow[], _now: number = new Date().getUTCFullYear()): TimelineRow | null {
  return askCandidates(rows, 1)[0] ?? null;
}

/**
 * The dice, on every date page.
 *
 * /random/ has existed in serve.ts since the beginning and was linked from
 * exactly one place, the about page, which is the page nobody lands on. A
 * reader who arrives on a date from a search result had no way to see a second
 * one without typing a URL, which is a strange thing to be true of a site made
 * of 366 pages that are fun to flick through.
 *
 * A server redirect rather than anything on the page, so it costs no script on
 * a site that ships none, and robots.txt already refuses it so no crawler
 * wanders 366 pages of duplicates.
 */
// The three marks in the bar's end. Our own line drawings, one stroke weight,
// the same box, so the three read as a set. Not emoji: an emoji is drawn by
// whichever phone or computer is looking, and looks like three different
// sets on three different screens.
const DICE = `<svg class="ic" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4.6"/><circle cx="8.4" cy="8.4" r="1.35" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="15.6" cy="15.6" r="1.35" fill="currentColor" stroke="none"/></svg>`;
const CALENDAR = `<svg class="ic" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3.4" y="5" width="17.2" height="15.6" rx="3.6"/><path d="M3.4 10.2h17.2M8.2 3.2v3.6M15.8 3.2v3.6"/></svg>`;
const INFO = `<svg class="ic" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2"/><circle cx="12" cy="7.9" r="0.9" fill="currentColor" stroke="none"/></svg>`;

const TODAY_ICON = `<svg class="ic" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3.4" y="5" width="17.2" height="15.6" rx="3.6"/><path d="M3.4 10.2h17.2M8.2 3.2v3.6M15.8 3.2v3.6"/><circle cx="12" cy="15.4" r="1.6" fill="currentColor" stroke="none"/></svg>`;

/**
 * The bar's end: Today, Every date, Random and About, as four matching
 * pills. The app pill came off on September 22, 2026: the way to the app
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
<a class="pill" href="/calendar/" title="Every day of the year" aria-label="Every day of the year">${CALENDAR}<span>Every date</span></a>
<a class="pill" href="/random/" title="A random day of the year" aria-label="A random day of the year">${DICE}<span>Random</span></a>
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
 * The birthday picker: month, day and year into the one route that already
 * knows what to do with them.
 *
 * This is the front door. A stranger who lands on today's page, or on any
 * date, tells the site their birthday here and is sent straight to it with
 * the personal card turned on, because POST /year takes exactly month, day
 * and year: it sets the birth-year cookie and redirects to that date. So the
 * whole flow is one form and no new server code, and it runs with no script,
 * which this site requires: three native selects and a button, which every
 * phone knows how to open.
 *
 * `big` is the hero on the home page; the slim one sits under each date
 * title so the front door is on every page, not only the home.
 */
function birthdayForm(heading: string, sub: string): string {
  const thisYear = new Date().getUTCFullYear();
  const months = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${monthName(i + 1)}</option>`).join("");
  const days = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  // The year is a number field, not a hundred options: a year dropdown would
  // print every year from 1920 on into every date page, which bloats the page
  // and drops a stray "1951" next to the real ones. The field carries no year
  // text at all until a reader types one.
  return `<p class="bbarq">${heading}</p>
<div class="bbarrow">
<select name="m" required aria-label="Month"><option value="" disabled selected hidden>Month</option>${months}</select>
<select name="d" required aria-label="Day"><option value="" disabled selected hidden>Day</option>${days}</select>
<input type="number" name="y" required aria-label="Year" placeholder="Year" min="1920" max="${thisYear}" inputmode="numeric">
<button type="submit">See my day</button>
</div>
${sub ? `<p class="bbarsub">${sub}</p>` : ""}`;
}

/** Landmarks a reader's birth year is measured against, launch year and name. */
const LANDMARKS: Array<[number, string]> = [
  [1994, "the PlayStation"],
  [1995, "Amazon"],
  [1998, "Google"],
  [2001, "Wikipedia"],
  [2004, "Facebook"],
  [2005, "YouTube"],
  [2007, "the iPhone"],
  [2009, "Bitcoin"],
  [2010, "Instagram"],
  [2011, "Minecraft"],
  [2016, "TikTok"],
  [2020, "the PlayStation 5"],
  [2022, "ChatGPT"],
];

const ME_START = "<!--me:start-->";
const ME_END = "<!--me:end-->";

/** The empty marker baked into every date page, filled by serve.ts for a reader who has given a year. */
export function meMarker(): string {
  return `${ME_START}${ME_END}`;
}

/** Put the reader's own panel where the marker is, or leave the page as built. */
export function withMe(html: string, panel: string | null): string {
  if (panel === null) return html;
  const start = html.indexOf(ME_START);
  const end = html.indexOf(ME_END, start);
  if (start < 0 || end < 0) return html;
  return html.slice(0, start) + panel + html.slice(end + ME_END.length);
}

function ageOn(month: number, day: number, birthYear: number, now: Date): number {
  const y = now.getUTCFullYear();
  const had = now.getUTCMonth() + 1 > month || (now.getUTCMonth() + 1 === month && now.getUTCDate() >= day);
  return y - birthYear - (had ? 0 : 1);
}

function landmarkList(names: string[]): string {
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The reader's own panel, built from their birth year alone: their age, the
 * decade, and the world their year landed in, measured against a fixed set of
 * landmarks. It needs no hive and no data for the date, so it is the one thing
 * that always has something to say the moment a birthday is entered, which is
 * the point of the front door. Pure: serve.ts computes the year, this draws it.
 */
/**
 * The first year the number one song strip covers. Mirrors FIRST_CHART_YEAR in
 * build.ts, which cannot be imported here because build.ts runs the build on
 * import and imports this file; render.test.ts holds the two numbers equal.
 */
export const FIRST_CHART_YEAR = 1959;

export function renderMePanel(
  month: number,
  day: number,
  birth: number | { year: number; month: number | null; day: number | null },
  now: Date = new Date(),
): string {
  const b = typeof birth === "number" ? { year: birth, month: null, day: null } : birth;
  const birthYear = b.year;
  const name = `${monthName(month)} ${day}`;
  const known = b.month !== null && b.day !== null;
  // Whose date this is. Until September 22, 2026 the kicker said "Your
  // September 22" on whichever date was open, because the site kept the
  // year alone and could not tell. Now it can, when the reader gave the whole
  // birthday, and it says "Your" only when it is true.
  const own = known && b.month === month && b.day === day;
  const theirs = known ? `${monthName(b.month!)} ${b.day}` : null;
  // The age is the reader's real one, from their own birthday. With a year
  // alone it is the age they reach this year, which is true whichever side
  // of their birthday today falls.
  const age = known ? ageOn(b.month!, b.day!, birthYear, now) : now.getUTCFullYear() - birthYear;
  const decade = `${Math.floor(birthYear / 10) * 10}s`;
  // Older than: launched after you. Younger than: already here. Nearest to
  // the reader's year first, three each, so the names mean something.
  const older = LANDMARKS.filter(([y]) => y > birthYear).sort((a, b) => a[0] - b[0]).slice(0, 3).map(([, n]) => n);
  const younger = LANDMARKS.filter(([y]) => y <= birthYear).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, n]) => n);
  const ageLine = !known
    ? age <= 0
      ? `You were born this year.`
      : `You turn ${age} this year.`
    : age < 0
      ? `You have not been born yet.`
      : age === 0
        ? `You turn 1 on your first ${theirs}.`
        : `You have been alive for ${age} ${age === 1 ? "year" : "years"}.`;
  const worlds: string[] = [];
  if (older.length > 0) worlds.push(`You are older than ${landmarkList(older)}.`);
  if (younger.length > 0) worlds.push(`${landmarkList(younger)} ${younger.length === 1 ? "was" : "were"} already here when you arrived.`);
  // "Save your card" came off, September 22, 2026: the picture was not good
  // enough to ask anybody to keep. The card page stays in the code and its
  // address sends a reader to the date page. Bring the link back here.
  const card = "";
  let note: string;
  if (own) {
    // The song strip starts in 1959, so a reader born before that has no
    // number one to be promised. Say so plainly rather than promise a row the
    // page does not have.
    note = birthYear < FIRST_CHART_YEAR
      ? `The charts this site uses begin in ${FIRST_CHART_YEAR}, so there is no number one song for the week you were born. Below: everyone who shares ${name} and everything that ever happened on your date.`
      : `Below: everyone who shares ${name} and everything that ever happened on your date. <a href="/${slug(month, day)}/comb/#comb-songs">The number one song the week you were born</a> is on the comb.`;
  } else if (known) {
    note = `This is ${name}, not your date. Below, each year says how old you were on ${name} that year. <a href="/${slug(b.month!, b.day!)}/">Go to ${theirs}</a>.`;
  } else {
    note = `Below, each year says roughly how old you were on ${name}. Add your month and day and the site can tell your own date from every other one. <a href="#birthday">Add them</a>.`;
  }
  // The year itself is never printed, here or anywhere on the page. The age
  // and the decade already say as much as the reader chose to show.
  const kicker = own ? `Your ${name}` : known ? `Your birthday is ${theirs}` : "Your birthday";
  return `<section class="me" aria-label="Your birthday">
<p class="mekicker">${kicker}</p>
<p class="meage">${ageLine}</p>
<p class="meworld">Born in the ${decade}. ${worlds.join(" ")}</p>
<p class="menote">${note}</p>
</section>`;
}

export function renderBirthdayBar(big: boolean = false): string {
  return `<form class="bbar${big ? " bbig" : ""}" method="post" action="/year" aria-label="See your birthday">
${birthdayForm(big ? "When is your birthday?" : "See your own birthday", big ? "See who shares it, the number one song the week you were born, and what the world looked like when you arrived." : "")}
</form>`;
}

/**
 * The picker as a popup, for a date page where it should not sit between the
 * title and the hive. A link opens it, a dark backdrop and a close button
 * shut it, and all of that is one `:target` rule and no script, which is what
 * the rest of the page's interaction is too. The link is a plain anchor to
 * the overlay's id; closing is an anchor back to no id at all.
 */
export function renderBirthdayModal(): string {
  return `<p class="bopenrow"><a class="bopen" href="#birthday">See your own birthday</a></p>
<div class="bmodal" id="birthday">
<a class="bscrim" href="#" aria-label="Close" tabindex="-1"></a>
<form class="bbar bcard" method="post" action="/year" aria-label="See your birthday">
<a class="bx" href="#" aria-label="Close">&times;</a>
${birthdayForm("When is your birthday?", "See who shares it, the number one song the week you were born, and what the world looked like when you arrived.")}
</form>
</div>`;
}

export function renderDayPage(
  page: DayPage,
  songs: SongOfTheYear[] = [],
  facts: Fact[] = [],
  events: DayEvent[] = [],
  everything: CulturalEvent[] = [],
  /**
   * What this date's own people remembered, when it has sealed.
   *
   * Null for every open date and for every date nobody has answered, which is
   * almost all of them, and those pages are exactly the pages they were.
   *
   * Baked in at build time rather than read on request, and that is not a
   * shortcut. A sealed date can never take another answer, so its order can
   * never change again: the moment it seals the page becomes a fixed thing,
   * and a fixed thing belongs in the file rather than in a query on every
   * read. It also keeps the promise the server makes, which is that an
   * ordinary page view calls nothing.
   */
  memory: Map<string, MemoryCount> | null = null,
  /**
   * Every lead line on the site, by "kind:id". Passed whole rather than per
   * date because the build reads the table once, the same as the facts and the
   * events, and a map lookup is cheaper than 366 filters.
   *
   * Empty is the normal state and every page is exactly the page it was.
   */
  leadLines: Map<string, string> = new Map(),
  /**
   * The years Wikipedia's editors picked as this date's biggest, by "month-day".
   * Empty is the normal state until the importer has run and every page is
   * exactly the page it was.
   */
  selected: Selected = new Map(),
  /**
   * The wall for this month and day, the newest year that has one, or null
   * when no wall exists yet, which leaves the page exactly the page it was.
   * Baked in like everything else: the rectangles are stored by the server
   * side allocator and an ordinary page view calls nothing.
   * docs/the-wall.md.
   */
  wall: WallDay | null = null,
  /**
   * Pictures the build holds for this date's subjects beyond the covers and
   * faces it lists itself: the events' lead pictures in the project's bucket,
   * event-pictures.ts. Empty until the worker has fetched them.
   */
  morePictures: Picture[] = [],
): string {
  // A row nobody wrote does not go on a page.
  //
  // 326 of the 357 published culture rows were an imported title and nothing
  // else, which renders as a game's name followed by "is released". On
  // September 11 that section was Guitar Hero 5, Mini Ninjas, Lego Star Wars
  // II, Super Mario Maker and Android Pay, and it was the loudest thing on a
  // page that said nothing at all about the date.
  //
  // docs/internet-culture.md gives the test: if the sentence could sit on a
  // Wikipedia date page without looking out of place, it does not belong here.
  // "Mini Ninjas is released" is that sentence exactly.
  //
  // Nothing is deleted and nothing is being said about the game. The row waits
  // in the panel and it is back the moment somebody writes one line about it,
  // which is the same bargain as a lead line: the writing is the bar, because
  // the writing is the thing a reader came for.
  //
  // Here rather than in fetchCulturalEvents, so the page and anything else
  // holding these rows agree about what is on it, and so it can be tested
  // without a network.
  const culture = everything.filter((row) => (row.context ?? "").trim() !== "");

  const bigLines = selected.get(selectedKey(page.month, page.day)) ?? new Map<number, string>();

  const name = `${monthName(page.month)} ${page.day}`;
  const canonical = `${SITE}/${slug(page.month, page.day)}/`;
  const count = page.people.length;
  // The lede describes the day, not the people on it, and that is the whole
  // September 6 change to this page.
  //
  // It used to read "The people most looked up on this day", above a list
  // ordered by exactly that. notability_score is attention and infamy is
  // attention, so on five dates the first row was a serial killer or a
  // dictator: Ted Bundy on November 24, Charles Manson on November 12, Ed Gein
  // on August 27, John Wayne Gacy on March 17, Benito Mussolini on July 29.
  // DayLine.swift had already worked this out and taken the names off the
  // app's celebration screens, and the fix was never carried here.
  //
  // The data half of that is fixed in 20260906240000. This half is the more
  // important one, because a word list only catches people whose description
  // says what they did, and Wikidata calls Bashar al-Assad a politician.
  //
  // It is also the better page. A ranked list of names is the one thing
  // Famous Birthdays already wins at with fifteen years of authority and the
  // same public data, and it is the least distinctive thing here. What is
  // distinctive sits below it. The description a few lines down worked this
  // out for search results months ago and said so in its own comment. Nobody
  // applied it to the page.
  //
  // Worded so it does not contain the string "What happened on <date>". That
  // is the timeline section's own heading, and a test asserts that heading is
  // absent on a date with nothing in it. A lede that quoted it would have made
  // that test pass or fail for the wrong reason forever after.
  // The sentence that used to sit under the heading is gone. A reader looking
  // at the date in sixty point type does not need to be told the page is
  // about that date, the counts below it already say what it holds, and a
  // summary with a colon and a list of three is the most recognisable rhythm
  // in machine writing. The meta description below is its own sentence and is
  // what a search result needs.
  const songLine = songs.length > 0
    ? ` And the number one song on ${name} in every year since ${songs[songs.length - 1]?.year}.`
    : "";
  // The description is what a search result shows, so the facts go in front
  // of the names when there are any: the names are what every other site in
  // this category already says.
  // Built here rather than inside the section, because the description a
  // search result shows has to count the same rows the page ends up with.
  // Culture rows join the one list. They had their own section for a while,
  // because sorted by year among Wikipedia's crusades and treaties a page
  // about a birthday opened on 878; pickHighlights now puts the date's
  // biggest first and the year order is what remains under it. On a date
  // with a hive these rows are also filed as wall stories by the worker, and
  // the feed under the hive draws those instead.
  const chronological = buildTimeline(facts, events, monthName(page.month), page.day, culture)
    .map((row) => {
      const written = leadLines.get(leadKey(row.kind, row.id));
      return written === undefined ? row : { ...row, leadLine: written };
    });

  // One row per selection, not every row that happens to share its year.
  //
  // Year alone put three 1888 rows in the top six on September 8: the Football
  // League's first season, which Wikipedia selected, plus a submarine test and
  // the Great Herding, which it did not. Half the cards on the page became one
  // year. So each selection claims the row it is actually about and nothing
  // else, and a selection matching nothing claims nothing.
  const big = new Set<TimelineRow>();
  for (const [year, line] of bigLines) {
    const match = bestMatch(line, year, chronological);
    if (match !== null) big.add(match);
  }
  const timelineRows = chronological.map((row) =>
    big.has(row) ? { ...row, selected: true } : row);
  // The one place on this site where what readers did changes what a page
  // looks like, and deliberately the last place: only after a date can never
  // take another answer.
  const timeline = memory === null ? timelineRows : byMemory(timelineRows, memory);
  // Three sources, counted apart, because the credit at the foot names who
  // found what and a curated row is not a searched one. Counting a person's
  // checked sentence as something a model turned up is the kind of wrong that
  // is invisible to us and obvious to the person who wrote it.
  const curatedCount = timeline.filter((row) => row.curated === true).length;
  const searched = timeline.filter((row) => row.curated !== true && row.sourceUrl !== null).length;
  const factLine = timeline.length > 0
    ? ` What happened on ${name}, in ${timeline.length} sourced things.`
    : "";
  // Now in the order the page itself uses, which is what that comment above
  // asked for and did not get.
  const whoLine = count > 0 ? ` And who was born on it.` : "";
  const description = timeline.length > 0 || songs.length > 0
    ? `${name}, and everything that was true about it.${factLine}${songLine}${whoLine}`.trim()
    : `Who was born on ${name}.`;

  const { previous, next } = neighbours(page.month, page.day);

  // The square where the date has a board, the wide card everywhere else.
  //
  // What travels is the thing worth travelling: a link to a date with a hive
  // on it should show the hive. A date with no board has no square worth
  // showing over the card it already has, and today that is 362 of the 366.
  //
  // Named, because it is a real cost: a square is center cropped to a strip
  // by the platforms that draw a wide preview, which takes the date off the
  // top and the state line off the bottom and leaves the board. It is shown
  // whole by the ones that draw a squarer thumbnail, which is where a link
  // pasted into a message usually lands.
  const hived = wall !== null && wall.stories.some((s) => s.rect !== null && (s.status === "placed" || s.status === "false"));
  const image: PreviewImage = hived
    ? { url: `${SITE}/og/${slug(page.month, page.day)}-square.png`, width: SQUARE, height: SQUARE }
    : `${SITE}/og/${slug(page.month, page.day)}.png`;

  // The two dates either side, named in the head as well as linked in the
  // page. This is how a search engine learns that the 366 are one ordered run
  // rather than 366 unrelated pages that happen to look alike.
  const sequence = `<link rel="prev" href="${SITE}/${slug(previous.month, previous.day)}/">
<link rel="next" href="${SITE}/${slug(next.month, next.day)}/">
`;

  const picked = pickHighlights(timeline);
  const rest = theRest(timeline, picked);
  const hue = dayHue(page.month);
  const shortName = `${monthName(page.month).slice(0, 3)} ${page.day}`;

  return `${head(`Born on ${name}`, description, canonical, image, !isReady(page, facts), "", sequence)}
<div class="day on-${slug(page.month, page.day)}" style="--day:${hue.day};--day-soft:${hue.soft}">
${siteBar(`<span class="barnav">
<a class="arrow" href="/${slug(previous.month, previous.day)}/" title="${monthName(previous.month)} ${previous.day}" aria-label="${monthName(previous.month)} ${previous.day}">&lsaquo;</a>
<span class="here">${shortName}</span>
<a class="arrow" href="/${slug(next.month, next.day)}/" title="${monthName(next.month)} ${next.day}" aria-label="${monthName(next.month)} ${next.day}">&rsaquo;</a>
</span>
`)}
<h1>${name}</h1>
${renderBirthdayModal()}
${meMarker()}
${pictureRules([...picturesFor(songs, page.people), ...morePictures])}
${wallSection(wall, name, Date.now(), {
    date: { month: page.month, day: page.day },
    history: historyRows([...picked, ...rest], page.people, songs, name),
  })}
${songs.length > 0 ? `<p class="credit">Chart positions are from the ${escapeHtml(CHART_NAME)}, compiled by Wikipedia and released under Creative Commons Attribution ShareAlike. ${songs.some((song) => song.hasArtwork) ? "Cover art comes from the iTunes Search API. " : ""}Birthed is not affiliated with Billboard, Wikipedia or Apple.</p>` : ""}
${feedCredits(timeline, name, searched, timeline.length - searched - curatedCount, curatedCount)}
${count === 0 ? `<p class="credit">Nobody imported for this date yet.</p>` : `<p class="credit">Names, years and descriptions of the ${count} people come from Wikidata, under Creative Commons Zero. Credit to Wikipedia and Wikidata.</p>`}
</div>
<p class="signed">Made by <a href="/about/">Jason Evan Page</a>, one person. No ads, nothing for sale.</p>
${jsonLd(page, canonical)}
${FOOT}`;
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
/**
 * Every picture the build has on disk for a date's subjects: a cover for
 * each number one that has one, a face for each person who has one. Keyed
 * the way the worker keys the story, so the rule finds the tile.
 */
export function picturesFor(songs: SongOfTheYear[], people: Person[], facesOnDisk: ReadonlySet<string> | null = null): Picture[] {
  const out: Picture[] = [];
  for (const song of songs) {
    if (song.hasArtwork === true) out.push({ subject: `song:${song.chartDate}`, path: `/covers/${coverName(song.song, song.artist)}.jpg` });
  }
  for (const person of people) {
    // The database saying a person has a picture is not the file being
    // here: the column is filled by the importer and the files arrive with
    // npm run faces, and between the two a tile drew the scrim for a face
    // with nothing under it. Checked against the folder, the way the covers
    // are, when the caller has listed it.
    const file = `${faceName(person.qid)}.jpg`;
    if (person.hasImage === true && (facesOnDisk === null || facesOnDisk.has(file))) out.push({ subject: `person:${person.qid}`, path: `/faces/${file}` });
  }
  return out;
}

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
 * The comb: every row of a date's feed on its own page, grouped by kind.
 * Baked from the newest year's wall like the hive page, and swapped live by
 * serve.ts while the date is open, between the same markers. Indexed, since
 * the rows are the date's history and the date page no longer carries them.
 */
export function renderCombPage(day: WallDay, month: number, d: number, pictures: Picture[] = []): string {
  const name = `${monthName(month)} ${d}`;
  const hue = dayHue(month);
  return `${head(`Every story on ${name}, ${day.year}`,
    `Everything with a birthday on ${name}: what happened, who was born, what was number one and the day's news, each with its source.`,
    `${SITE}${combPath(month, d)}`, `${SITE}/og/${slug(month, d)}.png`)}
<div class="day wcombday on-${slug(month, d)}" style="--day:${hue.day};--day-soft:${hue.soft}">
${siteBar(`<span class="barnav"><a class="here" href="/${slug(month, d)}/">${escapeHtml(name)}</a></span>
`)}
${pictureRules(pictures.filter((p) => !p.subject.startsWith("story:")))}
${wallSection(day, name, Date.now(), { comb: true, date: { month, day: d } })}
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

