/**
 * Pictures the project holds for tiles on the hive, read at build time and
 * at request time.
 *
 * Two tables, one shape. `event_pictures` is the lead picture of the article
 * a history row is about, copied from Wikimedia Commons by the worker's
 * `npm run pictures` (docs/the-wall.md section 19). `story_pictures` is the
 * publisher's own preview picture for a news story, the og:image the page
 * offers for link cards, copied by the worker's tick (section 20). Both live
 * in the project's public `pictures` bucket, so a path here is always on
 * that one host, and the site's image policy names that host and its own
 * and nothing else. No page asks Wikipedia, Commons or a publisher for a
 * picture.
 *
 * A picture is keyed the way the tile is: by the story's subject
 * ("historical_event:13857") when it has one, and by the story itself
 * ("story:<id>") when it does not, which is the news. wall.ts writes the
 * same key on the tile as data-subject, so one style rule finds it whether
 * the wall in the page is baked or live.
 */

import type { Picture, WallStory } from "./wall.js";

/** The storage bucket, the same name the worker writes to. */
export const BUCKET = "pictures";

export interface StoredPicture extends Picture {
  /** The credit line the receipt prints, plain words. */
  credit: string;
  /** Where the full credit lives: the file's page on Commons, or null for a publisher's picture, whose page the receipt already links. */
  commonsUrl: string | null;
  /** The licence's own page, when Commons gave one. */
  licenseUrl: string | null;
}

/** One row of event_pictures, as PostgREST sends it. */
export interface EventPictureRow {
  event_id: number | string;
  path: string | null;
  file: string;
  artist: string | null;
  license: string | null;
  license_url: string | null;
  commons_url: string | null;
}

/** One row of story_pictures. A null path is a page that offered no picture. */
export interface StoryPictureRow {
  story_id: string;
  path: string | null;
  outlet: string;
}

/** The public address of a stored picture. */
export function publicUrl(projectUrl: string, path: string): string {
  return `${projectUrl.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** The credit line for a Commons picture, the same words the worker's test pins. */
export function creditLine(file: string, artist: string | null, license: string | null): string {
  const by = artist ? `, by ${artist}` : "";
  const under = license ? `, ${license}` : "";
  return `Picture: ${file.replace(/_/g, " ")}${by}${under}, from Wikimedia Commons.`;
}

/** The credit line for a publisher's preview picture. */
export function previewCreditLine(outlet: string): string {
  return `Picture: the article's own preview picture, from ${outlet}. It belongs to the publisher.`;
}

/** The key a picture is filed under for a story: its subject, or the story itself. */
export function pictureKeyOf(story: Pick<WallStory, "id" | "subjectKind" | "subjectId">): string {
  return story.subjectKind !== null && story.subjectId !== null ? `${story.subjectKind}:${story.subjectId}` : `story:${story.id}`;
}

export function eventPicturesFrom(rows: EventPictureRow[], projectUrl: string): Map<string, StoredPicture> {
  const out = new Map<string, StoredPicture>();
  for (const row of rows) {
    if (typeof row.path !== "string" || row.path === "") continue;
    const subject = `historical_event:${row.event_id}`;
    out.set(subject, {
      subject,
      path: publicUrl(projectUrl, row.path),
      credit: creditLine(row.file, row.artist, row.license),
      commonsUrl: row.commons_url,
      licenseUrl: row.license_url,
    });
  }
  return out;
}

export function storyPicturesFrom(rows: StoryPictureRow[], projectUrl: string): Map<string, StoredPicture> {
  const out = new Map<string, StoredPicture>();
  for (const row of rows) {
    if (typeof row.path !== "string" || row.path === "") continue;
    const subject = `story:${row.story_id}`;
    out.set(subject, { subject, path: publicUrl(projectUrl, row.path), credit: previewCreditLine(row.outlet), commonsUrl: null, licenseUrl: null });
  }
  return out;
}

const EVENT_SELECT = "event_id,path,file,artist,license,license_url,commons_url";
const STORY_SELECT = "story_id,path,outlet";

async function readAll<T>(url: string, key: string, table: string, select: string, order: string): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({ select, order, limit: String(pageSize), offset: String(offset), path: "not.is.null" });
    const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    // A missing table is no pictures, not a dead build. The migration may not
    // have run yet, and a picture table is the last thing that should take
    // the site down: an empty answer leaves every tile drawn as it was, the
    // way an empty lead-lines or wall table does. Only the first page is
    // guarded, which is where a missing table shows up; a mid-read failure on
    // a table that exists is still worth stopping for.
    if (!response.ok) {
      if (offset === 0) {
        console.log(`${table} could not be read (${response.status}), so those tiles draw their colour`);
        return rows;
      }
      throw new Error(`${table} failed with ${response.status}`);
    }
    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

/** Both tables whole, for the build. Empty is the normal state before the worker has run. */
export async function fetchStoredPictures(url: string, key: string): Promise<Map<string, StoredPicture>> {
  const events = eventPicturesFrom(await readAll<EventPictureRow>(url, key, "event_pictures", EVENT_SELECT, "event_id.asc"), url);
  const stories = storyPicturesFrom(await readAll<StoryPictureRow>(url, key, "story_pictures", STORY_SELECT, "story_id.asc"), url);
  return new Map([...events, ...stories]);
}

async function readSome<T>(url: string, key: string, table: string, select: string, filter: string, timeoutMs: number): Promise<T[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}/rest/v1/${table}?select=${select}&${filter}&path=not.is.null`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: controller.signal,
    });
    if (!response.ok) return [];
    const rows = (await response.json()) as T[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The pictures for one wall's stories, read live for an open date. Two
 * small reads, one per table, only for the identifiers on this wall. A miss,
 * a timeout or an error is an empty list, never a broken page: the tiles
 * draw their colours, which is what the page did before pictures.
 */
export async function fetchPicturesFor(url: string, key: string, stories: Pick<WallStory, "id" | "subjectKind" | "subjectId" | "status">[], timeoutMs: number = 3000): Promise<StoredPicture[]> {
  // Only the placed stories, which are the tiles: those are the only ones a
  // picture is drawn on, so a busy date's hundreds of feed stories never go
  // into the query. That keeps the identifier list short enough for one
  // request, the whole reason this reads live rather than by identifier.
  const tiles = stories.filter((s) => s.status === "placed");
  const eventIds = tiles.filter((s) => s.subjectKind === "historical_event" && s.subjectId !== null && /^\d+$/.test(s.subjectId)).map((s) => s.subjectId!);
  const storyIds = tiles.filter((s) => s.subjectKind === null && /^[0-9a-f-]{36}$/i.test(s.id)).map((s) => s.id);
  const [events, news] = await Promise.all([
    eventIds.length === 0 ? Promise.resolve([] as EventPictureRow[]) : readSome<EventPictureRow>(url, key, "event_pictures", EVENT_SELECT, `event_id=in.(${eventIds.join(",")})`, timeoutMs),
    storyIds.length === 0 ? Promise.resolve([] as StoryPictureRow[]) : readSome<StoryPictureRow>(url, key, "story_pictures", STORY_SELECT, `story_id=in.(${storyIds.join(",")})`, timeoutMs),
  ]);
  return [...eventPicturesFrom(events, url).values(), ...storyPicturesFrom(news, url).values()];
}

/** One story's picture, for a receipt served live. */
export async function fetchPictureFor(url: string, key: string, story: Pick<WallStory, "id" | "subjectKind" | "subjectId">, timeoutMs: number = 3000): Promise<StoredPicture | null> {
  // A receipt asks for its one story whatever its status, so it is handed to
  // the bulk reader as a placed one to pass the tiles-only filter there.
  const found = await fetchPicturesFor(url, key, [{ ...story, status: "placed" }], timeoutMs);
  return found.find((p) => p.subject === pictureKeyOf(story)) ?? null;
}
