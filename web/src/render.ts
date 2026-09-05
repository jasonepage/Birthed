// Rendering a date page. Pure string in, string out, so it can be tested
// without a network and without a browser.

import { DayPage, Person, monthName, neighbours, slug, everyDate } from "./model.js";

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

function head(title: string, description: string, canonical: string, image?: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
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

export function renderDayPage(page: DayPage): string {
  const name = `${monthName(page.month)} ${page.day}`;
  const canonical = `${SITE}/${slug(page.month, page.day)}/`;
  const count = page.people.length;
  // Not a count. Ten rows is what we show, not how many people share a date,
  // and claiming otherwise would be a small lie on 366 pages.
  const headline = "The people most looked up on this day.";
  const description = count > 0
    ? `Who was born on ${name}. ${page.people.slice(0, 3).map((p) => p.name).join(", ")} and ${Math.max(0, count - 3)} more.`
    : `Who was born on ${name}.`;

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

  return `${head(`Born on ${name}`, description, canonical, image)}
<p class="kicker">Born on</p>
<h1>${name}</h1>
<p class="lede">${headline}</p>
${count > 0 ? `<ol>\n${list}\n</ol>` : `<p class="lede">Nobody imported for this date yet.</p>`}
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

export function renderSitemap(): string {
  const urls = [`${SITE}/`, ...everyDate().map((d) => `${SITE}/${slug(d.month, d.day)}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `<url><loc>${url}</loc><changefreq>monthly</changefreq></url>`).join("\n")}
</urlset>`;
}

export function renderRobots(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;
}

