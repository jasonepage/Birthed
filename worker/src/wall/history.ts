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

export type SubjectKind = "historical_event" | "birth_fact" | "cultural_event" | "person" | "song";

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
/**
 * A song files at the news's own priority. Sixty odd number ones share a
 * date, and at history priority they would take every unbacked slot the
 * kind cap allows before a single event did. At nought they wait behind
 * the date's history and beside the day's news, and one buzz beats all of
 * that, which is how a song reaches the hive: somebody says so.
 */
export const PRIORITY_SONG = 0;

/** How many people a date files; the rest stay on their own table. */
export const PEOPLE_PER_DATE = 12;
/** How many of those get the person priority. */
export const TOP_PEOPLE = 3;

// ---------------------------------------------------------------------------
// Rows as the database holds them
// ---------------------------------------------------------------------------

export interface EventRow {
  id: number | string; event_year: number | null; description: string; source_url: string | null;
  /** Held back from the date page and the share card by the events importer's word screen. Not from the hive; see planHistory. */
  suppressed?: boolean;
}
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

/** Why a row was left out of the pool, counted so a silent drop is not silent. */
export interface Dropped {
  /** The row carries no link, so there is nothing for a receipt to point at. */
  noLink: number;
  /** The row has fewer than twenty characters to quote. */
  shortQuotation: number;
  /** The row makes no headline at all. */
  noHeadline: number;
}

/**
 * The stories one date's history makes. Pure.
 *
 * A row with no link or fewer than twenty characters to quote is skipped:
 * a story on the wall has a receipt or it is not on the wall. It is skipped
 * out loud: `dropped`, when given, counts each reason, and run prints it.
 * Measured on September 10, 2026, on the three open dates, that count was
 * nought, nought and nought; every row that was missing from the hive was
 * missing for the reason below. A lead line a person wrote becomes the
 * headline, with the row's own sentence as the quotation, so the tile reads
 * well and the receipt still quotes the page.
 *
 * A suppressed event files like any other event. The flag is the events
 * importer's word screen, and it exists for the date page and the share
 * card, where a birthday reader should not be handed a plane crash. The
 * hive asks a different question, what mattered about the date, and on
 * September 10 the screen was holding back the answer: the Charlie Kirk
 * assassination, Hurricane Irma, and forty seven of the eighty five rows on
 * September 11. Nathan's call, September 10, 2026: they enter the pool at
 * the ordinary history priority, competing for an unbacked slot like any
 * other history, and never as a pick, because mayLead already keeps a
 * killing out of the first eight and the screen agrees with it.
 */
export function planHistory(wallDate: string, history: DateHistory, dropped?: Dropped): HistoryStory[] {
  const lines = new Map(history.leadLines.map((l) => [`${l.subject_kind}:${l.subject_id}`, l.line]));
  const out: HistoryStory[] = [];
  const seen = new Set<string>();

  const push = (story: Omit<HistoryStory, "wallDate" | "urlKey">): void => {
    const urlKey = subjectKey(story.subjectKind, story.subjectId);
    if (seen.has(urlKey)) return;
    if (story.url === "") { if (dropped) dropped.noLink += 1; return; }
    if (story.quotation.length < 20) { if (dropped) dropped.shortQuotation += 1; return; }
    if (story.headline === "") { if (dropped) dropped.noHeadline += 1; return; }
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
      priority: (picked || line !== undefined) && mayLead(sentence) && e.suppressed !== true ? PRIORITY_PICK : PRIORITY_HISTORY,
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
// The number one songs. docs/the-wall.md section 16: "not a pixel yet"
// becomes a pixel.
// ---------------------------------------------------------------------------

export const CHART_NAME = "Billboard Hot 100";
/** Days a weekly chart covers, counting the issue date itself. The same rule as web/src/songs.ts. */
const CHART_WINDOW = 7;

export interface SongRow { chart_date: string; song: string; artist: string; source_url: string }

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The number one song on a calendar date in every year that has one, newest
 * year first. A chart week covers the six days before its issue date and
 * the issue itself, the rule `coverageByDay` in web/src/songs.ts applies and
 * CLAUDE.md records: the first issue dated on or after the date and no more
 * than six days after it. A year with no covering issue is left out rather
 * than given the nearest one, so February 29 has only leap years, and 1958,
 * which is not imported, has nothing. Absent beats wrong.
 */
export function songsOn(weeks: SongRow[], month: number, day: number): Array<SongRow & { year: number }> {
  const covered = new Map<string, SongRow>();
  for (const week of weeks) {
    for (let back = 0; back < CHART_WINDOW; back += 1) {
      const covers = addDays(week.chart_date, -back);
      if (!covered.has(covers)) covered.set(covers, week);
    }
  }
  const out: Array<SongRow & { year: number }> = [];
  const years = new Set(weeks.map((w) => Number(w.chart_date.slice(0, 4))));
  for (const year of [...years].sort((a, b) => b - a)) {
    const iso = `${year}-${monthDay(month, day)}`;
    // A date that does not exist in this year, February 29 mostly.
    if (new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso) continue;
    const week = covered.get(iso);
    if (week !== undefined) out.push({ ...week, year });
  }
  return out;
}

/**
 * The stories a date's number ones make. Pure.
 *
 * Keyed by the issue date, which is the one thing that names a chart week.
 * The headline is the sentence a person says, "the number one song the week
 * I was born". The receipt is Wikipedia's list for that year, the page the
 * row was read from, and the quotation is the song and the artist as that
 * table prints them, in quotation marks and then the name. That pairing is
 * how every year list is laid out and it has not been checked from here
 * against a rendered page, because this session had no network; the source
 * is marked imported and the checker leaves it alone, the same as every
 * other history row. If a rendered table proves the pairing wrong, the fix
 * is here and not in the match rule.
 */
export function planSongs(wallDate: string, songs: Array<SongRow & { year: number }>): HistoryStory[] {
  const out: HistoryStory[] = [];
  const seen = new Set<string>();
  for (const s of songs) {
    const urlKey = subjectKey("song", s.chart_date);
    if (seen.has(urlKey) || s.source_url === "" || s.song.trim() === "") continue;
    seen.add(urlKey);
    out.push({
      wallDate, urlKey,
      subjectKind: "song", subjectId: s.chart_date,
      headline: fitHeadline(`${s.year}: "${fold(s.song)}" by ${fold(s.artist)} was the number one song`),
      url: s.source_url, outlet: hostOf(s.source_url),
      quotation: fold(`"${s.song}" ${s.artist}`).slice(0, 1000),
      priority: PRIORITY_SONG,
    });
  }
  return out;
}

/** Every Hot 100 week, read once per run and shared by the three open dates. */
export async function readSongs(db: Db): Promise<SongRow[]> {
  return rows<SongRow>(db, `chart_weeks?select=chart_date,song,artist,source_url&chart_name=eq.${encodeURIComponent(CHART_NAME)}&order=chart_date.asc`);
}

// ---------------------------------------------------------------------------
// Reading a date
// ---------------------------------------------------------------------------

/** "09-09" for a month and a day, zero padded the way a date is written. */
export function monthDay(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The month and day of a stored date, or "" when it is not one.
 *
 * The column is a date and the automatic interface hands it back as
 * "1994-09-09", so this is the last ten characters' middle five. A value
 * that is not shaped like a date returns "" and matches nothing, because a
 * row filed under a date nobody can read is not a row to guess about.
 */
export function monthDayOf(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match === null ? "" : `${match[2]}-${match[3]}`;
}

export async function readHistory(db: Db, month: number, day: number): Promise<DateHistory> {
  const [events, facts, culture, people, selected, leads] = await Promise.all([
    // Suppressed rows too. The screen is the date page's, not the hive's;
    // planHistory says why.
    rows<EventRow>(db, `historical_events?select=id,event_year,description,source_url,suppressed&event_month=eq.${month}&event_day=eq.${day}&order=event_year.asc,id.asc`),
    rows<FactRow>(db, `birth_facts?select=id,fact,source_url&birth_month=eq.${month}&birth_day=eq.${day}&birth_year=eq.0&region_key=eq.&verified=eq.true&order=id.asc`),
    // Every published row, screened here rather than by the database.
    //
    // `event_date` is a date column, and asking PostgREST for
    // `event_date=like.*-09-09` builds `event_date LIKE '%-09-09'`, which
    // Postgres refuses: there is no `date ~~ text` operator. That is a 400,
    // `rows` throws it, the throw takes out the whole `Promise.all` below,
    // and `tick.ts` catches it, writes one line to a log nobody reads and
    // carries on to the news. The history seeder failed on every tick from
    // the day it shipped and the only visible symptom was a wall made
    // entirely of wire copy.
    //
    // Three hundred and ninety three published rows in the whole table, so
    // reading all of them and keeping the ones on this month and day costs
    // less than being clever. `monthDayOf` is the screen.
    rows<CultureRow>(db, `cultural_events?select=id,event_date,context_string,source_url,origin&status=eq.published&order=event_date.asc,id.asc`),
    rows<PersonRow>(db, `notable_people?select=wikidata_qid,name,birth_year,death_year,short_description&birth_month=eq.${month}&birth_day=eq.${day}&adult_content=eq.false&order=notability_score.desc&limit=${PEOPLE_PER_DATE}`),
    rows<{ event_year: number }>(db, `selected_anniversaries?select=event_year&event_month=eq.${month}&event_day=eq.${day}`),
    rows<LeadLine>(db, "lead_lines?select=subject_kind,subject_id,line"),
  ]);
  const onThisDate = culture.filter((c) => monthDayOf(c.event_date) === monthDay(month, day));
  return { events, facts, culture: onThisDate, people, selectedYears: new Set(selected.map((s) => s.event_year)), leadLines: leads };
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

export async function run(db: Db, options: { now?: Date; dry?: boolean } = {}): Promise<{ planned: number; written: number }> {
  const now = options.now ?? new Date();
  let planned = 0;
  let written = 0;
  // The chart is one table for every date, so it is read once. A read that
  // fails costs the songs and nothing else: the date's events and people
  // still file, and the log says what was missed.
  let weeks: SongRow[] = [];
  try {
    weeks = await readSongs(db);
  } catch (error: unknown) {
    console.error(`wall history: the chart could not be read, so no songs file this run: ${error instanceof Error ? error.message : error}`);
  }
  for (const wallDate of openDates(now.getTime())) {
    const [, m, d] = wallDate.split("-").map(Number) as [number, number, number];
    const history = await readHistory(db, m, d);
    const dropped: Dropped = { noLink: 0, shortQuotation: 0, noHeadline: 0 };
    const stories = planHistory(wallDate, history, dropped);
    const songs = planSongs(wallDate, songsOn(weeks, m, d));
    planned += stories.length + songs.length;
    // A row left out is said so, per date and per reason, every run. A stage
    // that drops rows quietly looks exactly like one that drops none.
    const left = dropped.noLink + dropped.shortQuotation + dropped.noHeadline;
    if (left > 0) {
      console.log(`wall history ${wallDate}: ${left} rows left out, ${dropped.noLink} with no link, ${dropped.shortQuotation} with under twenty characters to quote, ${dropped.noHeadline} with no headline`);
    }
    if (options.dry) {
      for (const s of [...stories, ...songs]) console.log(`  ${wallDate} p${s.priority} ${s.subjectKind}: ${s.headline}`);
      continue;
    }
    if (stories.length === 0 && songs.length === 0) continue;
    const at = now.toISOString();
    await insert(db, "wall_days", [{ wall_date: wallDate, opens_at: at, live_at: at, closes_at: at }], { ignoreDuplicates: true });
    written += await file(db, wallDate, "history", stories, at);
    // The songs go in their own insert, after the date's history has landed.
    // The first day the songs shipped, the database refused their kind, the
    // refusal took the whole insert with it, and the date's events and people
    // were not filed either. A kind the database will not take must cost that
    // kind and nothing else.
    try {
      written += await file(db, wallDate, "songs", songs, at);
    } catch (error: unknown) {
      console.error(`wall history ${wallDate}: the songs were refused and the rest of the date stands: ${error instanceof Error ? error.message.slice(0, 300) : error}`);
    }
  }
  return { planned, written };
}

/** One batch of stories and their imported sources onto a date. Returns how many were new. */
async function file(db: Db, wallDate: string, what: string, stories: HistoryStory[], at: string): Promise<number> {
  if (stories.length === 0) return 0;
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
  if (sources.length > 0) await insert(db, "wall_sources", sources);
  console.log(`wall ${what} ${wallDate}: ${inserted.length} new of ${stories.length}`);
  return inserted.length;
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
