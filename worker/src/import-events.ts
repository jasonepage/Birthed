// Fills historical_events from Wikipedia's date articles, all 366 of them.
//
//   node dist/src/import-events.js --dry --print --month 9 --day 5   # read one, show it, write nothing
//   node dist/src/import-events.js --month 9                          # one month
//   node dist/src/import-events.js                                    # everything
//
// One request per date, so the whole year is 366 requests and a few minutes.
// Safe to run again: every row carries a fingerprint of its date, year and
// sentence, and a rerun overwrites rather than duplicates.
//
// Read the report at the end. A date that read nine events is the failure
// that matters, and it does not look like an error while it is happening.

import { createHash } from "node:crypto";

import { loadConfig, loadDotEnv } from "./config.js";
import { DateEvent, parseEvents } from "./events.js";
import { upsertHistoricalEvents } from "./upsert.js";
import { articleUrl, fetchPage } from "./wikipedia.js";

const LICENSE = "CC-BY-SA-4.0";
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function argNumber(name: string): number | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const parsed = Number(process.argv[index + 1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function fingerprint(month: number, day: number, event: DateEvent): string {
  return createHash("sha1")
    .update(`${month}|${day}|${event.year}|${event.description}`)
    .digest("hex");
}

interface DateResult {
  month: number;
  day: number;
  events: DateEvent[];
  sourceUrl: string;
  notes: string[];
}

async function readDate(month: number, day: number, userAgent: string, thisYear: number): Promise<DateResult> {
  const title = `${MONTHS[month - 1]} ${day}`;
  const page = await fetchPage(title, userAgent);
  if (page === null) {
    return { month, day, events: [], sourceUrl: articleUrl(title), notes: [`${title}: no page`] };
  }
  const read = parseEvents(page.html, thisYear);
  return {
    month,
    day,
    events: read.events,
    sourceUrl: articleUrl(page.title),
    notes: read.notes.map((note) => `${title}: ${note}`),
  };
}

async function main(): Promise<void> {
  await loadDotEnv();
  const dry = process.argv.includes("--dry");
  const print = process.argv.includes("--print");
  const config = loadConfig({ needsWrite: !dry });
  const thisYear = new Date().getUTCFullYear();

  const onlyMonth = argNumber("month");
  const onlyDay = argNumber("day");

  const dates: [number, number][] = [];
  for (let month = 1; month <= 12; month += 1) {
    if (onlyMonth !== undefined && month !== onlyMonth) continue;
    for (let day = 1; day <= (DAYS_IN_MONTH[month - 1] ?? 31); day += 1) {
      if (onlyDay !== undefined && day !== onlyDay) continue;
      dates.push([month, day]);
    }
  }

  console.log(`${dates.length} date${dates.length === 1 ? "" : "s"}`);

  const results: DateResult[] = [];
  for (const [month, day] of dates) {
    try {
      const result = await readDate(month, day, config.userAgent, thisYear);
      results.push(result);
      const flag = result.notes.length > 0 ? "  <- see report" : "";
      console.log(`${MONTHS[month - 1]} ${day}: ${result.events.length} events${flag}`);
      if (print) {
        for (const event of result.events) console.log(`  ${event.year}  ${event.description}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ month, day, events: [], sourceUrl: "", notes: [`${MONTHS[month - 1]} ${day}: ${message}`] });
      console.log(`${MONTHS[month - 1]} ${day}: failed, ${message}`);
    }
    // Wikipedia asks for a considerate rate.
    await sleep(250);
  }

  const rows = results.flatMap((result) =>
    result.events.map((event) => ({
      event_month: result.month,
      event_day: result.day,
      event_year: event.year,
      description: event.description,
      source_url: result.sourceUrl,
      content_license: LICENSE,
      fingerprint: fingerprint(result.month, result.day, event),
    })),
  );

  console.log("");
  console.log(`${rows.length} events across ${results.length} dates`);

  const problems = results.flatMap((result) => result.notes);
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

  const written = await upsertHistoricalEvents(rows, config.supabaseUrl, config.serviceRoleKey);
  console.log(`wrote ${written} rows`);
}

if (process.argv[1]?.endsWith("import-events.js")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
