// The curation panel's points, for a history row, as the worker needs them.
//
// The formula lives in web/src/admin.ts as POINTS_JS and runs in the panel.
// The worker and the site are separate packages, so this is a copy of the
// part that scores a Wikipedia history row, the way the word screens in
// history.ts are a copy of web/src/highlight.ts. worker/test/wall-points.test.ts
// reads the panel's copy off disk and holds the two to the same numbers on
// the same inputs, so a change to one that is not made to the other fails a
// test rather than quietly ranking two boards two ways.
//
// What it is for: docs/the-wall.md section 13 gave the allocator four coarse
// priorities, and on September 11, 2026 a hundred and sixty four history
// stories tied at priority 1, so the board among them was arrival order
// under the variety caps. The 2001 attacks lost a lottery to the theft of
// the Hope Diamond. This is the tie broken by the one number that separates
// history rows: whether people look the thing up on its date, every year.
//
// No model is asked. Every input is a column or a count.

export const WEIGHTS = { spike: 35, reach: 25, memory: 25, selected: 10, written: 15 } as const;
/** Every history row cites Wikipedia, which is "encyclopedia" on the panel's sourcing ladder. */
export const ENCYCLOPEDIA_SOURCING = 4;

export interface HistoryPointsInput {
  /** The year of the event, or null. */
  year: number | null;
  /** Wikipedia's editors picked the row for the date. */
  selected: boolean;
  /** Somebody wrote a lead line for it. */
  written: boolean;
  /** Yearly pageviews on the subject article, or null when unmeasured. */
  views: number | null;
  /** The lower of the views on the date in each of the last two years, or null. */
  viewsOnDateLow: number | null;
  /** The median day's views on the subject article, or null. */
  viewsMedianDay: number | null;
}

/** Living memory: a curve on the year, full between 1985 and 2015. */
export function memoryOf(year: number | null): number {
  if (year === null || Number.isNaN(year)) return 0;
  if (year >= 1985 && year <= 2015) return WEIGHTS.memory;
  if (year < 1985) return Math.max(0, Math.round(WEIGHTS.memory * (1 - (1985 - year) / 40)));
  return Math.max(0, Math.round(WEIGHTS.memory * (1 - (year - 2015) / 12)));
}

/** Reach: log scaled yearly pageviews, a million a year is the full score. Null when unmeasured. */
export function reachOf(views: number | null): number | null {
  if (views === null) return null;
  const v = Math.max(0, views);
  return Math.round(WEIGHTS.reach * Math.min(1, Math.log10(v + 1) / 6));
}

/**
 * The anniversary spike: how many more people opened the article on the
 * date than on an ordinary day, in the lower of the last two years, in
 * absolute views. A thousand earns nothing, a hundred thousand earns the
 * full score, log scale between. The reasons are on the panel's copy.
 */
export function spikeOf(onDateLow: number | null, medianDay: number | null): number | null {
  if (onDateLow === null || medianDay === null) return null;
  const excess = onDateLow - medianDay;
  if (excess < 1000) return 0;
  return Math.round(WEIGHTS.spike * Math.min(1, (Math.log10(excess) - 3) / 2));
}

/** One history row's points, the same number the panel prints for it. */
export function historyPoints(input: HistoryPointsInput): number {
  const spike = spikeOf(input.viewsOnDateLow, input.viewsMedianDay) ?? 0;
  const reach = reachOf(input.views) ?? 0;
  const selected = input.selected ? WEIGHTS.selected : 0;
  const written = input.written ? WEIGHTS.written : 0;
  return Math.max(0, spike + reach + selected + memoryOf(input.year) + written + ENCYCLOPEDIA_SOURCING);
}

// ---------------------------------------------------------------------------
// Rows as the database holds them, and the scores for one date
// ---------------------------------------------------------------------------

export interface ScoredEventRow { id: number | string; event_year: number | null; subject_url: string | null }
export interface ReachRow { source_url: string; views_year: number | null; views_on_date_low: number | null; views_median_day: number | null; error: string | null }

/**
 * The points for every history event on a date, keyed the way wall_stories
 * keys a subject: "historical_event:<id>". Pure. An event with no subject
 * or no measurement scores on year, pick and line alone, the same as the
 * panel prints for it.
 */
export function scoreEvents(
  events: ScoredEventRow[],
  reach: ReachRow[],
  selectedYears: Set<number>,
  leadLineIds: Set<string>,
): Map<string, number> {
  const byUrl = new Map(reach.map((r) => [r.source_url, r]));
  const out = new Map<string, number>();
  for (const e of events) {
    const measured = e.subject_url === null ? undefined : byUrl.get(e.subject_url);
    const usable = measured !== undefined && measured.error === null;
    out.set(`historical_event:${e.id}`, historyPoints({
      year: e.event_year,
      selected: e.event_year !== null && selectedYears.has(e.event_year),
      written: leadLineIds.has(String(e.id)),
      views: usable ? measured.views_year : null,
      viewsOnDateLow: usable ? measured.views_on_date_low : null,
      viewsMedianDay: usable ? measured.views_median_day : null,
    }));
  }
  return out;
}
