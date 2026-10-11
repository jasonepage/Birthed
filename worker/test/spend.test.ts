import { strict as assert } from "node:assert";
import { test } from "node:test";

import { FACTS_RUN_USD, STORIES_CALL_USD, estimatedUsd, factsCalls, spendLine, storiesCalls } from "../src/spend.js";

test("the facts editor's answer is read for its runs, one model call each", () => {
  assert.equal(factsCalls(JSON.stringify({ runs: 3, scored: 12, shown: 4, errors: [] })), 3);
  assert.equal(factsCalls(JSON.stringify({ runs: 0, scored: 0, shown: 0, errors: [] })), 0);
});

test("the stories editor's answer is read for its calls", () => {
  assert.equal(storiesCalls(JSON.stringify({ status: "done", calls: 2, report: [] })), 2);
  assert.equal(storiesCalls(JSON.stringify({ status: "done", calls: 0, report: [] })), 0);
});

test("an answer that cannot be read counts as nothing rather than failing the tick", () => {
  assert.equal(factsCalls("not json"), 0);
  assert.equal(storiesCalls(""), 0);
  assert.equal(storiesCalls(JSON.stringify({ status: "failed", error: "x" })), 0);
  assert.equal(factsCalls(JSON.stringify({ runs: -4 })), 0);
  assert.equal(factsCalls(JSON.stringify({ runs: "3" })), 0);
  assert.equal(factsCalls("null"), 0);
});

test("the estimate is the two CLAUDE.md prices times the counts", () => {
  assert.equal(estimatedUsd({ facts: 2, stories: 3 }), 2 * FACTS_RUN_USD + 3 * STORIES_CALL_USD);
  assert.equal(FACTS_RUN_USD, 0.005, "about half a cent a facts run");
  assert.equal(STORIES_CALL_USD, 0.01, "about a cent a stories call");
});

test("the line says calls and dollars, and the quiet run is visible too", () => {
  assert.equal(spendLine({ facts: 1, stories: 1 }), "editor: 2 calls, ~$0.02 (facts 1 run, stories 1 call)");
  assert.equal(spendLine({ facts: 20, stories: 2 }), "editor: 22 calls, ~$0.12 (facts 20 runs, stories 2 calls)");
  assert.equal(spendLine({ facts: 0, stories: 0 }), "editor: 0 calls, $0.00");
});

test("one facts run rounds up to a cent rather than down to nothing", () => {
  assert.equal(spendLine({ facts: 1, stories: 0 }), "editor: 1 call, ~$0.01 (facts 1 run, stories 0 calls)");
});
