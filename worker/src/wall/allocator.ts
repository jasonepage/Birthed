// The placement engine for the wall. docs/the-wall.md section 5, section 13
// for what the third build session changed here, and section 18 for the pie,
// decided by Nathan on September 11, 2026, which is what `allocate` cuts now.
//
// The pie, in one paragraph. The stories that earn a place are chosen as
// before: backed first, then by the panel's points under the variety caps,
// twelve at most, eight at most unbacked. Each gets the minimum twelve
// modules plus its share of the rest of the 256, by its share of the date's
// buzzes, or by points when nobody has buzzed yet, rounded so the areas sum
// to the board. The tiles are then laid in horizontal bands across the full
// width, biggest first, at most four to a band and at most five bands, so
// the board is always full and a buzz visibly moves the picture. A tile can
// shrink, and a tile can lose its place to a story somebody backed later:
// both promises were withdrawn in section 18, in writing, before this was.
//
// Everything below the pie, `allocateByGrowth` and its helpers, is the older
// engine. It still runs for a date carrying a story stamped false, because
// that story keeps its exact rectangle and a pie with a hole in it was not
// designed; section 18 names it open.
//
// The board is a square, 256 by 256 pixels, divided into 16 pixel modules, so
// 16 by 16 modules. Coordinates are zero indexed with the origin top left.
//
// This runs server side only, because anchors are stored and must be
// authoritative: a client that computed its own would draw a different wall
// from the one that is being frozen. It is a pure function. Same inputs, same
// output, always. It reads no clock, no random source and no database, and
// it takes the current time as a parameter only through the placement time
// each story already carries.
//
// The rules, in order:
//
//   A tile is placed once, may grow, and may never shrink or give up a module
//   it holds. Its stored rectangle is the top left corner and a size, and
//   growing up or left moves that corner outward: the new rectangle always
//   contains the old one whole. Pixels are stored in board coordinates, not
//   tile coordinates, so a corner moving outward changes nothing anybody drew.
//   A tile is never smaller than a headline needs: four modules wide and
//   three tall, twelve modules, decided September 10, 2026. One module could
//   hold a number and nothing else, and a wall of numbered squares
//   communicates nothing.
//   The board holds at most MAX_PLACED tiles. Twelve tiles of twelve modules
//   leave nearly half the square for growth, and twelve headlines is what a
//   person reads; seventy small ones is what nobody does. What qualifies and
//   does not fit is overflow and stays in the list under the board.
//   Of those, at most UNBACKED_PLACED may be stories nobody has backed. The
//   news seeder qualifies forty stories at once on an ordinary day, and a
//   board they filled at the first tick could never be joined by anything a
//   person later chose, because tiles never shrink and nothing is deleted.
//   So the seeded news fills eight tiles, four wait for stories people back,
//   and a tap on a tile with no support makes room for one more from the
//   feeds. The wall still opens carrying the day's news, section 11; it no
//   longer opens finished.
//   New stories are laid down after every story already holding a rectangle,
//   most supported first, then by score, then by priority, then by placement
//   time, then id, so a story people backed reaches the board before one
//   nobody has, the history people look up on the date opens the board ahead
//   of the history nobody does, the date's own history opens it ahead of the
//   news feeds, and the first to arrive wins among equals. The score is the
//   curation panel's points for a history row, worker/src/wall/points.ts,
//   decided September 11, 2026: with four coarse priorities a hundred and
//   sixty four history stories tied at one and the board among them was a
//   lottery, which the 2001 attacks lost to the theft of the Hope Diamond. A new story takes the free minimum rectangle whose
//   centre is nearest the board centre, ranked by distance, then clockwise
//   angle from straight up, then mx, then my.
//   Target size is min(tier ceiling, MIN_MODULES + floor(support /
//   UNITS_PER_MODULE)). One unit per module, so a first tap moves the target
//   and the board answers the first person who touches it.
//   Growth adds one whole free column, to the right or to the left, or one
//   whole free row, below or above, preferring width while w is at most h
//   times 1.5, right before left and down before up. A step that does not
//   overshoot the target is taken first; when every fitting step would
//   overshoot, the preferred one is taken anyway, because with a minimum of
//   four by three there is no one module step and a target one module past
//   the tile could otherwise never be reached. A tile grows not at all when
//   every side is blocked.
//   A claimed tile is capped at 24 modules and a confirmed one at 48.
//   A story with no free room comes back as overflow rather than throwing.

export const BOARD_MODULES = 16;
export const MODULE_PX = 16;
export const BOARD_PX = BOARD_MODULES * MODULE_PX;

/**
 * The smallest tile: a picture. docs/the-wall.md section 27.
 *
 * It was four by three until September 22, 2026, because that is what a
 * headline needs, and that one number was why the board held eleven tiles
 * out of a pool of 744. A cover or a face reads at forty pixels and a
 * sentence does not, so the floor is what a picture needs instead: two
 * modules by two, which is 80 by 80 on a 645 pixel board and 45 by 45 on a
 * phone. The words move to the tiles that have room for them and to the
 * receipt.
 */
export const MIN_W = 2;
export const MIN_H = 2;
export const MIN_MODULES = MIN_W * MIN_H;

/**
 * The most tiles the board holds. What qualifies beyond this is overflow.
 *
 * Sixty, not twelve. The board is 256 modules and the floor is four, so the
 * hard ceiling is sixty four; sixty leaves the allocator room to give the
 * buzzed tiles their share without the last few stories fighting for single
 * squares. A mural is the point.
 */
export const MAX_PLACED = 60;

/**
 * The most tiles that may hold a story with no support. The rest of the
 * board waits for stories somebody backed, so a story people chose can
 * always reach it while the day is young, whatever the feeds put there first.
 *
 * **This was the number that starved the board, not MAX_PLACED.** On
 * September 21, 2026 the hive drew eleven tiles from a pool of 744: eight
 * unbacked plus the three somebody had buzzed. Eight was right for a board
 * that held twelve tiles of four by three. On a board of sixty two by twos
 * it is the whole mural, refused. docs/the-wall.md section 27.
 *
 * Forty. The reason for holding any back is unchanged and still good: the
 * feeds qualify forty stories at the first tick, tiles never shrink, and a
 * board the seeder filled could never be joined by anything a person later
 * chose.
 *
 * Forty rather than forty eight because of the square rather than the rule.
 * Forty eight minimum tiles hold 192 of the board's 256 modules and leave
 * the rest in fragments, and a backed story needs six modules in one piece:
 * the test that puts five of them on a seeded board could place one. Forty
 * leaves ninety six modules, and all five land.
 */
export const UNBACKED_PLACED = 40;

/**
 * Variety among the tiles nobody has backed yet. docs/the-wall.md section 15.
 *
 * The first board a person ever saw was ten headlines of which three came
 * from one video game site, and every one of them was from today rather than
 * from the date. Both of those are the same failure: the order alone decides
 * the board, and an order with no variety in it produces a board with no
 * variety on it.
 *
 * These are caps on the unbacked tiles only, and they are advisory. A story
 * anybody has backed is never held off the board by them, because one buzz
 * beats every rule here, and if the caps cannot fill the board the leftover
 * slots are filled in plain order rather than left empty. A varied board is
 * worth something; an empty one is not.
 */
/** How many unbacked tiles may be the day's news rather than the date's own history. */
export const NEWS_UNBACKED = 8;
/** How many unbacked tiles any one outlet may hold. The date's history is exempt: every event shares one encyclopedia and that says nothing about variety. */
export const PER_OUTLET_UNBACKED = 3;
/** How many unbacked tiles any one kind of history may hold, so a board is not forty birthdays. */
export const PER_KIND_UNBACKED = 10;

/**
 * The groups the unbacked tiles are dealt to, and each group's share of the
 * forty eight. Nathan, September 11, 2026: music, films, games, birthdays
 * and television should reach the hive more often. The shares kept that
 * shape when the board grew on September 22, 2026, section 27, because the
 * shape was the right one and only the board was too small for it: eight
 * news, ten events, ten people, ten releases and two of whatever is left,
 * where a release is a number one song, album or film, or a row from the
 * culture table (a game, a patch, a meme, a show).
 *
 * News is the one held below the others on purpose. It is the group with
 * hundreds of rows a day and the only one that is not about the date, so
 * left to its own weight it would be the mural.
 *
 * What the quotas cannot fill, the fill hands to the thinnest group, so a
 * date with no releases still fills its board.
 */
export type TileGroup = "news" | "event" | "person" | "release" | "other";
export const GROUP_QUOTA: Readonly<Record<TileGroup, number>> = { news: NEWS_UNBACKED, event: PER_KIND_UNBACKED, person: PER_KIND_UNBACKED, release: 10, other: 2 };

export function groupOf(story: Pick<StoryInput, "subjectKind">): TileGroup {
  const kind = story.subjectKind ?? null;
  if (kind === null) return "news";
  if (kind === "historical_event") return "event";
  if (kind === "person") return "person";
  if (kind === "song" || kind === "album" || kind === "film" || kind === "cultural_event") return "release";
  return "other";
}

/**
 * Boost units per module of target area, above the minimum. One, because on
 * the web a tap is one unit and the board has to answer a single tap: at
 * five, the number set when a boost could be worth three units, five taps
 * earned one module and nobody ever saw the wall respond to anything they
 * did. At one the first tap moves the target past the minimum, the tile
 * takes its first whole column, and a handful of taps is plainly visible.
 */
export const UNITS_PER_MODULE = 1;

/**
 * The most modules a story may hold, however much support it has.
 *
 * Absolute numbers since September 22, 2026, not multiples of the minimum.
 * They were written as twice and four times a twelve module floor, and read
 * that way against the new four module floor they would shrink the biggest
 * tile on the board to a quarter of what it was, which is the opposite of
 * what section 27 is for: the tiles people buzzed should tower over the
 * field, not join it.
 */
export const CLAIMED_CEILING = 24;
export const CONFIRMED_CEILING = 48;

/** Width may keep growing while it is at most this many times the height. */
export const WIDTH_PREFERENCE = 1.5;

const CENTRE = (BOARD_MODULES - 1) / 2; // 7.5

export type Tier = "claimed" | "reported" | "seen_direct";

export interface Rect {
  mx: number;
  my: number;
  w: number;
  h: number;
}

export interface StoryInput {
  id: string;
  tier: Tier;
  /** Boost units so far. */
  support: number;
  /**
   * The curation panel's points for the row this story stands for, when it
   * has any: how many people look the thing up on its date every year, how
   * many look it up at all, how recent it is, whether Wikipedia picked it,
   * whether somebody wrote a line. Decides the order among stories with
   * equal support, ahead of priority. A story with no score, the news and
   * for now everything that is not a Wikipedia history row, sorts as nought
   * and falls through to priority. Beaten by a single unit of support.
   */
  score?: number;
  /**
   * Order among stories with equal support and equal score when the board
   * has room: the date's biggest history first, then people, then the rest,
   * then the news feeds. docs/the-wall.md section 13. Beaten by a single
   * unit of support.
   */
  priority?: number;
  /**
   * When the story earned its place, as milliseconds since the epoch or an
   * ISO string. Decides the order stories are considered in. For a story
   * already on the board it is the stored placed_at; for a new one it is the
   * moment it became eligible.
   */
  placedAt: number | string;
  /** The stored rectangle, when the story is already on the board. */
  anchor?: Rect | null;
  /**
   * Laid down at its rectangle and grown by nothing, whatever its support
   * or the minimum. A story stamped false keeps its exact rectangle, docs/the-wall.md
   * section 5, and the minimum tile size must not quietly enlarge it.
   */
  frozen?: boolean;
  /**
   * The imported row this story stands for, or null for the day's news.
   * Read by the variety pass and by nothing else here.
   */
  subjectKind?: string | null;
  /** The outlet, for the variety pass. A missing one is its own outlet. */
  outlet?: string;
}

export interface Placement extends Rect {
  id: string;
}

export interface Allocation {
  placed: Placement[];
  /** Stories that earned a place and found no free room, or found the board full. */
  overflow: string[];
}

export function tierCeiling(tier: Tier): number {
  return tier === "claimed" ? CLAIMED_CEILING : CONFIRMED_CEILING;
}

/** min(tier ceiling, MIN_MODULES + floor(support / UNITS_PER_MODULE)), in modules of area. */
export function targetModules(tier: Tier, support: number): number {
  const earned = Math.floor(Math.max(0, support) / UNITS_PER_MODULE);
  return Math.min(tierCeiling(tier), MIN_MODULES + earned);
}

function toMillis(value: number | string): number {
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(`allocator: unreadable placement time ${value}`);
  return parsed;
}

/**
 * Clockwise angle from straight up, in radians in [0, 2π). Straight up is
 * negative y because the origin is top left.
 */
function clockwiseFromUp(dx: number, dy: number): number {
  const angle = Math.atan2(dx, -dy);
  return angle < 0 ? angle + Math.PI * 2 : angle;
}

// Distances are compared with a tolerance because hypot of symmetric offsets
// can differ in the last bit, and a last bit deciding which module is nearer
// would make the order depend on floating point rather than on the rule.
const close = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

/**
 * Every module on the board in order of distance from the centre point,
 * nearest first, ties broken clockwise from straight up, then by mx, then
 * my. Kept for the tests and for anything that reasons about single
 * modules; new stories are placed by anchorOrder below.
 */
export function moduleOrder(): Array<{ mx: number; my: number }> {
  const all: Array<{ mx: number; my: number; distance: number; angle: number }> = [];
  for (let my = 0; my < BOARD_MODULES; my++) {
    for (let mx = 0; mx < BOARD_MODULES; mx++) {
      const dx = mx - CENTRE;
      const dy = my - CENTRE;
      all.push({ mx, my, distance: Math.hypot(dx, dy), angle: clockwiseFromUp(dx, dy) });
    }
  }
  all.sort((a, b) => {
    if (!close(a.distance, b.distance)) return a.distance - b.distance;
    if (!close(a.angle, b.angle)) return a.angle - b.angle;
    if (a.mx !== b.mx) return a.mx - b.mx;
    return a.my - b.my;
  });
  return all.map(({ mx, my }) => ({ mx, my }));
}

/**
 * Every place a minimum rectangle can sit, in the order a new story tries
 * them: the rectangle whose own centre is nearest the board centre first,
 * ties broken clockwise from straight up, then by mx, then my. Computed once
 * per call because it depends on nothing.
 */
export function anchorOrder(): Array<{ mx: number; my: number }> {
  const all: Array<{ mx: number; my: number; distance: number; angle: number }> = [];
  for (let my = 0; my + MIN_H <= BOARD_MODULES; my++) {
    for (let mx = 0; mx + MIN_W <= BOARD_MODULES; mx++) {
      // The centre of the rectangle against the centre of the board, both in
      // module units measured from the board's top left edge.
      const dx = mx + MIN_W / 2 - BOARD_MODULES / 2;
      const dy = my + MIN_H / 2 - BOARD_MODULES / 2;
      all.push({ mx, my, distance: Math.hypot(dx, dy), angle: clockwiseFromUp(dx, dy) });
    }
  }
  all.sort((a, b) => {
    if (!close(a.distance, b.distance)) return a.distance - b.distance;
    if (!close(a.angle, b.angle)) return a.angle - b.angle;
    if (a.mx !== b.mx) return a.mx - b.mx;
    return a.my - b.my;
  });
  return all.map(({ mx, my }) => ({ mx, my }));
}

class Board {
  private readonly taken: boolean[] = new Array(BOARD_MODULES * BOARD_MODULES).fill(false);

  isFree(mx: number, my: number): boolean {
    if (mx < 0 || my < 0 || mx >= BOARD_MODULES || my >= BOARD_MODULES) return false;
    return !this.taken[my * BOARD_MODULES + mx];
  }

  rectFree(rect: Rect): boolean {
    for (let y = rect.my; y < rect.my + rect.h; y++) {
      for (let x = rect.mx; x < rect.mx + rect.w; x++) {
        if (!this.isFree(x, y)) return false;
      }
    }
    return true;
  }

  take(rect: Rect): void {
    for (let y = rect.my; y < rect.my + rect.h; y++) {
      for (let x = rect.mx; x < rect.mx + rect.w; x++) {
        this.taken[y * BOARD_MODULES + x] = true;
      }
    }
  }

  columnFree(mx: number, my: number, h: number): boolean {
    for (let y = my; y < my + h; y++) if (!this.isFree(mx, y)) return false;
    return true;
  }

  rowFree(mx: number, my: number, w: number): boolean {
    for (let x = mx; x < mx + w; x++) if (!this.isFree(x, my)) return false;
    return true;
  }
}

interface Step {
  fits: boolean;
  overshoots: boolean;
  apply: () => Rect;
  take: () => void;
}

/**
 * Grows one tile toward its target area, one whole column or row at a time,
 * and returns the rectangle it ended with.
 *
 * Four directions. A column can be added on the right or on the left, a row
 * below or above. The rectangle that comes back always contains the one that
 * went in, so a tile never shrinks and never gives up ground; only its top
 * left corner may move outward.
 *
 * A step that lands on or under the target is taken before one that
 * overshoots it, so a tile of six modules with a target of eight still adds
 * the row that makes eight rather than the column that makes nine. When
 * every fitting step overshoots, the preferred one is taken: a four by three
 * tile with a target of thirteen has no step of one module, and a rule that
 * refused every step would leave the first tap invisible, which is the exact
 * thing the retune of September 10, 2026 exists to prevent.
 */
function grow(board: Board, rect: Rect, target: number): Rect {
  let current = { ...rect };
  for (;;) {
    const area = current.w * current.h;
    if (area >= target) return current;

    const preferWidth = current.w <= current.h * WIDTH_PREFERENCE;
    const wider = current.w + 1 <= BOARD_MODULES;
    const taller = current.h + 1 <= BOARD_MODULES;
    const widerOvershoots = (current.w + 1) * current.h > target;
    const tallerOvershoots = current.w * (current.h + 1) > target;

    const right: Step = {
      fits: wider && board.columnFree(current.mx + current.w, current.my, current.h),
      overshoots: widerOvershoots,
      apply: (): Rect => ({ ...current, w: current.w + 1 }),
      take: (): void => board.take({ mx: current.mx + current.w, my: current.my, w: 1, h: current.h }),
    };
    const left: Step = {
      fits: wider && board.columnFree(current.mx - 1, current.my, current.h),
      overshoots: widerOvershoots,
      apply: (): Rect => ({ ...current, mx: current.mx - 1, w: current.w + 1 }),
      take: (): void => board.take({ mx: current.mx - 1, my: current.my, w: 1, h: current.h }),
    };
    const down: Step = {
      fits: taller && board.rowFree(current.mx, current.my + current.h, current.w),
      overshoots: tallerOvershoots,
      apply: (): Rect => ({ ...current, h: current.h + 1 }),
      take: (): void => board.take({ mx: current.mx, my: current.my + current.h, w: current.w, h: 1 }),
    };
    const up: Step = {
      fits: taller && board.rowFree(current.mx, current.my - 1, current.w),
      overshoots: tallerOvershoots,
      apply: (): Rect => ({ ...current, my: current.my - 1, h: current.h + 1 }),
      take: (): void => board.take({ mx: current.mx, my: current.my - 1, w: current.w, h: 1 }),
    };

    const order = preferWidth ? [right, left, down, up] : [down, up, right, left];
    const step = order.find((candidate) => candidate.fits && !candidate.overshoots)
      ?? order.find((candidate) => candidate.fits);
    if (step === undefined) return current;
    step.take();
    current = step.apply();
  }
}

/** True when `outer` holds every module of `inner`. */
export function contains(outer: Rect, inner: Rect): boolean {
  return outer.mx <= inner.mx && outer.my <= inner.my
    && outer.mx + outer.w >= inner.mx + inner.w && outer.my + outer.h >= inner.my + inner.h;
}

/**
 * The unbacked stories, reordered so the tiles they take are varied.
 *
 * Two passes. The first walks the list in the order support and priority
 * already put it in and takes a story only while it breaches none of the
 * caps. The second walks whatever is left and fills any slot the first pass
 * did not, caps ignored, because a varied board is worth something and an
 * empty one is not. Everything else follows in its original order, so the
 * overflow list is the same shape it always was.
 *
 * Pure, and it decides order rather than placement: a story this moves down
 * is not refused, it is considered later, and on a quiet date it still lands.
 */
export function varied(unbacked: StoryInput[], limit: number): StoryInput[] {
  if (limit <= 0 || unbacked.length === 0) return unbacked;

  // The quotas. Each group takes its share in the order the list already
  // has, the news capped again per outlet so one newsroom's feed cannot
  // take what today is given. A quota is a reservation as much as a cap:
  // the list arrives sorted by support, score and priority, and every
  // history story outranks every news story, so a cap alone left today
  // with nothing at all on the real September 9.
  const taken = new Set<string>();
  const chosen: StoryInput[] = [];
  const byGroup = new Map<TileGroup, number>();
  const byOutlet = new Map<string, number>();

  for (const story of unbacked) {
    if (chosen.length >= limit) break;
    const group = groupOf(story);
    if ((byGroup.get(group) ?? 0) >= GROUP_QUOTA[group]) continue;
    if (group === "news") {
      const outlet = story.outlet ?? story.id;
      if ((byOutlet.get(outlet) ?? 0) >= PER_OUTLET_UNBACKED) continue;
      byOutlet.set(outlet, (byOutlet.get(outlet) ?? 0) + 1);
    }
    byGroup.set(group, (byGroup.get(group) ?? 0) + 1);
    chosen.push(story);
    taken.add(story.id);
  }

  // The fill. A slot the quotas could not fill is filled rather than left
  // empty, because a varied board is worth something and an empty one is
  // not. It takes from whichever group is thinnest on the board so far, in
  // the order the list already had, so a date with no releases hands their
  // two slots to the next thinnest rather than back to the group that
  // sorted first.
  const rest = unbacked.filter((s) => !taken.has(s.id));
  const seen = new Map<TileGroup, number>(byGroup);
  const fill: StoryInput[] = [];
  const used = new Set<string>();
  while (chosen.length + fill.length < limit) {
    let best: StoryInput | undefined;
    let fewest = Number.POSITIVE_INFINITY;
    for (const story of rest) {
      if (used.has(story.id)) continue;
      const count = seen.get(groupOf(story)) ?? 0;
      if (count < fewest) {
        fewest = count;
        best = story;
        if (count === 0) break;
      }
    }
    if (best === undefined) break;
    used.add(best.id);
    fill.push(best);
    seen.set(groupOf(best), (seen.get(groupOf(best)) ?? 0) + 1);
  }

  const after = rest.filter((s) => !used.has(s.id));
  return [...chosen, ...fill, ...after];
}

/** The most tiles a band across the board may hold: four at the minimum width fill sixteen. */
export const MAX_PER_BAND = Math.floor(BOARD_MODULES / MIN_W);
/** The most bands: five at the minimum height fill sixteen with one to spare. */
export const MAX_BANDS = Math.floor(BOARD_MODULES / MIN_H);

/**
 * Integers that sum to `total`, each at least `floor`, in proportion to
 * `weights`. Largest remainder: every share is floored, then the leftover
 * units go to the largest remainders. With all weights nought the total is
 * split evenly. Pure.
 */
export function shares(weights: number[], total: number, floor: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const spare = total - floor * n;
  if (spare < 0) throw new Error(`allocator: ${n} shares cannot each have ${floor} of ${total}`);
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  const even = sum <= 0;
  const exact = weights.map((w) => (even ? spare / n : (spare * Math.max(0, w)) / sum));
  const out = exact.map((x) => Math.floor(x));
  let left = spare - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % n) {
    out[order[k]!.i] = (out[order[k]!.i] ?? 0) + 1;
    left -= 1;
  }
  return out.map((x) => x + floor);
}

/**
 * Integers that sum to `total` in proportion to `weights`, none under `min`.
 * Unlike `shares`, the minimum is a clamp and not a base: a band owed 5.6 of
 * 16 rows gets about 5.6, and only a band owed less than three gets three,
 * with the rows it took coming off the others in proportion. Then largest
 * remainder rounding, which never takes a share below its floor. Pure.
 */
export function proportional(weights: number[], total: number, min: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (min * n > total) throw new Error(`allocator: ${n} parts cannot each have ${min} of ${total}`);
  const fixed = new Set<number>();
  let exact: number[] = new Array(n).fill(0);
  for (;;) {
    const freeTotal = total - min * fixed.size;
    const free = weights.map((w, i) => (fixed.has(i) ? 0 : Math.max(0, w)));
    const sum = free.reduce((a, b) => a + b, 0);
    const freeCount = n - fixed.size;
    exact = weights.map((_, i) => (fixed.has(i) ? min : sum <= 0 ? freeTotal / freeCount : (freeTotal * free[i]!) / sum));
    const below = exact.findIndex((x, i) => !fixed.has(i) && x < min);
    if (below < 0) break;
    fixed.add(below);
  }
  const out = exact.map((x) => Math.floor(x));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % n) {
    out[order[k]!.i] = (out[order[k]!.i] ?? 0) + 1;
    left -= 1;
  }
  return out;
}

/**
 * Every way to cut a sorted list of n tiles into consecutive bands of at
 * most MAX_PER_BAND, at most MAX_BANDS bands. Small: twelve tiles give a few
 * dozen.
 */
function partitions(n: number): number[][] {
  const out: number[][] = [];
  const walk = (left: number, sofar: number[]): void => {
    if (left === 0) { out.push(sofar); return; }
    if (sofar.length >= MAX_BANDS) return;
    for (let k = Math.min(MAX_PER_BAND, left); k >= 1; k -= 1) walk(left - k, [...sofar, k]);
  };
  walk(n, []);
  return out;
}

interface Cut { rects: Rect[]; cost: number }

/**
 * Lays `areas` (sorted largest first, summing to the board) into bands and
 * returns the rectangles in the same order, choosing among every partition
 * the one whose tiles land nearest their areas. Band heights are shares of
 * the board's height by the area in each band, never under MIN_H; widths in
 * a band are shares of the board's width by tile area, never under MIN_W.
 * Every band is exactly the board wide and the bands are exactly the board
 * tall, so the board is full.
 */
export function cutBands(areas: number[]): Rect[] {
  if (areas.length === 0) return [];
  let best: Cut | null = null;
  for (const bands of partitions(areas.length)) {
    let at = 0;
    const bandAreas = bands.map((k) => { const a = areas.slice(at, at + k).reduce((x, y) => x + y, 0); at += k; return a; });
    const heights = proportional(bandAreas, BOARD_MODULES, MIN_H);
    const rects: Rect[] = [];
    let cost = 0;
    let my = 0;
    at = 0;
    bands.forEach((k, b) => {
      const h = heights[b]!;
      const tiles = areas.slice(at, at + k);
      const widths = proportional(tiles, BOARD_MODULES, MIN_W);
      let mx = 0;
      tiles.forEach((target, i) => {
        const w = widths[i]!;
        rects.push({ mx, my, w, h });
        // Distance from the share it was owed, plus a little for a shape a
        // headline reads badly in, so a square beats a ribbon when both fit.
        cost += Math.abs(w * h - target) + 0.25 * Math.abs(w / h - WIDTH_PREFERENCE);
        mx += w;
      });
      at += k;
      my += h;
    });
    if (best === null || cost < best.cost) best = { rects, cost };
  }
  return best!.rects;
}

/**
 * Places every story that has earned a place, as a pie.
 *
 * Membership is chosen the way it always was, backed first and then by
 * points under the variety caps, but a stored rectangle no longer holds a
 * place: a story somebody backed later can take it. Then each placed story
 * gets MIN_MODULES plus its share of the rest of the board, by support when
 * anybody has buzzed on the date and by score when nobody has, and the tiles
 * are laid in bands, biggest first. A date carrying a story stamped false
 * falls back to allocateByGrowth, because that story keeps its rectangle
 * exactly and the pie has no hole in it yet.
 */
export function allocate(stories: StoryInput[]): Allocation {
  if (stories.some((s) => s.frozen && s.anchor)) return allocateByGrowth(stories);

  const byArrival = (a: StoryInput, b: StoryInput): number => {
    const at = toMillis(a.placedAt) - toMillis(b.placedAt);
    if (at !== 0) return at;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
  const sorted = [...stories].sort((a, b) => {
    if (b.support !== a.support) return b.support - a.support;
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    if ((b.priority ?? 0) !== (a.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
    return byArrival(a, b);
  });
  const backed = sorted.filter((s) => s.support > 0);
  const unbacked = varied(sorted.filter((s) => s.support <= 0), UNBACKED_PLACED);

  const chosen: StoryInput[] = [];
  const overflow: string[] = [];
  let unbackedPlaced = 0;
  for (const story of [...backed, ...unbacked]) {
    const isBacked = story.support > 0;
    if (chosen.length >= MAX_PLACED || (!isBacked && unbackedPlaced >= UNBACKED_PLACED)) {
      overflow.push(story.id);
      continue;
    }
    chosen.push(story);
    if (!isBacked) unbackedPlaced += 1;
  }
  if (chosen.length === 0) return { placed: [], overflow };

  // The shares. By buzzes when there are any; by points when there are none,
  // so a board nobody has touched is still meaningful rather than even.
  const anyBuzz = chosen.some((s) => s.support > 0);
  const weights = chosen.map((s) => (anyBuzz ? Math.max(0, s.support) : Math.max(0, s.score ?? 0)));
  const areas = shares(weights, BOARD_MODULES * BOARD_MODULES, MIN_MODULES);

  // Biggest first, top left, so the board reads in the order the shares do.
  const order = chosen.map((s, i) => ({ s, area: areas[i]! })).sort((a, b) => b.area - a.area || chosen.indexOf(a.s) - chosen.indexOf(b.s));
  const rects = cutBands(order.map((o) => o.area));
  const placed: Placement[] = order.map((o, i) => ({ id: o.s.id, ...rects[i]! }));
  return { placed, overflow };
}

/**
 * The older engine: places every story that has earned a place by growth.
 *
 * Stories already carrying an anchor keep their exact rectangle and may
 * grow, in placement order, so the story that got there first has first
 * claim on the space around it. Stories without one are then considered,
 * most supported first, and each takes the nearest free minimum rectangle
 * to the centre while the board holds fewer than MAX_PLACED tiles. The rest
 * are overflow. Runs for a date carrying a story stamped false, and for the
 * tests that pin how growth behaves.
 */
export function allocateByGrowth(stories: StoryInput[]): Allocation {
  const byArrival = (a: StoryInput, b: StoryInput): number => {
    const at = toMillis(a.placedAt) - toMillis(b.placedAt);
    if (at !== 0) return at;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
  const anchored = stories.filter((s) => s.anchor).sort(byArrival);
  // Most supported first. Among stories arriving together this is what puts
  // the one people backed on the board ahead of the ones nobody did.

  const sorted = stories.filter((s) => !s.anchor).sort((a, b) => {
    if (b.support !== a.support) return b.support - a.support;
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    if ((b.priority ?? 0) !== (a.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
    return byArrival(a, b);
  });

  // Anything anybody backed keeps its place at the front, untouched: one buzz
  // beats every rule in the variety pass, the same way it beats every
  // priority. Only the tiles nobody has chosen yet are reordered for variety,
  // and only as far as the slots they can take.
  const backedFirst = sorted.filter((s) => s.support > 0);
  const unbackedRest = sorted.filter((s) => s.support <= 0);
  const room = Math.max(0, UNBACKED_PLACED - anchored.filter((s) => s.support <= 0).length);
  const arriving = [...backedFirst, ...varied(unbackedRest, room)];

  const board = new Board();
  const placed: Placement[] = [];
  const overflow: string[] = [];

  // Existing rectangles are laid down first, all of them, before anything
  // grows. A tile placed later must never be allowed to grow into the
  // rectangle of one placed earlier, and the rectangles are the one thing
  // here that is already a fact.
  for (const story of anchored) {
    const anchor = story.anchor!;
    if (!board.rectFree(anchor)) {
      throw new Error(`allocator: stored rectangle for ${story.id} overlaps another stored rectangle`);
    }
    board.take(anchor);
  }

  for (const story of anchored) {
    const anchor = story.anchor!;
    if (story.frozen) {
      placed.push({ id: story.id, ...anchor });
      continue;
    }
    const target = targetModules(story.tier, story.support);
    const grown = grow(board, anchor, Math.max(target, anchor.w * anchor.h));
    placed.push({ id: story.id, ...grown });
  }

  const order = anchorOrder();
  let unbacked = anchored.filter((s) => s.support <= 0).length;

  for (const story of arriving) {
    const backed = story.support > 0;
    if (placed.length >= MAX_PLACED || (!backed && unbacked >= UNBACKED_PLACED)) {
      overflow.push(story.id);
      continue;
    }
    const free = order.find(({ mx, my }) => board.rectFree({ mx, my, w: MIN_W, h: MIN_H }));
    if (free === undefined) {
      overflow.push(story.id);
      continue;
    }
    const seed: Rect = { mx: free.mx, my: free.my, w: MIN_W, h: MIN_H };
    board.take(seed);
    const grown = grow(board, seed, targetModules(story.tier, story.support));
    placed.push({ id: story.id, ...grown });
    if (!backed) unbacked += 1;
  }

  // Placement order is still the order the board was read in, whatever
  // order the tiles were grown in, so a caller sees the same list shape it
  // always did.
  const rank = new Map<string, number>();
  [...anchored, ...arriving].forEach((s, i) => rank.set(s.id, i));
  placed.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);

  return { placed, overflow };
}

/** True when two rectangles share any module. */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.mx < b.mx + b.w && b.mx < a.mx + a.w && a.my < b.my + b.h && b.my < a.my + a.h;
}
