// Imports the notable people born on one calendar date.
//
//   node --experimental-strip-types src/import-day.ts            # today
//   node --experimental-strip-types src/import-day.ts 9 4        # September 4
//   node --experimental-strip-types src/import-day.ts 9 4 --dry-run --print
//
// Slice 1 of the build order in SDS.md section 16.

import { join } from "node:path";
import { loadConfig, loadDotEnv } from "./config.ts";
import { fetchPeopleBornOn, type WikidataPerson } from "./wikidata.ts";
import { notabilityScore } from "./notability.ts";
import { upsertNotablePeople, type NotablePersonRow } from "./upsert.ts";

const WIKIDATA_LICENSE = "CC0-1.0";

export function toRows(
  people: WikidataPerson[],
  month: number,
  day: number,
  maxPerDay: number,
): NotablePersonRow[] {
  return people
    .map((person) => ({
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
      notability_score: notabilityScore({
        sitelinks: person.sitelinks,
        birthYear: person.birthYear,
        isLiving: person.isLiving,
      }),
      source_url: `https://www.wikidata.org/wiki/${person.qid}`,
      content_license: WIKIDATA_LICENSE,
    }))
    .sort((a, b) => b.notability_score - a.notability_score)
    .slice(0, maxPerDay);
}

export async function importDay(
  month: number,
  day: number,
  opts: { dryRun: boolean; print: boolean },
): Promise<{ fetched: number; kept: number }> {
  const config = loadConfig();

  const started = Date.now();
  const people = await fetchPeopleBornOn(month, day, {
    yearFrom: config.yearFrom,
    yearTo: config.yearTo,
    minSitelinks: config.minSitelinks,
    userAgent: config.userAgent,
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const rows = toRows(people, month, day, config.maxPerDay);

  console.log(
    `${month}/${day}: matched ${people.length} people in ${elapsed}s, keeping the top ${rows.length}`,
  );

  if (opts.print) {
    for (const [index, row] of rows.slice(0, 15).entries()) {
      const years = `${row.birth_year ?? "?"}${row.death_year ? " to " + row.death_year : ""}`;
      console.log(
        `  ${String(index + 1).padStart(2)}. ${row.name} (${years})  score ${row.notability_score}  sitelinks ${row.sitelink_count}` +
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

  return { fetched: people.length, kept: rows.length };
}

async function main(): Promise<void> {
  await loadDotEnv(join(import.meta.dirname, "..", ".env"));

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

if (import.meta.filename === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
