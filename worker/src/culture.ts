// Dated works, out of Wikidata, for the curated cultural table.
//
// This is the answer to the thing that made docs/internet-culture.md slow: the
// rows were being written by hand, one at a time, and then every date had to
// be checked by hand against the page it cited. Twenty nine rows took an
// afternoon and six of them were wrong anyway. Wikidata already holds the
// release date of every notable game, film, album and piece of software, as a
// structured value with a stated precision, so for four of the five categories
// the writing and the checking are both somebody else's finished work.
//
// What this cannot do is memes, which have no structured source and no
// agreed date. Those stay hand written and thin, which is what that document
// already says they should be.
//
// The query is shaped exactly like the one in wikidata.ts and for the same
// reasons, which are written up there and in CLAUDE.md section 6: dates are
// bound with VALUES rather than filtered with MONTH() and DAY(), because the
// computed version cannot use an index and dies on the 60 second timeout; and
// precision is read off the full statement rather than the truthy property,
// because Wikidata stores a year-only date as January 1 of that year and the
// truthy property hands that back with nothing to say it is not a real day.

const ENDPOINT = "https://query.wikidata.org/sparql";

/** The five the database enumerated type allows. `meme` is never imported. */
export type CultureCategory = "tech" | "gaming";

/**
 * The Wikidata classes worth importing, and which category each becomes.
 *
 * Matched with a plain `wdt:P31` and not with `wdt:P31/wdt:P279*`. The
 * subclass walk is what makes this query expensive, and the query service is
 * volunteer funded and about to be asked 366 questions. The cost of the plain
 * version is recall: a work typed only as "animated feature film" rather than
 * as "film" is not found. That is a miss, which this project treats as cheaper
 * than a wrong row, and it can be closed later by naming more classes here
 * rather than by making every query walk a hierarchy.
 */
export const CLASSES: { qid: string; category: CultureCategory; noun: string }[] = [
  { qid: "Q7889", category: "gaming", noun: "video game" },
  { qid: "Q8076", category: "gaming", noun: "console" },
  { qid: "Q7397", category: "tech", noun: "software" },
  { qid: "Q1668024", category: "tech", noun: "product line" },
];

// Films and music were here and are not any more.
//
// The first run of this importer against September 7 returned twelve rows and
// eleven of them were films, dated to festival premieres. Memento came back on
// the day it screened at Venice, eight months before anybody in America could
// buy a ticket. Cars came back on a foreign release, three months after it
// opened at home.
//
// P577 is the earliest publication anywhere, and for a film that is almost
// always a festival, which is not a date any reader shares a world with. That
// is the rule WorldThen already settled, in the other direction: dates in this
// product are the reader's release, not the first one on earth, because the
// sentence is about their world rather than about the object.
//
// Games survive the same test, which is why they stayed. Wikidata carries
// regional releases for them often enough that the one good row in that first
// run was Final Fantasy VII on 7 September 1997, which is its North American
// date and is exactly the kind of row this table is for.
//
// Films and music can come back the day the query can ask for the United
// States release specifically, through a place of publication qualifier. That
// is a real query and it drops most rows, so it is its own piece of work and
// not a line to add here.
const NOT_IMPORTED = ["Q11424 film", "Q482994 album", "Q134556 single"];
void NOT_IMPORTED;

export interface DatedWork {
  qid: string;
  label: string;
  description: string | null;
  year: number;
  month: number;
  day: number;
  sitelinks: number;
  category: CultureCategory;
  /** The English Wikipedia article, which pageviews are counted against. */
  articleUrl: string;
}

export interface CultureQueryOptions {
  yearFrom: number;
  yearTo: number;
  minSitelinks: number;
  userAgent: string;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Every exact publication date literal for one calendar day across a range. */
export function dateLiterals(month: number, day: number, from: number, to: number): string[] {
  const literals: string[] = [];
  for (let year = from; year <= to; year++) {
    if (month === 2 && day === 29 && !isLeapYear(year)) continue;
    literals.push(`"${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T00:00:00Z"^^xsd:dateTime`);
  }
  return literals;
}

export function buildQuery(month: number, day: number, options: CultureQueryOptions): string {
  const values = dateLiterals(month, day, options.yearFrom, options.yearTo)
    .map((literal) => `    ${literal}`)
    .join("\n");
  const types = CLASSES.map((entry) => `wd:${entry.qid}`).join(" ");

  // No ORDER BY, for the reason wikidata.ts gives: the caller sorts what it
  // needs and the service should not sort thousands of rows for nothing.
  //
  // The label service is asked for "en,mul" and not "en", because a name
  // spelled the same in every language is filed under mul and a request for
  // English alone gets the identifier back instead of the name.
  //
  // Nothing in this string may carry a // comment. SPARQL comments start with
  // #, so a // line is sent as part of the query and every date comes back 400.
  return `SELECT ?work ?workLabel ?workDescription ?date ?sitelinks ?precision ?type ?article WHERE {
  VALUES ?date {
${values}
  }
  VALUES ?type { ${types} }
  ?work wdt:P577 ?date .
  ?work wdt:P31 ?type .
  ?work wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${options.minSitelinks})
  ?article schema:about ?work ; schema:isPartOf <https://en.wikipedia.org/> .
  ?work p:P577/psv:P577 ?dateNode .
  ?dateNode wikibase:timeValue ?date .
  ?dateNode wikibase:timePrecision ?precision .
  FILTER(?precision >= 11)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
}`;
}

interface SparqlBinding {
  work?: { value: string };
  workLabel?: { value: string };
  workDescription?: { value: string };
  date?: { value: string };
  sitelinks?: { value: string };
  type?: { value: string };
  article?: { value: string };
}

interface SparqlAnswer {
  results?: { bindings?: SparqlBinding[] };
}

function qidFrom(uri: string): string {
  const at = uri.lastIndexOf("/");
  return at < 0 ? uri : uri.slice(at + 1);
}

const BY_QID = new Map(CLASSES.map((entry) => [entry.qid, entry]));

/**
 * One row per work per date.
 *
 * A work with two publication dates on the same calendar day in different
 * years is two rows, which is correct: they are two anniversaries. A work
 * bound to the same date twice, which happens when Wikidata holds the value
 * under more than one statement, is one row, because the key is the work and
 * the date together.
 */
export function readAnswer(answer: SparqlAnswer, month: number, day: number): DatedWork[] {
  const byKey = new Map<string, DatedWork>();

  for (const row of answer.results?.bindings ?? []) {
    const workUri = row.work?.value;
    const dateValue = row.date?.value;
    const typeUri = row.type?.value;
    const article = row.article?.value;
    if (!workUri || !dateValue || !typeUri || !article) continue;

    const entry = BY_QID.get(qidFrom(typeUri));
    if (entry === undefined) continue;

    const year = Number(dateValue.slice(0, 4));
    if (!Number.isFinite(year)) continue;

    const qid = qidFrom(workUri);
    const label = row.workLabel?.value ?? "";
    // The label service answers with the identifier when it has no name in
    // any language asked for. A row titled "Q12345 is released" is worse than
    // no row, so it is dropped rather than printed.
    if (label === "" || /^Q\d+$/.test(label)) continue;

    const key = `${qid}|${year}`;
    if (byKey.has(key)) continue;

    byKey.set(key, {
      qid,
      label,
      description: row.workDescription?.value ?? null,
      year,
      month,
      day,
      sitelinks: Number(row.sitelinks?.value ?? 0),
      category: entry.category,
      articleUrl: article,
    });
  }

  return [...byKey.values()];
}

/** The sentence a row prints. Names the thing, says what happened, stops. */
export function titleFor(work: DatedWork): string {
  return `${work.label} is released`;
}

export async function fetchWorksPublishedOn(
  month: number,
  day: number,
  options: CultureQueryOptions,
  attempt = 1,
): Promise<DatedWork[]> {
  const query = buildQuery(month, day, options);
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "User-Agent": options.userAgent,
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query }),
  });

  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 4) {
      throw new Error(`Wikidata answered ${response.status} four times for ${month}/${day}`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    return fetchWorksPublishedOn(month, day, options, attempt + 1);
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Wikidata answered ${response.status} for ${month}/${day}. ${body.slice(0, 300)}`);
  }

  return readAnswer((await response.json()) as SparqlAnswer, month, day);
}

// ---------------------------------------------------------------------------
// Re-releases, and why the first September run put Super Mario Bros. on four
// different dates.
//
// The query above matches a work when ANY of its P577 values falls on the
// target day, and Wikidata stores every re-release, port and regional launch
// as another P577. Super Mario Bros. therefore answers on 13 September 1985,
// which is real, and on 1 September 2011, 12 September 2013 and 19 September
// 2018, which are Virtual Console and Switch Online re-releases. The pageview
// score attaches to the work rather than to the statement, so all four inherit
// the original's traffic and all four float to the top of their date.
//
// That is the worst kind of wrong for this site. A reader born on 1 September
// 2011 would be told the game came out on their birthday. It did not.
//
// The obvious fix, keeping only the earliest date, is wrong in the other
// direction: it deletes Final Fantasy VII from 7 September 1997, which is the
// North American release and the best row this importer has ever produced.
// FF7 shipped in Japan that January.
//
// So the test is the GAP, not the order. FF7 is seven months after its first
// release, which is a regional rollout. Super Mario Bros. on Wii U is twenty
// eight years after, which is a re-release. Eighteen months is wide enough for
// the Japan to America to Europe staircase that games of that era actually
// walked, and far too narrow for a nostalgia reissue.
//
// It is not exact. A port eleven months behind still gets through. It removes
// the decades-late cases, which are all of the ones that made the page lie.
export const REISSUE_MONTHS = 18;

/** Whole months from a work's first known publication to this one. */
export function monthsAfterFirst(firstIso: string, work: DatedWork): number {
  const first = new Date(firstIso);
  if (Number.isNaN(first.getTime())) return 0;
  const firstMonths = first.getUTCFullYear() * 12 + first.getUTCMonth();
  return work.year * 12 + (work.month - 1) - firstMonths;
}

/**
 * Whether this date is a reissue of something already released long before.
 *
 * A work the earliest lookup knows nothing about is kept. A missing answer
 * means that query failed, and failing open leaves the old behaviour rather
 * than silently emptying every date.
 */
export function isReissue(work: DatedWork, earliest: Map<string, string>): boolean {
  const first = earliest.get(work.qid);
  if (first === undefined) return false;
  return monthsAfterFirst(first, work) > REISSUE_MONTHS;
}

/**
 * Whether this row is dated to something that has not happened yet.
 *
 * The year range runs to the current year, so an announced release later this
 * year comes back as a fact. Announced dates slip constantly, and a page
 * saying a game "is released" two days from now is wrong today and wrong
 * differently next month.
 */
export function isUnreleased(work: DatedWork, now: Date = new Date()): boolean {
  const when = Date.UTC(work.year, work.month - 1, work.day);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return when > today;
}

export function buildEarliestQuery(qids: string[]): string {
  const values = qids.map((qid) => `wd:${qid}`).join(" ");
  // Every precision, deliberately. A work whose first release Wikidata only
  // knows to the year is stored as January the first of that year, which is
  // close enough to measure a gap against and much better than treating the
  // first exact date as the original.
  return `SELECT ?work (MIN(?d) AS ?first) WHERE {
  VALUES ?work { ${values} }
  ?work wdt:P577 ?d .
}
GROUP BY ?work`;
}

interface EarliestAnswer {
  results?: { bindings?: { work?: { value: string }; first?: { value: string } }[] };
}

export function readEarliest(answer: EarliestAnswer): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of answer.results?.bindings ?? []) {
    const work = row.work?.value;
    const first = row.first?.value;
    if (!work || !first) continue;
    out.set(qidFrom(work), first);
  }
  return out;
}

/**
 * The first publication date of each work, in one extra query.
 *
 * Cheap on purpose. The date indexed query above has already cut the world
 * down to a few dozen works, so this asks about those by identifier rather
 * than asking the service to aggregate over every game it holds, which is the
 * version that times out.
 */
export async function fetchEarliestPublications(
  qids: string[],
  userAgent: string,
): Promise<Map<string, string>> {
  if (qids.length === 0) return new Map();
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "User-Agent": userAgent,
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query: buildEarliestQuery(qids) }),
  });
  // Failing open, for the reason isReissue gives: an empty map keeps every
  // row, which is the behaviour that existed before this check did.
  if (!response.ok) return new Map();
  return readEarliest((await response.json()) as EarliestAnswer);
}
