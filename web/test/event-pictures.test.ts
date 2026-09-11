import { strict as assert } from "node:assert";
import { test } from "node:test";

import { creditLine, eventPicturesFrom, publicUrl } from "../src/event-pictures.js";
import { pictureRules, storyBody, type WallDay, type WallStory } from "../src/wall.js";

const PROJECT = "https://lunqqhjwqrpbujwxwdzk.supabase.co";

test("rows become pictures keyed the way the worker keys a story, served from the project's public bucket", () => {
  const pictures = eventPicturesFrom([
    { event_id: 13857, path: "event/13857.jpg", file: "WTC_smoking_on_9-11.jpeg", artist: "Michael Foran", license: "CC BY 2.0", license_url: "https://creativecommons.org/licenses/by/2.0", commons_url: "https://commons.wikimedia.org/wiki/File:WTC_smoking_on_9-11.jpeg" },
    { event_id: 5, path: "", file: "Nothing.jpg", artist: null, license: null, license_url: null, commons_url: null },
  ], `${PROJECT}/`);
  assert.equal(pictures.size, 1, "a row with no path is no picture");
  const picture = pictures.get("historical_event:13857")!;
  assert.equal(picture.path, `${PROJECT}/storage/v1/object/public/pictures/event/13857.jpg`);
  assert.equal(picture.credit, "Picture: WTC smoking on 9-11.jpeg, by Michael Foran, CC BY 2.0, from Wikimedia Commons.");
  assert.equal(publicUrl(PROJECT, "event/1.png"), `${PROJECT}/storage/v1/object/public/pictures/event/1.png`);
  assert.equal(creditLine("Old.jpg", null, "Public domain"), "Picture: Old.jpg, Public domain, from Wikimedia Commons.");
});

test("the style rule survives the safe filter with the project's address whole", () => {
  const [picture] = eventPicturesFrom([{ event_id: 7, path: "event/7.jpg", file: "A.jpg", artist: null, license: null, license_url: null, commons_url: null }], PROJECT).values();
  const css = pictureRules([picture!]);
  assert.ok(css.includes(`[data-subject="historical_event:7"]{--pic:url("${PROJECT}/storage/v1/object/public/pictures/event/7.jpg")}`), css);
});

const day: WallDay = {
  id: "d1", wallDate: "2026-09-11", year: 2026, month: 9, day: 11,
  opensAt: "2026-09-11T04:00:00.000Z", closesAt: "2026-09-12T04:00:00.000Z", sealedAt: null,
  wallVersion: 1, stories: [],
} as unknown as WallDay;

const story: WallStory = {
  id: "s1", wallDate: "2026-09-11", headline: "The September 11 attacks", url: "https://en.wikipedia.org/wiki/September_11_attacks",
  kind: "event", tier: "encyclopedia", support: 0, status: "placed", rect: { mx: 0, my: 0, w: 8, h: 6 },
  submittedAt: "2026-09-11T04:00:00.000Z", placedAt: "2026-09-11T04:01:00.000Z", falseAt: null, falseNote: null,
  subjectKind: "historical_event", subjectId: "13857", sources: [],
} as unknown as WallStory;

test("the receipt prints the credit when it is given one, with the Commons page linked, and nothing when it is not", () => {
  const without = storyBody(story, day, Date.parse("2026-09-11T05:00:00Z"));
  assert.ok(!without.includes("wcredit"));
  const credit = { subject: "historical_event:13857", path: "x", credit: "Picture: WTC smoking on 9-11.jpeg, by Michael Foran, CC BY 2.0, from Wikimedia Commons.", commonsUrl: "https://commons.wikimedia.org/wiki/File:WTC_smoking_on_9-11.jpeg", licenseUrl: "https://creativecommons.org/licenses/by/2.0" };
  const withIt = storyBody(story, day, Date.parse("2026-09-11T05:00:00Z"), { credit });
  assert.ok(withIt.includes(`<p class="wfacts wcredit">Picture: WTC smoking on 9-11.jpeg, by Michael Foran, CC BY 2.0, from Wikimedia Commons.`), withIt);
  assert.ok(withIt.includes(`href="https://commons.wikimedia.org/wiki/File:WTC_smoking_on_9-11.jpeg"`));
  assert.ok(withIt.includes(`href="https://creativecommons.org/licenses/by/2.0"`));
  assert.ok(withIt.indexOf("wcredit") < withIt.indexOf('<h2 class="section">Sources</h2>'), "the credit sits above the sources");
});
