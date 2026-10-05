// Suggestions on the page on the server, docs/the-wall.md section 32: the
// search, the dedupe, the one a day, the guard and the undo, against a faked
// project and a faked Wikipedia. The database's own rules, the same ones
// again, are tested against the migration in worker/test/suggest-migration.test.ts.

import { strict as assert } from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { forgetWalls, readSuggestPick, start, suggestedFrom, topicsFrom } from "../src/serve.js";
import { forgetApple } from "../src/song-apple.js";
import { SONG_SCRIPT_SOURCE } from "../src/song-prompt.js";
import { forgetWikipedia, SUGGEST_SCRIPT, SUGGEST_SCRIPT_SOURCE, type Topic } from "../src/suggest.js";
import { WALL_END, WALL_START, openWallDates } from "../src/wall.js";

const BAKED = `<html><body><h1>A day</h1>${WALL_START}<section class="wall">baked</section>${WALL_END}<p>museum</p></body></html>`;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const NEWS = "eeeeeeee-0000-4000-8000-000000000001";
const PERSON = "eeeeeeee-0000-4000-8000-000000000002";
const SUGGESTION = "eeeeeeee-0000-4000-8000-000000000003";

test("a posted suggestion is an article number and a date, and nothing else gets through", () => {
  assert.deepEqual(readSuggestPick("p=19637&m=10&d=5"), { page: 19637, month: 10, day: 5 });
  assert.equal(readSuggestPick("p=Ada+Lovelace&m=10&d=5"), null, "never words");
  assert.equal(readSuggestPick("p=0&m=10&d=5"), null);
  assert.equal(readSuggestPick("p=-4&m=10&d=5"), null);
  assert.equal(readSuggestPick("p=1234567890123456&m=10&d=5"), null, "longer than any article number");
  assert.equal(readSuggestPick("p=12&m=13&d=5"), null);
  assert.equal(readSuggestPick("p=12&m=10&d=32"), null);
  assert.equal(readSuggestPick(""), null);
});

test("only a word the server knows comes back from a redirect, and only article numbers come back from a search", () => {
  assert.equal(suggestedFrom("suggested=kept&on=x"), "kept");
  assert.equal(suggestedFrom("suggested=exists"), "exists");
  assert.equal(suggestedFrom("suggested=<script>"), null);
  assert.equal(suggestedFrom(undefined), null);
  const known: Topic = { pageId: 19637, title: "Ada Lovelace", description: "English mathematician", item: "Q7259" };
  const lookup = (ids: number[]): Topic[] => ids.includes(19637) ? [known] : [];
  assert.deepEqual(topicsFrom("topics=19637", lookup), [known]);
  assert.equal(topicsFrom("topics=none", lookup), "none");
  assert.equal(topicsFrom("topics=busy", lookup), "busy");
  assert.equal(topicsFrom("topics=42", lookup), "expired", "a search this process has forgotten says search again");
  assert.equal(topicsFrom("topics=ada+lovelace", lookup), null, "never a phrase");
  assert.equal(topicsFrom("topics=1,2,3,4,5,6,7,8,9,10,11", lookup), null, "never more than a search offers");
  assert.equal(topicsFrom(undefined, lookup), null);
});

test("today's page has the box; a search points at what is already filed; a suggestion lands at once; one a day; the guard is the buzz's; and it can be taken back", async (t) => {
  const root = resolve("test-site-suggest");
  await rm(root, { recursive: true, force: true });
  const [todayKey, todayDate] = [...openWallDates().entries()][1]!;
  const [month, dayOfMonth] = todayKey.split("-").map(Number) as [number, number];
  const slug = `${MONTHS[month - 1]}-${dayOfMonth}`;
  await mkdir(join(root, slug), { recursive: true });
  await writeFile(join(root, slug, "index.html"), BAKED, "utf8");

  const realFetch = globalThis.fetch;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_ANON_KEY = "test-key";
  const calls: Array<{ url: string; body: string }> = [];
  let suggested = false;
  let suggestWord: Record<string, unknown> = { result: "kept", story_id: SUGGESTION };
  let standingSuggested: string | null = null;
  const row = (id: string, headline: string, url: string, kind: string | null, subject: string | null, support: number) => ({
    id, wall_date: todayDate, submitted_at: "2026-01-02T12:00:00Z", headline, url, outlet: url.includes("wikipedia") ? "Wikipedia" : "example.org",
    status: "pool", tier: "claimed", support, priority: 0, placed_at: null, anchor_mx: null, anchor_my: null, w_modules: null, h_modules: null,
    false_at: null, false_note: null, subject_kind: kind, subject_id: subject, wall_sources: [],
  });
  const news = row(NEWS, "Council approves the river crossing after a decade of study", "https://www.example.org/river", null, null, 0);
  const person = row(PERSON, "Ada Lovelace, English mathematician, born 1815", "https://en.wikipedia.org/wiki/Ada_Lovelace", "person", "Q7259", 0);
  const suggestion = row(SUGGESTION, "River Thames crossing: Bridge in London", "https://en.wikipedia.org/wiki/River_Thames_crossing", "suggestion", "Q99", 1);
  const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: String(init?.body ?? "") });
    if (url.startsWith("https://en.wikipedia.org/w/api.php")) {
      return json({ query: { pages: [
        { pageid: 19637, ns: 0, title: "Ada Lovelace", index: 1, description: "English mathematician", pageprops: { wikibase_item: "Q7259" } },
        { pageid: 4242, ns: 0, title: "River Thames crossing", index: 0, description: "Bridge in London", pageprops: { wikibase_item: "Q99" } },
        { pageid: 777, ns: 0, title: "River crossing puzzle", index: 2, description: "Logic puzzle", pageprops: { wikibase_item: "Q1145" } },
      ] } });
    }
    if (url.includes("apple.com") || url.includes("mzstatic.com")) return json({});
    if (!url.includes("supabase")) return realFetch(input, init);
    if (url.endsWith("/rpc/wall_suggest_topic")) {
      if (suggestWord.result === "kept") suggested = true;
      return json(suggestWord);
    }
    if (url.endsWith("/rpc/wall_forget_boost")) { suggested = false; return json({ result: "undone", support: 0 }); }
    if (url.endsWith("/rpc/wall_cast_web_boost")) return json({ result: "kept", support: 1, left: 2, allowance: 3, backed: [NEWS] });
    if (url.endsWith("/rpc/wall_web_standing")) return json({ allowance: 3, left: 3, backed: [], answered: null, suggested: standingSuggested });
    if (url.includes("/rest/v1/wall_days")) return json([{ wall_date: todayDate, opens_at: "2026-01-01T05:00:00Z", live_at: "2026-01-02T05:00:00Z", closes_at: "2099-01-01T05:00:00Z", closed_at: null }]);
    if (url.includes("/rest/v1/wall_stories")) return json(suggested ? [news, person, suggestion] : [news, person]);
    if (url.includes("/rest/v1/wall_boosts")) return json(suggested ? [{ id: 9, story_id: SUGGESTION, units: 1, cast_at: "2026-01-02T13:00:00Z", answer: false, suggested: true }] : []);
    return json([]);
  }) as typeof fetch;

  forgetApple();
  forgetWikipedia();
  forgetWalls();
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
    forgetApple();
    forgetWikipedia();
    await rm(root, { recursive: true, force: true });
  });
  const form = (body: string, headers: Record<string, string> = {}): RequestInit => ({
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers }, body, redirect: "manual",
  });

  // A stranger lands on today's page: the box, never a dead one, and its
  // script, named by its hash beside the song's.
  const first = await realFetch(`${base}/${slug}/`);
  assert.equal(first.status, 200);
  assert.ok((first.headers.get("content-security-policy") ?? "").includes(`script-src ${SONG_SCRIPT_SOURCE} ${SUGGEST_SCRIPT_SOURCE};`));
  const firstPage = await first.text();
  assert.ok(firstPage.includes('<div class="tg" id="suggest"'));
  assert.ok(firstPage.includes("<b>Be the first to suggest one.</b>"));
  assert.ok(firstPage.includes(`<script>${SUGGEST_SCRIPT}</script>`));
  assert.ok(firstPage.includes("<p>museum</p>"), "the baked museum is untouched");

  // DEDUPE. A search with the script: what is already filed first, and an
  // article that is already a tile carries that tile.
  const searched = await realFetch(`${base}/suggest/search`, form(`q=${encodeURIComponent("river crossing")}&m=${month}&d=${dayOfMonth}`, { Accept: "application/json" }));
  assert.equal(searched.status, 200);
  assert.equal(searched.headers.get("cache-control"), "no-store");
  const results = (await searched.json()) as { here: Array<{ id: string }>; results: Array<{ pageId: number; title: string; tile: string | null }> };
  assert.deepEqual(results.here.map((s) => s.id), [NEWS], "the story already on today's hive");
  assert.deepEqual(results.results.map((r) => [r.pageId, r.tile]), [[4242, null], [19637, PERSON], [777, null]], "Ada Lovelace is the person already filed for the date");
  assert.ok(!calls.some((c) => c.url.includes("supabase") && (c.url + c.body).toLowerCase().includes("river")), "the phrase never goes to our database");
  assert.ok(calls.some((c) => c.url.startsWith("https://en.wikipedia.org/w/api.php")), "Wikipedia is asked by the server");

  // One thing once: when the phrase already found the tile, the article for
  // it is not offered a second time underneath.
  const named = (await (await realFetch(`${base}/suggest/search`, form(`q=${encodeURIComponent("ada lovelace")}&m=${month}&d=${dayOfMonth}`, { Accept: "application/json" }))).json()) as { here: Array<{ id: string }>; results: Array<{ pageId: number }> };
  assert.deepEqual(named.here.map((s) => s.id), [PERSON]);
  assert.ok(!named.results.some((r) => r.pageId === 19637), "Ada Lovelace is listed once, as the tile already there");

  // The same search without the script: numbers only, never the phrase.
  const noScript = await realFetch(`${base}/suggest/search`, form(`q=river+crossing&m=${month}&d=${dayOfMonth}`));
  assert.equal(noScript.status, 303);
  const back = noScript.headers.get("location") ?? "";
  assert.equal(back, `/${slug}/?topics=4242,19637,777&found=${NEWS}#suggest`);
  assert.ok(!back.includes("river"), "never the phrase");
  const picks = await (await realFetch(`${base}${back.split("#")[0]}`)).text();
  assert.ok(picks.includes("Already on today's hive. Buzz it instead"));
  const adaRow = picks.slice(picks.indexOf(">Ada Lovelace<"), picks.indexOf("</li>", picks.indexOf(">Ada Lovelace<")));
  assert.ok(adaRow.includes(`name="s" value="${PERSON}"`) && !adaRow.includes('action="/suggest"'), "buzz it instead, never a second tile");
  assert.ok(picks.includes('<input type="hidden" name="p" value="4242">'), "the new article is offered by its number");

  // A search too long, or for no date, is refused before anything is asked.
  const wikipediaCalls = calls.filter((c) => c.url.includes("wikipedia.org")).length;
  assert.equal((await realFetch(`${base}/suggest/search`, form(`q=${"x".repeat(81)}&m=${month}&d=${dayOfMonth}`))).status, 400);
  assert.equal((await realFetch(`${base}/suggest/search`, form("q=ada&m=13&d=1"))).status, 400);
  assert.equal(calls.filter((c) => c.url.includes("wikipedia.org")).length, wikipediaCalls);

  // A malformed suggestion never reaches the database.
  const rpcs = (): number => calls.filter((c) => c.url.endsWith("/rpc/wall_suggest_topic")).length;
  const before = rpcs();
  assert.equal((await realFetch(`${base}/suggest`, form(`p=River+Thames&m=${month}&d=${dayOfMonth}`))).status, 400);
  assert.equal(rpcs(), before);
  assert.equal((await realFetch(`${base}/suggest`)).status, 404, "a GET is not a suggestion");

  // The suggestion. A first time reader gets the token a buzz would give
  // them, the database is asked with the article number and that token, and
  // the reader lands on their new row.
  const made = await realFetch(`${base}/suggest`, form(`p=4242&m=${month}&d=${dayOfMonth}`));
  assert.equal(made.status, 303);
  assert.equal(made.headers.get("location"), `/${slug}/?suggested=kept&on=${SUGGESTION}#wt-${SUGGESTION}`);
  const setCookie = made.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /^bt=[A-Za-z0-9_-]{16,}; Path=\/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure$/, "the buzz's own cookie, the same flags");
  const cookie = setCookie.split(";")[0]!;
  const asked = JSON.parse(calls.filter((c) => c.url.endsWith("/rpc/wall_suggest_topic")).pop()!.body) as Record<string, unknown>;
  assert.deepEqual(Object.keys(asked).sort(), ["page_id_in", "voter_token_in"], "a number and a token, never a title or a phrase");
  assert.equal(asked.page_id_in, 4242);
  assert.equal(`bt=${asked.voter_token_in}`, cookie);

  // The page it lands on: fresh, never stored, the row there at once, the
  // box put away by this browser's own standing, and the Undo.
  standingSuggested = SUGGESTION;
  const landed = await realFetch(`${base}/${slug}/?suggested=kept&on=${SUGGESTION}`, { headers: { Cookie: cookie } });
  assert.equal(landed.headers.get("cache-control"), "no-store");
  const landedPage = await landed.text();
  assert.ok(landedPage.includes(`id="wt-${SUGGESTION}"`), "on the list at once, not at the next tick");
  assert.ok(landedPage.includes("<b>Suggested today</b>"));
  assert.ok(landedPage.includes("with your free buzz on it"));
  assert.ok(landedPage.includes('action="/suggest/undo"'));
  assert.ok(landedPage.includes(".tgask,.tgresults{display:none}.tgdone{display:block}"), "ONE A DAY: the box is put away for this browser");
  assert.ok(landedPage.includes(`#wt-${SUGGESTION} .tgmine{display:inline}`));
  // A stranger handed that address gets no Undo and keeps the box.
  standingSuggested = null;
  const stranger = await (await realFetch(`${base}/${slug}/?suggested=kept&on=${SUGGESTION}`, { headers: { Cookie: "bt=abcdefghijklmnopqrstuvwxyz012345" } })).text();
  assert.ok(!stranger.includes('action="/suggest/undo"'));
  assert.ok(!stranger.includes(".tgask,.tgresults{display:none}"));

  // ONE A DAY: a second suggestion from the same browser is the database's
  // refusal, said on the page, and the same token went with it.
  suggestWord = { result: "suggested", story_id: SUGGESTION };
  const again = await realFetch(`${base}/suggest`, form(`p=777&m=${month}&d=${dayOfMonth}`, { Cookie: cookie }));
  assert.equal(again.headers.get("location"), `/${slug}/?suggested=suggested&on=${SUGGESTION}#suggest`);
  assert.equal(again.headers.get("set-cookie")?.split(";")[0], cookie, "the same browser, the same token");
  const secondAsk = JSON.parse(calls.filter((c) => c.url.endsWith("/rpc/wall_suggest_topic")).pop()!.body) as { voter_token_in: string };
  assert.equal(`bt=${secondAsk.voter_token_in}`, cookie);
  standingSuggested = SUGGESTION;
  const againPage = await (await realFetch(`${base}/${slug}/?suggested=suggested&on=${SUGGESTION}`, { headers: { Cookie: cookie } })).text();
  assert.ok(againPage.includes("You have already suggested something today. It is one a day"));
  assert.ok(!againPage.includes('action="/suggest/undo"'), "no Undo after a refusal");

  // DEDUPE in the database: a hand made post for something already filed is
  // pointed at the tile, which is drawn with its buzz under the sentence.
  suggestWord = { result: "exists", story_id: PERSON };
  const exists = await realFetch(`${base}/suggest`, form(`p=19637&m=${month}&d=${dayOfMonth}`, { Cookie: cookie }));
  assert.equal(exists.headers.get("location"), `/${slug}/?suggested=exists&on=${PERSON}#suggest`);
  const existsPage = await (await realFetch(`${base}/${slug}/?suggested=exists&on=${PERSON}`, { headers: { Cookie: cookie } })).text();
  const said = existsPage.slice(existsPage.indexOf('class="tgsaid"'), existsPage.indexOf("</div>", existsPage.indexOf('class="tgsaid"')));
  assert.ok(said.includes("Buzz it instead") && said.includes(`name="s" value="${PERSON}"`));

  // A word the server does not know is our failure.
  suggestWord = { result: "something_new" };
  const odd = await realFetch(`${base}/suggest`, form(`p=1&m=${month}&d=${dayOfMonth}`, { Cookie: cookie }));
  assert.equal(odd.headers.get("location"), `/${slug}/?suggested=failed#suggest`);

  // Taking it back: only with the cookie that made it, through the buzz's own undo.
  assert.equal((await realFetch(`${base}/suggest/undo`, form(`s=${SUGGESTION}&m=${month}&d=${dayOfMonth}`))).status, 400, "no cookie, no undo");
  assert.equal((await realFetch(`${base}/suggest/undo`, form(`k=person:Q7259&m=${month}&d=${dayOfMonth}`, { Cookie: cookie }))).status, 400, "an undo names its story");
  const undone = await realFetch(`${base}/suggest/undo`, form(`s=${SUGGESTION}&m=${month}&d=${dayOfMonth}`, { Cookie: cookie }));
  assert.equal(undone.headers.get("location"), `/${slug}/?suggested=undone#suggest`);
  const forgot = JSON.parse(calls.filter((c) => c.url.endsWith("/rpc/wall_forget_boost")).pop()!.body) as { story_id_in: string; voter_token_in: string };
  assert.equal(forgot.story_id_in, SUGGESTION);
  assert.equal(`bt=${forgot.voter_token_in}`, cookie);

  // A box loaded before midnight and used after it: the database files the
  // suggestion on today, so the reader is sent to today's page.
  suggestWord = { result: "kept", story_id: SUGGESTION };
  const otherMonth = month === 1 ? 2 : 1;
  const late = await realFetch(`${base}/suggest`, form(`p=4242&m=${otherMonth}&d=1`, { Cookie: cookie, "X-Forwarded-For": "198.51.100.1" }));
  assert.equal(late.headers.get("location"), `/${slug}/?suggested=kept&on=${SUGGESTION}#wt-${SUGGESTION}`);

  // A buzz from the museum on a row the build did not bake (a person past the
  // thirty, a fact found since) lands on the sentence that says it counted,
  // and on the row when the page carries it.
  const museumBuzz = (): Promise<Response> => realFetch(`${base}/boost`, form(`k=person:Q7259&m=${month}&d=${dayOfMonth}&v=museum`, { Cookie: cookie, "X-Forwarded-For": "198.51.100.2" }));
  assert.equal((await museumBuzz()).headers.get("location"), `/${slug}/?tapped=kept&on=${PERSON}#wkept`);
  await writeFile(join(root, slug, "index.html"), BAKED.replace("<p>museum</p>", '<ul><li class="mrow" id="m-person-Q7259" data-k="person:Q7259">Ada Lovelace</li></ul>'), "utf8");
  assert.equal((await museumBuzz()).headers.get("location"), `/${slug}/?tapped=kept&on=${PERSON}#m-person-Q7259`);
  // And the page that follows a buzz that counted shows that sentence
  // whatever the fragment found.
  const after = await (await realFetch(`${base}/${slug}/?tapped=kept&on=${PERSON}`, { headers: { Cookie: cookie, "X-Forwarded-For": "198.51.100.3" } })).text();
  assert.ok(after.includes("<style>#wkept{display:block}</style>"));

  // THE GUARD. There is no phone on the web: a suggestion is checked the way
  // a website buzz is, the token cookie and the per address ceiling, and the
  // two share one ceiling, so suggesting cannot be used to go around it.
  suggestWord = { result: "suggested", story_id: SUGGESTION };
  const flood = { "X-Forwarded-For": "203.0.113.77", Cookie: cookie };
  const statuses: number[] = [];
  for (let i = 0; i < 41; i += 1) statuses.push((await realFetch(`${base}/suggest`, form(`p=4242&m=${month}&d=${dayOfMonth}`, flood))).status);
  assert.deepEqual([...new Set(statuses.slice(0, 40))], [303], "forty a minute from one address");
  assert.equal(statuses[40], 400, "and the forty first is refused before the database");
  const boost = await realFetch(`${base}/boost`, form(`s=${NEWS}&m=${month}&d=${dayOfMonth}`, flood));
  assert.equal(boost.status, 400, "the buzz from that address is past the same ceiling");
  const elsewhere = await realFetch(`${base}/suggest`, form(`p=4242&m=${month}&d=${dayOfMonth}`, { "X-Forwarded-For": "203.0.113.78", Cookie: cookie }));
  assert.equal(elsewhere.status, 303, "another address is not");
  // Typing has its own count, so searching never spends the ceiling a suggestion needs.
  const typed = await realFetch(`${base}/suggest/search`, form(`q=ada&m=${month}&d=${dayOfMonth}`, { ...flood, Accept: "application/json" }));
  assert.equal(typed.status, 200);
});
