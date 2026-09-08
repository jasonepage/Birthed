/**
 * Lead lines: the card's wording, written by a person.
 *
 * The site asks one question above the fold and until now a scorer chose which
 * row it asked about and printed that row's own sentence. Measured against the
 * live September 8 page on 8 September 2026, that produced a routine space
 * station resupply flight, every reload, because it was the only sentence on
 * the date short enough to be a candidate.
 *
 * Raising the limit helped and did not fix it. Given Star Trek's first
 * broadcast and International Literacy Day, both 1966, both sourced, the
 * scorer takes Literacy Day because that sentence is eighteen characters
 * shorter. Nothing measurable about the two says which one people remember. A
 * person knows instantly, and this is where that judgement is kept.
 *
 * A lead line is not a correction and not a new claim. The row keeps its own
 * sentence and its own source, and the card prints both: the person's line in
 * the type the question is asked in, the record underneath it in the caption,
 * next to the link. That is the site's whole argument in one card.
 */

/** A row's card wording, keyed the way the answer forms key a row. */
export function leadKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

/**
 * Every lead line, by "kind:id".
 *
 * Read whole, like the facts and the events, because a few hundred rows answer
 * all 366 pages in one pass and 366 lookups would not. An empty table is the
 * normal state on the day this ships and every page is exactly the page it was.
 */
export async function fetchLeadLines(url: string, key: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "subject_kind,subject_id,line",
      order: "id.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${url}/rest/v1/lead_lines?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`lead lines failed with ${response.status}`);
    const rows = (await response.json()) as { subject_kind: string; subject_id: string; line: string }[];

    for (const row of rows) {
      const line = row.line.trim();
      // A blank line would blank the card rather than fall back to the row,
      // which is the one outcome worth a guard here. The column checks this
      // too; a check in one place is a check somebody edits in another file.
      if (line === "") continue;
      out.set(leadKey(row.subject_kind, row.subject_id), line);
    }

    if (rows.length < pageSize) break;
  }

  return out;
}
