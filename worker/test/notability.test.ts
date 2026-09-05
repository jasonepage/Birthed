import test from "node:test";
import assert from "node:assert/strict";
import { notabilityScore, signals } from "../src/notability.js";

const plain = { monthlyViews: 100_000, birthYear: 1900, isLiving: false, hasSocial: false, description: null };

test("the score starts from how many people look somebody up", () => {
  assert.equal(notabilityScore(plain), 100_000);
});

test("coverage no longer beats attention", () => {
  // The first bug: a footballer with articles in forty languages and 4,000
  // English readers a month outranked a pop star with two million.
  const footballer = notabilityScore({
    monthlyViews: 4_000, birthYear: 1993, isLiving: true, hasSocial: true,
    description: "French footballer",
  });
  const popStar = notabilityScore({
    monthlyViews: 2_000_000, birthYear: 1981, isLiving: true, hasSocial: true,
    description: "American singer",
  });
  assert.ok(popStar > footballer * 100);
});

test("an internet person outranks a working actor read slightly more often", () => {
  // The second bug: pageviews alone hand the page to screen actors, because
  // that is who Wikipedia readers look up. This audience does not open a
  // birthday app for a supporting cast member.
  const actor = notabilityScore({
    monthlyViews: 80_000, birthYear: 1978, isLiving: true, hasSocial: false,
    description: "American actor",
  });
  const creator = notabilityScore({
    monthlyViews: 60_000, birthYear: 1988, isLiving: true, hasSocial: true,
    description: "American YouTuber and internet personality",
  });
  assert.ok(creator > actor, `creator ${creator} should beat actor ${actor}`);
});

test("the creator lift is a lift, not a licence", () => {
  const smallCreator = notabilityScore({
    monthlyViews: 5_000, birthYear: 1999, isLiving: true, hasSocial: true,
    description: "British streamer",
  });
  const enormousActor = notabilityScore({
    monthlyViews: 900_000, birthYear: 1975, isLiving: true, hasSocial: true,
    description: "American actress and producer",
  });
  assert.ok(enormousActor > smallCreator);
});

test("musicians get a smaller lift than internet people", () => {
  const base = { monthlyViews: 50_000, birthYear: 1990, isLiving: true, hasSocial: true };
  const rapper = notabilityScore({ ...base, description: "American rapper" });
  const creator = notabilityScore({ ...base, description: "American YouTuber" });
  const nobody = notabilityScore({ ...base, description: "American lawyer" });
  assert.ok(creator > rapper && rapper > nobody);
});

test("matching is case insensitive and reads inside a longer sentence", () => {
  assert.deepEqual(
    signals({ monthlyViews: 1, birthYear: 1990, isLiving: true, hasSocial: false,
              description: "American TikTok personality and singer" }),
    ["creator", "music"],
  );
});

test("no description is not a crash", () => {
  assert.equal(notabilityScore({ ...plain, description: null }), 100_000);
});

test("no views is a real answer", () => {
  assert.equal(notabilityScore({ ...plain, monthlyViews: 0 }), 0);
});

test("the score cannot overflow a Postgres integer", () => {
  const huge = notabilityScore({
    monthlyViews: 2_000_000_000, birthYear: 2000, isLiving: true, hasSocial: true,
    description: "American YouTuber and rapper",
  });
  assert.ok(huge <= 2_147_483_647);
});
