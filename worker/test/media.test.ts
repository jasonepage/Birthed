import test from "node:test";
import assert from "node:assert/strict";
import { bigArtwork, normalise, pickMatch, primaryArtist, type StoreResult } from "../src/media.js";

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

test("a different recording is refused however well the name matches", () => {
  for (const trackName of [
    "Dilemma (Live)", "Dilemma (Remix)", "Dilemma (Karaoke Version)",
    "Dilemma (Acoustic)", "Dilemma (Radio Edit)", "Dilemma (2015 Remaster)",
  ]) {
    const only: StoreResult[] = [{ ...dilemma[0], trackName }];
    assert.equal(pickMatch(only, "Dilemma", "Nelly", 2002), null, trackName);
  }
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
