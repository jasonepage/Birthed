// Reading people out of the Wikidata query service.
//
// Two things in here exist because of specific traps, and both are written up
// in CLAUDE.md section 6.
//
// 1. The query does not filter with MONTH() and DAY(). Those are computed over
//    every entity in Wikidata that carries a birth date, cannot use an index,
//    and run against a 60 second timeout. Instead the query binds the exact
//    dates it wants with VALUES, one literal per year, which the index serves
//    directly.
//
// 2. The query reads time precision from the full statement, p:P569/psv:P569,
//    not from the truthy property wdt:P569. Wikidata stores a birth date known
//    only to the year as January 1 of that year, and the truthy property hands
//    that back with no precision attached. Without the precision filter,
//    January 1 fills with people whose birth date nobody recorded. FR-131.
//
// 3. The label service is asked for "en,mul" and not for "en". Wikidata now
//    files a name that is spelled the same in every language under the
//    language code mul rather than repeating it per language, and asking only
//    for English gets the identifier back instead of the name. See the label
//    handling in fetchPeopleBornOn, which is where that cost us Beyonce.

const ENDPOINT = "https://query.wikidata.org/sparql";

export interface WikidataPerson {
  qid: string;
  name: string;
  shortDescription: string | null;
  birthYear: number | null;
  deathYear: number | null;
  sitelinks: number;
  precision: number;
  isLiving: boolean;
  /** The English Wikipedia article, which is what pageviews are counted against. */
  articleUrl: string;
  /** Wikidata knows a TikTok, Instagram or YouTube account for this person. */
  hasSocial: boolean;
}

export interface QueryOptions {
  yearFrom: number;
  yearTo: number;
  minSitelinks: number;
  userAgent: string;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/** Every exact birth date literal for one calendar day across a year range. */
export function dateLiterals(month: number, day: number, from: number, to: number): string[] {
  const literals: string[] = [];
  for (let year = from; year <= to; year++) {
    // February 29 does not exist in a common year, so binding it would be a
    // literal Wikidata can never match. Skip rather than emit a dead value.
    if (month === 2 && day === 29 && !isLeapYear(year)) continue;
    literals.push(`"${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T00:00:00Z"^^xsd:dateTime`);
  }
  return literals;
}

/** Wikidata's items for the two calendars a date can be recorded in. */
export const GREGORIAN = "http://www.wikidata.org/entity/Q1985727";
export const JULIAN = "http://www.wikidata.org/entity/Q1985786";

/**
 * The day the Gregorian calendar began, as year, month and day. Before it,
 * a birthday is the date as written in the Julian calendar, which is how
 * Wikipedia, every reference book and every other birthday site gives it:
 * Leonardo da Vinci on April 15, 1452, Michelangelo on March 6, 1475. From
 * it on, a birthday is the Gregorian date, which is also what those sources
 * give: George Washington on February 22, Tchaikovsky on May 7, both of
 * them recorded in Julian and remembered in Gregorian.
 *
 * The countries that changed late (Britain in 1752, Russia in 1918) are
 * treated as if they changed in 1582. That is the convention, not the
 * history, and it is the one readers check against. The known cost is Isaac
 * Newton, whom most sources give as December 25, 1642 in the old style: this
 * rule files him on January 4, 1643.
 */
const CUTOVER: readonly [number, number, number] = [1582, 10, 15];

function beforeCutover(year: number, month: number, day: number): boolean {
  const [y, m, d] = CUTOVER;
  return year !== y ? year < y : month !== m ? month < m : day < d;
}

function isJulianLeapYear(year: number): boolean {
  return year % 4 === 0;
}

/**
 * The Gregorian date of a Julian one, through the Julian day number.
 *
 * Needed because the query service answers every date in Gregorian whatever
 * calendar it was recorded in, so Leonardo's April 15, 1452 is stored there
 * as April 24. To find him on April 15 the query has to ask for April 24 and
 * say it wants a date recorded in Julian.
 */
export function julianToGregorian(year: number, month: number, day: number): [number, number, number] {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  const b0 = jdn + 32044;
  const b = Math.floor((4 * b0 + 3) / 146097);
  const c = b0 - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const mm = Math.floor((5 * e + 2) / 153);
  return [
    100 * b + d - 4800 + Math.floor(mm / 10),
    mm + 3 - 12 * Math.floor(mm / 10),
    e - Math.floor((153 * mm + 2) / 5) + 1,
  ];
}

/**
 * The rows of the query's VALUES block: the date to match as the query
 * service stores it, the calendar it must have been recorded in, and the
 * year the birthday was actually in.
 *
 * From the cutover on, one row a year with the calendar left open, because
 * a Julian record of a date after 1582 is remembered by its Gregorian date
 * and the query service already stores it that way. Before the cutover, two
 * rows a year: the date recorded in Gregorian as written, and the Julian
 * date converted to how the query service stores it. The written year is
 * carried separately because a late December Julian date can land in the
 * next Gregorian year, and the birth year is the one that was written.
 */
export function dateBindings(month: number, day: number, from: number, to: number): string[] {
  const rows: string[] = [];
  const literal = (y: number, m: number, d: number): string =>
    `"${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}T00:00:00Z"^^xsd:dateTime`;
  for (let year = from; year <= to; year++) {
    if (!beforeCutover(year, month, day)) {
      if (month === 2 && day === 29 && !isLeapYear(year)) continue;
      rows.push(`(${literal(year, month, day)} UNDEF ${year})`);
      continue;
    }
    if (!(month === 2 && day === 29 && !isLeapYear(year))) {
      rows.push(`(${literal(year, month, day)} <${GREGORIAN}> ${year})`);
    }
    if (!(month === 2 && day === 29 && !isJulianLeapYear(year))) {
      const [gy, gm, gd] = julianToGregorian(year, month, day);
      rows.push(`(${literal(gy, gm, gd)} <${JULIAN}> ${year})`);
    }
  }
  return rows;
}

export function buildQuery(month: number, day: number, options: QueryOptions): string {
  const values = dateBindings(month, day, options.yearFrom, options.yearTo)
    .map((row) => `    ${row}`)
    .join("\n");

  // An English Wikipedia article is required, not preferred. Pageviews are
  // counted against it, and somebody with no English article is somebody this
  // audience is not looking up in English.
  //
  // hasSocial is computed with EXISTS rather than three OPTIONAL clauses,
  // because optional multi-valued properties multiply rows and a person with
  // four Instagram accounts should not arrive four times.
  //
  // The label service is asked for "en,mul" and not for "en". mul is
  // Wikidata's code for a name spelled the same way in every language, and a
  // name filed only there is invisible to a request for English: the service
  // answers with the identifier instead, which used to mean the row was
  // thrown away. Nothing in this string may carry a // comment. SPARQL
  // comments start with #, so a // line is sent to the query service as part
  // of the query and every date comes back 400.
  //
  // No ORDER BY. There used to be one on sitelinks, and it made the query
  // service sort four thousand rows on a busy date for nothing:
  // selectCandidates sorts what it needs itself, and nothing between here and
  // there depends on the order they arrive in. The query service is a
  // volunteer-funded shared resource and this backfill is 366 queries.
  return `SELECT ?person ?personLabel ?personDescription ?dob ?writtenYear ?dod ?sitelinks ?precision ?article ?hasSocial WHERE {
  VALUES (?dob ?cal ?writtenYear) {
${values}
  }
  ?person wdt:P569 ?dob .
  ?person wdt:P31 wd:Q5 .
  ?person wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${options.minSitelinks})
  ?article schema:about ?person ; schema:isPartOf <https://en.wikipedia.org/> .
  ?person p:P569/psv:P569 ?dobNode .
  ?dobNode wikibase:timeValue ?dob .
  ?dobNode wikibase:timePrecision ?precision .
  ?dobNode wikibase:timeCalendarModel ?cal .
  FILTER(?precision >= 11)
  OPTIONAL { ?person wdt:P570 ?dod . }
  BIND(EXISTS {
    { ?person wdt:P7085 ?social } UNION
    { ?person wdt:P2003 ?social } UNION
    { ?person wdt:P2397 ?social }
  } AS ?hasSocial)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
}`;
}

/**
 * A readable name out of an English Wikipedia address.
 *
 * Only ever used when the label service had nothing, so it is a floor and not
 * a source. It takes the last part of the address, turns the underscores back
 * into spaces and undoes the percent escaping, which is what separates
 * "Beyonc%C3%A9" from "Beyonce".
 *
 * A disambiguated title keeps its bracket, so this can produce "Drake
 * (musician)". That is worse than the label and much better than the row not
 * existing, and it only appears when Wikidata has no name for somebody in any
 * language we asked for.
 */
export function nameFromArticle(articleUrl: string): string {
  const marker = "/wiki/";
  const at = articleUrl.indexOf(marker);
  if (at < 0) return "";
  const segment = articleUrl.slice(at + marker.length);
  if (segment === "") return "";
  try {
    return decodeURIComponent(segment).replace(/_/g, " ").trim();
  } catch {
    return segment.replace(/_/g, " ").trim();
  }
}

interface SparqlBinding {
  [key: string]: { value: string } | undefined;
}

interface SparqlResponse {
  results: { bindings: SparqlBinding[] };
}

function yearFromLiteral(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(-?\d{1,6})-/.exec(value);
  if (!match || match[1] === undefined) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchPeopleBornOn(
  month: number,
  day: number,
  options: QueryOptions,
  attempt = 1,
): Promise<WikidataPerson[]> {
  const query = buildQuery(month, day, options);

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
      "User-Agent": options.userAgent,
    },
    body: new URLSearchParams({ query }).toString(),
  });

  // 429 is rate limiting, 5xx includes the 504 the query service returns when
  // a date takes too long. Both are worth another go.
  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 4) {
      throw new Error(`Wikidata gave up after ${attempt} attempts (${response.status}).`);
    }
    const retryAfter = Number(response.headers.get("retry-after") ?? "0");
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : attempt * 5000;
    console.warn(`  rate limited, waiting ${waitMs / 1000}s then retrying`);
    await sleep(waitMs);
    return fetchPeopleBornOn(month, day, options, attempt + 1);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Wikidata query failed with ${response.status}. First 400 characters of the response: ${body.slice(0, 400)}`,
    );
  }

  const payload = (await response.json()) as SparqlResponse;
  const currentYear = new Date().getUTCFullYear();
  const people = new Map<string, WikidataPerson>();
  let fellBackToArticleTitle = 0;

  for (const binding of payload.results.bindings) {
    const uri = binding.person?.value;
    if (!uri) continue;
    const qid = uri.slice(uri.lastIndexOf("/") + 1);
    if (people.has(qid)) continue;

    const articleUrl = binding.article?.value;
    if (!articleUrl) continue;

    // The label service answers with the identifier when it has no name in any
    // language it was asked for, and this line used to throw those rows away.
    //
    // That guard was written for people with no English name at all, which is
    // a real thing and a fair thing to drop. What it actually dropped was the
    // most famous person on the date. Wikidata has been moving names that are
    // spelled the same in every language to the language code mul, one item at
    // a time, and a request for English does not fall back to it. Beyonce,
    // Rihanna, Zendaya, Drake, Messi, Bieber, Doja Cat, Olivia Rodrigo, Bad
    // Bunny and Ye were all filed that way and were in none of the 366 pages.
    // Taylor Swift, who still carries both an English label and a mul one, was
    // fine. Nothing in the data looked wrong, because a row that never arrives
    // leaves nothing behind.
    //
    // The language chain above is the fix. This is the floor under it, because
    // the same thing will happen again the next time Wikidata moves a label
    // and we would rather have a slightly wrong name than no person. The
    // English article title is the fallback: the query requires an English
    // article, so it is always there, and it is a real name rather than an
    // identifier.
    const label = binding.personLabel?.value ?? "";
    const name = label === "" || label === qid ? nameFromArticle(articleUrl) : label;
    if (name === "") continue;
    if (name !== label) fellBackToArticleTitle += 1;

    // The year the birthday was written in, which before 1582 is not always
    // the year of the Gregorian date the query matched. See dateBindings.
    const written = Number(binding.writtenYear?.value ?? "NaN");
    const birthYear = Number.isInteger(written) ? written : yearFromLiteral(binding.dob?.value);
    const deathYear = yearFromLiteral(binding.dod?.value);
    const precision = Number(binding.precision?.value ?? "0");
    const sitelinks = Number(binding.sitelinks?.value ?? "0");

    // A death before the birth is a bad value in Wikidata, not a person.
    // Found September 25, 2026: Roger Sessions carries a second birth date
    // of 1986-12-29 beside his real 1896-12-28, died 1985, and the row broke
    // the table's death_year check, which failed the whole upsert and lost
    // December 29 for everybody. Dropping the one row keeps the date.
    if (birthYear !== null && deathYear !== null && deathYear < birthYear) {
      console.warn(`  skipped ${name} (${qid}): died ${deathYear}, before the birth year ${birthYear}`);
      continue;
    }

    // No recorded death is not the same as alive. Wikidata is missing plenty
    // of death dates for people born in the 1800s.
    const isLiving =
      deathYear === null && birthYear !== null && currentYear - birthYear <= 110;

    people.set(qid, {
      qid,
      name,
      shortDescription: binding.personDescription?.value ?? null,
      birthYear,
      deathYear,
      sitelinks: Number.isFinite(sitelinks) ? sitelinks : 0,
      precision: Number.isFinite(precision) ? precision : 0,
      isLiving,
      articleUrl,
      hasSocial: binding.hasSocial?.value === "true",
    });
  }

  if (fellBackToArticleTitle > 0) {
    // Worth saying out loud rather than counting silently. A handful is the
    // ordinary state of Wikidata. A sudden jump means another batch of labels
    // has moved and the language chain above needs another code in it.
    console.warn(
      `  ${fellBackToArticleTitle} of ${people.size} had no name in English or mul, ` +
        `so their English article title was used instead`,
    );
  }

  return [...people.values()];
}
