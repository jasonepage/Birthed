// Seeds the wall for a range of dates, so the pages can be looked at before
// anybody can submit or boost.
//
//   node dist/src/wall/seed.js --from 2026-08-27 --to 2026-09-10          # writes over the REST interface
//   node dist/src/wall/seed.js --from 2026-08-27 --to 2026-09-10 --sql    # prints the SQL instead
//   node dist/src/wall/seed.js ... --seed 7 --now 2026-09-09T20:00:00Z    # a different draw, a fixed clock
//
// Every story it writes is a real article from seed-stories.ts. What it
// invents is the rest: which wall date each lands on, who boosted it, how
// many units and when. It says so on every check row it writes, so the
// receipt on a seeded story page is honest about what was and was not
// checked.
//
// It is deterministic for a given --seed and --now: the same draw produces
// the same identifiers, the same boosts and the same board, so a seeded
// branch can be rebuilt exactly. Identifiers are md5 of a labelled string,
// which both this file and the SQL it prints can compute.
//
// The boosts it writes respect the rules the database enforces: a boost
// lands only from the live day on, three units a person on the date itself,
// one the day after, none before, and never on a story before it was
// submitted. The trigger checks all of that again, which is the point of the
// trigger. Then it plays the day back an hour at a time through the
// allocator, so anchors are assigned in the order stories earned them and
// tiles grow the way they would have grown, and stores the final board.

import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadConfig, loadDotEnv } from "../config.js";
import { allocate, type Rect, type StoryInput, type Tier } from "./allocator.js";
import { HOLD_MS, tierFor } from "./pool.js";
import { SEED_STORIES, type SeedStory } from "./seed-stories.js";
import { normalizeUrl } from "./url.js";

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;

/** "2026-09-09" to its parts. */
export function parseDate(text: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) throw new Error(`seed: not a date: ${text}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function addDays(text: string, days: number): string {
  const { y, m, d } = parseDate(text);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const NEW_YORK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
});

/**
 * The instant a calendar date begins in United States Eastern time, as
 * milliseconds since the epoch. Tries the two offsets Eastern has and keeps
 * the one that reads back as midnight on that date, which is what the
 * database's wall_eastern_midnight computes with its own time zone table.
 */
export function easternMidnight(text: string): number {
  const { y, m, d } = parseDate(text);
  for (const offsetHours of [4, 5]) {
    const candidate = Date.UTC(y, m - 1, d, offsetHours);
    const parts = Object.fromEntries(NEW_YORK.formatToParts(new Date(candidate)).map((p) => [p.type, p.value]));
    const hour = parts.hour === "24" ? "00" : parts.hour;
    if (Number(parts.year) === y && Number(parts.month) === m && Number(parts.day) === d && hour === "00") {
      return candidate;
    }
  }
  throw new Error(`seed: could not find Eastern midnight for ${text}`);
}

export function easternDateOf(millis: number): string {
  const parts = Object.fromEntries(NEW_YORK.formatToParts(new Date(millis)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// ---------------------------------------------------------------------------
// Deterministic draw
// ---------------------------------------------------------------------------

/** mulberry32. Small, fast, and the same everywhere. */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)]!;
}

function between(rand: () => number, from: number, to: number): number {
  return Math.floor(from + rand() * (to - from));
}

/** md5 of a labelled string, laid out as a uuid. The SQL computes the same. */
export function seedId(label: string): string {
  const hex = createHash("md5").update(label).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const STORY_LABEL = "birthed-wall-seed-story";
export const BOOSTER_LABEL = "birthed-wall-seed-booster";

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export interface PlannedSource {
  url: string;
  urlKey: string;
  outlet: string;
  owner: string;
  headline: string;
  quotation: string;
  verifiedAt: number;
}

export interface PlannedStory {
  index: number;
  id: string;
  submittedAt: number;
  headline: string;
  url: string;
  urlKey: string;
  outlet: string;
  tier: Tier;
  sources: PlannedSource[];
  /** Filled by the playback. */
  status: "pool" | "placed" | "overflow";
  placedAt: number | null;
  rect: Rect | null;
  support: number;
}

export interface PlannedBoost {
  storyIndex: number;
  boosterIndex: number;
  units: number;
  castAt: number;
}

export interface PlannedDay {
  date: string;
  opensAt: number;
  liveAt: number;
  closesAt: number;
  stories: PlannedStory[];
  /** In cast order, which is the order they must be inserted in. */
  boosts: PlannedBoost[];
  overflow: string[];
}

export interface PlanOptions {
  from: string;
  to: string;
  seed: number;
  now: number;
  /** The one date that gets a crowd, so a full mosaic can be seen. Null for none. */
  busyDate: string | null;
  stories?: SeedStory[];
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Lays out days, stories and boosts. Nothing here touches the allocator; the
 * playback does that once the boosts exist.
 */
export function plan(options: PlanOptions): PlannedDay[] {
  const rand = random(options.seed);
  const fixture = options.stories ?? SEED_STORIES;
  const confirmed = shuffled(fixture.filter((s) => s.kind !== "claimed"), rand);
  const claimed = shuffled(fixture.filter((s) => s.kind === "claimed"), rand);
  let nextConfirmed = 0;
  let nextClaimed = 0;
  const draw = (preferConfirmed: boolean): SeedStory => {
    if (preferConfirmed && confirmed.length > 0) return confirmed[nextConfirmed++ % confirmed.length]!;
    return claimed[nextClaimed++ % claimed.length]!;
  };

  const days: PlannedDay[] = [];
  let boosterCounter = 0;

  for (let date = options.from; date <= options.to; date = addDays(date, 1)) {
    const opensAt = easternMidnight(addDays(date, -1));
    const liveAt = easternMidnight(date);
    const afterAt = easternMidnight(addDays(date, 1));
    const closesAt = easternMidnight(addDays(date, 2));
    const busy = date === options.busyDate;

    // Nothing is submitted before the wall opens or after now.
    const submitUntil = Math.min(closesAt, options.now);
    if (submitUntil <= opensAt) {
      days.push({ date, opensAt, liveAt, closesAt, stories: [], boosts: [], overflow: [] });
      continue;
    }

    const count = busy ? 60 : options.now < liveAt ? 2 : between(rand, 4, 9);
    const stories: PlannedStory[] = [];
    const seen = new Set<string>();
    for (let i = 0; stories.length < count && i < count * 3; i++) {
      // Busy days lean on the confirmed stories so tiles can get big.
      const preferConfirmed = busy ? rand() < 0.45 : rand() < 0.25;
      const template = draw(preferConfirmed);
      const primary = template.sources[0]!;
      const urlKey = normalizeUrl(primary.url);
      if (seen.has(urlKey)) continue;
      seen.add(urlKey);

      // Most stories arrive on the live day, some the evening before, a few
      // the morning after.
      const roll = rand();
      let [lo, hi] = roll < 0.15
        ? [opensAt + 6 * HOUR, Math.min(liveAt, submitUntil)]
        : roll < 0.9
          ? [liveAt, Math.min(afterAt, submitUntil)]
          : [afterAt, submitUntil];
      // A window the clock has not reached yet collapses to what is open.
      if (hi <= lo) [lo, hi] = [opensAt, submitUntil];
      const submittedAt = between(rand, lo, hi);
      if (submittedAt >= submitUntil || submittedAt < opensAt) continue;

      const sources: PlannedSource[] = template.sources.map((source, j) => ({
        url: source.url,
        urlKey: normalizeUrl(source.url),
        outlet: source.outlet,
        owner: source.owner,
        headline: source.headline,
        quotation: source.quotation,
        // The first source is checked within minutes; a second arrives a
        // little later, as a second person would have added it.
        verifiedAt: submittedAt + (j === 0 ? between(rand, 2, 9) : between(rand, 20, 240)) * 60 * 1000,
      }));

      stories.push({
        index: stories.length,
        id: seedId(`${STORY_LABEL}:${date}:${stories.length}`),
        submittedAt,
        headline: primary.headline,
        url: primary.url,
        urlKey,
        outlet: primary.outlet,
        tier: tierFor(sources.map((s) => ({ owner: s.owner, verified: true })), template.kind === "seen_direct"),
        sources,
        status: "pool",
        placedAt: null,
        rect: null,
        support: 0,
      });
    }

    // Each story has a pull. A few are what everybody backs, most get a
    // unit or two, and some get nothing and stay in the pool.
    // On the busy day the confirmed stories carry most of the weight, which
    // is what it takes for a board to fill: a claimed tile stops at four
    // modules however loud it gets.
    const pull = stories.map((s) => (Math.pow(rand(), 2.2) * 10 + 0.05) * (busy && s.tier !== "claimed" ? 4 : 1));
    const choose = (at: number): number | null => {
      const open = stories.map((s, i) => (s.submittedAt <= at ? i : -1)).filter((i) => i >= 0);
      if (open.length === 0) return null;
      const total = open.reduce((sum, i) => sum + pull[i]!, 0);
      let r = rand() * total;
      for (const i of open) {
        r -= pull[i]!;
        if (r <= 0) return i;
      }
      return open[open.length - 1]!;
    };

    const boosts: PlannedBoost[] = [];
    const boosters = busy ? 400 : options.now < liveAt ? 0 : between(rand, 10, 45);
    const liveUntil = Math.min(afterAt, options.now);
    const afterUntil = Math.min(closesAt, options.now);

    for (let b = 0; b < boosters; b++) {
      const boosterIndex = boosterCounter++;
      if (liveUntil > liveAt) {
        // Three units on the day itself, split one of four ways.
        const split = pick([[3], [3], [2, 1], [1, 1, 1], [1], [2]], rand);
        for (const units of split) {
          const castAt = between(rand, liveAt, liveUntil);
          const story = choose(castAt);
          if (story === null) continue;
          boosts.push({ storyIndex: story, boosterIndex, units, castAt });
        }
      }
      if (afterUntil > afterAt && rand() < 0.5) {
        const castAt = between(rand, afterAt, afterUntil);
        const story = choose(castAt);
        if (story !== null) boosts.push({ storyIndex: story, boosterIndex, units: 1, castAt });
      }
    }
    boosts.sort((a, b) => a.castAt - b.castAt || a.boosterIndex - b.boosterIndex);

    days.push({ date, opensAt, liveAt, closesAt, stories, boosts, overflow: [] });
  }

  return days;
}

// ---------------------------------------------------------------------------
// Playback through the allocator
// ---------------------------------------------------------------------------

/** When a story has enough evidence: two owners verified, or the hold passed. */
function evidenceAt(story: PlannedStory): number {
  const byOwner = new Map<string, number>();
  for (const source of story.sources) {
    const owner = source.owner.trim().toLowerCase();
    byOwner.set(owner, Math.min(byOwner.get(owner) ?? Infinity, source.verifiedAt));
  }
  const times = [...byOwner.values()].sort((a, b) => a - b);
  const second = times[1];
  const held = story.submittedAt + HOLD_MS;
  return second === undefined ? held : Math.min(second, held);
}

/**
 * Runs the day forward an hour at a time. At each tick every story that has
 * earned a place is handed to the allocator with the support it had by
 * then. Since the pie, docs/the-wall.md section 18, the allocator cuts the
 * whole board afresh each tick: a story that is placed takes the rectangle
 * it was cut, and one that is not gives its rectangle up. The last tick is
 * the board.
 */
export function playback(day: PlannedDay, now: number): void {
  const end = Math.min(day.closesAt, now);
  const firstBoost = new Map<number, number>();
  for (const boost of day.boosts) {
    if (!firstBoost.has(boost.storyIndex)) firstBoost.set(boost.storyIndex, boost.castAt);
  }
  const eligibleAt = new Map<number, number>();
  for (const story of day.stories) {
    const first = firstBoost.get(story.index);
    if (first === undefined) continue;
    eligibleAt.set(story.index, Math.max(first, evidenceAt(story)));
  }

  let overflow: string[] = [];
  for (let tick = day.liveAt; tick <= end + HOUR; tick += HOUR) {
    const at = Math.min(tick, end);
    const input: StoryInput[] = [];
    for (const story of day.stories) {
      const since = eligibleAt.get(story.index);
      if (since === undefined || since > at) continue;
      const support = day.boosts
        .filter((b) => b.storyIndex === story.index && b.castAt <= at)
        .reduce((sum, b) => sum + b.units, 0);
      if (story.placedAt === null) story.placedAt = since;
      input.push({ id: story.id, tier: story.tier, support, placedAt: since, anchor: story.rect });
    }
    const result = allocate(input);
    const onBoard = new Set(result.placed.map((p) => p.id));
    for (const story of day.stories) {
      if (!onBoard.has(story.id)) story.rect = null;
    }
    for (const placed of result.placed) {
      const story = day.stories.find((s) => s.id === placed.id)!;
      story.rect = { mx: placed.mx, my: placed.my, w: placed.w, h: placed.h };
    }
    overflow = result.overflow;
    if (at >= end) break;
  }

  for (const story of day.stories) {
    story.support = day.boosts.filter((b) => b.storyIndex === story.index).reduce((sum, b) => sum + b.units, 0);
    if (story.rect !== null) story.status = "placed";
    else if (overflow.includes(story.id)) story.status = "overflow";
    else {
      story.status = "pool";
      story.placedAt = null;
    }
  }
  day.overflow = overflow;
}

// ---------------------------------------------------------------------------
// Writing: SQL
// ---------------------------------------------------------------------------

const CHECK_RESOLVES = "seeded: the address is the outlet's own, taken from its feed; the page was not fetched by the seed";
const CHECK_QUOTATION = "seeded: the quotation is the outlet's own wording from its feed; the page was not fetched by the seed";

function iso(millis: number): string {
  return new Date(millis).toISOString();
}

function dollar(text: string): string {
  if (text.includes("$j$")) throw new Error("seed: text contains the quoting tag");
  return `$j$${text}$j$`;
}

/** One transaction per day, so a failure leaves whole days rather than halves. */
export function toSql(day: PlannedDay): string {
  const d = day.date;
  const storyRows = day.stories.map((s) => ({
    i: s.index, at: iso(s.submittedAt), h: s.headline, u: s.url, k: s.urlKey, o: s.outlet, t: s.tier,
  }));
  const sourceRows = day.stories.flatMap((s) => s.sources.map((src, j) => ({
    i: s.index, j, u: src.url, k: src.urlKey, o: src.outlet, w: src.owner, h: src.headline, q: src.quotation, v: iso(src.verifiedAt),
  })));
  const boostRows = day.boosts.map((b) => [b.storyIndex, b.boosterIndex, b.units, iso(b.castAt)]);
  const placedRows = day.stories
    .filter((s) => s.status !== "pool")
    .map((s) => ({ i: s.index, st: s.status, p: s.placedAt === null ? null : iso(s.placedAt), r: s.rect }));
  const board = {
    tiles: day.stories.filter((s) => s.rect !== null).map((s) => ({
      story_id: s.id, mx: s.rect!.mx, my: s.rect!.my, w: s.rect!.w, h: s.rect!.h, support: s.support, tier: s.tier,
    })),
    overflow: day.overflow,
  };

  const lines: string[] = [];
  lines.push("begin;");
  lines.push(`insert into wall_days (wall_date, opens_at, live_at, closes_at) values ('${d}', now(), now(), now()) on conflict (wall_date) do nothing;`);
  if (storyRows.length > 0) {
    lines.push(`insert into wall_stories (id, wall_date, submitted_at, headline, url, url_key, outlet, tier, status)
select md5('${STORY_LABEL}:${d}:' || (e->>'i'))::uuid, '${d}', (e->>'at')::timestamptz, e->>'h', e->>'u', e->>'k', e->>'o', (e->>'t')::wall_evidence_tier, 'pool'
from jsonb_array_elements(${dollar(JSON.stringify(storyRows))}::jsonb) e;`);
    lines.push(`insert into wall_sources (story_id, url, url_key, outlet, owner, headline, quotation, verified_at, added_at)
select md5('${STORY_LABEL}:${d}:' || (e->>'i'))::uuid, e->>'u', e->>'k', e->>'o', e->>'w', e->>'h', e->>'q', (e->>'v')::timestamptz, (e->>'v')::timestamptz - interval '3 minutes'
from jsonb_array_elements(${dollar(JSON.stringify(sourceRows))}::jsonb) e;`);
    lines.push(`insert into wall_checks (source_id, checked_at, kind, passed, http_status, detail)
select s.id, s.verified_at - interval '1 minute', 'resolves', true, 200, ${dollar(CHECK_RESOLVES)}
from wall_sources s join wall_stories st on st.id = s.story_id where st.wall_date = '${d}'
union all
select s.id, s.verified_at, 'quotation', true, 200, ${dollar(CHECK_QUOTATION)}
from wall_sources s join wall_stories st on st.id = s.story_id where st.wall_date = '${d}';`);
  }
  if (boostRows.length > 0) {
    lines.push(`insert into wall_boosts (story_id, booster_id, wall_date, units, cast_at, tier_at_cast, support_before)
select md5('${STORY_LABEL}:${d}:' || (e->>0))::uuid, md5('${BOOSTER_LABEL}:' || (e->>1))::uuid, '${d}', (e->>2)::smallint, (e->>3)::timestamptz, 'claimed', 0
from jsonb_array_elements(${dollar(JSON.stringify(boostRows))}::jsonb) with ordinality as t(e, n) order by n;`);
  }
  if (placedRows.length > 0) {
    lines.push(`update wall_stories s set
  status = (e->>'st')::wall_story_status,
  placed_at = (e->>'p')::timestamptz,
  anchor_mx = (e->'r'->>'mx')::smallint, anchor_my = (e->'r'->>'my')::smallint,
  w_modules = (e->'r'->>'w')::smallint, h_modules = (e->'r'->>'h')::smallint
from jsonb_array_elements(${dollar(JSON.stringify(placedRows))}::jsonb) e
where s.id = md5('${STORY_LABEL}:${d}:' || (e->>'i'))::uuid;`);
  }
  lines.push(`insert into wall_snapshots (wall_date, taken_at, reason, board) values ('${d}', now(), 'seed', ${dollar(JSON.stringify(board))}::jsonb);`);
  lines.push("commit;");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Writing: REST
// ---------------------------------------------------------------------------

async function post(
  url: string, key: string, table: string, rows: unknown[], extra: Record<string, string> = {},
): Promise<void> {
  if (rows.length === 0) return;
  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...extra,
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    throw new Error(`seed: ${table} insert failed with ${response.status}. ${(await response.text()).slice(0, 400)}`);
  }
}

async function patch(url: string, key: string, table: string, id: string, body: unknown): Promise<void> {
  const response = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`seed: ${table} update failed with ${response.status}. ${(await response.text()).slice(0, 400)}`);
  }
}

async function get<T>(url: string, key: string, path: string): Promise<T> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`seed: read failed with ${response.status}`);
  return (await response.json()) as T;
}

export async function writeDay(day: PlannedDay, url: string, key: string): Promise<void> {
  const d = day.date;
  // The trigger fills the window; the values sent are placeholders it replaces.
  await post(url, key, "wall_days", [{ wall_date: d, opens_at: iso(day.opensAt), live_at: iso(day.liveAt), closes_at: iso(day.closesAt) }],
    { Prefer: "return=minimal,resolution=ignore-duplicates" });

  await post(url, key, "wall_stories", day.stories.map((s) => ({
    id: s.id, wall_date: d, submitted_at: iso(s.submittedAt), headline: s.headline, url: s.url,
    url_key: s.urlKey, outlet: s.outlet, tier: s.tier, status: "pool",
  })));

  const sourceRows = day.stories.flatMap((s) => s.sources.map((src) => ({
    id: seedId(`${STORY_LABEL}:${d}:${s.index}:source:${src.urlKey}`),
    story_id: s.id, url: src.url, url_key: src.urlKey, outlet: src.outlet, owner: src.owner,
    headline: src.headline, quotation: src.quotation, verified_at: iso(src.verifiedAt), added_at: iso(src.verifiedAt - 3 * 60 * 1000),
  })));
  await post(url, key, "wall_sources", sourceRows);

  await post(url, key, "wall_checks", sourceRows.flatMap((src) => [
    { source_id: src.id, checked_at: iso(Date.parse(src.verified_at) - 60 * 1000), kind: "resolves", passed: true, http_status: 200, detail: CHECK_RESOLVES },
    { source_id: src.id, checked_at: src.verified_at, kind: "quotation", passed: true, http_status: 200, detail: CHECK_QUOTATION },
  ]));

  // One row at a time, in cast order, because the trigger reads the story's
  // support at the moment of each insert and the order is the record.
  for (const boost of day.boosts) {
    await post(url, key, "wall_boosts", [{
      story_id: day.stories[boost.storyIndex]!.id,
      booster_id: seedId(`${BOOSTER_LABEL}:${boost.boosterIndex}`),
      wall_date: d, units: boost.units, cast_at: iso(boost.castAt),
      tier_at_cast: "claimed", support_before: 0,
    }]);
  }

  for (const story of day.stories) {
    if (story.status === "pool") continue;
    await patch(url, key, "wall_stories", story.id, {
      status: story.status,
      placed_at: story.placedAt === null ? null : iso(story.placedAt),
      anchor_mx: story.rect?.mx ?? null, anchor_my: story.rect?.my ?? null,
      w_modules: story.rect?.w ?? null, h_modules: story.rect?.h ?? null,
    });
  }

  const stored = await get<Array<{ id: string; support: number }>>(url, key, `wall_stories?select=id,support&wall_date=eq.${d}`);
  const support = new Map(stored.map((row) => [row.id, row.support]));
  await post(url, key, "wall_snapshots", [{
    wall_date: d, reason: "seed",
    board: {
      tiles: day.stories.filter((s) => s.rect !== null).map((s) => ({
        story_id: s.id, mx: s.rect!.mx, my: s.rect!.my, w: s.rect!.w, h: s.rect!.h,
        support: support.get(s.id) ?? s.support, tier: s.tier,
      })),
      overflow: day.overflow,
    },
  }]);
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

function argument(args: string[], name: string): string | undefined {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
}

export function summarise(day: PlannedDay): string {
  const placed = day.stories.filter((s) => s.status === "placed").length;
  const pool = day.stories.filter((s) => s.status === "pool").length;
  const units = day.boosts.reduce((sum, b) => sum + b.units, 0);
  const modules = day.stories.reduce((sum, s) => sum + (s.rect ? s.rect.w * s.rect.h : 0), 0);
  return `${day.date}: ${day.stories.length} stories, ${placed} placed, ${pool} in the pool, ${day.overflow.length} overflow, `
    + `${day.boosts.length} boosts for ${units} units, ${modules} of 256 modules`;
}

async function main(): Promise<void> {
  await loadDotEnv();
  const args = process.argv.slice(2);
  const sql = args.includes("--sql");
  const nowText = argument(args, "now");
  const now = nowText ? Date.parse(nowText) : Date.now();
  const to = argument(args, "to") ?? easternDateOf(now);
  const from = argument(args, "from") ?? addDays(to, -13);
  const seed = Number(argument(args, "seed") ?? "2026");
  const busyDate = argument(args, "busy") ?? addDays(easternDateOf(now), -4);

  const days = plan({ from, to, seed, now, busyDate });
  for (const day of days) playback(day, now);

  if (sql) {
    for (const day of days) {
      console.log(`-- ${summarise(day)}`);
      console.log(toSql(day));
      console.log();
    }
    return;
  }

  const config = loadConfig({ needsWrite: true });
  for (const day of days) {
    await writeDay(day, config.supabaseUrl, config.serviceRoleKey);
    console.log(summarise(day));
  }
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
