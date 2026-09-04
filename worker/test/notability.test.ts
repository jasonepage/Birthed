import test from "node:test";
import assert from "node:assert/strict";
import { notabilityScore } from "../src/notability.ts";

test("a long dead figure scores on sitelinks alone", () => {
  assert.equal(notabilityScore({ sitelinks: 10, birthYear: 1900, isLiving: false }), 100);
});

test("a living modern figure outranks a dead one with the same coverage", () => {
  const living = notabilityScore({ sitelinks: 10, birthYear: 1990, isLiving: true });
  const dead = notabilityScore({ sitelinks: 10, birthYear: 1900, isLiving: false });
  assert.equal(living, 225);
  assert.ok(living > dead);
});

test("being modern helps even when the person has died", () => {
  assert.equal(notabilityScore({ sitelinks: 10, birthYear: 1990, isLiving: false }), 150);
});

test("a missing birth year takes no recency bonus and does not crash", () => {
  assert.equal(notabilityScore({ sitelinks: 4, birthYear: null, isLiving: false }), 40);
});

test("the cutoff year is inclusive", () => {
  const atCutoff = notabilityScore({ sitelinks: 10, birthYear: 1960, isLiving: false });
  const beforeCutoff = notabilityScore({ sitelinks: 10, birthYear: 1959, isLiving: false });
  assert.equal(atCutoff, 150);
  assert.equal(beforeCutoff, 100);
});
