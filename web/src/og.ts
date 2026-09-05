// Renders the share image for every date, once, into out/og.
//
// Kept out of `npm run site` on purpose. The pages build with no browser and
// no native dependency; only this step needs Chromium, so a plain content
// rebuild stays fast and the site can be deployed without it.
//
//   npx playwright install chromium     # once
//   npm run og

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { everyDate, slug, type DayPage, type Person } from "./model.js";
import { renderShareCard } from "./share.js";

const OUT = join("out", "og");
const WIDTH = 1200;
const HEIGHT = 630;

interface Row {
  wikidata_qid: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  short_description: string | null;
}

function config() {
  const url = (process.env.SUPABASE_URL ?? "https://lunqqhjwqrpbujwxwdzk.supabase.co").replace(/\/+$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("Set SUPABASE_ANON_KEY. It is the publishable key and it is safe to ship.");
  return { url, key };
}

async function fetchDay(month: number, day: number, url: string, key: string): Promise<DayPage> {
  const query = new URLSearchParams({
    select: "wikidata_qid,name,birth_year,death_year,short_description",
    birth_month: `eq.${month}`,
    birth_day: `eq.${day}`,
    order: "notability_score.desc",
    limit: "3",
  });
  const response = await fetch(`${url}/rest/v1/notable_people?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${month}/${day} failed with ${response.status}`);
  const rows = (await response.json()) as Row[];
  const people: Person[] = rows.map((row) => ({
    qid: row.wikidata_qid,
    name: row.name,
    birthYear: row.birth_year,
    deathYear: row.death_year,
    description: row.short_description,
  }));
  return { month, day, people };
}

async function main(): Promise<void> {
  const { url, key } = config();
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

  let written = 0;
  for (const date of everyDate()) {
    const day = await fetchDay(date.month, date.day, url, key);
    await page.setContent(renderShareCard(day), { waitUntil: "load" });
    const shot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
    await writeFile(join(OUT, `${slug(date.month, date.day)}.png`), shot);
    written++;
    if (written % 30 === 0) console.log(`  ${written} of 366`);
  }

  await browser.close();
  console.log(`wrote ${written} share images into ${OUT}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
