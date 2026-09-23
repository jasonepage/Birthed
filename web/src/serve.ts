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
import { ASK_SLOTS, FIRST_CHART_YEAR, TODAY, renderCardPage, renderMePanel, renderRecord, renderStoryPage, withMe } from "./render.js";
import { SHARE_SCRIPT_SOURCE } from "./share-button.js";
import { ASK_MAX, easternMidnight, emptyWallDay, fetchWallDay, hiveDaysNav, openWallDates, pictureRules, picturedSubjects, combPictured, replaceWall, combPath, hivePath, takingBoosts, wallKey, wallMarks, wallSection, withChecks, type Anniversary, type RecordRow, type TapBack, type WallDay } from "./wall.js";
import { fetchSnapshotScores, liveHiveSection, type Standing } from "./hive-live.js";
import { pickFor, pickIndexFrom, pickPath, renderPickPage, PICK_MAX } from "./pick.js";
import { answer as findAnswer } from "./find.js";
import { fetchPictureFor, fetchPicturesFor, type StoredPicture } from "./stored-pictures.js";
import { personalName } from "./share.js";


const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".wav": "audio/wav",
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
    // img-src names the project's address as well as this one, since
    // September 11, 2026: the events' and the news stories' pictures live in
    // the project's public bucket, copied there by the worker,
    // stored-pictures.ts. Still no picture from Wikipedia, Commons or any
    // news site is loaded by a page.
    // media-src 'self' since September 22, 2026, for the one sound on the
    // site: the buzz, /buzz.wav, played by the page that follows a buzz.
    // font-src 'self' since the same day, for Fraunces on every page rather
    // than on the live hive alone. Without it the browser refuses the font
    // file silently and every page falls back to Georgia, which looks almost
    // right, which is the worst kind of wrong. serve.test.ts reads the header
    // for the same reason the /add lesson in CLAUDE.md gives: a header that
    // contradicts the page is invisible from the file on disk.
    `default-src 'none'; img-src 'self' ${projectBase()}; style-src 'unsafe-inline' 'self'; font-src 'self'; media-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
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

/**
 * The third: the full screen hive of a date that is taking buzzes.
 * docs/the-wall.md section 21. Two dates at most, today's and yesterday's by
 * the Eastern clock, which are the only dates a buzz can land on, keyed by
 * month and day the way openWallDates keys them. The header widens for the
 * hive path of those dates alone and only while they are live: a sealed
 * date's hive, tomorrow's hive and every date page keep the policy with no
 * script in it, and the baked hive page under this path carries no script
 * either, so a date that seals after a deploy serves a page that runs
 * nothing under a header that would have let it.
 */
export function liveHiveDates(now: number = Date.now()): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, wallDate] of openWallDates(now)) {
    if (now >= easternMidnight(wallDate)) out.set(key, wallDate);
  }
  return out;
}

/** The live hive a request path names, or null: "/september-11/hive/" while September 11 is taking buzzes. */
export function liveHivePathFor(requestPath: string, now: number = Date.now()): { month: number; day: number; wallDate: string } | null {
  const at = dateFor(requestPath);
  if (at === null || !at.hive) return null;
  const wallDate = liveHiveDates(now).get(wallKey(at.month, at.day));
  return wallDate === undefined ? null : { month: at.month, day: at.day, wallDate };
}

export function securityFor(requestPath: string, now: number = Date.now()): Record<string, string> {
  // The live hive: its own script, a socket to the project and a buzz posted
  // to this origin, the font served from this origin. Nothing else moves:
  // pictures still come from here and the project, a form still posts here
  // and nowhere else. The socket is named as wss: as well as https: because
  // an older browser reads a https: source as https: only.
  if (liveHivePathFor(requestPath, now) !== null) {
    return {
      ...SECURITY,
      "Content-Security-Policy":
        `default-src 'none'; img-src 'self' ${projectBase()}; style-src 'unsafe-inline' 'self'; font-src 'self'; ` +
        `script-src 'unsafe-inline'; connect-src 'self' ${apiOrigin()} ${apiOrigin().replace(/^https:/, "wss:")}; ` +
        "base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    };
  }
  // A story's receipt and a reader's card: the share script and nothing else,
  // named by its hash, so a receipt, which prints a source's words, can run
  // this one script and no other even if an escape were ever missed. The one
  // request it makes is for the card's picture, from this origin.
  // share-button.ts. September 22, 2026.
  if (receiptFor(requestPath) !== null || cardFor(requestPath) !== null) {
    return {
      ...SECURITY,
      "Content-Security-Policy":
        `default-src 'none'; img-src 'self' ${projectBase()}; style-src 'unsafe-inline' 'self'; font-src 'self'; media-src 'self'; ` +
        `script-src ${SHARE_SCRIPT_SOURCE}; connect-src 'self'; ` +
        "base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    };
  }
  const isAdd = SCRIPTED.some(
    (path) => requestPath === path || requestPath.startsWith(`${path}/`),
  );
  if (!isAdd) return SECURITY;
  return {
    ...SECURITY,
    "Content-Security-Policy":
      `default-src 'none'; img-src 'self' ${projectBase()}; style-src 'unsafe-inline' 'self'; font-src 'self'; ` +
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

  // The bar's pill says Every date and the page is /calendar/, so people
  // type the words they read. Hana did, September 22, 2026, and got a 404.
  if (path === "/every-date" || path === "/every-day") return "/calendar/";

  // The card page is off for now, September 22, 2026. Anybody holding a
  // link to one lands on its date instead of a picture that was not ready.
  const card = /^\/([a-z]+-\d{1,2})\/card$/.exec(path);
  if (card !== null && everyDate().some((d) => slug(d.month, d.day) === card[1])) return `/${card[1]}/`;

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
 * The birthday this browser saved: always a year, and a month and day when
 * the reader gave them.
 *
 * Until September 22, 2026 the cookie held the year alone, so the site could
 * not tell the reader's own date from any other and wrote "Your September 22"
 * over whichever date was open. It now holds the whole birthday as
 * yyyy-mm-dd. A cookie from before then still reads, as a year with no month
 * and no day, and every page that uses it says only what a year can support.
 *
 * Bounded by the same 1900 to 2100 the database column checks, and the month
 * and day must be a real date in that year, so a hand edited cookie is no
 * birthday rather than an answer that draws nonsense.
 */
export interface Birthday {
  year: number;
  month: number | null;
  day: number | null;
}

export function birthdayFromValue(raw: string): Birthday | null {
  const value = raw.trim();
  const whole = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (whole !== null) {
    const year = Number(whole[1]);
    const month = Number(whole[2]);
    const day = Number(whole[3]);
    if (year < 1900 || year > 2100 || !realDate(year, month, day)) return null;
    return { year, month, day };
  }
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 1900 && year <= 2100 ? { year, month: null, day: null } : null;
}

export function birthdayFromCookie(header: string | undefined): Birthday | null {
  for (const part of (header ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === YEAR_COOKIE) return birthdayFromValue(rest.join("="));
  }
  return null;
}

/** The birth year alone, for the pictures, which are rendered one per year. */
export function yearFromCookie(header: string | undefined): number | null {
  return birthdayFromCookie(header)?.year ?? null;
}

/** Whether a month and day exist in a year. February 29 only in a leap year. */
function realDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) return false;
  const at = new Date(Date.UTC(year, month - 1, day));
  return at.getUTCMonth() === month - 1 && at.getUTCDate() === day;
}

/** What the cookie holds for a birthday: yyyy-mm-dd, or the year alone when the date is not a real one. */
export function birthdayCookieValue(year: number, month: number, day: number): string {
  if (!realDate(year, month, day)) return String(year);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
  /** Where the reader is sent back to: the date page, the full screen hive, the story's receipt, the comb, or the pick page. */
  back: TapBack;
  /** The pair the pick page was showing, carried back so the reader lands on the same place in the list. Nought elsewhere. */
  pick: number;
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
  const p = Number(form.get("p") ?? "0");
  // A hand made post with a pair index out of range is answered from the
  // top of the list rather than refused: the index is a place to come back
  // to and nothing the database is told.
  const pick = Number.isInteger(p) && p >= 0 && p <= PICK_MAX ? p : 0;
  return { storyId, month, day, back: v === "hive" || v === "receipt" || v === "comb" || v === "pick" ? v : "day", pick };
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

/**
 * What the page's script is told after a buzz or an undo, on a post that
 * asked for JSON: the database's word, the story's count, and this
 * browser's standing, each only when the database gave it. Nothing else the
 * function returned reaches the page, and the identifier of the boost row is
 * there so the row's own arrival over the socket is recognised as this one.
 */
export function jsonAnswer(said: Tapped, answer: Record<string, unknown> | null): Record<string, unknown> {
  const out: Record<string, unknown> = { result: said };
  if (answer === null) return out;
  if (typeof answer.support === "number") out.support = answer.support;
  if (typeof answer.left === "number") out.left = answer.left;
  if (typeof answer.allowance === "number") out.allowance = answer.allowance;
  if (Array.isArray(answer.backed)) out.backed = answer.backed.filter((b): b is string => typeof b === "string" && UUID.test(b));
  if (typeof answer.boost_id === "number" || typeof answer.boost_id === "string") out.boost_id = answer.boost_id;
  return out;
}

/** True when the request asked for a JSON answer rather than a redirect: the live hive's script does, and nothing else on the site. */
function wantsJson(request: IncomingMessage): boolean {
  return /\bapplication\/json\b/i.test(String(request.headers.accept ?? ""));
}

async function castWebBoost(storyId: string, token: string): Promise<Tapped> {
  return (await castWebBoostAnswer(storyId, token)).said;
}

async function castWebBoostAnswer(storyId: string, token: string): Promise<{ said: Tapped; answer: Record<string, unknown> | null }> {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) return { said: "failed", answer: null };
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
    if (!response.ok) return { said: "failed", answer: null };
    const answer = (await response.json()) as Record<string, unknown>;
    const result = typeof answer?.result === "string" ? answer.result : "";
    if (result === "no_story" || result === "bad_token") return { said: "bad", answer };
    // A word this server does not know is our end failing to keep up with
    // the database, not a fact about the tap.
    return { said: TAPPED.has(result) ? result as Tapped : "failed", answer };
  } catch {
    return { said: "failed", answer: null };
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
async function forgetWebBoost(storyId: string, token: string): Promise<{ said: Tapped; answer: Record<string, unknown> | null }> {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) return { said: "failed", answer: null };
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
    if (!response.ok) return { said: "failed", answer: null };
    const answer = (await response.json()) as Record<string, unknown>;
    const result = typeof answer?.result === "string" ? answer.result : "";
    if (result === "no_story" || result === "bad_token") return { said: "bad", answer };
    // A word this server does not know is our end failing to keep up with
    // the database, never a claim about the buzz.
    return { said: TAPPED.has(result) ? result as Tapped : "failed", answer };
  } catch {
    return { said: "failed", answer: null };
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

/**
 * Every story this browser has buzzed, with what became of each.
 * docs/the-wall.md section 25.
 *
 * Null on any failure, which costs the reader the page rather than a wrong
 * one: an empty record and an outage look the same from here, and telling
 * somebody they have buzzed nothing when the database is down is the one
 * answer this page must not give.
 *
 * Every row is checked before it is drawn, the way the anniversary's are. A
 * headline reaches the page as the source's own wording, so it is escaped
 * where it is drawn and never goes inside a style rule; that is the rule
 * anniversaryBlock was moved out of wallMarks for.
 */
async function wallRecord(token: string | null): Promise<RecordRow[] | null> {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key || token === null) return null;
  try {
    const response = await fetch(`${projectBase()}/rest/v1/rpc/wall_web_record`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ voter_token_in: token }),
    });
    if (!response.ok) return null;
    const answer = (await response.json()) as { buzzes?: unknown };
    if (!Array.isArray(answer?.buzzes)) return null;
    return answer.buzzes.flatMap((row): RecordRow[] => {
      if (typeof row !== "object" || row === null) return [];
      const { story_id: id, headline, wall_date: date, sealed, status, outcome } = row as Record<string, unknown>;
      if (typeof id !== "string" || !UUID.test(id)) return [];
      if (typeof headline !== "string" || headline === "") return [];
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
      if (typeof status !== "string") return [];
      const verdict = outcome === "held" || outcome === "false" || outcome === "forgotten" ? outcome : null;
      return [{ storyId: id, headline, wallDate: date, sealed: sealed === true, status, outcome: verdict }];
    });
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

    // The whole birthday, since September 22, 2026, so the page can tell the
    // reader's own date from every other one. It stays in this browser and
    // comes back with each request; nothing here writes it anywhere.
    const cookie = good
      ? `${YEAR_COOKIE}=${birthdayCookieValue(year, month, day)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`
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
    const { said, answer } = await castWebBoostAnswer(tap.storyId, token);
    // The live hive's script asks for the answer as JSON and draws it
    // itself, docs/the-wall.md section 21. Same tap, same token, same
    // cookie, same limit, same word; only the shape of the reply differs.
    if (wantsJson(request)) {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie": `${TOKEN_COOKIE}=${token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`,
        ...SECURITY,
      });
      response.end(JSON.stringify(jsonAnswer(said, answer)));
      return;
    }
    const where = tap.back === "hive"
      ? hivePath(tap.month, tap.day)
      : tap.back === "comb"
        ? combPath(tap.month, tap.day)
      : tap.back === "receipt"
        ? `/${slug(tap.month, tap.day)}/wall/${tap.storyId}/`
      : tap.back === "pick"
        // The pick page carries its pair index in the query, so the word
        // below joins it with an ampersand rather than a question mark.
        ? `${pickPath(tap.month, tap.day)}?p=${tap.pick}`
        : `/${slug(tap.month, tap.day)}/`;
    const joiner = where.includes("?") ? "&" : "?";
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
      Location: `${where}${joiner}tapped=${said}${on}#${fragment}`,
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
    const { said, answer } = await forgetWebBoost(tap.storyId, token);
    if (wantsJson(request)) {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SECURITY });
      response.end(JSON.stringify(jsonAnswer(said, answer)));
      return;
    }
    const where = tap.back === "hive"
      ? hivePath(tap.month, tap.day)
      : tap.back === "comb"
        ? combPath(tap.month, tap.day)
      : tap.back === "receipt"
        ? `/${slug(tap.month, tap.day)}/wall/${tap.storyId}/`
      : tap.back === "pick"
        // The pick page carries its pair index in the query, so the word
        // below joins it with an ampersand rather than a question mark.
        ? `${pickPath(tap.month, tap.day)}?p=${tap.pick}`
        : `/${slug(tap.month, tap.day)}/`;
    const joiner = where.includes("?") ? "&" : "?";
    response.writeHead(303, {
      Location: `${where}${joiner}tapped=${said}#${TAP_FRAGMENT[said]}`,
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

  // This browser's own record. docs/the-wall.md section 25.
  //
  // Not a file and never one: every word of it belongs to the browser that
  // asked, so it is rendered per request, answered `no-store`, and carries
  // noindex as well, because a crawler has no cookie and the page it would
  // file is the empty one. robots.txt refuses the path too.
  //
  // A reader with no token has buzzed nothing and gets the empty page rather
  // than a redirect or a miss: the address is named on the privacy page and
  // should answer for anybody who types it. A read that fails is the one
  // case that must not answer "nothing", so it says so instead.
  // This or that, docs/the-wall.md section 30. Two stories from an open
  // hive and one question, drawn per request for this reader: which pairs
  // are shown depends on what this browser has buzzed, so the page is never
  // stored. On a date that is not taking buzzes it sends the reader to the
  // date page, where the board says why. No script and the default policy.
  const picking = method === "GET" || method === "HEAD" ? pickFor(path, everyDate()) : null;
  if (picking !== null) {
    const now = Date.now();
    const wallDate = openWallDates(now).get(wallKey(picking.month, picking.day));
    const tapped = tappedFrom(query);
    const address = String(request.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim()
      || request.socket.remoteAddress || "unknown";
    const fresh = tapped !== null && underLimit(address);
    const wall = wallDate === undefined ? null : await liveWall(picking.month, picking.day, now, fresh, false);
    if (wall === null || !takingBoosts(wall.day, now)) {
      response.writeHead(302, {
        Location: `/${slug(picking.month, picking.day)}/`,
        "Cache-Control": "no-store",
        ...securityFor(path),
      });
      response.end();
      return;
    }
    const token = tokenFromCookie(request.headers.cookie);
    const standing = token === null ? null : await wallStanding(wall.day.wallDate, token);
    // The Undo button only for a browser whose own standing says it backed
    // that story. The date page gates it on the word alone and the database
    // refuses a stranger either way; here the standing is already in hand,
    // so the control is drawn only where it can work.
    const undoOn = tapped === "kept" ? tappedOnFrom(query) : null;
    const undo = undoOn === null || standing === null || !standing.backed.includes(undoOn)
      ? null
      : wall.day.stories.find((s) => s.id === undoOn) ?? null;
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      Vary: "Cookie",
      ...securityFor(path),
    });
    if (method === "HEAD") { response.end(); return; }
    response.end(renderPickPage(wall.day, picking.month, picking.day, now, {
      standing: standing === null ? null : { left: standing.left, allowance: standing.allowance, backed: standing.backed },
      p: pickIndexFrom(query),
      tapped,
      undo,
    }));
    return;
  }

  if ((path === "/yours" || path === "/yours/") && (method === "GET" || method === "HEAD")) {
    const token = tokenFromCookie(request.headers.cookie);
    const rows = token === null ? [] : await wallRecord(token);
    response.writeHead(rows === null ? 503 : 200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...securityFor(path),
    });
    if (method === "HEAD") { response.end(); return; }
    response.end(renderRecord(rows ?? [], rows === null));
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

  // The page around that picture, with a way to send it. Drawn per request
  // because the heading says whether the picture is the reader's own, and
  // never stored for the same reason.
  const carded = method === "GET" || method === "HEAD" ? cardFor(path) : null;
  if (carded !== null) {
    // "Your card" only when the picture at that address will be the reader's
    // own, which is the same stat the save link's label makes: the pictures
    // are rendered for the open dates and a range of years, not for every one.
    const cardYear = yearFromCookie(request.headers.cookie);
    const cardDate = openWallDates(Date.now()).get(wallKey(carded.month, carded.day));
    const mine = cardYear !== null && cardDate !== undefined
      && await fileFor(join(personalRoot(), `${personalName(cardDate, cardYear)}.png`)) !== null;
    const html = renderCardPage(carded.month, carded.day, mine);
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      Vary: "Cookie",
      ...securityFor(path),
    });
    response.end(method === "HEAD" ? undefined : html);
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
      // The picture credit, one small read for the one story, because the
      // day's read carries no pictures either.
      const credit = method === "HEAD" ? null : await fetchPictureFor(projectBase(), key, story, WALL_TIMEOUT_MS);
      response.end(method === "HEAD" ? undefined : renderStoryPage(told, wall.day, now, { interactive: true, undo, credit }) + marks + (tapped === "kept" ? BUZZ_SOUND : ""));
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
    const birthday = readable ? birthdayFromCookie(request.headers.cookie) : null;
    const born = birthday?.year ?? null;
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
        marked.month, marked.day, now, fresh, marked.hive, found, undoOn, standing?.anniversary ?? [], standing,
        // The way to this reader's own record, drawn for a browser carrying
        // the token and for no other. docs/the-wall.md section 25.
        token !== null,
        marked.comb,
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
      // And the reader's own year in the song strip, on any date, for a
      // reader whose year the charts cover. The strip is baked into every
      // page, so this needs no wall.
      marks += songMark(slug(marked.month, marked.day), birthday);
      marks += ageMark(slug(marked.month, marked.day), birthday);
      // An anniversary is reason enough to draw this reader their own page,
      // even on a date they have done nothing on today: it is the whole of
      // what they came back for.
      // The reader's own panel, for anybody who has given a birth year, on any
      // date: their age, their decade and the world their year landed in. It
      // needs no hive, so it is what makes entering a birthday land on a date
      // that has no board yet.
      const mePanel = birthday !== null ? renderMePanel(marked.month, marked.day, birthday, new Date(now)) : null;
      const anniversary = (standing?.anniversary.length ?? 0) > 0;
      // A year alone is reason enough: without this a reader who has given
      // one and done nothing else is handed the shared page, and their link
      // says "Save this picture" while the address gives them their own.
      // A token alone is reason enough as well, since September 21, 2026: the
      // link to this browser's own record is on the page for a reader who
      // carries one, and a page carrying it is one reader's own like the
      // marks and is never stored.
      if (marks !== "" || anniversary || tapped !== null || found !== null || born !== null || token !== null) {
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
          response.end(method === "HEAD" ? undefined : withMe(withWall(html, wall?.section ?? null), mePanel) + marks + (tapped === "kept" ? BUZZ_SOUND : ""));
          return;
        }
      }
    }
    // An open date, for everybody: the page off disk with the wall as it is
    // right now swapped in. Only when the read succeeded; otherwise the file
    // is streamed exactly as built, below.
    const open = readable ? dateFor(path) : null;
    if (open !== null) {
      const wall = (await liveWall(open.month, open.day, Date.now(), false, open.hive, null, null, [], null, false, open.comb))?.section ?? null;
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
/**
 * The buzz, heard. Jason's mom's idea, September 22, 2026. The page that
 * follows a buzz that counted carries one audio element that plays by
 * itself, because the pages that take a buzz run no script and this is the
 * only way they can make a sound. A browser may decline to play it: Chrome
 * usually allows it after the tap that led here, Safari on a phone usually
 * does not, and nothing breaks either way. The live full screen hive plays
 * the same buzz from its script, where every browser allows it.
 */
export const BUZZ_SOUND = `<audio class="wbuzzsound" src="/buzz.wav" autoplay preload="auto"></audio>`;

export function yoursMark(dateSlug: string, year: number | null): string {
  if (year === null) return "";
  return `<style class="wyours">.on-${dateSlug} .wsaveall{display:none}.on-${dateSlug} .wsavemine{display:inline}</style>`;
}

/**
 * Where a reader stands against one year's row on a date: not born yet, born
 * that very day, born earlier that year, or an age.
 *
 * With the whole birthday this is exact. Born June 15, 1990, the row for
 * September 22, 1990 is the year they were born, and the row for June 10,
 * 1991 is before their first birthday. With a year alone, from a cookie set
 * before September 22, 2026, the site cannot tell the reader's date from any
 * other: the birth year's row is "the year", later rows are the year's
 * difference, and it never says "the day" or "the week" at all, because that
 * would be the claim the whole change exists to stop making.
 */
export type LifeMark =
  | { kind: "before" }
  | { kind: "day" }
  | { kind: "year" }
  | { kind: "age"; age: number };

export function lifeMark(birth: Birthday, year: number, month: number, day: number): LifeMark {
  if (year < birth.year) return { kind: "before" };
  if (birth.month === null || birth.day === null) {
    return year === birth.year ? { kind: "year" } : { kind: "age", age: year - birth.year };
  }
  const order = month - birth.month || day - birth.day;
  if (year === birth.year) return order < 0 ? { kind: "before" } : order === 0 ? { kind: "day" } : { kind: "year" };
  return { kind: "age", age: year - birth.year - (order < 0 ? 1 : 0) };
}

/** A year, from before the whole birthday was kept, reads as a birthday with no date. */
function asBirthday(birth: Birthday | number | null): Birthday | null {
  if (birth === null) return null;
  if (typeof birth === "number") return Number.isInteger(birth) ? { year: birth, month: null, day: null } : null;
  return birth;
}

/**
 * The one rule that picks out the reader's own year in the song strip.
 *
 * "The most popular songs stopped 10 years before I was born" was a reader
 * scrolling a strip of sixty rows with nothing to say which one was theirs.
 * This outlines that row and puts a short label in front of its title. The
 * strip is drawn two ways, baked with the year as the row's id and live with
 * the year as the id on the year span, and the rule matches both.
 *
 * "The week you were born" is said only on the reader's own date. On any
 * other date the birth year's row is "The year you were born", and every
 * later row carries the age the reader was on this date in that year.
 *
 * Same safety argument as yoursMark: everything inside the style block is
 * generated text. The year is an integer from the cookie, already checked,
 * and the label is the site's own words, never a source's. A song title
 * never goes in here.
 *
 * Empty for a reader with no year, and for a year before the charts begin,
 * because there is no row to mark.
 */
export function songMark(dateSlug: string, birth: Birthday | number | null, thisYear: number = new Date().getUTCFullYear()): string {
  const b = asBirthday(birth);
  const page = dateFor(`/${dateSlug}/`);
  if (b === null || page === null || b.year > thisYear) return "";
  const rowOf = (y: number): string => `.on-${dateSlug} .wsongs li:is([id="${y}"], :has(.wyr[id="${y}"]))`;
  // "Your life in number ones." The strip starts at the reader's own year
  // and walks forward, one card per birthday with the age on it, and the
  // years before they were born follow after, newest first as baked. It is
  // done with the grid's order property, so the baked page and the live one
  // keep the one order everybody else sees and nothing is drawn twice.
  // September 22, 2026.
  let rules = `.on-${dateSlug} .wsongs li{order:1000}`;
  for (let y = Math.max(b.year, FIRST_CHART_YEAR); y <= thisYear; y += 1) {
    const mark = lifeMark(b, y, page.month, page.day);
    if (mark.kind === "before") continue;
    const row = rowOf(y);
    if (mark.kind === "day") {
      rules += `${row}{order:0;outline:2px solid #FFD98A;outline-offset:-2px}`
        + `${row} .wsongt::before{content:"The week you were born. ";color:#FFD98A;font-weight:800}`;
    } else if (mark.kind === "year") {
      rules += `${row}{order:0}${row} .wsongt::before{content:"The year you were born. "}`;
    } else {
      rules += `${row}{order:${y - b.year}}${row} .wsongt::before{content:"${mark.age === 0 ? "Not yet 1" : `You were ${mark.age}`}. "}`;
    }
  }
  rules += `.on-${dateSlug} .wsongs .wsongt::before{color:#FFD98A;font-weight:700}`;
  return `<style class="wsong">${rules}</style>`;
}

/**
 * The reader's age on every dated row of the feed.
 *
 * A row the hive filed from history starts "1975: " and the list item
 * carries that year as data-y, baked. This writes one rule per year from the
 * reader's own to this one, so the row says "You were 11" above its
 * headline, the one thing an encyclopedia's date page cannot say. Years
 * before the reader say nothing, and the year they were born says so, or
 * says it was the very day on their own date.
 *
 * Same safety argument as songMark: an integer from the cookie and the
 * site's own words, never a source's.
 *
 * With the whole birthday the age is the one the reader was on this date in
 * that year. With a year alone, from an older cookie, it can be one high.
 */
export function ageMark(dateSlug: string, birth: Birthday | number | null, thisYear: number = new Date().getUTCFullYear()): string {
  const b = asBirthday(birth);
  const page = dateFor(`/${dateSlug}/`);
  if (b === null || page === null || b.year > thisYear) return "";
  const rowOf = (y: number): string => `.on-${dateSlug} .wlist li[data-y="${y}"]::before`;
  // One shared look. A ::before with no content is never drawn, so the rows
  // before the reader's year, which get no content rule, stay as they were.
  let rules = `.on-${dateSlug} .wlist li[data-y]::before{display:block;font-size:12px;font-weight:700;color:#FFD98A;margin-bottom:2px}`;
  for (let y = b.year; y <= thisYear; y += 1) {
    const mark = lifeMark(b, y, page.month, page.day);
    if (mark.kind === "before") continue;
    const words = mark.kind === "day"
      ? "The day you were born"
      : mark.kind === "year"
        ? "The year you were born"
        : mark.age === 0 ? "Not yet 1" : `You were ${mark.age}`;
    rules += `${rowOf(y)}{content:"${words}"}`;
  }
  return `<style class="wage">${rules}</style>`;
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

const wallCache = new Map<string, { at: number; day: WallDay | null; pictures: StoredPicture[] }>();
/**
 * The panel's points the worker cut the last board with, off its newest
 * snapshot, read only for the live hive and kept for the same twenty
 * seconds. Its own cache rather than a field on the wall's, because the
 * date page reads the wall too and never needs these, and a wall read for
 * the date page must not leave the hive page with no scores for twenty
 * seconds.
 */
const scoreCache = new Map<string, { at: number; scores: Map<string, number> }>();

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
  /** This browser's own standing, for the live hive alone, on a request answered no-store. */
  standing: Standing | null = null,
  /**
   * Whether to draw the link to this browser's own record. docs/the-wall.md
   * section 25. True for a request carrying the token and for no other, and
   * every such request is answered no-store by the caller.
   */
  yours: boolean = false,
  /** The comb, every row of the feed on its own page. */
  comb: boolean = false,
): Promise<{ section: string; day: WallDay } | null> {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) return null;
  const wallDate = openWallDates(now).get(wallKey(month, day));
  if (wallDate === undefined) return null;
  // The live board, docs/the-wall.md section 21: the full screen hive of a
  // date that is taking buzzes, and nothing else. The same rule the header
  // is widened by, so a page that carries the script is a page allowed to
  // run it.
  const scripted = hive && liveHiveDates(now).get(wallKey(month, day)) === wallDate;

  const cached = wallCache.get(wallDate);
  let wall: WallDay | null;
  // The pictures the project holds for this wall's stories, read with the
  // wall and cached with it. The baked page carries rules for the stories
  // the build saw; a story that landed since has its rule only here, inside
  // the swapped section, so a live tile is never a bare tile because the
  // deploy came before the news.
  let pictures: StoredPicture[] = [];
  if (!fresh && cached !== undefined && now - cached.at < WALL_FRESH_MS) {
    wall = cached.day;
    pictures = cached.pictures;
  } else {
    try {
      // No row yet is not a failure: it is tomorrow before anything has
      // landed, and tomorrow's page draws an empty square with the hour it
      // opens rather than nothing. A read that fails is null, and null is
      // the page as built.
      wall = (await fetchWallDay(projectBase(), key, wallDate, WALL_TIMEOUT_MS)) ?? emptyWallDay(wallDate);
      pictures = wall.stories.length === 0 ? [] : await fetchPicturesFor(projectBase(), key, wall.stories, WALL_TIMEOUT_MS);
    } catch {
      wall = null;
    }
    // A failure is remembered too, so an outage is asked about once every
    // twenty seconds rather than on every page view.
    wallCache.set(wallDate, { at: now, day: wall, pictures });
  }
  if (wall === null) return null;
  if (scripted && takingBoosts(wall, now)) {
    // The page's own allocator is handed the same numbers the worker's was.
    const known = scoreCache.get(wallDate);
    let scores: Map<string, number>;
    if (known !== undefined && now - known.at < WALL_FRESH_MS) {
      scores = known.scores;
    } else {
      scores = wall.stories.length === 0 ? new Map() : await fetchSnapshotScores(projectBase(), key, wallDate, WALL_TIMEOUT_MS);
      scoreCache.set(wallDate, { at: now, scores });
    }
    return {
      section: pictureRules(pictures) + hiveDaysNav(month, day, now) + liveHiveSection(wall, `${monthName(month)} ${day}`, now, { project: projectBase(), key, standing, scores, anniversary, yours }),
      day: wall,
    };
  }
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
  // Only the pictures something on this page draws: the tiles on the board
  // and the song covers. Every story's picture was written into every date
  // page, which on September 22, 2026 was 207 kilobytes of rules for rows
  // that draw no picture. The comb draws its cells' pictures, the news
  // aside, whose pictures are the publishers' and the heaviest.
  const drawn = comb ? combPictured(wall) : picturedSubjects(wall);
  const shown = pictures.filter((p) => drawn.has(p.subject));
  return {
    section: pictureRules(shown) + (hive ? hiveDaysNav(month, day, now) : "") + wallSection(wall, `${monthName(month)} ${day}`, now, { interactive: true, hive, comb, date: { month, day }, found: stories, undo, anniversary, yours }),
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
  scoreCache.clear();
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

/** The card a request path names, or null: "/september-22/card/". */
export function cardFor(requestPath: string): { month: number; day: number } | null {
  const match = /^\/([a-z]+-\d{1,2})\/card\/?(?:index\.html)?$/.exec(requestPath);
  if (match === null) return null;
  for (const d of everyDate()) {
    if (slug(d.month, d.day) === match[1]) return { month: d.month, day: d.day };
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
function dateFor(requestPath: string): { month: number; day: number; hive: boolean; comb: boolean } | null {
  for (const d of everyDate()) {
    const at = `/${slug(d.month, d.day)}`;
    if (requestPath === at || requestPath === `${at}/` || requestPath === `${at}/index.html`) return { month: d.month, day: d.day, hive: false, comb: false };
    if (requestPath === `${at}/hive` || requestPath === `${at}/hive/` || requestPath === `${at}/hive/index.html`) return { month: d.month, day: d.day, hive: true, comb: false };
    if (requestPath === `${at}/comb` || requestPath === `${at}/comb/` || requestPath === `${at}/comb/index.html`) return { month: d.month, day: d.day, hive: false, comb: true };
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
