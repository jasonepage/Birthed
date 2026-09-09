import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  BOARD_MODULES,
  CLAIMED_CEILING,
  CONFIRMED_CEILING,
  allocate,
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

test("target size is clamp(1, tier ceiling, floor(support / 5))", () => {
  assert.equal(targetModules("claimed", 0), 1);
  assert.equal(targetModules("claimed", 4), 1);
  assert.equal(targetModules("claimed", 5), 1);
  assert.equal(targetModules("claimed", 10), 2);
  assert.equal(targetModules("claimed", 1000), CLAIMED_CEILING);
  assert.equal(targetModules("reported", 1000), CONFIRMED_CEILING);
  assert.equal(targetModules("seen_direct", 119), 23);
  assert.equal(targetModules("seen_direct", 120), 24);
});

test("a new story lands on the free module nearest the centre and grows toward its target", () => {
  const result = allocate([story("a", { support: 20 })]);
  assert.deepEqual(result.overflow, []);
  assert.equal(result.placed.length, 1);
  const a = result.placed[0]!;
  assert.equal(a.mx, 8);
  assert.equal(a.my, 7);
  // 1x1, then width to 2x1, then w is no longer at most h times 1.5 so height, 2x2.
  assert.equal(a.w * a.h, 4);
  assert.deepEqual({ w: a.w, h: a.h }, { w: 2, h: 2 });
});

test("growth prefers width while w is at most h times 1.5 and reaches 24 as 6 by 4", () => {
  const result = allocate([story("a", { support: 200 })]);
  const a = result.placed[0]!;
  assert.deepEqual({ w: a.w, h: a.h }, { w: 6, h: 4 });
});

test("anchors never change across repeated runs, and later runs only grow", () => {
  const first = allocate([
    story("a", { support: 5, placedAt: "2026-09-09T10:00:00Z" }),
    story("b", { support: 5, placedAt: "2026-09-09T11:00:00Z" }),
    story("c", { support: 5, placedAt: "2026-09-09T12:00:00Z" }),
  ]);
  const byId = new Map(first.placed.map((p) => [p.id, p]));

  const second = allocate([
    story("a", { support: 40, placedAt: "2026-09-09T10:00:00Z", anchor: byId.get("a")! }),
    story("b", { support: 5, placedAt: "2026-09-09T11:00:00Z", anchor: byId.get("b")! }),
    story("c", { support: 15, placedAt: "2026-09-09T12:00:00Z", anchor: byId.get("c")! }),
    story("d", { support: 5, placedAt: "2026-09-09T13:00:00Z" }),
  ]);
  for (const after of second.placed) {
    const before = byId.get(after.id);
    if (before === undefined) continue;
    assert.equal(after.mx, before.mx, `${after.id} moved in x`);
    assert.equal(after.my, before.my, `${after.id} moved in y`);
    assert.ok(after.w >= before.w, `${after.id} got narrower`);
    assert.ok(after.h >= before.h, `${after.id} got shorter`);
  }
  noOverlap(second.placed);
});

test("a tile never shrinks when its support falls", () => {
  const anchor = { mx: 8, my: 7, w: 3, h: 2 };
  const result = allocate([story("a", { support: 0, anchor })]);
  assert.deepEqual(result.placed[0], { id: "a", ...anchor });
});

test("growth respects tier ceilings", () => {
  const claimed = allocate([story("a", { tier: "claimed", support: 500 })]);
  assert.equal(claimed.placed[0]!.w * claimed.placed[0]!.h, CLAIMED_CEILING);

  const reported = allocate([story("b", { tier: "reported", support: 500 })]);
  assert.equal(reported.placed[0]!.w * reported.placed[0]!.h, CONFIRMED_CEILING);

  const seen = allocate([story("c", { tier: "seen_direct", support: 500 })]);
  assert.equal(seen.placed[0]!.w * seen.placed[0]!.h, CONFIRMED_CEILING);
});

test("a full board returns overflow rather than throwing", () => {
  const stories: StoryInput[] = [];
  for (let i = 0; i < BOARD_MODULES * BOARD_MODULES + 3; i++) {
    stories.push(story(`s${String(i).padStart(3, "0")}`, {
      support: 1,
      placedAt: Date.UTC(2026, 8, 9, 0, 0, i),
    }));
  }
  const result = allocate(stories);
  assert.equal(result.placed.length, BOARD_MODULES * BOARD_MODULES);
  assert.deepEqual(result.overflow, ["s256", "s257", "s258"]);
  noOverlap(result.placed);
});

test("a blocked tile does not grow at all", () => {
  // Six one module tiles around a seventh whose right column and bottom row
  // are both taken. The seventh wants four modules and gets none.
  const anchors: Record<string, { mx: number; my: number; w: number; h: number }> = {
    centre: { mx: 8, my: 7, w: 1, h: 1 },
    right: { mx: 9, my: 7, w: 1, h: 1 },
    below: { mx: 8, my: 8, w: 1, h: 1 },
  };
  const result = allocate([
    story("centre", { support: 100, placedAt: 1, anchor: anchors.centre }),
    story("right", { support: 0, placedAt: 2, anchor: anchors.right }),
    story("below", { support: 0, placedAt: 3, anchor: anchors.below }),
  ]);
  const centre = result.placed.find((p) => p.id === "centre")!;
  assert.deepEqual({ w: centre.w, h: centre.h }, { w: 1, h: 1 });
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
  for (const p of a.placed) {
    assert.ok(p.mx >= 0 && p.my >= 0 && p.mx + p.w <= BOARD_MODULES && p.my + p.h <= BOARD_MODULES);
  }
});

test("equal placement times fall back to id order", () => {
  const result = allocate([story("b"), story("a")]);
  assert.equal(result.placed[0]!.id, "a");
  assert.deepEqual({ mx: result.placed[0]!.mx, my: result.placed[0]!.my }, { mx: 8, my: 7 });
});

test("a stored rectangle that overlaps another stored rectangle is refused, because it cannot be true", () => {
  assert.throws(() => allocate([
    story("a", { anchor: { mx: 0, my: 0, w: 2, h: 2 } }),
    story("b", { anchor: { mx: 1, my: 1, w: 2, h: 2 } }),
  ]));
});
