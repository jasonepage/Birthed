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

// ---------------------------------------------------------------------------

import { selectCandidates } from "../src/notability.js";

const creator = { sitelinks: 13, shortDescription: "American internet personality and YouTuber" };
const footballer = (n: number) => ({ sitelinks: n, shortDescription: "French footballer" });

test("an internet person is always looked up, however few languages cover them", () => {
  // Trisha Paytas has 13 sitelinks on a date with thousands of people. Picking
  // candidates by coverage cut her before her pageviews were ever consulted,
  // which put back the exact bias the score had just removed.
  const crowd = Array.from({ length: 300 }, (_, index) => footballer(100 - (index % 90)));
  const chosen = selectCandidates([...crowd, creator], 160);
  assert.ok(chosen.includes(creator), "the creator must survive the cap");
  assert.equal(chosen.length, 160);
});

test("the rest of the budget goes to the widest covered", () => {
  const chosen = selectCandidates([footballer(5), footballer(90), footballer(40)], 2);
  assert.deepEqual(chosen.map((p) => p.sitelinks), [90, 40]);
});

test("creators alone can fill the whole budget and nothing breaks", () => {
  const many = Array.from({ length: 20 }, () => ({ ...creator }));
  const chosen = selectCandidates([...many, footballer(99)], 5);
  assert.equal(chosen.length, 20, "creators are never cut, so the cap can be exceeded by them");
  assert.ok(!chosen.some((p) => p.shortDescription === "French footballer"));
});

test("an empty date is an empty list", () => {
  assert.deepEqual(selectCandidates([], 160), []);
});
