import test from "node:test";
import assert from "node:assert/strict";
import { dateLiterals, buildQuery, nameFromArticle } from "../src/wikidata.js";

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

test("the label service is asked for mul as well as English", () => {
  // Wikidata files a name spelled the same in every language under mul and
  // stops repeating it per language. Asking only for English gets the
  // identifier back, and the identifier used to mean the row was thrown away.
  // Measured on September 4: 20 of 2,904 people came back as their own
  // identifier under "en", and the widest covered of them by a factor of three
  // was Beyonce. Under "en,mul" it is none of them.
  const query = buildQuery(9, 4, OPTIONS);
  assert.ok(query.includes('wikibase:language "en,mul"'));
});

test("a name comes out of an article address when there is no label", () => {
  assert.equal(nameFromArticle("https://en.wikipedia.org/wiki/Beyonc%C3%A9"), "Beyoncé");
  assert.equal(nameFromArticle("https://en.wikipedia.org/wiki/Anton_Bruckner"), "Anton Bruckner");
});

test("a disambiguated title keeps its bracket rather than being dropped", () => {
  // Worse than the label and much better than the person not existing.
  assert.equal(nameFromArticle("https://en.wikipedia.org/wiki/Drake_(musician)"), "Drake (musician)");
});

test("an address that is not an article gives nothing to fall back to", () => {
  assert.equal(nameFromArticle("https://example.com/nope"), "");
  assert.equal(nameFromArticle("https://en.wikipedia.org/wiki/"), "");
});

test("a broken percent escape falls back rather than throwing", () => {
  assert.equal(nameFromArticle("https://en.wikipedia.org/wiki/100%_Pure"), "100% Pure");
});
