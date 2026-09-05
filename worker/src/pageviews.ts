// How many people actually look somebody up.
//
// Sitelink count, which is what the first version ranked on, measures how many
// languages have an article. That is coverage, not attention, and it is why a
// Bundesliga midfielder outranked a pop star. English Wikipedia pageviews
// measures the thing a day page is actually answering: who do people look up.
//
// Fetched in batches of 50 through the Wikipedia action interface rather than
// one article at a time through the metrics interface. The metrics one gives a
// longer history but costs one request per person, which meant 160 requests
// per date and turned a backfill into a four hour job. This is four requests
// per date.
//
// The trade is history: 60 days rather than 365. For this product that is
// arguably the better window anyway, because it reflects who people are
// looking up now rather than who they looked up two years ago. It is spikier,
// though, so somebody who died last month will rank high for a while.

const ENDPOINT = "https://en.wikipedia.org/w/api.php";
const BATCH = 50;
const DAYS = 60;

interface PageviewsPage {
  title?: string;
  pageviews?: Record<string, number | null>;
}

interface PageviewsResponse {
  query?: { pages?: Record<string, PageviewsPage> };
  error?: { info?: string };
}

/**
 * The article title as the action interface wants it: decoded, because that
 * parameter takes real titles rather than URL segments.
 */
export function titleFromArticleUrl(articleUrl: string): string | null {
  const marker = "/wiki/";
  const at = articleUrl.indexOf(marker);
  if (at < 0) return null;
  const segment = articleUrl.slice(at + marker.length);
  if (segment.length === 0) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Average views per month, from however many days the interface returned. */
export function averageMonthlyViews(daily: Record<string, number | null> | undefined): number {
  if (!daily) return 0;
  const values = Object.values(daily).map((value) => value ?? 0);
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 30);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBatch(
  titles: string[],
  userAgent: string,
  attempt = 1,
): Promise<Map<string, number>> {
  const query = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "pageviews",
    pvipdays: String(DAYS),
    redirects: "1",
    titles: titles.join("|"),
  });

  const response = await fetch(`${ENDPOINT}?${query}`, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
  });

  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 4) return new Map();
    await sleep(attempt * 1500);
    return fetchBatch(titles, userAgent, attempt + 1);
  }
  if (!response.ok) return new Map();

  const payload = (await response.json()) as PageviewsResponse;
  // formatversion 2 gives pages as an array, but older responses give an
  // object keyed by page id. Handle both rather than trusting one.
  const raw = payload.query?.pages;
  const pages: PageviewsPage[] = Array.isArray(raw) ? raw : Object.values(raw ?? {});

  const views = new Map<string, number>();
  for (const page of pages) {
    if (!page.title) continue;
    views.set(page.title, averageMonthlyViews(page.pageviews));
  }
  return views;
}

/** Views for a whole date's candidates, in batches of fifty. */
export async function monthlyViewsForTitles(
  titles: string[],
  userAgent: string,
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  for (let start = 0; start < titles.length; start += BATCH) {
    const batch = titles.slice(start, start + BATCH);
    const views = await fetchBatch(batch, userAgent);
    for (const [title, count] of views) results.set(title, count);
    // Anything the interface did not answer for is a real zero, not a gap.
    for (const title of batch) if (!results.has(title)) results.set(title, 0);
  }
  return results;
}
