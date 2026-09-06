import test from "node:test";
import assert from "node:assert/strict";
import { renderDayPage, renderSitemap, escapeHtml, isReady } from "../src/render.js";
import { everyDate, neighbours, slug } from "../src/model.js";

const page = {
  month: 9,
  day: 4,
  people: [
    { qid: "Q1", name: "Anton Bruckner", birthYear: 1824, deathYear: 1896, description: "Austrian composer", monthlyViews: 4200 },
    { qid: "Q2", name: "Hildur \"Test\" <script>", birthYear: 1982, deathYear: null, description: null, monthlyViews: 0 },
  ],
};

test("the page names the date in the title and the heading", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes("<title>Born on September 4</title>"));
  assert.ok(html.includes("<h1>September 4</h1>"));
  assert.ok(html.includes("The people most looked up on this day."));
  assert.ok(!html.includes("2 notable people"), "the row count is not the number of people who share a date");
});

test("a name from the data cannot inject markup", () => {
  const html = renderDayPage(page);
  assert.ok(!html.includes("<script>Hildur"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(escapeHtml(`<a href="x">&</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
});

test("the year column carries the birth year and nothing that could wrap", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes('<span class="year">1824</span>'));
  assert.ok(html.includes('<span class="year">1982</span>'));
  assert.ok(!html.includes("1824 to 1896"), "a range in the column pushes every name out of line");
});

test("a death year is shown, just not in the aligned column", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes("died 1896"));
});

test("every page links to the day before and the day after", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes('href="/september-3/"'));
  assert.ok(html.includes('href="/september-5/"'));
});

test("the year wraps at both ends", () => {
  assert.deepEqual(neighbours(1, 1).previous, { month: 12, day: 31 });
  assert.deepEqual(neighbours(12, 31).next, { month: 1, day: 1 });
});

test("February 29 has a page", () => {
  assert.equal(slug(2, 29), "february-29");
  assert.equal(everyDate().length, 366);
});

test("the page carries structured data a search engine can read", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes('<script type="application/ld+json">'));
  assert.ok(html.includes('"@type":"ItemList"'));
  assert.ok(html.includes('"sameAs":"https://www.wikidata.org/wiki/Q1"'));
});

test("an empty date says so rather than rendering a blank list", () => {
  const html = renderDayPage({ month: 3, day: 3, people: [] });
  assert.ok(html.includes("Nobody imported for this date yet."));
  assert.ok(!html.includes("<ol>"));
});

test("the sitemap lists the front door, support, privacy and all 366 dates", () => {
  const xml = renderSitemap();
  assert.equal((xml.match(/<loc>/g) ?? []).length, 369);
  assert.ok(xml.includes("https://birthed.app/privacy/"));
  assert.ok(xml.includes("https://birthed.app/february-29/"));
});


import { renderShareCard } from "../src/share.js";

test("every page points at its own share image", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes('<meta property="og:image" content="https://birthed.app/og/september-4.png">'));
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
});

test("the share card carries the date and the first three names", () => {
  const card = renderShareCard(page);
  assert.ok(card.includes("September 4"));
  assert.ok(card.includes("Anton Bruckner"));
});

test("a name on the card cannot inject markup either", () => {
  const card = renderShareCard(page);
  assert.ok(!card.includes("<script>Hildur"));
  assert.ok(card.includes("&lt;script&gt;"));
});

test("an empty date still produces a card rather than a broken one", () => {
  const card = renderShareCard({ month: 3, day: 3, people: [] });
  assert.ok(card.includes("March 3"));
  assert.ok(!card.includes("You share it with"));
});

import { calendar, isLeapYear, renderAdd, renderHome, renderPrivacy, renderSupport } from "../src/pages.js";

test("the front door still links every date, and the two pages people need", () => {
  const html = renderHome();
  assert.equal((html.match(/href="\/[a-z]+-\d+\/"/g) ?? []).length, 366);
  assert.ok(html.includes('href="/support/"'));
  assert.ok(html.includes('href="/privacy/"'));
});

test("the privacy page does not claim anything stays on the phone that does not", () => {
  const html = renderPrivacy();
  // The birthday, year and region go to the account. The people list does not.
  assert.ok(html.includes("are sent to that account"));
  assert.ok(html.includes("is not sent to the account service"));
  assert.ok(!/birthday[^.]*stays on your phone/i.test(html));
});

test("support and privacy carry a way to reach a person", () => {
  for (const html of [renderSupport(), renderPrivacy()]) {
    assert.ok(html.includes("mailto:"));
  }
});

test("every page names its favicon", () => {
  assert.ok(renderHome().includes('rel="icon" href="/favicon.ico"'));
});

test("the index is twelve calendars, and each month starts on its real weekday", () => {
  const html = renderHome(2026);
  const january = html.split("<h3>January</h3>")[1]?.split("</section>")[0] ?? "";
  // January 1 2026 was a Thursday, so four squares sit empty before it.
  assert.equal((january.match(/<span class="pad"><\/span>/g) ?? []).length, 4);
  assert.ok(january.includes('<a href="/january-1/" aria-label="January 1"'));
  assert.ok(january.includes("<span>Su</span>"), "the week has a header row");
  // March 1 2026 was a Sunday, so nothing sits before it.
  const march = html.split("<h3>March</h3>")[1]?.split("</section>")[0] ?? "";
  assert.equal((march.match(/<span class="pad"><\/span>/g) ?? []).length, 0);
});

test("the number is what you see, the date is what a screen reader says", () => {
  const html = renderHome(2026);
  assert.ok(html.includes('aria-label="December 25" title="December 25">25</a>'));
});

test("February 29 keeps a square in a year that does not have one", () => {
  const ordinary = renderHome(2026);
  assert.ok(ordinary.includes('<a class="leap" href="/february-29/"'));
  assert.ok(ordinary.includes("February 29 comes around every fourth year"));

  const leap = renderHome(2028);
  assert.ok(leap.includes('<a href="/february-29/"'));
  assert.ok(!leap.includes('class="leap"'), "a leap year has no odd one out");
  assert.ok(!leap.includes("comes around every fourth year"));
});

test("all 366 are linked once, in a leap year and out of one", () => {
  for (const year of [2026, 2027, 2028, 2100]) {
    const links = calendar(year).match(/href="\/[a-z]+-\d+\/"/g) ?? [];
    assert.equal(links.length, 366, `${year} did not link all 366`);
    assert.equal(new Set(links).size, 366, `${year} linked one twice`);
  }
});

test("the century rule is not forgotten", () => {
  assert.equal(isLeapYear(2028), true);
  assert.equal(isLeapYear(2027), false);
  assert.equal(isLeapYear(2100), false);
  assert.equal(isLeapYear(2000), true);
});

// The found facts on a date page. These are the section the whole date page
// argument now rests on, so the tests are about what would actually be wrong
// on a public page rather than about the markup.

const facts = [
  {
    month: 9,
    day: 4,
    fact: "On September 4, 1957, Ford unveiled the Edsel.",
    category: "release",
    sourceUrl: "https://en.wikipedia.org/wiki/Edsel",
  },
  {
    month: 9,
    day: 4,
    fact: "On September 4, 1998, Google was founded <script>alert(1)</script>.",
    category: "event",
    sourceUrl: "https://www.example.org/a?b=1&c=2",
  },
];

test("a date page carries its found facts and the page each came from", () => {
  const html = renderDayPage(page, [], facts);
  assert.ok(html.includes("What happened on September 4"));
  assert.ok(html.includes("On September 4, 1957, Ford unveiled the Edsel."));
  assert.ok(html.includes("en.wikipedia.org"));
  assert.ok(html.includes("2 things, each with the page it came from."));
});

test("the source host is shown without the www, which nobody reads", () => {
  const html = renderDayPage(page, [], facts);
  assert.ok(html.includes(">example.org<"));
  assert.ok(!html.includes(">www.example.org<"));
});

test("a fact from the model cannot inject markup", () => {
  const html = renderDayPage(page, [], facts);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes("b=1&amp;c=2"), "the ampersand in a source address is escaped too");
});

test("a date with no facts yet has no heading standing over nothing", () => {
  const html = renderDayPage(page, [], []);
  assert.ok(!html.includes("What happened on September 4"));
  assert.ok(!html.includes('class="facts"'));
});

test("the description leads with the facts, because the names are what everyone else has", () => {
  const html = renderDayPage(page, [], facts);
  assert.ok(html.includes("What happened on September 4, in 2 sourced facts."));
});

test("nothing on a date page is written to somebody born that day", () => {
  // A stranger who typed the date into a search box was not born on it, so a
  // fact that says "your birthday" is simply false here. The voice is set in
  // the Edge Function; this is the assertion that notices if it changes back.
  const html = renderDayPage(page, [], facts);
  const section = html.slice(html.indexOf("What happened on"), html.indexOf("<nav class=\"pager\">"));
  assert.ok(!/\byour?\b/i.test(section), "the facts section must not address a reader");
});

test("a date with nobody on it is ready when it has facts instead", () => {
  // January 1 has nobody and never will: Wikidata files a year-only birth date
  // as January 1, and the importer's precision filter correctly refuses all of
  // them. Holding one of the most searched dates of the year out of the
  // sitemap forever, on a head count it cannot meet, is the rule misfiring.
  const nobody = { month: 1, day: 1, people: [] };
  const twelve = Array.from({ length: 12 }, (_, index) => ({
    month: 1, day: 1, fact: `On January 1, thing number ${index} happened.`,
    category: "event", sourceUrl: "https://en.wikipedia.org/wiki/January_1",
  }));
  assert.equal(isReady(nobody, twelve), true);
  assert.equal(isReady(nobody, twelve.slice(0, 3)), false, "a few facts is not a page");
  assert.equal(isReady(nobody), false);
});

test("facts do not rescue a page whose people were never ranked", () => {
  // The other 171 are not thin, they have about fifty people each and no
  // pageviews, so they are ordered by how many languages have an article,
  // which fills a page with footballers. That is a worker run, not a rule
  // change, and facts must not paper over it.
  const unranked = {
    month: 6, day: 8,
    people: Array.from({ length: 10 }, (_, i) => ({
      qid: `Q${i}`, name: `Person ${i}`, birthYear: 1960 + i,
      deathYear: null, description: null, monthlyViews: 0,
    })),
  };
  const plenty = Array.from({ length: 12 }, (_, index) => ({
    month: 6, day: 8, fact: `On June 8, thing number ${index} happened.`,
    category: "event", sourceUrl: "https://en.wikipedia.org/wiki/June_8",
  }));
  assert.equal(isReady(unranked, plenty), false);
});

// The page a shared birthday lands on. The tests that matter here are about
// what it does not do: appear in search, and reach the server.

test("the add page keeps itself out of search results", () => {
  const html = renderAdd();
  assert.ok(html.includes('name="robots" content="noindex"'));
});

test("the add page never puts a birthday in a query", () => {
  // The whole design is that the data sits after the hash, which browsers do
  // not send. A link built with a question mark would be sent to the server
  // on every tap, and the privacy page would stop being true.
  const html = renderAdd();
  assert.ok(html.includes('/add/#"'), "the link it builds is a fragment");
  assert.ok(!/\/add\/\?/.test(html), "nothing builds a query onto /add/");
});

test("the add page hands off to the app rather than assuming it is there", () => {
  const html = renderAdd();
  assert.ok(html.includes("birthed://add?"));
  assert.ok(html.includes("<noscript>"), "it says why it needs a script");
});

test("the privacy page no longer claims the site runs no scripts", () => {
  // It did, and one page now does. A privacy page that is wrong about
  // something checkable is worse than one that explains itself.
  const html = renderPrivacy();
  assert.ok(!html.includes("runs no scripts"));
  assert.ok(html.includes("after the hash symbol"));
  assert.ok(html.includes("sets no cookies"));
});
