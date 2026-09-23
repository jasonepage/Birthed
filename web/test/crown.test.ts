// The crown, docs/the-wall.md section 30. Every rule here is a rule a
// reader could try to bend: a tie, an undo, a three unit app buzz, a row
// for a story that is not on the date, a row that is not a buzz at all.
import { strict as assert } from "node:assert";
import { test } from "node:test";

import { HIVE_CROWN_JS, boostFrom, crownClock, crownLine, crownOf, crownSaid, hiveCrown, noCrownYet, type WallBoost } from "../src/crown.js";
import { HIVE_LIVE_JS, liveHiveSection } from "../src/hive-live.js";
import { renderPrivacy } from "../src/pages.js";
import { BEE, crownBlock, crownFor, crownName, fetchWall, fetchWallDay, wallSection, type WallDay, type WallStory } from "../src/wall.js";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const C = "cccccccc-0000-4000-8000-000000000003";
const NOT_ON_DATE = "dddddddd-0000-4000-8000-000000000004";

function story(id: string, headline: string, overrides: Partial<WallStory> = {}): WallStory {
  return {
    id, wallDate: "2026-09-23", submittedAt: "2026-09-22T04:00:00Z", headline,
    url: `https://www.example.org/${id}`, outlet: "example.org", status: "placed", tier: "claimed",
    support: 0, priority: 1, placedAt: "2026-09-23T04:00:00Z", rect: null,
    falseAt: null, falseNote: null, subjectKind: "person", subjectId: id, sources: [], ...overrides,
  };
}

/** Three tiles across the top of the board, the shape the pie leaves a three story day in. */
function day(boosts: WallBoost[], overrides: Partial<WallDay> = {}): WallDay {
  return {
    wallDate: "2026-09-23", year: 2026, month: 9, day: 23,
    opensAt: "2026-09-22T04:00:00Z", liveAt: "2026-09-23T04:00:00Z", closesAt: "2026-09-25T04:00:00Z", closedAt: null,
    stories: [
      story(A, "Typhoid Mary, infected houseworker in New York City, born 1869", { rect: { mx: 0, my: 0, w: 6, h: 6 }, support: boosts.filter((b) => b.storyId === A).reduce((n, b) => n + b.units, 0) }),
      story(B, "Bruce Springsteen, American rock singer (born 1949), born 1949", { rect: { mx: 6, my: 0, w: 5, h: 6 }, support: boosts.filter((b) => b.storyId === B).reduce((n, b) => n + b.units, 0) }),
      story(C, "Major news outlets banned by Trump will have their day in court", { rect: { mx: 11, my: 0, w: 5, h: 6 }, subjectKind: null, subjectId: null, support: boosts.filter((b) => b.storyId === C).reduce((n, b) => n + b.units, 0) }),
    ],
    boosts,
    ...overrides,
  };
}

function buzz(id: number, storyId: string, castAt: string, units: number = 1): WallBoost {
  return { id, storyId, units, castAt };
}

const OPEN_NOW = Date.parse("2026-09-23T20:00:00Z");
const headlineOf = (id: string): string => ({ [A]: "Typhoid Mary", [B]: "Bruce Springsteen", [C]: "The news" })[id] ?? "?";

// ---------------------------------------------------------------------------
// The replay
// ---------------------------------------------------------------------------

test("no buzzes, no crown", () => {
  const crown = crownOf([], day([]).stories);
  assert.equal(crown.holder, null);
  assert.equal(crown.count, 0);
  assert.deepEqual(crown.changes, []);
});

test("one buzz takes the crown, from nobody", () => {
  const crown = crownOf([buzz(1, A, "2026-09-23T08:27:57Z")], day([]).stories);
  assert.equal(crown.holder, A);
  assert.equal(crown.count, 1);
  assert.deepEqual(crown.changes, [{ at: "2026-09-23T08:27:57Z", to: A, from: null }]);
  assert.equal(crownLine(crown.changes[0]!, headlineOf), "4:27 am Eastern: Typhoid Mary took the crown.");
});

test("three buzzes on three stories are a tie, and the first to the count keeps it", () => {
  // September 23, 2026, as the live table stood: three stories with one
  // buzz each. Nothing passed anything, so the crown never moved.
  const crown = crownOf([
    buzz(1, A, "2026-09-23T08:27:57Z"),
    buzz(2, C, "2026-09-23T15:25:00Z"),
    buzz(3, B, "2026-09-23T15:25:08Z"),
  ], day([]).stories);
  assert.equal(crown.holder, A);
  assert.equal(crown.count, 1);
  assert.equal(crown.changes.length, 1);
});

test("a story that gets strictly more takes it, and the line says from whom", () => {
  const crown = crownOf([
    buzz(1, A, "2026-09-23T08:27:57Z"),
    buzz(2, B, "2026-09-23T15:25:08Z"),
    buzz(3, B, "2026-09-23T19:12:00Z"),
  ], day([]).stories);
  assert.equal(crown.holder, B);
  assert.equal(crown.count, 2);
  assert.equal(crown.changes.length, 2);
  assert.deepEqual(crown.changes[1], { at: "2026-09-23T19:12:00Z", to: B, from: A });
  assert.equal(crownLine(crown.changes[1]!, headlineOf), "3:12 pm Eastern: Bruce Springsteen took the crown from Typhoid Mary.");
  assert.equal(crownSaid(crown.changes[1]!, headlineOf), "Bruce Springsteen took the crown from Typhoid Mary.");
});

test("the holder adding to its own lead is not a change of hands", () => {
  const crown = crownOf([
    buzz(1, A, "2026-09-23T08:00:00Z"),
    buzz(2, A, "2026-09-23T09:00:00Z"),
    buzz(3, A, "2026-09-23T10:00:00Z"),
  ], day([]).stories);
  assert.equal(crown.holder, A);
  assert.equal(crown.count, 3);
  assert.equal(crown.changes.length, 1);
});

test("a three unit buzz from the app is three units, and passes two ones", () => {
  const crown = crownOf([
    buzz(1, A, "2026-09-23T08:00:00Z"),
    buzz(2, A, "2026-09-23T09:00:00Z"),
    buzz(3, B, "2026-09-23T10:00:00Z", 3),
  ], day([]).stories);
  assert.equal(crown.holder, B);
  assert.equal(crown.count, 3);
  assert.deepEqual(crown.changes.map((c) => c.to), [A, B]);
});

test("the replay is in the order the buzzes were cast, whatever order the rows arrive in", () => {
  const rows = [
    buzz(3, B, "2026-09-23T19:12:00Z"),
    buzz(1, A, "2026-09-23T08:27:57Z"),
    buzz(2, B, "2026-09-23T15:25:08Z"),
  ];
  const crown = crownOf(rows, day([]).stories);
  assert.deepEqual(crown.changes.map((c) => c.to), [A, B]);
  assert.equal(crown.changes[0]!.at, "2026-09-23T08:27:57Z");
});

test("two buzzes in the same instant fall to the row id, so the answer is the same on every read", () => {
  const rows = [buzz(20, B, "2026-09-23T08:00:00Z"), buzz(10, A, "2026-09-23T08:00:00Z")];
  const crown = crownOf(rows, day([]).stories);
  assert.equal(crown.holder, A);
  assert.equal(crownOf([...rows].reverse(), day([]).stories).holder, A);
});

test("a buzz taken back inside its thirty seconds was never a takeover", () => {
  const before = crownOf([
    buzz(1, A, "2026-09-23T08:00:00Z"),
    buzz(2, B, "2026-09-23T09:00:00Z"),
    buzz(3, B, "2026-09-23T09:00:10Z"),
  ], day([]).stories);
  assert.equal(before.holder, B);
  // Row 3 is deleted by wall_forget_boost. The replay is of the rows that
  // exist, so the list does not say B took it and gave it back; B never had it.
  const after = crownOf([buzz(1, A, "2026-09-23T08:00:00Z"), buzz(2, B, "2026-09-23T09:00:00Z")], day([]).stories);
  assert.equal(after.holder, A);
  assert.equal(after.changes.length, 1);
});

test("a story stamped false cannot wear the crown, and its buzzes count for nothing", () => {
  const d = day([]);
  d.stories[1]!.status = "false";
  const crown = crownOf([
    buzz(1, B, "2026-09-23T08:00:00Z"),
    buzz(2, B, "2026-09-23T08:01:00Z"),
    buzz(3, A, "2026-09-23T09:00:00Z"),
  ], d.stories);
  assert.equal(crown.holder, A);
  assert.equal(crown.count, 1);
  assert.deepEqual(crown.changes.map((c) => c.from), [null]);
});

test("a buzz on a story that is not on the date, or a row that is not a buzz, is skipped", () => {
  const stories = day([]).stories;
  const crown = crownOf([
    buzz(1, NOT_ON_DATE, "2026-09-23T07:00:00Z"),
    buzz(2, NOT_ON_DATE, "2026-09-23T07:01:00Z"),
    buzz(3, A, "2026-09-23T08:00:00Z"),
  ], stories);
  assert.equal(crown.holder, A);
  assert.equal(crown.count, 1);
  // Rows shaped wrong, straight into the page's own replay: units out of
  // range, fractional, missing, and a time that does not parse.
  const api = hiveCrown();
  const eligible = { [A]: true, [B]: true };
  const bent = api.replay([
    { id: 1, story_id: A, units: 1, cast_at: "2026-09-23T08:00:00Z" },
    { id: 2, story_id: B, units: 0, cast_at: "2026-09-23T08:01:00Z" },
    { id: 3, story_id: B, units: 4, cast_at: "2026-09-23T08:02:00Z" },
    { id: 4, story_id: B, units: 1.5, cast_at: "2026-09-23T08:03:00Z" },
    { id: 5, story_id: B, units: 2, cast_at: "not a time" },
    { id: 6, story_id: B, units: "2" as unknown as number, cast_at: "2026-09-23T08:04:00Z" },
    { id: 7, story_id: 12 as unknown as string, units: 2, cast_at: "2026-09-23T08:05:00Z" },
    null as unknown as { id: number; story_id: string; units: number; cast_at: string },
  ], eligible);
  assert.equal(bent.holder, A);
  assert.equal(bent.count, 1);
});

test("a row from the database is read with no booster and dropped when it is not a buzz", () => {
  assert.deepEqual(boostFrom({ id: 7, story_id: A, units: 1, cast_at: "2026-09-23T08:00:00Z" }), { id: 7, storyId: A, units: 1, castAt: "2026-09-23T08:00:00Z" });
  const read = boostFrom({ id: 7, story_id: A, units: 1, cast_at: "2026-09-23T08:00:00Z", booster_id: "should-never-be-here" });
  assert.ok(read !== null && !("booster_id" in read) && !("boosterId" in read));
  assert.equal(boostFrom({ id: "x", story_id: A, units: 1, cast_at: "2026-09-23T08:00:00Z" }), null);
  assert.equal(boostFrom({ id: 1, headline: "a story row, not a buzz" }), null);
  assert.equal(boostFrom(undefined), null);
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

test("the time is the Eastern clock, in the shape the board already speaks", () => {
  assert.equal(crownClock("2026-09-23T15:25:08.702233+00:00"), "11:25 am Eastern");
  assert.equal(crownClock("2026-09-23T08:27:57Z"), "4:27 am Eastern");
  assert.equal(crownClock("2026-09-23T19:12:00Z"), "3:12 pm Eastern");
  assert.equal(crownClock("2026-09-23T16:00:00Z"), "12:00 pm Eastern");
  assert.equal(crownClock("2026-09-23T04:05:00Z"), "12:05 am Eastern");
  // Standard time, after the clocks go back.
  assert.equal(crownClock("2026-12-23T20:12:00Z"), "3:12 pm Eastern");
});

test("a long headline is cut at a word, the way the swarm line cuts one", () => {
  const long = "Nineteen members of al-Qaeda execute the September 11 attacks, a series of coordinated terrorist attacks";
  const line = crownLine({ at: "2026-09-23T19:12:00Z", to: A, from: null }, () => long);
  assert.equal(line, "3:12 pm Eastern: Nineteen members of al-Qaeda execute the September 11… took the crown.");
  assert.ok(line.length < long.length);
});

test("a crown line calls a person by name, a song by its title, and anything else by its headline", () => {
  assert.equal(crownName({ subjectKind: "person", headline: "Bruce Springsteen, American rock singer (born 1949), born 1949" }), "Bruce Springsteen");
  assert.equal(crownName({ subjectKind: "person", headline: "Typhoid Mary, infected houseworker in New York City, born 1869" }), "Typhoid Mary");
  assert.equal(crownName({ subjectKind: "person", headline: "Ray Charles, American singer, born 1930, died 2004" }), "Ray Charles");
  assert.equal(crownName({ subjectKind: "person", headline: "Somebody with no years" }), "Somebody with no years");
  assert.equal(crownName({ subjectKind: "song", headline: '1992: "End of the Road" by Boyz II Men was the number one song' }), '"End of the Road" by Boyz II Men');
  assert.equal(crownName({ subjectKind: "album", headline: "1975: Blood on the Tracks by Bob Dylan was the number one album" }), "Blood on the Tracks by Bob Dylan");
  assert.equal(crownName({ subjectKind: "film", headline: "1993: Jurassic Park was the number one film at the box office" }), "Jurassic Park");
  assert.equal(crownName({ subjectKind: "historical_event", headline: "1956: The dike around the Dutch polder East Flevoland is closed." }), "1956: The dike around the Dutch polder East Flevoland is closed.");
  assert.equal(crownName({ subjectKind: null, headline: "Oil hits $100 a barrel for first time since July" }), "Oil hits $100 a barrel for first time since July");
});

test("the empty line names the buzz in the board's own voice", () => {
  assert.equal(noCrownYet(BEE), "No crown yet. The first buzz on this hive takes it.");
  assert.equal(noCrownYet({ one: "tap" }), "No crown yet. The first tap on this hive takes it.");
});

// ---------------------------------------------------------------------------
// On the page
// ---------------------------------------------------------------------------

test("the block under the board: nothing before the date, a promise on an open board nobody has buzzed, nothing on a sealed board nobody buzzed", () => {
  const d = day([]);
  assert.equal(crownBlock(d, crownFor(d), BEE, Date.parse("2026-09-22T20:00:00Z")), "");
  const open = crownBlock(d, crownFor(d), BEE, OPEN_NOW);
  assert.ok(open.includes("No crown yet. The first buzz on this hive takes it."));
  assert.ok(open.includes("Every time it changes hands today:"));
  assert.ok(!open.includes('id="wcrownsay"'), "the status line is the live page's alone");
  assert.equal(crownBlock(d, crownFor(d), BEE, Date.parse("2026-09-26T20:00:00Z")), "");
  assert.equal(crownBlock({ ...d, closedAt: "2026-09-25T04:00:00Z" }, crownFor(d), BEE, Date.parse("2026-09-26T20:00:00Z")), "");
});

test("a sealed hive keeps its last crown and its list forever", () => {
  const d = day([buzz(1, A, "2026-09-23T08:27:57Z"), buzz(2, B, "2026-09-23T15:25:08Z"), buzz(3, B, "2026-09-23T19:12:00Z")], { closedAt: "2026-09-25T04:00:00Z" });
  const later = Date.parse("2027-03-01T12:00:00Z");
  const html = wallSection(d, "September 23", later, { hive: true, date: { month: 9, day: 23 } });
  assert.ok(html.includes(`id="w-${B}"`) && /class="wtile[^"]*wcrowned[^"]*"[^>]*id="w-bbbbbbbb/.test(html), "the last holder wears it");
  assert.ok(!/class="wtile[^"]*wcrowned[^"]*"[^>]*id="w-aaaaaaaa/.test(html), "the one it took it from does not");
  assert.ok(html.includes("Every time it changed hands before the seal:"));
  assert.ok(html.includes("4:27 am Eastern: Typhoid Mary took the crown."));
  assert.ok(html.includes("3:12 pm Eastern: Bruce Springsteen took the crown from Typhoid Mary."));
  assert.ok(!html.includes("<form"), "a sealed hive still carries no forms");
});

test("on the date page the holder's tile wears the crown, the others do not, and the list sits under the board", () => {
  const d = day([buzz(1, A, "2026-09-23T08:27:57Z")]);
  const html = wallSection(d, "September 23", OPEN_NOW, { interactive: true, date: { month: 9, day: 23 } });
  assert.equal((html.match(/wcrownmark/g) ?? []).length, 2, "one mark on the tile and one in the heading, and no more");
  assert.ok(/class="wtile[^"]*wcrowned[^"]*"[^>]*id="w-aaaaaaaa/.test(html));
  assert.ok(html.includes("Wears the crown."));
  assert.ok(html.indexOf('class="wboard') < html.indexOf('id="wcrown"'), "under the board");
  assert.ok(html.indexOf('id="wcrown"') < html.indexOf('class="wafter"'), "before what follows the board");
  assert.ok(html.includes("4:27 am Eastern: Typhoid Mary took the crown."));
});

test("a story that leads from the feed wears the crown on its row until the tick gives it a tile", () => {
  const d = day([buzz(1, B, "2026-09-23T08:27:57Z")]);
  d.stories[1]!.status = "pool";
  d.stories[1]!.rect = null;
  const html = wallSection(d, "September 23", OPEN_NOW, { interactive: true, date: { month: 9, day: 23 } });
  assert.ok(new RegExp(`<li id="w-${B}"[^>]*class="wcrowned"><span class="wcrownmark"`).test(html));
  assert.ok(!/class="wtile[^"]*wcrowned"/.test(html), "no tile wears it");
});

test("a headline's own characters cannot break the list or the tile", () => {
  const d = day([buzz(1, A, "2026-09-23T08:27:57Z")]);
  d.stories[0]!.headline = `</ol></div><script>alert(1)</script> "quoted" & 'single' <b>bold</b>`;
  const html = wallSection(d, "September 23", OPEN_NOW, { interactive: true, date: { month: 9, day: 23 } });
  assert.ok(!html.includes("<script>alert"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  const list = html.slice(html.indexOf('<ol class="wcrownlist"'), html.indexOf("</ol>"));
  assert.ok(list.includes("&lt;/ol&gt;&lt;/div&gt;"));
  assert.ok(list.includes("&quot;quoted&quot; &amp; &#39;single&#39;"));
});

test("a day read before the crown existed has no crown and no list, not a crash", () => {
  const d = day([]);
  delete (d as { boosts?: unknown }).boosts;
  const html = wallSection(d, "September 23", OPEN_NOW, { interactive: true, date: { month: 9, day: 23 } });
  assert.ok(html.includes("No crown yet."));
  assert.ok(!html.includes("wcrowned"));
});

// ---------------------------------------------------------------------------
// The live hive
// ---------------------------------------------------------------------------

test("the live hive carries the crown's code before the script that calls it, the log without a booster, and the holder's tile marked", () => {
  const d = day([buzz(1, A, "2026-09-23T08:27:57Z"), buzz(2, B, "2026-09-23T15:25:08Z"), buzz(3, B, "2026-09-23T19:12:00Z")]);
  const html = liveHiveSection(d, "September 23", OPEN_NOW, { project: "https://example.supabase.co", key: "publishable" });
  assert.ok(html.includes(HIVE_CROWN_JS));
  assert.ok(html.indexOf(HIVE_CROWN_JS) < html.indexOf(HIVE_LIVE_JS));
  const island = JSON.parse(html.slice(html.indexOf('<script type="application/json" id="hivedata">') + '<script type="application/json" id="hivedata">'.length, html.indexOf("</script>", html.indexOf('id="hivedata"')))) as { boosts: Array<Record<string, unknown>>; crownMark: string };
  assert.equal(island.boosts.length, 3);
  assert.equal((island as unknown as { stories: Array<{ name: string }> }).stories[1]!.name, "Bruce Springsteen");
  assert.deepEqual(Object.keys(island.boosts[0]!).sort(), ["cast_at", "id", "story_id", "units"]);
  assert.ok(!JSON.stringify(island).includes("booster"));
  assert.ok(island.crownMark.includes("wcrownmark"));
  assert.ok(/class="wtile[^"]*wcrowned[^"]*"[^>]*id="w-bbbbbbbb/.test(html));
  assert.ok(!/class="wtile[^"]*wcrowned[^"]*"[^>]*id="w-aaaaaaaa/.test(html));
  assert.ok(html.includes('id="wcrownsay"'), "the line a takeover is announced in");
  assert.ok(html.includes('id="wcrownlist"'));
  assert.ok(html.includes("took the crown from"));
});

test("the live script has one leader, the crown, and reads the log again after a reconnect", () => {
  assert.ok(!HIVE_LIVE_JS.includes("wlead"), "the pie's leader edge is gone; the crown is the leader");
  assert.ok(HIVE_LIVE_JS.includes("HiveCrown.replay(boosts"));
  assert.ok(HIVE_LIVE_JS.includes("wall_boosts?select=id,story_id,units,cast_at"), "the reconcile reads the same columns and never the booster");
  assert.ok(!HIVE_LIVE_JS.includes("booster_id"));
  // Still exactly two intervals: the heartbeat and the clock. The crown polls nothing.
  assert.equal((HIVE_LIVE_JS.match(/setInterval\(/g) ?? []).length, 2);
});

test("the page's replay is the same code the server ran", () => {
  const api = hiveCrown();
  const eligible = { [A]: true, [B]: true, [C]: true };
  const page = api.replay([
    { id: 1, story_id: A, units: 1, cast_at: "2026-09-23T08:27:57Z" },
    { id: "own:temp", story_id: B, units: 1, cast_at: "2026-09-23T15:25:08Z" },
    { id: 3, story_id: B, units: 1, cast_at: "2026-09-23T19:12:00Z" },
  ], eligible);
  const server = crownOf([buzz(1, A, "2026-09-23T08:27:57Z"), buzz(2, B, "2026-09-23T15:25:08Z"), buzz(3, B, "2026-09-23T19:12:00Z")], day([]).stories);
  assert.equal(page.holder, server.holder);
  assert.equal(page.count, server.count);
  assert.deepEqual(page.changes.map((c) => [c.at, c.to, c.from]), server.changes.map((c) => [c.at, c.to, c.from]));
});

// ---------------------------------------------------------------------------
// The read
// ---------------------------------------------------------------------------

test("the day's read asks for the buzz rows without the booster and keeps only the ones shaped like a buzz", async () => {
  const real = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("wall_days")) return new Response(JSON.stringify([{ wall_date: "2026-09-23", opens_at: "2026-09-22T04:00:00Z", live_at: "2026-09-23T04:00:00Z", closes_at: "2026-09-25T04:00:00Z", closed_at: null }]), { status: 200 });
    if (url.includes("wall_boosts")) return new Response(JSON.stringify([
      { id: 1, story_id: A, units: 1, cast_at: "2026-09-23T08:27:57+00:00" },
      { id: 2, story_id: A, units: 9, cast_at: "2026-09-23T08:28:00+00:00" },
      { id: 3, story_id: B, units: 1, cast_at: "2026-09-23T15:25:08+00:00", booster_id: "must-not-be-sent-but-if-it-were" },
    ]), { status: 200 });
    return new Response("[]", { status: 200 });
  }) as typeof fetch;
  try {
    const d = await fetchWallDay("https://example.supabase.co", "key", "2026-09-23");
    assert.ok(d !== null);
    const boostCall = calls.find((c) => c.includes("wall_boosts"))!;
    assert.ok(boostCall.includes("select=id,story_id,units,cast_at&"), boostCall);
    assert.ok(!boostCall.includes("booster"));
    assert.deepEqual(d.boosts, [
      { id: 1, storyId: A, units: 1, castAt: "2026-09-23T08:27:57+00:00" },
      { id: 3, storyId: B, units: 1, castAt: "2026-09-23T15:25:08+00:00" },
    ]);
  } finally {
    globalThis.fetch = real;
  }
});

test("the build's read files each buzz under its own date", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    const page = (rows: unknown[]) => new Response(JSON.stringify(url.includes("offset=0") ? rows : []), { status: 200 });
    if (url.includes("wall_days")) return page([
      { wall_date: "2026-09-22", opens_at: "2026-09-21T04:00:00Z", live_at: "2026-09-22T04:00:00Z", closes_at: "2026-09-24T04:00:00Z", closed_at: null },
      { wall_date: "2026-09-23", opens_at: "2026-09-22T04:00:00Z", live_at: "2026-09-23T04:00:00Z", closes_at: "2026-09-25T04:00:00Z", closed_at: null },
    ]);
    if (url.includes("wall_boosts")) {
      assert.ok(url.includes("select=id,story_id,wall_date,units,cast_at&"));
      return page([
        { id: 1, story_id: A, wall_date: "2026-09-23", units: 1, cast_at: "2026-09-23T08:27:57+00:00" },
        { id: 2, story_id: B, wall_date: "2026-09-22", units: 1, cast_at: "2026-09-22T19:53:07+00:00" },
        { id: 3, story_id: C, units: 1, cast_at: "2026-09-23T09:00:00+00:00" },
      ]);
    }
    return page([]);
  }) as typeof fetch;
  try {
    const days = await fetchWall("https://example.supabase.co", "key");
    assert.equal(days.length, 2);
    assert.deepEqual(days[0]!.boosts!.map((b) => b.id), [2]);
    assert.deepEqual(days[1]!.boosts!.map((b) => b.id), [1]);
  } finally {
    globalThis.fetch = real;
  }
});

test("the privacy page says what the crown list shows", () => {
  const html = renderPrivacy();
  assert.ok(html.includes("the crown"));
  assert.ok(html.includes("names nobody"));
});
