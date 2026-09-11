// Serves the built site.
//
//   npm run site      # renders out/
//   npm run serve     # serves it
//
// No dependencies, because this reads files off a disk and sets headers and
// there is no part of that worth a supply chain for. Node's own http and fs
// are the whole of it.
//
// The pages themselves are still rendered ahead of time by build.ts. An
// ordinary page view does not touch the database and does not render anything,
// so a Supabase outage cannot take the site down and a request costs a file
// read.
//
// The remembrance question was the first exception to that, and it is gone:
// its routes came off on September 11, 2026, after the question itself had
// already come off the page. Nothing was dropped from the database and the
// answers people gave are still read at build time to order a sealed date.
//
// The wall is the exception now, on its three open dates, docs/the-wall.md
// sections 12 and 13: those pages read the wall at request time, shared and
// cached, a tap is a POST to /boost, and the GET that follows it, carrying
// ?tapped=, reads once more past the cache. Every one of those falls back to
// the page as built, so an outage costs a count and never a site.

import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

import { everyDate, monthName, slug } from "./model.js";
import { ASK_SLOTS, TODAY, renderStoryPage } from "./render.js";
import { ASK_MAX, emptyWallDay, fetchWallDay, openWallDates, replaceWall, hivePath, wallKey, wallMarks, wallSection, withChecks, type Anniversary, type TapBack, type WallDay } from "./wall.js";
import { answer as findAnswer } from "./find.js";
import { personalName } from "./share.js";


const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

/**
 * The pages change whenever the importer runs, and a date page a year out of
 * date is worse than one fetched again. They are a few kilobytes each, so
 * revalidating every time costs nothing worth saving.
 *
 * The share images are named after the date and rewritten in place rather
 * than fingerprinted, so they get an hour rather than forever.
 */
function cacheControl(path: string): string {
  // Never stored. It names one of 366 dates and it is wrong from midnight,
  // and it is about a hundred and fifty bytes, so there is nothing to save.
  if (path === "/today.css") return "no-store";
  // The four numbers. The file itself holds no figures, but a page whose whole
  // job is to be read fresh should not sit in anybody's cache, and nothing
  // about it is worth the bytes a revalidate would save.
  if (path === "/admin/numbers" || path.startsWith("/admin/numbers/")) return "no-store";
  if (path.startsWith("/og/")) return "public, max-age=3600";
  if (extname(path) === "") return "public, max-age=0, must-revalidate";
  if (path.endsWith(".html")) return "public, max-age=0, must-revalidate";
  return "public, max-age=3600";
}

const SECURITY: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Every page but one is text, one inline stylesheet and nothing else, so
  // the policy for those stays this narrow. Widen it the day something needs
  // widening, not before. `/add` is the day, and it gets its own below rather
  // than loosening this one for the whole site.
  // style-src gains 'self' and nothing else does. /today.css is a stylesheet
  // this server generates and serves from this origin, and it is the whole
  // reason for the widening: it is how the calendar can ring today without a
  // script, which this policy still refuses everywhere except /add.
  "Content-Security-Policy":
    // form-action was 'none' until the first button that posts existed, which would
    // have refused them silently, the same way default-src silently killed
    // /add for months. 'self' and nothing else: a form on this site may post
    // to this site and nowhere on earth besides.
    "default-src 'none'; img-src 'self'; style-src 'unsafe-inline' 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

/// Where the one page that talks to a server is allowed to talk to.
///
/// Read from the environment so that moving the project moves this with it,
/// with the current project as the fallback because a web service that has
/// forgotten this value should still be able to send a birthday. Neither the
/// project reference nor its address is a secret; the key that goes with it
/// is the anonymous one that already ships inside the app.
/**
 * Where the project is, with the fallback every other file here already had.
 *
 * **This is the bug that made the whole feature do nothing.** build.ts, og.ts
 * and apiOrigin all read SUPABASE_URL with `?? the project address`, because
 * neither the reference nor the address is a secret. record() read it with no
 * fallback and returned false when it was missing. render.yaml sets
 * SUPABASE_ANON_KEY and does not set SUPABASE_URL, because nothing had ever
 * needed it to, so on the live site every answer returned false before the
 * database was ever called, and every reader who answered anything was
 * redirected to a sentence saying the date was sealed. It was not sealed. The
 * table had nothing in it because nothing was ever sent.
 *
 * So there is now one function and everything that talks to the project uses
 * it. Two copies of a fallback is how one of them ends up missing.
 */
export function projectBase(): string {
  return (process.env.SUPABASE_URL ?? "https://lunqqhjwqrpbujwxwdzk.supabase.co").replace(/\/+$/, "");
}

/**
 * Where the readers' own pictures are, which is deliberately not under the
 * site root: everything under that is reachable by asking for its path, and
 * these are one reader's own. og.ts writes them here by the same name.
 */
export function personalRoot(): string {
  return resolve(process.env.PERSONAL_ROOT ?? "personal");
}

function apiOrigin(): string {
  const raw = projectBase();
  try {
    return new URL(raw).origin;
  } catch {
    return "https://lunqqhjwqrpbujwxwdzk.supabase.co";
  }
}

/**
 * The headers for one request.
 *
 * `/add` is the only page on birthed.app that runs a script, and the policy
 * above says `default-src 'none'`, which covers scripts and network calls
 * too. So the page has been silently dead in every browser since it was
 * written: the browser dropped the script without drawing anything, which
 * looks exactly like an empty page. The privacy page was updated when that
 * script arrived and this header was not, which is the whole bug.
 *
 * The widening is per path and no wider than the page needs: it may run the
 * script that is written into it, and it may reach the project that receives
 * a birthday. Everything else stays refused, and every other page on the site
 * keeps the policy that has no script in it at all.
 *
 * `'unsafe-inline'` rather than a hash of the script, because the hash would
 * have to be computed from the built file and kept in step with it, and a
 * stale hash fails the same silent way this bug did. Nothing user-written is
 * rendered into that page, so there is nothing for an injected script to
 * arrive in.
 */
/**
 * The paths that run a script, and there are two.
 *
 * /add hands a birthday between two phones. /admin is the curation panel.
 * Everything else on this site runs nothing at all, and the widening is per
 * path so that stays true rather than becoming a thing somebody remembers.
 */
const SCRIPTED = ["/add", "/admin"];

export function securityFor(requestPath: string): Record<string, string> {
  const isAdd = SCRIPTED.some(
    (path) => requestPath === path || requestPath.startsWith(`${path}/`),
  );
  if (!isAdd) return SECURITY;
  return {
    ...SECURITY,
    "Content-Security-Policy":
      "default-src 'none'; img-src 'self'; style-src 'unsafe-inline' 'self'; " +
      `script-src 'unsafe-inline'; connect-src ${apiOrigin()}; ` +
      "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  };
}

/**
 * How far behind Coordinated Universal Time the server reads the clock when
 * somebody asks for today.
 *
 * Six hours is North American Central Standard Time. It is a choice and it is
 * written here rather than buried, because a server cannot read a visitor's
 * clock and this site has no script anywhere that could tell it. Coordinated
 * Universal Time on its own is already tomorrow through every American
 * evening, which would send most of the traffic this site gets to the wrong
 * one of the 366 pages every night. Six hours back is right for North America
 * and can be a day out for somebody in Asia in their early morning.
 *
 * Nothing is hidden by being wrong: the page that answers puts its own date
 * in the heading, so a visitor who lands on the wrong day can see it and the
 * arrows at the foot move one date at a time.
 */
const TODAY_BEHIND_UTC_HOURS = 6;

/**
 * The two paths that answer with a date rather than with a file.
 *
 *   /random/   one of the 366, drawn at random
 *   /today/    the date it is now
 *
 * Both are redirects rather than pages, and that is the whole reason they can
 * exist here. The site sends `default-src 'none'`, so no page on it may run a
 * script, and a script is the only way a page could pick a date for itself. A
 * redirect needs none. The server picks, the browser follows, and what it
 * lands on is one of the pages that was already built.
 *
 * The clock and the dice are arguments so a test can hand it both and get an
 * answer it can check.
 */
/**
 * The date "/" answers with.
 *
 * The root is not a page any more. It is whatever date it is, served from the
 * file that was already built for that date, so there is one template for all
 * 367 addresses and no front door to keep in step with them. The canonical
 * inside that file names the dated address, so a search engine indexes
 * /september-7/ and reads "/" as the same thing rather than as a rival.
 *
 * Read at request time rather than at build time, because the pages are baked
 * into a deploy and a baked "/" is the wrong day by the next morning. That is
 * the whole reason this lives here and not in build.ts.
 *
 * Shifted by the same hours as /today for the same reason, which is written
 * up above the constant.
 */
/**
 * The one stylesheet this server writes rather than reads.
 *
 * The calendar at the foot of every page marks two squares: the date whose
 * page you are on, which the renderer knows and fills in at build time, and
 * today, which it cannot. These pages are rendered into a deploy and served
 * unchanged until the next one, so a today ring written at build time would
 * still be pointing at the day of the deploy a week later, on all 366 pages,
 * with nothing on screen to say so. That is the same trap that made "/" a
 * date read at request time rather than a baked page.
 *
 * A script would answer it and this site does not run scripts. A stylesheet
 * does, because the ring is a presentation of a fact the server already knows,
 * and one selector naming one of 366 addresses is the whole of it.
 *
 * Not cached, and it carries no personal anything: the date is the server's,
 * not the reader's.
 */
/**
 * The three dates that are open right now, in the order they read.
 *
 * Yesterday, today and tomorrow. A date takes answers for the day either side
 * of itself and then seals until next year, and this is the one place that
 * arithmetic lives on the web side.
 */
export function openDates(now: Date = new Date()): string[] {
  const day = 24 * 60 * 60 * 1000;
  return [-1, 0, 1].map((offset) => todaySlug(new Date(now.getTime() + offset * day)));
}

/**
 * The stylesheet that knows what day it is.
 *
 * It rings today in the calendar, and it is now also what tells a page whether
 * it is open. The pages are baked ahead of time and a baked page cannot know
 * today's date, so every date page carries a class naming itself and this
 * sheet reveals the answering buttons on exactly three of them.
 *
 * Which means the buttons are not drawn on a date that would refuse them. That
 * is worth more than it sounds: a reader who taps and is told no has been
 * wasted, and the alternative was drawing three dead buttons on 363 pages.
 *
 * If this sheet fails to load nobody can answer, which is the safe direction
 * to fail in. The server still refuses a hand written post either way, because
 * the check that matters is in the database.
 */
/**
 * Which ask card each open date shows on this request.
 *
 * A number from zero to ASK_SLOTS minus one. Every page carries a card for
 * every slot, so any number resolves on any date, whatever that date's own
 * count of candidates is. See askSection in render.ts for the arithmetic.
 *
 * Random rather than clocked, and per date rather than one number for all
 * three, because this sheet is generated on every request and is never
 * cached, so a reader who reloads gets a different row to answer and a reader
 * who steps between the three open dates does not get the same slot on each.
 * That is the point: a fixed card is one chance to hook a stranger and the
 * same card forever for anybody who comes back.
 *
 * A reader who has just answered is the exception and it is handled in the
 * sheet rather than here. The redirect lands on that card's own identifier,
 * so :target reveals it whatever this picked, and the picked one is hidden
 * while a targeted one exists. Otherwise answering would scroll somebody to a
 * card that the next roll had already replaced.
 */
function askSlot(random: () => number): number {
  return Math.min(ASK_SLOTS - 1, Math.max(0, Math.floor(random() * ASK_SLOTS)));
}

export function todayStylesheet(now: Date = new Date(), random: () => number = Math.random): string {
  const open = openDates(now);
  const day = 24 * 60 * 60 * 1000;
  // The site's own clock, the same shift todaySlug makes.
  const shifted = now.getTime() - TODAY_BEHIND_UTC_HOURS * 60 * 60 * 1000;
  const startOfToday = Math.floor(shifted / day) * day;
  // Which of the four baked state sentences each open page shows, in the
  // order openDates returns them: yesterday's date, today's, tomorrow's.
  const sentence = ["senpast", "sennow", "sennext"];
  // The link in the "three open dates" line that points at the page itself.
  const self = ["/yesterday/", "/today/", "/tomorrow/"];
  return `.cal .days a[href="/${todaySlug(now)}/"]{outline:2px solid ${TODAY};` +
    `outline-offset:2px;color:#BFD8F5}\n` +
    // The signature, on today's date and nowhere else. Baked hidden into all
    // 366 pages and revealed here, because "/" serves today's own built file
    // and no file knows which day it is. Today's date rather than all three
    // open ones: it is the page a stranger arrives on, and a name repeated
    // across an almanac reads as a byline over work somebody else did.
    `.on-${todaySlug(now)} .signed{display:block}\n` +
    open.map((date, i) => {
      // A date is open from the start of the day before it to the end of the
      // day after it. Yesterday's date opened two days ago, today's opened
      // yesterday, tomorrow's opened at the start of today. The fraction of
      // the three days that has gone is what the fuse under the state line
      // draws, and it is true to the second this sheet was generated.
      const opensAt = startOfToday + (i - 2) * day;
      const gone = Math.min(1, Math.max(0, (shifted - opensAt) / (3 * day)));
      return `.on-${date} .rem{display:flex}` +
        // The year control is revealed with the buttons and by the same rule.
        // It is only worth asking somebody their birth year on a page where
        // they can do something with it, and asking on the 363 dates that
        // would refuse an answer is a personal question for nothing.
        `.on-${date} .yearask{display:block}` +
        // The first screen. The state sentence for this page, the open
        // version of the mechanic, the lit dot, the fuse, the ask card, and
        // the feed's copy of the ask row put away so the row is on the page
        // once.
        `.on-${date} .${sentence[i]},.on-${date} .senopen{display:inline}` +
        `.on-${date} .senshut{display:none}` +
        // .state .dot, not .dot: today.css is linked before the inline stylesheet,
        // so a rule of equal specificity here loses to the baked grey.
        `.on-${date} .state .dot{background:${TODAY};box-shadow:0 0 0 4px rgba(111,165,222,.18)}` +
        // The dot breathes only here, on an open date, where it is true. The
        // keyframes are baked; the trigger is not, because a grey dot
        // breathing on a sealed page would say the page is live.
        `@media (prefers-reduced-motion:no-preference){.on-${date} .state .dot{animation:breathe 4s ease-in-out infinite}}` +
        `.on-${date} .fuse{display:block}` +
        `.on-${date} .fuse span{--gone:${gone.toFixed(4)}}` +
        `.on-${date} .asks${askSlot(random)}{display:block}` +
        // The card the reader just answered, wherever the roll landed. The
        // second rule is what stops two cards being on screen at once, and it
        // is written with :has so that a browser without it shows two cards
        // rather than none, which is the right way round for a fallback.
        `.on-${date} .ask:target{display:block}` +
        `.on-${date}:has(.ask:target) .ask:not(:target){display:none}` +
        `.on-${date} .asked{display:none}` +
        `.on-${date} .also a[href="${self[i]}"]{display:none}`;
    }).join("") +
    `\n`;
}

export function todaySlug(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - TODAY_BEHIND_UTC_HOURS * 60 * 60 * 1000);
  return slug(shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

export function redirectFor(
  requestPath: string,
  now: Date = new Date(),
  random: () => number = Math.random,
): string | null {
  const path = requestPath.length > 1 && requestPath.endsWith("/")
    ? requestPath.slice(0, -1)
    : requestPath;

  if (path === "/random") {
    const dates = everyDate();
    // Clamped, because a random source that ever returns exactly 1 would
    // index one past the end and the server would answer with undefined.
    const index = Math.min(dates.length - 1, Math.max(0, Math.floor(random() * dates.length)));
    const picked = dates[index]!;
    return `/${slug(picked.month, picked.day)}/`;
  }

  if (path === "/yesterday" || path === "/tomorrow") {
    const day = 24 * 60 * 60 * 1000;
    const when = new Date(now.getTime() + (path === "/tomorrow" ? day : -day));
    return `/${todaySlug(when)}/`;
  }

  if (path === "/today") {
    const shifted = new Date(now.getTime() - TODAY_BEHIND_UTC_HOURS * 60 * 60 * 1000);
    return `/${slug(shifted.getUTCMonth() + 1, shifted.getUTCDate())}/`;
  }

  return null;
}

/**
 * Turns a request path into a file inside ROOT, or null.
 *
 * Everything outside ROOT is null, including anything that climbs out with
 * dot dot or a leading slash after decoding. A static server that can be
 * talked into reading /etc/passwd is the oldest bug there is, so the check is
 * a prefix test on the resolved path rather than a search for suspicious
 * characters.
 */
export function resolvePath(root: string, requestPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;

  const relative = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = resolve(join(root, relative));
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}

async function fileFor(full: string): Promise<string | null> {
  try {
    const info = await stat(full);
    if (info.isDirectory()) {
      const index = join(full, "index.html");
      const indexInfo = await stat(index);
      return indexInfo.isFile() ? index : null;
    }
    return info.isFile() ? full : null;
  } catch {
    return null;
  }
}

function send(
  response: ServerResponse,
  status: number,
  file: string,
  requestPath: string,
  headOnly: boolean,
): void {
  response.writeHead(status, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    "Cache-Control": cacheControl(requestPath),
    ...securityFor(requestPath),
  });
  if (headOnly) {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
}


// ---------------------------------------------------------------------------
// The two cookies.
//
// Both were the remembrance question's before they were the wall's. The token
// is the identity behind a buzz from a browser and the year decides which
// picture a reader gets, and both outlive the question they were written for.
//
// A write is still a plain HTML form that posts and redirects back. No script,
// on a site that ships none, which means it works with JavaScript turned off
// entirely. That is not nostalgia: the whole argument this site makes about
// itself is that it runs nothing, and a button written in JavaScript would
// have cost that argument for a thing a 1993 browser could do.

const TOKEN_COOKIE = "bt";
/// The reader's birth year, asked once and kept beside the token.
///
/// A separate cookie rather than a second field inside the token one, because
/// tokenFromCookie validates the token's shape strictly and a year sharing
/// that value would have to loosen it. Two cookies is cheaper than a format.
const YEAR_COOKIE = "by";
const MAX_BODY = 4096;

/** One person's opaque token. Not an account, not an address, not a fingerprint. */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * The birth year this browser saved, or null.
 *
 * Bounded by the same 1900 to 2100 the database column checks, so a hand
 * edited cookie is treated as no year rather than as an answer the database
 * will refuse for reasons nobody can see.
 */
export function yearFromCookie(header: string | undefined): number | null {
  for (const part of (header ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === YEAR_COOKIE) {
      const year = Number(rest.join("=").trim());
      if (Number.isInteger(year) && year >= 1900 && year <= 2100) return year;
    }
  }
  return null;
}

export function tokenFromCookie(header: string | undefined): string | null {
  for (const part of (header ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === TOKEN_COOKIE) {
      const value = rest.join("=").trim();
      // The database refuses anything under sixteen characters, so a truncated
      // or hand-edited cookie is treated as no cookie rather than as a vote
      // that silently fails.
      if (value.length >= 16 && /^[A-Za-z0-9_-]+$/.test(value)) return value;
    }
  }
  return null;
}

/**
 * A crude ceiling, in memory, per address.
 *
 * Not security. Somebody who wants to stuff a date can clear a cookie and use
 * another address, and the design already accepts that: the crowd can only
 * order rows that passed the evidence gate, there is no downvote, and the
 * tally is one signal out of four. This exists to stop a script making
 * thousands of writes in a minute, which is a cost problem rather than a
 * truth problem.
 */
const seen = new Map<string, { count: number; until: number }>();
const LIMIT = 40;
const WINDOW_MS = 60_000;

export function underLimit(key: string, now = Date.now()): boolean {
  const entry = seen.get(key);
  if (entry === undefined || now > entry.until) {
    seen.set(key, { count: 1, until: now + WINDOW_MS });
    // Swept here rather than on a timer, because a timer keeps a process alive
    // and this map is a few hundred entries on a site with no traffic.
    if (seen.size > 5000) {
      for (const [at, value] of seen) if (now > value.until) seen.delete(at);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= LIMIT;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
      if (body.length > MAX_BODY) {
        reject(new Error("body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Tapping a story on the wall// ---------------------------------------------------------------------------
// Tapping a story on the wall
// ---------------------------------------------------------------------------

export interface Tap {
  storyId: string;
  month: number;
  day: number;
  /** Where the reader is sent back to: the date page, the full screen hive, or the story's receipt. */
  back: TapBack;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * A posted tap into a story and a date to come back to, or null. Checked
 * here so a malformed post is a 400 rather than a round trip; the database
 * checks the story again.
 */
export function readTap(body: string): Tap | null {
  const form = new URLSearchParams(body);
  const storyId = (form.get("s") ?? "").trim().toLowerCase();
  const month = Number(form.get("m"));
  const day = Number(form.get("d"));
  if (!UUID.test(storyId)) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  const v = form.get("v");
  return { storyId, month, day, back: v === "hive" || v === "receipt" ? v : "day" };
}

/**
 * What happened to a tap, in the database's words, plus the two that are
 * ours: bad, for a story it does not have, and failed, for never reaching
 * it. Each has its own sentence on the page and its own fragment, so a
 * refusal never borrows another refusal's explanation.
 */
export type Tapped =
  | "kept" | "already" | "spent" | "not_yet" | "closed" | "false" | "bad" | "failed"
  // The undo's own two, docs/the-wall.md, the last entry in section 16. They
  // ride the same query string as a tap's word, for the same reason: it is
  // what permits the one fresh wall read on the way back, so the reader lands
  // on the count that moved rather than the one everybody else saw.
  | "undone" | "too_late";

const TAPPED = new Set<string>([
  "kept", "already", "spent", "not_yet", "closed", "false", "bad", "failed", "undone", "too_late",
]);

const TAP_FRAGMENT: Record<Tapped, string> = {
  kept: "wkept", already: "walready", spent: "wspent", not_yet: "wnotyet",
  closed: "wclosed", false: "wfalse", bad: "wfailed", failed: "wfailed",
  undone: "wundone", too_late: "wtoolate",
};

// ---------------------------------------------------------------------------
// The typed field. docs/the-wall.md section 15.
// ---------------------------------------------------------------------------

export interface Ask {
  /** What the reader typed, trimmed. May be empty: pressing Find on nothing is a blank answer, not a bad request. */
  q: string;
  month: number;
  day: number;
}

/**
 * A posted phrase and the date it asks about, or null. The phrase is held
 * to the length the input already declares, so a hand made post cannot hand
 * the matcher a novel. The date is checked the way a tap's is.
 */
export function readAsk(body: string): Ask | null {
  const form = new URLSearchParams(body);
  const q = (form.get("q") ?? "").trim();
  const month = Number(form.get("m"));
  const day = Number(form.get("d"));
  if (q.length > ASK_MAX) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return { q, month, day };
}

/**
 * The stories a redirect from /find says were found, best first, or null.
 * Identifiers only, never words: the phrase itself stays in the post body
 * it arrived in and is never written into an address, where it would land
 * in a request log. At most the few the field offers, and every one of
 * them must be shaped like ours or the whole list is refused.
 */
export function foundFrom(query: string | undefined): string[] | null {
  if (query === undefined || query === "") return null;
  const value = new URLSearchParams(query).get("found");
  if (value === null) return null;
  const ids = value.split(",").map((id) => id.trim().toLowerCase());
  if (ids.length === 0 || ids.length > 3 || !ids.every((id) => UUID.test(id))) return null;
  return ids;
}

/**
 * The story a redirect says a buzz just counted for, or null.
 *
 * A kept tap sends the reader to `#w-<story>`, and a fragment never reaches
 * a server, so the story travels in the query string as well. It is what
 * lets the sentence that says a buzz counted carry an Undo button for the
 * one request that follows it. Shaped like ours or refused, the way a found
 * identifier is: it is written into a form on the page.
 */
export function tappedOnFrom(query: string | undefined): string | null {
  if (query === undefined || query === "") return null;
  const value = new URLSearchParams(query).get("on");
  if (value === null) return null;
  const id = value.trim().toLowerCase();
  return UUID.test(id) ? id : null;
}

/** The tap a redirect says just happened, or null. Bounded like a posted tap: it permits one fresh read. */
export function tappedFrom(query: string | undefined): Tapped | null {
  if (query === undefined || query === "") return null;
  const value = new URLSearchParams(query).get("tapped");
  if (value === null || !TAPPED.has(value)) return null;
  return value as Tapped;
}

async function castWebBoost(storyId: string, token: string): Promise<Tapped> {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) return "failed";
  try {
    const response = await fetch(`${projectBase()}/rest/v1/rpc/wall_cast_web_boost`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ story_id_in: storyId, voter_token_in: token }),
    });
    if (!response.ok) return "failed";
    const answer = (await response.json()) as { result?: unknown };
    const result = typeof answer?.result === "string" ? answer.result : "";
    if (result === "no_story" || result === "bad_token") return "bad";
    // A word this server does not know is our end failing to keep up with
    // the database, not a fact about the tap.
    return TAPPED.has(result) ? result as Tapped : "failed";
  } catch {
    return "failed";
  }
}

/**
 * Ask the database to take one buzz back.
 *
 * It decides. The thirty second window, the caller match and the sealed
 * check all live in wall_forget_boost, so there is nothing here to get out
 * of step with them, which is the reasoning unrecord gives for the
 * remembrance answers. The token is the identity, the same one that cast it.
 */
async function forgetWebBoost(storyId: string, token: string): Promise<Tapped> {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) return "failed";
  try {
    const response = await fetch(`${projectBase()}/rest/v1/rpc/wall_forget_boost`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ story_id_in: storyId, voter_token_in: token }),
    });
    if (!response.ok) return "failed";
    const answer = (await response.json()) as { result?: unknown };
    const result = typeof answer?.result === "string" ? answer.result : "";
    if (result === "no_story" || result === "bad_token") return "bad";
    // A word this server does not know is our end failing to keep up with
    // the database, never a claim about the buzz.
    return TAPPED.has(result) ? result as Tapped : "failed";
  } catch {
    return "failed";
  }
}

/**
 * What this browser has on this wall date: taps left today and the stories
 * it backed. Null on any failure, which costs the reader their marks and
 * the count for one page view and nothing else.
 */
async function wallStanding(wallDate: string, token: string | null): Promise<{ left: number; allowance: number; backed: string[]; anniversary: Anniversary[] } | null> {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) return null;
  try {
    const response = await fetch(`${projectBase()}/rest/v1/rpc/wall_web_standing`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ wall_date_in: wallDate, voter_token_in: token }),
    });
    if (!response.ok) return null;
    const answer = (await response.json()) as { left?: unknown; allowance?: unknown; backed?: unknown; anniversary?: unknown };
    if (typeof answer?.left !== "number" || typeof answer?.allowance !== "number" || !Array.isArray(answer?.backed)) return null;
    // The anniversary is newer than some deployed copies of the function, so
    // its absence is an empty list and never a failed read: a reader whose
    // project has not run the migration loses a memory, not a page.
    const anniversary = Array.isArray(answer?.anniversary)
      ? answer.anniversary.flatMap((row): Anniversary[] => {
        if (typeof row !== "object" || row === null) return [];
        const { story_id: id, headline, wall_date: date } = row as Record<string, unknown>;
        if (typeof id !== "string" || !UUID.test(id)) return [];
        if (typeof headline !== "string" || headline === "") return [];
        if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
        return [{ storyId: id, headline, wallDate: date }];
      })
      : [];
    return {
      left: answer.left, allowance: answer.allowance,
      backed: answer.backed.filter((b): b is string => typeof b === "string"),
      anniversary,
    };
  } catch {
    return null;
  }
}

async function handle(
  root: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const method = request.method ?? "GET";
  const [path = "/", query] = (request.url ?? "/").split("?");

  // The health check, answered before anything else and depending on nothing.
  // Render holds a deploy until this returns 200, so it must not rest on a
  // file existing, on today's page having been built, or on any module beyond
  // this function. Pointing the check at "/" made a healthy server look dead
  // whenever the page behind "/" was not there.
  if (path === "/healthz") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY });
    response.end(method === "HEAD" ? undefined : "ok");
    return;
  }

  // POST reaches exactly one address and every other verb on every other path
  // is still refused. The allow header names the truth per path rather than
  // advertising POST across a site where it means nothing.
  const posts = path === "/year" || path === "/boost" || path === "/unboost"
    || path === "/find";
  if (method !== "GET" && method !== "HEAD" && !(method === "POST" && posts)) {
    response.writeHead(405, {
      Allow: posts ? "POST" : "GET, HEAD",
      ...SECURITY,
    }).end();
    return;
  }

  // The one thing this site asks a reader about themselves, saved once.  // The one thing this site asks a reader about themselves, saved once.
  //
  // Its own address rather than a field on the 150 answer forms, because a
  // control outside a form cannot reach into one without a script and this
  // site runs none. The year is bounded here and again in yearFromCookie, so
  // a hand edited cookie is no year rather than an answer the database refuses
  // for reasons nobody can see.
  if (method === "POST" && path === "/year") {
    const body = await readBody(request);
    const form = new URLSearchParams(body);
    const year = Number(form.get("y"));
    const month = Number(form.get("m"));
    const day = Number(form.get("d"));
    const good = Number.isInteger(year) && year >= 1900 && year <= 2100;
    const back = Number.isInteger(month) && Number.isInteger(day)
      && month >= 1 && month <= 12 && day >= 1 && day <= 31
      ? `/${slug(month, day)}/`
      : "/";

    const cookie = good
      ? `${YEAR_COOKIE}=${year}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`
      // Choosing the blank option clears it, which is the only way off this
      // site to change your mind, and a reader who has one should have one.
      : `${YEAR_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`;

    response.writeHead(303, {
      Location: back,
      "Cache-Control": "no-store",
      "Set-Cookie": cookie,
      ...SECURITY,
    });
    response.end();
    return;
  }

  // One tap on the wall. docs/the-wall.md section 13.
  //
  // The shape the remembrance answer had, exactly: the token cookie is the
  // identity, a reader with none gets one on this tap, the address is limited
  // before the database is touched, the database decides in one word, and
  // the answer is a redirect back to the date page carrying the word in the
  // query string, which permits the one fresh wall read on the way back,
  // and in the fragment, which reveals the sentence for it.
  //
  // The trade, named: a cookie is not a person. Anybody who clears one is a
  // new voter and can tap again, and there is no honest way around that
  // without an account, which reading here must never require. It is the
  // same trade the answers make, it is bounded by underLimit and by the
  // three unit budget in the database, and it is why every web boost is
  // recorded as web_token rather than attested.
  if (method === "POST" && path === "/boost") {
    const address = String(request.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim()
      || request.socket.remoteAddress || "unknown";
    const token = tokenFromCookie(request.headers.cookie) ?? newToken();
    let tap: Tap | null = null;
    try {
      tap = readTap(await readBody(request));
    } catch {
      tap = null;
    }
    if (tap === null || !underLimit(address)) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY });
      response.end("No.\n");
      return;
    }
    const said = await castWebBoost(tap.storyId, token);
    const where = tap.back === "hive"
      ? hivePath(tap.month, tap.day)
      : tap.back === "receipt"
        ? `/${slug(tap.month, tap.day)}/wall/${tap.storyId}/`
        : `/${slug(tap.month, tap.day)}/`;
    // A tap that counted lands on the story it counted for, so the tile
    // reads as changed through :target and the page scrolls to it. The
    // sentence for it is revealed by a :has rule in the stylesheet rather
    // than by the fragment, which can only name one element. Every other
    // word lands on its sentence as before, because there is nothing on the
    // board to show for it.
    const fragment = said === "kept" ? `w-${tap.storyId}` : TAP_FRAGMENT[said];
    // A buzz that counted also names its story in the query string, because
    // the fragment above never reaches this server on the way back and the
    // Undo button has to know what it is undoing. Only for a buzz that
    // counted: there is nothing to take back after any other word.
    const on = said === "kept" ? `&on=${tap.storyId}` : "";
    response.writeHead(303, {
      Location: `${where}?tapped=${said}${on}#${fragment}`,
      "Cache-Control": "no-store",
      "Set-Cookie": `${TOKEN_COOKIE}=${token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`,
      ...SECURITY,
    });
    response.end();
    return;
  }

  // Taking one buzz back, for thirty seconds after casting it.
  // docs/the-wall.md, the last entry in section 16.
  //
  // /boost's shape exactly, and deliberately so: the same posted fields, the
  // same token cookie as the identity, the same per address limit before the
  // database is touched, the same one word answer, and the same redirect
  // carrying that word in the query string, which permits the one fresh wall
  // read, and in the fragment, which reveals the sentence for it.
  //
  // The window is not checked here. wall_forget_boost checks it, and matches
  // on the caller as well as on the story, so this cannot reach a buzz
  // somebody else cast however the form is edited. A reader with no token has
  // cast nothing, so unlike /boost this mints none and sets no cookie: there
  // is nothing for a fresh browser to take back.
  if (method === "POST" && path === "/unboost") {
    const address = String(request.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim()
      || request.socket.remoteAddress || "unknown";
    const token = tokenFromCookie(request.headers.cookie);
    let tap: Tap | null = null;
    try {
      tap = readTap(await readBody(request));
    } catch {
      tap = null;
    }
    if (tap === null || token === null || !underLimit(address)) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY });
      response.end("No.\n");
      return;
    }
    const said = await forgetWebBoost(tap.storyId, token);
    const where = tap.back === "hive"
      ? hivePath(tap.month, tap.day)
      : tap.back === "receipt"
        ? `/${slug(tap.month, tap.day)}/wall/${tap.storyId}/`
        : `/${slug(tap.month, tap.day)}/`;
    response.writeHead(303, {
      Location: `${where}?tapped=${said}#${TAP_FRAGMENT[said]}`,
      "Cache-Control": "no-store",
      ...SECURITY,
    });
    response.end();
    return;
  }

  // The typed field. docs/the-wall.md section 15.
  //
  // The shape of /boost up to the point where /boost spends something: a
  // plain form, a malformed post refused as a 400 before anything is read,
  // a flood from one address refused before the wall is touched. Then the
  // phrase is matched, in memory, against the stories this server has
  // already read for the date, and the answer is a redirect back to the
  // date page. A find spends nothing, so no token is minted here and no
  // cookie is set: the buzz that may follow goes through /boost, which
  // does both.
  //
  // The phrase travels in the post body and nowhere else. The redirect
  // carries story identifiers, or a bare fragment for a miss, so what a
  // person typed never lands in an address or a request log. Whether it
  // should ever be kept is Nathan's call, section 15, and until it is made
  // the answer here is that it is not.
  if (method === "POST" && path === "/find") {
    const address = String(request.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim()
      || request.socket.remoteAddress || "unknown";
    let ask: Ask | null = null;
    try {
      ask = readAsk(await readBody(request));
    } catch {
      ask = null;
    }
    if (ask === null || !underLimit(address)) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY });
      response.end("No.\n");
      return;
    }
    const where = `/${slug(ask.month, ask.day)}/`;
    // The cached read is the right one: nothing is spent on a find, and the
    // reader confirms against the same wall the page just showed them.
    const wall = await liveWall(ask.month, ask.day, Date.now(), false, false);
    let location: string;
    if (wall === null) {
      // A date that is not open, or a wall this end could not read. The
      // sentence says both, because from here they are the same thing:
      // nothing to search.
      location = `${where}#wnofind`;
    } else {
      const found = findAnswer(ask.q, wall.day.stories);
      location = found.kind === "blank"
        ? `${where}#wblank`
        : found.kind === "miss"
          ? `${where}#wmiss`
          : found.kind === "one"
            ? `${where}?found=${found.match.story.id}#wfound`
            : `${where}?found=${found.matches.map((m) => m.story.id).join(",")}#wfound`;
    }
    response.writeHead(303, {
      Location: location,
      "Cache-Control": "no-store",
      ...SECURITY,
    });
    response.end();
    return;
  }

  // Answered before the disk is touched, because neither of these is a file.  // Answered before the disk is touched, because neither of these is a file.
  // Never stored: a cached "today" is wrong by tomorrow morning, and a cached
  // "random" is the same date for everybody who asks after the first one.
  const redirect = redirectFor(path);
  if (redirect !== null) {
    response.writeHead(302, {
      Location: redirect,
      "Cache-Control": "no-store",
      ...securityFor(path),
    });
    response.end();
    return;
  }

  // A reader's own picture of a hive.
  //
  // Rendered ahead of time, one per birth year on the dates whose hive is
  // near enough to today to be worth sharing, and picked here by the `by`
  // cookie. No browser runs in this process: Chromium wants more memory
  // sitting idle than this instance has in total, and the render would land
  // on the one process that serves every page.
  //
  // Answered `no-store`, and the address names only the date, so nothing a
  // reader could copy, and nothing in a log or a referrer, carries the year.
  // A request with no year, or one on a date with no picture rendered, gets
  // the plain square instead of a miss, so the link under the board is never
  // broken.
  const wanted = method === "GET" || method === "HEAD" ? pictureFor(path) : null;
  if (wanted !== null) {
    const born = yearFromCookie(request.headers.cookie);
    const wallDate = openWallDates(Date.now()).get(wallKey(wanted.month, wanted.day));
    const mine = born === null || wallDate === undefined
      ? null
      : await fileFor(join(personalRoot(), `${personalName(wallDate, born)}.png`));
    if (mine !== null) {
      response.writeHead(200, {
        "Content-Type": "image/png",
        // One reader's own, like their marks and their anniversary.
        "Cache-Control": "no-store",
        Vary: "Cookie",
        ...securityFor(path),
      });
      if (method === "HEAD") { response.end(); return; }
      createReadStream(mine).pipe(response);
      return;
    }
    const plain = await fileFor(resolve(join(root, "og", `${slug(wanted.month, wanted.day)}-square.png`)));
    if (plain !== null) {
      response.writeHead(200, {
        "Content-Type": "image/png",
        // The shared picture. One address answers two bodies here, so the
        // cache has to be told what decides which, or a reader who looks
        // before giving a year keeps the shared square for an hour and their
        // own picture never arrives. must-revalidate for the same reason.
        "Cache-Control": "public, max-age=3600, must-revalidate",
        Vary: "Cookie",
        ...securityFor(path),
      });
      if (method === "HEAD") { response.end(); return; }
      createReadStream(plain).pipe(response);
      return;
    }
  }

  if (path === "/today.css") {
    response.writeHead(200, {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": cacheControl(path),
      ...securityFor(path),
    });
    response.end(method === "HEAD" ? undefined : todayStylesheet());
    return;
  }

  // The root, answered with today's date page. Falls through to the ordinary
  // file lookup when that date has not been built, which leaves index.html as
  // the answer rather than a 404.
  //
  // Answered by asking for the dated address, not by sending its file. The
  // first version sent the file, which is the baked page, so "/" showed the
  // hive as the build saw it while /september-10/ two clicks away showed the
  // hive as it is, with the live wall swapped in, the reader's own marks and
  // the buzz buttons. The front door was the one address on the site that
  // never got today's board. Everything below that knows what to do with a
  // date path now gets to do it for the root too.
  if (path === "/" || path === "/index.html") {
    const today = await fileFor(join(root, todaySlug()));
    if (today !== null) {
      request.url = `/${todaySlug()}/${query === undefined ? "" : `?${query}`}`;
      return handle(root, request, response);
    }
  }

  // A receipt on an open date, drawn from the wall as it is right now. The
  // baked receipts are a build old: a story filed since the deploy has none,
  // and a check run since the deploy is not on the one it has. The three
  // open dates are already read and cached for the date page, so their
  // receipts cost nothing extra to draw live, and the buzz control is on
  // them for the reader who came to read the sources before deciding. A
  // sealed date's receipt is the baked file, which is final.
  const receipt = method === "GET" || method === "HEAD" ? receiptFor(path) : null;
  if (receipt !== null) {
    const now = Date.now();
    const tapped = tappedFrom(query);
    const address = String(request.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim()
      || request.socket.remoteAddress || "unknown";
    const fresh = tapped !== null && underLimit(address);
    const wall = await liveWall(receipt.month, receipt.day, now, fresh, false);
    const story = wall?.day.stories.find((s) => s.id === receipt.id);
    // A buzz cast from a receipt comes back to that receipt, so the Undo
    // button belongs on it too. It is only ever this story: a receipt is one
    // story's page and the redirect that reached it named the same one.
    //
    // Gated on the word as well as the story, the way the date page is. Read
    // from the query alone, `?on=` drew an Undo button for anybody handed the
    // address on a page they had tapped nothing on, which is the thing
    // undoForm's own note says must never happen. The database still refuses
    // a stranger, so this was a lying control rather than a hole.
    const undoOn = tapped === "kept" ? tappedOnFrom(query) : null;
    if (wall !== undefined && wall !== null && story !== undefined) {
      const token = tokenFromCookie(request.headers.cookie);
      const standing = token === null ? null : await wallStanding(wall.day.wallDate, token);
      const marks = standing === null ? "" : wallMarks(standing, wall.day, now);
      const undo = undoOn !== null && undoOn === story.id ? story : null;
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        // Never stored when the page carries anything that is one reader's
        // own, which is their marks or their Undo button. Deciding on the
        // marks alone would hand a shared cache a page with an Undo form on
        // it whenever the standing read failed.
        "Cache-Control": marks === "" && undo === null ? "public, max-age=20, must-revalidate" : "no-store",
        ...securityFor(path),
      });
      // The checks are read for this one story here, because the day's
      // read leaves them out; see fetchWallDay.
      const key = process.env.SUPABASE_ANON_KEY ?? "";
      const told = method === "HEAD" ? story : await withChecks(projectBase(), key, story, WALL_TIMEOUT_MS);
      response.end(method === "HEAD" ? undefined : renderStoryPage(told, wall.day, now, { interactive: true, undo }) + marks);
      return;
    }
  }

  const full = resolvePath(root, path);
  // Nothing inside the readers' own pictures is ever served as a file, even
  // if somebody points the two roots at the same place.
  //
  // The default layout already puts that folder outside the site root, so
  // this changes nothing in production. It is here because "outside the site
  // root" is a fact about two environment variables, and a deployment that
  // got them wrong would hand out every reader's picture with no error
  // anywhere to notice it by, which is the same shape as the policy header
  // that contradicted its page. A rule beats an arrangement.
  const inPersonal = full !== null && (full === personalRoot() || full.startsWith(personalRoot() + sep));
  const file = full === null || inPersonal ? null : await fileFor(full);

  if (file !== null) {
    // Your own marks, on a date you have answered before.    // Your own marks, on a date you have answered before.
    //
    // Only for a request that carries a token, which means only for somebody
    // who has answered something somewhere, so the ordinary visitor still gets
    // a file off disk and nothing else. When the call fails, or the reader has
    // said nothing about this date, marks is "" and the page is served exactly
    // as it was built. That is the same bargain the result path makes: an
    // outage costs a mark, never a site.
    // Either cookie is a reason to write something into the page: the token
    // brings a reader's own answers back, and the birth year puts the picker
    // away. Gating both on the token was wrong, because somebody can tell the
    // site their year before they ever answer anything, and then be asked for
    // it again on every page.
    // Since September 10, 2026 the only marks are the hive's: the year
    // picker and the remembrance answers are off the page, so the by cookie
    // and my_answers are no longer read on the way in. yearMarks stays
    // below, unused, with the route that still answers /year.
    const readable = method === "GET" && file.endsWith(".html");
    const token = readable ? tokenFromCookie(request.headers.cookie) : null;
    // The birth year is read again, for one thing only: the label on the save
    // link, because a reader who has given a year gets their own picture at
    // that address and the link should say so.
    const born = readable ? yearFromCookie(request.headers.cookie) : null;
    // The one request that follows a tap. It is allowed a fresh wall read,
    // past the twenty second cache, so the count and the mark the reader
    // just made are on the page they land on. Rate limited per address like
    // the tap itself, and like ?kept=.
    const tapped = readable ? tappedFrom(query) : null;
    const fresh = tapped !== null && underLimit(
      String(request.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim() || request.socket.remoteAddress || "unknown",
    );
    // The one request that follows a find. It carries the identifiers the
    // matcher chose, and the section is drawn with the confirmation for
    // them. Nothing was spent, so the cached wall is the right one, and no
    // token is needed: a browser that has never buzzed can find.
    const found = readable ? foundFrom(query) : null;
    // The story a buzz just counted for, so the sentence that says it
    // counted can carry the Undo button for the one request that follows.
    const undoOn = readable && tapped === "kept" ? tappedOnFrom(query) : null;
    const marked = token === null && tapped === null && found === null && born === null ? null : dateFor(path);
    if (marked !== null) {
      const now = Date.now();
      // The reader's own buzzes are read before the section rather than after
      // it, because the section now depends on one of them: the anniversary
      // is drawn into it, not written over it as a style rule. The wall date
      // comes from the clock rather than from the read, which is where
      // liveWall gets it too, so this costs no extra round trip.
      //
      // The count and the marks are still a style block on top, because the
      // section they land on is the shared one and they are one reader's
      // alone. Section 13.
      const wallDate = openWallDates(now).get(wallKey(marked.month, marked.day));
      const standing = wallDate !== undefined && token !== null ? await wallStanding(wallDate, token) : null;
      const wall = await liveWall(
        marked.month, marked.day, now, fresh, marked.hive, found, undoOn, standing?.anniversary ?? [],
      );
      let marks = "";
      // The reader's own taps and count, for a browser that has a token and
      // a date whose wall is open. A browser with no token yet sees the
      // section's own words, which are right for a browser that has done
      // nothing.
      if (wall !== null && standing !== null) {
        marks += wallMarks(standing, wall.day, now);
      }
      // And the label on the save link, but only when the picture it promises
      // is actually on disk for this reader.
      //
      // The label is decided from live state and the file behind it is a
      // build artefact, and the two drift: the pictures are rendered for the
      // dates within three days of the build, so four days after a deploy
      // there are none for today, and the years rendered are 1930 to 2020
      // while the cookie accepts 1900 to 2100. Promising a reader their own
      // version and handing them the shared square is a small lie told in
      // the one place this feature is visible, so the promise is made only
      // when the file is there. One stat, on a request that is already
      // reading the wall.
      if (wall !== null && born !== null && wallDate !== undefined) {
        const mine = await fileFor(join(personalRoot(), `${personalName(wallDate, born)}.png`));
        if (mine !== null) marks += yoursMark(slug(marked.month, marked.day), born);
      }
      // An anniversary is reason enough to draw this reader their own page,
      // even on a date they have done nothing on today: it is the whole of
      // what they came back for.
      const anniversary = (standing?.anniversary.length ?? 0) > 0;
      // A year alone is reason enough: without this a reader who has given
      // one and done nothing else is handed the shared page, and their link
      // says "Save this picture" while the address gives them their own.
      if (marks !== "" || anniversary || tapped !== null || found !== null) {
        let html: string | null = null;
        try {
          html = await readFile(file, "utf8");
        } catch {
          html = null;
        }
        if (html !== null) {
          response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            // Never stored. It is one reader's own answers and it is wrong for
            // everybody else who would be handed the cached copy.
            "Cache-Control": "no-store",
            ...securityFor(path),
          });
          response.end(method === "HEAD" ? undefined : withWall(html, wall?.section ?? null) + marks);
          return;
        }
      }
    }
    // An open date, for everybody: the page off disk with the wall as it is
    // right now swapped in. Only when the read succeeded; otherwise the file
    // is streamed exactly as built, below.
    const open = readable ? dateFor(path) : null;
    if (open !== null) {
      const wall = (await liveWall(open.month, open.day, Date.now(), false, open.hive))?.section ?? null;
      if (wall !== null) {
        let html: string | null = null;
        try {
          html = await readFile(file, "utf8");
        } catch {
          html = null;
        }
        if (html !== null) {
          response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            // Briefly. The wall moves by the quarter hour and this is the
            // same for every reader, so a short shared cache is right. Vary,
            // because the reader's own copy of this page is decided by their
            // cookies and a shared cache must not hand this one to them.
            "Cache-Control": "public, max-age=20, must-revalidate",
            Vary: "Cookie",
            ...securityFor(path),
          });
          response.end(method === "HEAD" ? undefined : withWall(html, wall));
          return;
        }
      }
    }
    send(response, 200, file, path, method === "HEAD");
    return;
  }

  // A real 404, with the status to match. Answering an unknown path with 200
  // is how a site teaches a crawler that every misspelling of a date is a
  // page worth having.
  const notFound = await fileFor(join(root, "404.html"));
  if (notFound !== null) {
    send(response, 404, notFound, "/404.html", method === "HEAD");
    return;
  }
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY });
  response.end(method === "HEAD" ? undefined : "Not found\n");
}

/**
 * The year picker, put away once the year is in a cookie.
 *
 * The site asks "born in?" on every date page, and kept asking after it had
 * been told, which is the site not listening. It knows: it set that cookie on
 * /year and reads it on the way back in.
 *
 * The picker is hidden rather than removed, and the line that replaces it links
 * to it, so `:target` brings it back out. That is the whole way to change your
 * mind and it needs no script and no second page.
 *
 * Written with the same `.on-<date>` prefix today.css uses, because today.css
 * is what revealed the picker in the first place and an unprefixed rule loses
 * to it on specificity. This block is later in the document, so an equal rule
 * wins.
 */
/**
 * The one rule that changes the label on the save link under the board.
 *
 * A reader who has told the site their birth year gets their own picture at
 * the same address, so the link says so. Both labels are baked into the
 * shared page and this reveals the right one, which is the shape the count
 * and the marks already use: everything written here is generated text, never
 * a source's words, so it is safe inside a style block.
 *
 * Empty for a reader with no year, and the page keeps the words it was built
 * with.
 */
export function yoursMark(dateSlug: string, year: number | null): string {
  if (year === null) return "";
  return `<style class="wyours">.on-${dateSlug} .wsaveall{display:none}.on-${dateSlug} .wsavemine{display:inline}</style>`;
}

export function yearMarks(slug: string, year: number | null): string {
  if (year === null) return "";
  const decade = `${Math.floor(year / 10) * 10}s`;
  return `.on-${slug} .yearask{display:none}` +
    `.on-${slug} .yearask:target{display:block}` +
    `.on-${slug} .yearset{display:block}` +
    `.on-${slug} .yearask:target ~ .yearset,.on-${slug} .yearset:has(~ .yearask:target){display:none}` +
    `.on-${slug} .yearsetv::after{content:"the ${decade}"}`;
}

/**
 * A baked page with one row's result written into it, or null.
 *
 * Null on every failure there is: a path that is not a date, a row nobody has
 * answered, a database that did not reply, a page built before the result
 * paragraphs existed. The caller serves the file as built in all of those
 * cases, which is why an outage costs a result and not a site.
 *
 * The replacement is done with a function rather than a string so that a
 * result containing a dollar sign cannot be read as a capture group, which is
 * the kind of thing that works for a year and then meets one row.
 */
// ---------------------------------------------------------------------------
// The wall, fresh while its date is open.
//
// docs/the-wall.md section 12. Pages bake at build time, so a baked wall for
// an open date is the wall the build saw, and section 7 promises a reader
// watches the day take shape. For the three open dates, and only those, the
// page reads the wall at request time and the fresh section replaces the
// baked one between the markers wallSection writes. Every other date calls
// nothing, exactly as before.
//
// The bargain is the one withResult makes: when anything about the read
// fails, a slow answer, an outage, a missing key, the baked page is served
// untouched. A Supabase outage costs a stale wall for a quarter hour and
// never a site. One read per open date per twenty seconds, whatever the
// traffic, so a busy day on the wall is not a busy day for the database.
// ---------------------------------------------------------------------------

const WALL_FRESH_MS = 20_000;
const WALL_TIMEOUT_MS = 3000;

const wallCache = new Map<string, { at: number; day: WallDay | null }>();

/**
 * The fresh wall for a date page, as the section to swap in and the day it
 * was drawn from, or null to serve the page as built.
 *
 * The day is what is cached, and the section is drawn from it per request,
 * because the section now depends on the request: it carries tap forms
 * while the date takes boosts by the clock, and the clock moves. Drawing
 * is a hundred rows of string work; the read is the thing worth sharing.
 *
 * `fresh` skips the cache for the one request that follows a tap, so the
 * reader who just tapped sees the count they moved rather than the section
 * everybody else saw twenty seconds ago. It is permitted by the query
 * string and rate limited per address, the way ?kept= is.
 */
async function liveWall(
  month: number, day: number, now: number = Date.now(), fresh: boolean = false, hive: boolean = false,
  found: string[] | null = null, undoOn: string | null = null,
  anniversary: Anniversary[] = [],
): Promise<{ section: string; day: WallDay } | null> {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) return null;
  const wallDate = openWallDates(now).get(wallKey(month, day));
  if (wallDate === undefined) return null;

  const cached = wallCache.get(wallDate);
  let wall: WallDay | null;
  if (!fresh && cached !== undefined && now - cached.at < WALL_FRESH_MS) {
    wall = cached.day;
  } else {
    try {
      // No row yet is not a failure: it is tomorrow before anything has
      // landed, and tomorrow's page draws an empty square with the hour it
      // opens rather than nothing. A read that fails is null, and null is
      // the page as built.
      wall = (await fetchWallDay(projectBase(), key, wallDate, WALL_TIMEOUT_MS)) ?? emptyWallDay(wallDate);
    } catch {
      wall = null;
    }
    // A failure is remembered too, so an outage is asked about once every
    // twenty seconds rather than on every page view.
    wallCache.set(wallDate, { at: now, day: wall });
  }
  if (wall === null) return null;
  // The identifiers a find redirect carries, resolved against this wall in
  // the order the matcher gave them. One that is not on the date is dropped
  // rather than refused: the wall may have moved since the find.
  const read = wall;
  const stories = found === null
    ? undefined
    : found.map((id) => read.stories.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => s !== undefined);
  // The story a buzz just counted for, resolved against this wall. One that
  // is not on the date is dropped rather than refused, the way a find's is:
  // the button is a convenience and its absence costs the reader the window,
  // never the page.
  const undo = undoOn === null ? null : read.stories.find((s) => s.id === undoOn) ?? null;
  return {
    section: wallSection(wall, `${monthName(month)} ${day}`, now, { interactive: true, hive, date: { month, day }, found: stories, undo, anniversary }),
    day: wall,
  };
}

/** The page with the fresh wall in it, or the page as it was. */
export function withWall(html: string, section: string | null): string {
  if (section === null) return html;
  return replaceWall(html, section) ?? html;
}

/** For tests: forget every fresh wall. */
export function forgetWalls(): void {
  wallCache.clear();
}

/** The receipt a request path names, or null: "/september-9/wall/<uuid>/". */
export function receiptFor(requestPath: string): { month: number; day: number; id: string } | null {
  const match = /^\/([a-z]+-\d{1,2})\/wall\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?(?:index\.html)?$/.exec(requestPath);
  if (match === null) return null;
  for (const d of everyDate()) {
    if (slug(d.month, d.day) === match[1]) return { month: d.month, day: d.day, id: match[2]! };
  }
  return null;
}

/**
 * The date whose picture a request asks for, or null.
 *
 * One address a date, "/september-10/yours.png", and it never names a year.
 * What comes back depends on the `by` cookie the request carries and on
 * nothing else, which is why there is no year in the path to leave in a
 * link, a log or a referrer, and why the answer is `no-store`.
 */
export function pictureFor(requestPath: string): { month: number; day: number } | null {
  const match = /^\/([a-z]+-\d{1,2})\/yours\.png$/.exec(requestPath);
  if (match === null) return null;
  for (const d of everyDate()) {
    if (slug(d.month, d.day) === match[1]) return { month: d.month, day: d.day };
  }
  return null;
}

/** The date a request path names, or null. The hive page names its date too. */
function dateFor(requestPath: string): { month: number; day: number; hive: boolean } | null {
  for (const d of everyDate()) {
    const at = `/${slug(d.month, d.day)}`;
    if (requestPath === at || requestPath === `${at}/` || requestPath === `${at}/index.html`) return { month: d.month, day: d.day, hive: false };
    if (requestPath === `${at}/hive` || requestPath === `${at}/hive/` || requestPath === `${at}/hive/index.html`) return { month: d.month, day: d.day, hive: true };
  }
  return null;
}

/**
 * Reads the environment when it is called rather than when the module loads,/**
 * Reads the environment when it is called rather than when the module loads,
 * so a test can point it at a temporary directory and an unused port.
 */
export function start(options: { root?: string; port?: number } = {}): ReturnType<typeof createServer> {
  const root = resolve(options.root ?? process.env.SITE_ROOT ?? "out");
  const port = options.port ?? Number(process.env.PORT ?? 10000);

  const server = createServer((request, response) => {
    handle(root, request, response).catch((error: unknown) => {
      console.error(error);
      if (!response.headersSent) response.writeHead(500, SECURITY);
      response.end();
    });
  });
  // 0.0.0.0 rather than Node's default, which prefers IPv6 and can leave a
  // health checker knocking on IPv4 forever.
  server.listen(port, "0.0.0.0", () => console.log(`serving ${root} on ${port}`));
  // Render sends SIGTERM on deploy. Finish what is in flight and go.
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  return server;
}

// Only when run directly, so a test can import resolvePath without opening a
// socket.
const entry = process.argv[1] ?? "";
if (entry.endsWith("serve.js") || entry.endsWith("serve.ts")) start();
