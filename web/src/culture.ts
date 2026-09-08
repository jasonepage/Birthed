// Curated internet and cultural history, keyed to one exact date.
//
// The rules for what belongs in here are in docs/internet-culture.md and are
// not repeated. What this file is responsible for is reading the table and
// handing the rows to the timeline in the shape it already understands.
//
// Why this is a separate table and a separate module from historical_events:
// those are Wikipedia's own date article lines, keyed to a month and a day,
// imported wholesale and unchecked. A cultural row is keyed to one exact date
// including the year, it is curated, and every one of them has been past a
// content check before it landed. Putting the two in one table would have a
// checked row and an unchecked row side by side with nothing to tell them
// apart, which is the argument the migration already makes.

/** One curated row. `year` is split out because the timeline groups by it. */
export interface CulturalEvent {
  /**
   * The row's own identifier, carried so a reader can point at this exact row.
   *
   * Not the year and the title slugified, which is what a first pass would
   * reach for: a curator editing a typo would silently orphan every answer
   * anybody had given it.
   */
  id: string;
  month: number;
  day: number;
  year: number;
  /** "Minecraft 1.14 is released". Short, and the thing being named. */
  title: string;
  /** The sentence worth reading, when there is one. */
  context: string | null;
  sourceUrl: string;
  /** tech, gaming, meme, music or cinema. Drives the coloured chip. */
  category: string;
  /**
   * Which kind of day this is: posted, happened, went_viral or ended.
   *
   * Stored on every row since the column existed and never once fetched, so
   * the page has been quietly rounding "this is the week it spread, nobody
   * knows when it was posted" down to a bare year. docs/internet-culture.md
   * rule two calls this the interesting part and says not to hide it, and
   * hiding it is exactly what an unselected column does.
   *
   * Optional, and null, for a row written before the column existed.
   */
  dateKind?: string | null;
  /**
   * "curated" when a person wrote and checked the row, "imported" when it came
   * out of a structured source. The credit at the foot of the section names
   * who found what, and ten hand written rows cannot share a sentence with
   * several thousand imported ones.
   */
  origin: string;
}

/**
 * What a row prints.
 *
 * The context when there is one, because that is the sentence somebody wrote
 * on purpose, and the title alone reads like a changelog. The title when there
 * is not, because a row with no sentence is still a dated fact and absent
 * beats invented.
 */
export function textOf(event: CulturalEvent): string {
  const context = event.context?.trim();
  return context !== undefined && context.length > 0 ? context : event.title;
}

/**
 * Every curated row, a page at a time.
 *
 * Paged for the same reason the facts, the events and the chart weeks are:
 * PostgREST answers at most a thousand rows and says nothing at all about the
 * ones it left out, so a single request would quietly return an early slice
 * and every date after it would look empty with no error anywhere.
 */
/**
 * Every published row.
 *
 * The status filter is belt and braces. The read policy already refuses a
 * candidate row to an anonymous caller, which is what the build is, so this
 * query would not see one anyway. It is here because a policy is a thing
 * somebody edits in a different file six months from now, and a generated row
 * appearing on a live page is the one failure this whole design exists to
 * prevent.
 */
export async function fetchCulturalEvents(url: string, key: string): Promise<CulturalEvent[]> {
  const pageSize = 1000;
  const events: CulturalEvent[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "id,event_date,category,event_title,context_string,source_url,origin,date_kind",
      status: "eq.published",
      order: "event_date.asc,id.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${url}/rest/v1/cultural_events?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`cultural events failed with ${response.status}`);
    }
    const rows = (await response.json()) as {
      id: number;
      event_date: string;
      category: string;
      event_title: string;
      context_string: string | null;
      source_url: string;
      origin: string | null;
      date_kind: string | null;
    }[];

    for (const row of rows) {
      const parsed = splitDate(row.event_date);
      // A row the database somehow holds with an unreadable date is dropped
      // rather than defaulted onto January 1, which is where a date nobody
      // recorded already goes and is a bin this must not add to.
      if (parsed === null) continue;
      events.push({
        id: String(row.id),
        ...parsed,
        title: row.event_title,
        context: row.context_string,
        sourceUrl: row.source_url,
        category: row.category,
        // Defaulted rather than trusted: the column arrived after the first
        // ten rows did, and a row written before it existed is a hand written
        // one.
        origin: row.origin ?? "curated",
        dateKind: row.date_kind,
      });
    }

    if (rows.length < pageSize) break;
  }

  return events;
}

/** "2011-11-18" into its three numbers, or null if it is not that. */
export function splitDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** Keyed by month and day, the way the build walks the dates. */
export function culturalByDate(events: CulturalEvent[]): Map<string, CulturalEvent[]> {
  const byDate = new Map<string, CulturalEvent[]>();
  for (const event of events) {
    const key = `${event.month}-${event.day}`;
    const list = byDate.get(key);
    if (list) list.push(event);
    else byDate.set(key, [event]);
  }
  return byDate;
}

export function culturalForDate(
  byDate: Map<string, CulturalEvent[]>,
  month: number,
  day: number,
): CulturalEvent[] {
  return byDate.get(`${month}-${day}`) ?? [];
}
