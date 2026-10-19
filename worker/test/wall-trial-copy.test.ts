import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { settle } from "../src/wall/check.js";

// The trial, October 19, 2026: the date page and the worker decide burials
// with one replay, copied. This holds the copy to the original byte for
// byte, the way wall-agree-web.test.ts holds the fold.

test("worker/src/wall/trial.ts is web/src/trial.ts, byte for byte", (t) => {
  const here = dirname(fileURLToPath(import.meta.url));
  const web = join(here, "..", "..", "..", "web", "src", "trial.ts");
  const worker = join(here, "..", "..", "src", "wall", "trial.ts");
  if (!existsSync(web)) { t.skip("no web/src/trial.ts in this checkout"); return; }
  assert.equal(readFileSync(worker, "utf8"), readFileSync(web, "utf8"));
});

test("a buried story goes to no board: a placed one gives its rectangle up", () => {
  const day = { wall_date: "2026-10-19", opens_at: "2026-10-18T04:00:00Z", live_at: "2026-10-19T04:00:00Z", closes_at: "2026-10-21T04:00:00Z", closed_at: null };
  const story = (id: string, mx: number) => ({
    id, wall_date: "2026-10-19", submitted_at: "2026-10-19T05:00:00Z", submitted_by: null, status: "placed", tier: "claimed", support: 0, priority: 0,
    subject_kind: null, subject_id: null, outlet: `${id}.com`, placed_at: "2026-10-19T05:01:00Z", anchor_mx: mx, anchor_my: 0, w_modules: 8, h_modules: 8,
  });
  const stories = [story("aaaaaaaa-0000-4000-8000-000000000001", 0), story("bbbbbbbb-0000-4000-8000-000000000002", 8)];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = settle(day as any, stories as any, [], [], "2026-10-19T15:05:00Z", new Map(), new Set(["aaaaaaaa-0000-4000-8000-000000000001"]));
  const gone = out.stories.find((u) => u.id === "aaaaaaaa-0000-4000-8000-000000000001")!;
  assert.equal(gone.status, "overflow");
  assert.equal(gone.anchor_mx, null);
  assert.ok(!out.snapshot!.board.tiles.some((tile) => tile.story_id === "aaaaaaaa-0000-4000-8000-000000000001"));
  assert.deepEqual(out.snapshot!.board.buried, ["aaaaaaaa-0000-4000-8000-000000000001"]);
});
