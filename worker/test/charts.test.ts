import { strict as assert } from "node:assert";
import { test } from "node:test";

import { ALBUMS, FILMS, chartNamed } from "../src/charts.js";
import { parseYear } from "../src/hot100.js";

/**
 * The shape of the Billboard 200 year pages: an Issue date column, an Album
 * column whose cells span the weeks of a run, an Artist(s) column, and the
 * sales and reference columns nobody reads. The title is italic rather than
 * quoted, which is the one visible difference from the song pages.
 */
const ALBUMS_2002 = `<table class="wikitable">
<tr><th>Issue date</th><th>Album</th><th>Artist(s)</th><th>Sales</th><th>Ref.</th></tr>
<tr><th scope="row">January 5</th><td rowspan="2"><i><a href="/wiki/Weathered">Weathered</a></i></td><td rowspan="2"><a href="/wiki/Creed_(band)">Creed</a></td><td>860,000</td><td></td></tr>
<tr><th scope="row">January 12</th><td>398,000</td><td></td></tr>
<tr><th scope="row">January 19</th><td><i>Weathered</i></td><td>Creed</td><td>200,000</td><td></td></tr>
</table>`;

/**
 * The shape of the box office year pages: a week number, a date that carries
 * its own year and sits in a column called either "Weekend end date" or
 * "Week ending" depending on the decade, a Film column that spans a run, and
 * no artist column at all.
 */
const FILMS_2002 = `<table class="wikitable">
<tr><th>#</th><th>Weekend end date</th><th>Film</th><th>Box office</th><th>Notes</th><th>Ref</th></tr>
<tr><td>1</td><td>January 6, 2002</td><td rowspan="2"><i><a href="/wiki/LOTR">The Lord of the Rings: The Fellowship of the Ring</a></i></td><td>$23,006,447</td><td></td><td></td></tr>
<tr><td>2</td><td>January 13, 2002</td><td>$16,201,260</td><td>Four weekends.</td><td></td></tr>
<tr><td>3</td><td>January 20, 2002</td><td><i>Black Hawk Down</i></td><td>$28,611,736</td><td></td><td></td></tr>
</table>`;

const FILMS_1976 = `<table class="wikitable">
<tr><th>#</th><th>Week ending</th><th>Film</th><th>Gross</th><th>Notes</th><th>Ref</th></tr>
<tr><td>1</td><td>January 7, 1976</td><td><i>Dog Day Afternoon</i></td><td>$1,488,800</td><td></td><td></td></tr>
</table>`;

test("reads an album year, filling the spanned cells down a run", () => {
  const { weeks, notes } = parseYear(ALBUMS_2002, 2002, ALBUMS);
  assert.deepEqual(
    weeks.map((week) => [week.chartDate, week.song, week.artist]),
    [
      ["2002-01-05", "Weathered", "Creed"],
      ["2002-01-12", "Weathered", "Creed"],
      ["2002-01-19", "Weathered", "Creed"],
    ],
  );
  assert.deepEqual(notes, []);
});

test("reads a film year with no credit column and a year inside the date", () => {
  const { weeks, notes } = parseYear(FILMS_2002, 2002, FILMS);
  assert.deepEqual(
    weeks.map((week) => [week.chartDate, week.song, week.artist]),
    [
      ["2002-01-06", "The Lord of the Rings: The Fellowship of the Ring", ""],
      ["2002-01-13", "The Lord of the Rings: The Fellowship of the Ring", ""],
      ["2002-01-20", "Black Hawk Down", ""],
    ],
  );
  assert.deepEqual(notes, []);
});

test("accepts the older film pages' Week ending header", () => {
  const { weeks } = parseYear(FILMS_1976, 1976, FILMS);
  assert.deepEqual(weeks.map((week) => [week.chartDate, week.song]), [["1976-01-07", "Dog Day Afternoon"]]);
});

test("the song reader does not read an album table as songs", () => {
  const { weeks } = parseYear(ALBUMS_2002, 2002);
  assert.equal(weeks.length, 0);
});

test("charts are found by their command line key", () => {
  assert.equal(chartNamed("films")?.name, "US box office");
  assert.equal(chartNamed("nope"), undefined);
});
