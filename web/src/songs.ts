// The number one song on a calendar date, in every year the chart has run.
//
// This is the one thing a Birthed date page has that a page about the people
// born that day does not: 68 rows of content that belong to September 4 and
// to no other date, and a question people actually type.
//
// The lookup rule is the app's rule, written once more here rather than
// shared, because the app is Swift and this is TypeScript and a shared rule
// that has to be written twice is better written twice deliberately: the
// chart covering a date is the first issue dated on or after it, and at most
// six days after it. See CLAUDE.md section 5.

export interface ChartWeek {
  /** yyyy-mm-dd, the issue date printed on the chart. */
  chartDate: string;
  song: string;
  artist: string;
}

export interface SongOfTheYear {
  year: number;
  /** The issue that covered this date in that year. */
  chartDate: string;
  song: string;
  artist: string;
}

export const CHART_NAME = "Billboard Hot 100";

/** Days a weekly chart covers, counting the issue date itself. */
const WINDOW = 7;

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whether a year actually has this calendar date. February 29 mostly does not. */
export function dateExists(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isoFor(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Every day covered by some chart week, mapped to the week covering it.
 *
 * Built once for the whole site rather than searched per page. A chart week
 * covers the six days before its issue date and the issue date itself, so
 * this is about 25,000 entries and answers all 366 pages in constant time.
 *
 * The alternative, a binary search per year per page, is 25,000 searches to
 * save a few megabytes of memory in a build that runs for a minute.
 */
export function coverageByDay(weeks: ChartWeek[]): Map<string, ChartWeek> {
  const covered = new Map<string, ChartWeek>();
  for (const week of weeks) {
    for (let back = 0; back < WINDOW; back += 1) {
      const day = addDays(week.chartDate, -back);
      // Earlier weeks never win a day a later week also claims, because
      // consecutive issues are seven days apart and these windows do not
      // overlap. This guard is for a table with a gap in it.
      if (!covered.has(day)) covered.set(day, week);
    }
  }
  return covered;
}

/**
 * The number one song on this calendar date, newest year first.
 *
 * A year with no covering chart is left out rather than filled with the
 * nearest one. February 29 therefore yields only leap years, which is correct
 * and is the whole reason `dateExists` is here.
 */
export function songsForDate(
  covered: Map<string, ChartWeek>,
  month: number,
  day: number,
  fromYear: number,
  toYear: number,
): SongOfTheYear[] {
  const songs: SongOfTheYear[] = [];
  for (let year = toYear; year >= fromYear; year -= 1) {
    if (!dateExists(year, month, day)) continue;
    const week = covered.get(isoFor(year, month, day));
    if (week === undefined) continue;
    songs.push({ year, chartDate: week.chartDate, song: week.song, artist: week.artist });
  }
  return songs;
}

/**
 * Reads the whole table, a page at a time.
 *
 * PostgREST answers at most a thousand rows and says nothing about the ones
 * it left out, so a single request would silently return the first thousand
 * weeks, which is 1959 to 1978, and every page would end at 1978 with no
 * error anywhere.
 */
export async function fetchChartWeeks(url: string, key: string): Promise<ChartWeek[]> {
  const pageSize = 1000;
  const weeks: ChartWeek[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "chart_date,song,artist",
      chart_name: `eq.${CHART_NAME}`,
      order: "chart_date.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${url}/rest/v1/chart_weeks?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`chart weeks failed with ${response.status}`);
    }
    const rows = (await response.json()) as { chart_date: string; song: string; artist: string }[];
    for (const row of rows) {
      weeks.push({ chartDate: row.chart_date, song: row.song, artist: row.artist });
    }
    if (rows.length < pageSize) break;
  }

  return weeks;
}
