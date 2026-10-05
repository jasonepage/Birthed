// Apple, from the server, for the song in your head. docs/the-wall.md
// section 31.
//
// Three things, and every one of them is a request this server makes so that
// no reader's browser ever asks Apple for anything:
//
//   search   Apple's song search, for the box at the top of today's page
//   chart    Apple Music's daily chart for the United States, the strip
//   covers   Apple's artwork, fetched and passed through at /cover/<track>.jpg
//
// Apple's own page says the search allows about 20 calls a minute, and every
// reader's search comes from this one server. So a phrase is answered from
// memory for ten minutes, this process makes at most SEARCH_PER_MINUTE calls
// a minute and says "busy" past that, and serve.ts holds each address to its
// own limit before any of it. A cover is kept in memory once fetched.
//
// The phrase a reader typed is never written down here or anywhere: it is a
// key in a ten minute cache in this process's memory and nothing else.

import { SONG_QUERY_MAX, artAt, collapse, parseChart, parseSearch, songsFrom, type ChartSong, type Found } from "./song-prompt.js";

const SEARCH_TTL_MS = 10 * 60_000;
const SEARCH_PER_MINUTE = 18;
const CHART_TTL_MS = 60 * 60_000;
const CHART_STALE_MS = 6 * 60 * 60_000;
const COVER_MAX_BYTES = 400_000;
const COVERS_KEPT = 400;
const ART_KEPT = 5000;
const APPLE_TIMEOUT_MS = 4000;
const USER_AGENT = "Birthed/0.1 (https://birthed.app)";

export const CHART_URL = "https://rss.marketingtools.apple.com/api/v2/us/music/most-played/10/songs.json";

/** Apple's artwork address by track, from searches, the chart and wall_songs. Bounded: the oldest go first. */
const art = new Map<string, string>();
/** What a search found, by track, so the page that follows a search without the script can draw it. */
const found = new Map<string, Found>();
const searches = new Map<string, { at: number; results: Found[] }>();
const calls: number[] = [];
let chart: { at: number; rows: ChartSong[] } | null = null;
const covers = new Map<string, { bytes: Buffer; type: string }>();

function keep<K, V>(map: Map<K, V>, key: K, value: V, limit: number): void {
  map.delete(key);
  map.set(key, value);
  while (map.size > limit) {
    const oldest = map.keys().next().value as K;
    map.delete(oldest);
  }
}

/** For tests: forget everything this module remembers. */
export function forgetApple(): void {
  art.clear(); found.clear(); searches.clear(); calls.length = 0; chart = null; covers.clear(); chartTried = -Infinity;
}

/** Remember where a track's artwork is, from any of the three places that say. */
export function rememberArt(trackId: string, url: string | null): void {
  if (url !== null && /^\d{1,18}$/.test(trackId)) keep(art, trackId, url, ART_KEPT);
}

/** Whether this process may ask Apple once more this minute, and if so, counts it. */
export function mayAskApple(now: number = Date.now()): boolean {
  while (calls.length > 0 && now - calls[0]! > 60_000) calls.shift();
  if (calls.length >= SEARCH_PER_MINUTE) return false;
  calls.push(now);
  return true;
}

/** A phrase as the cache knows it: trimmed, folded to lower case, one space between words. */
export function searchKey(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APPLE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`apple answered ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** For tests: how many phrases are held in memory. */
export function searchesHeld(): number {
  return searches.size;
}

/**
 * The songs for a phrase, one row per song, or "busy" when Apple could not
 * be asked or did not answer. A phrase under two characters or over the
 * box's limit is no songs.
 */
export async function searchSongs(q: string, now: number = Date.now()): Promise<Found[] | "busy"> {
  // The phrase is the cache's key, so an answer past its ten minutes is
  // dropped here rather than left until five hundred newer ones push it
  // out: the privacy page says it is gone after ten minutes, and it is.
  for (const [held, entry] of searches) if (now - entry.at >= SEARCH_TTL_MS) searches.delete(held);
  const key = searchKey(q);
  if (key.length < 2 || key.length > SONG_QUERY_MAX) return [];
  const held = searches.get(key);
  if (held !== undefined && now - held.at < SEARCH_TTL_MS) return held.results;
  if (!mayAskApple(now)) return "busy";
  let results: Found[];
  try {
    const query = new URLSearchParams({ term: key, media: "music", entity: "song", country: "US", limit: "25" });
    results = collapse(parseSearch(await getJson(`https://itunes.apple.com/search?${query}`)));
  } catch {
    return "busy";
  }
  keep(searches, key, { at: now, results }, 500);
  for (const f of results) {
    keep(found, f.id, f, ART_KEPT);
    rememberArt(f.id, f.artwork);
  }
  return results;
}

/** Songs a search found, by track, in the order asked; any this process has forgotten are left out. */
export function foundById(ids: readonly string[]): Found[] {
  return ids.flatMap((id) => {
    const f = found.get(id);
    return f === undefined ? [] : [f];
  });
}

/**
 * Apple Music's chart for the United States, as this process last read it,
 * and never a wait: a page is drawn with what is in hand and the read
 * happens behind it. Read at most once an hour, tried again no sooner than
 * five minutes after a failure, and a chart older than six hours is dropped
 * rather than shown, which is the honest way for the strip to fail.
 */
export function chartNow(now: number = Date.now(), url: string = CHART_URL): ChartSong[] {
  if ((chart === null || now - chart.at >= CHART_TTL_MS) && now - chartTried >= CHART_RETRY_MS) void refreshChart(now, url);
  return chart !== null && now - chart.at < CHART_STALE_MS ? chart.rows : [];
}

let chartTried = -Infinity;
let chartReading: Promise<void> | null = null;
const CHART_RETRY_MS = 5 * 60_000;

/** One read of the chart, shared by every request that asks while it runs. */
export function refreshChart(now: number = Date.now(), url: string = CHART_URL): Promise<void> {
  if (chartReading !== null) return chartReading;
  chartTried = now;
  chartReading = (async () => {
    try {
      const rows = parseChart(await getJson(url));
      if (rows.length > 0) {
        chart = { at: now, rows };
        for (const r of rows) rememberArt(r.id, r.artwork);
      }
    } catch {
      // The last good chart stands until it is six hours old.
    } finally {
      chartReading = null;
    }
  })();
  return chartReading;
}

/** Where a track's artwork is: remembered, or read from wall_songs with the website's key. Null for a track nobody has seen. */
async function artworkFor(trackId: string, project: string, key: string | undefined): Promise<string | null> {
  const held = art.get(trackId);
  if (held !== undefined) return held;
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${project}/rest/v1/wall_songs?select=track_id,title,artist,artwork_url&track_id=eq.${trackId}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: controller.signal,
    });
    if (!response.ok) return null;
    const song = songsFrom(await response.json()).get(trackId);
    if (song?.artwork) rememberArt(trackId, song.artwork);
    return song?.artwork ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(response: Response, max: number): Promise<Buffer | null> {
  if (response.body === null) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => {});
        return null;
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts);
}

/**
 * A track's cover, 300 pixels square, as bytes, or null. Only ever from
 * Apple's image host, at most 400 kilobytes, only an image, and kept in
 * memory once fetched so a busy board asks Apple once per cover.
 */
export async function coverFor(trackId: string, project: string, key: string | undefined): Promise<{ bytes: Buffer; type: string } | null> {
  if (!/^\d{1,18}$/.test(trackId)) return null;
  const held = covers.get(trackId);
  if (held !== undefined) return held;
  const source = artAt(await artworkFor(trackId, project, key), 300);
  if (source === null) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APPLE_TIMEOUT_MS);
  try {
    const response = await fetch(source, { headers: { "User-Agent": USER_AGENT, Accept: "image/*" }, signal: controller.signal, redirect: "error" });
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim();
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return null;
    const declared = Number(response.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > COVER_MAX_BYTES) return null;
    // Read in chunks and dropped at the cap, never measured after it is all
    // in memory: CLAUDE.md, "The tick read whatever it was sent".
    const bytes = await readCapped(response, COVER_MAX_BYTES);
    if (bytes === null || bytes.byteLength < 200) return null;
    const cover = { bytes, type };
    keep(covers, trackId, cover, COVERS_KEPT);
    return cover;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
