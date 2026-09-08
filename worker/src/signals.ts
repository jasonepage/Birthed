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
 * THREE, throw away every link that Wikidata says is a person or a place. This
 * is the rule that finally worked. Dropping the single most famous link was not
 * enough, because Saladin is more famous than Richard I and the Holy Roman
 * Empire is more famous than the Kingdom of France, so removing one context
 * link only promoted the next one.
 *
 * FOUR, of the survivors, the one carried by the fewest language editions,
 * because in a date line the event is the specific thing and everything else in
 * the sentence is there to locate it. A battle is in forty languages and the
 * king who won it is in a hundred and twelve.
 *
 * When rule three leaves nothing, the line has no article about what happened,
 * and it says so rather than pretending. That is not a failure to report: if
 * Wikipedia never wrote the article, the event is almost certainly not what the
 * date is remembered for.
 *
 * It is still a heuristic. "Bitcoin becomes legal tender in El Salvador" has no
 * article about the event and will pick something imperfect no matter what the
 * rule is. That is why the chosen title is stored on the row rather than used
 * and discarded: a curator can see what the ranker looked at, and a bad pick is
 * visible instead of being an unexplained position in a list.
 */
// "of" was in this list and had to come out. It is a genitive far more often
// than a preposition of place: "the signing of the Boxer Protocol", "the
// founding of Interpol", "the death of X". Every one of those points AT the
// subject, and with "of" here the Boxer Protocol was demoted out of its own
// line and the parent Boxer Rebellion won it. Geography is caught by the type
// check below instead, which is where it belonged all along.
const PLACE_WORD = /\b(in|at|near|from|into|outside|aboard)(\s+(the|a|an))?\s*$/i;
const TOPIC_PREFIX = 45;

export interface Pick {
  article: string | null;
  /**
   * Whether the chosen article is about the event rather than about somebody
   * or somewhere named in it. False means Wikipedia has not written an article
   * about what happened, which is itself a strong statement about the day.
   */
  ownArticle: boolean;
}

export function pickArticle(lineHtml: string, entities?: Map<string, Entity>): Pick {
  const links = linksIn(lineHtml);
  if (links.length === 0) return { article: null, ownArticle: false };

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
  const all = kept.length > 0 ? kept : demoted;
  if (all.length === 0) return { article: null, ownArticle: false };

  // Without Wikidata there is nothing to reason with, so fall back to the old
  // guess and do not claim the pick is an event article.
  if (entities === undefined) {
    let best: Link | null = null;
    for (const link of all) if (best === null || link.anchor.length >= best.anchor.length) best = link;
    return { article: best?.title ?? null, ownArticle: false };
  }

  const subjects = all.filter((l) => !isContextEntity(entities.get(l.title)));
  const pool = subjects.length > 0 ? subjects : all;

  // The most specific survivor, measured by how few language editions carry it.
  // A battle is in forty and the king who won it is in a hundred and twelve.
  let best: Link | null = null;
  let bestFame = Number.POSITIVE_INFINITY;
  for (const link of pool) {
    const fame = entities.get(link.title)?.sitelinks ?? Number.MAX_SAFE_INTEGER;
    if (fame < bestFame || (fame === bestFame && best !== null && link.anchor.length > best.anchor.length)) {
      best = link;
      bestFame = fame;
    }
  }
  return { article: best?.title ?? null, ownArticle: isEventEntity(entities.get(best?.title ?? "")) };
}

/** Just the title, for callers that do not care how it was found. */
export function primaryArticle(lineHtml: string, entities?: Map<string, Entity>): string | null {
  return pickArticle(lineHtml, entities).article;
}

/** Every article linked from the Events section, for the entity lookup. */
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
export function articlesByRow(html: string, entities?: Map<string, Entity>): Map<string, Pick> {
  const section = sectionById(html, "Events");
  const out = new Map<string, Pick>();
  if (section === null) return out;

  for (const item of listItems(section)) {
    const own = item.split(/<ul\b/i)[0] ?? "";
    const text = cellText(own).replace(/\s+/g, " ").trim();
    const m = /^(\d{1,4})\s*[\u2013\u2014-]\s*(.+)$/.exec(text);
    if (m === null) continue;
    const year = Number(m[1]);
    if (!Number.isInteger(year)) continue;
    const description = (m[2] ?? "").replace(/(\s*\[\d+\])+\s*$/, "").trim();
    const pick = pickArticle(own, entities);
    if (pick.article === null) continue;
    out.set(rowKey(year, description), pick);
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

/**
 * A real observance, as opposed to the rest of that section.
 *
 * September 7 returned sixteen entries and eleven were saints: Clodoald,
 * Gratus of Aosta, Marko Krizin. Wikipedia files the Christian feast days under
 * the same heading as the national days, as a nested list under one "Christian
 * feast day:" line, and every name in it arrives looking like an observance.
 *
 * The shape that survives is a named day with a place attached, which is what
 * every civic observance on the calendar looks like: Independence Day (Brazil),
 * Constitution Day (Fiji), National Threatened Species Day (Australia). A saint
 * is a bare name. This drops a handful of genuine religious observances that
 * happen to be written without a country, and that is the right trade when the
 * alternative is eleven saints diluting the strongest signal on the page.
 */
export function isObservance(text: string): boolean {
  return /\bday\b/i.test(text) && /\(/.test(text);
}

export function observancesFrom(html: string): Observance[] {
  const section =
    sectionById(html, "Holidays_and_observances") ?? sectionById(html, "Holidays");
  if (section === null) return [];
  const out: Observance[] = [];
  for (const item of listItems(section)) {
    const own = item.split(/<ul\b/i)[0] ?? "";
    const text = cellText(own).replace(/\s+/g, " ").trim();
    if (text.length < 4 || !isObservance(text)) continue;
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
// What each link IS, which turned out to matter more than how famous it is.
//
// The second live run still put Richard I of England at the top of September 7
// and scored the treaty of Baden as the Kingdom of France. Dropping the single
// most famous link had not been enough, because Saladin is more famous than
// Richard and the Holy Roman Empire is more famous than France, so throwing
// away one context link only promoted the next one.
//
// The distinction the rule was reaching for is not fame at all. Richard I is a
// PERSON. The Kingdom of France is a COUNTRY. The Battle of Arsuf is a BATTLE.
// A date line names people and places to locate an event, and Wikidata already
// records which of those a thing is, in P31.
//
// So a link whose type is a human or a piece of geography is context by
// definition, and an event line that has nothing else in it does not have an
// article about what happened. That last part is the strongest signal on this
// page and it fell out of the fix by accident: if Wikipedia has not written an
// article about the thing that happened, it is almost certainly not what the
// day is remembered for. "Giuseppe Garibaldi enters Naples" is a person and a
// city and nothing else, and it should not be in anybody's top five.

const WIKIDATA = "https://query.wikidata.org/sparql";

export interface Entity {
  sitelinks: number;
  /** English labels of every P31 value, lowercased. */
  types: string[];
}

/**
 * Types that are context in a date line, matched on the label rather than on a
 * list of identifiers.
 *
 * Labels because the identifier list is endless and unstable: a historical
 * country, a former kingdom, a commune of France and a census designated place
 * are four different items that all mean "this is a place". The words they
 * share are short and they do not change.
 */
const CONTEXT_TYPE = /\b(human|country|sovereign state|city|town|village|municipality|commune|island|river|brook|stream|creek|lake|bay|harbou?r|mountain|valley|province|county|region|state|kingdom|empire|dynasty|republic|capital|settlement|territory|continent|nation|neighbou?rhood|district)\b/;

export function isContextEntity(entity: Entity | undefined): boolean {
  if (entity === undefined) return false;
  return entity.types.some((t) => CONTEXT_TYPE.test(t));
}

/**
 * Types that mean the article is about something that HAPPENED.
 *
 * The person and place filter above is a negative test and it let three things
 * through on September 7 that are not events at all: the Mona Lisa is a
 * painting, Bitcoin is a currency, and Submarine is a class of vehicle. All
 * three scored as if the day were remembered for them, on the fame of an object
 * mentioned in the sentence.
 *
 * So the test for whether a line has an article of its own is positive. Not
 * "this is not a person" but "this is a battle, a treaty, a crash, an
 * election". If Wikipedia has written an article about the happening rather
 * than about a thing involved in it, the day probably is remembered for it, and
 * if it has not, the row is scoring on borrowed weight and says so.
 */
const EVENT_TYPE = /\b(event|battle|war|siege|conflict|campaign|military operation|invasion|revolution|rebellion|uprising|revolt|coup|massacre|genocide|attack|bombing|assassination|murder|disaster|accident|crash|collision|sinking|earthquake|eruption|flood|storm|hurricane|cyclone|famine|epidemic|pandemic|treaty|protocol|agreement|accord|convention|declaration|law|act|election|referendum|ceremony|festival|occurrence|incident|expedition|voyage|flight|mission|launch|discovery|trial|riot|strike|scandal|crisis|summit|conference|independence|coronation|match|tournament|race|premiere|release)\b/;

export function isEventEntity(entity: Entity | undefined): boolean {
  if (entity === undefined) return false;
  return entity.types.some((t) => EVENT_TYPE.test(t));
}

export function buildEntityQuery(titles: string[]): string {
  const values = titles.map((t) => `"${t.replace(/["\\]/g, "\\$&")}"@en`).join(" ");
  return `SELECT ?title ?sitelinks (GROUP_CONCAT(DISTINCT ?typeLabel; separator="|") AS ?types) WHERE {
  VALUES ?title { ${values} }
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
  ?item wikibase:sitelinks ?sitelinks .
  OPTIONAL { ?item wdt:P31 ?type . ?type rdfs:label ?typeLabel . FILTER(lang(?typeLabel) = "en") }
}
GROUP BY ?title ?sitelinks`;
}

interface EntityAnswer {
  results?: {
    bindings?: {
      title?: { value: string };
      sitelinks?: { value: string };
      types?: { value: string };
    }[];
  };
}

export function readEntities(answer: EntityAnswer): Map<string, Entity> {
  const out = new Map<string, Entity>();
  for (const row of answer.results?.bindings ?? []) {
    const title = row.title?.value;
    const raw = row.sitelinks?.value;
    if (title === undefined || raw === undefined) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    const types = (row.types?.value ?? "")
      .split("|")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t !== "");
    out.set(title, { sitelinks: n, types });
  }
  return out;
}

/**
 * Sitelinks and types for a batch of article titles.
 *
 * Fails open with an empty map, the same choice fetchEarliestPublications
 * makes: a date ranked on views alone is a worse ranking, and a run that drops
 * 366 dates because a volunteer funded service was busy is a worse day.
 */
export async function fetchEntities(
  titles: string[],
  userAgent: string,
): Promise<Map<string, Entity>> {
  if (titles.length === 0) return new Map();
  const response = await fetch(WIKIDATA, {
    method: "POST",
    headers: {
      "User-Agent": userAgent,
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query: buildEntityQuery(titles) }),
  });
  if (!response.ok) return new Map();
  return readEntities((await response.json()) as EntityAnswer);
}
