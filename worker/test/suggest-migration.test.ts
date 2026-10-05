import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Suggestions on the page, docs/the-wall.md section 32, tested against the
// migration itself rather than a description of it.
//
// PGlite is Postgres compiled to run inside this process, so the real
// 20261005000000_suggestions_on_the_page.sql runs here on top of the live
// project's wall tables and functions as they stood on October 3, 2026
// (test/fixtures/wall-live-2026-10-03.sql) and the song migration, which was
// applied to the live project on October 4, 2026. Wikipedia is a table of
// canned answers standing in for the http extension, and the answers are
// copied from what Wikipedia's interface returned to the live project on
// October 5, 2026: Hurricane Milton, Sputnik 1, the Nobel Peace Prize,
// Mercury, which is a disambiguation page, and Albert Einstein, whose
// article number 21653 used to be a redirect. Without the package installed
// the tests are skipped and say so.
//
// What it cannot test is the real Wikipedia: the request and its real answer
// are only exercised on the live project.

const MIGRATIONS = "../supabase/migrations";
const read = (path: string): string => readFileSync(path, "utf8");

type Db = {
  exec(sql: string): Promise<unknown>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
};

/**
 * The database the last test opened. Each one is a whole Postgres in this
 * process's memory, so it is closed when the next test opens its own:
 * left open, a file's dozen of them were enough for a small machine to
 * kill the test run.
 */
let open: Db | null = null;
async function opened(db: Db): Promise<Db> {
  if (open !== null) await open.close().catch(() => undefined);
  open = db;
  return db;
}

let PGlite: (new () => Db) | null = null;
try {
  PGlite = (await import("@electric-sql/pglite")).PGlite as unknown as new () => Db;
} catch {
  PGlite = null;
}
const skip = PGlite === null ? "npm install in worker/ for @electric-sql/pglite to run this" : false;

/** The address wall_topic_lookup asks, for one article number. */
const ask = (id: number): string =>
  `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&pageids=${id}`
  + "&prop=info|pageprops|description|extracts&inprop=url&ppprop=wikibase_item|disambiguation"
  + "&exintro=1&explaintext=1&exsentences=1&redirects=1";

function page(id: number, title: string, item: string | null, description: string | null, extract: string, extra: Record<string, unknown> = {}): unknown {
  const pageprops: Record<string, string> = {};
  if (item !== null) pageprops.wikibase_item = item;
  return {
    batchcomplete: true,
    query: {
      pages: [{
        pageid: id, ns: 0, title, contentmodel: "wikitext", pagelanguage: "en",
        fullurl: `https://en.wikipedia.org/wiki/${title.replace(/ /g, "_")}`,
        canonicalurl: `https://en.wikipedia.org/wiki/${title.replace(/ /g, "_")}`,
        pageprops, ...(description === null ? {} : { description, descriptionsource: "local" }), extract, ...extra,
      }],
    },
  };
}

const MILTON = 78046814;
const SPUTNIK = 28484;
const NOBEL = 26230922;
const EINSTEIN = 736;
const MERCURY = 19007;
const OLD_REDIRECT = 21653;

const WIKIPEDIA: Array<[number, number, unknown]> = [
  [MILTON, 200, page(MILTON, "Hurricane Milton", "Q130428849", "Category 5 Atlantic hurricane in 2024",
    "Hurricane Milton was an extremely powerful and destructive tropical cyclone which caused major damage and fatalities in Florida in October 2024.")],
  [SPUTNIK, 200, page(SPUTNIK, "Sputnik 1", "Q80811", "First artificial Earth satellite",
    "Sputnik 1  (, Russian: Спутник-1, Satellite 1), often referred to as simply Sputnik, was the first artificial Earth satellite.")],
  [NOBEL, 200, page(NOBEL, "Nobel Peace Prize", "Q35637", "One of five Nobel Prizes",
    "The Nobel Peace Prize is one of the five original Nobel Prizes established by the will of Swedish industrialist, inventor, and armaments manufacturer Alfred Nobel, along with the prizes in Chemistry, Physics, Physiology or Medicine, and Literature.")],
  [EINSTEIN, 200, page(EINSTEIN, "Albert Einstein", "Q937", "German-born theoretical physicist (1879–1955)",
    "Albert Einstein (14 March 1879 – 18 April 1955) was a German-born theoretical physicist best known for developing the theory of relativity.")],
  [MERCURY, 200, page(MERCURY, "Mercury", "Q48397", "Topics referred to by the same term", "Mercury most commonly refers to:", { pageprops: { wikibase_item: "Q48397", disambiguation: "" } })],
  // Asked for 21653, Wikipedia followed the redirect and answered with
  // Intuitionism, article 19513, which is what came back on October 5.
  [OLD_REDIRECT, 200, { batchcomplete: true, query: { redirects: [{ from: "Neointuitionism", to: "Intuitionism" }], pages: [(page(19513, "Intuitionism", "Q10879018", "Approach in philosophy of mathematics and logic",
    "In philosophy of mathematics, intuitionism, or neointuitionism (opposed to preintuitionism), is an approach where mathematics is considered to be purely the result of the constructive mental activity of humans rather than the discovery of fundamental principles claimed to exist in an objective reality.") as { query: { pages: unknown[] } }).query.pages[0]] } }],
  [46302, 200, { batchcomplete: true, query: { pages: [{ pageid: 46302, missing: true }] } }],
  [5001, 200, page(5001, "List of Florida hurricanes", "Q6571014", null, "This is a list of hurricanes that have affected the US state of Florida.")],
  [5002, 200, page(5002, "Some talk page", null, null, "Not an article at all, and it says so at length.", { ns: 1 })],
  [5003, 200, page(5003, "Moved somewhere", "Q1", "A page that says it lives elsewhere", "A page whose address is not on Wikipedia at all.", { fullurl: "https://evil.example.com/wiki/Moved" })],
  [5004, 200, page(5004, "A small village", null, null, "Tiny.")],
  [5555, 503, "Service Unavailable"],
  [7777, 200, "<html>not json</html>"],
];

const T = (n: number): string => `checktoken-${String(n).repeat(16)}`;

async function fresh(withSuggestions = true): Promise<Db> {
  const db = await opened(new PGlite!());
  await db.exec(read("test/fixtures/wall-live-2026-10-03.sql"));
  for (const [id, status, body] of WIKIPEDIA) {
    await db.query("insert into extensions.fake_apple (uri, status, body) values ($1, $2, $3)", [ask(id), status, typeof body === "string" ? body : JSON.stringify(body)]);
  }
  // One song, so a browser can answer and suggest on the same day.
  await db.query("insert into extensions.fake_apple (uri, status, body) values ($1, 200, $2)", [
    "https://itunes.apple.com/lookup?id=1738363970&entity=song&country=US",
    JSON.stringify({ resultCount: 1, results: [{
      wrapperType: "track", kind: "song", trackId: 1738363970, trackName: "Espresso", artistName: "Sabrina Carpenter", artistId: 390647681,
      collectionName: "Espresso - Single", releaseDate: "2024-04-11T12:00:00Z", trackExplicitness: "notExplicit",
      artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/aa/bb/cc/x.jpg/100x100bb.jpg",
      trackViewUrl: "https://music.apple.com/us/album/x/1738363971?i=1738363970&uo=4",
    }] }),
  ]);
  // The live project's events table, as wide as the dedupe reads it.
  await db.exec(`
    create table historical_events (id bigint primary key, subject_url text);
    insert into historical_events values (15139, 'https://en.wikipedia.org/wiki/Sputnik_1'), (15140, null);
  `);
  // Yesterday, today and tomorrow by the Eastern clock, as the worker opens
  // them, with five plain stories on yesterday and today, and on today three
  // that a suggestion has to find rather than copy: a person born on the
  // date, an event whose line is about Sputnik 1, and a story whose own
  // address is the Nobel Peace Prize article.
  await db.exec(`
    insert into wall_days (wall_date, opens_at, live_at, closes_at)
    select d, ((d - 1)::timestamp at time zone 'America/New_York'), (d::timestamp at time zone 'America/New_York'), ((d + 2)::timestamp at time zone 'America/New_York')
      from (select ((now() at time zone 'America/New_York')::date + k) as d from generate_series(-1, 1) k) q;
    insert into wall_stories (wall_date, headline, url, url_key, outlet, subject_kind, subject_id)
    select (now() at time zone 'America/New_York')::date + o, 'Story ' || o || '-' || k, 'https://example.org/' || o || '/' || k, 'https://example.org/' || o || '/' || k, 'example.org',
           case when k % 2 = 0 then 'historical_event' else null end, case when k % 2 = 0 then (15140 + k)::text else null end
      from generate_series(1, 5) k, generate_series(-1, 0) o;
    insert into wall_stories (wall_date, headline, url, url_key, outlet, subject_kind, subject_id)
    values
      ((now() at time zone 'America/New_York')::date, 'Albert Einstein, German-born theoretical physicist, born 1879', 'https://www.wikidata.org/wiki/Q937', 'subject:person:Q937', 'wikidata.org', 'person', 'Q937'),
      ((now() at time zone 'America/New_York')::date, '1957: The Soviet Union launches Sputnik 1', 'https://en.wikipedia.org/wiki/October_4', 'subject:historical_event:15139', 'en.wikipedia.org', 'historical_event', '15139'),
      ((now() at time zone 'America/New_York')::date, 'The Nobel Peace Prize, explained', 'https://en.wikipedia.org/wiki/Nobel_Peace_Prize', wall_url_key('https://en.wikipedia.org/wiki/Nobel_Peace_Prize'), 'en.wikipedia.org', null, null);
  `);
  await db.exec(read(`${MIGRATIONS}/20261003000000_the_song_in_your_head.sql`));
  if (withSuggestions) await db.exec(read(`${MIGRATIONS}/20261005000000_suggestions_on_the_page.sql`));
  return db;
}

async function value<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const row = (await db.query<Record<string, unknown>>(sql, params)).rows[0]!;
  return Object.values(row)[0] as T;
}
type Word = Record<string, unknown> & { result: string; story_id?: string; support?: number; left?: number; suggested?: string | null; answered?: string | null };
const suggest = (db: Db, id: number, token: string): Promise<Word> => value<Word>(db, "select wall_suggest_topic($1, $2)", [id, token]);
const buzz = (db: Db, story: string, token: string): Promise<Word> => value<Word>(db, "select wall_cast_web_boost($1, $2)", [story, token]);
const today = (db: Db): Promise<string> => value<string>(db, "select (now() at time zone 'America/New_York')::date::text");
const asked = (db: Db, id: number): Promise<number> => value<number>(db, "select count(*)::int from extensions.calls where uri = $1", [ask(id)]);
async function plain(db: Db, date: string): Promise<string[]> {
  return (await db.query<{ id: string }>("select id from wall_stories where wall_date = $1::date and headline like 'Story %' order by headline limit 4", [date])).rows.map((r) => r.id);
}
async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "";
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}

test("a suggestion is a real article and becomes one tile in Wikipedia's words, with its suggester's free buzz", { skip }, async () => {
  const db = await fresh();
  const first = await suggest(db, MILTON, T(1));
  assert.equal(first.result, "kept");
  assert.equal(first.support, 1, "the suggestion is its suggester's buzz");
  const story = (await db.query<Record<string, unknown>>("select * from wall_stories where id = $1", [first.story_id])).rows[0]!;
  assert.equal(story.headline, "Hurricane Milton: Category 5 Atlantic hurricane in 2024");
  assert.equal(story.subject_kind, "suggestion");
  assert.equal(story.subject_id, "Q130428849");
  assert.equal(story.url_key, "subject:suggestion:Q130428849");
  assert.equal(story.url, "https://en.wikipedia.org/wiki/Hurricane_Milton");
  assert.equal(story.outlet, "Wikipedia");
  assert.equal(story.tier, "claimed");
  assert.equal(story.submitted_by, null);
  const source = (await db.query<Record<string, unknown>>("select * from wall_sources where story_id = $1", [first.story_id])).rows;
  assert.equal(source.length, 1);
  assert.equal(source[0]!.imported, true);
  assert.equal(source[0]!.quotation, "Hurricane Milton was an extremely powerful and destructive tropical cyclone which caused major damage and fatalities in Florida in October 2024.");
  assert.equal(await asked(db, MILTON), 1);
  assert.equal(await value<number>(db, "select count(*)::int from wall_boosts where story_id = $1 and suggested", [first.story_id]), 1);
});

test("dedupe: the same thing suggested twice, or already on today's hive in any shape, points at that tile and makes nothing new", { skip }, async () => {
  const db = await fresh();
  const date = await today(db);
  const milton = await suggest(db, MILTON, T(1));
  const again = await suggest(db, MILTON, T(2));
  assert.equal(again.result, "exists");
  assert.equal(again.story_id, milton.story_id, "the second browser is pointed at the first one's tile");
  assert.equal(again.support, 1, "and pointing spends nothing");
  assert.equal(again.suggested, null, "and the second browser still has its suggestion for the day");
  assert.equal(await asked(db, MILTON), 1, "Wikipedia was asked once for the article");

  const person = await value<string>(db, "select id from wall_stories where url_key = 'subject:person:Q937'");
  const einstein = await suggest(db, EINSTEIN, T(2));
  assert.equal(einstein.result, "exists", "a person born on the date is already a tile");
  assert.equal(einstein.story_id, person);

  const event = await value<string>(db, "select id from wall_stories where url_key = 'subject:historical_event:15139'");
  const sputnik = await suggest(db, SPUTNIK, T(2));
  assert.equal(sputnik.result, "exists", "an event whose line is about the article is already a tile");
  assert.equal(sputnik.story_id, event);

  const story = await value<string>(db, "select id from wall_stories where headline = 'The Nobel Peace Prize, explained'");
  const nobel = await suggest(db, NOBEL, T(2));
  assert.equal(nobel.result, "exists", "a story whose own address is the article is already a tile");
  assert.equal(nobel.story_id, story);

  assert.equal(await value<number>(db, "select count(*)::int from wall_stories where wall_date = $1::date and subject_kind = 'suggestion'", [date]), 1, "one suggestion story in all of that");
  assert.equal(await value<number>(db, "select count(*)::int from wall_boosts where booster_id = wall_web_booster_id($1)", [T(2)]), 0, "and the second browser spent nothing");
  assert.equal((await buzz(db, milton.story_id!, T(2))).result, "kept", "it can buzz the tile it was pointed at instead");
});

test("one suggestion per browser per day, and it is free: the three buzzes and the song are still there", { skip }, async () => {
  const db = await fresh();
  const date = await today(db);
  const first = await suggest(db, MILTON, T(3));
  assert.equal(first.result, "kept");
  assert.equal(first.left, 3, "the suggestion spent none of the three");
  assert.equal(first.suggested, first.story_id, "the standing names it");
  const second = await suggest(db, OLD_REDIRECT, T(3));
  assert.equal(second.result, "suggested", "a second suggestion the same day is refused");
  assert.equal(second.story_id, first.story_id);
  assert.equal(await asked(db, OLD_REDIRECT), 0, "and Wikipedia was not even asked");
  const words: string[] = [];
  for (const id of await plain(db, date)) words.push((await buzz(db, id, T(3))).result);
  assert.deepEqual(words, ["kept", "kept", "kept", "spent"], "the three are all still there");
  assert.equal((await buzz(db, first.story_id!, T(3))).result, "already", "your own suggestion takes no second buzz from you");
  const song = await value<Word>(db, "select wall_answer_song(1738363970, $1)", [T(3)]);
  assert.equal(song.result, "kept", "the day's song is a separate free row");
  assert.equal(song.suggested, first.story_id);
  assert.equal(song.answered, song.story_id);
  assert.equal(song.left, 0, "and the three were spent by the buzzes alone");

  // The index holds it even against a direct insert with the flag set.
  const other = await value<string>(db, "select id from wall_stories where url_key = 'subject:person:Q937'");
  const forced = await refusal(() => db.exec(`begin;
    select set_config('wall.boost_auth', 'web_token', true), set_config('wall.boost_suggest', 'suggest', true);
    insert into wall_boosts (story_id, booster_id, wall_date, units, tier_at_cast, support_before)
      values ('${other}', wall_web_booster_id('${T(3)}'), '${date}', 1, 'claimed', 0);
    commit;`));
  await db.exec("rollback").catch(() => undefined);
  assert.match(forced, /wall_boosts_one_suggestion_a_day/);

  // Undone inside the thirty seconds, the day's suggestion is free again.
  assert.equal((await value<Word>(db, "select wall_forget_boost($1, $2)", [first.story_id, T(3)])).result, "undone");
  assert.equal((await suggest(db, OLD_REDIRECT, T(3))).result, "kept", "the suggestion is free again");
});

test("a suggestion taken back is taken up by the next browser that suggests it, never pointed at as a tile nobody can see", { skip }, async () => {
  const db = await fresh();
  const first = await suggest(db, MILTON, T(4));
  assert.equal(first.result, "kept");
  assert.equal((await value<Word>(db, "select wall_forget_boost($1, $2)", [first.story_id, T(4)])).result, "undone");
  assert.equal(await value<number>(db, "select support from wall_stories where id = $1", [first.story_id]), 0, "filed, with nobody behind it");
  const next = await suggest(db, MILTON, T(5));
  assert.equal(next.result, "kept", "not exists: the tile it would point at is drawn nowhere");
  assert.equal(next.story_id, first.story_id, "the same story, taken up again, not a second one");
  assert.equal(next.support, 1, "with the new browser's free buzz on it");
  assert.equal(next.suggested, first.story_id);
  assert.equal(await value<number>(db, "select count(*)::int from wall_stories where url_key like 'subject:suggestion:%'"), 1);
  assert.equal(await value<number>(db, "select count(*)::int from wall_sources where story_id = $1", [first.story_id]), 1, "and its one source, not a second");
  // Once somebody stands behind it again, it is an ordinary tile already there.
  assert.equal((await suggest(db, MILTON, T(6))).result, "exists");
  // The browser that took its own back may suggest again, and is pointed at the tile like anybody.
  const back = await suggest(db, MILTON, T(4));
  assert.equal(back.result, "exists");
});

test("a ceiling for the whole site: twenty new suggestions a minute and three hundred a day, before Wikipedia is asked", { skip }, async () => {
  const db = await fresh();
  const date = await today(db);
  const file = (n: number, minutesAgo: number): Promise<unknown> => db.query(
    `insert into wall_stories (wall_date, headline, url, url_key, outlet, tier, status, priority, subject_kind, subject_id, submitted_at)
     select $1::date, 'Filler ' || g, 'https://en.wikipedia.org/wiki/Filler_' || g, 'subject:suggestion:wp9' || g || '_' || $3::int, 'Wikipedia', 'claimed', 'pool', 0, 'suggestion', 'wp9' || g, now() - make_interval(mins => $3::int)
       from generate_series(1, $2::int) g`, [date, n, minutesAgo]);
  await file(20, 0);
  const crowded = await suggest(db, MILTON, T(7));
  assert.equal(crowded.result, "crowded", "a script with fresh tokens meets the ceiling");
  assert.equal(await asked(db, MILTON), 0, "and Wikipedia is not asked for it");
  assert.equal(await value<number>(db, "select count(*)::int from wall_boosts where booster_id = wall_web_booster_id($1)", [T(7)]), 0, "nothing spent");
  await db.query("update wall_stories set submitted_at = now() - interval '2 minutes' where headline like 'Filler %'");
  assert.equal((await suggest(db, MILTON, T(7))).result, "kept", "a minute later the box takes it");
  await file(279, 5);
  assert.equal((await suggest(db, SPUTNIK + 1000000, T(8))).result, "full", "three hundred in a day is the day's");
});

test("an answer and a suggestion are two different free rows, and the trigger will not let one row be both", { skip }, async () => {
  const db = await fresh();
  const date = await today(db);
  const story = await value<string>(db, "select id from wall_stories where url_key = 'subject:person:Q937'");
  const both = await refusal(() => db.exec(`begin;
    select set_config('wall.boost_auth', 'web_token', true), set_config('wall.boost_suggest', 'suggest', true), set_config('wall.boost_answer', 'answer', true);
    insert into wall_boosts (story_id, booster_id, wall_date, units, tier_at_cast, support_before)
      values ('${story}', wall_web_booster_id('${T(4)}'), '${date}', 1, 'claimed', 0);
    commit;`));
  await db.exec("rollback").catch(() => undefined);
  assert.match(both, /an answer or a suggestion, not both/);
  const yesterday = await value<string>(db, "select id from wall_stories where wall_date = $1::date - 1 limit 1", [date]);
  const late = await refusal(() => db.exec(`begin;
    select set_config('wall.boost_auth', 'web_token', true), set_config('wall.boost_suggest', 'suggest', true);
    insert into wall_boosts (story_id, booster_id, wall_date, units, tier_at_cast, support_before)
      values ('${yesterday}', wall_web_booster_id('${T(4)}'), '${date}', 1, 'claimed', 0);
    commit;`));
  await db.exec("rollback").catch(() => undefined);
  assert.match(late, /on its own date only/, "a suggestion lands on today's hive and no other");
});

test("Wikipedia's words only: an article that cannot be a tile, or a lookup that fails, files nothing", { skip }, async () => {
  const db = await fresh();
  assert.equal((await suggest(db, 46302, T(5))).result, "no_topic", "no such article");
  assert.equal((await suggest(db, MERCURY, T(5))).result, "no_topic", "a disambiguation page is not one thing");
  assert.equal((await suggest(db, 5001, T(5))).result, "no_topic", "a list is not one thing");
  assert.equal((await suggest(db, 5002, T(5))).result, "no_topic", "outside the article space");
  assert.equal((await suggest(db, 5003, T(5))).result, "no_topic", "an address off Wikipedia");
  assert.equal((await suggest(db, 31337, T(5))).result, "busy", "Wikipedia answered with nothing at all");
  assert.equal((await suggest(db, 5555, T(5))).result, "busy", "Wikipedia refused");
  assert.equal((await suggest(db, 7777, T(5))).result, "busy", "Wikipedia said something that is not its answer");
  assert.equal((await suggest(db, 999999, T(5))).result, "busy", "Wikipedia timed out");
  assert.equal(await value<number>(db, "select count(*)::int from wall_topics"), 0);
  assert.equal(await value<number>(db, "select count(*)::int from wall_stories where subject_kind = 'suggestion'"), 0);

  // A redirect is followed and the article it lands on is what is kept.
  const moved = await suggest(db, OLD_REDIRECT, T(5));
  assert.equal(moved.result, "kept");
  assert.equal(await value<number>(db, "select page_id::int from wall_topics"), 19513);
  assert.equal(await value<string>(db, "select headline from wall_stories where id = $1", [moved.story_id]), "Intuitionism: Approach in philosophy of mathematics and logic");

  // An article with no Wikidata item and a first sentence too short to quote.
  const small = await suggest(db, 5004, T(6));
  assert.equal(small.result, "kept");
  assert.equal(await value<string>(db, "select url_key from wall_stories where id = $1", [small.story_id]), "subject:suggestion:wp5004");
  assert.equal(await value<string>(db, "select quotation from wall_sources where story_id = $1", [small.story_id]), "Wikipedia article: A small village");
});

test("the guard: the same browser token as a buzz, never the app's account, and never Wikipedia directly", { skip }, async () => {
  const db = await fresh();
  assert.equal((await suggest(db, MILTON, "short")).result, "bad_token");
  await db.exec(`set test.uid = '00000000-0000-4000-8000-000000000001'`);
  assert.equal((await suggest(db, MILTON, T(1))).result, "bad_token", "a caller with an account is refused");
  await db.exec("reset test.uid");
  await db.exec("set role anon");
  assert.equal((await suggest(db, MILTON, T(1))).result, "kept", "the website's role suggests");
  assert.ok(await value<number>(db, "select count(*)::int from wall_boosts where suggested") >= 1, "and reads the suggested column");
  assert.ok(await value<number>(db, "select count(*)::int from wall_topics") >= 1, "and the articles");
  assert.match(await refusal(() => db.query("select wall_topic_lookup(1)")), /permission denied/, "never Wikipedia directly");
  assert.match(await refusal(() => db.query("insert into wall_topics (page_id, title, page_url) values (9, 'Typed by hand', 'https://en.wikipedia.org/wiki/X')")), /permission denied/, "never the articles table");
  assert.match(await refusal(() => db.query("select booster_id from wall_boosts limit 1")), /permission denied/, "never the booster");
  await db.exec("reset role");
  await db.exec("set role authenticated");
  assert.match(await refusal(() => db.query("select wall_suggest_topic(1, $1)", [T(3)])), /permission denied/, "the app does not suggest from here");
  await db.exec("reset role");
});

test("the midnight seal: no suggestion before the day opens or once it has sealed, and the day's suggestion is kept", { skip }, async () => {
  const db = await fresh();
  const date = await today(db);
  const kept = (await suggest(db, MILTON, T(1))).story_id!;
  await db.exec(`update wall_days set closed_at = now() - interval '1 second' where wall_date = '${date}'`);
  assert.equal((await suggest(db, NOBEL, T(2))).result, "closed");
  const standing = await value<Word>(db, "select wall_web_standing($1::date, $2)", [date, T(1)]);
  assert.equal(standing.suggested, kept);
  assert.equal((await value<Word>(db, "select wall_forget_boost($1, $2)", [kept, T(1)])).result, "closed", "and nothing about it moves");
  await db.exec(`update wall_days set closed_at = null, live_at = now() + interval '1 hour' where wall_date = '${date}'`);
  assert.equal((await suggest(db, NOBEL, T(2))).result, "not_yet");
});

test("a curator hides a suggestion before the seal, the panel lists it, and nobody else can", { skip }, async () => {
  const db = await fresh();
  const story = (await suggest(db, MILTON, T(1))).story_id!;
  assert.match(await refusal(() => db.query("select * from wall_suggestions_for_curator()")), /only a curator/);
  await db.exec("set test.admin = 'yes'");
  const listed = (await db.query<{ story_id: string; support: number; hidden_at: string | null }>("select * from wall_suggestions_for_curator()")).rows;
  assert.equal(listed.length, 1);
  assert.equal(listed[0]!.story_id, story);
  assert.equal(listed[0]!.support, 1);
  assert.equal((await value<Word>(db, "select wall_hide_song($1, 'not for the board')", [story])).result, "hidden");
  const person = await value<string>(db, "select id from wall_stories where url_key = 'subject:person:Q937'");
  assert.equal((await value<Word>(db, "select wall_hide_song($1, 'x')", [person])).result, "no_song", "only what a reader put there");
  await db.exec("reset test.admin");
  assert.equal((await suggest(db, MILTON, T(2))).result, "hidden", "a hidden suggestion is not made again");
  assert.equal((await buzz(db, story, T(2))).result, "no_story");
  await db.exec("set role anon");
  assert.equal(await value<number>(db, "select count(*)::int from wall_stories where id = $1", [story]), 0, "a reader cannot see it");
  await db.exec("reset role");
});

test("the two older unapplied files keep the change when applied after this one, and fail when applied before it", { skip }, async () => {
  const db = await fresh();
  await db.exec(read(`${MIGRATIONS}/20260911020000_the_anniversary.sql`));
  const a = await suggest(db, MILTON, T(1));
  assert.equal(a.result, "kept");
  assert.equal(a.left, 3);
  assert.equal(a.suggested, a.story_id);
  assert.ok(Array.isArray(a.anniversary));
  await db.exec(read(`${MIGRATIONS}/20260923010000_buzzes_that_refill.sql`));
  const b = await suggest(db, NOBEL, T(2));
  assert.equal(b.result, "exists", "dedupe is untouched by either file");
  const c = await suggest(db, OLD_REDIRECT, T(2));
  assert.equal(c.result, "kept");
  assert.equal(c.suggested, c.story_id);
  assert.ok("next_at" in c);
  const date = await today(db);
  const arrived = await value<number>(db, "select wall_boost_allowance(now(), $1::date)", [date]);
  const words: string[] = [];
  for (const id of await plain(db, date)) words.push((await buzz(db, id, T(2))).result);
  assert.equal(words.filter((w) => w === "kept").length, arrived, "under refills the suggestion is still outside the budget");

  const early = await fresh(false);
  await early.exec(read(`${MIGRATIONS}/20260911020000_the_anniversary.sql`));
  assert.match(await refusal(() => early.query("select wall_web_standing(current_date, $1)", [T(1)])), /suggested/);
});
