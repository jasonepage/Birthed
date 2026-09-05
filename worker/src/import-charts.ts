// Backfills a chart, week by week, from its first readable year to now.
//
//   node dist/src/import-charts.js --chart albums
//   node dist/src/import-charts.js --chart films --from 1990 --to 1999
//   node dist/src/import-charts.js --chart songs --dry     # parse and report, write nothing
//
// One request per year and a few thousand rows, so a chart finishes in under
// a minute. It is safe to run again: chart_weeks is keyed on the chart name
// and the issue date, and a rerun overwrites rather than duplicates.
//
// Read the report at the end rather than the progress. A year that came out
// with nine weeks in it is the failure that matters, and it does not look like
// an error while it is happening.

import { ChartSpec, CHARTS, chartNamed } from "./charts.js";
import { loadConfig, loadDotEnv } from "./config.js";
import { ChartWeek, auditYear, fillWeeks, parseYear } from "./hot100.js";
import { upsertChartWeeks } from "./upsert.js";
import { articleUrl, fetchPage } from "./wikipedia.js";

const LICENSE = "CC-BY-SA-4.0";

function argValue(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const parsed = Number(process.argv[index + 1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function argText(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? undefined : process.argv[index + 1];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface YearResult {
  year: number;
  weeks: (ChartWeek & { sourceUrl: string })[];
  notes: string[];
}

async function readYear(
  spec: ChartSpec,
  year: number,
  thisYear: number,
  userAgent: string,
): Promise<YearResult> {
  const title = spec.pageTitle(year);
  const page = await fetchPage(title, userAgent);
  if (page === null) {
    return { year, weeks: [], notes: [`${year}: no page called ${title}`] };
  }

  const parsed = parseYear(page.html, year, spec);
  const filled = fillWeeks(parsed.weeks);
  const notes = [
    ...parsed.notes,
    ...filled.notes.map((note) => `${year}: ${note}`),
    ...auditYear(filled.weeks, year, year === thisYear),
  ];

  const url = articleUrl(page.title);
  return { year, weeks: filled.weeks.map((week) => ({ ...week, sourceUrl: url })), notes };
}

/** The whole run for one chart. Exported so the songs script can reuse it. */
export async function runImport(spec: ChartSpec): Promise<void> {
  await loadDotEnv();
  const dry = process.argv.includes("--dry");
  const config = loadConfig({ needsWrite: !dry });

  const thisYear = new Date().getUTCFullYear();
  const from = Math.max(argValue("from", spec.firstYear), spec.firstYear);
  const to = argValue("to", thisYear);

  console.log(`${spec.name}, ${from} to ${to}`);

  const results: YearResult[] = [];
  for (let year = from; year <= to; year += 1) {
    try {
      const result = await readYear(spec, year, thisYear, config.userAgent);
      results.push(result);
      const flag = result.notes.length > 0 ? "  <- see report" : "";
      console.log(`${year}: ${result.weeks.length} weeks${flag}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ year, weeks: [], notes: [`${year}: ${message}`] });
      console.log(`${year}: failed, ${message}`);
    }
    // Wikipedia asks for a considerate rate and this is under a hundred requests.
    await sleep(200);
  }

  // One list, sorted, with the weeks each year's page did not write down
  // filled in across the year boundaries as well as inside them.
  const merged = new Map<string, ChartWeek & { sourceUrl: string }>();
  for (const result of results) {
    for (const week of result.weeks) merged.set(week.chartDate, week);
  }
  const ordered = [...merged.values()].sort((a, b) => a.chartDate.localeCompare(b.chartDate));

  const across = fillWeeks(ordered);
  const bySource = new Map(ordered.map((week) => [week.chartDate, week.sourceUrl]));
  const rows = across.weeks.map((week) => ({
    chart_date: week.chartDate,
    chart_name: spec.name,
    song: week.song,
    artist: week.artist,
    // A week that only exists because it was carried forward credits the page
    // the entry came from, which is the page that actually said it.
    source_url:
      bySource.get(week.chartDate) ?? articleUrl(spec.pageTitle(Number(week.chartDate.slice(0, 4)))),
    content_license: LICENSE,
  }));

  console.log("");
  console.log(
    `${rows.length} chart weeks, ${ordered[0]?.chartDate} to ${ordered[ordered.length - 1]?.chartDate}`,
  );

  const problems = [
    ...results.flatMap((result) => result.notes),
    ...across.notes.map((note) => `across years: ${note}`),
  ];
  if (problems.length === 0) {
    console.log("nothing odd");
  } else {
    console.log("");
    console.log(`${problems.length} things to look at:`);
    for (const problem of problems) console.log(`  ${problem}`);
  }

  if (dry) {
    console.log("");
    console.log("dry run, wrote nothing");
    return;
  }

  const written = await upsertChartWeeks(rows, config.supabaseUrl, config.serviceRoleKey);
  console.log(`wrote ${written} rows`);
}

async function main(): Promise<void> {
  const key = argText("chart");
  const spec = key === undefined ? undefined : chartNamed(key);
  if (spec === undefined) {
    const known = CHARTS.map((chart) => chart.key).join(", ");
    throw new Error(`Say which chart: --chart ${known.replace(/, /g, " | ")}`);
  }
  await runImport(spec);
}

// Only run when invoked directly, so the songs script can import runImport
// without this file starting a second run.
if (process.argv[1]?.endsWith("import-charts.js")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
