// Backfills the number one song, week by week, from 1959 to now.
//
//   node dist/src/import-hot100.js
//   node dist/src/import-hot100.js --from 1990 --to 1999
//   node dist/src/import-hot100.js --dry          # parse and report, write nothing
//
// Kept as its own entry point because the deploy and the README call it.
// The work lives in import-charts.ts now, which reads the albums and the
// films the same way.

import { SONGS } from "./charts.js";
import { runImport } from "./import-charts.js";

runImport(SONGS).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
