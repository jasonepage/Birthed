// The wall on a date page, and the receipt page for each story on it.
// docs/the-wall.md is the authority, and section 10 records the decisions
// this file was built on.
//
// The pages are baked at build time like every other section, from the
// rectangles the server side allocator stored, so every reader sees the same
// wall. A date page shows the newest wall its month and day have; every
// story on every year's wall gets a receipt page under the date.
//
// Boosting from the web, decided September 10, 2026, docs/the-wall.md
// section 13. While a date is taking boosts, and only in the section
// serve.ts renders at request time, every tile and every list row is a
// plain form: the headline is the button, one tap posts one unit to /boost,
// and the outlet name is the link to the receipt. No script, on a site that
// ships none. A baked page never carries the forms, so a date that closed
// after a deploy does not offer a tap the database would refuse. What a
// reader has left and which stories they backed are theirs alone, and are
// written into the page as a style block by wallMarks, the way my_answers
// hands remembrance answers back: nothing about anybody else, no count of
// people, no direction.
//
// The three open dates are the exception, decided September 9, 2026 in the
// second build session, docs/the-wall.md section 12. While a date is open its
// wall changes by the quarter hour, and section 7 promises a reader watches
// the day take shape, so for those three pages serve.ts reads the wall at
// request time through fetchWallDay below and swaps it into the baked page
// between the markers wallSection writes. When anything about that read
// fails the baked wall is served untouched, and a closed date calls nothing.
//
// Nothing in this module may cost anything at import. serve.ts imports
// render.ts which imports this, and a module that builds a formatter or
// reads a clock at load runs before the server has listened.

import { agreeOnNews } from "./agree.js";
import { monthName, slug } from "./model.js";

// Its own copy rather than render.ts's, because render.ts imports this file
// for the section and the styles, and a module cycle that reads a constant
// at load time fails in one import order and works in the other.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type WallTier = "claimed" | "reported" | "seen_direct";
export type WallStatus = "pool" | "placed" | "overflow" | "false";

export const BOARD_MODULES = 16;

export interface WallCheck {
  checkedAt: string;
  kind: "resolves" | "quotation";
  passed: boolean;
  httpStatus: number | null;
  detail: string | null;
}

export interface WallSource {
  id: string;
  url: string;
  outlet: string;
  owner: string;
  headline: string;
  quotation: string;
  verifiedAt: string | null;
  addedAt: string;
  checks: WallCheck[];
}

export interface WallStory {
  id: string;
  wallDate: string;
  submittedAt: string;
  headline: string;
  url: string;
  outlet: string;
  status: WallStatus;
  tier: WallTier;
  /** Boost units. */
  support: number;
  /** Order among unbacked stories in the feed: the date's own history above the news feeds. 0 to 9. */
  priority: number;
  placedAt: string | null;
  rect: { mx: number; my: number; w: number; h: number } | null;
  falseAt: string | null;
  falseNote: string | null;
  /**
   * The imported row this story stands for, or null for the day's news:
   * "song" and an issue date, "person" and a Wikidata identifier, and so on.
   * The worker writes both. Together they are the tile's data-subject, which
   * is what a baked picture rule matches; see pictureRules.
   */
  subjectKind: string | null;
  subjectId: string | null;
  sources: WallSource[];
  /**
   * How the story aged, written by the worker on its first, fifth and
   * tenth anniversary: held, false or forgotten. docs/the-wall.md section
   * 23. Absent until the first anniversary, so a sealed board today draws
   * nothing from it.
   */
  outcomes?: WallOutcome[];
}

export type WallOutcomeKind = "held" | "false" | "forgotten";
export interface WallOutcome {
  anniversary: number;
  outcome: WallOutcomeKind;
  note: string | null;
  recordedAt: string;
}

interface OutcomeRow { story_id: string; anniversary: number; outcome: WallOutcomeKind; note: string | null; recorded_at: string }

function outcomeFrom(o: Omit<OutcomeRow, "story_id">): WallOutcome {
  return { anniversary: o.anniversary, outcome: o.outcome, note: o.note, recordedAt: o.recorded_at };
}

export interface WallDay {
  wallDate: string;
  year: number;
  month: number;
  day: number;
  opensAt: string;
  liveAt: string;
  closesAt: string;
  closedAt: string | null;
  stories: WallStory[];
}

/** "9-9" for a month and day, the same key shape the rest of the build uses. */
export function wallKey(month: number, day: number): string {
  return `${month}-${day}`;
}

function parts(wallDate: string): { year: number; month: number; day: number } {
  const [y, m, d] = wallDate.split("-").map(Number);
  return { year: y ?? 0, month: m ?? 0, day: d ?? 0 };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * Reads a table whole. A 404 means the table is not there, which is what
 * production looks like before the wall migration has run, and that is an
 * empty wall rather than a failed build: the September 9 deploy failed on
 * exactly this, and a section that does not exist yet must never take the
 * site down. Any other failure still throws, because a wall that exists and
 * cannot be read is a real problem.
 */
async function rows<T>(url: string, key: string, path: string): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const joiner = path.includes("?") ? "&" : "?";
    const response = await fetch(`${url}/rest/v1/${path}${joiner}limit=${pageSize}&offset=${offset}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (response.status === 404) {
      console.log(`wall: ${path.split("?")[0]} is not there yet, so no page carries a wall`);
      return [];
    }
    if (!response.ok) throw new Error(`wall: ${path} failed with ${response.status}`);
    const page = (await response.json()) as T[];
    out.push(...page);
    if (page.length < pageSize) return out;
  }
}

interface DayRow { wall_date: string; opens_at: string; live_at: string; closes_at: string; closed_at: string | null }
interface StoryRow {
  id: string; wall_date: string; submitted_at: string; headline: string; url: string; outlet: string;
  status: WallStatus; tier: WallTier; support: number; priority: number | null; placed_at: string | null;
  anchor_mx: number | null; anchor_my: number | null; w_modules: number | null; h_modules: number | null;
  false_at: string | null; false_note: string | null;
  subject_kind?: string | null; subject_id?: string | null;
}
interface SourceRow {
  id: string; story_id: string; url: string; outlet: string; owner: string; headline: string; quotation: string;
  verified_at: string | null; added_at: string;
}
interface CheckRow {
  source_id: string; checked_at: string; kind: "resolves" | "quotation"; passed: boolean;
  http_status: number | null; detail: string | null;
}

/**
 * Every wall day with its stories, sources and checks, read whole. Four
 * tables and a few thousand rows at most for a long time, and the build
 * reads everything else whole for the same reason.
 */
export async function fetchWall(url: string, key: string): Promise<WallDay[]> {
  const days = await rows<DayRow>(url, key, "wall_days?select=wall_date,opens_at,live_at,closes_at,closed_at&order=wall_date.asc");
  if (days.length === 0) return [];
  const stories = await rows<StoryRow>(url, key,
    "wall_stories?select=id,wall_date,submitted_at,headline,url,outlet,status,tier,support,priority,placed_at,anchor_mx,anchor_my,w_modules,h_modules,false_at,false_note,subject_kind,subject_id&order=wall_date.asc,submitted_at.asc,id.asc");
  const sources = await rows<SourceRow>(url, key,
    "wall_sources?select=id,story_id,url,outlet,owner,headline,quotation,verified_at,added_at&order=added_at.asc,id.asc");
  const checks = await rows<CheckRow>(url, key,
    "wall_checks?select=source_id,checked_at,kind,passed,http_status,detail&order=checked_at.asc,id.asc");
  const outcomes = await rows<OutcomeRow>(url, key,
    "wall_outcomes?select=story_id,anniversary,outcome,note,recorded_at&order=anniversary.asc,id.asc");
  const outcomesByStory = new Map<string, WallOutcome[]>();
  for (const o of outcomes) {
    const list = outcomesByStory.get(o.story_id) ?? [];
    list.push(outcomeFrom(o));
    outcomesByStory.set(o.story_id, list);
  }

  const checksBySource = new Map<string, WallCheck[]>();
  for (const c of checks) {
    const list = checksBySource.get(c.source_id) ?? [];
    list.push({ checkedAt: c.checked_at, kind: c.kind, passed: c.passed, httpStatus: c.http_status, detail: c.detail });
    checksBySource.set(c.source_id, list);
  }
  const sourcesByStory = new Map<string, WallSource[]>();
  for (const s of sources) {
    const list = sourcesByStory.get(s.story_id) ?? [];
    list.push({
      id: s.id, url: s.url, outlet: s.outlet, owner: s.owner, headline: s.headline, quotation: s.quotation,
      verifiedAt: s.verified_at, addedAt: s.added_at, checks: checksBySource.get(s.id) ?? [],
    });
    sourcesByStory.set(s.story_id, list);
  }
  const storiesByDate = new Map<string, WallStory[]>();
  for (const s of stories) {
    const list = storiesByDate.get(s.wall_date) ?? [];
    list.push({
      id: s.id, wallDate: s.wall_date, submittedAt: s.submitted_at, headline: s.headline, url: s.url, outlet: s.outlet,
      status: s.status, tier: s.tier, support: s.support, priority: s.priority ?? 0, placedAt: s.placed_at,
      rect: s.anchor_mx === null || s.anchor_my === null || s.w_modules === null || s.h_modules === null
        ? null
        : { mx: s.anchor_mx, my: s.anchor_my, w: s.w_modules, h: s.h_modules },
      falseAt: s.false_at, falseNote: s.false_note,
      subjectKind: s.subject_kind ?? null, subjectId: s.subject_id ?? null,
      sources: sourcesByStory.get(s.id) ?? [],
      outcomes: outcomesByStory.get(s.id) ?? [],
    });
    storiesByDate.set(s.wall_date, list);
  }

  return days.map((d) => ({
    wallDate: d.wall_date, ...parts(d.wall_date),
    opensAt: d.opens_at, liveAt: d.live_at, closesAt: d.closes_at, closedAt: d.closed_at,
    stories: storiesByDate.get(d.wall_date) ?? [],
  }));
}

interface EmbeddedStoryRow extends StoryRow {
  wall_sources: Array<SourceRow & { wall_checks: CheckRow[] }>;
  wall_outcomes?: Array<Omit<OutcomeRow, "story_id">>;
}

function storyFrom(s: StoryRow, sources: WallSource[], outcomes: WallOutcome[] = []): WallStory {
  return {
    id: s.id, wallDate: s.wall_date, submittedAt: s.submitted_at, headline: s.headline, url: s.url, outlet: s.outlet,
    status: s.status, tier: s.tier, support: s.support, priority: s.priority ?? 0, placedAt: s.placed_at,
    rect: s.anchor_mx === null || s.anchor_my === null || s.w_modules === null || s.h_modules === null
      ? null
      : { mx: s.anchor_mx, my: s.anchor_my, w: s.w_modules, h: s.h_modules },
    falseAt: s.false_at, falseNote: s.false_note,
    subjectKind: s.subject_kind ?? null, subjectId: s.subject_id ?? null,
    sources,
    outcomes,
  };
}

// ---------------------------------------------------------------------------
// Pictures on tiles
// ---------------------------------------------------------------------------

/** "song:1994-09-10", "person:Q123": the subject a picture is for, as the tile carries it. */
export function subjectOf(story: Pick<WallStory, "subjectKind" | "subjectId">): string | null {
  if (story.subjectKind === null || story.subjectId === null) return null;
  return `${story.subjectKind}:${story.subjectId}`;
}

/**
 * The key a picture rule finds the tile by: the story's subject, or for a
 * story with none, which is the news, the story itself as "story:<id>".
 * stored-pictures.ts files pictures under the same two shapes.
 */
function subjectAttr(story: Pick<WallStory, "id" | "subjectKind" | "subjectId">): string {
  const subject = subjectOf(story) ?? `story:${story.id}`;
  return ` data-subject="${escapeHtml(subject)}"`;
}

export interface Picture {
  /** The subject, as subjectOf gives it. */
  subject: string;
  /**
   * A path on this domain, "/covers/abc.jpg", "/faces/Q123.jpg", or a
   * picture in the project's own public bucket, stored-pictures.ts. Never any
   * other host: the page sends img-src 'self' and the project's address,
   * and a picture from anywhere else is refused by the browser.
   */
  path: string;
}

/**
 * The style block that puts pictures on the tiles and rows of a date, baked
 * by build.ts beside the wall region rather than inside it.
 *
 * The wall section is swapped live by serve.ts on the open dates and the
 * live read has no idea which song has a cover on disk; the build does,
 * because it read the chart and listed static/covers. So the build writes
 * one rule per subject that has a picture, keyed by the data-subject the
 * worker's story carries, and whatever section is in the page, baked or
 * live, the tile for that subject draws its picture. The same trick as the
 * reader's own marks and the remaining count: the shared section carries
 * the structure and a style block lays the particular on top.
 *
 * Two rules, not one per picture with its colours repeated: one setting
 * --pic per subject, and one list selector giving every pictured subject
 * the light type and the scrim the tile needs over a photograph.
 */
export function pictureRules(pictures: Picture[]): string {
  if (pictures.length === 0) return "";
  const safe = (text: string): string => text.replace(/["\\]/g, "").replace(/[^A-Za-z0-9:_./-]/g, "");
  const each = pictures.map((p) => `[data-subject="${safe(p.subject)}"]{--pic:url("${safe(p.path)}")}`).join("");
  const all = pictures.map((p) => `.wtile[data-subject="${safe(p.subject)}"]`).join(",");
  // A pictured small tile is the picture and nothing else: its year is what
  // stands in when there is none. docs/the-wall.md section 27.
  const noYear = pictures.map((p) => `.wtile.small[data-subject="${safe(p.subject)}"] .wyr,.wtile.tiny[data-subject="${safe(p.subject)}"] .wyr`).join(",");
  return `<style class="wpics">${each}${noYear}{display:none}${all}{color:#FFF7EE;--wink:#FFF7EE;--wbtn:#FFE9B0;--wbtn-ink:#2A1A08;--wmark:#FFE9B0;justify-content:flex-end;--scrim:linear-gradient(to top,rgba(20,12,4,.94) 0%,rgba(20,12,4,.62) 48%,rgba(20,12,4,.18) 100%)}</style>`;
}

/** How many feed rows are shown before the fold. A dozen is a screen on a phone and a sample of every kind. */
export const FEED_SHOWN = 12;

/**
 * The feed in the order a reader can use. Pure.
 *
 * Most backed first, always: a buzz is the one thing that outranks
 * everything. Under that the kinds take turns, the day's news, then
 * something that happened, then somebody born, then a fact, then a
 * release, round again, so the first dozen rows are a sample of the whole
 * day rather than forty encyclopedia events in a row followed by seventy
 * headlines. Inside a kind the order is the one the pool already had, the
 * date's picks ahead of the rest and then arrival. The same instinct as the
 * allocator's variety pass and the app's Today feed, which mixes the kinds
 * so they take turns. No model: it is arithmetic, and it costs nothing.
 */
export function takeTurns(stories: WallStory[]): WallStory[] {
  const backed = stories.filter((s) => s.support > 0);
  const rest = stories.filter((s) => s.support === 0);
  const byKind = new Map<string, WallStory[]>();
  for (const story of rest) {
    const kind = story.subjectKind ?? "news";
    const list = byKind.get(kind) ?? [];
    list.push(story);
    byKind.set(kind, list);
  }
  // News leads the rotation because today is the one thing the wall is for;
  // after that the kinds in the order the date page tells them.
  const order = ["news", "historical_event", "person", "birth_fact", "cultural_event", ...[...byKind.keys()].filter((k) => !["news", "historical_event", "person", "birth_fact", "cultural_event"].includes(k)).sort()];
  const queues = order.map((k) => byKind.get(k) ?? []).filter((q) => q.length > 0);
  const mixed: WallStory[] = [];
  while (queues.some((q) => q.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next !== undefined) mixed.push(next);
    }
  }
  return [...backed, ...mixed];
}

/** "1994", "\"Song\" by Artist" out of the headline the worker wrote for a song, or null. */
export function songParts(headline: string): { year: string; title: string } | null {
  const found = /^(\d{4}): (.+) was the number one song$/.exec(headline);
  return found === null ? null : { year: found[1]!, title: found[2]! };
}

/**
 * One date's wall, read at request time. Two requests, the day and its
 * stories with their sources and checks embedded, each under a deadline,
 * because this runs inside a page view and a slow answer is worse than the
 * baked wall. Throws on anything but a clean read; the caller catches and
 * serves the page as built. Null when the date has no wall row, which is
 * also a reason to serve the page as built.
 */
export async function fetchWallDay(url: string, key: string, wallDate: string, timeoutMs: number = 3000): Promise<WallDay | null> {
  // Without the checks. The worker writes two check rows per source every
  // quarter hour, so a day's checks run to thousands of rows and megabytes
  // by the afternoon, and the date page draws none of them. Reading them
  // here was what pushed the live read past its three seconds and handed
  // every reader the baked page, with no buttons and the wrong count. The
  // receipt is the one page that shows checks, and it asks for its own
  // story's through fetchChecksFor.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };
    const dayResponse = await fetch(
      `${url}/rest/v1/wall_days?select=wall_date,opens_at,live_at,closes_at,closed_at&wall_date=eq.${wallDate}`,
      { headers, signal: controller.signal },
    );
    if (!dayResponse.ok) throw new Error(`wall: wall_days answered ${dayResponse.status}`);
    const days = (await dayResponse.json()) as DayRow[];
    const d = days[0];
    if (d === undefined) return null;

    const storiesResponse = await fetch(
      `${url}/rest/v1/wall_stories?select=id,wall_date,submitted_at,headline,url,outlet,status,tier,support,priority,placed_at,anchor_mx,anchor_my,w_modules,h_modules,false_at,false_note,subject_kind,subject_id,`
      + `wall_sources(id,story_id,url,outlet,owner,headline,quotation,verified_at,added_at),`
      + `wall_outcomes(anniversary,outcome,note,recorded_at)`
      + `&wall_date=eq.${wallDate}&order=submitted_at.asc,id.asc&wall_sources.order=added_at.asc&wall_outcomes.order=anniversary.asc`,
      { headers, signal: controller.signal },
    );
    if (!storiesResponse.ok) throw new Error(`wall: wall_stories answered ${storiesResponse.status}`);
    const stories = (await storiesResponse.json()) as EmbeddedStoryRow[];

    return {
      wallDate: d.wall_date, ...parts(d.wall_date),
      opensAt: d.opens_at, liveAt: d.live_at, closesAt: d.closes_at, closedAt: d.closed_at,
      stories: stories.map((s) => storyFrom(s, (s.wall_sources ?? []).map((src) => ({
        id: src.id, url: src.url, outlet: src.outlet, owner: src.owner, headline: src.headline, quotation: src.quotation,
        verifiedAt: src.verified_at, addedAt: src.added_at,
        checks: (src.wall_checks ?? []).map((c) => ({ checkedAt: c.checked_at, kind: c.kind, passed: c.passed, httpStatus: c.http_status, detail: c.detail })),
      })), (s.wall_outcomes ?? []).map(outcomeFrom))),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One story with its check history attached, read for its receipt alone.
 * A few hundred rows for one story's sources rather than a day's worth,
 * under the same deadline. A read that fails leaves the story as it was,
 * with no checks, and the receipt says no checks have run rather than
 * failing the page: the sources and the quotations are the receipt's
 * substance and they are already in hand.
 */
export async function withChecks(url: string, key: string, story: WallStory, timeoutMs: number = 3000): Promise<WallStory> {
  const ids = story.sources.map((s) => s.id);
  if (ids.length === 0) return story;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `${url}/rest/v1/wall_checks?select=source_id,checked_at,kind,passed,http_status,detail&source_id=in.(${ids.join(",")})&order=checked_at.asc,id.asc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: controller.signal },
    );
    if (!response.ok) return story;
    const rows = (await response.json()) as CheckRow[];
    if (!Array.isArray(rows)) return story;
    const bySource = new Map<string, WallCheck[]>();
    for (const c of rows) {
      if (typeof c?.source_id !== "string") continue;
      const list = bySource.get(c.source_id) ?? [];
      list.push({ checkedAt: c.checked_at, kind: c.kind, passed: c.passed, httpStatus: c.http_status, detail: c.detail });
      bySource.set(c.source_id, list);
    }
    return { ...story, sources: story.sources.map((s) => ({ ...s, checks: bySource.get(s.id) ?? s.checks })) };
  } catch {
    return story;
  } finally {
    clearTimeout(timer);
  }
}

let easternDate: Intl.DateTimeFormat | null = null;

/** The Eastern calendar date an instant falls on, as yyyy-mm-dd. Built on first use, never at import. */
export function easternDateOf(millis: number): string {
  if (easternDate === null) {
    easternDate = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
  }
  const p = Object.fromEntries(easternDate.formatToParts(new Date(millis)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * The instant a calendar date begins in Eastern time, the way the database's
 * wall_eastern_midnight computes it, without a time zone library: Eastern
 * midnight is 04:00 or 05:00 Coordinated Universal Time, and the formatter
 * says which.
 */
export function easternMidnight(wallDate: string): number {
  const [y, m, d] = wallDate.split("-").map(Number) as [number, number, number];
  for (const hour of [4, 5]) {
    const at = Date.UTC(y, m - 1, d, hour);
    if (easternDateOf(at) === wallDate && easternDateOf(at - 1) !== wallDate) return at;
  }
  return Date.UTC(y, m - 1, d, 5);
}

/**
 * A wall day with nothing on it, for a date that is open and has no row yet.
 * The day before a date is open for submissions and the news seeder files
 * nothing on it until the date arrives, so tomorrow's page had no wall at
 * all. It has one: an empty square and the hour it opens. The window is the
 * same arithmetic wall_days_fill_window does in the database.
 */
export function emptyWallDay(wallDate: string): WallDay {
  const [y, m, d] = wallDate.split("-").map(Number) as [number, number, number];
  const before = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  const after = new Date(Date.UTC(y, m - 1, d + 2)).toISOString().slice(0, 10);
  return {
    wallDate, year: y, month: m, day: d,
    opensAt: new Date(easternMidnight(before)).toISOString(),
    liveAt: new Date(easternMidnight(wallDate)).toISOString(),
    closesAt: new Date(easternMidnight(after)).toISOString(),
    closedAt: null,
    stories: [],
  };
}

/**
 * The three wall dates open at an instant: yesterday, today and tomorrow in
 * Eastern time, docs/the-wall.md section 3, keyed by month and day. These are
 * the only pages that read the wall at request time. December 31 opens
 * January 1 of the next year, and February 28 opens February 29 only in a
 * leap year, because the arithmetic is done on real dates.
 */
export function openWallDates(now: number = Date.now()): Map<string, string> {
  const [y, m, d] = easternDateOf(now).split("-").map(Number) as [number, number, number];
  const out = new Map<string, string>();
  for (const offset of [-1, 0, 1]) {
    const date = new Date(Date.UTC(y, m - 1, d + offset));
    out.set(wallKey(date.getUTCMonth() + 1, date.getUTCDate()), date.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * The wall a date page shows: the newest year that has one. Decided on
 * September 9, 2026, docs/the-wall.md section 10. Older years' stories keep
 * their receipt pages and are reachable from them.
 */
export function newestByDate(days: WallDay[]): Map<string, WallDay> {
  const out = new Map<string, WallDay>();
  for (const day of days) {
    const key = wallKey(day.month, day.day);
    const current = out.get(key);
    if (current === undefined || day.year > current.year) out.set(key, day);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

export function tierLabel(tier: WallTier): string {
  return tier === "seen_direct" ? "Seen directly" : tier === "reported" ? "Reported" : "Claimed";
}

/** What each tier means, in the words the document uses. Never a verdict. */
export function tierMeaning(tier: WallTier): string {
  if (tier === "seen_direct") return "Video, a filing, a record or an official statement.";
  if (tier === "reported") return "Two or more independently owned outlets.";
  return "Somebody said it and nobody has confirmed it.";
}

// ---------------------------------------------------------------------------
// The voice
// ---------------------------------------------------------------------------

/**
 * The words the wall uses for one unit of support. Decided September 10,
 * 2026: the mascot is a bee, so on the web a unit is a buzz. "You buzzed
 * this", "Two buzzes left today", a button that says Buzz. The word is one
 * place so the whole page changes together, and so it can be turned off.
 */
export interface Voice {
  /** The verb on the button: "Buzz", "Back this". */
  button: string;
  /** One unit, and more than one: "buzz", "buzzes". */
  one: string;
  many: string;
  /** What the reader did: "buzzed", "backed". */
  past: string;
  /** The verb that opens the sentence above the board: "Buzz", "Tap". */
  imperative: string;
}

export const BEE: Voice = { button: "Buzz", one: "buzz", many: "buzzes", past: "buzzed", imperative: "Buzz" };
export const PLAIN: Voice = { button: "Back this", one: "tap", many: "taps", past: "backed", imperative: "Tap" };

/**
 * Dates that speak plainly rather than making the buzz pun. Empty since
 * September 11, 2026, decided by Jason: every date is one product with one
 * voice, and a hive that says Buzz on one date and Back this on the next
 * reads as two apps. The solemn voice, PLAIN below, is kept as the second
 * entry of the Voice type so a date can be added back here without any
 * other change, but no date uses it now.
 */
export const PLAIN_DATES: ReadonlySet<string> = new Set<string>();

export function voiceFor(month: number, day: number): Voice {
  return PLAIN_DATES.has(wallKey(month, day)) ? PLAIN : BEE;
}

function voiceOf(day: WallDay): Voice {
  return voiceFor(day.month, day.day);
}

/**
 * How much support a story has, in the reader's own word for it. A story
 * nobody has backed says nothing at all: "0 boosts" on seventy tiles was
 * the whole of what the first wall communicated.
 */
export function units(n: number, voice: Voice = BEE): string {
  if (n <= 0) return "";
  return n === 1 ? `1 ${voice.one}` : `${n} ${voice.many}`;
}

// Built on first use rather than at module load. serve.ts imports render.ts,
// which imports this file, so anything evaluated here runs before the server
// listens. A time zone database that cannot name America/New_York would throw
// at import and the process would die before opening its port, with nothing in
// the log to say why. Nothing in this module may cost anything until it is
// called.
let easternFormat: Intl.DateTimeFormat | null = null;

function easternFormatter(): Intl.DateTimeFormat {
  if (easternFormat === null) {
    easternFormat = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });
  }
  return easternFormat;
}

/** A time as it reads in Eastern, because that is the clock the wall runs on. */
export function eastern(iso: string): string {
  return easternFormatter().format(new Date(iso));
}

function longDate(day: WallDay): string {
  return `${monthName(day.month)} ${day.day}, ${day.year}`;
}

/** The address of a story's receipt page, under its date. */
export function storyPath(story: WallStory): string {
  const { month, day } = parts(story.wallDate);
  return `/${slug(month, day)}/wall/${story.id}/`;
}

/**
 * Whether the board offers "Save this picture". Off, September 22, 2026:
 * without pictures on the tiles the saved square is a grid of beige text and
 * undersells the page. The picture, the route and the reader's own version
 * all still work; this is the one switch that shows the link again.
 */
export const SAVE_PICTURE = false;

/** Whether the tiles on a board carry more than one tier, which is when a key to the tiers says anything. */
export function tiersDiffer(stories: readonly Pick<WallStory, "tier">[]): boolean {
  return new Set(stories.map((s) => s.tier)).size > 1;
}

function chip(tier: WallTier): string {
  return `<span class="wchip w-${tier}">${tierLabel(tier)}</span>`;
}

/**
 * The chip on a row, which says nothing for the lowest tier.
 *
 * Every seeded story is claimed and stays claimed, because nothing adds a
 * second source yet, so "Claimed" sat on every row of the feed and a label
 * on everything is a label on nothing. A row is silent about the floor and
 * speaks when a story rises above it. The receipt still names every tier,
 * claimed included, because that is where a reader goes to ask.
 * September 22, 2026.
 */
function rowChip(tier: WallTier): string {
  return tier === "claimed" ? "" : ` ${chip(tier)}`;
}

// ---------------------------------------------------------------------------
// The wall on a date page
// ---------------------------------------------------------------------------

/**
 * How much a tile can say, decided by its shape rather than its area. A
 * module is about 35 pixels on a phone, so one row of text needs three
 * modules of width and a headline needs two rows of height. A tall thin
 * tile is as mute as a small one: letters stacked down a column are not a
 * headline.
 */
/**
 * The year a tile can say when it cannot say a sentence. docs/the-wall.md
 * section 27.
 *
 * A date board is about years, so the year is the one word every tile can
 * carry at any size: "1862" reads at forty pixels and a headline does not.
 * Taken from the wording the story already has rather than from a new
 * column, because every shape the seeders write puts it there: a history
 * row and a release open with it, and a person closes with it.
 *
 * Null when there is none to be sure of, and a tile with no year and no
 * picture keeps its outlet, which is what it had before.
 */
export function tileYear(headline: string): string | null {
  const opens = /^(1[0-9]{3}|20[0-9]{2}):/.exec(headline);
  if (opens !== null) return opens[1]!;
  const born = /,\s(?:born\s)?(1[0-9]{3}|20[0-9]{2})(?:\sto\s(?:1[0-9]{3}|20[0-9]{2}))?\s*$/.exec(headline);
  if (born !== null) return born[1]!;
  return null;
}

function tileClass(rect: { w: number; h: number }): string {
  if (rect.w >= 4 && rect.h >= 3) return "big";
  if (rect.w >= 3 && rect.h >= 2) return "mid";
  if ((rect.w >= 3 && rect.h === 1) || (rect.w === 2 && rect.h >= 2)) return "small";
  return "tiny";
}

/**
 * How big the type on a tile should be, and how many lines of it fit.
 *
 * **The bug this exists for.** Until September 21, 2026 the type scaled with
 * the tile's width alone and the line budget came from its height alone, and
 * neither knew the other or knew how long the headline was. Two things went
 * wrong on the live board for September 21, both visible in one screenshot:
 * a tile sixteen modules wide and three tall took type sized for sixteen
 * modules, asked for three lines of it, and the third line was sliced
 * through the middle with the footer sitting on top of it; and a tile ten by
 * seven holding a short sentence set that sentence at the top and left the
 * bottom half of the biggest tile on the board empty.
 *
 * So the size is fitted to the box and to the sentence instead. Walk the
 * sizes upward and keep the largest one whose whole headline still fits in
 * the room left under the footer. Pure arithmetic, no measuring in a
 * browser, and the answer is the same everywhere because it is in modules
 * rather than pixels.
 *
 * The four constants were read off a rendered board rather than guessed, and
 * they are the reason this is allowed to be arithmetic. If the typeface or
 * the footer changes, they are what changes with it.
 */
/**
 * Average glyph advance as a share of the font size, for this serif at this
 * weight, with the waste at the end of a wrapped line counted in. Measured
 * across the eleven tiles of the September 21 board, where the real figure
 * ran from 0.55 on a long sentence to 0.71 on a tile whose long words broke
 * early. The high end is the one to take: a line that turns out narrower
 * than the guess costs a little white space, and one that turns out wider
 * costs a line, which is what gets sliced in half.
 */
const CHAR_WIDTH = 0.62;
/** The stylesheet's line height on a tile headline. Measured: exactly this. */
const TILE_LINE_HEIGHT = 1.2;
/**
 * The footer, the padding and the gap, in modules: the height a headline
 * never gets. Measured at 0.80 on a 645 pixel board and 1.03 on a 390 pixel
 * one, because the footer has a pixel floor and a phone's module is small.
 * Set between them, nearer the phone, because every other part of this
 * arithmetic rounds toward drawing one line too many.
 *
 * **The limit, named.** On a phone the size clamp's own floor of ten pixels
 * beats this arithmetic on the smallest tiles, so a four by three tile there
 * holds about four lines where the arithmetic asked for five. The extra line
 * is cut by the box rather than by the clamp, so it loses its ellipsis. It
 * does not spill, it does not cross the footer, and the sentence it belongs
 * to was never going to fit in a tile that size. Worth fixing the day the
 * tiles get a short written form; not worth a second arithmetic in pixels.
 */
const TILE_CHROME = 0.92;
/** The stylesheet's baseline size, in modules: 38cqi against a sixteen module side. */
const TILE_BASE = 0.38;
/** The smallest and largest the type is ever set, as a multiple of the baseline. */
const FIT_MIN = 0.85;
const FIT_MAX = 3;

export function fitType(w: number, h: number, length: number): { fit: number; lines: number } {
  const room = Math.max(0.4, h - TILE_CHROME);
  const smallest = FIT_MIN * TILE_BASE;
  // Smallest first, keeping the last that fits. The answer is not monotonic:
  // a larger size takes fewer characters per line, so it can need a whole
  // extra line and stop fitting, and a size above that can fit again.
  let best: { size: number; lines: number } | null = null;
  for (let size = smallest; size <= FIT_MAX * TILE_BASE + 1e-9; size += 0.01) {
    const perLine = Math.max(1, Math.floor(w / (CHAR_WIDTH * size)));
    const lines = Math.max(1, Math.ceil(length / perLine));
    if (lines * TILE_LINE_HEIGHT * size <= room) best = { size, lines };
  }
  if (best === null) {
    // Longer than its tile holds at any size this will set. The smallest
    // type, and as many lines as the box has room for, so what is cut is cut
    // by the ellipsis at the end of a full line rather than by the tile's
    // edge through the middle of one.
    return { fit: FIT_MIN, lines: Math.max(1, Math.floor(room / (TILE_LINE_HEIGHT * smallest))) };
  }
  return { fit: Number((best.size / TILE_BASE).toFixed(2)), lines: best.lines };
}

/** The fields a buzz posts: the story, and the date page to come back to. */
/** Where a buzz lands the reader afterwards: the date page, the full screen hive, or the story's own receipt. */
export type TapBack = "day" | "hive" | "receipt";

function tapFields(story: WallStory, back: TapBack): string {
  const { month, day } = parts(story.wallDate);
  return `<input type="hidden" name="s" value="${story.id}"><input type="hidden" name="m" value="${month}"><input type="hidden" name="d" value="${day}">`
    + (back === "day" ? "" : `<input type="hidden" name="v" value="${back}">`);
}

/** The reader's own mark, hidden until wallMarks reveals it for the stories this browser backed. */
function mine(voice: Voice): string {
  return `<span class="wmine">You ${voice.past} this</span>`;
}

/**
 * The one control that spends a unit: a small form with one button, in the
 * tile's footer or at the end of a row. Decided September 10, 2026, after
 * the first person to use the wall could not find the receipt: the
 * headline had been the tap and the outlet name the link, and nobody
 * guesses that. A headline opens the story, because that is what a
 * headline does everywhere else, and the thing that votes says what it is.
 */
function buzzForm(story: WallStory, voice: Voice, back: TapBack = "day"): string {
  return `<form class="wbuzz" method="post" action="/boost">${tapFields(story, back)}`
    + `<button type="submit" aria-label="${escapeHtml(`${voice.button}: ${story.headline}`)}">${voice.button}</button></form>`;
}

/**
 * The one control that takes a buzz back: the same shape as the buzz form,
 * posting to /unboost, carrying the same three fields plus where to come
 * back to.
 *
 * Drawn only inside the sentence that follows a buzz that counted, and only
 * when the server knows which story that was, so a page somebody is merely
 * reading never carries one. docs/the-wall.md, the last entry in section 16:
 * the window is for a misclick and it is far too short to be a way of
 * changing your mind. Neither this nor the button's presence is permission;
 * the database decides and answers in one word.
 */
function undoForm(story: WallStory, voice: Voice, back: TapBack = "day"): string {
  return `<form class="wundo" method="post" action="/unboost">${tapFields(story, back)}`
    + `<button type="submit" aria-label="${escapeHtml(`Undo that ${voice.one}: ${story.headline}`)}">Undo</button></form>`;
}

/**
 * What kind of thing a tile is, drawn as a small line mark so the board
 * reads its mix at a glance: something that happened, somebody born, a
 * number one song, or the day's news. Four, not one per table: a fact, an
 * event and a release are all things that happened. Our own drawings at
 * one stroke weight, the same box as the marks in the bar, and never an
 * emoji, which is drawn differently by every phone.
 */
export type TileKind = "happened" | "born" | "song" | "album" | "film" | "news";

export function tileKind(story: Pick<WallStory, "subjectKind">): TileKind {
  if (story.subjectKind === null) return "news";
  if (story.subjectKind === "person") return "born";
  if (story.subjectKind === "song") return "song";
  if (story.subjectKind === "album") return "album";
  if (story.subjectKind === "film") return "film";
  return "happened";
}

export const KIND_WORD: Record<TileKind, string> = { happened: "Happened on this date", born: "Born on this date", song: "The number one song", album: "The number one album", film: "The number one film", news: "In the news today" };

const KIND_MARK: Record<TileKind, string> = {
  happened: `<circle cx="12" cy="12" r="8.6"/><path d="M12 7.6V12l3.2 2.1"/>`,
  born: `<path d="M8.4 11.2h7.2v9.4H8.4zM12 3.6c1.8 1.9 2.7 3.2 2.7 4.4a2.7 2.7 0 0 1-5.4 0c0-1.2.9-2.5 2.7-4.4z"/>`,
  song: `<circle cx="7.5" cy="17" r="2.9"/><circle cx="16.5" cy="15" r="2.9"/><path d="M10.4 17V6.2l9-2.2V15"/>`,
  album: `<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="2.4"/>`,
  film: `<rect x="3.6" y="6" width="16.8" height="12" rx="1.6"/><path d="M3.6 10.2h16.8M8 6v12M16 6v12"/>`,
  news: `<rect x="3.6" y="5" width="16.8" height="14" rx="2.4"/><path d="M7.2 9.2h5.6M7.2 12.4h9.6M7.2 15.6h9.6"/>`,
};

export function kindMark(kind: TileKind): string {
  return `<span class="wkind wk-${kind}" title="${KIND_WORD[kind]}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${KIND_MARK[kind]}</svg><span class="sr">${KIND_WORD[kind]}.</span></span>`;
}

function footer(story: WallStory, live: boolean, voice: Voice, hive: boolean): string {
  const count = units(story.support, voice);
  // The control first, then the count it changes, then the outlet, cut with
  // an ellipsis when the tile is narrow. No tier chip: the tile's colour is
  // its tier, the legend says so, and a chip beside the outlet was what
  // pushed a phone tile down to one line of headline.
  return `<span class="wfoot">${kindMark(tileKind(story))}${live ? buzzForm(story, voice, hive ? "hive" : "day") : ""}${count === "" ? "" : `<span class="wn">${count}</span>`}<span class="wo">${escapeHtml(story.outlet)}</span></span>`;
}

/**
 * One tile. The headline links to the receipt. While the date is taking
 * support, a button in the footer spends one unit. Either way it sits at
 * the anchor the server stored, at the size it stored.
 */
/**
 * The part of the square the page draws. The board is sixteen by sixteen and
 * a quiet day's tiles sit in the middle third of it, so drawn whole the
 * square was mostly black. The page zooms to the tiles: the smallest square
 * that holds every placed tile, never smaller than eight modules across so
 * one tile is not a wall, never larger than the board. It is still a square
 * and still one picture on a phone and a desktop; the stored rectangles are
 * untouched, and as the day fills the view widens until it is the whole
 * board. The sealed square, when it arrives, is drawn whole.
 */
export interface Viewport {
  ox: number;
  oy: number;
  side: number;
}

export const VIEW_MIN = 8;

export function viewportFor(rects: Array<{ mx: number; my: number; w: number; h: number }>): Viewport {
  if (rects.length === 0) return { ox: 0, oy: 0, side: VIEW_MIN };
  let x0 = BOARD_MODULES, y0 = BOARD_MODULES, x1 = 0, y1 = 0;
  for (const r of rects) {
    x0 = Math.min(x0, r.mx); y0 = Math.min(y0, r.my);
    x1 = Math.max(x1, r.mx + r.w); y1 = Math.max(y1, r.my + r.h);
  }
  const side = Math.min(BOARD_MODULES, Math.max(VIEW_MIN, x1 - x0, y1 - y0));
  const clamp = (v: number): number => Math.max(0, Math.min(BOARD_MODULES - side, v));
  const ox = clamp(Math.floor((x0 + x1) / 2 - side / 2));
  const oy = clamp(Math.floor((y0 + y1) / 2 - side / 2));
  return { ox, oy, side };
}

// ---------------------------------------------------------------------------
// Hindsight, docs/the-wall.md section 23
// ---------------------------------------------------------------------------

/** The latest verdict on a story, or null before its first anniversary. */
export function latestOutcome(story: Pick<WallStory, "outcomes">): WallOutcome | null {
  const all = story.outcomes ?? [];
  if (all.length === 0) return null;
  return [...all].sort((a, b) => b.anniversary - a.anniversary)[0]!;
}

/**
 * The mark in a tile's corner. The checker's stamp stands on its own and
 * wins; a verdict from the anniversary job marks a tile held or forgotten.
 * Nothing before the first anniversary, so a sealed board today is drawn
 * exactly as it was.
 */
export function outcomeStamp(story: Pick<WallStory, "status" | "outcomes">): string {
  if (story.status === "false") return `<span class="wstamp">Shown false</span>`;
  const latest = latestOutcome(story);
  if (latest === null || latest.outcome === "false") return "";
  return latest.outcome === "held"
    ? `<span class="wstamp wheld" title="Buzzed again on a later year's hive for this date">Held</span>`
    : `<span class="wstamp wforgot" title="On the board that day. Not buzzed on any later hive for this date">Forgotten</span>`;
}

const YEARS_ON: Record<number, string> = { 1: "One year on", 5: "Five years on", 10: "Ten years on" };

/**
 * The line under a sealed board once its stories have a verdict: "One year
 * on: two held, one forgotten." Counts the tiles on the board at the latest
 * anniversary any of them has reached. Null when none has, which is every
 * board until September 9, 2027.
 */
export function hindsightLine(day: Pick<WallDay, "stories">): string | null {
  const onWall = day.stories.filter((s) => s.rect !== null && (s.status === "placed" || s.status === "false"));
  const latest = Math.max(0, ...onWall.flatMap((s) => (s.outcomes ?? []).map((o) => o.anniversary)));
  if (latest === 0) return null;
  const counts = { held: 0, false: 0, forgotten: 0 };
  for (const s of onWall) {
    const at = (s.outcomes ?? []).find((o) => o.anniversary === latest);
    if (at) counts[at.outcome] += 1;
  }
  const word = (n: number, one: string, many: string): string => `${n === 1 ? "one" : n === 2 ? "two" : n === 3 ? "three" : n} ${n === 1 ? one : many}`;
  const partsOut: string[] = [];
  if (counts.held > 0) partsOut.push(`${word(counts.held, "held", "held")}`);
  if (counts.false > 0) partsOut.push(`${word(counts.false, "was shown false", "were shown false")}`);
  if (counts.forgotten > 0) partsOut.push(`${word(counts.forgotten, "forgotten", "forgotten")}`);
  if (partsOut.length === 0) return null;
  return `${YEARS_ON[latest] ?? `${latest} years on`}: ${partsOut.join(", ")}.`;
}

function tile(story: WallStory, live: boolean, voice: Voice, view: Viewport, hive: boolean, index: number = 0): string {
  const rect = story.rect!;
  const size = tileClass(rect);
  const count = units(story.support, voice);
  const label = `${story.headline}. ${story.outlet}. ${tierLabel(story.tier)}${count === "" ? "" : `, ${count}`}.`
    + (story.status === "false" ? " Later shown false." : "");
  // The size and the line budget, fitted to the box and the sentence
  // together. fitType says why the two used to be worked out apart.
  const { fit, lines } = fitType(rect.w, rect.h, story.headline.length);
  // --i is the tile's place in the deal, for the stagger when the board
  // rises in. The same variable the covers and the feed rise on.
  // --tw is the tile's width in modules. Since the pie, docs/the-wall.md
  // section 18, a tile can be a quarter of the board or the whole of it,
  // and a headline set for a four module tile leaves a sixteen module one
  // three quarters empty. The stylesheet grows the type with the width.
  const style = `grid-column:${rect.mx - view.ox + 1} / span ${rect.w};grid-row:${rect.my - view.oy + 1} / span ${rect.h};--lines:${lines};--fit:${fit};--tw:${rect.w};--i:${index}`;
  const stamp = outcomeStamp(story);
  const classes = `wtile ${size} w-${story.tier}${rect.h <= 3 ? " wh3" : ""}${story.status === "false" ? " wfalse" : ""}`;
  const receipt = storyPath(story);

  if (size === "tiny" || size === "small") {
    // The mural's ordinary tile since September 22, 2026. docs/the-wall.md
    // section 27: too small for a sentence, so it is its picture, and where
    // there is no picture it is its year, which reads at any size. The
    // headline is still the whole label a screen reader and a hover get, and
    // the receipt is one tap away.
    //
    // Both are drawn. The stylesheet hides the year on a tile that has a
    // picture, because whether a picture exists is known only to the rules
    // pictureRules writes and not here.
    const year = tileYear(story.headline);
    const inner = `<span class="wyr">${escapeHtml(year ?? story.outlet)}</span>`
      + (count === "" ? "" : `<span class="wn">${count}</span>`);
    return `<a class="${classes}${year === null ? " wnoyr" : ""}" id="w-${story.id}" href="${receipt}" style="${style}"${subjectAttr(story)} title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${inner}${stamp}</a>`;
  }

  const takes = live && story.status !== "false";
  return `<div class="${classes}" id="w-${story.id}" style="${style}"${subjectAttr(story)} role="listitem">`
    + `<a class="wh" href="${receipt}" title="${escapeHtml(label)} The receipt: every source, every quotation, every check.">${escapeHtml(story.headline)}</a>`
    + `${mine(voice)}${footer(story, takes, voice, hive)}${stamp}</div>`;
}

/**
 * One tile on the live hive, docs/the-wall.md section 21. The same headline,
 * mark, button, count and outlet as tile(), inside a cell the page's script
 * can light, move and resize. The tile is positioned by four custom
 * properties in modules of the whole board rather than by the grid, so the
 * script moves it by changing four numbers and the stylesheet animates the
 * move; the cell inside carries the glow, --heat, nought for a story nobody
 * has buzzed and one for the most buzzed. Only serve.ts draws these, for the
 * live section of an open date's full screen hive, and the script builds the
 * same shape for a story the pie brings onto the board later.
 */
export function liveTile(story: WallStory, live: boolean, voice: Voice, index: number = 0, heat: number = 0): string {
  const rect = story.rect!;
  const count = units(story.support, voice);
  const label = `${story.headline}. ${story.outlet}. ${tierLabel(story.tier)}${count === "" ? "" : `, ${count}`}.`
    + (story.status === "false" ? " Later shown false." : "");
  const { fit, lines } = fitType(rect.w, rect.h, story.headline.length);
  const style = `--x:${rect.mx};--y:${rect.my};--w:${rect.w};--h:${rect.h};--lines:${lines};--fit:${fit};--tw:${rect.w};--i:${index}`;
  const stamp = outcomeStamp(story);
  const classes = `wtile big w-${story.tier}${rect.h <= 3 ? " wh3" : ""}${story.status === "false" ? " wfalse" : ""}`;
  const takes = live && story.status !== "false";
  return `<div class="${classes}" id="w-${story.id}" style="${style}"${subjectAttr(story)} role="listitem">`
    + `<div class="wcell" style="--heat:${heat}"><span class="wstripe"></span>`
    + `<a class="wh" href="${storyPath(story)}" title="${escapeHtml(label)} The receipt: every source, every quotation, every check.">${escapeHtml(story.headline)}</a>`
    + `${mine(voice)}${footer(story, takes, voice, true)}${stamp}</div></div>`;
}

/** One row in the list under the board. The headline opens the receipt; the button spends a unit while the date takes them. */
/** "bbc.com and npr.org", "bbc.com, npr.org and theguardian.com". */
export function andList(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]!}`;
}

/**
 * One row of the feed.
 *
 * `alsoIn` is the other desks that carried the same story, which the feed
 * works out by counting rather than by asking anybody. Naming them is the
 * point: this site already argues that the colour on a tile is how well a
 * story is sourced, and four desks on one line is that argument in the feed.
 * docs/the-wall.md section 28.
 */
function listRow(story: WallStory, live: boolean, voice: Voice, alsoIn: readonly string[] | null = null): string {
  const count = units(story.support, voice);
  const also = alsoIn === null || alsoIn.length === 0 ? "" : ` <span class="walso">with ${escapeHtml(andList([...alsoIn]))}</span>`;
  const meta = `<span class="wmeta">${escapeHtml(story.outlet)}${also}${rowChip(story.tier)}${count === "" ? "" : ` ${count}`}${mine(voice)}</span>`;
  const control = live && story.status !== "false" ? ` ${buzzForm(story, voice)}` : "";
  return `<li id="w-${story.id}"${subjectAttr(story)}${yearAttr(story.headline)}><a href="${storyPath(story)}">${escapeHtml(story.headline)}</a> ${meta}${control}</li>`;
}

/**
 * The year a history row is about, as an attribute, so the server can put
 * the reader's age on it without touching the baked page. Only a headline
 * that opens "1975: " has one; the news and the people do not, because the
 * news is this year and a person's birth year is not something that
 * happened to the reader. See ageMark in serve.ts.
 */
export function yearAttr(headline: string): string {
  const found = /^(\d{3,4}): /.exec(headline);
  return found === null ? "" : ` data-y="${found[1]}"`;
}

/**
 * One song in the strip under the feed: its cover, when the build found
 * one, with the year on it, then the song and the one button. The cover
 * opens the receipt, the way a headline does. A song with no cover is the
 * made tile the covers wall already draws for records Apple does not carry.
 */
function songRow(story: WallStory, live: boolean, voice: Voice): string {
  const parts = songParts(story.headline);
  const year = parts?.year ?? "";
  const title = parts?.title ?? story.headline;
  const count = units(story.support, voice);
  const control = live && story.status !== "false" ? buzzForm(story, voice) : "";
  return `<li id="w-${story.id}"${subjectAttr(story)}>`
    + `<a class="wart" href="${storyPath(story)}" title="${escapeHtml(story.headline)}"><span class="wyr"${year === "" ? "" : ` id="${year}"`}>${year}</span></a>`
    + `<span class="wsongt">${escapeHtml(title)}</span>`
    + `<span class="wsongf">${control}${count === "" ? "" : `<span class="wn">${count}</span>`}${mine(voice)}</span></li>`;
}

function stateLine(day: WallDay, now: number): string {
  const closes = day.closedAt ?? day.closesAt;
  const closed = Date.parse(closes) <= now;
  const notYet = now < Date.parse(day.liveAt);
  // The third day is the one after the date, and the close is the midnight
  // that ends it.
  const after = new Date(Date.UTC(day.year, day.month - 1, day.day + 1));
  const ending = `${monthName(after.getUTCMonth() + 1)} ${after.getUTCDate()}, ${after.getUTCFullYear()}`;
  // The three words that carry the mechanic are set apart, so the clock line
  // teaches them: a hive is open, it seals at a fixed hour, and then it is
  // permanent. Nathan, September 10, 2026.
  const key = (word: string): string => `<em class="wkey">${word}</em>`;
  if (closed) return `<b>Sealed</b> at midnight Eastern ending ${ending}. ${key("Permanent")}.`;
  if (notYet) return `<b>Opens tonight</b> at midnight Eastern. ${key("Seals")} at midnight Eastern ending ${ending}, then ${key("permanent")}.`;
  return `<b>Open.</b> ${key("Seals")} at midnight Eastern ending ${ending}, then ${key("permanent")}.`;
}

/**
 * The square. Sixteen by sixteen modules, drawn as a grid whose columns and
 * rows are fixed, so it is one square on a phone and one square on a desktop
 * and never a layout that reflows. Every tile sits at the anchor the server
 * stored, at the size it stored, and links to its receipt.
 */
/** The comments a live wall is swapped in between. Present on every date page, wall or no wall. */
export const WALL_START = "<!--wall:start-->";
export const WALL_END = "<!--wall:end-->";

/**
 * The date's history rows sit inside the wall region, in the one feed, and
 * they are baked: the live read has no history data and needs none. These
 * markers let serve.ts lift them out of the baked page and hand them back to
 * the live section, so one feed can be half live and half baked.
 */
export const HISTORY_START = "<!--history:start-->";
export const HISTORY_END = "<!--history:end-->";

/** The baked history rows inside a page's wall region, or "". */
export function historyFrom(html: string): string {
  const start = html.indexOf(HISTORY_START);
  const end = html.indexOf(HISTORY_END, start);
  if (start < 0 || end < 0) return "";
  return html.slice(start + HISTORY_START.length, end);
}

/**
 * The baked page with a fresh wall section in place of the baked one, or
 * null when the page carries no markers, in which case it is served as it
 * was. Written with a function so a dollar sign in a headline cannot be
 * read as a capture group.
 */
export function replaceWall(html: string, section: string): string | null {
  const start = html.indexOf(WALL_START);
  const end = html.indexOf(WALL_END, start);
  if (start < 0 || end < 0) return null;
  return html.slice(0, start) + section + html.slice(end + WALL_END.length);
}

export interface WallOptions {
  /**
   * Draw the tap forms. Only serve.ts sets this, for the section it renders
   * at request time, and only then if the date is taking boosts by the
   * clock. A baked page never carries a form, so the fallback for a failed
   * live read is a wall that can be read and not tapped, which is the honest
   * state when the database cannot be reached.
   */
  interactive?: boolean;
  /**
   * The full screen page: the hive alone, as big as the window, with its
   * count and its sentences and nothing else. A buzz from it comes back to
   * it.
   */
  hive?: boolean;
  /**
   * The month and day the page is for, so a date with no wall yet can say
   * when its first hive opens. Without it a page with no wall draws
   * nothing, as before.
   */
  date?: { month: number; day: number };
  /**
   * The date's history rows, already rendered, drawn without buttons under
   * the promise on a date with no wall, and standing in for the feed on a
   * wall the worker has not filed anything for yet. Baked by build.ts and
   * lifted back out of the baked page by serve.ts for the live section.
   */
  history?: string;
  /**
   * What the typed field found, best first, drawn as the confirmation under
   * the field. Only serve.ts sets this, on the one request that follows a
   * post to /find, and only on a date page: the reader sees the story, its
   * outlet and its tier, and the buzz is a second post through /boost
   * unchanged. Nothing is spent by finding.
   */
  found?: WallStory[];
  /**
   * The story a buzz just counted for, on the one request that follows it,
   * so the sentence saying it counted can carry the Undo button. Null on
   * every other request, and the button is drawn nowhere else.
   *
   * It travels in the query string rather than in the fragment, because the
   * fragment is what scrolls the page to the tile and a fragment never
   * reaches a server. docs/the-wall.md, the last entry in section 16.
   */
  undo?: WallStory | null;
  /**
   * What this browser backed on this same day in earlier years, newest
   * first. docs/the-wall.md section 15.
   *
   * Drawn by the server into the section rather than written by wallMarks as
   * a style rule, which is what the brief for it asked for and is a
   * deliberate departure. A headline is the source's own wording and can
   * carry a quotation mark or the characters that end a style element, and
   * inside a CSS `content:` string escapeHtml does not apply and a headline
   * containing `</style>` ends the stylesheet and spills the rest of the page.
   * `foundBlock` already draws one reader's own stories into this section on
   * a request that is never stored, and this is that same shape. The count
   * and the marks stay in wallMarks, where they are generated text.
   *
   * Only ever on a request answered `no-store`, and only ever this browser's
   * own. No count, no rank, nobody else's.
   */
  anniversary?: Anniversary[];

  /**
   * Whether to draw the link to this browser's own record. docs/the-wall.md
   * section 25.
   *
   * True for a request carrying the token cookie and for no other, because
   * the only thing that ever mints that token is tapping Buzz, so the link
   * is shown to readers who have a record and to nobody else. A request
   * that draws it is answered `no-store` for the same reason the marks and
   * the Undo button make one: the page carries something that is one
   * reader's own.
   */
  yours?: boolean;
}

/** One buzz this browser cast on this day in an earlier year. */
export interface Anniversary {
  storyId: string;
  headline: string;
  /** "2025-09-10". */
  wallDate: string;
}

// ---------------------------------------------------------------------------
// The private record. docs/the-wall.md section 25.
// ---------------------------------------------------------------------------

/** One buzz on this browser's own record, as wall_web_record answers it. */
export interface RecordRow {
  storyId: string;
  headline: string;
  /** "2026-09-09". */
  wallDate: string;
  /** Whether the date has sealed, by the database's clock rather than this one. */
  sealed: boolean;
  /** The story's own status: pool, placed, overflow or false. */
  status: string;
  /** The latest anniversary's verdict, or null, which is every row until September 9, 2027. */
  outcome: WallOutcomeKind | null;
}

/**
 * Where one story on the record stands, in one word or two.
 *
 * The ladder in section 25, and a later fact replaces an earlier one rather
 * than sitting beside it, so a row is one sentence. Shown false comes before
 * everything because a story stamped false takes no more buzzes whether its
 * date has sealed or not, and the anniversary's verdict comes before the
 * board because it is the newer fact about the same story.
 *
 * Every word here is about the story. None of it is about the reader, which
 * is the whole rule this page is built inside.
 */
export function recordStanding(row: Pick<RecordRow, "sealed" | "status" | "outcome">): string {
  if (row.outcome === "false" || row.status === "false") return "Shown false";
  if (row.outcome === "held") return "Held";
  if (row.outcome === "forgotten") return "Forgotten";
  if (!row.sealed) return "Open";
  return row.status === "placed" ? "On the board" : "In the pool";
}

/**
 * The way to this browser's own record, under the board.
 *
 * One link and one clause, and deliberately not a count: section 25 refuses
 * every number on this page and a number in front of it would be the same
 * thing one step earlier.
 */
export function yoursLine(yours: boolean | undefined, voice: Voice): string {
  if (yours !== true) return "";
  return `<p class="wnote wyours"><a href="/yours/">Everything you have ${voice.past}</a>.`
    + ` Only you can see it, it is read from this browser, and it is not a score.</p>`;
}

export function wallSection(day: WallDay | null, name: string, now: number = Date.now(), options: WallOptions = {}): string {
  return `${WALL_START}${wallBody(day, name, now, options)}${WALL_END}`;
}

/** "/september-9/hive/", the full screen page for a date's hive. */
export function hivePath(month: number, day: number): string {
  return `/${slug(month, day)}/hive/`;
}

/**
 * The three hives open at once, as a row of pills: yesterday's, which still
 * takes one buzz, today's, and tomorrow's, which takes stories. The one being
 * read is marked and not a link. Drawn at request time only, because a baked
 * page cannot know which three dates are open. September 22, 2026.
 */
export function hiveDaysNav(month: number, day: number, now: number = Date.now()): string {
  const words = ["Yesterday", "Today", "Tomorrow"];
  const pills = [...openWallDates(now).values()].map((wallDate, i) => {
    const [, m, d] = wallDate.split("-").map(Number) as [number, number, number];
    const label = `<b>${words[i]}</b> ${monthName(m).slice(0, 3)} ${d}`;
    return m === month && d === day
      ? `<span class="wday here" aria-current="page">${label}</span>`
      : `<a class="wday" href="${hivePath(m, d)}">${label}</a>`;
  });
  return `<nav class="wdays" aria-label="The three open hives">${pills.join("")}</nav>`;
}

/**
 * What a date with no hive yet says. Every date gets its first hive the day
 * before it arrives, and the page says so rather than saying nothing.
 */
export function promise(name: string, month: number, day: number, now: number): string {
  const [y] = easternDateOf(now).split("-").map(Number) as [number];
  // The next time this date comes round, by the Eastern calendar.
  let year = y;
  const todayKey = easternDateOf(now);
  const candidate = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (candidate < todayKey) year = y + 1;
  const before = new Date(Date.UTC(year, month - 1, day - 1));
  const opens = `${monthName(before.getUTCMonth() + 1)} ${before.getUTCDate()}, ${before.getUTCFullYear()}`;
  // The blank board is drawn, with the opening date on it, so a date with
  // no hive yet looks like a hive waiting rather than a paragraph.
  return `<section class="wall wpromise" aria-labelledby="wallhead">
<p class="whead"><span class="section" id="wallhead">The hive for ${escapeHtml(name)}</span> <span class="wstate">Not open yet.</span></p>
<p class="wlede">${escapeHtml(name)} has no hive yet. Its first one opens on ${opens} at midnight Eastern, takes everything with a birthday that day and the buzzes people give it, and seals two days later, for good. Every date gets one a year, and they stack.</p>
<div class="wboard wblank" role="img" aria-label="An empty hive. The first one for ${escapeHtml(name)} opens ${opens}.">
<p class="wnothing"><b>First hive opens ${opens}</b><span>at midnight Eastern. Everything below takes buzzes then.</span></p>
</div>
</section>`;
}

/** Hours until an instant, said plainly. */
function hoursUntil(iso: string, now: number): string {
  const hours = Math.max(0, Math.round((Date.parse(iso) - now) / 3_600_000));
  if (hours === 0) return "less than an hour";
  return hours === 1 ? "about an hour" : `about ${hours} hours`;
}

/** Whether the date is taking boosts at an instant: from its live day until it closes. */
export function takingBoosts(day: WallDay, now: number): boolean {
  const closes = day.closedAt ?? day.closesAt;
  return now >= Date.parse(day.liveAt) && now < Date.parse(closes);
}

/**
 * The taps a fresh browser has on a date at an instant, by the rule in
 * docs/the-wall.md section 4: three on the date itself, one on the day
 * after, none the day before. "Today" is the Eastern calendar date.
 */
export function allowanceOn(day: WallDay, now: number): number {
  if (!takingBoosts(day, now)) return 0;
  const today = easternDateOf(now);
  if (today === day.wallDate) return 3;
  const after = new Date(Date.UTC(day.year, day.month - 1, day.day + 1)).toISOString().slice(0, 10);
  return today === after ? 1 : 0;
}

const WORDS = ["No", "One", "Two", "Three", "Four"];

/**
 * The remaining count, said so it means something: "Two taps left today."
 * The same sentence is written for every reader by the section and
 * rewritten for one reader by wallMarks, through ::after content, so the
 * shared, cached section carries the allowance and the browser's own number
 * lands on top of it.
 */
export function tapsLeftSentence(left: number, allowance: number, voice: Voice = BEE): string {
  const n = Math.max(0, Math.min(left, WORDS.length - 1));
  const word = WORDS[n]!;
  const tap = n === 1 ? voice.one : voice.many;
  // One is the allowance on the day after the date, section 4, and that is
  // the page whose count needs "on this date" to make sense: the reader may
  // still have three on today's.
  const yesterday = allowance === 1;
  if (n === 0) return yesterday ? `No ${voice.many} left today on this date.` : `No ${voice.many} left today.`;
  return yesterday ? `${word} ${tap} left today on this date. It closes tonight.` : `${word} ${tap} left today.`;
}

function countLine(day: WallDay, now: number, voice: Voice, live: boolean = true): string {
  // Before the date arrives the square itself says when it opens, and after
  // it seals there is nothing to count. And only where a buzz can be spent:
  // the baked page carries no forms, and a count on it is the allowance for
  // a browser that has done nothing, shown to a reader who may have done
  // everything.
  if (!takingBoosts(day, now) || !live) return "";
  const allowance = allowanceOn(day, now);
  return `<p class="wcount"><span class="wleft"></span></p>` +
    `<style>.wleft::after{content:"${tapsLeftSentence(allowance, allowance, voice)}"}</style>`;
}

/**
 * What the page says back after a tap, one sentence per outcome, hidden
 * until the redirect names one. The same trick the remembrance answers use:
 * :target reveals a sentence already on the page, so the site answers
 * without running a script. Every wall section carries them, baked pages
 * included, because a tap can be refused on a date that closed after the
 * page was served, and that reader lands on the baked page.
 */
export function afterwords(voice: Voice, name: string, undo: WallStory | null = null, back: TapBack = "day", live: boolean = false): string {
  const v = voice;
  // The Undo button, only on the page that follows a buzz that counted, and
  // only when the redirect said which story it counted for. The sentence is
  // the same one either way: what changes is whether there is still a way
  // back out of it.
  const takeItBack = undo === null
    ? ""
    // A div, not a paragraph. A paragraph cannot contain a form: a browser
    // closes it before the form, which puts the button outside whatever the
    // paragraph was doing. That is exactly the bug this line had first.
    : `<div class="wundoline">${undoForm(undo, v, back)}<span class="wundonote">Thirty seconds, for a tap you did not mean.</span></div>`;
  // On the live hive the tile has already grown by the time this shows, so
  // the quarter hour sentence would be false there; the page writes what the
  // buzz moved into the span instead (HiveShare in hive-live.ts).
  const kept = live
    ? `That counts. <span class="wshare" id="wshare"></span> <span class="wleft"></span>`
    : `That counts. <span class="wleft"></span> The hive redraws on the quarter hour, so a bigger tile takes a few minutes to show; your mark is there now.`;
  const rallied = live
    ? `
<p class="wsaid" id="wrallied">Link copied. Send it to whoever should ${v.one} this. It opens the hive with that tile lit, and nothing about you or them travels with it.</p>`
    : "";
  return `<div class="wsaids">
<div class="wsaid" id="wkept"><p>${kept}</p>${takeItBack}</div>
<p class="wsaid" id="wundone">Taken back. That ${v.one} is gone and you have it again. <span class="wleft"></span></p>
<p class="wsaid" id="wtoolate">That one stands. A ${v.one} can be taken back for thirty seconds after it is cast, and only by the browser that cast it. Nothing was changed.</p>
<p class="wsaid" id="walready">You already ${v.past} that one, on this browser. It did not spend a ${v.one}.</p>
<p class="wsaid" id="wspent">That is every ${v.one} you have on this date today, so that one did not count. It is still a good story to have picked.</p>
<p class="wsaid" id="wnotyet">Not yet. A date takes ${v.many} from the day itself, and this one has not arrived.</p>
<p class="wsaid" id="wclosed">This hive has sealed and is permanent now. That ${v.one} arrived after midnight and was not counted.</p>
<p class="wsaid" id="wfalse">That story was later shown false. It keeps its place on the hive and takes no ${v.many}.</p>
<p class="wsaid" id="wfailed">That did not save, and it was this end rather than yours. The date is fine. Try it again.</p>${rallied}
<p class="wsaid" id="wmiss">Nothing filed for ${escapeHtml(name)} says that. Nothing was spent. Adding a story takes a link and happens in the app: <a href="/about/">get Birthed</a> and add it there, and it is filed for the date.</p>
<p class="wsaid" id="wblank">Those words are too common to search on. Try a name, a place or what happened. Nothing was spent.</p>
<p class="wsaid" id="wnofind">The hive could not be searched just now: either it has sealed, or this end could not reach it. Nothing was spent. Try it again.</p>
</div>`;
}

/** The most a reader may type into the field. The input says so and the server holds it to the same. */
export const ASK_MAX = 120;

/**
 * The typed field. Ask what mattered about the date and find the story the
 * reader means among what is filed for it, rather than handing them a feed
 * of two hundred headlines to shop. A plain form, like the buzz: it posts
 * the phrase to /find, the server matches it against the date's stories in
 * memory and sends the reader back here with what it found, and nothing is
 * spent until they confirm through /boost. Drawn only in the live section,
 * for the same reason the buzz forms are, so a baked page never carries it.
 */
function askForm(day: WallDay, name: string, voice: Voice): string {
  const { month, day: d } = parts(day.wallDate);
  return `<form class="wask" id="ask" method="post" action="/find">
<label class="wasklabel" for="askq">What mattered about ${escapeHtml(name)}?</label>
<div class="waskrow"><input class="input" id="askq" name="q" type="text" maxlength="${ASK_MAX}" placeholder="A name, a place, a few words" autocomplete="off"><input type="hidden" name="m" value="${month}"><input type="hidden" name="d" value="${d}"><button type="submit">Find</button></div>
</form>`;
}

/**
 * The confirmation, drawn under the field on the one request after a post
 * to /find. The confirmation is not optional: a buzz is scarce, permanent
 * and irreversible, and a silent wrong match spends it on something the
 * reader did not mean. So the story, its outlet and its tier are shown
 * back, the button is the same form every tile carries, and "Not this one"
 * is the field again. A story shown false is still the story the reader
 * meant, so it is shown and it takes no buzz, the same as on a tile.
 */
function foundBlock(found: WallStory[], day: WallDay, live: boolean, voice: Voice): string {
  if (found.length === 0) return "";
  const { month, day: d } = parts(day.wallDate);
  const heading = found.length === 1 ? "Is this the one?" : "A few stories say that. Which one did you mean?";
  const rows = found.map((s) => {
    const count = units(s.support, voice);
    const meta = `<span class="wmeta">${escapeHtml(s.outlet)}${rowChip(s.tier)}${count === "" ? "" : ` ${count}`}</span>`;
    const control = s.status === "false"
      ? ` <span class="wmeta">Later shown false. Takes no ${voice.many}.</span>`
      : live ? ` ${buzzForm(s, voice)}` : "";
    // Its own id prefix, because the same story is drawn once more on the
    // hive or in the feed, and one id on a page names one element.
    return `<li id="f-${s.id}"><a href="${storyPath(s)}">${escapeHtml(s.headline)}</a> ${meta}${control}</li>`;
  }).join("\n");
  return `<div class="wsaid wfound" id="wfound">
<p class="wfoundhead">${heading}</p>
<ul class="wlist">
${rows}
</ul>
<p class="wnote">Spend one ${voice.one} on this? You get thirty seconds to take it back, and after that it stands. <a href="/${slug(month, d)}/#ask">Not this one</a></p>
</div>`;
}

/**
 * How long ago, in words. "one year ago today", "two years ago today".
 *
 * Years, because that is the only span this can be: the anniversary is the
 * same month and day in an earlier year, so the difference is always a whole
 * number of years and never a number of days. Plain numerals past ten, which
 * this site will not reach for another decade.
 */
export function yearsAgo(from: string, to: string): string {
  const was = Number(from.slice(0, 4));
  const now = Number(to.slice(0, 4));
  const gap = now - was;
  if (!Number.isFinite(gap) || gap < 1) return "";
  const words = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const said = gap < words.length ? words[gap]! : String(gap);
  return `${said} ${gap === 1 ? "year" : "years"} ago today`;
}

/**
 * What this browser backed on this day in earlier years.
 *
 * docs/the-wall.md section 15: not a score and not karma, which sections 6
 * and 8 refuse. A memory, shown only to the person who made it. So there is
 * no count on it, no rank, no total and nothing about anybody else: the
 * headline they backed, when, and a link to the receipt that is still there.
 *
 * A story keeps its receipt page after a newer wall takes the hive on the
 * date page, which is what the build already promises, so the link works
 * years later.
 */
export function anniversaryBlock(entries: Anniversary[], day: WallDay, voice: Voice): string {
  if (entries.length === 0) return "";
  const rows = entries.map((entry) => {
    const { month, day: d } = parts(entry.wallDate);
    const when = yearsAgo(entry.wallDate, day.wallDate);
    return `<li><span class="wannivwhen">You ${voice.past} this, ${escapeHtml(when)}</span>`
      + `<a href="/${slug(month, d)}/wall/${entry.storyId}/">${escapeHtml(entry.headline)}</a></li>`;
  }).join("\n");
  return `<section class="wanniv" aria-labelledby="wannivhead">
<h2 class="section" id="wannivhead">You were here</h2>
<p class="wnote">Only you can see this. It is on this browser and it is not a score.</p>
<ul class="wannivlist">
${rows}
</ul>
</section>`;
}

function wallBody(day: WallDay | null, name: string, now: number, options: WallOptions): string {
  const history = options.history ?? "";
  if (day === null) {
    if (options.date === undefined || options.hive) return "";
    return `${promise(name, options.date.month, options.date.day, now)}
<section class="feed2" aria-labelledby="feedhead">
<h2 class="section" id="feedhead">Today's feed</h2>
<p class="wnote">Everything with a birthday on ${escapeHtml(name)}. When its hive opens, every one of these takes buzzes.</p>
${HISTORY_START}${history}${HISTORY_END}
</section>`;
  }
  const live = options.interactive === true && takingBoosts(day, now);
  const hive = options.hive === true;
  const voice = voiceOf(day);
  const onWall = day.stories.filter((s) => s.rect !== null && (s.status === "placed" || s.status === "false"));
  // The feed: everything in the pool, most backed first, then the date's own
  // history ahead of the feeds, then arrival. All of it, no fold: a reddit
  // reads its feed and so does this. Decided September 10, 2026.
  const inPool = day.stories
    .filter((s) => s.status === "pool" || s.status === "overflow")
    .sort((a, b) => b.support - a.support || b.priority - a.priority || a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id));
  // The number ones are their own strip under the feed rather than sixty
  // rows in it: a wall of covers is how the date page already shows them,
  // and a cover with a year on it says more in less room than the sentence
  // does. Same pool, same button, same one buzz. Newest year first, the
  // most backed ahead of that.
  const songs = inPool.filter((s) => s.subjectKind === "song")
    .sort((a, b) => b.support - a.support || (songParts(b.headline)?.year ?? "").localeCompare(songParts(a.headline)?.year ?? ""));
  // One row per story rather than one per desk, most agreed first. The same
  // verdict filed by four newspapers was four rows with four buttons, which
  // split the buzzes four ways and made the wall disagree with itself about
  // what one story was. docs/the-wall.md section 28.
  const agreed = agreeOnNews(inPool.filter((s) => s.subjectKind !== "song"));
  const waiting = takeTurns(agreed.stories);
  const view = viewportFor(onWall.map((s) => s.rect!));
  const tiles = onWall.map((s, index) => tile(s, live, voice, view, hive, index)).join("\n");
  const notYet = now < Date.parse(day.liveAt);
  const closed = !takingBoosts(day, now) && !notYet;
  const { month, day: d } = parts(day.wallDate);

  // The hive, always drawn, even empty: an empty hive with the hour it opens
  // is a promise, and a missing section was a page that looked like nothing
  // was ever going to happen here.
  // An empty board is still a board: a faint grid of the modules nothing
  // has filled yet, and one line set large saying why. Three reasons, three
  // lines; the small line under each is the same sentence as before.
  const empty = onWall.length === 0
    ? `<p class="wnothing">${notYet
      ? `<b>Opens at midnight Eastern</b><span>That is ${hoursUntil(day.liveAt, now)} from now. What people ${voice.past} lands here.</span>`
      : closed
        ? `<b>Nothing reached the hive</b><span>Nothing reached the hive before it sealed.</span>`
        : `<b>Nothing on the hive yet</b><span>What people ${voice.past} lands here.</span>`}</p>`
    : "";
  const hindsight = closed ? hindsightLine(day) : null;
  const board = `<div class="wboard${onWall.length === 0 ? " wblank" : ""}${closed ? " wsealed" : ""}" role="list" aria-label="The hive, ${onWall.length} stories" style="--side:${view.side}">
${tiles}${empty}
</div>${hindsight === null ? "" : `
<p class="whindsight">${escapeHtml(hindsight)} <span class="whindsightsay">The board is as it sealed. The marks are what happened since.</span></p>`}`;

  const full = onWall.length > 0 && !hive
    ? `<p class="wfull"><a href="${hivePath(month, d)}">Open the hive full screen</a></p>`
    : "";

  /**
   * The way to get the picture, and it is a link and nothing else.
   *
   * No script, because this site runs none and the whole argument it makes
   * about itself depends on that. No download attribute either: it forces a
   * save without ever showing the thing, and somebody who is going to put
   * this in a message wants to look at it first. So it opens the picture at
   * its own address, full size, and every browser and every phone already
   * knows how to keep a picture from there.
   *
   * Two labels, one shown. The address never carries a year and the page is
   * shared, so which label is right is not known when this is baked: a
   * reader who has told the site their year gets their own version at the
   * same address, and `yoursMark` in serve.ts swaps the words on the open
   * dates. The same trick as the count and the marks, and safe for the same
   * reason, which is that every word in it is generated here.
   */
  const save = SAVE_PICTURE && onWall.length > 0
    ? `<p class="wsave"><a href="/${slug(month, d)}/yours.png"><span class="wsaveall">Save this picture</span><span class="wsavemine">Save your version</span></a></p>`
    : "";

  // The three chips and one clause. What each tier means is on the About
  // page and on every receipt; the legend's job here is only to say the
  // colours mean something. So it is drawn only when they do: a board whose
  // tiles are all one tier has one colour, and a key to three colours on it
  // explains a difference nobody can see. September 22, 2026.
  const legend = !tiersDiffer(onWall) ? "" : `<p class="wlegend"><span class="wchip w-seen_direct" title="${escapeHtml(tierMeaning("seen_direct"))}">Seen directly</span> <span class="wchip w-reported" title="${escapeHtml(tierMeaning("reported"))}">Reported</span> <span class="wchip w-claimed" title="${escapeHtml(tierMeaning("claimed"))}">Claimed</span> <span class="wlegendsay">Colour is how well a story is sourced, not whether it is true.</span></p>`;

  if (hive) {
    return `<section class="wall whive" aria-labelledby="wallhead">
<h2 class="section" id="wallhead">${escapeHtml(longDate(day))}</h2>
${countLine(day, now, voice, live)}${afterwords(voice, name, options.undo ?? null, "hive")}
${board}
${legend}
${save}
${anniversaryBlock(options.anniversary ?? [], day, voice)}
${yoursLine(options.yours, voice)}
</section>`;
  }

  // Under the hive, one feed: everything with a birthday on the date that is
  // not on the hive, with one button each. Before the worker has filed
  // anything for the date, the baked history stands in, so tomorrow's page
  // is not a countdown and nothing else.
  const unfiled = day.stories.length === 0;
  // A dozen rows, then the rest behind one line. A reader who wants the
  // whole day opens it once; a reader with three buzzes to spend does not
  // scroll a hundred and fifty rows to find one worth spending on.
  const shown = waiting.slice(0, FEED_SHOWN);
  const folded = waiting.slice(FEED_SHOWN);
  const feedList = waiting.length > 0
    ? `<ul class="wlist">
${shown.map((s) => listRow(s, live, voice, agreed.alsoIn.get(s.id) ?? null)).join("\n")}
</ul>` + (folded.length === 0 ? "" : `
<details class="wmore">
<summary>Show all ${waiting.length}</summary>
<ul class="wlist">
${folded.map((s) => listRow(s, live, voice, agreed.alsoIn.get(s.id) ?? null)).join("\n")}
</ul>
</details>`)
    : unfiled && history !== ""
      ? ""
      : `<p class="wnote wnofeed">Everything filed for ${escapeHtml(name)} is on the hive.</p>`;
  const stood = unfiled ? history : "";
  const feedNote = live
    ? `A ${voice.one} here counts the same as one on the hive.`
    : closed
      ? "The hive has sealed, so the feed takes no more."
      : `When the hive opens, every one of these takes ${voice.many}.`;

  // No sentence at all above the board, Nathan on September 22, 2026. The
  // line above it already says the hive is open and when it seals, the line
  // under it says what a buzz does, and the board itself is between them.
  // This was the third telling and it pushed the board down a line on a
  // phone. The earlier call on September 10 cut it everywhere but here; this
  // finishes that.
  const lede = "";
  // One line under the board, and a link for anybody who wants the rest.
  // Nathan, September 10, 2026: three paragraphs of explanation under the
  // board was a wall of text, and the people who need it are on the About
  // page anyway.
  const under = live
    ? `<p class="wnote wunder">A ${voice.one} makes its story bigger. Three a day. Typing spends nothing. <a href="/about/">How the hive works</a></p>`
    : closed
      ? `<p class="wnote wunder">Every story is a link to its source. <a href="/about/">How the hive works</a></p>`
      : "";

  const songStrip = songs.length === 0 ? "" : `<h3 class="wsub small">The number one song, every year</h3>
<p class="wnote">${live ? `A ${voice.one} on a song counts the same as one on anything else.` : "The week's number one on this date, back to 1959."}</p>
<ul class="wsongs">
${songs.map((s) => songRow(s, live, voice)).join("\n")}
</ul>`;

  // The hive is the hero: the name, one line saying what the hive is, one
  // sentence, the field and the count right above the board, and the board.
  // Everything that explains sits under it. Decided September 10, 2026.
  return `<section class="wall" aria-labelledby="wallhead">
<p class="whead"><span class="section" id="wallhead">The hive for ${escapeHtml(longDate(day))}</span> <span class="wstate">${stateLine(day, now)}</span></p>
${lede === "" ? "" : `<p class="wlede">${lede}</p>`}
${live ? askForm(day, name, voice) : ""}${countLine(day, now, voice, live)}${foundBlock(options.found ?? [], day, live, voice)}${afterwords(voice, name, options.undo ?? null)}
${board}
<div class="wafter">${onWall.length > 0 ? legend : ""}${save}${full}</div>
${under}
</section>
${anniversaryBlock(options.anniversary ?? [], day, voice)}
${yoursLine(options.yours, voice)}
<section class="feed2" aria-labelledby="feedhead">
<h2 class="section" id="feedhead">Today's feed</h2>
<p class="wnote">Everything with a birthday on ${escapeHtml(name)}, today's and every year's. ${feedNote}</p>
${feedList}
${HISTORY_START}${stood}${HISTORY_END}
${songStrip}
</section>`;
}

// ---------------------------------------------------------------------------
// One reader's own marks
// ---------------------------------------------------------------------------

/**
 * What this browser has done on this date, as a style block or "".
 *
 * The pixel problem, applied to the wall: a reader taps, and the page must
 * show them their own mark. This reveals "You backed this" on the stories
 * this browser backed and rewrites the remaining count to this browser's
 * own number. Nothing here is about anybody else: no totals, no other
 * token's taps, no count of people. It is one browser being shown what it
 * already told us, on the precedent of my_answers in serve.ts.
 *
 * A style block rather than rewritten tiles, because the section is shared
 * and cached for everybody for twenty seconds and this is the part that is
 * one reader's alone. The identifiers come out of our own database and are
 * used inside a selector, so anything not shaped like a uuid is dropped.
 */
export function wallMarks(standing: { left: number; allowance: number; backed: string[] }, day: WallDay, now: number): string {
  const rules: string[] = [];
  if (takingBoosts(day, now)) {
    const sentence = tapsLeftSentence(standing.left, standing.allowance, voiceOf(day));
    rules.push(`.wleft::after{content:"${sentence}"}`);
  }
  for (const id of standing.backed) {
    if (!/^[0-9a-f-]{36}$/.test(id)) continue;
    // The mark takes a line, so the headline gives one up rather than
    // showing the top of a line it cannot finish.
    rules.push(`#w-${id} .wmine{display:block}#w-${id} .wmeta .wmine{display:inline}#w-${id} .wh{-webkit-line-clamp:calc(var(--lines, 3) - 1)}#w-${id}{outline:3px solid var(--wink, #2A1A08);outline-offset:-3px}`);
  }
  if (rules.length === 0) return "";
  return `<style>${rules.join("")}</style>`;
}

// ---------------------------------------------------------------------------
// The receipt
// ---------------------------------------------------------------------------

function checkName(kind: WallCheck["kind"]): string {
  return kind === "resolves" ? "Link resolves" : "Page contains the quotation";
}

/**
 * A run of checks of one kind that all came out the same way: the same
 * result and the same status, one after another, with nothing of that kind
 * between them that differed. The receipt draws a run as one line.
 */
export interface CheckRun {
  kind: WallCheck["kind"];
  passed: boolean;
  httpStatus: number | null;
  /** Every check in the run, oldest first. Never fewer than one. */
  checks: WallCheck[];
}

/**
 * The check history folded into runs, in the order the runs began.
 *
 * The worker checked every source every quarter hour and wrote a row each
 * time, so a receipt was dozens of identical lines saying the link resolves
 * and the page contains the quotation: a log, not a receipt. Section 12
 * promises that a page that changes after a pass gets a new failing row and
 * the old row is never edited, so the fold keeps every change: a run breaks
 * on any check of its kind whose result or status differs, and the check
 * that broke it starts a run of its own, so a single failure between two
 * hundred passes is its own line.
 *
 * The two kinds interleave in the table, resolves then quotation every
 * tick, so runs are kept per kind and a run of one kind is not broken by
 * the other kind's rows. The detail is not part of the key on purpose: the
 * resolves detail carries the page's length in characters, which drifts
 * from fetch to fetch on a page that has not changed in any way the check
 * measures, and a fold that broke on it would fold nothing. The details are
 * still all on the page; the run row carries them.
 */
export function checkRuns(checks: WallCheck[]): CheckRun[] {
  const ordered = [...checks].sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
  const runs: CheckRun[] = [];
  const open = new Map<WallCheck["kind"], CheckRun>();
  for (const c of ordered) {
    const current = open.get(c.kind);
    if (current !== undefined && current.passed === c.passed && current.httpStatus === c.httpStatus) {
      current.checks.push(c);
      continue;
    }
    const run: CheckRun = { kind: c.kind, passed: c.passed, httpStatus: c.httpStatus, checks: [c] };
    open.set(c.kind, run);
    runs.push(run);
  }
  return runs;
}

/** "about 11 hours", "about 3 days", "about 45 minutes": how long a run lasted, said plainly. */
export function spanWords(fromIso: string, toIso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000));
  if (minutes < 60) return minutes === 1 ? "about a minute" : `about ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours === 1 ? "about an hour" : `about ${hours} hours`;
  const days = Math.round(hours / 24);
  return `about ${days} days`;
}

function checkRow(c: WallCheck): string {
  return `<tr><td>${escapeHtml(eastern(c.checkedAt))}</td><td>${checkName(c.kind)}</td><td>${c.passed ? "Passed" : "Failed"}</td><td>${c.httpStatus ?? ""}</td><td>${escapeHtml(c.detail ?? "")}</td></tr>`;
}

/**
 * One line for a run. A run of one is the row it always was. A longer run
 * says how many times and over what period, and folds every row it stands
 * for into a details element under the line, because the evidence stays
 * complete and only the repetition goes. A details element opens without a
 * script, which is what lets a receipt fold anything at all.
 */
function runRow(run: CheckRun): string {
  const first = run.checks[0]!;
  if (run.checks.length === 1) return checkRow(first);
  const last = run.checks[run.checks.length - 1]!;
  const details = new Set(run.checks.map((c) => c.detail ?? ""));
  const wording = details.size === 1
    ? escapeHtml(first.detail ?? "")
    : `${escapeHtml(first.detail ?? "")} The wording varied; every check is below.`;
  const every = run.checks.map((c) => `<li>${escapeHtml(eastern(c.checkedAt))}: ${escapeHtml(c.detail ?? "")}</li>`).join("\n");
  return `<tr class="wrun"><td>${escapeHtml(eastern(first.checkedAt))} to ${escapeHtml(eastern(last.checkedAt))}</td><td>${checkName(run.kind)}</td><td>${run.passed ? "Passed" : "Failed"}</td><td>${run.httpStatus ?? ""}</td>`
    + `<td>${run.checks.length} checks over ${spanWords(first.checkedAt, last.checkedAt)}, the same result every time. ${wording}`
    + `<details class="wevery"><summary>Every one of the ${run.checks.length}</summary><ul>
${every}
</ul></details></td></tr>`;
}

function sourceBlock(source: WallSource, index: number): string {
  // The runs, worked out once: the note below explains folding and there is
  // no sense explaining a folding that did not happen. A source checked twice
  // in two different ways has two rows and no run, and used to carry the
  // note anyway.
  const runs = checkRuns(source.checks);
  const folded = runs.some((run) => run.checks.length > 1);
  const verified = source.verifiedAt === null
    ? `<p class="wnote">The quotation has not yet been found on the page.</p>`
    : `<p class="wnote">Marked as found on the page, exactly, ${escapeHtml(eastern(source.verifiedAt))}. The check history below is the evidence.</p>`;
  const history = source.checks.length === 0
    ? `<p class="wnote">No checks run yet.</p>`
    : `<div class="wscroll"><table class="wchecks">
<thead><tr><th>When</th><th>Check</th><th>Result</th><th>Status</th><th>Detail</th></tr></thead>
<tbody>
${runs.map(runRow).join("\n")}
</tbody></table></div>`;
  return `<section class="wsource">
<h3 class="wsub">Source ${index + 1}: ${escapeHtml(source.outlet)}</h3>
<p><a href="${escapeHtml(source.url)}" rel="nofollow noopener">${escapeHtml(source.headline)}</a></p>
<p class="wmeta">Owned by ${escapeHtml(source.owner)}. Added ${escapeHtml(eastern(source.addedAt))}.</p>
<blockquote class="wquote">${escapeHtml(source.quotation)}</blockquote>
${verified}
<h4 class="wsub small">Check history</h4>
${folded ? `<p class="wnote">A run of checks that came out the same way is one line, with every check in it folded underneath. Any check that came out differently is its own line.</p>` : ""}
${history}
</section>`;
}

/**
 * The receipt. Plain and inspectable: the headline, the link, the tier and
 * what it means, every source with its quotation, and every check ever run.
 * No score, no name, nothing about who submitted or boosted it.
 */
export interface ReceiptOptions {
  /**
   * Draw the buzz control. Only serve.ts sets this, for a receipt it renders
   * at request time on an open date, and only then if the date is taking
   * boosts by the clock. A baked receipt never carries a form, for the same
   * reason a baked date page never does.
   */
  interactive?: boolean;
  /**
   * The story a buzz just counted for, so the sentence saying it counted can
   * carry the Undo button. The receipt draws the same sentences the date page
   * does and gets the button on the same one request.
   */
  undo?: WallStory | null;
  /**
   * The picture credit for a story that has a stored picture,
   * stored-pictures.ts. The tile shows the picture without a word; the
   * receipt is where the words go, the way the sources are.
   */
  credit?: { credit: string; commonsUrl: string | null; licenseUrl: string | null } | null;
}

function creditBlock(credit: ReceiptOptions["credit"]): string {
  if (credit === null || credit === undefined) return "";
  const links = [
    credit.commonsUrl === null ? "" : `<a href="${escapeHtml(credit.commonsUrl)}" rel="nofollow noopener">Its page on Commons</a>`,
    credit.licenseUrl === null ? "" : `<a href="${escapeHtml(credit.licenseUrl)}" rel="nofollow noopener">The licence</a>`,
  ].filter((link) => link !== "");
  return `<p class="wfacts wcredit">${escapeHtml(credit.credit)}${links.length === 0 ? "" : ` ${links.join(" &middot; ")}.`}</p>`;
}

export function storyBody(story: WallStory, day: WallDay, now: number = Date.now(), options: ReceiptOptions = {}): string {
  const { month, day: d } = parts(story.wallDate);
  const voice = voiceFor(month, d);
  const live = options.interactive === true && takingBoosts(day, now) && story.status !== "false";
  const status = story.status === "placed"
    ? `On the hive, ${story.rect!.w} by ${story.rect!.h} modules at column ${story.rect!.mx}, row ${story.rect!.my}.`
    : story.status === "false"
      ? `On the hive and later shown false, ${escapeHtml(eastern(story.falseAt ?? story.submittedAt))}. It keeps its rectangle.`
      : story.status === "overflow"
        ? "Earned a place and found no room on the hive. In the feed."
        : "In the feed. Not on the hive yet.";
  const falseNote = story.status === "false" && story.falseNote
    ? `<p class="wfalsenote">${escapeHtml(story.falseNote)}</p>`
    : "";
  // The one control, the count and the sentences, the same as a tile: a
  // reader who followed a headline here to read the sources should not have
  // to go back to vote on what they just read. The mark lands on this
  // element by id, the way it lands on a tile.
  const control = live
    ? `<div class="wfacts wreceiptbuzz" id="w-${story.id}">${buzzForm(story, voice, "receipt")}${mine(voice)}</div>
${countLine(day, now, voice)}${afterwords(voice, `${monthName(month)} ${d}`, options.undo ?? null, "receipt")}`
    : `<p class="wfacts" id="w-${story.id}">${mine(voice)}</p>`;
  return `<p class="wback"><a href="/${slug(month, d)}/">&larr; ${escapeHtml(monthName(month))} ${d}</a> &middot; the hive for ${escapeHtml(longDate(day))}</p>
<h1 class="wtitle">${escapeHtml(story.headline)}</h1>
<p class="wlink"><a href="${escapeHtml(story.url)}" rel="nofollow noopener">${escapeHtml(story.url)}</a></p>
<p class="wfacts">${chip(story.tier)} ${escapeHtml(tierMeaning(story.tier))} A tier is not a verdict.</p>
<p class="wfacts">${units(story.support, voice) === "" ? "Nobody has backed it yet." : `${units(story.support, voice)}.`} Submitted ${escapeHtml(eastern(story.submittedAt))}.${story.placedAt ? ` Placed ${escapeHtml(eastern(story.placedAt))}.` : ""}</p>
<p class="wfacts">${status}</p>
${control}
${falseNote}
${creditBlock(options.credit ?? null)}
<h2 class="section">Sources</h2>
<p class="wnote">The wording on the hive is the source's, never a person's. A check confirms a link resolves and that the page contains the quotation, by exact match. Nothing here decides what is true.</p>
${story.sources.map(sourceBlock).join("\n")}`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/** Appended to the site stylesheet. Colours follow the day's own hue. */
export const WALL_STYLE = `
.wall { margin: 8px 0 0; }
.wall h2.section { margin-top: 26px; }
/* The hive is the hero, September 10, 2026. What sits between the date's
   name and the board is one line naming the hive and its clock, one sentence,
   the field and the count. The heading is a line rather than a second
   headline: the name above it is the headline, and thirty two point type
   twice in a row was a screen with no board on it. */
.whead { margin: 0 0 6px; font-size: 13px; line-height: 1.5; color: #C9C2D4; }
.whead .section { font-family: Georgia, "Times New Roman", serif; font-weight: 800; font-size: 15px; color: #FFF7EE; margin-right: 6px; }
.wstate { display: block; margin: 0; font-size: 13px; font-weight: 600; color: #A49BAE; }
.wstate b { color: #FFF7EE; font-weight: 800; }
/* The coined words, underlined in honey. */
.wstate .wkey { font-style: normal; color: #FFF7EE; text-decoration: underline; text-decoration-color: #E7A83A; text-decoration-thickness: 2px; text-underline-offset: 3px; }
.wlede { margin: 0 0 12px; color: #B9B2AD; font-size: 15px; line-height: 1.4; max-width: 58ch; text-wrap: pretty; }
.wunder { margin: 8px 0 0; max-width: 62ch; }
.wboard {
  display: grid; grid-template-columns: repeat(var(--side, 16), minmax(0, 1fr)); grid-template-rows: repeat(var(--side, 16), minmax(0, 1fr));
  gap: 2px; width: 100%; max-width: 100%; aspect-ratio: 1 / 1; margin: 0 auto;
  padding: 2px; box-sizing: border-box; border-radius: 10px; background: #100D16;
  box-shadow: inset 0 0 0 1px rgba(255, 247, 238, .08);
}
/* On a phone the board runs edge to edge, because a gutter either side of
   the one picture on the page is forty pixels of nothing. The sticky bar
   runs edge to edge with it, or the tiles show either side of the bar as
   the page scrolls under it, which is what the first version did. On a wide
   screen the board stays the column's width for the same reason: the bar
   is the column's width, and a board wider than the bar scrolls out from
   under it. The full screen page sizes its own. */
@media (max-width: 760px) {
  .wall:not(.whive) .wboard { width: calc(100% + 40px); max-width: none; margin-left: -20px; margin-right: -20px; border-radius: 0; }
  .day .daybar { margin-left: -20px; margin-right: -20px; padding-left: 20px; padding-right: 20px; }
}
/* The empty board. A faint grid of the modules nothing has filled, the
   centre cleared for the words, so a hive that has not opened, or sealed
   with nothing on it, or does not exist yet, looks like a board waiting
   rather than a box with a sentence in it. Gradients, not an image: the
   page sends img-src 'self' and a data address is an image. */
.wboard.wblank {
  display: grid; place-items: center; aspect-ratio: 16 / 7; position: relative;
  background:
    radial-gradient(ellipse 62% 70% at 50% 50%, #100D16 38%, rgba(16, 13, 22, 0) 100%),
    linear-gradient(rgba(255, 247, 238, .07) 1px, transparent 1px) 0 0 / calc(100% / 16) calc(100% / 16),
    linear-gradient(90deg, rgba(255, 247, 238, .07) 1px, transparent 1px) 0 0 / calc(100% / 16) calc(100% / 16),
    #100D16;
}
.wnothing { grid-column: 1 / -1; grid-row: 1 / -1; align-self: center; justify-self: center; margin: 0; padding: 0 8%; text-align: center; font-size: 14px; line-height: 1.5; color: #827B75; text-wrap: balance; max-width: 40ch; }
.wnothing b { display: block; margin: 0 0 6px; font-family: Georgia, "Times New Roman", serif; font-weight: 800; font-size: clamp(20px, 5.4cqi, 30px); line-height: 1.15; color: #EFE0B8; }
.wnothing span { display: block; }
/* A sealed board is edged in honey, the one quiet sign on the picture
   itself that this one is finished. A chip on the board covered a tile. */
.wboard.wsealed { box-shadow: inset 0 0 0 1px rgba(255, 233, 176, .38); }
/* Under the board: one row, the legend on the left and the full screen link
   on the right, then the one line note. Three stacked lines of small grey
   type at three different alignments was the awkward version. */
.wafter { display: flex; align-items: center; justify-content: space-between; gap: 10px 18px; flex-wrap: wrap; margin: 10px 0 0; }
.wafter .wlegend { margin: 0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.wafter .wlegend .wchip { margin: 0; }
.wafter .wlegend .wlegendsay { margin-left: 4px; }
.wafter .wfull, .wafter .wsave { margin: 0; flex: none; }
/* Both labels are in the page and one of them is shown. The reader's own
   version is revealed by a rule serve.ts appends on the open dates, because
   the baked page is shared and cannot know who is reading it. */
.wsave { margin: 8px 0 0; text-align: right; font-size: 13px; }
.wsave a { color: #A49BAE; text-decoration: none; border-bottom: 1px solid #3A3348; }
.wsave a:hover { color: #FFD98A; border-color: #FFD98A; }
.wsavemine { display: none; }
.whive .wsave { max-width: 60ch; margin: 8px auto 0; }
.wfull { margin: 8px 0 0; text-align: right; font-size: 13px; }
.wfull a { color: #A49BAE; text-decoration: none; border-bottom: 1px solid #3A3348; }
.wfull a:hover { color: #FFD98A; border-color: #FFD98A; }
.walso { opacity: .85; }
.feed2 { margin: 30px 0 0; }
.feed2 h2.section { margin-bottom: 2px; }
.feed2 > .wnote { margin: 0 0 12px; max-width: 60ch; }
.feed2 .wlist + .wlist { margin-top: 8px; }
.wmore { margin: 22px 0 0; border-top: 1px solid #241E2E; padding-top: 4px; }
.wmore > summary { cursor: pointer; list-style: none; padding: 10px 0; font-size: 15px; font-weight: 600; color: #C9C2D4; }
.wmore > summary::-webkit-details-marker { display: none; }
.wmore > summary::before { content: "+"; display: inline-block; width: 20px; color: #A49BAE; }
.wmore[open] > summary::before { content: "\\2212"; }
.wmore > summary:hover { color: #FFD98A; }
/* The full screen page: the hive as big as the window allows, and little else. */
.wreceiptbuzz { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 10px 0 0; }
/* The mark's outline is for a tile; on the receipt the words are enough. */
.wstory .wfacts { outline: none !important; }
.wreceiptbuzz .wmine { margin: 0; }
.wstory .wcount { margin: 10px 0 0; }
.whive { margin: 0; }
.whive h2.section { margin: 10px 0 6px; font-size: 18px; }
.wrap.hivepage { max-width: none; padding: 16px 16px 40px; }
/* HIVE_MAX is a ceiling in CSS pixels. Tied to the window's height alone,
   the board grew by exactly as much as a zoom out shrank it, so zooming did
   nothing at all. September 22, 2026. */
.day.wsq { max-width: min(100%, calc(100vh - 40px), 1040px); margin: 0 auto; }
/* The footer is held to the same width as the board and centred with it.
   The full screen page widens the wrapper so the board can be as big as the
   window, and the footer was left full width under a centred board, so it
   hung off the left edge under the legend. */
.hivepage footer { max-width: min(100%, calc(100vh - 40px), 1040px); margin-left: auto; margin-right: auto; }
/* The three open hives, drawn at request time above an open date's hive. */
.wdays { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 14px; }
.wdays .wday { display: inline-flex; align-items: baseline; gap: 6px; padding: 6px 14px; border-radius: 999px; border: 1px solid #4A3A24; background: rgba(30, 23, 16, .7); color: #B7A488; font-size: 13px; text-decoration: none; }
.wdays .wday b { color: #FFF3E0; font-weight: 700; }
.wdays a.wday:hover { border-color: #F4B740; color: #FFCF6B; }
.wdays .wday.here { border-color: #F4B740; background: linear-gradient(180deg, #FFCF6B, #F4B740); color: #3A2A10; }
.wdays .wday.here b { color: #1B1206; }
.whive .wboard { width: 100%; }
.whive .wlegend { max-width: 60ch; margin: 12px auto 0; }
/* Honey. Decided September 10, 2026: the tile's colour is its tier, and the
   three tiers are three tones of the same hive, pale wax for claimed, amber
   for reported, deep honey for seen directly. Every seeded story is claimed,
   so a wall drawn in the day's hue was a grey square on a black page. Wax
   is the candle's own colour, so the site keeps one palette. */
.wtile {
  position: relative; display: block; min-width: 0; min-height: 0; overflow: hidden;
  border-radius: 3px; text-decoration: none; color: #2A1A08; box-sizing: border-box;
  background: #EFE0B8; --wink: #2A1A08; --wbtn: #2A1A08; --wbtn-ink: #FFE9B0; --wmark: #8A3F05;
}
.wtile.w-claimed { background: #EFE0B8; }
.wtile.w-reported { background: #E7A83A; }
.wtile.w-seen_direct { background: #B05A0C; color: #FFF3DC; --wink: #FFF3DC; --wbtn: #FFE9B0; --wbtn-ink: #2A1A08; --wmark: #FFE9B0; }
.wtile:hover { outline: 2px solid var(--wink); outline-offset: -2px; }
/* Juice, September 10, 2026, in style and nowhere else because the site
   sends default-src 'none'. Three things: the tiles rise in when the board
   loads, the way the covers do; a tile lifts under the pointer; and the
   tile a reader just buzzed reads as changed. The last one is :target. A
   tap that counts comes back to the page with the story's own id in the
   fragment, so the browser scrolls to the tile and lights it, and the
   sentence above the board is shown by :has rather than by the fragment,
   which can only name one element. Every ring here is a box shadow rather
   than an outline, because the reader's own mark already owns the outline. */
.wtile { transition: transform 160ms ease, box-shadow 160ms ease; }
.wtile:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(0, 0, 0, .5); z-index: 2; }
/* The section is a column so the sentence for a tap can move: after a tap
   that counted the browser lands on the tile, so the sentence and the count
   go under the board where the reader is looking, and the tile lands a
   third of the way down the window with room for them beneath it. */
.wall:not(.whive) { display: flex; flex-direction: column; }
.wall:not(.whive) > * { order: 0; }
.wall:not(.whive) > .wunder, .wall:not(.whive) > .wafter { order: 2; }
.day:has(.wtile:target) .wall > .wsaids { order: 1; margin: 12px 0 0; }
.wtile:target, .wlist li:target, .wsongs li:target {
  z-index: 3; scroll-margin-top: 34vh;
  box-shadow: 0 0 0 3px #FFD98A, 0 0 28px rgba(255, 217, 138, .55);
}
.wtile:target { outline: 3px solid #FFD98A !important; outline-offset: -3px; }
.wlist li:target, .wsongs li:target { position: relative; }
.day:has(.wtile:target, .wlist li:target, .wsongs li:target, .wreceiptbuzz:target) #wkept { display: block; }
@keyframes wpop {
  0% { transform: scale(.92); box-shadow: 0 0 0 0 rgba(255, 217, 138, .95), 0 0 0 rgba(255, 217, 138, 0); }
  55% { transform: scale(1.04); }
  100% { transform: none; box-shadow: 0 0 0 3px #FFD98A, 0 0 28px rgba(255, 217, 138, .55); }
}
@media (prefers-reduced-motion: no-preference) {
  .wboard .wtile { animation: rise 460ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards; animation-delay: calc(var(--i, 0) * 45ms); }
  .wboard .wtile:target { animation: rise 460ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards, wpop 720ms cubic-bezier(0.22, 0.61, 0.36, 1) 480ms both; }
  .wlist li:target, .wsongs li:target { animation: wpop 720ms cubic-bezier(0.22, 0.61, 0.36, 1) 200ms both; }
  .wtile:hover { transition: transform 160ms ease, box-shadow 160ms ease; }
}
@media (prefers-reduced-motion: reduce) { .wtile { transition: none; } .wtile:hover { transform: none; } }
/* A picture, when the page's picture rules name one for this tile's subject:
   the cover or the face fills the tile and a scrim darkens the bottom so the
   headline reads over it. A tile no rule names has --pic unset and draws as
   it always did. */
.wtile::before, .wtile::after { content: ""; position: absolute; inset: 0; pointer-events: none; }
.wtile::before { background: var(--pic, none) center / cover no-repeat; }
.wtile::after { background: var(--scrim, none); }
.wtile > * { position: relative; z-index: 1; }
.wtile.tiny .wn { z-index: 1; }
/* The strip of number ones under the feed. */
.wsongs { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.wsongs li { display: flex; flex-direction: column; gap: 6px; background: #17141F; border-radius: 12px; padding: 8px; font-size: 13px; line-height: 1.35; scroll-margin-top: 72px; --wbtn: #E7A83A; --wbtn-ink: #2A1A08; --wmark: #E7A83A; --wink: #E7A83A; }
.wsongs li:target { box-shadow: 0 0 0 2px #EF5680; }
.wsongs .wart {
  /* width: 100% is not decoration. In a column flex box an aspect-ratio
     box with no width takes its width from its height, which is nothing,
     and draws as nothing. */
  display: block; width: 100%; aspect-ratio: 1; border-radius: 8px; overflow: hidden; position: relative; text-decoration: none;
  background: #241E2E var(--pic, none) center / cover no-repeat;
}
.wsongs .wart:hover { outline: 2px solid #E7A83A; outline-offset: -2px; }
.wsongs .wyr {
  position: absolute; left: 6px; bottom: 6px; padding: 2px 7px; border-radius: 999px;
  background: rgba(20,12,4,.82); color: #FFE9B0; font-family: Georgia, "Times New Roman", serif; font-weight: 800; font-size: 13px;
}
.wsongs .wsongt { font-weight: 600; color: #E9E1DB; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.wsongs .wsongf { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #9C9490; }
.wsongs .wsongf .wn { font-weight: 700; }
.wsongs .wmine { display: none; }
.wchip {
  display: inline-block; padding: 1px 6px; border-radius: 999px; font-size: 10px; font-weight: 700;
  letter-spacing: .04em; text-transform: uppercase; vertical-align: middle;
}
.wchip.w-claimed { background: #EFE0B8; color: #2A1A08; }
.wchip.w-reported { background: #E7A83A; color: #2A1A08; }
.wchip.w-seen_direct { background: #B05A0C; color: #FFF3DC; }
.wempty, .wlegend, .wnote { font-size: 13px; color: #827B75; line-height: 1.45; }
.wlegend { margin: 10px 0 0; }
.wunder a, .wlegend a { color: #A49BAE; text-decoration: none; border-bottom: 1px solid #3A3348; }
.wunder a:hover { color: #FFD98A; border-color: #FFD98A; }
.wlegend .wchip { margin-right: 4px; }
.wsub { font-family: Georgia, "Times New Roman", serif; font-weight: 800; font-size: 19px; margin: 26px 0 4px; }
.wsub.small { font-size: 15px; margin-top: 14px; }
.wlist { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 8px; }
.wlist li { display: block; background: #17141F; border-radius: 12px; padding: 10px 13px; font-size: 15px; line-height: 1.4; }
.wlist a { text-decoration: none; font-weight: 600; }
.wlist a:hover { text-decoration: underline; }
.wmeta { font-size: 13px; color: #9C9490; }
.wback { font-size: 13px; color: #827B75; margin: 0 0 14px; }
.wback a { color: #A49BAE; text-decoration: none; border-bottom: 1px solid #3A3348; }
.wtitle { font-size: clamp(26px, 6vw, 40px); }
.wlink { font-size: 14px; word-break: break-all; margin: 0 0 12px; }
.wlink a { color: #A49BAE; }
.wfacts { margin: 0 0 6px; font-size: 15px; color: #C9C2D4; }
.wfalsenote { background: #17141F; border-left: 3px solid #FFF7EE; padding: 8px 12px; margin: 10px 0; font-size: 15px; }
.wsource { margin: 0 0 8px; }
.wsource p { margin: 0 0 6px; }
.wquote { margin: 8px 0; padding: 10px 14px; border-left: 3px solid var(--day, #8B5CF6); background: #17141F; font-family: Georgia, "Times New Roman", serif; font-size: 16px; line-height: 1.45; }
.wscroll { overflow-x: auto; }
.wchecks { border-collapse: collapse; font-size: 12.5px; min-width: 520px; }
.wchecks th, .wchecks td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #241E2E; vertical-align: top; }
.wchecks th { color: #827B75; font-weight: 600; }

/* The mural's ordinary tile. docs/the-wall.md section 27: it is its picture,
   and where there is no picture it is its year. Both are always in the
   markup; the rule below hides the year on a tile that turned out to have a
   picture, because only pictureRules knows which those are. */
.wtile.tiny, .wtile.small {
  display: grid; place-items: center; padding: 2px; overflow: hidden;
}
.wyr {
  position: relative; z-index: 1; font-family: Georgia, "Times New Roman", serif; font-weight: 700;
  line-height: 1; letter-spacing: -.01em; color: var(--wink, #2A1A08);
  font-size: clamp(9px, calc(21cqi * var(--tw, 2) / var(--side, 16)), 34px);
}
/* A tile with no year says its outlet instead, which is what it said before,
   and an outlet is a word rather than four numerals so it is set smaller and
   allowed to wrap out of sight. */
.wtile.wnoyr .wyr {
  font-family: inherit; font-weight: 600; font-size: clamp(7px, calc(11cqi * var(--tw, 2) / var(--side, 16)), 13px);
  opacity: .75; text-align: center; overflow: hidden; max-width: 100%;
}
.wtile[data-subject] .wyr { display: block; }
.wtile.small .wn, .wtile.tiny .wn {
  position: absolute; right: 2px; top: 2px; z-index: 2;
  font-size: clamp(7px, calc(13cqi * var(--tw, 2) / var(--side, 16)), 12px); font-weight: 800;
}
.wtile.mid, .wtile.big { padding: 5px 6px; display: flex; flex-direction: column; justify-content: space-between; }
.wtile.mid .wh, .wtile.big .wh {
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
  font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 11px; line-height: 1.2; text-wrap: pretty;
}
.wtile.big .wh { -webkit-line-clamp: 4; font-size: 13px; }
.wfoot { display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center; font-size: 9px; opacity: .9; margin-top: 3px; }
.wtile.mid .wtile.wfalse { opacity: .55; }
.wstamp {
  position: absolute; left: 0; right: 0; bottom: 0; padding: 2px 4px; font-size: 9px; font-weight: 800;
  letter-spacing: .06em; text-transform: uppercase; background: #2A1A08; color: #FFF3DC; text-align: center;
}
/* Hindsight, docs/the-wall.md section 23: the verdict on a sealed tile. */
.wstamp.wheld { background: #F4B740; color: #1B1206; }
.wstamp.wforgot { background: #3A2E1C; color: #B7A488; }
.whindsight { margin: 10px 0 0; font-size: 14px; color: #2A1A08; }
.whindsight .whindsightsay { color: #6B5A42; font-size: 12px; }
.wlivehive .whindsight, .hivepage .whindsight { color: #FFF3E0; }
.wlivehive .whindsightsay, .hivepage .whindsightsay { color: #B7A488; }

/* Boosting from the web, docs/the-wall.md section 13. Later than everything
   above on purpose: several of these override rules written for tiles that
   were links. */
/* The headline is a link to the receipt and looks like the headline it was.
   The one control that spends a unit is a small button in the footer. */
.wtile .wh, .wtile .wh:hover { color: inherit; text-decoration: none; }
.wtile .wh:hover { text-decoration: underline; text-decoration-color: rgba(42, 26, 8, .5); text-underline-offset: 2px; }
.wtile .wh:focus-visible { outline: 2px solid var(--wink); outline-offset: 2px; border-radius: 2px; }
.wbuzz { display: inline; margin: 0; flex: none; }
.wbuzz button {
  margin: 0; padding: 1px 7px; border: 0; border-radius: 999px; cursor: pointer;
  background: var(--wbtn, #2A1A08); color: var(--wbtn-ink, #FFE9B0); font: inherit; font-weight: 800; line-height: 1.4;
}
.wbuzz button:hover { filter: brightness(1.15); }
.wbuzz button:focus-visible { outline: 2px solid var(--wink, #2A1A08); outline-offset: 2px; }
/* The reader's own mark, revealed by wallMarks on the stories this browser
   backed. A line of its own inside the tile, so it covers nothing and costs
   the reader one line of a headline they already read. */
.wmine { display: none; font-weight: 800; color: var(--wmark, #8A3F05); font-size: clamp(8px, calc(30cqi / var(--side, 16)), 13px); line-height: 1.3; flex: none; }
.wboard { container-type: inline-size; }
.wtile.mid, .wtile.big { gap: 2px; }
/* Type scales with the window, not the board: a twelve module window draws
   each module a third larger than the whole board would, and the words
   follow. */
/* And with the tile: a headline in a tile twice the minimum width is set
   about a third larger, and one across the whole board about twice as large,
   so the pie's biggest share reads as the biggest thing on the page rather
   than as the emptiest tile. --tw is the tile's width in modules, set on the
   tile; the minimum is four. */
.wtile.mid .wh, .wtile.big .wh {
  font-size: clamp(10px, calc(38cqi / var(--side, 16) * var(--fit, 1)), 44px);
  -webkit-line-clamp: var(--lines, 3);
  /* The headline takes the room the footer leaves and no more. The clamp
     above is an arithmetic answer and the clamp's own floor of ten pixels
     can beat it on a small board, so this is the rule that holds whatever
     the arithmetic gets wrong: a headline may be cut, and it may never push
     the footer out of the tile or be sliced in half under it, which is what
     a sixteen module wide tile did on the live board for September 21. */
  flex: 1 1 auto; min-height: 0;
  /* And a hard ceiling in the same number of lines. The line clamp alone
     draws its ellipsis in the right place and still paints the line after
     it, which on the September 21 board put half a sentence across the
     footer of three tiles. A max-height in em is the same arithmetic said
     in a way the box cannot argue with. */
  max-height: calc(var(--lines, 3) * 1.2em);
}
.wtile.mid, .wtile.big { padding: clamp(5px, calc(14cqi / var(--side, 16)), 14px) clamp(6px, calc(16cqi / var(--side, 16)), 16px); }
.wfoot {
  flex: none; flex-wrap: nowrap; white-space: nowrap; overflow: hidden; margin-top: 0; min-width: 0;
  font-size: clamp(8px, calc(29cqi / var(--side, 16)), 13px);
}
.wfoot .wo { min-width: 0; overflow: hidden; text-overflow: ellipsis; opacity: .8; }
/* The kind mark, first in the footer, the size of the button's type. */
.wkind { display: inline-flex; flex: none; opacity: .85; }
.wkind svg { display: block; width: clamp(12px, calc(38cqi / var(--side, 16)), 17px); height: auto; }
.wfoot .wn { flex: none; font-weight: 700; }
.wfoot .wbuzz button { font-size: clamp(8px, calc(30cqi / var(--side, 16)), 13px); }
/* The two container rules that used to add a line on a wider board are gone
   with the guess they corrected: fitType works in modules, so a board twice
   the size draws the same tile twice as large with the same words in it. */
.wcount { margin: 0 0 10px; font-size: 15px; font-weight: 600; color: #E9E1DB; }
.wsaid {
  display: none; margin: 0 0 14px; padding: 13px 15px; border-radius: 12px;
  background: #171227; border: 1px solid #2A2434; color: #E9E1DB; font-size: 14px; line-height: 1.5;
}
.wsaid:target { display: block; }
/* Taking a misclick back. A quiet outline button rather than a second amber
   one: the buzz is the thing this page wants you to press, and the undo is
   the thing that should be findable and never inviting. It sits on the
   sentence that says a buzz counted, and nowhere else. */
/* The anniversary. docs/the-wall.md section 15: a memory, shown to the one
   person who made it, and never a number. Quiet on purpose. It is the last
   thing under the hive rather than the first thing on the page, because it is
   about a date that is over and the page is about one that is not. */
.wanniv { margin: 22px 0 0; }
.wanniv .wnote { margin: 2px 0 10px; }
.wannivlist { margin: 0; padding: 0; list-style: none; }
.wannivlist li {
  /* display:block explicitly. The site's list rules put a row into flex, and
     inherited that turned the label and the headline into two columns. */
  display: block; margin: 0 0 8px; padding: 10px 13px; border-radius: 10px;
  background: #171227; border: 1px solid #2A2434;
}
.wannivwhen {
  display: block; margin: 0 0 3px; color: #E7A83A;
  font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
}
.wannivlist a {
  display: block; color: #E9E1DB; font-family: Georgia, "Times New Roman", serif;
  font-weight: 700; font-size: 16px; line-height: 1.35; text-decoration: none;
}
.wannivlist a:hover { text-decoration: underline; text-underline-offset: 2px; }
.wannivlist a:focus-visible { outline: 2px solid #E7A83A; outline-offset: 2px; border-radius: 3px; }
/* The private record. docs/the-wall.md section 25. The link under the board
   is one quiet line, drawn only for a browser that has buzzed something, and
   the page it leads to borrows the anniversary's row so the two read as the
   same thing, which is what they are. */
.wyours { margin: 14px 0 0; }
.wyourshead {
  margin: 18px 0 6px; color: #E9E1DB;
  font-family: Georgia, "Times New Roman", serif; font-size: 26px; line-height: 1.2;
}
.wyourslist { margin: 14px 0 0; padding: 0; list-style: none; }
.wyourslist li {
  display: block; margin: 0 0 8px; padding: 10px 13px; border-radius: 10px;
  background: #171227; border: 1px solid #2A2434;
}
.wyourslist a {
  display: block; color: #E9E1DB; font-family: Georgia, "Times New Roman", serif;
  font-weight: 700; font-size: 16px; line-height: 1.35; text-decoration: none;
}
.wyourslist a:hover { text-decoration: underline; text-underline-offset: 2px; }
.wyourslist a:focus-visible { outline: 2px solid #E7A83A; outline-offset: 2px; border-radius: 3px; }
.wyoursmeta {
  display: flex; gap: 10px; margin: 5px 0 0;
  font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
}
.wyourswhen { color: #9A93A8; }
.wyoursstate { color: #E7A83A; }
.wsaid > p { margin: 0; }
.wundoline { margin: 10px 0 0; }
.wundo { display: inline; margin: 0; }
.wundo button {
  margin: 0; padding: 2px 11px; border: 1px solid #55506A; border-radius: 999px; cursor: pointer;
  background: transparent; color: #E9E1DB; font: inherit; font-weight: 700; line-height: 1.5;
}
.wundo button:hover { border-color: #8F88A6; background: rgba(255, 255, 255, .06); }
.wundo button:focus-visible { outline: 2px solid #E7A83A; outline-offset: 2px; }
.wundonote { margin-left: 7px; color: #A49BAE; font-size: 13px; }
.wlist li { --wbtn: #E7A83A; --wbtn-ink: #2A1A08; --wmark: #E7A83A; --wink: #E7A83A; }
.wlist .wbuzz { margin-left: 6px; }
.wlist .wbuzz button { font-size: 12px; padding: 2px 9px; }
.wlist .wmine { margin-left: 6px; }
/* The typed field, docs/the-wall.md section 15. A form like the buzz, and
   the confirmation is drawn under it on the one request that follows. */
.wask { margin: 0 0 12px; }
.wasklabel { display: block; margin: 0 0 8px; font-family: Georgia, "Times New Roman", serif; font-weight: 800; font-size: 19px; color: #FFF7EE; }
.waskrow { display: flex; gap: 8px; align-items: stretch; }
.wask .input { flex: 1; min-width: 0; padding: 11px 14px; border-radius: 12px; }
.wask button {
  flex: none; margin: 0; padding: 0 18px; border: 0; border-radius: 12px; cursor: pointer;
  background: #E7A83A; color: #2A1A08; font: inherit; font-weight: 800;
}
.wask button:hover { filter: brightness(1.1); }
.wask button:focus-visible { outline: 2px solid #FFD98A; outline-offset: 2px; }
.wask .wnote { margin: 8px 0 0; }
.wsaid.wfound { display: block; }
.wfoundhead { margin: 0 0 8px; font-family: Georgia, "Times New Roman", serif; font-weight: 800; font-size: 19px; }
.wfound .wlist { margin: 0 0 10px; }
.wfound .wnote { margin: 0; }
.wfound .wnote a { color: #A49BAE; }
/* A run of identical checks, folded. The details element is the fold. */
.wevery { margin: 6px 0 0; }
.wevery > summary { cursor: pointer; color: #827B75; }
.wevery > ul { margin: 6px 0 0; padding: 0 0 0 16px; list-style: disc; color: #827B75; }
.wevery > ul > li { display: list-item; background: none; border-radius: 0; padding: 1px 0; font-size: 12px; }
`;
