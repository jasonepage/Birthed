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
}

/**
 * One row per event, keyed on the fingerprint of its date, year and
 * sentence, so running the import again corrects rows rather than doubling
 * them. An edited sentence on Wikipedia arrives as a new row and the old
 * one stays; that is rare enough to clean by hand.
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
