import test from "node:test";
import assert from "node:assert/strict";
import {
  titleFromArticleUrl,
  averageMonthlyViews,
  viewsByRequestedTitle,
  followMappings,
} from "../src/pageviews.js";
import { searchTerm } from "../src/diagnose.js";
import { pageviewLookupLooksBroken } from "../src/import-day.js";

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
  const views = viewsByRequestedTitle(["Kim_Kardashian", "Logan_Paul"], [REAL_ANSWER]);
  assert.equal(views.get("Kim_Kardashian"), 210_000);
  assert.equal(views.get("Logan_Paul"), 60_000);
});

test("a redirect is followed to the article that actually holds the readings", () => {
  const views = viewsByRequestedTitle(["OutKast"], [REAL_ANSWER]);
  assert.equal(views.get("OutKast"), 30_000);
});

test("a title that needed no renaming still works", () => {
  const views = viewsByRequestedTitle(["Artsvik"], [REAL_ANSWER]);
  assert.equal(views.get("Artsvik"), 165);
});

test("every title asked about gets an answer, and an unknown one is zero", () => {
  const asked = ["Kim_Kardashian", "Nobody_At_All"];
  const views = viewsByRequestedTitle(asked, [REAL_ANSWER]);
  assert.deepEqual([...views.keys()], asked, "keyed by what was asked, always");
  assert.equal(views.get("Nobody_At_All"), 0);
});

test("a rename table that points at itself does not hang the import", () => {
  const loop = new Map([["A", "B"], ["B", "A"]]);
  assert.equal(typeof followMappings("A", loop), "string");
});

// The check that would have caught the key mismatch in the first minute
// instead of after a hundred dates.
function row(title: string | null, views: number) {
  return {
    wikidata_qid: "Q1", name: "x", birth_month: 1, birth_day: 1,
    birth_year: 1990, death_year: null, short_description: null,
    birth_precision: 11, sitelink_count: 5, is_living: true,
    notability_score: 0, enwiki_title: title, monthly_views: views,
    has_social: false, source_url: "https://example.org", content_license: "CC0-1.0",
  };
}

test("a date where only one-word titles have readings is flagged", () => {
  const broken = [
    row("Artsvik", 172), row("Taz", 40),
    row("Kim_Kardashian", 0), row("Logan_Paul", 0),
    row("Rachel_Maddow", 0), row("Adin_Ross", 0),
  ];
  assert.equal(pageviewLookupLooksBroken(broken), true);
});

test("a date that read correctly is not flagged", () => {
  const fine = [
    row("Kim_Kardashian", 222711), row("Logan_Paul", 77439),
    row("Artsvik", 172), row("Rachel_Maddow", 23896),
    row("Adin_Ross", 28796), row("Taz", 40),
  ];
  assert.equal(pageviewLookupLooksBroken(fine), false);
});

test("a date nobody has been looked up on yet is not flagged", () => {
  // All zeroes is the shape of a date that has not been scored at all, which
  // is a different problem and must not be reported as this one.
  const unscored = Array.from({ length: 6 }, () => row("Some_Person", 0));
  assert.equal(pageviewLookupLooksBroken(unscored), false);
});

test("a handful of rows is too few to conclude anything from", () => {
  assert.equal(pageviewLookupLooksBroken([row("Artsvik", 172)]), false);
});

// The second half of the same failure. The interface names every title it was
// asked about but attaches readings to only some of them, and hands back a
// continue token for the rest. This is the real shape: 25 asked for, readings
// on some, `continue` present, and the rest arriving in a second round.
const ROUND_ONE = {
  continue: { continue: "||", pvipcontinue: "Nemanja_Vidić" },
  query: {
    normalized: [
      { from: "Kim_Kardashian", to: "Kim Kardashian" },
      { from: "Nemanja_Vidić", to: "Nemanja Vidić" },
    ],
    pages: [
      { title: "Kim Kardashian", pageviews: { a: 7000, b: 7000 } },
      // Named, but no readings attached. This round did not cover them.
      { title: "Nemanja Vidić" },
    ],
  },
};

const ROUND_TWO = {
  batchcomplete: true,
  query: {
    normalized: [{ from: "Nemanja_Vidić", to: "Nemanja Vidić" }],
    pages: [
      { title: "Kim Kardashian", pageviews: { a: 7000, b: 7000 } },
      { title: "Nemanja Vidić", pageviews: { a: 900, b: 900 } },
    ],
  },
};

test("a title the first round did not cover is not written off as a zero", () => {
  const first = viewsByRequestedTitle(["Kim_Kardashian", "Nemanja_Vidić"], [ROUND_ONE]);
  assert.equal(first.get("Nemanja_Vidić"), 0, "one round alone cannot answer for it");

  const both = viewsByRequestedTitle(["Kim_Kardashian", "Nemanja_Vidić"], [ROUND_ONE, ROUND_TWO]);
  assert.equal(both.get("Nemanja_Vidić"), 27_000, "the second round carries the reading");
  assert.equal(both.get("Kim_Kardashian"), 210_000, "and the first round's is kept");
});

test("a page named with no readings never overwrites one that has them", () => {
  // Rounds in the other order, which is the case that would silently blank a
  // real reading if the empty page were treated as a zero.
  const views = viewsByRequestedTitle(["Nemanja_Vidić"], [ROUND_TWO, ROUND_ONE]);
  assert.equal(views.get("Nemanja_Vidić"), 27_000);
});
