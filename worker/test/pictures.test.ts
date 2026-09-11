import { strict as assert } from "node:assert";
import { test } from "node:test";

import { creditLine, eventsToPicture, fetchUrl, plainWords, publicUrl, readCredits, readPageImages, storagePath, titleOf } from "../src/pictures.js";

test("the twelve best scored events on a date that have no picture yet, most points first", () => {
  const events = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, subject_url: i === 3 ? null : `https://en.wikipedia.org/wiki/E${i + 1}` }));
  const scores = new Map(events.map((e) => [`historical_event:${e.id}`, e.id % 7]));
  const chosen = eventsToPicture(events, scores, new Set(["6"]));
  assert.equal(chosen.length, 12);
  assert.ok(!chosen.some((e) => e.id === 4), "no subject, no picture");
  assert.ok(!chosen.some((e) => e.id === 6), "already pictured");
  assert.equal(chosen[0]!.id, 13, "the highest score first, ties by id");
});

test("a subject address becomes the title the API wants", () => {
  assert.equal(titleOf("https://en.wikipedia.org/wiki/September_11_attacks"), "September 11 attacks");
  assert.equal(titleOf("https://en.wikipedia.org/wiki/1973_Chilean_coup_d'%C3%A9tat"), "1973 Chilean coup d'état");
});

test("page images: free lead pictures by the title asked, through normalisation and redirects, and nothing for an article without one", () => {
  const answer = {
    query: {
      normalized: [{ from: "september 11 attacks", to: "September 11 attacks" }],
      redirects: [{ from: "Chilean coup", to: "1973 Chilean coup d'état" }],
      pages: [
        { title: "September 11 attacks", pageimage: "WTC_smoking_on_9-11.jpeg" },
        { title: "1973 Chilean coup d'état", pageimage: "Golpe_de_Estado_1973.jpg" },
        { title: "Hope Diamond" },
      ],
    },
  };
  const files = readPageImages(["september 11 attacks", "Chilean coup", "Hope Diamond"], answer);
  assert.equal(files.get("september 11 attacks"), "WTC_smoking_on_9-11.jpeg");
  assert.equal(files.get("Chilean coup"), "Golpe_de_Estado_1973.jpg");
  assert.equal(files.has("Hope Diamond"), false, "a fair use lead picture is no picture");
});

test("credits: artist and licence in plain words, markup stripped, missing fields null", () => {
  const answer = {
    query: {
      normalized: [{ from: "File:WTC_smoking_on_9-11.jpeg", to: "File:WTC smoking on 9-11.jpeg" }],
      pages: [
        { title: "File:WTC smoking on 9-11.jpeg", imageinfo: [{ extmetadata: { Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Example">Michael Foran</a>' }, LicenseShortName: { value: "CC BY 2.0" }, LicenseUrl: { value: "https://creativecommons.org/licenses/by/2.0" } } }] },
        { title: "File:Old.jpg", imageinfo: [{ extmetadata: { LicenseShortName: { value: "Public domain" } } }] },
      ],
    },
  };
  const credit = readCredits(["WTC_smoking_on_9-11.jpeg", "Old.jpg"], answer);
  assert.deepEqual(credit.get("WTC_smoking_on_9-11.jpeg"), { artist: "Michael Foran", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0" });
  assert.deepEqual(credit.get("Old.jpg"), { artist: null, license: "Public domain", licenseUrl: null });
  assert.equal(plainWords("  <b>A &amp; B</b> "), "A & B");
  assert.equal(plainWords(undefined), null);
});

test("addresses: fetched at tile width, stored by event and content type, served from the public bucket", () => {
  assert.equal(fetchUrl("WTC smoking on 9-11.jpeg"), "https://commons.wikimedia.org/wiki/Special:FilePath/WTC_smoking_on_9-11.jpeg?width=640");
  assert.equal(storagePath(13857, "image/jpeg"), "event/13857.jpg");
  assert.equal(storagePath(13857, "image/png"), "event/13857.png");
  assert.equal(publicUrl("https://lunqqhjwqrpbujwxwdzk.supabase.co/", "event/13857.jpg"), "https://lunqqhjwqrpbujwxwdzk.supabase.co/storage/v1/object/public/pictures/event/13857.jpg");
});

test("the credit line is plain words with no markup, and says less when Commons says less", () => {
  assert.equal(creditLine("WTC_smoking_on_9-11.jpeg", { artist: "Michael Foran", license: "CC BY 2.0", licenseUrl: null }), "Picture: WTC smoking on 9-11.jpeg, by Michael Foran, CC BY 2.0, from Wikimedia Commons.");
  assert.equal(creditLine("Old.jpg", null), "Picture: Old.jpg, from Wikimedia Commons.");
});
