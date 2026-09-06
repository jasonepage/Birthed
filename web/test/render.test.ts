import test from "node:test";
import assert from "node:assert/strict";
import { renderDayPage, renderRobots, renderSitemap, escapeHtml, isReady } from "../src/render.js";
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
import { redirectFor } from "../src/serve.js";

test("the front door still links every date, and the two pages people need", () => {
  const html = renderHome();
  assert.equal((html.match(/href="\/[a-z]+-\d+\/"/g) ?? []).length, 366);
  assert.ok(html.includes('href="/support/"'));
  assert.ok(html.includes('href="/privacy/"'));
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
  // The date comes off the front and becomes the anchor in the margin. It
  // used to be printed inside every sentence, on a page titled with it.
  assert.ok(html.includes("Ford unveiled the Edsel."));
  assert.ok(!html.includes("On September 4, 1957, Ford"), "the page's own date is not repeated per row");
  assert.match(html, /<span class="year">1957<\/span>/);
  assert.ok(html.includes("en.wikipedia.org"));
  assert.ok(html.includes("2 things, oldest first."));
});

test("Wikipedia's own events join the researched ones, oldest first", () => {
  const events = [
    { month: 9, day: 4, year: 1888, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "George Eastman registers the trademark Kodak." },
  ];
  const html = renderDayPage(page, [], facts, events);
  assert.ok(html.includes("George Eastman registers the trademark Kodak."));
  assert.ok(html.includes("3 things, oldest first."));
  // 1888 is older than the 1957 fact, so it comes first in the list.
  assert.ok(
    html.indexOf("Kodak") < html.indexOf("Edsel"),
    "the list is ordered by year, not by which source it came from",
  );
  // One credit for each source that is actually on the page, and the
  // Wikipedia rows do not each carry their own host line.
  assert.match(html, /Creative Commons Attribution ShareAlike/);
  assert.match(html, /Google's Gemini/);
});

test("the same event from both sources is printed once", () => {
  const events = [
    { month: 9, day: 4, year: 1957, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "Ford unveils the Edsel to the public." },
  ];
  const html = renderDayPage(page, [], facts, events);
  assert.ok(html.includes("2 things, oldest first."), "the duplicate is dropped, not added");
  // Counting the word will not do: the fixture's own source address contains
  // it. What must not survive is Wikipedia's second telling of the event.
  assert.ok(!html.includes("Ford unveils the Edsel to the public."));
  assert.ok(html.includes("Ford unveiled the Edsel."), "the researched one is the one kept");
});

test("a page with no researched facts still has a section when Wikipedia does", () => {
  const events = [
    { month: 9, day: 4, year: 1888, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "George Eastman registers the trademark Kodak." },
  ];
  const html = renderDayPage(page, [], [], events);
  assert.ok(html.includes("What happened on September 4"));
  assert.ok(html.includes("1 things, oldest first."));
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
  assert.match(html, /<span class="year">1952<\/span>/);
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
  assert.ok(!html.includes('class="facts"'));
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
  const section = html.slice(html.indexOf("<ul class=\"facts\">"), html.indexOf("<nav class=\"pager\">"));
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
  assert.ok(html.includes("sets no cookies"));
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
  assert.match(html, /<li id="1990">/);
  assert.match(html, /<a href="#1990">1990<\/a>/);
  assert.match(html, /<li id="1989">/);
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
