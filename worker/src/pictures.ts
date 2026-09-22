// Pictures for the events on the hive: the pure parts.
//
// Every history row that names its article, historical_events.subject_url,
// can have that article's lead picture. Wikipedia's page image service says
// which file that is and, asked for free pictures only, hands back nothing
// for an article whose lead picture is not freely licensed, so the licence
// question is answered before a byte is fetched. Wikimedia Commons then says
// who made it and under what licence, which the receipt prints as credit.
//
// Which events get a picture: the best scored on each date, by the same
// points that choose the board, docs/the-wall.md section 19. The pictures
// live in Supabase Storage, in the `pictures` bucket, decided by Jason on
// September 11, 2026, because the repository is the wrong place for a
// gigabyte and Supabase is a company the privacy page already names.
//
// The network parts are in event-pictures.ts. Everything here takes data and
// returns data.

/**
 * How many events a date gets pictures for: every tile that can reach the
 * board, which is the rule and not the number.
 *
 * It was twelve, and twelve was right when the board held eleven tiles. It
 * is the reason the mural was starved of pictures as well as of tiles: on
 * September 22, 2026 the project held 369 event pictures for 19,750 history
 * rows, 15,148 of which name an article, and the job had only ever been run
 * on 36 of the 366 dates. Of what it did ask for, about 85 percent came
 * back.
 *
 * Forty, which is what UNBACKED_PLACED allows a date. docs/the-wall.md
 * section 27.
 *
 * **What this costs, because it is the one thing to check before running
 * it.** At about 85 percent and 366 dates this asks for something like
 * twelve thousand pictures where there are now 369, at tile width. The old
 * comment put 4,400 at a few hundred megabytes, so this is of the order of a
 * gigabyte in the bucket. That is a storage bill rather than a model bill,
 * and it is Jason's to approve before the job runs everywhere.
 */
export const PICTURES_PER_DATE = 40;
/** The width the picture is fetched at. A tile is at most sixteen modules, about 640 pixels on a desktop. */
export const PICTURE_WIDTH = 640;
/** The storage bucket, public, created by migration 20260911080000. */
export const BUCKET = "pictures";

const COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath";

/** The best scored events on a date that do not have a picture yet. */
export function eventsToPicture<T extends { id: number | string; subject_url: string | null }>(
  events: T[],
  scores: Map<string, number>,
  pictured: ReadonlySet<string>,
  limit: number = PICTURES_PER_DATE,
): T[] {
  return events
    .filter((e) => e.subject_url !== null && !pictured.has(String(e.id)))
    .sort((a, b) => (scores.get(`historical_event:${b.id}`) ?? 0) - (scores.get(`historical_event:${a.id}`) ?? 0) || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit);
}

/** The article title out of a subject address, with spaces, the way the API wants it. */
export function titleOf(subjectUrl: string): string {
  return decodeURIComponent(subjectUrl.replace(/^https?:\/\/en\.wikipedia\.org\/wiki\//, "")).replace(/_/g, " ");
}

export interface PageImagesAnswer {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    pages?: Array<{ title?: string; pageimage?: string; missing?: boolean }>;
  };
}

/**
 * Title to Commons file name, from a pageimages answer asked with
 * pilicense=free. A title with no free lead picture is simply absent. A
 * title the API normalised or redirected is mapped back to the title asked.
 */
export function readPageImages(asked: string[], answer: PageImagesAnswer): Map<string, string> {
  const forward = new Map<string, string>();
  for (const n of answer.query?.normalized ?? []) forward.set(n.from, n.to);
  for (const r of answer.query?.redirects ?? []) forward.set(forward.get(r.from) === undefined ? r.from : r.from, r.to);
  const byTitle = new Map<string, string>();
  for (const page of answer.query?.pages ?? []) {
    if (page.title !== undefined && typeof page.pageimage === "string" && page.pageimage !== "") byTitle.set(page.title, page.pageimage);
  }
  const out = new Map<string, string>();
  for (const title of asked) {
    let at = title;
    for (let hop = 0; hop < 3; hop += 1) {
      const next = forward.get(at);
      if (next === undefined) break;
      at = next;
    }
    const file = byTitle.get(at) ?? byTitle.get(title);
    if (file !== undefined) out.set(title, file);
  }
  return out;
}

export interface Credit {
  /** Who made it, as Commons records it, tags stripped. Null when Commons does not say. */
  artist: string | null;
  /** The licence's short name, such as "CC BY-SA 4.0" or "Public domain". */
  license: string | null;
  licenseUrl: string | null;
}

export interface ImageInfoAnswer {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    pages?: Array<{
      title?: string;
      imageinfo?: Array<{ extmetadata?: Record<string, { value?: string }> }>;
    }>;
  };
}

/** A Commons metadata value into plain words. Artist fields carry markup. */
export function plainWords(html: string | undefined): string | null {
  if (html === undefined) return null;
  const text = html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
  return text === "" ? null : text.slice(0, 200);
}

/** File name to credit, from an imageinfo answer asked with iiprop=extmetadata. */
export function readCredits(files: string[], answer: ImageInfoAnswer): Map<string, Credit> {
  const normalised = new Map<string, string>();
  for (const n of answer.query?.normalized ?? []) normalised.set(n.from, n.to);
  const byTitle = new Map<string, Credit>();
  for (const page of answer.query?.pages ?? []) {
    const meta = page.imageinfo?.[0]?.extmetadata;
    if (page.title === undefined || meta === undefined) continue;
    byTitle.set(page.title, {
      artist: plainWords(meta.Artist?.value),
      license: plainWords(meta.LicenseShortName?.value),
      licenseUrl: plainWords(meta.LicenseUrl?.value),
    });
  }
  const out = new Map<string, Credit>();
  for (const file of files) {
    const asked = `File:${file}`;
    const credit = byTitle.get(normalised.get(asked) ?? asked);
    if (credit !== undefined) out.set(file, credit);
  }
  return out;
}

/** The address the picture is fetched from, sized for a tile. */
export function fetchUrl(file: string, width: number = PICTURE_WIDTH): string {
  return `${COMMONS}/${encodeURIComponent(file.replace(/ /g, "_"))}?width=${width}`;
}

/** The Commons page for the file, where the full credit lives. */
export function commonsPage(file: string): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;
}

/**
 * Where the picture lives in the bucket. The extension follows what Commons
 * sent back, not the file's name: a picture asked for at a width comes back
 * as JPEG or PNG whatever the original was.
 */
export function storagePath(eventId: number | string, contentType: string): string {
  const ext = /png/i.test(contentType) ? "png" : /gif/i.test(contentType) ? "gif" : /webp/i.test(contentType) ? "webp" : "jpg";
  return `event/${eventId}.${ext}`;
}

/** The public address of a stored picture, which is what the page's style rule points at. */
export function publicUrl(projectUrl: string, path: string): string {
  return `${projectUrl.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** The credit line the receipt prints, in plain words and no markup. */
export function creditLine(file: string, credit: Credit | null): string {
  const by = credit?.artist ? `, by ${credit.artist}` : "";
  const under = credit?.license ? `, ${credit.license}` : "";
  return `Picture: ${file.replace(/_/g, " ")}${by}${under}, from Wikimedia Commons.`;
}
