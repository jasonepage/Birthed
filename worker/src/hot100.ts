// The number one song, week by week, out of Wikipedia's year lists.
//
// The facts here are facts: which record was number one on a given Billboard
// issue date is not somebody's creative work and cannot be owned. The list as
// a compilation is Wikipedia's, under Creative Commons Attribution ShareAlike,
// and every row carries the page it came from. Birthed is not affiliated with
// Billboard, Penske Media or Wikipedia, and "Billboard Hot 100" is used to
// name the chart, which is the only thing it could mean.

import { ChartSpec, SONGS } from "./charts.js";
import { columnMatching, readGrid, readTables } from "./html.js";

export interface ChartWeek {
  /** The issue date printed on the chart, as yyyy-mm-dd. */
  chartDate: string;
  song: string;
  artist: string;
}

export interface YearReading {
  weeks: ChartWeek[];
  /** Everything that was not perfectly regular, in words. */
  notes: string[];
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** The page that holds a year, before redirects. */
export function pageTitle(year: number): string {
  return `List of Billboard Hot 100 number ones of ${year}`;
}

/**
 * The Hot 100 began with the issue dated August 4, 1958, but the 1958 page
 * redirects to a combined article carrying several different charts of that
 * year, and picking the wrong table there would put the Best Sellers number
 * one under the Hot 100's name. Rather than guess, the import starts in 1959
 * and a 1958 birthday gets no song. Absent beats wrong.
 */
export const FIRST_YEAR = 1959;

/**
 * "January 3", or "January 3, 2004", or "3 January". Returns yyyy-mm-dd, and
 * null for anything it does not understand rather than a date it invented.
 *
 * The year comes from the page unless the cell states one. A cell that states
 * a different year is not overruled: some year pages carry the last issue of
 * the previous December, and taking the page's year there would file it
 * eleven months out.
 */
export function parseIssueDate(text: string, pageYear: number): string | null {
  const cleaned = text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (cleaned === "") return null;

  const monthFirst = /^([a-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?$/.exec(cleaned);
  const dayFirst = /^(\d{1,2})\s+([a-z]+)(?:\s*,?\s*(\d{4}))?$/.exec(cleaned);
  const match = monthFirst ?? dayFirst;
  if (match === null) return null;

  const monthName = (monthFirst ? match[1] : match[2]) ?? "";
  const dayText = (monthFirst ? match[2] : match[1]) ?? "";
  const month = MONTHS.indexOf(monthName);
  if (month < 0) return null;

  const day = Number.parseInt(dayText, 10);
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;

  const year = match[3] !== undefined ? Number.parseInt(match[3], 10) : pageYear;
  if (!Number.isFinite(year) || year < 1900 || year > 2200) return null;

  // A day the month does not have is a parsing failure, not a date.
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;

  return iso(date);
}

export function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

export function addDays(isoDate: string, days: number): string {
  const date = toDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86400000);
}

/**
 * Footnote markers that are not part of a title.
 *
 * The dagger means "best-performing single of the year" and sits inside a
 * superscript on some year pages and as bare text on others, so stripping
 * superscripts is not enough on its own. Asterisks are deliberately left
 * alone: chart listings write "F**kin' Perfect" with them.
 */
export function stripMarkers(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[\u2020\u2021\u2666\u25CA\u2605]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A song title as it should be read, without the quotation marks the tables
 * wrap it in.
 *
 * Each quoted run is unwrapped rather than the string as a whole, because the
 * whole string is not always one quoted title. A double A side is two quoted
 * titles with a slash between them, and a remix is a quoted title with a
 * parenthetical after it, and taking the first and last quote off either of
 * those leaves a quotation mark stranded in the middle.
 *
 * An odd number of quotation marks means something is not what it looks like,
 * and the text is left exactly as found rather than half unwrapped.
 */
export function cleanTitle(text: string): string {
  const trimmed = stripMarkers(text);
  if (trimmed === "") return "";

  const marks = (trimmed.match(/["\u201C\u201D]/g) ?? []).length;
  if (marks >= 2 && marks % 2 === 0) {
    return trimmed
      .replace(/["\u201C]([^"\u201C\u201D]*)["\u201D]/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }
  return trimmed;
}

/**
 * An artist as written. Quotation marks stay, because they are nicknames:
 * Dave "Baby" Cortez, Bobby "Boris" Pickett, Ricardo "RikRok" Ducent.
 */
export function cleanArtist(text: string): string {
  return stripMarkers(text);
}

/**
 * Reads one year page.
 *
 * The right table is found by what its header says rather than by where it
 * sits, because these pages also carry a legend table and an artists-by-weeks
 * table, and on some years an infobox as well. The artists table has an
 * Artist column but no date and no song, which is what rules it out.
 *
 * Which headers to look for comes from the chart spec. The Hot 100 is the
 * default so that every existing caller and test reads exactly as before;
 * the album and film pages differ only in what their columns are called and
 * in the film pages having no credit column at all.
 */
export function parseYear(html: string, year: number, spec: ChartSpec = SONGS): YearReading {
  const notes: string[] = [];
  const candidates: { weeks: ChartWeek[]; skipped: number }[] = [];

  for (const table of readTables(html)) {
    const grid = readGrid(table);
    const header = grid[0];
    if (header === undefined) continue;

    const dateColumn = columnMatching(header, spec.dateHeader);
    const songColumn = columnMatching(header, spec.titleHeader);
    const artistColumn = spec.creditHeader === null ? -2 : columnMatching(header, spec.creditHeader);
    if (dateColumn < 0 || songColumn < 0 || artistColumn === -1) continue;

    const weeks: ChartWeek[] = [];
    let skipped = 0;
    for (const row of grid.slice(1)) {
      const chartDate = parseIssueDate(row[dateColumn] ?? "", year);
      const song = cleanTitle(row[songColumn] ?? "");
      const artist = artistColumn < 0 ? "" : cleanArtist(row[artistColumn] ?? "");
      if (chartDate === null || song === "" || (artistColumn >= 0 && artist === "")) {
        skipped += 1;
        continue;
      }
      weeks.push({ chartDate, song, artist });
    }
    candidates.push({ weeks, skipped });
  }

  if (candidates.length === 0) {
    notes.push(`${year}: no table with the date, title and credit columns this chart needs`);
    return { weeks: [], notes };
  }

  // The chart table is the one with the most weeks in it. On a page with only
  // one such table this changes nothing, and on the 1958 style combined page
  // it at least picks the biggest rather than the first.
  const best = candidates.reduce((a, b) => (b.weeks.length > a.weeks.length ? b : a));
  if (best.skipped > 0) {
    notes.push(`${year}: ${best.skipped} rows had no readable date, song or artist`);
  }

  const byDate = new Map<string, ChartWeek>();
  for (const week of best.weeks) {
    const existing = byDate.get(week.chartDate);
    if (existing !== undefined) {
      if (existing.song !== week.song) {
        notes.push(`${year}: ${week.chartDate} listed twice, as ${existing.song} and ${week.song}`);
      }
      continue;
    }
    byDate.set(week.chartDate, week);
  }

  const weeks = [...byDate.values()].sort((a, b) => a.chartDate.localeCompare(b.chartDate));
  const wrongYear = weeks.filter((week) => !week.chartDate.startsWith(`${year}-`)).length;
  if (wrongYear > 0) notes.push(`${year}: ${wrongYear} rows dated outside the year`);

  return { weeks, notes };
}

/**
 * Fills weeks the pages did not write down.
 *
 * Some year lists give one row per chart week and some give only the week a
 * song reached number one, and the same page can change style between
 * decades. Either way a gap that is a whole number of weeks means the
 * previous song was still there, so it is carried forward. A gap that is not
 * a whole number of weeks is a hole in the data and is reported rather than
 * papered over: a wrong song is worse than no song.
 */
export function fillWeeks(weeks: ChartWeek[]): YearReading {
  const notes: string[] = [];
  const sorted = [...weeks].sort((a, b) => a.chartDate.localeCompare(b.chartDate));
  const filled: ChartWeek[] = [];

  for (const week of sorted) {
    const previous = filled[filled.length - 1];
    if (previous !== undefined) {
      const gap = daysBetween(previous.chartDate, week.chartDate);
      if (gap % 7 !== 0) {
        notes.push(
          `${previous.chartDate} to ${week.chartDate} is ${gap} days, which is not whole weeks`,
        );
      } else if (gap > 7) {
        for (let step = 7; step < gap; step += 7) {
          filled.push({
            chartDate: addDays(previous.chartDate, step),
            song: previous.song,
            artist: previous.artist,
          });
        }
      }
    }
    filled.push(week);
  }

  return { weeks: filled, notes };
}

/**
 * What is wrong with a finished year, in words a person can act on.
 *
 * A year of weekly charts has 52 or 53 issues. Anything else means the page
 * changed shape or the parse lost rows, and the run should say so loudly
 * rather than write a year with nine weeks in it and call that a success.
 */
export function auditYear(weeks: ChartWeek[], year: number, isCurrentYear: boolean): string[] {
  const notes: string[] = [];
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  if (first === undefined || last === undefined) return [`${year}: nothing parsed`];

  if (!isCurrentYear && weeks.length < 52) {
    notes.push(`${year}: only ${weeks.length} weeks, expected 52 or 53`);
  }
  if (weeks.length > 53) {
    notes.push(`${year}: ${weeks.length} weeks, which is more than a year holds`);
  }
  if (daysBetween(`${year}-01-01`, first.chartDate) > 7) {
    notes.push(`${year}: starts at ${first.chartDate}, more than a week into the year`);
  }
  if (!isCurrentYear && daysBetween(last.chartDate, `${year}-12-31`) > 7) {
    notes.push(`${year}: ends at ${last.chartDate}, more than a week short of the year`);
  }

  const weekdays = new Set(weeks.map((week) => toDate(week.chartDate).getUTCDay()));
  if (weekdays.size > 1) {
    notes.push(`${year}: issue dates fall on ${weekdays.size} different weekdays`);
  }
  return notes;
}
