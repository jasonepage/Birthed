// One tick of the wall, for the schedule in render.yaml: the history seeder,
// the news seeder and then the checker, every quarter hour.
//
//   node dist/src/wall/tick.js
//
// The news lands first so the checker can read the new pages in the same
// run. Either half failing is reported and does not stop the other, because
// a feed that is down is no reason to leave yesterday's quotations
// unchecked, and a page that will not answer is no reason to skip today's
// news. The close job, session three, will run here too.

import { loadConfig, loadDotEnv } from "../config.js";
import { run as check } from "./check.js";
import type { Db } from "./db.js";
import { run as history } from "./history.js";
import { run as news } from "./news.js";

async function main(): Promise<void> {
  await loadDotEnv();
  const config = loadConfig({ needsWrite: true });
  const db: Db = { url: config.supabaseUrl, key: config.serviceRoleKey };
  let failed = false;

  // The date's own history first, so a wall opens looking like the date and
  // its picks take the first tiles ahead of the feeds.
  try {
    await history(db);
  } catch (error: unknown) {
    failed = true;
    console.error(`wall history failed: ${error instanceof Error ? error.message : error}`);
  }
  try {
    await news(db, { userAgent: config.userAgent });
  } catch (error: unknown) {
    failed = true;
    console.error(`wall news failed: ${error instanceof Error ? error.message : error}`);
  }
  try {
    await check(db, { userAgent: config.userAgent });
  } catch (error: unknown) {
    failed = true;
    console.error(`wall check failed: ${error instanceof Error ? error.message : error}`);
  }
  if (failed) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
