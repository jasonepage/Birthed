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
