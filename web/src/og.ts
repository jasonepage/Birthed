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
import { factsByDay, factsForDate, fetchFacts } from "./facts.js";
import { everyDate, slug, type DayPage, type Person } from "./model.js";
import { cardHighlight, renderShareCard, type CardHive } from "./share.js";
import { eventsByDay, eventsForDate, fetchEvents } from "./timeline.js";
import { fetchWall, newestByDate, wallKey } from "./wall.js";
import { coverageByDay, fetchChartWeeks, songsForDate, withDownloadedCovers } from "./songs.js";
import { picturesFor } from "./render.js";
import { readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const OUT = join("out", "og");
const WIDTH = 1200;
const HEIGHT = 630;

interface Row {
  wikidata_qid: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  short_description: string | null;
  image_file: string | null;
}

/** The chart years the site draws, the same two numbers build.ts uses. */
const FIRST_CHART_YEAR = 1959;

function config() {
  const url = (process.env.SUPABASE_URL ?? "https://lunqqhjwqrpbujwxwdzk.supabase.co").replace(/\/+$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("Set SUPABASE_ANON_KEY. It is the publishable key and it is safe to ship.");
  return { url, key };
}

async function fetchDay(month: number, day: number, url: string, key: string): Promise<DayPage> {
  const query = new URLSearchParams({
    select: "wikidata_qid,name,birth_year,death_year,short_description,image_file",
    birth_month: `eq.${month}`,
    birth_day: `eq.${day}`,
    order: "notability_score.desc",
    // Forty rather than three: the card names three, and the hive card
    // needs to know which people on the date have a face on disk.
    limit: "40",
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
    // The share card does not rank anything, it just draws the three it was
    // given in the order they arrived.
    monthlyViews: 0,
    hasImage: row.image_file !== null,
  }));
  return { month, day, people };
}

async function main(): Promise<void> {
  const { url, key } = config();
  await mkdir(OUT, { recursive: true });

  // Read whole, once, the way the site build does. A card is one line of text
  // out of a few thousand rows, and 366 lookups for that would be silly.
  const facts = factsByDay(await fetchFacts(url, key));
  console.log(`facts loaded for ${facts.size} dates`);
  const events = eventsByDay(await fetchEvents(url, key));
  console.log(`events loaded for ${events.size} dates`);
  // The hive for each date, and the covers on disk, so a date with a hive
  // gets a card that looks like its board. The pictures are handed in as
  // file addresses: the card is screenshotted from a page with no origin,
  // where "/covers/x.jpg" resolves to nothing.
  const wallFor = newestByDate(await fetchWall(url, key));
  const files = await readdir(join("static", "covers")).catch(() => [] as string[]);
  const covered = coverageByDay(withDownloadedCovers(await fetchChartWeeks(url, key), files));
  const thisYear = new Date().getUTCFullYear();
  const onDisk = (path: string): string => pathToFileURL(resolve("static", path.replace(/^\//, ""))).href;
  console.log(`hives loaded for ${wallFor.size} dates`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

  let written = 0;
  let carrying = 0;
  let hived = 0;
  for (const date of everyDate()) {
    const day = await fetchDay(date.month, date.day, url, key);
    const wall = wallFor.get(wallKey(date.month, date.day)) ?? null;
    let hive: CardHive | null = null;
    if (wall !== null) {
      const songs = songsForDate(covered, date.month, date.day, FIRST_CHART_YEAR, thisYear);
      hive = { day: wall, pictures: new Map(picturesFor(songs, day.people).map((p) => [p.subject, onDisk(p.path)])) };
      if (wall.stories.some((s) => s.rect !== null)) hived++;
    }
    const highlight = cardHighlight(
      factsForDate(facts, date.month, date.day),
      eventsForDate(events, date.month, date.day),
      date.month,
      date.day,
    );
    if (highlight) carrying++;
    await page.setContent(renderShareCard(day, highlight, hive), { waitUntil: "load" });
    const shot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
    await writeFile(join(OUT, `${slug(date.month, date.day)}.png`), shot);
    written++;
    if (written % 30 === 0) console.log(`  ${written} of 366`);
  }

  await browser.close();
  console.log(`wrote ${written} share images into ${OUT}`);
  console.log(`${hived} of them show a hive, ${carrying} say what happened, ${written - carrying} are names only`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
