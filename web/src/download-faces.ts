// Downloads every portrait onto this domain, once.
//
//   node dist/src/download-faces.js
//   node dist/src/download-faces.js --limit 50
//
// The same shape as download-covers.ts and for the same reason, written out
// again because it is the reason and not the code that matters.
//
// The site sends `img-src 'self'`, and the privacy page names Supabase and
// Render as the only companies that see anything about a reader. Hotlinking
// Commons would mean widening that header and announcing every visitor to the
// Wikimedia Foundation in exchange for a thumbnail. Copying the file also
// means a face keeps working when a picture is renamed or replaced upstream,
// which on Commons happens more often than it does at Apple.
//
// 400 wide, which is what the grid draws at about 190 points, so it covers a
// retina screen with nothing left over.
//
// Named from the Wikidata identifier rather than the person's name. A name is
// not unique, changes spelling between sources, and contains characters a
// filesystem argues about. The identifier is stable forever.

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { faceName } from "./render.js";

const OUT = join("static", "faces");
const WIDTH = 400;
const COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath";
const AGENT = "Birthed/0.1 (https://birthed.app; support@birthed.app) face fetch";

interface Row {
  wikidata_qid: string;
  image_file: string;
}

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set.");
  return { url, key };
}

export function fileUrl(file: string, width = WIDTH): string {
  return `${COMMONS}/${encodeURIComponent(file.replace(/ /g, "_"))}?width=${width}`;
}

async function facesToFetch(url: string, key: string): Promise<Row[]> {
  const rows: Row[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "wikidata_qid,image_file",
      image_file: "not.is.null",
      order: "monthly_views.desc.nullslast",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${url}/rest/v1/notable_people?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`faces failed with ${response.status}`);
    const page = (await response.json()) as Row[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function main(): Promise<void> {
  const { url, key } = config();
  const limitAt = process.argv.indexOf("--limit");
  const limit = limitAt >= 0 ? Number(process.argv[limitAt + 1]) : Infinity;

  await mkdir(OUT, { recursive: true });
  const already = new Set(await readdir(OUT).catch(() => [] as string[]));

  const rows = await facesToFetch(url, key);
  // Ordered by pageviews, so a run stopped early has fetched the faces that
  // appear at the top of a date page rather than a random slice of them.
  const missing = rows.filter((row) => !already.has(`${faceName(row.wikidata_qid)}.jpg`));
  console.log(`${rows.length} people have a picture, ${already.size} already here, ${missing.length} to fetch`);

  let written = 0;
  let failed = 0;
  for (const row of missing.slice(0, limit)) {
    try {
      const response = await fetch(fileUrl(row.image_file), { headers: { "User-Agent": AGENT } });
      if (!response.ok) {
        // A missing or renamed file is one monogram, not a reason to stop. The
        // renderer already draws those and has since before faces existed.
        failed++;
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(join(OUT, `${faceName(row.wikidata_qid)}.jpg`), bytes);
      written++;
      if (written % 200 === 0) console.log(`  ${written} written`);
    } catch {
      failed++;
    }
    // Commons is donated infrastructure and this is a bulk read of it.
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(`wrote ${written} faces into ${OUT}, ${failed} could not be fetched`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
