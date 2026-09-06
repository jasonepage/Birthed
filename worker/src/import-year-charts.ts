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
import { columnMatching, decodeEntities, readGrid, readTables } from "./html.js";
import { articleUrl, fetchPage } from "./wikipedia.js";

const LICENSE = "CC-BY-SA-4.0";

interface YearChartSpec {
  chart: string;
  pageTitle: string;
  /** Header patterns, matched against lower case header text. */
  yearHeader: RegExp;
  titleHeader: RegExp;
  /** The earliest year worth trusting from this page. */
  firstYear: number;
  /** What the interface shows beside the claim. */
  note: string;
}

export const US_BEST_SELLING_GAME: YearChartSpec = {
  chart: "us_best_selling_game",
  pageTitle: "List of best-selling video games in the United States by year",
  // Distinctive on purpose. "Title" alone also matches the all-time top ten
  // table further down, whose Year column is a release year, and matching it
  // is exactly the wrong answer wearing the right shape: the first dry run
  // returned nine scattered years and developers where publishers belong.
  yearHeader: /^year/,
  titleHeader: /top.selling title/,
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
  /** Which reader produced it. Printed in dry mode, never stored. */
  from?: "table" | "section";
}

/**
 * Everything between two HTML tags, as plain text.
 */
function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

/**
 * The years 1980 to 1997, from the one table that lists them.
 *
 * That table is found by its "Top-selling title" header rather than by
 * position, because the page carries more than twenty tables and several of
 * them have a column called Title. A page that has been restructured returns
 * nothing here and says so, which is the failure worth having.
 */
export function parseYearTable(html: string, spec: YearChartSpec): YearChartRow[] {
  const url = articleUrl(spec.pageTitle);
  const rows: YearChartRow[] = [];
  const seen = new Set<number>();

  for (const table of readTables(html)) {
    const grid = readGrid(table);
    const first = grid[0];
    if (!first) continue;

    const header = first.map((cell) => cell.trim().toLowerCase());
    const yearColumn = columnMatching(header, spec.yearHeader);
    const titleColumn = columnMatching(header, spec.titleHeader);
    if (yearColumn < 0 || titleColumn < 0) continue;
    const creditColumn = columnMatching(header, /^publisher/);

    for (const line of grid.slice(1)) {
      const rawYear = (line[yearColumn] ?? "").trim();
      // Four digits and nothing else. A cell reading "1994-95" or "Notes" is
      // skipped rather than coerced, because half a guess about which year a
      // row belongs to is worse than no row.
      const match = /^(\d{4})$/.exec(rawYear);
      if (!match) continue;
      const year = Number(match[1]);
      if (year < spec.firstYear) continue;
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
        from: "table",
      });
    }
  }

  return rows;
}

/**
 * Every heading on the page whose whole text is a year, with where its
 * section starts and ends.
 *
 * The year is read out of the heading rather than counted. Pairing tables
 * with headings by document position was the thing worth avoiding, because
 * one stray heading shifts every year after it by one and looks perfectly
 * fine doing it. Reading "2007" out of the heading that says 2007 cannot
 * drift.
 */
export function yearSections(html: string): { year: number; body: string }[] {
  const heading = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g;
  const found: { year: number | null; start: number; end: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = heading.exec(html)) !== null) {
    const inner = match[1] ?? "";
    // Wikipedia puts an "[edit]" link inside the heading. It is markup, not
    // part of the name of the section.
    const text = stripTags(inner).replace(/\[edit\]/gi, "").trim();
    const yearMatch = /^(\d{4})$/.exec(text);
    found.push({
      year: yearMatch && yearMatch[1] ? Number(yearMatch[1]) : null,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  const sections: { year: number; body: string }[] = [];
  for (let index = 0; index < found.length; index += 1) {
    const here = found[index];
    if (!here || here.year === null) continue;
    // Up to the next heading of any level, so a subsection cannot pull in the
    // table belonging to the year after it.
    const next = found[index + 1];
    sections.push({ year: here.year, body: html.slice(here.end, next ? next.start : html.length) });
  }
  return sections;
}

/**
 * The years from 1998, which the page does not put in a per-year table at all.
 *
 * From 1998 onward every year gets its own top ten, with columns Rank, Title,
 * Developer and Publisher and no year anywhere in the table. So the year comes
 * from the heading above it and the game is the first row, which is rank one.
 *
 * Taking the first data row rather than searching for a cell reading "1" is
 * deliberate: some of these tables have no rank column at all, and every one
 * of them is in rank order, so position within the table is the reliable part
 * even though position of the table on the page is not.
 */
export function parseYearSections(html: string, spec: YearChartSpec): YearChartRow[] {
  const url = articleUrl(spec.pageTitle);
  const rows: YearChartRow[] = [];

  for (const section of yearSections(html)) {
    if (section.year < spec.firstYear) continue;

    const table = readTables(section.body)[0];
    if (!table) continue;
    const grid = readGrid(table);
    const header = grid[0];
    const firstRow = grid[1];
    if (!header || !firstRow) continue;

    const lower = header.map((cell) => cell.trim().toLowerCase());
    const titleColumn = columnMatching(lower, /^title|^game/);
    if (titleColumn < 0) continue;
    const creditColumn = columnMatching(lower, /^publisher/);

    const title = (firstRow[titleColumn] ?? "").trim();
    if (!title || title.length > 120) continue;
    const credit = creditColumn >= 0 ? (firstRow[creditColumn] ?? "").trim() : "";

    rows.push({
      chart: spec.chart,
      year: section.year,
      title,
      credit: credit === "" ? null : credit,
      source_url: url,
      content_license: LICENSE,
      note: spec.note,
      from: "section",
    });
  }

  return rows;
}

/**
 * Both readers, with the 1980 to 1997 table winning where they overlap,
 * because a column headed "Top-selling title" is a stronger claim than the
 * first row of a top ten.
 */
export function parsePage(html: string, spec: YearChartSpec): YearChartRow[] {
  const byYear = new Map<number, YearChartRow>();
  for (const row of parseYearSections(html, spec)) byYear.set(row.year, row);
  for (const row of parseYearTable(html, spec)) byYear.set(row.year, row);
  return [...byYear.values()].sort((a, b) => a.year - b.year);
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
      // `from` is a diagnostic for the dry run and is not a column.
      body: JSON.stringify(rows.map(({ from, ...row }) => row)),
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
    console.log(`${row.year}  ${row.from === "table" ? "tbl" : "sec"}  ${row.title}${row.credit ? `  (${row.credit})` : ""}`);
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
