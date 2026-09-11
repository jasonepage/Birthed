import { strict as assert } from "node:assert";
import { test } from "node:test";

import { pictureStory, previewPictureOf, storagePath, storiesToPicture, type StoryRow } from "../src/wall/story-pictures.js";
import type { Db } from "../src/wall/db.js";

const PAGE = "https://www.bbc.com/news/articles/c123";

test("the preview picture is og:image, resolved against the page, https only", () => {
  assert.equal(previewPictureOf(`<html><head><meta property="og:image" content="https://ichef.bbci.co.uk/news/1024/a.jpg"/></head></html>`, PAGE), "https://ichef.bbci.co.uk/news/1024/a.jpg");
  assert.equal(previewPictureOf(`<meta content="/img/lead.png" property="og:image">`, PAGE), "https://www.bbc.com/img/lead.png", "a relative address is resolved against the page");
  assert.equal(previewPictureOf(`<meta name="twitter:image" content="https://cdn.example.org/t.jpg">`, PAGE), "https://cdn.example.org/t.jpg", "twitter:image is the fallback");
  assert.equal(previewPictureOf(`<meta property="og:image" content="http://insecure.example.org/a.jpg">`, PAGE), null, "an http picture is refused");
  assert.equal(previewPictureOf(`<html><head><title>No card</title></head></html>`, PAGE), null);
  assert.equal(previewPictureOf(null, PAGE), null);
});

test("the copy is filed by story and by what the server sent", () => {
  assert.equal(storagePath("a618e2a9-bb20-4a39-bd47-ee78518f2e83", "image/jpeg"), "story/a618e2a9-bb20-4a39-bd47-ee78518f2e83.jpg");
  assert.equal(storagePath("x", "image/webp"), "story/x.webp");
});

test("only stories with no subject and no row yet are read", () => {
  const stories: StoryRow[] = [
    { id: "n1", wall_date: "2026-09-11", url: "https://a.example/1", outlet: "A", subject_kind: null },
    { id: "n2", wall_date: "2026-09-11", url: "https://a.example/2", outlet: "A", subject_kind: null },
    { id: "e1", wall_date: "2026-09-11", url: "https://en.wikipedia.org/wiki/X", outlet: "Wikipedia", subject_kind: "historical_event" },
  ];
  assert.deepEqual(storiesToPicture(stories, new Set(["n2"])).map((s) => s.id), ["n1"]);
});

test("a dry run reads the page and writes nothing; a page with no picture is said so", async () => {
  const db: Db = { url: "https://nowhere.invalid", key: "k" };
  const lines: string[] = [];
  const story: StoryRow = { id: "n1", wall_date: "2026-09-11", url: PAGE, outlet: "BBC", subject_kind: null };
  const withPicture = async () => ({ status: 200, body: `<meta property="og:image" content="https://ichef.bbci.co.uk/a.jpg">`, finalUrl: PAGE, detail: "ok" });
  assert.equal(await pictureStory(db, story, "test", true, (l) => lines.push(l), withPicture), "stored");
  assert.ok(lines[0]!.includes("https://ichef.bbci.co.uk/a.jpg"));
  const without = async () => ({ status: 200, body: `<html></html>`, finalUrl: PAGE, detail: "ok" });
  assert.equal(await pictureStory(db, story, "test", true, (l) => lines.push(l), without), "none");
  assert.ok(lines[1]!.includes("no preview picture"));
});
