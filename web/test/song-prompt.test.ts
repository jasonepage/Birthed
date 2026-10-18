// The song in your head, docs/the-wall.md section 31.
//
// The prompt came off the date page on October 18, 2026,
// docs/strip-to-the-hive.md. What is left is what the songs people named
// still need: reading them, drawing them as tiles on sealed hives, and the
// sealed picture. The rules
// the database decides, one answer a day, one story per song, an answer
// outside the three buzzes, are tested against the migration itself in
// worker/test/song-migration.test.ts; what is tested here is that the page
// says what the database decided, and never more.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { WallBoost } from "../src/crown.js";
import { renderRecap, sealedRecap } from "../src/recap.js";
import {
  artAt, boardSongs, coverPath, headsBy, recapSongs, songKey, songsFrom, type SongInfo,
} from "../src/song-prompt.js";
import { answerPictures, crownName, KIND_WORD, tileKind, wallMarks, wallSection, type WallDay, type WallStory } from "../src/wall.js";

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

test("on the hive a song is its own kind, named by its title and artist, with its cover", () => {
  const s = story(ESPRESSO, '2024: "Espresso" by Sabrina Carpenter');
  assert.equal(tileKind(s), "answer");
  assert.equal(KIND_WORD.answer, "Stuck in someone's head today");
  assert.equal(crownName(s), '"Espresso" by Sabrina Carpenter');
  assert.deepEqual(answerPictures(day([s, story(NEWS, "news", { subjectKind: null, subjectId: null })], [])), [{ subject: "answer:1738363970", path: "/cover/1738363970.jpg" }]);
});
