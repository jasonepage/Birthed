import { strict as assert } from "node:assert";
import { test } from "node:test";

import { renderDayPage, renderStoryPage } from "../src/render.js";
import {
  BEE, PLAIN, PLAIN_DATES, allowanceOn, fetchWall, newestByDate, storyPath, takingBoosts, tapsLeftSentence, tierLabel, units,
  voiceFor, wallMarks, wallSection, type WallDay, type WallStory,
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

test("a date page without a wall is the page it was", () => {
  const html = renderDayPage(PAGE);
  assert.ok(!html.includes('class="wall"'));
  assert.ok(!html.includes("The wall for"));
});

test("a tile sits at its stored anchor and size, and links to its receipt", () => {
  const s = story({ rect: { mx: 3, my: 5, w: 4, h: 3 }, support: 40 });
  const html = wallSection(day([s]), "September 9", Date.parse("2026-09-09T20:00:00Z"));
  assert.ok(html.includes("grid-column:4 / span 4;grid-row:6 / span 3"));
  assert.ok(html.includes(`href="${storyPath(s)}"`));
  assert.ok(html.includes("Council approves the river crossing"));
  assert.ok(html.includes("example.org"));
  assert.ok(html.includes("40 buzzes"));
  assert.ok(html.includes(">Reported<"));
  assert.ok(html.includes("Open. Closes at midnight Eastern ending September 10, 2026"));
});

test("a closed wall says it is permanent", () => {
  const html = wallSection(day([story()]), "September 9", Date.parse("2026-09-12T00:00:00Z"));
  assert.ok(html.includes("Closed at midnight Eastern ending September 10, 2026. This wall is permanent."));
});

test("the pool and the overflow are listed under the square and labelled as not on the wall", () => {
  const pooled = story({ id: "aaaaaaaa-0000-0000-0000-000000000001", status: "pool", rect: null, placedAt: null, support: 0, headline: "A pooled story nobody backed" });
  const spilled = story({ id: "aaaaaaaa-0000-0000-0000-000000000002", status: "overflow", rect: null, headline: "A story the square had no room for" });
  const html = wallSection(day([story(), pooled, spilled]), "September 9");
  assert.ok(html.includes("In the pool, not on the wall"));
  assert.ok(html.includes("A pooled story nobody backed"));
  assert.ok(html.includes("Earned a place, found no room, not on the wall"));
  assert.ok(html.includes("A story the square had no room for"));
  // Neither is drawn as a tile.
  assert.equal((html.match(/class="wtile/g) ?? []).length, 1);
});

test("a story shown false keeps its rectangle and is stamped", () => {
  const stamped = story({ status: "false", falseAt: "2026-09-10T10:00:00Z", falseNote: "The outlet corrected the vote count." });
  const html = wallSection(day([stamped]), "September 9");
  assert.ok(html.includes("grid-column:9 / span 2;grid-row:8 / span 1"));
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

test("the date page draws the wall above the rest of the page", () => {
  const s = story();
  const html = renderDayPage(PAGE, [], [], [], [], null, new Map(), new Map(), day([s]));
  const wallAt = html.indexOf('class="wall"');
  const everydayAt = html.indexOf('class="everyday"');
  assert.ok(wallAt > 0 && wallAt < everydayAt);
  assert.ok(html.includes("The wall for September 9, 2026"));
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
  assert.ok(live.includes("Buzz the stories you think will still matter about September 9"));
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
  assert.ok(early.includes("Buzzing starts when the date arrives"));
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
// The wall leads the page, decided September 10, 2026
// ---------------------------------------------------------------------------

import { restSummary } from "../src/render.js";

test("the wall leads the date page, and the imported history is folded under it with its counts", () => {
  const s = story({ rect: { mx: 3, my: 5, w: 4, h: 3 } });
  const people = [1, 2, 3].map((n) => ({ qid: `Q${n}`, name: `Person ${n}`, birthYear: 1950 + n, deathYear: null, description: "did things", monthlyViews: 100 }));
  const html = renderDayPage({ month: 9, day: 9, people }, [], [], [], [], null, new Map(), new Map(), day([s]));
  const h1 = html.indexOf("<h1>September 9</h1>");
  const wallAt = html.indexOf('class="wall"');
  const rememberAt = html.indexOf('class="remember"');
  const restAt = html.indexOf('<details class="rest">');
  const peopleAt = html.indexOf('class="section">Who shares it');
  assert.ok(h1 > 0 && h1 < wallAt, "the name, then the wall");
  assert.ok(wallAt < rememberAt, "the wall before the remembrance question");
  assert.ok(rememberAt < restAt, "the remembrance question before the folded history");
  assert.ok(restAt < peopleAt, "the people are inside the fold");
  assert.ok(html.indexOf("</details>") > peopleAt, "and the fold closes after them");
  assert.ok(html.includes("<summary>The rest of September 9: 3 people born on it.</summary>"));
  // The remembrance copy itself is untouched.
  assert.ok(html.includes('class="sen senopen">Everything below happened on this date. Say which ones you <b>remember</b>.'));
});

test("the summary line counts what is inside, in the order the page draws it", () => {
  assert.equal(restSummary("September 9", 45, 12, 67, 60), "The rest of September 9: 45 things that happened, 12 releases, the number one song in 67 years, and 60 people born on it.");
  assert.equal(restSummary("September 9", 1, 0, 0, 1), "The rest of September 9: 1 thing that happened, and 1 person born on it.");
  assert.equal(restSummary("September 9", 0, 0, 0, 0), "The rest of September 9");
});
