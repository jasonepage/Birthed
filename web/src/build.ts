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

import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DayPage, Person, everyDate, slug } from "./model.js";
import { coverageByDay, fetchChartWeeks, songsForDate, withDownloadedCovers } from "./songs.js";
import { buildSeed, factsByDay, factsForDate, fetchFacts, pickHighlights } from "./facts.js";
import { isReady, renderDayPage, renderNotFound, renderRobots, renderSitemap } from "./render.js";
import { eventsByDay, eventsForDate, fetchEvents, fetchSealedMemory } from "./timeline.js";
import { culturalByDate, culturalForDate, fetchCulturalEvents } from "./culture.js";
import { renderAdd, renderHome, renderPrivacy, renderSupport } from "./pages.js";
import { renderAdmin } from "./admin.js";

const OUT = "out";
const PER_PAGE = 10;
const CONCURRENCY = 8;

interface Row {
  wikidata_qid: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  short_description: string | null;
  image_file: string | null;
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
    select: "wikidata_qid,name,birth_year,death_year,short_description,monthly_views,image_file",
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
    hasImage: row.image_file !== null,
  }));
  return { month, day, people };
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  for (let start = 0; start < items.length; start += size) {
    await Promise.all(items.slice(start, start + size).map(work));
  }
}

const FIRST_CHART_YEAR = 1959;

/** How many real facts the front door carries. Twelve is one out of every month. */
const HOME_HIGHLIGHTS = 12;

async function main(): Promise<void> {
  const { url, key } = config();
  const dates = everyDate();
  let written = 0;
  let empty = 0;
  const ready: Array<{ month: number; day: number }> = [];

  await mkdir(OUT, { recursive: true });

  // The whole chart table once, rather than 366 lookups. It is a few thousand
  // rows, and every date page needs a slice of it.
  const found = await fetchChartWeeks(url, key);
  // What the table says, checked against what is on disk. A page must not
  // point at a cover we have not got.
  const files = await readdir(join("static", "covers")).catch(() => [] as string[]);
  const weeks = withDownloadedCovers(found, files);
  const claimed = found.filter((week) => week.hasArtwork === true).length;
  const drawn = weeks.filter((week) => week.hasArtwork === true).length;
  if (claimed > drawn) {
    console.log(
      `${claimed - drawn} chart weeks have a cover in the database that is not in static/covers, ` +
      `so those tiles fall back to the made one. Run npm run covers, then build again.`,
    );
  }
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

  // Read whole for the same reason the facts are: twenty thousand rows answer
  // all 366 pages in one pass, and 366 lookups would not.
  const events = await fetchEvents(url, key);
  const eventsFor = eventsByDay(events);
  console.log(`${events.length} Wikipedia events loaded, covering ${eventsFor.size} dates`);

  // The curated rows. Read whole like the others, and there are far fewer of
  // them: this table is written by hand, one date at a time, and is meant to
  // stay that way. An empty table is a normal state and not a failure, so it
  // says so plainly rather than warning about it: on a date with none of these
  // the page is exactly the page it was before.
  const culture = await fetchCulturalEvents(url, key);
  const cultureFor = culturalByDate(culture);
  console.log(
    culture.length === 0
      ? "no curated cultural rows yet, so no page has one"
      : `${culture.length} curated cultural rows loaded, covering ${cultureFor.size} dates`,
  );

  // What the sealed dates decided. Almost always empty, and that is the normal
  // state: a date only seals once its three days are up.
  //
  // Baked in here rather than read on request, because a sealed date can never
  // take another answer, so its order can never change again. A fixed thing
  // belongs in the file, and it keeps the promise the server makes: an
  // ordinary page view calls nothing.
  const memory = await fetchSealedMemory(url, key);
  console.log(
    memory.size === 0
      ? "no dates have sealed yet, so every page is in its ordinary order"
      : `${memory.size} sealed dates will be laid out in the order their own people remembered them`,
  );

  await inBatches(dates, CONCURRENCY, async (date) => {
    const page = await fetchDay(date.month, date.day, url, key);
    if (page.people.length === 0) empty++;
    const songs = songsForDate(covered, date.month, date.day, FIRST_CHART_YEAR, thisYear);
    const found = factsForDate(factsFor, date.month, date.day);
    const happened = eventsForDate(eventsFor, date.month, date.day);
    const curated = culturalForDate(cultureFor, date.month, date.day);
    if (isReady(page, found)) ready.push(date);
    const directory = join(OUT, slug(date.month, date.day));
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "index.html"),
      renderDayPage(page, songs, found, happened, curated,
                    memory.get(`${date.month}-${date.day}`) ?? null),
      "utf8",
    );
    written++;
  });

  // The front door shows six real facts off six real date pages, because a
  // landing page for a site whose value is 366 pages of content that shows
  // none of the content is asking to be taken on trust. They cost nothing:
  // every fact is already in memory by the time this line runs.
  const highlights = pickHighlights(facts, HOME_HIGHLIGHTS, buildSeed());
  if (highlights.length < HOME_HIGHLIGHTS) {
    console.log(`only ${highlights.length} facts on the front door, out of ${HOME_HIGHLIGHTS}`);
  }
  await mkdir(join(OUT, "about"), { recursive: true });
  await writeFile(join(OUT, "about", "index.html"), renderHome(thisYear, highlights), "utf8");
  // index.html is a copy of today's date page rather than a page of its own.
  //
  // serve.ts answers "/" by reading the file for whatever date it is when the
  // request arrives, so this copy is only what a plain static host would fall
  // back to. It is written from the same renderer, so there is one template
  // and not two, and the canonical inside it names the dated address, which
  // is the one that should be indexed.
  const now = new Date();
  const todaySlug = slug(now.getUTCMonth() + 1, now.getUTCDate());
  await cp(join(OUT, todaySlug, "index.html"), join(OUT, "index.html"));
  await mkdir(join(OUT, "support"), { recursive: true });
  await writeFile(join(OUT, "support", "index.html"), renderSupport(), "utf8");
  await mkdir(join(OUT, "privacy"), { recursive: true });
  await writeFile(join(OUT, "privacy", "index.html"), renderPrivacy(), "utf8");
  // The landing page for a shared birthday. Carries noindex: it is a handover
  // between two people, not something anybody should find in a search result.
  // It gets the anonymous key because one of its three modes posts an answer
  // back to a request somebody made in the app. Shipping that key in a page is
  // the same thing the app does: it grants nothing on its own, and the write
  // it can reach goes through a function that decides what is allowed.
  await mkdir(join(OUT, "add"), { recursive: true });
  await writeFile(join(OUT, "add", "index.html"), renderAdd({ url, key }), "utf8");
  // The curation panel. Carries the same publishable key as /add and the app,
  // and is noindex. What anybody may actually do there is decided by a row
  // level security policy against their own token, not by this page.
  await mkdir(join(OUT, "admin"), { recursive: true });
  await writeFile(join(OUT, "admin", "index.html"), renderAdmin({ url, key }), "utf8");
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
