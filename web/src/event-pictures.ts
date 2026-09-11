/**
 * Pictures for the events on the hive, read at build time.
 *
 * The worker's `npm run pictures` puts each pictured event's lead picture
 * from Wikipedia in the project's `pictures` bucket and records the path
 * and the credit in event_pictures. This module reads that table whole and
 * turns each row into the two things a page needs: a Picture the style block
 * points a tile at, and a credit line the receipt prints. Nothing here talks
 * to Wikipedia or Commons; the page shows a file the project holds.
 *
 * The site sends img-src 'self' and the project's own address, and nothing
 * else, so a path here is always on that one host. See docs/the-wall.md
 * section 18 and worker/src/pictures.ts for the rules that chose the events.
 */

import type { Picture } from "./wall.js";

/** One row of event_pictures, as PostgREST sends it. */
export interface EventPictureRow {
  event_id: number | string;
  path: string;
  file: string;
  artist: string | null;
  license: string | null;
  license_url: string | null;
  commons_url: string | null;
}

export interface EventPicture extends Picture {
  /** The credit line the receipt prints, plain words. */
  credit: string;
  /** The file's page on Wikimedia Commons, where the full credit lives. */
  commonsUrl: string | null;
  /** The licence's own page, when Commons gave one. */
  licenseUrl: string | null;
}

/** The storage bucket, the same name the worker writes to. */
export const BUCKET = "pictures";

/** The public address of a stored picture. */
export function publicUrl(projectUrl: string, path: string): string {
  return `${projectUrl.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** The credit line, the same words the worker's test pins. */
export function creditLine(file: string, artist: string | null, license: string | null): string {
  const by = artist ? `, by ${artist}` : "";
  const under = license ? `, ${license}` : "";
  return `Picture: ${file.replace(/_/g, " ")}${by}${under}, from Wikimedia Commons.`;
}

/** Rows into pictures keyed by subject, "historical_event:<id>", the way the worker keys a story. */
export function eventPicturesFrom(rows: EventPictureRow[], projectUrl: string): Map<string, EventPicture> {
  const out = new Map<string, EventPicture>();
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

/** The whole table, paged. Empty is the normal state before the worker has run. */
export async function fetchEventPictures(url: string, key: string): Promise<Map<string, EventPicture>> {
  const rows: EventPictureRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "event_id,path,file,artist,license,license_url,commons_url",
      order: "event_id.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${url}/rest/v1/event_pictures?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`event pictures failed with ${response.status}`);
    const page = (await response.json()) as EventPictureRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return eventPicturesFrom(rows, url);
}

/**
 * One event's picture, read live for a receipt served on an open date. A
 * miss, a timeout or an error is no credit, never a broken page.
 */
export async function fetchEventPicture(url: string, key: string, eventId: string, timeoutMs: number = 3000): Promise<EventPicture | null> {
  if (!/^\d+$/.test(eventId)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `${url}/rest/v1/event_pictures?select=event_id,path,file,artist,license,license_url,commons_url&event_id=eq.${eventId}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: controller.signal },
    );
    if (!response.ok) return null;
    const rows = (await response.json()) as EventPictureRow[];
    if (!Array.isArray(rows)) return null;
    return eventPicturesFrom(rows, url).get(`historical_event:${eventId}`) ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
