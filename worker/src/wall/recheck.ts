// When a source is read again, and when a check is worth a row. Pure, so
// the policy is tested against timelines rather than against a network.
//
// The checker used to read every source on every open wall on every tick,
// four times an hour, and write two rows each time. Measured on September
// 10, 2026: 176 pages fetched and 352 rows written per tick, and one news
// article of 427,568 characters downloaded five times in half an hour to
// confirm the same sentence was still on it. That costs bandwidth and
// compute, it asks other people's servers for the same page ninety six times
// a day, which is how a checker gets blocked and how the tier system then
// stops working, and it turns a receipt into thirty identical lines. This
// file is the two decisions that fix it: dueForCheck says whether to read
// the page at all, and shouldRecord says whether what was read deserves a
// row.
//
// What does not change. verified_at follows the latest read whether or not
// that read was written down: a pass sets it, a fail clears it. A result
// that differs from the last recorded one is always a row, so a page that
// changes after a pass gets its failing row and the old row is never edited.
// An imported source is not read at all; check.ts decides that before
// asking here. docs/the-wall.md section 12.
//
// One thing the schema does not carry is when a page was last read, as
// opposed to last written about. A passing source has it in verified_at. A
// source that fails after passing is read every tick and needs no anchor. A
// source that has never passed has nothing, so once its retries slow down
// every read of it is recorded, and its rows are its schedule. A column on
// wall_sources for the last read would let those rows go too; that is a
// migration, and this file works without it.

import type { CheckRow } from "./check.js";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * How long a passing source stands before it is read again. Four hours.
 *
 * What a re-read is for is catching a page that has been taken down,
 * rewritten or put behind a wall since it passed, so the tier that rests on
 * it falls. The edits that break an exact match cluster in the first hours
 * after a story is published, and the sources here are read within a quarter
 * hour of being filed, so the first read already lands in that window. After
 * a pass the question is only whether the page is still there. Four hours
 * means a story stands on a changed page for at most four hours and a tick,
 * against fifteen minutes before, and a wall is open for three days, so one
 * passing source costs about nineteen reads over its whole life instead of
 * nearly three hundred. Two hours would double that for a tighter window
 * nothing reads at that grain; six would let a page stand a quarter of a day.
 */
export const PASSING_INTERVAL_MS = 4 * HOUR;

/**
 * How long a source that has never passed is retried on every tick before
 * it is read at PASSING_INTERVAL_MS like everything else. One hour.
 *
 * The live checks on September 10, 2026 said that every failing source on
 * the open walls had never passed: sixty eight answered 200 with a page that
 * does not contain the feed's description, and eleven never answered. None
 * had ever flipped. A page that does not use the words the feed used will
 * not start using them, and a host that refuses the checker is not helped by
 * being asked again every fifteen minutes; that is the quickest way to be
 * blocked for good. An hour of every-tick retries, four reads, sees through
 * a transient outage at the first read, and after that the page is read as
 * often as a passing one, which still catches a page that comes good later.
 *
 * A source that passed and then fails is different and is read every tick
 * for as long as the wall is open: an outage ends, an edit can be reverted,
 * and a return restores a tier. That is the case section 12 was written for.
 */
export const RETRY_WINDOW_MS = 1 * HOUR;

/**
 * How often a read whose result has not changed is written down anyway.
 * Twenty four hours.
 *
 * verified_at carries the exact time of the latest pass, but it is one
 * mutable column and a fail clears it, so the rows are the durable record,
 * and without an occasional row a receipt cannot tell "read every four
 * hours for two days and passing" from "not looked at for two days". One row
 * a day says the source was still standing, bounds a three day wall to about
 * three of them per kind, and is short enough to read as a receipt rather
 * than a log.
 */
export const HEARTBEAT_MS = 24 * HOUR;

/**
 * The last half hour before a wall closes, in which a source is read once
 * more whatever its schedule says. The sealed wall is permanent, and its
 * tiers should rest on a read from the wall's last minutes rather than one
 * from up to four hours earlier. Two ticks fit in the window; the first reads
 * and the second sees a read inside the window and does not.
 */
export const CLOSING_WINDOW_MS = 30 * MINUTE;

/** The newest recorded check of one kind on a source. */
export interface LatestCheck {
  checked_at: string;
  passed: boolean;
}

/** What the rows already say about one source. */
export interface CheckHistory {
  resolves: LatestCheck | null;
  quotation: LatestCheck | null;
  /** The earliest recorded check of either kind, or null when there is none. */
  first_checked_at: string | null;
  /** A recorded quotation check has passed at some point. */
  ever_passed: boolean;
}

/** A source with no rows at all. */
export const NEVER_CHECKED: CheckHistory = { resolves: null, quotation: null, first_checked_at: null, ever_passed: false };

/** The rows folded into one history per source, in any order. */
export function summarize(rows: Array<Pick<CheckRow, "source_id" | "kind" | "checked_at" | "passed">>): Map<string, CheckHistory> {
  const out = new Map<string, CheckHistory>();
  for (const row of rows) {
    const history = out.get(row.source_id) ?? { ...NEVER_CHECKED };
    const at = Date.parse(row.checked_at);
    const latest = history[row.kind];
    // Ties on checked_at, which the seed tool and the submit function both
    // produce, go to the row that arrived later, so a caller ordering by id
    // within checked_at gets the last one written.
    if (latest === null || at >= Date.parse(latest.checked_at)) {
      history[row.kind] = { checked_at: row.checked_at, passed: row.passed };
    }
    if (history.first_checked_at === null || at < Date.parse(history.first_checked_at)) history.first_checked_at = row.checked_at;
    if (row.kind === "quotation" && row.passed) history.ever_passed = true;
    out.set(row.source_id, history);
  }
  return out;
}

/**
 * When the page was last read. verified_at when it is later than the rows,
 * because a pass moves it whether or not the read was written down.
 */
function lastReadAt(history: CheckHistory, verifiedAt: string | null): number {
  const recorded = history.quotation === null ? -Infinity : Date.parse(history.quotation.checked_at);
  const verified = verifiedAt === null ? -Infinity : Date.parse(verifiedAt);
  return Math.max(recorded, verified);
}

/**
 * Whether the page is read on this tick.
 *
 * Never checked: now. Failing after a pass: every tick. Failing and never
 * passed: every tick inside the retry window, then at the passing interval.
 * Passing: at the passing interval, measured from the last read rather than
 * the last row. And a source not read inside the closing window is read
 * once there. The quotation check is the one consulted, because it fails
 * whenever the resolves check does and it is the one verified_at follows.
 */
export function dueForCheck(history: CheckHistory, verifiedAt: string | null, closesAt: string, now: string): boolean {
  const latest = history.quotation;
  if (latest === null || history.first_checked_at === null) return true;
  const at = Date.parse(now);

  if (!latest.passed) {
    if (history.ever_passed) return true;
    if (at - Date.parse(history.first_checked_at) < RETRY_WINDOW_MS) return true;
  }

  const lastRead = lastReadAt(history, verifiedAt);
  if (at - lastRead >= PASSING_INTERVAL_MS) return true;

  const closes = Date.parse(closesAt);
  return closes - at <= CLOSING_WINDOW_MS && lastRead < closes - CLOSING_WINDOW_MS;
}

/**
 * Whether what one read says is written down. The two checks from one read
 * are written together or not at all, so every recorded read is the pair
 * section 12 describes.
 *
 * A first read is written. A result that differs from the last recorded one
 * of its kind is always written; that is the promise that a change is never
 * lost. The same result again is written once the heartbeat has elapsed
 * since the last recorded read, with one exception: a source that has never
 * passed and is past its retry window has no verified_at to carry the time
 * of its last read, so each of its reads is written and its rows are its
 * schedule. Inside the window it is read every tick regardless and the first
 * row anchors the window, so nothing more is needed.
 */
export function shouldRecord(history: CheckHistory, judged: CheckRow[]): boolean {
  for (const check of judged) {
    const latest = history[check.kind];
    if (latest === null || latest.passed !== check.passed) return true;
  }
  const at = Math.max(...judged.map((c) => Date.parse(c.checked_at)));
  const quotation = judged.find((c) => c.kind === "quotation");
  const failing = quotation !== undefined && !quotation.passed;
  if (failing && !history.ever_passed && history.first_checked_at !== null
      && at - Date.parse(history.first_checked_at) >= RETRY_WINDOW_MS) {
    return true;
  }
  const lastRecorded = Math.max(...judged.map((c) => Date.parse(history[c.kind]!.checked_at)));
  return at - lastRecorded >= HEARTBEAT_MS;
}

/** The history the rows would say after a read, for a caller walking a timeline. */
export function afterCheck(history: CheckHistory, judged: CheckRow[], recorded: boolean): CheckHistory {
  if (!recorded) return history;
  const next: CheckHistory = { ...history };
  for (const check of judged) {
    if (next.first_checked_at === null || Date.parse(check.checked_at) < Date.parse(next.first_checked_at)) next.first_checked_at = check.checked_at;
    if (check.kind === "quotation" && check.passed) next.ever_passed = true;
    next[check.kind] = { checked_at: check.checked_at, passed: check.passed };
  }
  return next;
}
