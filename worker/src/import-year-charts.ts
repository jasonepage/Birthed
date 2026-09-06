// Backfills a chart that is keyed to a year rather than to a week.
//
//   node dist/src/import-year-charts.js --dry     # parse and print, write nothing
//   node dist/src/import-year-charts.js
//
// **Run it dry first and read every row.** This parser has never been run
// against the live page by whoever wrote it, because that session had no way
// to reach the web. The whole reason this file prints the full table in dry
// mode rather than a count is that eleven of the hundred and one dates in
// WorldThen were wrong, every one of them was a real date, and none of them
// would have been caught by anything except somebody reading the list.
//
// One page, one request, about forty seven rows. Safe to run again: the table
// is keyed on the chart and the year and a rerun overwrites rather than
// duplicates.

import { loadConfig, loadDotEnv } from "./config.js";
import { columnMatching, readGrid, readTables } from "./html.js";
import { articleUrl, fetchPage } from "./wikipedia.js";

const LICENSE = "CC-BY-SA-4.0";

interface YearChartSpec {
  chart: string;
  pageTitle: string;
  /** Header patterns, matched against lower case header text. */
  yearHeader: RegExp;
  titleHeader: RegExp;
  creditHeader: RegExp | null;
  /** The earliest year worth trusting from this page. */
  firstYear: number;
  /** What the interface shows beside the claim. */
  note: string;
}

export const US_BEST_SELLING_GAME: YearChartSpec = {
  chart: "us_best_selling_game",
  pageTitle: "List of best-selling video games in the United States by year",
  yearHeader: /^year/,
  titleHeader: /^game|^title/,
  creditHeader: /^publisher|^developer/,
  // The page runs from 1980. Anything earlier is not on it.
  firstYear: 1980,
  // Short on purpose: it sits in the panel next to the song's issue date and
  // does the same job, which is making the claim checkable rather than
  // asserted. The fuller story is on the page every row links to.
  note: "United States sales for the whole year, from Circana. Not every publisher reports.",
};

export interface YearChartRow {
  chart: string;
  year: number;
  title: string;
  credit: string | null;
  source_url: string;
  content_license: string;
  note: string;
}

/**
 * Reads the one table on the page that has a year column and a title column.
 *
 * Deliberately not "the first table": these pages carry navigation boxes and
 * summary tables that a positional rule picks up silently. Matching on the
 * headers means a page that has been restructured returns nothing and says so,
 * rather than returning the wrong thing and looking fine.
 */
export function parsePage(html: string, spec: YearChartSpec): YearChartRow[] {
  const url = articleUrl(spec.pageTitle);
  const rows: YearChartRow[] = [];
  const seen = new Set<number>();

  for (const table of readTables(html)) {
    const grid = readGrid(table);
    if (grid.length < 2) continue;

    const first = grid[0];
    if (!first) continue;
    const header = first.map((cell) => cell.trim().toLowerCase());
    const yearColumn = columnMatching(header, spec.yearHeader);
    const titleColumn = columnMatching(header, spec.titleHeader);
    if (yearColumn < 0 || titleColumn < 0) continue;
    const creditColumn = spec.creditHeader ? columnMatching(header, spec.creditHeader) : -1;

    for (const line of grid.slice(1)) {
      const rawYear = (line[yearColumn] ?? "").trim();
      // A four digit year and nothing else. A cell reading "1994-95" or
      // "Notes" is skipped rather than coerced, because half a guess about
      // which year a row belongs to is worse than no row at all.
      const match = /^(\d{4})$/.exec(rawYear);
      if (!match) continue;
      const year = Number(match[1]);
      if (year < spec.firstYear) continue;
      // The first table that matches wins for a given year. A later summary
      // table repeating the same years must not overwrite it.
      if (seen.has(year)) continue;

      const title = (line[titleColumn] ?? "").trim();
      if (!title) continue;

      const credit = creditColumn >= 0 ? (line[creditColumn] ?? "").trim() : "";

      seen.add(year);
      rows.push({
        chart: spec.chart,
        year,
        title,
        credit: credit === "" ? null : credit,
        source_url: url,
        content_license: LICENSE,
        note: spec.note,
      });
    }
  }

  rows.sort((a, b) => a.year - b.year);
  return rows;
}

/**
 * What is missing, so a gap is reported rather than discovered by a reader
 * born in the year that fell out.
 */
export function auditYears(rows: YearChartRow[], firstYear: number, lastYear: number): number[] {
  const have = new Set(rows.map((row) => row.year));
  const missing: number[] = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    if (!have.has(year)) missing.push(year);
  }
  return missing;
}

async function upsertYearCharts(
  rows: YearChartRow[],
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<number> {
  if (rows.length === 0) return 0;
  const response = await fetch(
    `${supabaseUrl}/rest/v1/year_charts?on_conflict=chart,year`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );
  if (!response.ok) {
    throw new Error(`year_charts upsert failed: ${response.status} ${await response.text()}`);
  }
  return rows.length;
}

async function main(): Promise<void> {
  const dry = process.argv.includes("--dry");
  await loadDotEnv();
  const config = loadConfig({ needsWrite: !dry });

  const spec = US_BEST_SELLING_GAME;
  const page = await fetchPage(spec.pageTitle, config.userAgent);
  if (!page) {
    console.log(`Wikipedia has no page called "${spec.pageTitle}". It has probably been renamed, so find where it went before changing anything here.`);
    process.exitCode = 1;
    return;
  }
  const rows = parsePage(page.html, spec);

  // Every row, not a count. Reading them is the point of the dry run.
  for (const row of rows) {
    console.log(`${row.year}  ${row.title}${row.credit ? `  (${row.credit})` : ""}`);
  }

  const thisYear = new Date().getUTCFullYear();
  const missing = auditYears(rows, spec.firstYear, thisYear - 1);
  console.log(`\n${rows.length} rows, ${spec.firstYear} to ${thisYear}.`);
  if (missing.length > 0) {
    console.log(`Missing years: ${missing.join(", ")}`);
  }
  if (rows.length === 0) {
    console.log("Nothing matched. The page has probably been restructured, so check the headers in the spec against it before changing anything else.");
    process.exitCode = 1;
    return;
  }

  if (dry) {
    console.log("Dry run, nothing written.");
    return;
  }

  const written = await upsertYearCharts(rows, config.supabaseUrl, config.serviceRoleKey);
  console.log(`Wrote ${written} rows to year_charts.`);
}

if (process.argv[1] && process.argv[1].endsWith("import-year-charts.js")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
