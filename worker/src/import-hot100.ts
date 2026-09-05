// Backfills the number one song, week by week, from 1959 to now.
//
//   node dist/src/import-hot100.js
//   node dist/src/import-hot100.js --from 1990 --to 1999
//   node dist/src/import-hot100.js --dry          # parse and report, write nothing
//
// About seventy requests and a few thousand rows, so it finishes in under a
// minute. It is safe to run again: chart_weeks is keyed on the chart name and
// the issue date, and a rerun overwrites rather than duplicates.
//
// Read the report at the end rather than the progress. A year that came out
// with nine weeks in it is the failure that matters, and it does not look like
// an error while it is happening.

import { loadConfig, loadDotEnv } from "./config.js";
import {
  ChartWeek,
  FIRST_YEAR,
  auditYear,
  fillWeeks,
  pageTitle,
  parseYear,
} from "./hot100.js";
import { upsertChartWeeks } from "./upsert.js";
import { articleUrl, fetchPage } from "./wikipedia.js";

const CHART = "Billboard Hot 100";
const LICENSE = "CC-BY-SA-4.0";

function argValue(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const parsed = Number(process.argv[index + 1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface YearResult {
  year: number;
  weeks: (ChartWeek & { sourceUrl: string })[];
  notes: string[];
}

async function readYear(year: number, thisYear: number, userAgent: string): Promise<YearResult> {
  const title = pageTitle(year);
  const page = await fetchPage(title, userAgent);
  if (page === null) {
    return { year, weeks: [], notes: [`${year}: no page called ${title}`] };
  }

  const parsed = parseYear(page.html, year);
  const filled = fillWeeks(parsed.weeks);
  const notes = [
    ...parsed.notes,
    ...filled.notes.map((note) => `${year}: ${note}`),
    ...auditYear(filled.weeks, year, year === thisYear),
  ];

  const url = articleUrl(page.title);
  return { year, weeks: filled.weeks.map((week) => ({ ...week, sourceUrl: url })), notes };
}

async function main(): Promise<void> {
  await loadDotEnv();
  const dry = process.argv.includes("--dry");
  const config = loadConfig({ needsWrite: !dry });

  const thisYear = new Date().getUTCFullYear();
  const from = Math.max(argValue("from", FIRST_YEAR), FIRST_YEAR);
  const to = argValue("to", thisYear);

  const results: YearResult[] = [];
  for (let year = from; year <= to; year += 1) {
    try {
      const result = await readYear(year, thisYear, config.userAgent);
      results.push(result);
      const flag = result.notes.length > 0 ? "  <- see report" : "";
      console.log(`${year}: ${result.weeks.length} weeks${flag}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ year, weeks: [], notes: [`${year}: ${message}`] });
      console.log(`${year}: failed, ${message}`);
    }
    // Wikipedia asks for a considerate rate and this is seventy requests.
    await sleep(200);
  }

  // One list, sorted, with the weeks each year's page did not write down
  // filled in across the year boundaries as well as inside them. A song that
  // held number one from December into January is written on both pages, so
  // this is mostly a safety net for a page that starts on the second week.
  const merged = new Map<string, ChartWeek & { sourceUrl: string }>();
  for (const result of results) {
    for (const week of result.weeks) merged.set(week.chartDate, week);
  }
  const ordered = [...merged.values()].sort((a, b) => a.chartDate.localeCompare(b.chartDate));

  const across = fillWeeks(ordered);
  const bySource = new Map(ordered.map((week) => [week.chartDate, week.sourceUrl]));
  const rows = across.weeks.map((week) => ({
    chart_date: week.chartDate,
    chart_name: CHART,
    song: week.song,
    artist: week.artist,
    // A week that only exists because it was carried forward credits the page
    // the song came from, which is the page that actually said it.
    source_url: bySource.get(week.chartDate) ?? articleUrl(pageTitle(Number(week.chartDate.slice(0, 4)))),
    content_license: LICENSE,
  }));

  console.log("");
  console.log(`${rows.length} chart weeks, ${ordered[0]?.chartDate} to ${ordered[ordered.length - 1]?.chartDate}`);

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

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
