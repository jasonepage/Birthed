// Decade teams, docs/the-wall.md section 30. Counted by buzzes, the news is
// the 2020s, nothing with no buzzes, and nothing about a reader.
import { strict as assert } from "node:assert";
import { test } from "node:test";

import { HIVE_DECADES_JS, bornOf, decadeLine, decadeOf, decadeStanding, generationOf, hiveDecades, yearOf } from "../src/decades.js";
import { HIVE_LIVE_JS, liveHiveSection } from "../src/hive-live.js";
import { BEE, PLAIN, decadesBlock, wallSection, type WallDay, type WallStory } from "../src/wall.js";

function story(id: string, headline: string, o: Partial<WallStory> = {}): WallStory {
  return {
    id, wallDate: "2026-09-23", submittedAt: "2026-09-22T04:00:00Z", headline,
    url: `https://www.example.org/${id}`, outlet: "example.org", status: "placed", tier: "claimed",
    support: 0, priority: 1, placedAt: "2026-09-23T04:00:00Z", rect: { mx: 0, my: 0, w: 4, h: 3 }, falseAt: null, falseNote: null,
    subjectKind: "person", subjectId: id, sources: [], ...o,
  };
}
function day(stories: WallStory[], o: Partial<WallDay> = {}): WallDay {
  return {
    wallDate: "2026-09-23", year: 2026, month: 9, day: 23,
    opensAt: "2026-09-22T04:00:00Z", liveAt: "2026-09-23T04:00:00Z", closesAt: "2026-09-25T04:00:00Z", closedAt: null,
    stories, boosts: [], ...o,
  };
}
const NOW = Date.parse("2026-09-23T20:00:00Z");
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const C = "cccccccc-0000-4000-8000-000000000003";
const D = "dddddddd-0000-4000-8000-000000000004";

test("every kind of tile carries a year, and the news is this year", () => {
  assert.equal(yearOf(story(A, "Bruce Springsteen, American rock singer (born 1949), born 1949")), 1949);
  assert.equal(decadeOf(story(A, "Typhoid Mary, infected houseworker in New York City, born 1869")), 1860);
  assert.equal(decadeOf(story(A, "1956: The dike around the Dutch polder East Flevoland is closed.", { subjectKind: "historical_event" })), 1950);
  assert.equal(decadeOf(story(A, '1992: "End of the Road" by Boyz II Men was the number one song', { subjectKind: "song" })), 1990);
  assert.equal(decadeOf(story(A, "On September 21, 1784, the Pennsylvania Packet began publishing as the first successful daily newspaper in the United States.", { subjectKind: "birth_fact" })), 1780);
  assert.equal(decadeOf(story(A, "Major news outlets banned by Trump will have their day in court", { subjectKind: null, subjectId: null })), 2020);
  assert.equal(decadeOf(story(A, "Somebody with no year at all")), null);
  assert.equal(decadeOf(story(A, "44: something before the common era, refused upstream", { subjectKind: "historical_event" })), null, "a year needs three digits");
});

test("zero buzzes: no line; one: a leader; three across two decades: the most first, older first on a tie", () => {
  const stories = [
    story(A, "Typhoid Mary, infected houseworker in New York City, born 1869"),
    story(B, "Bruce Springsteen, American rock singer (born 1949), born 1949"),
    story(C, "Major news outlets banned by Trump will have their day in court", { subjectKind: null, subjectId: null }),
  ];
  assert.equal(decadeLine(day(stories), "September 23", BEE, false), "");
  assert.deepEqual(decadeStanding(day(stories)).teams, []);
  const one = day(stories.map((s) => (s.id === B ? { ...s, support: 1 } : s)));
  assert.equal(decadeLine(one, "September 23", BEE, false), "The 1940s (Boomers) lead September 23 with the only buzz so far.");
  const three = day(stories.map((s) => (s.id === B ? { ...s, support: 2 } : s.id === A ? { ...s, support: 1 } : s)));
  assert.equal(decadeLine(three, "September 23", BEE, false), "The 1940s (Boomers) lead September 23 with 2 of 3 buzzes.");
  assert.deepEqual(decadeStanding(three).teams, [{ decade: 1940, buzzes: 2, generation: "Boomers" }, { decade: 1860, buzzes: 1, generation: null }]);
  const tie = day(stories.map((s) => (s.id === B || s.id === A ? { ...s, support: 1 } : s)));
  assert.equal(decadeLine(tie, "September 23", BEE, false), "The 1860s and 1940s (Boomers) are level on September 23, 1 buzz each.");
  assert.deepEqual(decadeStanding(tie).leaders, [1860, 1940]);
  assert.equal(decadeLine(tie, "September 23", PLAIN, true), "The 1860s and 1940s (Boomers) were level on September 23, 1 tap each.");
});

test("the three live boards of September 21 to 23, 2026, as they stood", () => {
  // September 21: the news held one of five; the Pennsylvania Packet two.
  const s21 = day([
    story(A, "On September 21, 1784, the Pennsylvania Packet began publishing as the first successful daily newspaper in the United States.", { subjectKind: "birth_fact", support: 2 }),
    story(B, "1965: The Gambia, Maldives and Singapore are admitted as members of the United Nations.", { subjectKind: "historical_event", support: 1 }),
    story(C, "1993: A Transair Georgian Airlines Tu-134 is shot down by a missile in the Black Sea near Sokhumi, Georgia.", { subjectKind: "historical_event", support: 1 }),
    story(D, "Paramount settles lawsuit blocking $110 billion Warner Bros. merger", { subjectKind: null, subjectId: null, support: 1 }),
  ]);
  assert.equal(decadeLine(s21, "September 21", BEE, true), "The 1780s led September 21 with 2 of 5 buzzes.");
  // September 22: all three buzzes on the news. The 2020s lead, honestly.
  const s22 = day([
    story(A, "Trump seeks ‘massive’ Belarus fertiliser deal amid Canada trade war", { subjectKind: null, subjectId: null, support: 1 }),
    story(B, "Matthew McConaughey Exposed Himself to Jimmy Kimmel in the Emmys Bathroom and Woody Harrelson Saw the Whole Thing", { subjectKind: null, subjectId: null, support: 1 }),
    story(C, "Taiwan Creative Content Fest Adds Spotlight Screenings to Court International Buyers", { subjectKind: null, subjectId: null, support: 1 }),
    story(D, "Robert Wadlow, tallest person in recorded history, born 1918"),
  ], { wallDate: "2026-09-22" });
  assert.equal(decadeLine(s22, "September 22", BEE, false), "The 2020s lead September 22 with all 3 buzzes so far.");
  // September 23: one each on the 1860s and the 1940s, ten news tiles with none.
  const s23 = day([
    story(A, "Typhoid Mary, infected houseworker in New York City, born 1869", { support: 1 }),
    story(B, "Bruce Springsteen, American rock singer (born 1949), born 1949", { support: 1 }),
    story(C, "Major news outlets banned by Trump will have their day in court", { subjectKind: null, subjectId: null, support: 1, status: "pool", rect: null }),
  ]);
  assert.equal(decadeLine(s23, "September 23", BEE, false), "The 1860s, 1940s (Boomers) and 2020s are level on September 23, 1 buzz each.");
});

test("a story stamped false counts for no team, a story with no year counts for none, and a pooled story with a buzz counts", () => {
  const d = day([
    story(A, "Typhoid Mary, infected houseworker in New York City, born 1869", { support: 5, status: "false" }),
    story(B, "Somebody with no year", { support: 1 }),
    story(C, "1956: The dike around the Dutch polder East Flevoland is closed.", { subjectKind: "historical_event", support: 1, status: "pool", rect: null }),
  ]);
  assert.equal(decadeLine(d, "September 23", BEE, false), "The 1950s lead September 23 with the only buzz so far.");
});

test("the block: nothing before the date, nothing with no buzzes, the line and the top three, and the tiles carry their decade", () => {
  const stories = [
    story(A, "Typhoid Mary, infected houseworker in New York City, born 1869", { support: 1 }),
    story(B, "Bruce Springsteen, American rock singer (born 1949), born 1949", { support: 3, rect: { mx: 4, my: 0, w: 4, h: 3 } }),
    story(C, "1956: The dike around the Dutch polder East Flevoland is closed.", { subjectKind: "historical_event", support: 2, rect: { mx: 8, my: 0, w: 4, h: 3 } }),
    story(D, "Major news outlets banned by Trump will have their day in court", { subjectKind: null, subjectId: null, support: 1, rect: { mx: 12, my: 0, w: 4, h: 3 } }),
  ];
  assert.equal(decadesBlock(day(stories), "September 23", BEE, Date.parse("2026-09-22T20:00:00Z")), "");
  assert.equal(decadesBlock(day(stories.map((s) => ({ ...s, support: 0 }))), "September 23", BEE, NOW), "");
  const html = wallSection(day(stories), "September 23", NOW, { interactive: true, date: { month: 9, day: 23 } });
  assert.ok(html.includes('<p class="wdecadeline" id="wdecadeline">The 1940s (Boomers) lead September 23 with 3 of 7 buzzes.</p>'));
  assert.ok(html.includes('<span class="wdecade">1940s <b>3</b></span> <span class="wdecade">1950s <b>2</b></span> <span class="wdecade">1860s <b>1</b></span>'));
  assert.ok(!html.includes("2020s <b>"), "only the top three");
  // A four way tie shows all four, because the line names all four.
  const four = wallSection(day(stories.map((s) => ({ ...s, support: 1 }))), "September 23", NOW, { interactive: true, date: { month: 9, day: 23 } });
  assert.ok(four.includes("The 1860s, 1940s (Boomers), 1950s and 2020s are level on September 23, 1 buzz each."));
  assert.ok(four.includes("2020s <b>1</b>"));
  assert.ok(html.indexOf('id="wdecades"') < html.indexOf('id="wcrown"'), "the teams line sits above the crown list");
  assert.ok(html.includes(`data-decade="1940"`) && html.includes(`data-decade="2020"`));
  const sealed = wallSection(day(stories, { closedAt: "2026-09-25T04:00:00Z" }), "September 23", Date.parse("2026-10-01T00:00:00Z"), { hive: true, date: { month: 9, day: 23 } });
  assert.ok(sealed.includes("The 1940s (Boomers) led September 23 with 3 of 7 buzzes."));
});

test("the live hive carries the decades code, each story's decade, and repaints the line on every layout", () => {
  const d = day([
    story(A, "Typhoid Mary, infected houseworker in New York City, born 1869", { support: 1 }),
    story(B, "Major news outlets banned by Trump will have their day in court", { subjectKind: null, subjectId: null, rect: { mx: 4, my: 0, w: 4, h: 3 } }),
  ]);
  const html = liveHiveSection(d, "September 23", NOW, { project: "https://example.supabase.co", key: "publishable" });
  assert.ok(html.includes(HIVE_DECADES_JS));
  assert.ok(html.indexOf(HIVE_DECADES_JS) < html.indexOf(HIVE_LIVE_JS));
  assert.ok(html.includes('"decade":1860') && html.includes('"decade":2020'));
  assert.ok(html.includes('"born":1869') && html.includes('"born":null'));
  assert.ok(html.includes('id="wdecadeline">The 1860s lead September 23 with the only buzz so far.</p>'));
  assert.ok(HIVE_LIVE_JS.includes("decadesPaint();"));
  assert.ok(HIVE_LIVE_JS.includes("HiveDecades.standing(rows)"));
  // With nothing buzzed the box is on the page, hidden, for the script to fill.
  const quiet = liveHiveSection(day(d.stories.map((s) => ({ ...s, support: 0 }))), "September 23", NOW, { project: "https://example.supabase.co", key: "publishable" });
  assert.ok(quiet.includes('<div class="wdecades" id="wdecades" hidden>'));
  assert.equal((HIVE_LIVE_JS.match(/setInterval\(/g) ?? []).length, 2, "no new clock");
});

test("the page's standing is the server's", () => {
  const api = hiveDecades();
  const page = api.standing([{ decade: 1940, support: 2, born: 1949 }, { decade: 1860, support: 1, born: 1869 }, { decade: null, support: 9 }, { decade: 2020, support: 0 }]);
  assert.deepEqual(page, { teams: [{ decade: 1940, buzzes: 2, generation: "Boomers" }, { decade: 1860, buzzes: 1, generation: null }], total: 3, leaders: [1940] });
  // Bent rows: a negative, a string, a missing support.
  const bent = api.standing([{ decade: 1940, support: -3 }, { decade: 1950, support: "2" as unknown as number }, { decade: 1960 } as unknown as { decade: number; support: number }, { decade: 1970, support: 1 }]);
  assert.deepEqual(bent.teams, [{ decade: 1970, buzzes: 1, generation: null }]);
});

test("a generation is named for people only, when the decade's buzzed people are all one generation", () => {
  assert.equal(generationOf(1949), "Boomers");
  assert.equal(generationOf(1945), "Silent Generation");
  assert.equal(generationOf(1946), "Boomers");
  assert.equal(generationOf(1964), "Boomers");
  assert.equal(generationOf(1965), "Gen X");
  assert.equal(generationOf(1980), "Gen X");
  assert.equal(generationOf(1981), "Millennials");
  assert.equal(generationOf(1996), "Millennials");
  assert.equal(generationOf(1997), "Gen Z");
  assert.equal(generationOf(2012), "Gen Z");
  assert.equal(generationOf(2013), "Gen Alpha");
  assert.equal(generationOf(1869), null, "before the named generations");
  assert.equal(generationOf(null), null);
  assert.equal(bornOf(story(A, "1977: Star Wars was the number one film at the box office", { subjectKind: "film" })), null, "a film has no generation");
  assert.equal(bornOf(story(A, "Bruce Springsteen, American rock singer (born 1949), born 1949")), 1949);
  // A 1940s led by Springsteen is Boomers. A 1940s where a film from 1949
  // also has a buzz is a decade, because a film belongs to nobody.
  const bruce = story(A, "Bruce Springsteen, American rock singer (born 1949), born 1949", { support: 1 });
  const film = story(B, "1949: The Third Man was the number one film at the box office", { subjectKind: "film", support: 1, rect: { mx: 4, my: 0, w: 4, h: 3 } });
  assert.equal(decadeLine(day([bruce]), "September 23", BEE, false), "The 1940s (Boomers) lead September 23 with the only buzz so far.");
  assert.equal(decadeLine(day([bruce, film]), "September 23", BEE, false), "The 1940s lead September 23 with all 2 buzzes so far.");
  // Two people of the 1940s from two generations: Silent (1943) and Boomer (1949). A decade, not a generation.
  const silent = story(C, "Somebody Else, singer, born 1943", { support: 1, rect: { mx: 8, my: 0, w: 4, h: 3 } });
  assert.equal(decadeLine(day([bruce, silent]), "September 23", BEE, false), "The 1940s lead September 23 with all 2 buzzes so far.");
  // The page's own copy names the same generation.
  assert.equal(hiveDecades().generationOf(1949), "Boomers");
  assert.equal(hiveDecades().generationOf(1869), null);
});
