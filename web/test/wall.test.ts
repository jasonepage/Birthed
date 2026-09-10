import { strict as assert } from "node:assert";
import { test } from "node:test";

import { renderDayPage, renderHivePage, renderStoryPage } from "../src/render.js";
import {
  BEE, PLAIN, PLAIN_DATES, VIEW_MIN, allowanceOn, emptyWallDay, fetchWall, hivePath, newestByDate, storyPath, takingBoosts,
  tapsLeftSentence, tierLabel, units, viewportFor, voiceFor, wallMarks, wallSection, type WallDay, type WallStory,
} from "../src/wall.js";

const PAGE = { month: 9, day: 9, people: [] };

function story(overrides: Partial<WallStory> = {}): WallStory {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    wallDate: "2026-09-09",
    submittedAt: "2026-09-09T14:00:00Z",
    headline: "Council approves the river crossing after a decade of study",
    url: "https://www.example.org/news/river-crossing",
    outlet: "example.org",
    status: "placed",
    tier: "reported",
    support: 12,
    priority: 0,
    placedAt: "2026-09-09T16:00:00Z",
    rect: { mx: 8, my: 7, w: 2, h: 1 },
    falseAt: null,
    falseNote: null,
    sources: [{
      id: "s1", url: "https://www.example.org/news/river-crossing", outlet: "example.org", owner: "Example Media",
      headline: "Council approves the river crossing after a decade of study",
      quotation: "The council voted seven to two on Tuesday night to approve the crossing.",
      verifiedAt: "2026-09-09T14:05:00Z", addedAt: "2026-09-09T14:01:00Z",
      checks: [
        { checkedAt: "2026-09-09T14:04:00Z", kind: "resolves", passed: true, httpStatus: 200, detail: "final address unchanged" },
        { checkedAt: "2026-09-09T14:05:00Z", kind: "quotation", passed: true, httpStatus: 200, detail: "matched at offset 2210" },
      ],
    }],
    ...overrides,
  };
}

function day(stories: WallStory[], overrides: Partial<WallDay> = {}): WallDay {
  return {
    wallDate: "2026-09-09", year: 2026, month: 9, day: 9,
    opensAt: "2026-09-08T04:00:00Z", liveAt: "2026-09-09T04:00:00Z", closesAt: "2026-09-11T04:00:00Z", closedAt: null,
    stories, ...overrides,
  };
}

test("a date page without a hive yet says when its first one opens", () => {
  const html = renderDayPage(PAGE);
  assert.ok(html.includes('class="wall wpromise"'));
  assert.ok(html.includes("September 9 has no hive yet. Its first one opens on September 8,"));
  assert.ok(!html.includes('class="wboard'), "no board is drawn for a promise");
});

test("a tile sits at its stored anchor and size, and links to its receipt", () => {
  const s = story({ rect: { mx: 3, my: 5, w: 4, h: 3 }, support: 40 });
  const html = wallSection(day([s]), "September 9", Date.parse("2026-09-09T20:00:00Z"));
  // Drawn inside the viewport: an eight module window centred on the tile,
  // so the stored anchor at column 3, row 5 lands at column 3, row 4 of the
  // window, whose origin is (1, 2).
  assert.ok(html.includes('style="--side:8"'));
  assert.ok(html.includes("grid-column:3 / span 4;grid-row:4 / span 3"));
  assert.ok(html.includes(`href="${storyPath(s)}"`));
  assert.ok(html.includes("Council approves the river crossing"));
  assert.ok(html.includes("example.org"));
  assert.ok(html.includes("40 buzzes"));
  assert.ok(html.includes(">Reported<"));
  assert.ok(html.includes("Open. Seals at midnight Eastern ending September 10, 2026"));
});

test("a closed wall says it is permanent", () => {
  const html = wallSection(day([story()]), "September 9", Date.parse("2026-09-12T00:00:00Z"));
  assert.ok(html.includes("Sealed at midnight Eastern ending September 10, 2026. Permanent."));
});

test("the pool and the overflow are the feed under the hive, all of it, backed first, then the date's own history, then arrival", () => {
  const pooled = story({ id: "aaaaaaaa-0000-0000-0000-000000000001", status: "pool", rect: null, placedAt: null, support: 0, headline: "A pooled story nobody backed" });
  const spilled = story({ id: "aaaaaaaa-0000-0000-0000-000000000002", status: "overflow", rect: null, headline: "A story the hive had no room for" });
  const history = story({ id: "aaaaaaaa-0000-0000-0000-000000000003", status: "pool", rect: null, placedAt: null, support: 0, priority: 3, submittedAt: "2026-09-09T15:00:00Z", headline: "1888: The Football League kicks off" });
  const html = wallSection(day([story(), pooled, spilled, history]), "September 9");
  assert.ok(html.includes('<h2 class="section" id="feedhead">Today\'s feed</h2>'));
  const at = (text: string) => { const i = html.indexOf(text); assert.ok(i > 0, text); return i; };
  // Twelve buzzes first, then the date's own history ahead of the feeds even
  // though it arrived later, then the news nobody backed.
  assert.ok(at("A story the hive had no room for") < at("1888: The Football League kicks off"));
  assert.ok(at("1888: The Football League kicks off") < at("A pooled story nobody backed"));
  // No fold: the whole feed is on the page.
  assert.ok(!html.includes("<details"), "the feed is not folded");
  assert.ok(!html.includes("Backed, waiting"));
  // None of the three is drawn as a tile.
  assert.equal((html.match(/class="wtile/g) ?? []).length, 1);
});

test("a story shown false keeps its rectangle and is stamped", () => {
  const stamped = story({ status: "false", falseAt: "2026-09-10T10:00:00Z", falseNote: "The outlet corrected the vote count." });
  const html = wallSection(day([stamped]), "September 9");
  assert.ok(html.includes("grid-column:4 / span 2;grid-row:5 / span 1"));
  assert.ok(html.includes("wfalse"));
  assert.ok(html.includes("Shown false"));
  const page = renderStoryPage(stamped, day([stamped]));
  assert.ok(page.includes("later shown false"));
  assert.ok(page.includes("The outlet corrected the vote count."));
});

test("the receipt shows the headline, the link, the tier, every quotation and every check", () => {
  const s = story();
  const html = renderStoryPage(s, day([s]));
  assert.ok(html.includes("Council approves the river crossing after a decade of study"));
  assert.ok(html.includes('href="https://www.example.org/news/river-crossing"'));
  assert.ok(html.includes("Two or more independently owned outlets."));
  assert.ok(html.includes("The council voted seven to two on Tuesday night to approve the crossing."));
  assert.ok(html.includes("Link resolves"));
  assert.ok(html.includes("Page contains the quotation"));
  assert.ok(html.includes("matched at offset 2210"));
  assert.ok(html.includes("12 buzzes"));
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
  // The words the document forbids never appear.
  assert.ok(!/verified truth|fact checked/i.test(html));
});

test("the receipt says nothing about who submitted or boosted", () => {
  const s = story();
  const html = renderStoryPage(s, day([s]));
  assert.ok(!/submitted by|booster|profile|handle/i.test(html));
});

test("the date page draws the hive under the name and nothing else in front of it", () => {
  const s = story();
  const html = renderDayPage(PAGE, [], [], [], [], null, new Map(), new Map(), day([s]));
  const h1 = html.indexOf("<h1>September 9</h1>");
  const wallAt = html.indexOf('class="wall"');
  assert.ok(h1 > 0 && h1 < wallAt);
  assert.ok(html.includes("The hive for September 9, 2026"));
  assert.ok(!html.includes('class="remember"'), "the remembrance game is off the page");
  assert.ok(!html.includes('action="/remember"'), "and so is its button");
});

test("a date page shows only the newest year's wall", () => {
  const older = day([story({ id: "aaaaaaaa-0000-0000-0000-000000000009", wallDate: "2025-09-09" })], { wallDate: "2025-09-09", year: 2025 });
  const newer = day([story()]);
  const picked = newestByDate([older, newer]);
  assert.equal(picked.get("9-9")?.year, 2026);
  assert.equal(picked.size, 1);
});

test("tier labels are the document's words and never a verdict", () => {
  assert.equal(tierLabel("seen_direct"), "Seen directly");
  assert.equal(tierLabel("reported"), "Reported");
  assert.equal(tierLabel("claimed"), "Claimed");
});

test("the receipt address sits under its date", () => {
  assert.equal(storyPath(story()), "/september-9/wall/11111111-2222-3333-4444-555555555555/");
});

test("a project without the wall tables yet is an empty wall, not a failed build", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => new Response("", { status: 404 })) as typeof fetch;
  try {
    assert.deepEqual(await fetchWall("https://example.invalid", "key"), []);
  } finally {
    globalThis.fetch = real;
  }
});

test("a wall that exists and cannot be read still fails the build", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => new Response("", { status: 500 })) as typeof fetch;
  try {
    await assert.rejects(fetchWall("https://example.invalid", "key"));
  } finally {
    globalThis.fetch = real;
  }
});

// ---------------------------------------------------------------------------
// Boosting from the web, docs/the-wall.md section 13
// ---------------------------------------------------------------------------

const LIVE_NOW = Date.parse("2026-09-09T20:00:00Z");

test("a story nobody backed never prints a count of nothing", () => {
  assert.equal(units(0), "");
  assert.equal(units(1), "1 buzz");
  assert.equal(units(3), "3 buzzes");
  assert.equal(units(3, PLAIN), "3 taps");
  const s = story({ rect: { mx: 3, my: 5, w: 4, h: 3 }, support: 0 });
  const html = wallSection(day([s]), "September 9", LIVE_NOW);
  assert.ok(!/0 (boosts|taps)/.test(html));
  assert.ok(!/\bboost/i.test(html), "the page does not say boost anywhere; a reader is not told what one is");
  const page = renderStoryPage(s, day([s]));
  assert.ok(page.includes("Nobody has backed it yet."));
  assert.ok(!/0 (boosts|taps)/.test(page));
});

test("the baked section carries no forms, and the interactive one carries a tap on every tile and row while the date takes boosts", () => {
  const onWall = story({ rect: { mx: 3, my: 5, w: 4, h: 3 }, support: 2 });
  const pooled = story({ id: "aaaaaaaa-0000-0000-0000-000000000001", status: "pool", rect: null, placedAt: null, support: 0 });
  const spilled = story({ id: "aaaaaaaa-0000-0000-0000-000000000002", status: "overflow", rect: null });
  const d = day([onWall, pooled, spilled]);

  const baked = wallSection(d, "September 9", LIVE_NOW);
  assert.ok(!baked.includes("<form"), "a baked page never offers a tap");
  assert.ok(baked.includes(`href="${storyPath(onWall)}"`));
  assert.ok(baked.includes('id="wkept"'), "the afterwords are on every page, for a tap refused after a page was served");

  const live = wallSection(d, "September 9", LIVE_NOW, { interactive: true });
  // One control per tile and per row, and it says what it does.
  assert.equal((live.match(/<form class="wbuzz"/g) ?? []).length, 3);
  assert.equal((live.match(/>Buzz<\/button>/g) ?? []).length, 3);
  assert.ok(live.includes('action="/boost"'));
  assert.ok(live.includes(`name="s" value="${onWall.id}"`));
  assert.ok(live.includes('name="m" value="9"') && live.includes('name="d" value="9"'));
  // The headline is the link to the receipt, on the tile and in the list.
  assert.ok(live.includes(`<a class="wh" href="${storyPath(onWall)}"`));
  assert.ok(live.includes(`<li id="w-${pooled.id}"><a href="${storyPath(pooled)}">`));
  assert.ok(live.includes("Buzz what you think will still matter about September 9"));
  assert.ok(live.includes("Three buzzes left today."));
  assert.ok(live.includes("You buzzed this"));
  // The evidence tiers keep their one line and nothing claims a model decided anything.
  assert.ok(live.includes("a tier is not a verdict."));
  assert.ok(!/verified truth|fact checked|model/i.test(live));
});

test("the day before takes no taps, the day after takes one, and a closed wall takes none", () => {
  const d = day([story({ rect: { mx: 3, my: 5, w: 4, h: 3 } })]);
  const before = Date.parse("2026-09-08T20:00:00Z");
  const after = Date.parse("2026-09-10T20:00:00Z");
  const closed = Date.parse("2026-09-11T05:00:00Z");
  assert.equal(takingBoosts(d, before), false);
  assert.equal(takingBoosts(d, LIVE_NOW), true);
  assert.equal(takingBoosts(d, after), true);
  assert.equal(takingBoosts(d, closed), false);
  assert.equal(allowanceOn(d, before), 0);
  assert.equal(allowanceOn(d, LIVE_NOW), 3);
  assert.equal(allowanceOn(d, after), 1);
  assert.equal(allowanceOn(d, closed), 0);

  const early = wallSection(d, "September 9", before, { interactive: true });
  assert.ok(!early.includes("<form"), "no tap is offered before the date arrives");
  assert.ok(early.includes("Tomorrow's hive. When the date arrives"));
  const late = wallSection(d, "September 9", after, { interactive: true });
  assert.ok(late.includes("<form"));
  assert.ok(late.includes("One buzz left today on this date. It closes tonight."));
  const shut = wallSection(d, "September 9", closed, { interactive: true });
  assert.ok(!shut.includes("<form"));
  assert.ok(!shut.includes("buzzes left"));
});

test("the remaining count says what it means", () => {
  assert.equal(tapsLeftSentence(3, 3), "Three buzzes left today.");
  assert.equal(tapsLeftSentence(2, 3), "Two buzzes left today.");
  assert.equal(tapsLeftSentence(1, 3), "One buzz left today.");
  assert.equal(tapsLeftSentence(0, 3), "No buzzes left today.");
  assert.equal(tapsLeftSentence(1, 1), "One buzz left today on this date. It closes tonight.");
  assert.equal(tapsLeftSentence(0, 1), "No buzzes left today on this date.");
  assert.equal(tapsLeftSentence(2, 3, PLAIN), "Two taps left today.");
});

test("a solemn date speaks plainly: no pun anywhere on its wall", () => {
  assert.ok(PLAIN_DATES.has("9-11"));
  assert.equal(voiceFor(9, 11), PLAIN);
  assert.equal(voiceFor(9, 9), BEE);
  const s = story({ wallDate: "2026-09-11", rect: { mx: 3, my: 5, w: 4, h: 3 }, support: 2 });
  const d = day([s], { wallDate: "2026-09-11", day: 11, liveAt: "2026-09-11T04:00:00Z", opensAt: "2026-09-10T04:00:00Z", closesAt: "2026-09-13T04:00:00Z" });
  const now = Date.parse("2026-09-11T20:00:00Z");
  const html = wallSection(d, "September 11", now, { interactive: true });
  assert.ok(!/buzz/i.test(html.replace(/class="wbuzz"/g, "")), "no buzz on September 11, outside the class name of the control");
  assert.ok(html.includes("Three taps left today."));
  assert.ok(html.includes(">Back this</button>"));
  assert.ok(html.includes("You backed this"));
  assert.ok(html.includes("2 taps"));
  // The wall itself is unchanged: it still opens and still takes support.
  assert.ok(html.includes('action="/boost"'));
  const marks = wallMarks({ left: 1, allowance: 3, backed: [s.id] }, d, now);
  assert.ok(marks.includes("One tap left today."));
});

test("a reader's own marks reveal their taps and their count, and nothing about anybody else", () => {
  const d = day([story({ rect: { mx: 3, my: 5, w: 4, h: 3 }, support: 7 })]);
  const marks = wallMarks({ left: 2, allowance: 3, backed: ["11111111-2222-3333-4444-555555555555", "not a uuid; }"] }, d, LIVE_NOW);
  assert.ok(marks.startsWith("<style>") && marks.endsWith("</style>"));
  assert.ok(marks.includes('.wleft::after{content:"Two buzzes left today."}'));
  assert.ok(marks.includes("#w-11111111-2222-3333-4444-555555555555 .wmine{display:block}"));
  assert.ok(!marks.includes("not a uuid"));
  assert.ok(!/\d+ (people|readers)/.test(marks));
  // Nothing at all for a browser that has done nothing on a closed date.
  assert.equal(wallMarks({ left: 0, allowance: 0, backed: [] }, d, Date.parse("2026-09-12T00:00:00Z")), "");
});

test("a tile is drawn at the height it has, and the headline gets the lines it can hold", () => {
  const short = wallSection(day([story({ rect: { mx: 0, my: 0, w: 4, h: 3 } })]), "September 9", LIVE_NOW);
  assert.ok(short.includes("grid-row:1 / span 3;--lines:3"));
  const tall = wallSection(day([story({ rect: { mx: 0, my: 0, w: 6, h: 5 } })]), "September 9", LIVE_NOW);
  assert.ok(tall.includes("--lines:7"));
});

// ---------------------------------------------------------------------------
// One feed, one verb, decided September 10, 2026
// ---------------------------------------------------------------------------

test("the hive leads the date page, and the imported history is plain rows until the worker files it", () => {
  const people = [1, 2, 3].map((n) => ({ qid: `Q${n}`, name: `Person ${n}`, birthYear: 1950 + n, deathYear: null, description: "did things", monthlyViews: 100 }));
  // Tomorrow's hive, before the worker has filed a thing for it.
  const empty = emptyWallDay("2026-09-09");
  const html = renderDayPage({ month: 9, day: 9, people }, [], [], [], [], null, new Map(), new Map(), empty);
  const h1 = html.indexOf("<h1>September 9</h1>");
  const wallAt = html.indexOf('class="wall"');
  const feedAt = html.indexOf('class="feed2"');
  const personAt = html.indexOf('id="r-person-Q1"');
  assert.ok(h1 > 0 && h1 < wallAt, "the name, then the hive");
  assert.ok(wallAt < feedAt, "the hive, then the feed");
  // The baked history stands in for the feed, without buttons.
  assert.ok(feedAt < personAt, "the people are in the feed");
  assert.ok(!html.includes('action="/remember"'));
  assert.ok(!html.includes('class="rest"'), "no fold without songs");
  assert.ok(!html.includes("What people remember"));
  assert.ok(!html.includes("Closes tonight"));
  // Once the worker has filed the date's history as stories, the feed is
  // the stories and the baked rows are not drawn twice.
  const s = story({ rect: { mx: 3, my: 5, w: 4, h: 3 } });
  const filed = story({ id: "aaaaaaaa-0000-0000-0000-000000000003", status: "pool", rect: null, placedAt: null, support: 0, priority: 2, headline: "Person 1, did things, born 1951" });
  const later = renderDayPage({ month: 9, day: 9, people }, [], [], [], [], null, new Map(), new Map(), day([s, filed]));
  assert.ok(later.includes("Person 1, did things, born 1951"));
  assert.ok(!later.includes('id="r-person-Q1"'), "the baked row is not drawn beside the story it became");
  // A hive with tiles and an empty pool says so rather than showing the
  // baked rows as if they were still waiting.
  const placedOnly = renderDayPage({ month: 9, day: 9, people }, [], [], [], [], null, new Map(), new Map(), day([s]));
  assert.ok(placedOnly.includes("Everything filed for September 9 is on the hive."));
  assert.ok(!placedOnly.includes('id="r-person-Q1"'));
});

test("a date with no hive yet lists its history under the promise, without buttons", () => {
  const people = [{ qid: "Q1", name: "Person 1", birthYear: 1951, deathYear: null, description: "did things", monthlyViews: 100 }];
  const html = renderDayPage({ month: 9, day: 9, people });
  assert.ok(html.indexOf('class="wall wpromise"') < html.indexOf('id="r-person-Q1"'));
  assert.ok(!html.includes("<form"));
  assert.ok(html.includes("When its hive opens, every one of these takes buzzes."));
});

test("the number one songs stay behind one line", () => {
  const songs = [{ year: 2001, chartDate: "2001-09-08", song: "A Song", artist: "A Band" }];
  const html = renderDayPage(PAGE, songs);
  assert.ok(html.includes('<details class="rest">'));
  assert.ok(html.includes("<summary>The number one song on September 9 in 1 year</summary>"));
});

// ---------------------------------------------------------------------------
// The hive is the product, decided September 10, 2026
// ---------------------------------------------------------------------------

test("the page zooms to the tiles: the smallest square that holds them, never under eight, never over the board", () => {
  assert.deepEqual(viewportFor([]), { ox: 0, oy: 0, side: VIEW_MIN });
  // Ten tiles in the middle of a quiet day.
  const quiet = viewportFor([{ mx: 6, my: 6, w: 4, h: 3 }, { mx: 10, my: 6, w: 4, h: 3 }, { mx: 6, my: 9, w: 5, h: 4 }, { mx: 2, my: 6, w: 4, h: 3 }]);
  assert.equal(quiet.side, 12);
  assert.ok(quiet.ox >= 0 && quiet.oy >= 0 && quiet.ox + quiet.side <= 16 && quiet.oy + quiet.side <= 16);
  // Every tile is inside the window.
  for (const r of [{ mx: 2, my: 6, w: 4, h: 3 }, { mx: 10, my: 6, w: 4, h: 3 }, { mx: 6, my: 9, w: 5, h: 4 }]) {
    assert.ok(r.mx >= quiet.ox && r.mx + r.w <= quiet.ox + quiet.side && r.my >= quiet.oy && r.my + r.h <= quiet.oy + quiet.side);
  }
  // A full day is the whole board.
  const full = viewportFor([{ mx: 0, my: 0, w: 4, h: 3 }, { mx: 12, my: 13, w: 4, h: 3 }]);
  assert.deepEqual(full, { ox: 0, oy: 0, side: 16 });
  // A tile in a corner: the window is clamped to the board rather than
  // hanging off it.
  const corner = viewportFor([{ mx: 0, my: 0, w: 4, h: 3 }]);
  assert.deepEqual(corner, { ox: 0, oy: 0, side: 8 });
});

test("tomorrow has an empty hive with the hour it opens, not a missing section", () => {
  const tomorrow = emptyWallDay("2026-09-10");
  assert.equal(tomorrow.liveAt, "2026-09-10T04:00:00.000Z");
  assert.equal(tomorrow.opensAt, "2026-09-09T04:00:00.000Z");
  assert.equal(tomorrow.closesAt, "2026-09-12T04:00:00.000Z");
  assert.deepEqual(tomorrow.stories, []);
  // January is five hours behind, not four.
  assert.equal(emptyWallDay("2026-01-10").liveAt, "2026-01-10T05:00:00.000Z");
  const html = wallSection(tomorrow, "September 10", Date.parse("2026-09-10T01:00:00Z"), { interactive: true });
  assert.ok(html.includes('class="wboard wblank"'));
  assert.ok(html.includes("Opens at midnight Eastern, about 3 hours from now."));
  assert.ok(html.includes("Tomorrow's hive."));
  assert.ok(!html.includes("<form"), "nothing to buzz before the date arrives");
});

test("the full screen page is the hive, its count and its sentences, and a buzz from it comes back to it", () => {
  const s = story({ rect: { mx: 3, my: 5, w: 4, h: 3 }, support: 2 });
  const d = day([s]);
  const section = wallSection(d, "September 9", LIVE_NOW, { interactive: true, hive: true });
  assert.ok(section.includes('class="wall whive"'));
  assert.ok(section.includes('name="v" value="hive"'));
  assert.ok(!section.includes("feed2") && !section.includes("Today's feed"), "the feed stays on the date page");
  const page = renderHivePage(d, 9, 9);
  assert.ok(page.includes('<meta name="robots" content="noindex">'));
  assert.ok(page.includes('href="/september-9/"'));
  assert.equal(hivePath(9, 9), "/september-9/hive/");
  // The date page links to it, and only when there is something to see.
  const dated = wallSection(d, "September 9", LIVE_NOW);
  assert.ok(dated.includes('href="/september-9/hive/">Open the hive full screen</a>'));
  assert.ok(!wallSection(emptyWallDay("2026-09-10"), "September 10", LIVE_NOW).includes("full screen"));
});
