// The song in your head on the server, docs/the-wall.md section 31: the
// pick, the search, the undo, the covers and the chart, against a faked
// project and a faked Apple. The database's own rules are tested against the
// migration in worker/test/song-migration.test.ts.

import { strict as assert } from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { forgetWalls, readPick, sangFrom, soughtFrom, start } from "../src/serve.js";
import { forgetApple, rememberArt, searchKey, searchSongs, mayAskApple } from "../src/song-apple.js";
import { SONG_SCRIPT_SOURCE, type Found } from "../src/song-prompt.js";
import { SUGGEST_SCRIPT_SOURCE } from "../src/suggest.js";
import { WALL_END, WALL_START, openWallDates } from "../src/wall.js";

const BAKED = `<html><body><h1>A day</h1>${WALL_START}<section class="wall">baked</section>${WALL_END}<p>feed</p></body></html>`;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const SONG_STORY = "cccccccc-0000-4000-8000-000000000001";
const TOKEN = "bt=abcdefghijklmnopqrstuvwxyz012345";

test("a posted pick is a track number and a date, and nothing else gets through", () => {
  assert.deepEqual(readPick("t=1738363970&m=10&d=3"), { track: "1738363970", month: 10, day: 3 });
  assert.equal(readPick("t=&m=10&d=3"), null);
  assert.equal(readPick("t=0&m=10&d=3"), null);
  assert.equal(readPick("t=12a&m=10&d=3"), null);
  assert.equal(readPick("t=1234567890123456&m=10&d=3"), null, "longer than any track number");
  assert.equal(readPick("t=1&m=13&d=3"), null);
  assert.equal(readPick("t=1&m=10&d=0"), null);
});

test("only a word the server knows comes back from a redirect, and only tracks come back from a search", () => {
  assert.equal(sangFrom("sang=kept&on=x"), "kept");
  assert.equal(sangFrom("sang=answered"), "answered");
  assert.equal(sangFrom("sang=<script>"), null);
  assert.equal(sangFrom(undefined), null);
  const known: Found = { id: "1738363970", title: "Espresso", artist: "Sabrina Carpenter", artistId: "1", released: "", year: null, explicit: false, artwork: null };
  const lookup = (ids: string[]): Found[] => ids.includes("1738363970") ? [known] : [];
  assert.deepEqual(soughtFrom("songs=1738363970", lookup), [known]);
  assert.equal(soughtFrom("songs=none", lookup), "none");
  assert.equal(soughtFrom("songs=busy", lookup), "busy");
  assert.equal(soughtFrom("songs=42", lookup), "expired", "a search this process has forgotten says search again");
  assert.equal(soughtFrom("songs=espresso", lookup), null, "never a phrase");
  assert.equal(soughtFrom("songs=1,2,3,4,5,6,7,8,9", lookup), null, "never more than a search offers");
});

test("Apple is asked at most eighteen times a minute, and a phrase is asked once", async () => {
  forgetApple();
  const now = Date.parse("2026-10-03T18:00:00Z");
  let asked = 0;
  for (let i = 0; i < 25; i += 1) if (mayAskApple(now + i)) asked += 1;
  assert.equal(asked, 18);
  assert.equal(mayAskApple(now + 61_000), true, "a minute later it may ask again");
  forgetApple();
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ results: [{ wrapperType: "track", kind: "song", trackId: 1, trackName: "Espresso", artistName: "Sabrina Carpenter", artistId: 2, releaseDate: "2024-04-11T12:00:00Z" }] }), { status: 200 });
  }) as typeof fetch;
  try {
    assert.equal(searchKey("  Espresso   SABRINA "), "espresso sabrina");
    const first = await searchSongs("Espresso Sabrina", now);
    const second = await searchSongs("  espresso   sabrina ", now + 1000);
    assert.deepEqual(first, second);
    assert.equal(calls, 1, "the same phrase, folded, is answered from memory");
    assert.deepEqual(await searchSongs("e", now), [], "one letter asks nothing");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = real;
    forgetApple();
  }
});

test("today's date page asks the question, a pick lands on the board at once, a second pick is refused, and an answer can be taken back", async (t) => {
  const root = resolve("test-site-song");
  await rm(root, { recursive: true, force: true });
  const [todayKey, todayDate] = [...openWallDates().entries()][1]!;
  const [month, dayOfMonth] = todayKey.split("-").map(Number) as [number, number];
  const slug = `${MONTHS[month - 1]}-${dayOfMonth}`;
  await mkdir(join(root, slug), { recursive: true });
  await writeFile(join(root, slug, "index.html"), BAKED, "utf8");

  // The project, faked, and Apple, faked. Every request is recorded.
  const realFetch = globalThis.fetch;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_ANON_KEY = "test-key";
  const calls: Array<{ url: string; body: string }> = [];
  let answered = false;
  let answerWord: Record<string, unknown> = { result: "kept", story_id: SONG_STORY, support: 1, left: 3, allowance: 3, backed: [SONG_STORY], answered: SONG_STORY };
  let standingAnswered: string | null = null;
  const numberOnes = [2019, 1994, 1961].map((year, i) => ({
    id: `dddddddd-0000-4000-8000-00000000000${i}`, wall_date: todayDate, submitted_at: "2026-01-02T12:00:00Z",
    headline: `${year}: "Number One ${year}" by Band ${year} was the number one song`, url: `https://en.wikipedia.org/wiki/${year}`, outlet: "Wikipedia",
    status: "pool", tier: "claimed", support: 0, priority: 1, placed_at: null, anchor_mx: null, anchor_my: null, w_modules: null, h_modules: null,
    false_at: null, false_note: null, subject_kind: "song", subject_id: `${year}-01-01`, wall_sources: [],
  }));
  const songStory = {
    id: SONG_STORY, wall_date: todayDate, submitted_at: "2026-01-02T13:00:00Z",
    headline: '2024: "Espresso" by Sabrina Carpenter', url: "https://music.apple.com/us/album/espresso/1738363766?i=1738363970", outlet: "Apple Music",
    status: "pool", tier: "seen_direct", support: 1, priority: 0, placed_at: null, anchor_mx: null, anchor_my: null, w_modules: null, h_modules: null,
    false_at: null, false_note: null, subject_kind: "answer", subject_id: "1738363970", wall_sources: [],
  };
  const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: String(init?.body ?? "") });
    if (url.includes("itunes.apple.com/search")) {
      return json({ results: [
        { wrapperType: "track", kind: "song", trackId: 1750307020, trackName: "Espresso", artistName: "Sabrina Carpenter", artistId: 390647681, releaseDate: "2024-08-23T12:00:00Z", artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/b/100x100bb.jpg" },
        { wrapperType: "track", kind: "song", trackId: 1738363970, trackName: "Espresso", artistName: "Sabrina Carpenter", artistId: 390647681, releaseDate: "2024-04-11T12:00:00Z", artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg" },
        { wrapperType: "track", kind: "song", trackId: 2000000001, trackName: "Please Please Please", artistName: "Sabrina Carpenter", artistId: 390647681, releaseDate: "2024-06-06T12:00:00Z", trackExplicitness: "explicit" },
      ] });
    }
    if (url.includes("rss.marketingtools.apple.com")) {
      return json({ feed: { title: "Top Songs", results: [{ id: "6818209989", name: "Solar Eclipse", artistName: "Drake & Don Toliver", artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/c/100x100bb.jpg", contentAdvisoryRating: "Explict" }] } });
    }
    if (url.includes("mzstatic.com")) {
      return new Response(new Uint8Array(4096).fill(7), { status: 200, headers: { "Content-Type": "image/jpeg", "Content-Length": "4096" } });
    }
    if (!url.includes("supabase")) return realFetch(input, init);
    if (url.endsWith("/rpc/wall_answer_song")) { answered = true; return json(answerWord); }
    if (url.endsWith("/rpc/wall_forget_boost")) { answered = false; return json({ result: "undone", support: 0 }); }
    if (url.endsWith("/rpc/wall_web_standing")) return json({ allowance: 3, left: 3, backed: standingAnswered === null ? [] : [standingAnswered], answered: standingAnswered });
    if (url.includes("/rest/v1/wall_days")) return json([{ wall_date: todayDate, opens_at: "2026-01-01T05:00:00Z", live_at: "2026-01-02T05:00:00Z", closes_at: "2099-01-01T05:00:00Z", closed_at: null }]);
    if (url.includes("/rest/v1/wall_stories")) return json(answered ? [...numberOnes, songStory] : numberOnes);
    if (url.includes("/rest/v1/wall_boosts")) return json(answered ? [{ id: 9, story_id: SONG_STORY, units: 1, cast_at: "2026-01-02T13:00:00Z", answer: true }] : []);
    if (url.includes("/rest/v1/wall_songs")) {
      return json(url.includes("1738363970") ? [{ track_id: 1738363970, title: "Espresso", artist: "Sabrina Carpenter", album: "Espresso - Single", released: "2024-04-11", explicit: false, artwork_url: "https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg" }] : []);
    }
    return json([]);
  }) as typeof fetch;

  forgetApple();
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
    await rm(root, { recursive: true, force: true });
  });

  // A stranger lands on today's page: the question, the examples, the search
  // and the one script the header names.
  const first = await realFetch(`${base}/${slug}/`);
  assert.equal(first.status, 200);
  assert.ok((first.headers.get("content-security-policy") ?? "").includes(`script-src ${SONG_SCRIPT_SOURCE} ${SUGGEST_SCRIPT_SOURCE};`));
  const firstPage = await first.text();
  assert.ok(firstPage.includes("What song is in your head today?"));
  assert.ok(firstPage.includes("<b>Be the first.</b>"));
  assert.equal((firstPage.match(/>Example</g) ?? []).length, 3, "three examples, each marked");
  assert.ok(!firstPage.includes('class="sgchart"'), "the chart is read behind the first page and never waited for");
  await new Promise((done) => setTimeout(done, 20));
  forgetWalls();
  const second = await (await realFetch(`${base}/${slug}/`)).text();
  assert.ok(second.includes('class="sgchart"'), "the next page has the chart");
  assert.ok(second.includes("Chart data") && second.includes("Not answers from people here."), "labelled as chart data, not answers");
  assert.ok(second.includes("Solar Eclipse") && second.includes('<img src="/cover/6818209989.jpg"'));
  assert.equal(calls.filter((c) => c.url.includes("rss.marketingtools.apple.com")).length, 1, "read once");

  // A search with the script: JSON, one row per song, the oldest Espresso.
  const searched = await realFetch(`${base}/song/search`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: `q=${encodeURIComponent("espresso sabrina")}&m=${month}&d=${dayOfMonth}`,
  });
  assert.equal(searched.status, 200);
  assert.equal(searched.headers.get("cache-control"), "no-store");
  const results = (await searched.json()) as { results: Array<{ id: string; title: string; year: number; explicit: boolean }> };
  assert.deepEqual(results.results.map((r) => [r.id, r.title, r.year, r.explicit]), [["1738363970", "Espresso", 2024, false], ["2000000001", "Please Please Please", 2024, true]]);
  const appleCall = calls.find((c) => c.url.includes("itunes.apple.com/search"))!;
  assert.ok(appleCall.url.includes("term=espresso+sabrina") && appleCall.url.includes("entity=song") && appleCall.url.includes("country=US"));
  assert.ok(!calls.some((c) => c.url.includes("supabase") && c.url.includes("espresso")), "the phrase never goes to our database");

  // The same search without the script: back to the date page with track
  // numbers only, and the page draws them.
  const noScript = await realFetch(`${base}/song/search`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `q=espresso+sabrina&m=${month}&d=${dayOfMonth}`, redirect: "manual",
  });
  assert.equal(noScript.status, 303);
  const back = noScript.headers.get("location") ?? "";
  assert.equal(back, `/${slug}/?songs=1738363970,2000000001#song`);
  assert.ok(!back.includes("espresso"), "never the phrase");
  const picks = await (await realFetch(`${base}${back.split("#")[0]}`)).text();
  assert.ok(picks.includes('<form class="sgpick" method="post" action="/song"><input type="hidden" name="t" value="1738363970">'));

  // A cover, through this site.
  const cover = await realFetch(`${base}/cover/1738363970.jpg`);
  assert.equal(cover.status, 200);
  assert.equal(cover.headers.get("content-type"), "image/jpeg");
  assert.match(cover.headers.get("cache-control") ?? "", /max-age=86400/);
  assert.equal((await cover.arrayBuffer()).byteLength, 4096);
  assert.ok(calls.some((c) => c.url === "https://is1-ssl.mzstatic.com/image/thumb/a/300x300bb.jpg"), "Apple's artwork, at 300 pixels, asked by the server");
  assert.equal((await realFetch(`${base}/cover/31337.jpg`)).status, 404, "a track nobody has seen is a miss");
  assert.equal((await realFetch(`${base}/cover/..%2F..%2Fetc.jpg`)).status, 404);

  // The pick. A first time reader gets a token, the database is asked with
  // the track number and that token, and the reader lands on their song.
  const picked = await realFetch(`${base}/song`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `t=1738363970&m=${month}&d=${dayOfMonth}`, redirect: "manual",
  });
  assert.equal(picked.status, 303);
  assert.equal(picked.headers.get("location"), `/${slug}/?sang=kept&on=${SONG_STORY}#ws-${SONG_STORY}`);
  const cookie = (picked.headers.get("set-cookie") ?? "").split(";")[0]!;
  assert.match(cookie, /^bt=[A-Za-z0-9_-]{16,}$/);
  const asked = JSON.parse(calls.filter((c) => c.url.endsWith("/rpc/wall_answer_song")).pop()!.body) as { track_id_in: number; voter_token_in: string };
  assert.equal(asked.track_id_in, 1738363970);
  assert.equal(`bt=${asked.voter_token_in}`, cookie, "the token in the cookie is the token the database was given");

  // The page it lands on: fresh, never stored, the song on the board, the
  // examples gone, the sentence, and the Undo because the standing says so.
  standingAnswered = SONG_STORY;
  const landed = await realFetch(`${base}/${slug}/?sang=kept&on=${SONG_STORY}`, { headers: { Cookie: cookie } });
  assert.equal(landed.headers.get("cache-control"), "no-store");
  const landedPage = await landed.text();
  assert.ok(landedPage.includes(`id="ws-${SONG_STORY}"`), "the song is on the board at once, not at the next tick");
  assert.ok(!landedPage.includes(">Example<"), "the examples are gone");
  assert.ok(landedPage.includes("Your song is on today&#39;s board."));
  assert.ok(landedPage.includes('action="/song/undo"'));
  assert.ok(landedPage.includes(`#ws-${SONG_STORY} .sgmine{display:inline}`), "marked as this reader's own");
  assert.ok(landedPage.includes(".sgask,.sgresults,.sghint{display:none}"), "and the search put away");

  // A stranger handed that address gets no Undo: their standing says nothing.
  standingAnswered = null;
  const stranger = await (await realFetch(`${base}/${slug}/?sang=kept&on=${SONG_STORY}`, { headers: { Cookie: TOKEN } })).text();
  assert.ok(!stranger.includes('action="/song/undo"'));

  // A second pick the same day: the database's word, said on the page.
  answerWord = { result: "answered", story_id: SONG_STORY, left: 3, allowance: 3, backed: [SONG_STORY], answered: SONG_STORY };
  const again = await realFetch(`${base}/song`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: `t=2000000001&m=${month}&d=${dayOfMonth}`, redirect: "manual",
  });
  assert.equal(again.headers.get("location"), `/${slug}/?sang=answered&on=${SONG_STORY}#song`);
  assert.equal(again.headers.get("set-cookie")?.split(";")[0], cookie, "the same browser, the same token");
  standingAnswered = SONG_STORY;
  const againPage = await (await realFetch(`${base}/${slug}/?sang=answered&on=${SONG_STORY}`, { headers: { Cookie: cookie } })).text();
  assert.ok(againPage.includes("You already answered today. One song a day."));
  assert.ok(!againPage.includes('action="/song/undo"'), "no Undo after a refusal");

  // A word the server does not know is our failure.
  answerWord = { result: "something_new" };
  const odd = await realFetch(`${base}/song`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie }, body: `t=1&m=${month}&d=${dayOfMonth}`, redirect: "manual" });
  assert.equal(odd.headers.get("location"), `/${slug}/?sang=failed#song`);

  // A malformed pick never reaches the database.
  const before = calls.filter((c) => c.url.endsWith("/rpc/wall_answer_song")).length;
  const bad = await realFetch(`${base}/song`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "t=espresso&m=10&d=3", redirect: "manual" });
  assert.equal(bad.status, 400);
  assert.equal(calls.filter((c) => c.url.endsWith("/rpc/wall_answer_song")).length, before);
  assert.equal((await realFetch(`${base}/song`)).status, 404, "a GET is not a pick");

  // Taking it back.
  const undone = await realFetch(`${base}/song/undo`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: `s=${SONG_STORY}&m=${month}&d=${dayOfMonth}`, redirect: "manual",
  });
  assert.equal(undone.headers.get("location"), `/${slug}/?sang=undone#song`);
  const forgot = JSON.parse(calls.filter((c) => c.url.endsWith("/rpc/wall_forget_boost")).pop()!.body) as { story_id_in: string; voter_token_in: string };
  assert.equal(forgot.story_id_in, SONG_STORY);
  assert.equal(`bt=${forgot.voter_token_in}`, cookie);
  const noToken = await realFetch(`${base}/song/undo`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `s=${SONG_STORY}&m=${month}&d=${dayOfMonth}`, redirect: "manual" });
  assert.equal(noToken.status, 400, "a browser with no token answered nothing");
});

test("a cover is remembered from a search and fetched from Apple's image host only", async () => {
  forgetApple();
  rememberArt("5", "https://is1-ssl.mzstatic.com/image/thumb/z/100x100bb.jpg");
  const real = globalThis.fetch;
  const asked: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    asked.push(String(input));
    return new Response("<html>not an image</html>", { status: 200, headers: { "Content-Type": "text/html" } });
  }) as typeof fetch;
  try {
    const { coverFor } = await import("../src/song-apple.js");
    assert.equal(await coverFor("5", "https://project.example", undefined), null, "something that is not an image is refused");
    assert.deepEqual(asked, ["https://is1-ssl.mzstatic.com/image/thumb/z/300x300bb.jpg"]);
    rememberArt("6", "https://evil.example.com/image/thumb/z/100x100bb.jpg");
    assert.equal(await coverFor("6", "https://project.example", undefined), null);
    assert.equal(asked.length, 1, "a host that is not Apple's is never asked");
  } finally {
    globalThis.fetch = real;
    forgetApple();
  }
});
