import test from "node:test";
import assert from "node:assert/strict";
import { notabilityScore } from "../src/notability.js";

test("the score starts from how many people look somebody up", () => {
  assert.equal(
    notabilityScore({ monthlyViews: 100_000, birthYear: 1900, isLiving: false, hasSocial: false }),
    100_000,
  );
});

test("coverage no longer beats attention", () => {
  // The bug this replaced: a footballer with articles in forty languages and
  // 4,000 English readers a month outranked a pop star with two million.
  const footballer = notabilityScore({
    monthlyViews: 4_000, birthYear: 1993, isLiving: true, hasSocial: true,
  });
  const popStar = notabilityScore({
    monthlyViews: 2_000_000, birthYear: 1981, isLiving: true, hasSocial: true,
  });
  assert.ok(popStar > footballer * 100);
});

test("a person the internet keeps an account for gets a lift", () => {
  const withSocial = notabilityScore({
    monthlyViews: 10_000, birthYear: 1990, isLiving: true, hasSocial: true,
  });
  const without = notabilityScore({
    monthlyViews: 10_000, birthYear: 1990, isLiving: true, hasSocial: false,
  });
  assert.equal(withSocial, 17_500);
  assert.equal(without, 14_000);
});

test("being modern is a lift, not the whole answer", () => {
  const modern = notabilityScore({
    monthlyViews: 1_000, birthYear: 1995, isLiving: true, hasSocial: false,
  });
  const historical = notabilityScore({
    monthlyViews: 900_000, birthYear: 1770, isLiving: false, hasSocial: false,
  });
  assert.ok(historical > modern, "somebody read 900,000 times a month still wins");
});

test("no views is a real answer and not a crash", () => {
  assert.equal(
    notabilityScore({ monthlyViews: 0, birthYear: null, isLiving: false, hasSocial: true }),
    0,
  );
});

test("the score cannot overflow a Postgres integer", () => {
  const huge = notabilityScore({
    monthlyViews: 2_000_000_000, birthYear: 2000, isLiving: true, hasSocial: true,
  });
  assert.ok(huge <= 2_147_483_647);
});
