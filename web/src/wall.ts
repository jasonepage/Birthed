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
  placedAt: string | null;
  rect: { mx: number; my: number; w: number; h: number } | null;
  falseAt: string | null;
  falseNote: string | null;
  sources: WallSource[];
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
  status: WallStatus; tier: WallTier; support: number; placed_at: string | null;
  anchor_mx: number | null; anchor_my: number | null; w_modules: number | null; h_modules: number | null;
  false_at: string | null; false_note: string | null;
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
    "wall_stories?select=id,wall_date,submitted_at,headline,url,outlet,status,tier,support,placed_at,anchor_mx,anchor_my,w_modules,h_modules,false_at,false_note&order=wall_date.asc,submitted_at.asc,id.asc");
  const sources = await rows<SourceRow>(url, key,
    "wall_sources?select=id,story_id,url,outlet,owner,headline,quotation,verified_at,added_at&order=added_at.asc,id.asc");
  const checks = await rows<CheckRow>(url, key,
    "wall_checks?select=source_id,checked_at,kind,passed,http_status,detail&order=checked_at.asc,id.asc");

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
      status: s.status, tier: s.tier, support: s.support, placedAt: s.placed_at,
      rect: s.anchor_mx === null || s.anchor_my === null || s.w_modules === null || s.h_modules === null
        ? null
        : { mx: s.anchor_mx, my: s.anchor_my, w: s.w_modules, h: s.h_modules },
      falseAt: s.false_at, falseNote: s.false_note,
      sources: sourcesByStory.get(s.id) ?? [],
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
}

function storyFrom(s: StoryRow, sources: WallSource[]): WallStory {
  return {
    id: s.id, wallDate: s.wall_date, submittedAt: s.submitted_at, headline: s.headline, url: s.url, outlet: s.outlet,
    status: s.status, tier: s.tier, support: s.support, placedAt: s.placed_at,
    rect: s.anchor_mx === null || s.anchor_my === null || s.w_modules === null || s.h_modules === null
      ? null
      : { mx: s.anchor_mx, my: s.anchor_my, w: s.w_modules, h: s.h_modules },
    falseAt: s.false_at, falseNote: s.false_note,
    sources,
  };
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
      `${url}/rest/v1/wall_stories?select=id,wall_date,submitted_at,headline,url,outlet,status,tier,support,placed_at,anchor_mx,anchor_my,w_modules,h_modules,false_at,false_note,`
      + `wall_sources(id,story_id,url,outlet,owner,headline,quotation,verified_at,added_at,wall_checks(source_id,checked_at,kind,passed,http_status,detail))`
      + `&wall_date=eq.${wallDate}&order=submitted_at.asc,id.asc&wall_sources.order=added_at.asc&wall_sources.wall_checks.order=checked_at.asc`,
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
      })))),
    };
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
 * Dates that speak plainly. docs/the-wall.md section 9 left solemn dates
 * open, with a curated list as one of the two options. This is that list,
 * for the voice only: the wall still opens, still takes support, still
 * seals. It only stops making the pun. Month and day, keyed the way the
 * rest of the build keys a date. A start, to be edited by a person, and
 * September 11 is the one the documents name.
 */
export const PLAIN_DATES: ReadonlySet<string> = new Set([
  "9-11",  // September 11 attacks
  "12-7",  // Pearl Harbor
  "4-19",  // Oklahoma City
  "4-20",  // Columbine
  "12-14", // Sandy Hook
  "6-12",  // Pulse
  "10-1",  // Las Vegas
  "5-24",  // Uvalde
]);

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

function chip(tier: WallTier): string {
  return `<span class="wchip w-${tier}">${tierLabel(tier)}</span>`;
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
function tileClass(rect: { w: number; h: number }): string {
  if (rect.w >= 4 && rect.h >= 3) return "big";
  if (rect.w >= 3 && rect.h >= 2) return "mid";
  if ((rect.w >= 3 && rect.h === 1) || (rect.w === 2 && rect.h >= 2)) return "small";
  return "tiny";
}

/** The fields a buzz posts: the story, and the date page to come back to. */
function tapFields(story: WallStory): string {
  const { month, day } = parts(story.wallDate);
  return `<input type="hidden" name="s" value="${story.id}"><input type="hidden" name="m" value="${month}"><input type="hidden" name="d" value="${day}">`;
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
function buzzForm(story: WallStory, voice: Voice): string {
  return `<form class="wbuzz" method="post" action="/boost">${tapFields(story)}`
    + `<button type="submit" aria-label="${escapeHtml(`${voice.button}: ${story.headline}`)}">${voice.button}</button></form>`;
}

function footer(story: WallStory, live: boolean, voice: Voice): string {
  const count = units(story.support, voice);
  // The control first, then the count it changes, then the outlet, cut with
  // an ellipsis when the tile is narrow. No tier chip: the tile's colour is
  // its tier, the legend says so, and a chip beside the outlet was what
  // pushed a phone tile down to one line of headline.
  return `<span class="wfoot">${live ? buzzForm(story, voice) : ""}${count === "" ? "" : `<span class="wn">${count}</span>`}<span class="wo">${escapeHtml(story.outlet)}</span></span>`;
}

/**
 * One tile. The headline links to the receipt. While the date is taking
 * support, a button in the footer spends one unit. Either way it sits at
 * the anchor the server stored, at the size it stored.
 */
function tile(story: WallStory, live: boolean, voice: Voice): string {
  const rect = story.rect!;
  const size = tileClass(rect);
  const count = units(story.support, voice);
  const label = `${story.headline}. ${story.outlet}. ${tierLabel(story.tier)}${count === "" ? "" : `, ${count}`}.`
    + (story.status === "false" ? " Later shown false." : "");
  // How many lines of headline the height allows, a hint the stylesheet
  // reads. Three modules hold three lines on a phone and four on a desktop;
  // taller tiles hold more.
  const lines = rect.h <= 3 ? 3 : rect.h === 4 ? 5 : rect.h === 5 ? 7 : rect.h === 6 ? 9 : 11;
  const style = `grid-column:${rect.mx + 1} / span ${rect.w};grid-row:${rect.my + 1} / span ${rect.h};--lines:${lines}`;
  const stamp = story.status === "false" ? `<span class="wstamp">Shown false</span>` : "";
  const classes = `wtile ${size} w-${story.tier}${rect.h <= 3 ? " wh3" : ""}${story.status === "false" ? " wfalse" : ""}`;
  const receipt = storyPath(story);

  if (size === "tiny" || size === "small") {
    // A stored rectangle from before the minimum existed. Too small for a
    // headline; it links to its receipt and takes no control.
    const inner = size === "tiny"
      ? `<span class="wn">${count}</span>`
      : `<span class="wo">${escapeHtml(story.outlet)}</span> <span class="wn">${count}</span>`;
    return `<a class="${classes}" id="w-${story.id}" href="${receipt}" style="${style}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${inner}${stamp}</a>`;
  }

  const takes = live && story.status !== "false";
  return `<div class="${classes}" id="w-${story.id}" style="${style}" role="listitem">`
    + `<a class="wh" href="${receipt}" title="${escapeHtml(label)} The receipt: every source, every quotation, every check.">${escapeHtml(story.headline)}</a>`
    + `${mine(voice)}${footer(story, takes, voice)}${stamp}</div>`;
}

/** One row in the list under the board. The headline opens the receipt; the button spends a unit while the date takes them. */
function listRow(story: WallStory, live: boolean, voice: Voice): string {
  const count = units(story.support, voice);
  const meta = `<span class="wmeta">${escapeHtml(story.outlet)} ${chip(story.tier)}${count === "" ? "" : ` ${count}`}${mine(voice)}</span>`;
  const control = live && story.status !== "false" ? ` ${buzzForm(story, voice)}` : "";
  return `<li id="w-${story.id}"><a href="${storyPath(story)}">${escapeHtml(story.headline)}</a> ${meta}${control}</li>`;
}

function stateLine(day: WallDay, now: number): string {
  const closes = day.closedAt ?? day.closesAt;
  const closed = Date.parse(closes) <= now;
  // The third day is the one after the date, and the close is the midnight
  // that ends it.
  const after = new Date(Date.UTC(day.year, day.month - 1, day.day + 1));
  const ending = `${monthName(after.getUTCMonth() + 1)} ${after.getUTCDate()}, ${after.getUTCFullYear()}`;
  if (closed) return `Closed at midnight Eastern ending ${ending}. This wall is permanent.`;
  return `Open. Closes at midnight Eastern ending ${ending}, and is then permanent.`;
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
}

export function wallSection(day: WallDay | null, name: string, now: number = Date.now(), options: WallOptions = {}): string {
  return `${WALL_START}${wallBody(day, name, now, options)}${WALL_END}`;
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

function countLine(day: WallDay, now: number, voice: Voice): string {
  if (!takingBoosts(day, now)) {
    // Open for submissions, not yet for support: the day before.
    if (now >= Date.parse(day.opensAt) && now < Date.parse(day.liveAt)) {
      return `<p class="wcount">${voice === BEE ? "Buzzing" : "Taps"} start${voice === BEE ? "s" : ""} when the date arrives, at midnight Eastern.</p>`;
    }
    return "";
  }
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
function afterwords(voice: Voice): string {
  const v = voice;
  return `<div class="wsaids">
<p class="wsaid" id="wkept">That counts. <span class="wleft"></span> The square redraws on the quarter hour, so a bigger tile takes a few minutes to show; your mark on it is there now.</p>
<p class="wsaid" id="walready">You already ${v.past} that one, on this browser. It did not spend a ${v.one}.</p>
<p class="wsaid" id="wspent">That is every ${v.one} you have on this date today, so that one did not count. It is still a good story to have picked.</p>
<p class="wsaid" id="wnotyet">Not yet. A date takes ${v.many} from the day itself, and this one has not arrived.</p>
<p class="wsaid" id="wclosed">This wall has closed and is permanent now. That ${v.one} arrived after midnight and was not counted.</p>
<p class="wsaid" id="wfalse">That story was later shown false. It keeps its place on the wall and takes no ${v.many}.</p>
<p class="wsaid" id="wfailed">That did not save, and it was this end rather than yours. The date is fine. Try it again.</p>
</div>`;
}

function wallBody(day: WallDay | null, name: string, now: number, options: WallOptions): string {
  if (day === null) return "";
  const live = options.interactive === true && takingBoosts(day, now);
  const voice = voiceOf(day);
  const onWall = day.stories.filter((s) => s.rect !== null && (s.status === "placed" || s.status === "false"));
  const pool = day.stories.filter((s) => s.status === "pool");
  const overflow = day.stories.filter((s) => s.status === "overflow");
  const tiles = onWall.map((s) => tile(s, live, voice)).join("\n");
  const empty = onWall.length === 0
    ? `<p class="wempty">Nothing on the wall yet. Stories wait in the pool until a source page has been read and found to say what the tile says.</p>`
    : "";

  const poolList = pool.length > 0
    ? `<h3 class="wsub">In the pool, not on the wall</h3>
<p class="wnote">Waiting for a source to check out${live ? `, or for the square to have room. A ${voice.one} here counts the same as one on the square` : ""}.</p>
<ul class="wlist">
${pool.map((s) => listRow(s, live, voice)).join("\n")}
</ul>`
    : "";
  const overflowList = overflow.length > 0
    ? `<h3 class="wsub">Earned a place, found no room, not on the wall</h3>
<p class="wnote">The square was full when these qualified. They keep their receipts${live ? `, and a ${voice.one} here still counts` : ""}.</p>
<ul class="wlist">
${overflow.map((s) => listRow(s, live, voice)).join("\n")}
</ul>`
    : "";

  const lede = live
    ? `${voice.imperative} the stories you think will still matter about ${escapeHtml(name)} years from now. Each ${voice.one} makes its story bigger on the square, and you get a few a day.`
    : `What people here think will still matter about ${escapeHtml(name)}. Each story is a link to a source, in the source's own words. Support decides how much of the square it takes.`;
  const receipts = ` A headline opens its receipt: every source, every quotation, every check.`;

  return `<section class="wall" aria-labelledby="wallhead">
<h2 class="section" id="wallhead">The wall for ${escapeHtml(longDate(day))}</h2>
<p class="wstate">${stateLine(day, now)}</p>
<p class="wlede">${lede}</p>
${countLine(day, now, voice)}${afterwords(voice)}
<div class="wboard" role="list" aria-label="The wall, a square of ${onWall.length} stories">
${tiles}
</div>
${empty}
<p class="wlegend"><span class="wchip w-seen_direct">Seen directly</span> ${escapeHtml(tierMeaning("seen_direct"))} <span class="wchip w-reported">Reported</span> ${escapeHtml(tierMeaning("reported"))} <span class="wchip w-claimed">Claimed</span> ${escapeHtml(tierMeaning("claimed"))} A tile's colour is its tier, and a tier is not a verdict.${receipts}</p>
${poolList}${overflowList}
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

function checkRow(c: WallCheck): string {
  const what = c.kind === "resolves" ? "Link resolves" : "Page contains the quotation";
  return `<tr><td>${escapeHtml(eastern(c.checkedAt))}</td><td>${what}</td><td>${c.passed ? "Passed" : "Failed"}</td><td>${c.httpStatus ?? ""}</td><td>${escapeHtml(c.detail ?? "")}</td></tr>`;
}

function sourceBlock(source: WallSource, index: number): string {
  const verified = source.verifiedAt === null
    ? `<p class="wnote">The quotation has not yet been found on the page.</p>`
    : `<p class="wnote">Marked as found on the page, exactly, ${escapeHtml(eastern(source.verifiedAt))}. The check history below is the evidence.</p>`;
  const history = source.checks.length === 0
    ? `<p class="wnote">No checks run yet.</p>`
    : `<div class="wscroll"><table class="wchecks">
<thead><tr><th>When</th><th>Check</th><th>Result</th><th>Status</th><th>Detail</th></tr></thead>
<tbody>
${source.checks.map(checkRow).join("\n")}
</tbody></table></div>`;
  return `<section class="wsource">
<h3 class="wsub">Source ${index + 1}: ${escapeHtml(source.outlet)}</h3>
<p><a href="${escapeHtml(source.url)}" rel="nofollow noopener">${escapeHtml(source.headline)}</a></p>
<p class="wmeta">Owned by ${escapeHtml(source.owner)}. Added ${escapeHtml(eastern(source.addedAt))}.</p>
<blockquote class="wquote">${escapeHtml(source.quotation)}</blockquote>
${verified}
<h4 class="wsub small">Check history</h4>
${history}
</section>`;
}

/**
 * The receipt. Plain and inspectable: the headline, the link, the tier and
 * what it means, every source with its quotation, and every check ever run.
 * No score, no name, nothing about who submitted or boosted it.
 */
export function storyBody(story: WallStory, day: WallDay): string {
  const { month, day: d } = parts(story.wallDate);
  const status = story.status === "placed"
    ? `On the wall, ${story.rect!.w} by ${story.rect!.h} modules at column ${story.rect!.mx}, row ${story.rect!.my}.`
    : story.status === "false"
      ? `On the wall and later shown false, ${escapeHtml(eastern(story.falseAt ?? story.submittedAt))}. It keeps its rectangle.`
      : story.status === "overflow"
        ? "Earned a place and found no room on the square. Not on the wall."
        : "In the pool. Not on the wall.";
  const falseNote = story.status === "false" && story.falseNote
    ? `<p class="wfalsenote">${escapeHtml(story.falseNote)}</p>`
    : "";
  return `<p class="wback"><a href="/${slug(month, d)}/">&larr; ${escapeHtml(monthName(month))} ${d}</a> &middot; the wall for ${escapeHtml(longDate(day))}</p>
<h1 class="wtitle">${escapeHtml(story.headline)}</h1>
<p class="wlink"><a href="${escapeHtml(story.url)}" rel="nofollow noopener">${escapeHtml(story.url)}</a></p>
<p class="wfacts">${chip(story.tier)} ${escapeHtml(tierMeaning(story.tier))} A tier is not a verdict.</p>
<p class="wfacts">${units(story.support, voiceFor(month, d)) === "" ? "Nobody has backed it yet." : `${units(story.support, voiceFor(month, d))}.`} Submitted ${escapeHtml(eastern(story.submittedAt))}.${story.placedAt ? ` Placed ${escapeHtml(eastern(story.placedAt))}.` : ""}</p>
<p class="wfacts">${status}</p>
${falseNote}
<h2 class="section">Sources</h2>
<p class="wnote">The wording on the wall is the source's, never a person's. A check confirms a link resolves and that the page contains the quotation, by exact match. Nothing here decides what is true.</p>
${story.sources.map(sourceBlock).join("\n")}`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/** Appended to the site stylesheet. Colours follow the day's own hue. */
export const WALL_STYLE = `
.wall { margin: 26px 0 0; }
.wall h2.section { margin-top: 26px; }
.wstate { margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #C9C2D4; }
.wlede { margin: 0 0 14px; color: #B9B2AD; font-size: 15px; line-height: 1.4; max-width: 58ch; text-wrap: pretty; }
.wboard {
  display: grid; grid-template-columns: repeat(16, minmax(0, 1fr)); grid-template-rows: repeat(16, minmax(0, 1fr));
  gap: 2px; width: 100%; max-width: 560px; aspect-ratio: 1 / 1; margin: 0 auto;
  padding: 2px; box-sizing: border-box; border-radius: 10px; background: #100D16;
  box-shadow: inset 0 0 0 1px rgba(255, 247, 238, .08);
}
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
.wchip {
  display: inline-block; padding: 1px 6px; border-radius: 999px; font-size: 10px; font-weight: 700;
  letter-spacing: .04em; text-transform: uppercase; vertical-align: middle;
}
.wchip.w-claimed { background: #EFE0B8; color: #2A1A08; }
.wchip.w-reported { background: #E7A83A; color: #2A1A08; }
.wchip.w-seen_direct { background: #B05A0C; color: #FFF3DC; }
.wempty, .wlegend, .wnote { font-size: 13px; color: #827B75; line-height: 1.45; }
.wlegend { margin: 10px 0 0; }
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

.wtile.tiny .wn { position: absolute; inset: 0; display: grid; place-items: center; font-size: 9px; font-weight: 700; opacity: .85; }
.wtile.small { display: flex; align-items: center; gap: 4px; padding: 2px 4px; font-size: 9px; line-height: 1.2; white-space: nowrap; overflow: hidden; }
.wtile.small .wo { opacity: .8; }
.wtile.small .wn { font-weight: 700; }
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
.wmine { display: none; font-weight: 800; color: var(--wmark, #8A3F05); font-size: clamp(8px, 1.9cqi, 11px); line-height: 1.3; flex: none; }
.wboard { container-type: inline-size; }
.wtile.mid, .wtile.big { gap: 2px; }
.wtile.mid .wh, .wtile.big .wh { font-size: clamp(10px, 2.4cqi, 14px); -webkit-line-clamp: var(--lines, 3); }
.wfoot {
  flex: none; flex-wrap: nowrap; white-space: nowrap; overflow: hidden; margin-top: 0; min-width: 0;
  font-size: clamp(8px, 1.8cqi, 11px);
}
.wfoot .wo { min-width: 0; overflow: hidden; text-overflow: ellipsis; opacity: .8; }
.wfoot .wn { flex: none; font-weight: 700; }
.wfoot .wbuzz button { font-size: clamp(8px, 1.9cqi, 11px); }
@container (min-width: 480px) { .wtile.wh3 { --lines: 4; } }
.wcount { margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #E9E1DB; }
.wsaid {
  display: none; margin: 0 0 14px; padding: 13px 15px; border-radius: 12px;
  background: #171227; border: 1px solid #2A2434; color: #E9E1DB; font-size: 14px; line-height: 1.5;
}
.wsaid:target { display: block; }
.wlist li { --wbtn: #E7A83A; --wbtn-ink: #2A1A08; --wmark: #E7A83A; --wink: #E7A83A; }
.wlist .wbuzz { margin-left: 6px; }
.wlist .wbuzz button { font-size: 12px; padding: 2px 9px; }
.wlist .wmine { margin-left: 6px; }
`;
