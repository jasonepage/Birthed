import { strict as assert } from "node:assert";
import { test } from "node:test";

import { normalizeUrl, outletOf } from "../src/wall/url.js";

/**
 * Real world pairs: the address as it arrives from a share button, a
 * newsletter or a pasted tab, and the key it must become. Two addresses in
 * the same pair must produce the same key, and a parameter that changes the
 * page must survive.
 */
const PAIRS: Array<[string, string, string]> = [
  [
    "https://www.nytimes.com/2026/09/09/us/politics/example-story.html?smid=nytcore-ios-share&utm_source=twitter&utm_medium=social",
    "https://www.nytimes.com/2026/09/09/us/politics/example-story.html?utm_campaign=x&smid=nytcore-ios-share",
    "https://nytimes.com/2026/09/09/us/politics/example-story.html?smid=nytcore-ios-share",
  ],
  [
    "http://www.bbc.com/news/world-us-canada-12345678?fbclid=IwAR0abc123",
    "https://bbc.com/news/world-us-canada-12345678/",
    "https://bbc.com/news/world-us-canada-12345678",
  ],
  [
    "https://www.reuters.com/world/us/example-headline-2026-09-09/?utm_source=Sailthru&utm_medium=newsletter&utm_campaign=daily-briefing",
    "https://www.reuters.com/world/us/example-headline-2026-09-09/",
    "https://reuters.com/world/us/example-headline-2026-09-09",
  ],
  [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=AbCdEf123&feature=share",
    "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
    "https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
  ],
  [
    "https://x.com/NASA/status/1834567890123456789?s=46&t=abc",
    "https://www.x.com/NASA/status/1834567890123456789?t=abc",
    // x.com and twitter.com stay different keys on purpose: folding one host
    // into another is a rule this file does not have. The pair is about s.
    "https://x.com/NASA/status/1834567890123456789?t=abc",
  ],
  [
    "https://www.theguardian.com/us-news/2026/sep/09/example-story#comments",
    "https://www.theguardian.com/us-news/2026/sep/09/example-story?utm_term=abc",
    "https://theguardian.com/us-news/2026/sep/09/example-story",
  ],
  [
    "https://apnews.com/article/example-story-a1b2c3d4e5f6?utm_source=apnews&utm_medium=share",
    "https://APNEWS.com/article/example-story-a1b2c3d4e5f6",
    "https://apnews.com/article/example-story-a1b2c3d4e5f6",
  ],
  [
    "https://www.reddit.com/r/technology/comments/1abcde/example_title/?share_id=xyz&utm_name=iossmf&ref=share&ref_source=link",
    "https://www.reddit.com/r/technology/comments/1abcde/example_title/?ref_source=link&share_id=xyz",
    "https://reddit.com/r/technology/comments/1abcde/example_title?ref_source=link&share_id=xyz",
  ],
  [
    "https://www.washingtonpost.com/technology/2026/09/09/example-story/?itid=hp_top&mc_cid=abc&mc_eid=def",
    "https://www.washingtonpost.com/technology/2026/09/09/example-story/?itid=hp_top",
    "https://washingtonpost.com/technology/2026/09/09/example-story?itid=hp_top",
  ],
  [
    "https://item.taobao.com/item.htm?id=123456&spm=a1z10.1-c.w4004-1.2.abc",
    "https://item.taobao.com/item.htm?id=123456",
    "https://item.taobao.com/item.htm?id=123456",
  ],
  [
    "https://www.google.com/search?q=birthed+app&gclid=CjwKCA&msclkid=abc",
    "https://www.google.com/search?q=birthed+app",
    "https://google.com/search?q=birthed+app",
  ],
  [
    "https://www.instagram.com/p/C1abcDEf/?igshid=MzRlODBiNWFlZA%3D%3D&cmpid=x",
    "https://www.instagram.com/p/C1abcDEf/",
    "https://instagram.com/p/C1abcDEf",
  ],
];

test("real world pairs produce one key each", () => {
  for (const [left, right, expected] of PAIRS) {
    assert.equal(normalizeUrl(left), expected, left);
    assert.equal(normalizeUrl(right), expected, right);
  }
});

test("s is removed only on x.com and twitter.com", () => {
  assert.equal(normalizeUrl("https://twitter.com/a/status/1?s=20"), "https://twitter.com/a/status/1");
  assert.equal(normalizeUrl("https://example.com/page?s=20"), "https://example.com/page?s=20");
});

test("a parameter that changes which page you see stays", () => {
  assert.equal(normalizeUrl("https://example.com/list?page=2"), "https://example.com/list?page=2");
  assert.equal(normalizeUrl("https://example.com/list?id=7&ref=home"), "https://example.com/list?id=7");
  assert.equal(normalizeUrl("https://example.com/a?utm_source=x&utmx=keep"), "https://example.com/a?utmx=keep");
});

test("the root of a site loses its one trailing slash and nothing else", () => {
  assert.equal(normalizeUrl("https://www.example.com/"), "https://example.com");
  assert.equal(normalizeUrl("https://example.com"), "https://example.com");
  assert.equal(normalizeUrl("https://example.com/a//"), "https://example.com/a/");
});

test("path case is kept because it can change the page", () => {
  assert.equal(normalizeUrl("https://Example.com/Some/Path"), "https://example.com/Some/Path");
});

test("a non http address is refused", () => {
  assert.throws(() => normalizeUrl("mailto:somebody@example.com"));
  assert.throws(() => normalizeUrl("not an address"));
});

test("the outlet is the host with no www", () => {
  assert.equal(outletOf("https://www.bbc.com/news/1"), "bbc.com");
  assert.equal(outletOf("https://apnews.com/article/x"), "apnews.com");
});
