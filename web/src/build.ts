// Builds the static site. One page per calendar date, each carrying that
// date's hive, plus the hive pages, the receipts, the About, support and
// privacy pages, a sitemap and a robots file.
//
//   cp .env.example .env      # then put the anonymous key in it
//   npm run site
//
// The key can also just be exported in the shell. A .env file is read only if
// one is there, which is why the flag is --env-file-if-exists: without that,
// Node refuses to start when the file is absent and the shell route breaks.
//
// Output lands in web/out, which is what a static host points at.
//
// Stripped to the hive on October 18, 2026, docs/strip-to-the-hive.md. The
// date page used to carry the archive of the date (history, people, the
// number ones), so the build read people for every date, the found facts,
// Wikipedia's events, the curated rows, the lead lines, the selections and
// the sealed memory. None of that is on a page any more, so none of it is
// read. What is left is the walls, the pictures for the tiles on them, and
// the chart weeks, which say which cover a number one tile draws.

import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { everyDate, slug } from "./model.js";
import { answerPictures, fetchWall, newestByDate, picturedSubjects, storyPath, subjectOf, wallKey, type Picture, type WallDay } from "./wall.js";
import { coverName, coverageByDay, fetchChartWeeks, songsForDate, withDownloadedCovers } from "./songs.js";
import { faceName, hasBoard, renderCalendarPage, renderDayPage, renderNotFound, renderRobots, renderSitemap, renderHivePage, renderStoryPage } from "./render.js";
import { fetchStoredPictures, pictureKeyOf, type StoredPicture } from "./stored-pictures.js";
import { renderAdd, renderHome, renderPrivacy, renderSupport } from "./pages.js";
import { renderAdmin, renderNumbers } from "./admin.js";

const OUT = "out";
const FIRST_CHART_YEAR = 1959;

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

/**
 * Every picture the build holds for the tiles on one board: the project's
 * stored pictures for events and news, the song answers' covers, a number
 * one's cover from static/covers and a person's face from static/faces.
 * Only for tiles that are on the board, because a rule for a story nobody
 * can see is weight and nothing else.
 *
 * Read from the stories' own subjects rather than from a list of the date's
 * people, which is what lets the build stop reading people at all. A face or
 * a cover is offered only when the file is on disk.
 */
export function boardPictures(
  day: WallDay,
  stored: ReadonlyMap<string, StoredPicture>,
  facesOnDisk: ReadonlySet<string>,
  coverFor: ReadonlyMap<string, string>,
): Picture[] {
  const drawn = picturedSubjects(day);
  const out: Picture[] = [];
  for (const story of day.stories) {
    const subject = subjectOf(story) ?? `story:${story.id}`;
    if (!drawn.has(subject)) continue;
    const kept = stored.get(pictureKeyOf(story));
    if (kept !== undefined) {
      out.push(kept);
      continue;
    }
    if (story.subjectKind === "person" && story.subjectId !== null) {
      const file = `${faceName(story.subjectId)}.jpg`;
      if (facesOnDisk.has(file)) out.push({ subject, path: `/faces/${file}` });
    } else if (story.subjectKind === "song" && story.subjectId !== null) {
      const cover = coverFor.get(story.subjectId);
      if (cover !== undefined) out.push({ subject, path: `/covers/${cover}.jpg` });
    }
  }
  return [...out, ...answerPictures(day).filter((p) => drawn.has(p.subject))];
}

async function main(): Promise<void> {
  const { url, key } = config();
  const dates = everyDate();
  let written = 0;
  const ready: Array<{ month: number; day: number }> = [];

  await mkdir(OUT, { recursive: true });

  // The covers a number one tile can draw, by its chart date. The whole chart
  // table once, checked against the covers on disk, so a tile never points at
  // a cover that is not here.
  const found = await fetchChartWeeks(url, key);
  const coverFiles = await readdir(join("static", "covers")).catch(() => [] as string[]);
  const weeks = withDownloadedCovers(found, coverFiles);
  const covered = coverageByDay(weeks);
  const thisYear = new Date().getUTCFullYear();
  const coverFor = new Map<string, string>();
  for (const date of dates) {
    for (const song of songsForDate(covered, date.month, date.day, FIRST_CHART_YEAR, thisYear)) {
      if (song.hasArtwork === true) coverFor.set(song.chartDate, coverName(song.song, song.artist));
    }
  }
  // The faces on disk, so a tile never draws a face that is not here.
  const facesOnDisk = new Set(await readdir(join("static", "faces")).catch(() => [] as string[]));

  // The wall. Read whole: the rectangles are stored, so the page only draws them.
  const walls = await fetchWall(url, key);
  const wallFor = newestByDate(walls);
  console.log(
    walls.length === 0
      ? "no wall days yet, so no page carries a wall"
      : `${walls.length} wall days loaded, ${walls.reduce((n, d) => n + d.stories.length, 0)} stories, covering ${wallFor.size} dates`,
  );

  // The pictures the project holds for tiles: the events' lead pictures and
  // the news stories' preview pictures, both put in the bucket by the worker
  // and credited on the receipt.
  const stored = await fetchStoredPictures(url, key);

  // The faces and covers some page actually draws. Only these are copied into
  // the deploy, rather than all of static/faces and static/covers, which were
  // about 176 megabytes on October 18, 2026 and existed for the archive the
  // date page no longer carries. A tile placed after the deploy draws its
  // colour until the next one.
  const used = new Set<string>();
  const picturesByKey = new Map<string, Picture[]>();
  for (const date of dates) {
    const key = wallKey(date.month, date.day);
    const wall = wallFor.get(key) ?? null;
    const pictures = wall === null ? [] : boardPictures(wall, stored, facesOnDisk, coverFor);
    picturesByKey.set(key, pictures);
    for (const p of pictures) if (p.path.startsWith("/faces/") || p.path.startsWith("/covers/")) used.add(p.path);
    if (hasBoard(wall)) ready.push(date);
    const directory = join(OUT, slug(date.month, date.day));
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "index.html"), renderDayPage(date, wall, pictures), "utf8");
    written++;
  }

  // One receipt page per story on every year's wall, under its date. A
  // story from an earlier year keeps its page after a newer wall takes the
  // hive on the date page.
  let receipts = 0;
  for (const day of walls) {
    for (const story of day.stories) {
      const directory = join(OUT, storyPath(story).slice(1));
      await mkdir(directory, { recursive: true });
      const credit = stored.get(pictureKeyOf(story)) ?? null;
      await writeFile(join(directory, "index.html"), renderStoryPage(story, day, Date.now(), { credit }), "utf8");
      receipts++;
    }
  }
  if (receipts > 0) console.log(`wrote ${receipts} wall story pages`);

  // The full screen hive, one per date that has a wall, drawn from the
  // newest year the way the date page is. Swapped live by serve.ts while the
  // date is open.
  let hives = 0;
  for (const [key, day] of wallFor) {
    const [month, d] = key.split("-").map(Number) as [number, number];
    const directory = join(OUT, slug(month, d), "hive");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "index.html"), renderHivePage(day, month, d, picturesByKey.get(key) ?? []), "utf8");
    hives++;
  }
  if (hives > 0) console.log(`wrote ${hives} hive pages`);

  // The index of all 366. Linked from nothing in the bar since October 18,
  // 2026, and still answered, because /every-date sends people here.
  await mkdir(join(OUT, "calendar"), { recursive: true });
  await writeFile(join(OUT, "calendar", "index.html"), renderCalendarPage(thisYear), "utf8");

  await mkdir(join(OUT, "about"), { recursive: true });
  await writeFile(join(OUT, "about", "index.html"), renderHome(), "utf8");
  // index.html is a copy of today's date page rather than a page of its own.
  // serve.ts answers "/" by reading the file for whatever date it is when the
  // request arrives, so this copy is only what a plain static host would fall
  // back to.
  const now = new Date();
  const todaySlug = slug(now.getUTCMonth() + 1, now.getUTCDate());
  await cp(join(OUT, todaySlug, "index.html"), join(OUT, "index.html"));
  await mkdir(join(OUT, "support"), { recursive: true });
  await writeFile(join(OUT, "support", "index.html"), renderSupport(), "utf8");
  await mkdir(join(OUT, "privacy"), { recursive: true });
  await writeFile(join(OUT, "privacy", "index.html"), renderPrivacy(), "utf8");
  // The landing page for a shared birthday, from the app. noindex.
  await mkdir(join(OUT, "add"), { recursive: true });
  await writeFile(join(OUT, "add", "index.html"), renderAdd({ url, key }), "utf8");
  // The curation panel and the four numbers. What anybody may do there is
  // decided by a row level security policy against their own token.
  await mkdir(join(OUT, "admin"), { recursive: true });
  await writeFile(join(OUT, "admin", "index.html"), renderAdmin({ url, key }), "utf8");
  await mkdir(join(OUT, "admin", "numbers"), { recursive: true });
  await writeFile(join(OUT, "admin", "numbers", "index.html"), renderNumbers({ url, key }), "utf8");
  // The favicons, fonts and sounds, copied as they are, and of the faces and
  // covers only the ones a page draws.
  await cp("static", OUT, {
    recursive: true,
    filter: (source) => !/(^|[\\/])static[\\/](faces|covers)([\\/]|$)/.test(source),
  });
  for (const path of used) {
    await mkdir(join(OUT, path.split("/")[1]!), { recursive: true });
    await cp(join("static", path), join(OUT, path)).catch(() => undefined);
  }
  await writeFile(join(OUT, "sitemap.xml"), renderSitemap(ready), "utf8");
  await writeFile(join(OUT, "robots.txt"), renderRobots(), "utf8");
  await writeFile(join(OUT, "404.html"), renderNotFound(), "utf8");

  console.log(`wrote ${written} date pages into ${OUT}, ${ready.length} of them with a board`);
  console.log(`copied ${used.size} faces and covers that a board draws`);
}

// Only when run directly, so a test can import boardPictures.
const entry = process.argv[1] ?? "";
if (entry.endsWith("build.js") || entry.endsWith("build.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
