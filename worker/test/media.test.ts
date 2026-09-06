import test from "node:test";
import assert from "node:assert/strict";
import { bigArtwork, normalise, pickMatch, primaryArtist, sameArtist, type StoreResult, realNames } from "../src/media.js";

// The two rows a real search returned on September 6. Both are the same
// recording on two different albums: Nellyville is Nelly's, Simply Deep is
// Kelly Rowland's.
const dilemma: StoreResult[] = [
  {
    trackName: "Dilemma (feat. Kelly Rowland)", artistName: "Nelly",
    collectionName: "Nellyville", releaseDate: "2002-06-25T07:00:00Z",
    previewUrl: "https://audio-ssl.itunes.apple.com/a.m4a",
    trackViewUrl: "https://music.apple.com/us/album/dilemma/1440735154?i=1440735612",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg",
  },
  {
    trackName: "Dilemma", artistName: "Nelly",
    collectionName: "Simply Deep", releaseDate: "2002-10-22T07:00:00Z",
    previewUrl: "https://audio-ssl.itunes.apple.com/b.m4a",
    trackViewUrl: "https://music.apple.com/us/album/dilemma/158820840?i=158821282",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/y/100x100bb.jpg",
  },
];

test("a featuring credit is stripped before the titles are compared", () => {
  // The bug this exists for. The first rule required the track name to equal
  // the chart title, so "Dilemma (feat. Kelly Rowland)" failed and the rule
  // took the other row instead. It would have played correct audio by
  // accident while being wrong on purpose.
  assert.equal(normalise("Dilemma (feat. Kelly Rowland)"), "dilemma");
  assert.equal(normalise("Dilemma"), "dilemma");
  const match = pickMatch(dilemma, "Dilemma", "Nelly featuring Kelly Rowland", 2002);
  assert.ok(match);
  assert.equal(match.previewUrl, "https://audio-ssl.itunes.apple.com/a.m4a");
});

test("two correct survivors do not mean refuse, they mean take the original", () => {
  // The second half of the same bug. Refusing whenever more than one survived
  // threw away a case where both answers were right, so the tiebreak is the
  // release date nearest the chart year: Nellyville in June over Simply Deep
  // in October, for a chart week in September 2002.
  const match = pickMatch(dilemma, "Dilemma", "Nelly featuring Kelly Rowland", 2002);
  assert.ok(match?.storeUrl?.includes("1440735154"));
});

test("a different performance is refused however well the name matches", () => {
  for (const trackName of [
    "Dilemma (Live)", "Dilemma (Remix)", "Dilemma (Karaoke Version)",
    "Dilemma (Acoustic)", "Dilemma (Instrumental)", "Dilemma (Demo)",
  ]) {
    const only: StoreResult[] = [{ ...dilemma[0], trackName }];
    assert.equal(pickMatch(only, "Dilemma", "Nelly", 2002), null, trackName);
  }
});

test("the same performance at a different length or loudness is kept", () => {
  // This list used to include "version", "edit", "radio" and "remaster", and
  // the first real run showed what that costs: it threw out "Is It Over Now?
  // (Taylor's Version) [From The Vault]", which is not a variant of the 2023
  // number one, it is the 2023 number one. For a thirty second preview a
  // remaster and a radio edit are the right recording.
  for (const trackName of [
    "Dilemma (Radio Edit)", "Dilemma (2015 Remaster)", "Dilemma (Single Version)",
  ]) {
    const only: StoreResult[] = [{ ...dilemma[0], trackName }];
    assert.ok(pickMatch(only, "Dilemma", "Nelly", 2002), trackName);
  }
});

// ---------------------------------------------------------------------------
// Every case below is a real refusal from the first live run, kept as a test
// so the same rule cannot tighten back over them.

test("a source credit in brackets is not a different recording", () => {
  const only: StoreResult[] = [{
    ...dilemma[0], trackName: 'I Knew It, I Knew You (From "Toy Story 5")',
    artistName: "Taylor Swift", collectionName: "Toy Story 5",
  }];
  assert.ok(pickMatch(only, "I Knew It, I Knew You", "Taylor Swift", 2026));
});

test("an artist's own re-recording of their own number one still counts", () => {
  const only: StoreResult[] = [{
    ...dilemma[0], trackName: "Is It Over Now? (Taylor's Version) [From The Vault]",
    artistName: "Taylor Swift", collectionName: "1989 (Taylor's Version)",
  }];
  assert.ok(pickMatch(only, "Is It Over Now?", "Taylor Swift", 2023));
});

test("Apple's EP and Single suffixes are packaging, not identity", () => {
  for (const [collectionName, want] of [
    ["THE SIN : BLISS - EP", "The Sin: Bliss"],
    ["GOLDEN HOUR : Part.5 - EP", "Golden Hour: Part.5"],
    ["DO IT - EP", "Do It"],
  ] as const) {
    const only: StoreResult[] = [{
      collectionName, artistName: "ENHYPEN",
      collectionViewUrl: "https://music.apple.com/x",
      artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg",
    }];
    assert.ok(pickMatch(only, want, "Enhypen", 2026, false), collectionName);
  }
});

test("a chart credit and a store credit spell the same act differently", () => {
  // Billboard writes the first of each pair, Apple the second.
  const cases: [string, string][] = [
    ["Huntrix: Ejae, Audrey Nuna and Rei Ami", "HUNTR/X, EJAE, AUDREY NUNA, REI AMI & KPop Demon Hunters Cast"],
    ["\u00a5$: Ye and Ty Dolla Sign featuring Rich the Kid and Playboi Carti", "\u00a5$, Kanye West & Ty Dolla $ign"],
    ["Daryl Hall and John Oates", "Hall & Oates"],
    ["Kendrick Lamar and SZA", "Kendrick Lamar & SZA"],
  ];
  for (const [chart, store] of cases) {
    assert.equal(sameArtist(chart, store), true, `${chart} vs ${store}`);
  }
});

test("a covers act still shares nothing with the real one", () => {
  assert.equal(sameArtist("Nelly", "The Hitmakers"), false);
  assert.equal(sameArtist("Bad Bunny", "D'SH!T"), false);
  assert.equal(sameArtist("ASAP Rocky", "Snake City"), false);
  assert.equal(sameArtist("Taylor Swift", "Kendrick Lamar"), false);
});

test("a karaoke album is refused even when the track name is clean", () => {
  const only: StoreResult[] = [{
    ...dilemma[0], trackName: "Dilemma",
    collectionName: "Karaoke Hits of 2002 (In the Style of Nelly)",
  }];
  assert.equal(pickMatch(only, "Dilemma", "Nelly", 2002), null);
});

test("the wrong artist with the right title is refused", () => {
  const only: StoreResult[] = [{ ...dilemma[0], trackName: "Dilemma", artistName: "The Hitmakers" }];
  assert.equal(pickMatch(only, "Dilemma", "Nelly", 2002), null);
});

test("an ampersand act is one artist and is never split", () => {
  // Cutting a credit at "&" would look up Hall, and Simon, and neither exists.
  assert.equal(primaryArtist("Hall & Oates"), "Hall & Oates");
  assert.equal(primaryArtist("Simon & Garfunkel"), "Simon & Garfunkel");
  assert.equal(primaryArtist("Nelly featuring Kelly Rowland"), "Nelly");
  assert.equal(primaryArtist("Elton John feat. Dua Lipa"), "Elton John");
});

test("an ampersand still matches a catalogue that spells it out", () => {
  const only: StoreResult[] = [{
    ...dilemma[0], trackName: "Rich Girl", artistName: "Daryl Hall & John Oates",
    collectionName: "Voices",
  }];
  assert.ok(pickMatch(only, "Rich Girl", "Daryl Hall and John Oates", 1977));
});

test("an album match carries the cover and no preview, because albums have none", () => {
  const albums: StoreResult[] = [{
    collectionName: "Nellyville", artistName: "Nelly", releaseDate: "2002-06-25T07:00:00Z",
    collectionViewUrl: "https://music.apple.com/us/album/nellyville/1440735154",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg",
  }];
  const match = pickMatch(albums, "Nellyville", "Nelly", 2002, false);
  assert.ok(match);
  assert.equal(match.previewUrl, null);
  assert.ok(match.artworkUrl?.includes("600x600"));
});

test("nothing at all is a normal answer and not a crash", () => {
  assert.equal(pickMatch([], "Dilemma", "Nelly", 2002), null);
});

test("the cover is asked for at a size worth looking at", () => {
  assert.equal(
    bigArtwork("https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg"),
    "https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg",
  );
  assert.equal(bigArtwork(undefined), null);
});

// ---------------------------------------------------------------------------
// The first live album run refused about one in five, and reading the
// refusals showed the rule was wrong rather than the catalogue thin. These are
// the real rows from that run.

test("a title that merely contains the word live is not a live recording", () => {
  // The one that mattered most. Every record with live, cover, demo or
  // reprise anywhere in its name was refused, because the filter read the
  // whole name instead of what was inside the brackets.
  for (const name of ["Dying to Live", "Live in No Shoes Nation", "Live Your Life", "Cover Me"]) {
    const match = pickMatch(
      [{ collectionName: name, artistName: "Somebody", releaseDate: "2018-01-01" }],
      name, "Somebody", 2018, false,
    );
    assert.ok(match !== null, `${name} was refused for having a word in its title`);
  }
});

test("a performance announced in brackets is still refused", () => {
  // The guard the change above must not have opened. If any of these ever
  // start matching, somebody's birthday plays a karaoke backing track.
  for (const name of ["Dilemma (Live)", "Dilemma (Karaoke Version)", "Dilemma (Instrumental)", "Dilemma [Live at Wembley]"]) {
    const match = pickMatch(
      [{ trackName: name, artistName: "Nelly", releaseDate: "2002-01-01" }],
      "Dilemma", "Nelly", 2002,
    );
    assert.equal(match, null, `${name} was accepted as the record that charted`);
  }
});

test("an imitation album is still refused however the title reads", () => {
  const match = pickMatch(
    [{ trackName: "Fear Inoculum", collectionName: "Lullaby Versions of Tool",
       artistName: "Twinkle Twinkle Little Rock Star", releaseDate: "2019-08-30" }],
    "Fear Inoculum", "Tool", 2019,
  );
  assert.equal(match, null);
});

test("a name written with symbols for letters is the same name", () => {
  assert.equal(sameArtist("Pink", "P!nk"), true);
  assert.equal(sameArtist("Kesha", "Ke$ha"), true);
  assert.equal(sameArtist("Pink", "Blackpink"), false, "sharing letters is not sharing a name");
});

test("a credit that names nobody is not a test a correct row can fail", () => {
  // Wikipedia files a film record under Soundtrack, sometimes hung off the
  // real names with a slash. Apple credits the composers. Comparing the word
  // soundtrack against a list of people can only refuse a correct row.
  assert.equal(realNames("Soundtrack"), "");
  assert.equal(realNames("Lady Gaga and Bradley Cooper / Soundtrack"), "Lady Gaga and Bradley Cooper");
  assert.equal(realNames("Dreamville / Various Artists"), "Dreamville");
  assert.equal(sameArtist("Soundtrack", "Benj Pasek & Justin Paul"), true);
  // And it does not become a way in for anybody: the title still has to match.
  const wrong = pickMatch(
    [{ collectionName: "Something Else Entirely", artistName: "Anyone", releaseDate: "2018-01-01" }],
    "The Greatest Showman", "Soundtrack", 2018, false,
  );
  assert.equal(wrong, null);
});

test("packaging on the store's title is not part of the name", () => {
  assert.equal(normalise("A Star Is Born Soundtrack"), normalise("A Star Is Born"));
  assert.equal(
    normalise("The Greatest Showman (Original Motion Picture Soundtrack)"),
    normalise("The Greatest Showman"),
  );
  assert.equal(normalise("Love Yourself 結 'Answer'"), normalise("Love Yourself: Answer"));
});
