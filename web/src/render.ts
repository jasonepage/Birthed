// Rendering a date page. Pure string in, string out, so it can be tested
// without a network and without a browser.

import { DayPage, Person, monthName, neighbours, slug, everyDate } from "./model.js";
import { CHART_NAME, coverName, SongOfTheYear } from "./songs.js";
import { calendar } from "./calendar.js";
import { type CulturalEvent, textOf } from "./culture.js";
import { Fact, hostOf } from "./facts.js";
import { buildTimeline, byMemory, pickHighlights, theRest, type DayEvent, type MemoryCount, type TimelineRow } from "./timeline.js";
import { cardHighlight, mayAsk, mayLead, mayLeadWords, type Highlight } from "./highlight.js";
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
const INK = "#0E0C16";
const ACCENT = "#EF5680";
/* Today, in the calendar. A second hue rather than a second shade of the
   accent, because the accent already means "here" everywhere else on the page
   and two pinks a square apart is not a distinction anybody makes at a
   glance. Blue is far enough from it to read instantly on the plum ground and
   is used for nothing else. Exported because serve.ts writes the rule that
   uses it and the two must not drift. */
export const TODAY = "#6FA5DE";
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
const QUIET = "#827B75";

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


/* The first screen, decided September 8, 2026. docs/first-impression-proposal.md.

   The state line is the first thing after the bar. Four sentences are baked
   into every page and one is shown: the sealed one by default, so a page with
   no today.css says the safe thing, and today.css turns on one of the other
   three for the three dates that are open. The Yesterday, Today and Tomorrow
   chips this replaces were coloured by href rather than by date, so a sealed
   page lit "Today" in blue and said answering was open under it. */
.state { margin: 20px 0 0; font-size: 14px; font-weight: 600; color: #C9C2D4; line-height: 1.4; }
.state .dot {
  display: inline-block; width: 9px; height: 9px; border-radius: 999px;
  background: #3A3348; margin: 0 8px 1px 0; vertical-align: middle;
}
.sen { display: none; }
.senshut { display: inline; }
.sen b { color: #FFF7EE; font-weight: 700; }
/* The fuse. A two pixel line exactly as long as the part of the three days
   that has gone. Its length is one custom property, --gone, which today.css
   sets from the real clock on every request, so it is true to the second the
   page loaded without a script. Where motion is allowed the same line creeps:
   the animation is 72 hours long and today.css starts it however far in we
   already are. It counts nothing and nobody. It is only the clock. */
.fuse { display: none; height: 2px; margin: 10px 0 0; background: #241E2E; border-radius: 2px; overflow: hidden; }
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
.mechanic { margin: 0 0 4px; color: #B9B2AD; font-size: 15px; line-height: 1.4; max-width: 58ch; text-wrap: pretty; }
.mechanic b { color: #FFF7EE; font-weight: 600; }
/* The other open dates, as one quiet line. today.css hides the link to the
   page you are on, so the sentence names the other two. */
.also { margin: 0; font-size: 13px; color: #827B75; }
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
.signed { display: none; margin: 30px 0 0; font-size: 11.5px; color: #6B6560; }
.signed a { color: #8D857E; text-decoration: none; border-bottom: 1px solid #3A3348; }
.signed a:hover { color: #C6BDB4; }
.also a { color: #A49BAE; text-decoration: none; border-bottom: 1px solid #3A3348; }
.also a:hover { color: #FFF7EE; }

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
  background: linear-gradient(168deg, #221A2E 0%, #17121F 62%);
  box-shadow: inset 0 0 0 1px rgba(255, 247, 238, .10);
}
.askhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px 0; }
.asklab { font-size: 10.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--day-soft, #C6B0F5); }
.askyr { font-family: Georgia, serif; font-size: 26px; font-weight: 700; color: var(--day-soft, #C6B0F5); line-height: 1; }
.askbody { display: grid; grid-template-columns: 64px 1fr; gap: 14px; padding: 10px 16px 0; align-items: start; }
.askbody.noart { grid-template-columns: 1fr; }
.askart { width: 64px; aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: #17141F; box-shadow: 0 6px 18px rgba(0, 0, 0, .45); }
.askart img { width: 100%; height: 100%; object-fit: cover; display: block; }
.asksaid {
  margin: 0; font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(17px, 4.4vw, 22px); line-height: 1.3; text-wrap: pretty;
}
.askcap { grid-column: 1 / -1; font-size: 11.5px; color: #827B75; line-height: 1.35; margin: 4px 0 0; }
.askcap b { color: #A49BAE; font-weight: 600; }
/* The row's own sentence, under a line somebody wrote for it. Its own block
   rather than a run of the caption, because it is a different kind of thing
   from the record sleeve note beside it: that is context, this is the source
   text the question was written from. */
.askrec { display: block; margin: 0 0 3px; color: #948C86; }
.askcap a { color: #827B75; text-decoration: none; }
.askcap a:hover { color: ${ACCENT}; text-decoration: underline; }
/* Same three words every row further down uses, bigger here, once, because
   this is where the mechanic is taught. */
.ask .rem { gap: 8px; margin: 0; padding: 12px 16px 4px; }
.ask .rem button {
  font-size: 14.5px; font-weight: 600; min-height: 42px; padding: 11px 15px;
  background: rgba(255, 247, 238, .06); color: #FFF7EE; border-color: rgba(255, 247, 238, .18);
}
.ask .rem button:hover { border-color: var(--day-soft, #C6B0F5); background: rgba(198, 176, 245, .14); }
.ask .rres { padding: 0 16px; }
.ask .undo { padding: 0 16px; }
.ask .mine { padding: 6px 16px 0; margin: 0; }
.askrule { margin: 0; padding: 6px 16px 14px; font-size: 12.5px; color: #827B75; line-height: 1.45; }
/* The row the ask was taken from, where it sits in the feed. Hidden by
   today.css on the three open dates, so a row is on the page once: at the top
   while the date is open, in its place once it has sealed. */
.alsolab { margin: 30px 0 10px; font-size: 10.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #7A7385; }
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
.mine { display: none; margin: 6px 0 0; font-size: 12.5px; color: #6FA5DE; }
/* A count of a room, on a sealed date, once there are enough people in it to
   be worth counting. Not a rating: see rememberedLine. */
.tally { margin: 8px 0 0; font-size: 12.5px; color: var(--day-soft, #C6B0F5); }

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
  background: none; color: #A49BAE; border: 1px solid #2A2434;
  border-radius: 999px; padding: 7px 11px;
}
.rem button:hover { color: #FFF7EE; border-color: var(--day-soft, #C6B0F5); }

/* The result, written in by the server on the request after an answer. Baked
   in empty on every row, so a page that nobody has answered draws none of
   them. No colour on any of it: every date has at least one row where a
   coloured chart under a killing would be grotesque, so the reader's own
   answer is not singled out here at all and the shape does the talking. */
/* Said above a sealed date's list, because the page has visibly rearranged and
   nothing else on it explains why. */
.memorynote {
  margin: 26px 0 -8px; font-size: 13px; color: ${QUIET};
  border-left: 2px solid var(--day-soft, #C6B0F5); padding-left: 12px;
}
.rres:empty { display: none; }
.rres { display: block; margin: 10px 0 0; max-width: 420px; }
.rrow { display: flex; align-items: center; gap: 10px; margin: 0 0 4px; }
.rlab { flex: 0 0 118px; font-size: 11.5px; color: #A49BAE; }
.rbar { flex: 1 1 auto; height: 5px; border-radius: 999px; background: #241E2E; overflow: hidden; }
.rbar span { display: block; height: 100%; border-radius: 999px; background: #6E6680; }
.rnum {
  flex: 0 0 28px; text-align: right; font-size: 11.5px; font-weight: 700;
  color: #A49BAE; font-variant-numeric: tabular-nums;
}
.rtot { display: block; margin: 7px 0 0; font-size: 11.5px; color: ${QUIET}; }
/* Quiet, because an undo that shouts is one people press by accident, which is
   the problem it exists to solve arriving from the other direction. */
.undo { margin: 4px 0 0; }
.undo button {
  font: inherit; font-size: 11.5px; cursor: pointer; background: none;
  color: ${QUIET}; border: 0; padding: 4px 0; text-decoration: underline;
}
.undo button:hover { color: #FFF7EE; }

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
.yearset { display: none; margin: 26px 0 30px; font-size: 13px; color: #827B75; }
.yearset a { color: #A49BAE; text-decoration: none; border-bottom: 1px solid #3A3348; }
.yearset a:hover { color: #FFF7EE; }
.yearsetv { color: #E8DCCB; }
.yearlede { margin: 0 0 12px; font-size: 14px; color: #C9C2D4; }
.yearlede b { color: #FFF7EE; font-weight: 700; }
.yearask form { margin: 0; }
.decpick { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

.yeardecs, .yg { display: flex; flex-wrap: wrap; gap: 8px; }
.yeardecs label, .yg button {
  font: inherit; font-size: 15px; font-weight: 700; line-height: 1; cursor: pointer;
  padding: 13px 15px; border-radius: 12px; border: 1px solid #2A2434;
  background: #1C1626; color: #C9C2D4; font-variant-numeric: tabular-nums;
}
.yeardecs label:hover, .yg button:hover { color: #FFF7EE; border-color: var(--day-soft, #C6B0F5); }
.decpick:focus-visible ~ .yeardecs label[for] { outline: 2px solid ${ACCENT}; outline-offset: 2px; }

/* Nothing is shown until a decade is picked, which is why the years are
   display:none rather than merely hidden: an empty row that took up space
   would read as a control that had failed. */
.yg { display: none; margin: 10px 0 0; }
.yearyears { min-height: 0; }
#dec2020:checked ~ .yearyears .yg2020 { display: flex; }
#dec2020:checked ~ .yeardecs label[for="dec2020"] { background: ${ACCENT}; border-color: ${ACCENT}; color: #1A0F16; }
#dec2010:checked ~ .yearyears .yg2010 { display: flex; }
#dec2010:checked ~ .yeardecs label[for="dec2010"] { background: ${ACCENT}; border-color: ${ACCENT}; color: #1A0F16; }
#dec2000:checked ~ .yearyears .yg2000 { display: flex; }
#dec2000:checked ~ .yeardecs label[for="dec2000"] { background: ${ACCENT}; border-color: ${ACCENT}; color: #1A0F16; }
#dec1990:checked ~ .yearyears .yg1990 { display: flex; }
#dec1990:checked ~ .yeardecs label[for="dec1990"] { background: ${ACCENT}; border-color: ${ACCENT}; color: #1A0F16; }
#dec1980:checked ~ .yearyears .yg1980 { display: flex; }
#dec1980:checked ~ .yeardecs label[for="dec1980"] { background: ${ACCENT}; border-color: ${ACCENT}; color: #1A0F16; }
#dec1970:checked ~ .yearyears .yg1970 { display: flex; }
#dec1970:checked ~ .yeardecs label[for="dec1970"] { background: ${ACCENT}; border-color: ${ACCENT}; color: #1A0F16; }
#dec1960:checked ~ .yearyears .yg1960 { display: flex; }
#dec1960:checked ~ .yeardecs label[for="dec1960"] { background: ${ACCENT}; border-color: ${ACCENT}; color: #1A0F16; }
#dec1950:checked ~ .yearyears .yg1950 { display: flex; }
#dec1950:checked ~ .yeardecs label[for="dec1950"] { background: ${ACCENT}; border-color: ${ACCENT}; color: #1A0F16; }
#dec1940:checked ~ .yearyears .yg1940 { display: flex; }
#dec1940:checked ~ .yeardecs label[for="dec1940"] { background: ${ACCENT}; border-color: ${ACCENT}; color: #1A0F16; }
#dec1930:checked ~ .yearyears .yg1930 { display: flex; }
#dec1930:checked ~ .yeardecs label[for="dec1930"] { background: ${ACCENT}; border-color: ${ACCENT}; color: #1A0F16; }
.yearnote { font-size: 11.5px; color: ${QUIET}; margin: 10px 0 0; }
/* Said only after the server has redirected here, revealed by :target, which
   is how this page says anything back without running a script. */
.afterword {
  display: none; margin: 14px 0 0; padding: 13px 15px; border-radius: 12px;
  background: #171227; border: 1px solid #2A2434; color: #E9E1DB;
  font-size: 14px; line-height: 1.5;
}
.afterword:target { display: block; }

.barend { display: flex; align-items: center; gap: 14px; }
.dice {
  display: inline-flex; align-items: center; gap: 6px; text-decoration: none;
  color: #A49BAE; border: 1px solid #2A2434; border-radius: 999px;
  padding: 5px 11px 5px 9px;
}
.dice:hover { color: #FFF7EE; border-color: var(--day-soft, #C6B0F5); }
.dice .ic { display: block; }
/* A photograph is not square. A head sits in the top third of almost every one
   of these, so a square crop takes foreheads off. */
img.face {
  width: 100%; aspect-ratio: 4 / 5; object-fit: cover; object-position: 50% 16%;
  border-radius: 10px; margin-bottom: 11px; display: block; background: #1A1526;
}
@media (max-width: 520px) { .dice span { display: none; } .dice { padding: 6px 8px; } }

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
  background: #141020; border: 1px solid #221C30; border-radius: 14px; overflow: hidden;
}
a.tile:hover { border-color: var(--day-soft, #C6B0F5); }
.tpic { display: block; position: relative; aspect-ratio: 1 / 1; overflow: hidden; }
.tpic img, .tpic .tbg { width: 100%; height: 100%; object-fit: cover; display: block; }
.tpic .tbg { object-position: 50% 18%; }
/* The monogram is a placeholder and should read as one. It was set at ninety
   points in the most valuable slot on the page, which made the least
   interesting thing on it the loudest. */
.tbg.noface {
  display: grid; place-items: center;
  font-family: Georgia, "Times New Roman", serif; font-size: 34px; font-weight: 700;
  letter-spacing: .04em; color: rgba(255, 247, 238, .5);
  background: linear-gradient(160deg, #241E36, #16121F);
}
.t-person { border-bottom: 2px solid #EF5680; }
.t-music { border-bottom: 2px solid var(--day, #8A6BE0); }
.t-moment {
  border-bottom: 2px solid #9FB6C9; background: #07060C;
  display: grid; place-items: center;
}
.tyr {
  font-family: Georgia, serif; font-size: 54px; line-height: 1;
  color: rgba(159, 182, 201, .5); letter-spacing: -.02em;
}
.tin { display: block; padding: 12px 13px 14px; }
.tlab {
  display: block; font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase;
  font-weight: 700; margin-bottom: 6px; color: #7A7385;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tbig {
  display: block; font-family: Georgia, "Times New Roman", serif;
  font-size: 17px; line-height: 1.22; color: #FFF7EE;
}
.tsub { display: block; color: #A49BAE; font-size: 13px; margin-top: 5px; }
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
  border-bottom: 1px solid #221C30; border-left: 2px solid var(--day, #8A6BE0);
}
.cul .cyr {
  font-family: Georgia, serif; font-size: 21px; color: var(--day-soft, #C6B0F5);
  width: 58px; flex: none; font-variant-numeric: tabular-nums; line-height: 1.3;
}
.cul .ctx {
  margin: 0; font-family: Georgia, "Times New Roman", serif;
  font-size: 17px; line-height: 1.4; color: #FFF7EE;
}
/* The tag and the source belong on one quiet line under the sentence, not
   stacked as two more paragraphs with a link underlined like a footnote. */
.cul .meta { display: flex; gap: 10px; align-items: center; margin-top: 5px; }
.cul .meta .src { margin: 0; }
.cul .meta .src a { color: #7A7385; text-decoration: none; font-size: 11px; }
.cul .meta .src a:hover { color: #A49BAE; }
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
  margin: 0; background: ${INK}; color: #FFF7EE;
  font: 17px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
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
  font-family: Georgia, "Times New Roman", serif; font-weight: 800;
  font-size: clamp(38px, 9vw, 64px); line-height: 1.05; margin: 0 0 10px;
}
.day h1 { font-size: clamp(30px, 7.5vw, 48px); line-height: 1.02; margin: 10px 0 6px; letter-spacing: -.01em; }
.lede { color: #B9B2AD; margin: 0 0 30px; }
/* The hidden attribute has to beat every display rule below it. A browser
   hides [hidden] with its own stylesheet, and any author rule that sets
   display wins over that, so .btn made the two buttons on /add ignore being
   hidden and the page offered both at once. Anything switched on and off from
   a script depends on this line. */
[hidden] { display: none !important; }
ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
li {
  background: #17141F; border-radius: 14px; padding: 13px 15px;
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
.what { color: #9C9490; font-size: 15px; margin: 2px 0 0; }
.died { color: ${QUIET}; font-size: 13px; margin: 3px 0 0; }
h2.section {
  font-family: Georgia, "Times New Roman", serif; font-weight: 800;
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
  overflow: hidden; background: #17141F;
  box-shadow: 0 6px 18px rgba(0,0,0,0.45);
  transition: transform 160ms ease, box-shadow 160ms ease;
}
a.art:hover { transform: translateY(-3px); box-shadow: 0 12px 26px rgba(0,0,0,0.55); }
ol.covers .art img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* A recording with no cover. Made rather than missing. */
ol.covers .none {
  display: flex; align-items: center; justify-content: center; height: 100%;
  padding: 10px; text-align: center;
  background: linear-gradient(140deg, #3A1B45, #1B0B24);
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
  font-family: Georgia, "Times New Roman", serif; font-weight: 800;
  font-size: 15px; line-height: 1.2; color: #FFF7EE;
}
ol.covers .y { margin: 9px 0 0; font-size: 13px; color: #9C9490; }
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
ol.covers .a { margin: 1px 0 0; color: #9C9490; font-size: 13px; overflow-wrap: anywhere; }
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
/* The year dial, and the reason it is built out of radio buttons.
   This site sends default-src 'none', so no page on it may run a script, and
   that is not an obstacle worth routing around: it is the strongest thing the
   privacy page claims and the /add incident is what loosening it costs. So the
   years are 60-odd radio inputs and the panel below them is chosen with
   :checked and a sibling selector. Clicking a tick picks a year, and the arrow
   keys walk the years, which is behaviour a radio group already has and no
   script of ours could do better.
   The per-year rules are generated in songSection, because which years exist
   depends on the date. February 29 has seventeen of them. */
.dial { margin: 0 0 30px; position: relative; }
.dial input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.dial input:focus-visible ~ .ticks { box-shadow: 0 0 0 2px rgba(239, 86, 128, 0.55); border-radius: 3px; }
.dial .ticks { display: flex; align-items: flex-end; height: 30px; border-bottom: 1px solid #3A3348; }
.dial .ticks label {
  flex: 1 1 0; height: 9px; cursor: pointer; border-left: 1px solid #3A3348;
}
.dial .ticks label.dec { height: 19px; border-left-color: #6E6680; }
.dial .ticks label:hover { background: rgba(239, 86, 128, 0.22); }
.dial .scale {
  display: flex; justify-content: space-between; margin: 6px 0 0;
  font-size: 11px; color: ${QUIET}; font-variant-numeric: tabular-nums;
}
.dial .now { margin: 20px 0 0; min-height: 118px; }
.dial .pick { display: none; gap: 24px; align-items: baseline; flex-wrap: wrap; }
.dial .body { min-width: 240px; flex: 1; }
.dial .diallabel {
  margin: 0 0 12px; font-size: 11px; letter-spacing: 0.13em; text-transform: uppercase;
  color: #A79E98;
}
.dial .yr {
  font-family: Georgia, "Times New Roman", serif; font-size: 46px; line-height: 1;
  color: ${ACCENT}; font-variant-numeric: tabular-nums;
}
.dial .said {
  font-family: Georgia, "Times New Roman", serif; font-size: 22px; line-height: 1.25;
  margin: 0; color: #FFF7EE;
}
.dial .by { margin: 4px 0 0; color: #9C9490; font-size: 15px; }
.dial .when { margin: 9px 0 0; color: ${QUIET}; font-size: 12px; }
.dial .turns { margin: 3px 0 0; color: #9C9490; font-size: 13px; }
@media (max-width: 520px) { .dial .yr { font-size: 34px; } .dial .said { font-size: 19px; } }
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
details.more > summary:hover { color: #FFF7EE; }
details.more ol.covers { margin-top: 16px; }
details.more > summary .n, .shelfhead .n {
  color: ${QUIET}; font-size: 12px; font-weight: 400; letter-spacing: 0.04em;
}
.shelf { scroll-margin-top: 68px; }
.shelfhead {
  margin: 22px 0 14px; font-size: 14px; font-weight: 700; color: #FFF7EE;
  display: flex; align-items: baseline; gap: 9px;
}
/* The tick strip scrolls rather than shrinking.
   Sixty-seven years across a phone is a two pixel target each, which is not a
   control. Given a floor per tick the strip is wider than the screen and can
   be swiped, and every year stays reachable by thumb. On a desktop the whole
   run fits and the floor never applies. */
.dial .ticks { overflow-x: auto; scrollbar-width: none; }
.dial .ticks::-webkit-scrollbar { display: none; }
/* position: relative is what keeps the strip on the phone. Each tick carries
   a hidden span for anything reading the page aloud, positioned absolutely,
   and without a positioned tick to hang off it hung off .dial instead, which
   is outside the scrolling strip. Sixty-odd of those spans sat up to 680
   pixels out, the document was wider than the screen, and iOS Safari drew the
   whole page at desktop width and shrank it to fit. The viewport tag was
   there the whole time. */
.dial .ticks label { flex: 1 0 auto; min-width: 10px; position: relative; }
@media (pointer: coarse) { .dial .ticks { height: 44px; } .dial .ticks label { min-width: 20px; height: 16px; } .dial .ticks label.dec { height: 30px; } }
/* The year is on the label for anything reading the page out loud. It is not
   drawn, because sixty-seven printed years is the wall this replaced. */
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
  background: none; border-radius: 0; padding: 16px 0; border-top: 1px solid #2A2434;
  display: flex; gap: 13px; align-items: baseline;
}
ul.facts li:first-child { border-top: none; padding-top: 6px; }
ul.facts .said { min-width: 0; }
ul.facts .what {
  font-family: Georgia, "Times New Roman", serif; font-size: 19px; line-height: 1.42;
  color: #FFF7EE; margin: 0;
}
ul.facts .src { margin: 7px 0 0; font-size: 13px; }
ul.facts .src a { color: ${QUIET}; text-decoration: none; }
ul.facts .src a:hover { color: ${ACCENT}; text-decoration: underline; }
nav.pager { display: flex; justify-content: space-between; gap: 12px; margin: 34px 0 0; font-size: 15px; }
nav.pager a { color: ${ACCENT}; text-decoration: none; }
.cta {
  margin: 34px 0 0; padding: 20px; border-radius: 16px;
  background: linear-gradient(135deg, #FF88A8, ${ACCENT} 48%, #A8265A);
  color: #FFF7EE;
}
.cta h2 { font-family: Georgia, serif; margin: 0 0 6px; font-size: 22px; }
.cta p { margin: 0; opacity: 0.92; font-size: 15px; }
footer { margin: 40px 0 0; color: ${QUIET}; font-size: 13px; }
footer .nothing { color: #A79E98; }
footer a { color: #9C9490; }
/* The year as twelve calendars. Seven columns, so a row is a week and the page
   reads the way a wall calendar does instead of as a column of 366 lines. */
.cal h3 {
  font-family: Georgia, "Times New Roman", serif; font-weight: 800;
  font-size: 19px; margin: 0 0 8px;
}
.cal .dow, .cal .days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.cal .dow { margin: 0 0 5px; padding: 0 0 6px; border-bottom: 1px solid #2A2434; }
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
footer .sitelinks { color: #B9B2AD; font-size: 14px; }
footer .sitelinks a { color: ${ACCENT}; text-decoration: none; }
.btn {
  display: inline-block; margin: 6px 0 0; padding: 12px 20px; border-radius: 999px;
  background: #FFF7EE; color: #A8265A; font-weight: 700; text-decoration: none; font-size: 15px;
}
.cal { scroll-margin-top: 24px; }
html { scroll-behavior: smooth; }
.soon { display: inline-block; margin: 6px 0 0; padding: 12px 20px; border-radius: 999px; border: 1px solid #3A3342; color: #B9B2AD; font-size: 15px; }
h2.plain { font-family: Georgia, "Times New Roman", serif; font-weight: 800; font-size: clamp(22px, 5vw, 28px); margin: 40px 0 8px; }
.prose p, .prose li { color: #D9D2CC; }
.prose ul { padding-left: 20px; }
.prose h3 { margin: 26px 0 4px; font-size: 17px; }
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
  color: #B9B2AD;
}
.hint { display: block; margin: 9px 0 0; font-size: 13px; color: ${QUIET}; }
.input, .select > select {
  appearance: none; -webkit-appearance: none; -moz-appearance: none;
  display: block; width: 100%; margin: 0;
  font-family: inherit; font-size: 16px; line-height: 1.4; color: #FFF7EE;
  background: rgba(255, 247, 238, 0.055);
  border: 1px solid #3A3342; border-radius: 14px; padding: 15px 16px;
  transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
}
.input::placeholder { color: ${QUIET}; }
.input:hover, .select > select:hover { border-color: #4C4458; }
.input:focus, .select > select:focus {
  outline: none; border-color: ${ACCENT};
  background: rgba(255, 247, 238, 0.085);
  /* ACCENT at 22 percent. Written out, because a hex colour cannot be given
     an alpha by another rule. */
  box-shadow: 0 0 0 3px rgba(239, 86, 128, 0.22);
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
  border-right: 2px solid #9C9490; border-bottom: 2px solid #9C9490;
  transform: translateY(-72%) rotate(45deg);
  pointer-events: none;
}
.select:hover::after { border-color: #FFF7EE; }
/* The open menu is drawn by the operating system and inherits almost nothing
   from here, so its rows are told their colours. Without this, some browsers
   open a white list out of a dark control. */
.select option { background: #17141F; color: #FFF7EE; }
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
  background: linear-gradient(135deg, #FF88A8, ${ACCENT} 55%, #C9315F);
  color: #FFF7EE;
  box-shadow: 0 12px 30px rgba(239, 86, 128, 0.26);
}
.btn.primary:hover { filter: brightness(1.06); }
.btn.primary:active { transform: translateY(1px); box-shadow: 0 6px 16px rgba(239, 86, 128, 0.24); }
/* Only the buttons. A field already answers focus with an accent border and a
   glow, and adding an outline on top of that drew two rings around one box. */
.btn:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 3px; }
/* What went wrong, and what came out. The muted .lede grey is for prose a
   reader may skip, and neither of these is skippable. */
.problem { margin: 16px 0 0; font-size: 15px; color: #FFB3C6; }
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
body.home {
  background-image:
    radial-gradient(1100px 620px at 6% -12%, rgba(239, 86, 128, 0.20), transparent 60%),
    radial-gradient(900px 560px at 98% -6%, rgba(139, 92, 246, 0.16), transparent 62%),
    radial-gradient(760px 520px at 48% 4%, rgba(255, 136, 168, 0.06), transparent 66%);
  background-repeat: no-repeat;
}
/* The calendar wants room and prose does not, so the page is wide and the
   words inside it are not. */
.wrap.home { max-width: 1120px; padding-top: 24px; }
.home .col { max-width: 720px; margin-inline: auto; }

/* The strip across the top. The two things here are redirects the server
   answers, not pages, which is the only way a static site with no script can
   offer a random date at all. */
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px; margin: 0 0 26px;
}
.mark {
  font-size: 12px; font-weight: 800; letter-spacing: 0.22em;
  color: ${ACCENT}; text-transform: uppercase; text-decoration: none;
}
.quick { display: flex; gap: 8px; }
.quick a {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 15px; border-radius: 999px;
  font-size: 13px; font-weight: 600; color: #D9D2CC; text-decoration: none;
  background: rgba(255, 247, 238, 0.045);
  box-shadow: inset 0 0 0 1px rgba(255, 247, 238, 0.13);
  transition: color 140ms ease, background 140ms ease, box-shadow 140ms ease, transform 140ms ease;
}
.quick a:hover, .quick a:focus-visible {
  color: #FFF7EE; background: rgba(239, 86, 128, 0.16);
  box-shadow: inset 0 0 0 1px rgba(239, 86, 128, 0.55);
  transform: translateY(-1px);
}
.quick .ic { flex: none; opacity: 0.85; }
.quick a:hover .ic { opacity: 1; }
@media (max-width: 430px) { .quick a span { display: none; } .quick a { padding: 10px; } }

/* One column. The app icon that used to float here is gone: it bobbed up and
   down beside a headline that now has a job to do, and an icon is what a page
   leads with when it has nothing to say yet. */
.home .hero { margin: 8px 0 0; max-width: 760px; }
.home .hero h1 { font-size: clamp(35px, 6.6vw, 60px); letter-spacing: -0.012em; }
.herotext { min-width: 0; }
/* The second half of the sentence, lit. Guarded, because the fallback for an
   unsupported background-clip is transparent text, which is a headline nobody
   can read rather than a headline that is not pink. */
.glow { color: #FFB9CC; }
@supports ((-webkit-background-clip: text) or (background-clip: text)) {
  .glow {
    background-image: linear-gradient(118deg, #FFCBD9 0%, ${ACCENT} 44%, #B98CFF 100%);
    -webkit-background-clip: text; background-clip: text;
    color: transparent;
  }
}
/* The name, underlined rather than emboldened. The headline is Georgia at 800
   and Georgia ships one bold, so there is no weight left to reach for and
   asking for more only gets a browser's synthetic smear.

   text-decoration-color is set explicitly and that is not tidiness. The rule
   above paints this text with a gradient and sets color to transparent, and an
   underline defaults to currentColor, so without naming a colour here the line
   is drawn in transparent and there is simply nothing under the word. It would
   have looked like the underline had not been applied at all. */
.brandword {
  text-decoration: underline;
  text-decoration-color: ${ACCENT};
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
  background: #17121F; border: 1px solid #2A2434; border-radius: 18px;
  padding: 20px 22px 22px;
}
.beats li::before {
  content: counter(beat);
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; margin: 0 0 13px;
  border-radius: 999px; background: rgba(239, 86, 128, 0.14);
  color: ${ACCENT}; font-size: 12.5px; font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.beats h3 { margin: 0 0 8px; font-size: 17px; line-height: 1.3; letter-spacing: -0.005em; }
.beats p { margin: 0; color: #A49BAE; font-size: 14.5px; line-height: 1.62; }

.actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 22px 0 0; }
.actions .btn { margin: 0; }
.btn.brand {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 14px 24px; font-size: 16px;
  background-image: linear-gradient(135deg, #FF9BB6, ${ACCENT} 52%, #C0335F);
  color: #FFF7EE;
  box-shadow: 0 14px 34px rgba(239, 86, 128, 0.30);
  transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;
}
.btn.brand:hover {
  filter: brightness(1.07); transform: translateY(-2px);
  box-shadow: 0 20px 44px rgba(239, 86, 128, 0.40);
}
.btn.brand:active { transform: translateY(0); }
.btn.ghost {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 14px 20px; font-size: 15px;
  background: transparent; color: #E7E0DA;
  box-shadow: inset 0 0 0 1px rgba(255, 247, 238, 0.20);
  transition: color 140ms ease, background 140ms ease, box-shadow 140ms ease, transform 140ms ease;
}
.btn.ghost:hover {
  color: #FFF7EE; background: rgba(239, 86, 128, 0.10);
  box-shadow: inset 0 0 0 1px rgba(239, 86, 128, 0.60);
  transform: translateY(-2px);
}
.fine { color: ${QUIET}; font-size: 13px; margin: 14px 0 0; max-width: 46ch; }

/* Pick your month. A band rather than a line of small links, because this is
   the one thing on the page a visitor who knows what they want is looking for,
   and it used to be six words of grey text. */
.picker {
  margin: 34px 0 0; padding: 18px 20px 20px; border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 247, 238, 0.06), rgba(255, 247, 238, 0.02));
  box-shadow: inset 0 0 0 1px rgba(255, 247, 238, 0.09);
}
.pickerlabel {
  margin: 0 0 13px; font-family: inherit;
  font-size: 12px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
  color: #8A8280;
}
.bornin { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
.bornin a {
  display: flex; align-items: center; justify-content: center;
  padding: 12px 4px; border-radius: 13px;
  font-size: 14px; font-weight: 700; color: #D9D2CC; text-decoration: none;
  background: rgba(255, 247, 238, 0.05);
  box-shadow: inset 0 0 0 1px rgba(255, 247, 238, 0.10);
  transition: color 140ms ease, background 140ms ease, box-shadow 140ms ease, transform 140ms ease;
}
.bornin a:hover, .bornin a:focus-visible {
  color: #23090F; background-image: linear-gradient(135deg, #FFB0C6, ${ACCENT});
  box-shadow: 0 10px 22px rgba(239, 86, 128, 0.34);
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
  background: linear-gradient(180deg, rgba(255, 247, 238, 0.055), rgba(255, 247, 238, 0.022));
  box-shadow: inset 0 0 0 1px rgba(255, 247, 238, 0.09);
  border-radius: 18px; padding: 16px 18px 14px;
  transition: box-shadow 160ms ease, background 160ms ease;
}
.railtrack li.hlcard:hover {
  background: linear-gradient(180deg, rgba(239, 86, 128, 0.13), rgba(255, 247, 238, 0.03));
  box-shadow: inset 0 0 0 1px rgba(239, 86, 128, 0.50), 0 20px 40px rgba(0, 0, 0, 0.34);
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
  font-family: Georgia, "Times New Roman", serif; font-size: 17px; line-height: 1.42;
  color: #FFF7EE;
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
  padding: 15px 0 4px; border-top: 1px solid rgba(255, 247, 238, 0.11);
}
.features h3 { margin: 0 0 5px; font-size: 16px; }
.features h3::before {
  content: ""; display: inline-block; vertical-align: 0.12em;
  width: 7px; height: 7px; border-radius: 2px; margin-right: 9px;
  background-image: linear-gradient(135deg, #FFB0C6, ${ACCENT});
}
.features p { margin: 0; color: #B9B2AD; font-size: 15px; }
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
  background: rgba(239, 86, 128, 0.07);
  box-shadow: inset 0 0 0 1px rgba(239, 86, 128, 0.42), 0 22px 50px rgba(239, 86, 128, 0.12);
}
.cal:target h3 { color: #FFD3E0; }
.cal:target .dow { border-bottom-color: rgba(239, 86, 128, 0.30); }
.cal .days a {
  background: rgba(255, 247, 238, 0.055); color: #CFC7C1; text-decoration: none; font-weight: 600;
  box-shadow: inset 0 0 0 1px rgba(255, 247, 238, 0.05);
  transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease, color 120ms ease;
}
.cal .days a:hover, .cal .days a:focus-visible {
  background-image: linear-gradient(140deg, #FFB0C6, ${ACCENT});
  background-color: ${ACCENT};
  color: #23090F; transform: translateY(-2px) scale(1.07);
  box-shadow: 0 10px 20px rgba(239, 86, 128, 0.38);
}
.cal .days a:focus-visible { outline: 2px solid #FFF7EE; outline-offset: 2px; }
/* February 29 in a year that does not have one. It still has a page, so it
   still has a square, marked rather than quietly dropped. */
.cal .days a.leap {
  background: none; color: ${QUIET};
  box-shadow: inset 0 0 0 1px rgba(239, 86, 128, 0.30);
}
.cal .days a.leap:hover, .cal .days a.leap:focus-visible {
  color: #23090F; box-shadow: 0 10px 20px rgba(239, 86, 128, 0.38);
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
  background-image: linear-gradient(140deg, #FFB0C6, ${ACCENT});
  background-color: ${ACCENT}; color: #23090F; font-weight: 700;
  box-shadow: 0 8px 18px rgba(239, 86, 128, 0.34);
}
p.calkey {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin: 20px 0 0; font-size: 12px; color: #A79E98;
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
  .quick a, .btn.brand, .btn.ghost, .bornin a, .railtrack li.hlcard, .cal, .cal .days a {
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
.day { --day: #8B5CF6; --day-soft: #C4AEFF; }

.daybar {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 11px 0 10px; margin: 0 0 4px;
  /* Nearly solid, not translucent. The blur is an enhancement and not every
     browser applies it; without it a lighter wash leaves the drawer summary
     and the feed legible straight through the bar, which reads as broken
     rather than as layered. */
  background: rgba(14, 12, 22, 0.94);
  -webkit-backdrop-filter: saturate(140%) blur(14px);
  backdrop-filter: saturate(140%) blur(14px);
  box-shadow: 0 1px 0 rgba(255, 247, 238, 0.07);
}
.daybar .mark {
  font-size: 11px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase;
  color: ${ACCENT}; text-decoration: none;
}
.barnav { display: flex; align-items: center; gap: 4px; }
.barnav .here {
  font-size: 13px; font-weight: 700; color: #B9B2AD; padding: 0 4px;
  min-width: 52px; text-align: center; font-variant-numeric: tabular-nums;
}
.arrow {
  width: 32px; height: 32px; flex: none; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  color: #B9B2AD; text-decoration: none; font-size: 15px;
  box-shadow: inset 0 0 0 1px rgba(255, 247, 238, 0.12);
  transition: color 140ms ease, background 140ms ease, box-shadow 140ms ease;
}
.arrow:hover {
  color: #FFF7EE; background: rgba(239, 86, 128, 0.16);
  box-shadow: inset 0 0 0 1px rgba(239, 86, 128, 0.55);
}
/* Was a filled pink pill with a glow under it, which is the single loudest
   thing a page can put in its top right corner and the one every generated
   landing page has. This page is a reference now, so the app is a word. */
.daybar .get {
  font-size: 13px; text-decoration: none; color: #9C9490;
  border-bottom: 1px solid transparent; padding-bottom: 1px;
}
.daybar .get:hover { color: #FFF7EE; border-bottom-color: #6E6680; }
@media (max-width: 400px) { .barnav .here { min-width: 44px; font-size: 12px; } }

/* What the page holds, as one object rather than three sentences. */


.hrow { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.hrow h2.section { margin-bottom: 0; }
.hrow a { font-size: 13px; color: ${ACCENT}; text-decoration: none; font-weight: 600; white-space: nowrap; }

/* The six. A card here is a card because it is one thing to read, not because
   every block on the page got the same rectangle. */
ul.feed { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 12px; }
ul.feed li {
  display: block; border-radius: 18px; padding: 16px 18px;
  background: linear-gradient(180deg, rgba(255, 247, 238, 0.055), rgba(255, 247, 238, 0.022));
  box-shadow: inset 0 0 0 1px rgba(255, 247, 238, 0.09);
  transition: box-shadow 180ms ease, background 180ms ease;
}
ul.feed li:hover {
  background: linear-gradient(180deg, rgba(239, 86, 128, 0.10), rgba(255, 247, 238, 0.03));
  box-shadow: inset 0 0 0 1px rgba(239, 86, 128, 0.42), 0 18px 38px rgba(0, 0, 0, 0.34);
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
.k-event { color: #F0A63C; }
.k-release { color: #3FBFA3; }
.k-sport { color: #6FA8FF; }
.k-science { color: #C4AEFF; }
.k-record { color: #6FA8FF; }
.k-price { color: #F0A63C; }
.k-weather { color: #6FA8FF; }
.k-local { color: #3FBFA3; }
.k-older { color: #C4AEFF; }
.k-tech { color: #3FBFA3; }
.k-music { color: #C4AEFF; }
.k-cinema { color: #F0A63C; }
/* Two hues that nothing else on the page uses, for the two categories that
   are the reason the curated table exists. */
.k-gaming { color: #9BE07A; }
.k-meme { color: #F58BC8; }
ul.feed .yr {
  font-family: Georgia, serif; font-size: 15px; font-weight: 700; color: ${QUIET};
  font-variant-numeric: tabular-nums;
}
ul.feed .said {
  font-family: Georgia, "Times New Roman", serif; font-size: 18px; line-height: 1.4;
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
  background: linear-gradient(168deg, #221A2E 0%, #17121F 62%);
  border-color: #3A3348;
}
ul.feed li.sealedlead .said {
  font-size: clamp(28px, 4.6vw, 44px); line-height: 1.14; font-weight: 800;
  letter-spacing: -0.015em; margin: 14px 0 0;
}
ul.feed li.sealedlead .yr { font-size: 40px; }
ul.feed li.sealedlead .leadmark {
  display: inline-flex; align-items: center; gap: 7px; margin: 0 0 4px;
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--day-soft, #C6B0F5);
}
ul.feed li.sealedlead .leadmark::before {
  content: ""; width: 18px; height: 2px; border-radius: 2px;
  background: var(--day-soft, #C6B0F5);
}
@media (max-width: 560px) { ul.feed li.sealedlead { padding: 22px 18px 20px; } }

/* The rest, behind one tap. Present in the HTML, so it is still indexed and
   still answers a search: closed is a display state, not a missing page. */
details.more {
  margin: 12px 0 0; border-radius: 16px; overflow: hidden;
  background: rgba(255, 247, 238, 0.035);
  box-shadow: inset 0 0 0 1px rgba(255, 247, 238, 0.09);
}
details.more > summary {
  cursor: pointer; list-style: none; padding: 14px 18px;
  font-size: 14px; font-weight: 700; color: #FFF7EE;
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
}
details.more > summary::-webkit-details-marker { display: none; }
details.more > summary::after { content: "+"; color: ${ACCENT}; font-size: 17px; font-weight: 700; }
details.more[open] > summary::after { content: "\\2212"; }
details.more > summary:hover { background: rgba(239, 86, 128, 0.10); }
details.more .inner { padding: 2px 18px 16px; }
details.more ul { list-style: none; margin: 0; padding: 0; }
details.more ul li {
  display: flex; gap: 12px; align-items: baseline; background: none; border-radius: 0;
  padding: 12px 0; border-top: 1px solid #2A2434;
}
details.more ul li:first-child { border-top: none; }
details.more .y {
  color: ${ACCENT}; font-weight: 700; font-size: 13px; width: 44px; flex: none;
  font-variant-numeric: tabular-nums;
}
details.more .x { font-family: Georgia, serif; font-size: 16px; line-height: 1.4; margin: 0; color: #E9E1DB; }
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
  background: linear-gradient(180deg, rgba(255, 247, 238, 0.055), rgba(255, 247, 238, 0.02));
  box-shadow: inset 0 0 0 1px rgba(255, 247, 238, 0.09);
  text-decoration: none; color: inherit; display: block;
  transition: box-shadow 160ms ease;
}
.who:hover { box-shadow: inset 0 0 0 1px rgba(239, 86, 128, 0.45), 0 16px 32px rgba(0, 0, 0, 0.4); }
.face {
  width: 54px; height: 54px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #2A0B15;
  background-image: linear-gradient(140deg, #FFB0C6, ${ACCENT});
}
/* Four so the row is not one colour, dealt by position and nothing else. No
   meaning is claimed by which face gets which. */
.who:nth-child(4n+2) .face { background-image: linear-gradient(140deg, var(--day-soft), var(--day)); }
.who:nth-child(4n+3) .face { background-image: linear-gradient(140deg, #9FE8D6, #3FBFA3); }
.who:nth-child(4n+4) .face { background-image: linear-gradient(140deg, #FFD79B, #F0A63C); }
.who .n { font-weight: 700; font-size: 14px; margin: 11px 0 0; line-height: 1.25; }
.who .w { color: ${QUIET}; font-size: 12px; margin: 4px 0 0; line-height: 1.3; }
.who .b { color: ${ACCENT}; font-size: 11px; font-weight: 700; margin: 8px 0 0; font-variant-numeric: tabular-nums; }
.who .d { color: ${QUIET}; font-size: 11px; margin: 2px 0 0; }

/* The two dates either side, as somewhere to go rather than two arrows. */
nav.pager.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
nav.pager.cards a {
  display: block; padding: 14px 16px; border-radius: 16px; text-decoration: none; color: inherit;
  background: linear-gradient(180deg, rgba(255, 247, 238, 0.05), rgba(255, 247, 238, 0.02));
  box-shadow: inset 0 0 0 1px rgba(255, 247, 238, 0.09);
  transition: background 160ms ease, box-shadow 160ms ease;
}
nav.pager.cards a:hover {
  background: rgba(239, 86, 128, 0.10);
  box-shadow: inset 0 0 0 1px rgba(239, 86, 128, 0.45), 0 16px 32px rgba(0, 0, 0, 0.34);
}
nav.pager.cards .dir {
  font-size: 10px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase;
  color: ${QUIET}; margin: 0;
}
nav.pager.cards .when {
  font-family: Georgia, serif; font-size: 19px; font-weight: 700; margin: 6px 0 0; color: ${ACCENT};
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
@keyframes draw { from { transform: scaleX(0); } to { transform: none; } }
@media (prefers-reduced-motion: no-preference) {
  .rres:not(:empty) { animation: rise 460ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards; }
  .rbar span {
    transform-origin: left center;
    animation: draw 460ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards;
    animation-delay: calc(90ms + var(--i, 0) * 45ms);
  }
  .rtot, .undo { animation: rise 460ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards; animation-delay: 225ms; }
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
export function head(
  title: string,
  description: string,
  canonical: string,
  image?: string,
  noindex = false,
  bodyClass = "",
  // Anything one kind of page needs in its head and the others do not. A
  // seventh positional argument is not lovely, but the alternative was for
  // every page to carry a field that only date pages ever fill.
  extraHead = "",
): string {
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
${image ? `<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:image" content="${image}">` : ""}
<meta name="twitter:card" content="summary_large_image">
${extraHead}<style>${STYLE}</style>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}><div class="wrap${bodyClass ? ` ${bodyClass}` : ""}">`;
}

const CREDIT = `<p>Names, years and descriptions come from <a href="https://www.wikidata.org">Wikidata</a>, released under <a href="https://creativecommons.org/publicdomain/zero/1.0/">Creative Commons Zero</a>. Credit to Wikipedia and Wikidata.</p>
<p>Birthed is not affiliated with Wikipedia, Wikidata or the Wikimedia Foundation.</p>`;

const SITELINKS = `<p class="sitelinks"><a href="/">Every date</a> · <a href="/support/">Support</a> · <a href="/privacy/">Privacy</a></p>`;

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
<p class="nothing">No account, no sign up, and nothing on this page is loaded from another company. Answer a row and one random string is kept in a cookie, so the same browser is not counted twice on the same date. That is the whole of what is kept about you.</p>
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
 * Every year's number one on this calendar date, newest first.
 *
 * The one thing on this page that belongs to this date and to no other, and
 * the reason somebody who is not looking for a birthday might land here.
 *
 * Years with no covering chart are simply absent, so February 29 shows the
 * seventeen leap years and says nothing about the others. Nothing is filled
 * in from a nearby week.
 */
function songSection(songs: SongOfTheYear[], name: string): string {
  if (songs.length === 0) return "";

  // A wall of covers rather than a list of rows.
  //
  // This is the change that stops the page reading as a scaffold, and it is
  // not a styling change. Until now every section on it was the same stack of
  // rounded rectangles holding a bold line and a grey line, which is what
  // every generated page looks like, and a stranger recognised it in four
  // seconds. Sixty-odd album covers are the one thing on this page that
  // nobody could have produced without the work behind them.
  //
  // Every year is still its own address. "number one song on September 5
  // 1990" is a real thing people type, the answer is already here, and an
  // anchor makes that row linkable without generating a page for every day
  // and year, which would be about 24,500 pages holding four lines each. The
  // year is the link, so it can be copied out of the address bar.
  // One cover. Unchanged from the wall this replaces, because the tile was
  // never the problem: sixty-odd of them in one column was.
  const tile = (song: SongOfTheYear, index: number): string => {
    const art = song.hasArtwork
      ? `<img src="/covers/${coverName(song.song, song.artist)}.jpg" alt=""
   width="300" height="300" loading="lazy" decoding="async">`
      // A recording with no cover gets a made one rather than a grey box or a
      // broken image. Apple's catalogue thins out in the early years and some
      // recordings are restricted by country, so this is a normal state and it
      // should look deliberate.
      : `<span class="none"><span>${escapeHtml(song.song)}</span></span>`;

    // Linked to Apple Music where there is a link. That is not decoration and
    // not an affiliate move: the preview and the cover are published to
    // promote the store, so the link out is the other half of the arrangement.
    const wrapped = song.storeUrl
      ? `<a class="art" href="${escapeHtml(song.storeUrl)}" rel="nofollow noopener">${art}</a>`
      : `<span class="art">${art}</span>`;

    const delay = index < 12 ? ` style="--i:${index}"` : "";

    return `<li id="${song.year}"${delay}>
${wrapped}
<p class="y"><a href="#${song.year}">${song.year}</a></p>
<p class="t" title="${escapeHtml(song.song)}">${escapeHtml(song.song)}</p>
<p class="a">${escapeHtml(song.artist)}</p>
</li>`;
  };

  const oldest = songs[songs.length - 1]?.year ?? "";
  const newest = songs[0]?.year ?? "";
  const covered = songs.filter((song) => song.hasArtwork).length;

  // One link per decade this date actually has a chart for, pointing at the
  // earliest year in it. February 29 has seventeen years and no 1960s at all,
  // so the list is built from the songs rather than from a range.
  const firstOfDecade = new Map<number, number>();
  for (const song of songs) {
    const decade = Math.floor(song.year / 10) * 10;
    const current = firstOfDecade.get(decade);
    if (current === undefined || song.year < current) firstOfDecade.set(decade, song.year);
  }
  const jumps = [...firstOfDecade.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([decade]) => `<a href="#d${decade}">${decade}s</a>`)
    .join(" · ");
  // Two decades is not a line worth writing.
  const decades = firstOfDecade.size >= 3
    ? `<p class="decades">Jump to ${jumps}</p>`
    : "";

  // The dial, and why it is radio buttons.
  //
  // The wall answered "what was number one in my year" by making somebody
  // scroll past sixty-six years they did not ask about to reach the one they
  // did. The dial answers it in one press, and the covers stop being the only
  // way in, which is what lets them fold up below.
  //
  // No script, because this site sends default-src 'none' and that promise is
  // worth more than a drag gesture. A radio group already does the two things
  // that matter: a click picks a year, and the arrow keys walk them. The rules
  // that show the matching panel are generated here rather than living in
  // STYLE, because which years exist depends on the date and February 29 has
  // seventeen of them.
  const buildYear = new Date().getUTCFullYear();
  const selected = songs[0]?.year;
  const radios = songs
    .map((song) => `<input type="radio" name="dialyear" id="dy${song.year}"${song.year === selected ? " checked" : ""}>`)
    .join("");
  // Oldest to newest left to right, which is the direction a year runs.
  const ordered = [...songs].sort((a, b) => a.year - b.year);
  const ticks = ordered
    .map((song) => `<label for="dy${song.year}"${song.year % 10 === 0 ? ' class="dec"' : ""} title="${song.year}"><span class="sr">${song.year}</span></label>`)
    .join("");
  const picks = songs.map((song) => {
    const [y, m, d] = song.chartDate.split("-");
    const issued = m && d && y ? `${monthName(Number(m))} ${Number(d)}, ${y}` : song.chartDate;
    return `<div class="pick p${song.year}">
<p class="yr">${song.year}</p>
<div class="body">
<p class="said">${escapeHtml(song.song)}</p>
<p class="by">${escapeHtml(song.artist)}</p>
<p class="when">${escapeHtml(CHART_NAME)}, issue dated ${issued}</p>
<p class="turns">Somebody born on ${escapeHtml(name)}, ${song.year} turns ${buildYear - song.year} in ${buildYear}.</p>
</div>
</div>`;
  }).join("\n");
  const dialRules = songs
    .map((song) => `#dy${song.year}:checked~.now .p${song.year}{display:flex}#dy${song.year}:checked~.ticks label[for=dy${song.year}]{background:${ACCENT};border-left-color:${ACCENT}}`)
    .join("");

  const dial = `<style>${dialRules}</style>
<div class="dial">
<p class="diallabel">Pick a year</p>
${radios}
<div class="ticks">${ticks}</div>
<div class="now">
${picks}
</div>
</div>`;

  // The covers, folded by decade, newest open.
  //
  // A wall of sixty-odd is a long scroll to get past on the way to the people,
  // and somebody looking for the nineties had to travel through the twenties
  // to reach them. A details element per decade is one press to the decade you
  // want and no press at all for the years you do not, and it needs no script.
  // Every year keeps its own anchor inside, and a browser opens a details to
  // reach a target within it, so /september-7/#1996 still lands on 1996.
  const byDecade = new Map<number, SongOfTheYear[]>();
  for (const song of songs) {
    const decade = Math.floor(song.year / 10) * 10;
    const bucket = byDecade.get(decade);
    if (bucket) bucket.push(song);
    else byDecade.set(decade, [song]);
  }
  let index = 0;
  const shelves = [...byDecade.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([decade, group], position) => {
      const items = group.map((song) => tile(song, index++)).join("\n");
      const years = group.length === 1 ? "1 year" : `${group.length} years`;
      // The newest decade is open, so the section is never a row of shut
      // drawers with nothing to look at.
      return position === 0
        ? `<section class="shelf" id="d${decade}">
<h3 class="shelfhead">${decade}s <span class="n">${years}</span></h3>
<ol class="covers">
${items}
</ol>
</section>`
        : `<details class="more shelf" id="d${decade}">
<summary>${decade}s <span class="n">${years}</span></summary>
<ol class="covers">
${items}
</ol>
</details>`;
    })
    .join("\n");

  return `<h2 class="section">The number one song on ${escapeHtml(name)}</h2>
<p class="lede">Every year from ${oldest} to ${newest}, from the chart week that ${escapeHtml(name)} fell in.</p>
${dial}
${decades}
${shelves}
<p class="credit">Chart positions are from the ${escapeHtml(CHART_NAME)}, compiled by Wikipedia and released under Creative Commons Attribution ShareAlike. ${covered > 0 ? "Cover art and the links to Apple Music come from the iTunes Search API. " : ""}Birthed is not affiliated with Billboard, Wikipedia or Apple.</p>`;
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

function factsSection(facts: Fact[], name: string): string {
  if (facts.length === 0) return "";

  const rows = facts.map((fact) => `<li>
<p class="what">${escapeHtml(fact.fact)}</p>
<p class="src"><a href="${escapeHtml(fact.sourceUrl)}" rel="nofollow noopener">${escapeHtml(hostOf(fact.sourceUrl))}</a></p>
</li>`).join("\n");

  return `<h2 class="section">What happened on ${escapeHtml(name)}</h2>
<p class="lede">${facts.length} things, each with the page it came from.</p>
<ul class="facts">
${rows}
</ul>
<p class="credit">Found by Google's Gemini searching the web, and kept only when the page it cited answered. Birthed is not affiliated with Google.</p>`;
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
export function dayHue(month: number): { day: string; soft: string } {
  // 25 puts January in orange and September in violet, and steps a month
  // every 30 degrees from there, which keeps all twelve clear of the pink.
  const hue = ((month - 1) * 30 + 25) % 360;
  return { day: `hsl(${hue} 72% 62%)`, soft: `hsl(${hue} 82% 80%)` };
}

/**
 * What a researched fact's kind is called on the page.
 *
 * Every value the researcher is allowed to return is here. A Wikipedia line
 * has no kind, so it is called an event, which is what its section of the
 * article is called and is true of all of them.
 */
const KINDS: Record<string, { label: string; klass: string }> = {
  event: { label: "Event", klass: "k-event" },
  release: { label: "Released", klass: "k-release" },
  sport: { label: "Sport", klass: "k-sport" },
  science: { label: "Science", klass: "k-science" },
  record: { label: "Record", klass: "k-record" },
  price: { label: "Then and now", klass: "k-price" },
  weather: { label: "Weather", klass: "k-weather" },
  local: { label: "Local", klass: "k-local" },
  older_than: { label: "Older than", klass: "k-older" },
  // The curated rows. These are the five the cultural_event_category type
  // allows, and they get two colours of their own rather than borrowing from
  // the nine above, because the point of the table is that a reader can see at
  // a glance that this row is not another line out of an encyclopedia.
  tech: { label: "Tech", klass: "k-tech" },
  gaming: { label: "Gaming", klass: "k-gaming" },
  meme: { label: "Internet", klass: "k-meme" },
  music: { label: "Music", klass: "k-music" },
  cinema: { label: "Film", klass: "k-cinema" },
};

function kindOf(category: string | null): { label: string; klass: string } {
  if (category === null) return { label: "Event", klass: "k-event" };
  return KINDS[category] ?? { label: "Event", klass: "k-event" };
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
 * How many people who answered this row remembered it, on a sealed date.
 *
 * **This is a count and not a rating.** The difference matters more than any
 * other line in this file. A model saying a row is an eight out of ten is an
 * opinion wearing a number, and it is the exact thing that makes a site read
 * as generated. "Eleven of the fourteen people who answered this remembered
 * it" is a fact about a room. Nobody can argue with it, it says nothing about
 * whether the event was good or important, and it is the only measurement this
 * project exists to produce.
 *
 * So it is safe beside the things a rating would not be. The September 11
 * attacks carry no judgement here, only how many of the people who came said
 * they remembered, which is true of them rather than of the day.
 *
 * It is not a direction. There are three answers, "never heard of it" counts
 * the same as the others, and nothing here subtracts, so no crowd can push a
 * row off a page by arriving. That is what `docs/first-impression-brief.md`
 * forbids, and this is not it.
 *
 * **The floor is the whole safety.** A number is powerful at nine hundred
 * answers and embarrassing at nine, and printing "one of the two people who
 * answered this" tells a stranger the site is empty in a way no absence would.
 * Below the floor a sealed row says nothing at all, which is the same bargain
 * the front page already makes.
 */
const ENOUGH_TO_COUNT = 10;

function inWords(n: number): string {
  const words = [
    "no", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
    "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
  ];
  return words[n] ?? String(n);
}

function rememberedLine(count: MemoryCount | undefined): string {
  if (count === undefined) return "";
  const answered = count.there + count.remembers + count.heard + count.never;
  if (answered < ENOUGH_TO_COUNT) return "";
  const remembered = count.there + count.remembers;
  return `<p class="tally">${inWords(remembered)} of the ${inWords(answered)} people who answered this remembered it</p>`;
}

function feedSection(
  picked: TimelineRow[],
  rest: TimelineRow[],
  total: number,
  name: string,
  searched: number,
  fromWikipedia: number,
  curated = 0,
  // Carried in rather than parsed back out of the name, because the form posts
  // numbers and a page that reparses its own heading is one typo from posting
  // an answer against the wrong date.
  month = 0,
  day = 0,
  /// Whether this date has sealed, which is the only thing that earns a row
  /// the front page treatment.
  sealed = false,
  /// The rows the ask cards at the top of the page were taken from, each as
  /// "kind:id". They are drawn here without their forms and their identifiers,
  /// because the cards carry them, and today.css hides all of them on the three
  /// open dates so no row is on the page twice.
  ///
  /// All of them, not only the one showing. Only one card is revealed per
  /// request and the others could in principle keep their place in the feed,
  /// but a row that moves between two places on the page depending on which
  /// card was dealt is a row whose identifiers would have to be in both, and
  /// an identifier in two places is the bug this class exists to prevent. Four
  /// missing rows out of a hundred and fifty is a price worth paying for that.
  asked: string[] = [],
  /// What each row's own people said, on a sealed date. Empty everywhere else.
  memory: Map<string, MemoryCount> | null = null,
): string {
  if (picked.length === 0) return "";
  const tallyFor = (row: TimelineRow) =>
    memory === null ? "" : rememberedLine(memory.get(`${row.kind}:${row.id}`));
  const askedSet = new Set(asked);
  const isAsked = (row: TimelineRow) => askedSet.has(`${row.kind}:${row.id}`);

  const cards = picked.map((row, index) => {
    const kind = kindOf(row.category);
    // Only the first few are staggered. The rest are below the fold on every
    // screen, so animating them would move things nobody is looking at.
    const delay = index < 6 ? ` style="--i:${index}"` : "";
    const lead = [index === 0 ? (sealed ? "lead sealedlead" : "lead") : "", isAsked(row) ? "asked" : ""]
      .filter((c) => c !== "").join(" ");
    // Said above the lead rather than left to be inferred, because a row set
    // four times the size of the one under it is a claim, and the reader is
    // owed what the claim rests on.
    const mark = index === 0 && sealed
      ? `<span class="leadmark">Most remembered</span>`
      : "";
    return `<li class="${lead}"${isAsked(row) ? "" : ` id="r-${row.kind}-${escapeHtml(row.id)}"`}${delay}>
<span class="head"><span class="tag ${kind.klass}">${kind.label}</span><span class="yr">${row.year === null ? "" : row.year}</span></span>
${mark}
<p class="said">${escapeHtml(row.text)}</p>
${whenOf(row.dateKind) ? `<p class="datenote">${whenOf(row.dateKind)}</p>` : ""}
${row.sourceUrl ? `<p class="src"><a href="${escapeHtml(row.sourceUrl)}" rel="nofollow noopener">${escapeHtml(hostOf(row.sourceUrl))}</a></p>` : ""}
${tallyFor(row)}${isAsked(row) ? "" : rememberForm(row.kind, row.id, month, day)}
${isAsked(row) ? "" : `<p class="mine"></p>`}
</li>`;
  }).join("\n");

  const others = rest.map((row) => `<li${isAsked(row) ? ` class="asked"` : ` id="r-${row.kind}-${escapeHtml(row.id)}"`}>
<span class="y">${row.year === null ? "&nbsp;" : row.year}</span>
<span>
<p class="x">${escapeHtml(row.text)}</p>
${whenOf(row.dateKind) ? `<p class="datenote">${whenOf(row.dateKind)}</p>` : ""}
${row.sourceUrl ? `<p class="src"><a href="${escapeHtml(row.sourceUrl)}" rel="nofollow noopener">${escapeHtml(hostOf(row.sourceUrl))}</a></p>` : ""}
${tallyFor(row)}${isAsked(row) ? "" : rememberForm(row.kind, row.id, month, day)}
${isAsked(row) ? "" : `<p class="mine"></p>`}
</span>
</li>`).join("\n");

  const drawer = rest.length > 0
    ? `<details class="more">
<summary><span>Everything else that happened</span><span>${rest.length} more</span></summary>
<div class="inner">
<ul>
${others}
</ul>
</div>
</details>`
    : "";

  const spread = [...picked, ...rest]
    .filter((row) => row.dateKind === "went_viral").length;

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
      ? `<p class="credit">The other ${fromWikipedia} are from the ${escapeHtml(name)} article on Wikipedia, quoted as written and released under Creative Commons Attribution ShareAlike. Birthed is not affiliated with Wikipedia or the Wikimedia Foundation.</p>`
      : "",
  ].filter((line) => line !== "").join("\n");

  return `<div class="hrow"><h2 class="section">What happened</h2></div>
<p class="lede">${rest.length === 0 ? `${total} things, newest first.` : `${picked.length} worth stopping on, out of ${total}.`}</p>
${yearAsk(month, day)}
<ul class="feed">
${cards}
</ul>
${drawer}
${credits}`;
}

/** The initials on a face, which is all we have: there are no photographs. */
function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter((part) => part.length > 0);
  const first = parts[0]?.charAt(0) ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return (first + second).toUpperCase();
}

/** Ten people as a row that is pushed, not a column that is scrolled past. */
function peopleRail(page: DayPage, name: string): string {
  if (page.people.length === 0) return `<p class="lede">Nobody imported for this date yet.</p>`;

  const cards = page.people.map((person) => `<a class="who" href="https://www.wikidata.org/wiki/${escapeHtml(person.qid)}" rel="nofollow noopener">
${faceOrInitials(person, "face")}
<p class="n">${escapeHtml(person.name)}</p>
${person.description && tidyDescription(person.description) ? `<p class="w">${escapeHtml(tidyDescription(person.description))}</p>` : ""}
<p class="b">${escapeHtml(birthYearLabel(person)) || "&nbsp;"}</p>
${person.deathYear ? `<p class="d">died ${person.deathYear}</p>` : ""}
</a>`).join("\n");

  return `<div class="hrow"><h2 class="section">Who shares it</h2></div>
<p class="lede">${page.people.length} ${page.people.length === 1 ? "person" : "people"} born on ${escapeHtml(name)}.</p>
<div class="rail">
${cards}
</div>`;
}

/**
 * The first thing anybody sees, and the reason the counts are gone.
 *
 * "51 things, 67 number ones, 10 people" was inventory. It is the number that
 * was easiest to compute, promoted to the most valuable space on the page, and
 * it made a reader feel nothing. Under it sat three identical event cards
 * starting in 878, so the first screen was text, then text, then text, and the
 * whole thing read as an archive inside two seconds.
 *
 * Three tiles instead, chosen to be unalike rather than to be complete. A
 * person, some album art, and one thing that happened. A face, a picture and a
 * fact, in three different visual registers, before the eye reaches a list of
 * anything.
 *
 * The third tile takes cardHighlight, which is the same function that picks the
 * line for the share image, and it is reused here on purpose: it already
 * refuses killings, bombings and crashes. 41 percent of the 19,734 Wikipedia
 * events match that filter and every date has at least one. Without it, 134 of
 * the 366 pages would open on somebody's worst day.
 */
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

function faceOrInitials(person: Person, className: string): string {
  return person.hasImage === true
    ? `<img class="${className}" src="/faces/${faceName(person.qid)}.jpg" alt="" loading="lazy" decoding="async">`
    : `<span class="${className} noface">${escapeHtml(initialsOf(person.name))}</span>`;
}

/**
 * Three buttons under a row, and no script anywhere near them.
 *
 * A plain form that posts and redirects back. That is not nostalgia. The whole
 * argument this site makes about itself is that it runs nothing, and a voting
 * widget written in JavaScript would have spent that argument on a feature a
 * 1993 browser could already do.
 *
 * Three answers and no fourth, and none of them is a downvote. There is no way
 * to say a thing did not matter, only whether it reached you. A direction is a
 * weapon, and an up and down score on January 6 or October 7 is a brigading
 * target inside a week on a site whose whole claim is to be a sourced record.
 *
 * "I was there" was the fourth and is gone from both clients. It asks about
 * presence, and this measures transmission, which is a different question:
 * nobody was there for a diplomatic announcement and nobody was there for a
 * song being number one. It was answerable on a small minority of rows, which
 * made it noise near the top of the scale rather than a rung of it. The three
 * that are left ask the same question of every row on the page.
 *
 * `there` stays in DEPTHS and in the check constraint even so, because this
 * form offered it from the day it shipped and those answers are already in the
 * table. A value that is no longer offered still has to be readable, or every
 * row that collected one quietly reports a smaller total than it has.
 *
 * "Never heard of it" is an answer rather than an absence, and it is the most
 * interesting one this can collect: a row that is thoroughly documented and
 * that nobody has heard of is a fact about the world you cannot get any other
 * way, and it is invisible if you only count the people who remember.
 *
 * The form is drawn on every date, including the ones that are sealed, because
 * the page is baked ahead of time and cannot know today's date. The server
 * knows, refuses politely, and sends the reader back to an explanation. The
 * check that matters is in the database and cannot be reached from a client at
 * all.
 */
/**
 * The one thing this site asks a reader about themselves.
 *
 * Crossed with the answers below it, a birth year produces the thing none of
 * this is worth doing without: a map of what each generation remembers.
 * Everybody born before 1985 remembering something that nobody born after
 * 2000 has heard of is a fact about the world that cannot be scraped from
 * anywhere, because nobody has ever collected it. Until this control existed
 * every answer this site took stored a null year, so none of that was
 * possible.
 *
 * **Asked once and kept in a cookie, not carried by the forms.** A radio group
 * or a select outside a form cannot reach into one without a script, and this
 * site runs none, so the alternative was repeating the picker inside all 150
 * forms on the page. Instead it posts to its own address, the year joins the
 * token in a cookie, and every answer after it carries the year server side
 * without any form knowing about it.
 *
 * **A returning reader is asked again, and that is a real cost.** The page is
 * baked ahead of time and cannot know what is in anybody's cookie, so this
 * control looks the same to somebody who set it a month ago. Posting it twice
 * is harmless, it just writes the same cookie. The alternative is reading the
 * database or the cookie on every page view, and not doing that on an ordinary
 * page view is the property that keeps this site up when Supabase is not.
 *
 * The year is never shown to anybody, never joined to a name, and lives in the
 * same place the token does. `remembrances.birth_year` is the only column it
 * reaches.
 */
function yearAsk(month: number, day: number): string {
  const now = new Date().getUTCFullYear();
  const firstDecade = 1930;
  const lastDecade = Math.floor(now / 10) * 10;

  const decades: number[] = [];
  for (let decade = lastDecade; decade >= firstDecade; decade -= 10) decades.push(decade);

  // The radios come first and are invisible. They are the only state this
  // control has, and CSS reveals one row of years from which one is checked.
  const radios = decades
    .map((d) => `<input type="radio" name="dec" id="dec${d}" class="decpick">`)
    .join("");

  const decadeChips = decades
    .map((d) => `<label for="dec${d}">${d}s</label>`)
    .join("");

  const yearRows = decades.map((d) => {
    const years: string[] = [];
    for (let year = d; year < d + 10 && year <= now; year++) {
      years.push(`<button type="submit" name="y" value="${year}">${year}</button>`);
    }
    return `<div class="yg yg${d}">${years.join("")}</div>`;
  }).join("");

  return `<p class="yearset" id="yearset">Your answers carry <span class="yearsetv"></span>. <a href="#yearask">Change it</a></p>
<div class="yearask" id="yearask">
<p class="yearlede">Answers are more useful with a year on them. <b>Born in?</b></p>
<form method="post" action="/year">
<input type="hidden" name="m" value="${month}">
<input type="hidden" name="d" value="${day}">
${radios}
<div class="yeardecs">${decadeChips}</div>
<div class="yearyears">${yearRows}</div>
</form>
<p class="yearnote">Two taps. Kept in a cookie on this browser, sent with your answers, and never shown to anybody.</p>
</div>`;
}

function rememberForm(kind: string, id: string, month: number, day: number): string {
  const answers: Array<[string, string]> = [
    ["remember", "I remember it"],
    ["heard", "Heard of it"],
    ["never", "Never heard of it"],
  ];
  return `<form class="rem" method="post" action="/remember">
<input type="hidden" name="k" value="${escapeHtml(kind)}">
<input type="hidden" name="i" value="${escapeHtml(id)}">
<input type="hidden" name="m" value="${month}">
<input type="hidden" name="d" value="${day}">
${answers.map(([value, label]) => `<button type="submit" name="a" value="${value}">${label}</button>`).join("")}
</form>
<p class="rres" id="${resultId(kind, id)}"></p>`;
}

/**
 * Where the server writes a result, and why it is baked in empty.
 *
 * The pages are built ahead of time and cannot know what anybody has answered,
 * so the row carries an empty paragraph and the server fills exactly one of
 * them on the request that follows an answer. Empty paragraphs draw as nothing
 * because of `.rres:empty`, and this is the same trick the two afterword
 * sentences already use: the shape is in the page and the server decides which
 * one the reader sees.
 */
export function resultId(kind: string, id: string): string {
  return `rr-${kind}-${id}`.replace(/[^A-Za-z0-9_-]/g, "_");
}

/**
 * What a row looked like to everybody, drawn after the reader has answered it.
 *
 * Shown to somebody who has answered and to nobody else. A count in front of a
 * reader who has not answered tells them what the popular answer is, and an
 * answer given after reading that is agreement rather than memory, which is
 * the one measurement this whole thing exists to take. A reader who has
 * already committed cannot be biased, and showing them nothing is why this
 * site was write only for its first three days: it took an answer and said
 * "Kept", which is a form rather than a thing worth coming back to.
 *
 * The bars are a span with an inline width and no script anywhere near them.
 * style-src carries 'unsafe-inline' already, for the one inline stylesheet
 * every page on this site has.
 */
export function resultMarkup(counts: Remembered): string {
  const total = counts.there + counts.remembers + counts.heard + counts.never;
  if (total === 0) return "";

  const rows: Array<[string, number]> = [];
  // "I was there" is no longer offered by either client, and rows that
  // collected one before it went are still drawn, or the numbers under a row
  // would not add up to the total printed beside them.
  if (counts.there > 0) rows.push(["I was there", counts.there]);
  rows.push(["I remember it", counts.remembers]);
  rows.push(["Heard of it", counts.heard]);
  rows.push(["Never heard of it", counts.never]);

  // --i is the bar's place in the list, for the stagger when the result
  // lands. Same variable the covers and the feed rise on.
  const bars = rows.map(([label, count], index) => {
    const share = Math.round((count / total) * 100);
    return `<span class="rrow"><span class="rlab">${escapeHtml(label)}</span>` +
      `<span class="rbar"><span style="width:${count > 0 ? Math.max(share, 2) : 0}%;--i:${index}"></span></span>` +
      `<span class="rnum">${count}</span></span>`;
  }).join("");

  const said = total === 1 ? "1 answer so far" : `${total} answers so far`;
  return `${bars}<span class="rtot">${said}</span>`;
}

/**
 * Taking one answer back, for half a minute.
 *
 * Drawn only beside a result, which is only drawn on the request that follows
 * an answer, so it is never on a page somebody is merely reading. The window
 * is enforced in the database, in forget(), which also matches on the token so
 * it can only ever reach an answer this browser gave. A button pressed too
 * late is refused there and the page says so.
 *
 * An undo rather than a way to change your mind. A misclick is noticed at
 * once; second thoughts about your place in the room take longer than that,
 * and by then the result is on screen, so a longer window is a window to
 * switch to whatever the majority said.
 */
export function undoForm(kind: string, id: string, month: number, day: number): string {
  return `<form class="undo" method="post" action="/forget">
<input type="hidden" name="k" value="${escapeHtml(kind)}">
<input type="hidden" name="i" value="${escapeHtml(id)}">
<input type="hidden" name="m" value="${month}">
<input type="hidden" name="d" value="${day}">
<button type="submit">Undo</button>
</form>`;
}

export interface Remembered {
  there: number;
  remembers: number;
  heard: number;
  never: number;
}

/**
 * What happened after you tapped, said without a script.
 *
 * The server redirects to one of these two fragments and `:target` reveals the
 * matching one. The same trick the year dial on this site already runs on, and
 * the reason it is worth the trouble: the alternative was either a page that
 * silently swallows an answer or a page that runs JavaScript to say thank you.
 */
const AFTER = `<p class="afterword" id="kept">Kept. It counts towards what this date is remembered for, and it will still be here next year.</p>
<p class="afterword" id="sealed">This date is sealed. A day takes answers on the day itself and the day either side, and then it closes until next year. Come back on the day.</p>
<p class="afterword" id="failed">That did not save, and it was this end rather than yours. The date is fine and nothing is closed. Try it again.</p>
<p class="afterword" id="cooling">Not yet. A minute or two between answers, then the next one.</p>
<p class="afterword" id="spent">That is every row on this date. There is nothing left to answer here, which almost nobody manages. The date opens again next year.</p>
<p class="afterword" id="already">You have already answered that one, on this browser. It is below, with what everybody else said. Nothing is sealed and the rest of the date is still open.</p>
<p class="afterword" id="undone">Taken back. Nothing was recorded and you can answer it again.</p>
<p class="afterword" id="toolate">That one is in. It counts from here. An answer can be taken back for half a minute and then it stands.</p>`;

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
 * The ask cards, drawn only on the three open dates by today.css, one at a
 * time.
 *
 * Each carries the row's real identifiers, r-kind-id and rr-kind-id, so the
 * redirect after an answer lands here and the server writes the result here.
 * Every one of these rows is drawn in the feed without them; feedSection does
 * that, and today.css hides all of them there so no row is on the page twice.
 *
 * The slot classes are the whole rotation. today.css picks one number from
 * zero to ASK_SLOTS minus one and reveals whatever carries it. A card lists
 * every slot that lands on it under this page's own count, so a date with two
 * candidates and a date with five both resolve any slot the sheet sends, and
 * neither can be sent a number that reveals nothing.
 */
function askSection(rows: TimelineRow[], songs: SongOfTheYear[], month: number, day: number): string {
  if (rows.length === 0) return "";
  return rows.map((row, index) => askCard(row, rows.length, index, songs, month, day)).join("\n");
}

function askCard(
  row: TimelineRow,
  count: number,
  index: number,
  songs: SongOfTheYear[],
  month: number,
  day: number,
): string {
  const song = songs.find((s) => s.year === row.year && s.hasArtwork === true);
  const art = song === undefined
    ? ""
    : `<span class="askart"><img src="/covers/${coverName(song.song, song.artist)}.jpg" alt="" width="64" height="64" decoding="async"></span>`;
  // What the card asks, and what it rests on.
  //
  // When somebody has written a line for this row, the card sets that as the
  // question and prints the row's own sentence under it, next to the link. It
  // is not decoration and it is not a hedge. The whole argument of this site is
  // that it says what a person would say and can be checked, and a card that
  // showed only the written line would be the first place on it where a
  // sentence appeared with nothing behind it.
  const record = row.leadLine === undefined
    ? ""
    : `<span class="askrec">${escapeHtml(row.text)}</span>`;
  const caption = [
    record,
    song === undefined ? "" : `Number one that week: <b>${escapeHtml(song.song)}</b>, ${escapeHtml(song.artist)}.`,
    row.sourceUrl ? `Source: <a href="${escapeHtml(row.sourceUrl)}" rel="nofollow noopener">${escapeHtml(hostOf(row.sourceUrl))}</a>` : "",
  ].filter((part) => part !== "").join(" &nbsp;");
  const slots: string[] = [];
  for (let slot = 0; slot < ASK_SLOTS; slot += 1) {
    if (slot % count === index) slots.push(`asks${slot}`);
  }
  return `<section class="ask ${slots.join(" ")}" id="r-${row.kind}-${escapeHtml(row.id)}">
<div class="askhead"><span class="asklab">Do you remember this one?</span><span class="askyr">${row.year}</span></div>
<div class="askbody${art === "" ? " noart" : ""}">
${art}
<p class="asksaid">${escapeHtml(row.leadLine ?? row.text)}</p>
${caption === "" ? "" : `<p class="askcap">${caption}</p>`}
</div>
${rememberForm(row.kind, row.id, month, day)}
<p class="mine"></p>
<p class="askrule">One tap, no account, anonymous. A minute or two between answers, no score, and "never heard of it" counts the same as the others.</p>
</section>`;
}

function openingBand(
  page: DayPage,
  songs: SongOfTheYear[],
  culture: CulturalEvent[],
  highlight: Highlight | null,
): string {
  const person = page.people[0];
  const withArt = songs.filter((song) => song.hasArtwork === true);
  // One cover, not four.
  //
  // Four of them tiled behind a caption was the wrong idea twice over. Album
  // covers are designed to be the loudest thing in any frame, so four
  // unrelated ones fight each other, and putting words on top of that made the
  // words unreadable whatever the veil did. One cover, at a size somebody
  // chose the artwork for, with the caption underneath on a solid background.
  const cover = withArt[0];

  const faceTile = person === undefined ? "" : `<a class="tile" href="https://www.wikidata.org/wiki/${escapeHtml(person.qid)}" rel="nofollow noopener">
<span class="tpic t-person">${faceOrInitials(person, "tbg")}</span>
<span class="tin"><span class="tlab">Born on this day</span><b class="tbig">${escapeHtml(person.name)}</b><span class="tsub">${escapeHtml(birthYearLabel(person))}</span></span>
</a>`;

  const artTile = cover === undefined ? "" : `<div class="tile">
<span class="tpic t-music"><img src="/covers/${coverName(cover.song, cover.artist)}.jpg" alt="" loading="lazy" decoding="async"></span>
<span class="tin"><span class="tlab">Number one, ${cover.year}</span><b class="tbig">${escapeHtml(cover.song)}</b><span class="tsub">${escapeHtml(cover.artist)}</span></span>
</div>`;

  const newest = [...culture].sort((a, b) => b.year - a.year)[0];
  const moment = newest !== undefined
    ? { year: newest.year, text: newest.title, label: "Out on this date" }
    : highlight !== null
      ? { year: highlight.year, text: highlight.text, label: "On this date" }
      : null;
  const momentTile = moment === null ? "" : `<div class="tile">
<span class="tpic t-moment"><span class="tyr">${moment.year}</span></span>
<span class="tin"><span class="tlab">${moment.label}</span><b class="tbig">${escapeHtml(moment.text)}</b></span>
</div>`;

  const tiles = [faceTile, artTile, momentTile].filter((t) => t !== "");
  if (tiles.length === 0) return "";
  return `<p class="alsolab">Also on this date</p>
<section class="tiles">\n${tiles.join("\n")}\n</section>`;
}

/**
 * What came out on this date, above what happened on it.
 *
 * These are the rows a reader under forty actually recognises, and until now
 * they were sorted by year in among Wikipedia's crusades, which is how a page
 * about somebody's birthday came to open on a Frankish king being crowned in
 * 878. Being a separate section is not a styling preference: they are a
 * different kind of claim, curated or imported against an exact date with a
 * year, where a historical_events row is a month and a day out of a prose list.
 */
function cultureSection(culture: CulturalEvent[], name: string): string {
  if (culture.length === 0) return "";
  const rows = [...culture]
    .sort((a, b) => b.year - a.year)
    .map((event) => {
      const kind = kindOf(event.category);
      const when = whenOf(event.dateKind);
      return `<li class="cul ${kind.klass}" id="r-cultural_event-${escapeHtml(event.id)}">
<span class="cyr">${event.year}</span>
<div><p class="ctx">${escapeHtml(textOf(event))}</p>
<span class="meta"><span class="tag ${kind.klass}">${kind.label}</span><span class="src"><a href="${escapeHtml(event.sourceUrl)}" rel="nofollow noopener">${escapeHtml(hostOf(event.sourceUrl))}</a></span></span>
${when ? `<p class="datenote">${when}</p>` : ""}
${rememberForm("cultural_event", event.id, event.month, event.day)}</div>
</li>`;
    })
    .join("\n");

  // The label has to keep the paragraph that explains it. A reader cannot
  // interpret "when it spread, not when it was posted" on its own, and printing
  // an honest caveat nobody can read is decoration. This moved here with the
  // rows and a test caught it going missing on the way.
  const spread = culture.filter((event) => event.dateKind === "went_viral").length;
  const note = spread > 0
    ? `<p class="credit">${spread === 1 ? "One row says" : `${spread} rows say`} "when it spread, not when it was posted". That means the original posting is gone or was never recorded, and the date is the week it broke out, taken from something published at the time. Printing that instead of a confident year is deliberate.</p>`
    : "";
  const written = culture.filter((event) => event.origin !== "imported").length;
  const imported = culture.length - written;
  const credit = [
    written > 0 ? `<p class="credit">${written === 1 ? "One of these was" : `${written} of these were`} written and checked by hand, against the page ${written === 1 ? "it links" : "each one links"}.</p>` : "",
    imported > 0 ? `<p class="credit">${written > 0 ? `The other ${imported}` : imported === 1 ? "This one" : `All ${imported}`} came out of Wikidata, which records an exact release date for ${imported === 1 ? "it" : "each of them"}. Nothing here was written by a model.</p>` : "",
  ].filter((line) => line !== "").join("\n");

  // No "Open today" flag beside this heading any more. The state line at the
  // top of the page says open or sealed for the whole page, and a flag that
  // appeared beside one section read as if only that section was open.
  return `<div class="hrow"><h2 class="section">What came out</h2></div>
<p class="lede">Games, records and releases dated to ${escapeHtml(name)} itself, newest first.</p>
<ul class="culture">
${rows}
</ul>
${note}
${credit}`;
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
const DICE = `<svg class="ic" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4.6"/><circle cx="8.4" cy="8.4" r="1.35" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="15.6" cy="15.6" r="1.35" fill="currentColor" stroke="none"/></svg>`;

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
  // Culture is no longer merged into the history feed. It was being sorted by
  // year in among Wikipedia's crusades and treaties, which is how a page about
  // a birthday ended up opening on 878. It gets its own section, above.
  const chronological = buildTimeline(facts, events, monthName(page.month), page.day)
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
  // Said once, because the page has visibly rearranged and nothing else on it
  // explains why.
  const memoryNote = memory === null
    ? ""
    : `<p class="memorynote">Sealed. In the order the people who were here remembered it.</p>`;
  const highlight = cardHighlight(facts, events, page.month, page.day);
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

  const image = `${SITE}/og/${slug(page.month, page.day)}.png`;

  // The two dates either side, named in the head as well as linked in the
  // page. This is how a search engine learns that the 366 are one ordered run
  // rather than 366 unrelated pages that happen to look alike.
  const sequence = `<link rel="prev" href="${SITE}/${slug(previous.month, previous.day)}/">
<link rel="next" href="${SITE}/${slug(next.month, next.day)}/">
`;

  const picked = pickHighlights(timeline);
  const rest = theRest(timeline, picked);
  // The row the page opens on. Chosen from the chronological list rather than
  // the remembered order, because a sealed page never draws it.
  const asked = askCandidates(timelineRows);
  const askedKeys = asked.map((row) => `${row.kind}:${row.id}`);
  const hue = dayHue(page.month);
  // The index of all 366 sits at the foot of every date page, which is what
  // lets "/" be today's page instead of a separate front door. A reader who
  // arrives on /april-26/ from a search result can reach any other date from
  // where they landed, and a reader who types birthed.app gets the same page
  // with today's date in it. There is no longer a page whose only job is to
  // point at the pages.
  const indexYear = new Date().getUTCFullYear();
  const shortName = `${monthName(page.month).slice(0, 3)} ${page.day}`;

  return `${head(`Born on ${name}`, description, canonical, image, !isReady(page, facts), "", sequence)}
<div class="day on-${slug(page.month, page.day)}" style="--day:${hue.day};--day-soft:${hue.soft}">
<div class="daybar">
<a class="mark" href="/">Birthed</a>
<span class="barnav">
<a class="arrow" href="/${slug(previous.month, previous.day)}/" title="${monthName(previous.month)} ${previous.day}" aria-label="${monthName(previous.month)} ${previous.day}">&lsaquo;</a>
<span class="here">${shortName}</span>
<a class="arrow" href="/${slug(next.month, next.day)}/" title="${monthName(next.month)} ${next.day}" aria-label="${monthName(next.month)} ${next.day}">&rsaquo;</a>
</span>
<span class="barend">
<a class="dice" href="/random/" title="A random day of the year" aria-label="A random day of the year">${DICE}<span>Random</span></a>
<a class="get" href="/about/">About</a>
</span>
</div>
${AFTER}
<p class="state"><span class="dot" aria-hidden="true"></span>
<span class="sen senpast"><b>Open.</b> Closes tonight, then sealed until next year.</span>
<span class="sen sennow"><b>Open.</b> Closes tomorrow night, then sealed until next year.</span>
<span class="sen sennext"><b>Just opened.</b> Two more days, then sealed until next year.</span>
<span class="sen senshut"><b>Sealed.</b> Opens again on ${monthName(previous.month)} ${previous.day}, for three days.</span>
</p>
<div class="fuse" aria-hidden="true"><span></span></div>
<h1>${name}</h1>
<p class="mechanic">
<span class="sen senopen">Everything below happened on this date. Say which ones you <b>remember</b>. When it shuts, what people remembered rises to the top and stays there for a year.</span>
<span class="sen senshut">Everything below happened on this date. For three days a year it takes answers about what people <b>remember</b> of it, and when it shuts, what they remembered rises to the top and stays there for a year.</span>
</p>
<p class="also">The three open dates right now: <a href="/yesterday/">yesterday</a> <a href="/today/">today</a> <a href="/tomorrow/">tomorrow</a>.</p>
${askSection(asked, songs, page.month, page.day)}
${openingBand(page, songs, culture, highlight)}
${cultureSection(culture, name)}
${memoryNote}${feedSection(picked, rest, timeline.length, name, searched, timeline.length - searched - curatedCount, curatedCount, page.month, page.day, memory !== null, askedKeys, memory)}
${songSection(songs, name)}
${peopleRail(page, name)}
<nav class="pager cards">
<a href="/${slug(previous.month, previous.day)}/">
<p class="dir">&larr; The day before</p>
<p class="when">${monthName(previous.month)} ${previous.day}</p>
</a>
<a class="after" href="/${slug(next.month, next.day)}/">
<p class="dir">The day after &rarr;</p>
<p class="when">${monthName(next.month)} ${next.day}</p>
</a>
</nav>
<section class="everyday">
<h2 class="section">Every day of the year</h2>
<p class="lede">Pick a date and see who shares it and what happened on it. The weeks are laid out the way they fall in ${indexYear}.</p>
${calendar(indexYear, { month: page.month, day: page.day })}
</section>
</div>
<p class="signed">Made by <a href="/about/">Jason Evan Page</a>, one person. No ads, nothing for sale.</p>
${jsonLd(page, canonical)}
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
  return `User-agent: *\nAllow: /\nDisallow: /random\nDisallow: /today\n\nSitemap: ${SITE}/sitemap.xml\n`;
}

