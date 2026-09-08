import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildQuery, dateLiterals, readAnswer, recencyWeight, LIVING_MEMORY_YEARS } from "../src/moments.js";

const opts = { yearFrom: 1900, yearTo: 2026, minSitelinks: 8, userAgent: "test" };

const row = (qid: string, label: string, date: string, sitelinks: number, types: string) => ({
  item: { value: `http://www.wikidata.org/entity/${qid}` },
  itemLabel: { value: label },
  date: { value: date },
  sitelinks: { value: String(sitelinks) },
  article: { value: `https://en.wikipedia.org/wiki/${label.replace(/ /g, "_")}` },
  types: { value: types },
});

test("dates are bound as literals, never filtered with a function", () => {
  const q = buildQuery(9, 11, opts);
  assert.ok(q.includes("VALUES ?date"));
  assert.ok(q.includes('"2001-09-11T00:00:00Z"^^xsd:dateTime'));
  assert.equal(q.includes("MONTH("), false, "a function over every dated item times out");
});

test("both a point in time and a start time count as a day", () => {
  const q = buildQuery(9, 11, opts);
  assert.ok(q.includes("p:P585/psv:P585"));
  assert.ok(q.includes("p:P580/psv:P580"));
});

test("precision is read off the statement, not the truthy value", () => {
  const q = buildQuery(9, 11, opts);
  assert.ok(q.includes("wikibase:timePrecision"));
  assert.ok(q.includes("?precision >= 11"), "a year-only date is stored as January the first");
});

test("no line of the query is a JavaScript comment", () => {
  for (const line of buildQuery(9, 11, opts).split("\n")) {
    assert.equal(line.trim().startsWith("//"), false, `SPARQL cannot parse: ${line}`);
  }
});

test("the 29th of February only exists in leap years", () => {
  const leaps = dateLiterals(2, 29, 1900, 1912);
  assert.equal(leaps.length, 3, "1900 was not a leap year, 1904, 1908 and 1912 were");
});

test("only things that happened survive", () => {
  const out = readAnswer({ results: { bindings: [
    row("Q1", "September 11 attacks", "2001-09-11T00:00:00Z", 160, "terrorist attack"),
    row("Q2", "Some Person", "2001-09-11T00:00:00Z", 90, "human"),
    row("Q3", "Some Stadium", "2001-09-11T00:00:00Z", 40, "building|stadium"),
  ] } }, 9, 11);
  assert.deepEqual(out.map((m) => m.label), ["September 11 attacks"]);
});

test("a thing with both a point and a start on the same day is one moment", () => {
  const out = readAnswer({ results: { bindings: [
    row("Q1", "The Blitz", "1940-09-07T00:00:00Z", 45, "military operation"),
    row("Q1", "The Blitz", "1940-09-07T00:00:00Z", 45, "aerial bombing"),
  ] } }, 9, 7);
  assert.equal(out.length, 1);
});

test("a row the label service could not name is dropped", () => {
  const out = readAnswer({ results: { bindings: [
    row("Q999", "Q999", "2001-09-11T00:00:00Z", 40, "battle"),
  ] } }, 9, 11);
  assert.equal(out.length, 0);
});

test("an empty or malformed answer is empty, not a crash", () => {
  assert.equal(readAnswer({}, 9, 7).length, 0);
  assert.equal(readAnswer({ results: { bindings: [{ itemLabel: { value: "x" } }] } }, 9, 7).length, 0);
});

test("living memory is flat and then falls away, and never reaches zero", () => {
  assert.equal(recencyWeight(2026, 2026), 1);
  assert.equal(recencyWeight(2026 - LIVING_MEMORY_YEARS, 2026), 1, "still in living memory");
  assert.ok(recencyWeight(1940, 2026) < recencyWeight(2001, 2026));
  assert.ok(recencyWeight(878, 2026) >= 0.25, "outranked, never deleted");
});

test("9/11 is not docked for being twenty five years old", () => {
  assert.equal(recencyWeight(2001, 2026), 1);
});
