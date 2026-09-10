import { strict as assert } from "node:assert";
import { test } from "node:test";

import { PRIORITY_HISTORY, PRIORITY_PERSON, PRIORITY_PICK, mayLead, monthDay, monthDayOf, planHistory, type DateHistory } from "../src/wall/history.js";
import { allocate, type StoryInput } from "../src/wall/allocator.js";

function history(overrides: Partial<DateHistory> = {}): DateHistory {
  return {
    events: [
      { id: 1, event_year: 1957, description: "Ford unveiled the Edsel to the public.", source_url: "https://en.wikipedia.org/wiki/September_4" },
      { id: 2, event_year: 1888, description: "George Eastman registers the trademark Kodak.", source_url: "https://en.wikipedia.org/wiki/September_4" },
      { id: 3, event_year: 2001, description: "A bombing killed forty people in the capital.", source_url: "https://en.wikipedia.org/wiki/September_4" },
      { id: 4, event_year: 1200, description: "Short.", source_url: "https://en.wikipedia.org/wiki/September_4" },
    ],
    facts: [{ id: 9, fact: "The first Wii console went on sale in Japan on this date.", source_url: "https://example.org/wii" }],
    culture: [
      { id: 11, event_date: "2015-09-04", context_string: "Nintendo shipped the level editor and people spent a decade making levels.", source_url: "https://example.org/mm", origin: "curated" },
      { id: 12, event_date: "2009-09-04", context_string: null, source_url: "https://example.org/mn", origin: "imported" },
    ],
    people: [
      { wikidata_qid: "Q1", name: "Anton Bruckner", birth_year: 1824, death_year: 1896, short_description: "Austrian composer" },
      { wikidata_qid: "Q2", name: "Beyoncé", birth_year: 1981, death_year: null, short_description: "American singer" },
      { wikidata_qid: "Q3", name: "Ali", birth_year: 1990, death_year: null, short_description: null },
      { wikidata_qid: "Q4", name: "Somebody Fourth", birth_year: 1950, death_year: null, short_description: "a person" },
    ],
    selectedYears: new Set([1888]),
    leadLines: [{ subject_kind: "historical_event", subject_id: "1", line: "The Edsel arrived." }],
    ...overrides,
  };
}

test("a date's history becomes wall stories keyed by subject, with the row's own link and words", () => {
  const stories = planHistory("2026-09-04", history());
  const byKey = new Map(stories.map((s) => [s.urlKey, s]));
  const edsel = byKey.get("subject:historical_event:1")!;
  assert.equal(edsel.headline, "1957: The Edsel arrived.", "a written line is the headline");
  assert.equal(edsel.quotation, "Ford unveiled the Edsel to the public.", "the receipt still quotes the page");
  assert.equal(edsel.url, "https://en.wikipedia.org/wiki/September_4");
  assert.equal(edsel.outlet, "en.wikipedia.org");
  assert.equal(edsel.priority, PRIORITY_PICK);
  const kodak = byKey.get("subject:historical_event:2")!;
  assert.equal(kodak.headline, "1888: George Eastman registers the trademark Kodak.");
  assert.equal(kodak.priority, PRIORITY_PICK, "Wikipedia's pick for the date leads");
  // Forty events share one article; the subject is what makes them distinct.
  assert.notEqual(edsel.urlKey, kodak.urlKey);
  assert.equal(edsel.url, kodak.url);
});

test("a killing enters the pool and does not lead; a row with nothing to quote is not filed", () => {
  const stories = planHistory("2026-09-04", history({ selectedYears: new Set([2001]) }));
  const byKey = new Map(stories.map((s) => [s.urlKey, s]));
  const grim = byKey.get("subject:historical_event:3")!;
  assert.ok(grim, "it is on the wall's pool");
  assert.equal(grim.priority, PRIORITY_HISTORY, "and it does not take the first eight");
  assert.equal(byKey.has("subject:historical_event:4"), false, "fewer than twenty characters is not a receipt");
  assert.equal(mayLead("A parade went by."), true);
  assert.equal(mayLead("Troops entered the city."), false);
});

test("people, facts and written releases file too, and a bare title does not", () => {
  const stories = planHistory("2026-09-04", history());
  const byKey = new Map(stories.map((s) => [s.urlKey, s]));
  const bruckner = byKey.get("subject:person:Q1")!;
  assert.equal(bruckner.headline, "Anton Bruckner, Austrian composer, born 1824");
  assert.equal(bruckner.url, "https://www.wikidata.org/wiki/Q1");
  assert.equal(bruckner.priority, PRIORITY_PERSON);
  assert.ok(bruckner.quotation.length >= 20);
  // A short name with no description has nothing twenty characters long to
  // quote from its page, so it is not filed: a story has a receipt or it is
  // not on the wall.
  assert.equal(byKey.has("subject:person:Q3"), false);
  assert.equal(byKey.get("subject:person:Q4")!.priority, PRIORITY_HISTORY, "only the top few people lead");
  assert.equal(byKey.get("subject:birth_fact:9")!.headline, "The first Wii console went on sale in Japan on this date.");
  const mario = byKey.get("subject:cultural_event:11")!;
  assert.equal(mario.headline, "2015: Nintendo shipped the level editor and people spent a decade making levels.");
  assert.equal(mario.priority, PRIORITY_PICK, "somebody wrote about it");
  assert.equal(byKey.has("subject:cultural_event:12"), false, "a bare imported title is not on the page and not on the wall");
});

test("when the board has room and nobody has buzzed, the date's picks go on before the feeds, and one buzz beats any priority", () => {
  const stories: StoryInput[] = [];
  for (let i = 0; i < 20; i++) stories.push({ id: `news-${String(i).padStart(2, "0")}`, tier: "claimed", support: 0, priority: 0, placedAt: 1 });
  stories.push({ id: "pick", tier: "claimed", support: 0, priority: PRIORITY_PICK, placedAt: 2 });
  stories.push({ id: "person", tier: "claimed", support: 0, priority: PRIORITY_PERSON, placedAt: 2 });
  stories.push({ id: "buzzed-news", tier: "claimed", support: 1, priority: 0, placedAt: 3 });
  const result = allocate(stories);
  const placed = result.placed.map((p) => p.id);
  assert.deepEqual(placed.slice(0, 3), ["buzzed-news", "pick", "person"]);
  assert.ok(result.overflow.length > 0);
});

// The bug that kept every one of these stories off the hive for as long as
// the seeder existed. `cultural_events.event_date` is a date column, and the
// read asked the automatic interface for `event_date=like.*-09-09`, which
// builds `event_date LIKE '%-09-09'` and which Postgres refuses outright:
// there is no `date ~~ text` operator, so it answers 42883. That is a 400,
// the read throws it, the throw takes the whole date's history with it, and
// tick.ts logs one line and moves on to the news. The wall filled with wire
// copy and nothing said why.
//
// The date is screened here now, so these assert the screen rather than a
// query string, and the seeder no longer asks a date column to match text.

test("a month and a day are written the way a stored date writes them", () => {
  assert.equal(monthDay(9, 9), "09-09");
  assert.equal(monthDay(12, 25), "12-25");
  assert.equal(monthDay(1, 1), "01-01");
});

test("the month and day of a stored date, and nothing at all from a value that is not one", () => {
  assert.equal(monthDayOf("1994-09-09"), "09-09");
  assert.equal(monthDayOf("2026-12-25"), "12-25");
  // The automatic interface can hand a date back with a time on it.
  assert.equal(monthDayOf("1994-09-09T00:00:00+00:00"), "09-09");
  // A row filed under something nobody can read matches no date rather than
  // being guessed at.
  assert.equal(monthDayOf(""), "");
  assert.equal(monthDayOf("not a date"), "");
  assert.equal(monthDayOf("09-09"), "");
});

test("the culture screen keeps this date's rows and drops every other date, whatever the year", () => {
  const rows = [
    { id: 1, event_date: "2015-09-09", keep: true },
    { id: 2, event_date: "1977-09-09", keep: true },
    { id: 3, event_date: "2015-09-08", keep: false },
    { id: 4, event_date: "2015-10-09", keep: false },
    { id: 5, event_date: "", keep: false },
  ];
  const kept = rows.filter((r) => monthDayOf(r.event_date) === monthDay(9, 9)).map((r) => r.id);
  assert.deepEqual(kept, rows.filter((r) => r.keep).map((r) => r.id));
});
