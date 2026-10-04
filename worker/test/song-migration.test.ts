import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// The song in your head, docs/the-wall.md section 31, tested against the
// migration itself rather than a description of it.
//
// PGlite is Postgres compiled to run inside this process, plpgsql and all, so
// the real 20261003000000_the_song_in_your_head.sql runs here on top of the
// live project's wall tables and functions as they stood on October 3, 2026,
// copied with pg_get_functiondef into test/fixtures/wall-live-2026-10-03.sql.
// Apple is a table of canned answers standing in for the http extension.
// Without the package installed the tests are skipped and say so, the way
// wall-rls.test.ts skips without a database.
//
// What it cannot test is the real Apple: the lookup's request and Apple's
// real answer are only exercised on the live project.

const MIGRATIONS = "../supabase/migrations";
const read = (path: string): string => readFileSync(path, "utf8");

type Db = {
  exec(sql: string): Promise<unknown>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

let PGlite: (new () => Db) | null = null;
try {
  PGlite = (await import("@electric-sql/pglite")).PGlite as unknown as new () => Db;
} catch {
  PGlite = null;
}
const skip = PGlite === null ? "npm install in worker/ for @electric-sql/pglite to run this" : false;

const ART = "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/aa/bb/cc/x.jpg/100x100bb.jpg";
function track(id: number, name: string, artist: string, artistId: number, collection: string, released: string, explicit: boolean): Record<string, unknown> {
  return {
    wrapperType: "track", kind: "song", trackId: id, trackName: name, artistName: artist, artistId,
    collectionName: collection, releaseDate: released, trackExplicitness: explicit ? "explicit" : "notExplicit",
    artworkUrl100: ART, trackViewUrl: `https://music.apple.com/us/album/x/${id + 1}?i=${id}&uo=4`,
  };
}
const APPLE: Array<[number, number, unknown]> = [
  [1738363970, 200, { resultCount: 1, results: [track(1738363970, "Espresso", "Sabrina Carpenter", 390647681, "Espresso - Single", "2024-04-11T12:00:00Z", false)] }],
  [1750307020, 200, { resultCount: 1, results: [track(1750307020, "Espresso", "Sabrina Carpenter", 390647681, "Short n' Sweet", "2024-08-23T12:00:00Z", false)] }],
  [6818209989, 200, { resultCount: 1, results: [track(6818209989, "Solar Eclipse", "Drake & Don Toliver", 271256, "X", "2026-09-26T12:00:00Z", true)] }],
  [1111111111, 200, { resultCount: 1, results: [{ ...track(1111111111, "Bohemian Rhapsody", "Queen", 3296287, "A Night at the Opera (2011 Remaster)", "1975-10-31T12:00:00Z", false), artworkUrl100: "https://evil.example.com/x.jpg" }] }],
  [4242, 200, { resultCount: 1, results: [{ wrapperType: "collection", collectionId: 4242, collectionName: "An album" }] }],
  [5555, 503, "Service Unavailable"],
  [7777, 200, "<html>not json</html>"],
];

const T = (n: number): string => `checktoken-${String(n).repeat(16)}`;

async function fresh(): Promise<Db> {
  const db = new PGlite!();
  await db.exec(read("test/fixtures/wall-live-2026-10-03.sql"));
  for (const [id, status, body] of APPLE) {
    await db.query("insert into extensions.fake_apple (uri, status, body) values ($1, $2, $3)",
      [`https://itunes.apple.com/lookup?id=${id}&entity=song&country=US`, status, typeof body === "string" ? body : JSON.stringify(body)]);
  }
  // Yesterday, today and tomorrow by the Eastern clock, as the worker opens
  // them, with five stories on yesterday and today.
  await db.exec(`
    insert into wall_days (wall_date, opens_at, live_at, closes_at)
    select d, ((d - 1)::timestamp at time zone 'America/New_York'), (d::timestamp at time zone 'America/New_York'), ((d + 2)::timestamp at time zone 'America/New_York')
      from (select ((now() at time zone 'America/New_York')::date + k) as d from generate_series(-1, 1) k) q;
    insert into wall_stories (wall_date, headline, url, url_key, outlet, subject_kind, subject_id)
    select (now() at time zone 'America/New_York')::date + o, 'Story ' || o || '-' || k, 'https://example.org/' || o || '/' || k, 'https://example.org/' || o || '/' || k, 'example.org',
           case when k % 2 = 0 then 'historical_event' else null end, case when k % 2 = 0 then k::text else null end
      from generate_series(1, 5) k, generate_series(-1, 0) o;
  `);
  await db.exec(read(`${MIGRATIONS}/20261003000000_the_song_in_your_head.sql`));
  return db;
}

async function value<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const row = (await db.query<Record<string, unknown>>(sql, params)).rows[0]!;
  return Object.values(row)[0] as T;
}
type Word = Record<string, unknown> & { result: string; story_id?: string; support?: number; left?: number; answered?: string | null };
const answer = (db: Db, id: number, token: string): Promise<Word> => value<Word>(db, "select wall_answer_song($1, $2)", [id, token]);
const buzz = (db: Db, story: string, token: string): Promise<Word> => value<Word>(db, "select wall_cast_web_boost($1, $2)", [story, token]);
const today = (db: Db): Promise<string> => value<string>(db, "select (now() at time zone 'America/New_York')::date::text");
async function others(db: Db, date: string): Promise<string[]> {
  return (await db.query<{ id: string }>("select id from wall_stories where wall_date = $1::date and subject_kind is distinct from 'answer' order by headline limit 4", [date])).rows.map((r) => r.id);
}
async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "";
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}

test("dedupe by track and by song: one story per song however Apple spelled the version, one lookup per track", { skip }, async () => {
  const db = await fresh();
  const first = await answer(db, 1738363970, T(1));
  assert.equal(first.result, "kept");
  const story = (await db.query<Record<string, unknown>>("select * from wall_stories where id = $1", [first.story_id])).rows[0]!;
  assert.equal(story.headline, '2024: "Espresso" by Sabrina Carpenter', "Apple's year in front, the way every dated row on the hive carries one");
  assert.equal(story.subject_kind, "answer");
  assert.equal(story.tier, "seen_direct");
  assert.equal(story.url_key, "answer:390647681:espresso");
  assert.equal(story.submitted_by, null);

  const album = await answer(db, 1750307020, T(2));
  assert.equal(album.result, "kept");
  assert.equal(album.story_id, first.story_id, "the album version is the same song");
  const same = await answer(db, 1738363970, T(3));
  assert.equal(same.story_id, first.story_id, "the same track is the same song");
  assert.equal(same.support, 3);
  assert.equal(await value<number>(db, "select count(*)::int from wall_stories where subject_kind = 'answer'"), 1);
  assert.equal(await value<number>(db, "select count(*)::int from wall_boosts where story_id = $1 and answer", [first.story_id]), 3, "three heads");
  assert.equal(await value<number>(db, "select count(*)::int from extensions.calls where uri like '%id=1738363970%'"), 1, "Apple asked once for the track");
  const source = (await db.query<Record<string, unknown>>("select * from wall_sources where story_id = $1", [first.story_id])).rows;
  assert.equal(source.length, 1);
  assert.equal(source[0]!.is_primary_doc, true);
  assert.equal(source[0]!.imported, true);
  assert.equal(source[0]!.quotation, '"Espresso" by Sabrina Carpenter, from Espresso - Single, released 2024-04-11. Apple Music track 1738363970.');
});

test("one answer per browser per day, and it is free: the three buzzes are still there", { skip }, async () => {
  const db = await fresh();
  const date = await today(db);
  const first = await answer(db, 1738363970, T(1));
  assert.equal(first.result, "kept");
  assert.equal(first.left, 3, "the answer spent none of the three");
  assert.equal(first.answered, first.story_id);
  const second = await answer(db, 6818209989, T(1));
  assert.equal(second.result, "answered", "a second song the same day is refused");
  assert.equal(second.story_id, first.story_id);
  assert.equal(await value<number>(db, "select count(*)::int from extensions.calls where uri like '%id=6818209989%'"), 0, "and Apple was not even asked");
  const words: string[] = [];
  for (const id of await others(db, date)) words.push((await buzz(db, id, T(1))).result);
  assert.deepEqual(words, ["kept", "kept", "kept", "spent"]);
  assert.equal((await buzz(db, first.story_id!, T(1))).result, "already", "your own song takes no second buzz from you");

  // The index holds it even against a direct insert.
  const ids = await others(db, date);
  const twice = await refusal(() => db.exec(`begin; select set_config('wall.boost_auth', 'web_token', true); select set_config('wall.boost_answer', 'answer', true);
    insert into wall_boosts (story_id, booster_id, wall_date, units, tier_at_cast, support_before) values ('${ids[0]}', wall_web_booster_id('${T(1)}'), '${date}', 1, 'claimed', 0); commit;`));
  await db.exec("rollback").catch(() => {});
  assert.match(twice, /wall_boosts_one_answer_a_day/);

  // Only on the date itself: yesterday's hive still takes its one buzz, and
  // never an answer.
  const yesterday = (await others(db, (await value<string>(db, "select ($1::date - 1)::text", [date]))))[0]!;
  const late = await refusal(() => db.exec(`begin; select set_config('wall.boost_auth', 'web_token', true); select set_config('wall.boost_answer', 'answer', true);
    insert into wall_boosts (story_id, booster_id, wall_date, units, tier_at_cast, support_before) values ('${yesterday}', wall_web_booster_id('${T(9)}'), '${date}'::date - 1, 1, 'claimed', 0); commit;`));
  await db.exec("rollback").catch(() => {});
  assert.match(late, /own date only/);
  assert.equal((await buzz(db, yesterday, T(1))).result, "kept", "yesterday's one buzz is untouched by the answer");

  // A caller cannot mark its own row an answer: the flag is the trigger's.
  await db.exec(`insert into wall_boosts (story_id, booster_id, wall_date, units, tier_at_cast, support_before, answer) values ('${ids[1]}', wall_web_booster_id('${T(8)}'), '${date}', 1, 'claimed', 0, true)`);
  assert.equal(await value<number>(db, "select count(*)::int from wall_boosts where booster_id = wall_web_booster_id($1) and answer", [T(8)]), 0);
});

test("a song already buzzed cannot also be your answer, and a taken back answer frees the day's answer", { skip }, async () => {
  const db = await fresh();
  const date = await today(db);
  const espresso = (await answer(db, 1738363970, T(1))).story_id!;
  assert.equal((await buzz(db, espresso, T(4))).result, "kept");
  assert.equal((await answer(db, 1738363970, T(4))).result, "already");
  assert.equal(await value<number>(db, "select count(*)::int from wall_boosts where booster_id = wall_web_booster_id($1) and answer", [T(4)]), 0);
  assert.equal((await answer(db, 6818209989, T(4))).result, "kept", "a different song is still free to answer with");

  assert.equal((await answer(db, 1738363970, T(3))).result, "kept");
  const undone = await value<Word>(db, "select wall_forget_boost($1, $2)", [espresso, T(3)]);
  assert.equal(undone.result, "undone");
  const standing = await value<Word>(db, "select wall_web_standing($1::date, $2)", [date, T(3)]);
  assert.equal(standing.answered, null);
  assert.equal((await answer(db, 1111111111, T(3))).result, "kept", "the answer is free again");
});

test("Apple's words only: a lookup that is not a song, or that fails, files nothing", { skip }, async () => {
  const db = await fresh();
  assert.equal((await answer(db, 4242, T(5))).result, "no_song", "an album is not a song");
  assert.equal((await answer(db, 31337, T(5))).result, "no_song", "nothing found");
  assert.equal((await answer(db, 5555, T(5))).result, "busy", "Apple refused");
  assert.equal((await answer(db, 7777, T(5))).result, "busy", "Apple said something that is not its lookup");
  assert.equal((await answer(db, 999999, T(5))).result, "busy", "Apple timed out");
  assert.equal(await value<number>(db, "select count(*)::int from wall_songs"), 0);
  assert.equal((await answer(db, 1738363970, "short")).result, "bad_token");
  const queen = await answer(db, 1111111111, T(5));
  assert.equal(queen.result, "kept");
  assert.equal(await value<string | null>(db, "select artwork_url from wall_songs where track_id = 1111111111"), null, "artwork off Apple's image host is dropped");
  assert.equal(await value<string>(db, "select headline from wall_stories where id = $1", [queen.story_id]), '1975: "Bohemian Rhapsody" by Queen');
  assert.equal(await value<boolean>(db, "select explicit from wall_songs where track_id = 1111111111"), false);
});

test("a curator hides a song from every reader, before the seal, and nobody else can", { skip }, async () => {
  const db = await fresh();
  const song = (await answer(db, 6818209989, T(1))).story_id!;
  assert.match(await refusal(() => db.query("select wall_hide_song($1, 'reason')", [song])), /only a curator/);
  await db.exec("set test.admin = 'yes'");
  assert.match(await refusal(() => db.query("select wall_hide_song($1, '  ')", [song])), /say why/);
  assert.equal((await value<Word>(db, "select wall_hide_song($1, 'not for the board')", [song])).result, "hidden");
  const list = (await db.query<{ heads: number; hidden_at: string | null }>("select * from wall_songs_for_curator()")).rows;
  assert.equal(list.length, 1);
  assert.equal(list[0]!.heads, 1);
  assert.ok(list[0]!.hidden_at !== null);
  await db.exec("reset test.admin");
  assert.equal((await answer(db, 6818209989, T(2))).result, "hidden", "a hidden song takes no answer");
  const record = await value<{ buzzes: Array<{ story_id: string }> }>(db, "select wall_web_record($1)", [T(1)]);
  assert.deepEqual(record.buzzes, [], "and the private record of the browser that answered with it no longer lists it");
  assert.equal((await buzz(db, song, T(2))).result, "no_story", "and no buzz");
  await db.exec("set role anon");
  assert.equal(await value<number>(db, "select count(*)::int from wall_stories where id = $1", [song]), 0, "a reader cannot see it");
  assert.match(await refusal(() => db.query("select wall_hide_song($1, 'x')", [song])), /permission denied/);
  await db.exec("reset role");
});

test("what the website's role may and may not touch", { skip }, async () => {
  const db = await fresh();
  await answer(db, 1738363970, T(1));
  await db.exec("set role anon");
  assert.ok(await value<number>(db, "select count(*)::int from wall_boosts where answer") >= 1, "it reads the answer column");
  assert.ok(await value<number>(db, "select count(*)::int from wall_songs") >= 1, "and the songs");
  assert.match(await refusal(() => db.query("select booster_id from wall_boosts limit 1")), /permission denied/, "never the booster");
  assert.match(await refusal(() => db.query("select wall_song_lookup(1)")), /permission denied/, "never Apple directly");
  assert.equal((await answer(db, 1750307020, T(2))).result, "kept", "it answers");
  await db.exec("reset role");
  await db.exec("set role authenticated");
  assert.match(await refusal(() => db.query("select wall_answer_song(1, $1)", [T(3)])), /permission denied/, "the app does not answer yet");
  await db.exec("reset role");
});

test("the midnight seal: no answer once the day has sealed, and the day's answer still names its song", { skip }, async () => {
  const db = await fresh();
  const date = await today(db);
  const song = (await answer(db, 1738363970, T(1))).story_id!;
  await db.exec(`update wall_days set closed_at = now() - interval '1 second' where wall_date = '${date}'`);
  assert.equal((await answer(db, 1738363970, T(2))).result, "closed");
  assert.equal((await buzz(db, song, T(2))).result, "closed");
  const standing = await value<Word>(db, "select wall_web_standing($1::date, $2)", [date, T(1)]);
  assert.equal(standing.answered, song);
  assert.equal(standing.left, 0);
  assert.equal((await value<Word>(db, "select wall_forget_boost($1, $2)", [song, T(1)])).result, "closed", "and nothing about it moves");
});

test("the two older unapplied files keep the change when applied after this one, and fail when applied before it", { skip }, async () => {
  const db = await fresh();
  await db.exec(read(`${MIGRATIONS}/20260911020000_the_anniversary.sql`));
  const a = await answer(db, 1738363970, T(1));
  assert.equal(a.result, "kept");
  assert.equal(a.left, 3);
  assert.equal(a.answered, a.story_id);
  assert.ok(Array.isArray(a.anniversary));
  await db.exec(read(`${MIGRATIONS}/20260923010000_buzzes_that_refill.sql`));
  const b = await answer(db, 1750307020, T(2));
  assert.equal(b.result, "kept");
  assert.equal(b.answered, b.story_id);
  assert.ok("next_at" in b);
  const date = await today(db);
  const arrived = await value<number>(db, "select wall_boost_allowance(now(), $1::date)", [date]);
  const words: string[] = [];
  for (const id of await others(db, date)) words.push((await buzz(db, id, T(2))).result);
  assert.equal(words.filter((w) => w === "kept").length, arrived, "under refills the answer is still outside the budget");

  const early = new PGlite!();
  await early.exec(read("test/fixtures/wall-live-2026-10-03.sql"));
  await early.exec(read(`${MIGRATIONS}/20260911020000_the_anniversary.sql`));
  assert.match(await refusal(() => early.query("select wall_web_standing(current_date, $1)", [T(1)])), /answer/);
});
