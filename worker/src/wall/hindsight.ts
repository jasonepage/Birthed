// Hindsight. docs/the-wall.md section 23, decided September 21, 2026.
//
// Two jobs, both on the tick.
//
// Stories return. When a date's hive opens, every news or submitted story
// that ended on an earlier year's sealed board for that calendar date is
// refiled into the new pool: same page, same headline, same url_key, the
// outlet carrying the year it was first filed, at history priority, with
// its sources copied and marked imported. A story stamped false does not
// return. Imported history already returns by itself, because the history
// seeder files the same subject every year, so this covers only the rows
// with no subject.
//
// Outcomes. On a sealed story's first, fifth and tenth anniversary the
// worker writes one row to wall_outcomes: false if the checker stamped it,
// held if the same page was buzzed on a later year's hive for the date on
// or before the anniversary, forgotten otherwise. Only stories that were on
// the board, placed or false, get one. The unique on (story_id, anniversary)
// makes a second run write nothing.
//
//   node dist/src/wall/hindsight.js          # both jobs, every open date
//   node dist/src/wall/hindsight.js --dry    # plan and print, write nothing
//
// The sealed board is never re-cut. Nothing here touches a rectangle, a
// support count or a boost.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadConfig, loadDotEnv } from "../config.js";
import { insert, rows, type Db } from "./db.js";
import { PRIORITY_HISTORY } from "./history.js";
import { easternDateOf, openDates } from "./news.js";

export const ANNIVERSARIES = [1, 5, 10] as const;
export type Anniversary = (typeof ANNIVERSARIES)[number];
export type Outcome = "held" | "false" | "forgotten";

/** A story as the sealed board left it, with what this job needs of it. */
export interface SealedStory {
  id: string;
  wallDate: string;
  headline: string;
  url: string;
  urlKey: string;
  outlet: string;
  status: "placed" | "false" | "pool" | "overflow";
  subjectKind: string | null;
}

export interface SourceCopy {
  url: string;
  urlKey: string;
  outlet: string;
  owner: string;
  headline: string;
  quotation: string;
}

/** A story to refile on a later year's hive. */
export interface ReturningStory {
  wallDate: string;
  headline: string;
  url: string;
  urlKey: string;
  outlet: string;
  /** The year the page was first filed, which the outlet carries. */
  firstYear: number;
  sources: SourceCopy[];
}

/** "npr.org, 2026": the outlet with the year the page first landed, so a returning tile reads as last year's. */
export function returningOutlet(outlet: string, firstYear: number): string {
  return `${outlet}, ${firstYear}`;
}

/** The outlet a returning story came in with, if the outlet carries a year, else null. */
export function firstYearOf(outlet: string): number | null {
  const m = /^(.*), (\d{4})$/.exec(outlet);
  return m ? Number(m[2]) : null;
}

/**
 * The stories to refile on a date's new hive, from the stories that ended
 * on the sealed boards of earlier years for the same month and day. Only
 * rows with no subject: everything imported returns through the history
 * seeder. Only rows that were placed: a story that never left the pool was
 * never a claim, and one stamped false does not come back. A page on two
 * earlier boards returns once, from the year it first landed, and a page
 * already in the new hive's pool is left to the unique on the insert.
 */
export function planReturning(wallDate: string, earlier: Array<SealedStory & { sources: SourceCopy[] }>): ReturningStory[] {
  const monthDay = wallDate.slice(5);
  const byKey = new Map<string, ReturningStory>();
  const sorted = [...earlier].sort((a, b) => a.wallDate.localeCompare(b.wallDate) || a.id.localeCompare(b.id));
  for (const s of sorted) {
    if (s.wallDate >= wallDate || s.wallDate.slice(5) !== monthDay) continue;
    if (s.subjectKind !== null) continue;
    if (s.status !== "placed") continue;
    if (byKey.has(s.urlKey)) continue;
    // A story that itself returned carries the year it was first filed;
    // keep that year rather than stacking "2026, 2027" onto the outlet.
    const carried = firstYearOf(s.outlet);
    const firstYear = carried ?? Number(s.wallDate.slice(0, 4));
    const outlet = carried === null ? s.outlet : s.outlet.replace(/, \d{4}$/, "");
    byKey.set(s.urlKey, {
      wallDate, headline: s.headline, url: s.url, urlKey: s.urlKey, outlet: returningOutlet(outlet, firstYear), firstYear,
      sources: s.sources.filter((src) => src.quotation.length >= 20),
    });
  }
  return [...byKey.values()];
}

/** "2027-09-09" for the first anniversary of "2026-09-09". February 29 lands on March 1 in a common year, which is what Date does. */
export function anniversaryDate(wallDate: string, years: number): string {
  const [y, m, d] = wallDate.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y + years, m - 1, d)).toISOString().slice(0, 10);
}

/** Which anniversaries of a sealed date have arrived by a given Eastern date. */
export function anniversariesDue(wallDate: string, today: string): Anniversary[] {
  return ANNIVERSARIES.filter((n) => anniversaryDate(wallDate, n) <= today);
}

/**
 * The verdict on one story at one anniversary. `laterBuzzedOn` is the wall
 * dates of later hives for the same calendar date on which the same page
 * had at least one buzz; only those on or before the anniversary count, so
 * a fifth anniversary verdict cannot be moved by a buzz in year six.
 */
export function decideOutcome(story: Pick<SealedStory, "status" | "wallDate">, anniversary: Anniversary, laterBuzzedOn: string[]): { outcome: Outcome; note: string } {
  if (story.status === "false") return { outcome: "false", note: "Stamped false by the checker before the anniversary." };
  const until = anniversaryDate(story.wallDate, anniversary);
  const held = laterBuzzedOn.filter((d) => d > story.wallDate && d <= until).sort();
  if (held.length > 0) {
    const first = held[0]!;
    return { outcome: "held", note: `Buzzed again on the hive for ${first}${held.length > 1 ? ` and ${held.length - 1} later hive${held.length > 2 ? "s" : ""}` : ""}.` };
  }
  return { outcome: "forgotten", note: `On the board that day. Not buzzed on any later hive for the date by ${until}.` };
}

// ---------------------------------------------------------------------------
// Reading and writing
// ---------------------------------------------------------------------------

interface StoryRow {
  id: string;
  wall_date: string;
  headline: string;
  url: string;
  url_key: string;
  outlet: string;
  status: SealedStory["status"];
  support: number;
  subject_kind: string | null;
}

interface SourceRow {
  story_id: string;
  url: string;
  url_key: string;
  outlet: string;
  owner: string;
  headline: string;
  quotation: string;
}

/** Every story ever filed for a month and day, on every year's hive, with its sources. */
export const FIRST_HIVE_YEAR = 2026;

/** Every wall date for a month and day from the first hive's year through a year, inclusive. */
export function datesAcrossYears(monthDay: string, throughYear: number): string[] {
  const out: string[] = [];
  for (let y = FIRST_HIVE_YEAR; y <= throughYear; y++) out.push(`${y}-${monthDay}`);
  return out;
}

async function readDateAcrossYears(db: Db, monthDay: string, throughYear: number): Promise<Array<SealedStory & { support: number; sources: SourceCopy[] }>> {
  // The exact dates, listed. Never a LIKE on a date column through the
  // automatic interface, docs/the-wall.md section 17, and never the whole
  // table: a tick runs every quarter hour.
  const dates = datesAcrossYears(monthDay, throughYear).join(",");
  const onDate = await rows<StoryRow>(db, `wall_stories?select=id,wall_date,headline,url,url_key,outlet,status,support,subject_kind&wall_date=in.(${dates})&order=wall_date.asc,id.asc`);
  if (onDate.length === 0) return [];
  const sources: SourceRow[] = [];
  for (let i = 0; i < onDate.length; i += 100) {
    const ids = onDate.slice(i, i + 100).map((r) => r.id).join(",");
    sources.push(...await rows<SourceRow>(db, `wall_sources?select=story_id,url,url_key,outlet,owner,headline,quotation&story_id=in.(${ids})`));
  }
  const byStory = new Map<string, SourceCopy[]>();
  for (const s of sources) {
    const list = byStory.get(s.story_id) ?? [];
    list.push({ url: s.url, urlKey: s.url_key, outlet: s.outlet, owner: s.owner, headline: s.headline, quotation: s.quotation });
    byStory.set(s.story_id, list);
  }
  return onDate.map((r) => ({
    id: r.id, wallDate: r.wall_date, headline: r.headline, url: r.url, urlKey: r.url_key, outlet: r.outlet,
    status: r.status, subjectKind: r.subject_kind, support: r.support, sources: byStory.get(r.id) ?? [],
  }));
}

/** Refiles returning stories on one open date. Returns how many were new. */
export async function fileReturning(db: Db, wallDate: string, stories: ReturningStory[], at: string): Promise<number> {
  if (stories.length === 0) return 0;
  const inserted = await insert<{ id: string; url_key: string }>(
    db, "wall_stories?on_conflict=wall_date,url_key", stories.map((s) => ({
      wall_date: wallDate, headline: s.headline, url: s.url, url_key: s.urlKey, outlet: s.outlet, status: "pool", tier: "claimed",
      subject_kind: null, subject_id: null, priority: PRIORITY_HISTORY,
    })), { returning: true, ignoreDuplicates: true });
  const byKey = new Map(stories.map((s) => [s.urlKey, s]));
  const sources = inserted.flatMap((row) => {
    const s = byKey.get(row.url_key)!;
    return s.sources.map((src) => ({
      story_id: row.id, url: src.url, url_key: src.urlKey, outlet: src.outlet, owner: src.owner,
      headline: src.headline, quotation: src.quotation, imported: true, verified_at: at,
    }));
  });
  if (sources.length > 0) await insert(db, "wall_sources", sources);
  console.log(`wall hindsight ${wallDate}: ${inserted.length} returning of ${stories.length}`);
  return inserted.length;
}

export interface HindsightReport {
  returned: number;
  outcomes: number;
}

/**
 * Both jobs. Returning stories for every open date, then outcomes for every
 * sealed story on those dates' month and day whose anniversary has arrived
 * and has no row yet. The outcomes are keyed to the open dates on purpose:
 * a date's anniversaries land on the date itself, so the day the hive
 * reopens is the day last year's verdicts are written.
 */
export async function run(db: Db, options: { now?: Date; dry?: boolean } = {}): Promise<HindsightReport> {
  const now = options.now ?? new Date();
  const today = easternDateOf(now.getTime());
  const at = now.toISOString();
  const report: HindsightReport = { returned: 0, outcomes: 0 };
  for (const wallDate of openDates(now.getTime())) {
    const monthDay = wallDate.slice(5);
    const across = await readDateAcrossYears(db, monthDay, Number(wallDate.slice(0, 4)));
    if (across.length === 0) continue;

    const returning = planReturning(wallDate, across.filter((s) => s.wallDate < wallDate));
    if (options.dry) {
      for (const s of returning) console.log(`  ${wallDate} returning from ${s.firstYear}: ${s.headline}`);
    } else if (returning.length > 0) {
      await insert(db, "wall_days", [{ wall_date: wallDate, opens_at: at, live_at: at, closes_at: at }], { ignoreDuplicates: true });
      report.returned += await fileReturning(db, wallDate, returning, at);
    }

    // Outcomes. Which later hives each page was buzzed on, by url_key.
    const buzzedOn = new Map<string, string[]>();
    for (const s of across) {
      if (s.support <= 0) continue;
      const list = buzzedOn.get(s.urlKey) ?? [];
      list.push(s.wallDate);
      buzzedOn.set(s.urlKey, list);
    }
    const sealed = across.filter((s) => (s.status === "placed" || s.status === "false") && anniversariesDue(s.wallDate, today).length > 0);
    if (sealed.length === 0) continue;
    const existing = new Set<string>();
    for (let i = 0; i < sealed.length; i += 100) {
      const ids = sealed.slice(i, i + 100).map((s) => s.id).join(",");
      for (const o of await rows<{ story_id: string; anniversary: number }>(db, `wall_outcomes?select=story_id,anniversary&story_id=in.(${ids})`)) {
        existing.add(`${o.story_id}:${o.anniversary}`);
      }
    }
    const toWrite: Array<{ story_id: string; anniversary: number; outcome: Outcome; note: string }> = [];
    for (const s of sealed) {
      for (const n of anniversariesDue(s.wallDate, today)) {
        if (existing.has(`${s.id}:${n}`)) continue;
        const { outcome, note } = decideOutcome(s, n, buzzedOn.get(s.urlKey) ?? []);
        toWrite.push({ story_id: s.id, anniversary: n, outcome, note });
        if (options.dry) console.log(`  ${s.wallDate} year ${n} ${outcome}: ${s.headline}`);
      }
    }
    if (!options.dry && toWrite.length > 0) {
      await insert(db, "wall_outcomes?on_conflict=story_id,anniversary", toWrite, { ignoreDuplicates: true });
      console.log(`wall hindsight ${monthDay}: ${toWrite.length} outcomes written`);
    }
    report.outcomes += toWrite.length;
  }
  return report;
}

async function main(): Promise<void> {
  await loadDotEnv();
  const config = loadConfig({ needsWrite: true });
  const dry = process.argv.includes("--dry");
  const report = await run({ url: config.supabaseUrl, key: config.serviceRoleKey }, { dry });
  console.log(`wall hindsight: ${report.returned} stories returned, ${report.outcomes} outcomes${dry ? " (dry, nothing written)" : ""}`);
}

const entry = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (entry === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
