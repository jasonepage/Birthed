// Suggestions on the page, docs/the-wall.md section 32: the pure parts. What
// counts as an article, how a suggestion is recognised as a tile already on
// the date, the name it goes by, and the one script. The database's own
// rules are tested against the migration in worker/test/suggest-migration.test.ts.

import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { recapSuggestions, forgetWikipedia, hereFor, searchesHeld, mayAskWikipedia, parseTopics, searchAddress, searchTopics, suggestionName, SUGGEST_QUERY_MAX, SUGGEST_RESULTS, SUGGEST_SCRIPT, SUGGEST_SCRIPT_SOURCE, tileFor, topicKey, topicsById, topicUrl, type Topic } from "../src/suggest.js";
import type { WallStory } from "../src/wall.js";

function story(overrides: Partial<WallStory> = {}): WallStory {
  return {
    id: "11111111-2222-3333-4444-555555555555", wallDate: "2026-10-05", submittedAt: "2026-10-05T14:00:00Z",
    headline: "Council approves the river crossing after a decade of study", url: "https://www.example.org/news/river-crossing",
    outlet: "example.org", status: "pool", tier: "claimed", support: 0, priority: 0, placedAt: null, rect: null,
    falseAt: null, falseNote: null, subjectKind: null, subjectId: null, sources: [], ...overrides,
  };
}

/** Wikipedia's answer to a prefix search, the shape formatversion=2 sends. */
function answerOf(pages: unknown[]): unknown {
  return { batchcomplete: true, query: { pages } };
}

test("an article is offered only when it can be a tile: no lists, no pages of several meanings, nothing outside the articles", () => {
  const topics = parseTopics(answerOf([
    { pageid: 3, ns: 0, title: "Mercury (planet)", index: 3, description: "Smallest planet in the Solar System", pageprops: { wikibase_item: "Q308" } },
    { pageid: 1, ns: 0, title: "Mercury", index: 1, pageprops: { disambiguation: "", wikibase_item: "Q12" } },
    { pageid: 2, ns: 0, title: "List of Mercury missions", index: 2, pageprops: { wikibase_item: "Q99" } },
    { pageid: 4, ns: 14, title: "Category:Mercury", index: 4 },
    { pageid: 5, ns: 0, title: "Freddie Mercury", index: 0, description: "British singer (1946–1991)", pageprops: { wikibase_item: "Q15869" } },
    { ns: 0, title: "Mercury Records", index: 5, missing: true },
    { pageid: 6, ns: 0, title: "Mercury Prize", index: 6, pageprops: { wikibase_item: "not-an-item" } },
  ]));
  assert.deepEqual(topics, [
    { pageId: 5, title: "Freddie Mercury", description: "British singer (1946–1991)", item: "Q15869" },
    { pageId: 3, title: "Mercury (planet)", description: "Smallest planet in the Solar System", item: "Q308" },
    { pageId: 6, title: "Mercury Prize", description: null, item: null },
  ], "Wikipedia's order, and an item that is not shaped like one is no item");
  assert.deepEqual(parseTopics(null), []);
  assert.deepEqual(parseTopics({ query: {} }), []);
  assert.deepEqual(parseTopics({ error: { code: "badvalue" } }), []);
  const many = parseTopics(answerOf(Array.from({ length: 10 }, (_, i) => ({ pageid: i + 1, ns: 0, title: `Thing ${i}`, index: i }))));
  assert.equal(many.length, SUGGEST_RESULTS, "a phone's screen of rows");
  // Control characters out, the way the database does it.
  assert.equal(parseTopics(answerOf([{ pageid: 9, ns: 0, title: "Bell\u0007 Labs", index: 0 }]))[0]!.title, "Bell Labs");
});

test("dedupe: an article is the tile already on the date by its Wikidata item or by its own address, and only then", () => {
  const person = story({ id: "aaaaaaaa-0000-0000-0000-000000000001", subjectKind: "person", subjectId: "Q15869", headline: "Freddie Mercury, British singer, born 1946", url: "https://en.wikipedia.org/wiki/Freddie_Mercury" });
  const suggested = story({ id: "aaaaaaaa-0000-0000-0000-000000000002", subjectKind: "suggestion", subjectId: "Q308", headline: "Mercury (planet): Smallest planet", url: "https://en.wikipedia.org/wiki/Mercury_(planet)", support: 1 });
  const event = story({ id: "aaaaaaaa-0000-0000-0000-000000000003", subjectKind: "historical_event", subjectId: "77", headline: "1991: Something about the Mercury Prize", url: "https://en.wikipedia.org/wiki/Mercury_Prize" });
  const news = story({ id: "aaaaaaaa-0000-0000-0000-000000000004" });
  const stories = [person, suggested, event, news];
  const t = (pageId: number, title: string, item: string | null): Topic => ({ pageId, title, description: null, item });
  assert.equal(tileFor(t(5, "Freddie Mercury", "Q15869"), stories)?.id, person.id, "a person born on the date, by item");
  assert.equal(tileFor(t(3, "Mercury (planet)", "Q308"), stories)?.id, suggested.id, "something already suggested, by item");
  assert.equal(tileFor(t(6, "Mercury Prize", null), stories)?.id, event.id, "a story whose own address is the article");
  assert.equal(tileFor(t(7, "Mercury Records", "Q1"), stories), null, "and nothing else");
  // An item on a story of another kind is not the same thing: a history row's
  // subject is its own number, never a Wikidata item.
  assert.equal(tileFor(t(8, "Something else", "77"), stories), null);
  // The address, whatever escaping it was written with.
  const accented = story({ id: "aaaaaaaa-0000-0000-0000-000000000005", url: "https://en.wikipedia.org/wiki/Bj%C3%B6rk" });
  assert.equal(tileFor(t(9, "Björk", null), [accented])?.id, accented.id);
  assert.equal(topicUrl("Mercury (planet)"), "https://en.wikipedia.org/wiki/Mercury_(planet)");
  // A suggestion taken back inside its thirty seconds is drawn nowhere, so it
  // is not a tile to point anybody at: the article is offered again, and the
  // database takes the filed story up for whoever suggests it next.
  const takenBack = { ...suggested, support: 0 };
  assert.equal(tileFor(t(3, "Mercury (planet)", "Q308"), [takenBack]), null);
  assert.deepEqual(hereFor("mercury planet", [takenBack]), []);
});

test("dedupe: a phrase is matched against what is already filed before anything new is offered", () => {
  const news = story({ id: "aaaaaaaa-0000-0000-0000-000000000004" });
  const other = story({ id: "aaaaaaaa-0000-0000-0000-000000000005", headline: "Storm closes ports along the coast", url: "https://www.example.org/storm" });
  assert.deepEqual(hereFor("river crossing", [news, other]).map((s) => s.id), [news.id]);
  assert.deepEqual(hereFor("the", [news, other]), [], "stop words find nothing");
  assert.deepEqual(hereFor("volcano", [news, other]), []);
});

test("a suggestion goes by its article's title, read off its own address, never by the headline's description", () => {
  assert.equal(suggestionName({ url: "https://en.wikipedia.org/wiki/Mercury_(planet)", headline: "Mercury (planet): Smallest planet" }), "Mercury (planet)");
  assert.equal(suggestionName({ url: "https://en.wikipedia.org/wiki/Star_Wars:_The_Last_Jedi", headline: "Star Wars: The Last Jedi: 2017 film" }), "Star Wars: The Last Jedi", "a title with its own colon");
  assert.equal(suggestionName({ url: "https://en.wikipedia.org/wiki/Bj%C3%B6rk", headline: "Björk: Icelandic singer" }), "Björk");
  assert.equal(suggestionName({ url: "https://example.org/x", headline: "Plain" }), "Plain");
  assert.equal(suggestionName({ url: "https://en.wikipedia.org/wiki/%E0%A4%A", headline: "Broken escape" }), "Broken escape");
});

test("the sealed picture lists what readers suggested and still stand behind, most buzzed first", () => {
  const s = (id: string, support: number, url: string, extra: Partial<WallStory> = {}): WallStory => story({ id, support, url, subjectKind: "suggestion", headline: "x: y", ...extra });
  const list = recapSuggestions([
    s("a", 2, "https://en.wikipedia.org/wiki/Mercury_(planet)", { submittedAt: "2026-10-05T10:00:00Z" }),
    s("b", 5, "https://en.wikipedia.org/wiki/Freddie_Mercury"),
    s("c", 0, "https://en.wikipedia.org/wiki/Taken_back"),
    s("d", 2, "https://en.wikipedia.org/wiki/Shown_false", { status: "false" }),
    s("e", 2, "https://en.wikipedia.org/wiki/Later", { submittedAt: "2026-10-05T12:00:00Z" }),
    story({ id: "f", support: 9 }),
  ]);
  assert.deepEqual(list, [{ name: "Freddie Mercury", count: 5 }, { name: "Mercury (planet)", count: 2 }, { name: "Later", count: 2 }]);
});

test("Wikipedia is asked at most thirty times a minute by this server, a phrase is asked once, and a short or long phrase asks nothing", async () => {
  forgetWikipedia();
  const now = Date.parse("2026-10-05T18:00:00Z");
  let asked = 0;
  for (let i = 0; i < 40; i += 1) if (mayAskWikipedia(now + i)) asked += 1;
  assert.equal(asked, 30);
  assert.equal(mayAskWikipedia(now + 61_000), true);
  forgetWikipedia();
  const real = globalThis.fetch;
  const urls: string[] = [];
  let headers: Record<string, string> = {};
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    urls.push(String(input));
    headers = init?.headers as Record<string, string>;
    return new Response(JSON.stringify(answerOf([{ pageid: 5, ns: 0, title: "Freddie Mercury", index: 0, pageprops: { wikibase_item: "Q15869" } }])), { status: 200 });
  }) as typeof fetch;
  try {
    assert.equal(topicKey("  Freddie   MERCURY "), "freddie mercury");
    const first = await searchTopics("Freddie Mercury", now);
    const second = await searchTopics("  freddie   mercury ", now + 1000);
    assert.deepEqual(first, second);
    assert.equal(urls.length, 1, "the same phrase, folded, is answered from memory");
    assert.ok(urls[0]!.startsWith("https://en.wikipedia.org/w/api.php?"));
    assert.ok(urls[0]!.includes("generator=prefixsearch") && urls[0]!.includes("gpsnamespace=0"));
    assert.equal(urls[0], searchAddress("freddie mercury"));
    assert.equal(headers["User-Agent"], "Birthed/0.1 (https://birthed.app)", "a user agent Wikipedia's policy asks for");
    assert.deepEqual(topicsById([5, 404]).map((t) => t.title), ["Freddie Mercury"], "found articles are remembered by number, for the page that follows");
    // Held ten minutes and then gone, not kept until newer phrases push it out:
    // the phrase is what a reader typed, and the privacy page says so.
    assert.equal(searchesHeld(), 1);
    await searchTopics("queen", now + 11 * 60_000);
    assert.equal(searchesHeld(), 1, "the first phrase is gone, the new one held");
    assert.deepEqual(await searchTopics("f", now), []);
    assert.deepEqual(await searchTopics("x".repeat(SUGGEST_QUERY_MAX + 1), now), []);
    assert.equal(urls.length, 2);
    globalThis.fetch = (async () => new Response("down", { status: 503 })) as typeof fetch;
    assert.equal(await searchTopics("queen band", now), "busy", "Wikipedia not answering is busy, never an empty answer");
    globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
    assert.equal(await searchTopics("queen band two", now), "busy");
  } finally {
    globalThis.fetch = real;
    forgetWikipedia();
  }
});

test("the box's script is the one the header names, draws with DOM calls only, posts to this origin alone, and never puts the phrase in an address", () => {
  assert.equal(SUGGEST_SCRIPT_SOURCE, `'sha256-${createHash("sha256").update(SUGGEST_SCRIPT).digest("base64")}'`);
  assert.ok(!SUGGEST_SCRIPT.includes("innerHTML") && !SUGGEST_SCRIPT.includes("insertAdjacentHTML"), "nothing Wikipedia or a headline says is ever markup");
  assert.ok(SUGGEST_SCRIPT.includes('fetch("/suggest/search"'));
  assert.ok(!/fetch\("https?:/.test(SUGGEST_SCRIPT), "nothing else is fetched");
  assert.ok(!SUGGEST_SCRIPT.includes("?q="), "the phrase goes in the body");
  // A pick posts the article's number, never its words, and a tile already
  // there is buzzed through the same /boost form as everywhere else.
  assert.ok(SUGGEST_SCRIPT.includes('post("/suggest",[["p",t.pageId]'));
  assert.ok(SUGGEST_SCRIPT.includes('post("/boost",[["s",t.tile]'));
  assert.ok(SUGGEST_SCRIPT.includes("Already on today's hive. Buzz it instead"));
});
