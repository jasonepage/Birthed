import test from "node:test";
import assert from "node:assert/strict";
import { dateLiterals, buildQuery } from "../src/wikidata.js";

const OPTIONS = { yearFrom: 1600, yearTo: 2015, minSitelinks: 10, userAgent: "test" };

test("one literal per year in the range", () => {
  assert.equal(dateLiterals(9, 4, 1600, 1602).length, 3);
});

test("literals are exact Wikidata date values", () => {
  assert.deepEqual(dateLiterals(9, 4, 1961, 1961), ['"1961-09-04T00:00:00Z"^^xsd:dateTime']);
});

test("February 29 is skipped in a common year", () => {
  assert.deepEqual(dateLiterals(2, 29, 1900, 1904), ['"1904-02-29T00:00:00Z"^^xsd:dateTime']);
});

test("1900 is not a leap year and 2000 is", () => {
  assert.equal(dateLiterals(2, 29, 1900, 1900).length, 0);
  assert.equal(dateLiterals(2, 29, 2000, 2000).length, 1);
});

test("February 28 is never skipped", () => {
  assert.equal(dateLiterals(2, 28, 1900, 1901).length, 2);
});

test("the query never computes MONTH or DAY, which cannot use an index", () => {
  const query = buildQuery(9, 4, OPTIONS);
  assert.ok(!query.includes("MONTH("));
  assert.ok(!query.includes("DAY("));
});

test("the query reads precision from the statement, not the truthy property", () => {
  const query = buildQuery(9, 4, OPTIONS);
  assert.ok(query.includes("p:P569/psv:P569"));
  assert.ok(query.includes("wikibase:timePrecision"));
  assert.ok(query.includes("FILTER(?precision >= 11)"));
});

test("the query binds one exact date per year in the range", () => {
  const query = buildQuery(9, 4, OPTIONS);
  const bound = query.match(/\^\^xsd:dateTime/g) ?? [];
  assert.equal(bound.length, 2015 - 1600 + 1);
});
