// Fetching a rendered Wikipedia page.
//
// The action interface rather than the REST one, because action=parse gives
// the legacy parser's HTML: no data-mw blobs, no generated ids, just the table
// the templates expanded to. redirects=1 because some year pages have been
// renamed and the old titles still point at them.

const ENDPOINT = "https://en.wikipedia.org/w/api.php";

interface ParseResponse {
  parse?: { title?: string; text?: string };
  error?: { code?: string; info?: string };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchedPage {
  /** The title Wikipedia settled on, after any redirect. */
  title: string;
  html: string;
}

/**
 * The rendered HTML of a page, or null when the page does not exist.
 *
 * A missing page is null rather than an exception, because a year list that
 * has not been written yet is a normal thing for the current year to run into
 * and not a reason to abandon the other sixty-seven.
 */
export async function fetchPage(
  title: string,
  userAgent: string,
  attempt = 1,
): Promise<FetchedPage | null> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", title);
  url.searchParams.set("prop", "text");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("redirects", "1");

  const response = await fetch(url, { headers: { "User-Agent": userAgent } });

  // 429 is rate limiting and 5xx includes the 504 that a slow render returns.
  // Both are worth waiting out. A 404 is not.
  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 4) {
      throw new Error(`Wikipedia gave up on ${title} after ${attempt} attempts (${response.status}).`);
    }
    const retryAfter = Number(response.headers.get("retry-after") ?? "0");
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : attempt * 4000;
    console.warn(`  ${response.status} on ${title}, waiting ${waitMs / 1000}s then retrying`);
    await sleep(waitMs);
    return fetchPage(title, userAgent, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`Wikipedia answered ${response.status} for ${title}.`);
  }

  const body = (await response.json()) as ParseResponse;
  if (body.error !== undefined) {
    if (body.error.code === "missingtitle") return null;
    throw new Error(`Wikipedia error on ${title}: ${body.error.info ?? body.error.code ?? "unknown"}`);
  }
  const html = body.parse?.text;
  if (html === undefined) return null;
  return { title: body.parse?.title ?? title, html };
}

export function articleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}
