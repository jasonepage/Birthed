// The one-time backfill across all 366 calendar dates.
//
//   node dist/src/import-all.js
//   node dist/src/import-all.js --only-missing              # resume where it stopped
//   node dist/src/import-all.js --only-missing --at-once 3  # three dates in flight
//   node dist/src/import-all.js --from 7 --pause 500
//
// --only-missing asks the database which dates already have people and skips
// them, so a run that dies in July picks up in July instead of starting again
// in January.

import { loadConfig, loadDotEnv } from "./config.js";
import { importDay } from "./import-day.js";

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const ENOUGH = 10; // FR-022 wants at least ten people on a date

function argValue(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const parsed = Number(process.argv[index + 1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ImportedDay {
  birth_month: number;
  birth_day: number;
  people: number;
  scored: number;
  scored_multiword: number;
}

/**
 * Which dates are actually finished, in one request.
 *
 * Twice now a date has looked finished and been wrong, and both times this
 * check was the thing protecting it, which is worth saying plainly: the flag
 * meant to finish the job is the easiest place in this worker to hide bad
 * data, because a skipped date produces no output at all.
 *
 * First it was dates with people but no pageviews, imported before ranking
 * existed. They have their full ten, ordered by how many languages have an
 * article, which is coverage rather than attention and fills a page with
 * footballers.
 *
 * Then it was dates whose pageviews were fetched by the version that matched
 * Wikipedia's answers to the wrong key. Those have scored rows, so they passed
 * the first fix, and every scored row is somebody whose article title happens
 * to be one word.
 *
 * So finished now means enough people, and at least one of them both carries
 * pageviews and has a space in their name. On a date that imported correctly,
 * some of the ten most looked up people do.
 */
async function alreadyDone(url: string, key: string): Promise<Set<string>> {
  const response = await fetch(`${url}/rest/v1/rpc/imported_days`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: "{}",
  });
  if (!response.ok) {
    console.warn(`  could not read what is already imported (${response.status}), doing everything`);
    return new Set();
  }
  const rows = (await response.json()) as ImportedDay[];
  return new Set(
    rows
      .filter((row) => row.people >= ENOUGH && row.scored_multiword > 0)
      .map((row) => `${row.birth_month}/${row.birth_day}`),
  );
}

async function main(): Promise<void> {
  await loadDotEnv();
  const config = loadConfig({ needsWrite: true });

  const startMonth = argValue("from", 1);
  const pauseMs = argValue("pause", 400);
  const onlyMissing = process.argv.includes("--only-missing");

  const done = onlyMissing
    ? await alreadyDone(config.supabaseUrl, config.serviceRoleKey)
    : new Set<string>();
  if (onlyMissing) console.log(`${done.size} dates are done and correctly ranked, skipping those.\n`);

  let kept = 0;
  let skipped = 0;
  let finished = 0;
  const failures: string[] = [];
  const started = Date.now();

  const todo: { month: number; day: number }[] = [];
  for (let month = startMonth; month <= 12; month++) {
    const days = DAYS_IN_MONTH[month - 1] ?? 31;
    for (let day = 1; day <= days; day++) {
      if (done.has(`${month}/${day}`)) {
        skipped++;
        continue;
      }
      todo.push({ month, day });
    }
  }
  console.log(`${todo.length} dates to do.\n`);

  // Most of a date is spent waiting: one query to Wikidata, four to
  // Wikipedia, one write. Doing three dates at once cuts a three hour backfill
  // to about one, and the ceiling is there because the other end of this is a
  // volunteer-funded query service and six parallel callers is where being a
  // good guest ends. Rate limiting is already retried, so a burst that is too
  // much slows down rather than failing.
  const atOnce = Math.max(1, Math.min(argValue("at-once", 1), 6));
  if (atOnce > 1) console.log(`${atOnce} at a time.\n`);

  // Shared cursor. Safe without a lock because there is no await between
  // reading it and moving it on, and JavaScript runs one thing at a time.
  let cursor = 0;

  const runners = Array.from({ length: atOnce }, async () => {
    for (;;) {
      const date = todo[cursor];
      cursor += 1;
      if (date === undefined) return;

      try {
        const result = await importDay(date.month, date.day, { dryRun: false, print: false });
        kept += result.kept;
      } catch (error: unknown) {
        failures.push(`${date.month}/${date.day}`);
        console.error(`  ${date.month}/${date.day} failed: ${error instanceof Error ? error.message : error}`);
      }
      finished += 1;
      if (finished % 10 === 0 || finished === todo.length) {
        const minutes = (Date.now() - started) / 60000;
        const rate = finished / Math.max(minutes, 0.01);
        const left = Math.round((todo.length - finished) / Math.max(rate, 0.01));
        console.log(`  [${finished} of ${todo.length}] about ${left} minutes left`);
      }
      await sleep(pauseMs);
    }
  });
  await Promise.all(runners);

  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\nfinished in ${minutes} minutes. rows kept ${kept}, skipped ${skipped}.`);
  if (failures.length > 0) {
    console.log(`dates that failed: ${failures.join(", ")}`);
    console.log("run again with --only-missing to pick them up.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
