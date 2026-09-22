import { strict as assert } from "node:assert";
import { test } from "node:test";

import { hiveAllocator } from "../src/hive-allocator.js";
import { HIVE_LIVE_JS, HIVE_LIVE_STYLE, HIVE_SHARE_JS, clockFor, heatFor, jsonIsland, liveHiveSection, liveStories, rectVars, shareLine } from "../src/hive-live.js";
import { renderDayPage, renderHivePage } from "../src/render.js";
import { liveTile, wallSection, BEE, type WallDay, type WallStory } from "../src/wall.js";

// The live hive, docs/the-wall.md section 21. What these pin: the port of
// the pie cuts a full board with no overlaps; the live section carries the
// data island, the allocator and the script, and nothing a source wrote can
// break out of either; and every other page is exactly as scriptless as it
// was. The port's agreement with the worker's allocator is pinned on the
// worker's side, in worker/test/wall-allocator-web.test.ts.

function story(overrides: Partial<WallStory> = {}): WallStory {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    wallDate: "2026-09-11",
    submittedAt: "2026-09-11T04:00:00Z",
    headline: "Council approves the river crossing after a decade of study",
    url: "https://www.example.org/news/river-crossing",
    outlet: "example.org",
    status: "placed",
    tier: "reported",
    support: 3,
    priority: 0,
    placedAt: "2026-09-11T04:15:00Z",
    rect: { mx: 0, my: 0, w: 16, h: 16 },
    falseAt: null,
    falseNote: null,
    subjectKind: null,
    subjectId: null,
    sources: [],
    ...overrides,
  };
}

function day(stories: WallStory[], overrides: Partial<WallDay> = {}): WallDay {
  return {
    wallDate: "2026-09-11", year: 2026, month: 9, day: 11,
    opensAt: "2026-09-10T04:00:00Z", liveAt: "2026-09-11T04:00:00Z", closesAt: "2026-09-13T04:00:00Z", closedAt: null,
    stories, ...overrides,
  };
}

const NOW = Date.parse("2026-09-11T20:00:00Z");
const OPTIONS = { project: "https://lunqqhjwqrpbujwxwdzk.supabase.co", key: "publishable-key" };

test("the port cuts a full board with no overlaps, biggest share first", () => {
  const web = hiveAllocator();
  const areas = web.shares([30, 5, 1, 0, 0, 0, 0, 0], 256, 12);
  assert.equal(areas.reduce((a, b) => a + b, 0), 256);
  assert.ok(areas.every((a) => a >= 12));
  const rects = web.cutBands([...areas].sort((a, b) => b - a));
  assert.equal(rects.reduce((sum, r) => sum + r.w * r.h, 0), 256, "the bands fill the board");
  for (let i = 0; i < rects.length; i++) {
    const a = rects[i]!;
    assert.ok(a.w >= 4 && a.h >= 3, "never smaller than a headline needs");
    assert.ok(a.mx + a.w <= 16 && a.my + a.h <= 16, "inside the board");
    for (let j = i + 1; j < rects.length; j++) {
      const b = rects[j]!;
      const apart = a.mx + a.w <= b.mx || b.mx + b.w <= a.mx || a.my + a.h <= b.my || b.my + b.h <= a.my;
      assert.ok(apart, `tiles ${i} and ${j} overlap`);
    }
  }
  const result = web.allocate([
    { id: "a", tier: "claimed", support: 4, placedAt: NOW, subjectKind: null, outlet: "npr.org" },
    { id: "b", tier: "claimed", support: 1, placedAt: NOW, subjectKind: "person", outlet: "en.wikipedia.org" },
    { id: "c", tier: "claimed", support: 0, placedAt: NOW, subjectKind: "historical_event", outlet: "en.wikipedia.org" },
  ]);
  assert.ok(result !== null);
  assert.deepEqual(result.placed.map((p) => p.id), ["a", "b", "c"], "most buzzed first, then the rest");
  assert.deepEqual(result.overflow, []);
  const a = result.placed[0]!;
  assert.ok(a.w * a.h > 128, "four buzzes against one is more than half the board");
  // A buzz on c moves it: the same call with one more unit lays out differently.
  const after = web.allocate([
    { id: "a", tier: "claimed", support: 4, placedAt: NOW, subjectKind: null, outlet: "npr.org" },
    { id: "b", tier: "claimed", support: 1, placedAt: NOW, subjectKind: "person", outlet: "en.wikipedia.org" },
    { id: "c", tier: "claimed", support: 2, placedAt: NOW, subjectKind: "historical_event", outlet: "en.wikipedia.org" },
  ])!;
  assert.deepEqual(after.placed.map((p) => p.id), ["a", "c", "b"], "c overtook b");
});

test("the live section carries the data, the allocator and the script, and nothing a source wrote escapes them", () => {
  const sneaky = story({ id: "22222222-2222-2222-2222-222222222222", headline: `Quote "this" </script><script>alert(1)</script> and a $1 sign`, support: 0, rect: { mx: 0, my: 8, w: 16, h: 8 } });
  const d = day([story({ rect: { mx: 0, my: 0, w: 16, h: 8 } }), sneaky]);
  const html = liveHiveSection(d, "September 11", NOW, { ...OPTIONS, scores: new Map([[sneaky.id, 42]]), standing: { left: 2, allowance: 3, backed: [] } });
  assert.ok(html.includes('class="wall whive wlivehive"'));
  assert.ok(html.includes('<script type="application/json" id="hivedata">'), "the data island");
  assert.ok(html.includes("var HiveAllocator = (function ()"), "the allocator is inlined");
  assert.ok(html.includes(HIVE_LIVE_JS.trim().slice(0, 40)), "the script is inlined");
  assert.ok(html.includes(HIVE_LIVE_STYLE.trim().slice(0, 40)), "the style is inlined");
  // The headline reaches the data island as JSON with its angle brackets
  // escaped, so a headline cannot end the script element; and the tile
  // draws it as text.
  const island = /<script type="application\/json" id="hivedata">([\s\S]*?)<\/script>/.exec(html)!;
  assert.ok(!island[1]!.includes("</script"), "no close tag inside the island");
  const data = JSON.parse(island[1]!) as { stories: Array<{ id: string; headline: string; score: number; status: string }>; left: number; allowance: number; date: string; project: string; key: string };
  assert.equal(data.date, "2026-09-11");
  assert.equal(data.project, OPTIONS.project);
  assert.equal(data.key, OPTIONS.key);
  assert.equal(data.left, 2);
  assert.equal(data.allowance, 3);
  const found = data.stories.find((s) => s.id === sneaky.id)!;
  assert.equal(found.headline, sneaky.headline, "the source's words, exactly, as data");
  assert.equal(found.score, 42, "the panel's points ride along");
  assert.equal(found.status, "placed");
  assert.ok(html.includes("&lt;/script&gt;&lt;script&gt;alert(1)"), "the headline is escaped where it is drawn");
  assert.ok(!html.includes("<script>alert(1)</script>"));
  // The tile is positioned by its rectangle in modules, not by the grid.
  assert.ok(html.includes('style="--x:0;--y:0;--w:16;--h:8;'), "the placed tile carries its rectangle");
  assert.ok(!html.includes("grid-column:"), "no grid placement on the live board");
  assert.ok(html.includes('id="wclock">'), "the countdown");
  assert.ok(html.includes("Two buzzes left today."), "the reader's own count is on the page before the script runs");
  assert.ok(html.includes('class="wdot"') && html.includes('class="wdot wspent"'), "three buzzes, one spent");
  assert.ok(html.includes("The swarm, right now"));
  assert.ok(html.includes('<em>What will still matter?</em>'));
  assert.ok(!html.includes("\u2014"), "no em dashes");
});

test("a fresh browser gets the allowance, a story stamped false is handed over frozen, and the overflow tile is not drawn", () => {
  const stamped = story({ id: "33333333-3333-3333-3333-333333333333", status: "false", support: 0, rect: { mx: 0, my: 0, w: 4, h: 3 }, falseAt: "2026-09-11T10:00:00Z" });
  const waiting = story({ id: "44444444-4444-4444-4444-444444444444", status: "overflow", rect: null, support: 0 });
  const d = day([stamped, waiting]);
  const html = liveHiveSection(d, "September 11", NOW, OPTIONS);
  assert.ok(html.includes("Three buzzes left today."));
  assert.ok(html.includes(`id="w-${stamped.id}"`), "a stamped story keeps its tile");
  assert.ok(html.includes("Shown false"));
  assert.ok(!html.includes(`id="w-${waiting.id}"`), "an overflow story is data, not a tile, until the pie brings it on");
  const rows = liveStories(d);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0]!.rect, { mx: 0, my: 0, w: 4, h: 3 });
  assert.equal(rows[1]!.rect, null);
  assert.equal(rows[1]!.placedAt, waiting.placedAt);
});

test("the small helpers", () => {
  assert.equal(heatFor(0, 10), 0, "a story nobody buzzed is dark");
  assert.equal(heatFor(10, 10), 1, "the most buzzed blazes");
  assert.ok(heatFor(1, 10) > 0.15 && heatFor(1, 10) < 0.4, "one buzz shows some warmth");
  assert.equal(clockFor(0), "00:00:00");
  assert.equal(clockFor(-5000), "00:00:00");
  assert.equal(clockFor(3_661_000), "01:01:01");
  assert.equal(clockFor(26 * 3_600_000), "26:00:00", "the day after counts past twenty four hours");
  assert.equal(rectVars({ mx: 1, my: 2, w: 3, h: 4 }), "--x:1;--y:2;--w:3;--h:4");
  assert.equal(jsonIsland({ a: "</script>\u2028" }), '{"a":"\\u003c/script>\\u2028"}');
  const tile = liveTile(story({ rect: { mx: 4, my: 3, w: 8, h: 5 } }), true, BEE, 2, 0.5);
  assert.ok(tile.includes('--x:4;--y:3;--w:8;--h:5;--lines:7;--tw:8;--i:2'));
  assert.ok(tile.includes('<div class="wcell" style="--heat:0.5"><span class="wstripe"></span>'));
  assert.ok(tile.includes('<form class="wbuzz" method="post" action="/boost">'), "the button is a form, so it posts without the script too");
  assert.ok(tile.includes('name="v" value="hive"'));
});

test("the song tile plays on tap and never on load: the script makes its audio context on a tap and nowhere else", () => {
  const makes = HIVE_LIVE_JS.split("new (window.AudioContext").length - 1;
  assert.equal(makes, 1, "one place makes a context");
  assert.ok(/function playChord\(\) \{[\s\S]*?new \(window\.AudioContext/.test(HIVE_LIVE_JS), "and it is inside playChord");
  assert.ok(/addEventListener\("click", function \(e\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); playChord\(\); \}\)/.test(HIVE_LIVE_JS), "which only a click calls");
  assert.ok(!/^\s*playChord\(\);\s*$/m.test(HIVE_LIVE_JS), "never called on its own line at load");
});

test("the script polls nothing: it subscribes over a socket and reads counts again only after a reconnect", () => {
  assert.ok(HIVE_LIVE_JS.includes("/realtime/v1/websocket?apikey="));
  assert.ok(HIVE_LIVE_JS.includes('"postgres_changes"') || HIVE_LIVE_JS.includes("postgres_changes:"));
  assert.ok(HIVE_LIVE_JS.includes('table: "wall_boosts"'));
  assert.ok(HIVE_LIVE_JS.includes('filter: "wall_date=eq." + D.date'));
  // The one setInterval that touches the network is the socket heartbeat;
  // the other is the clock.
  const intervals = HIVE_LIVE_JS.match(/setInterval\(/g) ?? [];
  assert.equal(intervals.length, 2);
  assert.ok(HIVE_LIVE_JS.includes('send("phoenix", "heartbeat", {})'));
  assert.ok(HIVE_LIVE_JS.includes("if (everJoined) reconcile();"), "the read after a reconnect");
});

test("every other page is exactly as scriptless as it was", () => {
  const d = day([story()]);
  const hive = renderHivePage(d, 9, 11, []);
  assert.ok(!hive.includes("<script"), "the baked hive page carries no script at all");
  assert.ok(!hive.includes("hivedata"));
  const section = wallSection(d, "September 11", NOW, { interactive: true, hive: true, date: { month: 9, day: 11 } });
  assert.ok(!section.includes("<script"), "the plain hive section, sealed or not, has none");
  const page = renderDayPage({ month: 9, day: 11, people: [] }, [], [], [], [], null, new Map(), new Map(), d, []);
  const scripts = page.match(/<script[^>]*>/g) ?? [];
  assert.ok(scripts.every((tag) => tag.includes('type="application/ld+json"')), `a date page runs nothing: ${scripts.join(" ")}`);
  assert.ok(!page.includes("HiveAllocator"));
});

// What your buzz did. The tile already grew by the time the sentence shows,
// so the sentence says what it grew by, in the one number a tile's size is:
// its share of the date's buzzes.
test("the share line says what the buzz moved, in whole points, and never says nothing happened", () => {
  assert.equal(shareLine(0, 1, 0, 1), "The first buzz on this hive. This tile is all of it until somebody else buzzes.");
  assert.equal(shareLine(0, 1, 10, 11), "Your buzz put this tile at 9% of the hive.");
  assert.equal(shareLine(2, 3, 24, 25), "Your buzz took this tile from 8% to 12% of the hive.");
  // A thousand buzzes on the board: the whole numbers do not move, so one decimal does.
  assert.equal(shareLine(100, 101, 1000, 1001), "Your buzz took this tile from 10.0% to 10.1% of the hive.");
  // The solemn voice, still available by the list in wall.ts.
  assert.equal(shareLine(0, 1, 0, 1, { one: "tap", many: "taps" }), "The first tap on this hive. This tile is all of it until somebody else taps.");
});

test("the reader's own buzz pulses the tile, pops the count and writes the share line; somebody else's does not", () => {
  assert.ok(/function pulse\(t\)/.test(HIVE_LIVE_JS));
  assert.ok(/if \(own\) \{ pulse\(t\); sayShare\(/.test(HIVE_LIVE_JS), "pulse and the line only on the reader's own buzz");
  assert.ok(/bump\(s, 1, ev, true\)/.test(HIVE_LIVE_JS), "youBuzz says it is the reader's own");
  assert.ok(/bump\(s, typeof record\.units === "number" \? record\.units : 1, null\)/.test(HIVE_LIVE_JS), "a Realtime buzz is not");
  assert.ok(HIVE_LIVE_STYLE.includes("@keyframes wpulse") && HIVE_LIVE_STYLE.includes("@keyframes wpop"));
  assert.ok(/prefers-reduced-motion: reduce\)[^}]*\{[\s\S]*?\.wlive \.wtile\.wpulse \.wcell, \.wlive \.wn\.wpop \{ animation: none; \}/.test(HIVE_LIVE_STYLE), "and both stop under reduced motion");
  const html = liveHiveSection(day([story()]), "September 11", NOW, OPTIONS);
  assert.ok(html.includes('<span class="wshare" id="wshare"></span>'), "the live kept sentence has the span");
  assert.ok(!html.includes("redraws on the quarter hour"), "and not the baked page's quarter hour sentence, which would be false here");
  assert.ok(html.includes(HIVE_SHARE_JS), "the page carries HiveShare");
  assert.ok(html.indexOf(HIVE_SHARE_JS) < html.indexOf(HIVE_LIVE_JS), "before the script that calls it");
});
