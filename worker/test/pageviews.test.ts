import test from "node:test";
import assert from "node:assert/strict";
import { titleFromArticleUrl, averageMonthlyViews } from "../src/pageviews.js";
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
