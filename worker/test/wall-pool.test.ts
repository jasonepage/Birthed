import { strict as assert } from "node:assert";
import { test } from "node:test";

import { HOLD_MS, eligibleForWall, hasEnoughEvidence, independentOwners, isSeeded, tierFor } from "../src/wall/pool.js";

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

test("a seeded story waits for its quotation and nothing else", () => {
  const verified = [{ owner: "National Public Radio", verified: true }];
  const unverified = [{ owner: "National Public Radio", verified: false }];
  const seeded = { support: 0, submittedAt: T0, submittedBy: null };
  const person = { support: 0, submittedAt: T0, submittedBy: "11111111-1111-1111-1111-111111111111" };

  // Today's news reaches today's wall the moment its quotation is found on the
  // page. No hold, no boost. Otherwise submitted_at, which is when the row was
  // written, would keep today's news off today's wall until tomorrow.
  assert.equal(eligibleForWall(seeded, verified, T0), true);
  assert.equal(eligibleForWall(seeded, verified, T0 + 60_000), true);

  // An unverified quotation still keeps it off the board completely.
  assert.equal(eligibleForWall(seeded, unverified, T0), false);
  assert.equal(eligibleForWall(seeded, [], T0), false);

  // None of that is waived for a story a person submitted. It waits out the
  // hold and still needs somebody other than the submitter to agree.
  assert.equal(eligibleForWall(person, verified, T0), false);
  assert.equal(eligibleForWall(person, verified, T0 + HOLD_MS), false);
  assert.equal(eligibleForWall({ ...person, support: 1 }, verified, T0 + HOLD_MS - 1), false);
  assert.equal(eligibleForWall({ ...person, support: 1 }, verified, T0 + HOLD_MS), true);
});

test("only a null submitter counts as seeded", () => {
  assert.equal(isSeeded({ submittedBy: null }), true);
  assert.equal(isSeeded({}), false, "an absent field must not waive the rule");
  assert.equal(isSeeded({ submittedBy: "11111111-1111-1111-1111-111111111111" }), false);
});
