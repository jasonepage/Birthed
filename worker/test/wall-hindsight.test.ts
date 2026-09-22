import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  anniversariesDue, anniversaryDate, datesAcrossYears, decideOutcome, firstYearOf, planReturning, returningOutlet,
  type SealedStory, type SourceCopy,
} from "../src/wall/hindsight.js";
import { PRIORITY_HISTORY } from "../src/wall/history.js";

// Hindsight, docs/the-wall.md section 23. What these pin: which stories
// return to a later year's pool and how they are named; which anniversaries
// have arrived; and the three verdicts, decided from the checker's stamp and
// from buzzes on later hives, never from anything about a person.

function sealed(overrides: Partial<SealedStory & { sources: SourceCopy[] }> = {}): SealedStory & { sources: SourceCopy[] } {
  return {
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    wallDate: "2026-09-09",
    headline: "Council approves the river crossing after a decade of study",
    url: "https://www.example.org/news/river-crossing",
    urlKey: "example.org/news/river-crossing",
    outlet: "example.org",
    status: "placed",
    subjectKind: null,
    sources: [{ url: "https://www.example.org/news/river-crossing", urlKey: "example.org/news/river-crossing", outlet: "example.org", owner: "example.org", headline: "Council approves the river crossing", quotation: "The council voted seven to two to approve the crossing." }],
    ...overrides,
  };
}

test("a placed news story from an earlier year returns; the pool, the false, the imported and this year's own do not", () => {
  const earlier = [
    sealed(),
    sealed({ id: "aaaaaaaa-0000-0000-0000-000000000002", urlKey: "example.org/pool", url: "https://example.org/pool", status: "pool" }),
    sealed({ id: "aaaaaaaa-0000-0000-0000-000000000003", urlKey: "example.org/false", url: "https://example.org/false", status: "false" }),
    sealed({ id: "aaaaaaaa-0000-0000-0000-000000000004", urlKey: "person:Q1", url: "https://en.wikipedia.org/wiki/Somebody", status: "placed", subjectKind: "person" }),
    sealed({ id: "aaaaaaaa-0000-0000-0000-000000000005", urlKey: "example.org/this-year", url: "https://example.org/this-year", wallDate: "2027-09-09" }),
    sealed({ id: "aaaaaaaa-0000-0000-0000-000000000006", urlKey: "example.org/other-date", url: "https://example.org/other-date", wallDate: "2026-09-10" }),
  ];
  const plan = planReturning("2027-09-09", earlier);
  assert.deepEqual(plan.map((s) => s.urlKey), ["example.org/news/river-crossing"]);
  const one = plan[0]!;
  assert.equal(one.wallDate, "2027-09-09");
  assert.equal(one.headline, "Council approves the river crossing after a decade of study");
  assert.equal(one.outlet, "example.org, 2026", "the outlet carries the year it first landed");
  assert.equal(one.firstYear, 2026);
  assert.equal(one.sources.length, 1, "its sources come with it");
});

test("a page on two earlier boards returns once, from the year it first landed, and a returning story does not stack years on the outlet", () => {
  const plan = planReturning("2028-09-09", [
    sealed({ id: "aaaaaaaa-0000-0000-0000-000000000011", wallDate: "2027-09-09", outlet: "example.org, 2026" }),
    sealed({ id: "aaaaaaaa-0000-0000-0000-000000000010", wallDate: "2026-09-09" }),
  ]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0]!.outlet, "example.org, 2026");
  assert.equal(plan[0]!.firstYear, 2026);
  // And when only the returned copy survives to be read, the year still comes from the outlet, not the copy's date.
  const again = planReturning("2028-09-09", [sealed({ wallDate: "2027-09-09", outlet: "example.org, 2026" })]);
  assert.equal(again[0]!.outlet, "example.org, 2026");
});

test("a source too short to quote is not copied, and a story with none returns with none", () => {
  const plan = planReturning("2027-09-09", [sealed({ sources: [{ url: "https://example.org/x", urlKey: "example.org/x", outlet: "example.org", owner: "example.org", headline: "x", quotation: "too short" }] })]);
  assert.equal(plan[0]!.sources.length, 0);
});

test("the small helpers", () => {
  assert.equal(returningOutlet("npr.org", 2026), "npr.org, 2026");
  assert.equal(firstYearOf("npr.org, 2026"), 2026);
  assert.equal(firstYearOf("npr.org"), null);
  assert.equal(anniversaryDate("2026-09-09", 1), "2027-09-09");
  assert.equal(anniversaryDate("2028-02-29", 1), "2029-03-01", "February 29 lands on March 1 in a common year");
  assert.deepEqual(anniversariesDue("2026-09-09", "2027-09-08"), []);
  assert.deepEqual(anniversariesDue("2026-09-09", "2027-09-09"), [1]);
  assert.deepEqual(anniversariesDue("2026-09-09", "2031-09-09"), [1, 5]);
  assert.deepEqual(anniversariesDue("2026-09-09", "2040-01-01"), [1, 5, 10]);
  assert.deepEqual(datesAcrossYears("09-09", 2028), ["2026-09-09", "2027-09-09", "2028-09-09"]);
  assert.equal(PRIORITY_HISTORY, 1, "returning stories file at history priority");
});

test("the three verdicts: false is the stamp, held is a buzz on a later hive by the anniversary, forgotten is neither", () => {
  const s = { status: "placed" as const, wallDate: "2026-09-09" };
  assert.equal(decideOutcome({ ...s, status: "false" }, 1, ["2027-09-09"]).outcome, "false", "the stamp wins even if it was buzzed");
  assert.deepEqual(decideOutcome(s, 1, ["2027-09-09"]), { outcome: "held", note: "Buzzed again on the hive for 2027-09-09." });
  assert.equal(decideOutcome(s, 5, ["2027-09-09", "2029-09-09", "2031-09-09"]).note, "Buzzed again on the hive for 2027-09-09 and 2 later hives.");
  assert.deepEqual(decideOutcome(s, 1, []), { outcome: "forgotten", note: "On the board that day. Not buzzed on any later hive for the date by 2027-09-09." });
  // A buzz on its own day is not hindsight, and a buzz after the anniversary cannot move that anniversary's verdict.
  assert.equal(decideOutcome(s, 1, ["2026-09-09"]).outcome, "forgotten");
  assert.equal(decideOutcome(s, 1, ["2028-09-09"]).outcome, "forgotten");
  assert.equal(decideOutcome(s, 5, ["2028-09-09"]).outcome, "held");
});
