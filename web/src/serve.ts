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
// Two requests are the exception and both of them follow an answer: the POST
// that records one, and the single redirected GET carrying ?kept= that draws
// the result. Nothing a reader can reach by browsing calls the database, and
// when the ?kept= call fails the page is served exactly as it was built, so
// the outage costs a result and never a site.

import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

import { everyDate, slug } from "./model.js";
import { TODAY, resultId, resultMarkup, type Remembered } from "./render.js";


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
    // form-action was 'none' until the remember buttons existed, which would
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
function apiOrigin(): string {
  const raw = process.env.SUPABASE_URL ?? "https://lunqqhjwqrpbujwxwdzk.supabase.co";
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
export function todayStylesheet(now: Date = new Date()): string {
  const open = openDates(now);
  return `.cal .days a[href="/${todaySlug(now)}/"]{outline:2px solid ${TODAY};` +
    `outline-offset:2px;color:#BFD8F5}\n` +
    // The year control is revealed with the buttons and by the same rule. It
    // is only worth asking somebody their birth year on a page where they can
    // do something with it, and asking on the 363 dates that would refuse an
    // answer is a personal question for nothing.
    open.map((date) =>
      `.on-${date} .rem{display:flex}.on-${date} .openflag{display:inline-flex}` +
      `.on-${date} .yearask{display:block}`).join("") +
    `\n${open.map((date) => `.trip a[href="/${date}/"]`).join(",")}{color:#BFD8F5;border-color:${TODAY}}\n`;
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
// Remembering.
//
// The one thing on this site that writes anything, and it is a plain HTML form
// that posts and redirects back. No script, on a site that ships none, which
// means it works with JavaScript turned off entirely. That is not nostalgia:
// the whole argument this site makes about itself is that it runs nothing, and
// a voting widget written in JavaScript would have cost that argument for a
// feature that a 1993 browser could do.
//
// The read path is untouched. A GET still costs a file read and nothing else,
// so a Supabase outage stops people voting and does not stop the site serving,
// which is the invariant this file was built around.

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

// birth_fact was missing here and the timeline has been drawing buttons on
// those rows since the day it shipped. Every answer given on a researched fact
// was refused with a 400 and the reader was shown "No." with nothing on screen
// saying why. The check constraint gained the kind in
// 20260908070000_remembrances_birth_fact_kind.sql and this set was never told.
const KINDS = new Set(["moment", "cultural_event", "historical_event", "birth_fact", "person"]);
const DEPTHS = new Set(["there", "remember", "heard", "never"]);

export interface Answer {
  month: number;
  day: number;
  kind: string;
  id: string;
  depth: string;
  birthYear: number | null;
}

/**
 * A posted form into an answer, or null.
 *
 * Every field is checked here rather than trusted and passed on. The database
 * checks them again, because a client is a thing anybody can write, and this
 * layer exists so a malformed post is a 400 rather than a round trip.
 */
export function readAnswer(body: string): Answer | null {
  const form = new URLSearchParams(body);
  const month = Number(form.get("m"));
  const day = Number(form.get("d"));
  const kind = form.get("k") ?? "";
  const id = (form.get("i") ?? "").trim();
  const depth = form.get("a") ?? "";
  const rawYear = form.get("y");

  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  if (!KINDS.has(kind) || !DEPTHS.has(depth)) return null;
  if (id === "" || id.length > 64) return null;

  const year = Number(rawYear);
  const birthYear = rawYear !== null && Number.isInteger(year) && year >= 1900 && year <= 2100
    ? year
    : null;

  return { month, day, kind, id, depth, birthYear };
}

async function record(answer: Answer, token: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  const response = await fetch(`${url}/rest/v1/rpc/remember`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      month_in: answer.month,
      day_in: answer.day,
      subject_kind_in: answer.kind,
      subject_id_in: answer.id,
      voter_token_in: token,
      depth_in: answer.depth,
      birth_year_in: answer.birthYear,
    }),
  });
  if (!response.ok) return false;
  return (await response.json()) === true;
}

/**
 * What a date's rows scored, for the one request that follows an answer.
 *
 * **This is the only place on the read path that ever calls the database, and
 * it only runs when the query string says somebody just answered.** An
 * ordinary page view still reads a baked file off disk and nothing else, which
 * is the property that keeps this site up when Supabase is not. A failure here
 * returns nothing and the page is served exactly as it was built, so the worst
 * an outage costs is a missing result rather than a missing site.
 */
async function tallyFor(month: number, day: number): Promise<Map<string, Remembered>> {
  const out = new Map<string, Remembered>();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return out;

  try {
    const response = await fetch(`${url}/rest/v1/rpc/remembrance_tally`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ month_in: month, day_in: day }),
    });
    if (!response.ok) return out;
    const rows = (await response.json()) as Array<{
      subject_kind: string; subject_id: string; edition_year: number;
      there: number; remembers: number; heard: number; never: number;
    }>;
    // This year's edition. An older one is a different question and the row it
    // belongs under is a comparison this site does not draw yet.
    const thisYear = new Date().getUTCFullYear();
    for (const row of rows) {
      if (row.edition_year !== thisYear) continue;
      out.set(`${row.subject_kind}:${row.subject_id}`, {
        there: row.there, remembers: row.remembers, heard: row.heard, never: row.never,
      });
    }
  } catch {
    return out;
  }
  return out;
}

/**
 * The row a redirect says was just answered, or null.
 *
 * Read from the query string rather than trusted: it decides whether this one
 * request is allowed to call the database, so it is bounded exactly the way a
 * posted answer is.
 */
export function keptFrom(query: string | undefined): { kind: string; id: string } | null {
  if (query === undefined || query === "") return null;
  const value = new URLSearchParams(query).get("kept");
  if (value === null) return null;
  const cut = value.indexOf(":");
  if (cut < 1) return null;
  const kind = value.slice(0, cut);
  const id = value.slice(cut + 1);
  if (!KINDS.has(kind)) return null;
  if (id === "" || id.length > 64) return null;
  return { kind, id };
}

async function handle(
  root: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const method = request.method ?? "GET";
  const [path = "/", query] = (request.url ?? "/").split("?");

  // POST reaches exactly one address and every other verb on every other path
  // is still refused. The allow header names the truth per path rather than
  // advertising POST across a site where it means nothing.
  const posts = path === "/remember" || path === "/year";
  if (method !== "GET" && method !== "HEAD" && !(method === "POST" && posts)) {
    response.writeHead(405, {
      Allow: posts ? "POST" : "GET, HEAD",
      ...SECURITY,
    }).end();
    return;
  }

  // The one thing this site asks a reader about themselves, saved once.
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

  if (method === "POST") {
    const address = String(request.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim()
      || request.socket.remoteAddress || "unknown";
    const token = tokenFromCookie(request.headers.cookie) ?? newToken();
    let answer: Answer | null = null;
    try {
      answer = readAnswer(await readBody(request));
    } catch {
      answer = null;
    }
    if (answer === null || !underLimit(address)) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY });
      response.end("No.\n");
      return;
    }
    // The year comes from the cookie rather than the form, because no form on
    // this site carries one: /year saves it once and every answer after it
    // gets it for free. A posted year still wins if one ever arrives, so this
    // is a fallback and not an override.
    if (answer.birthYear === null) {
      answer = { ...answer, birthYear: yearFromCookie(request.headers.cookie) };
    }

    // Awaited, because a reader who taps and is sent back to a page that has
    // not recorded them has been lied to, and this is one round trip.
    const kept = await record(answer, token);
    // The fragment is the whole feedback mechanism. :target reveals one of two
    // sentences already in the page, so the site says something back without
    // running a script.
    // Still a redirect rather than a rendered response, so a refresh is a GET
    // and the fragment can put the reader back on the row they answered. The
    // query string is what permits the one database call on the way back: see
    // keptFrom and the note at the top of this file.
    const where = `/${slug(answer.month, answer.day)}/`;
    const row = `${answer.kind}-${answer.id}`;
    response.writeHead(303, {
      Location: kept
        ? `${where}?kept=${encodeURIComponent(`${answer.kind}:${answer.id}`)}#r-${row}`
        : `${where}#sealed`,
      "Cache-Control": "no-store",
      // A year, because the point of the token is that the same browser is not
      // counted twice on a date it comes back to next year. HttpOnly because
      // nothing on this site runs a script that would read it.
      "Set-Cookie": `${TOKEN_COOKIE}=${token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`,
      ...SECURITY,
    });
    response.end();
    return;
  }

  // Answered before the disk is touched, because neither of these is a file.
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
  if (path === "/" || path === "/index.html") {
    const today = await fileFor(join(root, todaySlug()));
    if (today !== null) {
      send(response, 200, today, "/", method === "HEAD");
      return;
    }
  }

  const full = resolvePath(root, path);
  const file = full === null ? null : await fileFor(full);

  if (file !== null) {
    // The one read that draws a result, and the only one that ever calls the
    // database. It happens on the single redirected request after somebody has
    // answered, it is rate limited per address like the answer itself was, and
    // when anything about it fails the baked page is served untouched.
    const kept = method === "GET" && file.endsWith(".html") ? keptFrom(query) : null;
    if (kept !== null) {
      const address = String(request.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim()
        || request.socket.remoteAddress || "unknown";
      const shown = underLimit(address) ? await withResult(file, path, kept) : null;
      if (shown !== null) {
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          // Never stored. It is one reader's own result on one row and it is
          // wrong for everybody else and wrong for them a minute later.
          "Cache-Control": "no-store",
          ...securityFor(path),
        });
        response.end(shown);
        return;
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
async function withResult(
  file: string,
  requestPath: string,
  kept: { kind: string; id: string },
): Promise<string | null> {
  const date = everyDate().find((d) => {
    const at = `/${slug(d.month, d.day)}`;
    return requestPath === at || requestPath === `${at}/` || requestPath === `${at}/index.html`;
  });
  if (date === undefined) return null;

  const counts = (await tallyFor(date.month, date.day)).get(`${kept.kind}:${kept.id}`);
  if (counts === undefined) return null;

  const marked = resultId(kept.kind, kept.id);
  const anchor = `id="${marked}"></p>`;
  let html: string;
  try {
    html = await readFile(file, "utf8");
  } catch {
    return null;
  }
  if (!html.includes(anchor)) return null;
  return html.replace(anchor, () => `id="${marked}">${resultMarkup(counts)}</p>`);
}

/**
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
  server.listen(port, () => console.log(`serving ${root} on ${port}`));
  // Render sends SIGTERM on deploy. Finish what is in flight and go.
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  return server;
}

// Only when run directly, so a test can import resolvePath without opening a
// socket.
const entry = process.argv[1] ?? "";
if (entry.endsWith("serve.js") || entry.endsWith("serve.ts")) start();
