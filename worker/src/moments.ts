// The moments a date is actually remembered for.
//
// This replaces the thing that made September 7 boring, and the problem was
// never the ranking. It was the source.
//
// events.ts reads the "September 7" article on Wikipedia, which is a prose list
// maintained by history editors. It is chronological, it is structurally
// dominated by pre-1950 war and politics, and on that date its best rows are a
// crusade, a siege and a treaty. Ranking cannot rescue cold material, and three
// rewrites of the ranker proved it: the ordering got correct and the page
// stayed dull.
//
// The moments people name when you ask them about a date are not lines in that
// article. They are their own things. The murder of George Floyd is a Wikidata
// item with an exact day. The January 6 attack on the Capitol is a Wikidata
// item with an exact day. The assassination of Charlie Kirk is a Wikidata item
// with an exact day. Each one has an article in dozens of languages because the
// world decided it mattered, which is a judgement already made, already
// public, and free to read.
//
// So this asks the question the other way round. Not "what does the date page
// list", but "what happened on this day that the world wrote an article about".
// The test importance.ts applies as a penalty, does this have an article about
// itself, becomes the condition for being here at all.
//
// Free. Wikidata only, no key, nothing metered, one query per date.

import { isEventEntity, type Entity } from "./signals.js";

const ENDPOINT = "https://query.wikidata.org/sparql";

export interface Moment {
  qid: string;
  label: string;
  description: string | null;
  year: number;
  month: number;
  day: number;
  sitelinks: number;
  types: string[];
  articleUrl: string;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function dateLiterals(month: number, day: number, from: number, to: number): string[] {
  const out: string[] = [];
  for (let year = from; year <= to; year++) {
    if (month === 2 && day === 29 && !isLeapYear(year)) continue;
    out.push(`"${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T00:00:00Z"^^xsd:dateTime`);
  }
  return out;
}

export interface MomentQuery {
  yearFrom: number;
  yearTo: number;
  /** Below this many language editions a thing is local news, not a moment. */
  minSitelinks: number;
  userAgent: string;
}

/**
 * One query per date, dates bound with VALUES.
 *
 * Bound rather than filtered with MONTH() and DAY(), for the reason written in
 * culture.ts: a function over every dated item in Wikidata cannot use an index
 * and dies on the sixty second timeout.
 *
 * P585 is "point in time", which is what Wikidata puts on a thing that happened
 * on one day. P580 is "start time", which is what it puts on a thing that began
 * on one day and ran on, and both belong here: the Blitz has a start and the
 * Capitol attack has a point. Precision is read off the statement node rather
 * than the truthy property, because a year-only date is stored as January the
 * first and the truthy value hands it back with nothing to say it is not a real
 * day. That bug already cost this project once, in the people importer.
 */
export function buildQuery(month: number, day: number, options: MomentQuery): string {
  const values = dateLiterals(month, day, options.yearFrom, options.yearTo)
    .map((literal) => `    ${literal}`)
    .join("\n");
  // No // comments inside this string. SPARQL comments start with # and a
  // stray // line is sent as part of the query, which answers 400 on every
  // date. That is written in culture.ts too and it is worth writing twice.
  return `SELECT ?item ?itemLabel ?itemDescription ?date ?sitelinks ?article
       (GROUP_CONCAT(DISTINCT ?typeLabel; separator="|") AS ?types) WHERE {
  VALUES ?date {
${values}
  }
  { ?item p:P585/psv:P585 ?node } UNION { ?item p:P580/psv:P580 ?node }
  ?node wikibase:timeValue ?date .
  ?node wikibase:timePrecision ?precision .
  FILTER(?precision >= 11)
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${options.minSitelinks})
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL { ?item wdt:P31 ?type . ?type rdfs:label ?typeLabel . FILTER(lang(?typeLabel) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
}
GROUP BY ?item ?itemLabel ?itemDescription ?date ?sitelinks ?article`;
}

interface Binding {
  item?: { value: string };
  itemLabel?: { value: string };
  itemDescription?: { value: string };
  date?: { value: string };
  sitelinks?: { value: string };
  article?: { value: string };
  types?: { value: string };
}

interface Answer {
  results?: { bindings?: Binding[] };
}

function qidFrom(uri: string): string {
  const at = uri.lastIndexOf("/");
  return at < 0 ? uri : uri.slice(at + 1);
}

/**
 * Rows into moments, keeping only the ones that are events.
 *
 * The date filter alone returns anything with a day on it: a person's wedding,
 * a building's opening, a treaty, and also a football match and the day a
 * spacecraft changed orbit. isEventEntity is the same test signals.ts uses, and
 * reusing it here is deliberate. There should be exactly one definition in this
 * codebase of what counts as a thing that happened.
 */
export function readAnswer(answer: Answer, month: number, day: number): Moment[] {
  const byQid = new Map<string, Moment>();
  for (const row of answer.results?.bindings ?? []) {
    const uri = row.item?.value;
    const label = row.itemLabel?.value ?? "";
    const dateValue = row.date?.value;
    const article = row.article?.value;
    if (!uri || !dateValue || !article) continue;
    // The label service answers with the identifier when it has no name. A row
    // reading "Q12345 happened" is worse than no row.
    if (label === "" || /^Q\d+$/.test(label)) continue;

    const year = Number(dateValue.slice(0, 4));
    if (!Number.isFinite(year)) continue;

    const types = (row.types?.value ?? "")
      .split("|")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t !== "");
    const entity: Entity = { sitelinks: Number(row.sitelinks?.value ?? 0), types };
    if (!isEventEntity(entity)) continue;

    const qid = qidFrom(uri);
    // A thing with both a point in time and a start time on the same day
    // arrives twice. It is one moment.
    if (byQid.has(qid)) continue;
    byQid.set(qid, {
      qid,
      label,
      description: row.itemDescription?.value ?? null,
      year,
      month,
      day,
      sitelinks: entity.sitelinks,
      types,
      articleUrl: article,
    });
  }
  return [...byQid.values()];
}

export async function fetchMoments(
  month: number,
  day: number,
  options: MomentQuery,
  attempt = 1,
): Promise<Moment[]> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "User-Agent": options.userAgent,
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query: buildQuery(month, day, options) }),
  });
  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 4) throw new Error(`Wikidata answered ${response.status} four times for ${month}/${day}`);
    await new Promise((r) => setTimeout(r, attempt * 2000));
    return fetchMoments(month, day, options, attempt + 1);
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Wikidata answered ${response.status} for ${month}/${day}. ${body.slice(0, 200)}`);
  }
  return readAnswer((await response.json()) as Answer, month, day);
}

// ---------------------------------------------------------------------------
// Living memory.
//
// I argued against weighting recency by hand and said pageviews would carry it.
// That was right for an almanac and wrong for this. The audience is people who
// remember things, and a page for somebody born in 1998 that leads with the
// Great Siege of Malta has failed at its only job, however correctly it ranked.
//
// So the weight is explicit, and being explicit is the point: a number in a
// file can be argued with, and a bias hidden inside a proxy signal cannot.
//
// The curve is flat for thirty years and then falls away. Thirty because that
// is roughly how far back a shared "where were you" reaches: in 2026 that is
// 1996, which keeps 9/11, Katrina, the crash, Floyd, the Capitol and Kirk at
// full weight. Older things are not deleted, they are outranked, and something
// enormous enough still arrives on its own sitelinks. The moon landing is in a
// hundred and sixty languages and does not need help from me.
export const LIVING_MEMORY_YEARS = 30;

export function recencyWeight(year: number, now = new Date().getUTCFullYear()): number {
  const age = now - year;
  if (age <= LIVING_MEMORY_YEARS) return 1;
  // Halves every forty years after that, floored so nothing reaches zero.
  return Math.max(0.25, 1 / (1 + (age - LIVING_MEMORY_YEARS) / 40));
}
