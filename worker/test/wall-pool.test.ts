import { strict as assert } from "node:assert";
import { test } from "node:test";

import { HOLD_MS, eligibleForWall, hasEnoughEvidence, independentOwners, tierFor } from "../src/wall/pool.js";

const T0 = Date.UTC(2026, 8, 9, 12, 0, 0);

test("two verified sources under different ownership are enough evidence at once", () => {
  const sources = [
    { owner: "Reuters", verified: true },
    { owner: "Associated Press", verified: true },
  ];
  assert.equal(independentOwners(sources), 2);
  assert.equal(hasEnoughEvidence(sources, T0, T0), true);
});

test("two sources under one owner are one source", () => {
  const sources = [
    { owner: "Comcast", verified: true },
    { owner: "comcast", verified: true },
  ];
  assert.equal(independentOwners(sources), 1);
  assert.equal(hasEnoughEvidence(sources, T0, T0), false);
  assert.equal(hasEnoughEvidence(sources, T0, T0 + HOLD_MS), true);
});

test("an unverified source counts for nothing", () => {
  const sources = [
    { owner: "Reuters", verified: true },
    { owner: "Associated Press", verified: false },
  ];
  assert.equal(independentOwners(sources), 1);
});

test("support means at least one unit, and both rules must hold", () => {
  const sources = [{ owner: "Reuters", verified: true }];
  assert.equal(eligibleForWall({ support: 0, submittedAt: T0 }, sources, T0 + HOLD_MS), false);
  assert.equal(eligibleForWall({ support: 1, submittedAt: T0 }, sources, T0 + HOLD_MS - 1), false);
  assert.equal(eligibleForWall({ support: 1, submittedAt: T0 }, sources, T0 + HOLD_MS), true);
});

test("the tier follows the sources unless the story was seen directly", () => {
  const one = [{ owner: "Reuters", verified: true }];
  const two = [...one, { owner: "BBC", verified: true }];
  assert.equal(tierFor(one, false), "claimed");
  assert.equal(tierFor(two, false), "reported");
  assert.equal(tierFor(one, true), "seen_direct");
});
