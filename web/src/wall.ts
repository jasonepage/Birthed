// The wall on a date page, and the receipt page for each story on it.
// docs/the-wall.md is the authority, and section 10 records the decisions
// this file was built on.
//
// Read only. Nothing here submits or boosts. The pages are baked at build
// time like every other section, from the rectangles the server side
// allocator stored, so every reader sees the same wall and the page view
// calls nothing. A date page shows the newest wall its month and day have;
// every story on every year's wall gets a receipt page under the date.

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

async function rows<T>(url: string, key: string, path: string): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const joiner = path.includes("?") ? "&" : "?";
    const response = await fetch(`${url}/rest/v1/${path}${joiner}limit=${pageSize}&offset=${offset}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
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

function units(n: number): string {
  return n === 1 ? "1 boost" : `${n} boosts`;
}

const EASTERN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric",
  hour: "numeric", minute: "2-digit", timeZoneName: "short",
});

/** A time as it reads in Eastern, because that is the clock the wall runs on. */
export function eastern(iso: string): string {
  return EASTERN.format(new Date(iso));
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

function tile(story: WallStory): string {
  const rect = story.rect!;
  const size = tileClass(rect);
  const label = `${story.headline}. ${story.outlet}. ${tierLabel(story.tier)}, ${units(story.support)}.`
    + (story.status === "false" ? " Later shown false." : "");
  const style = `grid-column:${rect.mx + 1} / span ${rect.w};grid-row:${rect.my + 1} / span ${rect.h}`;
  const stamp = story.status === "false" ? `<span class="wstamp">Shown false</span>` : "";
  const inner = size === "tiny"
    ? `<span class="wn">${story.support}</span>`
    : size === "small"
      ? `<span class="wo">${escapeHtml(story.outlet)}</span> <span class="wn">${story.support}</span>`
      : `<span class="wh">${escapeHtml(story.headline)}</span><span class="wfoot"><span class="wo">${escapeHtml(story.outlet)}</span>${chip(story.tier)}<span class="wn">${units(story.support)}</span></span>`;
  return `<a class="wtile ${size} w-${story.tier}${story.status === "false" ? " wfalse" : ""}" href="${storyPath(story)}" style="${style}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${inner}${stamp}</a>`;
}

function listRow(story: WallStory): string {
  return `<li><a href="${storyPath(story)}">${escapeHtml(story.headline)}</a> <span class="wmeta">${escapeHtml(story.outlet)} ${chip(story.tier)} ${units(story.support)}</span></li>`;
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
export function wallSection(day: WallDay | null, name: string, now: number = Date.now()): string {
  if (day === null) return "";
  const onWall = day.stories.filter((s) => s.rect !== null && (s.status === "placed" || s.status === "false"));
  const pool = day.stories.filter((s) => s.status === "pool");
  const overflow = day.stories.filter((s) => s.status === "overflow");
  const tiles = onWall.map(tile).join("\n");
  const empty = onWall.length === 0
    ? `<p class="wempty">Nothing on the wall yet. Stories wait in the pool until they have enough evidence and at least one boost.</p>`
    : "";

  const poolList = pool.length > 0
    ? `<h3 class="wsub">In the pool, not on the wall</h3>
<p class="wnote">Waiting for enough evidence and at least one boost.</p>
<ul class="wlist">
${pool.map(listRow).join("\n")}
</ul>`
    : "";
  const overflowList = overflow.length > 0
    ? `<h3 class="wsub">Earned a place, found no room, not on the wall</h3>
<p class="wnote">The square was full when these qualified. They keep their receipts.</p>
<ul class="wlist">
${overflow.map(listRow).join("\n")}
</ul>`
    : "";

  return `<section class="wall" aria-labelledby="wallhead">
<h2 class="section" id="wallhead">The wall for ${escapeHtml(longDate(day))}</h2>
<p class="wstate">${stateLine(day, now)}</p>
<p class="wlede">What people here think will still matter about ${escapeHtml(name)}. Each story is a link to a source, in the source's own words. Support decides how much of the square it takes.</p>
<div class="wboard" role="list" aria-label="The wall, a square of ${onWall.length} stories">
${tiles}
</div>
${empty}
<p class="wlegend"><span class="wchip w-seen_direct">Seen directly</span> ${escapeHtml(tierMeaning("seen_direct"))} <span class="wchip w-reported">Reported</span> ${escapeHtml(tierMeaning("reported"))} <span class="wchip w-claimed">Claimed</span> ${escapeHtml(tierMeaning("claimed"))} A tier is not a verdict.</p>
${poolList}${overflowList}
</section>`;
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
<p class="wfacts">${units(story.support)}. Submitted ${escapeHtml(eastern(story.submittedAt))}.${story.placedAt ? ` Placed ${escapeHtml(eastern(story.placedAt))}.` : ""}</p>
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
.wtile {
  position: relative; display: block; min-width: 0; min-height: 0; overflow: hidden;
  border-radius: 3px; text-decoration: none; color: #FFF7EE; box-sizing: border-box;
  background: #2A2338;
}
.wtile.w-claimed { background: #2E2740; }
.wtile.w-reported { background: var(--day, #8B5CF6); }
.wtile.w-seen_direct { background: var(--day-soft, #C4AEFF); color: #17121F; }
.wtile:hover { outline: 2px solid #FFF7EE; outline-offset: -2px; }
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
.wtile.mid .wfoot .wchip { display: none; }
.wtile.wfalse { opacity: .55; }
.wstamp {
  position: absolute; left: 0; right: 0; bottom: 0; padding: 2px 4px; font-size: 9px; font-weight: 800;
  letter-spacing: .06em; text-transform: uppercase; background: #FFF7EE; color: #2A0B15; text-align: center;
}
.wchip {
  display: inline-block; padding: 1px 6px; border-radius: 999px; font-size: 10px; font-weight: 700;
  letter-spacing: .04em; text-transform: uppercase; vertical-align: middle;
}
.wchip.w-claimed { background: #2E2740; color: #C9C2D4; }
.wchip.w-reported { background: var(--day, #8B5CF6); color: #FFF7EE; }
.wchip.w-seen_direct { background: var(--day-soft, #C4AEFF); color: #17121F; }
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
`;
