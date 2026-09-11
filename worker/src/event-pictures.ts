// Pictures for the events on the hive.
//
//   npm run pictures -- --month 9 --day 11      # one date
//   npm run pictures -- --dry                   # plan the year, fetch nothing
//   npm run pictures                            # every date
//
// For each date, the twelve best scored events that name an article and have
// no picture yet, by the same points that choose the board. Wikipedia's page
// image service says which free file is the article's lead picture, Commons
// says who made it and under what licence, the file is fetched at tile width
// and put in the `pictures` bucket, and event_pictures records the path and
// the credit. docs/the-wall.md section 19, and pictures.ts for the rules.
//
// Free, like every other importer here. The pause between fetches is
// politeness to a volunteer funded service, and a run stopped halfway leaves
// nothing half done: a picture is recorded only after it is stored.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadConfig, loadDotEnv } from "./config.js";
import { BUCKET, commonsPage, eventsToPicture, fetchUrl, readCredits, readPageImages, storagePath, titleOf, type Credit, type ImageInfoAnswer, type PageImagesAnswer } from "./pictures.js";
import { scoresFor } from "./wall/check.js";
import { rows, type Db } from "./wall/db.js";
import { count } from "./events.js";

const API = "https://en.wikipedia.org/w/api.php";
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const PAUSE_MS = 400;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function argNumber(name: string): number | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const parsed = Number(process.argv[index + 1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

interface EventRow { id: number; event_year: number | null; subject_url: string | null }

async function pageImages(titles: string[], userAgent: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let start = 0; start < titles.length; start += 50) {
    const batch = titles.slice(start, start + 50);
    const url = new URL(API);
    url.searchParams.set("action", "query");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("piprop", "name");
    // Free pictures only. An article whose lead picture is fair use comes
    // back with no picture, which is the answer we want.
    url.searchParams.set("pilicense", "free");
    url.searchParams.set("pilimit", "50");
    url.searchParams.set("redirects", "1");
    url.searchParams.set("titles", batch.join("|"));
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    const response = await fetch(url, { headers: { "User-Agent": userAgent } });
    if (!response.ok) throw new Error(`pageimages answered ${response.status}`);
    for (const [title, file] of readPageImages(batch, (await response.json()) as PageImagesAnswer)) out.set(title, file);
    await sleep(PAUSE_MS);
  }
  return out;
}

async function credits(files: string[], userAgent: string): Promise<Map<string, Credit>> {
  const out = new Map<string, Credit>();
  for (let start = 0; start < files.length; start += 50) {
    const batch = files.slice(start, start + 50);
    const url = new URL(API);
    url.searchParams.set("action", "query");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "extmetadata");
    url.searchParams.set("iiextmetadatafilter", "Artist|LicenseShortName|LicenseUrl");
    url.searchParams.set("titles", batch.map((f) => `File:${f}`).join("|"));
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    const response = await fetch(url, { headers: { "User-Agent": userAgent } });
    if (!response.ok) throw new Error(`imageinfo answered ${response.status}`);
    for (const [file, credit] of readCredits(batch, (await response.json()) as ImageInfoAnswer)) out.set(file, credit);
    await sleep(PAUSE_MS);
  }
  return out;
}

async function store(db: Db, path: string, body: ArrayBuffer, contentType: string): Promise<void> {
  const response = await fetch(`${db.url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, "Content-Type": contentType, "x-upsert": "true", "Cache-Control": "public, max-age=31536000" },
    body,
  });
  if (!response.ok) throw new Error(`storage answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

async function record(db: Db, row: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${db.url}/rest/v1/event_pictures?on_conflict=event_id`, {
    method: "POST",
    headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`event_pictures refused: ${response.status} ${(await response.text()).slice(0, 200)}`);
}

export async function pictureDate(db: Db, month: number, day: number, userAgent: string, dry: boolean, log: (line: string) => void): Promise<{ stored: number; noPicture: number; failed: number }> {
  const events = await rows<EventRow>(db, `historical_events?select=id,event_year,subject_url&event_month=eq.${month}&event_day=eq.${day}&subject_url=not.is.null`);
  const already = new Set((await rows<{ event_id: number }>(db, `event_pictures?select=event_id&event_id=in.(${events.map((e) => e.id).join(",") || "0"})`)).map((r) => String(r.event_id)));
  const scores = await scoresFor(db, `2000-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, () => undefined);
  const chosen = eventsToPicture(events, scores, already);
  if (chosen.length === 0) return { stored: 0, noPicture: 0, failed: 0 };

  const titles = chosen.map((e) => titleOf(e.subject_url!));
  const files = await pageImages(titles, userAgent);
  const withPicture = chosen.filter((e) => files.has(titleOf(e.subject_url!)));
  const noPicture = chosen.length - withPicture.length;
  if (dry) {
    for (const e of chosen) log(`  ${e.event_year} ${titleOf(e.subject_url!)}: ${files.get(titleOf(e.subject_url!)) ?? "(no free picture)"}`);
    return { stored: 0, noPicture, failed: 0 };
  }
  const creditOf = await credits([...new Set(withPicture.map((e) => files.get(titleOf(e.subject_url!))!))], userAgent);

  let stored = 0;
  let failed = 0;
  for (const e of withPicture) {
    const title = titleOf(e.subject_url!);
    const file = files.get(title)!;
    try {
      const response = await fetch(fetchUrl(file), { headers: { "User-Agent": userAgent }, redirect: "follow" });
      if (!response.ok) throw new Error(`commons answered ${response.status}`);
      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      if (!/^image\//.test(contentType)) throw new Error(`not an image: ${contentType}`);
      const body = await response.arrayBuffer();
      const path = storagePath(e.id, contentType);
      await store(db, path, body, contentType);
      const credit = creditOf.get(file) ?? null;
      await record(db, {
        event_id: e.id, article: title, file, path,
        artist: credit?.artist ?? null, license: credit?.license ?? null, license_url: credit?.licenseUrl ?? null,
        commons_url: commonsPage(file), fetched_at: new Date().toISOString(),
      });
      stored += 1;
    } catch (error: unknown) {
      failed += 1;
      log(`  ${title}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await sleep(PAUSE_MS);
  }
  return { stored, noPicture, failed };
}

async function main(): Promise<void> {
  await loadDotEnv();
  const dry = process.argv.includes("--dry");
  const config = loadConfig({ needsWrite: !dry });
  const db: Db = { url: config.supabaseUrl, key: config.serviceRoleKey };
  const onlyMonth = argNumber("month");
  const onlyDay = argNumber("day");
  const dates: Array<[number, number]> = [];
  for (let month = 1; month <= 12; month += 1) {
    if (onlyMonth !== undefined && month !== onlyMonth) continue;
    for (let day = 1; day <= (DAYS_IN_MONTH[month - 1] ?? 31); day += 1) {
      if (onlyDay !== undefined && day !== onlyDay) continue;
      dates.push([month, day]);
    }
  }
  let stored = 0, noPicture = 0, failed = 0;
  for (const [month, day] of dates) {
    const result = await pictureDate(db, month, day, config.userAgent, dry, (line) => console.log(line));
    stored += result.stored; noPicture += result.noPicture; failed += result.failed;
    console.log(`${month}/${day}: ${result.stored} stored, ${result.noPicture} with no free picture, ${result.failed} failed`);
  }
  console.log(`\n${count(stored, "picture")} stored, ${noPicture} events with no free picture, ${count(failed, "failure")}${dry ? " (dry run, nothing fetched or written)" : ""}`);
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
