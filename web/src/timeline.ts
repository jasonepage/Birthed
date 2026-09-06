// What happened on a date, from both of the things that know.
//
// Two sources answer the same question and neither knows about the other.
// Gemini researched thirteen things for September 4 and checked the page each
// one cites. Wikipedia's own September 4 article lists fifty four, written by
// people and checked by more of them. Put side by side they are four times
// the material, and seven of the thirteen are the same event twice.
//
// So this file does two jobs: it merges them into one list ordered by year,
// and it refuses to print the founding of Google twice.

import type { Fact } from "./facts.js";

/** One line of Wikipedia's Events section for a date. */
export interface DayEvent {
  month: number;
  day: number;
  year: number;
  description: string;
  sourceUrl: string;
}

/** A row of the merged list. */
export interface TimelineRow {
  /** Null only when a fact does not name a year, which is rare and allowed. */
  year: number | null;
  text: string;
  /** Null for a Wikipedia event, which is credited once at the foot instead. */
  sourceUrl: string | null;
}

/** A key a date can be looked up by, since a Map cannot take a pair. */
function key(month: number, day: number): number {
  return month * 100 + day;
}

export function eventsByDay(events: DayEvent[]): Map<number, DayEvent[]> {
  const byDay = new Map<number, DayEvent[]>();
  for (const event of events) {
    const at = key(event.month, event.day);
    const list = byDay.get(at);
    if (list) list.push(event);
    else byDay.set(at, [event]);
  }
  return byDay;
}

export function eventsForDate(byDay: Map<number, DayEvent[]>, month: number, day: number): DayEvent[] {
  return byDay.get(key(month, day)) ?? [];
}

/**
 * Words too common to tell two sentences apart.
 *
 * Deliberately short. The comparison already ignores anything under four
 * letters, which removes most of the English language's connective tissue,
 * and a long stop list would start removing the words that actually carry a
 * sentence's meaning.
 */
const STOP = new Set([
  "that", "this", "with", "from", "into", "which", "when", "were", "what",
  "their", "there", "then", "than", "they", "them", "have", "been", "being",
  "after", "before", "during", "over", "under", "about", "also", "would",
  "could", "should", "will", "shall", "much", "more", "most", "some", "such",
  "only", "other", "another", "where", "while", "each", "both", "between",
]);

/**
 * The words worth comparing: four letters or more, no punctuation, no stop
 * words. Accents are kept, because "Angeles" with and without one being two
 * different words costs nothing here and folding them is a rabbit hole.
 */
function significant(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOP.has(word));
  return new Set(words);
}

/**
 * Whether two sentences are describing the same event.
 *
 * Overlap against the shorter of the two rather than against the union,
 * because Wikipedia's sentence is often the terse one and the researched fact
 * the wordy one, and a union would punish the pair for that difference alone.
 * "Maiden flight of the first U.S. airship, the USS Shenandoah" shares four of
 * its five carrying words with the longer sentence about the same flight, and
 * a union measure would score that pair at 0.44 rather than 0.80.
 *
 * The threshold is set from twelve real pairs on September 4, where seven are
 * the same event and five are different events that share only a year. The
 * duplicates score between 0.50 and 0.80 and the distinct pairs between 0.00
 * and 0.14, so anything in the middle separates them. It is set nearer the
 * bottom of that gap because the two mistakes are not equally bad: dropping a
 * distinct event loses one row out of fifty, and keeping a duplicate prints
 * the same thing twice on a public page.
 */
export function saysTheSameThing(a: string, b: string): boolean {
  const first = significant(a);
  const second = significant(b);
  const smaller = Math.min(first.size, second.size);
  if (smaller === 0) return false;

  let shared = 0;
  for (const word of first) {
    if (second.has(word)) shared += 1;
  }
  return shared / smaller >= 0.34;
}

/**
 * Takes the date off the front of a researched fact and hands back its year.
 *
 * The facts are written naming the date, on purpose: the same sentence has to
 * read correctly for somebody born on it and for a stranger who searched for
 * it. On a page whose title is already the date, that prefix is printed once
 * per row and the year, which is the thing worth seeing, ends up buried in the
 * middle of a sentence while every other list on the page puts it in the
 * margin.
 *
 * Only ever strips the page's own date. A fact that names a different date, or
 * names none, is returned exactly as written, because rewriting a sentence we
 * cannot parse is how a true fact becomes a false one.
 */
export function splitDatePrefix(
  fact: string,
  monthName: string,
  day: number,
): { year: number | null; text: string } {
  const pattern = new RegExp(`^On ${monthName} ${day}, (\\d{4}), (.+)$`, "s");
  const match = pattern.exec(fact.trim());
  if (match === null) return { year: null, text: fact.trim() };

  const year = Number(match[1]);
  const rest = (match[2] ?? "").trim();
  if (rest.length === 0) return { year: null, text: fact.trim() };

  // "the date never occurred" has to become "The date never occurred". Only
  // the first letter, so "iPhone" and "eBay" survive.
  return { year, text: rest.charAt(0).toUpperCase() + rest.slice(1) };
}

/**
 * One list, ordered by year, with the duplicates gone.
 *
 * The researched fact wins a collision rather than Wikipedia's line. Not
 * because it is better written, but because it is the one whose cited page was
 * opened and checked before the fact was kept, and because it is already on
 * the page today. Dropping it in favour of the newcomer would silently swap
 * out content that has been serving searches.
 *
 * A fact with no year sorts last rather than first. It is the rarest row on
 * the page and the top of a list is the most valuable place on it.
 */
export function buildTimeline(
  facts: Fact[],
  events: DayEvent[],
  monthName: string,
  day: number,
): TimelineRow[] {
  const fromFacts: TimelineRow[] = facts.map((fact) => {
    const { year, text } = splitDatePrefix(fact.fact, monthName, day);
    return { year, text, sourceUrl: fact.sourceUrl };
  });

  // Only facts that landed on a year can collide with an event, since the
  // comparison is only ever made within a year.
  const factsByYear = new Map<number, string[]>();
  for (const row of fromFacts) {
    if (row.year === null) continue;
    const list = factsByYear.get(row.year);
    if (list) list.push(row.text);
    else factsByYear.set(row.year, [row.text]);
  }

  const fromEvents: TimelineRow[] = [];
  for (const event of events) {
    const sameYear = factsByYear.get(event.year) ?? [];
    if (sameYear.some((text) => saysTheSameThing(text, event.description))) continue;
    fromEvents.push({ year: event.year, text: event.description, sourceUrl: null });
  }

  const rows = [...fromFacts, ...fromEvents];
  rows.sort((a, b) => {
    if (a.year === null) return b.year === null ? 0 : 1;
    if (b.year === null) return -1;
    return a.year - b.year;
  });
  return rows;
}

/**
 * Reads every Wikipedia event, a page at a time.
 *
 * Paged for the same reason the facts and the chart weeks are: PostgREST
 * answers at most a thousand rows and says nothing about the ones it left out.
 * There are close to twenty thousand of these, so a single request would
 * quietly return the first few days of January and every page after that
 * would have no events on it, with no error anywhere.
 */
export async function fetchEvents(url: string, key: string): Promise<DayEvent[]> {
  const pageSize = 1000;
  const events: DayEvent[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "event_month,event_day,event_year,description,source_url",
      order: "event_month.asc,event_day.asc,event_year.asc,id.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${url}/rest/v1/historical_events?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`events failed with ${response.status}`);
    }
    const rows = (await response.json()) as {
      event_month: number;
      event_day: number;
      event_year: number;
      description: string;
      source_url: string;
    }[];
    for (const row of rows) {
      events.push({
        month: row.event_month,
        day: row.event_day,
        year: row.event_year,
        description: row.description,
        sourceUrl: row.source_url,
      });
    }
    if (rows.length < pageSize) break;
  }

  return events;
}
