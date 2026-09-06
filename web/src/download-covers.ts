// Downloads every album cover onto this domain, once.
//
//   node dist/src/download-covers.js            # everything missing
//   node dist/src/download-covers.js --limit 50
//
// Kept out of `npm run site` for the same reason og.ts is: a plain content
// rebuild should stay fast and need nothing but the database. This is run when
// the chart media importer has found new covers, and what it writes is
// committed, so a deploy never depends on Apple being reachable.
//
// **Why these are copied here rather than pointed at.** The site sends
// `img-src 'self'`, and the privacy page names Supabase and Render as the only
// companies that see anything about a reader. Hotlinking Apple's image server
// would mean widening that header and adding a third company to that list, so
// that every person who opens a date page is announced to Apple, in exchange
// for a thumbnail. It also means a cover keeps working when Apple rotates an
// address, which it does.
//
// 300 by 300 rather than the 600 the importer stores. The grid draws them at
// about 150 points wide, so 300 covers a retina screen exactly and the whole
// set is about 30 megabytes instead of 150.

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { coverName, CHART_NAME } from "./songs.js";

const OUT = join("static", "covers");
const SIZE = 300;

interface Row {
  song: string;
  artist: string;
  artwork_url: string;
}

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set.");
  }
  return { url, key };
}

/** Apple's size is a path segment, not a parameter. */
export function atSize(url: string, size: number): string {
  return url.replace(/\/\d+x\d+([a-z-]*)\.(jpg|png)$/i, `/${size}x${size}$1.$2`);
}

/**
 * One row per distinct recording that has a cover.
 *
 * The same song is number one for several weeks running and appears on as many
 * date pages as it covers, so the work is per recording and the file is named
 * after the recording.
 */
async function coversToFetch(url: string, key: string): Promise<Row[]> {
  const rows: Row[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "song,artist,artwork_url",
      chart_name: `eq.${CHART_NAME}`,
      artwork_url: "not.is.null",
      order: "chart_date.desc",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${url}/rest/v1/chart_weeks?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`reading chart_weeks failed with ${response.status}`);
    }
    const page = (await response.json()) as Row[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  const seen = new Set<string>();
  const distinct: Row[] = [];
  for (const row of rows) {
    const name = coverName(row.song, row.artist);
    if (seen.has(name)) continue;
    seen.add(name);
    distinct.push(row);
  }
  return distinct;
}

async function main(): Promise<void> {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg < 0 ? 0 : Number(process.argv[limitArg + 1] ?? "0");
  const { url, key } = config();

  await mkdir(OUT, { recursive: true });
  const already = new Set(await readdir(OUT).catch(() => [] as string[]));

  let rows = await coversToFetch(url, key);
  rows = rows.filter((row) => !already.has(`${coverName(row.song, row.artist)}.jpg`));
  if (limit > 0) rows = rows.slice(0, limit);

  console.log(`${rows.length} covers to fetch, ${already.size} already here.`);

  let written = 0;
  let failed = 0;
  for (const row of rows) {
    const name = coverName(row.song, row.artist);
    try {
      const response = await fetch(atSize(row.artwork_url, SIZE));
      if (!response.ok) throw new Error(`${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      // A cover that came back as an error page rather than an image would
      // otherwise be written as a broken file that looks present forever.
      if (bytes.length < 1000) throw new Error(`only ${bytes.length} bytes`);
      await writeFile(join(OUT, `${name}.jpg`), bytes);
      written += 1;
    } catch (error) {
      failed += 1;
      console.log(`MISS  ${row.song} / ${row.artist}   ${String(error)}`);
    }
  }

  console.log(`\n${written} written, ${failed} failed.`);
  if (written > 0) {
    console.log("These are committed, so a deploy never depends on Apple being up.");
  }
}

if (process.argv[1] && process.argv[1].endsWith("download-covers.js")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
