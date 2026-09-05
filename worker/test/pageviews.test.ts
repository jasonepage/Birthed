import test from "node:test";
import assert from "node:assert/strict";
import {
  titleFromArticleUrl,
  averageMonthlyViews,
  viewsByRequestedTitle,
  followMappings,
} from "../src/pageviews.js";
import { searchTerm } from "../src/diagnose.js";

test("the title is decoded, because the batch interface wants real titles", () => {
  assert.equal(titleFromArticleUrl("https://en.wikipedia.org/wiki/Beyonc%C3%A9"), "Beyoncé");
  assert.equal(titleFromArticleUrl("https://en.wikipedia.org/wiki/Anton_Bruckner"), "Anton_Bruckner");
});

test("an address that is not an article gives nothing back", () => {
  assert.equal(titleFromArticleUrl("https://example.com/nope"), null);
});

test("a broken percent escape does not throw", () => {
  assert.equal(titleFromArticleUrl("https://en.wikipedia.org/wiki/100%"), "100%");
});

test("daily counts become a monthly figure", () => {
  assert.equal(averageMonthlyViews({ "2026-09-01": 10, "2026-09-02": 20 }), 450);
});

test("a day the interface reports as null counts as zero, not as missing", () => {
  assert.equal(averageMonthlyViews({ "2026-09-01": 30, "2026-09-02": null }), 450);
});

test("no data at all is zero rather than a crash", () => {
  assert.equal(averageMonthlyViews(undefined), 0);
  assert.equal(averageMonthlyViews({}), 0);
});

test("an accented name is searched by the part before the accent", () => {
  assert.equal(searchTerm("Beyoncé"), "beyonc");
  assert.equal(searchTerm("Beyoncé"), "beyonc");
});

test("a plain name is searched whole", () => {
  assert.equal(searchTerm("Trisha Paytas"), "trisha paytas");
});

test("quotes and backslashes cannot escape into the query", () => {
  assert.equal(searchTerm('Bob" } UNION { ?x ?y ?z'), "bob } union { ?x ?y ?z");
});

// The bug that ranked Kim Kardashian below an Armenian singer.
//
// This payload is the real answer from the action interface, trimmed. What was
// asked for and what came back are different strings, and the first version of
// this code keyed on what came back.
const REAL_ANSWER = {
  query: {
    normalized: [
      { from: "Kim_Kardashian", fromencoded: false, to: "Kim Kardashian" },
      { from: "Logan_Paul", fromencoded: false, to: "Logan Paul" },
    ],
    redirects: [{ from: "OutKast", to: "Outkast" }],
    pages: [
      { title: "Kim Kardashian", pageviews: { a: 7000, b: 7000 } },
      { title: "Logan Paul", pageviews: { a: 2000, b: 2000 } },
      { title: "Outkast", pageviews: { a: 1000, b: 1000 } },
      { title: "Artsvik", pageviews: { a: 5, b: 6 } },
    ],
  },
};

test("a normalised title is matched back to the title that was asked for", () => {
  const views = viewsByRequestedTitle(["Kim_Kardashian", "Logan_Paul"], REAL_ANSWER);
  assert.equal(views.get("Kim_Kardashian"), 210_000);
  assert.equal(views.get("Logan_Paul"), 60_000);
});

test("a redirect is followed to the article that actually holds the readings", () => {
  const views = viewsByRequestedTitle(["OutKast"], REAL_ANSWER);
  assert.equal(views.get("OutKast"), 30_000);
});

test("a title that needed no renaming still works", () => {
  const views = viewsByRequestedTitle(["Artsvik"], REAL_ANSWER);
  assert.equal(views.get("Artsvik"), 165);
});

test("every title asked about gets an answer, and an unknown one is zero", () => {
  const asked = ["Kim_Kardashian", "Nobody_At_All"];
  const views = viewsByRequestedTitle(asked, REAL_ANSWER);
  assert.deepEqual([...views.keys()], asked, "keyed by what was asked, always");
  assert.equal(views.get("Nobody_At_All"), 0);
});

test("a rename table that points at itself does not hang the import", () => {
  const loop = new Map([["A", "B"], ["B", "A"]]);
  assert.equal(typeof followMappings("A", loop), "string");
});
