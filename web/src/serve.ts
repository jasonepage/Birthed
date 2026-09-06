// Serves the built site.
//
//   npm run site      # renders out/
//   npm run serve     # serves it
//
// No dependencies, because this reads files off a disk and sets headers and
// there is no part of that worth a supply chain for. Node's own http and fs
// are the whole of it.
//
// The pages themselves are still rendered ahead of time by build.ts. This
// process does not touch the database and does not render anything, so a
// Supabase outage cannot take the site down and a request costs a file read.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

import { everyDate, slug } from "./model.js";


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
  "Content-Security-Policy":
    "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
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
export function securityFor(requestPath: string): Record<string, string> {
  const isAdd = requestPath === "/add" || requestPath.startsWith("/add/");
  if (!isAdd) return SECURITY;
  return {
    ...SECURITY,
    "Content-Security-Policy":
      "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; " +
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

async function handle(
  root: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const method = request.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD", ...SECURITY }).end();
    return;
  }

  const path = (request.url ?? "/").split("?")[0] ?? "/";

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

  const full = resolvePath(root, path);
  const file = full === null ? null : await fileFor(full);

  if (file !== null) {
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
