// The history seeder. docs/the-wall.md section 13, decided September 10,
// 2026: everything with a birthday today is a pixel. When a date's wall
// opens, what happened on this date, who was born on it and what came out on
// it are filed into the same pool as the day's news, submitted by nobody,
// with the row's own link and the row's own words, and the same three buzzes
// a day cover all of it.
//
//   node dist/src/wall/history.js          # every open date
//   node dist/src/wall/history.js --dry    # plan and print, write nothing
//
// Runs on the worker's schedule before the news, so a wall opens looking
// like the date. Four sources, the same four the site's date page was built
// from, read under the same screens the site applies: no suppressed event,
// no adult performer, only published culture rows somebody wrote about, only
// verified facts with no year and no region.
//
// The source on each story is the importer's own citation, marked imported,
// and the checker leaves it alone: the importer read that page once and the
// receipt says so rather than claiming a check that never ran.
//
// Priority is what goes first when the square has room and nobody has
// buzzed yet. Wikipedia's picks for the date and lines a person wrote go
// first, then the most looked up people, then the rest of the history, then
// the news. A word screen keeps a killing out of the first eight, the same
// screen web/src/highlight.ts applies to the share card; it still enters the
// pool and can be buzzed there.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadConfig, loadDotEnv } from "../config.js";
import { insert, rows, type Db } from "./db.js";
import { fitHeadline, openDates } from "./news.js";
import { fold } from "./page.js";

export type SubjectKind = "historical_event" | "birth_fact" | "cultural_event" | "person";

export interface HistoryStory {
  wallDate: string;
  subjectKind: SubjectKind;
  subjectId: string;
  headline: string;
  url: string;
  /** The subject, not the page: forty events share one Wikipedia article. */
  urlKey: string;
  outlet: string;
  quotation: string;
  priority: number;
}

// The two word screens from web/src/highlight.ts, copied rather than shared
// because the worker and the site are separate packages. If one changes, the
// other should; the test holds them to a few sentences each side agrees on.
const NOT_ON_A_BIRTHDAY_CARD =
  /\b(kill|killed|kills|killing|killings|massacre|massacres|massacred|shooting|shootings|shoots|shot|murder|murders|murdered|bomb|bombs|bombing|bombings|bombed|attack|attacks|attacked|dies|died|death|deaths|dead|crash|crashed|crashes|earthquake|earthquakes|hurricane|hurricanes|tsunami|tsunamis|famine|famines|war|wars|warfare|battle|battles|siege|sieges|executed|execution|executions|assassinat\w*|rape|rapes|raped|slaughter|slaughtered|genocide|terror\w*|hostage|hostages|riot|riots|invasion|invasions|invades|invaded|disaster|disasters|sank|sinking|sunk|explosion|explosions|exploded|epidemic|epidemics|pandemic|plague|plagues|suicide|abduct\w*|torture\w*|weapon|weapons|munition\w*|warhead\w*|casualt\w*|atrocit\w*)\b/i;
const NOT_FROM_AN_ENCYCLOPEDIA =
  /\b(deposed|revolt|rebellion|coup|troops|army|armies|military|nazi|holocaust|massacred|uprising|mutiny|purge|famine|refugees|persecution)\b/i;

/** Whether a sentence may lead: the screen that keeps a killing out of the first eight. */
export function mayLead(text: string): boolean {
  return !NOT_ON_A_BIRTHDAY_CARD.test(text) && !NOT_FROM_AN_ENCYCLOPEDIA.test(text);
}

export const PRIORITY_PICK = 3;
export const PRIORITY_PERSON = 2;
export const PRIORITY_HISTORY = 1;

/** How many people a date files; the rest stay on their own table. */
export const PEOPLE_PER_DATE = 12;
/** How many of those get the person priority. */
export const TOP_PEOPLE = 3;

// ---------------------------------------------------------------------------
// Rows as the database holds them
// ---------------------------------------------------------------------------

export interface EventRow { id: number | string; event_year: number | null; description: string; source_url: string | null }
export interface FactRow { id: number | string; fact: string; source_url: string | null }
export interface CultureRow {
  id: number | string; event_date: string; context_string: string | null; source_url: string | null; origin: string;
}
export interface PersonRow {
  wikidata_qid: string; name: string; birth_year: number | null; death_year: number | null; short_description: string | null;
}
export interface LeadLine { subject_kind: string; subject_id: string; line: string }

export interface DateHistory {
  events: EventRow[];
  facts: FactRow[];
  culture: CultureRow[];
  people: PersonRow[];
  /** Wikipedia's picks for the date, by year. */
  selectedYears: Set<number>;
  leadLines: LeadLine[];
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function subjectKey(kind: SubjectKind, id: string): string {
  return `subject:${kind}:${id}`;
}

/**
 * The stories one date's history makes. Pure.
 *
 * A row with no link or fewer than twenty characters to quote is skipped:
 * a story on the wall has a receipt or it is not on the wall. A lead line a
 * person wrote becomes the headline, with the row's own sentence as the
 * quotation, so the tile reads well and the receipt still quotes the page.
 */
export function planHistory(wallDate: string, history: DateHistory): HistoryStory[] {
  const lines = new Map(history.leadLines.map((l) => [`${l.subject_kind}:${l.subject_id}`, l.line]));
  const out: HistoryStory[] = [];
  const seen = new Set<string>();

  const push = (story: Omit<HistoryStory, "wallDate" | "urlKey">): void => {
    const urlKey = subjectKey(story.subjectKind, story.subjectId);
    if (seen.has(urlKey)) return;
    if (story.url === "" || story.quotation.length < 20 || story.headline === "") return;
    seen.add(urlKey);
    out.push({ wallDate, urlKey, ...story });
  };

  for (const e of history.events) {
    const id = String(e.id);
    const sentence = fold(e.description);
    const line = lines.get(`historical_event:${id}`);
    const picked = e.event_year !== null && history.selectedYears.has(e.event_year);
    const text = line ?? sentence;
    const year = e.event_year === null ? "" : `${e.event_year}: `;
    push({
      subjectKind: "historical_event", subjectId: id,
      headline: fitHeadline(`${year}${text}`),
      url: e.source_url ?? "", outlet: hostOf(e.source_url ?? ""),
      quotation: sentence.slice(0, 1000),
      priority: (picked || line !== undefined) && mayLead(sentence) ? PRIORITY_PICK : PRIORITY_HISTORY,
    });
  }

  for (const f of history.facts) {
    const id = String(f.id);
    const sentence = fold(f.fact);
    const line = lines.get(`birth_fact:${id}`);
    push({
      subjectKind: "birth_fact", subjectId: id,
      headline: fitHeadline(line ?? sentence),
      url: f.source_url ?? "", outlet: hostOf(f.source_url ?? ""),
      quotation: sentence.slice(0, 1000),
      priority: line !== undefined && mayLead(sentence) ? PRIORITY_PICK : PRIORITY_HISTORY,
    });
  }

  for (const c of history.culture) {
    if (c.context_string === null || fold(c.context_string) === "") continue;
    const id = String(c.id);
    const sentence = fold(c.context_string);
    const year = c.event_date.slice(0, 4);
    push({
      subjectKind: "cultural_event", subjectId: id,
      headline: fitHeadline(`${year}: ${sentence}`),
      url: c.source_url ?? "", outlet: hostOf(c.source_url ?? ""),
      quotation: sentence.slice(0, 1000),
      // Written by a person rather than imported as a title: the writing is
      // the bar the site already applies, so it leads with the picks.
      priority: c.origin !== "imported" && mayLead(sentence) ? PRIORITY_PICK : PRIORITY_HISTORY,
    });
  }

  history.people.slice(0, PEOPLE_PER_DATE).forEach((p, index) => {
    const description = fold(p.short_description ?? "");
    const born = p.birth_year === null ? "" : `, born ${p.birth_year}`;
    const headline = fitHeadline(`${p.name}${description ? `, ${description}` : ""}${born}`);
    // The quotation has to be twenty characters the page carries. A name
    // alone often is not, and a Wikidata page shows the name and the
    // description as its heading, so the pair is what is quoted.
    const quotation = fold(`${p.name}${description ? ` ${description}` : ""}`);
    push({
      subjectKind: "person", subjectId: p.wikidata_qid,
      headline,
      url: `https://www.wikidata.org/wiki/${p.wikidata_qid}`, outlet: "wikidata.org",
      quotation: quotation.length >= 20 ? quotation : headline,
      priority: index < TOP_PEOPLE ? PRIORITY_PERSON : PRIORITY_HISTORY,
    });
  });

  return out;
}

// ---------------------------------------------------------------------------
// Reading a date
// ---------------------------------------------------------------------------

export async function readHistory(db: Db, month: number, day: number): Promise<DateHistory> {
  const [events, facts, culture, people, selected, leads] = await Promise.all([
    rows<EventRow>(db, `historical_events?select=id,event_year,description,source_url&event_month=eq.${month}&event_day=eq.${day}&suppressed=eq.false&order=event_year.asc,id.asc`),
    rows<FactRow>(db, `birth_facts?select=id,fact,source_url&birth_month=eq.${month}&birth_day=eq.${day}&birth_year=eq.0&region_key=eq.&verified=eq.true&order=id.asc`),
    rows<CultureRow>(db, `cultural_events?select=id,event_date,context_string,source_url,origin&status=eq.published&event_date=like.*-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}&order=event_date.asc,id.asc`),
    rows<PersonRow>(db, `notable_people?select=wikidata_qid,name,birth_year,death_year,short_description&birth_month=eq.${month}&birth_day=eq.${day}&adult_content=eq.false&order=notability_score.desc&limit=${PEOPLE_PER_DATE}`),
    rows<{ event_year: number }>(db, `selected_anniversaries?select=event_year&event_month=eq.${month}&event_day=eq.${day}`),
    rows<LeadLine>(db, "lead_lines?select=subject_kind,subject_id,line"),
  ]);
  return { events, facts, culture, people, selectedYears: new Set(selected.map((s) => s.event_year)), leadLines: leads };
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

export async function run(db: Db, options: { now?: Date; dry?: boolean } = {}): Promise<{ planned: number; written: number }> {
  const now = options.now ?? new Date();
  let planned = 0;
  let written = 0;
  for (const wallDate of openDates(now.getTime())) {
    const [, m, d] = wallDate.split("-").map(Number) as [number, number, number];
    const history = await readHistory(db, m, d);
    const stories = planHistory(wallDate, history);
    planned += stories.length;
    if (options.dry) {
      for (const s of stories) console.log(`  ${wallDate} p${s.priority} ${s.subjectKind}: ${s.headline}`);
      continue;
    }
    if (stories.length === 0) continue;
    const at = now.toISOString();
    await insert(db, "wall_days", [{ wall_date: wallDate, opens_at: at, live_at: at, closes_at: at }], { ignoreDuplicates: true });
    // The conflict target is the same unique the news uses, and for a history
    // story url_key is the subject, so a second run files nothing twice.
    const inserted = await insert<{ id: string; url_key: string }>(
      db, "wall_stories?on_conflict=wall_date,url_key", stories.map((s) => ({
        wall_date: wallDate, headline: s.headline, url: s.url, url_key: s.urlKey, outlet: s.outlet, status: "pool", tier: "claimed",
        subject_kind: s.subjectKind, subject_id: s.subjectId, priority: s.priority,
      })), { returning: true, ignoreDuplicates: true });
    const byKey = new Map(stories.map((s) => [s.urlKey, s]));
    const sources = inserted.map((row) => {
      const s = byKey.get(row.url_key)!;
      return {
        story_id: row.id, url: s.url, url_key: s.urlKey, outlet: s.outlet, owner: s.outlet,
        headline: s.headline, quotation: s.quotation, imported: true, verified_at: at,
      };
    });
    await insert(db, "wall_sources", sources);
    written += inserted.length;
    console.log(`wall history ${wallDate}: ${inserted.length} new of ${stories.length}`);
  }
  return { planned, written };
}

async function main(): Promise<void> {
  await loadDotEnv();
  const dry = process.argv.includes("--dry");
  const config = loadConfig({ needsWrite: !dry });
  await run({ url: config.supabaseUrl, key: config.serviceRoleKey }, { dry });
}

function isEntryPoint(): boolean {
  const argv = process.argv[1];
  if (argv === undefined) return false;
  try {
    return realpathSync(argv) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
