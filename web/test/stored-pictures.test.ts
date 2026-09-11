import { strict as assert } from "node:assert";
import { test } from "node:test";

import { creditLine, eventPicturesFrom, pictureKeyOf, previewCreditLine, publicUrl, storyPicturesFrom } from "../src/stored-pictures.js";
import { pictureRules, storyBody, wallSection, type WallDay, type WallStory } from "../src/wall.js";

const PROJECT = "https://lunqqhjwqrpbujwxwdzk.supabase.co";

test("event rows become pictures keyed the way the worker keys a story, served from the project's public bucket", () => {
  const pictures = eventPicturesFrom([
    { event_id: 13857, path: "event/13857.jpg", file: "WTC_smoking_on_9-11.jpeg", artist: "Michael Foran", license: "CC BY 2.0", license_url: "https://creativecommons.org/licenses/by/2.0", commons_url: "https://commons.wikimedia.org/wiki/File:WTC_smoking_on_9-11.jpeg" },
    { event_id: 5, path: null, file: "Nothing.jpg", artist: null, license: null, license_url: null, commons_url: null },
  ], `${PROJECT}/`);
  assert.equal(pictures.size, 1, "a row with no path is no picture");
  const picture = pictures.get("historical_event:13857")!;
  assert.equal(picture.path, `${PROJECT}/storage/v1/object/public/pictures/event/13857.jpg`);
  assert.equal(picture.credit, "Picture: WTC smoking on 9-11.jpeg, by Michael Foran, CC BY 2.0, from Wikimedia Commons.");
  assert.equal(publicUrl(PROJECT, "event/1.png"), `${PROJECT}/storage/v1/object/public/pictures/event/1.png`);
  assert.equal(creditLine("Old.jpg", null, "Public domain"), "Picture: Old.jpg, Public domain, from Wikimedia Commons.");
});

test("news rows are keyed by the story itself and credited to the publisher", () => {
  const pictures = storyPicturesFrom([
    { story_id: "a618e2a9-bb20-4a39-bd47-ee78518f2e83", path: "story/a618e2a9-bb20-4a39-bd47-ee78518f2e83.jpg", outlet: "the Guardian" },
    { story_id: "none", path: null, outlet: "BBC" },
  ], PROJECT);
  assert.equal(pictures.size, 1);
  const picture = pictures.get("story:a618e2a9-bb20-4a39-bd47-ee78518f2e83")!;
  assert.equal(picture.path, `${PROJECT}/storage/v1/object/public/pictures/story/a618e2a9-bb20-4a39-bd47-ee78518f2e83.jpg`);
  assert.equal(picture.credit, previewCreditLine("the Guardian"));
  assert.equal(picture.commonsUrl, null);
});

test("the style rule survives the safe filter with the project's address and a story identifier whole", () => {
  const [event] = eventPicturesFrom([{ event_id: 7, path: "event/7.jpg", file: "A.jpg", artist: null, license: null, license_url: null, commons_url: null }], PROJECT).values();
  const [news] = storyPicturesFrom([{ story_id: "a618e2a9-bb20-4a39-bd47-ee78518f2e83", path: "story/a618e2a9-bb20-4a39-bd47-ee78518f2e83.webp", outlet: "BBC" }], PROJECT).values();
  const css = pictureRules([event!, news!]);
  assert.ok(css.includes(`[data-subject="historical_event:7"]{--pic:url("${PROJECT}/storage/v1/object/public/pictures/event/7.jpg")}`), css);
  assert.ok(css.includes(`[data-subject="story:a618e2a9-bb20-4a39-bd47-ee78518f2e83"]{--pic:url("${PROJECT}/storage/v1/object/public/pictures/story/a618e2a9-bb20-4a39-bd47-ee78518f2e83.webp")}`), css);
});

const day: WallDay = {
  id: "d1", wallDate: "2026-09-11", year: 2026, month: 9, day: 11,
  opensAt: "2026-09-11T04:00:00.000Z", closesAt: "2026-09-12T04:00:00.000Z", sealedAt: null,
  wallVersion: 1, stories: [],
} as unknown as WallDay;

const event: WallStory = {
  id: "s1", wallDate: "2026-09-11", headline: "The September 11 attacks", url: "https://en.wikipedia.org/wiki/September_11_attacks",
  kind: "event", tier: "encyclopedia", support: 0, status: "placed", rect: { mx: 0, my: 0, w: 8, h: 6 },
  submittedAt: "2026-09-11T04:00:00.000Z", placedAt: "2026-09-11T04:01:00.000Z", falseAt: null, falseNote: null,
  subjectKind: "historical_event", subjectId: "13857", outlet: "Wikipedia", sources: [],
} as unknown as WallStory;

const news: WallStory = { ...event, id: "a618e2a9-bb20-4a39-bd47-ee78518f2e83", subjectKind: null, subjectId: null, url: "https://www.theguardian.com/x", headline: "Grief, fury, conspiracy" } as WallStory;

test("a news tile carries its own identifier as the subject, so a picture rule can find it", () => {
  assert.equal(pictureKeyOf(event), "historical_event:13857");
  assert.equal(pictureKeyOf(news), "story:a618e2a9-bb20-4a39-bd47-ee78518f2e83");
  const html = wallSection({ ...day, stories: [event, news] } as WallDay, "September 11", Date.parse("2026-09-11T05:00:00Z"), { date: { month: 9, day: 11 } });
  assert.ok(html.includes(`data-subject="historical_event:13857"`));
  assert.ok(html.includes(`data-subject="story:a618e2a9-bb20-4a39-bd47-ee78518f2e83"`), html.slice(0, 400));
});

test("the receipt prints the credit when it is given one, with the Commons page linked, and nothing when it is not", () => {
  const without = storyBody(event, day, Date.parse("2026-09-11T05:00:00Z"));
  assert.ok(!without.includes("wcredit"));
  const credit = { credit: "Picture: WTC smoking on 9-11.jpeg, by Michael Foran, CC BY 2.0, from Wikimedia Commons.", commonsUrl: "https://commons.wikimedia.org/wiki/File:WTC_smoking_on_9-11.jpeg", licenseUrl: "https://creativecommons.org/licenses/by/2.0" };
  const withIt = storyBody(event, day, Date.parse("2026-09-11T05:00:00Z"), { credit });
  assert.ok(withIt.includes(`<p class="wfacts wcredit">Picture: WTC smoking on 9-11.jpeg, by Michael Foran, CC BY 2.0, from Wikimedia Commons.`), withIt);
  assert.ok(withIt.includes(`href="https://commons.wikimedia.org/wiki/File:WTC_smoking_on_9-11.jpeg"`));
  assert.ok(withIt.includes(`href="https://creativecommons.org/licenses/by/2.0"`));
  assert.ok(withIt.indexOf("wcredit") < withIt.indexOf('<h2 class="section">Sources</h2>'), "the credit sits above the sources");
  const publisher = storyBody(news, day, Date.parse("2026-09-11T05:00:00Z"), { credit: { credit: previewCreditLine("the Guardian"), commonsUrl: null, licenseUrl: null } });
  assert.ok(publisher.includes(`<p class="wfacts wcredit">Picture: the article&#39;s own preview picture, from the Guardian. It belongs to the publisher.</p>`) || publisher.includes(`<p class="wfacts wcredit">Picture: the article's own preview picture, from the Guardian. It belongs to the publisher.</p>`), publisher);
});

test("a picture table that does not exist is no pictures, not a dead build", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const u = String(input);
    if (u.includes("story_pictures")) return new Response('{"code":"42P01"}', { status: 404 });
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const { fetchStoredPictures } = await import("../src/stored-pictures.js");
    const pictures = await fetchStoredPictures("https://nowhere.invalid", "k");
    assert.equal(pictures.size, 0, "a 404 on a picture table leaves the build alive with no pictures");
  } finally {
    globalThis.fetch = realFetch;
  }
});
