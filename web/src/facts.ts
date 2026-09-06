// The things found about a calendar date, for the page about that date.
//
// These are the rows the app reads on the Mine tab, under `birth_year` 0,
// which is the key for "this calendar date, in no particular year". They are
// written in the date's own voice for exactly this reason: the same sentence
// has to be true for somebody born on the date and for a stranger who typed
// it into a search box.
//
// This is the one section of a date page that is not a list of names and not
// a chart. Famous Birthdays has the names. Nobody has "on this date in 1912
// the Piedra Movediza fell over" with the page it came from underneath.

export interface Fact {
  month: number;
  day: number;
  fact: string;
  /** event, release, older_than, sport, science, price, weather, local, record. */
  category: string;
  sourceUrl: string;
}

/** A key a date can be looked up by, since a Map cannot take a pair. */
function key(month: number, day: number): number {
  return month * 100 + day;
}

export function factsByDay(facts: Fact[]): Map<number, Fact[]> {
  const byDay = new Map<number, Fact[]>();
  for (const fact of facts) {
    const at = key(fact.month, fact.day);
    const list = byDay.get(at);
    if (list) list.push(fact);
    else byDay.set(at, [fact]);
  }
  return byDay;
}

export function factsForDate(byDay: Map<number, Fact[]>, month: number, day: number): Fact[] {
  return byDay.get(key(month, day)) ?? [];
}

/**
 * Reads every verified calendar date fact, a page at a time.
 *
 * Paged for the same reason the chart weeks are: PostgREST answers at most a
 * thousand rows and says nothing about the ones it left out, so a single
 * request would quietly return January through to some day in April and every
 * page after that would have no facts on it, with no error anywhere.
 *
 * `verified` is not a filter that could be dropped. The read policy on the
 * table already refuses everything else, and unverified rows are the ones
 * whose cited page did not answer.
 */
export async function fetchFacts(url: string, key: string): Promise<Fact[]> {
  const pageSize = 1000;
  const facts: Fact[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "birth_month,birth_day,fact,category,source_url",
      birth_year: "eq.0",
      region_key: "eq.",
      verified: "eq.true",
      order: "birth_month.asc,birth_day.asc,id.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${url}/rest/v1/birth_facts?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`facts failed with ${response.status}`);
    }
    const rows = (await response.json()) as {
      birth_month: number;
      birth_day: number;
      fact: string;
      category: string;
      source_url: string;
    }[];
    for (const row of rows) {
      facts.push({
        month: row.birth_month,
        day: row.birth_day,
        fact: row.fact,
        category: row.category,
        sourceUrl: row.source_url,
      });
    }
    if (rows.length < pageSize) break;
  }

  return facts;
}

/** "en.wikipedia.org". What the reader sees before deciding to follow it. */
export function hostOf(sourceUrl: string): string {
  try {
    const host = new URL(sourceUrl).hostname;
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return "source";
  }
}
