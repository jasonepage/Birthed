// Imports the notable people born on one calendar date.
//
//   node dist/src/import-day.js            # today
//   node dist/src/import-day.js 9 4        # September 4
//   node dist/src/import-day.js 9 4 --dry-run --print
//
// Two passes. Wikidata answers who was born on the date and whether anybody
// keeps a social account for them. English Wikipedia answers how many people
// actually look them up, which is the thing that decides the order.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadConfig, loadDotEnv } from "./config.js";
import { fetchPeopleBornOn, type WikidataPerson } from "./wikidata.js";
import { monthlyViewsForTitles, titleFromArticleUrl } from "./pageviews.js";
import { notabilityScore, selectCandidates, signals } from "./notability.js";
import { upsertNotablePeople, type NotablePersonRow } from "./upsert.js";

const WIKIDATA_LICENSE = "CC0-1.0";

export function toRows(
  people: WikidataPerson[],
  views: Map<string, number>,
  month: number,
  day: number,
  maxPerDay: number,
): NotablePersonRow[] {
  return people
    .map((person) => {
      const title = titleFromArticleUrl(person.articleUrl);
      const monthlyViews = title ? views.get(title) ?? 0 : 0;
      return {
        wikidata_qid: person.qid,
        name: person.name,
        birth_month: month,
        birth_day: day,
        birth_year: person.birthYear,
        death_year: person.deathYear,
        short_description: person.shortDescription,
        birth_precision: person.precision,
        sitelink_count: person.sitelinks,
        is_living: person.isLiving,
        enwiki_title: title,
        monthly_views: monthlyViews,
        has_social: person.hasSocial,
        notability_score: notabilityScore({
          monthlyViews,
          birthYear: person.birthYear,
          isLiving: person.isLiving,
          hasSocial: person.hasSocial,
          description: person.shortDescription,
        }),
        source_url: `https://www.wikidata.org/wiki/${person.qid}`,
        content_license: WIKIDATA_LICENSE,
      };
    })
    .sort((a, b) => b.notability_score - a.notability_score)
    .slice(0, maxPerDay);
}

/**
 * Whether a date's rows look like the pageview lookup silently failed.
 *
 * This exists because it did, for hours, and nothing looked wrong while it
 * happened. A zero is not an error: it reads as somebody nobody looks up. So
 * the whole failure was invisible, and the only symptom was that the ranking
 * quietly filled with people who happen to have one-word article titles.
 *
 * The check is the shape of that failure rather than a guess at a threshold.
 * On any real date, some of the most looked up people have a space in their
 * name. If none of the ones with a reading do, the readings were matched to
 * the wrong key.
 */
export function pageviewLookupLooksBroken(rows: NotablePersonRow[]): boolean {
  if (rows.length < 5) return false;
  const scored = rows.filter((row) => row.monthly_views > 0);
  if (scored.length === 0) return false;
  return !scored.some((row) => (row.enwiki_title ?? "").includes("_"));
}

export async function importDay(
  month: number,
  day: number,
  opts: { dryRun: boolean; print: boolean },
): Promise<{ fetched: number; kept: number }> {
  const config = loadConfig({ needsWrite: !opts.dryRun });

  const started = Date.now();
  const everyone = await fetchPeopleBornOn(month, day, {
    yearFrom: config.yearFrom,
    yearTo: config.yearTo,
    minSitelinks: config.minSitelinks,
    userAgent: config.userAgent,
  });

  // Pageviews cost one request each, so not everybody can be looked up.
  // Internet people are always looked up regardless of how few languages cover
  // them, because picking candidates by coverage was what hid them. See
  // selectCandidates.
  const candidates = selectCandidates(everyone, config.candidateCap);

  const titles = candidates
    .map((person) => titleFromArticleUrl(person.articleUrl))
    .filter((title): title is string => title !== null);

  const views = await monthlyViewsForTitles(titles, config.userAgent);
  const rows = toRows(candidates, views, month, day, config.maxPerDay);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log(
    `${month}/${day}: ${everyone.length} with an English article, ` +
      `looked up ${titles.length}, keeping the top ${rows.length} (${elapsed}s)`,
  );

  if (pageviewLookupLooksBroken(rows)) {
    console.warn(
      `  WARNING ${month}/${day}: everybody with a reading has a one-word article title. ` +
        `The pageview lookup is matching the wrong key and this date will be ranked on nothing.`,
    );
  }

  if (opts.print) {
    for (const [index, row] of rows.slice(0, 15).entries()) {
      const marks = signals({
        monthlyViews: row.monthly_views,
        birthYear: row.birth_year,
        isLiving: row.is_living,
        hasSocial: row.has_social,
        description: row.short_description,
      }).join(" ");
      console.log(
        `  ${String(index + 1).padStart(2)}. ${row.name} (${row.birth_year ?? "?"})  ` +
          `${row.monthly_views.toLocaleString()} views  score ${row.notability_score.toLocaleString()}  ${marks}` +
          (row.short_description ? `\n      ${row.short_description}` : ""),
      );
    }
  }

  if (!opts.dryRun && rows.length > 0) {
    const written = await upsertNotablePeople(rows, config.supabaseUrl, config.serviceRoleKey);
    console.log(`  upserted ${written} rows`);
  } else if (opts.dryRun) {
    console.log("  dry run, nothing written");
  }

  return { fetched: everyone.length, kept: rows.length };
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

  await importDay(month, day, {
    dryRun: args.includes("--dry-run"),
    print: args.includes("--print"),
  });
}

// Only run when this file is the entry point, so that import-all.ts can
// import importDay without tripping the command line path.
function isEntryPoint(): boolean {
  const argv = process.argv[1];
  if (argv === undefined) return false;
  try {
    return realpathSync(argv) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
