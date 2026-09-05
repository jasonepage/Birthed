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
import { monthlyViewsFor, titleSegment } from "./pageviews.js";
import { notabilityScore } from "./notability.js";
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
      const segment = titleSegment(person.articleUrl);
      const monthlyViews = segment ? views.get(segment) ?? 0 : 0;
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
        enwiki_title: segment,
        monthly_views: monthlyViews,
        has_social: person.hasSocial,
        notability_score: notabilityScore({
          monthlyViews,
          birthYear: person.birthYear,
          isLiving: person.isLiving,
          hasSocial: person.hasSocial,
        }),
        source_url: `https://www.wikidata.org/wiki/${person.qid}`,
        content_license: WIKIDATA_LICENSE,
      };
    })
    .sort((a, b) => b.notability_score - a.notability_score)
    .slice(0, maxPerDay);
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

  // Pageviews cost one request each, so only the strongest candidates by
  // coverage are looked up. This is a real bias, accepted for cost: somebody
  // with an English article and almost no language editions can be cut before
  // their pageviews are ever consulted. Raise IMPORT_CANDIDATE_CAP to widen it.
  const candidates = [...everyone]
    .sort((a, b) => b.sitelinks - a.sitelinks)
    .slice(0, config.candidateCap);

  const segments = candidates
    .map((person) => titleSegment(person.articleUrl))
    .filter((segment): segment is string => segment !== null);

  const views = await monthlyViewsFor(segments, config.userAgent);
  const rows = toRows(candidates, views, month, day, config.maxPerDay);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log(
    `${month}/${day}: ${everyone.length} with an English article, ` +
      `looked up ${segments.length}, keeping the top ${rows.length} (${elapsed}s)`,
  );

  if (opts.print) {
    for (const [index, row] of rows.slice(0, 15).entries()) {
      const marks = [row.has_social ? "social" : null, row.is_living ? null : "died"]
        .filter(Boolean)
        .join(" ");
      console.log(
        `  ${String(index + 1).padStart(2)}. ${row.name} (${row.birth_year ?? "?"})  ` +
          `${row.monthly_views.toLocaleString()} views a month  ${marks}` +
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
