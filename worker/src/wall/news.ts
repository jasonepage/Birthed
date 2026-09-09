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
import { decodeEntities, fold, ownerOf, type OwnerRow } from "./page.js";
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

/** Plain words from a feed field: tags gone, entities decoded, whitespace folded. */
export function plain(text: string): string {
  return fold(decodeEntities(text.replace(/<[^>]*>/g, " ")));
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
      let quotation = fold(item.description);
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
    const mine = planned.filter((p) => p.wallDate === wallDate);
    // A page already on this date is that story; ignoring the duplicate is
    // the same rule wall_submit_story applies, and the row that comes back
    // is only the new ones.
    const stories = await insert<{ id: string; url_key: string }>(db, "wall_stories", mine.map((p) => ({
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
