// The placement engine for the wall. docs/the-wall.md section 5.
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
//   New stories take the free module nearest the board centre point
//   (7.5, 7.5), ranked by distance, then clockwise angle from straight up,
//   then mx, then my. Stories are considered in order of placement time,
//   then id.
//   Target size is clamp(1, tier ceiling, floor(support / 5)).
//   Growth adds one whole free column, to the right or to the left, or one
//   whole free row, below or above, preferring width while w is at most h
//   times 1.5, right before left and down before up, and does not grow at
//   all when every side is blocked. Decided on September 9, 2026: with only
//   right and down, the first stories on a busy day were boxed in by one
//   module tiles within the hour and could never grow whatever support they
//   gathered. docs/the-wall.md section 9.
//   A claimed tile is capped at 4 modules and a confirmed one at 24.
//   A story with no free module comes back as overflow rather than throwing.

export const BOARD_MODULES = 16;
export const MODULE_PX = 16;
export const BOARD_PX = BOARD_MODULES * MODULE_PX;

/** Boost units per module of area. */
export const UNITS_PER_MODULE = 5;

/** The most modules a claimed story may hold, however much support it has. */
export const CLAIMED_CEILING = 4;
/** The most modules a reported or seen directly story may hold. */
export const CONFIRMED_CEILING = 24;

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
   * When the story earned its place, as milliseconds since the epoch or an
   * ISO string. Decides the order stories are considered in. For a story
   * already on the board it is the stored placed_at; for a new one it is the
   * moment it became eligible.
   */
  placedAt: number | string;
  /** The stored rectangle, when the story is already on the board. */
  anchor?: Rect | null;
}

export interface Placement extends Rect {
  id: string;
}

export interface Allocation {
  placed: Placement[];
  /** Stories that earned a place and found no free module. */
  overflow: string[];
}

export function tierCeiling(tier: Tier): number {
  return tier === "claimed" ? CLAIMED_CEILING : CONFIRMED_CEILING;
}

/** clamp(1, tier ceiling, floor(support / 5)), in modules of area. */
export function targetModules(tier: Tier, support: number): number {
  const wanted = Math.floor(Math.max(0, support) / UNITS_PER_MODULE);
  return Math.max(1, Math.min(tierCeiling(tier), wanted));
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

/**
 * Every module on the board in the order a new story tries them: nearest the
 * centre first, ties broken clockwise from straight up, then by mx, then my.
 * Computed once per call because it depends on nothing.
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
  // Distances are compared with a tolerance because hypot of symmetric
  // offsets can differ in the last bit, and a last bit deciding which module
  // is nearer would make the order depend on floating point rather than on
  // the rule.
  const close = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
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

/**
 * Grows one tile toward its target area, one whole column or row at a time,
 * and returns the rectangle it ended with. A step that would overshoot the
 * target is not taken, so a tile of six modules with a target of eight adds
 * the row that makes eight rather than the column that makes nine.
 *
 * Four directions. A column can be added on the right or on the left, a row
 * below or above. The rectangle that comes back always contains the one that
 * went in, so a tile never shrinks and never gives up ground; only its top
 * left corner may move outward.
 */
function grow(board: Board, rect: Rect, target: number): Rect {
  let current = { ...rect };
  for (;;) {
    const area = current.w * current.h;
    if (area >= target) return current;

    const preferWidth = current.w <= current.h * WIDTH_PREFERENCE;
    const widerFits = current.w + 1 <= BOARD_MODULES && (current.w + 1) * current.h <= target;
    const tallerFits = current.h + 1 <= BOARD_MODULES && current.w * (current.h + 1) <= target;

    const right = {
      fits: widerFits && board.columnFree(current.mx + current.w, current.my, current.h),
      apply: (): Rect => ({ ...current, w: current.w + 1 }),
      take: (): void => board.take({ mx: current.mx + current.w, my: current.my, w: 1, h: current.h }),
    };
    const left = {
      fits: widerFits && board.columnFree(current.mx - 1, current.my, current.h),
      apply: (): Rect => ({ ...current, mx: current.mx - 1, w: current.w + 1 }),
      take: (): void => board.take({ mx: current.mx - 1, my: current.my, w: 1, h: current.h }),
    };
    const down = {
      fits: tallerFits && board.rowFree(current.mx, current.my + current.h, current.w),
      apply: (): Rect => ({ ...current, h: current.h + 1 }),
      take: (): void => board.take({ mx: current.mx, my: current.my + current.h, w: current.w, h: 1 }),
    };
    const up = {
      fits: tallerFits && board.rowFree(current.mx, current.my - 1, current.w),
      apply: (): Rect => ({ ...current, my: current.my - 1, h: current.h + 1 }),
      take: (): void => board.take({ mx: current.mx, my: current.my - 1, w: current.w, h: 1 }),
    };

    const order = preferWidth ? [right, left, down, up] : [down, up, right, left];
    const step = order.find((candidate) => candidate.fits);
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
 * grow. Stories without one are given the nearest free module to the centre
 * and may then grow in the same pass. Everything happens in placement order,
 * so the story that got there first has first claim on the space around it.
 */
export function allocate(stories: StoryInput[]): Allocation {
  const ordered = [...stories].sort((a, b) => {
    const at = toMillis(a.placedAt) - toMillis(b.placedAt);
    if (at !== 0) return at;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const board = new Board();
  const placed: Placement[] = [];
  const overflow: string[] = [];

  // Existing rectangles are laid down first, all of them, before anything
  // grows. A tile placed later must never be allowed to grow into the
  // rectangle of one placed earlier, and the rectangles are the one thing
  // here that is already a fact.
  for (const story of ordered) {
    const anchor = story.anchor;
    if (!anchor) continue;
    if (!board.rectFree(anchor)) {
      throw new Error(`allocator: stored rectangle for ${story.id} overlaps another stored rectangle`);
    }
    board.take(anchor);
  }

  const order = moduleOrder();

  for (const story of ordered) {
    const target = targetModules(story.tier, story.support);

    if (story.anchor) {
      const grown = grow(board, story.anchor, Math.max(target, story.anchor.w * story.anchor.h));
      placed.push({ id: story.id, ...grown });
      continue;
    }

    const free = order.find(({ mx, my }) => board.isFree(mx, my));
    if (free === undefined) {
      overflow.push(story.id);
      continue;
    }
    const seed: Rect = { mx: free.mx, my: free.my, w: 1, h: 1 };
    board.take(seed);
    const grown = grow(board, seed, target);
    placed.push({ id: story.id, ...grown });
  }

  return { placed, overflow };
}

/** True when two rectangles share any module. */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.mx < b.mx + b.w && b.mx < a.mx + a.w && a.my < b.my + b.h && b.my < a.my + a.h;
}
