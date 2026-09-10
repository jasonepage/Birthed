// The checker. docs/the-wall.md section 5, and section 12 for what this
// session decided.
//
//   node dist/src/wall/check.js                # every open date
//   node dist/src/wall/check.js --date 2026-09-09
//   node dist/src/wall/check.js --dry          # read and report, write nothing
//
// Runs on the worker's schedule, every fifteen minutes, beside the news
// seeder. For every source on every open wall that recheck.ts says is due,
// it fetches the page and judges a check of kind resolves, then tests
// whether the page contains the stored quotation by exact string match and
// judges a check of kind quotation. Exact match only. No model is ever asked
// whether a quotation matches, and a quotation is never rewritten to make it
// match. verified_at is set only by a passing quotation check and is cleared
// by a failing one, on every read, whether or not the read is written down.
// A read whose result differs from the last recorded one is always written;
// a page that changes after a pass gets a new failing row and the old row is
// never edited. A read that says what the last row already says is written
// only as an occasional heartbeat, so a receipt stays a receipt. The
// schedule and the heartbeat are recheck.ts, with the reasons.
//
// Then, per story, it recomputes the tier through tierFor, graduates stories
// out of the pool under the pool rules including HOLD_HOURS, and hands the
// date to the allocator. A story that finds no room becomes overflow and is
// tried again on the next run. A story stamped false keeps its rectangle and
// is never grown.
//
// Two halves. checkSource and settle are pure and tested, as is the policy
// in recheck.ts; run is the glue that reads, fetches and writes.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadConfig, loadDotEnv } from "../config.js";
import { allocate, type Rect, type StoryInput, type Tier } from "./allocator.js";
import { insert, rows, update, type Db } from "./db.js";
import { HostSilence, fetchPage, ownerOf, pageContains, type Fetched, type OwnerRow } from "./page.js";
import { eligibleForWall, tierFor } from "./pool.js";
import { NEVER_CHECKED, dueForCheck, shouldRecord, summarize } from "./recheck.js";
import { outletOf } from "./url.js";

// ---------------------------------------------------------------------------
// Rows as the database holds them
// ---------------------------------------------------------------------------

export type Status = "pool" | "placed" | "overflow" | "false";

export interface DayRow {
  wall_date: string;
  opens_at: string;
  live_at: string;
  closes_at: string;
  closed_at: string | null;
}

export interface StoryRow {
  id: string;
  wall_date: string;
  submitted_at: string;
  submitted_by: string | null;
  status: Status;
  tier: Tier;
  support: number;
  priority: number;
  /** The imported row this story stands for, or null for the day's news. Read by the allocator's variety pass. */
  subject_kind?: string | null;
  outlet?: string;
  placed_at: string | null;
  anchor_mx: number | null;
  anchor_my: number | null;
  w_modules: number | null;
  h_modules: number | null;
}

export interface SourceRow {
  id: string;
  story_id: string;
  url: string;
  owner: string;
  quotation: string;
  verified_at: string | null;
  is_primary_doc: boolean;
  /** The importer read this page once; the checker leaves it alone. */
  imported: boolean;
}

export interface CheckRow {
  source_id: string;
  checked_at: string;
  kind: "resolves" | "quotation";
  passed: boolean;
  http_status: number | null;
  detail: string;
}

// ---------------------------------------------------------------------------
// One source, one fetch, two checks
// ---------------------------------------------------------------------------

export interface Judgement {
  checks: CheckRow[];
  /** What verified_at becomes: the check time on a pass, null on a fail. */
  verifiedAt: string | null;
}

/**
 * What one fetch says about one source. Always two rows: the page answered
 * or did not, and the page contains the quotation or does not. A page that
 * could not be read cannot contain anything, so that is a failed quotation
 * check too, and verified_at is cleared until a later run finds it again.
 */
export function checkSource(source: SourceRow, fetched: Fetched, at: string): Judgement {
  const resolves = fetched.status !== null && fetched.status >= 200 && fetched.status < 400;
  const checks: CheckRow[] = [{
    source_id: source.id,
    checked_at: at,
    kind: "resolves",
    passed: resolves,
    http_status: fetched.status,
    detail: fetched.detail,
  }];

  let contains = false;
  let detail: string;
  if (!resolves || fetched.body === null) {
    detail = "the page could not be read, so the quotation could not be checked";
  } else if (pageContains(fetched.body, source.quotation)) {
    contains = true;
    detail = "the page contains the quotation, exactly";
  } else {
    detail = "the page does not contain the quotation, exactly";
  }
  checks.push({
    source_id: source.id,
    checked_at: at,
    kind: "quotation",
    passed: contains,
    http_status: fetched.status,
    detail,
  });

  return { checks, verifiedAt: contains ? at : null };
}

// ---------------------------------------------------------------------------
// Settling a date: tiers, graduation, placement
// ---------------------------------------------------------------------------

export interface StoryUpdate {
  id: string;
  tier?: Tier;
  status?: Status;
  placed_at?: string | null;
  anchor_mx?: number;
  anchor_my?: number;
  w_modules?: number;
  h_modules?: number;
}

export interface SourceOwnerUpdate {
  id: string;
  owner: string;
}

export interface Snapshot {
  wall_date: string;
  taken_at: string;
  reason: "tick";
  board: {
    tiles: Array<{ story_id: string; mx: number; my: number; w: number; h: number; support: number; tier: Tier }>;
    overflow: string[];
  };
}

export interface Settled {
  stories: StoryUpdate[];
  owners: SourceOwnerUpdate[];
  snapshot: Snapshot | null;
}

function rectOf(story: StoryRow): Rect | null {
  if (story.anchor_mx === null || story.anchor_my === null || story.w_modules === null || story.h_modules === null) {
    return null;
  }
  return { mx: story.anchor_mx, my: story.anchor_my, w: story.w_modules, h: story.h_modules };
}

function sameRect(a: Rect | null, b: Rect): boolean {
  return a !== null && a.mx === b.mx && a.my === b.my && a.w === b.w && a.h === b.h;
}

/**
 * One date, after its sources have been checked. Pure.
 *
 * Owners are resolved through the ownership table from each source's host
 * and written back when they differ, so an edit to the table reaches the
 * receipts. The tier is what tierFor says the sources earn, with seen
 * directly only when a source a person marked as the thing itself has a
 * verified quotation. A pool story with enough evidence and enough support
 * is handed to the allocator alongside everything already placed; what
 * finds no room is overflow and is offered again next run. A false story is
 * laid down at its rectangle and grown by nothing.
 */
export function settle(
  day: DayRow,
  stories: StoryRow[],
  sources: SourceRow[],
  owners: OwnerRow[],
  now: string,
): Settled {
  const updates = new Map<string, StoryUpdate>();
  const touch = (id: string): StoryUpdate => {
    const existing = updates.get(id);
    if (existing) return existing;
    const made: StoryUpdate = { id };
    updates.set(id, made);
    return made;
  };

  const ownerUpdates: SourceOwnerUpdate[] = [];
  const byStory = new Map<string, Array<{ owner: string; verified: boolean; primary: boolean }>>();
  for (const source of sources) {
    const owner = ownerOf(owners, outletOf(source.url));
    if (owner !== source.owner) ownerUpdates.push({ id: source.id, owner });
    const list = byStory.get(source.story_id) ?? [];
    list.push({ owner, verified: source.verified_at !== null, primary: source.is_primary_doc });
    byStory.set(source.story_id, list);
  }

  const input: StoryInput[] = [];
  for (const story of stories) {
    const its = byStory.get(story.id) ?? [];
    const rect = rectOf(story);

    if (story.status === "false") {
      // Stamped. Keeps its exact rectangle, earns nothing, grows nowhere.
      if (rect !== null) input.push({ id: story.id, tier: story.tier, support: 0, placedAt: story.placed_at ?? story.submitted_at, anchor: rect, frozen: true });
      continue;
    }

    const seenDirect = its.some((s) => s.primary && s.verified);
    const tier = tierFor(its, seenDirect);
    if (tier !== story.tier) touch(story.id).tier = tier;

    if (story.status === "pool") {
      // No verified source, no evidence at all. The hold in pool.ts is for
      // a story whose one source says what the tile says and nobody has
      // confirmed it a second way; a dead link, a paywall or a rewritten
      // page is not a source that waited long enough, it is no source. So a
      // story that never verifies never leaves the pool. Section 12.
      if (!its.some((s) => s.verified)) continue;
      if (!eligibleForWall({ support: story.support, submittedAt: story.submitted_at, submittedBy: story.submitted_by }, its, now)) continue;
      touch(story.id).placed_at = now;
      input.push({ id: story.id, tier, support: story.support, priority: story.priority, placedAt: now, anchor: null,
                   subjectKind: story.subject_kind ?? null, outlet: story.outlet });
      continue;
    }

    // placed or overflow: placed_at is when it earned its place, and an
    // overflow story keeps that so it is considered in the order it earned
    // rather than as new each run.
    input.push({ id: story.id, tier, support: story.support, priority: story.priority, placedAt: story.placed_at ?? story.submitted_at, anchor: rect,
                 subjectKind: story.subject_kind ?? null, outlet: story.outlet });
  }

  if (input.length === 0) {
    return { stories: [...updates.values()], owners: ownerUpdates, snapshot: null };
  }

  const result = allocate(input);
  const byId = new Map(stories.map((s) => [s.id, s]));

  for (const placed of result.placed) {
    const story = byId.get(placed.id)!;
    if (story.status === "false") continue;
    const rect = { mx: placed.mx, my: placed.my, w: placed.w, h: placed.h };
    if (story.status === "placed" && sameRect(rectOf(story), rect)) continue;
    const u = touch(story.id);
    u.status = "placed";
    u.anchor_mx = rect.mx;
    u.anchor_my = rect.my;
    u.w_modules = rect.w;
    u.h_modules = rect.h;
  }
  for (const id of result.overflow) {
    const story = byId.get(id)!;
    if (story.status === "overflow") continue;
    touch(id).status = "overflow";
  }

  const supportOf = new Map(stories.map((s) => [s.id, s.support]));
  const tierOf = (id: string): Tier => updates.get(id)?.tier ?? byId.get(id)!.tier;
  const snapshot: Snapshot = {
    wall_date: day.wall_date,
    taken_at: now,
    reason: "tick",
    board: {
      tiles: result.placed.map((p) => ({
        story_id: p.id, mx: p.mx, my: p.my, w: p.w, h: p.h, support: supportOf.get(p.id) ?? 0, tier: tierOf(p.id),
      })),
      overflow: result.overflow,
    },
  };

  return { stories: [...updates.values()], owners: ownerUpdates, snapshot };
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

export interface RunReport {
  dates: string[];
  sourcesChecked: number;
  /** Sources the schedule left alone this run. Imported sources are not counted either way. */
  sourcesWaiting: number;
  /** Sources that were due but whose host had already gone silent twice this run. Nothing is written for them. */
  sourcesSilenced: number;
  /** Check rows written, across every date. */
  checksWritten: number;
  verified: number;
  failed: number;
  graduated: number;
  overflow: number;
  retiered: number;
}

/** The columns of a check row the schedule reads. */
type HistoryRow = Pick<CheckRow, "source_id" | "kind" | "checked_at" | "passed">;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function run(db: Db, options: { now?: Date; date?: string; dry?: boolean; log?: (line: string) => void } = {}): Promise<RunReport> {
  const now = options.now ?? new Date();
  const at = now.toISOString();
  const log = options.log ?? ((line: string) => console.log(line));
  // Pages are asked for the way a browser asks, PAGE_HEADERS in page.ts,
  // whatever the worker's configured agent says; that one is for Wikidata.
  // One silence tracker for the whole run, because a host that is not
  // answering for yesterday's wall is not answering for today's either.
  const silence = new HostSilence();

  const dayFilter = options.date
    ? `wall_date=eq.${options.date}`
    : `closes_at=gt.${encodeURIComponent(at)}&closed_at=is.null`;
  const days = await rows<DayRow>(db, `wall_days?select=wall_date,opens_at,live_at,closes_at,closed_at&${dayFilter}&order=wall_date.asc`);
  const report: RunReport = { dates: days.map((d) => d.wall_date), sourcesChecked: 0, sourcesWaiting: 0, sourcesSilenced: 0, checksWritten: 0, verified: 0, failed: 0, graduated: 0, overflow: 0, retiered: 0 };
  if (days.length === 0) {
    log("wall check: no open dates");
    return report;
  }
  const owners = await rows<OwnerRow>(db, "wall_outlet_owners?select=domain,owner");

  for (const day of days) {
    const stories = await rows<StoryRow>(db,
      `wall_stories?select=id,wall_date,submitted_at,submitted_by,status,tier,support,priority,subject_kind,outlet,placed_at,anchor_mx,anchor_my,w_modules,h_modules&wall_date=eq.${day.wall_date}&order=submitted_at.asc,id.asc`);
    const live = stories.filter((s) => s.status !== "false");
    const sources: SourceRow[] = [];
    for (const ids of chunk(live.map((s) => s.id), 80)) {
      sources.push(...await rows<SourceRow>(db,
        `wall_sources?select=id,story_id,url,owner,quotation,verified_at,is_primary_doc,imported&story_id=in.(${ids.join(",")})&order=added_at.asc,id.asc`));
    }

    // What the rows already say about each source, so the schedule can ask
    // when it was last read and what it said. Only the columns the policy
    // reads; the detail column is the bulk of a row and is not needed here.
    // Every row for the day's sources is read rather than the newest few,
    // because the policy also needs to know whether a source has ever
    // passed, and the volume is bounded by the policy itself once the rows
    // written before it age out with their walls.
    const priorChecks: HistoryRow[] = [];
    for (const ids of chunk(sources.filter((s) => !s.imported).map((s) => s.id), 80)) {
      priorChecks.push(...await rows<HistoryRow>(db,
        `wall_checks?select=source_id,kind,checked_at,passed&source_id=in.(${ids.join(",")})&order=checked_at.asc,id.asc`));
    }
    const histories = summarize(priorChecks);

    // One at a time: these are other people's servers and the wall is not
    // in a hurry. Which sources are read at all is recheck.ts's decision.
    const checks: CheckRow[] = [];
    let dueCount = 0;
    for (const source of sources) {
      // An imported source is the importer's own citation, read once when
      // the row was written. It is not fetched again and its verification
      // stands; the receipt says so. docs/the-wall.md section 13.
      if (source.imported) continue;
      const history = histories.get(source.id) ?? NEVER_CHECKED;
      if (!dueForCheck(history, source.verified_at, day.closes_at, at)) {
        report.sourcesWaiting += 1;
        continue;
      }
      if (silence.skips(source.url)) {
        report.sourcesSilenced += 1;
        continue;
      }
      const fetched = await fetchPage(source.url);
      silence.record(source.url, fetched);
      const judged = checkSource(source, fetched, at);
      if (shouldRecord(history, judged.checks)) checks.push(...judged.checks);
      dueCount += 1;
      report.sourcesChecked += 1;
      if (judged.verifiedAt !== null) report.verified += 1; else report.failed += 1;
      const before = source.verified_at;
      source.verified_at = judged.verifiedAt;
      // A pass moves verified_at to this check; a fail clears it. A fail on a
      // source that was already clear writes nothing. This happens whether
      // or not the check earned a row: for a passing source verified_at is
      // also how the schedule knows when the page was last read.
      if (!options.dry && before !== judged.verifiedAt) {
        await update(db, "wall_sources", `id=eq.${source.id}`, { verified_at: judged.verifiedAt });
      }
    }
    report.checksWritten += checks.length;
    if (!options.dry) {
      for (const batch of chunk(checks, 200)) await insert(db, "wall_checks", batch);
    }

    const settled = settle(day, stories, sources, owners, at);
    report.graduated += settled.stories.filter((u) => u.placed_at !== undefined && u.status === "placed").length;
    report.overflow += settled.stories.filter((u) => u.status === "overflow").length;
    report.retiered += settled.stories.filter((u) => u.tier !== undefined).length;

    if (!options.dry) {
      for (const owner of settled.owners) await update(db, "wall_sources", `id=eq.${owner.id}`, { owner: owner.owner });
      for (const u of settled.stories) {
        const { id, ...fields } = u;
        // A story that earned a place and found none keeps placed_at, so it
        // is tried again in the order it earned. Everything else is written
        // exactly as settled.
        await update(db, "wall_stories", `id=eq.${id}`, fields);
      }
      if (settled.snapshot !== null) {
        const last = await rows<{ board: Snapshot["board"] }>(db,
          `wall_snapshots?select=board&wall_date=eq.${day.wall_date}&order=taken_at.desc&limit=1`);
        if (last.length === 0 || JSON.stringify(last[0]!.board) !== JSON.stringify(settled.snapshot.board)) {
          await insert(db, "wall_snapshots", [settled.snapshot]);
        }
      }
    }

    log(`wall check ${day.wall_date}: ${sources.length} sources, ${dueCount} read, ${checks.length} check rows written, ${stories.length} stories, `
      + `${settled.stories.filter((u) => u.status === "placed" && u.placed_at !== undefined).length} graduated, `
      + `${settled.stories.filter((u) => u.status === "overflow").length} overflow, ${settled.owners.length} owners corrected`
      + (options.dry ? " (dry, nothing written)" : ""));
  }
  // The hosts that went silent are the one thing in this log worth reading
  // on the day a host starts refusing the worker, so they get their own line.
  if (silence.silenced().length > 0) {
    log(`wall check: ${report.sourcesSilenced} sources left unread because their host did not answer twice this run: ${silence.silenced().join(", ")}`);
  }
  return report;
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

function argument(args: string[], name: string): string | undefined {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
}

async function main(): Promise<void> {
  await loadDotEnv();
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const config = loadConfig({ needsWrite: !dry });
  const db: Db = { url: config.supabaseUrl, key: config.serviceRoleKey };
  const report = await run(db, { date: argument(args, "date"), dry });
  console.log(`checked ${report.sourcesChecked} sources on ${report.dates.length} dates, ${report.sourcesWaiting} not yet due, ${report.sourcesSilenced} on silent hosts, `
    + `${report.checksWritten} check rows written: ${report.verified} verified, ${report.failed} not, `
    + `${report.graduated} graduated, ${report.overflow} overflow, ${report.retiered} changed tier`);
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
