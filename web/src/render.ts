// Rendering a date page. Pure string in, string out, so it can be tested
// without a network and without a browser.

import { DayPage, Person, monthName, neighbours, slug, everyDate } from "./model.js";
import { CHART_NAME, SongOfTheYear } from "./songs.js";

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
export function isReady(page: DayPage): boolean {
  if (page.people.length < READY_PEOPLE) return false;
  return page.people.some((person) => person.monthlyViews > 0);
}

const SITE = "https://birthed.app";
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
ol.songs .title { font-weight: 600; margin: 0; }
ol.songs .by { color: #9C9490; font-size: 15px; margin: 2px 0 0; }
p.credit { color: #6E6862; font-size: 13px; margin: 14px 0 0; }
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
.months { columns: 3; column-gap: 20px; margin: 26px 0 0; padding: 0; list-style: none; }
.months a { color: ${ACCENT}; text-decoration: none; font-size: 15px; line-height: 2; }
@media (max-width: 520px) { .months { columns: 2; } }
`;

function head(
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

const FOOT = `<footer>
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
      ...(person.description ? { description: person.description } : {}),
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

  const rows = songs.map((song) => `<li>
<span class="year">${song.year}</span>
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

export function renderDayPage(page: DayPage, songs: SongOfTheYear[] = []): string {
  const name = `${monthName(page.month)} ${page.day}`;
  const canonical = `${SITE}/${slug(page.month, page.day)}/`;
  const count = page.people.length;
  // Not a count. Ten rows is what we show, not how many people share a date,
  // and claiming otherwise would be a small lie on 366 pages.
  const headline = "The people most looked up on this day.";
  const songLine = songs.length > 0
    ? ` And the number one song on ${name} in every year since ${songs[songs.length - 1]?.year}.`
    : "";
  const description = count > 0
    ? `Who was born on ${name}. ${page.people.slice(0, 3).map((p) => p.name).join(", ")} and ${Math.max(0, count - 3)} more.${songLine}`
    : `Who was born on ${name}.${songLine}`;

  const { previous, next } = neighbours(page.month, page.day);

  const list = page.people.map((person) => `<li>
<span class="year">${escapeHtml(birthYearLabel(person)) || "&nbsp;"}</span>
<span class="who">
<p class="name"><a href="https://www.wikidata.org/wiki/${escapeHtml(person.qid)}" rel="nofollow noopener">${escapeHtml(person.name)}</a></p>
${person.description ? `<p class="what">${escapeHtml(person.description)}</p>` : ""}
${person.deathYear ? `<p class="died">died ${person.deathYear}</p>` : ""}
</span>
</li>`).join("\n");

  const image = `${SITE}/og/${slug(page.month, page.day)}.png`;

  return `${head(`Born on ${name}`, description, canonical, image, !isReady(page))}
<p class="kicker">Born on</p>
<h1>${name}</h1>
<p class="lede">${headline}</p>
${count > 0 ? `<ol>\n${list}\n</ol>` : `<p class="lede">Nobody imported for this date yet.</p>`}
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

export function renderIndex(): string {
  const canonical = `${SITE}/`;
  const months = MONTH_BLOCKS();
  return `${head("Birthed: every day of the year", "Who was born on every day of the year, and what to do with yours.", canonical)}
<p class="kicker">Birthed</p>
<h1>Every day of the year</h1>
<p class="lede">Pick a date and see who shares it.</p>
${months}
${FOOT}`;
}

function MONTH_BLOCKS(): string {
  const byMonth = new Map<number, number[]>();
  for (const date of everyDate()) {
    const list = byMonth.get(date.month) ?? [];
    list.push(date.day);
    byMonth.set(date.month, list);
  }
  return [...byMonth.entries()].map(([month, days]) => `<h2 style="font-family:Georgia,serif;margin:30px 0 0">${monthName(month)}</h2>
<ul class="months">${days.map((day) => `<li><a href="/${slug(month, day)}/">${monthName(month)} ${day}</a></li>`).join("")}</ul>`).join("\n");
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
  const urls = [`${SITE}/`, ...dates.map((d) => `${SITE}/${slug(d.month, d.day)}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `<url><loc>${url}</loc><changefreq>monthly</changefreq></url>`).join("\n")}
</urlset>`;
}

export function renderRobots(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;
}

