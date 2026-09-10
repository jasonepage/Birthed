import { strict as assert } from "node:assert";
import { test } from "node:test";

import { CLAIMED_CEILING } from "../src/wall/allocator.js";
import { checkSource, settle, type DayRow, type SourceRow, type StoryRow } from "../src/wall/check.js";
import type { Fetched } from "../src/wall/page.js";
import { HOLD_MS } from "../src/wall/pool.js";

const NOW = "2026-09-09T20:00:00.000Z";
const EARLIER = new Date(Date.parse(NOW) - HOLD_MS - 60_000).toISOString();
const JUST_NOW = new Date(Date.parse(NOW) - 60_000).toISOString();

const DAY: DayRow = {
  wall_date: "2026-09-09",
  opens_at: "2026-09-08T04:00:00Z", live_at: "2026-09-09T04:00:00Z", closes_at: "2026-09-11T04:00:00Z", closed_at: null,
};

const OWNERS = [
  { domain: "npr.org", owner: "National Public Radio" },
  { domain: "cnn.com", owner: "Warner Bros. Discovery" },
  { domain: "nbcnews.com", owner: "Comcast" },
  { domain: "cnbc.com", owner: "Comcast" },
];

const A_PERSON = "11111111-1111-1111-1111-111111111111";

function story(id: string, overrides: Partial<StoryRow> = {}): StoryRow {
  return {
    id, wall_date: "2026-09-09", submitted_at: EARLIER, submitted_by: A_PERSON, status: "pool", tier: "claimed", support: 0, priority: 0, placed_at: null,
    anchor_mx: null, anchor_my: null, w_modules: null, h_modules: null, ...overrides,
  };
}

function source(id: string, storyId: string, url: string, overrides: Partial<SourceRow> = {}): SourceRow {
  return {
    id, story_id: storyId, url, owner: "", quotation: "Five tankers were hit and sunk on Tuesday morning.",
    verified_at: NOW, is_primary_doc: false, imported: false, ...overrides,
  };
}

const PAGE = `<html><head><title>A page</title>
<meta property="og:description" content="Five tankers were hit &amp; sunk on Tuesday morning."></head>
<body><script>var x = "Five tankers were struck";</script>
<p>The   U.S. military said five   tankers were hit and sunk on
Tuesday morning.</p></body></html>`;

function fetched(status: number | null, body: string | null): Fetched {
  return { status, body, finalUrl: status === null ? null : "https://npr.org/a", detail: status === null ? "no answer within 15 seconds" : `${status}` };
}

// ---------------------------------------------------------------------------
// Quotation checks
// ---------------------------------------------------------------------------

test("an exact quotation passes, and verified_at becomes the check time", () => {
  const s = source("s1", "a", "https://npr.org/a", { quotation: "five tankers were hit and sunk on Tuesday morning.", verified_at: null });
  const judged = checkSource(s, fetched(200, PAGE), NOW);
  assert.equal(judged.checks.length, 2);
  assert.deepEqual(judged.checks.map((c) => [c.kind, c.passed]), [["resolves", true], ["quotation", true]]);
  assert.equal(judged.verifiedAt, NOW);
});

test("whitespace is folded on both sides and entities are decoded, and nothing else is forgiven", () => {
  const folded = source("s1", "a", "https://npr.org/a", { quotation: "Five tankers were hit & sunk on\n\nTuesday morning." });
  assert.equal(checkSource(folded, fetched(200, PAGE), NOW).verifiedAt, NOW);
  const cased = source("s1", "a", "https://npr.org/a", { quotation: "five tankers were hit & sunk on tuesday morning." });
  assert.equal(checkSource(cased, fetched(200, PAGE), NOW).verifiedAt, null);
});

test("a paraphrase fails and clears verified_at, with a row that says so", () => {
  const s = source("s1", "a", "https://npr.org/a", { quotation: "Five tankers were struck and sunk on Tuesday morning." });
  const judged = checkSource(s, fetched(200, PAGE), NOW);
  assert.deepEqual(judged.checks.map((c) => [c.kind, c.passed]), [["resolves", true], ["quotation", false]]);
  assert.equal(judged.verifiedAt, null);
  assert.match(judged.checks[1]!.detail, /does not contain/);
});

test("text inside a script is not the page's text", () => {
  const s = source("s1", "a", "https://npr.org/a", { quotation: "Five tankers were struck" });
  assert.equal(checkSource(s, fetched(200, PAGE), NOW).verifiedAt, null);
});

test("a 404, a timeout and a paywall each write two failing rows and clear verified_at", () => {
  for (const f of [fetched(404, "<html>not found</html>"), fetched(null, null), fetched(403, "<html>subscribe</html>")]) {
    const judged = checkSource(source("s1", "a", "https://npr.org/a"), f, NOW);
    assert.equal(judged.checks[0]!.kind, "resolves");
    assert.equal(judged.checks[0]!.passed, false);
    assert.equal(judged.checks[0]!.http_status, f.status);
    assert.equal(judged.checks[1]!.kind, "quotation");
    assert.equal(judged.checks[1]!.passed, false);
    assert.equal(judged.verifiedAt, null);
  }
});

test("a page that resolves but has lost the quotation gets a passing resolves row and a failing quotation row", () => {
  const judged = checkSource(source("s1", "a", "https://npr.org/a"), fetched(200, "<html><p>The story was rewritten.</p></html>"), NOW);
  assert.deepEqual(judged.checks.map((c) => c.passed), [true, false]);
});

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

test("two verified sources under different owners reach reported", () => {
  const settled = settle(DAY, [story("a")], [
    source("s1", "a", "https://www.npr.org/x"),
    source("s2", "a", "https://edition.cnn.com/y"),
  ], OWNERS, NOW);
  assert.equal(settled.stories.find((u) => u.id === "a")?.tier, "reported");
});

test("two verified sources under one owner stay claimed", () => {
  const settled = settle(DAY, [story("a")], [
    source("s1", "a", "https://www.nbcnews.com/x"),
    source("s2", "a", "https://www.cnbc.com/y"),
  ], OWNERS, NOW);
  assert.equal(settled.stories.find((u) => u.id === "a")?.tier, undefined, "claimed already, so nothing to write");
});

test("an unverified second source counts for nothing", () => {
  const settled = settle(DAY, [story("a")], [
    source("s1", "a", "https://www.npr.org/x"),
    source("s2", "a", "https://edition.cnn.com/y", { verified_at: null }),
  ], OWNERS, NOW);
  assert.equal(settled.stories.find((u) => u.id === "a")?.tier, undefined);
});

test("seen directly needs a source a person marked as the thing itself, with a verified quotation", () => {
  const marked = settle(DAY, [story("a")], [source("s1", "a", "https://nasa.gov/x", { is_primary_doc: true })], OWNERS, NOW);
  assert.equal(marked.stories.find((u) => u.id === "a")?.tier, "seen_direct");

  const unverified = settle(DAY, [story("a")], [source("s1", "a", "https://nasa.gov/x", { is_primary_doc: true, verified_at: null })], OWNERS, NOW);
  assert.equal(unverified.stories.find((u) => u.id === "a")?.tier, undefined);

  const notMarked = settle(DAY, [story("a")], [source("s1", "a", "https://nasa.gov/x")], OWNERS, NOW);
  assert.equal(notMarked.stories.find((u) => u.id === "a")?.tier, undefined, "a host name never earns the tier");
});

test("a tier that falls is written down too", () => {
  const settled = settle(DAY, [story("a", { tier: "reported" })], [
    source("s1", "a", "https://www.npr.org/x"),
    source("s2", "a", "https://edition.cnn.com/y", { verified_at: null }),
  ], OWNERS, NOW);
  assert.equal(settled.stories.find((u) => u.id === "a")?.tier, "claimed");
});

test("owners are resolved through the table and corrected on the source, and an unknown domain is its own owner", () => {
  const settled = settle(DAY, [story("a")], [
    source("s1", "a", "https://edition.cnn.com/y", { owner: "cnn.com" }),
    source("s2", "a", "https://example.org/z", { owner: "example.org" }),
  ], OWNERS, NOW);
  assert.deepEqual(settled.owners, [{ id: "s1", owner: "Warner Bros. Discovery" }]);
});

// ---------------------------------------------------------------------------
// Graduation and placement
// ---------------------------------------------------------------------------

test("a single source story graduates after the hold, and not before", () => {
  const sources = [source("s1", "a", "https://www.npr.org/x")];
  const early = settle(DAY, [story("a", { support: 1, submitted_at: JUST_NOW })], sources, OWNERS, NOW);
  assert.equal(early.stories.length, 0);
  assert.equal(early.snapshot, null);

  const held = settle(DAY, [story("a", { support: 1, submitted_at: EARLIER })], sources, OWNERS, NOW);
  const a = held.stories.find((u) => u.id === "a")!;
  assert.equal(a.status, "placed");
  assert.equal(a.placed_at, NOW);
  // One unit: the minimum four by three plus its first whole column.
  assert.deepEqual([a.anchor_mx, a.anchor_my, a.w_modules, a.h_modules], [6, 6, 5, 3]);
  assert.equal(held.snapshot?.board.tiles.length, 1);
});

test("two independently owned verified sources place at once, without the hold", () => {
  const settled = settle(DAY, [story("a", { support: 1, submitted_at: JUST_NOW })], [
    source("s1", "a", "https://www.npr.org/x"),
    source("s2", "a", "https://edition.cnn.com/y"),
  ], OWNERS, NOW);
  assert.equal(settled.stories.find((u) => u.id === "a")?.status, "placed");
});

test("a story with evidence and no support waits, which is how tomorrow's date waits", () => {
  const settled = settle(DAY, [story("a", { support: 0 })], [
    source("s1", "a", "https://www.npr.org/x"),
    source("s2", "a", "https://edition.cnn.com/y"),
  ], OWNERS, NOW);
  assert.equal(settled.stories.find((u) => u.id === "a")?.status, undefined);
  assert.equal(settled.snapshot, null);
});

test("a story that never verifies never leaves the pool, however long it waits and however many boosts it has", () => {
  // A 404, a timeout or a paywall: the quotation is never found, so
  // verified_at stays null. The hold in pool.ts would let a one source story
  // through after twelve hours, but the hold is for a source that verified
  // and was not confirmed a second way. No verified source is no evidence.
  const settled = settle(DAY, [story("a", { support: 30, submitted_at: "2026-09-01T00:00:00Z" })],
    [source("s1", "a", "https://www.npr.org/x", { verified_at: null })], OWNERS, NOW);
  assert.equal(settled.stories.length, 0);
  assert.equal(settled.snapshot, null);
});

test("placed stories keep their rectangles and grow; the snapshot is the whole board", () => {
  const stories = [
    story("a", { status: "placed", support: 20, placed_at: EARLIER, anchor_mx: 8, anchor_my: 7, w_modules: 1, h_modules: 1, tier: "reported" }),
    // Already at the minimum with one unit: five by three, which is what one
    // unit earns, so nothing about it changes on this run.
    story("b", { status: "placed", support: 1, placed_at: JUST_NOW, anchor_mx: 9, anchor_my: 7, w_modules: 5, h_modules: 3 }),
  ];
  const settled = settle(DAY, stories, [
    source("s1", "a", "https://www.npr.org/x"), source("s2", "a", "https://edition.cnn.com/y"),
    source("s3", "b", "https://www.npr.org/z"),
  ], OWNERS, NOW);
  const a = settled.stories.find((u) => u.id === "a")!;
  // Twenty units on a reported story: a target of thirty two, reached as a
  // whole rectangle that still holds the one module it started with. The
  // tile beside it blocks growth to the right, so it goes left.
  assert.equal(a.w_modules! * a.h_modules!, 32);
  assert.ok(a.anchor_mx! <= 8 && a.anchor_mx! + a.w_modules! > 8 && a.anchor_my! <= 7 && a.anchor_my! + a.h_modules! > 7, "the grown tile contains its old module");
  assert.equal(a.placed_at, undefined, "an already placed story keeps its placed_at");
  assert.equal(settled.stories.find((u) => u.id === "b"), undefined, "unchanged tile, nothing written");
  assert.equal(settled.snapshot?.board.tiles.length, 2);
});

test("a claimed story is capped at its ceiling whatever its support", () => {
  const settled = settle(DAY, [story("a", { support: 500 })], [source("s1", "a", "https://www.npr.org/x")], OWNERS, NOW);
  const a = settled.stories.find((u) => u.id === "a")!;
  assert.equal(a.w_modules! * a.h_modules!, CLAIMED_CEILING);
});

test("a story that finds no room becomes overflow, keeps placed_at, and is offered again next run", () => {
  const full: StoryRow[] = [];
  let n = 0;
  for (let my = 0; my < 16; my++) {
    for (let mx = 0; mx < 16; mx++) {
      full.push(story(`f${n++}`, { status: "placed", support: 1, placed_at: EARLIER, anchor_mx: mx, anchor_my: my, w_modules: 1, h_modules: 1 }));
    }
  }
  const late = story("late", { support: 5 });
  const sources = [...full.map((s) => source(`src-${s.id}`, s.id, "https://www.npr.org/x")), source("src-late", "late", "https://www.npr.org/late")];

  const first = settle(DAY, [...full, late], sources, OWNERS, NOW);
  const l = first.stories.find((u) => u.id === "late")!;
  assert.equal(l.status, "overflow");
  assert.equal(l.placed_at, NOW);
  assert.deepEqual(first.snapshot?.board.overflow, ["late"]);

  // Next run: still overflow, and nothing is written for it because nothing changed.
  const second = settle(DAY, [...full, { ...late, status: "overflow", placed_at: NOW }], sources, OWNERS, "2026-09-09T20:15:00.000Z");
  assert.equal(second.stories.find((u) => u.id === "late"), undefined);
  assert.deepEqual(second.snapshot?.board.overflow, ["late"]);
});

test("a story stamped false keeps its exact rectangle and grows by nothing", () => {
  const stories = [
    story("f", { status: "false", support: 500, tier: "reported", placed_at: EARLIER, anchor_mx: 8, anchor_my: 7, w_modules: 1, h_modules: 1 }),
  ];
  const settled = settle(DAY, stories, [], OWNERS, NOW);
  assert.equal(settled.stories.length, 0);
  assert.deepEqual(settled.snapshot?.board.tiles[0], { story_id: "f", mx: 8, my: 7, w: 1, h: 1, support: 500, tier: "reported" });
});
