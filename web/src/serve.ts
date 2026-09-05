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
  // The pages are text, one inline stylesheet and no scripts at all, so the
  // policy can be this narrow. Widen it the day something needs widening,
  // not before.
  "Content-Security-Policy":
    "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

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
    ...SECURITY,
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
