import test from "node:test";
import assert from "node:assert/strict";
import { worldScore, isAdultContent, isViolentNotoriety, notabilityScore, signals } from "../src/notability.js";

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

test("a commentator outranks an actor read about as often", () => {
  const pundit = notabilityScore({
    monthlyViews: 40_000, birthYear: 1988, isLiving: true, hasSocial: true,
    description: "American political commentator",
  });
  const actor = notabilityScore({
    monthlyViews: 45_000, birthYear: 1975, isLiving: true, hasSocial: false,
    description: "American actor",
  });
  assert.ok(pundit > actor, `pundit ${pundit} should beat actor ${actor}`);
});

test("politician on its own is not enough, or every mayor arrives", () => {
  assert.deepEqual(
    signals({ monthlyViews: 1, birthYear: 1950, isLiving: true, hasSocial: false,
              description: "American politician" }),
    [],
  );
  assert.deepEqual(
    signals({ monthlyViews: 1, birthYear: 1985, isLiving: true, hasSocial: false,
              description: "American political commentator and podcaster" }),
    ["creator", "commentary"],
  );
});

test("a commentator is always looked up, like any other internet person", () => {
  const pundit = { sitelinks: 6, shortDescription: "American political commentator" };
  const crowd = Array.from({ length: 300 }, (_, i) => footballer(120 - (i % 100)));
  assert.ok(selectCandidates([...crowd, pundit], 160).includes(pundit));
});

// ---------------------------------------------------------------------------
// The third bug: the creator bonus had no idea what it was promoting.

test("an adult performer scores zero however much attention she has", () => {
  // The real row from September 6. 107,393 views a month, and the description
  // matches creatorTerms twice, which was multiplying her by 3.15 and putting
  // her first on the date page.
  assert.equal(
    notabilityScore({
      monthlyViews: 107_393, birthYear: 1996, isLiving: true, hasSocial: true,
      description: "American internet personality, podcaster and former pornographic film actress",
    }),
    0,
  );
});

test("zero is returned before any bonus, so no bonus can outrank it", () => {
  // The failure this guards: writing it as a penalty instead of a return, and
  // then adding a bonus large enough to climb back over the penalty.
  assert.equal(
    notabilityScore({
      monthlyViews: 2_000_000, birthYear: 2000, isLiving: true, hasSocial: true,
      description: "American YouTuber, singer, political commentator and adult film performer",
    }),
    0,
  );
});

test("the wordings Wikidata actually uses are all caught", () => {
  for (const description of [
    "Lebanese-American former pornographic film actress (born 1993)",
    "American adult film performer (born 1978)",
    "Australian pornographic actress, pornographic director, and model (born 1985)",
    "American Twitch streamer and former pornographic actress (born 1991)",
    "Spanish pornographic actor, producer and Internet personality",
    "French nobleman, revolutionary politician, philosopher and writer of erotic works",
  ]) {
    assert.equal(isAdultContent(description), true, description);
  }
});

test("ordinary descriptions are not caught", () => {
  for (const description of [
    "British actor",
    "Irish musician",
    "English musician, co-founder of Pink Floyd",
    "American actress",
    "French general and politician",
    null,
  ]) {
    assert.equal(isAdultContent(description), false, String(description));
  }
});

test("the reason shows up in the signals, so a zero is explainable", () => {
  assert.ok(
    signals({ monthlyViews: 1, birthYear: 1990, isLiving: true, hasSocial: false,
              description: "American pornographic actress" })
      .includes("adult, score forced to 0"),
  );
});

// ---------------------------------------------------------------------------
// The fourth bug, and it is the third one again. Infamy is attention, and
// nobody carried the September 6 adult performer fix to the rest of the list.

test("the five real rows that were opening date pages all score zero", () => {
  // Every one of these was rank one on its own date on September 6, on the
  // page the site asks Google to rank, above a heading reading "The people
  // most looked up on this day".
  for (const [description, who] of [
    ["American serial killer (1946-1989)", "Ted Bundy, November 24"],
    ["American criminal and cult leader (1934-2017)", "Charles Manson, November 12"],
    ["American murderer and human trophy collector (1906-1983)", "Ed Gein, August 27"],
    ["American serial killer (1942-1994)", "John Wayne Gacy, March 17"],
    ["dictator of Italy from 1922 to 1945", "Benito Mussolini, July 29"],
    ["sentenced to death in France", "Hamida Djandoubi, September 22 hive"],
  ] as const) {
    assert.equal(isViolentNotoriety(description), true, who);
    assert.equal(
      notabilityScore({
        monthlyViews: 287_085, birthYear: 1946, isLiving: false, hasSocial: false, description,
      }),
      0,
      who,
    );
  }
});

test("ordinary descriptions are not caught by the violence list", () => {
  for (const description of [
    "American actor and martial artist",
    "British actor",
    "South Korean actress and singer",
    "American comedian, writer, and actor",
    "American professional wrestler",
    "Norwegian actress",
    "English association football player",
    "American criminal defense attorney",
    "American author of crime fiction",
  ]) {
    assert.equal(isViolentNotoriety(description), false, description);
  }
});

test("the screen says why, so a zero can be explained rather than guessed at", () => {
  assert.ok(
    signals({
      monthlyViews: 1, birthYear: 1946, isLiving: false, hasSocial: false,
      description: "American serial killer (1946-1989)",
    }).includes("violence, score forced to 0"),
  );
});

// ---------------------------------------------------------------------------
// What the importer keeps. CLAUDE.md section 5, September 22, 2026.
// ---------------------------------------------------------------------------

test("the world score is the same arithmetic the database column uses", () => {
  // notable_people.world_score, migration 20260922000000. If these two ever
  // disagree, the people kept are not the people shown.
  assert.equal(worldScore(230961, 70, 727527), Math.round(Math.sqrt(230961) * 70));
  assert.equal(worldScore(0, 300, 1), 0, "nobody reads about them in English");
  assert.equal(worldScore(1000, 0, 1), 0, "nobody wrote about them anywhere");
  // A nought stays a nought: the adult content and violence screens decide
  // who never reaches a date page, ahead of this.
  assert.equal(worldScore(9_000_000, 339, 0), 0);
});

test("a dead scientist with the whole world's coverage is not cut by a date's cap", () => {
  // The shape that removed Albert Einstein from March 14. He is dead, born
  // before the modern cut, not a creator and not on social media, so he
  // collects no bonus at all; the people who beat him collect up to 3.15.
  const einstein = { views: 300_000, langs: 321, score: 300_000 };
  // Fifty living entertainers: fewer languages, comparable English traffic,
  // and every multiplier the score has.
  const crowd = Array.from({ length: 50 }, (_, i) => ({
    views: 250_000 + i, langs: 25 + (i % 20), score: Math.round((250_000 + i) * 3.15),
  }));

  const byAttention = [einstein, ...crowd].sort((a, b) => b.score - a.score);
  assert.ok(byAttention.indexOf(einstein) >= 50, "attention alone cuts him at fifty");

  const byWorld = [einstein, ...crowd]
    .sort((a, b) => worldScore(b.views, b.langs, b.score) - worldScore(a.views, a.langs, a.score));
  assert.equal(byWorld[0], einstein, "the world's coverage puts him first");
});
