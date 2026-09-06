// Writing into Supabase over the REST interface, with the service role key.
// The key bypasses row level security, which is exactly why it never goes near
// the iOS target. CLAUDE.md section 9.

export interface NotablePersonRow {
  wikidata_qid: string;
  name: string;
  birth_month: number;
  birth_day: number;
  birth_year: number | null;
  death_year: number | null;
  short_description: string | null;
  birth_precision: number;
  sitelink_count: number;
  is_living: boolean;
  notability_score: number;
  enwiki_title: string | null;
  monthly_views: number;
  has_social: boolean;
  adult_content: boolean;
  source_url: string;
  content_license: string;
}

export async function upsertNotablePeople(
  rows: NotablePersonRow[],
  supabaseUrl: string,
  serviceRoleKey: string,
  batchSize = 500,
): Promise<number> {
  let written = 0;

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const response = await fetch(
      `${supabaseUrl}/rest/v1/notable_people?on_conflict=wikidata_qid`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(batch),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Upsert failed with ${response.status}. ${body.slice(0, 400)}`,
      );
    }
    written += batch.length;
  }

  return written;
}

export interface ChartWeekRow {
  chart_date: string;
  chart_name: string;
  song: string;
  artist: string;
  source_url: string;
  content_license: string;
}

/**
 * One row per chart week, keyed on the chart and the issue date, so running
 * the import again corrects rows rather than doubling them.
 */
export async function upsertChartWeeks(
  rows: ChartWeekRow[],
  supabaseUrl: string,
  serviceRoleKey: string,
  batchSize = 500,
): Promise<number> {
  let written = 0;

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const response = await fetch(
      `${supabaseUrl}/rest/v1/chart_weeks?on_conflict=chart_name,chart_date`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(batch),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Chart week upsert failed with ${response.status}. ${body.slice(0, 400)}`);
    }
    written += batch.length;
  }

  return written;
}

export interface HistoricalEventRow {
  event_month: number;
  event_day: number;
  event_year: number;
  description: string;
  source_url: string;
  content_license: string;
  fingerprint: string;
  /**
   * The moment this run started, the same value on every row of the run.
   *
   * Sent rather than left to the column default, because it is what makes a
   * re-run able to tell this run's rows from the ones it did not produce. An
   * upsert that merges writes this onto a row it matched, so after the write
   * every row the run still stands behind carries the run's own timestamp and
   * everything else carries an older one.
   */
  imported_at: string;
}

/**
 * One row per event, keyed on the fingerprint of its date, year and
 * sentence, so running the import again corrects rows rather than doubling
 * them.
 *
 * The fingerprint covers the sentence, so an edited sentence is a different
 * row rather than the same row changed. On its own that leaves the old one
 * behind, which is what `pruneHistoricalEvents` is for: this writes what is
 * true now, and that removes what is no longer true.
 */
export async function upsertHistoricalEvents(
  rows: HistoricalEventRow[],
  supabaseUrl: string,
  serviceRoleKey: string,
  batchSize = 500,
): Promise<number> {
  let written = 0;

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const response = await fetch(
      `${supabaseUrl}/rest/v1/historical_events?on_conflict=fingerprint`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(batch),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Event upsert failed with ${response.status}. ${body.slice(0, 400)}`);
    }
    written += batch.length;
  }

  return written;
}

/**
 * The address that removes one date's rows from before a given moment.
 *
 * Its own function so it can be read and tested without a network. The two
 * date filters are the safety: a prune is always scoped to one calendar date,
 * so a mistake in the timestamp can never reach beyond the date the run just
 * read.
 */
export function pruneQuery(month: number, day: number, before: string): string {
  return (
    `event_month=eq.${month}&event_day=eq.${day}` +
    `&imported_at=lt.${encodeURIComponent(before)}`
  );
}

/**
 * Removes rows the run did not produce, one date at a time.
 *
 * Only ever called with dates that read successfully and returned events, so
 * a page that failed to fetch, or that arrived in a shape the reader could not
 * follow, leaves its rows exactly where they are. That is the whole safety
 * argument: nothing is deleted on the strength of an absence, only on the
 * strength of a good read that no longer contains it.
 *
 * The alternative was leaving the old rows in place, which sounds harmless and
 * is not: Wikipedia edits sentences constantly, the fingerprint covers the
 * sentence, and the Today feed would show the old wording and the new wording
 * of the same event one above the other.
 */
export async function pruneHistoricalEvents(
  dates: { month: number; day: number }[],
  before: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<number> {
  let removed = 0;

  for (const date of dates) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/historical_events?${pruneQuery(date.month, date.day, before)}`,
      {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Prefer: "return=minimal,count=exact",
        },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Event prune failed with ${response.status}. ${body.slice(0, 400)}`);
    }

    // PostgREST answers a counted request with "*/12" in Content-Range.
    const range = response.headers.get("content-range") ?? "";
    const count = Number(range.split("/")[1]);
    if (Number.isFinite(count)) removed += count;
  }

  return removed;
}
