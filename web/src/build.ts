// Builds the static site. One page per calendar date, an index, a sitemap and
// a robots file, straight out of the same table the app reads.
//
//   cp .env.example .env      # then put the anonymous key in it
//   npm run site
//
// The key can also just be exported in the shell. A .env file is read only if
// one is there, which is why the flag is --env-file-if-exists: without that,
// Node refuses to start when the file is absent and the shell route breaks.
//
// Output lands in web/out, which is what a static host points at.

import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DayPage, Person, everyDate, slug } from "./model.js";
import { coverageByDay, fetchChartWeeks, songsForDate } from "./songs.js";
import { factsByDay, factsForDate, fetchFacts } from "./facts.js";
import { isReady, renderDayPage, renderNotFound, renderRobots, renderSitemap } from "./render.js";
import { renderAdd, renderHome, renderPrivacy, renderSupport } from "./pages.js";

const OUT = "out";
const PER_PAGE = 10;
const CONCURRENCY = 8;

interface Row {
  wikidata_qid: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  short_description: string | null;
  monthly_views: number | null;
}

function config() {
  const url = (process.env.SUPABASE_URL ?? "https://lunqqhjwqrpbujwxwdzk.supabase.co").replace(/\/+$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Set SUPABASE_ANON_KEY. It is the publishable key, safe to ship, and it is in the Supabase dashboard under Project Settings, API Keys.",
    );
  }
  return { url, key };
}

async function fetchDay(month: number, day: number, url: string, key: string): Promise<DayPage> {
  const query = new URLSearchParams({
    select: "wikidata_qid,name,birth_year,death_year,short_description,monthly_views",
    birth_month: `eq.${month}`,
    birth_day: `eq.${day}`,
    order: "notability_score.desc",
    limit: String(PER_PAGE),
  });
  const response = await fetch(`${url}/rest/v1/notable_people?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${month}/${day} failed with ${response.status}`);
  }
  const rows = (await response.json()) as Row[];
  const people: Person[] = rows.map((row) => ({
    qid: row.wikidata_qid,
    name: row.name,
    birthYear: row.birth_year,
    deathYear: row.death_year,
    description: row.short_description,
    monthlyViews: row.monthly_views ?? 0,
  }));
  return { month, day, people };
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  for (let start = 0; start < items.length; start += size) {
    await Promise.all(items.slice(start, start + size).map(work));
  }
}

const FIRST_CHART_YEAR = 1959;

async function main(): Promise<void> {
  const { url, key } = config();
  const dates = everyDate();
  let written = 0;
  let empty = 0;
  const ready: Array<{ month: number; day: number }> = [];

  await mkdir(OUT, { recursive: true });

  // The whole chart table once, rather than 366 lookups. It is a few thousand
  // rows, and every date page needs a slice of it.
  const weeks = await fetchChartWeeks(url, key);
  const covered = coverageByDay(weeks);
  const thisYear = new Date().getUTCFullYear();
  console.log(`${weeks.length} chart weeks loaded`);
  if (weeks.length === 0) {
    console.log("no chart weeks, so the pages will have no songs on them");
    console.log("run the worker's import:songs first");
  }

  // Every calendar date fact at once, for the same reason as the charts: a
  // few thousand rows answer all 366 pages, and 366 lookups would not.
  const facts = await fetchFacts(url, key);
  const factsFor = factsByDay(facts);
  console.log(`${facts.length} found facts loaded, covering ${factsFor.size} dates`);
  if (factsFor.size < 366) {
    console.log(`${366 - factsFor.size} dates have no facts yet, and their pages simply will not have that section`);
  }

  await inBatches(dates, CONCURRENCY, async (date) => {
    const page = await fetchDay(date.month, date.day, url, key);
    if (page.people.length === 0) empty++;
    const songs = songsForDate(covered, date.month, date.day, FIRST_CHART_YEAR, thisYear);
    const found = factsForDate(factsFor, date.month, date.day);
    if (isReady(page, found)) ready.push(date);
    const directory = join(OUT, slug(date.month, date.day));
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "index.html"), renderDayPage(page, songs, found), "utf8");
    written++;
  });

  await writeFile(join(OUT, "index.html"), renderHome(), "utf8");
  await mkdir(join(OUT, "support"), { recursive: true });
  await writeFile(join(OUT, "support", "index.html"), renderSupport(), "utf8");
  await mkdir(join(OUT, "privacy"), { recursive: true });
  await writeFile(join(OUT, "privacy", "index.html"), renderPrivacy(), "utf8");
  // The landing page for a shared birthday. Carries noindex: it is a handover
  // between two people, not something anybody should find in a search result.
  await mkdir(join(OUT, "add"), { recursive: true });
  await writeFile(join(OUT, "add", "index.html"), renderAdd(), "utf8");
  // The favicons and touch icons, copied as they are.
  await cp("static", OUT, { recursive: true });
  await writeFile(join(OUT, "sitemap.xml"), renderSitemap(ready), "utf8");
  await writeFile(join(OUT, "robots.txt"), renderRobots(), "utf8");
  await writeFile(join(OUT, "404.html"), renderNotFound(), "utf8");

  console.log(`wrote ${written} date pages into ${OUT}, ${empty} of them with nobody in`);
  console.log(`${ready.length} are ready and in the sitemap, ${written - ready.length} carry noindex until they are`);
  if (ready.length < written) {
    console.log("run the worker's import-all --only-missing to finish the rest, then build again");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
