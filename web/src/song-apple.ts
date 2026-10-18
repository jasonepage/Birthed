// Apple's artwork, from the server, for the songs people named in the song
// in your head. docs/the-wall.md section 31.
//
// The song prompt came off the date page on October 18, 2026,
// docs/strip-to-the-hive.md, and with it the search and the chart this file
// used to read. What is left is the covers: the songs people named between
// October 3 and October 18 are tiles on sealed hives, and their covers are
// fetched from Apple's image host by this server and passed through at
// /cover/<track>.jpg, so no reader's browser asks Apple for anything. A cover
// is kept in memory once fetched.

import { artAt, songsFrom } from "./song-prompt.js";

const COVER_MAX_BYTES = 400_000;
const COVERS_KEPT = 400;
const ART_KEPT = 5000;
const APPLE_TIMEOUT_MS = 4000;
const USER_AGENT = "Birthed/0.1 (https://birthed.app)";

/** Apple's artwork address by track, from wall_songs. Bounded: the oldest go first. */
const art = new Map<string, string>();
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
  art.clear(); covers.clear();
}

/** Remember where a track's artwork is. */
export function rememberArt(trackId: string, url: string | null): void {
  if (url !== null && /^\d{1,18}$/.test(trackId)) keep(art, trackId, url, ART_KEPT);
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
