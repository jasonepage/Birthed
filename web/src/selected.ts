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
export type Selected = Map<string, Set<number>>;

export function selectedKey(month: number, day: number): string {
  return `${month}-${day}`;
}

export async function fetchSelected(url: string, key: string): Promise<Selected> {
  const out: Selected = new Map();
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "event_month,event_day,event_year",
      order: "id.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${url}/rest/v1/selected_anniversaries?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`selected anniversaries failed with ${response.status}`);
    const rows = (await response.json()) as
      { event_month: number; event_day: number; event_year: number }[];

    for (const row of rows) {
      const at = selectedKey(row.event_month, row.event_day);
      const years = out.get(at) ?? new Set<number>();
      years.add(row.event_year);
      out.set(at, years);
    }

    if (rows.length < pageSize) break;
  }

  return out;
}
