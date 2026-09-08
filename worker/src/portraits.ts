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

async function main(): Promise<void> {
  await loadDotEnv();
  const args = process.argv.slice(2);
  const nums = args.filter((a) => /^\d+$/.test(a)).map(Number);
  const month = nums[0];
  const day = nums[1];
  if (month === undefined || day === undefined) {
    console.error("usage: npm run portraits -- <month> <day> [--out path.json]");
    process.exit(1);
  }
  const outAt = args.indexOf("--out");
  const out = outAt >= 0 ? args[outAt + 1] : undefined;

  const config = loadConfig({ needsWrite: false });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
  if (!key) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in worker/.env");

  const people = await peopleOn(month, day, config.supabaseUrl, key);
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
