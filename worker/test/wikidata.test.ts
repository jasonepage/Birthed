import test from "node:test";
import assert from "node:assert/strict";
import { GREGORIAN, JULIAN, dateBindings, dateLiterals, buildQuery, julianToGregorian, nameFromArticle } from "../src/wikidata.js";

const OPTIONS = { yearFrom: 1400, yearTo: 2015, minSitelinks: 10, userAgent: "test" };

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

test("the query binds one exact date per year from 1582, and two before it", () => {
  // Before the Gregorian calendar began a birthday can be recorded in either
  // calendar, and the query service stores both in Gregorian, so a year
  // before the cutover asks for the date as written and for the Julian date
  // converted. September 4 1582 is before October 15 1582, so 1582 has two.
  const query = buildQuery(9, 4, OPTIONS);
  const bound = query.match(/\^\^xsd:dateTime/g) ?? [];
  assert.equal(bound.length, (1582 - 1400 + 1) * 2 + (2015 - 1583 + 1));
});

test("Leonardo is asked for on April 15, the way his birthday was written", () => {
  // Wikidata records April 15 1452 in the Julian calendar and the query
  // service answers it as April 24 1452. Found on September 25, 2026: the
  // importer would have filed him on April 24, which no reader would accept.
  const rows = dateBindings(4, 15, 1452, 1452);
  assert.deepEqual(rows, [
    `("1452-04-15T00:00:00Z"^^xsd:dateTime <${GREGORIAN}> 1452)`,
    `("1452-04-24T00:00:00Z"^^xsd:dateTime <${JULIAN}> 1452)`,
  ]);
});

test("Michelangelo, March 6 1475 in Julian, is March 15 to the query service", () => {
  assert.deepEqual(julianToGregorian(1475, 3, 6), [1475, 3, 15]);
});

test("after the cutover the calendar is left open, so Washington and Tchaikovsky keep their Gregorian dates", () => {
  // Both are recorded in Julian and remembered in Gregorian, and the query
  // service already stores the Gregorian. Pinning the calendar here would
  // lose them; converting again would move them.
  assert.deepEqual(dateBindings(2, 22, 1732, 1732), ['("1732-02-22T00:00:00Z"^^xsd:dateTime UNDEF 1732)']);
  assert.deepEqual(dateBindings(5, 7, 1840, 1840), ['("1840-05-07T00:00:00Z"^^xsd:dateTime UNDEF 1840)']);
});

test("the first Gregorian day is after the cutover and the day before it is not", () => {
  assert.equal(dateBindings(10, 15, 1582, 1582).length, 1);
  assert.equal(dateBindings(10, 4, 1582, 1582).length, 2);
});

test("a late December Julian date keeps the year it was written in", () => {
  // December 25 1500 in Julian is January 4 1501 in Gregorian. The birth
  // year is still 1500.
  assert.deepEqual(julianToGregorian(1500, 12, 25), [1501, 1, 4]);
  assert.ok(dateBindings(12, 25, 1500, 1500).some((row) => row.includes('"1501-01-04') && row.endsWith(" 1500)")));
});

test("February 29 follows each calendar's own leap years", () => {
  // 1500 is a leap year in Julian and not in Gregorian, so only the Julian
  // row exists. 1504 is a leap year in both.
  const in1500 = dateBindings(2, 29, 1500, 1500);
  assert.equal(in1500.length, 1);
  assert.ok(in1500[0]!.includes(JULIAN));
  assert.equal(dateBindings(2, 29, 1504, 1504).length, 2);
  assert.equal(dateBindings(2, 29, 1900, 1900).length, 0);
});

test("the query reads the calendar from the statement and the year from the binding", () => {
  const query = buildQuery(4, 15, OPTIONS);
  assert.ok(query.includes("VALUES (?dob ?cal ?writtenYear)"));
  assert.ok(query.includes("?dobNode wikibase:timeCalendarModel ?cal ."));
  assert.ok(query.includes("?writtenYear"));
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

test("no line of the query is a JavaScript comment", () => {
  // Every date came back 400 because three // lines explaining the label
  // service were written inside the template literal instead of above it.
  // SPARQL comments start with #, so those lines were sent as part of the
  // query. The address in the article clause contains // legitimately, which
  // is why this looks at how a line starts rather than at the whole string.
  const offending = buildQuery(9, 4, OPTIONS)
    .split("\n")
    .filter((line) => line.trim().startsWith("//"));
  assert.deepEqual(offending, []);
});
