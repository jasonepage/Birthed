import { strict as assert } from "node:assert";
import { test } from "node:test";

import { CLASSES, buildQuery, dateLiterals, readAnswer, titleFor } from "../src/culture.js";
import { score, toRows } from "../src/import-culture.js";

const OPTIONS = { yearFrom: 1900, yearTo: 1902, minSitelinks: 10, userAgent: "test" };

test("dates are bound as literals, never computed", () => {
  // The whole reason this query returns at all. MONTH() and DAY() cannot use
  // an index and die on the sixty second timeout, which is written up in
  // wikidata.ts and repeated here because the trap is repeated in the query.
  const query = buildQuery(9, 7, OPTIONS);
  assert.ok(!query.includes("MONTH("), "a computed month is the timeout");
  assert.ok(!query.includes("DAY("));
  assert.match(query, /"1900-09-07T00:00:00Z"\^\^xsd:dateTime/);
  assert.match(query, /FILTER\(\?precision >= 11\)/, "a year-only date is January 1 and is not a day");
});

test("February 29 binds only the years that have one", () => {
  const leap = dateLiterals(2, 29, 1899, 1905);
  assert.equal(leap.length, 1, "1904 is the only leap year in that range");
  assert.match(leap[0] ?? "", /1904-02-29/);
});

test("the query carries no double slash comment", () => {
  // SPARQL comments start with #, so a // line is sent as part of the query
  // and every date comes back 400. Tested per line rather than on the whole
  // string, because the query legitimately contains https:// twice.
  for (const line of buildQuery(1, 1, OPTIONS).split("\n")) {
    assert.ok(!line.trimStart().startsWith("//"), `a comment line reached the query: ${line}`);
  }
});

const binding = (over: Record<string, unknown> = {}) => ({
  work: { value: "http://www.wikidata.org/entity/Q42305" },
  workLabel: { value: "Halo 3" },
  workDescription: { value: "2007 video game" },
  date: { value: "2007-09-25T00:00:00Z" },
  sitelinks: { value: "34" },
  type: { value: "http://www.wikidata.org/entity/Q7889" },
  article: { value: "https://en.wikipedia.org/wiki/Halo_3" },
  ...over,
});

test("a work becomes one row with the category its class maps to", () => {
  const works = readAnswer({ results: { bindings: [binding()] } }, 9, 25);
  assert.equal(works.length, 1);
  assert.equal(works[0]?.category, "gaming");
  assert.equal(works[0]?.year, 2007);
  assert.equal(titleFor(works[0]!), "Halo 3 is released");
});

test("the same work bound twice on one date is one row", () => {
  // Wikidata holds the value under more than one statement often enough that
  // this is the normal case and not the odd one.
  const works = readAnswer({ results: { bindings: [binding(), binding()] } }, 9, 25);
  assert.equal(works.length, 1);
});

test("a work with no name in any language asked for is dropped", () => {
  // The label service answers with the identifier when it has nothing, and
  // "Q42305 is released" is worse than no row at all.
  const works = readAnswer({ results: { bindings: [binding({ workLabel: { value: "Q42305" } })] } }, 9, 25);
  assert.equal(works.length, 0);
});

// The first run of this returned eleven films out of twelve rows, every one of
// them dated to a festival premiere. Memento came back on its Venice date,
// eight months before a ticket could be bought in America.
test("films and music are not imported, and games still are", () => {
  const categories = new Set(CLASSES.map((entry) => entry.category as string));
  assert.ok(!categories.has("cinema"), "P577 for a film is a festival, not the reader's release");
  assert.ok(!categories.has("music"));
  assert.ok(!categories.has("meme"), "memes have no structured source");
  assert.ok(categories.has("gaming"));
});

const work = (over: Record<string, unknown> = {}) => ({
  qid: "Q1", label: "A Thing", description: "2007 video game",
  year: 2007, month: 9, day: 25, sitelinks: 40,
  category: "gaming" as const, articleUrl: "https://en.wikipedia.org/wiki/A_Thing",
  ...over,
});

test("the ranking keeps what is both widely covered and actually read", () => {
  // Sitelinks alone fills a date with releases nobody opens. Views alone fills
  // it with whatever came out this year.
  assert.ok(
    score(work({ sitelinks: 100 }), 10_000) > score(work({ sitelinks: 8 }), 400_000),
    "coverage has to survive a spike in attention",
  );
});

test("an imported row stores no sentence and says it was imported", () => {
  const rows = toRows([work()], new Map([["A_Thing", 5000]]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.context_string, null, "a generated sentence is the voice this table escapes");
  assert.equal(rows[0]?.origin, "imported");
  assert.equal(rows[0]?.event_date, "2007-09-25");
  assert.equal(rows[0]?.event_title, "A Thing is released");
});

test("the two screens the people importer uses apply here too", () => {
  const rows = toRows(
    [work({ description: "2007 pornographic video game" }),
     work({ qid: "Q2", label: "Fine", description: "2007 video game" })],
    new Map(),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.event_title, "Fine is released");
});

test("a date keeps only its best, and the cap is a storage limit not a display one", () => {
  const many = Array.from({ length: 30 }, (_, i) =>
    work({ qid: `Q${i}`, label: `Thing ${i}`, sitelinks: i + 1 }));
  const views = new Map(many.map((w, i) => [`Thing_${i}`, (i + 1) * 100]));
  const rows = toRows(many, views, 12);
  assert.equal(rows.length, 12);
  assert.equal(rows[0]?.event_title, "Thing 29 is released", "the widest covered leads");
});

// Found by a test that passed an empty view map, which is exactly what a date
// looks like when the pageview lookup fails. Without a floor every score is
// sitelinks times the square root of nothing, so the whole date ranks zero and
// comes out in arrival order with nothing on screen to say so.
test("a date with no view data ranks on coverage rather than on nothing", () => {
  const many = Array.from({ length: 30 }, (_, i) =>
    work({ qid: `Q${i}`, label: `Thing ${i}`, sitelinks: i + 1 }));
  const rows = toRows(many, new Map(), 12);
  assert.equal(rows[0]?.event_title, "Thing 29 is released");
  assert.ok(score(work({ sitelinks: 40 }), 0) > score(work({ sitelinks: 10 }), 0));
});
