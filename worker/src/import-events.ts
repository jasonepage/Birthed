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
import { count, DateEvent, parseEvents, ReadEvent } from "./events.js";
import { subjectUrl } from "./subject.js";
import { pruneHistoricalEvents, upsertHistoricalEvents } from "./upsert.js";
import { articleUrl, fetchPage, resolveRedirects } from "./wikipedia.js";

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
  events: ReadEvent[];
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
        for (const event of result.events) console.log(`  ${event.year}  ${event.description}\n        about: ${event.subject?.title ?? "(nothing named)"}${event.subject?.redirect ? " (redirect)" : ""}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ month, day, events: [], sourceUrl: "", notes: [`${MONTHS[month - 1]} ${day}: ${message}`] });
      console.log(`${MONTHS[month - 1]} ${day}: failed, ${message}`);
    }
    // Wikipedia asks for a considerate rate.
    await sleep(250);
  }

  // A subject that is a redirect is measured under the title it lands on,
  // because the pageviews service counts a redirect's own views, which are
  // close to nothing. Resolved once for the whole run, fifty titles a call.
  const redirects = results.flatMap((r) => r.events).filter((e) => e.subject?.redirect).map((e) => e.subject!.title);
  let resolved = new Map<string, string>();
  if (redirects.length > 0) {
    try {
      resolved = await resolveRedirects(redirects, config.userAgent);
      console.log(`${count(resolved.size, "redirect")} of ${new Set(redirects).size} resolved to the article they land on`);
    } catch (error: unknown) {
      // Unresolved redirects keep their own title and measure near zero, so
      // say so rather than write a number that looks like a measurement.
      console.log(`redirects could not be resolved, ${error instanceof Error ? error.message : String(error)}; those subjects keep their redirect title`);
    }
  }
  const subjectFor = (event: ReadEvent): string | null => {
    if (event.subject === null) return null;
    return subjectUrl(resolved.get(event.subject.title) ?? event.subject.title);
  };

  // One timestamp for the whole run, written onto every row. It is what tells
  // the prune below which rows this run still stands behind.
  const startedAt = new Date().toISOString();

  const rows = results.flatMap((result) =>
    result.events.map((event) => ({
      event_month: result.month,
      event_day: result.day,
      event_year: event.year,
      description: event.description,
      source_url: result.sourceUrl,
      subject_url: subjectFor(event),
      content_license: LICENSE,
      fingerprint: fingerprint(result.month, result.day, event),
      imported_at: startedAt,
    })),
  );

  console.log("");
  console.log(`${count(rows.length, "event")} across ${count(results.length, "date")}`);
  const named = rows.filter((row) => row.subject_url !== null).length;
  console.log(`${named} name the article they are about and can be measured; ${rows.length - named} name none and will not be`);

  const problems = results.flatMap((result) => result.notes);
  if (problems.length === 0) {
    console.log("nothing odd");
  } else {
    console.log("");
    console.log(`${count(problems.length, "thing")} to look at:`);
    for (const problem of problems) console.log(`  ${problem}`);
  }

  if (dry) {
    console.log("");
    console.log("dry run, wrote nothing");
    return;
  }

  const written = await upsertHistoricalEvents(rows, config.supabaseUrl, config.serviceRoleKey);
  console.log(`wrote ${written} rows`);

  // Only the dates that actually read. A date whose fetch failed keeps every
  // row it already had, because an absence proves nothing about Wikipedia and
  // everything about the network.
  const read = results.filter((result) => result.events.length > 0);
  const removed = await pruneHistoricalEvents(
    read.map((result) => ({ month: result.month, day: result.day })),
    startedAt,
    config.supabaseUrl,
    config.serviceRoleKey,
  );
  if (removed > 0) {
    console.log(`removed ${count(removed, "row")} Wikipedia no longer carries`);
  } else {
    console.log("nothing to remove");
  }
}

if (process.argv[1]?.endsWith("import-events.js")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
