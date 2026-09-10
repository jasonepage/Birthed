// What a page says, and whether it says a quotation. docs/the-wall.md
// section 5: the check is an exact string match of a quotation against the
// fetched page, a paraphrase fails, and no model is ever asked.
//
// This is the same rule the database applies at submission, in
// wall_page_contains in supabase/migrations/20260909120000_the_wall_writes.sql,
// written twice because the submit function runs inside Postgres and the
// checker runs here. worker/test/wall-page.test.ts holds the two to the same
// answers on the same fixtures.
//
// The page is read two ways: as its visible text, with scripts, styles and
// tags gone and entities decoded, and as its markup with entities decoded,
// so a description carried in a meta tag counts. Runs of whitespace are
// folded to one space on both sides of the comparison. Nothing else about
// the quotation is ever changed, and it is stored exactly as extracted.

const NAMED: Record<string, string> = {
  nbsp: " ", quot: "\"", apos: "'", lt: "<", gt: ">",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’",
  ldquo: "“", rdquo: "”", hellip: "…",
};

/** Numeric and the common named character references undone. */
export function decodeEntities(text: string): string {
  let s = text.replace(/&#[xX]([0-9A-Fa-f]{1,6});/g, (whole, hex: string) => {
    const n = parseInt(hex, 16);
    return n >= 1 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : whole;
  });
  s = s.replace(/&#([0-9]{1,7});/g, (whole, dec: string) => {
    const n = Number(dec);
    return n >= 1 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : whole;
  });
  for (const [name, value] of Object.entries(NAMED)) s = s.split(`&${name};`).join(value);
  // Last, so an encoded ampersand is not decoded twice.
  return s.split("&amp;").join("&");
}

/** Runs of whitespace folded to one space, ends trimmed. Every word stays. */
export function fold(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The page with its scripts, styles and comments gone. Not what a reader sees, but nothing a reader cannot. */
export function withoutCode(html: string): string {
  return html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

/** The visible text of a page, roughly what a reader would see. */
export function pageText(html: string): string {
  return fold(decodeEntities(withoutCode(html).replace(/<[^>]*>/g, " ")));
}

/** True when the page contains the quotation, exactly, by either reading. */
export function pageContains(html: string, quotation: string): boolean {
  const q = fold(quotation);
  if (q === "") return false;
  if (pageText(html).includes(q)) return true;
  return fold(decodeEntities(withoutCode(html))).includes(q);
}

/** One meta tag's content by property or name, in either attribute order. */
export function meta(html: string, key: string): string | null {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta\\s[^>]*?(?:property|name)\\s*=\\s*["']${k}["'][^>]*?content\\s*=\\s*"([^"]*)"`, "i"),
    new RegExp(`<meta\\s[^>]*?(?:property|name)\\s*=\\s*["']${k}["'][^>]*?content\\s*=\\s*'([^']*)'`, "i"),
    new RegExp(`<meta\\s[^>]*?content\\s*=\\s*"([^"]*)"[^>]*?(?:property|name)\\s*=\\s*["']${k}["']`, "i"),
    new RegExp(`<meta\\s[^>]*?content\\s*=\\s*'([^']*)'[^>]*?(?:property|name)\\s*=\\s*["']${k}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const found = pattern.exec(html);
    if (found?.[1] !== undefined) {
      const value = fold(decodeEntities(found[1]));
      if (value !== "") return value;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

export interface OwnerRow {
  domain: string;
  owner: string;
}

/**
 * Who owns a host, through wall_outlet_owners: the host itself first, then
 * each parent domain, and a host that matches nothing is its own owner. The
 * same walk wall_owner_of makes in the database.
 */
export function ownerOf(table: OwnerRow[], host: string): string {
  let h = host.trim().toLowerCase();
  if (h.startsWith("www.")) h = h.slice(4);
  const byDomain = new Map(table.map((row) => [row.domain.toLowerCase(), row.owner]));
  const parts = h.split(".");
  for (let i = 0; i < Math.max(parts.length - 1, 1); i++) {
    const found = byDomain.get(parts.slice(i).join("."));
    if (found !== undefined) return found;
  }
  return h;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

export interface Fetched {
  /** Null when no response arrived at all: a timeout, a refused connection, a bad name. */
  status: number | null;
  body: string | null;
  finalUrl: string | null;
  /** What happened, in one line, for the check row. */
  detail: string;
}

/**
 * How a page is asked for. A browser's own identification, with Birthed
 * named at the end so an operator reading a log can still find us.
 *
 * The worker's configured agent, "Birthed/0.1 (...) node-fetch", is right
 * for the Wikidata query service, which asks to be told who is calling. It
 * is the wrong thing to say to a news site. Measured on September 10, 2026:
 * every one of nine npr.org article pages answered nothing within fifteen
 * seconds, while feeds.npr.org answered the same worker at once, which is
 * the shape of an article host screening by user agent rather than a
 * network that is down. Whether this header gets through is unknown until
 * a tick from Render says so; what is known is that the old one did not.
 *
 * Accept-Language is sent because some hosts answer a request with no
 * language preference with a chooser page rather than the article.
 */
export const PAGE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Birthed/0.1 (+https://birthed.app)";

export const PAGE_HEADERS: Record<string, string> = {
  "User-Agent": PAGE_USER_AGENT,
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
  "Accept-Language": "en-US,en;q=0.9",
};

/** How many silent reads a host gets in one run before the rest of its pages are left for the next run. */
export const SILENT_STRIKES = 2;

/**
 * A host that has not answered twice in one run is not asked again in that
 * run. Nine npr.org sources at fifteen seconds each cost the checker over
 * two minutes a tick to learn the same thing nine times, and a host that is
 * screening the worker is not helped by being asked a seventh time in the
 * same minute; that is the quickest way to be screened for good. A page
 * left unread is not a failed check and is not written down as one: its
 * schedule in recheck.ts sees no row and asks again next run. Only silence
 * counts, a status of any kind is an answer.
 */
export class HostSilence {
  private readonly strikes = new Map<string, number>();

  constructor(private readonly limit: number = SILENT_STRIKES) {}

  /** Whether a host has gone silent often enough to be left alone this run. */
  skips(url: string): boolean {
    return (this.strikes.get(hostOf(url)) ?? 0) >= this.limit;
  }

  /** Record what a read said. Silence counts against the host; an answer clears it. */
  record(url: string, fetched: Fetched): void {
    const host = hostOf(url);
    if (fetched.status === null) this.strikes.set(host, (this.strikes.get(host) ?? 0) + 1);
    else this.strikes.delete(host);
  }

  /** The hosts left alone, for the log. */
  silenced(): string[] {
    return [...this.strikes.entries()].filter(([, n]) => n >= this.limit).map(([host]) => host).sort();
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return url;
  }
}

/**
 * One page, with a deadline, following redirects, as a browser would ask
 * for it. Every failure is a value rather than a throw, because every
 * outcome is written down as a check. Redirects are followed because the
 * feeds carry canonical addresses and the sites answer them with a hop to
 * www or to a section host; the address landed on is in the detail.
 */
export async function fetchPage(url: string, headers: Record<string, string> = PAGE_HEADERS, timeoutMs: number = 15000): Promise<Fetched> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });
    const body = await response.text();
    const type = response.headers.get("content-type") ?? "";
    return {
      status: response.status,
      body,
      finalUrl: response.url || url,
      detail: `${response.status}, ${type.split(";")[0] || "unknown type"}, ${body.length} characters`
        + (response.url && response.url !== url ? `, landed on ${response.url}` : ""),
    };
  } catch (error: unknown) {
    const reason = error instanceof Error ? (error.name === "AbortError" ? `no answer within ${timeoutMs / 1000} seconds` : error.message) : String(error);
    return { status: null, body: null, finalUrl: null, detail: reason.slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}
