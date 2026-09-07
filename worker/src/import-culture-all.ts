// Every calendar date, for the cultural table.
//
//   node dist/src/import-culture-all.js
//   node dist/src/import-culture-all.js --dry-run
//   node dist/src/import-culture-all.js --from 9 --to 10
//
// 366 queries against a volunteer funded service, so they go one at a time
// with a pause between them rather than in parallel. That is the same courtesy
// import-all.ts extends and the reason is written there: this is somebody
// else's server and there is no deadline on a backfill.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./config.js";
import { importCulture } from "./import-culture.js";

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** A courtesy gap between queries. */
const PAUSE_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  await loadDotEnv();
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const valueAfter = (flag: string): number | null => {
    const at = args.indexOf(flag);
    if (at < 0) return null;
    const raw = Number(args[at + 1]);
    return Number.isInteger(raw) ? raw : null;
  };
  const from = valueAfter("--from") ?? 1;
  const to = valueAfter("--to") ?? 12;

  let fetched = 0;
  let kept = 0;
  let failed = 0;
  const started = Date.now();

  for (let month = from; month <= to; month++) {
    for (let day = 1; day <= (DAYS_IN_MONTH[month - 1] ?? 31); day++) {
      try {
        const result = await importCulture(month, day, { dryRun, print: false });
        fetched += result.fetched;
        kept += result.kept;
      } catch (error) {
        // One date that will not answer is one thin page, not a reason to
        // abandon the other 365. It is counted and named so the run can be
        // repeated for just those dates.
        failed++;
        console.error(`  ${month}/${day} failed: ${String(error)}`);
      }
      await sleep(PAUSE_MS);
    }
  }

  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  console.log(
    `\nfetched ${fetched}, kept ${kept}, ${failed} dates failed, in ${minutes} minutes` +
      (dryRun ? " (dry run, nothing written)" : ""),
  );
}

function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
