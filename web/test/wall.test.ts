import { strict as assert } from "node:assert";
import { test } from "node:test";

import { renderDayPage, renderHivePage, renderStoryPage } from "../src/render.js";
import {
  eastern,
  yearsAgo,
  combRank,
  BEE, PLAIN, PLAIN_DATES, VIEW_MIN, allowanceOn, emptyWallDay, fetchWall, hivePath, newestByDate, storyPath, takingBoosts,
  tapsLeftSentence, tierLabel, yearAttr, SAVE_PICTURE, tiersDiffer, hiveDaysNav, units, viewportFor, voiceFor, wallMarks, wallSection, pictureRules, songParts, subjectOf, takeTurns, FEED_SHOWN, tileKind, kindMark, WALL_STYLE, sealedLine, picturedSubjects, combPictured, hindsightLine, latestOutcome, outcomeStamp, recordStanding, yoursLine, fitType, tileYear, type WallDay, type WallStory,
} from "../src/wall.js";
import { picturesFor } from "../src/render.js";
import { SHARE_SCRIPT } from "../src/share-button.js";

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
    subjectKind: null,
    subjectId: null,
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
  // A blank board is drawn with the opening date on it, and no tiles.
  assert.ok(html.includes('class="wboard wblank"'));
  assert.ok(html.includes("First hive opens September 8,"));
  assert.ok(!html.includes('class="wtile'));
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
  // One tier on the board, so no key to three: the tile's colour is its tier.
  assert.ok(!html.includes('class="wlegend"'));
  assert.ok(html.replace(/<[^>]+>/g, "").includes("Open. Seals at midnight Eastern ending September 10, 2026"));
  assert.ok(html.includes('<em class="wkey">Seals</em>'), "the coined words are set apart");
});

test("a closed wall says it is permanent", () => {
  const html = wallSection(day([story()]), "September 9", Date.parse("2026-09-12T00:00:00Z"));
  assert.ok(html.replace(/<[^>]+>/g, "").includes("Sealed at midnight Eastern ending September 10, 2026. Permanent."));
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

test("a baked receipt carries no form, and a live one carries the buzz and the mark's anchor", () => {
  const s = story({ status: "pool", rect: null, placedAt: null, support: 0 });
  const baked = renderStoryPage(s, day([s]));
  assert.ok(!baked.includes("<form"), "a baked receipt never offers a buzz");
  assert.ok(baked.includes(`id="w-${s.id}"`), "but the mark has somewhere to land");
  const live = renderStoryPage(s, day([s]), LIVE_NOW, { interactive: true });
  assert.equal((live.match(/<form class="wbuzz"/g) ?? []).length, 1);
  assert.ok(live.includes('name="v" value="receipt"'));
  assert.ok(live.includes("Three buzzes left today."));
  assert.ok(live.includes("You buzzed this"));
  // A story shown false takes no buzz, on the receipt as on the tile.
  const stamped = story({ status: "false", falseAt: "2026-09-10T10:00:00Z" });
  assert.ok(!renderStoryPage(stamped, day([stamped]), LIVE_NOW, { interactive: true }).includes("<form"));
  // After the date seals, none either.
  assert.ok(!renderStoryPage(s, day([s]), Date.parse("2026-09-12T00:00:00Z"), { interactive: true }).includes("<form"));
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
  assert.ok(live.includes(`<li id="w-${pooled.id}" data-subject="story:${pooled.id}"><a href="${storyPath(pooled)}">`));
  // One line above the board since September 23, 2026 (the-wall.md section
  // 30): what to do and what a buzz does, before the board. It names no
  // number, because the count under it does.
  assert.ok(live.includes(`<p class="wlede">${HOW_TO}</p>`), "the how-to is above the board");
  assert.ok(live.indexOf('class="wlede"') < live.indexOf('class="wboard'), "above it, not under it");
  assert.ok(!/\d/.test(HOW_TO), "and it names no number");
  assert.ok(!baked.includes('class="wlede"'), "a page with nothing to spend says nothing about spending");
  assert.ok(live.includes("Three buzzes left today."));
  assert.ok(live.includes("You buzzed this"));
  // Nothing claims a model decided anything. The tier key is drawn only when
  // the board carries more than one tier; see "the save link and the tier key".
  assert.ok(!live.includes('class="wlegend"'));
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
  assert.ok(early.replace(/<[^>]+>/g, "").includes("Opens tonight at midnight Eastern."));
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

test("every date speaks the one voice, buzz, September 11 included", () => {
  assert.equal(PLAIN_DATES.size, 0, "no date is solemn any more");
  assert.equal(voiceFor(9, 11), BEE);
  assert.equal(voiceFor(9, 9), BEE);
  const s = story({ wallDate: "2026-09-11", rect: { mx: 3, my: 5, w: 4, h: 3 }, support: 2 });
  const d = day([s], { wallDate: "2026-09-11", day: 11, liveAt: "2026-09-11T04:00:00Z", opensAt: "2026-09-10T04:00:00Z", closesAt: "2026-09-13T04:00:00Z" });
  const now = Date.parse("2026-09-11T20:00:00Z");
  const html = wallSection(d, "September 11", now, { interactive: true });
  assert.ok(html.includes("Three buzzes left today."));
  assert.ok(html.includes(">Buzz</button>"));
  assert.ok(html.includes("You buzzed this"));
  assert.ok(html.includes("2 buzzes"));
  assert.ok(!/back this|backed this|taps? left/i.test(html), "no solemn wording anywhere");
  // The wall itself is unchanged: it still opens and still takes support.
  assert.ok(html.includes('action="/boost"'));
  const marks = wallMarks({ left: 1, allowance: 3, backed: [s.id] }, d, now);
  assert.ok(marks.includes("One buzz left today."));
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
  // The same 58 character headline in two tiles. Since September 21, 2026
  // the size and the line budget are worked out together by fitType from the
  // box and the sentence, so a bigger tile holds the same words in larger
  // type rather than in more lines of small type.
  const short = wallSection(day([story({ rect: { mx: 0, my: 0, w: 4, h: 3 } })]), "September 9", LIVE_NOW);
  assert.ok(short.includes("grid-row:1 / span 3;--lines:4;--fit:1.11;"));
  const tall = wallSection(day([story({ rect: { mx: 0, my: 0, w: 6, h: 5 } })]), "September 9", LIVE_NOW);
  assert.ok(tall.includes("--lines:5;--fit:1.77;"), "taller and wider, so larger type");
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
  assert.ok(!html.includes('class="wbuzz"') && !html.includes('action="/boost"'), "no buzz buttons on a baked page (the birthday picker form is fine)");
  assert.ok(html.includes("When its hive opens, every one of these takes buzzes."));
});

test("the number one songs are one strip, baked under the feed until the worker files them, never drawn twice", () => {
  const songs = [{ year: 2001, chartDate: "2001-09-08", song: "A Song", artist: "A Band" }];
  const html = renderDayPage(PAGE, songs);
  assert.ok(!html.includes('<details class="rest">'), "the folded section is gone");
  assert.equal((html.match(/class="wsongs"/g) ?? []).length, 1, "one strip");
  assert.ok(html.includes('<li id="2001" data-subject="song:2001-09-08">'));
  assert.ok(html.includes("&quot;A Song&quot; by A Band"));
  assert.ok(!html.includes('class="wbuzz"') && !html.includes('action="/boost"'), "no buzz buttons before the worker has filed the songs (the birthday picker form is fine)");
  // Once the worker has filed a song story, the strip is the stories and the baked one is not drawn beside it.
  const filed = story({ id: "aaaaaaaa-0000-0000-0000-000000000009", status: "pool", rect: null, placedAt: null, support: 0, subjectKind: "song", subjectId: "2001-09-08", headline: "2001: A Song by A Band was the number one song" });
  const later = renderDayPage(PAGE, songs, [], [], [], null, new Map(), new Map(), day([story(), filed]));
  // Once filed, the songs live on the comb, September 22, 2026, and the
  // date page carries the card that leads there instead of a second strip.
  assert.equal((later.match(/class="wsongs"/g) ?? []).length, 0, "no strip on the date page once filed");
  assert.ok(later.includes('<a class="wcomb" href="/september-9/comb/">'));
  const comb = wallSection(day([story(), filed]), "September 9", Date.now(), { comb: true });
  assert.equal((comb.match(/class="wsongs"/g) ?? []).length, 1, "one strip, on the comb");
  assert.ok(comb.includes('id="2001"'), "the year is still an address");
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
  assert.ok(html.includes("Opens at midnight Eastern</b>"));
  assert.ok(html.includes("about 3 hours from now."));
  assert.ok(html.replace(/<[^>]+>/g, "").includes("Opens tonight at midnight Eastern."));
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

/** The page as a reader sees it: tags gone, entities left alone. Class names
 * and attribute values are markup and are not read by anybody. */
// ---------------------------------------------------------------------------
// The typed field. docs/the-wall.md section 15.
// ---------------------------------------------------------------------------

import { ASK_MAX, HOW_TO, checkRuns, spanWords, type WallCheck } from "../src/wall.js";

test("the typed field is on the live section only, posts a plain form to /find, and spends nothing", () => {
  const d = day([story({ rect: { mx: 3, my: 5, w: 4, h: 3 } })]);
  const baked = wallSection(d, "September 9", LIVE_NOW);
  assert.ok(!baked.includes('action="/find"'), "a baked page never carries the field");
  // The three sentences the field answers with are on every page, baked
  // ones included, for a reader whose find lands on the fallback.
  for (const id of ["wmiss", "wblank", "wnofind"]) assert.ok(baked.includes(`id="${id}"`), `${id} is on the baked page`);

  const live = wallSection(d, "September 9", LIVE_NOW, { interactive: true });
  assert.equal((live.match(/<form class="wask"/g) ?? []).length, 1);
  assert.ok(live.includes('method="post" action="/find"'));
  assert.ok(live.includes("What mattered about September 9?"));
  assert.ok(live.includes(`name="q" type="text" maxlength="${ASK_MAX}"`));
  assert.ok(live.includes('name="m" value="9"') && live.includes('name="d" value="9"'));
  assert.ok(live.includes(">Find</button>"));
  // The ways on from the board are one row of pills under it, and the old
  // fragment between them is gone. Nathan, September 22, 2026.
  assert.ok(!live.includes("makes its story bigger."), "cut, September 22, 2026");
  assert.ok(live.indexOf('class="wways"') > live.indexOf('class="wboard'), "the row is under the board");
  assert.ok(live.includes('<a href="/about/">How the hive works</a>'));
  assert.ok(!live.includes("Typing spends nothing."), "cut, September 22, 2026");
  // No script anywhere near it: a form and a button and nothing else.
  assert.ok(!/<script|onsubmit|oninput/i.test(live));
  // The miss is the front door to submission rather than a dead end.
  assert.ok(live.includes('id="wmiss">Nothing filed for September 9 says that.'));
  // /add/ is where somebody hands you their birthday, not where you get the
  // app. The About page is the one with the download on it.
  assert.ok(live.includes('<a href="/about/">get Birthed</a>'));
  assert.ok(!live.includes('<a href="/add/">'), "get Birthed never points at the birthday hand-off page");

  // After the date seals the field is gone with the buzz forms.
  const sealed = wallSection(d, "September 9", Date.parse("2026-09-12T00:00:00Z"), { interactive: true });
  assert.ok(!sealed.includes('action="/find"'));
  // And the full screen hive does not carry it: it is the hive and its count and nothing else.
  assert.ok(!wallSection(d, "September 9", LIVE_NOW, { interactive: true, hive: true }).includes('action="/find"'));
});

test("the confirmation shows the story, its outlet and its tier, and the buzz is the same /boost form, with a way out", () => {
  const found = story({ id: "aaaaaaaa-0000-0000-0000-000000000001", status: "pool", rect: null, placedAt: null, support: 0 });
  const other = story({ id: "aaaaaaaa-0000-0000-0000-000000000002", status: "pool", rect: null, placedAt: null, support: 3, headline: "The other one" });
  const d = day([found, other]);

  const none = wallSection(d, "September 9", LIVE_NOW, { interactive: true });
  assert.ok(!none.includes('id="wfound"'), "no confirmation unless a find said so");

  const one = wallSection(d, "September 9", LIVE_NOW, { interactive: true, found: [found] });
  assert.ok(one.includes('id="wfound"'));
  assert.ok(one.includes("Is this the one?"));
  assert.ok(one.includes(`<li id="f-${found.id}"><a href="${storyPath(found)}">Council approves the river crossing after a decade of study</a>`));
  assert.ok(one.includes("example.org") && one.includes(">Reported<"));
  // Nothing spent until the reader confirms, and the confirmation is the
  // existing buzz form, unchanged: the story, the date, /boost.
  const block = one.slice(one.indexOf('id="wfound"'), one.indexOf("</div>", one.indexOf('id="wfound"')));
  assert.ok(block.includes('<form class="wbuzz" method="post" action="/boost">'));
  assert.ok(block.includes(`name="s" value="${found.id}"`));
  // Thirty seconds, since the undo shipped. A confirmation that told the
  // reader a buzz could not be taken back and then drew an Undo button under
  // it was the copy contradicting the product.
  assert.ok(block.includes("Spend one buzz on this? You get thirty seconds to take it back, and after that it stands."));
  assert.ok(block.includes('<a href="/september-9/#ask">Not this one</a>'));
  // The same story is still drawn in the feed under its own id, so the two ids differ.
  assert.ok(one.includes(`<li id="w-${found.id}" data-subject="story:${found.id}">`));

  const several = wallSection(d, "September 9", LIVE_NOW, { interactive: true, found: [other, found] });
  assert.ok(several.includes("A few stories say that. Which one did you mean?"));
  assert.ok(several.indexOf(`id="f-${other.id}"`) < several.indexOf(`id="f-${found.id}"`), "best first, as the matcher ordered them");
  assert.ok(several.includes("3 buzzes"));

  // A story shown false is still the one the reader meant, so it is shown, and it takes no buzz.
  const stamped = story({ id: "aaaaaaaa-0000-0000-0000-000000000003", status: "false", falseAt: "2026-09-09T18:00:00Z" });
  const shown = wallSection(day([stamped]), "September 9", LIVE_NOW, { interactive: true, found: [stamped] });
  const falseBlock = shown.slice(shown.indexOf('id="wfound"'), shown.indexOf("</div>", shown.indexOf('id="wfound"')));
  assert.ok(falseBlock.includes("Later shown false. Takes no buzzes."));
  assert.ok(!falseBlock.includes("<form"));

  // September 11 speaks the same voice as every other date now.
  const plain = wallSection(day([found], { wallDate: "2026-09-11", month: 9, day: 11, liveAt: "2026-09-11T04:00:00Z", closesAt: "2026-09-13T04:00:00Z" }),
    "September 11", Date.parse("2026-09-11T20:00:00Z"), { interactive: true, found: [{ ...found, wallDate: "2026-09-11" }] });
  assert.ok(plain.includes("Spend one buzz on this?"));
});

// ---------------------------------------------------------------------------
// The receipt's check history, folded.
// ---------------------------------------------------------------------------

function check(minute: number, kind: WallCheck["kind"], passed: boolean, httpStatus: number | null, detail: string): WallCheck {
  return { checkedAt: new Date(Date.UTC(2026, 8, 9, 14, minute)).toISOString(), kind, passed, httpStatus, detail };
}

/** A quarter hour of checks, the way the worker wrote them: a pair every fifteen minutes. */
function quarterHours(pairs: number, from: number = 0): WallCheck[] {
  const out: WallCheck[] = [];
  for (let i = 0; i < pairs; i += 1) {
    const minute = from + i * 15;
    out.push(check(minute, "resolves", true, 200, `200, text/html, ${48000 + i} characters`));
    out.push(check(minute + 1, "quotation", true, 200, "the page contains the quotation, exactly"));
  }
  return out;
}

test("a run of identical checks is one run per kind, and every change breaks it", () => {
  const same = quarterHours(4);
  const runs = checkRuns(same);
  assert.equal(runs.length, 2, "two kinds, two runs");
  assert.deepEqual(runs.map((r) => [r.kind, r.passed, r.httpStatus, r.checks.length]), [["resolves", true, 200, 4], ["quotation", true, 200, 4]]);
  // The run keeps every row, oldest first.
  assert.deepEqual(runs[0]!.checks.map((c) => c.detail), same.filter((c) => c.kind === "resolves").map((c) => c.detail));

  // The page changed after a pass: a failing quotation row between two runs
  // of passes is its own run, and the resolves run around it is untouched.
  const changed = [...quarterHours(3), check(45, "resolves", true, 200, "200, text/html, 48100 characters"), check(46, "quotation", false, 200, "the page does not contain the quotation, exactly"), ...quarterHours(2, 60)];
  const broken = checkRuns(changed);
  assert.deepEqual(broken.map((r) => [r.kind, r.passed, r.checks.length]), [
    ["resolves", true, 6], ["quotation", true, 3], ["quotation", false, 1], ["quotation", true, 2],
  ]);
  // A different status is a change too, even when the result is the same word.
  const moved = [check(0, "resolves", true, 200, "a"), check(15, "resolves", true, 301, "b"), check(30, "resolves", true, 301, "c")];
  assert.deepEqual(checkRuns(moved).map((r) => [r.httpStatus, r.checks.length]), [[200, 1], [301, 2]]);
  // Out of order rows are put in order first, so a run is a run in time.
  assert.deepEqual(checkRuns([...same].reverse()).map((r) => r.checks.length), [4, 4]);
  assert.deepEqual(checkRuns([]), []);
});

test("the receipt draws a run as one line with its count and its period, keeps every row underneath, and shows a change in full", () => {
  const checks = [...quarterHours(48), check(720, "quotation", false, 200, "the page does not contain the quotation, exactly")];
  const s = story({ sources: [{ ...story().sources[0]!, checks }] });
  const html = renderStoryPage(s, day([s]));
  // Forty eight pairs and one failure are four lines, not ninety seven.
  assert.equal((html.match(/<tr class="wrun"/g) ?? []).length, 2);
  assert.equal((html.match(/<tbody>[\s\S]*?<\/tbody>/)![0].match(/<tr[ >]/g) ?? []).length, 3);
  assert.ok(html.includes("48 checks over about 12 hours, the same result every time."));
  // Built from eastern() rather than pinned to one string: the exact wording
  // is the platform's Intl output and has already differed between versions,
  // which is not a thing this test is trying to hold still.
  // The two kinds alternate, so the resolves run is the even indices: it
  // opens at checks[0] and closes at checks[94], and the quotation run that
  // follows it closes one minute later.
  assert.ok(html.includes(`${eastern(checks[0]!.checkedAt)} to ${eastern(checks[94]!.checkedAt)}`));
  // The resolves detail drifts by a few characters between fetches, which
  // is not a change the check measures; the row says so and keeps them all.
  assert.ok(html.includes("The wording varied; every check is below."));
  assert.ok(html.includes("<summary>Every one of the 48</summary>"));
  assert.ok(html.includes("200, text/html, 48000 characters") && html.includes("200, text/html, 48047 characters"), "every row is still on the page");
  assert.equal((html.match(/the page contains the quotation, exactly/g) ?? []).length, 49, "the quotation run's detail once on the line and once per row underneath");
  // The failure is its own full line, never folded into the passes.
  assert.ok(html.includes("<td>Failed</td><td>200</td><td>the page does not contain the quotation, exactly</td>"));
  // No script does the folding. The one script on a receipt is the share
  // control's, since September 22, 2026, and it is only that.
  const scripts = html.match(/<script>[\s\S]*?<\/script>/g) ?? [];
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0], `<script>${SHARE_SCRIPT}</script>`);
  assert.ok(html.includes("<details class=\"wevery\">"));

  // A single check is the row it always was, with no note about runs.
  const one = renderStoryPage(story(), day([story()]));
  assert.ok(!one.includes("wrun"));
  assert.ok(!one.includes("A run of checks that came out the same way"));
});

test("a period is said plainly", () => {
  assert.equal(spanWords("2026-09-09T14:00:00Z", "2026-09-09T14:00:00Z"), "about 0 minutes");
  assert.equal(spanWords("2026-09-09T14:00:00Z", "2026-09-09T14:01:00Z"), "about a minute");
  assert.equal(spanWords("2026-09-09T14:00:00Z", "2026-09-09T14:45:00Z"), "about 45 minutes");
  assert.equal(spanWords("2026-09-09T14:00:00Z", "2026-09-09T15:00:00Z"), "about an hour");
  assert.equal(spanWords("2026-09-09T14:00:00Z", "2026-09-10T01:00:00Z"), "about 11 hours");
  assert.equal(spanWords("2026-09-09T14:00:00Z", "2026-09-12T14:00:00Z"), "about 3 days");
});

// ---------------------------------------------------------------------------
// Pictures on tiles, and the number ones as a strip. docs/the-wall.md
// section 16, Nathan's ask on September 10, 2026.
// ---------------------------------------------------------------------------

const LIVE = Date.parse("2026-09-09T16:00:00Z");

function song(id: string, year: number, chartDate: string, support: number = 0, overrides: Partial<WallStory> = {}): WallStory {
  return story({
    id, headline: `${year}: "I'll Make Love to You" by Boyz II Men was the number one song`,
    url: `https://en.wikipedia.org/wiki/List_of_Billboard_Hot_100_number_ones_of_${year}`, outlet: "en.wikipedia.org",
    status: "pool", tier: "claimed", support, priority: 0, placedAt: null, rect: null,
    subjectKind: "song", subjectId: chartDate, ...overrides,
  });
}

test("a tile and a row carry the subject the worker filed them under, and news carries its own identifier", () => {
  const placedSong = song("aaaaaaaa-0000-0000-0000-000000000001", 1994, "1994-09-10", 3, { status: "placed", rect: { mx: 6, my: 6, w: 3, h: 3 }, placedAt: "2026-09-09T15:00:00Z" });
  const html = wallSection(day([placedSong, story({ id: "bbbbbbbb-0000-0000-0000-000000000002" })]), "September 9", LIVE);
  assert.ok(html.includes(`id="w-${placedSong.id}"`) && html.includes('data-subject="song:1994-09-10"'));
  const news = html.slice(html.indexOf('id="w-bbbbbbbb'), html.indexOf('id="w-bbbbbbbb') + 500);
  assert.ok(news.includes('data-subject="story:bbbbbbbb-0000-0000-0000-000000000002"'), "the day's news carries its own identifier, so a preview picture can find it");
  assert.equal(subjectOf({ subjectKind: null, subjectId: null }), null);
  assert.equal(subjectOf({ subjectKind: "person", subjectId: "Q42" }), "person:Q42");
});

test("the number ones are a strip of covers on the comb, not sixty rows in the feed", () => {
  const older = song("aaaaaaaa-0000-0000-0000-000000000001", 1994, "1994-09-10");
  const newer = song("aaaaaaaa-0000-0000-0000-000000000002", 2026, "2026-09-12");
  const backed = song("aaaaaaaa-0000-0000-0000-000000000003", 1971, "1971-09-11", 2);
  const news = story({ id: "bbbbbbbb-0000-0000-0000-000000000002", status: "pool", rect: null, placedAt: null });
  const page = wallSection(day([older, newer, backed, news]), "September 9", LIVE, { interactive: true });
  const feed = page.slice(page.indexOf('<ul class="wlist">'), page.indexOf("</ul>"));
  assert.ok(feed.includes(`id="w-${news.id}"`));
  assert.ok(!page.includes('<ul class="wsongs">'), "the covers are on the comb, not the date page");
  assert.ok(page.includes("3</b> number one songs"), "and the card counts them");
  const html = wallSection(day([older, newer, backed, news]), "September 9", LIVE, { interactive: true, comb: true });
  assert.ok(!feed.includes("subject:song") && !feed.includes(`id="w-${older.id}"`), "no song sits in the feed list");
  const strip = html.slice(html.indexOf('<ul class="wsongs">'), html.indexOf("</ul>", html.indexOf('<ul class="wsongs">')));
  const order = [backed.id, newer.id, older.id].map((id) => strip.indexOf(`id="w-${id}"`));
  assert.ok(order[0]! < order[1]! && order[1]! < order[2]!, "most backed first, then newest year");
  assert.ok(strip.includes('data-subject="song:1994-09-10"'));
  assert.ok(strip.includes('<span class="wyr" id="1994">1994</span>'), "the year sits on the cover");
  const shown = /<span class="wsongt">([^<]*)<\/span>/.exec(strip)?.[1] ?? "";
  assert.ok(shown.includes("Boyz II Men") && !shown.includes("was the number one song"), `the song and artist, not the whole sentence: ${shown}`);
  assert.equal((strip.match(/<form class="wbuzz"/g) ?? []).length, 3, "one button each while the date is live");
  assert.ok(strip.includes('name="v" value="comb"'), "a buzz on a song comes back to the comb");
  // A hive with no songs filed draws no strip and no heading for one.
  assert.ok(!wallSection(day([news]), "September 9", LIVE, { comb: true }).includes("wsongs"));
});

test("the picture rules name a tile by its subject and put nothing but a path on this domain in them", () => {
  const css = pictureRules([
    { subject: "song:1994-09-10", path: "/covers/0123456789abcdef.jpg" },
    { subject: "person:Q42", path: "/faces/Q42.jpg" },
  ]);
  assert.ok(css.startsWith('<style class="wpics">') && css.endsWith("</style>"));
  assert.ok(css.includes('[data-subject="song:1994-09-10"]{--pic:url("/covers/0123456789abcdef.jpg")}'));
  assert.ok(css.includes('[data-subject="person:Q42"]{--pic:url("/faces/Q42.jpg")}'));
  assert.ok(css.includes('.wtile[data-subject="song:1994-09-10"],.wtile[data-subject="person:Q42"]{color:var(--cream)'), "one shared rule for the light type and the scrim");
  assert.equal(pictureRules([]), "");
  // A subject or a path with quotes or a closing tag in it cannot break out of the rule.
  const odd = pictureRules([{ subject: `song:1994"]}</style><script>`, path: `/covers/x.jpg")}` }]);
  assert.ok(!odd.includes("<script>") && !odd.includes("</style><"));
});

test("the build lists a cover for every number one it has on disk, and a face for every person with one", () => {
  const pictures = picturesFor(
    [
      { year: 1994, chartDate: "1994-09-10", song: "I'll Make Love to You", artist: "Boyz II Men", hasArtwork: true },
      { year: 1993, chartDate: "1993-09-11", song: "Dreamlover", artist: "Mariah Carey", hasArtwork: false },
    ],
    [
      { qid: "Q42", name: "Somebody", birthYear: 1950, deathYear: null, description: null, monthlyViews: 0, hasImage: true },
      { qid: "Q43", name: "Nobody", birthYear: 1950, deathYear: null, description: null, monthlyViews: 0, hasImage: false },
    ],
  );
  assert.deepEqual(pictures.map((p) => p.subject), ["song:1994-09-10", "person:Q42"]);
  assert.match(pictures[0]!.path, /^\/covers\/[0-9a-f]{16}\.jpg$/);
  assert.equal(pictures[1]!.path, "/faces/Q42.jpg");
  // And the page carries them beside the wall, so a live section finds them too.
  const html = renderDayPage({ month: 9, day: 10, people: [] }, [
    { year: 1994, chartDate: "1994-09-10", song: "I'll Make Love to You", artist: "Boyz II Men", hasArtwork: true },
  ]);
  assert.ok(html.includes('<style class="wpics">[data-subject="song:1994-09-10"]'));
  const hive = renderHivePage(day([]), 9, 9, [{ subject: "song:1994-09-10", path: "/covers/abc.jpg" }]);
  assert.ok(hive.includes('<style class="wpics">'));
});

test("the year and the song come back out of the headline the worker wrote", () => {
  assert.deepEqual(songParts(`1994: "I'll Make Love to You" by Boyz II Men was the number one song`), { year: "1994", title: `"I'll Make Love to You" by Boyz II Men` });
  assert.equal(songParts("Council approves the river crossing"), null);
});

// ---------------------------------------------------------------------------
// The feed a reader can use: kinds take turns, a dozen shown, the rest folded.
// ---------------------------------------------------------------------------

function pooled(id: string, kind: string | null, support: number = 0, priority: number = 0): WallStory {
  return story({ id, headline: `${kind ?? "news"} ${id}`, status: "pool", rect: null, placedAt: null, support, priority, subjectKind: kind, subjectId: kind === null ? null : id });
}

test("under the backed stories the kinds take turns, news first, and a kind that runs out is skipped", () => {
  const input = [
    pooled("h1", "historical_event"), pooled("h2", "historical_event"), pooled("h3", "historical_event"),
    pooled("n1", null), pooled("n2", null),
    pooled("p1", "person"),
    pooled("b1", null, 2), pooled("h9", "historical_event", 1),
  ];
  const out = takeTurns(input).map((s) => s.id);
  assert.deepEqual(out, ["b1", "h9", "n1", "h1", "p1", "n2", "h2", "h3"]);
  // Within a kind the order it came in is kept, which is the pool's own order.
  assert.deepEqual(takeTurns([pooled("h2", "historical_event"), pooled("h1", "historical_event")]).map((s) => s.id), ["h2", "h1"]);
  assert.deepEqual(takeTurns([]), []);
});

test("the feed shows a dozen rows and sends the rest to the comb, with a card that counts them", () => {
  const stories: WallStory[] = [];
  for (let i = 0; i < 30; i++) stories.push(pooled(`aaaaaaaa-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`, i % 3 === 0 ? null : i % 3 === 1 ? "historical_event" : "person"));
  const html = wallSection(day(stories), "September 9", LIVE);
  const open = html.slice(html.indexOf('<ul class="wlist">'), html.indexOf("</ul>"));
  assert.equal((open.match(/<li /g) ?? []).length, FEED_SHOWN);
  // The rest is not on the page at all any more, September 22, 2026.
  assert.equal((html.match(/<li id="w-/g) ?? []).length, FEED_SHOWN, "no folded rows");
  assert.ok(!html.includes("wmore"));
  assert.ok(html.includes('<a class="wcomb" href="/september-9/comb/">'));
  assert.ok(html.includes(`${30 - FEED_SHOWN} more cells in the comb`));
  assert.ok(html.includes("Open the comb"));
  assert.ok(html.includes("still takes a buzz"));
  // A short feed has no comb to go to.
  assert.ok(!wallSection(day(stories.slice(0, 5)), "September 9", LIVE).includes("wcomb"));
});

test("the comb carries every row, grouped by kind, and a buzz from it comes back to it", () => {
  const stories: WallStory[] = [];
  for (let i = 0; i < 30; i++) stories.push(pooled(`aaaaaaaa-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`, i % 3 === 0 ? null : i % 3 === 1 ? "historical_event" : "person"));
  const html = wallSection(day(stories), "September 9", LIVE, { comb: true, interactive: true, date: { month: 9, day: 9 } });
  assert.equal((html.match(/<li id="w-/g) ?? []).length, 30, "every row");
  assert.ok(html.includes('id="comb-happened"') && html.includes('id="comb-born"') && html.includes('id="comb-news"'));
  assert.ok(html.indexOf('id="comb-happened"') < html.indexOf('id="comb-born"'));
  assert.ok(html.includes('href="#comb-born"'), "a jump to each kind");
  assert.ok(html.includes('name="v" value="comb"'), "a buzz from the comb comes back to the comb");
  assert.ok(!html.includes('class="wboard'), "the comb draws no board");
  // Every cell is the same hexagon, no wide ones, since September 22, 2026.
  assert.ok(!html.includes("wcwide"), "a comb has one cell");
  // A kind past a dozen folds: the first twelve open, the rest under a line
  // that counts them, all still on the page.
  const happened = html.slice(html.indexOf('id="comb-happened"'), html.indexOf('id="comb-born"'));
  assert.ok(!happened.includes("wcombmore"), "ten of a kind do not fold");
  const news = html.slice(html.indexOf('id="comb-news"'));
  assert.equal((news.match(/<li id="w-/g) ?? []).length, 10);
  // Sealed, it says so and carries no button.
  const sealed = wallSection(day(stories), "September 9", Date.parse("2026-09-12T00:00:00Z"), { comb: true, date: { month: 9, day: 9 } });
  assert.ok(sealed.includes("when the hive sealed") && sealed.includes("It takes no more."));
  assert.ok(!sealed.includes('action="/boost"'));
});

test("the comb ranks a kind by buzzes, then priority, then desks, and folds it past a dozen", () => {
  const stories: WallStory[] = [];
  for (let i = 0; i < 15; i++) stories.push(pooled(`aaaaaaaa-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`, "historical_event", 0, i === 3 ? 3 : 1));
  stories[7] = { ...stories[7]!, support: 2 };
  const ranked = combRank(stories, new Map());
  assert.equal(ranked[0]!.id, stories[7]!.id, "one buzz beats every priority");
  assert.equal(ranked[1]!.id, stories[3]!.id, "then the date's biggest history");
  const html = wallSection(day(stories), "September 9", LIVE, { comb: true, interactive: true, date: { month: 9, day: 9 } });
  const cells = html.match(/<li id="w-/g) ?? [];
  assert.equal(cells.length, 15, "every cell is on the page");
  assert.ok(html.includes("<summary>3 more cells</summary>"), "the rest fold under a count");
  assert.ok(html.indexOf(`id="w-${stories[7]!.id}"`) < html.indexOf(`id="w-${stories[3]!.id}"`));
  assert.ok(html.indexOf("<details class=\"wcombmore\">") < html.indexOf(`id="w-${stories[14]!.id}"`), "the last arrival is in the fold");
  // A buzzed cell glows by its share of the most buzzed of its kind.
  assert.ok(html.includes(`id="w-${stories[7]!.id}" class="wcell wc-happened wcbacked"`));
  assert.match(html, /--heat:1\.00/);
});

test("a date page draws only the pictures it shows", () => {
  const tile = story({ id: "aaaaaaaa-0000-0000-0000-000000000001", status: "placed" });
  const row = pooled("aaaaaaaa-0000-0000-0000-000000000002", null);
  const song = story({ id: "aaaaaaaa-0000-0000-0000-000000000003", status: "pool", rect: null, subjectKind: "song", subjectId: "1994-09-10" });
  const drawn = picturedSubjects(day([tile, row, song]));
  assert.ok(drawn.has(`story:${tile.id}`));
  assert.ok(!drawn.has("song:1994-09-10"), "the covers moved to the comb");
  assert.ok(!drawn.has(`story:${row.id}`), "a feed row draws no picture");
  // The comb draws its cells' pictures and the covers, and not the news.
  const combed = combPictured(day([tile, row, song]));
  assert.ok(combed.has("song:1994-09-10"));
  assert.ok(!combed.has(`story:${row.id}`), "a news picture is the publisher's and heavy");
});

test("every tile carries a kind mark: happened, born, song or news", () => {
  assert.equal(tileKind({ subjectKind: null }), "news");
  assert.equal(tileKind({ subjectKind: "person" }), "born");
  assert.equal(tileKind({ subjectKind: "song" }), "song");
  for (const kind of ["historical_event", "birth_fact", "cultural_event"]) assert.equal(tileKind({ subjectKind: kind }), "happened");
  const mark = kindMark("born");
  assert.ok(mark.includes('class="wkind wk-born"'));
  assert.ok(mark.includes('stroke-width="1.7"'), "one stroke weight, the bar's");
  assert.ok(mark.includes("Born on this date."), "a word for a screen reader");
  const s = story({ rect: { mx: 3, my: 5, w: 4, h: 3 }, subjectKind: "song", subjectId: "1994-09-10" });
  const html = wallSection(day([s]), "September 9");
  assert.ok(html.includes('class="wkind wk-song"'));
  assert.ok(html.indexOf("wk-song") < html.indexOf('class="wo"'), "the mark leads the footer");
});

test("a face is drawn only when its file is on disk, however the database feels about it", () => {
  const people = [{ qid: "Q1", name: "A", birthYear: 1970, deathYear: null, description: "x", monthlyViews: 1, hasImage: true }];
  assert.equal(picturesFor([], people).length, 1, "with no folder listed, the database is trusted");
  assert.equal(picturesFor([], people, new Set()).length, 0, "an empty folder draws no face");
  assert.deepEqual(picturesFor([], people, new Set(["Q1.jpg"])).map((p) => p.path), ["/faces/Q1.jpg"]);
});

test("the Undo button is inside the sentence that says a buzz counted, and a form is never put in a paragraph", () => {
  const s = story({ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" });
  const now = Date.parse("2026-09-09T18:00:00Z");
  const d = day([s]);

  // Without the story, the sentence carries no way back out of anything.
  const plain = wallSection(d, "September 9", now, { interactive: true, date: { month: 9, day: 9 } });
  assert.ok(!plain.includes("/unboost"), "no Undo on a page nobody just tapped on");

  const after = wallSection(d, "September 9", now, { interactive: true, date: { month: 9, day: 9 }, undo: s });
  assert.ok(after.includes('action="/unboost"'));
  assert.ok(after.includes(`<input type="hidden" name="s" value="${s.id}">`));

  // The bug this pins, found by rendering the page and looking at it. A form
  // is not permitted inside a paragraph, so a browser closes the paragraph
  // before the form: the Undo button ended up a sibling of the hidden
  // sentence rather than a child of it, which meant it was drawn on every
  // page, including pages nobody had tapped anything on. The sentence is a
  // div, and every element that carries a form has to be.
  const opened = after.slice(after.indexOf('id="wkept"'));
  const closed = opened.slice(0, opened.indexOf("</div>"));
  assert.ok(closed.includes("/unboost"), "the button is inside the element that is hidden until a buzz counts");
  assert.ok(!closed.includes("<p>That counts".replace("<p>", "<p class")), "the sentence itself is still a paragraph");
  for (const carrier of [after, renderStoryPage(s, d, now, { interactive: true, undo: s })]) {
    for (const match of carrier.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
      assert.ok(!match[1]!.includes("<form"), `a form inside a paragraph: ${match[0]!.slice(0, 90)}`);
    }
  }
});

test("the receipt draws its buzz control in an element the reader's mark can land on", () => {
  const s = story({ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" });
  const now = Date.parse("2026-09-09T18:00:00Z");
  const html = renderStoryPage(s, day([s]), now, { interactive: true });
  // wallMarks writes "#w-<id> .wmine{display:block}", so the control and the
  // mark have to be inside the element that carries that id. They were in a
  // paragraph with a form in it, which a browser splits, so the mark could
  // never appear on a receipt.
  const opened = html.slice(html.indexOf(`id="w-${s.id}"`));
  const block = opened.slice(0, opened.indexOf("</div>"));
  assert.ok(block.includes('class="wbuzz"'), "the control is inside it");
  assert.ok(block.includes('class="wmine"'), "and so is the mark the rule reveals");
  assert.ok(wallMarks({ left: 2, allowance: 3, backed: [s.id] }, day([s]), now).includes(`#w-${s.id} .wmine{display:block}`));
});

test("the anniversary is drawn to one browser, links to the receipt, and is never a number", () => {
  const now = Date.parse("2026-09-09T18:00:00Z");
  const d = day([story({ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", support: 4 })]);

  // Nobody's anniversary is drawn without one.
  const plain = wallSection(d, "September 9", now, { interactive: true, date: { month: 9, day: 9 } });
  assert.ok(!plain.includes("You were here"));

  const html = wallSection(d, "September 9", now, {
    interactive: true, date: { month: 9, day: 9 },
    anniversary: [
      { storyId: "11111111-1111-1111-1111-111111111111", headline: "What mattered last year", wallDate: "2025-09-09" },
      { storyId: "22222222-2222-2222-2222-222222222222", headline: "And the year before", wallDate: "2024-09-09" },
    ],
  });
  assert.ok(html.includes("You were here"));
  assert.ok(html.includes("You buzzed this, one year ago today"));
  assert.ok(html.includes("You buzzed this, two years ago today"));
  assert.ok(html.includes("What mattered last year"));
  // The link is to the story's own receipt under its own year's date, which
  // the build keeps after a newer wall takes the hive on the date page.
  assert.ok(html.includes('href="/september-9/wall/11111111-1111-1111-1111-111111111111/"'));
  assert.ok(html.includes("Only you can see this. It is on this browser and it is not a score."));

  // Sections 6 and 8 refuse every score, so nothing in the block carries a
  // count, a rank or a total. The only digits allowed are the ones inside
  // identifiers and addresses.
  const block = html.slice(html.indexOf('<section class="wanniv"'));
  const visible = block.slice(0, block.indexOf("</section>"))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
  assert.ok(!/\d/.test(visible), `a number reached the anniversary: ${visible}`);

  // A headline is the source's own wording, so it is escaped like every
  // other one on the page. This is why it is drawn here rather than written
  // into a style rule, where escapeHtml would not apply.
  const nasty = wallSection(d, "September 9", now, {
    interactive: true, date: { month: 9, day: 9 },
    anniversary: [{ storyId: "11111111-1111-1111-1111-111111111111", headline: '</style><script>x</script>"', wallDate: "2025-09-09" }],
  });
  assert.ok(!nasty.includes("<script>"), "a headline cannot close an element or open one");
  assert.ok(nasty.includes("&lt;/style&gt;"));
});

test("how long ago is counted in years, because that is the only span an anniversary has", () => {
  assert.equal(yearsAgo("2025-09-09", "2026-09-09"), "one year ago today");
  assert.equal(yearsAgo("2024-09-09", "2026-09-09"), "two years ago today");
  assert.equal(yearsAgo("2016-09-09", "2026-09-09"), "ten years ago today");
  // Past ten, numerals rather than a word this site does not have.
  assert.equal(yearsAgo("2015-09-09", "2026-09-09"), "11 years ago today");
  // The same year, and a future one, are not anniversaries and say nothing.
  assert.equal(yearsAgo("2026-09-09", "2026-09-09"), "");
  assert.equal(yearsAgo("2027-09-09", "2026-09-09"), "");
  // February 29 is an ordinary case here: the years subtract and the month
  // and day were already matched by the database.
  assert.equal(yearsAgo("2024-02-29", "2028-02-29"), "four years ago today");
});

test("the save link and the tier key are off while they say nothing", () => {
  // September 22, 2026: without pictures on the tiles the saved square
  // undersold the page, and every seeded story is claimed, so a key to three
  // colours explained one. The picture route still works; SAVE_PICTURE is
  // the switch that shows the link again.
  assert.equal(SAVE_PICTURE, false);
  const section = wallSection(day([story({ tier: "claimed" })]), "September 9", Date.parse("2026-09-09T20:00:00Z"), { date: { month: 9, day: 9 } });
  assert.ok(!section.includes("yours.png"), "no save link");
  assert.ok(!section.includes("wlegend"), "no key to one colour");
  assert.ok(!renderHivePage(day([story({ tier: "claimed" })]), 9, 9).includes("yours.png"));
  // The key comes back by itself the day a story rises above claimed.
  const mixed = wallSection(day([
    story({ tier: "claimed" }),
    story({ id: "aaaaaaaa-0000-0000-0000-00000000d002", tier: "reported", rect: { mx: 0, my: 0, w: 2, h: 1 } }),
  ]), "September 9", Date.parse("2026-09-09T20:00:00Z"), { date: { month: 9, day: 9 } });
  assert.ok(mixed.includes('class="wlegend"'));
  assert.ok(tiersDiffer([{ tier: "claimed" }, { tier: "reported" }]));
  assert.ok(!tiersDiffer([{ tier: "claimed" }, { tier: "claimed" }]));
});

// Hindsight, docs/the-wall.md section 23. The sealed board never changes;
// a verdict written on the anniversary marks a tile and adds one line.
test("a sealed board with no outcomes is drawn exactly as it was, and a verdict marks the tile and adds one line", () => {
  const sealedAt = Date.parse("2027-09-10T00:00:00Z");
  const plain = wallSection(day([story()]), "September 9", sealedAt);
  assert.ok(!plain.includes("whindsight") && !plain.includes("wheld") && !plain.includes("wforgot"), "nothing before the first anniversary");

  const held = story({ outcomes: [{ anniversary: 1, outcome: "held", note: "Buzzed again on the hive for 2027-09-09.", recordedAt: "2027-09-09T05:00:00Z" }] });
  const forgot = story({ id: "22222222-2222-3333-4444-555555555555", rect: { mx: 10, my: 7, w: 2, h: 1 }, support: 2, outcomes: [{ anniversary: 1, outcome: "forgotten", note: null, recordedAt: "2027-09-09T05:00:00Z" }] });
  const shownFalse = story({ id: "33333333-2222-3333-4444-555555555555", rect: { mx: 12, my: 7, w: 2, h: 1 }, status: "false", falseAt: "2026-09-10T00:00:00Z", outcomes: [{ anniversary: 1, outcome: "false", note: null, recordedAt: "2027-09-09T05:00:00Z" }] });
  const html = wallSection(day([held, forgot, shownFalse]), "September 9", sealedAt);
  assert.ok(html.includes('<span class="wstamp wheld"'), "held is marked");
  assert.ok(html.includes('<span class="wstamp wforgot"'), "forgotten is marked");
  assert.ok(html.includes('<span class="wstamp">Shown false</span>'), "the checker's stamp stands");
  assert.ok(html.includes("One year on: one held, one was shown false, one forgotten."), "and the line counts them");
  assert.ok(html.includes("The board is as it sealed. The marks are what happened since."));

  // The latest anniversary is the one counted, and an open day draws no line however it aged.
  assert.equal(hindsightLine({ stories: [story({ outcomes: [{ anniversary: 1, outcome: "forgotten", note: null, recordedAt: "" }, { anniversary: 5, outcome: "held", note: null, recordedAt: "" }] })] }), "Five years on: one held.");
  assert.equal(latestOutcome(story())?.outcome, undefined);
  assert.equal(outcomeStamp(story({ outcomes: [{ anniversary: 1, outcome: "false", note: null, recordedAt: "" }] })), "", "a false verdict without the stamp draws nothing rather than a second word for it");
  assert.equal(hindsightLine({ stories: [story({ status: "pool", rect: null, outcomes: [{ anniversary: 1, outcome: "held", note: null, recordedAt: "" }] })] }), null, "a story that never left the pool is not counted");
});


// ---------------------------------------------------------------------------
// The private record. docs/the-wall.md section 25.
// ---------------------------------------------------------------------------

test("where a story on the record stands is one word, and a later fact replaces an earlier one", () => {
  // The ladder, from the bottom up.
  assert.equal(recordStanding({ sealed: false, status: "pool", outcome: null }), "Open");
  assert.equal(recordStanding({ sealed: true, status: "pool", outcome: null }), "In the pool");
  assert.equal(recordStanding({ sealed: true, status: "overflow", outcome: null }), "In the pool");
  assert.equal(recordStanding({ sealed: true, status: "placed", outcome: null }), "On the board");
  // The anniversary's verdict is the newer fact about the same story, so it
  // takes the line rather than sitting beside the board's answer.
  assert.equal(recordStanding({ sealed: true, status: "placed", outcome: "held" }), "Held");
  assert.equal(recordStanding({ sealed: true, status: "placed", outcome: "forgotten" }), "Forgotten");
  // Shown false comes before everything: a story stamped false takes no more
  // buzzes whether its date has sealed or not.
  assert.equal(recordStanding({ sealed: false, status: "false", outcome: null }), "Shown false");
  assert.equal(recordStanding({ sealed: true, status: "placed", outcome: "false" }), "Shown false");
  // Every word here is about the story. None of them is about the reader.
  for (const word of ["Open", "In the pool", "On the board", "Held", "Forgotten", "Shown false"]) {
    assert.ok(!/\byou\b|\byour\b/i.test(word), word);
  }
});

test("the way to the record is drawn for a browser that has buzzed something and for no other", () => {
  assert.equal(yoursLine(false, BEE), "");
  assert.equal(yoursLine(undefined, BEE), "");
  const line = yoursLine(true, BEE);
  assert.ok(line.includes('href="/yours/"'));
  assert.ok(line.includes("buzzed"), "the hive's own word");
  assert.ok(!line.includes("not a score"), "said on the record page itself, not here");
  // A number in front of the page would be the thing the page refuses, one
  // step earlier. docs/the-wall.md section 25.
  assert.ok(!/\d/.test(line), `no number belongs on this line: ${line}`);
  // The solemn voice says it its own way, the way every other sentence does.
  assert.ok(yoursLine(true, PLAIN).includes("backed"));
});

test("a hive draws the way to the record only when it is asked to", () => {
  const d = day([story()]);
  assert.ok(!wallSection(d, "September 9", LIVE_NOW).includes('href="/yours/"'));
  assert.ok(wallSection(d, "September 9", LIVE_NOW, { yours: true }).includes('href="/yours/"'));
  assert.ok(wallSection(d, "September 9", LIVE_NOW, { hive: true, yours: true }).includes('href="/yours/"'));
});

// ---------------------------------------------------------------------------
// The type on a tile, fitted to its box and its sentence.
//
// The numbers below come from the real board for September 21, 2026,
// rendered and measured rather than imagined: eleven tiles, a 645 pixel
// board, a module of 40.3 pixels. Before this the type scaled with width
// alone and the line budget came from height alone, and the board showed
// both halves of that: a sixteen by three tile with its third line sliced
// through the middle under the footer, and a ten by seven tile with a short
// sentence at the top and the bottom half empty.
// ---------------------------------------------------------------------------

test("a wide short tile is not given more lines than its height holds", () => {
  // The 1993 tile: sixteen wide, three tall, a 106 character sentence. It is
  // the one that was sliced in half.
  const wide = fitType(16, 3, 106);
  assert.equal(wide.lines, 3);
  assert.ok(wide.lines * 1.2 * wide.fit * 0.38 <= 3, "three lines of this size fit in three modules");
});

test("a big tile holding a short sentence sets it large rather than leaving the tile empty", () => {
  // The 1784 tile: ten by seven, 122 characters, and it used to fill a third
  // of its own box.
  const big = fitType(10, 7, 122);
  const small = fitType(4, 3, 122);
  assert.ok(big.fit > 1.8, `a ten by seven tile sets its type large, got ${big.fit}`);
  assert.ok(big.fit > small.fit * 2, "and much larger than the same sentence in a four by three");
  // The same tile with three words in it is larger still, up to the ceiling.
  assert.ok(fitType(10, 7, 20).fit >= big.fit);
  assert.ok(fitType(16, 16, 12).fit <= 3, "and never past the ceiling");
});

test("nothing is ever set below the floor, and a sentence too long for its tile keeps whole lines", () => {
  // The 2001 tile: four by three, 155 characters. No size fits the whole
  // sentence, so it takes the floor and as many whole lines as the box has.
  const over = fitType(4, 3, 155);
  assert.equal(over.fit, 0.85);
  assert.ok(over.lines >= 4 && over.lines <= 6, `whole lines only, got ${over.lines}`);
  assert.ok(over.lines * 1.2 * over.fit * 0.38 <= 3);
  // A tile of any shape answers, and always with at least one line.
  for (let w = 3; w <= 16; w++) {
    for (let h = 2; h <= 16; h++) {
      for (const length of [12, 60, 122, 300]) {
        const got = fitType(w, h, length);
        assert.ok(got.lines >= 1, `${w}x${h} ${length}`);
        assert.ok(got.fit >= 0.85 && got.fit <= 3, `${w}x${h} ${length} fit ${got.fit}`);
        // The whole point: the lines it asks for fit in the room it has.
        assert.ok(got.lines * 1.2 * got.fit * 0.38 <= h, `${w}x${h} ${length} overflows`);
      }
    }
  }
});

test("a tile carries its size and its line budget, and the headline can never push the footer out", () => {
  const s = story({ rect: { mx: 0, my: 0, w: 16, h: 3 }, headline: "1993: A Transair Georgian Airlines Tu-134 is shot down by a missile in the Black Sea near Sokhumi, Georgia." });
  const html = wallSection(day([s]), "September 21", LIVE_NOW, { hive: true });
  assert.match(html, /--lines:3;--fit:[0-9.]+;/);
  // The two rules that hold whatever the arithmetic gets wrong.
  assert.ok(WALL_STYLE.includes("max-height: calc(var(--lines, 3) * 1.2em)"));
  assert.ok(WALL_STYLE.includes("flex: 1 1 auto; min-height: 0;"));
  // And the guess these replaced is gone.
  assert.ok(!WALL_STYLE.includes("--more"), "the container query that added a line is retired");
});

// ---------------------------------------------------------------------------
// The mural's ordinary tile. docs/the-wall.md section 27.
// ---------------------------------------------------------------------------

test("a tile knows the one word it can always say, which is its year", () => {
  // The three shapes the seeders write, and nothing else is guessed at.
  assert.equal(tileYear("1993: A Transair Georgian Airlines Tu-134 is shot down by a missile."), "1993");
  assert.equal(tileYear("2015: A rat dragged a slice of pizza down the stairs."), "2015");
  assert.equal(tileYear("Luke Wilson, American actor, born 1971"), "1971");
  assert.equal(tileYear("Michael Jackson, American singer, 1958 to 2009"), "1958", "a life gives the year it began");
  assert.equal(tileYear("1784: the Pennsylvania Packet began publishing"), "1784");
  // And the shapes that have no year to be sure of.
  assert.equal(tileYear("Apple's clever software lets iPhone batteries skirt shipping limits"), null);
  assert.equal(tileYear("The Mac Mini is still mighty, just not as cheap"), null);
  assert.equal(tileYear("A headline mentioning 1998 in the middle of it"), null, "a year in passing is not the date's year");
  assert.equal(tileYear(""), null);
});

test("a small tile draws the start of its headline, and carries its year for a board too narrow for words", () => {
  const small = story({ rect: { mx: 0, my: 0, w: 2, h: 2 }, support: 0, headline: "1862: Taiping Rebellion: The Ever Victorious Army defeats Taiping forces at the Battle of Cixi." });
  const html = wallSection(day([small]), "September 21", LIVE_NOW, { hive: true });
  // The headline, which the stylesheet clamps, the way the live hive's small
  // tiles read it. Nathan, September 22, 2026: a bare year tells a reader
  // nothing.
  assert.ok(html.includes('class="wh wsh">1862: Taiping Rebellion'), "a small tile draws its headline");
  // And the year, for a phone, where a two module tile is forty pixels and
  // the old rule that a year reads at any size is still right.
  assert.ok(html.includes('class="wyr">1862<'), "the year, which reads at any size");
  // It is still the whole of what a screen reader and a hover are handed,
  // and the receipt is one tap away.
  assert.match(html, /aria-label="1862: Taiping Rebellion/);
  assert.match(html, /href="\/september-9\/wall\//);
  // A story with no year falls back to what the tile said before.
  const newsy = story({ rect: { mx: 0, my: 0, w: 2, h: 2 }, outlet: "theverge.com", headline: "The Mac Mini is still mighty, just not as cheap" });
  const newsHtml = wallSection(day([newsy]), "September 21", LIVE_NOW, { hive: true });
  assert.ok(newsHtml.includes('class="wyr">theverge.com<'));
  assert.ok(newsHtml.includes("wnoyr"), "and says so, so the stylesheet can set it smaller");
});

test("a pictured small tile is the picture and nothing else", () => {
  // Which tiles have a picture is known only to the rules pictureRules
  // writes, so the year is always drawn and hidden there.
  const rules = pictureRules([{ subject: "person:Q39829", path: "/faces/Q39829.jpg" }]);
  assert.ok(rules.includes('.wtile.small[data-subject="person:Q39829"] .wyr'));
  assert.ok(rules.includes("{display:none}"));
  assert.ok(rules.includes('--pic:url("/faces/Q39829.jpg")'));
});

// docs/the-wall.md section 28.
test("four desks filing one story are one feed row, naming the other three", () => {
  const base = { status: "pool" as const, rect: null, placedAt: null, support: 0, priority: 0 };
  const desks = [
    story({ ...base, id: "cccccccc-0000-0000-0000-000000000001", outlet: "aljazeera.com", headline: "Sri Lanka court convicts 14 over deadly Easter bombings" }),
    story({ ...base, id: "cccccccc-0000-0000-0000-000000000002", outlet: "bbc.com", headline: "Sri Lanka court convicts 15 men over deadly Easter Sunday bombings" }),
    story({ ...base, id: "cccccccc-0000-0000-0000-000000000003", outlet: "npr.org", headline: "Sri Lanka court convicts 15 over deadly 2019 Easter bombings" }),
  ];
  const html = wallSection(day(desks), "September 9");
  assert.equal((html.match(/Sri Lanka court convicts/g) ?? []).length, 1, "one row, not three");
  assert.ok(html.includes("Sri Lanka court convicts 14 over deadly Easter bombings"), "the shortest telling is the row");
  assert.ok(html.includes("with bbc.com and npr.org"), "the other desks are named");
  assert.equal((html.match(/class="walso"/g) ?? []).length, 1);
});

test("a story one desk carried says nothing about other desks", () => {
  const alone = story({ status: "pool", rect: null, placedAt: null, support: 0, priority: 0, outlet: "espn.com", headline: "Early bets for Week 3: Three games to target right away" });
  const html = wallSection(day([alone]), "September 9");
  assert.ok(html.includes("Early bets for Week 3"));
  assert.ok(!html.includes("walso"));
});

test("a buzz already spent is never folded into somebody else's row", () => {
  const base = { status: "pool" as const, rect: null, placedAt: null, priority: 0 };
  const backed = story({ ...base, id: "dddddddd-0000-0000-0000-000000000001", support: 2, outlet: "bbc.com", headline: "Sri Lanka court convicts 15 men over deadly Easter Sunday bombings" });
  const other = story({ ...base, id: "dddddddd-0000-0000-0000-000000000002", support: 0, outlet: "npr.org", headline: "Sri Lanka court convicts 15 over deadly 2019 Easter bombings" });
  const html = wallSection(day([backed, other]), "September 9");
  assert.ok(html.includes("Sri Lanka court convicts 15 men over deadly Easter Sunday bombings"), "the backed row keeps its own button");
  assert.equal((html.match(/Sri Lanka court convicts/g) ?? []).length, 2, "both rows are drawn");
});

test("a feed row says nothing about the lowest tier and names every tier above it", () => {
  const claimed = story({ id: "aaaaaaaa-0000-0000-0000-00000000c001", status: "pool", rect: null, placedAt: null, support: 0, tier: "claimed", headline: "1975: A claimed row" });
  const reported = story({ id: "aaaaaaaa-0000-0000-0000-00000000c002", status: "pool", rect: null, placedAt: null, support: 0, tier: "reported", headline: "A reported row" });
  const html = wallSection(day([claimed, reported]), "September 9");
  const rowOf = (id: string): string => { const i = html.indexOf(`<li id="w-${id}"`); assert.ok(i >= 0, id); return html.slice(i, html.indexOf("</li>", i)); };
  assert.ok(!rowOf(claimed.id).includes("wchip"), "every seeded story is claimed, so the chip said nothing");
  assert.ok(rowOf(reported.id).includes('<span class="wchip w-reported">Reported</span>'));
  // And the dated row carries its year for the reader's age.
  assert.ok(rowOf(claimed.id).includes(' data-y="1975"'));
  assert.ok(!rowOf(reported.id).includes("data-y"));
});

test("only a headline that opens with a year carries one", () => {
  assert.equal(yearAttr("1975: Sara Jane Moore tries to shoot the President"), ' data-y="1975"');
  assert.equal(yearAttr("476: The last emperor in the West is deposed"), ' data-y="476"');
  assert.equal(yearAttr("How Trump's media ban sparked a broadcaster boycott"), "");
  assert.equal(yearAttr("Tatiana Maslany, Canadian actress, born 1985"), "");
  assert.equal(yearAttr("10000 people march"), "");
});

test("an open hive links the other two open hives, and marks the one being read", () => {
  // Noon Eastern on September 22, 2026: yesterday is the 21st, tomorrow the 23rd.
  const now = Date.parse("2026-09-22T16:00:00Z");
  const today = hiveDaysNav(9, 22, now);
  assert.ok(today.includes('<a class="wday" href="/september-21/hive/"><b>Yesterday</b> Sep 21</a>'));
  assert.ok(today.includes('<span class="wday here" aria-current="page"><b>Today</b> Sep 22</span>'));
  assert.ok(today.includes('<a class="wday" href="/september-23/hive/"><b>Tomorrow</b> Sep 23</a>'));
  // From yesterday's hive the other two are links, and yesterday is marked.
  const yesterday = hiveDaysNav(9, 21, now);
  assert.ok(yesterday.includes('<span class="wday here" aria-current="page"><b>Yesterday</b> Sep 21</span>'));
  assert.ok(yesterday.includes('href="/september-22/hive/"') && yesterday.includes('href="/september-23/hive/"'));
  // Across a month end.
  const oct = hiveDaysNav(10, 1, Date.parse("2026-10-01T16:00:00Z"));
  assert.ok(oct.includes('href="/september-30/hive/"') && oct.includes('href="/october-2/hive/"'));
});

test("a receipt can be sent on, and leads to the rest of its hive", () => {
  const a = story({ id: "aaaaaaaa-0000-0000-0000-000000000001", headline: "The one being read", support: 0 });
  const b = story({ id: "aaaaaaaa-0000-0000-0000-000000000002", headline: "Buzzed <twice>", support: 2 });
  const c = story({ id: "aaaaaaaa-0000-0000-0000-000000000003", headline: "Nobody yet", support: 0 });
  const html = renderStoryPage(a, day([a, b, c]));
  assert.ok(html.includes('class="sharebox"'));
  assert.ok(html.includes(`data-url="https://birthed.app/september-9/wall/${a.id}/"`), "the address shared is the receipt's own");
  assert.ok(html.includes("More from the hive for"));
  assert.ok(html.indexOf("Buzzed &lt;twice&gt;") < html.indexOf("Nobody yet"), "most buzzed first, and escaped");
  assert.ok(!html.slice(html.indexOf("More from the hive")).includes(">The one being read<"), "never the story itself");
  // A hive of one has nothing more to show.
  assert.ok(!renderStoryPage(a, day([a])).includes("More from the hive"));
});

test("a sealed board says what it sealed with, and why an older one is small", () => {
  // September 20, 2026 sealed before the board grew, with nobody buzzing.
  const old = { closesAt: "2026-09-22T04:00:00Z", closedAt: null };
  const eight = Array.from({ length: 8 }, () => ({ support: 0 }));
  const line = sealedLine(old, eight, BEE);
  assert.ok(line.startsWith("Nobody buzzed this hive before it sealed, so the board is the 8 stories it opened with."));
  assert.ok(line.includes("Hives that sealed before September 22, 2026 put at most eight stories nobody had buzzed on the board"));
  // A later hive with buzzes on it says how many, and nothing about the old rule.
  const later = { closesAt: "2026-09-24T04:00:00Z", closedAt: null };
  const board = [{ support: 2 }, { support: 1 }, ...Array.from({ length: 40 }, () => ({ support: 0 }))];
  assert.equal(sealedLine(later, board, BEE), "It sealed with 3 buzzes on 2 stories, and those are the biggest tiles.");
  // And it is drawn under a sealed board, not an open one.
  const s = story({ support: 0 });
  const sealed = wallSection(day([s]), "September 9", Date.parse("2026-09-12T00:00:00Z"));
  assert.ok(sealed.includes("Nobody buzzed this hive before it sealed"));
  assert.ok(!wallSection(day([s]), "September 9", Date.parse("2026-09-09T20:00:00Z")).includes("before it sealed, so the board"));
});

test("a number one on the board stays in the song strip, pointing at its tile", () => {
  const onBoard = story({ id: "aaaaaaaa-0000-0000-0000-00000000a980", headline: "1980: \"Upside Down\" by Diana Ross was the number one song", subjectKind: "song", subjectId: "1980-09-27", status: "placed", support: 1 });
  const pooled = story({ id: "aaaaaaaa-0000-0000-0000-00000000a981", headline: "1981: \"Endless Love\" by Diana Ross and Lionel Richie was the number one song", subjectKind: "song", subjectId: "1981-09-26", status: "pool", rect: null, support: 0 });
  const html = wallSection(day([onBoard, pooled]), "September 9", Date.parse("2026-09-09T20:00:00Z"), { comb: true });
  const strip = html.slice(html.indexOf('<ul class="wsongs">'));
  assert.ok(strip.includes('id="1980"'), "1980 is still a row in the strip");
  assert.ok(strip.includes(`href="/september-9/#w-${onBoard.id}"`), "and it points at its tile, on the date page");
  assert.equal((html.match(new RegExp(`id="w-${onBoard.id}"`, "g")) ?? []).length, 0, "the tile keeps the one id, on the date page");
  assert.ok(strip.includes('id="1981"'));
});
