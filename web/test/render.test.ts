import test from "node:test";
import assert from "node:assert/strict";
import { ASK_SLOTS, FIRST_CHART_YEAR, askCandidates, renderDayPage, renderCalendarPage, renderCombPage, renderHivePage, renderRecord, renderRobots, renderSitemap, escapeHtml, isReady, renderMePanel, meMarker, withMe, stripCss} from "../src/render.js";
import type { RecordRow } from "../src/wall.js";
import { everyDate, neighbours, slug } from "../src/model.js";

const page = {
  month: 9,
  day: 4,
  people: [
    { qid: "Q1", name: "Anton Bruckner", birthYear: 1824, deathYear: 1896, description: "Austrian composer", monthlyViews: 4200 },
    { qid: "Q2", name: "Hildur \"Test\" <script>", birthYear: 1982, deathYear: null, description: null, monthlyViews: 0 },
  ],
};

test("the page names the date in the title and the heading", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes("<title>Born on September 4</title>"));
  assert.ok(html.includes("<h1>September 4</h1>"));
  assert.ok(!html.includes("2 notable people"), "the row count is not the number of people who share a date");
  // The summary sentence that used to sit under the heading is deliberately
  // not there. It told a reader what the heading already told them, in the
  // one rhythm that reads as machine written.
  assert.ok(!html.includes("Everything that was true about September 4:"));
  // The search result still gets a sentence of its own. This fixture has no
  // facts and no songs, so it is the plain one.
  assert.match(html, /<meta name="description" content="Who was born on September 4\.">/);
});

test("the page does not lead with the list of names", () => {
  // The regression this guards is not cosmetic. The list is ordered by
  // notability_score, which is attention, and infamy is attention, so leading
  // with it put Ted Bundy at the top of November 24 and a serial killer or a
  // dictator at the top of four other dates. The data screen in
  // 20260906240000 catches the ones whose description says what they did, and
  // Wikidata calls Bashar al-Assad a politician, so the ordering must not be
  // the first thing on the page even when the screen is working.
  const html = renderDayPage(page, [], [
    { id: "t", month: 9, day: 4, fact: "Something sourced happened.", category: "event",
      sourceUrl: "https://example.org/september-4" },
  ]);
  // One list now: what happened, then who was born. The people are rows in
  // the same feed, after the events, never the first thing.
  const people = html.indexOf('id="r-person-');
  const happened = html.indexOf('id="r-birth_fact-t"');
  assert.ok(people > 0, "the people are still on the page");
  assert.ok(happened > 0, "the timeline is still on the page");
  assert.ok(happened < people, "what happened on the date comes before who was born on it");
});

test("the lede never claims the list is ranked by attention", () => {
  const html = renderDayPage(page);
  assert.ok(!html.includes("most looked up"));
});

test("a name from the data cannot inject markup", () => {
  const html = renderDayPage(page);
  assert.ok(!html.includes("<script>Hildur"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(escapeHtml(`<a href="x">&</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
});

test("the year column carries the birth year and nothing that could wrap", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes('<span class="fyr">1824</span>'));
  assert.ok(html.includes('<span class="fyr">1982</span>'));
  assert.ok(!html.includes("1824 to 1896"), "a range in the column pushes every name out of line");
});

test("a death year is shown, just not in the aligned column", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes("died 1896"));
});

test("every page links to the day before and the day after", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes('href="/september-3/"'));
  assert.ok(html.includes('href="/september-5/"'));
});

test("the year wraps at both ends", () => {
  assert.deepEqual(neighbours(1, 1).previous, { month: 12, day: 31 });
  assert.deepEqual(neighbours(12, 31).next, { month: 1, day: 1 });
});

test("February 29 has a page", () => {
  assert.equal(slug(2, 29), "february-29");
  assert.equal(everyDate().length, 366);
});

test("the page carries structured data a search engine can read", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes('<script type="application/ld+json">'));
  assert.ok(html.includes('"@type":"ItemList"'));
  assert.ok(html.includes('"sameAs":"https://www.wikidata.org/wiki/Q1"'));
});

test("an empty date says so rather than rendering a blank list", () => {
  const html = renderDayPage({ month: 3, day: 3, people: [] });
  assert.ok(html.includes("Nobody imported for this date yet."));
  assert.ok(!html.includes("<ol>"));
});

test("the sitemap lists the front door, support, privacy and all 366 dates", () => {
  const xml = renderSitemap();
  assert.equal((xml.match(/<loc>/g) ?? []).length, 369);
  assert.ok(xml.includes("https://birthed.app/privacy/"));
  assert.ok(xml.includes("https://birthed.app/february-29/"));
});


import { renderShareCard } from "../src/share.js";

test("every page points at its own share image", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes('<meta property="og:image" content="https://birthed.app/og/september-4.png">'));
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
});

test("a date with a hive offers the square to a link preview, and every other date the wide card", () => {
  const story = {
    id: "11111111-2222-3333-4444-555555555555", wallDate: "2026-09-04", submittedAt: "2026-09-04T05:00:00Z",
    headline: "1998: Google is founded", url: "https://en.wikipedia.org/wiki/September_4", outlet: "en.wikipedia.org",
    status: "placed" as const, tier: "claimed" as const, support: 0, priority: 1, placedAt: "2026-09-04T05:15:00Z",
    rect: { mx: 4, my: 4, w: 4, h: 3 }, falseAt: null, falseNote: null, subjectKind: null, subjectId: null, sources: [],
  };
  const day = { wallDate: "2026-09-04", year: 2026, month: 9, day: 4, opensAt: "2026-09-03T04:00:00Z", liveAt: "2026-09-04T04:00:00Z", closesAt: "2026-09-06T04:00:00Z", closedAt: "2026-09-06T04:00:00Z", stories: [story] };

  // Before: every date, hive or no hive, offered the same wide card.
  const plain = renderDayPage(page);
  assert.ok(plain.includes('<meta property="og:image" content="https://birthed.app/og/september-4.png">'));
  assert.ok(plain.includes('<meta property="og:image:width" content="1200">'));
  assert.ok(plain.includes('<meta property="og:image:height" content="630">'));

  // After, on a date whose board has tiles on it.
  const hived = renderDayPage(page, [], [], [], [], null, new Map(), new Map(), day);
  assert.ok(hived.includes('<meta property="og:image" content="https://birthed.app/og/september-4-square.png">'));
  assert.ok(hived.includes('<meta property="og:image:width" content="1080">'));
  assert.ok(hived.includes('<meta property="og:image:height" content="1080">'));
  assert.ok(hived.includes('<meta name="twitter:image" content="https://birthed.app/og/september-4-square.png">'));

  // A hive row with nothing placed on it is not a hive to show.
  const bare = renderDayPage(page, [], [], [], [], null, new Map(), new Map(), { ...day, stories: [] });
  assert.ok(bare.includes('<meta property="og:image" content="https://birthed.app/og/september-4.png">'));
});

test("the square's side is the same number in the card and in the head", () => {
  // render.ts keeps its own copy, because share.ts already imports render.ts
  // and importing back makes a cycle around a constant read at module load.
  const hived = renderDayPage(page, [], [], [], [], null, new Map(), new Map(), {
    wallDate: "2026-09-04", year: 2026, month: 9, day: 4, opensAt: "2026-09-03T04:00:00Z",
    liveAt: "2026-09-04T04:00:00Z", closesAt: "2026-09-06T04:00:00Z", closedAt: null,
    stories: [{
      id: "11111111-2222-3333-4444-555555555555", wallDate: "2026-09-04", submittedAt: "2026-09-04T05:00:00Z",
      headline: "1998: Google is founded", url: "https://x.test/a", outlet: "x.test", status: "placed" as const,
      tier: "claimed" as const, support: 0, priority: 1, placedAt: "2026-09-04T05:15:00Z",
      rect: { mx: 4, my: 4, w: 4, h: 3 }, falseAt: null, falseNote: null, subjectKind: null, subjectId: null, sources: [],
    }],
  });
  assert.ok(hived.includes(`<meta property="og:image:width" content="${SQUARE_SIDE}">`));
});

test("the share card carries the date and the first three names", () => {
  const card = renderShareCard(page);
  assert.ok(card.includes("September 4"));
  assert.ok(card.includes("Anton Bruckner"));
});

test("a name on the card cannot inject markup either", () => {
  const card = renderShareCard(page);
  assert.ok(!card.includes("<script>Hildur"));
  assert.ok(card.includes("&lt;script&gt;"));
});

test("a date with a hive gets a card that draws the board, with its covers", () => {
  const story = {
    id: "11111111-2222-3333-4444-555555555555", wallDate: "2026-09-04", submittedAt: "2026-09-04T05:00:00Z",
    headline: "1998: Google is founded", url: "https://en.wikipedia.org/wiki/September_4", outlet: "en.wikipedia.org",
    status: "placed" as const, tier: "claimed" as const, support: 2, priority: 1, placedAt: "2026-09-04T05:15:00Z",
    rect: { mx: 4, my: 4, w: 4, h: 3 }, falseAt: null, falseNote: null, subjectKind: "song", subjectId: "2007-09-08", sources: [],
  };
  const day = { wallDate: "2026-09-04", year: 2026, month: 9, day: 4, opensAt: "2026-09-03T04:00:00Z", liveAt: "2026-09-04T04:00:00Z", closesAt: "2026-09-06T04:00:00Z", closedAt: "2026-09-06T04:00:00Z", stories: [story] };
  const card = renderShareCard(page, null, { day, pictures: new Map([["song:2007-09-08", "file:///static/covers/abc.jpg"]]) });
  assert.ok(card.includes("The hive for"));
  assert.ok(card.includes("September 4"));
  assert.ok(card.includes("1998: Google is founded"));
  assert.ok(card.includes("url(&quot;file:///static/covers/abc.jpg&quot;)"), "the cover is on the tile, quoted so the style attribute survives it");
  assert.ok(card.includes("grid-column:3 / span 4;grid-row:4 / span 3"), "the same viewport the page uses");
  assert.ok(card.includes("2 buzzes"));
  assert.ok(card.includes("Sealed for good."));
  assert.ok(!card.includes("You share it with"));
  // A hive with nothing placed on it is not a picture, so the ordinary card stands.
  const bare = renderShareCard(page, null, { day: { ...day, stories: [] }, pictures: new Map() });
  assert.ok(bare.includes("Born on"));
});

test("an empty date still produces a card rather than a broken one", () => {
  const card = renderShareCard({ month: 3, day: 3, people: [] });
  assert.ok(card.includes("March 3"));
  assert.ok(!card.includes("You share it with"));
});

import { readFile } from "node:fs/promises";
import { renderSquare, SQUARE_SIDE } from "../src/share.js";

/** One placed story, the shape og.ts hands the square. */
function placed(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-2222-3333-4444-555555555555", wallDate: "2026-09-04", submittedAt: "2026-09-04T05:00:00Z",
    headline: "1998: Google is founded", url: "https://en.wikipedia.org/wiki/September_4", outlet: "en.wikipedia.org",
    status: "placed" as const, tier: "claimed" as const, support: 2, priority: 1, placedAt: "2026-09-04T05:15:00Z",
    rect: { mx: 4, my: 4, w: 4, h: 3 }, falseAt: null, falseNote: null,
    subjectKind: "song", subjectId: "2007-09-08", sources: [], ...overrides,
  };
}

function hiveDay(stories: ReturnType<typeof placed>[], overrides: Record<string, unknown> = {}) {
  return {
    wallDate: "2026-09-04", year: 2026, month: 9, day: 4, opensAt: "2026-09-03T04:00:00Z",
    liveAt: "2026-09-04T04:00:00Z", closesAt: "2026-09-06T04:00:00Z", closedAt: "2026-09-06T04:00:00Z",
    stories, ...overrides,
  };
}

test("the square draws the board at its own proportions, with the date and the covers", () => {
  const day = hiveDay([placed()]);
  const sq = renderSquare(page, null, { day, pictures: new Map([["song:2007-09-08", "file:///static/covers/abc.jpg"]]) });
  assert.ok(sq.includes(`width: ${SQUARE_SIDE}px; height: ${SQUARE_SIDE}px`), "1080 by 1080, not the wide strip");
  assert.ok(sq.includes("The hive for"));
  assert.ok(sq.includes("September 4"));
  assert.ok(sq.includes("1998: Google is founded"));
  assert.ok(sq.includes("url(&quot;file:///static/covers/abc.jpg&quot;)"), "the cover is on the tile");
  assert.ok(sq.includes("grid-column:3 / span 4;grid-row:4 / span 3"), "the same viewport the page and the wide card use");
  assert.ok(sq.includes("2 buzzes"));
  assert.ok(sq.includes("birthed.app"));
});

test("the square gives a headline more room than the wide card does", () => {
  const day = hiveDay([placed()]);
  const hive = { day, pictures: new Map<string, string>() };
  const sq = renderSquare(page, null, hive);
  const wide = renderShareCard(page, null, hive);
  // Both size a headline from the module, so comparing the module compares the
  // headline. 880 pixels of board against 540 is the whole reason for the shape.
  assert.ok(sq.includes("--m: 109.00px"), "880 pixels of board over an eight module viewport");
  assert.ok(wide.includes("--m: 66.75px"), "534 pixels of board over the same viewport");
});

test("a date with no board gets an honest picture rather than none", () => {
  const sq = renderSquare({ month: 3, day: 3, people: [] });
  assert.ok(sq.includes("March 3"));
  assert.ok(sq.includes("Its hive opens the day before"), "it says when the board arrives instead of apologising");
  assert.ok(sq.includes("birthed.app"));
  // A hive row with nothing placed on it is still an empty date.
  const bare = renderSquare(page, null, { day: hiveDay([]), pictures: new Map() });
  assert.ok(bare.includes("Its hive opens the day before"));
});

test("the empty square leads with what happened, and falls back to names when nothing was found", () => {
  const withFact = renderSquare({ month: 3, day: 3, people: [] }, { year: 1931, text: "The Star Spangled Banner became the national anthem." });
  assert.ok(withFact.includes("1931"));
  assert.ok(withFact.includes("national anthem"));
  const withNames = renderSquare(page, null);
  assert.ok(withNames.includes("Anton Bruckner"), "no researched fact, so the names stand in");
});

test("nothing a source wrote can inject markup into either square", () => {
  const day = hiveDay([placed({ headline: "<script>alert(1)</script>", outlet: "<img src=x>" })]);
  const sq = renderSquare(page, null, { day, pictures: new Map() });
  assert.ok(!sq.includes("<script>alert(1)</script>"));
  assert.ok(sq.includes("&lt;script&gt;"));
  assert.ok(!sq.includes("<img src=x>"));
  const names = renderSquare(page, null);
  assert.ok(!names.includes("<script>Hildur"));
  assert.ok(names.includes("&lt;script&gt;"));
});

test("a card is handed its pictures as bytes, never as an address that needs an origin", async () => {
  // What broke: the card is put up with setContent, which leaves the page on
  // an opaque origin, and Chromium refuses every file:// subresource such a
  // page asks for. Nothing throws and nothing appears, and a tile with a
  // picture also takes the scrim and the light type, so an empty dark tile
  // looks deliberate. This reads og.ts rather than the card, because the card
  // draws whatever address it is given and the mistake is in the giving.
  const og = await readFile(new URL("../../src/og.ts", import.meta.url), "utf8");
  assert.ok(!og.includes("pathToFileURL"), "a file address is refused as a local resource");
  assert.ok(og.includes("data:${kind};base64,"), "the bytes go in the card");
  // And the card puts whatever it is handed on the tile, quoted, so a data
  // address survives the style attribute the same way a path did.
  const story = {
    id: "11111111-2222-3333-4444-555555555555", wallDate: "2026-09-04", submittedAt: "2026-09-04T05:00:00Z",
    headline: "1998: Google is founded", url: "https://en.wikipedia.org/wiki/September_4", outlet: "en.wikipedia.org",
    status: "placed" as const, tier: "claimed" as const, support: 0, priority: 1, placedAt: "2026-09-04T05:15:00Z",
    rect: { mx: 4, my: 4, w: 4, h: 3 }, falseAt: null, falseNote: null, subjectKind: "song", subjectId: "2007-09-08", sources: [],
  };
  const day = { wallDate: "2026-09-04", year: 2026, month: 9, day: 4, opensAt: "2026-09-03T04:00:00Z", liveAt: "2026-09-04T04:00:00Z", closesAt: "2026-09-06T04:00:00Z", closedAt: null, stories: [story] };
  const pictures = new Map([["song:2007-09-08", "data:image/jpeg;base64,AAAA"]]);
  for (const card of [renderShareCard(page, null, { day, pictures }), renderSquare(page, null, { day, pictures })]) {
    assert.ok(card.includes("url(&quot;data:image/jpeg;base64,AAAA&quot;)"));
    assert.ok(!card.includes("file://"));
  }
});

import { ageLine, personalName, pickPersonal, renderPersonalSquare, storyYear } from "../src/share.js";

test("a story's year is read from every shape the worker writes, and nothing else", () => {
  const y = (headline: string, kind: string | null) => storyYear({ headline, subjectKind: kind }, 2026);
  assert.equal(y("1792: The Hope Diamond is stolen along with other French crown jewels", "historical_event"), 1792);
  assert.equal(y("2007: Britney's comeback performance went badly.", "cultural_event"), 2007);
  assert.equal(y("Guy Ritchie, English filmmaker (born 1968), born 1968", "person"), 1968);
  assert.equal(y("On September 10, 1932, the Eighth Avenue Line opened in New York City", "birth_fact"), 1932);
  // The day's news happened today, so it takes the wall's own year.
  assert.equal(y("Oil hits $100 a barrel for the first time since July", null), 2026);
  // A person whose description carries a year is still read from the end,
  // which is where the worker puts the one it means.
  assert.equal(y("Bashar al-Assad, President of Syria from 2000 to 2024, born 1965", "person"), 1965);
  // Nothing to state is null, and a story with no year is never pulled out.
  assert.equal(y("In standard calendar years, September 11 is the 254th day", "birth_fact"), null);
});

test("the two age lines, including the year the reader arrived", () => {
  assert.equal(ageLine(2007, 1994), "You were 13 when this happened.");
  assert.equal(ageLine(1995, 1994), "You were 1 when this happened.");
  assert.equal(ageLine(1994, 1994), "This happened the year you were born.");
  assert.equal(ageLine(1792, 1994), "202 years before you were born.");
  assert.equal(ageLine(1993, 1994), "1 year before you were born.");
});

test("the story a reader's picture pulls out is the one the board would pick", () => {
  const at = (over: Record<string, unknown>) => ({
    id: String(over.id), wallDate: "2026-09-10", submittedAt: "2026-09-10T05:00:00Z", headline: "",
    url: "https://example.com/x", outlet: "example.com", status: "placed" as const, tier: "claimed" as const,
    support: 0, priority: 1, placedAt: "2026-09-10T05:15:00Z", rect: { mx: 2, my: 2, w: 3, h: 3 },
    falseAt: null, falseNote: null, subjectKind: "historical_event", subjectId: "1", sources: [], ...over,
  });
  const day = (stories: ReturnType<typeof at>[]) => ({
    wallDate: "2026-09-10", year: 2026, month: 9, day: 10, opensAt: "2026-09-09T04:00:00Z",
    liveAt: "2026-09-10T04:00:00Z", closesAt: "2026-09-12T04:00:00Z", closedAt: null, stories,
  });
  const old = at({ id: "a", headline: "1089: The first synod of pope Urban II starts in Melfi" });
  const mine = at({ id: "b", headline: "2007: Britney's comeback performance went badly." });
  const buzzed = at({ id: "c", headline: "1570: Spanish Jesuit missionaries land in Virginia", support: 3 });
  const undated = at({ id: "d", headline: "In standard calendar years this is the 254th day", subjectKind: "birth_fact" });

  // Inside the reader's own life beats older, which is the sentence this
  // product is built on.
  assert.equal(pickPersonal(day([old, mine]), 1994)?.id, "b");
  // A buzz beats it, the way a buzz beats everything on this board.
  assert.equal(pickPersonal(day([old, mine, buzzed]), 1994)?.id, "c");
  // A reader born after every story on the board still gets one.
  assert.equal(pickPersonal(day([old, mine]), 2015)?.id, "a");
  // A story with no year it can state is never pulled out, and a board of
  // nothing but those has no picture rather than a made up number.
  assert.equal(pickPersonal(day([undated]), 1994), null);
  assert.equal(renderPersonalSquare({ month: 9, day: 10, people: [] }, { day: day([undated]), pictures: new Map() }, 1994), null);
});

test("a reader's picture shows the board, the story it pulled out and their own arithmetic", () => {
  const story = {
    id: "11111111-2222-3333-4444-555555555555", wallDate: "2026-09-10", submittedAt: "2026-09-10T05:00:00Z",
    headline: "2007: Britney's comeback performance went badly.", url: "https://en.wikipedia.org/wiki/Chris_Crocker",
    outlet: "en.wikipedia.org", status: "placed" as const, tier: "claimed" as const, support: 0, priority: 3,
    placedAt: "2026-09-10T05:15:00Z", rect: { mx: 6, my: 6, w: 4, h: 3 }, falseAt: null, falseNote: null,
    subjectKind: "cultural_event", subjectId: "17e569aa", sources: [],
  };
  const other = { ...story, id: "22222222-2222-3333-4444-555555555555", headline: "1089: The first synod of pope Urban II", rect: { mx: 2, my: 2, w: 4, h: 3 }, subjectId: "other" };
  const day = { wallDate: "2026-09-10", year: 2026, month: 9, day: 10, opensAt: "2026-09-09T04:00:00Z", liveAt: "2026-09-10T04:00:00Z", closesAt: "2026-09-12T04:00:00Z", closedAt: null, stories: [story, other] };
  const html = renderPersonalSquare({ month: 9, day: 10, people: [] }, { day, pictures: new Map() }, 1994)!;
  assert.ok(html.includes("You were 13 when this happened."));
  assert.ok(html.includes("Britney"));
  assert.ok(html.includes("September 10"));
  // The one it pulled is lit and the rest of the board dims rather than goes,
  // because the point is that this one came off that board.
  assert.ok(html.includes(`class="t lit"`) || html.includes(" lit\""));
  assert.ok(html.includes(" dim"));
});

test("more buzzes wins over higher priority, the way the board itself orders", () => {
  const at = (over: Record<string, unknown>) => ({
    id: String(over.id), wallDate: "2026-09-10", submittedAt: "2026-09-10T05:00:00Z", headline: "",
    url: "https://example.com/x", outlet: "example.com", status: "placed" as const, tier: "claimed" as const,
    support: 0, priority: 1, placedAt: "2026-09-10T05:15:00Z", rect: { mx: 2, my: 2, w: 3, h: 3 },
    falseAt: null, falseNote: null, subjectKind: "historical_event", subjectId: "1", sources: [], ...over,
  });
  const day = (stories: ReturnType<typeof at>[]) => ({
    wallDate: "2026-09-10", year: 2026, month: 9, day: 10, opensAt: "2026-09-09T04:00:00Z",
    liveAt: "2026-09-10T04:00:00Z", closesAt: "2026-09-12T04:00:00Z", closedAt: null, stories,
  });
  // Two buzzes at the lowest priority against one buzz at the highest. The
  // first version of this scored only whether support was more than nought
  // and then let priority decide, which handed the picture to the one buzz.
  const two = at({ id: "two", headline: "1967: The people of Gibraltar vote to remain a British dependency", support: 2, priority: 0 });
  const one = at({ id: "one", headline: "2007: Britney's comeback performance went badly.", support: 1, priority: 3, subjectKind: "cultural_event" });
  assert.equal(pickPersonal(day([one, two]), 1994)?.id, "two");
});

test("today's news is the last thing a reader's picture reaches for", () => {
  const at = (over: Record<string, unknown>) => ({
    id: String(over.id), wallDate: "2026-09-10", submittedAt: "2026-09-10T05:00:00Z", headline: "",
    url: "https://example.com/x", outlet: "example.com", status: "placed" as const, tier: "claimed" as const,
    support: 0, priority: 1, placedAt: "2026-09-10T05:15:00Z", rect: { mx: 2, my: 2, w: 3, h: 3 },
    falseAt: null, falseNote: null, subjectKind: "historical_event", subjectId: "1", sources: [], ...over,
  });
  const day = (stories: ReturnType<typeof at>[]) => ({
    wallDate: "2026-09-10", year: 2026, month: 9, day: 10, opensAt: "2026-09-09T04:00:00Z",
    liveAt: "2026-09-10T04:00:00Z", closesAt: "2026-09-12T04:00:00Z", closedAt: null, stories,
  });
  // The real September 10: the buzzes are on a story from that morning, which
  // would tell a reader born in 1994 they were 32, which is their age and not
  // a discovery. The 2007 tile under it tells them they were 13.
  const news = at({ id: "news", headline: "Grief, fury, conspiracy: inside Turning Point USA", support: 2, priority: 0, subjectKind: null, subjectId: null });
  const britney = at({ id: "britney", headline: "2007: Britney's comeback performance went badly.", support: 0, priority: 3, subjectKind: "cultural_event" });
  assert.equal(pickPersonal(day([news, britney]), 1994)?.id, "britney");
  assert.equal(ageLine(2007, 1994), "You were 13 when this happened.");
  // A board with nothing but today still makes a picture rather than none.
  assert.equal(pickPersonal(day([news]), 1994)?.id, "news");
});

test("the pulled story's picture is set where the browser will decode it", () => {
  const story = {
    id: "11111111-2222-3333-4444-555555555555", wallDate: "2026-09-10", submittedAt: "2026-09-10T05:00:00Z",
    headline: "Guy Ritchie, English filmmaker (born 1968), born 1968", url: "https://www.wikidata.org/wiki/Q192990",
    outlet: "wikidata.org", status: "placed" as const, tier: "claimed" as const, support: 1, priority: 2,
    placedAt: "2026-09-10T05:15:00Z", rect: { mx: 6, my: 6, w: 4, h: 3 }, falseAt: null, falseNote: null,
    subjectKind: "person", subjectId: "Q192990", sources: [],
  };
  const day = { wallDate: "2026-09-10", year: 2026, month: 9, day: 10, opensAt: "2026-09-09T04:00:00Z", liveAt: "2026-09-10T04:00:00Z", closesAt: "2026-09-12T04:00:00Z", closedAt: null, stories: [story] };
  const html = renderPersonalSquare({ month: 9, day: 10, people: [] },
    { day, pictures: new Map([["person:Q192990", "data:image/jpeg;base64,AAAA"]]) }, 1994)!;
  // In a style attribute the HTML parser decodes the escaped quote before CSS
  // ever sees it. Inside a style element it does not, and the CSS parser reads
  // an unquoted url beginning with an ampersand, which resolves against the
  // page's opaque origin and silently draws nothing. That is the same empty
  // box the file address gave, in the one place the fix for it did not reach.
  assert.ok(html.includes(`style="background-image:url(&quot;data:image/jpeg;base64,AAAA&quot;)"`));
  const styleBlock = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  assert.ok(!styleBlock.includes("data:image"), "no picture address inside the style element");
  assert.ok(!styleBlock.includes("&quot;"), "and nothing in there relying on a character reference");
});

test("a four digit number in a headline is not mistaken for the story's year", () => {
  const y = (headline: string, kind: string | null) => storyYear({ headline, subjectKind: kind }, 2026);
  // Each of these used to return the first number it found and then state it
  // as a fact about the reader's life in the largest type on the picture.
  assert.equal(y("A crowd of 1500 watched the 1932 opening of the line", "historical_event"), null);
  assert.equal(y("Matty Healy, singer in the band The 1975", "person"), null);
  assert.equal(y("The 1948 Olympics drew fewer than the 1932 games", "birth_fact"), null);
  // The shape the worker actually writes is still read.
  assert.equal(y("On September 10, 1932, the Eighth Avenue Line opened in New York City.", "birth_fact"), 1932);
  // A story a reader submitted carries no subject, like the news, but it can
  // be about any year at all, so its own year wins over the day it was filed.
  assert.equal(y("1989: the Berlin Wall falls", null), 1989);
  assert.equal(y("Oil hits $100 a barrel for the first time since July", null), 2026);
});

test("a reader's birth year is in no file name this build writes", () => {
  const name = personalName("2026-09-10", 1994);
  assert.match(name, /^[0-9a-f]{32}$/);
  assert.ok(!name.includes("1994"));
  assert.ok(!name.includes("94"), "not even the last two digits fall out of it by accident");
  // Same date and year, same file, so the builder and the server agree
  // without passing anything between them.
  assert.equal(personalName("2026-09-10", 1994), name);
  assert.notEqual(personalName("2026-09-10", 1995), name);
  assert.notEqual(personalName("2026-09-11", 1994), name);
});




import { calendar, isLeapYear, renderAdd, renderHome, renderPrivacy, renderSupport } from "../src/pages.js";
import { asHighlight, pickHighlights, type Fact } from "../src/facts.js";
import { redirectFor } from "../src/serve.js";

test("the front door reaches the calendar, and the two pages people need", () => {
  // The twelve grids came off the foot of this page on September 10, 2026:
  // with Every date in the bar they were the calendar page twice. Every date
  // is one link away, on /calendar/, which the next tests hold to all 366.
  const html = renderHome();
  assert.ok(html.includes('href="/calendar/"'));
  assert.equal((html.match(/href="\/[a-z]+-\d+\/"/g) ?? []).length, 0, "no grid of dates on the front door");
  assert.ok(html.includes('href="/support/"'));
  assert.ok(html.includes('href="/privacy/"'));
});

test("the front door offers a random day and today, and neither is a page", () => {
  const html = renderHome();
  assert.ok(html.includes('href="/random/"'));
  assert.ok(html.includes('href="/today/"'));
  // Both are answered by a redirect. If either ever became a file, the built
  // site would have a page nothing links to it correctly and this would say so.
  assert.equal(redirectFor("/random/") === null, false);
  assert.equal(redirectFor("/today/") === null, false);
});

test("an icon only link still has a name when its words are hidden", () => {
  // Under 430 pixels the stylesheet hides the words in these two links. A
  // link whose remaining content is a decorative svg has no accessible name
  // at all unless one is on the link itself.
  const html = renderHome();
  assert.ok(html.includes('class="pill" href="/today/" title="Today\'s date" aria-label='));
  assert.ok(html.includes('class="pill" href="/random/" title="A random day of the year" aria-label='));
});

test("the about page explains how to play and asks for nothing", () => {
  // September 22, 2026: the front door is today's date now, and every date
  // page has its own See your own birthday button. The About page is the
  // rules, so it no longer asks for a birthday or offers a second Random.
  const html = renderHome(2026);
  assert.ok(!html.includes('action="/year"'), "no birthday form");
  assert.ok(!html.includes("Surprise me"), "the bar already has Random day");
  assert.ok(html.includes("How to play"));
  assert.ok(html.includes("Spend your three buzzes") && html.includes("Midnight seals it"));
  assert.ok(html.includes('<a class="btn play" href="/today/">'));
  assert.ok(!html.includes("<script"));
});

test("the privacy page does not claim anything stays on the phone that does not", () => {
  const html = renderPrivacy();
  // The birthday, year and region go to the account. The people list does not.
  assert.ok(html.includes("are sent to that account"));
  assert.ok(html.includes("is not sent to the account service"));
  assert.ok(!/birthday[^.]*stays on your phone/i.test(html));
});

test("support and privacy carry a way to reach a person", () => {
  for (const html of [renderSupport(), renderPrivacy()]) {
    assert.ok(html.includes("mailto:"));
  }
});

test("every page names its favicon", () => {
  assert.ok(renderHome().includes('rel="icon" href="/favicon.ico"'));
});

test("the index is twelve calendars, and each month starts on its real weekday", () => {
  const html = renderCalendarPage(2026);
  const january = html.split("<h3>January</h3>")[1]?.split("</section>")[0] ?? "";
  // January 1 2026 was a Thursday, so four squares sit empty before it.
  assert.equal((january.match(/<span class="pad"><\/span>/g) ?? []).length, 4);
  assert.ok(january.includes('<a href="/january-1/" aria-label="January 1"'));
  assert.ok(january.includes("<span>Su</span>"), "the week has a header row");
  // March 1 2026 was a Sunday, so nothing sits before it.
  const march = html.split("<h3>March</h3>")[1]?.split("</section>")[0] ?? "";
  assert.equal((march.match(/<span class="pad"><\/span>/g) ?? []).length, 0);
});

test("the number is what you see, the date is what a screen reader says", () => {
  const html = renderCalendarPage(2026);
  assert.ok(html.includes('aria-label="December 25" title="December 25">25</a>'));
});

test("February 29 keeps a square in a year that does not have one", () => {
  const ordinary = renderCalendarPage(2026);
  assert.ok(ordinary.includes('<a class="leap" href="/february-29/"'));
  assert.ok(ordinary.includes("February 29 comes around every fourth year"));

  const leap = renderCalendarPage(2028);
  assert.ok(leap.includes('<a href="/february-29/"'));
  assert.ok(!leap.includes('class="leap"'), "a leap year has no odd one out");
  assert.ok(!leap.includes("comes around every fourth year"));
});

test("all 366 are linked once, in a leap year and out of one", () => {
  for (const year of [2026, 2027, 2028, 2100]) {
    const links = calendar(year).match(/href="\/[a-z]+-\d+\/"/g) ?? [];
    assert.equal(links.length, 366, `${year} did not link all 366`);
    assert.equal(new Set(links).size, 366, `${year} linked one twice`);
  }
});

// Two squares in the calendar are marked and they are marked in two different
// places, for a reason that is easy to undo by accident. The date whose page
// this is can be written at build time. Today cannot, because these pages are
// baked into a deploy and served unchanged until the next one, so a today
// written here would still point at the day of the deploy a week later.
// The footer says there is no sign up, and on one page that is false. /add
// has a form, runs a script and posts a birthday to the project, which is why
// it carries its own widened policy header. A claim that is true on 370 pages
// and false on one is worse than no claim, because the one is the page
// somebody screenshots.
test("every page says nothing is collected, except the page that collects", () => {
  const claim = "no sign up";
  const collecting = renderAdd({ url: "https://example.supabase.co", key: "anon" });
  assert.ok(!collecting.includes(claim), "/add takes a birthday and must not claim otherwise");

  for (const [name, html] of [
    ["about", renderHome(2026, [])],
    ["support", renderSupport()],
    ["privacy", renderPrivacy()],
  ] as const) {
    assert.ok(html.includes(claim), `${name} should carry the line`);
  }
});

test("the calendar marks the page's own date, once", () => {
  const marked = calendar(2026, { month: 9, day: 8 });
  assert.equal((marked.match(/class="thispage"/g) ?? []).length, 1);
  assert.match(marked, /<a class="thispage" href="\/september-8\/"/);
});

test("a calendar with no date of its own marks nothing", () => {
  // The about page draws the same twelve months and is not a date.
  assert.ok(!calendar(2026).includes("thispage"));
});

test("February 29 can be the marked square in a year that has no 29th", () => {
  // The leap day keeps a square in every year, so it has to be markable in
  // every year too, or its own page is the one page that cannot say so.
  const marked = calendar(2027, { month: 2, day: 29 });
  assert.match(marked, /class="[^"]*thispage[^"]*" href="\/february-29\/"/);
});

test("the century rule is not forgotten", () => {
  assert.equal(isLeapYear(2028), true);
  assert.equal(isLeapYear(2027), false);
  assert.equal(isLeapYear(2100), false);
  assert.equal(isLeapYear(2000), true);
});

// The found facts on a date page. These are the section the whole date page
// argument now rests on, so the tests are about what would actually be wrong
// on a public page rather than about the markup.

const facts = [
  {
    id: "t", month: 9,
    day: 4,
    fact: "On September 4, 1957, Ford unveiled the Edsel.",
    category: "release",
    sourceUrl: "https://en.wikipedia.org/wiki/Edsel",
  },
  {
    id: "t", month: 9,
    day: 4,
    fact: "On September 4, 1998, Google was founded <script>alert(1)</script>.",
    category: "event",
    sourceUrl: "https://www.example.org/a?b=1&c=2",
  },
];

test("a date page carries its found facts and the page each came from", () => {
  const html = renderDayPage(page, [], facts);
  assert.match(html, /<ul class="wlist hist">/);
  // The date comes off the front and becomes the anchor in the margin. It
  // used to be printed inside every sentence, on a page titled with it.
  assert.ok(html.includes("Ford unveiled the Edsel."));
  assert.ok(!html.includes("On September 4, 1957, Ford"), "the page's own date is not repeated per row");
  assert.match(html, /<span class="fyr">1957<\/span>/);
  assert.ok(html.includes("en.wikipedia.org"));
  assert.ok(html.includes("The 2 with a source link under them were found by Google's Gemini"));
});

test("Wikipedia's own events join the researched ones, newest first", () => {
  const events = [
    { id: "t", month: 9, day: 4, year: 1888, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "George Eastman registers the trademark Kodak." },
  ];
  const html = renderDayPage(page, [], facts, events);
  assert.ok(html.includes("George Eastman registers the trademark Kodak."));
  assert.ok(html.includes("The other 1 is from the September 4 article on Wikipedia"));
  // 1888 is older than the 1957 fact, so it comes last in the list. The feed
  // reads from now backwards as of 8 September 2026; see the sort in
  // buildTimeline for why.
  //
  // Measured inside the feed rather than across the whole page. The opening
  // band now names one thing above it, drawn from the same rows, so a raw
  // indexOf over the document answers a question about the tiles instead of a
  // question about the ordering.
  const feed = html.slice(html.indexOf('<ul class="wlist hist">'));
  assert.ok(
    feed.indexOf("Edsel") < feed.indexOf("Kodak"),
    "the list is ordered by year, newest first, not by which source it came from",
  );
  // One credit for each source that is actually on the page, and the
  // Wikipedia rows do not each carry their own host line.
  assert.match(html, /Creative Commons Attribution ShareAlike/);
  assert.match(html, /Google's Gemini/);
});

test("the same event from both sources is printed once", () => {
  const events = [
    { id: "t", month: 9, day: 4, year: 1957, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "Ford unveils the Edsel to the public." },
  ];
  const html = renderDayPage(page, [], facts, events);
  assert.ok(html.includes("The 2 with a source link under them"), "the duplicate is dropped, not added");
  // Counting the word will not do: the fixture's own source address contains
  // it. What must not survive is Wikipedia's second telling of the event.
  assert.ok(!html.includes("Ford unveils the Edsel to the public."));
  assert.ok(html.includes("Ford unveiled the Edsel."), "the researched one is the one kept");
});

test("a page with no researched facts still has a section when Wikipedia does", () => {
  const events = [
    { id: "t", month: 9, day: 4, year: 1888, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "George Eastman registers the trademark Kodak." },
  ];
  const html = renderDayPage(page, [], [], events);
  assert.match(html, /<ul class="wlist hist">/);
  assert.ok(html.includes("George Eastman registers the trademark Kodak."));
  assert.ok(!html.includes("Google's Gemini"), "no Gemini credit when no Gemini rows");
  assert.match(html, /Creative Commons Attribution ShareAlike/);
});

test("a description stops repeating the year the row already prints", () => {
  const dead = {
    month: 9,
    day: 4,
    people: [
      { qid: "Q9", name: "Rishi Kapoor", birthYear: 1952, deathYear: 2020,
        description: "Indian film actor (1951\u20132020)", monthlyViews: 900 },
    ],
  };
  const html = renderDayPage(dead);
  assert.ok(html.includes("Indian film actor"));
  // Wikidata's own data disagreed with itself here: the birth date says 1952
  // and the description said 1951, so the page printed both next to each other.
  assert.ok(!html.includes("1951"), "the prose copy of the years goes, the structured one stays");
  assert.match(html, /<span class="fyr">1952<\/span>/);
  assert.ok(html.includes("died 2020"));
});

test("the source host is shown without the www, which nobody reads", () => {
  const html = renderDayPage(page, [], facts);
  assert.ok(html.includes(">example.org<"));
  assert.ok(!html.includes(">www.example.org<"));
});

test("a fact from the model cannot inject markup", () => {
  const html = renderDayPage(page, [], facts);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes("b=1&amp;c=2"), "the ampersand in a source address is escaped too");
});

test("a date with no facts yet has no heading standing over nothing", () => {
  const html = renderDayPage(page, [], []);
  assert.ok(!html.includes("What happened on September 4"));
  assert.ok(!html.includes('class="feed"'));
});

test("the description leads with the facts, because the names are what everyone else has", () => {
  const html = renderDayPage(page, [], facts);
  assert.ok(html.includes("What happened on September 4, in 2 sourced things."));
});

test("nothing on a date page is written to somebody born that day", () => {
  // A stranger who typed the date into a search box was not born on it, so a
  // fact that says "your birthday" is simply false here. The voice is set in
  // the Edge Function; this is the assertion that notices if it changes back.
  //
  // Sliced from the facts list rather than from the first "What happened on",
  // which is in the meta description up in the head. Starting there put the
  // whole inlined stylesheet inside the section being read, so this test was
  // also asserting that no CSS comment anywhere on the site contains the word
  // "you". It caught one, and the comment was about dropdown chevrons.
  const html = renderDayPage(page, [], facts);
  const start = html.indexOf('<ul class="wlist hist">');
  const section = html.slice(start, html.indexOf("</ul>", start));
  assert.ok(section.length > 0, "the facts list is on the page to be read");
  assert.ok(!/\byour?\b/i.test(section), "the facts section must not address a reader");
});

test("a date with nobody on it is ready when it has facts instead", () => {
  // January 1 has nobody and never will: Wikidata files a year-only birth date
  // as January 1, and the importer's precision filter correctly refuses all of
  // them. Holding one of the most searched dates of the year out of the
  // sitemap forever, on a head count it cannot meet, is the rule misfiring.
  const nobody = { month: 1, day: 1, people: [] };
  const twelve = Array.from({ length: 12 }, (_, index) => ({
    id: "t", month: 1, day: 1, fact: `On January 1, thing number ${index} happened.`,
    category: "event", sourceUrl: "https://en.wikipedia.org/wiki/January_1",
  }));
  assert.equal(isReady(nobody, twelve), true);
  assert.equal(isReady(nobody, twelve.slice(0, 3)), false, "a few facts is not a page");
  assert.equal(isReady(nobody), false);
});

test("facts do not rescue a page whose people were never ranked", () => {
  // The other 171 are not thin, they have about fifty people each and no
  // pageviews, so they are ordered by how many languages have an article,
  // which fills a page with footballers. That is a worker run, not a rule
  // change, and facts must not paper over it.
  const unranked = {
    month: 6, day: 8,
    people: Array.from({ length: 10 }, (_, i) => ({
      qid: `Q${i}`, name: `Person ${i}`, birthYear: 1960 + i,
      deathYear: null, description: null, monthlyViews: 0,
    })),
  };
  const plenty = Array.from({ length: 12 }, (_, index) => ({
    id: "t", month: 6, day: 8, fact: `On June 8, thing number ${index} happened.`,
    category: "event", sourceUrl: "https://en.wikipedia.org/wiki/June_8",
  }));
  assert.equal(isReady(unranked, plenty), false);
});

// The page a shared birthday lands on. The tests that matter here are about
// what it does not do: appear in search, and put a birthday in a query.

/// Stand-ins for the real project. The page is built with them baked in, so a
/// test can look for them and know the wiring reached the markup.
const API = { url: "https://example.supabase.co", key: "test-anon-key" };

test("the add page keeps itself out of search results", () => {
  const html = renderAdd(API);
  assert.ok(html.includes('name="robots" content="noindex"'));
});

test("the add page never puts a birthday in a query", () => {
  // The whole design is that the data sits after the hash, which browsers do
  // not send. A link built with a question mark would be sent to the server
  // on every tap, and the privacy page would stop being true.
  const html = renderAdd(API);
  assert.ok(html.includes('/add/#"'), "the link it builds is a fragment");
  assert.ok(!/\/add\/\?/.test(html), "nothing builds a query onto /add/");
});

test("the add page hands off to the app rather than assuming it is there", () => {
  const html = renderAdd(API);
  assert.ok(html.includes("birthed://add?"));
  assert.ok(html.includes("<noscript>"), "it says why it needs a script");
});

// The third mode: somebody answering a request rather than volunteering.
// This is the only place on the site that writes to a server, so the tests are
// about it being reachable, being honest, and not leaking into the other two.

test("the add page can answer a request as well as build a link", () => {
  const html = renderAdd(API);
  assert.ok(html.includes("rpc/leave_birthday"), "it posts to the function, not the table");
  assert.ok(!/rest\/v1\/birthday_replies/.test(html), "it never writes the table directly");
  assert.ok(html.includes(API.url), "the project it posts to is baked in");
  assert.ok(html.includes(API.key), "so is the publishable key");
});

test("the code travels after the hash, like everything else here", () => {
  // Not for secrecy. It keeps the code out of the website's access logs, so
  // the only record that a request exists is the row the sender created.
  const html = renderAdd(API);
  assert.ok(html.includes("values.c"), "the code is read out of the fragment");
  assert.ok(!/\/add\/\?/.test(html), "nothing builds a query onto /add/");
});

test("a mistyped address is not treated as a request", () => {
  const html = renderAdd(API);
  assert.ok(/\[A-Z2-9\]\{6,12\}/.test(html), "the code has to look like a code");
});

test("the send route tells the reader what happens to what they typed", () => {
  // The rest of this site is true because nothing reaches us. This one button
  // is the exception, and a page that took the answer without saying so would
  // make the privacy page a lie.
  const html = renderAdd(API);
  assert.ok(html.includes("deleted from our server"));
  assert.ok(html.includes("You do not need the app"));
});

test("a failed send falls back to the link that never needed us", () => {
  const html = renderAdd(API);
  assert.ok(html.includes("Send them this link instead"));
});

test("the privacy page says what the request route stores", () => {
  const html = renderPrivacy();
  assert.ok(html.includes("Asking somebody for their birthday"));
  assert.ok(html.includes("their name and their birthday are stored against that code"));
  assert.ok(html.includes("Confirming deletes it from the server."));
  assert.ok(html.includes("a fortnight"), "the expiry is stated, not implied");
});

test("the privacy page no longer claims the site runs no scripts", () => {
  // It did, and one page now does. A privacy page that is wrong about
  // something checkable is worse than one that explains itself.
  const html = renderPrivacy();
  assert.ok(!html.includes("runs no scripts"));
  assert.ok(html.includes("after the hash symbol"));
  // This used to assert the page carried "sets no cookies", which pinned the
  // claim in place while the answer route was setting one. The test above
  // asserts the opposite now, on purpose.
});

// The footer sentence is the answer to the Reddit accusation and its whole
// value is that a reader can check every clause in the network tab. It said
// the page set no cookies while the answer route was setting a one year one.
// These two assertions exist so that the next thing stored about a reader
// either appears in the sentence or fails the build.
// A polished free site with no owner named on it is read as a business that
// has not shown its hand. The name goes above the fold on the date page, which
// is where the doubt happens, and the About page carries the reason. Both, or
// the line is a signature with nothing behind it.
test("the date page and the about page are signed", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes("Jason Evan Page"), "the date page says who made it");
  assert.ok(html.includes("No ads, nothing for sale."), "shortened with the move to a credit line");
  // Baked into all 366 and drawn on one. A name on every page of an almanac
  // reads as a byline over work somebody else did, and "/" serves today's own
  // built file, so no file can know whether it is today. today.css does.
  const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  assert.match(style, /\.signed \{ display: none;/);
  // The last line of the page, at the size of a credit. It sat on the first
  // screen for one morning and that was too loud for the person whose name it
  // is, which is the only vote that counts on this one.
  // Measured against the calendar, which every date page has. This fixture has
  // no rows and therefore no ask card, so testing against one asserted nothing
  // on the page it was actually run on.
  const mark = html.indexOf("Jason Evan Page");
  assert.ok(mark > 0 && mark > html.indexOf('class="everyday"'),
    "the name is the last line of the page, below even the calendar");
  const baked = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  assert.match(baked, /\.signed \{ display: none;/, "still today's date only, by today.css");

  const about = renderHome(2026, []);
  assert.ok(about.includes("Who made this"));
  assert.ok(about.includes("Jason Evan Page"));
  assert.ok(about.includes("It costs me money to run and it does not make any."));
});

test("the footer names the cookie instead of denying it", () => {
  const html = renderPrivacy();
  assert.ok(!html.includes("sets no cookies"), "answering sets one, so the line may not deny it");
  assert.ok(html.includes("one random string is kept in a cookie"));
  assert.ok(html.includes("not counted twice"), "the line says what the cookie is for");
});

// The privacy page has to name both cookies by the names the reader will see
// in their browser, or naming them in the footer is the only honest text on
// the site and the page behind it still reads as boilerplate.
test("the privacy page names both cookies and refuses the address", () => {
  const html = renderPrivacy();
  assert.ok(html.includes("<code>bt</code>"), "the answer token is named");
  assert.ok(html.includes("<code>by</code>"), "the birth year cookie is named");
  assert.ok(html.includes("never sent to our database and is never stored against a buzz"));
  assert.ok(html.includes("no analytics service"));
});

test("the hidden attribute beats the stylesheet", () => {
  // The /add page switches its two buttons with the hidden attribute, and
  // .btn sets display, which wins over the browser's own [hidden] rule. The
  // page shipped offering "Make my link" and "Send it" at once, on a screen
  // where only one of them does the right thing.
  const html = renderDayPage(page);
  assert.match(html, /\[hidden\]\s*{\s*display:\s*none\s*!important;\s*}/);
});

test("the form on the add page loads nothing", () => {
  // The security header for /add says img-src 'self'. The usual way to put a
  // chevron on a dropdown is a data: URI as a background image, and a data:
  // URI is an image, so the browser would refuse it, draw no chevron, and say
  // nothing on the page. That is the same silent shape as the two bugs this
  // page has already had, so the rule is tested here rather than looked for
  // in a browser: the whole stylesheet fetches nothing at all.
  const html = renderAdd(API);
  const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  assert.ok(style.length > 0, "the stylesheet is inlined into the page");
  // The fetches the stylesheet makes are the typeface and the honeycomb
  // behind the board, both from this origin, since September 22, 2026.
  // Nothing else, and nothing from anywhere else.
  assert.ok(!style.replace(/url\("\/(fonts\/[^"]+|honeycomb\.svg)"\)/g, "").includes("url("), "nothing in the stylesheet fetches anything but the font and the honeycomb from here");
  assert.match(style, /\.select::after\s*{[^}]*border-right/, "the chevron is drawn with borders");
});

test("the add form does not make iOS zoom when a field is tapped", () => {
  // Safari on iOS zooms the page in when a control smaller than 16px takes
  // focus, and it does not zoom back out. The form would work and would feel
  // broken, which is the failure this page can least afford: it is the first
  // thing somebody sees of Birthed.
  const html = renderAdd(API);
  assert.match(html, /\.input,\s*\.select\s*>\s*select\s*{[^}]*font-size:\s*16px/);
});

test("the label the script rewrites holds nothing but its own words", () => {
  // When somebody has been asked for their birthday, the name stops being
  // optional and the script rewrites the label to say so. It used to do that
  // by reaching into the first child node of a label that also held a line
  // break and the input, so one extra element in front of that text would
  // have sent the rewrite nowhere and left "if you want" over a field that is
  // now required. Nothing on screen would have said so.
  const html = renderAdd(API);
  assert.match(
    html,
    /<label class="label" id="name-label" for="name">[^<]*<\/label>/,
    "the label contains text and no elements",
  );
  assert.ok(
    html.includes('document.getElementById("name-label").textContent = "Your name";'),
    "the rewrite replaces the whole content rather than one node inside it",
  );
  assert.ok(
    !html.includes("childNodes[0].nodeValue"),
    "nothing reaches into a particular child node of the label",
  );
});

test("every song year is its own address on the date page", () => {
  const songs = [
    { year: 1990, song: "Vision of Love", artist: "Mariah Carey", chartDate: "1990-09-08" },
    { year: 1989, song: "Cold Hearted", artist: "Paula Abdul", chartDate: "1989-09-09" },
  ];
  const html = renderDayPage(page, songs);
  // The long tail query is "number one song on September 5 1990", and the
  // answer is already on this page. The anchor is what makes that row
  // linkable without generating a page for every day and year.
  // The tile carries an animation delay now, so the opening tag no longer
  // ends at the id. Matched without the closing bracket: what this guards is
  // that the year is an address, not what else the tag carries.
  assert.match(html, /<li id="1990"/);
  assert.match(html, /<a class="wart" href="#1990"/);
  assert.match(html, /<li id="1989"/);
  assert.match(html, /scroll-margin-top/);
});

// ---------------------------------------------------------------------------
// The two routes that answer with a date rather than with a file, and the
// facts the front door shows. Both are new and both are the kind of thing
// that breaks quietly: a redirect that lands on a page that was never built
// is a 404 nobody sees until somebody presses the button.
// ---------------------------------------------------------------------------

test("random lands on a date that exists, every time", () => {
  // Both ends of the range, because the failure worth catching is an index
  // one past the end, which answers with undefined and a link to /undefined/.
  for (const roll of [0, 0.0001, 0.5, 0.999999, 1]) {
    const to = redirectFor("/random/", new Date(), () => roll);
    assert.ok(to !== null, `no answer for ${roll}`);
    assert.match(to!, /^\/[a-z]+-\d{1,2}\/$/, `${roll} gave ${to}`);
  }
});

test("random can reach all 366 and never anything else", () => {
  const seen = new Set<string>();
  for (let index = 0; index < 366; index++) {
    const to = redirectFor("/random/", new Date(), () => (index + 0.5) / 366);
    seen.add(to!);
  }
  assert.equal(seen.size, 366);
});

test("today is read six hours behind, which is the whole point of it", () => {
  // Nine in the evening in California on September 6. Coordinated Universal
  // Time is already September 7, and answering with September 7 is the bug
  // this offset exists to prevent.
  const evening = new Date("2026-09-07T04:00:00Z");
  assert.equal(redirectFor("/today/", evening), "/september-6/");
  // And it does roll over. Nine in the morning Central on the 7th.
  assert.equal(redirectFor("/today/", new Date("2026-09-07T15:00:00Z")), "/september-7/");
});

test("a path with no trailing slash is the same route", () => {
  assert.equal(redirectFor("/today", new Date("2026-03-02T18:00:00Z")), "/march-2/");
  assert.ok(redirectFor("/random") !== null);
});

test("nothing else is a redirect", () => {
  for (const path of ["/", "/september-4/", "/add/", "/privacy/", "/randomly/", "/today-ish/"]) {
    assert.equal(redirectFor(path), null, `${path} should be a file, not a redirect`);
  }
});

test("robots keeps the two redirects out of a crawl", () => {
  const robots = renderRobots();
  assert.ok(robots.includes("Disallow: /random"));
  assert.ok(robots.includes("Disallow: /today"));
  // And one browser's own record, which a crawler could only ever see empty.
  // docs/the-wall.md section 25.
  assert.ok(robots.includes("Disallow: /yours"));
});

// ---------------------------------------------------------------------------
// The private record. docs/the-wall.md section 25.
// ---------------------------------------------------------------------------

const RECORD: RecordRow[] = [
  { storyId: "11111111-1111-1111-1111-111111111111", headline: "Council approves the river crossing", wallDate: "2026-09-21", sealed: false, status: "pool", outcome: null },
  { storyId: "22222222-2222-2222-2222-222222222222", headline: "A headline with \"quotes\" & <script>", wallDate: "2026-09-09", sealed: true, status: "placed", outcome: null },
  { storyId: "33333333-3333-3333-3333-333333333333", headline: "The one that got there first", wallDate: "2017-06-12", sealed: true, status: "placed", outcome: "held" },
];

test("the record lists the stories this browser buzzed, and nothing that is a number", () => {
  const html = renderRecord(RECORD);
  for (const row of RECORD) {
    assert.ok(html.includes(`/wall/${row.storyId}/`), "every row links to its receipt");
  }
  assert.ok(html.includes("Council approves the river crossing"));
  assert.ok(html.includes("September 21, 2026"));
  assert.ok(html.includes("Open"));
  assert.ok(html.includes("On the board"));
  assert.ok(html.includes("Held"));
  // Section 25 refuses every number about the reader, and this is the test
  // that says so: no total, no rank, no streak, no count of anybody else.
  const body = html.slice(html.indexOf("<h1"));
  assert.ok(!/\b(\d+)\s+(buzzes|stories|backed)\b/i.test(body), `a count reached the page: ${body.slice(0, 200)}`);
  assert.ok(!/you have backed|your score|leaderboard/i.test(body));
  // And the page says out loud what it refuses to be, because this is the
  // page most likely to grow a number later.
  assert.ok(html.includes("it is not a score"));
  // A crawler carries no cookie, so the only page it could file is empty.
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
  // And no page on this site outside /add and /admin runs anything.
  assert.ok(!html.includes("<script"), "the record page runs nothing");
});

test("a headline on the record is the source's wording and is escaped where it is drawn", () => {
  const html = renderRecord(RECORD);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  // Never inside a style rule, which is the rule anniversaryBlock exists for:
  // escapeHtml does not apply inside a CSS content string, and a headline
  // carrying the characters that end a style element would spill the page.
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((m) => m[1]).join(" ");
  assert.ok(!styles.includes("quotes"), "a source's words never go in a style rule");
});

test("an empty record says why it might be empty, and a failed read never says nothing", () => {
  const empty = renderRecord([]);
  assert.ok(empty.includes("Nothing here yet"));
  assert.ok(empty.includes("clearing it empties this list"), "a cleared cookie is explained rather than left to look like a loss");
  assert.ok(empty.includes("still count"));
  const failed = renderRecord([], true);
  assert.ok(failed.includes("could not be read just now"));
  assert.ok(!failed.includes("Nothing here yet"), "an outage must never read as an empty record");
});

const HIGHLIGHT_FACT: Fact = {
  id: "t", month: 8,
  day: 15,
  fact: "On August 15, 1998, Apple began shipping the original Bondi Blue iMac G3 personal computer.",
  category: "release",
  sourceUrl: "https://en.wikipedia.org/wiki/IMac_G3",
};

test("a fact is taken apart into a year and the rest of the sentence", () => {
  const highlight = asHighlight(HIGHLIGHT_FACT);
  assert.ok(highlight);
  assert.equal(highlight!.year, 1998);
  // The opening is gone, because the badge beside it already says the date.
  assert.ok(!highlight!.text.startsWith("On August 15"));
  assert.ok(highlight!.text.startsWith("Apple began shipping"));
});

test("a sentence that opens with somebody else's date is refused", () => {
  // A row filed under August 15 whose sentence is about August 16 is a data
  // problem, and putting it on the front door under an August 15 badge would
  // print something false on the most read page on the site.
  const wrong = { ...HIGHLIGHT_FACT, day: 16 };
  assert.equal(asHighlight(wrong), null);
  // And so is one that does not open the expected way at all.
  assert.equal(asHighlight({ ...HIGHLIGHT_FACT, fact: "Apple shipped the iMac." }), null);
});

test("the front door takes at most one fact per month", () => {
  const facts: Fact[] = [];
  for (let month = 1; month <= 12; month++) {
    for (let copy = 0; copy < 4; copy++) {
      facts.push({
        id: `t${month}-${copy}`,
        month,
        day: copy + 1,
        fact: `On ${MONTH_WORDS[month - 1]} ${copy + 1}, 19${50 + copy}, something worth reading happened and it was written down in a sentence of a reasonable length.`,
        category: "event",
        sourceUrl: "https://en.wikipedia.org/wiki/Test",
      });
    }
  }
  const picked = pickHighlights(facts, 6, 12345);
  assert.equal(picked.length, 6);
  assert.equal(new Set(picked.map((row) => row.month)).size, 6, "a month appeared twice");
  // Calendar order, so the strip reads as a walk through the year.
  for (let index = 1; index < picked.length; index++) {
    assert.ok(picked[index]!.month > picked[index - 1]!.month);
  }
});

test("the same seed deals the same hand, and a different one does not", () => {
  const facts: Fact[] = [];
  for (let month = 1; month <= 12; month++) {
    for (let copy = 0; copy < 6; copy++) {
      facts.push({
        id: `t${month}-${copy}`,
        month,
        day: copy + 1,
        fact: `On ${MONTH_WORDS[month - 1]} ${copy + 1}, 19${40 + copy}, number ${copy} of the things that happened that day happened, and here is the rest of the sentence.`,
        category: "event",
        sourceUrl: "https://en.wikipedia.org/wiki/Test",
      });
    }
  }
  const one = pickHighlights(facts, 6, 777).map((row) => row.text).join("|");
  const same = pickHighlights(facts, 6, 777).map((row) => row.text).join("|");
  const other = pickHighlights(facts, 6, 778).map((row) => row.text).join("|");
  assert.equal(one, same, "a build is not reproducible");
  assert.notEqual(one, other, "the seed does nothing");
});

test("no facts is a missing section rather than a heading over nothing", () => {
  const html = renderHome(2026, []);
  assert.ok(!html.includes("Every date has a day like this in it"));
  // And the page still works.
  assert.ok(html.includes('href="/calendar/"') && html.includes("How to play"));
});

test("the front door still runs nothing", () => {
  // The site sends default-src 'none'. Every piece of behaviour on this page
  // is a link, a fragment or a stylesheet rule, and it has to stay that way.
  const html = renderHome(2026, pickHighlights([HIGHLIGHT_FACT], 6, 1));
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("onclick"));
});

const MONTH_WORDS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];


test("the page carries every event, and none of them is behind a fold", () => {
  // The reason this matters is not tidiness. The whole list is what answers a
  // search for any one of these events, so a page that showed six and dropped
  // thirty seven would be a page that stopped answering thirty seven queries.
  // Closed is a display state; absent is a different page.
  const many = Array.from({ length: 20 }, (unused, index) => ({
    id: `t${index}`,
    month: 9,
    day: 4,
    year: 1500 + index * 25,
    sourceUrl: "https://en.wikipedia.org/wiki/September_4",
    description: `the thing that happened in ${1500 + index * 25}`,
  }));
  // The drawer is gone, decided September 10, 2026: the whole feed is on the
  // page, the way a reddit reads its feed. Absent is still a different page.
  const html = renderDayPage(page, [], [], many);
  assert.ok(!html.includes("<details class="), "nothing is folded");
  for (const event of many) {
    assert.ok(html.includes(event.description), `${event.year} is not on the page at all`);
  }
});

test("a date page can be moved off in both directions without reaching the foot", () => {
  const html = renderDayPage(page);
  const nameAt = html.indexOf("<h1>September 4</h1>");
  assert.ok(nameAt > 0, "the name has to exist for this slice to mean anything");
  const bar = html.slice(html.indexOf('<div class="daybar">'), nameAt);
  assert.ok(bar.includes('href="/september-3/"'), "the day before is not reachable from the bar");
  assert.ok(bar.includes('href="/september-5/"'), "the day after is not reachable from the bar");
  // The pair of cards at the foot is gone, decided September 10, 2026: the
  // bar already does this and the head names both neighbours for a crawler.
  assert.ok(!html.includes('<nav class="pager cards">'));
  assert.ok(html.includes('<link rel="prev" href="https://birthed.app/september-3/">'));
  assert.ok(html.includes('<link rel="next" href="https://birthed.app/september-5/">'));
  // The index of all 366 is its own page now, linked from the bar.
  assert.ok(bar.includes('href="/calendar/"'));
  assert.ok(bar.includes("<span>Every date</span>"));
  assert.ok(!html.includes('class="everyday"'));
});

test("Today, Every date, Random, About and Get the app are five of the same control, each with its own mark and its word", () => {
  const html = renderDayPage(page);
  const bar = html.slice(html.indexOf('<span class="barend">'), html.indexOf("</span>\n</div>"));
  const pills = bar.match(/<a class="pill[ "]/g) ?? [];
  assert.equal(pills.length, 5, "five matching pills, not one pill and bare words");
  assert.equal((bar.match(/<svg class="ic"/g) ?? []).length, 5, "a drawn mark on each, not an emoji");
  const words = ["Today", "Every date", "Random", "About", "Get the app"];
  for (const word of words) assert.ok(bar.includes(`<span>${word}</span>`), `the word ${word} stays next to its mark`);
  // In that order: the same words in the same order on every page is what
  // makes a site read as one site. September 22, 2026.
  const at = words.map((word) => bar.indexOf(`<span>${word}</span>`));
  assert.deepEqual([...at].sort((a, b) => a - b), at, "the pills are in one order");
  // The way to the app, from every date page, September 22, 2026.
  assert.ok(bar.includes('href="https://testflight.apple.com/join/hzm6Mhhm"'));
  assert.ok(!bar.includes('class="get"') && !bar.includes('class="dice"'), "the old shapes are gone");
});

test("every page draws the same bar", () => {
  const bar = (html: string) => html.slice(html.indexOf('<span class="barend">'), html.indexOf("</span>\n</div>"));
  const day = bar(renderDayPage(page));
  const wallDay = { wallDate: "2026-09-04", year: 2026, month: 9, day: 4, opensAt: "2026-09-03T04:00:00Z", liveAt: "2026-09-04T04:00:00Z", closesAt: "2026-09-06T04:00:00Z", closedAt: null, stories: [] };
  for (const [name, html] of [
    ["about", renderHome(2026)],
    ["calendar", renderCalendarPage(2026)],
    ["support", renderSupport()],
    ["privacy", renderPrivacy()],
    ["hive", renderHivePage(wallDay, 9, 4)],
    ["comb", renderCombPage(wallDay, 9, 4)],
  ] as const) {
    assert.equal(bar(html), day, `${name} carries the date page's bar`);
    assert.ok(!html.includes("Back to the day") && !html.includes("Random day"), `${name} has no second set of words`);
  }
});

test("every date wears the honey, and the brand pink is not it", () => {
  // Until September 22, 2026 each month had its own hue. One look now, the
  // live hive's, so the second colour on every date page is the honey and
  // March and September are the same page with different names on them.
  const september = renderDayPage(page);
  // Not pinned to the whole opening tag. That wrapper also carries the class
  // naming its own date, which is how the per-request stylesheet knows whether
  // this page is one of the three taking answers today.
  assert.match(september, /<div class="day [^"]*" style="--day:var\(--honey\);--day-soft:var\(--honey-lite\)"/);
  assert.match(september, /class="day on-september-4"/);
  const march = renderDayPage({ month: 3, day: 12, people: [] });
  const hueOf = (html: string) => /--day:([^;"]+)/.exec(html)?.[1];
  assert.equal(hueOf(september), hueOf(march), "one second colour on every page");
  assert.ok(!september.includes("--day:#EF5680"), "the pink is the wordmark and nothing else");
});


test("the 366 date pages say in their heads that they are one ordered run", () => {
  const html = renderDayPage(page);
  assert.match(html, /<link rel="prev" href="https:\/\/birthed\.app\/september-3\/">/);
  assert.match(html, /<link rel="next" href="https:\/\/birthed\.app\/september-5\/">/);
});

test("the year wraps at both ends rather than running off it", () => {
  const newYear = renderDayPage({ month: 1, day: 1, people: [] });
  assert.match(newYear, /<link rel="prev" href="https:\/\/birthed\.app\/december-31\/">/);
  const lastDay = renderDayPage({ month: 12, day: 31, people: [] });
  assert.match(lastDay, /<link rel="next" href="https:\/\/birthed\.app\/january-1\/">/);
});

// ---------------------------------------------------------------------------
// Saying which kind of day the date actually is.
//
// The column has existed since the cultural table did and the page never
// selected it, so a row whose date is "the week this broke out, nobody knows
// when it was posted" printed a bare year and claimed the same confidence as
// a row read straight off a timestamp. docs/internet-culture.md rule two
// calls that the interesting part.

const cultural = (over = {}) => ({
  id: "7",
  month: 9, day: 4, year: 2015,
  title: "A meme starts",
  context: "Somebody posted a picture and everybody copied it.",
  sourceUrl: "https://knowyourmeme.com/memes/example",
  category: "meme",
  origin: "imported",
  ...over,
});

test("a row dated to when it spread says so, and explains itself once", () => {
  const html = renderDayPage(page, [], [], [], [cultural({ dateKind: "went_viral" })]);
  assert.ok(html.includes("when it spread, not when it was posted"),
    "the honest label is the differentiator and it has to reach the page");
  assert.ok(html.includes("the original posting is gone or was never recorded"),
    "a label a reader cannot interpret is decoration, so the page defines it once");
});

test("an exact posting date and a shutdown are labelled too", () => {
  const posted = renderDayPage(page, [], [], [], [cultural({ dateKind: "posted" })]);
  assert.ok(posted.includes("the exact day it was posted"));
  const ended = renderDayPage(page, [], [], [], [cultural({ dateKind: "ended" })]);
  assert.ok(ended.includes("the day it ended"));
});

test("an ordinary dated event carries no label at all", () => {
  // "happened" is the case a reader already assumes. Printing it on most of
  // the page would make the labels wallpaper and cost the other two their
  // weight, which is the whole reason they are worth printing.
  const html = renderDayPage(page, [], [], [], [cultural({ dateKind: "happened" })]);
  assert.ok(!html.includes('class="datenote"'), "the ordinary case is not annotated");
  assert.ok(!html.includes("the original posting is gone"), "and it does not drag in the footnote");
});

test("a row from before the column existed is not annotated either", () => {
  const html = renderDayPage(page, [], [], [], [cultural({})]);
  assert.ok(!html.includes('class="datenote"'));
});

// ---------------------------------------------------------------------------
// The words are on the page.
//
// These exist because of a real outage rather than out of thoroughness. A new
// feature introduced a class called "said" and set display:none on it, and
// ".said" has been the event sentence, the fact text and
// the song title since long before that. Every event on birthed.app went blank
// and the page still looked plausible: cards, years, source lines, no words.
//
// docs/handoff.md already recorded two collisions, .here and .when, and both
// were caught by a test asserting the absence of something. This one reached
// production because nothing asserted the presence of anything.

test("the event sentence is actually rendered, not just its card", () => {
  const events = [
    { id: "t", month: 9, day: 4, year: 1888, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "George Eastman registers the trademark Kodak." },
  ];
  const html = renderDayPage(page, [], facts, events);
  assert.ok(html.includes("George Eastman registers the trademark Kodak."),
    "the sentence must be in the markup");
  assert.equal(html.includes(".said {\n  display: none"), false,
    "and nothing may blanket-hide the class it is rendered in");
});

test("no class that carries a sentence is hidden by default", () => {
  const html = renderDayPage(page, [], facts, [
    { id: "t", month: 9, day: 4, year: 1888, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "George Eastman registers the trademark Kodak." },
  ], [cultural({})]);
  const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));

  // Named rather than derived. A general rule tried first and produced a false
  // alarm on .pick, which IS hidden and IS revealed, by a generated per-year
  // selector the pattern could not see. A test that cries wolf gets deleted by
  // the next person, so this one names the classes that carry words instead.
  for (const name of ["said", "ctx", "n", "w", "x", "tbig", "tsub", "mtx"]) {
    const hidden = new RegExp(`\\.${name}\\s*\\{[^}]*display:\\s*none`);
    assert.equal(hidden.test(style), false,
      `.${name} carries text on this page and something hides it`);
  }
});







test("the year control is hidden until a date is open, like the buttons", () => {
  const html = renderDayPage(page);
  // Matched loosely on purpose: the rule gained spacing and this test is
  // about the control being hidden until a date is open, not about its margins.
  assert.match(html, /\.yearask \{[^}]*display: none/);
});


// Two candidates from the same decade are one candidate as far as a reader is
// concerned, because the question the card asks is about a time in their life.
// Real sentences off the live September 8 page, pasted rather than invented,
// because this is the bug they found. Fourteen rows on that date are from 1958
// on and exactly one became a candidate, so that one card carried all five
// rotation slots and the page never changed however many times anybody
// reloaded it. Thirteen of them died on a 110 character limit written for the
// share image, not on the word screens: Star Trek's first broadcast is 139
// characters and McGwire's 62nd home run is 168. The survivor, at 94, was a
// routine space station resupply flight. The shortest sentence on a date is
// not the most memorable thing that happened on it, and a limit that admits
// only the shortest admits only the dullest.
// Every one of these is a real row from the live September 11 page. The screen
// matched "bomb" and not "bombs", and "attack" and not "attacks", so on the
// anniversary of the attacks one reload in five dealt "Russia tests the
// largest conventional weapon ever, the Father of All Bombs" under the words
// "Do you remember this one?". Singular forms only was a hole straight through
// a screen whose entire job is to catch this, and the plural of a word for a
// killing is still a word for a killing.
// 326 of 357 published culture rows were an imported title and nothing else,
// which renders as a game's name followed by "is released". The writing is the
// bar, because the writing is the thing a reader came for.
test("a culture row with nothing written about it is not on the page", () => {
  const page = { month: 9, day: 11, people: [] };
  const withSentence = {
    id: "1", month: 9, day: 11, year: 2015, title: "Super Mario Maker is released",
    context: "Nintendo shipped the level editor and people spent a decade making levels nobody could finish.",
    sourceUrl: "https://example.com/1", category: "gaming", origin: "imported", dateKind: "happened",
  };
  const bare = {
    id: "2", month: 9, day: 11, year: 2009, title: "Mini Ninjas is released",
    context: null, sourceUrl: "https://example.com/2", category: "gaming",
    origin: "imported", dateKind: "happened",
  };
  const html = renderDayPage(page, [], [], [], [withSentence, bare]);
  assert.ok(html.includes("Nintendo shipped the level editor"), "a row somebody wrote about stays");
  assert.equal(html.includes("Mini Ninjas"), false, "a bare title does not");
});


test("the day's biggest lead the list, and the rest still read newest first", () => {
  const events = [
    { id: "ny", month: 9, day: 8, year: 1664, sourceUrl: "https://e.com/1", description: "New Amsterdam was renamed New York." },
    { id: "dull", month: 9, day: 8, year: 2000, sourceUrl: "https://e.com/2", description: "A routine resupply flight went up." },
    { id: "mid", month: 9, day: 8, year: 1975, sourceUrl: "https://e.com/3", description: "Something in 1975." },
    { id: "old", month: 9, day: 8, year: 1400, sourceUrl: "https://e.com/4", description: "Something in 1400." },
  ];
  const big = new Map([["9-8", new Map([[1664, "New Amsterdam was renamed New York in honour of the Duke of York"]])]]);
  const html = renderDayPage({ month: 9, day: 8, people: [] }, [], [], events, [], null, new Map(), big);

  const feed = html.slice(html.indexOf('<ul class="wlist hist">'));
  assert.ok(feed.indexOf("New York") < feed.indexOf("resupply"),
    "the selected row leads even though it is the oldest thing here");

  // Nothing about the selection is printed. It decides order and says nothing.
  // (The birthday picker's placeholder option carries a "selected" attribute,
  // so the guard is the curation wording, not the bare word.)
  assert.equal(html.includes("Wikipedia's editors"), false);
  assert.equal(html.includes("the day's selection"), false);
  assert.equal(html.includes("selected anniversar"), false);
});


test("a plural does not walk a heavy row onto the card", () => {
  const rows = [
    { kind: "historical_event" as const, id: "bomb", year: 2007, text: "Russia tests the largest conventional weapon ever, the Father of All Bombs.", sourceUrl: "https://e.com/1", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "att", year: 2001, text: "Nineteen members of al-Qaeda execute the September 11 attacks, a series of coordinated terrorist attacks.", sourceUrl: "https://e.com/2", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "fire", year: 2012, text: "A total of 315 people are killed in two garment factory fires in Pakistan.", sourceUrl: "https://e.com/3", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "ok", year: 1997, text: "NASA's Mars Global Surveyor reaches Mars.", sourceUrl: "https://e.com/4", category: null, dateKind: null },
  ];
  const texts = askCandidates(rows).map((r) => r.text);
  assert.ok(texts.some((t) => t.includes("Mars Global Surveyor")), "the one row that may lead does");
  assert.equal(texts.length, 1, "and it is the only candidate on the date");
  for (const word of ["Bombs", "attacks", "killed"]) {
    assert.ok(!texts.some((t) => t.includes(word)), word + " never leads a birthday page");
  }
});

test("the real September 8 rows fill the rotation instead of starving it", () => {
  const rows = [
    { kind: "historical_event" as const, id: "s0", year: 1966, text: "UNESCO proclaimed International Literacy Day to highlight the importance of literacy for people and communities globally.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s1", year: 2016, text: "NASA launched the OSIRIS-REx spacecraft on a mission to travel to asteroid Bennu and collect sample material to return to Earth.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s2", year: 1960, text: "In Huntsville, Alabama, US President Dwight D. Eisenhower formally dedicates the Marshall Space Flight Center (NASA had already activated the facility on July 1).", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s3", year: 1966, text: "The science fiction television series Star Trek made its broadcast television debut in the United States on NBC with the episode The Man Trap.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s4", year: 1971, text: "In Washington, D.C., the John F. Kennedy Center for the Performing Arts is inaugurated, with the opening feature being the premiere of Leonard Bernstein's Mass.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s5", year: 1974, text: "Watergate scandal: US President Gerald Ford signs the pardon of Richard Nixon for any crimes Nixon may have committed while in office.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s6", year: 1986, text: "Nicholas Daniloff, a correspondent for U.S. News & World Report, is indicted on charges of espionage by the Soviet Union.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s7", year: 1998, text: "Mark McGwire of the St. Louis Cardinals hit his 62nd home run of the season, breaking the Major League Baseball single-season home run record set by Roger Maris in 1961.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s8", year: 2000, text: "NASA launches Space Shuttle Atlantis on STS-106 to resupply the International Space Station.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s9", year: 2017, text: "Syrian civil war: The Syrian Democratic Forces (SDF) announce the beginning of the Deir ez-Zor campaign, with the stated aim of eliminating the Islamic State (IS) from all areas north and east of the Euphrates.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
  ];
  const picked = askCandidates(rows);
  assert.equal(picked.length, ASK_SLOTS, "every slot has its own card");

  const texts = picked.map((row) => row.text);
  assert.ok(texts.some((t) => t.includes("McGwire")), "the row the proposal assumed would lead is one now");

  // And here is the limit of doing this with arithmetic, written down rather
  // than tuned away. The best row on this date, by any reader's judgement, is
  // Star Trek going out for the first time in 1966. It is not here. It is
  // outside the 1985 to 2015 window, so it scores below five in-window rows,
  // and inside its own decade the scorer prefers International Literacy Day
  // anyway because that sentence is eighteen characters shorter.
  //
  // Nothing measurable about those two sentences says which one people
  // remember. No constant added here fixes it, and one tuned until Star Trek
  // won would be fitted to this one date. That is the argument for a person
  // writing the lead line, not for another number.
  assert.ok(!texts.some((t) => t.includes("Star Trek")), "recorded, not endorsed");

  // The word screens are untouched. A civil war is still never a candidate,
  // whatever room the card has.
  assert.ok(!texts.some((t) => t.includes("Syrian")), "a war is not a card, at any length");

  // And no two from the same ten years while there is anything else left.
  const decades = picked.map((row) => Math.floor((row.year ?? 0) / 10));
  assert.equal(new Set(decades).size, decades.length, "one per decade");
});

// The judgement the scorer cannot make, kept where a person can put it. The
// row keeps its own sentence and its own source; this is the card's wording.
test("a written lead line leads its date, in the words a person wrote", () => {
  const events = [
    { id: "trek", month: 9, day: 4, year: 1966, sourceUrl: "https://en.wikipedia.org/wiki/September_8",
      description: "The science fiction television series Star Trek made its broadcast television debut in the United States on NBC with the episode The Man Trap." },
    { id: "dull", month: 9, day: 4, year: 2000, sourceUrl: "https://en.wikipedia.org/wiki/September_8",
      description: "NASA launches Space Shuttle Atlantis on STS-106 to resupply the International Space Station." },
  ];
  const lines = new Map([["historical_event:trek", "Star Trek went out for the first time."]]);
  const html = renderDayPage(page, [], [], events, [], null, lines);

  // Without a line, Star Trek is 139 characters and out of the window, and the
  // resupply flight leads. With one, it leads, and the row reads the line.
  const feed = html.slice(html.indexOf('<ul class="wlist hist">'));
  assert.ok(feed.indexOf('id="r-historical_event-trek"') < feed.indexOf('id="r-historical_event-dull"'));
  assert.equal(html.split("Star Trek went out for the first time.").length, 2,
    "the written line is on the page once, on its row");
  assert.ok(!html.includes("made its broadcast television debut"), "and it stands in for the record, not beside it");
});

// A written line is eight words and could be gentle about anything. What the
// card is really about is the row underneath it, so the word screens read that
// and not the line.
test("a lead line cannot walk a heavy row onto the card", () => {
  const events = [
    { id: "grim", month: 9, day: 4, year: 1999, sourceUrl: "https://en.wikipedia.org/wiki/September_8",
      description: "A bombing at a school killed forty people." },
  ];
  const lines = new Map([["historical_event:grim", "A day people still talk about."]]);
  const html = renderDayPage(page, [], [], events, [], null, lines);
  assert.equal(html.includes('<section class="ask '), false, "no card, however the line is worded");
});

test("the candidates are spread across decades before the list is filled up", () => {
  const rows = [
    { kind: "historical_event" as const, id: "1", year: 1996, text: "One.", sourceUrl: "https://e.com/1", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "2", year: 1997, text: "Two.", sourceUrl: "https://e.com/2", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "3", year: 2004, text: "Three.", sourceUrl: "https://e.com/3", category: null, dateKind: null },
  ];
  const picked = askCandidates(rows, 2);
  assert.equal(picked.length, 2);
  const decades = picked.map((r) => Math.floor((r.year ?? 0) / 10));
  assert.notEqual(decades[0], decades[1],
    "one from each decade before a second from either");
});

test("the first ask stays away from years with no record beside them", () => {
  const events = [
    { id: "a", month: 9, day: 4, year: 1888, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "George Eastman registers the trademark Kodak." },
  ];
  const html = renderDayPage(page, [], [], events);
  assert.equal(html.includes('<section class="ask '), false, "nothing from 1958 on, so no ask");
  assert.ok(html.includes('id="r-historical_event-a"'), "and the row keeps its own anchor in the feed");
});

test("the about page explains what the site does before what is on a page", () => {
  const html = renderHome(2026, []);
  // The game first, since September 22, 2026: the front door is a date now.
  assert.ok(html.includes("Every date has a hive."));
  // The underline needs its own colour named. The headline is painted with a
  // gradient and its text colour is transparent, so an underline left on
  // currentColor is drawn in transparent and nothing appears under the word.
  assert.match(html, /\.brandword \{[^}]*text-decoration-color: #EF5680/);
  // The steps, in order, because the thing this site does is a sequence and a
  // reader who does not know it needs the order more than the detail.
  let at = 0;
  for (const step of ["Open a date", "Spend your three buzzes", "Yesterday gets one more", "Midnight seals it", "Come back next year"]) {
    const found = html.indexOf(step, at);
    assert.ok(found > at, `the page lost the step, or moved it: ${step}`);
    at = found;
  }
  // The rule that everything else rests on, said to a stranger in one clause.
  assert.ok(html.includes("no way to say a thing did not matter"));
});

test("the about page no longer floats an app icon above the headline", () => {
  const html = renderHome(2026, []);
  assert.equal(html.includes("heroart"), false);
  assert.equal(html.includes("icon-192.png"), false, "the hero image is gone");
  // And the animation that only it used went with it, rather than being left
  // in the stylesheet for something that no longer exists.
  assert.equal(html.includes("@keyframes bob"), false);
});

test("the four beats stack, rather than inheriting the flex row every list gets", () => {
  // There is a bare `li { display: flex }` in the stylesheet, written for the
  // lists where a year sits beside a name. It applies to every list item on
  // the site, so a card that does not override it turns its number, heading
  // and paragraph into three columns and wraps the heading one word to a line.
  // Nothing fails and nothing logs. It just looks like nobody designed it.
  const html = renderHome(2026, []);
  assert.match(html, /\.beats li \{[^}]*display: block/);
});

test("the link preview says what the site does, not what is on a page", () => {
  const html = renderHome(2026, []);
  // A description that disagreed with the page would be the one thing most
  // people read before deciding whether to open it.
  assert.match(html, /<meta name="description" content="Every date has a hive\./);
});



/**
 * Every animation on a date page lives inside the no-preference media query,
 * so the page is complete with all of it off. Walks the stylesheet with a
 * brace counter rather than a regex, because a regex cannot tell an
 * animation inside the block from one that follows it.
 */
function animationsOutsideMotionBlocks(css: string): string[] {
  const out: string[] = [];
  const open = "@media (prefers-reduced-motion: no-preference)";
  const openMin = "@media (prefers-reduced-motion:no-preference)";
  let depth = 0;
  let inside = false;
  let insideDepth = 0;
  let i = 0;
  while (i < css.length) {
    if (!inside && (css.startsWith(open, i) || css.startsWith(openMin, i))) {
      inside = true;
      insideDepth = depth;
    }
    const ch = css[i];
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (inside && depth === insideDepth) inside = false;
    }
    if (!inside && css.startsWith("animation:", i) && !css.startsWith("animation: none", i)) {
      out.push(css.slice(Math.max(0, i - 60), i + 40).replace(/\s+/g, " "));
    }
    i++;
  }
  return out;
}

test("no animation on a date page plays when the reader asked for reduced motion", () => {
  const html = renderDayPage(page);
  const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  // The keyframes themselves are allowed anywhere; they do nothing until
  // something names them.
  const stray = animationsOutsideMotionBlocks(style).filter((s) => !s.includes("@keyframes"));
  assert.deepEqual(stray, [], "an animation sits outside the motion block");
  // The four the motion work added are present, by name, so this test cannot
  // pass by the block being empty.
  for (const name of ["burn", "rise", "rail", "breathe"]) {
    assert.ok(style.includes(`@keyframes ${name}`), `${name} keyframes are baked`);
  }
  assert.ok(style.includes(":target .mine { animation: rise"), "the reader's own mark lands after it");
  assert.ok(style.includes(".afterword:target { animation: rise"), "the sentence at the top lands");
  assert.ok(style.includes(".ask .rem button:nth-child(7) { animation-delay: 315ms; }"), "the three buttons arrive one beat apart");
  // The press state is a transform on :active and the transition that
  // softens it is switched off for reduced motion, in the reduce block.
  assert.ok(style.includes(".rem button:active, .yeardecs label:active, .yg button:active { transform: scale(.96); }"));
  const reduce = style.slice(style.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.ok(reduce.includes(".rem button, .yeardecs label, .yg button { transition: none; }"));
  // Nothing breathes in the baked sheet. Only today.css may start that, on an
  // open date.
  assert.equal(style.includes("animation: breathe"), false, "the dot only breathes when today.css says the date is open");
});

test("the reader's panel says Your only on the reader's own date, and prints no raw year", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  const own = renderMePanel(9, 4, { year: 1991, month: 9, day: 4 }, now);
  assert.ok(own.includes("Your September 4"));
  assert.ok(own.includes("You have been alive for 35 years."));
  assert.ok(own.includes("Born in the 1990s."));
  assert.ok(own.includes("You are older than the PlayStation, Amazon and Google."));
  // The exact birth year is never printed: the site keeps it off the page.
  assert.ok(!own.includes("1991"));
  assert.ok(!own.includes("Save your card"), "off for now, September 22, 2026");
  // A younger reader gets both sides of the world line.
  const young = renderMePanel(9, 4, { year: 2005, month: 9, day: 4 }, now);
  assert.ok(young.includes("You are older than the iPhone, Bitcoin and Instagram."));
  assert.ok(/were already here when you arrived\./.test(young));
  // A birthday not yet reached this year is a year younger.
  assert.ok(renderMePanel(12, 25, { year: 2010, month: 12, day: 25 }, now).includes("alive for 15 years"));
});

test("on somebody else's date the panel names the reader's own date and their real age", () => {
  const now = new Date("2026-09-22T12:00:00Z");
  // Hana's test, September 22, 2026: June 15, 1990, read on September 22.
  const other = renderMePanel(9, 22, { year: 1990, month: 6, day: 15 }, now);
  assert.ok(!other.includes("Your September 22"), "the page's date is not the reader's");
  assert.ok(other.includes("Your birthday is June 15"));
  assert.ok(other.includes("You have been alive for 36 years."));
  assert.ok(other.includes('href="/june-15/"'), "and the way to their own date");
  assert.ok(other.includes("This is September 22, not your date."));
  assert.ok(!/the number one song the week you were born/i.test(other), "no week is promised on a date that is not theirs");
  assert.ok(!/1990(?!s)/.test(other), "the decade, never the year");
  // The age comes from the real birthday, not from the page: born December
  // 25, 1990, the reader is 35 on September 22, 2026 whichever page is open.
  assert.ok(renderMePanel(3, 1, { year: 1990, month: 12, day: 25 }, now).includes("alive for 35 years"));
});

test("a cookie from before the whole birthday was kept says only what a year can support", () => {
  const now = new Date("2026-09-22T12:00:00Z");
  const legacy = renderMePanel(9, 22, 1990, now);
  assert.ok(!legacy.includes("Your September 22"));
  assert.ok(legacy.includes("Your birthday"));
  assert.ok(legacy.includes("You turn 36 this year."));
  assert.ok(legacy.includes('href="#birthday"'), "and the way to add the month and day");
  assert.ok(!/1990(?!s)/.test(legacy), "the decade, never the year");
});

test("the panel promises a number one song only to a reader the charts cover", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  const on = (year: number) => renderMePanel(9, 4, { year, month: 9, day: 4 }, now);
  // Born before the strip begins: told so plainly, and still pointed below.
  const before = on(1950);
  assert.ok(before.includes("The charts this site uses begin in 1959, so there is no number one song for the week you were born."));
  assert.ok(before.includes("Below: everyone who shares September 4 and everything that ever happened on your date."));
  assert.ok(!/the number one song the week you were born/i.test(before));
  // 1958 is deliberately not imported, so it is on the wrong side of the line.
  assert.ok(on(1958).includes("begin in 1959"));
  // From the first chart year on, the promise stands.
  const first = on(1959);
  assert.ok(/the number one song the week you were born/i.test(first));
  assert.ok(first.includes('href="/september-4/comb/#comb-songs"'), "and it is on the comb now");
  assert.ok(!first.includes("begin in 1959"));
  assert.ok(/the number one song the week you were born/i.test(on(1994)));
});

test("render.ts and build.ts agree on the first chart year", async () => {
  // build.ts runs the build on import, so its constant is read from the
  // source text rather than imported.
  const source = await readFile(new URL("../../src/build.ts", import.meta.url), "utf8");
  const match = /const FIRST_CHART_YEAR = (\d{4});/.exec(source);
  assert.ok(match, "build.ts declares FIRST_CHART_YEAR");
  assert.equal(FIRST_CHART_YEAR, Number(match![1]));
  assert.equal(FIRST_CHART_YEAR, 1959);
});

test("withMe fills the marker, and leaves a page with no marker alone", () => {
  const page = `<h1>x</h1>${meMarker()}<p>rest</p>`;
  const filled = withMe(page, "<section class=\"me\">panel</section>");
  assert.ok(filled.includes('<section class="me">panel</section>'));
  assert.ok(!filled.includes("me:start"));
  assert.equal(withMe("<h1>no marker</h1>", "<section>x</section>"), "<h1>no marker</h1>");
  assert.equal(withMe(page, null), page);
});


test("the stylesheet is sent without its comments, and nothing in it depends on one", () => {
  const html = renderDayPage(page);
  const style = html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"));
  assert.ok(!style.includes("/*"), "no comment reaches the page");
  assert.ok(style.includes(".wcomb {"), "and the rules are all still there");
  assert.equal(stripCss('a { content: "x"; } /* why */\n\n\n  b { color: red; }'), 'a { content: "x"; } \nb { color: red; }');
});
