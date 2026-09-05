// The one-time backfill across all 366 calendar dates, paced so the query
// service is not hammered. This is open technical question 1 in SDS.md
// section 17: if the paced run turns out to be too slow or gets throttled, the
// fallback is a Wikidata database dump.
//
//   node --experimental-strip-types src/import-all.ts
//   node --experimental-strip-types src/import-all.ts --from 9 --pause 3000

import { loadDotEnv } from "./config.js";
import { importDay } from "./import-day.js";

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function argValue(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const raw = process.argv[index + 1];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  await loadDotEnv();

  const startMonth = argValue("from", 1);
  const pauseMs = argValue("pause", 2000);

  let totalKept = 0;
  let failures = 0;

  for (let month = startMonth; month <= 12; month++) {
    const days = DAYS_IN_MONTH[month - 1] ?? 31;
    for (let day = 1; day <= days; day++) {
      try {
        const result = await importDay(month, day, { dryRun: false, print: false });
        totalKept += result.kept;
      } catch (error: unknown) {
        failures++;
        console.error(`  ${month}/${day} failed: ${error instanceof Error ? error.message : error}`);
      }
      await sleep(pauseMs);
    }
  }

  console.log(`\nbackfill finished. rows kept ${totalKept}, dates that failed ${failures}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
