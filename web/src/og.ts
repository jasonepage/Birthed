// Renders the share pictures for every date, once, into out/og.
//
// Two shapes a date, from the same browser and the same staged HTML:
//
//   <date>.png         1200 by 630, the link preview, cropped to that strip by
//                      every platform that draws one.
//   <date>-square.png  1080 by 1080, the board at its own proportions, which is
//                      the one somebody saves and puts somewhere else.
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
import { cardHighlight, FIRST_BIRTH_YEAR, LAST_BIRTH_YEAR, personalName, renderPersonalSquare, renderShareCard, renderSquare, SQUARE_SIDE, type CardHive } from "./share.js";
import { eventsByDay, eventsForDate, fetchEvents } from "./timeline.js";
import { fetchWall, newestByDate, subjectOf, wallKey } from "./wall.js";
import { coverageByDay, fetchChartWeeks, songsForDate, withDownloadedCovers } from "./songs.js";
import { picturesFor } from "./render.js";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const OUT = join("out", "og");
/**
 * Where a reader's own picture goes, and it is deliberately not under `out/`.
 *
 * Everything under `out/` is reachable by asking for its path, and these are
 * one reader's own. `serve.ts` opens them by name and streams the bytes at an
 * address that carries only the date; nothing routes to this folder.
 */
const PERSONAL = process.env.PERSONAL_ROOT ?? "personal";

/**
 * How far either side of today a date gets pictures for every birth year.
 *
 * Three days each way, which is the three open dates and a little slack, so a
 * deploy on Monday still has the right pictures on Thursday. It is a window
 * rather than every date because the arithmetic is one picture per date per
 * birth year: 91 years across seven dates is a few hundred files and about a
 * minute, and across all 366 it would be 33,000 files, ten gigabytes and half
 * an hour of build. A date outside the window falls back to the plain square,
 * which is the right thing to fall back to.
 */
const PERSONAL_DAYS = 3;
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
    order: "world_score.desc",
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
  const facesOnDisk = new Set(await readdir(join("static", "faces")).catch(() => [] as string[]));
  const covered = coverageByDay(withDownloadedCovers(await fetchChartWeeks(url, key), files));
  const thisYear = new Date().getUTCFullYear();

  /**
   * A picture, as bytes inside the card rather than as an address pointing out
   * of it.
   *
   * **A file address does not work here and never did.** The card is put in
   * front of the browser with setContent, which leaves the page on an opaque
   * origin, and Chromium refuses every file:// subresource such a page asks
   * for: "Not allowed to load local resource", as a failed request with
   * nothing thrown and nothing on the picture. So every cover and every face
   * on a hive card has been drawing as an empty dark tile since the day the
   * card learned to draw them, because a tile with a picture also takes the
   * scrim and the light type and the two together look deliberate.
   *
   * A relative path was the first thing tried and it fails for the same
   * reason with a different message. Inlining the bytes is the only shape
   * that needs no origin at all, and it keeps the one rendering path exactly
   * as it is: still Playwright, still staged HTML, still one screenshot.
   *
   * Read once each. A cover belongs to a chart week and a face to a person,
   * so the same handful of files come round on many of the 366 dates.
   */
  const inlined = new Map<string, string>();
  const picture = async (path: string): Promise<string> => {
    const found = inlined.get(path);
    if (found !== undefined) return found;
    const bytes = await readFile(resolve("static", path.replace(/^\//, "")));
    const kind = path.endsWith(".png") ? "image/png" : "image/jpeg";
    const uri = `data:${kind};base64,${bytes.toString("base64")}`;
    inlined.set(path, uri);
    return uri;
  };
  console.log(`hives loaded for ${wallFor.size} dates`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  // A second page rather than resizing the first one between every shot: a
  // viewport change is a relayout and there are 366 of each.
  const square = await browser.newPage({ viewport: { width: SQUARE_SIDE, height: SQUARE_SIDE } });

  let written = 0;
  let squares = 0;
  let personal = 0;
  await mkdir(PERSONAL, { recursive: true });
  // The window, as real dates, so it crosses a month end and a year end the
  // way the wall's own arithmetic does.
  const middle = Date.now();
  const inWindow = new Set<string>();
  for (let offset = -PERSONAL_DAYS; offset <= PERSONAL_DAYS; offset++) {
    inWindow.add(new Date(middle + offset * 86_400_000).toISOString().slice(0, 10));
  }
  let carrying = 0;
  let hived = 0;
  for (const date of everyDate()) {
    const day = await fetchDay(date.month, date.day, url, key);
    const wall = wallFor.get(wallKey(date.month, date.day)) ?? null;
    let hive: CardHive | null = null;
    if (wall !== null) {
      const songs = songsForDate(covered, date.month, date.day, FIRST_CHART_YEAR, thisYear);
      // Only the subjects that are actually on a tile. picturesFor answers for
      // every chart week and every one of the forty people it was handed, and
      // a board draws at most a dozen, so without this the kept bytes converge
      // on the whole of static/ once every date has a wall: 177 megabytes of
      // pictures is about 247 megabytes of base64 held for the life of the
      // process, beside a Chromium already measured at 700.
      const onTiles = new Set(wall.stories
        .filter((s) => s.rect !== null && (s.status === "placed" || s.status === "false"))
        .map((s) => subjectOf(s))
        .filter((s): s is string => s !== null));
      const found = picturesFor(songs, day.people, facesOnDisk).filter((p) => onTiles.has(p.subject));
      hive = { day: wall, pictures: new Map(await Promise.all(found.map(async (p) => [p.subject, await picture(p.path)] as const))) };
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
    // Every date gets a square, with a hive on it or without one. A date with
    // no board is 362 of the 366 today, and it gets the one sourced thing that
    // happened on it rather than no picture at all.
    await square.setContent(renderSquare(day, highlight, hive), { waitUntil: "load" });
    const tall = await square.screenshot({ type: "png", clip: { x: 0, y: 0, width: SQUARE_SIDE, height: SQUARE_SIDE } });
    await writeFile(join(OUT, `${slug(date.month, date.day)}-square.png`), tall);
    squares++;
    // And, for a date whose hive is near enough to today to be worth sharing,
    // one picture per birth year, each with the story its reader's own
    // arithmetic picked out of that board.
    if (hive !== null && inWindow.has(wall!.wallDate)) {
      for (let born = FIRST_BIRTH_YEAR; born <= LAST_BIRTH_YEAR; born++) {
        const html = renderPersonalSquare(day, hive, born);
        if (html === null) continue;
        await square.setContent(html, { waitUntil: "load" });
        const mine = await square.screenshot({ type: "png", clip: { x: 0, y: 0, width: SQUARE_SIDE, height: SQUARE_SIDE } });
        await writeFile(join(PERSONAL, `${personalName(wall!.wallDate, born)}.png`), mine);
        personal++;
      }
    }
    if (written % 30 === 0) console.log(`  ${written} of 366`);
  }

  await browser.close();
  console.log(`wrote ${written} share images and ${squares} squares into ${OUT}`);
  console.log(`wrote ${personal} readers\u2019 own pictures into ${PERSONAL}`);
  console.log(`${hived} of them show a hive, ${carrying} say what happened, ${written - carrying} are names only`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
