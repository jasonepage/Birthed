/**
 * Imports Wikipedia's selected anniversaries for all 366 dates.
 *
 * Run once, and again whenever it is worth refreshing: `npm run anniversaries`.
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and network, which is why
 * it is a script rather than part of the build.
 *
 * What it is for is in src/selected.ts. In short: the site had no notion of
 * importance, and Wikipedia's editors have been maintaining one, in public,
 * for years, because those pages go on their main page. Five to thirteen
 * events a date, argued over, free.
 *
 * **Nothing imported here is ever printed.** The rows are a ranking signal
 * matched against our own by year. That is deliberate: importing Wikipedia's
 * prose as page content would make this site the encyclopedia it exists to
 * differ from, and the licence and the voice are both wrong for it.
 *
 * It goes gently. One request a second, a real user agent, and it stops on the
 * first hard failure rather than hammering somebody else's servers, because
 * this is a free public good and using it badly is how it stops being free.
 */
import { everyDate } from "./model.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const AGENT = "birthed.app anniversary importer (one request a second, contact via birthed.app)";

interface Selection {
  event_month: number;
  event_day: number;
  event_year: number;
  text: string;
  source_url: string;
}

/**
 * Pulls year and line out of one selected anniversaries page.
 *
 * Parsed from the wikitext rather than the rendered HTML, because the wikitext
 * is a predictable list of "* [[year]] – text" and the HTML around it changes
 * with skins and templates. Anything that does not match that shape is skipped
 * rather than guessed at: a wrong year here silently promotes the wrong row on
 * a page, which is worse than a date having no selection at all.
 */
export function parseSelections(wikitext: string, month: number, day: number, url: string): Selection[] {
  const out: Selection[] = [];
  for (const line of wikitext.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("*")) continue;
    // "*[[1664]] – New Amsterdam ..." and the BC and AD variants around it.
    const year = /\[\[(\d{3,4})\]\]/.exec(trimmed);
    if (year === null) continue;
    const parts = trimmed.split(/\s[–—-]\s/);
    if (parts.length < 2) continue;
    const text = parts.slice(1).join(" - ")
      // Wiki markup out, leaving the words. Link labels win over targets,
      // which is what a reader would have seen.
      .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
      .replace(/\[\[([^\]]*)\]\]/g, "$1")
      .replace(/'''?/g, "")
      .replace(/<[^>]*>/g, "")
      .replace(/\{\{[^}]*\}\}/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 10 || text.length > 400) continue;
    out.push({
      event_month: month,
      event_day: day,
      event_year: Number(year[1]),
      text,
      source_url: url,
    });
  }
  return out;
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed");

  let written = 0;
  let empty = 0;

  for (const date of everyDate()) {
    const title = `Wikipedia:Selected_anniversaries/${MONTHS[date.month - 1]}_${date.day}`;
    const api = `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&action=raw`;
    const page = `https://en.wikipedia.org/wiki/${title}`;

    const response = await fetch(api, { headers: { "User-Agent": AGENT } });
    if (!response.ok) {
      // A missing date is a fact about Wikipedia, not a failure here. A 429 or
      // a 5xx is us being a bad guest and it stops.
      if (response.status === 404) { empty++; continue; }
      throw new Error(`${title} answered ${response.status}, stopping rather than retrying`);
    }
    const rows = parseSelections(await response.text(), date.month, date.day, page);
    if (rows.length === 0) { empty++; continue; }

    const write = await fetch(`${url}/rest/v1/selected_anniversaries?on_conflict=event_month,event_day,event_year,text`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    });
    if (!write.ok) throw new Error(`writing ${title} answered ${write.status} ${await write.text()}`);
    written += rows.length;
    console.log(`${MONTHS[date.month - 1]} ${date.day}: ${rows.length}`);

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n${written} selections across ${366 - empty} dates. ${empty} dates had none.`);
}

// Only when this file is the thing that was run. Importing it, which a test
// of the parser does, must not start hitting somebody else's servers.
if (process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "\u0000")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
