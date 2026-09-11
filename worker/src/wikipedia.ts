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

/**
 * Where a set of titles really point, for the ones that are redirects.
 *
 * The pageviews service counts a redirect's own views, which are close to
 * nothing, so a subject that is a redirect has to be measured under the
 * title it lands on. action=query with redirects=1 answers for up to fifty
 * titles at a time and returns only the ones that moved; a title that is
 * not in the answer stays as it was.
 */
export async function resolveRedirects(titles: string[], userAgent: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(titles)];
  for (let start = 0; start < unique.length; start += 50) {
    const batch = unique.slice(start, start + 50);
    const url = new URL(ENDPOINT);
    url.searchParams.set("action", "query");
    url.searchParams.set("titles", batch.join("|"));
    url.searchParams.set("redirects", "1");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    const response = await fetch(url, { headers: { "User-Agent": userAgent } });
    if (!response.ok) throw new Error(`Wikipedia answered ${response.status} resolving redirects.`);
    const body = (await response.json()) as { query?: { normalized?: Array<{ from: string; to: string }>; redirects?: Array<{ from: string; to: string }> } };
    // A title may be normalised first (capitalisation, underscores) and
    // then redirected, so both hops are followed.
    const normalised = new Map((body.query?.normalized ?? []).map((n) => [n.from, n.to]));
    const redirected = new Map((body.query?.redirects ?? []).map((r) => [r.from, r.to]));
    for (const title of batch) {
      const step = normalised.get(title) ?? title;
      const target = redirected.get(step);
      if (target !== undefined && target !== title) out.set(title, target);
    }
    await sleep(250);
  }
  return out;
}
