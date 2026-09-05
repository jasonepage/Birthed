// How many people actually look somebody up.
//
// Sitelink count, which is what the first version ranked on, measures how many
// languages have an article. That is coverage, not attention, and it is why a
// Bundesliga midfielder outranked a pop star. English Wikipedia pageviews
// measures the thing a day page is actually answering: who do people look up.

const ENDPOINT = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user";

interface PageviewsResponse {
  items?: Array<{ views?: number }>;
}

function stamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}${month}0100`;
}

/** The last twelve complete months, which is recent enough to reflect who is
 *  current and long enough not to be a spike. */
export function twelveMonthWindow(now: Date = new Date()): { start: string; end: string; months: number } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
  return { start: stamp(start), end: stamp(end), months: 12 };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Average monthly views. Zero when the article has no data, which is a real
 *  answer rather than a failure. */
export async function monthlyViews(
  titleSegment: string,
  userAgent: string,
  window = twelveMonthWindow(),
  attempt = 1,
): Promise<number> {
  const url = `${ENDPOINT}/${titleSegment}/monthly/${window.start}/${window.end}`;
  const response = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "application/json" } });

  if (response.status === 404) return 0;

  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 3) return 0;
    await sleep(attempt * 2000);
    return monthlyViews(titleSegment, userAgent, window, attempt + 1);
  }

  if (!response.ok) return 0;

  const payload = (await response.json()) as PageviewsResponse;
  const items = payload.items ?? [];
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + (item.views ?? 0), 0);
  return Math.round(total / items.length);
}

/** The article title as the pageviews interface wants it, taken from the
 *  Wikipedia URL Wikidata hands back. It arrives percent-encoded already. */
export function titleSegment(articleUrl: string): string | null {
  const marker = "/wiki/";
  const at = articleUrl.indexOf(marker);
  if (at < 0) return null;
  const segment = articleUrl.slice(at + marker.length);
  return segment.length > 0 ? segment : null;
}

/** Fetches a batch with a small amount of concurrency, because the interface
 *  is free and shared and hammering it is rude. */
export async function monthlyViewsFor(
  segments: string[],
  userAgent: string,
  concurrency = 6,
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const window = twelveMonthWindow();
  for (let start = 0; start < segments.length; start += concurrency) {
    const batch = segments.slice(start, start + concurrency);
    const views = await Promise.all(batch.map((segment) => monthlyViews(segment, userAgent, window)));
    batch.forEach((segment, index) => results.set(segment, views[index] ?? 0));
  }
  return results;
}
