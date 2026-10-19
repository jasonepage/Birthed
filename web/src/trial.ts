// The sting and the trial, October 19, 2026.
//
// A sting is the hive's other verb: "this does not matter". One a day per
// browser, never on a story the same browser buzzed. Three stings on a story
// put it on trial until the next hourly redraw; at the redraw it is buried
// if its stings strictly outnumber its buzzes, and otherwise it survives and
// is immune to a new trial for six hours. A buried story leaves the board
// for the graveyard under it, and the graveyard is part of the sealed
// record.
//
// Everything here is a replay of rows that never change: the buzz rows and
// the sting rows, each with the instant it was cast. Taking one back inside
// its thirty seconds deletes the row, so the replay simply never sees it,
// and a trial its third sting opened never opened. The same rows give the
// same answer on the date page, the receipt, the worker's board and the
// sealed page, today and in ten years.
//
// The database keeps the budget, the one side per story rule and the seal.
// It does not run this replay, so it cannot refuse a sting on an immune or
// buried story; the site answers those in words first, and the replay
// ignores any such row that arrives some other way: a sting during immunity
// counts for nothing, and nothing cast at a buried story counts at all.
//
// SELF-CONTAINED ON PURPOSE. worker/src/wall/trial.ts is this file, byte for
// byte, held to it by worker/test/wall-trial-copy.test.ts. Change both or
// neither.

/** How many stings since the last trial put a story on trial. */
export const STINGS_FOR_TRIAL = 3;
/** How long a story that survived a trial is immune to a new one. */
export const IMMUNITY_MS = 6 * 3_600_000;
/** The redraw is on the hour, every hour (the worker's schedule, "0 * * * *"). */
export const REDRAW_MS = 3_600_000;

export const TRIAL_WORDS = {
  trial: "ON TRIAL: the hive is deciding",
  buried: "Buried by the hive",
  immune: "This one just survived a trial",
} as const;

/** A buzz or a sting, as the replay needs it. */
export interface Vote {
  storyId: string;
  at: string;
  /** Buzz units; a sting is always one. */
  units?: number;
}

export type TrialPhase = "clear" | "trial" | "immune" | "buried";

export interface TrialState {
  phase: TrialPhase;
  /** Every sting that counts, all day. */
  stings: number;
  /** Every buzz that counts, all day: gross, the crown's own count. */
  buzzes: number;
  /** When the open trial is decided: the next redraw, or the seal if that comes first. */
  endsAt: string | null;
  /** Until when a survivor is immune. */
  immuneUntil: string | null;
  /** When the hive buried it. */
  buriedAt: string | null;
  /** How many trials it has stood, decided ones only. */
  trials: number;
}

/** The first redraw strictly after an instant: the next top of the hour. */
export function nextRedraw(at: number): number {
  return (Math.floor(at / REDRAW_MS) + 1) * REDRAW_MS;
}

function clear(): TrialState {
  return { phase: "clear", stings: 0, buzzes: 0, endsAt: null, immuneUntil: null, buriedAt: null, trials: 0 };
}

/**
 * Every story's trial state at an instant, from the day's rows. `closesAt`
 * is the seal: a trial still open then is decided at the seal, on the
 * counts as they stood, and nothing cast after it counts. Pure.
 */
export function trialsAt(
  boosts: readonly Vote[],
  stings: readonly Vote[],
  now: number,
  closesAt: string,
): Map<string, TrialState> {
  const seal = Date.parse(closesAt);
  const until = Math.min(now, Number.isFinite(seal) ? seal : now);
  type Event = { kind: "buzz" | "sting"; storyId: string; at: number; units: number; order: number };
  const events: Event[] = [];
  let order = 0;
  for (const b of boosts) events.push({ kind: "buzz", storyId: b.storyId, at: Date.parse(b.at), units: Math.max(1, b.units ?? 1), order: order++ });
  for (const s of stings) events.push({ kind: "sting", storyId: s.storyId, at: Date.parse(s.at), units: 1, order: order++ });
  // Rows cast at or after the seal, or not yet, count for nothing.
  const timely = events.filter((e) => Number.isFinite(e.at) && e.at < until);
  timely.sort((a, b) => a.at - b.at || (a.kind === b.kind ? a.order - b.order : a.kind === "buzz" ? -1 : 1));

  const out = new Map<string, TrialState>();
  const fresh = new Map<string, number>();
  let trialEnd = new Map<string, number>();
  const state = (id: string): TrialState => {
    let s = out.get(id);
    if (s === undefined) { s = clear(); out.set(id, s); }
    return s;
  };
  // Decide every trial whose end has come, on the counts at that moment.
  const settle = (upTo: number): void => {
    const next = new Map<string, number>();
    for (const [id, end] of trialEnd) {
      if (end > upTo) { next.set(id, end); continue; }
      const s = state(id);
      s.trials += 1;
      s.endsAt = null;
      if (s.stings > s.buzzes) {
        s.phase = "buried";
        s.buriedAt = new Date(end).toISOString();
      } else {
        s.phase = "immune";
        s.immuneUntil = new Date(end + IMMUNITY_MS).toISOString();
        fresh.set(id, 0);
      }
    }
    trialEnd = next;
  };

  for (const e of timely) {
    settle(e.at);
    const s = state(e.storyId);
    if (s.phase === "buried") continue;
    if (s.phase === "immune" && s.immuneUntil !== null && e.at >= Date.parse(s.immuneUntil)) {
      s.phase = "clear";
      s.immuneUntil = null;
    }
    if (e.kind === "buzz") {
      s.buzzes += e.units;
      continue;
    }
    if (s.phase === "immune") continue;
    s.stings += 1;
    const count = (fresh.get(e.storyId) ?? 0) + 1;
    fresh.set(e.storyId, count);
    if (s.phase === "clear" && count >= STINGS_FOR_TRIAL) {
      const end = Math.min(nextRedraw(e.at), Number.isFinite(seal) ? seal : Infinity);
      s.phase = "trial";
      s.endsAt = new Date(end).toISOString();
      trialEnd.set(e.storyId, end);
    }
  }
  settle(until);
  // A survivor whose immunity has run out by now is clear again.
  for (const s of out.values()) {
    if (s.phase === "immune" && s.immuneUntil !== null && Date.parse(s.immuneUntil) <= until) {
      s.phase = "clear";
      s.immuneUntil = null;
    }
  }
  return out;
}

/** The stories the hive has buried by an instant, oldest burial first. */
export function buriedOf(states: ReadonlyMap<string, TrialState>): string[] {
  return [...states].filter(([, s]) => s.phase === "buried").sort((a, b) => (a[1].buriedAt! < b[1].buriedAt! ? -1 : 1)).map(([id]) => id);
}

export interface CrownChangeLike { at: string; to: string; from: string | null }

/**
 * The crown with burials in it. Most buzzes wears it, gross, as before; a
 * story the hive buries loses it at the moment it is buried, to whichever
 * story then has the most buzzes, the first to reach that count winning a
 * tie, and a buried story can never take it again. With no burial this is
 * exactly the crown it always was. Pure.
 */
export function crownWithBurials(
  boosts: ReadonlyArray<Vote & { id?: number | string }>,
  eligible: ReadonlySet<string>,
  burials: ReadonlyMap<string, string>,
): { holder: string | null; count: number; changes: CrownChangeLike[] } {
  type Ev = { at: number; kind: "buzz" | "bury"; storyId: string; units: number; iso: string; order: number };
  const evs: Ev[] = [];
  let order = 0;
  for (const b of boosts) {
    const at = Date.parse(b.at);
    if (Number.isFinite(at)) evs.push({ at, kind: "buzz", storyId: b.storyId, units: Math.max(1, b.units ?? 1), iso: b.at, order: order++ });
  }
  for (const [id, at] of burials) evs.push({ at: Date.parse(at), kind: "bury", storyId: id, units: 0, iso: at, order: order++ });
  evs.sort((a, b) => a.at - b.at || (a.kind === b.kind ? a.order - b.order : a.kind === "buzz" ? -1 : 1));

  const counts = new Map<string, number>();
  const reached = new Map<string, number>();
  const dead = new Set<string>();
  let holder: string | null = null;
  let top = 0;
  const changes: CrownChangeLike[] = [];
  for (const e of evs) {
    if (e.kind === "bury") {
      dead.add(e.storyId);
      if (holder !== e.storyId) continue;
      let best: string | null = null;
      let bestCount = 0;
      for (const [id, n] of counts) {
        if (dead.has(id) || n <= 0) continue;
        if (n > bestCount || (n === bestCount && best !== null && (reached.get(id) ?? 0) < (reached.get(best) ?? 0))) { best = id; bestCount = n; }
      }
      changes.push({ at: e.iso, to: best ?? "", from: holder });
      holder = best;
      top = bestCount;
      if (best === null) changes.pop();
      continue;
    }
    if (!eligible.has(e.storyId) || dead.has(e.storyId)) continue;
    const n = (counts.get(e.storyId) ?? 0) + e.units;
    counts.set(e.storyId, n);
    reached.set(e.storyId, e.at);
    if (n > top) {
      if (holder !== e.storyId) changes.push({ at: e.iso, to: e.storyId, from: holder });
      holder = e.storyId;
      top = n;
    }
  }
  return { holder, count: top, changes };
}
