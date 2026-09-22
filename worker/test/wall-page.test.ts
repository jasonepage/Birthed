import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

import { HostSilence, PAGE_HEADERS, PAGE_MAX_BYTES, SILENT_STRIKES, decodeEntities, fetchPage, fold, meta, ownerOf, pageContains, pageText, type Fetched } from "../src/wall/page.js";
import { normalizeUrl } from "../src/wall/url.js";

// The quotation rule and the address key each exist twice: once here, for
// the checker, and once in SQL, for the submit function. These fixtures are
// run through both. The SQL half needs a database: set DATABASE_URL to a
// Postgres connection string carrying every migration and it runs through
// psql; without it the SQL half is skipped and says so.

const url = process.env.DATABASE_URL;

function sql(query: string): string {
  return execFileSync("psql", [url!, "--no-psqlrc", "-Atc", query], { encoding: "utf8" }).trim();
}

function literal(text: string): string {
  return `$q$${text}$q$`;
}

const PAGE = `<!doctype html><html><head><title>Five tankers &amp; a warship</title>
<meta content="US strikes 5 Iranian oil tankers" property="og:title">
<meta property="og:site_name" content="Al Jazeera">
<meta name="description" content="US military says it struck the five Iranian tankers after the IRGC targeted a US warship twice in two days.">
<style>.x { content: "hidden words"; }</style>
</head><body><!-- The U.S. military said it destroyed five --> <script>var s = "The U.S. military said it destroyed five Iranian oil tankers";</script>
<p>The U.S. military said it destroyed five&nbsp;Iranian oil tankers on Tuesday in response to the latest attacks
   on its warships and American targets in Jordan, the latest burst of back-and-forth strikes.</p>
<p>It&#8217;s the fourth such strike this month &#x2014; officials said.</p>
</body></html>`;

const CASES: Array<[string, boolean]> = [
  ["The U.S. military said it destroyed five Iranian oil tankers on Tuesday in response to the latest attacks on its warships and American targets in Jordan, the latest burst of back-and-forth strikes.", true],
  ["US military says it struck the five Iranian tankers after the IRGC targeted a US warship twice in two days.", true],
  ["It’s the fourth such strike this month — officials said.", true],
  ["The U.S. military said it destroyed five Iranian oil tankers", true],
  ["The US military said it destroyed five Iranian oil tankers on Tuesday", false],
  ["hidden words", false],
  ["five iranian oil tankers", false],
  ["", false],
];

test("the checker's quotation rule: exact match passes, a paraphrase fails, code is not text", () => {
  for (const [quotation, expected] of CASES) {
    assert.equal(pageContains(PAGE, quotation), expected, JSON.stringify(quotation));
  }
});

test("entities and whitespace", () => {
  assert.equal(decodeEntities("a &amp; b&#39;s &#x27;c&#x27; &rsquo; &amp;amp;"), "a & b's 'c' ’ &amp;");
  assert.equal(fold("  a \n\n b\t c  "), "a b c");
  assert.match(pageText(PAGE), /^Five tankers & a warship The U\.S\. military/);
});

test("meta tags in either attribute order, with either quote", () => {
  assert.equal(meta(PAGE, "og:title"), "US strikes 5 Iranian oil tankers");
  assert.equal(meta(PAGE, "og:site_name"), "Al Jazeera");
  assert.equal(meta(PAGE, "og:description"), null);
  assert.equal(meta(`<meta name='description' content='It&#39;s fine'>`, "description"), "It's fine");
});

test("owners walk up the domain, and an unknown host is its own owner", () => {
  const table = [{ domain: "cnn.com", owner: "Warner Bros. Discovery" }, { domain: "news.sky.com", owner: "Comcast" }];
  assert.equal(ownerOf(table, "edition.cnn.com"), "Warner Bros. Discovery");
  assert.equal(ownerOf(table, "www.cnn.com"), "Warner Bros. Discovery");
  assert.equal(ownerOf(table, "news.sky.com"), "Comcast");
  assert.equal(ownerOf(table, "sky.com"), "sky.com");
  assert.equal(ownerOf(table, "example.org"), "example.org");
});

const ADDRESSES = [
  "https://www.npr.org/2026/09/09/nx-s1-5962641/us-destroy-iranian-oil-tankers?utm_source=feed&utm_medium=rss",
  "http://NPR.org/2026/09/09/nx-s1-5962641/us-destroy-iranian-oil-tankers/",
  "https://x.com/nasa/status/123?s=20&t=abc",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&si=xyz",
  "https://example.org:8080/a/b?q=hello world&page=2#section",
  "https://example.org/search?b=2&a=1&a=0",
  "https://example.org/?ref=twitter&fbclid=abc",
  "https://example.org/path?name=Ünïcode&x=%20a",
  "https://example.org/a%20b/c?empty",
];

test("the address key in SQL agrees with worker/src/wall/url.ts", {
  skip: url ? false : "set DATABASE_URL to a Postgres connection string to run this",
}, () => {
  for (const address of ADDRESSES) {
    assert.equal(sql(`select wall_url_key(${literal(address)})`), normalizeUrl(address), address);
  }
});

test("the quotation rule in SQL agrees with the checker", {
  skip: url ? false : "set DATABASE_URL to a Postgres connection string to run this",
}, () => {
  for (const [quotation, expected] of CASES) {
    const answer = sql(`select wall_page_contains(${literal(PAGE)}, ${literal(quotation)})`);
    assert.equal(answer === "t", expected, JSON.stringify(quotation));
  }
  const headline = sql(`select headline from wall_page_meta(${literal(PAGE)})`);
  assert.equal(headline, "US strikes 5 Iranian oil tankers");
  assert.equal(sql(`select site_name from wall_page_meta(${literal(PAGE)})`), "Al Jazeera");
  assert.equal(sql(`select wall_owner_of('edition.cnn.com')`), "Warner Bros. Discovery");
  assert.equal(sql(`select wall_owner_of('example.org')`), "example.org");
});

// ---------------------------------------------------------------------------
// Hosts that do not answer. September 10, 2026: nine npr.org sources, nine
// silences of fifteen seconds each, every tick.
// ---------------------------------------------------------------------------

const SILENT: Fetched = { status: null, body: null, finalUrl: null, detail: "no answer within 15 seconds" };
const ANSWERED: Fetched = { status: 200, body: "<p>hello</p>", finalUrl: "https://www.npr.org/a", detail: "200" };
const REFUSED: Fetched = { status: 403, body: "", finalUrl: "https://www.npr.org/a", detail: "403" };

test("a host that answers nothing twice in a run is left alone for the rest of it", () => {
  const silence = new HostSilence();
  assert.equal(silence.skips("https://www.npr.org/2026/09/10/one"), false);
  silence.record("https://www.npr.org/2026/09/10/one", SILENT);
  assert.equal(silence.skips("https://www.npr.org/2026/09/10/two"), false, "one silence is a bad moment");
  silence.record("https://www.npr.org/2026/09/10/two", SILENT);
  assert.equal(silence.skips("https://www.npr.org/2026/09/10/three"), true, "two is a host");
  assert.equal(SILENT_STRIKES, 2);
  assert.deepEqual(silence.silenced(), ["www.npr.org"]);
  // Another host is another host, and the feed host is not the article host.
  assert.equal(silence.skips("https://feeds.npr.org/1001/rss.xml"), false);
  assert.equal(silence.skips("https://www.theguardian.com/world"), false);
});

test("any answer at all, even a refusal, is not silence and clears the count", () => {
  const silence = new HostSilence();
  silence.record("https://www.npr.org/a", SILENT);
  silence.record("https://www.npr.org/b", REFUSED);
  silence.record("https://www.npr.org/c", SILENT);
  assert.equal(silence.skips("https://www.npr.org/d"), false, "a 403 is an answer, and the count started over");
  silence.record("https://www.npr.org/d", ANSWERED);
  assert.deepEqual(silence.silenced(), []);
});

test("the page request says it is a browser and still says it is Birthed", () => {
  assert.ok(PAGE_HEADERS["User-Agent"]!.startsWith("Mozilla/5.0"));
  assert.ok(PAGE_HEADERS["User-Agent"]!.includes("Birthed"), "an operator reading a log can still find us");
  assert.ok(!PAGE_HEADERS["User-Agent"]!.includes("node-fetch"), "the worker's own name for itself is for Wikidata");
  assert.ok(PAGE_HEADERS["Accept-Language"]);
});

// The cap. CLAUDE.md section 5, September 22, 2026: the tick died for an hour
// with "Reached heap limit Allocation failed" because fetchPage read whatever
// it was sent, and what it was sent was a 64,440,402 byte page.
function answer(body: string, headers: Record<string, string> = {}): Response {
  const bytes = new TextEncoder().encode(body);
  return new Response(new ReadableStream({
    start(controller) { controller.enqueue(bytes); controller.close(); },
  }), { status: 200, headers: { "content-type": "text/html", ...headers } });
}

test("a page inside the cap is read whole", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => answer("<html>a short page</html>")) as typeof fetch;
  try {
    const got = await fetchPage("https://example.com/a");
    assert.equal(got.body, "<html>a short page</html>");
    assert.equal(got.status, 200);
  } finally { globalThis.fetch = real; }
});

test("a page over the cap is unreadable rather than half read", async () => {
  const real = globalThis.fetch;
  const huge = "x".repeat(PAGE_MAX_BYTES + 1000);
  globalThis.fetch = (async () => answer(huge)) as typeof fetch;
  try {
    const got = await fetchPage("https://example.com/huge");
    assert.equal(got.body, null, "never a truncated body, which would make a quotation check lie");
    assert.match(got.detail, /too big to read/);
  } finally { globalThis.fetch = real; }
});

test("a declared length over the cap is refused without draining the body", async () => {
  const real = globalThis.fetch;
  let cancelled = false;
  // A stream fills its own queue as soon as it exists, so whether a chunk was
  // produced says nothing. What is observable, and what matters, is that
  // fetchPage lets go of the response instead of reading it to the end.
  globalThis.fetch = (async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(10)); },
    cancel() { cancelled = true; },
  }), { status: 200, headers: { "content-type": "text/html", "content-length": String(64_440_402) } })) as typeof fetch;
  try {
    const got = await fetchPage("https://example.com/declared");
    assert.equal(got.body, null);
    assert.match(got.detail, /too big to read: 64440402 bytes/);
    assert.equal(cancelled, true, "the body is cancelled, not drained");
  } finally { globalThis.fetch = real; }
});
