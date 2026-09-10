// A wall opens already carrying the day's news. docs/the-wall.md section 11.
//
//   node dist/src/wall/news.js            # every open date, from the live feeds
//   node dist/src/wall/news.js --dry      # read the feeds and say what would land
//
// Runs on the worker's schedule beside the checker. It reads a handful of
// public news feeds and files each item on the wall of the Eastern date it
// was published, as a story in the pool at the claimed tier, with the feed's
// own headline, the feed's own link and the feed's own description as the
// quotation. The importer is the submitter: submitted_by is null. Nothing
// here boosts anything, ever. A seeded story is placed only when a person
// backs it, and stays one module if nobody does.
//
// This is not the test seed. worker/src/wall/seed.ts invents boosts and must
// never run against the live project. This file invents nothing: every row
// it writes is a real article and it writes no boost, no check and no
// rectangle. The checker reads the page and writes the checks within the
// quarter hour.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadConfig, loadDotEnv } from "../config.js";
import { insert, rows, type Db } from "./db.js";
import { decodeEntities, fetchPage, fold, meta, ownerOf, pageContains, type Fetched, type OwnerRow } from "./page.js";
import { normalizeUrl, outletOf } from "./url.js";

// ---------------------------------------------------------------------------
// The feeds
// ---------------------------------------------------------------------------

export interface Feed {
  url: string;
  outlet: string;
}

/**
 * Public feeds with real headlines and a description on every item.
 *
 * Balance is the point, not volume. The first version was four world desks
 * and two science desks, and the wall it produced read like a six o'clock
 * bulletin: nothing anybody under thirty would say they remember about a day.
 * What people actually carry out of a year is at least as much music, film,
 * sport, games and whatever the internet was doing. So the list is grouped by
 * what a day is made of, and no group is allowed to be the whole wall.
 *
 * Every one of these is a public feed carrying the outlet's own headline and
 * its own description, which is what the quotation is matched against. A feed
 * that stops carrying descriptions stops producing verified sources and should
 * be replaced rather than worked around.
 */
export const FEEDS: Feed[] = [
  // What happened in the world
  { url: "https://feeds.npr.org/1001/rss.xml", outlet: "npr.org" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", outlet: "aljazeera.com" },
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", outlet: "bbc.com" },
  { url: "https://www.theguardian.com/world/rss", outlet: "theguardian.com" },

  // What was discovered
  { url: "https://www.nasa.gov/news-release/feed/", outlet: "nasa.gov" },
  { url: "https://www.sciencedaily.com/rss/top.xml", outlet: "sciencedaily.com" },

  // What people watched
  { url: "https://variety.com/feed/", outlet: "variety.com" },
  { url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", outlet: "bbc.com" },

  // What people listened to
  { url: "https://www.billboard.com/feed/", outlet: "billboard.com" },
  { url: "https://feeds.npr.org/1039/rss.xml", outlet: "npr.org" },

  // What the internet was doing
  { url: "https://www.theverge.com/rss/index.xml", outlet: "theverge.com" },
  { url: "https://www.polygon.com/rss/index.xml", outlet: "polygon.com" },

  // What was won and lost
  { url: "https://www.espn.com/espn/rss/news", outlet: "espn.com" },
  { url: "https://www.theguardian.com/uk/sport/rss", outlet: "theguardian.com" },
];

/**
 * The most items one feed may put on one date's wall. Lower than it was,
 * because the list is more than twice as long and the point of widening it was
 * a wall that carries a whole day rather than one desk's version of it.
 */
export const PER_FEED_PER_DATE = 5;

/**
 * Headlines that are not a thing that happened. docs/the-wall.md section 15.
 *
 * The wall asks one question, whether a story will still matter about this
 * date years from now, and a reader who is handed a ballot of ticket-buying
 * guides and console opinion answers it correctly by not spending anything.
 * These are the shapes that are never an answer to that question: an opinion
 * column, a question headline, a listicle, service journalism telling you
 * where to buy something, a release date, a review.
 *
 * Two apostrophes, because half these feeds curl theirs and a screen that
 * misses "Here's Where to Buy" while catching "Here's where to buy" is not a
 * screen.
 *
 * Deliberately narrow. Every pattern here was written against the hundred
 * and twenty nine headlines the live feeds actually filed for September 9,
 * 2026, and it catches twelve of them and no story. Over-filtering costs
 * more than the junk does: the junk loses one tile, a false positive loses
 * the day's news. When in doubt this lets it through.
 *
 * Not a deletion. Section 11 says the feed list is the vetting, and this is
 * the same vetting applied one level finer. Nothing is removed from any
 * table; these were never filed.
 */
const NOT_A_THING_THAT_HAPPENED =
  /\?\s*$|^(opinion|analysis|review|explainer|column)\b|here['’]?s (what|how|why|when|where|everything)|everything you need|top [0-9]+|[0-9]+ (things|ways|reasons)\b|finally gets a release|release date|:\s*here['’]|weigh in\b|what to know\b|explained\s*$|ranked\s*$|hands.on\b|first look\b|is the (last|best|worst|most)\b|who needs\b|tour [0-9]{4}\b/i;

/**
 * Whether a headline is a thing that happened, and so whether it belongs on
 * a board about what will still matter.
 */
export function mayMatter(headline: string): boolean {
  return headline.trim() !== "" && !NOT_A_THING_THAT_HAPPENED.test(headline);
}

// ---------------------------------------------------------------------------
// Reading a feed
// ---------------------------------------------------------------------------

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  /** Milliseconds since the epoch, or null when the item carries no readable date. */
  publishedAt: number | null;
}

function element(xml: string, name: string): string | null {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}\\s*>`, "i").exec(xml);
  if (match === null) return null;
  let inner = match[1]!.trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(inner);
  if (cdata !== null) inner = cdata[1]!;
  return inner;
}

/**
 * Plain words from a feed field: tags gone, entities decoded, whitespace
 * folded.
 *
 * Some feeds carry markup inside CDATA, where the tags are literal and are
 * stripped first. The Guardian's carry markup escaped as entities, so the
 * tags only appear after the entities are decoded, and the old order, strip
 * then decode, handed back "<p>Lambie, a veteran and Tasmanian senator ..."
 * as the quotation. No article page contains "<p>", so every Guardian
 * source failed its check from the day the feed was added: thirty of thirty
 * on the open walls on September 10, 2026. So when decoding uncovers tags,
 * they are stripped and the text is decoded once more, because content that
 * was escaped twice has its own entities escaped twice as well.
 */
export function plain(text: string): string {
  let s = decodeEntities(text.replace(/<[^>]*>/g, " "));
  if (/<[a-zA-Z/!][^>]*>/.test(s)) s = decodeEntities(s.replace(/<[^>]*>/g, " "));
  return fold(s);
}

/**
 * A feed excerpt with its truncation mark removed. Variety, The Verge and
 * NASA send the first few dozen words of the article and end them with
 * "[…]", and the article page has the words and never the mark, so the
 * exact match failed on the last three characters of every one of them:
 * twenty seven sources, one verified, on the open walls on September 10,
 * 2026. Taking the mark off leaves fewer of the source's words and never
 * different ones, which is the same rule fitHeadline already applies. Only
 * a trailing mark is touched.
 */
export function withoutTruncationMark(text: string): string {
  return fold(text).replace(/\s*(\[\s*(…|\.\.\.)\s*\]|…|\.\.\.)\s*$/u, "").trim();
}

/** Every item in an RSS or Atom document that has a title and a link. */
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1\s*>/gi) ?? [];
  for (const block of blocks) {
    const title = element(block, "title");
    let link = element(block, "link");
    if (link === null || link === "") {
      // Atom carries the address as an attribute.
      const href = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i.exec(block);
      link = href?.[1] ?? null;
    }
    if (title === null || link === null) continue;
    const description = element(block, "description") ?? element(block, "summary") ?? element(block, "content") ?? "";
    const when = element(block, "pubDate") ?? element(block, "published") ?? element(block, "updated") ?? element(block, "dc:date");
    const parsed = when === null ? NaN : Date.parse(plain(when));
    items.push({
      title: plain(title),
      link: plain(link),
      description: plain(description),
      publishedAt: Number.isNaN(parsed) ? null : parsed,
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// What lands where
// ---------------------------------------------------------------------------

const NEW_YORK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
});

export function easternDateOf(millis: number): string {
  const parts = Object.fromEntries(NEW_YORK.formatToParts(new Date(millis)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** The three dates that are open at an instant: yesterday, today and tomorrow, Eastern. */
export function openDates(nowMillis: number): string[] {
  const today = easternDateOf(nowMillis);
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  return [-1, 0, 1].map((offset) => new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10));
}

export interface PlannedStory {
  wallDate: string;
  headline: string;
  url: string;
  urlKey: string;
  outlet: string;
  quotation: string;
}

/** The first three hundred characters of a headline, cut at a word. wall_fit_headline, the same rule. */
export function fitHeadline(text: string): string {
  const s = fold(text);
  if (s.length <= 300) return s;
  const cut = s.slice(0, 300);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut).trim();
}

/**
 * Which items land on which open wall. Pure.
 *
 * An item goes on the wall of the Eastern date it was published, if that
 * date is open. An item with no date, a description shorter than twenty
 * characters, or an address that is not a page is left out. At most
 * PER_FEED_PER_DATE per feed per date, newest first, and the same page never
 * twice in one run.
 */
export function planNews(feedItems: Array<{ feed: Feed; items: FeedItem[] }>, nowMillis: number): PlannedStory[] {
  const open = new Set(openDates(nowMillis));
  const seen = new Set<string>();
  const out: PlannedStory[] = [];
  for (const { feed, items } of feedItems) {
    const perDate = new Map<string, number>();
    const dated = items
      .filter((item) => item.publishedAt !== null && item.publishedAt <= nowMillis)
      .sort((a, b) => b.publishedAt! - a.publishedAt!);
    for (const item of dated) {
      const wallDate = easternDateOf(item.publishedAt!);
      if (!open.has(wallDate)) continue;
      if ((perDate.get(wallDate) ?? 0) >= PER_FEED_PER_DATE) continue;
      let urlKey: string;
      try {
        urlKey = normalizeUrl(item.link);
      } catch {
        continue;
      }
      const key = `${wallDate}|${urlKey}`;
      if (seen.has(key)) continue;
      const headline = fitHeadline(item.title);
      // The screen runs on the source's own title rather than on the cut
      // one, so a pattern near the end is still there to be seen.
      if (!mayMatter(item.title)) continue;
      let quotation = withoutTruncationMark(item.description);
      if (quotation.length < 20) quotation = headline;
      if (headline === "" || quotation.length < 20) continue;
      seen.add(key);
      perDate.set(wallDate, (perDate.get(wallDate) ?? 0) + 1);
      out.push({
        wallDate, headline, url: urlKey, urlKey, outlet: feed.outlet || outletOf(urlKey),
        quotation: quotation.slice(0, 1000),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The quotation, taken from the page
// ---------------------------------------------------------------------------

/** Where a story's quotation came from, for the log and for the tests. */
export type QuotationOrigin = "feed" | "page description" | "page headline" | "feed, page unread" | "feed, nothing on the page";

/**
 * The quotation a new story is filed with, given its page. Pure.
 *
 * The feed's own description when the page contains it, because it is the
 * outlet's lede and reads best on a receipt. Otherwise the page's own
 * description, then the page's own headline, which is the rule
 * wall_submit_story applies to a link a person pastes: the page is asked
 * what it says about itself and that is quoted. Every candidate is held to
 * pageContains before it is taken, the same exact match with whitespace
 * folded that the checker will run a quarter hour later, so nothing is
 * stored here that the checker could disagree with. When the page could not
 * be read the feed's words are kept and the checker retries on its own
 * schedule; when the page offers nothing quotable the feed's words are kept
 * and the story fails its check and stays in the pool, which is right: a
 * page that will not say what it says is not a receipt.
 */
export function quotationFor(feedQuotation: string, page: Fetched): { quotation: string; origin: QuotationOrigin } {
  const feed = fold(feedQuotation);
  if (page.body === null || page.status === null || page.status < 200 || page.status >= 400) {
    return { quotation: feed, origin: "feed, page unread" };
  }
  if (feed.length >= 20 && pageContains(page.body, feed)) return { quotation: feed, origin: "feed" };
  const description = meta(page.body, "og:description") ?? meta(page.body, "description") ?? meta(page.body, "twitter:description");
  if (description !== null && description.length >= 20 && pageContains(page.body, description)) {
    return { quotation: description.slice(0, 1000), origin: "page description" };
  }
  const headline = meta(page.body, "og:title") ?? titleOf(page.body);
  if (headline !== null && headline.length >= 20 && pageContains(page.body, headline)) {
    return { quotation: headline.slice(0, 1000), origin: "page headline" };
  }
  return { quotation: feed, origin: "feed, nothing on the page" };
}

/** The title element's text, or null. */
function titleOf(html: string): string | null {
  const found = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html);
  if (found?.[1] === undefined) return null;
  const value = fold(decodeEntities(found[1]));
  return value === "" ? null : value;
}

/**
 * Each new story's page read once and its quotation settled. The reader is
 * an argument so the tests hand in pages rather than a network. One page at
 * a time, for the same reason the checker reads one at a time: these are
 * other people's servers.
 */
export async function withPageQuotations(
  planned: PlannedStory[],
  read: (url: string) => Promise<Fetched> = (url) => fetchPage(url),
  log: (line: string) => void = () => {},
): Promise<PlannedStory[]> {
  const out: PlannedStory[] = [];
  const origins = new Map<QuotationOrigin, number>();
  for (const story of planned) {
    const page = await read(story.url);
    const { quotation, origin } = quotationFor(story.quotation, page);
    origins.set(origin, (origins.get(origin) ?? 0) + 1);
    out.push({ ...story, quotation });
  }
  if (planned.length > 0) log(`wall news: quotations ${[...origins.entries()].map(([k, n]) => `${n} ${k}`).join(", ")}`);
  return out;
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

async function readFeed(feed: Feed, userAgent: string): Promise<FeedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(feed.url, { headers: { "User-Agent": userAgent }, signal: controller.signal });
    if (!response.ok) {
      console.warn(`wall news: ${feed.outlet} answered ${response.status}`);
      return [];
    }
    return parseFeed(await response.text());
  } catch (error: unknown) {
    console.warn(`wall news: ${feed.outlet} could not be read: ${error instanceof Error ? error.message : error}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function run(db: Db, options: { now?: Date; dry?: boolean; userAgent?: string; feeds?: Feed[] } = {}): Promise<{ planned: number; written: number }> {
  const now = options.now ?? new Date();
  const userAgent = options.userAgent ?? "Mozilla/5.0 (compatible; Birthed/0.1; +https://birthed.app)";
  const feeds = options.feeds ?? FEEDS;

  const read: Array<{ feed: Feed; items: FeedItem[] }> = [];
  for (const feed of feeds) read.push({ feed, items: await readFeed(feed, userAgent) });
  const planned = planNews(read, now.getTime());
  console.log(`wall news: ${planned.length} items across ${new Set(planned.map((p) => p.wallDate)).size} open dates`);
  if (options.dry) {
    for (const p of planned) console.log(`  ${p.wallDate} ${p.outlet}: ${p.headline}`);
    return { planned: planned.length, written: 0 };
  }

  const owners = await rows<OwnerRow>(db, "wall_outlet_owners?select=domain,owner");
  let written = 0;
  for (const wallDate of [...new Set(planned.map((p) => p.wallDate))]) {
    // The trigger fills the window; the values sent are placeholders it replaces.
    const at = now.toISOString();
    await insert(db, "wall_days", [{ wall_date: wallDate, opens_at: at, live_at: at, closes_at: at }], { ignoreDuplicates: true });
    // Only a page not already on this date is read. A feed carries an
    // article for days, and reading it again every quarter hour to settle a
    // quotation that was settled on the first run is the checker's old
    // mistake, recheck.ts, made over again in the seeder.
    const already = new Set((await rows<{ url_key: string }>(db, `wall_stories?select=url_key&wall_date=eq.${wallDate}`)).map((r) => r.url_key));
    const mine = await withPageQuotations(planned.filter((p) => p.wallDate === wallDate && !already.has(p.urlKey)), undefined, console.log);
    if (mine.length === 0) {
      console.log(`wall news ${wallDate}: nothing new`);
      continue;
    }
    // A page already on this date is that story; ignoring the duplicate is
    // the same rule wall_submit_story applies, and the row that comes back
    // is only the new ones.
    // The conflict target has to be named. PostgREST resolves
    // ignore-duplicates against the primary key unless told otherwise, and
    // this table's primary key is a generated uuid that never collides. The
    // constraint that actually fires on a second run is the unique on
    // (wall_date, url_key), so without this the whole batch fails with a 409
    // the moment a feed still carries an article it carried last time, which
    // is every run.
    const stories = await insert<{ id: string; url_key: string }>(
      db, "wall_stories?on_conflict=wall_date,url_key", mine.map((p) => ({
      wall_date: wallDate, headline: p.headline, url: p.url, url_key: p.urlKey, outlet: p.outlet, status: "pool", tier: "claimed",
    })), { returning: true, ignoreDuplicates: true });
    const byKey = new Map(mine.map((p) => [p.urlKey, p]));
    const sources = stories.map((s) => {
      const p = byKey.get(s.url_key)!;
      return {
        story_id: s.id, url: p.url, url_key: p.urlKey, outlet: p.outlet, owner: ownerOf(owners, outletOf(p.url)),
        headline: p.headline, quotation: p.quotation,
      };
    });
    await insert(db, "wall_sources", sources);
    written += stories.length;
    console.log(`wall news ${wallDate}: ${stories.length} new of ${mine.length}`);
  }
  return { planned: planned.length, written };
}

async function main(): Promise<void> {
  await loadDotEnv();
  const dry = process.argv.includes("--dry");
  const config = loadConfig({ needsWrite: !dry });
  await run({ url: config.supabaseUrl, key: config.serviceRoleKey }, { dry, userAgent: config.userAgent });
}

function isEntryPoint(): boolean {
  const argv = process.argv[1];
  if (argv === undefined) return false;
  try {
    return realpathSync(argv) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
