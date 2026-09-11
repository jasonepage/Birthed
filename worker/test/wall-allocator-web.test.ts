import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { allocate, cutBands, proportional, shares, varied, type StoryInput } from "../src/wall/allocator.js";

// The live hive page runs the pie in the browser, docs/the-wall.md section
// 21, from a plain JavaScript copy in web/src/hive-allocator.ts. This reads
// that copy off disk, evaluates it the way the page does, and runs both
// engines on a few hundred generated boards. If the two ever disagree the
// board a reader watches would jump the moment the tick re-baked it, which
// is the one thing the live page must never do. The same shape as
// wall-points.test.ts holding worker/src/wall/points.ts to the panel's
// formula. Skipped, not passed, when the checkout has no web/.

interface Port {
  allocate(stories: StoryInput[]): { placed: Array<{ id: string; mx: number; my: number; w: number; h: number }>; overflow: string[] } | null;
  shares(weights: number[], total: number, floor: number): number[];
  proportional(weights: number[], total: number, min: number): number[];
  cutBands(areas: number[]): Array<{ mx: number; my: number; w: number; h: number }>;
  varied(unbacked: StoryInput[], limit: number): StoryInput[];
}

function port(t: { skip: (reason: string) => void }): Port | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "..", "..", "web", "src", "hive-allocator.ts");
  if (!existsSync(path)) { t.skip("no web/src/hive-allocator.ts in this checkout"); return null; }
  const source = readFileSync(path, "utf8");
  const match = /export const HIVE_ALLOCATOR_JS = `([\s\S]*?)`;\n/.exec(source);
  assert.ok(match, "HIVE_ALLOCATOR_JS not found in web/src/hive-allocator.ts");
  const js = new Function(`return \`${match![1]}\`;`)() as string;
  return new Function(`${js}; return HiveAllocator;`)() as Port;
}

/** A small deterministic generator, so a failure names a seed that reproduces it. */
function random(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

const KINDS = [null, null, "historical_event", "historical_event", "person", "song", "album", "film", "cultural_event", "birth_fact"];
const OUTLETS = ["npr.org", "bbc.com", "aljazeera.com", "theguardian.com", "en.wikipedia.org"];
const TIERS = ["claimed", "claimed", "reported", "seen_direct"] as const;

function board(seed: number): StoryInput[] {
  const next = random(seed);
  const n = 1 + Math.floor(next() * 40);
  const out: StoryInput[] = [];
  const anyBuzz = next() < 0.7;
  for (let i = 0; i < n; i++) {
    const kind = KINDS[Math.floor(next() * KINDS.length)] ?? null;
    const support = anyBuzz && next() < 0.35 ? 1 + Math.floor(next() * 40) : 0;
    const score = next() < 0.5 ? Math.floor(next() * 120) : 0;
    const story: StoryInput = {
      id: `${seed}-${i}`,
      tier: TIERS[Math.floor(next() * TIERS.length)]!,
      support,
      placedAt: Date.UTC(2026, 8, 11, 4) + Math.floor(next() * 6) * 3_600_000,
      anchor: null,
      subjectKind: kind,
      outlet: kind === null ? OUTLETS[Math.floor(next() * OUTLETS.length)] : "en.wikipedia.org",
    };
    if (score > 0) story.score = score;
    if (next() < 0.6) story.priority = Math.floor(next() * 4);
    out.push(story);
  }
  return out;
}

test("the browser's pie agrees with the worker's on a few hundred generated boards", (t) => {
  const web = port(t);
  if (web === null) return;
  let boards = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const input = board(seed);
    const theirs: ReturnType<Port["allocate"]> = web.allocate(input.map((s) => ({ ...s })));
    const ours = allocate(input);
    assert.deepEqual(theirs, ours, `seed ${seed}`);
    boards += 1;
  }
  assert.equal(boards, 400);
});

test("the port cuts shares, bands and variety exactly as the worker does", (t) => {
  const web = port(t);
  if (web === null) return;
  const next = random(99);
  for (let i = 0; i < 200; i++) {
    const n = 1 + Math.floor(next() * 12);
    const weights = Array.from({ length: n }, () => (next() < 0.2 ? 0 : Math.floor(next() * 50)));
    assert.deepEqual(web.shares(weights, 256, 12), shares(weights, 256, 12), `shares ${weights.join(",")}`);
    const parts = 1 + Math.floor(next() * 4);
    const pw = Array.from({ length: parts }, () => Math.floor(next() * 100));
    assert.deepEqual(web.proportional(pw, 16, 3), proportional(pw, 16, 3), `proportional ${pw.join(",")}`);
    const areas = shares(weights, 256, 12).sort((a, b) => b - a);
    assert.deepEqual(web.cutBands(areas), cutBands(areas), `bands ${areas.join(",")}`);
  }
  for (let seed = 500; seed < 560; seed++) {
    const unbacked = board(seed).map((s) => ({ ...s, support: 0 }));
    assert.deepEqual(web.varied(unbacked, 8).map((s) => s.id), varied(unbacked, 8).map((s) => s.id), `varied ${seed}`);
  }
});

test("the port refuses a board the growth engine owns, rather than cutting a pie with a hole in it", (t) => {
  const web = port(t);
  if (web === null) return;
  const input = board(7);
  input.push({ id: "stamped", tier: "claimed", support: 0, placedAt: Date.UTC(2026, 8, 11, 5), anchor: { mx: 0, my: 0, w: 4, h: 3 }, frozen: true });
  assert.equal(web.allocate(input), null);
  // The worker lays that date out by growth, and does place the stamped story at its rectangle.
  const ours = allocate(input);
  assert.ok(ours.placed.some((p) => p.id === "stamped" && p.mx === 0 && p.my === 0 && p.w === 4 && p.h === 3));
});
