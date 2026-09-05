import { strict as assert } from "node:assert";
import { test } from "node:test";

import { READY_PEOPLE, isReady, renderDayPage, renderSitemap } from "../src/render.js";
import { ChartWeek, coverageByDay, dateExists, songsForDate } from "../src/songs.js";

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

test("the section is absent rather than empty when there are no songs", () => {
  const html = renderDayPage({ month: 9, day: 4, people: [] }, []);
  assert.equal(html.includes("The number one song on"), false);
});

test("the section renders the years and credits the source", () => {
  const songs = songsForDate(coverageByDay(WEEKS), 9, 4, 1959, 2026);
  const html = renderDayPage({ month: 9, day: 4, people: [] }, songs);
  assert.ok(html.includes("The number one song on September 4"));
  assert.ok(html.includes("We Belong Together"));
  assert.ok(html.includes("Kanye West") === false, "September 4 2005 is not Gold Digger week");
  assert.ok(html.includes("Billboard Hot 100"));
  assert.ok(html.includes("not affiliated with Billboard"));
});

test("a song title with markup in it is escaped", () => {
  const nasty: ChartWeek[] = [
    { chartDate: "2005-09-10", song: '<script>alert(1)</script>', artist: 'A & B "live"' },
  ];
  const songs = songsForDate(coverageByDay(nasty), 9, 4, 2005, 2005);
  const html = renderDayPage({ month: 9, day: 4, people: [] }, songs);
  assert.equal(html.includes("<script>alert(1)</script>"), false);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("A &amp; B &quot;live&quot;"));
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

test("a half imported date is built but told not to index itself", () => {
  const thin = renderDayPage({ month: 9, day: 4, people: people(3) }, []);
  assert.ok(thin.includes('name="robots" content="noindex"'));
  assert.ok(thin.includes("Person 0"), "still built, still readable by anyone who types the address");
});

test("a finished date does not carry noindex", () => {
  const full = renderDayPage({ month: 9, day: 4, people: people(10) }, []);
  assert.equal(full.includes('content="noindex"'), false);
});

test("the readiness line is exactly where it says it is", () => {
  assert.equal(isReady({ month: 1, day: 1, people: people(READY_PEOPLE - 1) }), false);
  assert.equal(isReady({ month: 1, day: 1, people: people(READY_PEOPLE) }), true);
});

test("the sitemap lists only the pages that are ready", () => {
  const map = renderSitemap([{ month: 9, day: 4 }, { month: 3, day: 22 }]);
  assert.ok(map.includes("https://birthed.app/september-4/"));
  assert.ok(map.includes("https://birthed.app/march-22/"));
  assert.equal(map.includes("https://birthed.app/january-1/"), false,
    "a sitemap that lists a noindex page contradicts itself");
  // The index is always in it.
  assert.ok(map.includes("<loc>https://birthed.app/</loc>"));
});

test("ten people who were never ranked is not a ready page", () => {
  // The failure this exists to stop. A date imported before pageviews has its
  // full ten and is ordered by how many languages have an article, which fills
  // the page with footballers. It passes a head count and is exactly the page
  // that should not be handed to a search engine.
  const unranked = people(10).map((person) => ({ ...person, monthlyViews: 0 }));
  assert.equal(isReady({ month: 1, day: 1, people: unranked }), false);

  const ranked = [...unranked];
  ranked[0] = { ...ranked[0]!, monthlyViews: 1 };
  assert.equal(isReady({ month: 1, day: 1, people: ranked }), true);
});
