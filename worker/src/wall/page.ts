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
 * One page, with a deadline, following redirects, as a browser would ask
 * for it. Every failure is a value rather than a throw, because every
 * outcome is written down as a check.
 */
export async function fetchPage(url: string, userAgent: string, timeoutMs: number = 15000): Promise<Fetched> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" },
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
