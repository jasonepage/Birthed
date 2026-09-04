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

export function buildQuery(month: number, day: number, options: QueryOptions): string {
  const values = dateLiterals(month, day, options.yearFrom, options.yearTo)
    .map((literal) => `    ${literal}`)
    .join("\n");

  return `SELECT ?person ?personLabel ?personDescription ?dob ?dod ?sitelinks ?precision WHERE {
  VALUES ?dob {
${values}
  }
  ?person wdt:P569 ?dob .
  ?person wdt:P31 wd:Q5 .
  ?person wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${options.minSitelinks})
  ?person p:P569/psv:P569 ?dobNode .
  ?dobNode wikibase:timeValue ?dob .
  ?dobNode wikibase:timePrecision ?precision .
  FILTER(?precision >= 11)
  OPTIONAL { ?person wdt:P570 ?dod . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)`;
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

  if (response.status === 429 || response.status === 503) {
    if (attempt >= 4) {
      throw new Error(`Wikidata rate limited after ${attempt} attempts (${response.status}).`);
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

  for (const binding of payload.results.bindings) {
    const uri = binding.person?.value;
    if (!uri) continue;
    const qid = uri.slice(uri.lastIndexOf("/") + 1);
    if (people.has(qid)) continue;

    const name = binding.personLabel?.value ?? "";
    // The label service falls back to the identifier when no English label
    // exists. A day page is not improved by a row that reads Q12345.
    if (name === "" || name === qid) continue;

    const birthYear = yearFromLiteral(binding.dob?.value);
    const deathYear = yearFromLiteral(binding.dod?.value);
    const precision = Number(binding.precision?.value ?? "0");
    const sitelinks = Number(binding.sitelinks?.value ?? "0");

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
    });
  }

  return [...people.values()];
}
