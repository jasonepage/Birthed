import test from "node:test";
import assert from "node:assert/strict";
import { titleSegment, twelveMonthWindow } from "../src/pageviews.js";

test("the article title is taken from the Wikipedia address as it arrives", () => {
  assert.equal(titleSegment("https://en.wikipedia.org/wiki/Beyonc%C3%A9"), "Beyonc%C3%A9");
  assert.equal(titleSegment("https://en.wikipedia.org/wiki/Anton_Bruckner"), "Anton_Bruckner");
});

test("an address that is not a Wikipedia article gives nothing back", () => {
  assert.equal(titleSegment("https://www.wikidata.org/wiki/Q1"), "Q1");
  assert.equal(titleSegment("https://example.com/nope"), null);
});

test("the window is twelve whole months ending at the start of this one", () => {
  const window = twelveMonthWindow(new Date(Date.UTC(2026, 8, 5)));
  assert.equal(window.start, "2025090100");
  assert.equal(window.end, "2026090100");
});

import { searchTerm } from "../src/diagnose.js";

test("an accented name is searched by the part before the accent", () => {
  // A macOS terminal can hand over the accent as a separate combining
  // character, which is a different string from the one Wikidata stores. That
  // made a person who was right there look missing.
  assert.equal(searchTerm("Beyonce\u0301"), "beyonc");
  assert.equal(searchTerm("Beyonc\u00e9"), "beyonc");
});

test("a plain name is searched whole", () => {
  assert.equal(searchTerm("Trisha Paytas"), "trisha paytas");
});

test("quotes and backslashes cannot escape into the query", () => {
  assert.equal(searchTerm('Bob" } UNION { ?x ?y ?z'), "bob } union { ?x ?y ?z");
});
