// Imports the notable works published on one calendar date.
//
//   node dist/src/import-culture.js            # today
//   node dist/src/import-culture.js 9 7        # September 7
//   node dist/src/import-culture.js 9 7 --dry-run --print
//
// Two passes, the same two the people importer makes. Wikidata answers what
// was published on the date. English Wikipedia answers how many people look it
// up, which is what decides the order when there are more than a page can
// hold. See import-day.ts, which this deliberately mirrors.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadConfig, loadDotEnv } from "./config.js";
import { fetchWorksPublishedOn, titleFor, type DatedWork } from "./culture.js";
import { monthlyViewsForTitles, titleFromArticleUrl } from "./pageviews.js";
import { isAdultContent, isViolentNotoriety } from "./notability.js";
import { upsertCulturalEvents, type CulturalEventRow } from "./upsert.js";

/** Works published before this are not what this table is for. */
const FIRST_YEAR = 1900;

/**
 * How many rows one date keeps.
 *
 * A date page draws a handful and holds the rest in a drawer, so this is not a
 * display limit, it is a limit on how much of Wikidata's long tail is worth
 * storing. Twelve is roughly the point where the ranking stops being able to
 * tell one row from the next.
 */
const MAX_PER_DAY = 12;

/**
 * Ranked the way the almanac ranks people, and for the same reason.
 *
 * Sitelinks measure how many languages wrote about a thing, which is the
 * closest thing to a vote on whether it lasted. Pageviews measure who is being
 * looked up now. Either alone is wrong here in a way that shows: sitelinks
 * alone fills a date with obscure European releases, and views alone fills it
 * with whatever came out this year. The product of one and the square root of
 * the other keeps a thing that is both widely covered and actually read.
 */
export function score(work: DatedWork, monthlyViews: number): number {
  // The floor of one is not cosmetic. A pageview lookup that fails answers
  // zero, and zero is indistinguishable from an article nobody reads, so a
  // date where the lookup failed would multiply every row to zero and rank
  // them in whatever order they arrived in. That is not hypothetical: 7,525
  // of the 25,741 rows in notable_people carry a zero today, and the comment
  // in pageviews.ts about how invisible that failure is was written after it
  // had already happened once. With the floor, a date with no view data at all
  // falls back to ranking on coverage, which is a worse answer and still an
  // answer.
  return Math.round(work.sitelinks * Math.sqrt(Math.max(1, monthlyViews)));
}

export function toRows(
  works: DatedWork[],
  views: Map<string, number>,
  maxPerDay = MAX_PER_DAY,
): CulturalEventRow[] {
  const screened = works.filter((work) => {
    // The same two screens the people importer applies, against the same
    // Wikidata one line description, because the reason is the same: this is
    // the sentence somebody reads on their birthday morning. A film whose
    // description says what it is gets caught here. One whose description does
    // not is a gap, which is written up in notability.ts and is a floor rather
    // than a solution.
    if (isAdultContent(work.description)) return false;
    if (isViolentNotoriety(work.description)) return false;
    return true;
  });

  return screened
    .map((work) => {
      const title = titleFromArticleUrl(work.articleUrl);
      const monthlyViews = title ? views.get(title) ?? 0 : 0;
      return { work, ranked: score(work, monthlyViews) };
    })
    .sort((a, b) => b.ranked - a.ranked)
    .slice(0, maxPerDay)
    .map(({ work }) => ({
      event_date: `${work.year}-${String(work.month).padStart(2, "0")}-${String(work.day).padStart(2, "0")}`,
      category: work.category,
      event_title: titleFor(work),
      // Null on purpose. An imported row has a title and a date and nothing
      // else, and a sentence generated to fill the column would be the
      // encyclopedia voice this table exists to get away from, on every row.
      context_string: null,
      source_url: `https://www.wikidata.org/wiki/${work.qid}`,
      origin: "imported",
    }));
}

export async function importCulture(
  month: number,
  day: number,
  opts: { dryRun: boolean; print: boolean },
): Promise<{ fetched: number; kept: number }> {
  const config = loadConfig({ needsWrite: !opts.dryRun });
  const started = Date.now();

  const works = await fetchWorksPublishedOn(month, day, {
    yearFrom: FIRST_YEAR,
    yearTo: new Date().getUTCFullYear(),
    minSitelinks: config.minSitelinks,
    userAgent: config.userAgent,
  });

  const titles = works
    .map((work) => titleFromArticleUrl(work.articleUrl))
    .filter((title): title is string => title !== null);
  const views = await monthlyViewsForTitles(titles, config.userAgent);

  const rows = toRows(works, views);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log(
    `${month}/${day}: ${works.length} published with an English article, keeping ${rows.length} (${elapsed}s)`,
  );

  if (opts.print) {
    for (const [index, row] of rows.entries()) {
      console.log(`  ${String(index + 1).padStart(2)}. ${row.event_date}  [${row.category}]  ${row.event_title}`);
    }
  }

  if (!opts.dryRun && rows.length > 0) {
    const written = await upsertCulturalEvents(rows, config.supabaseUrl, config.serviceRoleKey);
    console.log(`  upserted ${written} rows`);
  } else if (opts.dryRun) {
    console.log("  dry run, nothing written");
  }

  return { fetched: works.length, kept: rows.length };
}

async function main(): Promise<void> {
  await loadDotEnv();
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--")).map(Number);
  const now = new Date();
  const month = positional[0] ?? now.getMonth() + 1;
  const day = positional[1] ?? now.getDate();

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Month must be 1 through 12, got ${month}`);
  }
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`Day must be 1 through 31, got ${day}`);
  }

  await importCulture(month, day, {
    dryRun: args.includes("--dry-run"),
    print: args.includes("--print"),
  });
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
