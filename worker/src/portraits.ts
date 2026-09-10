// Faces.
//
//   npm run portraits -- 9 7
//   npm run portraits -- 9 7 --out ../web/proto/portraits-9-7.json
//
// Every notable person on a date has a Wikidata identifier already, and
// Wikidata records a picture of most of them in P18. That property points at
// Wikimedia Commons, where the licence is free by policy and the only
// obligation is credit, which this site already gives on every row.
//
// The URL written here is a Special:FilePath link rather than a direct
// upload.wikimedia.org one. The direct path contains an MD5 hash of the
// filename and is a thing you have to compute; Special:FilePath is stable,
// documented, redirects to the current file, and takes a width parameter, so a
// page can ask for a 400 pixel portrait instead of a four megabyte scan.
//
// Free, like the rest of the importers. No key, nothing metered.

import { realpathSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadConfig, loadDotEnv } from "./config.js";
import { PEOPLE_PER_DATE, hivePeoplePath } from "./wall/history.js";

const WIKIDATA = "https://query.wikidata.org/sparql";
const COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath";

export interface Portrait {
  qid: string;
  name: string;
  /** A Commons URL sized for a card, or null when Wikidata has no picture. */
  url: string | null;
  /** The file name, kept so a credit line can name what it is showing. */
  file: string | null;
}

/**
 * A Commons file name into a URL a browser can load.
 *
 * The width is not decoration. Commons holds originals, and a few of these are
 * scans measured in megabytes. Asking for 400 pixels is the difference between
 * a page that loads on a phone and one that does not.
 */
export function filePathUrl(file: string, width = 400): string {
  return `${COMMONS}/${encodeURIComponent(file.replace(/ /g, "_"))}?width=${width}`;
}

export function buildPortraitQuery(qids: string[]): string {
  const values = qids.map((q) => `wd:${q}`).join(" ");
  // P18 only. Not P109 (signature), not P154 (logo), not the coat of arms that
  // royalty carries: a page that promised faces and delivered a heraldic shield
  // would be worse than one that showed nothing.
  return `SELECT ?item ?file WHERE {
  VALUES ?item { ${values} }
  ?item wdt:P18 ?file .
}`;
}

interface PortraitAnswer {
  results?: { bindings?: { item?: { value: string }; file?: { value: string } }[] };
}

/** The bare file name out of a Commons URL. */
export function fileNameFrom(url: string): string | null {
  const at = url.lastIndexOf("/");
  if (at < 0) return null;
  const name = decodeURIComponent(url.slice(at + 1)).trim();
  return name === "" ? null : name;
}

export function readPortraits(answer: PortraitAnswer): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of answer.results?.bindings ?? []) {
    const item = row.item?.value;
    const file = row.file?.value;
    if (item === undefined || file === undefined) continue;
    const qid = item.slice(item.lastIndexOf("/") + 1);
    const name = fileNameFrom(file);
    // First one wins. A handful of people carry two P18 values and there is no
    // signal here for choosing between them, so taking the first is honest and
    // stable rather than arbitrary and different on every run.
    if (name !== null && !out.has(qid)) out.set(qid, name);
  }
  return out;
}

export async function fetchPortraits(
  qids: string[],
  userAgent: string,
): Promise<Map<string, string>> {
  if (qids.length === 0) return new Map();
  const response = await fetch(WIKIDATA, {
    method: "POST",
    headers: {
      "User-Agent": userAgent,
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query: buildPortraitQuery(qids) }),
  });
  if (!response.ok) return new Map();
  return readPortraits((await response.json()) as PortraitAnswer);
}

interface PersonRow {
  wikidata_qid: string;
  name: string;
}

async function peopleOn(month: number, day: number, url: string, key: string): Promise<PersonRow[]> {
  const query = new URLSearchParams({
    select: "wikidata_qid,name",
    birth_month: `eq.${month}`,
    birth_day: `eq.${day}`,
    adult_content: "is.false",
    violence_content: "is.false",
    order: "monthly_views.desc.nullslast",
    limit: "30",
  });
  const response = await fetch(`${url}/rest/v1/notable_people?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`people for ${month}/${day} failed with ${response.status}`);
  return (await response.json()) as PersonRow[];
}


// ---------------------------------------------------------------------------
// Every date, written back.
//
//   npm run portraits -- --all --write
//
// 25,741 people at two hundred identifiers a query is about a hundred and
// thirty queries, with a courtesy pause, which is a couple of minutes against
// a volunteer funded service. Free, no key, nothing metered.
//
// Written in batches through set_person_images rather than one request per
// person, because 25,741 requests is twenty minutes and a run that stops
// halfway leaves nobody able to say which half landed.

const QIDS_PER_QUERY = 200;
const WRITE_BATCH = 500;
const PAUSE_MS = 900;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function everyPerson(url: string, key: string): Promise<PersonRow[]> {
  const rows: PersonRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "wikidata_qid,name",
      order: "id.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${url}/rest/v1/notable_people?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    // Paged for the reason every other reader here is paged: PostgREST answers
    // at most a thousand rows and says nothing at all about the ones it left
    // out, so a single request would quietly return the first slice and every
    // person after it would silently have no face.
    if (!response.ok) throw new Error(`people failed with ${response.status}`);
    const page = (await response.json()) as PersonRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function writeImages(
  url: string,
  key: string,
  rows: Array<{ qid: string; file: string | null }>,
): Promise<number> {
  let changed = 0;
  for (let start = 0; start < rows.length; start += WRITE_BATCH) {
    const batch = rows.slice(start, start + WRITE_BATCH);
    const response = await fetch(`${url}/rest/v1/rpc/set_person_images`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ rows: batch }),
    });
    if (!response.ok) {
      throw new Error(`write failed with ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
    changed += Number(await response.json()) || 0;
  }
  return changed;
}

async function everyone(url: string, key: string, userAgent: string, write: boolean): Promise<void> {
  const people = await everyPerson(url, key);
  console.log(`${people.length} people to look up`);

  const found: Array<{ qid: string; file: string | null }> = [];
  for (let start = 0; start < people.length; start += QIDS_PER_QUERY) {
    const batch = people.slice(start, start + QIDS_PER_QUERY);
    const files = await fetchPortraits(batch.map((p) => p.wikidata_qid), userAgent);
    for (const person of batch) {
      found.push({ qid: person.wikidata_qid, file: files.get(person.wikidata_qid) ?? null });
    }
    const done = Math.min(start + QIDS_PER_QUERY, people.length);
    if (done % 2000 < QIDS_PER_QUERY) {
      console.log(`  ${done} of ${people.length}, ${found.filter((f) => f.file).length} with a picture`);
    }
    await sleep(PAUSE_MS);
  }

  const have = found.filter((f) => f.file !== null).length;
  console.log(`\n${have} of ${people.length} have a picture on Wikidata (${Math.round((have / people.length) * 100)} percent)`);

  if (!write) {
    console.log("Nothing written. Add --write to store them.");
    return;
  }
  const changed = await writeImages(url, key, found);
  console.log(`${changed} rows updated`);
}

// ---------------------------------------------------------------------------
// The people the hive files, and only them.
//
//   npm run portraits -- --hive
//   npm run portraits -- --hive --write
//
// docs/the-wall.md section 16 left faces unbuilt with image_file empty on
// every row. The hive files twelve people a date, so twelve a date is what
// gets a face: 366 dates at twelve is at most 4,392 people, about twenty two
// queries against the query service instead of a hundred and thirty, and a
// few thousand files on the site instead of twenty five thousand. The people
// are read through hivePeoplePath, the same string history.ts asks with, so
// the faces on disk are exactly the tiles that can draw one.
// ---------------------------------------------------------------------------

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Every month and day of the year, February 29 included. */
export function everyDate(): Array<{ month: number; day: number }> {
  const out: Array<{ month: number; day: number }> = [];
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= (DAYS_IN_MONTH[month - 1] ?? 31); day++) out.push({ month, day });
  }
  return out;
}

/**
 * The people the hive files, across every date, each once. A person is
 * born on one date, so the only way a duplicate arrives is a row filed
 * under two dates by mistake, and one row per identifier is what the write
 * function expects.
 */
export function uniquePeople(pages: PersonRow[][]): PersonRow[] {
  const seen = new Set<string>();
  const out: PersonRow[] = [];
  for (const page of pages) {
    for (const person of page) {
      if (seen.has(person.wikidata_qid)) continue;
      seen.add(person.wikidata_qid);
      out.push(person);
    }
  }
  return out;
}

async function hivePeople(url: string, key: string): Promise<PersonRow[]> {
  const pages: PersonRow[][] = [];
  for (const { month, day } of everyDate()) {
    const response = await fetch(`${url}/rest/v1/${hivePeoplePath(month, day)}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`people for ${month}/${day} failed with ${response.status}`);
    pages.push((await response.json()) as PersonRow[]);
  }
  return uniquePeople(pages);
}

async function hive(url: string, key: string, userAgent: string, write: boolean): Promise<void> {
  const people = await hivePeople(url, key);
  console.log(`${people.length} people across the year, at most ${PEOPLE_PER_DATE} a date`);

  const found: Array<{ qid: string; file: string | null }> = [];
  for (let start = 0; start < people.length; start += QIDS_PER_QUERY) {
    const batch = people.slice(start, start + QIDS_PER_QUERY);
    const files = await fetchPortraits(batch.map((p) => p.wikidata_qid), userAgent);
    for (const person of batch) {
      found.push({ qid: person.wikidata_qid, file: files.get(person.wikidata_qid) ?? null });
    }
    console.log(`  ${Math.min(start + QIDS_PER_QUERY, people.length)} of ${people.length}, ${found.filter((f) => f.file).length} with a picture`);
    await sleep(PAUSE_MS);
  }

  const have = found.filter((f) => f.file !== null).length;
  console.log(`\n${have} of ${people.length} have a picture on Wikidata (${Math.round((have / people.length) * 100)} percent)`);

  if (!write) {
    console.log("Nothing written. Add --write to store them, then run `npm run faces` in web/ to download them.");
    return;
  }
  const changed = await writeImages(url, key, found);
  console.log(`${changed} rows updated`);
}

async function main(): Promise<void> {
  await loadDotEnv();
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const onlyHive = args.includes("--hive");
  const write = args.includes("--write");
  const nums = args.filter((a) => /^\d+$/.test(a)).map(Number);
  const month = nums[0];
  const day = nums[1];
  if (!all && !onlyHive && (month === undefined || day === undefined)) {
    console.error("usage: npm run portraits -- <month> <day> [--out path.json]");
    console.error("       npm run portraits -- --hive --write     the twelve people a date the hive files");
    console.error("       npm run portraits -- --all --write      everybody");
    process.exit(1);
  }
  const outAt = args.indexOf("--out");
  const out = outAt >= 0 ? args[outAt + 1] : undefined;

  const config = loadConfig({ needsWrite: false });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
  if (!key) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in worker/.env");

  if (onlyHive) {
    await hive(config.supabaseUrl, key, config.userAgent, write);
    return;
  }
  if (all) {
    await everyone(config.supabaseUrl, key, config.userAgent, write);
    return;
  }

  const people = await peopleOn(month!, day!, config.supabaseUrl, key);
  const files = await fetchPortraits(people.map((p) => p.wikidata_qid), config.userAgent);

  const portraits: Portrait[] = people.map((p) => {
    const file = files.get(p.wikidata_qid) ?? null;
    return { qid: p.wikidata_qid, name: p.name, file, url: file === null ? null : filePathUrl(file) };
  });

  const have = portraits.filter((p) => p.url !== null).length;
  console.log(`${month}/${day}: ${have} of ${people.length} people have a picture on Wikidata`);
  for (const p of portraits) {
    console.log(`  ${p.url === null ? "     " : "  yes"}  ${p.name.padEnd(28)}${p.file ?? ""}`);
  }

  if (out !== undefined) {
    await writeFile(out, JSON.stringify(portraits, null, 2) + "\n", "utf8");
    console.log(`\nwrote ${out}`);
  } else {
    console.log("\nNothing written. Pass --out <path.json> to save it.");
  }
}

function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
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
