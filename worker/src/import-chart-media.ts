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
import { pickMatch, primaryArtist, realNames, type Match, type StoreResult } from "./media.js";

/** Apple allows about twenty a minute. This is a shade under. */
const GAP_MS = 3_200;

interface Title {
  chart_name: string;
  song: string;
  artist: string;
  year: number;
}

interface ChartSpec {
  name: string;
  /**
   * Apple's media type, and it is not optional however much it looks it.
   *
   * The search endpoint defaults media to music, and an entity that does not
   * belong to the media type is not an error, it is zero results. So the first
   * films run asked for movies inside music and came back with nothing at all
   * for forty titles in a row, which reads exactly like a catalogue that does
   * not carry them.
   */
  media: string;
  entity: string;
  wantTrack: boolean;
  attribute: string;
  /**
   * How far from the chart year a release may be dated. Only films need one,
   * for the reason written over `maxYearsAway` in media.ts: their rows carry
   * no artist, so the title is the only thing standing between a 1997 blockbuster
   * and a documentary about it made twenty years later.
   */
  maxYearsAway?: number;
}

const CHARTS: Record<string, ChartSpec> = {
  songs: { name: "Billboard Hot 100", media: "music", entity: "song", wantTrack: true, attribute: "songTerm" },
  albums: { name: "Billboard 200", media: "music", entity: "album", wantTrack: false, attribute: "albumTerm" },
  // A film is a track in Apple's catalogue, not a collection: the title is in
  // trackName and the poster is the track's artwork. previewUrl on one of
  // these is a trailer, which is why nothing plays it.
  films: {
    name: "US box office", media: "movie", entity: "movie",
    wantTrack: true, attribute: "movieTerm", maxYearsAway: 2,
  },
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

/**
 * One search. `attribute` restricts which field the term is matched against.
 *
 * The second pass exists because of a failure the first live run showed and
 * no matching rule could have fixed. "Music" by Playboi Carti and "Mayhem" by
 * Lady Gaga are both real albums that Apple holds, and searching for the title
 * and the artist together returned neither, because a one word title against a
 * large catalogue of that artist's other work is a hard query for a relevance
 * engine. Nothing was wrong with the answer; the right row was never in it.
 *
 * So a miss is retried against the album or song field alone, where the title
 * is the only thing being ranked, and the artist check then does the work of
 * telling the real one from everybody else who named a record Music.
 */
async function search(title: Title, spec: ChartSpec, attribute?: string): Promise<StoreResult[]> {
  const query = new URLSearchParams({
    // A blank artist is every box office row, and joining a title to nothing
    // leaves a trailing space that helps no relevance engine.
    term: attribute ? title.song : `${title.song} ${title.artist}`.trim(),
    media: spec.media,
    entity: spec.entity,
    country: "US",
    // 12 was too few. Raising it costs the same single request and it is the
    // cheapest half of the retrieval problem above.
    limit: "25",
  });
  if (attribute) query.set("attribute", attribute);
  const response = await fetch(`https://itunes.apple.com/search?${query}`, {
    headers: { "User-Agent": "Birthed/0.1 (https://birthed.app)" },
  });
  // 403 is the rate limiter. Waiting it out is the only correct response, and
  // a run that ignored it would fill the table with empty refusals.
  if (response.status === 403 || response.status === 429) {
    await sleep(30_000);
    return search(title, spec, attribute);
  }
  if (!response.ok) return [];
  const body = (await response.json()) as { results?: StoreResult[] };
  return body.results ?? [];
}

/**
 * The third and last look, and it asks the opposite question.
 *
 * Passes one and two both search for the title and get back everything in the
 * catalogue named that. When the title is a common word and the artist is
 * not, that is the wrong way round. Searching for Drones returns meditation
 * recordings and a channel called Moon Muse, and Muse's own album is nowhere
 * in the first twenty five. Searching for Muse returns Muse, and Drones is
 * sitting in the results.
 *
 * Two hundred is the most Apple will return. An artist with a long catalogue
 * and a lot of compilations can still push the wanted record past it, which
 * is a real limit and not a bug to chase.
 *
 * Only titles that have already failed twice pay for this, and only when the
 * credit names somebody. Asking for an artist called Soundtrack is a wasted
 * request.
 */
async function searchByArtist(title: Title, spec: ChartSpec): Promise<StoreResult[]> {
  const named = realNames(primaryArtist(title.artist));
  if (named === "") return [];

  const query = new URLSearchParams({
    term: named,
    media: spec.media,
    entity: spec.entity,
    country: "US",
    attribute: "artistTerm",
    limit: "200",
  });
  const response = await fetch(`https://itunes.apple.com/search?${query}`, {
    headers: { "User-Agent": "Birthed/0.1 (https://birthed.app)" },
  });
  if (response.status === 403 || response.status === 429) {
    await sleep(30_000);
    return searchByArtist(title, spec);
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
      let results = await search(title, spec);
      let match = pickMatch(results, title.song, title.artist, title.year, spec.wantTrack, spec.maxYearsAway);

      // Only the misses pay for the second request, which is about a quarter
      // of them, so the whole backfill grows by roughly a quarter rather than
      // doubling.
      if (!match) {
        await sleep(GAP_MS);
        const second = await search(title, spec, spec.attribute);
        const retry = pickMatch(second, title.song, title.artist, title.year, spec.wantTrack, spec.maxYearsAway);
        if (retry) {
          match = retry;
          results = second;
        }
      }

      // Still nothing, so ask for the artist rather than the title.
      if (!match) {
        await sleep(GAP_MS);
        const third = await searchByArtist(title, spec);
        const retry = pickMatch(third, title.song, title.artist, title.year, spec.wantTrack, spec.maxYearsAway);
        if (retry) {
          match = retry;
          results = third;
        } else if (third.length > 0 && results.length === 0) {
          // Nothing to show from the first search but the artist has a
          // catalogue, which is worth seeing in the refusal line: it says the
          // artist was found and the record was not, rather than nothing at
          // all was found.
          results = third;
        }
      }

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
