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
import { TODAY, renderCardPage, renderRecord, renderStoryPage } from "./render.js";
import { SHARE_SCRIPT_SOURCE } from "./share-button.js";
import { answerPictures, easternMidnight, emptyWallDay, fetchWallDay, hiveDaysNav, openWallDates, pictureRules, picturedSubjects, keptAt, replaceWall, hivePath, takingBoosts, wallKey, wallMarks, wallSection, withChecks, type Anniversary, type RecordRow, type TapBack, type WallDay } from "./wall.js";
import { fetchSnapshotScores, liveHiveSection, type Standing } from "./hive-live.js";
import { pickFor, pickIndexFrom, pickPath, renderPickPage, PICK_MAX } from "./pick.js";
import { fetchPictureFor, fetchPicturesFor, type StoredPicture } from "./stored-pictures.js";
import { coverFor } from "./song-apple.js";


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
export function todayStylesheet(now: Date = new Date(), _random: () => number = Math.random): string {
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
        // The first screen. The state sentence for this page, the open
        // version of the mechanic, the lit dot and the fuse.
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
        `.on-${date} .also a[href="${self[i]}"]{display:none}`;
    }).join("") +
    `\n`;
}

/** A date with a board and when it seals, as build.ts writes them to sealed.json. */
export interface SealedHive { path: string; closesAt: string }

/**
 * The hives the build saw, read once per root: the file changes only with a
 * deploy, and a deploy is a new process. A missing or broken file is no
 * hives, which sends Random to today.
 */
const sealedByRoot = new Map<string, Promise<SealedHive[]>>();
export function sealedHives(root: string): Promise<SealedHive[]> {
  let found = sealedByRoot.get(root);
  if (found === undefined) {
    found = readFile(join(root, "sealed.json"), "utf8")
      .then((text) => {
        const rows = JSON.parse(text) as unknown;
        if (!Array.isArray(rows)) return [];
        return rows.filter((r): r is SealedHive =>
          typeof r === "object" && r !== null
          && typeof (r as SealedHive).path === "string" && /^\/[a-z]+-\d{1,2}\/$/.test((r as SealedHive).path)
          && typeof (r as SealedHive).closesAt === "string" && !Number.isNaN(Date.parse((r as SealedHive).closesAt)));
      })
      .catch(() => []);
    sealedByRoot.set(root, found);
  }
  return found;
}

export function todaySlug(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - TODAY_BEHIND_UTC_HOURS * 60 * 60 * 1000);
  return slug(shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

export function redirectFor(
  requestPath: string,
  now: Date = new Date(),
  random: () => number = Math.random,
  sealed: ReadonlyArray<SealedHive> = [],
): string | null {
  const path = requestPath.length > 1 && requestPath.endsWith("/")
    ? requestPath.slice(0, -1)
    : requestPath;

  // A random hive that has sealed, October 18, 2026. Nathan: "maybe it does
  // a random selection of only hives that have sealed so far". Most of the
  // 366 have never had a hive, and a die that lands on an empty page was why
  // the pill came off. Before anything has sealed it lands on today.
  if (path === "/random") {
    const done = sealed.filter((h) => Date.parse(h.closesAt) <= now.getTime());
    if (done.length === 0) return `/${todaySlug(now)}/`;
    // Clamped, because a random source that ever returns exactly 1 would
    // index one past the end and the server would answer with undefined.
    const index = Math.min(done.length - 1, Math.max(0, Math.floor(random() * done.length)));
    return done[index]!.path;
  }

  if (path === "/yesterday" || path === "/tomorrow") {
    const day = 24 * 60 * 60 * 1000;
    const when = new Date(now.getTime() + (path === "/tomorrow" ? day : -day));
    return `/${todaySlug(when)}/`;
  }

  // The bar's pill says Every date and the page is /calendar/, so people
  // type the words they read. Hana did, September 22, 2026, and got a 404.
  if (path === "/every-date" || path === "/every-day") return "/calendar/";

  // The comb came off on October 18, 2026, docs/strip-to-the-hive.md. A link
  // to a date's comb lands on its date.
  const comb = /^\/([a-z]+-\d{1,2})\/comb$/.exec(path);
  if (comb !== null && everyDate().some((d) => slug(d.month, d.day) === comb[1])) return `/${comb[1]}/`;

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
/**
 * The birthday cookie an older version of this site set. Nothing reads it
 * since October 18, 2026, docs/strip-to-the-hive.md; the one place it is
 * named is the old /year address, which clears it.
 */
const YEAR_COOKIE = "by";
const MAX_BODY = 4096;

/** One person's opaque token. Not an account, not an address, not a fingerprint. */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
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
  /** The story. */
  storyId: string;
  month: number;
  day: number;
  /** Where the reader is sent back to: the date page, the full screen hive, the story's receipt, or the pick page. */
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
  return { storyId, month, day, back: v === "hive" || v === "receipt" || v === "pick" ? v : "day", pick };
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

/** The addresses the date page used to post to, answered with a way back. October 18, 2026. */
const RETIRED_POSTS: ReadonlySet<string> = new Set([
  "/year", "/find", "/song", "/song/search", "/song/undo", "/suggest", "/suggest/search", "/suggest/undo",
]);

const TAPPED = new Set<string>([
  "kept", "already", "spent", "not_yet", "closed", "false", "bad", "failed", "undone", "too_late",
]);

const TAP_FRAGMENT: Record<Tapped, string> = {
  kept: "wkept", already: "walready", spent: "wspent", not_yet: "wnotyet",
  closed: "wclosed", false: "wfalse", bad: "wfailed", failed: "wfailed",
  undone: "wundone", too_late: "wtoolate",
};

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
async function wallStanding(wallDate: string, token: string | null): Promise<{ left: number; allowance: number; backed: string[]; anniversary: Anniversary[]; answered: string | null; suggested: string | null } | null> {
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
    const answer = (await response.json()) as { left?: unknown; allowance?: unknown; backed?: unknown; anniversary?: unknown; answered?: unknown; suggested?: unknown };
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
      // The song this browser answered with on the date, docs/the-wall.md
      // section 31. Absent before the song migration, which is no answer.
      answered: typeof answer.answered === "string" && UUID.test(answer.answered) ? answer.answered : null,
      // What it suggested on the date, section 32. Absent before the
      // suggestions migration, which is no suggestion.
      suggested: typeof answer.suggested === "string" && UUID.test(answer.suggested) ? answer.suggested : null,
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
  const posts = path === "/boost" || path === "/unboost" || RETIRED_POSTS.has(path);
  if (method !== "GET" && method !== "HEAD" && !(method === "POST" && posts)) {
    response.writeHead(405, {
      Allow: posts ? "POST" : "GET, HEAD",
      ...SECURITY,
    }).end();
    return;
  }

  // The addresses the date page used to post to, retired on October 18,
  // 2026, docs/strip-to-the-hive.md: the birthday picker, the song in your
  // head, the suggestion box and the old typed field. A page cached before
  // then can still post here, so each answers with the date it came from
  // rather than a refusal, and the old birthday picker's address clears the
  // cookie it used to set. Nothing is read from the body but the date.
  if (method === "POST" && RETIRED_POSTS.has(path)) {
    let back = "/";
    try {
      const form = new URLSearchParams(await readBody(request));
      const month = Number(form.get("m"));
      const day = Number(form.get("d"));
      if (Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) back = `/${slug(month, day)}/`;
    } catch {
      back = "/";
    }
    response.writeHead(303, {
      Location: back,
      "Cache-Control": "no-store",
      ...(path === "/year" ? { "Set-Cookie": `${YEAR_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure` } : {}),
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
    const onDatePage = tap.back === "day";
    const read = onDatePage ? await liveWall(tap.month, tap.day, Date.now(), false, false) : null;
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
      : tap.back === "receipt"
        ? `/${slug(tap.month, tap.day)}/wall/${tap.storyId}/`
      : tap.back === "pick"
        // The pick page carries its pair index in the query, so the word
        // below joins it with an ampersand rather than a question mark.
        ? `${pickPath(tap.month, tap.day)}?p=${tap.pick}`
        : `/${slug(tap.month, tap.day)}/`;
    const joiner = where.includes("?") ? "&" : "?";
    // A tap that counted lands on the story it counted for, so the tile
    // reads as changed through :target and the page scrolls to it. On the
    // date page keptAt decides: the tile when the story is on the board, the
    // sentence when it is not. Every other word lands on its sentence.
    const counted = said === "kept" && onDatePage ? read?.day.stories.find((s) => s.id === tap!.storyId) ?? null : null;
    const fragment = said !== "kept"
      ? TAP_FRAGMENT[said]
      : counted !== null
        ? keptAt(counted)
        : `w-${tap.storyId}`;
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

  // A song's cover, docs/the-wall.md section 31: Apple's artwork, fetched by
  // this server from Apple's image host and passed through, so the page's
  // image policy stays this origin and the project and no reader's browser
  // asks Apple for anything. A track nobody has searched, charted or
  // answered with is a miss.
  const covered = method === "GET" || method === "HEAD" ? /^\/cover\/(\d{1,18})\.jpg$/.exec(path) : null;
  if (covered !== null) {
    const cover = await coverFor(covered[1]!, projectBase(), process.env.SUPABASE_ANON_KEY);
    if (cover === null) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300", ...SECURITY });
      response.end(method === "HEAD" ? undefined : "No cover.\n");
      return;
    }
    response.writeHead(200, { "Content-Type": cover.type, "Cache-Control": "public, max-age=86400", ...SECURITY });
    response.end(method === "HEAD" ? undefined : cover.bytes);
    return;
  }

  // Answered before the disk is touched, because neither of these is a file.  // Answered before the disk is touched, because neither of these is a file.
  // Never stored: a cached "today" is wrong by tomorrow morning, and a cached
  // "random" is the same date for everybody who asks after the first one.
  const redirect = redirectFor(path, new Date(), Math.random, path.startsWith("/random") ? await sealedHives(root) : []);
  if (redirect !== null) {
    response.writeHead(302, {
      Location: redirect,
      "Cache-Control": "no-store",
      ...securityFor(path),
    });
    response.end();
    return;
  }

  // The page around that picture, with a way to send it. The reader's own
  // version, drawn from a birth year, came off with the birthday cookie on
  // October 18, 2026, so every reader gets the shared picture.
  const carded = method === "GET" || method === "HEAD" ? cardFor(path) : null;
  if (carded !== null) {
    const html = renderCardPage(carded.month, carded.day, false);
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      Vary: "Cookie",
      ...securityFor(path),
    });
    response.end(method === "HEAD" ? undefined : html);
    return;
  }

  // A hive's picture at "/<date>/yours.png". It used to answer with a
  // reader's own version, picked by the birthday cookie; since October 18,
  // 2026 it is always the shared square, so a link saved before then still
  // works.
  const wanted = method === "GET" || method === "HEAD" ? pictureFor(path) : null;
  if (wanted !== null) {
    const plain = await fileFor(resolve(join(root, "og", `${slug(wanted.month, wanted.day)}-square.png`)));
    if (plain !== null) {
      response.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, must-revalidate",
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
    // Your own marks, on a date page or a hive page you have buzzed on.
    //
    // Only for a request that carries a token, which means only for a browser
    // that has buzzed something somewhere, or for the one request that
    // follows a tap, so the ordinary visitor still gets a file off disk and
    // nothing else. When the call fails, marks is "" and the page is served
    // exactly as it was built: an outage costs a mark, never a site.
    //
    // Since October 18, 2026 this reads the token and nothing else. The
    // birthday cookie, the song in your head and the suggestion box came off
    // the page, docs/strip-to-the-hive.md.
    const readable = method === "GET" && file.endsWith(".html");
    const token = readable ? tokenFromCookie(request.headers.cookie) : null;
    // The one request that follows a tap. It is allowed a fresh wall read,
    // past the twenty second cache, so the count and the mark the reader
    // just made are on the page they land on. Rate limited per address like
    // the tap itself.
    const tapped = readable ? tappedFrom(query) : null;
    const fresh = tapped !== null && underLimit(
      String(request.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim() || request.socket.remoteAddress || "unknown",
    );
    // The story a buzz just counted for, so the sentence that says it
    // counted can carry the Undo button for the one request that follows.
    const undoOn = readable && tapped === "kept" ? tappedOnFrom(query) : null;
    const marked = token === null && tapped === null ? null : dateFor(path);
    if (marked !== null) {
      const now = Date.now();
      // The reader's own buzzes are read before the section rather than after
      // it, because the section depends on one of them: the anniversary is
      // drawn into it, not written over it as a style rule. The count and the
      // marks are a style block on top, because the section they land on is
      // the shared one and they are one reader's alone. Section 13.
      const wallDate = openWallDates(now).get(wallKey(marked.month, marked.day));
      const standing = wallDate !== undefined && token !== null ? await wallStanding(wallDate, token) : null;
      const wall = await liveWall(
        marked.month, marked.day, now, fresh, marked.hive, undoOn, standing?.anniversary ?? [], standing,
        // The way to this reader's own record, drawn for a browser carrying
        // the token and for no other. docs/the-wall.md section 25.
        token !== null,
      );
      const marks = wall !== null && standing !== null ? wallMarks(standing, wall.day, now) : "";
      // A token alone is reason enough to draw this reader their own page,
      // since September 21, 2026: the link to this browser's own record is on
      // it, and a page carrying it is one reader's own like the marks and is
      // never stored.
      let html: string | null = null;
      try {
        html = await readFile(file, "utf8");
      } catch {
        html = null;
      }
      if (html !== null) {
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          // Never stored. It is one reader's own marks and it is wrong for
          // everybody else who would be handed the cached copy.
          "Cache-Control": "no-store",
          ...securityFor(path),
        });
        response.end(method === "HEAD" ? undefined : withWall(html, wall?.section ?? null) + marks + (tapped === "kept" ? KEPT_SAID + BUZZ_SOUND : ""));
        return;
      }
    }
    // An open date, for everybody: the page off disk with the wall as it is
    // right now swapped in. Only when the read succeeded; otherwise the file
    // is streamed exactly as built, below.
    const open = readable ? dateFor(path) : null;
    if (open !== null) {
      const live = await liveWall(open.month, open.day, Date.now(), false, open.hive, null, [], null, false);
      const wall = live?.section ?? null;
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
            // Briefly. The wall moves by the hourly tick and this is the
            // same for every reader, so a short shared cache is right. Vary,
            // because the reader's own copy of this page is decided by their
            // token cookie and a shared cache must not hand this one to them.
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
 * The buzz, heard. Jason's mom's idea, September 22, 2026. The page that
 * follows a buzz that counted carries one audio element that plays by
 * itself, because the pages that take a buzz run no script and this is the
 * only way they can make a sound. A browser may decline to play it: Chrome
 * usually allows it after the tap that led here, Safari on a phone usually
 * does not, and nothing breaks either way. The live full screen hive plays
 * the same buzz from its script, where every browser allows it.
 */
export const BUZZ_SOUND = `<audio class="wbuzzsound" src="/buzz.wav" autoplay preload="auto"></audio>`;

/**
 * The sentence that says a buzz counted, shown on the page that follows it
 * whatever the fragment names. The fragment shows it by landing on the
 * story, and a story the page does not draw, which the feed used to draw and
 * the museum may not, would leave it hidden. docs/the-wall.md section 32.
 */
export const KEPT_SAID = `<style>#wkept{display:block}</style>`;


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
// untouched. A Supabase outage costs a stale wall until the next tick and
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
  undoOn: string | null = null,
  anniversary: Anniversary[] = [],
  /** This browser's own standing, for the live hive alone, on a request answered no-store. */
  standing: Standing | null = null,
  /**
   * Whether to draw the link to this browser's own record. docs/the-wall.md
   * section 25. True for a request carrying the token and for no other, and
   * every such request is answered no-store by the caller.
   */
  yours: boolean = false,
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
      section: pictureRules([...pictures, ...answerPictures(wall)]) + hiveDaysNav(month, day, now) + liveHiveSection(wall, `${monthName(month)} ${day}`, now, { project: projectBase(), key, standing, scores, anniversary, yours }),
      day: wall,
    };
  }
  const read = wall;
  // The story a buzz just counted for, resolved against this wall. One that
  // is not on the date is dropped rather than refused, the way a find's is:
  // the button is a convenience and its absence costs the reader the window,
  // never the page.
  const undo = undoOn === null ? null : read.stories.find((s) => s.id === undoOn) ?? null;
  // Only the pictures something on this page draws: the tiles on the board.
  // Every story's picture was written into every date page, which on
  // September 22, 2026 was 207 kilobytes of rules for rows that draw no
  // picture.
  const drawn = picturedSubjects(wall);
  const shown = [...pictures, ...answerPictures(wall)].filter((p) => drawn.has(p.subject));
  const name = `${monthName(month)} ${day}`;
  return {
    section: pictureRules(shown) + (hive ? hiveDaysNav(month, day, now) : "") + wallSection(wall, name, now, {
      interactive: true, hive, date: { month, day }, undo, anniversary, yours,
    }),
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
