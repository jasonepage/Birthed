import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  BOARD_MODULES,
  CLAIMED_CEILING,
  CONFIRMED_CEILING,
  MAX_PLACED,
  MIN_H,
  MIN_MODULES,
  MIN_W,
  UNBACKED_PLACED,
  UNITS_PER_MODULE,
  allocate,
  anchorOrder,
  contains,
  moduleOrder,
  overlaps,
  targetModules,
  type Placement,
  type StoryInput,
} from "../src/wall/allocator.js";

function story(id: string, overrides: Partial<StoryInput> = {}): StoryInput {
  return { id, tier: "reported", support: 0, placedAt: `2026-09-09T12:00:00Z`, ...overrides };
}

function noOverlap(placed: Placement[]): void {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      assert.ok(!overlaps(placed[i]!, placed[j]!), `${placed[i]!.id} overlaps ${placed[j]!.id}`);
    }
  }
}

function area(p: { w: number; h: number }): number {
  return p.w * p.h;
}

test("the first free module is the one up and right of the centre point", () => {
  const order = moduleOrder();
  assert.deepEqual(order.slice(0, 4), [
    { mx: 8, my: 7 },
    { mx: 8, my: 8 },
    { mx: 7, my: 8 },
    { mx: 7, my: 7 },
  ]);
  assert.equal(order.length, BOARD_MODULES * BOARD_MODULES);
  assert.equal(new Set(order.map((m) => `${m.mx},${m.my}`)).size, order.length);
});

test("the first place for a new tile is the minimum rectangle centred on the board", () => {
  const order = anchorOrder();
  // A four by three rectangle cannot sit exactly on the centre point, so the
  // nearest four share a distance and are taken clockwise from straight up.
  const first = order[0]!;
  assert.ok(Math.abs(first.mx + MIN_W / 2 - 8) <= 0.5 && Math.abs(first.my + MIN_H / 2 - 8) <= 0.5, JSON.stringify(first));
  assert.equal(order.length, (BOARD_MODULES - MIN_W + 1) * (BOARD_MODULES - MIN_H + 1));
  for (const { mx, my } of order) {
    assert.ok(mx >= 0 && my >= 0 && mx + MIN_W <= BOARD_MODULES && my + MIN_H <= BOARD_MODULES);
  }
});

test("the minimum tile is what a headline needs, and the board caps at a readable number", () => {
  assert.deepEqual({ w: MIN_W, h: MIN_H, modules: MIN_MODULES }, { w: 4, h: 3, modules: 12 });
  assert.equal(MAX_PLACED, 12);
  // Twelve tiles at the minimum leave nearly half the square for growth.
  assert.ok(MAX_PLACED * MIN_MODULES <= BOARD_MODULES * BOARD_MODULES * 0.6);
});

test("target size is min(tier ceiling, minimum plus one module per unit)", () => {
  assert.equal(UNITS_PER_MODULE, 1);
  assert.equal(targetModules("claimed", 0), MIN_MODULES);
  assert.equal(targetModules("claimed", 1), MIN_MODULES + 1);
  assert.equal(targetModules("claimed", 4), MIN_MODULES + 4);
  assert.equal(targetModules("claimed", 1000), CLAIMED_CEILING);
  assert.equal(targetModules("reported", 1000), CONFIRMED_CEILING);
  assert.equal(targetModules("seen_direct", 35), 47);
  assert.equal(targetModules("seen_direct", 36), CONFIRMED_CEILING);
  assert.ok(CLAIMED_CEILING > MIN_MODULES && CONFIRMED_CEILING > CLAIMED_CEILING);
});

test("a story nobody backed is placed at the minimum, near the centre, and not smaller", () => {
  const result = allocate([story("a")]);
  assert.deepEqual(result.overflow, []);
  const a = result.placed[0]!;
  assert.deepEqual({ w: a.w, h: a.h }, { w: MIN_W, h: MIN_H });
  assert.ok(a.mx >= 5 && a.mx <= 7 && a.my >= 5 && a.my <= 7, JSON.stringify(a));
});

test("one tap is one unit, and the first tap visibly grows the tile", () => {
  const untouched = allocate([story("a", { support: 0 })]).placed[0]!;
  const tapped = allocate([story("a", { support: 1 })]).placed[0]!;
  assert.equal(area(untouched), MIN_MODULES);
  // Target thirteen. No step of one module exists, so the preferred whole
  // column is taken: four by three becomes five by three.
  assert.deepEqual({ w: tapped.w, h: tapped.h }, { w: 5, h: 3 });
  assert.ok(contains(tapped, untouched) || area(tapped) > area(untouched));
});

test("a handful of taps keeps showing, and growth prefers width while w is at most h times 1.5", () => {
  const sizes = [0, 1, 4, 9, 13, 17, 24, 29].map((support) => {
    const p = allocate([story("a", { support })]).placed[0]!;
    return area(p);
  });
  // 12, 15, 20, 24, 28, 35, 40, 48: every step is a whole column or row and
  // each one is larger than the last.
  assert.deepEqual(sizes, [12, 15, 20, 24, 28, 35, 40, 48]);
  const big = allocate([story("a", { support: 200 })]).placed[0]!;
  assert.deepEqual({ w: big.w, h: big.h }, { w: 8, h: 6 });
});

test("a step that does not overshoot is taken before one that does", () => {
  // Four by three with a target of sixteen: right to five by three (fifteen,
  // under), then the only fitting steps overshoot and the preferred one is
  // taken, five by four. A rule that stopped at fifteen would leave the
  // fourth tap invisible.
  const p = allocate([story("a", { support: 4 })]).placed[0]!;
  assert.deepEqual({ w: p.w, h: p.h }, { w: 5, h: 4 });
});

test("a tile keeps every module it holds across repeated runs, and later runs only grow", () => {
  const first = allocate([
    story("a", { support: 1, placedAt: "2026-09-09T10:00:00Z" }),
    story("b", { support: 1, placedAt: "2026-09-09T11:00:00Z" }),
    story("c", { support: 1, placedAt: "2026-09-09T12:00:00Z" }),
  ]);
  const byId = new Map(first.placed.map((p) => [p.id, p]));

  const second = allocate([
    story("a", { support: 9, placedAt: "2026-09-09T10:00:00Z", anchor: byId.get("a")! }),
    story("b", { support: 1, placedAt: "2026-09-09T11:00:00Z", anchor: byId.get("b")! }),
    story("c", { support: 4, placedAt: "2026-09-09T12:00:00Z", anchor: byId.get("c")! }),
    story("d", { support: 1, placedAt: "2026-09-09T13:00:00Z" }),
  ]);
  for (const after of second.placed) {
    const before = byId.get(after.id);
    if (before === undefined) continue;
    assert.ok(contains(after, before), `${after.id} gave up ground`);
    assert.ok(after.w >= before.w, `${after.id} got narrower`);
    assert.ok(after.h >= before.h, `${after.id} got shorter`);
  }
  assert.equal(second.placed.length, 4);
  noOverlap(second.placed);
});

test("a tile never shrinks when its support falls, and a stored rectangle below the minimum is kept, not thrown away", () => {
  const anchor = { mx: 8, my: 7, w: 3, h: 2 };
  const result = allocate([story("a", { support: 0, anchor })]);
  // Six modules held, a target of twelve: it grows toward the minimum like
  // any tile toward its target, and every module it held is still its own.
  assert.ok(contains(result.placed[0]!, anchor));
  assert.equal(area(result.placed[0]!), MIN_MODULES);
});

test("growth respects tier ceilings", () => {
  const claimed = allocate([story("a", { tier: "claimed", support: 500 })]);
  assert.equal(area(claimed.placed[0]!), CLAIMED_CEILING);

  const reported = allocate([story("b", { tier: "reported", support: 500 })]);
  assert.equal(area(reported.placed[0]!), CONFIRMED_CEILING);

  const seen = allocate([story("c", { tier: "seen_direct", support: 500 })]);
  assert.equal(area(seen.placed[0]!), CONFIRMED_CEILING);
});

test("the board caps at MAX_PLACED and the rest is overflow, in the list under the board", () => {
  const stories: StoryInput[] = [];
  for (let i = 0; i < MAX_PLACED + 5; i++) {
    stories.push(story(`s${String(i).padStart(3, "0")}`, {
      support: 1,
      placedAt: Date.UTC(2026, 8, 9, 0, 0, i),
    }));
  }
  const result = allocate(stories);
  assert.equal(result.placed.length, MAX_PLACED);
  assert.deepEqual(result.overflow, ["s012", "s013", "s014", "s015", "s016"]);
  noOverlap(result.placed);
  for (const p of result.placed) assert.ok(area(p) >= MIN_MODULES);
});

test("stories nobody backed fill at most UNBACKED_PLACED tiles, and the rest of the board waits for backed ones", () => {
  assert.ok(UNBACKED_PLACED < MAX_PLACED);
  const unbacked: StoryInput[] = [];
  for (let i = 0; i < 20; i++) {
    unbacked.push(story(`u${String(i).padStart(2, "0")}`, { placedAt: Date.UTC(2026, 8, 9, 0, 0, i) }));
  }
  // The seeder's first tick: forty qualify, eight are placed, the board is
  // not finished.
  const seeded = allocate(unbacked);
  assert.equal(seeded.placed.length, UNBACKED_PLACED);
  assert.equal(seeded.overflow.length, 20 - UNBACKED_PLACED);

  // Later, five stories people backed arrive: four take the reserved tiles,
  // the fifth waits, and the unbacked ones still in the list stay there.
  const backed: StoryInput[] = [];
  for (let i = 0; i < 5; i++) {
    backed.push(story(`b${i}`, { support: 2, placedAt: Date.UTC(2026, 8, 9, 3, 0, i) }));
  }
  const anchors = new Map(seeded.placed.map((p) => [p.id, p]));
  const later = allocate([
    ...unbacked.map((s) => ({ ...s, anchor: anchors.get(s.id) ?? null })),
    ...backed,
  ]);
  assert.equal(later.placed.length, MAX_PLACED);
  assert.deepEqual(later.placed.filter((p) => p.id.startsWith("b")).map((p) => p.id), ["b0", "b1", "b2", "b3"]);
  assert.ok(later.overflow.includes("b4"));
  assert.equal(later.overflow.filter((id) => id.startsWith("u")).length, 20 - UNBACKED_PLACED);
  noOverlap(later.placed);
});

test("a tap on an unbacked tile makes room for one more story from the feeds", () => {
  const unbacked: StoryInput[] = [];
  for (let i = 0; i < UNBACKED_PLACED + 1; i++) {
    unbacked.push(story(`u${String(i).padStart(2, "0")}`, { placedAt: Date.UTC(2026, 8, 9, 0, 0, i) }));
  }
  const first = allocate(unbacked);
  assert.deepEqual(first.overflow, [`u${String(UNBACKED_PLACED).padStart(2, "0")}`]);
  const anchors = new Map(first.placed.map((p) => [p.id, p]));
  const tapped = unbacked.map((s, i) => ({ ...s, support: i === 0 ? 1 : 0, anchor: anchors.get(s.id) ?? null }));
  const second = allocate(tapped);
  assert.deepEqual(second.overflow, []);
  assert.equal(second.placed.length, UNBACKED_PLACED + 1);
});

test("a full board returns overflow rather than throwing, even under the cap", () => {
  // Stored rectangles that leave no room for a minimum tile, fewer of them
  // than the cap.
  const stories: StoryInput[] = [];
  let n = 0;
  for (let my = 0; my < BOARD_MODULES; my += 4) {
    for (let mx = 0; mx < BOARD_MODULES; mx += 8) {
      stories.push(story(`f${n++}`, { placedAt: n, anchor: { mx, my, w: 8, h: 4 } }));
    }
  }
  assert.ok(stories.length < MAX_PLACED);
  const result = allocate([...stories, story("late", { support: 5, placedAt: 100 })]);
  assert.equal(result.placed.length, stories.length);
  assert.deepEqual(result.overflow, ["late"]);
});

test("among new stories the most supported is placed first, so a backed story reaches the board before an unbacked one", () => {
  const stories: StoryInput[] = [];
  for (let i = 0; i < UNBACKED_PLACED + 1; i++) {
    stories.push(story(`unbacked-${String(i).padStart(2, "0")}`, { placedAt: Date.UTC(2026, 8, 9, 0, 0, i) }));
  }
  // Arrived last, backed by three people.
  stories.push(story("backed", { support: 3, placedAt: Date.UTC(2026, 8, 9, 1, 0, 0) }));
  const result = allocate(stories);
  assert.ok(result.placed.some((p) => p.id === "backed"), "the backed story is on the board");
  assert.deepEqual(result.overflow, [`unbacked-${String(UNBACKED_PLACED).padStart(2, "0")}`]);
  // And it took the centre, because it was considered first.
  const backed = result.placed.find((p) => p.id === "backed")!;
  assert.ok(backed.mx >= 4 && backed.mx <= 8 && backed.my >= 4 && backed.my <= 8, JSON.stringify(backed));
});

test("a stored rectangle is never displaced by a newer, better supported story", () => {
  const first = allocate([story("early", { placedAt: 1 })]).placed[0]!;
  const second = allocate([
    story("early", { placedAt: 1, anchor: first }),
    story("late", { support: 30, placedAt: 2 }),
  ]);
  const early = second.placed.find((p) => p.id === "early")!;
  assert.ok(contains(early, first));
  noOverlap(second.placed);
});

test("a tile boxed in on all four sides does not grow at all", () => {
  const anchors: Record<string, { mx: number; my: number; w: number; h: number }> = {
    centre: { mx: 6, my: 6, w: 4, h: 3 },
    right: { mx: 10, my: 6, w: 4, h: 3 },
    below: { mx: 6, my: 9, w: 4, h: 3 },
    left: { mx: 2, my: 6, w: 4, h: 3 },
    above: { mx: 6, my: 3, w: 4, h: 3 },
  };
  const result = allocate([
    story("centre", { support: 100, placedAt: 1, anchor: anchors.centre }),
    story("right", { support: 0, placedAt: 2, anchor: anchors.right }),
    story("below", { support: 0, placedAt: 3, anchor: anchors.below }),
    story("left", { support: 0, placedAt: 4, anchor: anchors.left }),
    story("above", { support: 0, placedAt: 5, anchor: anchors.above }),
  ]);
  const centre = result.placed.find((p) => p.id === "centre")!;
  assert.deepEqual({ w: centre.w, h: centre.h }, { w: 4, h: 3 });
});

test("a tile blocked on the right and below grows left and up instead", () => {
  // The case section 10 of docs/the-wall.md found: the first story on a busy
  // day is surrounded within the hour on the two sides growth used to go.
  const result = allocate([
    story("centre", { support: 4, placedAt: 1, anchor: { mx: 6, my: 6, w: 4, h: 3 } }),
    story("right", { support: 0, placedAt: 2, anchor: { mx: 10, my: 6, w: 4, h: 3 } }),
    story("below", { support: 0, placedAt: 3, anchor: { mx: 6, my: 9, w: 4, h: 3 } }),
  ]);
  const centre = result.placed.find((p) => p.id === "centre")!;
  // Width first: the column on the left. Then w is no longer at most h times
  // 1.5, so a row, and the one below is taken, so the one above.
  assert.deepEqual(centre, { id: "centre", mx: 5, my: 5, w: 5, h: 4 });
  assert.ok(contains(centre, { mx: 6, my: 6, w: 4, h: 3 }));
  noOverlap(result.placed);
});

test("right is preferred over left and down over up", () => {
  const result = allocate([story("a", { support: 4, anchor: { mx: 6, my: 6, w: 4, h: 3 } })]);
  assert.deepEqual(result.placed[0], { id: "a", mx: 6, my: 6, w: 5, h: 4 });
});

test("growth up or left stops at the edge of the board", () => {
  const result = allocate([
    story("corner", { support: 20, placedAt: 1, anchor: { mx: 0, my: 0, w: 4, h: 3 } }),
    story("right", { support: 0, placedAt: 2, anchor: { mx: 4, my: 0, w: 4, h: 3 } }),
    story("below", { support: 0, placedAt: 3, anchor: { mx: 0, my: 3, w: 4, h: 3 } }),
  ]);
  const corner = result.placed.find((p) => p.id === "corner")!;
  assert.deepEqual(corner, { id: "corner", mx: 0, my: 0, w: 4, h: 3 });
});

test("placement is deterministic under identical inputs, whatever order they arrive in", () => {
  const stories: StoryInput[] = [];
  for (let i = 0; i < 40; i++) {
    stories.push(story(`story-${i}`, {
      tier: i % 3 === 0 ? "claimed" : i % 3 === 1 ? "reported" : "seen_direct",
      support: (i * 7) % 60,
      placedAt: Date.UTC(2026, 8, 9, 0, i % 5, 0),
    }));
  }
  const a = allocate(stories);
  const b = allocate([...stories].reverse());
  const c = allocate(stories);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
  noOverlap(a.placed);
  assert.ok(a.placed.length <= MAX_PLACED);
  for (const p of a.placed) {
    assert.ok(p.mx >= 0 && p.my >= 0 && p.mx + p.w <= BOARD_MODULES && p.my + p.h <= BOARD_MODULES);
    assert.ok(area(p) >= MIN_MODULES);
  }
});

test("equal support and equal placement times fall back to id order", () => {
  const result = allocate([story("b"), story("a")]);
  assert.equal(result.placed[0]!.id, "a");
});

test("a stored rectangle that overlaps another stored rectangle is refused, because it cannot be true", () => {
  assert.throws(() => allocate([
    story("a", { anchor: { mx: 0, my: 0, w: 2, h: 2 } }),
    story("b", { anchor: { mx: 1, my: 1, w: 2, h: 2 } }),
  ]));
});
