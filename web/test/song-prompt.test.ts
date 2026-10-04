// The song in your head, docs/the-wall.md section 31.
//
// The pure half, the board above the hive, and the sealed picture. The rules
// the database decides, one answer a day, one story per song, an answer
// outside the three buzzes, are tested against the migration itself in
// worker/test/song-migration.test.ts; what is tested here is that the page
// says what the database decided, and never more.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { WallBoost } from "../src/crown.js";
import { renderRecap, sealedRecap } from "../src/recap.js";
import {
  SONG_QUESTION, SONG_SCRIPT, SONG_SCRIPT_SOURCE, artAt, boardSongs, collapse, coverPath, exampleSongs, headsBy,
  parseChart, parseSearch, recapSongs, songKey, songsFrom, type Found, type SongInfo,
} from "../src/song-prompt.js";
import { answerPictures, crownName, KIND_WORD, songSection, tileKind, wallMarks, wallSection, type WallDay, type WallStory } from "../src/wall.js";
import { createHash } from "node:crypto";

const ESPRESSO = "aaaaaaaa-0000-4000-8000-000000000001";
const SOLAR = "aaaaaaaa-0000-4000-8000-000000000002";
const NEWS = "aaaaaaaa-0000-4000-8000-000000000003";

// Two in the afternoon Eastern on October 3, 2026: the 3rd asks, the 2nd
// still takes buzzes, the 4th is tomorrow.
const NOW = Date.parse("2026-10-03T18:00:00Z");
const TOMORROW_NOON = Date.parse("2026-10-04T16:00:00Z");
const AFTER_SEAL = Date.parse("2026-10-05T04:00:01Z");

function story(id: string, headline: string, overrides: Partial<WallStory> = {}): WallStory {
  return {
    id, wallDate: "2026-10-03", submittedAt: "2026-10-03T12:00:00Z", headline,
    url: `https://music.apple.com/us/album/x/1?i=${id}`, outlet: "Apple Music", status: "pool", tier: "seen_direct",
    support: 0, priority: 0, placedAt: null, rect: null, falseAt: null, falseNote: null,
    subjectKind: "answer", subjectId: "1738363970", sources: [], ...overrides,
  };
}

function answer(id: number, storyId: string, at: string): WallBoost {
  return { id, storyId, units: 1, castAt: at, answer: true };
}

function buzz(id: number, storyId: string, at: string): WallBoost {
  return { id, storyId, units: 1, castAt: at };
}

const SONGS = new Map<string, SongInfo>([
  ["1738363970", { trackId: "1738363970", title: "Espresso", artist: "Sabrina Carpenter", album: "Espresso - Single", released: "2024-04-11", explicit: false, artwork: "https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg" }],
  ["6818209989", { trackId: "6818209989", title: "Solar Eclipse", artist: "Drake & Don Toliver", album: null, released: "2026-09-26", explicit: true, artwork: null }],
]);

/** The date's own number ones, as the history seeder files them. */
const NUMBER_ONES: WallStory[] = [2019, 2005, 1994, 1985, 1972, 1961].map((year, i) => story(`bbbbbbbb-0000-4000-8000-00000000000${i}`, `${year}: "Song ${year}" by Artist ${year} was the number one song`, {
  subjectKind: "song", subjectId: `${year}-10-03`, outlet: "Wikipedia", tier: "claimed",
}));

function day(stories: WallStory[], boosts: WallBoost[], overrides: Partial<WallDay> = {}): WallDay {
  return {
    wallDate: "2026-10-03", year: 2026, month: 10, day: 3,
    opensAt: "2026-10-02T04:00:00Z", liveAt: "2026-10-03T04:00:00Z", closesAt: "2026-10-05T04:00:00Z", closedAt: null,
    stories, boosts, songs: SONGS, answers: true, ...overrides,
  };
}

// ---------------------------------------------------------------------------
// One song however it is spelled
// ---------------------------------------------------------------------------

test("the title folds the way the database folds it, printed by the live project on October 3, 2026", () => {
  // From a read only query of wall_song_key's expression on the live
  // project, so the two copies are held to the same answers, including the
  // characters where POSIX punctuation and Unicode punctuation could differ.
  const live: Record<string, string> = {
    "Espresso": "1:espresso",
    "Bohemian Rhapsody - Remastered 2011": "1:bohemianrhapsody",
    "Please Please Please (feat. Someone) [Live]": "1:pleasepleaseplease",
    "Short n' Sweet": "1:shortnsweet",
    "Short n’ Sweet": "1:shortnsweet",
    "(Intro)": "1:(intro)",
    "강남스타일": "1:강남스타일",
    "Señorita": "1:señorita",
    "Don't Stop Me Now - 2011 Mix": "1:dontstopmenow",
    "WAP (feat. Megan Thee Stallion)": "1:wap",
    "Hello, Goodbye": "1:hellogoodbye",
    "Mr. Brightside": "1:mrbrightside",
    "Love Story (Taylor's Version)": "1:lovestory",
    "Rock & Roll": "1:rockroll",
    "  Spaced   Out  ": "1:spacedout",
    "A-Punk": "1:apunk",
    "Hey Jude - Remastered 2015": "1:heyjude",
    "99 Problems": "1:99problems",
    "Bad Guy": "1:badguy",
    "bad guy": "1:badguy",
    "Chéri": "1:chéri",
    "¿Quién?": "1:quién",
    "*NSYNC Bye Bye Bye": "1:nsyncbyebyebye",
    "Up!": "1:up",
    "U.N.I.T.Y.": "1:unity",
    "“Quoted”": "1:quoted",
    "Ça va \u2014 bien": "1:çavabien",
    "Beyoncé – Halo": "1:beyoncéhalo",
  };
  for (const [title, key] of Object.entries(live)) assert.equal(songKey(1, title), key, title);
});

function found(id: string, title: string, artistId: string, released: string, extra: Partial<Found> = {}): Found {
  return { id, title, artist: "Sabrina Carpenter", artistId, released, year: Number(released.slice(0, 4)), explicit: false, artwork: null, ...extra };
}

test("dedupe by track: the same track twice is one row", () => {
  const rows = collapse([found("1738363970", "Espresso", "390647681", "2024-04-11T12:00:00Z"), found("1738363970", "Espresso", "390647681", "2024-04-11T12:00:00Z")]);
  assert.deepEqual(rows.map((r) => r.id), ["1738363970"]);
});

test("dedupe by song: the single, the album and the clean version are one row, the oldest, in Apple's order", () => {
  const rows = collapse([
    found("1750307020", "Espresso", "390647681", "2024-08-23T12:00:00Z"),
    found("2000000001", "Please Please Please", "390647681", "2024-06-06T12:00:00Z"),
    found("1738363970", "Espresso", "390647681", "2024-04-11T12:00:00Z"),
    found("1750307099", "Espresso (Clean)", "390647681", "2024-08-23T12:00:00Z"),
    found("3000000001", "Espresso", "999", "2019-01-01T12:00:00Z", { artist: "Somebody else" }),
  ]);
  assert.deepEqual(rows.map((r) => r.id), ["1738363970", "2000000001", "3000000001"], "Espresso once, the oldest release, where Apple first ranked it; another artist's Espresso is its own song");
});

test("Apple's search answer reads as songs only, with Apple's own artwork and nothing else", () => {
  const rows = parseSearch({ results: [
    { wrapperType: "track", kind: "song", trackId: 1738363970, trackName: "Espresso", artistName: "Sabrina Carpenter", artistId: 390647681, releaseDate: "2024-04-11T12:00:00Z", trackExplicitness: "notExplicit", artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg" },
    { wrapperType: "track", kind: "music-video", trackId: 2, trackName: "Espresso (Video)", artistName: "Sabrina Carpenter", artistId: 390647681 },
    { wrapperType: "collection", collectionId: 3, collectionName: "Short n' Sweet" },
    { wrapperType: "track", kind: "song", trackId: 4, trackName: "Bad\u0007 Art", artistName: "X", artistId: 5, releaseDate: "", trackExplicitness: "explicit", artworkUrl100: "https://evil.example.com/x.jpg" },
    { wrapperType: "track", kind: "song", trackId: "not a number", trackName: "Nope", artistName: "X", artistId: 5 },
  ] });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { id: "1738363970", title: "Espresso", artist: "Sabrina Carpenter", artistId: "390647681", released: "2024-04-11T12:00:00Z", year: 2024, explicit: false, artwork: "https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg" });
  assert.equal(rows[1]!.title, "Bad Art", "a control character is taken out");
  assert.equal(rows[1]!.artwork, null, "an artwork address off Apple's image host is dropped");
  assert.equal(rows[1]!.explicit, true);
  assert.deepEqual(parseSearch(null), []);
  assert.deepEqual(parseSearch({ results: "no" }), []);
});

test("Apple's chart reads its rows, marks the explicit ones, and stops at five", () => {
  const results = Array.from({ length: 10 }, (_, i) => ({ id: String(6818209989 + i), name: `Song ${i}`, artistName: `Artist ${i}`, artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/y/100x100bb.jpg", ...(i === 0 ? { contentAdvisoryRating: "Explict" } : {}) }));
  const chart = parseChart({ feed: { title: "Top Songs", results } });
  assert.equal(chart.length, 5);
  assert.deepEqual(chart[0], { id: "6818209989", title: "Song 0", artist: "Artist 0", artwork: "https://is1-ssl.mzstatic.com/image/thumb/y/100x100bb.jpg", explicit: true });
  assert.equal(chart[1]!.explicit, false);
  assert.deepEqual(parseChart({ feed: {} }), []);
});

test("a cover is only ever Apple's image host, resized, and served from this site by track number", () => {
  assert.equal(artAt("https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a/b/c/x.rgb.jpg/100x100bb.jpg"), "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a/b/c/x.rgb.jpg/300x300bb.jpg");
  assert.equal(artAt("https://evil.example.com/image/thumb/100x100bb.jpg"), null);
  assert.equal(artAt("http://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg"), null);
  assert.equal(artAt(null), null);
  assert.equal(coverPath("1738363970"), "/cover/1738363970.jpg");
  assert.equal(coverPath("../etc/passwd"), null);
  assert.equal(coverPath("12a"), null);
});

test("the rows the database sends for songs are read, and anything malformed is dropped", () => {
  const songs = songsFrom([
    { track_id: 1738363970, title: "Espresso", artist: "Sabrina Carpenter", album: null, released: "2024-04-11", explicit: false, artwork_url: "https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg" },
    { track_id: "x", title: "Nope", artist: "X" },
    { track_id: 2, title: "", artist: "X" },
  ]);
  assert.deepEqual([...songs.keys()], ["1738363970"]);
  assert.equal(songs.get("1738363970")!.released, "2024-04-11");
});

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

test("heads are the answer rows; a buzz on a song is a buzz, not a head", () => {
  const heads = headsBy([answer(1, ESPRESSO, "2026-10-03T12:00:00Z"), answer(2, ESPRESSO, "2026-10-03T12:05:00Z"), buzz(3, ESPRESSO, "2026-10-03T12:06:00Z"), answer(4, SOLAR, "2026-10-03T12:07:00Z")]);
  assert.deepEqual([...heads.entries()], [[ESPRESSO, 2], [SOLAR, 1]]);
});

test("the board is one row per song, most buzzed first, and a song in nobody's head with no buzz is not on it", () => {
  const stories = [
    story(SOLAR, '2026: "Solar Eclipse" by Drake & Don Toliver', { subjectId: "6818209989", support: 1, submittedAt: "2026-10-03T12:07:00Z" }),
    story(ESPRESSO, '2024: "Espresso" by Sabrina Carpenter', { support: 3 }),
    story(NEWS, "A headline", { subjectKind: null, subjectId: null, support: 9 }),
    story("aaaaaaaa-0000-4000-8000-000000000009", '1999: "Taken Back" by Nobody', { subjectId: "999", support: 0 }),
  ];
  const board = boardSongs(stories, [answer(1, ESPRESSO, "x"), answer(2, ESPRESSO, "y"), answer(3, SOLAR, "z")], SONGS);
  assert.deepEqual(board.map((b) => [b.title, b.artist, b.year, b.heads, b.story.support, b.explicit]), [
    ["Espresso", "Sabrina Carpenter", 2024, 2, 3, false],
    ["Solar Eclipse", "Drake & Don Toliver", 2026, 1, 1, true],
  ]);
});

test("a song whose row could not be read still reads from its headline", () => {
  const board = boardSongs([story(ESPRESSO, '2024: "Espresso" by Sabrina Carpenter', { support: 1, subjectId: "1" })], [answer(1, ESPRESSO, "x")], new Map());
  assert.deepEqual([board[0]!.title, board[0]!.artist, board[0]!.year], ["Espresso", "Sabrina Carpenter", 2024]);
});

test("an empty board asks, and shows examples marked as examples, spread across the date's number ones", () => {
  const html = songSection(day(NUMBER_ONES, []), "October 3", NOW, true, {});
  assert.ok(html.includes(SONG_QUESTION));
  assert.ok(html.includes("<b>Be the first.</b>"));
  const examples = exampleSongs(NUMBER_ONES);
  assert.deepEqual(examples.map((e) => e.year), [2019, 1985, 1961], "the newest, the middle and the oldest");
  assert.equal((html.match(/class="sgtag">Example</g) ?? []).length, 3, "every example says so");
  assert.ok(html.includes('aria-label="Examples, not answers"'));
  const exampleList = html.slice(html.indexOf("sgexamples"), html.indexOf("</ol>", html.indexOf("sgexamples")));
  assert.ok(!exampleList.includes("<form"), "an example has no buzz button");
  assert.ok(!exampleList.includes("/cover/"), "and no cover, because it is not a song anybody picked");
  assert.ok(exampleList.includes("Number one on this date in 1985"));
  assert.ok(html.includes('action="/song/search"'), "the search posts without the script");
  assert.ok(html.includes(`<script>${SONG_SCRIPT}</script>`));
});

test("the first real answer removes the examples", () => {
  const before = songSection(day(NUMBER_ONES, []), "October 3", NOW, true, {});
  assert.ok(before.includes("sgexample"));
  const after = songSection(day([...NUMBER_ONES, story(ESPRESSO, '2024: "Espresso" by Sabrina Carpenter', { support: 1 })], [answer(1, ESPRESSO, "2026-10-03T12:00:00Z")]), "October 3", NOW, true, {});
  assert.ok(!after.includes("sgexample"), "no example row");
  assert.ok(!after.includes(">Example<"), "and no example label anywhere");
  assert.ok(!after.includes("Be the first"));
  assert.ok(after.includes('id="ws-' + ESPRESSO + '"'), "the real answer is on the board");
  assert.ok(after.includes(">Espresso</a>") && after.includes("Sabrina Carpenter &middot; 2024"));
  assert.ok(after.includes("In 1 head &middot; 1 buzz"));
  assert.ok(after.includes('<img src="/cover/1738363970.jpg"'), "its cover comes from this site");
  assert.ok(after.includes('action="/boost"') && after.includes('name="v" value="song"'), "and it takes buzzes, coming back to the board");
});

test("an answer is never typed text: a title is escaped wherever it is drawn", () => {
  const evil = new Map<string, SongInfo>([["1", { trackId: "1", title: "</li><script>alert(1)</script>", artist: "\"><img src=x>", album: null, released: null, explicit: false, artwork: null }]]);
  const html = songSection(day([story(ESPRESSO, "x", { subjectId: "1", support: 1 })], [answer(1, ESPRESSO, "t")], { songs: evil }), "October 3", NOW, true, {});
  assert.ok(!html.includes("<script>alert"));
  assert.ok(!html.includes('"><img src=x>'));
  assert.ok(html.includes("&lt;/li&gt;&lt;script&gt;"));
});

test("a search without the script comes back as the forms the script would draw", () => {
  const html = songSection(day([], []), "October 3", NOW, true, { found: [found("1738363970", "Espresso", "390647681", "2024-04-11T12:00:00Z", { explicit: true })] });
  assert.ok(html.includes('<form class="sgpick" method="post" action="/song"><input type="hidden" name="t" value="1738363970"><input type="hidden" name="m" value="10"><input type="hidden" name="d" value="3">'));
  assert.ok(html.includes('<span class="sge" title="Explicit">E</span>'));
  assert.ok(songSection(day([], []), "October 3", NOW, true, { found: "none" }).includes("Nothing found."));
  assert.ok(songSection(day([], []), "October 3", NOW, true, { found: "busy" }).includes("busy for a moment"));
  assert.ok(songSection(day([], []), "October 3", NOW, true, { found: "expired" }).includes("Search again"));
});

test("the word after a pick is said, and the Undo is drawn only for the answer the server named", () => {
  const d = day([story(ESPRESSO, '2024: "Espresso" by Sabrina Carpenter', { support: 1 })], [answer(1, ESPRESSO, "t")]);
  const kept = songSection(d, "October 3", NOW, true, { said: "kept", undo: ESPRESSO });
  assert.ok(kept.includes("Your song is on today&#39;s board."));
  assert.ok(kept.includes('<form class="wundo" method="post" action="/song/undo"><input type="hidden" name="s" value="' + ESPRESSO + '">'));
  assert.ok(!songSection(d, "October 3", NOW, true, { said: "kept", undo: null }).includes("/song/undo"), "no Undo the server did not name");
  assert.ok(!songSection(d, "October 3", NOW, true, { said: "answered", undo: ESPRESSO }).includes("/song/undo"), "no Undo after any other word");
  assert.ok(songSection(d, "October 3", NOW, true, { said: "answered" }).includes("You already answered today. One song a day."));
  assert.ok(songSection(d, "October 3", NOW, true, { said: "already" }).includes("cannot be your answer too"));
});

test("one answer a day: a browser that has answered sees its song marked and the search put away", () => {
  const marks = wallMarks({ left: 3, allowance: 3, backed: [ESPRESSO], answered: ESPRESSO }, day([], []), NOW);
  assert.ok(marks.includes(".sgask,.sgresults,.sghint{display:none}.sgdone{display:block}"));
  assert.ok(marks.includes(`#ws-${ESPRESSO} .sgmine{display:inline}`));
  assert.ok(!wallMarks({ left: 3, allowance: 3, backed: [], answered: null }, day([], []), NOW).includes("sgask"), "a browser that has not answered keeps the search");
  assert.ok(!wallMarks({ left: 3, allowance: 3, backed: [], answered: "not-a-uuid\"}{" }, day([], []), NOW).includes("sgask"), "only an identifier shaped like ours reaches a style rule");
  const section = songSection(day([story(ESPRESSO, '2024: "Espresso" by Sabrina Carpenter', { support: 1 })], [answer(1, ESPRESSO, "t")]), "October 3", NOW, true, {});
  assert.ok(section.includes('<p class="sgdone">You answered today.'), "the line the marks reveal is on the shared page, hidden");
});

test("yesterday's page shows yesterday's songs with their buzz buttons, asks nothing, and points at today's question by the Eastern clock", () => {
  const d = day([story(ESPRESSO, '2024: "Espresso" by Sabrina Carpenter', { support: 2 })], [answer(1, ESPRESSO, "t"), buzz(2, ESPRESSO, "u")]);
  const html = songSection(d, "October 3", TOMORROW_NOON, true, {});
  assert.ok(html.includes("Stuck in heads on October 3, 2026"));
  assert.ok(html.includes("Answers for October 3 closed at midnight Eastern."));
  assert.ok(html.includes('<a href="/october-4/">Today\'s question</a>'));
  assert.ok(!html.includes("<script"), "no script");
  assert.ok(!html.includes('action="/song/search"'), "no search");
  assert.ok(html.includes('action="/boost"'), "the songs still take buzzes until the seal");
  assert.ok(html.includes("In 1 head &middot; 2 buzzes"));
  assert.equal(songSection(day([], []), "October 3", TOMORROW_NOON, true, {}), "", "a yesterday nobody answered shows nothing");
});

test("the midnight seal: the board stays as it sealed, with no buttons, and a sealed day nobody answered shows nothing", () => {
  const d = day([story(ESPRESSO, '2024: "Espresso" by Sabrina Carpenter', { support: 2 })], [answer(1, ESPRESSO, "t"), answer(2, ESPRESSO, "u")]);
  const sealed = songSection(d, "October 3", AFTER_SEAL, true, {});
  assert.ok(sealed.includes("Sealed with the hive. Permanent."));
  assert.ok(sealed.includes(">Espresso</a>") && sealed.includes("In 2 heads"));
  assert.ok(!sealed.includes("<form"), "nothing on a sealed board takes anything");
  assert.ok(!sealed.includes("<script"));
  assert.equal(songSection(day(NUMBER_ONES, []), "October 3", AFTER_SEAL, true, {}), "", "no examples and no question on a sealed date");
  // The baked page, which is what a sealed date serves, draws the same board.
  const baked = wallSection(d, "October 3", AFTER_SEAL, {});
  assert.ok(baked.includes('id="ws-' + ESPRESSO + '"'));
  assert.ok(!baked.includes("<form class=\"wbuzz\""));
});

test("the midnight seal: the sealed picture names the day's songs by heads, and only once the day has sealed", () => {
  const stories = [
    story(ESPRESSO, '2024: "Espresso" by Sabrina Carpenter', { support: 3, status: "placed", rect: { mx: 0, my: 0, w: 4, h: 4 } }),
    story(SOLAR, '2026: "Solar Eclipse" by Drake & Don Toliver', { subjectId: "6818209989", support: 4, status: "placed", rect: { mx: 4, my: 0, w: 4, h: 4 } }),
  ];
  const boosts = [answer(1, ESPRESSO, "2026-10-03T12:00:00Z"), answer(2, ESPRESSO, "2026-10-03T12:01:00Z"), buzz(3, ESPRESSO, "2026-10-03T12:02:00Z"),
    answer(4, SOLAR, "2026-10-03T12:03:00Z"), buzz(5, SOLAR, "2026-10-03T12:04:00Z"), buzz(6, SOLAR, "2026-10-03T12:05:00Z"), buzz(7, SOLAR, "2026-10-03T12:06:00Z")];
  const d = day(stories, boosts);
  const songs = recapSongs(d.stories, d.boosts, SONGS);
  assert.deepEqual(songs, [
    { title: "Espresso", artist: "Sabrina Carpenter", count: 2 },
    { title: "Solar Eclipse", artist: "Drake & Don Toliver", count: 1 },
  ], "ranked by heads, not by buzzes");
  assert.equal(sealedRecap(d, NOW, songs), null, "before midnight the picture is refused");
  const recap = sealedRecap(d, AFTER_SEAL, songs);
  assert.ok(recap !== null);
  assert.deepEqual(recap.songs, songs);
  assert.equal(recap.totalBuzzes, 7, "an answer is a buzz in the total");
  assert.equal(recap.crown?.name, '"Solar Eclipse" by Drake & Don Toliver', "a song can wear the crown, named the way a number one is");
  const picture = renderRecap(recap);
  assert.ok(picture.includes("Stuck in everyone&#39;s head") || picture.includes("Stuck in everyone's head"));
  assert.ok(picture.includes("Espresso"));
});

test("nothing is drawn before the song migration, because the read cannot tell an answer from a buzz", () => {
  assert.equal(songSection(day(NUMBER_ONES, [], { answers: false }), "October 3", NOW, true, {}), "");
  assert.equal(songSection(day(NUMBER_ONES, [], { answers: undefined }), "October 3", NOW, true, {}), "");
});

test("a baked page never carries the question, the search or the script", () => {
  const html = songSection(day(NUMBER_ONES, []), "October 3", NOW, false, {});
  assert.equal(html, "", "nothing to show and nothing to ask on a page that cannot ask");
});

test("on the hive a song is its own kind, named by its title and artist, with its cover", () => {
  const s = story(ESPRESSO, '2024: "Espresso" by Sabrina Carpenter');
  assert.equal(tileKind(s), "answer");
  assert.equal(KIND_WORD.answer, "Stuck in someone's head today");
  assert.equal(crownName(s), '"Espresso" by Sabrina Carpenter');
  assert.deepEqual(answerPictures(day([s, story(NEWS, "news", { subjectKind: null, subjectId: null })], [])), [{ subject: "answer:1738363970", path: "/cover/1738363970.jpg" }]);
});

test("songs are the board above the hive, not rows in the feed under it", () => {
  const html = wallSection(day([story(ESPRESSO, '2024: "Espresso" by Sabrina Carpenter', { support: 1 }), story(NEWS, "A headline from the news", { subjectKind: null, subjectId: null })], [answer(1, ESPRESSO, "t")]), "October 3", NOW, { interactive: true });
  const feed = html.slice(html.indexOf('id="feedhead"'));
  assert.ok(feed.includes("A headline from the news"));
  assert.ok(!feed.includes("Espresso"), "the song is not in the feed");
  assert.ok(html.indexOf('id="song"') < html.indexOf('class="wall"'), "and the board leads the page, above the hive");
});

test("the search script is the one the header names, draws with DOM calls only, and posts to this origin alone", () => {
  assert.equal(SONG_SCRIPT_SOURCE, `'sha256-${createHash("sha256").update(SONG_SCRIPT).digest("base64")}'`);
  assert.ok(!SONG_SCRIPT.includes("innerHTML"), "nothing Apple sent is ever markup");
  assert.ok(SONG_SCRIPT.includes('fetch("/song/search"'));
  assert.ok(!/fetch\("https?:/.test(SONG_SCRIPT), "and nothing else is fetched");
  assert.ok(!SONG_SCRIPT.includes("?q="), "the phrase goes in the body, never in an address");
});
