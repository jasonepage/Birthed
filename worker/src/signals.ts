// The evidence importance.ts scores.
//
// importance.ts is arithmetic on four numbers and has no idea where they come
// from. This file goes and gets them, and it is the harder half, because the
// rows we already store cannot answer the question.
//
// `events.ts` runs every line through `cellText`, which reduces a link to the
// words inside it. That is right for the sentence, which should read as
// somebody wrote it, and it throws away the one thing a ranker needs: which
// article the line is actually about. "The Luftwaffe begins the Blitz" is a
// string. <a href="/wiki/The_Blitz">the Blitz</a> is a claim you can go and
// measure. So this file re-reads the same HTML and keeps the links.
//
// Nothing here writes to the database. It gathers, and the caller decides.

import { cellText } from "./html.js";

export interface Link {
  /** The article title, as it appears in the URL, with underscores removed. */
  title: string;
  /** The words the reader sees. */
  anchor: string;
  /** Where the link starts in the line, used only to break ties. */
  at: number;
}

/**
 * Titles that are context in every sentence they appear in.
 *
 * A date line about the Blitz links to London, and London's article is read by
 * more people in a day than the Blitz's is in a month. Left in, the ranker
 * would decide that every event mentioning a large country is a large event,
 * which is how you end up ranking "Canada closes its embassy in Tehran" above
 * the invention of television.
 *
 * Only the shapes that are always context: bare years, decades, centuries, and
 * the date pages themselves. Countries are NOT in here, because "Independence
 * of Brazil" would not survive a rule that threw away anything naming a
 * country, and the longest-anchor rule below already handles the ordinary case.
 */
const CONTEXT = /^(\d{1,4}(s)?|\d{1,2}(st|nd|rd|th) century|January|February|March|April|May|June|July|August|September|October|November|December)(\s+\d{1,2})?$/i;

export function isContextTitle(title: string): boolean {
  return CONTEXT.test(title.trim());
}

function listItems(html: string): string[] {
  const items: string[] = [];
  const pattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) items.push(m[1] ?? "");
  return items;
}

/** Every wiki link in a stretch of HTML, in the order it appears. */
export function linksIn(html: string): Link[] {
  const out: Link[] = [];
  const pattern = /<a\b[^>]*\bhref="\/wiki\/([^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const raw = decodeURIComponent(m[1] ?? "");
    // File:, Category:, Help: and friends are never the subject of an event.
    if (raw.includes(":")) continue;
    const title = raw.replace(/_/g, " ").trim();
    const anchor = cellText(m[2] ?? "").trim();
    if (title === "" || anchor === "") continue;
    out.push({ title, anchor, at: m.index });
  }
  return out;
}

/**
 * Which article a line is about.
 *
 * The first version of this ranked September 7 and produced nonsense, in a way
 * worth writing down because the nonsense was consistent. The Battle of Arsuf
 * scored as Richard I of England. The treaty of Baden scored as the Holy Roman
 * Empire. The Boxer Protocol scored as the Boxer Rebellion. The relief of Malta
 * scored as Philip II of Spain. A medieval skirmish came out above the night
 * the Blitz began.
 *
 * The rule had been "longest anchor text", on the reasoning that event articles
 * carry long specific titles. What it actually selected was the most famous
 * proper noun in the sentence, because these lines are written by naming a
 * large well known thing in order to locate a small specific one. So the ranker
 * was measuring the fame of the context rather than the importance of the
 * event, and every line mentioning a king ranked as that king.
 *
 * The correction is to use that same structure in reverse. In a date line, the
 * event is the SPECIFIC thing and the context is the FAMOUS thing, so the most
 * globally famous link is the one to throw away. Fame is measured by sitelinks,
 * which the caller has already fetched for every link on the date.
 *
 * Four rules, in order:
 *
 * ONE, drop a topic prefix before a colon near the front of the line. "World
 * War II: the German Luftwaffe begins the Blitz". The words before the colon
 * are the file an editor put it under.
 *
 * TWO, demote a link after a preposition of place or origin. "dies at the
 * Hobart Zoo", "independence from Portugal". Where and from whom, never what.
 * Without this, the thylacine going extinct is an article about a zoo.
 *
 * THREE, when fame is known and more than one candidate survives, drop the
 * single most famous one. Not all the famous ones: dropping every link above a
 * threshold empties lines whose subject genuinely is well known.
 *
 * FOUR, of what is left, the longest anchor, ties to the later link, because
 * these sentences put the actor before the act.
 *
 * It is still a heuristic. "Bitcoin becomes legal tender in El Salvador" has no
 * article about the event and will pick something imperfect no matter what the
 * rule is. That is why the chosen title is stored on the row rather than used
 * and discarded: a curator can see what the ranker looked at, and a bad pick is
 * visible instead of being an unexplained position in a list.
 */
const PLACE_WORD = /\b(in|at|near|from|to|into|outside|aboard|of)(\s+(the|a|an))?\s*$/i;
const TOPIC_PREFIX = 45;

export function primaryArticle(lineHtml: string, fame?: Map<string, number>): string | null {
  const links = linksIn(lineHtml);
  if (links.length === 0) return null;

  let floor = 0;
  const colon = lineHtml.indexOf(":");
  if (colon > 0 && cellText(lineHtml.slice(0, colon)).length <= TOPIC_PREFIX) floor = colon;

  const kept: Link[] = [];
  const demoted: Link[] = [];
  for (const link of links) {
    if (link.at < floor) continue;
    if (isContextTitle(link.title) || isContextTitle(link.anchor)) continue;
    const before = cellText(lineHtml.slice(floor, link.at));
    (PLACE_WORD.test(before) ? demoted : kept).push(link);
  }

  let pool = kept.length > 0 ? kept : demoted;
  if (pool.length === 0) return null;

  // Rule three. Only when fame is known and there is something left afterwards.
  if (fame !== undefined && pool.length > 1) {
    let most: Link | null = null;
    let mostFame = -1;
    for (const link of pool) {
      const f = fame.get(link.title) ?? 0;
      if (f > mostFame) { mostFame = f; most = link; }
    }
    if (most !== null && mostFame > 0) pool = pool.filter((l) => l !== most);
  }

  let best: Link | null = null;
  for (const link of pool) {
    if (best === null || link.anchor.length >= best.anchor.length) best = link;
  }
  return best === null ? null : best.title;
}

/** Every article linked from the Events section, for the fame lookup. */
export function allEventLinks(html: string): string[] {
  const section = sectionById(html, "Events");
  if (section === null) return [];
  const out = new Set<string>();
  for (const item of listItems(section)) {
    const own = item.split(/<ul\b/i)[0] ?? "";
    for (const link of linksIn(own)) {
      if (!isContextTitle(link.title)) out.add(link.title);
    }
  }
  return [...out];
}

/**
 * A key that matches a parsed line back to the row already in the database.
 *
 * The year plus the first forty characters of the sentence, lowercased and
 * stripped of everything that is not a letter, a number or a single space.
 * Not the whole sentence, because a stored row went through `cellText` on a
 * day when the article read slightly differently, and a trailing clause that
 * has since been edited must not orphan the row. Forty characters is long
 * enough that two events in the same year do not collide and short enough to
 * survive an edit at the end of a line.
 */
export function rowKey(year: number, description: string): string {
  const flat = description
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 40);
  return `${year}|${flat}`;
}

/** The HTML between a heading with the given id and the next heading. */
export function sectionById(html: string, id: string): string | null {
  const start = html.search(new RegExp(`<h2[^>]*\\bid="${id}"[^>]*>`, "i"));
  if (start < 0) return null;
  const rest = html.slice(start);
  const next = rest.slice(1).search(/<h2\b/i);
  return next < 0 ? rest : rest.slice(0, next + 1);
}


/**
 * Which article each event line on a date page is about.
 *
 * Same HTML `parseEvents` reads, same line splitting, links kept this time.
 * Returns a map keyed by `rowKey`, so the caller can look up the rows it
 * already has rather than trying to keep two lists in the same order.
 */
export function articlesByRow(html: string, fame?: Map<string, number>): Map<string, string> {
  const section = sectionById(html, "Events");
  const out = new Map<string, string>();
  if (section === null) return out;

  for (const item of listItems(section)) {
    const own = item.split(/<ul\b/i)[0] ?? "";
    const text = cellText(own).replace(/\s+/g, " ").trim();
    const m = /^(\d{1,4})\s*[\u2013\u2014-]\s*(.+)$/.exec(text);
    if (m === null) continue;
    const year = Number(m[1]);
    if (!Number.isInteger(year)) continue;
    const description = (m[2] ?? "").replace(/(\s*\[\d+\])+\s*$/, "").trim();
    const article = primaryArticle(own, fame);
    if (article === null) continue;
    out.set(rowKey(year, description), article);
  }
  return out;
}

/**
 * What a date is officially observed for, straight off the date article.
 *
 * Every Wikipedia date page carries a "Holidays and observances" section, and
 * it is the cheapest strong signal on the calendar: a country holding a public
 * holiday every year is the literal definition of a day being remembered for
 * something. September 7 has two, for opposite reasons, and neither is
 * discoverable from the events list alone.
 *
 * Returned as lines rather than a boolean, because tying an observance to the
 * event that caused it cannot be done reliably by machine. "Independence Day
 * (Brazil)" and "Independence of Brazil" share a word. "National Threatened
 * Species Day" and "the last thylacine dies at the Hobart Zoo" share none, and
 * they are the same fact. So the observance is surfaced, a link is proposed,
 * and a curator confirms it with one keypress in the panel that already exists.
 * That is the same bargain as every other row on this site: the machine finds
 * it, a person agrees to it, and nothing reaches a page in between.
 */
export interface Observance {
  text: string;
  article: string | null;
}

export function observancesFrom(html: string): Observance[] {
  const section =
    sectionById(html, "Holidays_and_observances") ?? sectionById(html, "Holidays");
  if (section === null) return [];
  const out: Observance[] = [];
  for (const item of listItems(section)) {
    const own = item.split(/<ul\b/i)[0] ?? "";
    const text = cellText(own).replace(/\s+/g, " ").trim();
    if (text.length < 4) continue;
    out.push({ text, article: primaryArticle(own) });
  }
  return out;
}

/**
 * How strongly an observance looks like it commemorates an event.
 *
 * Shared significant words, over the shorter of the two, which is the same
 * measure `timeline.ts` uses to spot two sentences describing one thing. It is
 * used only to order what a curator is shown, never to decide anything: a
 * score of zero is common and correct for a true pair.
 */
export function observanceMatch(observance: string, event: string): number {
  const words = (s: string) =>
    new Set(
      s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
        .filter((w) => w.length >= 5),
    );
  const a = words(observance);
  const b = words(event);
  const smaller = Math.min(a.size, b.size);
  if (smaller === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / smaller;
}

/**
 * The events Wikipedia's own editors picked for this date.
 *
 * Wikipedia:Selected anniversaries/September 7 is the list their main page
 * draws from, maintained by hand, and free. Worth a point in the score and no
 * more, because it balances subject matter rather than ranking importance: on
 * September 7 it carries the founding of an Italian football club and leaves
 * out the first television picture.
 */
export function anniversaryArticles(html: string): Set<string> {
  const out = new Set<string>();
  for (const item of listItems(html)) {
    const own = item.split(/<ul\b/i)[0] ?? "";
    if (!/\b\d{3,4}\b/.test(cellText(own))) continue;
    for (const link of linksIn(own)) {
      if (!isContextTitle(link.title)) out.add(link.title);
    }
  }
  return out;
}

export function anniversaryUrl(monthName: string, day: number): string {
  return `https://en.wikipedia.org/wiki/Wikipedia:Selected_anniversaries/${monthName}_${day}`;
}

// ---------------------------------------------------------------------------
// Sitelinks, the signal that stops this being an American calendar.
//
// One query for every article on a date, by title, asking Wikidata how many
// language editions carry it. Batched by identifier the way the culture
// importer batches its earliest-publication lookup, and for the same reason:
// asking the service to aggregate over everything it holds is the version that
// times out.

const WIKIDATA = "https://query.wikidata.org/sparql";

export function buildSitelinkQuery(titles: string[]): string {
  const values = titles
    .map((t) => `"${t.replace(/["\\]/g, "\\$&")}"@en`)
    .join(" ");
  return `SELECT ?title ?sitelinks WHERE {
  VALUES ?title { ${values} }
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
  ?item wikibase:sitelinks ?sitelinks .
}`;
}

interface SitelinkAnswer {
  results?: { bindings?: { title?: { value: string }; sitelinks?: { value: string } }[] };
}

export function readSitelinks(answer: SitelinkAnswer): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of answer.results?.bindings ?? []) {
    const title = row.title?.value;
    const raw = row.sitelinks?.value;
    if (title === undefined || raw === undefined) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) out.set(title, n);
  }
  return out;
}

/**
 * Sitelink counts for a batch of article titles.
 *
 * Fails open with an empty map, the same choice `fetchEarliestPublications`
 * makes: a date that scores on views alone is a worse ranking, and a run that
 * drops 366 dates because a volunteer funded service was busy is a worse day.
 */
export async function fetchSitelinks(
  titles: string[],
  userAgent: string,
): Promise<Map<string, number>> {
  if (titles.length === 0) return new Map();
  const response = await fetch(WIKIDATA, {
    method: "POST",
    headers: {
      "User-Agent": userAgent,
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query: buildSitelinkQuery(titles) }),
  });
  if (!response.ok) return new Map();
  return readSitelinks((await response.json()) as SitelinkAnswer);
}
