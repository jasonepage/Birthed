// This or that, docs/the-wall.md section 30. The pairing is pinned here:
// the board's own order, never a story against itself, never one this
// browser buzzed, never two news stories from one outlet.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { PICK_QUESTION, pickFor, pickIndexFrom, pickList, pickPairs, pickPath, renderPickPage } from "../src/pick.js";
import { everyDate } from "../src/model.js";
import { forgetWalls, readTap, start } from "../src/serve.js";
import { BEE, afterwords, crownTook, openWallDates, wallSection, type WallDay, type WallStory } from "../src/wall.js";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const C = "cccccccc-0000-4000-8000-000000000003";
const D = "dddddddd-0000-4000-8000-000000000004";
const E = "eeeeeeee-0000-4000-8000-000000000005";
const F = "ffffffff-0000-4000-8000-000000000006";

function story(id: string, headline: string, o: Partial<WallStory> = {}): WallStory {
  return {
    id, wallDate: "2026-09-23", submittedAt: `2026-09-22T04:00:0${id[0]}Z`.replace(/0(\w)Z$/, "0Z"), headline,
    url: `https://www.example.org/${id}`, outlet: "example.org", status: "pool", tier: "claimed",
    support: 0, priority: 1, placedAt: null, rect: null, falseAt: null, falseNote: null,
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

/** Six stories in board order: two buzzed, then by the editor's score. */
function six(): WallStory[] {
  return [
    story(A, "Typhoid Mary, infected houseworker in New York City, born 1869", { support: 2, status: "placed", rect: { mx: 0, my: 0, w: 8, h: 8 } }),
    story(B, "Bruce Springsteen, American rock singer (born 1949), born 1949", { support: 1, status: "placed", rect: { mx: 8, my: 0, w: 8, h: 8 } }),
    story(C, "Major news outlets banned by Trump will have their day in court", { subjectKind: null, subjectId: null, interest: 8, priority: 0, outlet: "bbc.com" }),
    story(D, "Oil hits $100 a barrel for first time since July", { subjectKind: null, subjectId: null, interest: 7, priority: 0, outlet: "bbc.com" }),
    story(E, "1956: The dike around the Dutch polder East Flevoland is closed.", { subjectKind: "historical_event", interest: 5 }),
    story(F, "1992: \"End of the Road\" by Boyz II Men was the number one song", { subjectKind: "song", interest: 3 }),
  ];
}

test("the list is the board's own order with the false and the already buzzed left out", () => {
  const d = day([...six(), story("99999999-0000-4000-8000-000000000009", "A story shown false", { status: "false", support: 9 })]);
  assert.deepEqual(pickList(d, new Set()).map((s) => s.id), [A, B, C, D, E, F]);
  assert.deepEqual(pickList(d, new Set([A, C])).map((s) => s.id), [B, D, E, F]);
});

test("pairs run down the list two at a time, and two news stories from one outlet are never a pair", () => {
  // C and D are both bbc.com, so C takes E and D takes F.
  const pairs = pickPairs(pickList(day(six()), new Set()));
  assert.deepEqual(pairs.map((p) => [p.a.id, p.b.id]), [[A, B], [C, E], [D, F]]);
  for (const p of pairs) assert.notEqual(p.a.id, p.b.id, "a story never faces itself");
});

test("a story with nobody it may face is left out rather than paired with itself or its own outlet", () => {
  const list = pickList(day([six()[2]!, six()[3]!]), new Set());
  assert.equal(list.length, 2);
  assert.deepEqual(pickPairs(list), []);
  assert.deepEqual(pickPairs([six()[0]!]), []);
  assert.deepEqual(pickPairs([]), []);
});

test("zero, one and three buzzes: a buzz takes the winner out and the loser faces the next story", () => {
  const d = day(six());
  assert.deepEqual(pickPairs(pickList(d, new Set())).map((p) => [p.a.id, p.b.id])[0], [A, B]);
  // The reader buzzes A. A is out; B faces C.
  assert.deepEqual(pickPairs(pickList(d, new Set([A]))).map((p) => [p.a.id, p.b.id]), [[B, C], [D, E]]);
  // Three buzzes: A, B, C. D faces E, F has nobody.
  assert.deepEqual(pickPairs(pickList(d, new Set([A, B, C]))).map((p) => [p.a.id, p.b.id]), [[D, E]]);
});

test("the address and the pair index", () => {
  assert.equal(pickPath(9, 23), "/september-23/pick/");
  assert.equal(pickPath(9, 23, 2), "/september-23/pick/?p=2");
  assert.deepEqual(pickFor("/september-23/pick/", everyDate()), { month: 9, day: 23 });
  assert.deepEqual(pickFor("/september-23/pick", everyDate()), { month: 9, day: 23 });
  assert.equal(pickFor("/september-99/pick/", everyDate()), null);
  assert.equal(pickFor("/september-23/", everyDate()), null);
  assert.equal(pickIndexFrom("p=3"), 3);
  assert.equal(pickIndexFrom("p=3&tapped=kept"), 3);
  assert.equal(pickIndexFrom("p=-1"), 0);
  assert.equal(pickIndexFrom("p=2.5"), 0);
  assert.equal(pickIndexFrom("p=99999"), 0);
  assert.equal(pickIndexFrom(undefined), 0);
});

test("the page: two sides, one question, one plain form each, no script, and a skip that spends nothing", () => {
  const html = renderPickPage(day(six()), 9, 23, NOW, { standing: null, p: 0, tapped: null, undo: null });
  assert.ok(html.includes(PICK_QUESTION));
  assert.ok(!html.includes("<script"), "no script on this page");
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
  assert.equal((html.match(/<form class="wbuzz wpickbuzz" method="post" action="\/boost">/g) ?? []).length, 2);
  assert.ok(html.includes(`name="s" value="${A}"`) && html.includes(`name="s" value="${B}"`));
  assert.ok(html.includes('name="v" value="pick"') && html.includes('name="p" value="0"'));
  assert.ok(html.includes('href="/september-23/pick/?p=1" rel="nofollow">Skip this pair</a>'));
  assert.ok(html.includes("Three buzzes left today."));
  assert.ok(html.includes("This one</button>"));
  assert.ok(!html.includes('<button type="submit" disabled'));
});

test("the page follows this browser: what it buzzed is out, its count is its own, and no buzzes left turns the buttons off", () => {
  const html = renderPickPage(day(six()), 9, 23, NOW, { standing: { left: 1, allowance: 3, backed: [A] }, p: 0, tapped: null, undo: null });
  assert.ok(!html.includes(`name="s" value="${A}"`), "the story this browser buzzed is not offered");
  assert.ok(html.includes(`name="s" value="${B}"`) && html.includes(`name="s" value="${C}"`));
  assert.ok(html.includes("One buzz left today."));
  const spent = renderPickPage(day(six()), 9, 23, NOW, { standing: { left: 0, allowance: 3, backed: [A, B, C] }, p: 0, tapped: null, undo: null });
  assert.ok(spent.includes("No buzzes left today."));
  assert.equal((spent.match(/<button type="submit" disabled/g) ?? []).length, 2);
});

test("the second pair, the last pair, past the end, and nothing to pair", () => {
  const d = day(six());
  const second = renderPickPage(d, 9, 23, NOW, { standing: null, p: 1, tapped: null, undo: null });
  assert.ok(second.includes(`name="s" value="${C}"`) && second.includes(`name="s" value="${E}"`));
  assert.ok(second.includes('name="p" value="1"'));
  const last = renderPickPage(d, 9, 23, NOW, { standing: null, p: 2, tapped: null, undo: null });
  assert.ok(last.includes("This is the last pair on the hive."));
  assert.ok(!last.includes("Skip this pair"));
  const past = renderPickPage(d, 9, 23, NOW, { standing: null, p: 7, tapped: null, undo: null });
  assert.ok(past.includes("You have seen every pair."));
  assert.ok(past.includes('href="/september-23/pick/"'));
  const none = renderPickPage(day([six()[0]!]), 9, 23, NOW, { standing: null, p: 0, tapped: null, undo: null });
  assert.ok(none.includes("One story left on this hive that you have not buzzed"));
  const empty = renderPickPage(day([]), 9, 23, NOW, { standing: null, p: 0, tapped: null, undo: null });
  assert.ok(empty.includes("Nothing left to pair."));
});

test("after a tap the page says what happened, offers the undo for a buzz that counted, and says when it took the crown", () => {
  const d = day(six(), { boosts: [
    { id: 1, storyId: A, units: 1, castAt: "2026-09-23T08:00:00Z" },
    { id: 2, storyId: A, units: 1, castAt: "2026-09-23T09:00:00Z" },
    { id: 3, storyId: B, units: 1, castAt: "2026-09-23T10:00:00Z" },
  ] });
  const kept = renderPickPage(d, 9, 23, NOW, { standing: { left: 2, allowance: 3, backed: [B] }, p: 0, tapped: "kept", undo: d.stories[1]! });
  assert.ok(kept.includes("That counts."));
  assert.ok(kept.includes('<form class="wundo" method="post" action="/unboost">'));
  assert.ok(kept.includes(`name="s" value="${B}"`) && kept.includes('name="v" value="pick"'));
  assert.ok(!kept.includes('<b class="wcrowntook">'), "B did not take the crown: A still has more");
  // B gets two more: the last change is to B, a minute ago. The sentence says so.
  const took = day(six(), { boosts: [...d.boosts!, { id: 4, storyId: B, units: 1, castAt: "2026-09-23T19:59:30Z" }, { id: 5, storyId: B, units: 1, castAt: "2026-09-23T19:59:40Z" }] });
  const crowned = renderPickPage(took, 9, 23, NOW, { standing: { left: 2, allowance: 3, backed: [B] }, p: 0, tapped: "kept", undo: took.stories[1]! });
  assert.ok(crowned.includes('<b class="wcrowntook">Bruce Springsteen took the crown from Typhoid Mary.</b>'));
  const spent = renderPickPage(d, 9, 23, NOW, { standing: { left: 0, allowance: 3, backed: [] }, p: 0, tapped: "spent", undo: null });
  assert.ok(spent.includes("so that one did not count"));
  assert.ok(!spent.includes('action="/unboost"'));
  const junk = renderPickPage(d, 9, 23, NOW, { standing: null, p: 0, tapped: "whatever", undo: null });
  assert.ok(!junk.includes('id="wsaid"'));
});

test("the crown sentence: only for a change to this story inside the last minute", () => {
  const boosts = [
    { id: 1, storyId: A, units: 1, castAt: "2026-09-23T08:00:00Z" },
    { id: 2, storyId: B, units: 1, castAt: "2026-09-23T19:59:30Z" },
    { id: 3, storyId: B, units: 1, castAt: "2026-09-23T19:59:40Z" },
  ];
  const d = day(six(), { boosts });
  assert.equal(crownTook(d, B, NOW), "Bruce Springsteen took the crown from Typhoid Mary.");
  assert.equal(crownTook(d, A, NOW), null, "not the story that took it");
  assert.equal(crownTook(d, B, NOW + 10 * 60_000), null, "ten minutes on, the same query says nothing");
  // The holder adding to its own lead took nothing.
  const same = day(six(), { boosts: [...boosts, { id: 4, storyId: B, units: 1, castAt: "2026-09-23T19:59:50Z" }] });
  assert.equal(crownTook(same, B, NOW), "Bruce Springsteen took the crown from Typhoid Mary.", "the last change is still the one that took it");
  const held = day(six(), { boosts: [{ id: 1, storyId: A, units: 1, castAt: "2026-09-23T08:00:00Z" }, { id: 2, storyId: A, units: 1, castAt: "2026-09-23T19:59:50Z" }] });
  assert.equal(crownTook(held, A, NOW), null, "A already wore it; the first crown was hours ago");
  // On the date page the sentence rides "That counts." for the buzz that counted.
  const said = afterwords(BEE, "September 23", d.stories[1]!, "day", false, "Bruce Springsteen took the crown from Typhoid Mary.");
  assert.ok(said.includes('That counts. <b class="wcrowntook">Bruce Springsteen took the crown from Typhoid Mary.</b>'));
  const page = wallSection(d, "September 23", NOW, { interactive: true, date: { month: 9, day: 23 }, undo: d.stories[1]! });
  assert.ok(page.includes('<b class="wcrowntook">Bruce Springsteen took the crown from Typhoid Mary.</b>'));
  const quiet = wallSection(d, "September 23", NOW, { interactive: true, date: { month: 9, day: 23 } });
  assert.ok(!quiet.includes('<b class="wcrowntook">'), "nothing without a buzz that just counted");
});

test("the date page links to it while a buzz can be spent, and a sealed page does not", () => {
  const live = wallSection(day(six()), "September 23", NOW, { interactive: true, date: { month: 9, day: 23 } });
  assert.ok(live.includes('<a href="/september-23/pick/">Pick between two</a>'));
  const sealed = wallSection(day(six(), { closedAt: "2026-09-25T04:00:00Z" }), "September 23", Date.parse("2026-10-01T00:00:00Z"), { interactive: true, date: { month: 9, day: 23 } });
  assert.ok(!sealed.includes("Pick between two"));
});

test("a tap from the pick page carries its pair back, and lands on the same pair with the word", async (t) => {
  const root = resolve("test-site-pick");
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  const open = openWallDates();
  const [openKey, openDate] = [...open.entries()][1]!;
  const [openMonth, openDay] = openKey.split("-").map(Number) as [number, number];
  const openSlug = `${["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][openMonth - 1]}-${openDay}`;
  await mkdir(join(root, openSlug), { recursive: true });
  await writeFile(join(root, openSlug, "index.html"), "<html><body><!--wall:start--><section>baked</section><!--wall:end--></body></html>", "utf8");

  const realFetch = globalThis.fetch;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_ANON_KEY = "test-key";
  const backed: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("supabase")) return realFetch(input, init);
    if (url.endsWith("/rpc/wall_cast_web_boost")) {
      backed.push(A);
      return new Response(JSON.stringify({ result: "kept", support: 1, allowance: 3, left: 2, backed, boost_id: 41 }), { status: 200 });
    }
    if (url.endsWith("/rpc/wall_web_standing")) return new Response(JSON.stringify({ allowance: 3, left: 3 - backed.length, backed }), { status: 200 });
    if (url.includes("wall_days")) return new Response(JSON.stringify([{ wall_date: openDate, opens_at: "2026-01-01T05:00:00Z", live_at: "2026-01-02T05:00:00Z", closes_at: "2099-01-01T05:00:00Z", closed_at: null }]), { status: 200 });
    if (url.includes("wall_boosts")) return new Response(JSON.stringify(backed.map((id, i) => ({ id: 41 + i, story_id: id, units: 1, cast_at: new Date().toISOString() }))), { status: 200 });
    if (url.includes("wall_stories")) return new Response(JSON.stringify([A, B, C].map((id, i) => ({
      id, wall_date: openDate, submitted_at: `2026-01-02T12:0${i}:00Z`, headline: `Story ${i}`, url: `https://example.org/${i}`, outlet: `outlet${i}.org`,
      status: "pool", tier: "claimed", support: 0, placed_at: null, anchor_mx: null, anchor_my: null, w_modules: null, h_modules: null,
      false_at: null, false_note: null, subject_kind: null, subject_id: null, wall_sources: [],
    }))), { status: 200 });
    return new Response("[]", { status: 200 });
  }) as typeof fetch;

  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    server.close();
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
    forgetWalls();
    await rm(root, { recursive: true, force: true });
  });

  forgetWalls();
  // The page, fresh: no script, never stored, the default policy, two forms.
  const page = await realFetch(`${base}/${openSlug}/pick/`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.ok(page.headers.get("content-security-policy")?.includes("default-src 'none'"));
  assert.ok(!page.headers.get("content-security-policy")?.includes("script-src"));
  const html = await page.text();
  assert.ok(!html.includes("<script"));
  assert.ok(html.includes(PICK_QUESTION));
  assert.ok(html.includes(`name="s" value="${A}"`) && html.includes(`name="s" value="${B}"`));

  // A tap from the second pair comes back to the second pair with the word.
  const posted = await realFetch(`${base}/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `s=${A}&m=${openMonth}&d=${openDay}&v=pick&p=1`,
    redirect: "manual",
  });
  assert.equal(posted.status, 303);
  assert.equal(posted.headers.get("location"), `/${openSlug}/pick/?p=1&tapped=kept&on=${A}#w-${A}`);
  const cookie = posted.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert.ok(cookie.startsWith("bt="));

  // Landing there: the sentence, the undo, and the story just buzzed is out
  // of every pair.
  const after = await (await realFetch(`${base}/${openSlug}/pick/?p=0&tapped=kept&on=${A}`, { headers: { Cookie: cookie } })).text();
  assert.ok(after.includes("That counts."));
  assert.ok(after.includes('action="/unboost"'));
  const offered = [...after.matchAll(/<form class="wbuzz wpickbuzz"[^>]*><input type="hidden" name="s" value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(offered, [B, C], "the story just buzzed is out of every pair; the undo form is the only place it appears");
  assert.ok(after.includes(`name="s" value="${B}"`) && after.includes(`name="s" value="${C}"`));
  assert.ok(after.includes("Two buzzes left today."));

  // A stranger handed the same address gets no undo: the database would
  // refuse it anyway, and a lying control is worse than none.
  const stranger = await (await realFetch(`${base}/${openSlug}/pick/?tapped=kept&on=${A}`)).text();
  assert.ok(!stranger.includes('action="/unboost"'));

  // A date not taking buzzes sends the reader to the date page.
  const closedMonth = ((openMonth + 5) % 12) + 1;
  const closedSlug = `${["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][closedMonth - 1]}-1`;
  const closed = await realFetch(`${base}/${closedSlug}/pick/`, { redirect: "manual" });
  assert.equal(closed.status, 302);
  assert.equal(closed.headers.get("location"), `/${closedSlug}/`);

  // readTap carries the pair for the undo too.
  assert.equal(readTap(`s=${A}&m=${openMonth}&d=${openDay}&v=pick&p=1`)!.pick, 1);
});
