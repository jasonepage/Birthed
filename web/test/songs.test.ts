import { strict as assert } from "node:assert";
import { test } from "node:test";

import { renderSitemap } from "../src/render.js";
import { ChartWeek, coverageByDay, dateExists, songsForDate, coverName, withDownloadedCovers } from "../src/songs.js";

/** Four consecutive Saturdays, the way the table actually holds them. */
const WEEKS: ChartWeek[] = [
  { chartDate: "2005-09-03", song: "We Belong Together", artist: "Mariah Carey" },
  { chartDate: "2005-09-10", song: "We Belong Together", artist: "Mariah Carey" },
  { chartDate: "2005-09-17", song: "Gold Digger", artist: "Kanye West featuring Jamie Foxx" },
  { chartDate: "2004-09-04", song: "Slow Motion", artist: "Juvenile featuring Soulja Slim" },
];

test("a chart week covers its issue date and the six days before it", () => {
  const covered = coverageByDay(WEEKS);
  assert.equal(covered.get("2005-09-17")?.song, "Gold Digger");
  assert.equal(covered.get("2005-09-11")?.song, "Gold Digger");
  // The seventh day back belongs to the week before, not this one.
  assert.equal(covered.get("2005-09-10")?.song, "We Belong Together");
});

test("a date with no chart in that year is left out rather than filled", () => {
  const covered = coverageByDay(WEEKS);
  // Nothing in the fixture covers 1999, and the nearest week is not offered.
  assert.equal(covered.get("1999-09-04"), undefined);
});

test("a date page gets one row per year, newest first", () => {
  const covered = coverageByDay(WEEKS);
  const songs = songsForDate(covered, 9, 4, 1959, 2026);
  assert.deepEqual(songs.map((song) => song.year), [2005, 2004]);
  assert.equal(songs[0]?.song, "We Belong Together");
  assert.equal(songs[1]?.song, "Slow Motion");
});

test("February 29 yields leap years only", () => {
  assert.equal(dateExists(2024, 2, 29), true);
  assert.equal(dateExists(2023, 2, 29), false);
  assert.equal(dateExists(1900, 2, 29), false, "1900 was not a leap year");
  assert.equal(dateExists(2000, 2, 29), true, "2000 was");

  const leap: ChartWeek[] = [
    { chartDate: "2024-03-02", song: "Lose Control", artist: "Teddy Swims" },
    { chartDate: "2023-03-04", song: "Flowers", artist: "Miley Cyrus" },
  ];
  const songs = songsForDate(coverageByDay(leap), 2, 29, 2020, 2026);
  assert.deepEqual(songs.map((song) => song.year), [2024],
    "2023 has no February 29, so it cannot have a song on one");
});

// MARK: Readiness

function people(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    qid: `Q${index}`,
    name: `Person ${index}`,
    birthYear: 1990 + index,
    deathYear: null,
    description: null,
    monthlyViews: 1000,
  }));
}

test("the sitemap lists only the pages that are ready", () => {
  const map = renderSitemap([{ month: 9, day: 4 }, { month: 3, day: 22 }]);
  assert.ok(map.includes("https://birthed.app/september-4/"));
  assert.ok(map.includes("https://birthed.app/march-22/"));
  assert.equal(map.includes("https://birthed.app/january-1/"), false,
    "a sitemap that lists a noindex page contradicts itself");
  // The index is always in it.
  assert.ok(map.includes("<loc>https://birthed.app/</loc>"));
});

// ---------------------------------------------------------------------------
// The database says a cover exists. static/covers says whether we have it.
// The page has to believe the second one, because the page is what points a
// browser at a file. The first real run put thirteen broken images across the
// 366 pages by believing the first one.

test("a cover that is not downloaded falls back rather than breaking", () => {
  const weeks = [
    { chartDate: "2024-09-07", song: "A Bar Song (Tipsy)", artist: "Shaboozey", hasArtwork: true },
    { chartDate: "2022-09-03", song: "As It Was", artist: "Harry Styles", hasArtwork: true },
  ];
  const onDisk = [`${coverName("A Bar Song (Tipsy)", "Shaboozey")}.jpg`];

  const checked = withDownloadedCovers(weeks, onDisk);
  assert.equal(checked[0]?.hasArtwork, true, "the one we downloaded still draws");
  assert.equal(checked[1]?.hasArtwork, false, "the one we did not must not be pointed at");
  // And nothing else about the row is touched, because the song is still the
  // number one whether or not we have a picture of it.
  assert.equal(checked[1]?.song, "As It Was");
});

test("a week that never had a cover is left exactly as it was", () => {
  const weeks = [{ chartDate: "1960-09-05", song: "The Twist", artist: "Chubby Checker" }];
  assert.deepEqual(withDownloadedCovers(weeks, []), weeks);
});

test("an empty covers folder turns every tile into the made one", () => {
  const weeks = [
    { chartDate: "2024-09-07", song: "A Bar Song (Tipsy)", artist: "Shaboozey", hasArtwork: true },
  ];
  assert.equal(withDownloadedCovers(weeks, [])[0]?.hasArtwork, false);
});
