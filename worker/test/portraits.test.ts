import { strict as assert } from "node:assert";
import { test } from "node:test";
import { FACES_PER_DATE, buildPortraitQuery, everyDate, fileNameFrom, filePathUrl, readPortraits, uniquePeople } from "../src/portraits.js";
import { hivePeoplePath } from "../src/wall/history.js";

test("a file name becomes a sized Commons url", () => {
  const url = filePathUrl("Buddy Holly cropped.jpg");
  assert.ok(url.startsWith("https://commons.wikimedia.org/wiki/Special:FilePath/"));
  assert.ok(url.includes("Buddy_Holly_cropped.jpg"));
  assert.ok(url.endsWith("?width=400"), "a page must not be served a four megabyte scan");
});

test("apostrophes and accents survive the url", () => {
  const url = filePathUrl("O'Sullivan à Paris.jpg");
  assert.ok(url.includes("%27") || url.includes("O'Sullivan"));
  assert.ok(url.includes("%C3%A0"));
});

test("the query asks for P18 and nothing else", () => {
  const q = buildPortraitQuery(["Q1046", "Q189599"]);
  assert.ok(q.includes("wd:Q1046 wd:Q189599"));
  assert.ok(q.includes("wdt:P18"));
  assert.equal(q.includes("P109"), false, "a signature is not a face");
  assert.equal(q.includes("P154"), false, "a logo is not a face");
});

test("a commons url yields its file name", () => {
  assert.equal(
    fileNameFrom("http://commons.wikimedia.org/wiki/Special:FilePath/Buddy%20Holly.jpg"),
    "Buddy Holly.jpg",
  );
  assert.equal(fileNameFrom("nothing"), null);
});

test("the first picture wins when somebody has two", () => {
  const map = readPortraits({ results: { bindings: [
    { item: { value: "http://www.wikidata.org/entity/Q1046" }, file: { value: "http://commons.wikimedia.org/wiki/Special:FilePath/First.jpg" } },
    { item: { value: "http://www.wikidata.org/entity/Q1046" }, file: { value: "http://commons.wikimedia.org/wiki/Special:FilePath/Second.jpg" } },
  ] } });
  assert.equal(map.get("Q1046"), "First.jpg");
  assert.equal(map.size, 1);
});

test("a malformed or empty answer yields nothing rather than throwing", () => {
  assert.equal(readPortraits({}).size, 0);
  assert.equal(readPortraits({ results: { bindings: [{ item: { value: "x/Q1" } }] } }).size, 0);
});

test("the hive run walks all 366 dates, February 29 included", () => {
  const dates = everyDate();
  assert.equal(dates.length, 366);
  assert.ok(dates.some((d) => d.month === 2 && d.day === 29));
  assert.equal(dates.filter((d) => d.month === 4 && d.day === 31).length, 0);
});

test("the hive run asks for the people the history seeder files, the world's first, with a limit for faces only", () => {
  assert.ok(!hivePeoplePath(9, 10).includes("limit="), "the seeder files everybody on the date");
  const path = hivePeoplePath(9, 10, FACES_PER_DATE);
  assert.ok(path.startsWith("notable_people?"));
  assert.ok(path.includes("birth_month=eq.9"));
  assert.ok(path.includes("birth_day=eq.10"));
  assert.ok(path.includes("adult_content=eq.false"));
  // The same order a date page uses, so the faces fetched are the faces
  // drawn. CLAUDE.md section 5, September 22, 2026.
  assert.ok(path.includes("order=world_score.desc"));
  assert.ok(path.endsWith(`limit=${FACES_PER_DATE}`));
});

test("a person filed under two dates is looked up once", () => {
  const people = uniquePeople([
    [{ wikidata_qid: "Q1", name: "A" }, { wikidata_qid: "Q2", name: "B" }],
    [{ wikidata_qid: "Q2", name: "B" }, { wikidata_qid: "Q3", name: "C" }],
  ]);
  assert.deepEqual(people.map((p) => p.wikidata_qid), ["Q1", "Q2", "Q3"]);
});
