// Rendering a date page. Pure string in, string out, so it can be tested
// without a network and without a browser.

import { DayPage, Person, monthName, neighbours, slug, everyDate } from "./model.js";
import { CHART_NAME, coverName, SongOfTheYear } from "./songs.js";
import { calendar } from "./calendar.js";
import { type CulturalEvent } from "./culture.js";
import { Fact, hostOf } from "./facts.js";
import { buildTimeline, pickHighlights, theRest, type DayEvent, type TimelineRow } from "./timeline.js";

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
h1 {
  font-family: Georgia, "Times New Roman", serif; font-weight: 800;
  font-size: clamp(38px, 9vw, 64px); line-height: 1.05; margin: 0 0 10px;
}
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
.dial .ticks label { flex: 1 0 auto; min-width: 10px; }
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

.home .hero { display: flex; gap: 26px; align-items: flex-start; margin: 8px 0 0; }
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
.heroart { position: relative; flex: none; display: block; line-height: 0; }
.heroart::before {
  content: ""; position: absolute; inset: -22px; border-radius: 44px;
  background: radial-gradient(closest-side, rgba(239, 86, 128, 0.45), transparent 72%);
  filter: blur(12px);
}
.heroart img {
  position: relative; width: 104px; height: 104px; border-radius: 26px; display: block;
  box-shadow: 0 20px 46px rgba(239, 86, 128, 0.30), 0 0 0 1px rgba(255, 247, 238, 0.10);
  animation: bob 6s ease-in-out infinite;
}
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

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
.railtrack {
  display: flex; gap: 14px; flex: none; list-style: none; margin: 0; padding: 0;
  animation: rail 72s linear infinite;
}
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
  .home .hero { flex-direction: column; gap: 16px; }
  .wrap.home { padding-left: 16px; padding-right: 16px; }
  .picker { padding: 16px 15px 17px; }
}

/* Nothing on this page needs to move for it to work. */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .heroart img { animation: none; }
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
.counts {
  display: grid; grid-template-columns: repeat(3, 1fr);
  margin: 22px 0 0; padding: 14px 4px;
  border-top: 1px solid #2A2434; border-bottom: 1px solid #2A2434;
}
.counts div { text-align: center; border-left: 1px solid #2A2434; }
.counts div:first-child { border-left: none; }
.counts b {
  display: block; font-family: Georgia, serif; font-size: 22px; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.counts span {
  display: block; margin-top: 6px; font-size: 11px; letter-spacing: 0.13em;
  text-transform: uppercase; color: #A79E98;
}
.counts b { color: #FFF7EE; }

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
 */
export const FOOT = `<footer>
${SITELINKS}
<p class="nothing">No account, no sign up and nothing to fill in. This page sets no cookies and loads nothing from any other company.</p>
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
function feedSection(
  picked: TimelineRow[],
  rest: TimelineRow[],
  total: number,
  name: string,
  searched: number,
  fromWikipedia: number,
  curated = 0,
): string {
  if (picked.length === 0) return "";

  const cards = picked.map((row, index) => {
    const kind = kindOf(row.category);
    // Only the first few are staggered. The rest are below the fold on every
    // screen, so animating them would move things nobody is looking at.
    const delay = index < 6 ? ` style="--i:${index}"` : "";
    return `<li class="${index === 0 ? "lead" : ""}"${delay}>
<span class="head"><span class="tag ${kind.klass}">${kind.label}</span><span class="yr">${row.year === null ? "" : row.year}</span></span>
<p class="said">${escapeHtml(row.text)}</p>
${whenOf(row.dateKind) ? `<p class="datenote">${whenOf(row.dateKind)}</p>` : ""}
${row.sourceUrl ? `<p class="src"><a href="${escapeHtml(row.sourceUrl)}" rel="nofollow noopener">${escapeHtml(hostOf(row.sourceUrl))}</a></p>` : ""}
</li>`;
  }).join("\n");

  const others = rest.map((row) => `<li>
<span class="y">${row.year === null ? "&nbsp;" : row.year}</span>
<span>
<p class="x">${escapeHtml(row.text)}</p>
${whenOf(row.dateKind) ? `<p class="datenote">${whenOf(row.dateKind)}</p>` : ""}
${row.sourceUrl ? `<p class="src"><a href="${escapeHtml(row.sourceUrl)}" rel="nofollow noopener">${escapeHtml(hostOf(row.sourceUrl))}</a></p>` : ""}
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
<p class="lede">${rest.length === 0 ? `${total} things, oldest first.` : `${picked.length} worth stopping on, out of ${total}.`}</p>
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
<span class="face">${escapeHtml(initialsOf(person.name))}</span>
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

export function renderDayPage(
  page: DayPage,
  songs: SongOfTheYear[] = [],
  facts: Fact[] = [],
  events: DayEvent[] = [],
  culture: CulturalEvent[] = [],
): string {
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
  const timeline = buildTimeline(facts, events, monthName(page.month), page.day, culture);
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
<div class="day" style="--day:${hue.day};--day-soft:${hue.soft}">
<div class="daybar">
<a class="mark" href="/">Birthed</a>
<span class="barnav">
<a class="arrow" href="/${slug(previous.month, previous.day)}/" title="${monthName(previous.month)} ${previous.day}" aria-label="${monthName(previous.month)} ${previous.day}">&lsaquo;</a>
<span class="here">${shortName}</span>
<a class="arrow" href="/${slug(next.month, next.day)}/" title="${monthName(next.month)} ${next.day}" aria-label="${monthName(next.month)} ${next.day}">&rsaquo;</a>
</span>
<a class="get" href="/about/">About</a>
</div>
<p class="kicker">Born on</p>
<h1>${name}</h1>
<div class="counts">
<div><b>${timeline.length}</b><span>things</span></div>
<div><b>${songs.length}</b><span>number ones</span></div>
<div><b>${count}</b><span>people</span></div>
</div>
${feedSection(picked, rest, timeline.length, name, searched, timeline.length - searched - curatedCount, curatedCount)}
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

