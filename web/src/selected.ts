/**
 * What Wikipedia's editors chose as the top of each day.
 *
 * The site has never had any notion of importance. `historical_events` holds
 * about fifty four rows a date and every one is exactly as important as every
 * other, because nothing has ever ranked them. That is why September 8 led
 * with a space station resupply flight while New Amsterdam becoming New York
 * sat in a drawer, and it is most of why the page reads as a database: an
 * unranked list is what a database looks like.
 *
 * Wikipedia's selected anniversaries are the missing signal and they have been
 * public the whole time. Five to thirteen events a date, argued over by
 * editors for years because they go on the main page, free, dated, all 366.
 * It is the closest thing there is to a newsroom picking the top of the day,
 * which is what this project has been trying to reproduce with a model.
 *
 * **A ranking signal, not content.** Nothing from that table is ever printed.
 * The site prints its own rows; a selection only says which of them lead. On
 * September 8 that is Michelangelo's David, New Amsterdam becoming New York
 * and the first Football League season, all three of which were already on the
 * page and none of which was anywhere near the top.
 *
 * Matched on the year alone, deliberately. Fuzzy text matching between
 * Wikipedia's line and ours would be a source of quiet wrongness for a
 * marginal gain, and two rows sharing a year on one date is rare enough that
 * marking both is the cheaper mistake.
 */
export type Selected = Map<string, Map<number, string>>;

export function selectedKey(month: number, day: number): string {
  return `${month}-${day}`;
}

export async function fetchSelected(url: string, key: string): Promise<Selected> {
  const out: Selected = new Map();
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "event_month,event_day,event_year,text",
      order: "id.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${url}/rest/v1/selected_anniversaries?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`selected anniversaries failed with ${response.status}`);
    const rows = (await response.json()) as
      { event_month: number; event_day: number; event_year: number; text: string }[];

    for (const row of rows) {
      const at = selectedKey(row.event_month, row.event_day);
      const years = out.get(at) ?? new Map<number, string>();
      // The line is carried as well as the year, because a year alone cannot
      // tell three rows from 1888 apart and September 8 has exactly that: the
      // Football League's first season, Isaac Peral's submarine and the Great
      // Herding. Marking all three put one year in half the cards on the page.
      years.set(row.event_year, row.text);
      out.set(at, years);
    }

    if (rows.length < pageSize) break;
  }

  return out;
}

/**
 * Which of our rows a selection is actually about, when several share its year.
 *
 * Wikipedia's line and ours are written differently and always will be, so this
 * counts the words they have in common and takes the best. Not clever, and it
 * does not need to be: the job is only to tell the Football League's first
 * season from a submarine test, and any two sentences about the same event
 * share several long words while two sentences about different ones share
 * almost none.
 *
 * Ties and near misses go to nobody. A selection that matches nothing on the
 * page is a gap somebody should fill, and promoting the wrong row is worse than
 * promoting none: the whole point of the signal is that the top of the page is
 * the top of the day.
 */
export function bestMatch<T extends { year: number | null; text: string }>(
  line: string,
  year: number,
  rows: T[],
): T | null {
  const words = (text: string) =>
    new Set(
      text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
        .filter((word) => word.length > 3),
    );
  const theirs = words(line);
  if (theirs.size === 0) return null;

  let best: T | null = null;
  let bestShared = 0;
  for (const row of rows) {
    if (row.year !== year) continue;
    let shared = 0;
    for (const word of words(row.text)) if (theirs.has(word)) shared += 1;
    if (shared > bestShared) { best = row; bestShared = shared; }
  }
  // Two long words in common is the floor. One is a coincidence: "September"
  // and "first" appear in half the rows on any date.
  return bestShared >= 2 ? best : null;
}
