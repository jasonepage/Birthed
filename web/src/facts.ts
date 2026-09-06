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

// ---------------------------------------------------------------------------
// The front door's proof strip.
//
// The home page used to describe the product in five cards and show none of
// it, which is the oldest mistake a landing page for a content site can make:
// the thing it is selling was already sitting in the database, free, and the
// page talked about it instead of printing it.
//
// So the build hands the front door a handful of real facts off real date
// pages. They cost nothing, they are the strongest argument the product has,
// and each one is an internal link from the index to a page a crawler should
// see, which the index otherwise only offers as a bare number in a square.
// ---------------------------------------------------------------------------

/** One fact, taken apart so the front door can set the year away from the sentence. */
export interface Highlight {
  month: number;
  day: number;
  year: number;
  /** The sentence with its own "On September 4, 1888," opening taken off. */
  text: string;
  sourceUrl: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * A fact is written in its date's own voice, which on a date page is right and
 * on the front door is a stutter: the badge beside it already says September 4
 * and the sentence would say it again. This takes the opening off and hands
 * back the year separately.
 *
 * It returns null rather than guessing whenever the sentence does not open the
 * way it expects, or opens with a date that is not the row's own date. A fact
 * that cannot be taken apart is simply not one of the ones the front door
 * shows; there are thousands of others.
 */
export function asHighlight(fact: Fact): Highlight | null {
  const match = /^On ([A-Z][a-z]+) (\d{1,2}), (\d{3,4}), (.+)$/.exec(fact.fact.trim());
  if (!match) return null;
  const [, monthWord, dayText, yearText, rest] = match as unknown as string[];
  const month = MONTH_NAMES.indexOf(monthWord!) + 1;
  if (month !== fact.month || Number(dayText) !== fact.day) return null;
  const year = Number(yearText);
  if (!Number.isFinite(year) || year < 1 || year > 2200) return null;
  const text = rest!.charAt(0).toUpperCase() + rest!.slice(1);
  return { month: fact.month, day: fact.day, year, text, sourceUrl: fact.sourceUrl };
}

/**
 * Categories that make a duller row than the others.
 *
 * Not a filter. A month whose only parseable fact is about the weather still
 * gets to be that month's fact; this only decides which one wins when a month
 * has several, which most of them do.
 */
const QUIETER = new Set(["weather", "price", "local", "older_than"]);

/** A small deterministic random source, so one build picks one set and says so. */
function seeded(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

/**
 * The facts the front door shows, at most one per month so the strip is a
 * walk through the year rather than four rows out of the same fortnight.
 *
 * The length window is not fussiness. These sit in a grid of equal cards, and
 * a nine word fact beside a fifty word one leaves a hole in the grid that
 * reads as a bug. Anything outside the window goes on its date page, where the
 * rows are full width and a short one looks like a short one.
 *
 * The seed is the build's own day, so a deploy deals a different hand and two
 * builds of the same commit on the same day are identical, which is what makes
 * a broken page reproducible.
 */
export function pickHighlights(facts: Fact[], count: number, seed: number): Highlight[] {
  const random = seeded(seed);
  const byMonth = new Map<number, Array<{ highlight: Highlight; quiet: boolean }>>();

  for (const fact of facts) {
    const highlight = asHighlight(fact);
    if (!highlight) continue;
    if (highlight.text.length < 55 || highlight.text.length > 165) continue;
    const list = byMonth.get(highlight.month) ?? [];
    list.push({ highlight, quiet: QUIETER.has(fact.category) });
    byMonth.set(highlight.month, list);
  }

  const perMonth: Highlight[] = [];
  for (const [, candidates] of byMonth) {
    const dealt = shuffled(candidates, random);
    // The loud ones first, and a month with nothing but quiet ones still
    // gets a row rather than being dropped out of the year.
    const chosen = dealt.find((candidate) => !candidate.quiet) ?? dealt[0];
    if (chosen) perMonth.push(chosen.highlight);
  }

  return shuffled(perMonth, random)
    .slice(0, count)
    .sort((left, right) => left.month - right.month || left.day - right.day);
}

/** Days since 1970, which is the same number all day and a different one tomorrow. */
export function buildSeed(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 86400000);
}
