// Pictures for the news on the hive: the publisher's own preview picture.
//
//   node dist/src/wall/story-pictures.js            # every open date
//   node dist/src/wall/story-pictures.js --date 2026-09-11
//   node dist/src/wall/story-pictures.js --dry      # say what would be fetched
//
// Every news page carries an og:image tag. Publishers put it there so that a
// shared link shows a picture on Facebook, X, iMessage and Slack, which is
// exactly what a tile on the hive is: a link card. The worker copies that one
// picture into the project's public bucket and records where it is; the
// receipt says whose it is and links the article. No page on the site ever
// asks the publisher's server for anything, which keeps the privacy page's
// promise. A publisher that wants a picture gone writes to the address on
// the privacy page and the row is deleted; the tile draws its colour again.
// docs/the-wall.md section 20, decided September 11, 2026.
//
// Which stories: every story on an open date that has no picture yet and
// has no subject of its own, which is the news and the submissions. A story
// with a subject gets its picture from the subject's importer instead
// (event-pictures.ts, the covers, the faces). A page read once and found to
// carry no picture is recorded with no path, so it is not read again.
//
// One page at a time, a pause between, the same manners as the checker.
// worker/src/wall/page.ts is not touched: this reads the page with the same
// fetchPage the checker uses and looks at two meta tags.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadConfig, loadDotEnv } from "../config.js";
import { insert, rows, type Db } from "./db.js";
import { fetchPage, meta } from "./page.js";

/** The storage bucket, the same one the event pictures use. */
export const BUCKET = "pictures";
/** A preview picture bigger than this is not copied. Most are under 300 kilobytes. */
export const MAX_BYTES = 3_000_000;
const PAUSE_MS = 400;

export interface StoryRow {
  id: string;
  wall_date: string;
  url: string;
  outlet: string;
  subject_kind: string | null;
}

/**
 * The picture a page offers for its own link card, as an absolute https
 * address, or null. og:image first, then twitter:image, which is what the
 * card services themselves fall back to. A relative address is resolved
 * against the page. Anything that is not https is refused: the site is
 * https and a copy is made over the same.
 */
export function previewPictureOf(html: string | null, pageUrl: string): string | null {
  if (html === null) return null;
  for (const key of ["og:image", "og:image:secure_url", "twitter:image", "twitter:image:src"]) {
    const value = meta(html, key);
    if (value === null) continue;
    try {
      const resolved = new URL(value, pageUrl);
      if (resolved.protocol !== "https:") continue;
      return resolved.toString();
    } catch {
      continue;
    }
  }
  return null;
}

/** Where the copy lives in the bucket. The extension follows what the server sent. */
export function storagePath(storyId: string, contentType: string): string {
  const ext = /png/i.test(contentType) ? "png" : /gif/i.test(contentType) ? "gif" : /webp/i.test(contentType) ? "webp" : /avif/i.test(contentType) ? "avif" : "jpg";
  return `story/${storyId}.${ext}`;
}

/** The stories on the given dates that have no subject and no picture row yet. */
export function storiesToPicture(stories: StoryRow[], pictured: ReadonlySet<string>): StoryRow[] {
  return stories.filter((s) => s.subject_kind === null && !pictured.has(s.id));
}

async function store(db: Db, path: string, body: ArrayBuffer, contentType: string): Promise<void> {
  const response = await fetch(`${db.url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, "Content-Type": contentType, "x-upsert": "true", "Cache-Control": "public, max-age=31536000" },
    body,
  });
  if (!response.ok) throw new Error(`storage answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

export interface Report { stored: number; none: number; failed: number }

/**
 * The picture's bytes, or null once it passes the cap.
 *
 * Read in chunks and abandoned as soon as it is too big, so an oversized
 * picture costs the cap rather than its whole size. A server that declares no
 * content-length is the reason this exists as well as the header check.
 */
async function readCappedBytes(response: Response, maxBytes: number): Promise<ArrayBuffer | null> {
  if (response.body === null) return new ArrayBuffer(0);
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(bytes);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.byteLength; }
  return out.buffer;
}

/**
 * One story: read its page, find the preview picture, copy it, record it.
 * A page with no picture is recorded with no path so it is not read again.
 * A failure to copy records nothing, so a later run tries again.
 */
export async function pictureStory(
  db: Db, story: StoryRow, userAgent: string, dry: boolean, log: (line: string) => void,
  read: (url: string) => ReturnType<typeof fetchPage> = (url) => fetchPage(url),
): Promise<"stored" | "none" | "failed"> {
  const page = await read(story.url);
  const imageUrl = previewPictureOf(page.body, page.finalUrl ?? story.url);
  if (imageUrl === null) {
    log(`  ${story.outlet}: no preview picture`);
    if (!dry) await insert(db, "story_pictures?on_conflict=story_id", [{ story_id: story.id, page_url: story.url, image_url: null, outlet: story.outlet, path: null, fetched_at: new Date().toISOString() }], { ignoreDuplicates: true });
    return "none";
  }
  if (dry) {
    log(`  ${story.outlet}: ${imageUrl}`);
    return "stored";
  }
  try {
    const response = await fetch(imageUrl, { headers: { "User-Agent": userAgent, Accept: "image/*" }, redirect: "follow" });
    if (!response.ok) throw new Error(`picture answered ${response.status}`);
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim() || "image/jpeg";
    if (!/^image\//.test(contentType)) throw new Error(`not an image: ${contentType}`);
    // The declared size first. Reading the whole picture and then measuring
    // it is how a 64,440,402 byte page got allocated in a 256 megabyte heap
    // and killed the tick; the message said "too big" only after the bytes
    // were already in memory. CLAUDE.md section 5, September 22, 2026.
    const declared = Number(response.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      await response.body?.cancel().catch(() => {});
      throw new Error(`too big: ${declared} bytes`);
    }
    const body = await readCappedBytes(response, MAX_BYTES);
    if (body === null) throw new Error(`too big: over ${MAX_BYTES} bytes`);
    if (body.byteLength < 1000) throw new Error(`only ${body.byteLength} bytes`);
    const path = storagePath(story.id, contentType);
    await store(db, path, body, contentType);
    await insert(db, "story_pictures?on_conflict=story_id", [{ story_id: story.id, page_url: story.url, image_url: imageUrl, outlet: story.outlet, path, fetched_at: new Date().toISOString() }], { ignoreDuplicates: true });
    return "stored";
  } catch (error: unknown) {
    log(`  ${story.outlet}: ${error instanceof Error ? error.message : String(error)}`);
    return "failed";
  }
}

/** Every open date, or the dates given. */
export async function run(db: Db, options: { dates?: string[]; userAgent?: string; dry?: boolean; log?: (line: string) => void } = {}): Promise<Report> {
  const log = options.log ?? ((line: string) => console.log(line));
  const userAgent = options.userAgent ?? "Mozilla/5.0 (compatible; Birthed/0.1; +https://birthed.app)";
  // now() is computed here and sent as a timestamp: PostgREST does not run
  // SQL functions in a filter, it would send the text "now()" and Postgres
  // would reject it. An open date is one whose close is still ahead.
  const nowIso = new Date().toISOString();
  const dates = options.dates ?? (await rows<{ wall_date: string }>(db, `wall_days?select=wall_date&closes_at=gt.${nowIso}&order=wall_date.asc`)).map((d) => d.wall_date);
  const report: Report = { stored: 0, none: 0, failed: 0 };
  for (const wallDate of dates) {
    const stories = await rows<StoryRow>(db, `wall_stories?select=id,wall_date,url,outlet,subject_kind&wall_date=eq.${wallDate}&order=submitted_at.asc`);
    // In batches, not one giant filter: a busy date carries hundreds of
    // stories, and every identifier in one query string is tens of kilobytes,
    // which the server refuses with a 400. A hundred at a time is well under.
    const pictured = new Set<string>();
    for (let start = 0; start < stories.length; start += 100) {
      const batch = stories.slice(start, start + 100).map((s) => s.id);
      for (const r of await rows<{ story_id: string }>(db, `story_pictures?select=story_id&story_id=in.(${batch.join(",")})`)) pictured.add(r.story_id);
    }
    const todo = storiesToPicture(stories, pictured);
    if (todo.length === 0) continue;
    log(`wall pictures ${wallDate}: ${todo.length} stories to read`);
    for (const story of todo) {
      const outcome = await pictureStory(db, story, userAgent, options.dry === true, log);
      report[outcome] += 1;
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
  }
  log(`wall pictures: ${report.stored} stored, ${report.none} with no preview picture, ${report.failed} failed${options.dry ? " (dry run, nothing fetched or written)" : ""}`);
  return report;
}

async function main(): Promise<void> {
  await loadDotEnv();
  const dry = process.argv.includes("--dry");
  const config = loadConfig({ needsWrite: !dry });
  const at = process.argv.indexOf("--date");
  const dates = at >= 0 && process.argv[at + 1] !== undefined ? [process.argv[at + 1]!] : undefined;
  await run({ url: config.supabaseUrl, key: config.serviceRoleKey }, { dates, dry, userAgent: config.userAgent });
}

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
