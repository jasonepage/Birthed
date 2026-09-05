// The one-time backfill across all 366 calendar dates.
//
//   node dist/src/import-all.js
//   node dist/src/import-all.js --only-missing    # resume where it stopped
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

interface ImportedDay { birth_month: number; birth_day: number; people: number }

/** Which dates already have enough people, in one request. */
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
    rows.filter((row) => row.people >= ENOUGH).map((row) => `${row.birth_month}/${row.birth_day}`),
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
  if (onlyMissing) console.log(`${done.size} dates already have people, skipping those.\n`);

  let kept = 0;
  let skipped = 0;
  const failures: string[] = [];
  const started = Date.now();

  for (let month = startMonth; month <= 12; month++) {
    const days = DAYS_IN_MONTH[month - 1] ?? 31;
    for (let day = 1; day <= days; day++) {
      if (done.has(`${month}/${day}`)) {
        skipped++;
        continue;
      }
      try {
        const result = await importDay(month, day, { dryRun: false, print: false });
        kept += result.kept;
      } catch (error: unknown) {
        failures.push(`${month}/${day}`);
        console.error(`  ${month}/${day} failed: ${error instanceof Error ? error.message : error}`);
      }
      await sleep(pauseMs);
    }
  }

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
