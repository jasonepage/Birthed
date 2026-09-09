import { strict as assert } from "node:assert";
import { test } from "node:test";

import { renderDayPage, renderStoryPage } from "../src/render.js";
import {
  fetchWall, newestByDate, storyPath, tierLabel, wallSection, type WallDay, type WallStory,
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
  assert.ok(html.includes("40 boosts"));
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
  assert.ok(html.includes("12 boosts"));
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
