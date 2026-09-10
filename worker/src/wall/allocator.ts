// The placement engine for the wall. docs/the-wall.md section 5, and
// section 13 for what the third build session changed here.
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
//   most supported first, then by priority, then by placement time, then id,
//   so a story people backed reaches the board before one nobody has, the
//   date's own history opens the board ahead of the news feeds, and the
//   first to arrive wins among equals. A new story takes the free minimum rectangle whose
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
 * The smallest tile: what a headline needs. On a phone the board is about
 * 368 pixels across, so a module is 23 pixels and four by three is 92 by 69,
 * four lines of about fourteen characters; on a desktop it is 140 by 105 and
 * most headlines fit whole.
 */
export const MIN_W = 4;
export const MIN_H = 3;
export const MIN_MODULES = MIN_W * MIN_H;

/** The most tiles the board holds. What qualifies beyond this is overflow. */
export const MAX_PLACED = 12;

/**
 * The most tiles that may hold a story with no support. The rest of the
 * board waits for stories somebody backed, so a story people chose can
 * always reach it while the day is young, whatever the feeds put there first.
 */
export const UNBACKED_PLACED = 8;

/**
 * Boost units per module of target area, above the minimum. One, because on
 * the web a tap is one unit and the board has to answer a single tap: at
 * five, the number set when a boost could be worth three units, five taps
 * earned one module and nobody ever saw the wall respond to anything they
 * did. At one the first tap moves the target past the minimum, the tile
 * takes its first whole column, and a handful of taps is plainly visible.
 */
export const UNITS_PER_MODULE = 1;

/** The most modules a claimed story may hold, however much support it has. Twice the minimum. */
export const CLAIMED_CEILING = 24;
/** The most modules a reported or seen directly story may hold. Four times the minimum. */
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
   * Order among stories with equal support when the board has room: the
   * date's biggest history first, then people, then the rest, then the news
   * feeds. docs/the-wall.md section 13. Beaten by a single unit of support.
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
 * Places every story that has earned a place.
 *
 * Stories already carrying an anchor keep their exact rectangle and may
 * grow, in placement order, so the story that got there first has first
 * claim on the space around it. Stories without one are then considered,
 * most supported first, and each takes the nearest free minimum rectangle
 * to the centre while the board holds fewer than MAX_PLACED tiles. The rest
 * are overflow.
 */
export function allocate(stories: StoryInput[]): Allocation {
  const byArrival = (a: StoryInput, b: StoryInput): number => {
    const at = toMillis(a.placedAt) - toMillis(b.placedAt);
    if (at !== 0) return at;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
  const anchored = stories.filter((s) => s.anchor).sort(byArrival);
  // Most supported first. Among stories arriving together this is what puts
  // the one people backed on the board ahead of the ones nobody did.

  const arriving = stories.filter((s) => !s.anchor).sort((a, b) => {
    if (b.support !== a.support) return b.support - a.support;
    if ((b.priority ?? 0) !== (a.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
    return byArrival(a, b);
  });

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
