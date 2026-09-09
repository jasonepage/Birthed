import { strict as assert } from "node:assert";
import { test } from "node:test";

import { BOARD_MODULES, overlaps } from "../src/wall/allocator.js";
import {
  addDays, easternDateOf, easternMidnight, plan, playback, seedId, toSql, type PlannedDay,
} from "../src/wall/seed.js";

const NOW = Date.parse("2026-09-09T20:30:00Z");

function seeded(): PlannedDay[] {
  const days = plan({ from: "2026-08-27", to: "2026-09-10", seed: 2026, now: NOW, busyDate: "2026-09-05" });
  for (const day of days) playback(day, NOW);
  return days;
}

test("Eastern midnight is four hours behind in September and five in January", () => {
  assert.equal(new Date(easternMidnight("2026-09-09")).toISOString(), "2026-09-09T04:00:00.000Z");
  assert.equal(new Date(easternMidnight("2026-01-09")).toISOString(), "2026-01-09T05:00:00.000Z");
  assert.equal(easternDateOf(Date.parse("2026-09-10T03:59:00Z")), "2026-09-09");
  assert.equal(easternDateOf(Date.parse("2026-09-10T04:00:00Z")), "2026-09-10");
  assert.equal(addDays("2026-08-31", 1), "2026-09-01");
});

test("the same seed and clock produce the same plan", () => {
  const a = seeded();
  const b = seeded();
  assert.deepEqual(a, b);
  assert.equal(a.length, 15);
});

test("identifiers are md5 laid out as a uuid, which the printed SQL recomputes", () => {
  assert.match(seedId("x"), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(seedId("x"), seedId("x"));
  assert.notEqual(seedId("x"), seedId("y"));
});

test("every boost obeys the window, the budget and the order of events", () => {
  for (const day of seeded()) {
    const afterAt = easternMidnight(addDays(day.date, 1));
    const spent = new Map<string, number>();
    let last = -Infinity;
    for (const boost of day.boosts) {
      assert.ok(boost.castAt >= day.liveAt, `${day.date}: a boost before the live day`);
      assert.ok(boost.castAt < day.closesAt, `${day.date}: a boost after close`);
      assert.ok(boost.castAt <= NOW, `${day.date}: a boost in the future`);
      assert.ok(boost.castAt >= last, `${day.date}: boosts out of cast order`);
      last = boost.castAt;
      const story = day.stories[boost.storyIndex]!;
      assert.ok(story.submittedAt <= boost.castAt, `${day.date}: a boost before its story was submitted`);
      const castOn = easternDateOf(boost.castAt);
      const key = `${boost.boosterIndex}:${castOn}`;
      const total = (spent.get(key) ?? 0) + boost.units;
      spent.set(key, total);
      const allowance = castOn === day.date ? 3 : boost.castAt >= afterAt ? 1 : 0;
      assert.ok(total <= allowance, `${day.date}: booster ${boost.boosterIndex} spent ${total} on ${castOn}`);
    }
  }
});

test("tomorrow's wall has submissions and no boosts, and the busy day is the crowded one", () => {
  const days = seeded();
  const tomorrow = days.find((d) => d.date === "2026-09-10")!;
  assert.ok(tomorrow.stories.length > 0);
  assert.equal(tomorrow.boosts.length, 0);
  assert.ok(tomorrow.stories.every((s) => s.status === "pool"));

  // The fixture holds 74 distinct articles and a date may carry each once,
  // so a seeded board cannot run out of modules; overflow is proved in the
  // allocator tests. What the busy day proves is that a crowded board places
  // every supported story and leaves the unsupported ones in the pool.
  const busy = days.find((d) => d.date === "2026-09-05")!;
  const quiet = days.find((d) => d.date === "2026-09-04")!;
  assert.ok(busy.stories.length > quiet.stories.length * 3);
  assert.ok(busy.stories.filter((s) => s.status === "placed").length >= 40);
  assert.ok(busy.stories.some((s) => s.status === "pool"));
});

test("placed tiles sit on the board without overlapping, and a placed story has support", () => {
  for (const day of seeded()) {
    const placed = day.stories.filter((s) => s.status === "placed");
    for (const story of placed) {
      const r = story.rect!;
      assert.ok(r.mx >= 0 && r.my >= 0 && r.mx + r.w <= BOARD_MODULES && r.my + r.h <= BOARD_MODULES);
      assert.ok(story.support >= 1);
      assert.ok(story.placedAt !== null);
    }
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        assert.ok(!overlaps(placed[i]!.rect!, placed[j]!.rect!), `${day.date}: tiles overlap`);
      }
    }
    for (const story of day.stories.filter((s) => s.status === "pool")) {
      assert.equal(story.rect, null);
    }
  }
});

test("every date in the range has at least one story once it has opened", () => {
  for (const day of seeded()) {
    assert.ok(day.stories.length > 0, day.date);
    assert.ok(day.stories.every((s) => s.sources.length >= 1));
    assert.ok(day.stories.every((s) => s.sources.every((src) => src.quotation.length >= 20)));
  }
});

test("the printed SQL is one transaction a day and carries the story identifiers by label", () => {
  const day = seeded()[0]!;
  const sql = toSql(day);
  assert.ok(sql.startsWith("begin;"));
  assert.ok(sql.trimEnd().endsWith("commit;"));
  assert.ok(sql.includes(`md5('birthed-wall-seed-story:${day.date}:'`));
  assert.ok(!sql.includes("$j$$j$"));
});

test("on the seeded busy day, the most supported stories are no longer boxed in at one module", () => {
  // The case docs/the-wall.md section 10 found and left alone: the first
  // stories on the busy day were surrounded within the hour and growth only
  // went right and down, so the two with the most support sat at one module
  // each while a claimed story with less held four. Growth now goes in all
  // four directions, section 9, and this is what that buys on the same seed.
  const busy = seeded().find((day) => day.date === "2026-09-05")!;
  const placed = busy.stories.filter((s) => s.rect !== null);
  const area = (s: { rect: { w: number; h: number } | null }): number => (s.rect ? s.rect.w * s.rect.h : 0);
  const confirmed = placed.filter((s) => s.tier !== "claimed").sort((a, b) => b.support - a.support);
  const claimed = placed.filter((s) => s.tier === "claimed");

  // The three stories section 10 named, by their support on this seed.
  const seventyOne = confirmed.find((s) => s.tier === "seen_direct" && s.support === 71)!;
  const sixtyTwo = confirmed.find((s) => s.tier === "seen_direct" && s.support === 62)!;
  const thirtyEight = claimed.find((s) => s.support === 38)!;
  assert.ok(seventyOne && sixtyTwo && thirtyEight, "the seed still produces the stories section 10 describes");
  assert.equal(area(thirtyEight), 4, "the claimed story still holds four, its ceiling");
  assert.ok(area(seventyOne) > area(thirtyEight), `71 units holds ${area(seventyOne)} modules`);
  assert.ok(area(sixtyTwo) > area(thirtyEight), `62 units holds ${area(sixtyTwo)} modules`);

  const biggestClaimed = Math.max(...claimed.map(area));
  assert.equal(biggestClaimed, 4, "a claimed story is still capped at four modules");
  const larger = confirmed.slice(0, 5).filter((s) => area(s) > biggestClaimed).length;
  assert.ok(larger >= 3, `${larger} of the five most supported confirmed stories are bigger than any claimed one`);

  // Every module a tile held at any tick, it still holds at the end.
  for (const story of placed) {
    assert.ok(story.rect!.mx >= 0 && story.rect!.my >= 0);
    assert.ok(story.rect!.mx + story.rect!.w <= BOARD_MODULES && story.rect!.my + story.rect!.h <= BOARD_MODULES);
  }
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      assert.ok(!overlaps(placed[i]!.rect!, placed[j]!.rect!));
    }
  }
});
