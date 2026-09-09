import { strict as assert } from "node:assert";
import { test } from "node:test";

import { PER_FEED_PER_DATE, fitHeadline, openDates, parseFeed, planNews, type Feed } from "../src/wall/news.js";

// 20:30 Coordinated Universal Time on September 9 is 16:30 Eastern, so the
// open dates are the 8th, the 9th and the 10th.
const NOW = Date.parse("2026-09-09T20:30:00Z");
const NPR: Feed = { url: "https://feeds.npr.org/1001/rss.xml", outlet: "npr.org" };

const RSS = `<?xml version="1.0"?><rss><channel><title>NPR</title>
<item>
  <title><![CDATA[U.S. military says it destroyed 5 Iranian oil tankers]]></title>
  <link>https://www.npr.org/2026/09/09/nx-s1-5962641/us-destroy-iranian-oil-tankers?utm_source=feed</link>
  <description><![CDATA[The U.S. military said it <b>destroyed</b> five Iranian oil tankers on Tuesday.]]></description>
  <pubDate>Wed, 09 Sep 2026 14:02:00 -0400</pubDate>
</item>
<item>
  <title>Late on the 8th, Eastern</title>
  <link>https://www.npr.org/2026/09/08/late</link>
  <description>Published at eleven at night Eastern, which is the 9th in London and the 8th here.</description>
  <pubDate>Wed, 09 Sep 2026 03:10:00 +0000</pubDate>
</item>
<item>
  <title>Too old</title>
  <link>https://www.npr.org/2026/09/01/old</link>
  <description>A week old, and the wall for the 1st is long closed.</description>
  <pubDate>Tue, 01 Sep 2026 12:00:00 +0000</pubDate>
</item>
<item>
  <title>Too short a description</title>
  <link>https://www.npr.org/2026/09/09/short</link>
  <description>Brief.</description>
  <pubDate>Wed, 09 Sep 2026 12:00:00 +0000</pubDate>
</item>
<item>
  <title>No date at all</title>
  <link>https://www.npr.org/2026/09/09/undated</link>
  <description>An item without a date cannot be filed on a wall.</description>
</item>
<item>
  <title>From the future</title>
  <link>https://www.npr.org/2026/09/10/tomorrow</link>
  <description>Dated after now, so it waits for a later run.</description>
  <pubDate>Thu, 10 Sep 2026 12:00:00 +0000</pubDate>
</item>
</channel></rss>`;

test("the open dates are yesterday, today and tomorrow, Eastern", () => {
  assert.deepEqual(openDates(NOW), ["2026-09-08", "2026-09-09", "2026-09-10"]);
  // Just after Eastern midnight the dates roll, whatever the Coordinated Universal Time date says.
  assert.deepEqual(openDates(Date.parse("2026-09-10T04:01:00Z")), ["2026-09-09", "2026-09-10", "2026-09-11"]);
  assert.deepEqual(openDates(Date.parse("2026-12-31T20:00:00Z")), ["2026-12-30", "2026-12-31", "2027-01-01"]);
  assert.deepEqual(openDates(Date.parse("2028-02-28T20:00:00Z")), ["2028-02-27", "2028-02-28", "2028-02-29"]);
});

test("items are read with their words plain and their dates parsed", () => {
  const items = parseFeed(RSS);
  assert.equal(items.length, 6);
  assert.equal(items[0]!.title, "U.S. military says it destroyed 5 Iranian oil tankers");
  assert.equal(items[0]!.description, "The U.S. military said it destroyed five Iranian oil tankers on Tuesday.");
  assert.equal(items[0]!.publishedAt, Date.parse("2026-09-09T18:02:00Z"));
  assert.equal(items[4]!.publishedAt, null);
});

test("an item lands on the wall of the Eastern date it was published, at the claimed tier, with no boost", () => {
  const planned = planNews([{ feed: NPR, items: parseFeed(RSS) }], NOW);
  assert.deepEqual(planned.map((p) => [p.wallDate, p.headline]), [
    ["2026-09-09", "U.S. military says it destroyed 5 Iranian oil tankers"],
    ["2026-09-09", "Too short a description"],
    ["2026-09-08", "Late on the 8th, Eastern"],
  ]);
  // A description too short to quote falls back to the headline, which is
  // the source's wording too and is on the page. wall_submit_story does the
  // same.
  assert.equal(planned[1]!.quotation, "Too short a description");
  const first = planned[0]!;
  assert.equal(first.url, "https://npr.org/2026/09/09/nx-s1-5962641/us-destroy-iranian-oil-tankers", "tracking removed, the key is the address");
  assert.equal(first.quotation, "The U.S. military said it destroyed five Iranian oil tankers on Tuesday.");
  assert.equal(first.outlet, "npr.org");
  // Nothing about boosts exists on a planned story. There is no field to
  // invent one in.
  assert.ok(!("support" in first) && !("boosts" in first));
});

test("one feed puts at most eight items on one date, newest first, and never the same page twice", () => {
  const items = [];
  for (let i = 0; i < 12; i++) {
    items.push({
      title: `Story ${i}`, link: `https://npr.org/2026/09/09/story-${i % 10}`,
      description: "A description that is long enough to be a quotation.", publishedAt: Date.parse("2026-09-09T10:00:00Z") + i * 60_000,
    });
  }
  const planned = planNews([{ feed: NPR, items }], NOW);
  assert.equal(planned.length, PER_FEED_PER_DATE);
  assert.equal(planned[0]!.headline, "Story 11");
  assert.equal(new Set(planned.map((p) => p.urlKey)).size, planned.length);
});

test("a headline longer than the column is cut at a word and keeps only the source's words", () => {
  const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
  const cut = fitHeadline(long);
  assert.ok(cut.length <= 300);
  assert.ok(long.startsWith(cut));
  assert.ok(!cut.endsWith(" "));
  assert.equal(fitHeadline("  short   headline "), "short headline");
});
