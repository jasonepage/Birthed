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
/**
 * How many times to follow the interface's continue token for one batch.
 *
 * Fifty titles takes about three. The cap is here so a token that never
 * clears cannot turn one date into an infinite loop.
 */
const MAX_ROUNDS = 12;

export interface PageviewsPage {
  title?: string;
  pageviews?: Record<string, number | null>;
}

interface TitleMapping {
  from?: string;
  to?: string;
}

export interface PageviewsResponse {
  /**
   * Present when the answer is partial. The interface names every title that
   * was asked about but attaches readings to only some of them, and expects
   * to be asked again with these parameters for the rest.
   */
  continue?: Record<string, string>;
  batchcomplete?: boolean;
  query?: {
    /**
     * An array under formatversion 2 and an object keyed by page id under the
     * older one. Typed as both because the code handles both, and because a
     * type that claims only one of them is a type that cannot describe the
     * real answer.
     */
    pages?: PageviewsPage[] | Record<string, PageviewsPage>;
    /** Underscores to spaces, first letter capitalised, and so on. */
    normalized?: TitleMapping[];
    /** Where a redirect actually points. */
    redirects?: TitleMapping[];
  };
  error?: { info?: string };
}

/**
 * The article title as the action interface wants it: decoded, because that
 * parameter takes real titles rather than URL segments.
 *
 * The underscores are left alone on purpose. They are what the URL has, they
 * are accepted by the interface, and the answer is matched back through the
 * interface's own normalisation table rather than by guessing at the shape it
 * will hand back. See followMappings.
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

/** One round trip. Null when the interface would not answer. */
async function requestRound(
  titles: string[],
  userAgent: string,
  carry: Record<string, string>,
  attempt = 1,
): Promise<PageviewsResponse | null> {
  const query = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "pageviews",
    pvipdays: String(DAYS),
    redirects: "1",
    titles: titles.join("|"),
    ...carry,
  });

  const response = await fetch(`${ENDPOINT}?${query}`, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
  });

  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 4) return null;
    await sleep(attempt * 1500);
    return requestRound(titles, userAgent, carry, attempt + 1);
  }
  if (!response.ok) return null;

  return (await response.json()) as PageviewsResponse;
}

/**
 * Everything the interface will say about these titles, however many round
 * trips that takes.
 *
 * It answers partially and says so. Ask for twenty five titles and it names
 * all twenty five, attaches readings to eighteen, and hands back a continue
 * token for the rest. Reading the first answer and stopping loses the
 * remainder, and the loss is invisible: a page with no readings attached
 * looks exactly like a page nobody reads.
 *
 * That is the third time in this file that a partial answer has been read as
 * a complete one, so the loop is bounded and the rounds it took are worth
 * knowing about.
 */
async function fetchBatch(titles: string[], userAgent: string): Promise<Map<string, number>> {
  const rounds: PageviewsResponse[] = [];
  let carry: Record<string, string> = {};

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const payload = await requestRound(titles, userAgent, carry);
    if (payload === null) break;
    rounds.push(payload);
    if (payload.continue === undefined) break;
    carry = payload.continue;
  }

  return viewsByRequestedTitle(titles, rounds);
}

/**
 * The reading for each title that was asked about, keyed by what was asked.
 *
 * Pure, and separate from the fetch, because this is where the bug was and a
 * bug that cannot be tested is a bug that comes back.
 *
 * What is asked for and what is answered are different strings.
 * "Kim_Kardashian" is normalised to "Kim Kardashian", and "OutKast" is
 * redirected to "Outkast". Keying on the answer and looking up by the request
 * means every multi-word name scores zero, and a zero does not look like a
 * bug. It looks like somebody nobody reads, so the ranking quietly fills with
 * people who happen to have one-word article titles.
 */
export function viewsByRequestedTitle(
  titles: string[],
  rounds: PageviewsResponse[],
): Map<string, number> {
  const byAnsweredTitle = new Map<string, number>();
  const alias = new Map<string, string>();

  for (const payload of rounds) {
    const raw = payload.query?.pages;
    const pages: PageviewsPage[] = Array.isArray(raw) ? raw : Object.values(raw ?? {});
    for (const page of pages) {
      // A page with no readings attached is one this round did not cover, not
      // a page nobody reads. Skipping it leaves it for a later round instead
      // of writing a zero over it.
      if (!page.title || page.pageviews === undefined) continue;
      byAnsweredTitle.set(page.title, averageMonthlyViews(page.pageviews));
    }
    for (const [from, to] of mappings(payload)) alias.set(from, to);
  }

  const views = new Map<string, number>();
  for (const asked of titles) {
    views.set(asked, byAnsweredTitle.get(followMappings(asked, alias)) ?? 0);
  }
  return views;
}

/**
 * Every rename the interface reported, request to answer.
 *
 * Normalisation happens first and redirects second, so both go in one table
 * and are followed in order.
 */
export function mappings(payload: PageviewsResponse): Map<string, string> {
  const alias = new Map<string, string>();
  for (const list of [payload.query?.normalized, payload.query?.redirects]) {
    for (const entry of list ?? []) {
      if (entry.from !== undefined && entry.to !== undefined) alias.set(entry.from, entry.to);
    }
  }
  return alias;
}

/**
 * Follows a title through the rename table to what the answer is filed under.
 *
 * Bounded, because a table that pointed at itself would otherwise hang the
 * import rather than mis-rank one person.
 */
export function followMappings(title: string, alias: Map<string, string>, hops = 4): string {
  let current = title;
  for (let step = 0; step < hops; step += 1) {
    const next = alias.get(current);
    if (next === undefined || next === current) return current;
    current = next;
  }
  return current;
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
    // fetchBatch already answers for every title it was asked about, so a
    // missing entry here means the request itself failed and the zero is the
    // failure rather than the reading.
    for (const title of batch) results.set(title, views.get(title) ?? 0);
  }
  return results;
}
