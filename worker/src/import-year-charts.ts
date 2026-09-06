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
  from?: "table" | "sentence";
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
 * The years from 1998, which the page does not put in a table at all.
 *
 * From 1998 onward it gives each year its own top ten, with columns Rank,
 * Title, Developer and Publisher and no year anywhere in the table. The year
 * lives in the sentence above it: "The Legend of Zelda: Ocarina of Time was
 * the best-selling game of 1998."
 *
 * So the sentence is the source, which is better than it sounds. It states
 * the title and the year in one place, in the page's own words, and it is the
 * same discipline the reward pipeline uses: take the sentence that makes the
 * claim rather than assembling the claim from parts and hoping.
 *
 * Reading the rank one row of each table instead would mean pairing every
 * table with a heading by document position, and a page with one stray
 * heading would shift every year after it by one and look perfectly fine.
 */
export function parseYearSentences(html: string, spec: YearChartSpec): YearChartRow[] {
  const url = articleUrl(spec.pageTitle);
  const rows: YearChartRow[] = [];
  const seen = new Set<number>();

  const phrase = /\s+was the (?:best|top)[-\s]selling (?:video )?game of\s*(\d{4})/g;
  let match: RegExpExecArray | null;
  while ((match = phrase.exec(html)) !== null) {
    const yearText = match[1];
    if (!yearText) continue;
    const year = Number(yearText);
    if (year < spec.firstYear) continue;
    if (seen.has(year)) continue;

    // The title is whatever sentence the phrase is the end of. Take a window
    // back from the match, drop the markup, and keep the last sentence in it.
    const window = html.slice(Math.max(0, match.index - 400), match.index);
    const text = stripTags(window);
    const title = (text.split(/(?<=[.!?])\s+/).pop() ?? "").trim();
    // A title long enough to be a paragraph is a failed match, not a game.
    if (!title || title.length > 120) continue;

    seen.add(year);
    rows.push({
      chart: spec.chart,
      year,
      title,
      credit: null,
      source_url: url,
      content_license: LICENSE,
      note: spec.note,
      from: "sentence",
    });
  }

  return rows;
}

/**
 * Both readers, with the table winning where they overlap, because a column
 * is a stronger claim than a sentence.
 */
export function parsePage(html: string, spec: YearChartSpec): YearChartRow[] {
  const byYear = new Map<number, YearChartRow>();
  for (const row of parseYearSentences(html, spec)) byYear.set(row.year, row);
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
    console.log(`${row.year}  ${row.from === "table" ? "tbl" : "txt"}  ${row.title}${row.credit ? `  (${row.credit})` : ""}`);
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
