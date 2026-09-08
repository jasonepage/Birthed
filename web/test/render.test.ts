import test from "node:test";
import assert from "node:assert/strict";
import { ASK_SLOTS, askCandidates, renderDayPage, renderRobots, renderSitemap, escapeHtml, isReady, undoForm } from "../src/render.js";
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
  assert.ok(!html.includes("2 notable people"), "the row count is not the number of people who share a date");
  // The summary sentence that used to sit under the heading is deliberately
  // not there. It told a reader what the heading already told them, in the
  // one rhythm that reads as machine written.
  assert.ok(!html.includes("Everything that was true about September 4:"));
  // The search result still gets a sentence of its own. This fixture has no
  // facts and no songs, so it is the plain one.
  assert.match(html, /<meta name="description" content="Who was born on September 4\.">/);
});

test("the page does not lead with the list of names", () => {
  // The regression this guards is not cosmetic. The list is ordered by
  // notability_score, which is attention, and infamy is attention, so leading
  // with it put Ted Bundy at the top of November 24 and a serial killer or a
  // dictator at the top of four other dates. The data screen in
  // 20260906240000 catches the ones whose description says what they did, and
  // Wikidata calls Bashar al-Assad a politician, so the ordering must not be
  // the first thing on the page even when the screen is working.
  const html = renderDayPage(page, [], [
    { id: "t", month: 9, day: 4, fact: "Something sourced happened.", category: "event",
      sourceUrl: "https://example.org/september-4" },
  ]);
  const people = html.indexOf("People born on September 4");
  const happened = html.indexOf('class="section">What happened');
  assert.ok(people > 0, "the people section is still on the page");
  assert.ok(happened > 0, "the timeline section is still on the page");
  assert.ok(happened < people, "what happened on the date comes before who was born on it");
});

test("the lede never claims the list is ranked by attention", () => {
  const html = renderDayPage(page);
  assert.ok(!html.includes("most looked up"));
});

test("a name from the data cannot inject markup", () => {
  const html = renderDayPage(page);
  assert.ok(!html.includes("<script>Hildur"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(escapeHtml(`<a href="x">&</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
});

test("the year column carries the birth year and nothing that could wrap", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes('<p class="b">1824</p>'));
  assert.ok(html.includes('<p class="b">1982</p>'));
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
import { asHighlight, pickHighlights, type Fact } from "../src/facts.js";
import { redirectFor } from "../src/serve.js";

test("the front door still reaches every date, and the two pages people need", () => {
  const html = renderHome();
  const links = new Set(html.match(/href="\/[a-z]+-\d+\/"/g) ?? []);
  assert.equal(links.size, 366);
  assert.ok(html.includes('href="/support/"'));
  assert.ok(html.includes('href="/privacy/"'));
});

test("the front door offers a random day and today, and neither is a page", () => {
  const html = renderHome();
  assert.ok(html.includes('href="/random/"'));
  assert.ok(html.includes('href="/today/"'));
  // Both are answered by a redirect. If either ever became a file, the built
  // site would have a page nothing links to it correctly and this would say so.
  assert.equal(redirectFor("/random/") === null, false);
  assert.equal(redirectFor("/today/") === null, false);
});

test("an icon only link still has a name when its words are hidden", () => {
  // Under 430 pixels the stylesheet hides the words in these two links. A
  // link whose remaining content is a decorative svg has no accessible name
  // at all unless one is on the link itself.
  const html = renderHome();
  assert.ok(html.includes('href="/today/" aria-label='));
  assert.ok(html.includes('href="/random/" aria-label='));
});

test("the born in strip jumps to a month that exists on the page", () => {
  const html = renderHome(2026);
  const jumps = html.match(/href="#([a-z]+)"/g) ?? [];
  assert.equal(jumps.length, 12);
  for (const jump of jumps) {
    const anchor = jump.slice('href="#'.length, -1);
    assert.ok(html.includes(`id="${anchor}"`), `no calendar for #${anchor}`);
  }
  // The strip must not have added a script to a page that promises none.
  assert.ok(!html.includes("<script"));
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

// Two squares in the calendar are marked and they are marked in two different
// places, for a reason that is easy to undo by accident. The date whose page
// this is can be written at build time. Today cannot, because these pages are
// baked into a deploy and served unchanged until the next one, so a today
// written here would still point at the day of the deploy a week later.
// The footer says there is no sign up, and on one page that is false. /add
// has a form, runs a script and posts a birthday to the project, which is why
// it carries its own widened policy header. A claim that is true on 370 pages
// and false on one is worse than no claim, because the one is the page
// somebody screenshots.
test("every page says nothing is collected, except the page that collects", () => {
  const claim = "no sign up";
  const collecting = renderAdd({ url: "https://example.supabase.co", key: "anon" });
  assert.ok(!collecting.includes(claim), "/add takes a birthday and must not claim otherwise");

  for (const [name, html] of [
    ["about", renderHome(2026, [])],
    ["support", renderSupport()],
    ["privacy", renderPrivacy()],
  ] as const) {
    assert.ok(html.includes(claim), `${name} should carry the line`);
  }
});

test("the calendar marks the page's own date, once", () => {
  const marked = calendar(2026, { month: 9, day: 8 });
  assert.equal((marked.match(/class="thispage"/g) ?? []).length, 1);
  assert.match(marked, /<a class="thispage" href="\/september-8\/"/);
});

test("a calendar with no date of its own marks nothing", () => {
  // The about page draws the same twelve months and is not a date.
  assert.ok(!calendar(2026).includes("thispage"));
});

test("February 29 can be the marked square in a year that has no 29th", () => {
  // The leap day keeps a square in every year, so it has to be markable in
  // every year too, or its own page is the one page that cannot say so.
  const marked = calendar(2027, { month: 2, day: 29 });
  assert.match(marked, /class="[^"]*thispage[^"]*" href="\/february-29\/"/);
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
    id: "t", month: 9,
    day: 4,
    fact: "On September 4, 1957, Ford unveiled the Edsel.",
    category: "release",
    sourceUrl: "https://en.wikipedia.org/wiki/Edsel",
  },
  {
    id: "t", month: 9,
    day: 4,
    fact: "On September 4, 1998, Google was founded <script>alert(1)</script>.",
    category: "event",
    sourceUrl: "https://www.example.org/a?b=1&c=2",
  },
];

test("a date page carries its found facts and the page each came from", () => {
  const html = renderDayPage(page, [], facts);
  assert.match(html, /<h2 class="section">What happened<\/h2>/);
  // The date comes off the front and becomes the anchor in the margin. It
  // used to be printed inside every sentence, on a page titled with it.
  assert.ok(html.includes("Ford unveiled the Edsel."));
  assert.ok(!html.includes("On September 4, 1957, Ford"), "the page's own date is not repeated per row");
  assert.match(html, /<span class="yr">1957<\/span>/);
  assert.ok(html.includes("en.wikipedia.org"));
  assert.ok(html.includes("2 things, newest first."));
});

test("Wikipedia's own events join the researched ones, newest first", () => {
  const events = [
    { id: "t", month: 9, day: 4, year: 1888, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "George Eastman registers the trademark Kodak." },
  ];
  const html = renderDayPage(page, [], facts, events);
  assert.ok(html.includes("George Eastman registers the trademark Kodak."));
  assert.ok(html.includes("3 things, newest first."));
  // 1888 is older than the 1957 fact, so it comes last in the list. The feed
  // reads from now backwards as of 8 September 2026; see the sort in
  // buildTimeline for why.
  //
  // Measured inside the feed rather than across the whole page. The opening
  // band now names one thing above it, drawn from the same rows, so a raw
  // indexOf over the document answers a question about the tiles instead of a
  // question about the ordering.
  const feed = html.slice(html.indexOf('<ul class="feed">'));
  assert.ok(
    feed.indexOf("Edsel") < feed.indexOf("Kodak"),
    "the list is ordered by year, newest first, not by which source it came from",
  );
  // One credit for each source that is actually on the page, and the
  // Wikipedia rows do not each carry their own host line.
  assert.match(html, /Creative Commons Attribution ShareAlike/);
  assert.match(html, /Google's Gemini/);
});

test("the same event from both sources is printed once", () => {
  const events = [
    { id: "t", month: 9, day: 4, year: 1957, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "Ford unveils the Edsel to the public." },
  ];
  const html = renderDayPage(page, [], facts, events);
  assert.ok(html.includes("2 things, newest first."), "the duplicate is dropped, not added");
  // Counting the word will not do: the fixture's own source address contains
  // it. What must not survive is Wikipedia's second telling of the event.
  assert.ok(!html.includes("Ford unveils the Edsel to the public."));
  assert.ok(html.includes("Ford unveiled the Edsel."), "the researched one is the one kept");
});

test("a page with no researched facts still has a section when Wikipedia does", () => {
  const events = [
    { id: "t", month: 9, day: 4, year: 1888, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "George Eastman registers the trademark Kodak." },
  ];
  const html = renderDayPage(page, [], [], events);
  assert.match(html, /<h2 class="section">What happened<\/h2>/);
  assert.ok(html.includes("1 things, newest first."));
  assert.ok(!html.includes("Google's Gemini"), "no Gemini credit when no Gemini rows");
  assert.match(html, /Creative Commons Attribution ShareAlike/);
});

test("a description stops repeating the year the row already prints", () => {
  const dead = {
    month: 9,
    day: 4,
    people: [
      { qid: "Q9", name: "Rishi Kapoor", birthYear: 1952, deathYear: 2020,
        description: "Indian film actor (1951\u20132020)", monthlyViews: 900 },
    ],
  };
  const html = renderDayPage(dead);
  assert.ok(html.includes("Indian film actor"));
  // Wikidata's own data disagreed with itself here: the birth date says 1952
  // and the description said 1951, so the page printed both next to each other.
  assert.ok(!html.includes("1951"), "the prose copy of the years goes, the structured one stays");
  assert.match(html, /<p class="b">1952<\/p>/);
  assert.ok(html.includes("died 2020"));
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
  assert.ok(!html.includes('class="feed"'));
});

test("the description leads with the facts, because the names are what everyone else has", () => {
  const html = renderDayPage(page, [], facts);
  assert.ok(html.includes("What happened on September 4, in 2 sourced things."));
});

test("nothing on a date page is written to somebody born that day", () => {
  // A stranger who typed the date into a search box was not born on it, so a
  // fact that says "your birthday" is simply false here. The voice is set in
  // the Edge Function; this is the assertion that notices if it changes back.
  //
  // Sliced from the facts list rather than from the first "What happened on",
  // which is in the meta description up in the head. Starting there put the
  // whole inlined stylesheet inside the section being read, so this test was
  // also asserting that no CSS comment anywhere on the site contains the word
  // "you". It caught one, and the comment was about dropdown chevrons.
  const html = renderDayPage(page, [], facts);
  const section = html.slice(html.indexOf("<ul class=\"feed\">"), html.indexOf("<nav class=\"pager"));
  assert.ok(section.length > 0, "the facts list is on the page to be read");
  assert.ok(!/\byour?\b/i.test(section), "the facts section must not address a reader");
});

test("a date with nobody on it is ready when it has facts instead", () => {
  // January 1 has nobody and never will: Wikidata files a year-only birth date
  // as January 1, and the importer's precision filter correctly refuses all of
  // them. Holding one of the most searched dates of the year out of the
  // sitemap forever, on a head count it cannot meet, is the rule misfiring.
  const nobody = { month: 1, day: 1, people: [] };
  const twelve = Array.from({ length: 12 }, (_, index) => ({
    id: "t", month: 1, day: 1, fact: `On January 1, thing number ${index} happened.`,
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
    id: "t", month: 6, day: 8, fact: `On June 8, thing number ${index} happened.`,
    category: "event", sourceUrl: "https://en.wikipedia.org/wiki/June_8",
  }));
  assert.equal(isReady(unranked, plenty), false);
});

// The page a shared birthday lands on. The tests that matter here are about
// what it does not do: appear in search, and put a birthday in a query.

/// Stand-ins for the real project. The page is built with them baked in, so a
/// test can look for them and know the wiring reached the markup.
const API = { url: "https://example.supabase.co", key: "test-anon-key" };

test("the add page keeps itself out of search results", () => {
  const html = renderAdd(API);
  assert.ok(html.includes('name="robots" content="noindex"'));
});

test("the add page never puts a birthday in a query", () => {
  // The whole design is that the data sits after the hash, which browsers do
  // not send. A link built with a question mark would be sent to the server
  // on every tap, and the privacy page would stop being true.
  const html = renderAdd(API);
  assert.ok(html.includes('/add/#"'), "the link it builds is a fragment");
  assert.ok(!/\/add\/\?/.test(html), "nothing builds a query onto /add/");
});

test("the add page hands off to the app rather than assuming it is there", () => {
  const html = renderAdd(API);
  assert.ok(html.includes("birthed://add?"));
  assert.ok(html.includes("<noscript>"), "it says why it needs a script");
});

// The third mode: somebody answering a request rather than volunteering.
// This is the only place on the site that writes to a server, so the tests are
// about it being reachable, being honest, and not leaking into the other two.

test("the add page can answer a request as well as build a link", () => {
  const html = renderAdd(API);
  assert.ok(html.includes("rpc/leave_birthday"), "it posts to the function, not the table");
  assert.ok(!/rest\/v1\/birthday_replies/.test(html), "it never writes the table directly");
  assert.ok(html.includes(API.url), "the project it posts to is baked in");
  assert.ok(html.includes(API.key), "so is the publishable key");
});

test("the code travels after the hash, like everything else here", () => {
  // Not for secrecy. It keeps the code out of the website's access logs, so
  // the only record that a request exists is the row the sender created.
  const html = renderAdd(API);
  assert.ok(html.includes("values.c"), "the code is read out of the fragment");
  assert.ok(!/\/add\/\?/.test(html), "nothing builds a query onto /add/");
});

test("a mistyped address is not treated as a request", () => {
  const html = renderAdd(API);
  assert.ok(/\[A-Z2-9\]\{6,12\}/.test(html), "the code has to look like a code");
});

test("the send route tells the reader what happens to what they typed", () => {
  // The rest of this site is true because nothing reaches us. This one button
  // is the exception, and a page that took the answer without saying so would
  // make the privacy page a lie.
  const html = renderAdd(API);
  assert.ok(html.includes("deleted from our server"));
  assert.ok(html.includes("You do not need the app"));
});

test("a failed send falls back to the link that never needed us", () => {
  const html = renderAdd(API);
  assert.ok(html.includes("Send them this link instead"));
});

test("the privacy page says what the request route stores", () => {
  const html = renderPrivacy();
  assert.ok(html.includes("Asking somebody for their birthday"));
  assert.ok(html.includes("their name and their birthday are stored against that code"));
  assert.ok(html.includes("Confirming deletes it from the server."));
  assert.ok(html.includes("a fortnight"), "the expiry is stated, not implied");
});

test("the privacy page no longer claims the site runs no scripts", () => {
  // It did, and one page now does. A privacy page that is wrong about
  // something checkable is worse than one that explains itself.
  const html = renderPrivacy();
  assert.ok(!html.includes("runs no scripts"));
  assert.ok(html.includes("after the hash symbol"));
  // This used to assert the page carried "sets no cookies", which pinned the
  // claim in place while the answer route was setting one. The test above
  // asserts the opposite now, on purpose.
});

// The footer sentence is the answer to the Reddit accusation and its whole
// value is that a reader can check every clause in the network tab. It said
// the page set no cookies while the answer route was setting a one year one.
// These two assertions exist so that the next thing stored about a reader
// either appears in the sentence or fails the build.
// A polished free site with no owner named on it is read as a business that
// has not shown its hand. The name goes above the fold on the date page, which
// is where the doubt happens, and the About page carries the reason. Both, or
// the line is a signature with nothing behind it.
test("the date page and the about page are signed", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes("Jason Evan Page"), "the date page says who made it");
  assert.ok(html.includes("No ads, nothing for sale."), "shortened with the move to a credit line");
  // Baked into all 366 and drawn on one. A name on every page of an almanac
  // reads as a byline over work somebody else did, and "/" serves today's own
  // built file, so no file can know whether it is today. today.css does.
  const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  assert.match(style, /\.signed \{ display: none;/);
  // The last line of the page, at the size of a credit. It sat on the first
  // screen for one morning and that was too loud for the person whose name it
  // is, which is the only vote that counts on this one.
  // Measured against the calendar, which every date page has. This fixture has
  // no rows and therefore no ask card, so testing against one asserted nothing
  // on the page it was actually run on.
  const mark = html.indexOf("Jason Evan Page");
  assert.ok(mark > 0 && mark > html.indexOf('class="everyday"'),
    "the name is the last line of the page, below even the calendar");
  const baked = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  assert.match(baked, /\.signed \{ display: none;/, "still today's date only, by today.css");

  const about = renderHome(2026, []);
  assert.ok(about.includes("Who made this"));
  assert.ok(about.includes("Jason Evan Page"));
  assert.ok(about.includes("It costs me money to run and it does not make any."));
});

test("the footer names the cookie instead of denying it", () => {
  const html = renderPrivacy();
  assert.ok(!html.includes("sets no cookies"), "answering sets one, so the line may not deny it");
  assert.ok(html.includes("one random string is kept in a cookie"));
  assert.ok(html.includes("not counted twice"), "the line says what the cookie is for");
});

// The privacy page has to name both cookies by the names the reader will see
// in their browser, or naming them in the footer is the only honest text on
// the site and the page behind it still reads as boilerplate.
test("the privacy page names both cookies and refuses the address", () => {
  const html = renderPrivacy();
  assert.ok(html.includes("<code>bt</code>"), "the answer token is named");
  assert.ok(html.includes("<code>by</code>"), "the birth year cookie is named");
  assert.ok(html.includes("never sent to our database and is never stored against an answer"));
  assert.ok(html.includes("no analytics service"));
});

test("the hidden attribute beats the stylesheet", () => {
  // The /add page switches its two buttons with the hidden attribute, and
  // .btn sets display, which wins over the browser's own [hidden] rule. The
  // page shipped offering "Make my link" and "Send it" at once, on a screen
  // where only one of them does the right thing.
  const html = renderDayPage(page);
  assert.match(html, /\[hidden\]\s*{\s*display:\s*none\s*!important;\s*}/);
});

test("the form on the add page loads nothing", () => {
  // The security header for /add says img-src 'self'. The usual way to put a
  // chevron on a dropdown is a data: URI as a background image, and a data:
  // URI is an image, so the browser would refuse it, draw no chevron, and say
  // nothing on the page. That is the same silent shape as the two bugs this
  // page has already had, so the rule is tested here rather than looked for
  // in a browser: the whole stylesheet fetches nothing at all.
  const html = renderAdd(API);
  const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  assert.ok(style.length > 0, "the stylesheet is inlined into the page");
  assert.ok(!style.includes("url("), "nothing in the stylesheet fetches anything");
  assert.match(style, /\.select::after\s*{[^}]*border-right/, "the chevron is drawn with borders");
});

test("the add form does not make iOS zoom when a field is tapped", () => {
  // Safari on iOS zooms the page in when a control smaller than 16px takes
  // focus, and it does not zoom back out. The form would work and would feel
  // broken, which is the failure this page can least afford: it is the first
  // thing somebody sees of Birthed.
  const html = renderAdd(API);
  assert.match(html, /\.input,\s*\.select\s*>\s*select\s*{[^}]*font-size:\s*16px/);
});

test("the label the script rewrites holds nothing but its own words", () => {
  // When somebody has been asked for their birthday, the name stops being
  // optional and the script rewrites the label to say so. It used to do that
  // by reaching into the first child node of a label that also held a line
  // break and the input, so one extra element in front of that text would
  // have sent the rewrite nowhere and left "if you want" over a field that is
  // now required. Nothing on screen would have said so.
  const html = renderAdd(API);
  assert.match(
    html,
    /<label class="label" id="name-label" for="name">[^<]*<\/label>/,
    "the label contains text and no elements",
  );
  assert.ok(
    html.includes('document.getElementById("name-label").textContent = "Your name";'),
    "the rewrite replaces the whole content rather than one node inside it",
  );
  assert.ok(
    !html.includes("childNodes[0].nodeValue"),
    "nothing reaches into a particular child node of the label",
  );
});

test("every song year is its own address on the date page", () => {
  const songs = [
    { year: 1990, song: "Vision of Love", artist: "Mariah Carey", chartDate: "1990-09-08" },
    { year: 1989, song: "Cold Hearted", artist: "Paula Abdul", chartDate: "1989-09-09" },
  ];
  const html = renderDayPage(page, songs);
  // The long tail query is "number one song on September 5 1990", and the
  // answer is already on this page. The anchor is what makes that row
  // linkable without generating a page for every day and year.
  // The tile carries an animation delay now, so the opening tag no longer
  // ends at the id. Matched without the closing bracket: what this guards is
  // that the year is an address, not what else the tag carries.
  assert.match(html, /<li id="1990"/);
  assert.match(html, /<a href="#1990">1990<\/a>/);
  assert.match(html, /<li id="1989"/);
  assert.match(html, /scroll-margin-top/);
});

// ---------------------------------------------------------------------------
// The two routes that answer with a date rather than with a file, and the
// facts the front door shows. Both are new and both are the kind of thing
// that breaks quietly: a redirect that lands on a page that was never built
// is a 404 nobody sees until somebody presses the button.
// ---------------------------------------------------------------------------

test("random lands on a date that exists, every time", () => {
  // Both ends of the range, because the failure worth catching is an index
  // one past the end, which answers with undefined and a link to /undefined/.
  for (const roll of [0, 0.0001, 0.5, 0.999999, 1]) {
    const to = redirectFor("/random/", new Date(), () => roll);
    assert.ok(to !== null, `no answer for ${roll}`);
    assert.match(to!, /^\/[a-z]+-\d{1,2}\/$/, `${roll} gave ${to}`);
  }
});

test("random can reach all 366 and never anything else", () => {
  const seen = new Set<string>();
  for (let index = 0; index < 366; index++) {
    const to = redirectFor("/random/", new Date(), () => (index + 0.5) / 366);
    seen.add(to!);
  }
  assert.equal(seen.size, 366);
});

test("today is read six hours behind, which is the whole point of it", () => {
  // Nine in the evening in California on September 6. Coordinated Universal
  // Time is already September 7, and answering with September 7 is the bug
  // this offset exists to prevent.
  const evening = new Date("2026-09-07T04:00:00Z");
  assert.equal(redirectFor("/today/", evening), "/september-6/");
  // And it does roll over. Nine in the morning Central on the 7th.
  assert.equal(redirectFor("/today/", new Date("2026-09-07T15:00:00Z")), "/september-7/");
});

test("a path with no trailing slash is the same route", () => {
  assert.equal(redirectFor("/today", new Date("2026-03-02T18:00:00Z")), "/march-2/");
  assert.ok(redirectFor("/random") !== null);
});

test("nothing else is a redirect", () => {
  for (const path of ["/", "/september-4/", "/add/", "/privacy/", "/randomly/", "/today-ish/"]) {
    assert.equal(redirectFor(path), null, `${path} should be a file, not a redirect`);
  }
});

test("robots keeps the two redirects out of a crawl", () => {
  const robots = renderRobots();
  assert.ok(robots.includes("Disallow: /random"));
  assert.ok(robots.includes("Disallow: /today"));
});

const HIGHLIGHT_FACT: Fact = {
  id: "t", month: 8,
  day: 15,
  fact: "On August 15, 1998, Apple began shipping the original Bondi Blue iMac G3 personal computer.",
  category: "release",
  sourceUrl: "https://en.wikipedia.org/wiki/IMac_G3",
};

test("a fact is taken apart into a year and the rest of the sentence", () => {
  const highlight = asHighlight(HIGHLIGHT_FACT);
  assert.ok(highlight);
  assert.equal(highlight!.year, 1998);
  // The opening is gone, because the badge beside it already says the date.
  assert.ok(!highlight!.text.startsWith("On August 15"));
  assert.ok(highlight!.text.startsWith("Apple began shipping"));
});

test("a sentence that opens with somebody else's date is refused", () => {
  // A row filed under August 15 whose sentence is about August 16 is a data
  // problem, and putting it on the front door under an August 15 badge would
  // print something false on the most read page on the site.
  const wrong = { ...HIGHLIGHT_FACT, day: 16 };
  assert.equal(asHighlight(wrong), null);
  // And so is one that does not open the expected way at all.
  assert.equal(asHighlight({ ...HIGHLIGHT_FACT, fact: "Apple shipped the iMac." }), null);
});

test("the front door takes at most one fact per month", () => {
  const facts: Fact[] = [];
  for (let month = 1; month <= 12; month++) {
    for (let copy = 0; copy < 4; copy++) {
      facts.push({
        id: `t${month}-${copy}`,
        month,
        day: copy + 1,
        fact: `On ${MONTH_WORDS[month - 1]} ${copy + 1}, 19${50 + copy}, something worth reading happened and it was written down in a sentence of a reasonable length.`,
        category: "event",
        sourceUrl: "https://en.wikipedia.org/wiki/Test",
      });
    }
  }
  const picked = pickHighlights(facts, 6, 12345);
  assert.equal(picked.length, 6);
  assert.equal(new Set(picked.map((row) => row.month)).size, 6, "a month appeared twice");
  // Calendar order, so the strip reads as a walk through the year.
  for (let index = 1; index < picked.length; index++) {
    assert.ok(picked[index]!.month > picked[index - 1]!.month);
  }
});

test("the same seed deals the same hand, and a different one does not", () => {
  const facts: Fact[] = [];
  for (let month = 1; month <= 12; month++) {
    for (let copy = 0; copy < 6; copy++) {
      facts.push({
        id: `t${month}-${copy}`,
        month,
        day: copy + 1,
        fact: `On ${MONTH_WORDS[month - 1]} ${copy + 1}, 19${40 + copy}, number ${copy} of the things that happened that day happened, and here is the rest of the sentence.`,
        category: "event",
        sourceUrl: "https://en.wikipedia.org/wiki/Test",
      });
    }
  }
  const one = pickHighlights(facts, 6, 777).map((row) => row.text).join("|");
  const same = pickHighlights(facts, 6, 777).map((row) => row.text).join("|");
  const other = pickHighlights(facts, 6, 778).map((row) => row.text).join("|");
  assert.equal(one, same, "a build is not reproducible");
  assert.notEqual(one, other, "the seed does nothing");
});

test("no facts is a missing section rather than a heading over nothing", () => {
  const html = renderHome(2026, []);
  assert.ok(!html.includes("Every date has a day like this in it"));
  // And the page still works.
  assert.equal(new Set(html.match(/href="\/[a-z]+-\d+\/"/g) ?? []).size, 366);
});

test("the front door still runs nothing", () => {
  // The site sends default-src 'none'. Every piece of behaviour on this page
  // is a link, a fragment or a stylesheet rule, and it has to stay that way.
  const html = renderHome(2026, pickHighlights([HIGHLIGHT_FACT], 6, 1));
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("onclick"));
});

const MONTH_WORDS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];


test("the drawer holds everything the feed did not, and the page still carries it all", () => {
  // The reason this matters is not tidiness. The whole list is what answers a
  // search for any one of these events, so a page that showed six and dropped
  // thirty seven would be a page that stopped answering thirty seven queries.
  // Closed is a display state; absent is a different page.
  const many = Array.from({ length: 20 }, (unused, index) => ({
    id: `t${index}`,
    month: 9,
    day: 4,
    year: 1500 + index * 25,
    sourceUrl: "https://en.wikipedia.org/wiki/September_4",
    description: `the thing that happened in ${1500 + index * 25}`,
  }));
  const html = renderDayPage(page, [], [], many);
  assert.match(html, /<details class="more">/);
  assert.ok(html.includes("14 more"), "the drawer says how much is behind it");
  for (const event of many) {
    assert.ok(html.includes(event.description), `${event.year} is not on the page at all`);
  }
});

test("a date page can be moved off in both directions without reaching the foot", () => {
  const html = renderDayPage(page);
  const stateAt = html.indexOf('<p class="state">');
  assert.ok(stateAt > 0, "the state line has to exist for this slice to mean anything");
  const bar = html.slice(html.indexOf('<div class="daybar">'), stateAt);
  assert.ok(bar.includes('href="/september-3/"'), "the day before is not reachable from the bar");
  assert.ok(bar.includes('href="/september-5/"'), "the day after is not reachable from the bar");
  // The pair at the foot stays, because that is how a crawler walks all 366.
  assert.match(html, /<nav class="pager cards">/);
});

test("a month has its own colour and the brand pink is not it", () => {
  const september = renderDayPage(page);
  // Not pinned to the whole opening tag. That wrapper also carries the class
  // naming its own date, which is how the per-request stylesheet knows whether
  // this page is one of the three taking answers today.
  assert.match(september, /<div class="day [^"]*" style="--day:hsl\(/);
  assert.match(september, /class="day on-september-4"/);
  const march = renderDayPage({ month: 3, day: 12, people: [] });
  const hueOf = (html: string) => /--day:hsl\((\d+)/.exec(html)?.[1];
  assert.notEqual(hueOf(september), hueOf(march), "every page would wear the same second colour");
});


test("the 366 date pages say in their heads that they are one ordered run", () => {
  const html = renderDayPage(page);
  assert.match(html, /<link rel="prev" href="https:\/\/birthed\.app\/september-3\/">/);
  assert.match(html, /<link rel="next" href="https:\/\/birthed\.app\/september-5\/">/);
});

test("the year wraps at both ends rather than running off it", () => {
  const newYear = renderDayPage({ month: 1, day: 1, people: [] });
  assert.match(newYear, /<link rel="prev" href="https:\/\/birthed\.app\/december-31\/">/);
  const lastDay = renderDayPage({ month: 12, day: 31, people: [] });
  assert.match(lastDay, /<link rel="next" href="https:\/\/birthed\.app\/january-1\/">/);
});

test("a decade jump exists for every decade the date actually charted in", () => {
  const songs = [1959, 1962, 1971, 1988, 1994, 2003, 2011, 2024].map((year) => ({
    year, chartDate: `${year}-09-06`, song: `song ${year}`, artist: "somebody",
  }));
  const html = renderDayPage(page, songs);
  for (const decade of [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020]) {
    assert.ok(html.includes(`${decade}s</a>`), `no jump for the ${decade}s`);
  }
  // Each one points at the earliest year it has, and that year is a real
  // anchor further down the page rather than a guess at one.
  assert.ok(html.includes('href="#1959"'));
  assert.ok(html.includes('href="#1962"'), "the 1960s jump goes to 1962, the only one it has");
  assert.match(html, /<li id="1962"/);
});

test("a date with only a couple of decades gets no bar at all", () => {
  // February 29 is the case this exists for: seventeen chart years spread thin.
  const songs = [2020, 2024].map((year) => ({
    year, chartDate: `${year}-02-29`, song: `song ${year}`, artist: "somebody",
  }));
  assert.ok(!renderDayPage(page, songs).includes('class="decades"'));
});

// ---------------------------------------------------------------------------
// Saying which kind of day the date actually is.
//
// The column has existed since the cultural table did and the page never
// selected it, so a row whose date is "the week this broke out, nobody knows
// when it was posted" printed a bare year and claimed the same confidence as
// a row read straight off a timestamp. docs/internet-culture.md rule two
// calls that the interesting part.

const cultural = (over = {}) => ({
  id: "7",
  month: 9, day: 4, year: 2015,
  title: "A meme starts",
  context: "Somebody posted a picture and everybody copied it.",
  sourceUrl: "https://knowyourmeme.com/memes/example",
  category: "meme",
  origin: "imported",
  ...over,
});

test("a row dated to when it spread says so, and explains itself once", () => {
  const html = renderDayPage(page, [], [], [], [cultural({ dateKind: "went_viral" })]);
  assert.ok(html.includes("when it spread, not when it was posted"),
    "the honest label is the differentiator and it has to reach the page");
  assert.ok(html.includes("the original posting is gone or was never recorded"),
    "a label a reader cannot interpret is decoration, so the page defines it once");
});

test("an exact posting date and a shutdown are labelled too", () => {
  const posted = renderDayPage(page, [], [], [], [cultural({ dateKind: "posted" })]);
  assert.ok(posted.includes("the exact day it was posted"));
  const ended = renderDayPage(page, [], [], [], [cultural({ dateKind: "ended" })]);
  assert.ok(ended.includes("the day it ended"));
});

test("an ordinary dated event carries no label at all", () => {
  // "happened" is the case a reader already assumes. Printing it on most of
  // the page would make the labels wallpaper and cost the other two their
  // weight, which is the whole reason they are worth printing.
  const html = renderDayPage(page, [], [], [], [cultural({ dateKind: "happened" })]);
  assert.ok(!html.includes('class="datenote"'), "the ordinary case is not annotated");
  assert.ok(!html.includes("the original posting is gone"), "and it does not drag in the footnote");
});

test("a row from before the column existed is not annotated either", () => {
  const html = renderDayPage(page, [], [], [], [cultural({})]);
  assert.ok(!html.includes('class="datenote"'));
});

// ---------------------------------------------------------------------------
// The words are on the page.
//
// These exist because of a real outage rather than out of thoroughness. A new
// feature introduced a class called "said" and set display:none on it, and
// ".said" has been the event sentence, the year dial line, the fact text and
// the song title since long before that. Every event on birthed.app went blank
// and the page still looked plausible: cards, years, source lines, no words.
//
// docs/handoff.md already recorded two collisions, .here and .when, and both
// were caught by a test asserting the absence of something. This one reached
// production because nothing asserted the presence of anything.

test("the event sentence is actually rendered, not just its card", () => {
  const events = [
    { id: "t", month: 9, day: 4, year: 1888, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "George Eastman registers the trademark Kodak." },
  ];
  const html = renderDayPage(page, [], facts, events);
  assert.ok(html.includes("George Eastman registers the trademark Kodak."),
    "the sentence must be in the markup");
  assert.equal(html.includes(".said {\n  display: none"), false,
    "and nothing may blanket-hide the class it is rendered in");
});

test("no class that carries a sentence is hidden by default", () => {
  const html = renderDayPage(page, [], facts, [
    { id: "t", month: 9, day: 4, year: 1888, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "George Eastman registers the trademark Kodak." },
  ], [cultural({})]);
  const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));

  // Named rather than derived. A general rule tried first and produced a false
  // alarm on .pick, which IS hidden and IS revealed, by a generated per-year
  // selector the pattern could not see. A test that cries wolf gets deleted by
  // the next person, so this one names the classes that carry words instead.
  for (const name of ["said", "ctx", "n", "w", "x", "tbig", "tsub", "mtx"]) {
    const hidden = new RegExp(`\\.${name}\\s*\\{[^}]*display:\\s*none`);
    assert.equal(hidden.test(style), false,
      `.${name} carries text on this page and something hides it`);
  }
});

test("every kind of row can be answered, not just the curated ones", () => {
  const events = [
    { id: "e1", month: 9, day: 4, year: 1888, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "George Eastman registers the trademark Kodak." },
  ];
  const html = renderDayPage(page, [], facts, events, [cultural({})]);
  for (const kind of ["historical_event", "birth_fact", "cultural_event"]) {
    assert.ok(html.includes(`value="${kind}"`), `${kind} rows must be answerable`);
  }
});

test("a row is answered by its identifier, never by its position", () => {
  // The merged list mixes three sources, so an index is not an identity: the
  // same row sits somewhere else the day a new fact lands, and every answer
  // anybody gave would silently move to a different sentence.
  const events = [
    { id: "e99", month: 9, day: 4, year: 1888, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "George Eastman registers the trademark Kodak." },
  ];
  const html = renderDayPage(page, [], [], events);
  assert.ok(html.includes('name="i" value="e99"'));
  assert.ok(html.includes('id="r-historical_event-e99"'), "and the redirect has somewhere to land");
});

test("the form posts the page's own date, not one parsed back out of the heading", () => {
  const html = renderDayPage(page, [], facts);
  assert.ok(html.includes('name="m" value="9"'));
  assert.ok(html.includes('name="d" value="4"'));
});

test("a row offers three answers and the presence claim is not one of them", () => {
  // Asserting the three are PRESENT, not just that the fourth is absent.
  // Both earlier class name collisions on this site were caught by tests that
  // asserted an absence, and the one that reached production was caught by
  // nothing, because nothing checked that the sentences were still there.
  const html = renderDayPage(page, [], [
    { id: "t", month: 9, day: 4, fact: "Something sourced happened.", category: "event",
      sourceUrl: "https://example.org/september-4" },
  ]);

  assert.ok(html.includes('value="remember">I remember it</button>'));
  assert.ok(html.includes('value="heard">Heard of it</button>'));
  assert.ok(html.includes('value="never">Never heard of it</button>'));

  // "I was there" asks about presence and this measures transmission, which is
  // a different question. Nobody was there for a diplomatic announcement and
  // nobody was there for a song being number one, so it was answerable on a
  // small minority of rows and was noise near the top of the scale rather than
  // a rung of it. The iOS app dropped it first and this matches it.
  assert.equal(html.includes("I was there"), false);
  assert.equal(html.includes('value="there"'), false);

  // Still no direction, which is the rule that has never moved.
  assert.equal(html.includes('value="downvote"'), false);
});

test("every row carries an empty result the server can write into", () => {
  // A presence assertion, not an absence one. The paragraph is baked in empty
  // and the server fills exactly one of them on the request after an answer,
  // so if it ever stops being rendered the reveal goes quiet with nothing on
  // screen and no test failing.
  const html = renderDayPage(page, [], [
    { id: "t", month: 9, day: 4, fact: "Something sourced happened.", category: "event",
      sourceUrl: "https://example.org/september-4" },
  ]);
  assert.ok(html.includes('<p class="rres" id="rr-birth_fact-t"></p>'));
  assert.ok(html.includes(".rres:empty { display: none; }"), "and it draws as nothing until filled");
});

test("the site asks for a birth year once, and says what it does with it", () => {
  const html = renderDayPage(page, [], [
    { id: "t", month: 9, day: 4, fact: "Something sourced happened.", category: "event",
      sourceUrl: "https://example.org/september-4" },
  ]);
  assert.ok(html.includes('action="/year"'));
  // One submit per year rather than a select and a Save. A select needs a
  // second tap, and this site runs no script so an increment button would be a
  // round trip per year.
  // Decade, then year. Two taps, nothing to scroll, and no script: ten hidden
  // radios hold the state and the checked one reveals its own row of years.
  assert.ok(html.includes('name="y" value="1994"'), "every year is its own submit");
  assert.equal(html.includes("<select"), false, "the default select is gone");
  assert.equal(html.includes("yearstrip"), false, "and so is the sideways scroller");
  assert.ok(html.includes('<label for="dec1990">1990s</label>'));
  assert.ok(html.includes('id="dec1990"'));
  // The reveal is CSS on a sibling, which is what keeps this scriptless.
  assert.match(html, /#dec1990:checked ~ \.yearyears \.yg1990 \{ display: flex; \}/);
  // Every decade from the 1930s to this one, so nobody is missing.
  for (const decade of [1930, 1950, 1970, 2000, 2020]) {
    assert.ok(html.includes(`<label for="dec${decade}">${decade}s</label>`), `${decade}s missing`);
  }
  assert.ok(html.includes("never shown to anybody"));
  // Once on the page, not once per row. A picker repeated 150 times is what
  // the cookie exists to avoid.
  assert.equal((html.match(/action="\/year"/g) ?? []).length, 1);
});

test("the year control is hidden until a date is open, like the buttons", () => {
  const html = renderDayPage(page);
  // Matched loosely on purpose: the rule gained spacing and this test is
  // about the control being hidden until a date is open, not about its margins.
  assert.match(html, /\.yearask \{[^}]*display: none/);
});

test("a failure on our side does not tell the reader the date is sealed", () => {
  // "Sealed" is a claim about the date. A missing environment variable is a
  // claim about us, and dressing one as the other is what hid a dead feature
  // for three days.
  const html = renderDayPage(page);
  assert.ok(html.includes('id="failed"'));
  assert.ok(html.includes("it was this end rather than yours"));
  assert.ok(html.includes('id="sealed"'), "and the real sealed sentence is still there");
  assert.ok(html.includes('id="kept"'));
});

test("an undo is offered beside a result and never on a page being read", () => {
  const bare = renderDayPage(page, [], [
    { id: "t", month: 9, day: 4, fact: "Something sourced happened.", category: "event",
      sourceUrl: "https://example.org/september-4" },
  ]);
  // A baked page has no undo anywhere in it. The server adds one next to the
  // result, on the one request that follows an answer.
  assert.equal(bare.includes('action="/forget"'), false);

  const beside = undoForm("historical_event", "7214", 9, 4);
  assert.ok(beside.includes('action="/forget"'));
  assert.ok(beside.includes('value="historical_event"'));
  assert.ok(beside.includes('value="7214"'));
  assert.ok(beside.includes("Undo"));
});

test("the page can say taken back, and can say too late, without saying sealed", () => {
  const html = renderDayPage(page);
  assert.ok(html.includes('id="undone"'));
  assert.ok(html.includes('id="toolate"'));
  assert.ok(html.includes("can be taken back for half a minute"));
  // Four different outcomes, four different sentences. Collapsing any two of
  // them is what let a duplicate answer report itself as a sealed date.
  for (const id of ["kept", "already", "spent", "sealed", "failed", "undone", "toolate"]) {
    assert.ok(html.includes(`id="${id}"`), `${id} has nothing to say`);
  }
});

test("answering the same row twice is not reported as a sealed date", () => {
  // Three evenings went on this one message. remember() returns false for four
  // different reasons and the page called all of them "sealed", which is a
  // claim about the date and is wrong for three of the four. The commonest by
  // far is a row you already answered, on a page where nothing says which
  // ones you have done.
  const html = renderDayPage(page);
  assert.ok(html.includes('id="already"'));
  assert.ok(html.includes("You have already answered that one"));
  assert.ok(html.includes("Nothing is sealed"), "and it says so in as many words");
});

test("the first screen says open or sealed in words, and sealed is what a page says on its own", () => {
  // The Yesterday, Today and Tomorrow chips this replaces were coloured by
  // href rather than by date, so a sealed page lit "Today" in blue and said
  // answering was open under it. docs/first-impression-proposal.md.
  const html = renderDayPage(page);
  assert.equal(html.includes('class="trip"'), false, "the chips are gone");
  assert.equal(html.includes('class="kicker">Born on'), false, "and so is the database kicker");
  // Four sentences baked, one shown. The sealed one is the default, so a page
  // whose today.css never arrived says the safe thing.
  for (const name of ["senpast", "sennow", "sennext", "senshut"]) {
    assert.ok(html.includes(`class="sen ${name}"`), `${name} is baked into every page`);
  }
  assert.ok(html.includes("Closes tonight"));
  assert.ok(html.includes("Closes tomorrow night"));
  assert.ok(html.includes("Two more days"));
  assert.ok(html.includes("<b>Sealed.</b> Opens again on September 3, for three days."),
    "a sealed page names the day it opens, which is the day before it");
  const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  assert.match(style, /\.sen \{ display: none; \}/);
  assert.match(style, /\.senshut \{ display: inline; \}/);
  // The mechanic is under the date in two versions, because "say which ones
  // you remember" is a lie on the 363 pages that refuse answers.
  assert.ok(html.includes('class="sen senopen">Everything below happened on this date. Say which ones you <b>remember</b>.'));
  assert.ok(html.includes('class="sen senshut">Everything below happened on this date. For three days a year'));
  // The fuse and the ask are present and off; today.css turns them on.
  assert.ok(html.includes('<div class="fuse"'));
  assert.match(style, /\.fuse \{ display: none;/);
  assert.match(style, /\.ask \{\s*display: none;/);
  // No "Open today" flag beside a section any more: the state line says it for
  // the whole page.
  assert.equal(html.includes("Open today"), false);
});

test("the first ask is one real row with the three answers, and the feed carries that row without them", () => {
  const events = [
    { id: "old", month: 9, day: 4, year: 476, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "Romulus Augustulus is deposed." },
    { id: "grim", month: 9, day: 4, year: 2001, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "A bombing killed forty people." },
    { id: "near", month: 9, day: 4, year: 1999, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "The first Wii console went on sale." },
    { id: "far", month: 9, day: 4, year: 1966, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "Star Trek first aired on NBC." },
  ];
  const html = renderDayPage(page, [], [], events);
  const first = html.indexOf('<section class="ask ');
  const ask = html.slice(first, html.indexOf("</section>", first));
  assert.ok(ask.includes("The first Wii console went on sale."), "the best candidate is dealt first");
  const cards = [...html.matchAll(/<section class="ask [\s\S]*?<\/section>/g)].map((m) => m[0]);
  assert.ok(cards.length > 0);
  assert.ok(cards.every((card) => !card.includes("bombing")),
    "a heavy row is never a candidate, whatever its year");
  assert.ok(ask.includes('id="r-historical_event-near"'), "the ask carries the row's anchor so the redirect lands on it");
  assert.ok(ask.includes('id="rr-historical_event-near"'), "and its result paragraph, so the server writes here");
  for (const answer of ["remember", "heard", "never"]) assert.ok(ask.includes(`value="${answer}"`));
  assert.ok(ask.includes("Do you remember this one?"));
  // Once in the page. The feed's copy has no anchor and no form.
  assert.equal(html.split('id="r-historical_event-near"').length, 2, "one anchor for the row");
  assert.equal(html.split('id="rr-historical_event-near"').length, 2, "one result paragraph for the row");
  assert.match(html, /<li class="[^"]*asked"/, "the feed's copy is marked for today.css to put away");
});

// A single fixed card is one chance to hook a stranger and the same card
// forever for anybody who comes back. Several are baked and today.css reveals
// one, so the page is dealt rather than fixed.
test("several ask cards are baked, and every slot lands on exactly one of them", () => {
  const events = [
    { id: "a", month: 9, day: 4, year: 1999, sourceUrl: "https://example.com/a", description: "A thing in 1999." },
    { id: "b", month: 9, day: 4, year: 1986, sourceUrl: "https://example.com/b", description: "A thing in 1986." },
    { id: "c", month: 9, day: 4, year: 2008, sourceUrl: "https://example.com/c", description: "A thing in 2008." },
  ];
  const html = renderDayPage(page, [], [], events);
  const cards = [...html.matchAll(/<section class="ask ([^"]*)"/g)].map((m) => m[1] ?? "");
  assert.equal(cards.length, 3, "one card per candidate");

  // Every slot the stylesheet can send reveals exactly one card on this page,
  // whatever this date's own count of candidates happens to be. A slot that
  // revealed none would be a page with no ask on it and nothing to say why.
  for (let slot = 0; slot < ASK_SLOTS; slot += 1) {
    const hits = cards.filter((klasses) => klasses.split(" ").includes(`asks${slot}`));
    assert.equal(hits.length, 1, `slot ${slot} reveals exactly one card`);
  }

  // Every candidate is put away in the feed, not only the one showing, so a
  // row's identifiers are never in two places at once.
  for (const id of ["a", "b", "c"]) {
    assert.equal(html.split(`id="r-historical_event-${id}"`).length, 2, `one anchor for ${id}`);
  }
});

// Two candidates from the same decade are one candidate as far as a reader is
// concerned, because the question the card asks is about a time in their life.
// Real sentences off the live September 8 page, pasted rather than invented,
// because this is the bug they found. Fourteen rows on that date are from 1958
// on and exactly one became a candidate, so that one card carried all five
// rotation slots and the page never changed however many times anybody
// reloaded it. Thirteen of them died on a 110 character limit written for the
// share image, not on the word screens: Star Trek's first broadcast is 139
// characters and McGwire's 62nd home run is 168. The survivor, at 94, was a
// routine space station resupply flight. The shortest sentence on a date is
// not the most memorable thing that happened on it, and a limit that admits
// only the shortest admits only the dullest.
// Every one of these is a real row from the live September 11 page. The screen
// matched "bomb" and not "bombs", and "attack" and not "attacks", so on the
// anniversary of the attacks one reload in five dealt "Russia tests the
// largest conventional weapon ever, the Father of All Bombs" under the words
// "Do you remember this one?". Singular forms only was a hole straight through
// a screen whose entire job is to catch this, and the plural of a word for a
// killing is still a word for a killing.
// 326 of 357 published culture rows were an imported title and nothing else,
// which renders as a game's name followed by "is released". The writing is the
// bar, because the writing is the thing a reader came for.
test("a culture row with nothing written about it is not on the page", () => {
  const page = { month: 9, day: 11, people: [] };
  const withSentence = {
    id: "1", month: 9, day: 11, year: 2015, title: "Super Mario Maker is released",
    context: "Nintendo shipped the level editor and people spent a decade making levels nobody could finish.",
    sourceUrl: "https://example.com/1", category: "gaming", origin: "imported", dateKind: "happened",
  };
  const bare = {
    id: "2", month: 9, day: 11, year: 2009, title: "Mini Ninjas is released",
    context: null, sourceUrl: "https://example.com/2", category: "gaming",
    origin: "imported", dateKind: "happened",
  };
  const html = renderDayPage(page, [], [], [], [withSentence, bare]);
  assert.ok(html.includes("Super Mario Maker"), "a row somebody wrote about stays");
  assert.equal(html.includes("Mini Ninjas"), false, "a bare title does not");
});

// A reader answers ten rows, the page looks identical afterwards, and there is
// no trace of them when they come back. These pin the two halves of the fix:
// the marker is baked into every answerable row and hidden, and the style the
// server writes says nothing about anybody else.
// The site had no notion of importance at all: fifty four rows a date, every
// one as important as every other, which is what a database looks like. On
// September 8 that meant a space station resupply flight led while New
// Amsterdam becoming New York sat in a drawer. Wikipedia's editors have picked
// the top of each day for years and the signal was sitting unused.
// A count is not a rating, and the difference is the whole argument. A model
// calling a row an eight out of ten is an opinion wearing a number. "Eleven of
// the fourteen people who answered this remembered it" is a fact about a room
// that says nothing about whether the event was good, which is why it is safe
// beside things a rating would not be.
test("a sealed row counts its own people, and only once there are enough of them", () => {
  const events = [
    { id: "big", month: 9, day: 4, year: 1999, sourceUrl: "https://e.com/1", description: "A thing many people saw." },
    { id: "quiet", month: 9, day: 4, year: 1998, sourceUrl: "https://e.com/2", description: "A thing hardly anybody answered." },
  ];
  const memory = new Map([
    ["historical_event:big", { there: 2, remembers: 9, heard: 2, never: 1 }],
    ["historical_event:quiet", { there: 0, remembers: 1, heard: 1, never: 0 }],
  ]);
  const html = renderDayPage({ month: 9, day: 4, people: [] }, [], [], events, [], memory);

  assert.ok(html.includes("eleven of the fourteen people who answered this remembered it"),
    "the counted row says what its own people said, in words");
  // Two answers is not a finding, and printing it tells a stranger the site is
  // empty in a way that saying nothing does not.
  assert.equal(html.includes("one of the two people"), false, "below the floor a row says nothing");

  // Nothing anywhere is a rating or a direction. Checked as shapes rather than
  // as words, because the card's own copy says "no score" and a bare search for
  // that string fails on the page promising the opposite of it.
  // A bare slash matched "aspect-ratio: 4 / 5" in the stylesheet, which is the
  // kind of assertion that fails for a reason nobody can read. Rating language
  // only.
  // Twice now a check has failed on the page promising the opposite: the card
  // says "no score" and the stylesheet comment says "no downvote". So this
  // looks for a rating being given, not for the words being mentioned.
  for (const shape of [/\b\d+\s*out of\s*(ten|10|five|5)\b/i, /\brate[ds]?\s+\d/i, /\bscore of\s+\d/i]) {
    assert.equal(shape.test(html), false, shape + " never appears");
  }
  assert.ok(html.includes("no score"), "and the card still promises there is not one");
});

test("the day's biggest lead the cards, and the rest still read newest first", () => {
  const events = [
    { id: "ny", month: 9, day: 8, year: 1664, sourceUrl: "https://e.com/1", description: "New Amsterdam was renamed New York." },
    { id: "dull", month: 9, day: 8, year: 2000, sourceUrl: "https://e.com/2", description: "A routine resupply flight went up." },
    { id: "mid", month: 9, day: 8, year: 1975, sourceUrl: "https://e.com/3", description: "Something in 1975." },
    { id: "old", month: 9, day: 8, year: 1400, sourceUrl: "https://e.com/4", description: "Something in 1400." },
  ];
  const big = new Map([["9-8", new Map([[1664, "New Amsterdam was renamed New York in honour of the Duke of York"]])]]);
  const html = renderDayPage({ month: 9, day: 8, people: [] }, [], [], events, [], null, new Map(), big);

  const feed = html.slice(html.indexOf('<ul class="feed">'));
  assert.ok(feed.indexOf("New York") < feed.indexOf("resupply"),
    "the selected row leads even though it is the oldest thing here");

  // Nothing about the selection is printed. It decides order and says nothing.
  assert.equal(html.includes("Wikipedia's editors"), false);
  assert.equal(html.includes("selected"), false);
});

test("every answerable row carries a hidden mark for its own reader", () => {
  const html = renderDayPage({ month: 9, day: 4, people: [] }, [], [], [
    { id: "a", month: 9, day: 4, year: 1999, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "A thing happened in 1999." },
  ]);
  assert.ok(html.includes('id="r-historical_event-a"'), "the row has the anchor the mark is keyed to");
  assert.ok(html.includes('<p class="mine"></p>'), "and an empty marker beside its form");
  const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  assert.match(style, /\.mine \{ display: none;/, "hidden until this reader's own answers say otherwise");
  // Empty on purpose. The words arrive with the style block rather than being
  // baked into a hundred and fifty rows almost nobody will ever see.
  assert.equal(html.includes("You remembered this"), false);
});

test("a plural does not walk a heavy row onto the card", () => {
  const rows = [
    { kind: "historical_event" as const, id: "bomb", year: 2007, text: "Russia tests the largest conventional weapon ever, the Father of All Bombs.", sourceUrl: "https://e.com/1", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "att", year: 2001, text: "Nineteen members of al-Qaeda execute the September 11 attacks, a series of coordinated terrorist attacks.", sourceUrl: "https://e.com/2", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "fire", year: 2012, text: "A total of 315 people are killed in two garment factory fires in Pakistan.", sourceUrl: "https://e.com/3", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "ok", year: 1997, text: "NASA's Mars Global Surveyor reaches Mars.", sourceUrl: "https://e.com/4", category: null, dateKind: null },
  ];
  const texts = askCandidates(rows).map((r) => r.text);
  assert.ok(texts.some((t) => t.includes("Mars Global Surveyor")), "the one row that may lead does");
  assert.equal(texts.length, 1, "and it is the only candidate on the date");
  for (const word of ["Bombs", "attacks", "killed"]) {
    assert.ok(!texts.some((t) => t.includes(word)), word + " never leads a birthday page");
  }
});

test("the real September 8 rows fill the rotation instead of starving it", () => {
  const rows = [
    { kind: "historical_event" as const, id: "s0", year: 1966, text: "UNESCO proclaimed International Literacy Day to highlight the importance of literacy for people and communities globally.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s1", year: 2016, text: "NASA launched the OSIRIS-REx spacecraft on a mission to travel to asteroid Bennu and collect sample material to return to Earth.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s2", year: 1960, text: "In Huntsville, Alabama, US President Dwight D. Eisenhower formally dedicates the Marshall Space Flight Center (NASA had already activated the facility on July 1).", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s3", year: 1966, text: "The science fiction television series Star Trek made its broadcast television debut in the United States on NBC with the episode The Man Trap.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s4", year: 1971, text: "In Washington, D.C., the John F. Kennedy Center for the Performing Arts is inaugurated, with the opening feature being the premiere of Leonard Bernstein's Mass.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s5", year: 1974, text: "Watergate scandal: US President Gerald Ford signs the pardon of Richard Nixon for any crimes Nixon may have committed while in office.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s6", year: 1986, text: "Nicholas Daniloff, a correspondent for U.S. News & World Report, is indicted on charges of espionage by the Soviet Union.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s7", year: 1998, text: "Mark McGwire of the St. Louis Cardinals hit his 62nd home run of the season, breaking the Major League Baseball single-season home run record set by Roger Maris in 1961.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s8", year: 2000, text: "NASA launches Space Shuttle Atlantis on STS-106 to resupply the International Space Station.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "s9", year: 2017, text: "Syrian civil war: The Syrian Democratic Forces (SDF) announce the beginning of the Deir ez-Zor campaign, with the stated aim of eliminating the Islamic State (IS) from all areas north and east of the Euphrates.", sourceUrl: "https://en.wikipedia.org/wiki/September_8", category: null, dateKind: null },
  ];
  const picked = askCandidates(rows);
  assert.equal(picked.length, ASK_SLOTS, "every slot has its own card");

  const texts = picked.map((row) => row.text);
  assert.ok(texts.some((t) => t.includes("McGwire")), "the row the proposal assumed would lead is one now");

  // And here is the limit of doing this with arithmetic, written down rather
  // than tuned away. The best row on this date, by any reader's judgement, is
  // Star Trek going out for the first time in 1966. It is not here. It is
  // outside the 1985 to 2015 window, so it scores below five in-window rows,
  // and inside its own decade the scorer prefers International Literacy Day
  // anyway because that sentence is eighteen characters shorter.
  //
  // Nothing measurable about those two sentences says which one people
  // remember. No constant added here fixes it, and one tuned until Star Trek
  // won would be fitted to this one date. That is the argument for a person
  // writing the lead line, not for another number.
  assert.ok(!texts.some((t) => t.includes("Star Trek")), "recorded, not endorsed");

  // The word screens are untouched. A civil war is still never a candidate,
  // whatever room the card has.
  assert.ok(!texts.some((t) => t.includes("Syrian")), "a war is not a card, at any length");

  // And no two from the same ten years while there is anything else left.
  const decades = picked.map((row) => Math.floor((row.year ?? 0) / 10));
  assert.equal(new Set(decades).size, decades.length, "one per decade");
});

// The judgement the scorer cannot make, kept where a person can put it. The
// row keeps its own sentence and its own source; this is the card's wording.
test("a written lead line leads its date, and the record stays under it", () => {
  const events = [
    { id: "trek", month: 9, day: 4, year: 1966, sourceUrl: "https://en.wikipedia.org/wiki/September_8",
      description: "The science fiction television series Star Trek made its broadcast television debut in the United States on NBC with the episode The Man Trap." },
    { id: "dull", month: 9, day: 4, year: 2000, sourceUrl: "https://en.wikipedia.org/wiki/September_8",
      description: "NASA launches Space Shuttle Atlantis on STS-106 to resupply the International Space Station." },
  ];
  const lines = new Map([["historical_event:trek", "Star Trek went out for the first time."]]);
  const html = renderDayPage(page, [], [], events, [], null, lines);

  // Without a line, Star Trek is 139 characters and out of the window, and the
  // resupply flight leads. With one, it leads, and by more than any
  // combination of the rest could overturn.
  const first = html.indexOf('<section class="ask ');
  const card = html.slice(first, html.indexOf("</section>", first));
  assert.ok(card.includes('<p class="asksaid">Star Trek went out for the first time.</p>'),
    "the card asks the question in the words a person wrote");
  assert.ok(card.includes("made its broadcast television debut"),
    "and prints the row's own sentence underneath, so nothing on the card is unbacked");
  // No per row link here, because a Wikipedia event carries none by design and
  // is credited once at the foot. That is exactly why printing its sentence on
  // the card matters: it is the only thing on the card a reader can check the
  // written line against.
  assert.ok(card.includes('id="r-historical_event-trek"'), "and it is still that row being answered");

  // The feed is untouched. A lead line is the card's wording, not a rewrite.
  assert.equal(html.includes("Star Trek went out for the first time."),
    true);
  assert.equal(html.split("Star Trek went out for the first time.").length, 2,
    "the written line is on the page once, on the card");
});

// A written line is eight words and could be gentle about anything. What the
// card is really about is the row underneath it, so the word screens read that
// and not the line.
test("a lead line cannot walk a heavy row onto the card", () => {
  const events = [
    { id: "grim", month: 9, day: 4, year: 1999, sourceUrl: "https://en.wikipedia.org/wiki/September_8",
      description: "A bombing at a school killed forty people." },
  ];
  const lines = new Map([["historical_event:grim", "A day people still talk about."]]);
  const html = renderDayPage(page, [], [], events, [], null, lines);
  assert.equal(html.includes('<section class="ask '), false, "no card, however the line is worded");
});

test("the candidates are spread across decades before the list is filled up", () => {
  const rows = [
    { kind: "historical_event" as const, id: "1", year: 1996, text: "One.", sourceUrl: "https://e.com/1", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "2", year: 1997, text: "Two.", sourceUrl: "https://e.com/2", category: null, dateKind: null },
    { kind: "historical_event" as const, id: "3", year: 2004, text: "Three.", sourceUrl: "https://e.com/3", category: null, dateKind: null },
  ];
  const picked = askCandidates(rows, 2);
  assert.equal(picked.length, 2);
  const decades = picked.map((r) => Math.floor((r.year ?? 0) / 10));
  assert.notEqual(decades[0], decades[1],
    "one from each decade before a second from either");
});

test("the first ask stays away from years with no record beside them", () => {
  const events = [
    { id: "a", month: 9, day: 4, year: 1888, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "George Eastman registers the trademark Kodak." },
  ];
  const html = renderDayPage(page, [], [], events);
  assert.equal(html.includes('<section class="ask '), false, "nothing from 1958 on, so no ask");
  assert.ok(html.includes('id="r-historical_event-a"'), "and the row keeps its own anchor in the feed");
});

test("the about page explains what the site does before what is on a page", () => {
  const html = renderHome(2026, []);
  // The thesis, in the headline rather than four screens down.
  assert.ok(html.includes("Birthed</span> records what stuck"));
  // The underline needs its own colour named. The headline is painted with a
  // gradient and its text colour is transparent, so an underline left on
  // currentColor is drawn in transparent and nothing appears under the word.
  assert.match(html, /\.brandword \{[^}]*text-decoration-color: #EF5680/);
  assert.ok(html.includes("opens for three days a year"));
  // The four beats, in order, because the thing this site does is a sequence
  // and a reader who does not know it needs the order more than the detail.
  for (const beat of [
    "A date opens for three days",
    "Everybody answers at once",
    "Then it seals",
    "Next year it opens on top",
  ]) {
    assert.ok(html.includes(beat), `the page lost the beat: ${beat}`);
  }
  // The rule that everything else rests on, said to a stranger in one clause.
  assert.ok(html.includes("no way to say a thing did not matter"));
});

test("the about page no longer floats an app icon above the headline", () => {
  const html = renderHome(2026, []);
  assert.equal(html.includes("heroart"), false);
  assert.equal(html.includes("icon-192.png"), false, "the hero image is gone");
  // And the animation that only it used went with it, rather than being left
  // in the stylesheet for something that no longer exists.
  assert.equal(html.includes("@keyframes bob"), false);
});

test("the four beats stack, rather than inheriting the flex row every list gets", () => {
  // There is a bare `li { display: flex }` in the stylesheet, written for the
  // lists where a year sits beside a name. It applies to every list item on
  // the site, so a card that does not override it turns its number, heading
  // and paragraph into three columns and wraps the heading one word to a line.
  // Nothing fails and nothing logs. It just looks like nobody designed it.
  const html = renderHome(2026, []);
  assert.match(html, /\.beats li \{[^}]*display: block/);
});

test("the link preview says what the site does, not what is on a page", () => {
  const html = renderHome(2026, []);
  // A description that disagreed with the page would be the one thing most
  // people read before deciding whether to open it.
  assert.match(html, /<meta name="description" content="Every date on the calendar opens for three days a year\./);
});

test("waiting and finishing are different sentences, and neither is a lecture", () => {
  // Seven reasons, seven sentences. Being between answers is a fact about the
  // clock; being out of rows is a fact about the date; sealed is a fact about
  // the year. The whole history of this feature is one of those borrowing
  // another's explanation.
  const html = renderDayPage(page);
  assert.ok(html.includes('id="cooling"'), "a wait has its own sentence");
  assert.ok(html.includes("A minute or two between answers"));
  assert.ok(html.includes('id="spent"'));

  // The old sentence spent three clauses explaining why a limit of ten was
  // good for you, which is what made it read as an excuse. r/place never
  // explained its cooldown to anybody. A rule that has to argue for itself at
  // the moment it bites is a rule the reader has already decided about.
  assert.equal(html.includes("nobody chose anything on"), false);
  assert.equal(html.includes("That is your ten"), false);
  assert.equal(html.includes("Ten answers per date"), false, "the card promise matches the mechanic");
});

test("only a sealed date gets a front page lead", () => {
  const facts = [
    { id: "a", month: 9, day: 4, fact: "The first thing.", category: "event",
      sourceUrl: "https://example.org/a" },
    { id: "b", month: 9, day: 4, fact: "The second thing.", category: "event",
      sourceUrl: "https://example.org/b" },
  ];

  // Open. Nothing has earned the top of the page, so nothing is set large.
  //
  // Checking the class is APPLIED, not that the string is absent: the rule
  // itself lives in the stylesheet on every page, so a bare includes() here
  // passes for the wrong reason and would go on passing if the class were
  // applied to every date on the site.
  const open = renderDayPage(page, [], facts);
  assert.equal(open.includes('class="lead sealedlead"'), false);
  assert.equal(open.includes("Most remembered"), false);

  // Sealed. The row its own people remembered leads, and says why it leads,
  // because a row set four times the size of the one under it is a claim.
  const sealed = renderDayPage(page, [], facts, [], [], new Map([
    ["birth_fact:b", { there: 0, remembers: 9, heard: 0, never: 0 }],
  ]));
  assert.ok(sealed.includes('class="lead sealedlead"'));
  assert.ok(sealed.includes("Most remembered"));
  assert.ok(sealed.includes("In the order the people who were here remembered it"));
});

test("the year dial's hidden labels stay inside the strip that scrolls", () => {
  // Without this the page was wider than a phone and iOS drew it at desktop
  // size and shrank it, viewport tag and all. See the comment on the rule.
  const html = renderDayPage(page, [
    { year: 1998, chartDate: "1998-09-04", song: "One", artist: "Somebody", hasArtwork: false },
    { year: 1999, chartDate: "1999-09-04", song: "Two", artist: "Somebody", hasArtwork: false },
  ]);
  const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  assert.match(style, /\.dial \.ticks label \{[^}]*position: relative/);
});
