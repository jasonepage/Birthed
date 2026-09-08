import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildPortraitQuery, fileNameFrom, filePathUrl, readPortraits } from "../src/portraits.js";

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
