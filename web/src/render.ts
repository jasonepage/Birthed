// Rendering a date page. Pure string in, string out, so it can be tested
// without a network and without a browser.

import { DayPage, Person, monthName, neighbours, slug, everyDate } from "./model.js";
import { CHART_NAME, SongOfTheYear } from "./songs.js";
import { Fact, hostOf } from "./facts.js";
import { buildTimeline, type DayEvent, type TimelineRow } from "./timeline.js";

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
.died { color: #6E6862; font-size: 13px; margin: 3px 0 0; }
h2.section {
  font-family: Georgia, "Times New Roman", serif; font-weight: 800;
  font-size: clamp(24px, 5vw, 32px); line-height: 1.15; margin: 46px 0 6px;
}
ol.songs li { display: flex; gap: 13px; align-items: baseline; padding: 11px 15px; }
/* Landing on /september-5/#1990 must not put the row flush against the top
   edge of the window with the heading scrolled away above it. */
ol.songs li { scroll-margin-top: 22px; }
ol.songs .year a { color: inherit; text-decoration: none; }
ol.songs .year a:hover { text-decoration: underline; }
ol.songs li:target { background: #211A2E; box-shadow: inset 0 0 0 1px ${ACCENT}; }
ol.songs .title { font-weight: 600; margin: 0; }
ol.songs .by { color: #9C9490; font-size: 15px; margin: 2px 0 0; }
p.credit { color: #6E6862; font-size: 13px; margin: 14px 0 0; }
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
ul.facts .src a { color: #7C7570; text-decoration: none; }
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
footer { margin: 40px 0 0; color: #7C7570; font-size: 13px; }
footer a { color: #9C9490; }
/* The year as twelve calendars. Seven columns, so a row is a week and the page
   reads the way a wall calendar does instead of as a column of 366 lines. */
.months { display: grid; grid-template-columns: repeat(3, 1fr); gap: 26px 18px; margin: 24px 0 0; padding: 0; }
.cal { min-width: 0; }
.cal h3 {
  font-family: Georgia, "Times New Roman", serif; font-weight: 800;
  font-size: 19px; margin: 0 0 8px;
}
.cal .dow, .cal .days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.cal .dow { margin: 0 0 5px; padding: 0 0 6px; border-bottom: 1px solid #2A2434; }
.cal .dow span {
  font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-align: center;
  color: #6E6862; text-transform: uppercase;
}
.cal .days a, .cal .days .pad {
  display: flex; align-items: center; justify-content: center;
  aspect-ratio: 1 / 1; border-radius: 8px;
  font-size: 13px; font-variant-numeric: tabular-nums;
}
.cal .days a { background: #17141F; color: #D9D2CC; text-decoration: none; }
.cal .days a:hover, .cal .days a:focus { background: ${ACCENT}; color: #FFF7EE; }
/* February 29 in a year that does not have one. It still has a page. */
.cal .days a.leap { background: none; color: #7C7570; box-shadow: inset 0 0 0 1px #2A2434; }
.cal .days a.leap:hover, .cal .days a.leap:focus { background: ${ACCENT}; color: #FFF7EE; box-shadow: none; }
p.calnote { color: #6E6862; font-size: 13px; margin: 22px 0 0; }
@media (max-width: 680px) { .months { grid-template-columns: repeat(2, 1fr); gap: 22px 14px; } }
@media (max-width: 430px) { .months { grid-template-columns: 1fr; gap: 26px; } .cal .days a { font-size: 15px; } }
footer .sitelinks { color: #B9B2AD; font-size: 14px; }
footer .sitelinks a { color: ${ACCENT}; text-decoration: none; }
.hero { display: flex; gap: 22px; align-items: flex-start; margin: 10px 0 0; }
.hero img { width: 92px; height: 92px; border-radius: 22px; flex: none; }
.hero h1 { font-size: clamp(34px, 8vw, 58px); }
.btn {
  display: inline-block; margin: 6px 0 0; padding: 12px 20px; border-radius: 999px;
  background: #FFF7EE; color: #A8265A; font-weight: 700; text-decoration: none; font-size: 15px;
}
.bornin { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 18px 0 0; }
.bornin span { color: #7C7570; font-size: 13px; margin-right: 4px; }
.bornin a {
  display: inline-block; padding: 6px 11px; border-radius: 999px; font-size: 13px; font-weight: 600;
  color: #D9D2CC; text-decoration: none; box-shadow: inset 0 0 0 1px #3A3342;
}
.bornin a:hover, .bornin a:focus { background: ${ACCENT}; color: #FFF7EE; box-shadow: none; }
.cal { scroll-margin-top: 24px; }
html { scroll-behavior: smooth; }
.soon { display: inline-block; margin: 6px 0 0; padding: 12px 20px; border-radius: 999px; border: 1px solid #3A3342; color: #B9B2AD; font-size: 15px; }
.features { display: grid; gap: 10px; margin: 34px 0 0; padding: 0; list-style: none; }
.features li { display: block; }
.features h3 { margin: 0 0 4px; font-size: 17px; }
.features p { margin: 0; color: #B9B2AD; font-size: 15px; }
h2.plain { font-family: Georgia, "Times New Roman", serif; font-weight: 800; font-size: clamp(22px, 5vw, 28px); margin: 40px 0 8px; }
.prose p, .prose li { color: #D9D2CC; }
.prose ul { padding-left: 20px; }
.prose h3 { margin: 26px 0 4px; font-size: 17px; }
.prose .updated { color: #7C7570; font-size: 13px; }
@media (max-width: 520px) { .hero { flex-direction: column; gap: 14px; } }

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
.hint { display: block; margin: 9px 0 0; font-size: 13px; color: #7C7570; }
.input, .select > select {
  appearance: none; -webkit-appearance: none; -moz-appearance: none;
  display: block; width: 100%; margin: 0;
  font-family: inherit; font-size: 16px; line-height: 1.4; color: #FFF7EE;
  background: rgba(255, 247, 238, 0.055);
  border: 1px solid #3A3342; border-radius: 14px; padding: 15px 16px;
  transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
}
.input::placeholder { color: #6E6862; }
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
`;

export function head(
  title: string,
  description: string,
  canonical: string,
  image?: string,
  noindex = false,
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
<style>${STYLE}</style>
</head>
<body><div class="wrap">`;
}

export const FOOT = `<footer>
<p class="sitelinks"><a href="/">Every date</a> · <a href="/support/">Support</a> · <a href="/privacy/">Privacy</a></p>
<p>Names, years and descriptions come from <a href="https://www.wikidata.org">Wikidata</a>, released under <a href="https://creativecommons.org/publicdomain/zero/1.0/">Creative Commons Zero</a>. Credit to Wikipedia and Wikidata.</p>
<p>Birthed is not affiliated with Wikipedia, Wikidata or the Wikimedia Foundation.</p>
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

  // Every year is its own address. "number one song on September 5 1990" is a
  // real thing people type, the answer is already in this list, and an anchor
  // makes that row linkable and quotable without generating a page for every
  // day and year, which would be about 24,500 pages holding four lines each.
  // The year itself is the link, so it can be copied out of the address bar.
  const rows = songs.map((song) => `<li id="${song.year}">
<span class="year"><a href="#${song.year}">${song.year}</a></span>
<span class="who">
<p class="title">${escapeHtml(song.song)}</p>
<p class="by">${escapeHtml(song.artist)}</p>
</span>
</li>`).join("\n");

  const oldest = songs[songs.length - 1]?.year ?? "";
  const newest = songs[0]?.year ?? "";

  return `<h2 class="section">The number one song on ${escapeHtml(name)}</h2>
<p class="lede">Every year from ${oldest} to ${newest}, from the chart week that ${escapeHtml(name)} fell in.</p>
<ol class="songs">
${rows}
</ol>
<p class="credit">Chart positions are from the ${escapeHtml(CHART_NAME)}, compiled by Wikipedia and released under Creative Commons Attribution ShareAlike. Birthed is not affiliated with Billboard or Wikipedia.</p>`;
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
 * The merged list: what was researched about the date and what Wikipedia's own
 * article for it says, in one column ordered by year.
 *
 * Two credits rather than one, and each only when that source is actually on
 * the page. The researched facts carry a link per row because their sources
 * are all different and the link is the point. The Wikipedia lines carry one
 * credit at the foot instead, the way the chart weeks already do, because
 * fifty four rows saying "en.wikipedia.org" underneath each other is noise
 * that tells the reader nothing the credit does not.
 */
function timelineSection(rows: TimelineRow[], name: string, searched: number, fromWikipedia: number): string {
  if (rows.length === 0) return "";

  const items = rows.map((row) => `<li>
<span class="year">${row.year === null ? "&nbsp;" : row.year}</span>
<span class="said">
<p class="what">${escapeHtml(row.text)}</p>
${row.sourceUrl ? `<p class="src"><a href="${escapeHtml(row.sourceUrl)}" rel="nofollow noopener">${escapeHtml(hostOf(row.sourceUrl))}</a></p>` : ""}
</span>
</li>`).join("\n");

  const credits = [
    searched > 0
      ? `<p class="credit">The ${searched} with a source link under them were found by Google's Gemini searching the web, and kept only when the page each one cites answered. Birthed is not affiliated with Google.</p>`
      : "",
    fromWikipedia > 0
      ? `<p class="credit">The other ${fromWikipedia} are from the ${escapeHtml(name)} article on Wikipedia, quoted as written and released under Creative Commons Attribution ShareAlike. Birthed is not affiliated with Wikipedia or the Wikimedia Foundation.</p>`
      : "",
  ].filter((line) => line !== "").join("\n");

  return `<h2 class="section">What happened on ${escapeHtml(name)}</h2>
<p class="lede">${rows.length} things, oldest first.</p>
<ul class="facts">
${items}
</ul>
${credits}`;
}

export function renderDayPage(
  page: DayPage,
  songs: SongOfTheYear[] = [],
  facts: Fact[] = [],
  events: DayEvent[] = [],
): string {
  const name = `${monthName(page.month)} ${page.day}`;
  const canonical = `${SITE}/${slug(page.month, page.day)}/`;
  const count = page.people.length;
  // Not a count. Ten rows is what we show, not how many people share a date,
  // and claiming otherwise would be a small lie on 366 pages.
  const headline = "The people most looked up on this day.";
  const songLine = songs.length > 0
    ? ` And the number one song on ${name} in every year since ${songs[songs.length - 1]?.year}.`
    : "";
  // The description is what a search result shows, so the facts go in front
  // of the names when there are any: the names are what every other site in
  // this category already says.
  // Built here rather than inside the section, because the description a
  // search result shows has to count the same rows the page ends up with.
  const timeline = buildTimeline(facts, events, monthName(page.month), page.day);
  const searched = timeline.filter((row) => row.sourceUrl !== null).length;
  const factLine = timeline.length > 0
    ? ` What happened on ${name}, in ${timeline.length} sourced things.`
    : "";
  const description = count > 0
    ? `Who was born on ${name}. ${page.people.slice(0, 3).map((p) => p.name).join(", ")} and ${Math.max(0, count - 3)} more.${factLine}${songLine}`
    : `Who was born on ${name}.${factLine}${songLine}`;

  const { previous, next } = neighbours(page.month, page.day);

  const list = page.people.map((person) => `<li>
<span class="year">${escapeHtml(birthYearLabel(person)) || "&nbsp;"}</span>
<span class="who">
<p class="name"><a href="https://www.wikidata.org/wiki/${escapeHtml(person.qid)}" rel="nofollow noopener">${escapeHtml(person.name)}</a></p>
${person.description && tidyDescription(person.description) ? `<p class="what">${escapeHtml(tidyDescription(person.description))}</p>` : ""}
${person.deathYear ? `<p class="died">died ${person.deathYear}</p>` : ""}
</span>
</li>`).join("\n");

  const image = `${SITE}/og/${slug(page.month, page.day)}.png`;

  return `${head(`Born on ${name}`, description, canonical, image, !isReady(page, facts))}
<p class="kicker">Born on</p>
<h1>${name}</h1>
<p class="lede">${headline}</p>
${count > 0 ? `<ol>\n${list}\n</ol>` : `<p class="lede">Nobody imported for this date yet.</p>`}
${timelineSection(timeline, name, searched, timeline.length - searched)}
${songSection(songs, name)}
<nav class="pager">
<a href="/${slug(previous.month, previous.day)}/">&larr; ${monthName(previous.month)} ${previous.day}</a>
<a href="/${slug(next.month, next.day)}/">${monthName(next.month)} ${next.day} &rarr;</a>
</nav>
<section class="cta">
<h2>Is ${name} yours?</h2>
<p>Birthed is an app about the day you were born. Who shares it, what happened on it, and what to do with it.</p>
</section>
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

