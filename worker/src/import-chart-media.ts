// Fills in the cover and the thirty second preview for every chart title.
//
//   node dist/src/import-chart-media.js --dry --limit 40    # look, write nothing
//   node dist/src/import-chart-media.js --chart songs
//   node dist/src/import-chart-media.js                     # everything left
//
// **Run it dry first and read the refusals, not the matches.** A wrong match
// is a karaoke recording playing on somebody's birthday under the claim that
// it was number one the week they were born, and this product's whole promise
// is that it does not lie. The matching rule, and the two bugs it has already
// had, are in media.ts.
//
// Work is per distinct title, not per row. The same song is number one for
// several weeks running, so 6,804 chart weeks are about 2,450 lookups, and the
// answer for one title is written to every week that shares it.
//
// About twenty calls a minute is what Apple's search endpoint allows, so the
// whole backfill is roughly two hours. It is safe to stop and restart: a title
// with matched_at set is never looked up again, whether it matched or not.

import { loadConfig, loadDotEnv } from "./config.js";
import { pickMatch, type Match, type StoreResult } from "./media.js";

/** Apple allows about twenty a minute. This is a shade under. */
const GAP_MS = 3_200;

interface Title {
  chart_name: string;
  song: string;
  artist: string;
  year: number;
}

const CHARTS: Record<string, { name: string; entity: string; wantTrack: boolean }> = {
  songs: { name: "Billboard Hot 100", entity: "song", wantTrack: true },
  albums: { name: "Billboard 200", entity: "album", wantTrack: false },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? undefined : process.argv[index + 1];
}

/**
 * Every title still unlooked at, newest first.
 *
 * Newest first on purpose: Apple's catalogue is densest for recent decades, so
 * a run stopped early has still filled in the years most readers were born in.
 */
async function unmatchedTitles(chartName: string, url: string, key: string): Promise<Title[]> {
  const query = new URLSearchParams({
    select: "chart_name,song,artist,chart_date",
    chart_name: `eq.${chartName}`,
    matched_at: "is.null",
    order: "chart_date.desc",
  });
  const response = await fetch(`${url}/rest/v1/chart_weeks?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`reading chart_weeks failed: ${response.status} ${await response.text()}`);
  }
  const rows = (await response.json()) as {
    chart_name: string; song: string; artist: string; chart_date: string;
  }[];

  const seen = new Set<string>();
  const titles: Title[] = [];
  for (const row of rows) {
    const identity = `${row.song} ${row.artist}`.toLowerCase();
    if (seen.has(identity)) continue;
    seen.add(identity);
    titles.push({
      chart_name: row.chart_name,
      song: row.song,
      artist: row.artist,
      year: Number(row.chart_date.slice(0, 4)),
    });
  }
  return titles;
}

async function search(title: Title, entity: string): Promise<StoreResult[]> {
  const query = new URLSearchParams({
    term: `${title.song} ${title.artist}`,
    entity,
    country: "US",
    limit: "12",
  });
  const response = await fetch(`https://itunes.apple.com/search?${query}`, {
    headers: { "User-Agent": "Birthed/0.1 (https://birthed.app)" },
  });
  // 403 is the rate limiter. Waiting it out is the only correct response, and
  // a run that ignored it would fill the table with empty refusals.
  if (response.status === 403 || response.status === 429) {
    await sleep(30_000);
    return search(title, entity);
  }
  if (!response.ok) return [];
  const body = (await response.json()) as { results?: StoreResult[] };
  return body.results ?? [];
}

/**
 * The answer, written to every week that shares this title.
 *
 * matched_at is set whether or not anything was found, which is what stops a
 * refusal being retried on every future run. A row with matched_at set and
 * preview_url null was looked at and honestly came up empty.
 */
async function writeMatch(title: Title, match: Match | null, url: string, key: string): Promise<void> {
  const query = new URLSearchParams({
    chart_name: `eq.${title.chart_name}`,
    song: `eq.${title.song}`,
    artist: `eq.${title.artist}`,
  });
  const response = await fetch(`${url}/rest/v1/chart_weeks?${query}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      preview_url: match?.previewUrl ?? null,
      artwork_url: match?.artworkUrl ?? null,
      store_url: match?.storeUrl ?? null,
      matched_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) {
    throw new Error(`writing ${title.song} failed: ${response.status} ${await response.text()}`);
  }
}

async function main(): Promise<void> {
  const dry = process.argv.includes("--dry");
  const limit = Number(arg("limit") ?? "0");
  const only = arg("chart");
  await loadDotEnv();
  const config = loadConfig({ needsWrite: !dry });

  const keys = only ? [only] : Object.keys(CHARTS);
  let matched = 0;
  let refused = 0;

  for (const key of keys) {
    const spec = CHARTS[key];
    if (!spec) {
      console.log(`Unknown chart "${key}". Known: ${Object.keys(CHARTS).join(", ")}`);
      process.exitCode = 1;
      return;
    }

    let titles = await unmatchedTitles(spec.name, config.supabaseUrl, config.serviceRoleKey);
    if (limit > 0) titles = titles.slice(0, limit);
    console.log(`\n${spec.name}: ${titles.length} titles to look up.\n`);

    for (const title of titles) {
      const results = await search(title, spec.entity);
      const match = pickMatch(results, title.song, title.artist, title.year, spec.wantTrack);

      if (match) {
        matched += 1;
        console.log(`ok    ${title.year}  ${title.song} / ${title.artist}${match.previewUrl ? "  [audio]" : ""}`);
      } else {
        refused += 1;
        // The refusals are what a person has to read. A run that printed only
        // its successes would look perfect while quietly deciding that a
        // hundred birthdays get no song.
        const near = results.slice(0, 2)
          .map((r) => `${r.trackName ?? r.collectionName} / ${r.artistName}`)
          .join(" | ");
        console.log(`MISS  ${title.year}  ${title.song} / ${title.artist}${near ? `   saw: ${near}` : "   saw nothing"}`);
      }

      if (!dry) await writeMatch(title, match, config.supabaseUrl, config.serviceRoleKey);
      await sleep(GAP_MS);
    }
  }

  const total = matched + refused;
  const rate = total === 0 ? 0 : Math.round((matched / total) * 100);
  console.log(`\n${matched} matched, ${refused} refused, ${rate} percent.`);
  console.log(dry ? "Dry run, nothing written." : "Written.");
}

if (process.argv[1] && process.argv[1].endsWith("import-chart-media.js")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
