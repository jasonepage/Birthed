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
import { type CulturalEvent, textOf } from "./culture.js";

export interface DayEvent {
  /** The row's own identifier, so a reader can point at this exact line. */
  id: string;
  month: number;
  day: number;
  year: number;
  description: string;
  sourceUrl: string;
}

/** A row of the merged list. */
export interface TimelineRow {
  /**
   * Which table this came out of, and its identifier there.
   *
   * Carried so a reader can answer for one line. The merged list mixes three
   * sources, so a position in the list is not an identity: the same row is at a
   * different index the day a new fact lands, and every answer anybody had
   * given would silently move to a different sentence.
   */
  kind: "historical_event" | "birth_fact" | "cultural_event";
  id: string;
  /** Null only when a fact does not name a year, which is rare and allowed. */
  year: number | null;
  text: string;
  /** Null for a Wikipedia event, which is credited once at the foot instead. */
  sourceUrl: string | null;
  /**
   * A short sentence a person wrote for the ask card, or undefined.
   *
   * Never replaces `text`. The feed prints the row's own sentence and the card
   * prints both, the person's line as the question and the record under it.
   * See src/lead.ts.
   */
  leadLine?: string;
  /**
   * Wikipedia's editors picked the thing that happened in this year on this
   * date as one of the day's biggest. A ranking signal and nothing else: it
   * decides what leads, it is never printed, and it makes no claim about this
   * row beyond its year. See src/selected.ts.
   */
  selected?: boolean;
  /**
   * Whether a person wrote this row and checked it, rather than a model
   * finding it or Wikipedia holding it. Carried on the row because the credit
   * at the foot of the section names who found what, and a curated row that
   * counted as a researched one would tell readers a person's sentence was
   * found by a model.
   */
  curated?: boolean;
  /**
   * What kind of thing this is: event, release, sport, science, record and so
   * on. Only a researched fact has one, because only the researcher was asked
   * for it. It was being dropped here, and it is the only thing either source
   * knows about a line beyond its words and its year.
   */
  category: string | null;
  /**
   * Which kind of day this is, for a curated or imported cultural row:
   * posted, happened, went_viral or ended. Null for everything else, because
   * only that researcher was asked the question.
   *
   * This is the honesty the rest of the row cannot express. A year on its own
   * claims the same confidence whether the timestamp came off the post itself
   * or off a magazine writing about a thing that had already been going round
   * for a fortnight. Those are different claims and the page should say so.
   */
  dateKind?: string | null;
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
  // Trailing and defaulted, so the four argument calls that existed before
  // curated rows did keep working and keep meaning the same thing.
  culture: CulturalEvent[] = [],
): TimelineRow[] {
  // Curated rows go in first and win every collision, which is the only
  // ordering decision in here that matters.
  //
  // Google being founded is in Wikipedia's September 4 article, and it is also
  // the kind of thing somebody wrote a curated row for. Both would otherwise
  // print, one after the other, saying the same thing in two voices. The
  // curated one wins because somebody chose it, wrote it and checked its
  // source, and the Wikipedia line is the one that reads like an encyclopedia,
  // which is the whole complaint this table exists to answer.
  const fromCulture: TimelineRow[] = culture.map((event) => ({
    kind: "cultural_event" as const,
    id: event.id,
    year: event.year,
    text: textOf(event),
    sourceUrl: event.sourceUrl,
    category: event.category,
    // Only a row somebody actually wrote counts as curated. An imported one
    // has a source and a category and no author, and saying otherwise in the
    // credit would be a claim about a person that is not true.
    curated: event.origin !== "imported",
    dateKind: event.dateKind,
  }));

  const claimedByYear = new Map<number, string[]>();
  const claim = (year: number | null, text: string): void => {
    if (year === null) return;
    const list = claimedByYear.get(year);
    if (list) list.push(text);
    else claimedByYear.set(year, [text]);
  };
  const alreadySaid = (year: number, text: string): boolean =>
    (claimedByYear.get(year) ?? []).some((said) => saysTheSameThing(said, text));

  // Both the sentence and the title, and the title is the one that does the
  // work. A curated row prints its context, which is written on purpose not to
  // sound like an encyclopedia, so it almost never resembles the Wikipedia line
  // about the same event. The title does: "Google is founded" against "Google
  // is founded." Claiming only the printed text left the duplicate in, which is
  // what the first render of a curated page showed.
  for (let i = 0; i < fromCulture.length; i++) {
    const row = fromCulture[i];
    const source = culture[i];
    if (row === undefined || source === undefined) continue;
    claim(row.year, row.text);
    if (source.title !== row.text) claim(row.year, source.title);
  }

  const fromFacts: TimelineRow[] = [];
  for (const fact of facts) {
    const { year, text } = splitDatePrefix(fact.fact, monthName, day);
    if (year !== null && alreadySaid(year, text)) continue;
    fromFacts.push({ kind: "birth_fact", id: fact.id, year, text, sourceUrl: fact.sourceUrl, category: fact.category });
    claim(year, text);
  }

  const fromEvents: TimelineRow[] = [];
  for (const event of events) {
    if (alreadySaid(event.year, event.description)) continue;
    fromEvents.push({ kind: "historical_event", id: event.id, year: event.year, text: event.description, sourceUrl: null, category: null });
    claim(event.year, event.description);
  }

  const rows = [...fromCulture, ...fromFacts, ...fromEvents];
  // Newest first, which is a change made on 8 September 2026 and is worth the
  // paragraph.
  //
  // This ran oldest first until then, and the drawer on September 8 opened on
  // Philip of Swabia being crowned King of Germany in 1198. A timeline read
  // forwards is the more natural thing to build and it is the wrong way round
  // for who is reading. Forty seven rows on that date, fourteen of them from
  // 1958 on: oldest first spends the top of the feed on the eight hundred
  // years nobody alive remembers, and buries every row anybody could answer
  // with more than "never heard of it" under a coronation, a circumnavigation
  // and the founding of St Augustine.
  //
  // It is still a timeline. It is read from now backwards, which is also how
  // anybody scrolling actually reads one. A sealed date is unaffected, because
  // byMemory replaces this order entirely with what its own people remembered.
  //
  // A fact with no year still sorts last rather than first, for the reason
  // given above: it is the rarest row here and it says the least.
  rows.sort((a, b) => {
    if (a.year === null) return b.year === null ? 0 : 1;
    if (b.year === null) return -1;
    return b.year - a.year;
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
      select: "id,event_month,event_day,event_year,description,source_url",
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
      id: number;
      event_month: number;
      event_day: number;
      event_year: number;
      description: string;
      source_url: string;
    }[];
    for (const row of rows) {
      events.push({
        id: String(row.id),
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


/**
 * The handful worth stopping on, out of all of them.
 *
 * Two rules, and both are deliberately dull, because a clever rule that cannot
 * be explained is one nobody can check on 366 pages.
 *
 * First, the researched facts win. Not because they are better written, but
 * because each one was kept only when the page it cites was opened and
 * answered, and because the researcher was choosing what mattered about the
 * date while Wikipedia's list is everything anybody ever added. If a date has
 * fewer of them than we need, the whole merged list is used instead, so a date
 * nobody researched still gets a feed rather than an empty section.
 *
 * Second, they are spread evenly across the years rather than taken off the
 * top. Taking the first six gives six things from antiquity on one date and
 * six from the last century on another. Even spacing always keeps the oldest
 * and the newest, which are the two a reader is most likely to want, and puts
 * four between them.
 *
 * In the list's own order on the way out, because the section says "newest first" and
 * that is still true of what is shown.
 */
export function pickHighlights(rows: TimelineRow[], count = 6): TimelineRow[] {
  // The top of the day, when anything says what that is.
  //
  // These six are the cards above the drawer, and until 8 September 2026 they
  // were six rows spread evenly across the date's span, which is a way of
  // showing the range and not a way of showing what mattered. Wikipedia's
  // editors have picked the day's biggest events for years and that signal was
  // sitting unused, so it goes here: a selected row leads, in the order the
  // list is already in, and the old spread fills whatever is left.
  //
  // The drawer underneath stays newest first. Two shelves: the big things at
  // the top, and everything else read from now backwards. See src/selected.ts.
  //
  // A written lead line counts as big too, since September 10, 2026. Somebody
  // sat down and wrote a sentence about that row, which is the same signal as
  // an editor picking it, and the worker files both at the same priority
  // when it puts the date's history on the hive. The page agrees with it.
  const big = rows.filter((row) => row.selected === true || (row.leadLine ?? "").trim() !== "");
  if (big.length >= count) return big.slice(0, count);

  const researched = rows.filter((row) => row.sourceUrl !== null);
  const pool = researched.length >= count ? researched : rows;
  // Short dates take the early exit and still need the selection in front of
  // them, which is the kind of thing that works on a date with fifty rows and
  // quietly does nothing on a date with four.
  if (pool.length <= count) return bigFirst(big, pool, count);

  const chosen: TimelineRow[] = [];
  const last = pool.length - 1;
  // The newest thing on the date leads, whoever found it. Preferring the
  // researched facts is right for the body of the feed and wrong for the top
  // of it: the best sentence on the page must not be filed behind a source
  // rule, so whatever is first in the full list beats whatever the pool had.
  //
  // This was the oldest until 8 September 2026, on the reasoning that the end
  // of the Western Roman Empire is a better lead than a calendar reform. True,
  // and it was answering the wrong question. The lead card is the biggest
  // thing in the feed and spending it on the most distant row is the same
  // mistake as opening the drawer in 1198. See the sort in buildTimeline.
  const eldest = rows[0];
  for (let i = 0; i < count; i++) {
    const at = Math.round((i * last) / (count - 1));
    const row = pool[at];
    // Rounding can land twice on the same row when the pool is barely bigger
    // than the count, and the same sentence printed twice is the one outcome
    // worth writing a line to prevent.
    if (row !== undefined && !chosen.includes(row)) chosen.push(row);
  }
  if (eldest !== undefined && !chosen.includes(eldest)) {
    chosen.splice(0, 1, eldest);
  }
  return bigFirst(big, chosen, count);
}

/**
 * The day's biggest in front, then whatever else was chosen, capped.
 *
 * One place, because the two ways out of pickHighlights both need it and only
 * one of them had it, which is a bug that looks like nothing on a busy date.
 */
function bigFirst(big: TimelineRow[], rest: TimelineRow[], count: number): TimelineRow[] {
  if (big.length === 0) return rest.slice(0, count);
  return [...big, ...rest.filter((row) => !big.includes(row))].slice(0, count);
}

/** The rows that are not in the picked handful, in the order they arrived. */
export function theRest(rows: TimelineRow[], picked: TimelineRow[]): TimelineRow[] {
  return rows.filter((row) => !picked.includes(row));
}


/**
 * What one row's answers came to, for ordering a sealed date.
 *
 * The same arithmetic the app uses, and it has to stay the same arithmetic:
 * two clients that ranked a sealed page differently would be showing two
 * different canvases for one date, and the whole claim is that the date has
 * one.
 */
export interface MemoryCount {
  there: number;
  remembers: number;
  heard: number;
  never: number;
}

/**
 * How much of a row survived, as one number.
 *
 * Nothing subtracts. "Never heard of it" is worth zero and never less than
 * zero, because a negative is a downvote arriving through the back door and
 * there is no direction anywhere in this design. Remembering is worth twice
 * hearing of, because they are different claims: one is transmission, which is
 * the thing this project exists to measure, and the other is documentation
 * reaching somebody, which Wikipedia already counts.
 */
export function memoryWeight(count: MemoryCount): number {
  return (count.there + count.remembers) * 2 + count.heard;
}

/**
 * A sealed date, put back in the order its own people remembered it in.
 *
 * Only ever called for a date that has sealed. While one is open the order is
 * chronological, because an order that moved with the answers would show every
 * reader the popular answer before they gave their own, and that is the one
 * thing that would destroy the measurement. Once it seals nobody can answer
 * again, so the order cannot influence anything and is free to say what
 * happened.
 *
 * It is a ranking and never a vote. No answer subtracts, no row can be pushed
 * down by anybody, nothing is removed, and every row keeps the source it
 * arrived with.
 *
 * Ties fall through to how many people answered, which separates a row thirty
 * people had never heard of from a row nobody was asked about, and then to the
 * incoming position, so a sealed page draws identically every time it is
 * built. Without that last step "sealed" would be a word rather than a fact.
 */
export function byMemory(
  rows: TimelineRow[],
  counts: Map<string, MemoryCount>,
): TimelineRow[] {
  const of = (row: TimelineRow): MemoryCount =>
    counts.get(`${row.kind}:${row.id}`) ?? { there: 0, remembers: 0, heard: 0, never: 0 };

  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const wa = memoryWeight(of(a.row));
      const wb = memoryWeight(of(b.row));
      if (wa !== wb) return wb - wa;
      const ta = of(a.row);
      const tb = of(b.row);
      const answersA = ta.there + ta.remembers + ta.heard + ta.never;
      const answersB = tb.there + tb.remembers + tb.heard + tb.never;
      if (answersA !== answersB) return answersB - answersA;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}


/**
 * Every sealed date's answers, for the build.
 *
 * Two requests plus one per sealed date, and there are almost none of them:
 * a date only seals after its three days are up, so in the first year this
 * reads at most a handful and usually zero. An empty answer is the normal
 * state and not a failure.
 *
 * Only the current year's editions. An older one is a different question, and
 * the page it belongs to is a comparison this site does not draw yet.
 */
export async function fetchSealedMemory(
  url: string,
  key: string,
): Promise<Map<string, Map<string, MemoryCount>>> {
  const out = new Map<string, Map<string, MemoryCount>>();
  const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };
  const thisYear = new Date().getUTCFullYear();

  let sealed: Array<{ event_month: number; event_day: number }> = [];
  try {
    // Not "sealed_at is not null". Nothing ever stamps that column: a date is
    // sealed when its window has passed, which is a fact about the clock, and
    // sealed_at is only ever set when somebody shuts a date early by hand. A
    // query on the column alone found nothing and always would have.
    const query = new URLSearchParams({
      select: "event_month,event_day,edition_year,closes_at,sealed_at",
      edition_year: `eq.${thisYear}`,
    });
    const response = await fetch(`${url}/rest/v1/day_editions?${query}`, { headers });
    if (!response.ok) return out;
    const editions = (await response.json()) as Array<{
      event_month: number; event_day: number; closes_at: string; sealed_at: string | null;
    }>;
    const now = Date.now();
    sealed = editions.filter((e) =>
      e.sealed_at !== null || Date.parse(e.closes_at) <= now);
  } catch {
    return out;
  }

  for (const edition of sealed) {
    try {
      const response = await fetch(`${url}/rest/v1/rpc/remembrance_tally`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ month_in: edition.event_month, day_in: edition.event_day }),
      });
      if (!response.ok) continue;
      const rows = (await response.json()) as Array<{
        subject_kind: string; subject_id: string; edition_year: number;
        there: number; remembers: number; heard: number; never: number;
      }>;
      const forDate = new Map<string, MemoryCount>();
      for (const row of rows) {
        if (row.edition_year !== thisYear) continue;
        forDate.set(`${row.subject_kind}:${row.subject_id}`, {
          there: row.there, remembers: row.remembers, heard: row.heard, never: row.never,
        });
      }
      if (forDate.size > 0) {
        out.set(`${edition.event_month}-${edition.event_day}`, forDate);
      }
    } catch {
      continue;
    }
  }
  return out;
}
