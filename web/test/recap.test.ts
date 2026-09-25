import { test } from "node:test";
import assert from "node:assert/strict";
import { isSealed, recapPath, renderRecap, sealedRecap } from "../src/recap.js";
import type { WallDay } from "../src/wall.js";

const story = (id: string, headline: string, support: number, extra: Record<string, unknown> = {}) =>
  ({ id, headline, support, status: "placed", subjectKind: null, outlet: "wikipedia.org", interest: null, ...extra });

// September 23, 2026 sealed at 04:00 UTC on September 25.
const CLOSES = "2026-09-25T04:00:00Z";
const day = {
  wallDate: "2026-09-23", year: 2026, month: 9, day: 23,
  opensAt: "2026-09-22T04:00:00Z", liveAt: "2026-09-23T04:00:00Z", closesAt: CLOSES, closedAt: null,
  stories: [
    story("a", "1789: Congress passes twelve amendments", 2),
    story("b", "A man in a Batman costume stole a handbag", 2),
    story("c", "Stamford Bridge, 1066", 1),
    story("d", "A false thing", 3, { status: "false" }),
    story("e", "Nobody buzzed <this>", 0),
  ],
  boosts: [
    { id: 1, storyId: "a", units: 1, castAt: "2026-09-23T13:00:00Z" },
    { id: 2, storyId: "b", units: 1, castAt: "2026-09-23T13:30:00Z" },
    { id: 3, storyId: "a", units: 1, castAt: "2026-09-23T15:06:00Z" },
    { id: 4, storyId: "b", units: 1, castAt: "2026-09-23T16:00:00Z" },
    { id: 5, storyId: "c", units: 1, castAt: "2026-09-23T17:00:00Z" },
    { id: 6, storyId: "d", units: 1, castAt: "2026-09-23T18:00:00Z" },
  ],
} as unknown as WallDay;

test("a day that can still move gets no picture", () => {
  const before = Date.parse(CLOSES) - 1;
  assert.equal(isSealed(day, before), false);
  assert.equal(sealedRecap(day, before), null);
  assert.equal(isSealed(day, Date.parse(CLOSES)), true);
});

test("a sealed day's picture carries the crown, the total and the most buzzed", () => {
  const recap = sealedRecap(day, Date.parse(CLOSES) + 60_000)!;
  assert.equal(recap.totalBuzzes, 6, "every buzz counts toward the total");
  assert.equal(recap.crown?.name, "1789: Congress passes twelve amendments", "a tie is held by whoever reached it first");
  assert.equal(recap.crown?.buzzes, 2);
  assert.deepEqual(recap.below.map((l) => l.name), ["A man in a Batman costume stole a handbag", "Stamford Bridge, 1066"],
    "not the crown again, not a story stamped false, not a story nobody buzzed");
  assert.deepEqual(recap.songs, []);
});

test("the picture names the date and escapes what the sources wrote", () => {
  const recap = sealedRecap(day, Date.parse(CLOSES))!;
  recap.crown = { name: "<script>alert(1)</script>", buzzes: 2 };
  const html = renderRecap(recap);
  assert.ok(html.includes("September 23, 2026"));
  assert.ok(html.includes("Sealed with 6 buzzes"));
  assert.ok(html.includes("birthed.app/september-23/"));
  assert.ok(!html.includes("<script>alert"), "a headline never becomes markup");
  assert.ok(!html.includes("Stuck in everyone"), "no songs, no songs section");
});

test("the songs have a place to go once the prompt ships", () => {
  const recap = sealedRecap(day, Date.parse(CLOSES), [
    { title: "Espresso", artist: "Sabrina Carpenter", count: 4 },
    { title: "Dreams", artist: "Fleetwood Mac", count: 9 },
  ])!;
  assert.equal(recap.songs[0]?.title, "Dreams", "most named first");
  const html = renderRecap(recap);
  assert.ok(html.includes("Stuck in everyone&#39;s head") || html.includes("Stuck in everyone's head"));
  assert.ok(html.includes("Fleetwood Mac"));
  assert.equal(recap.below.length, 2, "two stories under the crown when the songs are drawn, so the square fits");
});

test("a day nobody buzzed still gets a picture, and says so", () => {
  const quiet = { ...day, boosts: [], stories: day.stories.map((s) => ({ ...s, support: 0 })) } as unknown as WallDay;
  const recap = sealedRecap(quiet, Date.parse(CLOSES))!;
  assert.equal(recap.crown, null);
  assert.equal(recap.totalBuzzes, 0);
  assert.ok(renderRecap(recap).includes("Nobody buzzed this one"));
});

test("the stored path is the date and nothing else", () => {
  assert.equal(recapPath("2026-09-23"), "2026-09-23.png");
});
