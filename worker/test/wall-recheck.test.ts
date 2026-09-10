import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { CheckRow } from "../src/wall/check.js";
import {
  CLOSING_WINDOW_MS, HEARTBEAT_MS, NEVER_CHECKED, PASSING_INTERVAL_MS, RETRY_WINDOW_MS,
  afterCheck, dueForCheck, shouldRecord, summarize, type CheckHistory,
} from "../src/wall/recheck.js";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const TICK = 15 * MINUTE;

// A wall opens at T0 and closes three days later, which is the shape of the
// window in docs/the-wall.md section 5: the day before, the day, the day after.
const T0 = Date.UTC(2026, 8, 8, 4, 0, 0);
const CLOSES = T0 + 72 * HOUR;
const CLOSES_AT = new Date(CLOSES).toISOString();
const iso = (ms: number): string => new Date(ms).toISOString();

/** The two rows one read produces, the way checkSource shapes them. */
function read(sourceId: string, at: number, passed: boolean, status: number | null = passed ? 200 : 404): CheckRow[] {
  return [
    { source_id: sourceId, checked_at: iso(at), kind: "resolves", passed: status !== null && status < 400, http_status: status, detail: `${status}` },
    { source_id: sourceId, checked_at: iso(at), kind: "quotation", passed, http_status: status, detail: passed ? "contains" : "does not contain" },
  ];
}

/**
 * One source walked through the policy the way check.ts walks it: asked
 * whether it is due, read if so, verified_at moved on every read, and the
 * rows kept only when shouldRecord says. Returns what happened at each tick.
 */
interface Walk {
  history: CheckHistory;
  verifiedAt: string | null;
  reads: number[];
  recorded: number[];
}

function walk(sourceId: string, outcome: (at: number) => boolean, ticks: number, from: Walk = { history: NEVER_CHECKED, verifiedAt: null, reads: [], recorded: [] }): Walk {
  const state: Walk = { ...from, reads: [...from.reads], recorded: [...from.recorded] };
  for (let tick = 0; tick < ticks; tick++) {
    const at = T0 + tick * TICK;
    if (!dueForCheck(state.history, state.verifiedAt, CLOSES_AT, iso(at))) continue;
    const passed = outcome(at);
    const judged = read(sourceId, at, passed);
    const kept = shouldRecord(state.history, judged);
    state.history = afterCheck(state.history, judged, kept);
    state.verifiedAt = passed ? iso(at) : null;
    state.reads.push(tick);
    if (kept) state.recorded.push(tick);
  }
  return state;
}

// ---------------------------------------------------------------------------
// The decisions, one at a time
// ---------------------------------------------------------------------------

test("a source that has never been checked is due now, and its first read is written", () => {
  assert.equal(dueForCheck(NEVER_CHECKED, null, CLOSES_AT, iso(T0)), true);
  assert.equal(shouldRecord(NEVER_CHECKED, read("s", T0, true)), true);
  assert.equal(shouldRecord(NEVER_CHECKED, read("s", T0, false)), true);
});

test("a source with verified_at but no rows is still read now, because nothing in the record says why it is verified", () => {
  assert.equal(dueForCheck(NEVER_CHECKED, iso(T0 - MINUTE), CLOSES_AT, iso(T0)), true);
});

test("a passing source waits the passing interval, measured from the last read and not the last row", () => {
  const first = read("s", T0, true);
  const history = afterCheck(NEVER_CHECKED, first, true);
  assert.equal(dueForCheck(history, iso(T0), CLOSES_AT, iso(T0 + TICK)), false);
  assert.equal(dueForCheck(history, iso(T0), CLOSES_AT, iso(T0 + PASSING_INTERVAL_MS - 1)), false);
  assert.equal(dueForCheck(history, iso(T0), CLOSES_AT, iso(T0 + PASSING_INTERVAL_MS)), true);

  // The read at four hours passes again and writes nothing, but verified_at
  // moves to it, so the next read is four hours after that rather than the
  // next tick.
  const again = read("s", T0 + PASSING_INTERVAL_MS, true);
  assert.equal(shouldRecord(history, again), false);
  const unchanged = afterCheck(history, again, false);
  assert.deepEqual(unchanged, history);
  const verifiedAt = iso(T0 + PASSING_INTERVAL_MS);
  assert.equal(dueForCheck(unchanged, verifiedAt, CLOSES_AT, iso(T0 + PASSING_INTERVAL_MS + TICK)), false);
  assert.equal(dueForCheck(unchanged, verifiedAt, CLOSES_AT, iso(T0 + 2 * PASSING_INTERVAL_MS)), true);
});

test("the same passing result is written once a day as a heartbeat, so the receipt shows the source still standing", () => {
  const history = afterCheck(NEVER_CHECKED, read("s", T0, true), true);
  assert.equal(shouldRecord(history, read("s", T0 + HEARTBEAT_MS - TICK, true)), false);
  assert.equal(shouldRecord(history, read("s", T0 + HEARTBEAT_MS, true)), true);
});

test("a pass that turns into a fail is always written, and the source is then read on every tick", () => {
  let history = afterCheck(NEVER_CHECKED, read("s", T0, true), true);
  // Two days of passing reads, none written, verified_at carrying the time.
  const lastPass = T0 + 40 * HOUR;
  assert.equal(shouldRecord(history, read("s", lastPass - PASSING_INTERVAL_MS, true)), true, "the day two heartbeat");
  history = afterCheck(history, read("s", lastPass - PASSING_INTERVAL_MS, true), true);

  const fail = read("s", lastPass + PASSING_INTERVAL_MS, false);
  assert.equal(shouldRecord(history, fail), true, "a change is never lost");
  history = afterCheck(history, fail, true);
  assert.equal(history.ever_passed, true);

  // Now failing after a pass: every tick, because an outage ends.
  const t = lastPass + PASSING_INTERVAL_MS;
  assert.equal(dueForCheck(history, null, CLOSES_AT, iso(t + TICK)), true);
  assert.equal(dueForCheck(history, null, CLOSES_AT, iso(t + 2 * TICK)), true);
  // The same failure again is not a new row until the heartbeat.
  assert.equal(shouldRecord(history, read("s", t + TICK, false)), false);
  assert.equal(shouldRecord(history, read("s", t + HEARTBEAT_MS, false)), true);
});

test("a page that resolves but has lost its quotation writes the pair, so the receipt shows a 200 beside the failed match", () => {
  const history = afterCheck(NEVER_CHECKED, read("s", T0, true), true);
  const lost = read("s", T0 + PASSING_INTERVAL_MS, false, 200);
  assert.equal(lost[0]!.passed, true);
  assert.equal(lost[1]!.passed, false);
  assert.equal(shouldRecord(history, lost), true);
});

test("a source that has never passed is retried every tick for an hour, then read at the passing interval, and each of those reads is written", () => {
  const s = walk("s", () => false, 5 * 4 + 1);
  // Ticks 0 through 3 are inside the hour. Tick 4 is at the hour, outside it,
  // and the read at tick 0 is the anchor, so the next read is four hours
  // after that, at tick 16, and the one after at tick 32.
  assert.deepEqual(s.reads, [0, 1, 2, 3, 16]);
  assert.deepEqual(s.recorded, [0, 16]);
  assert.deepEqual(walk("s", () => false, 33).reads, [0, 1, 2, 3, 16, 32]);
  assert.equal(s.verifiedAt, null);
  assert.equal(RETRY_WINDOW_MS / TICK, 4, "four reads inside the window");
});

test("a fail that turns into a pass is always written and verified_at is set", () => {
  const flips = T0 + 8 * HOUR;
  const s = walk("s", (at) => at >= flips, 8 * 4 + 1);
  assert.deepEqual(s.reads, [0, 1, 2, 3, 16, 32]);
  assert.deepEqual(s.recorded, [0, 16, 32]);
  assert.equal(s.verifiedAt, iso(flips));
  assert.equal(s.history.ever_passed, true);
  assert.equal(s.history.quotation?.passed, true);
  // And from here it is a passing source: not due at the next tick.
  assert.equal(dueForCheck(s.history, s.verifiedAt, CLOSES_AT, iso(flips + TICK)), false);
});

test("a source whose wall is about to close is read once more in the last half hour, and only once", () => {
  const lastRead = CLOSES - 3 * HOUR;
  const history = afterCheck(NEVER_CHECKED, read("s", lastRead, true), true);
  const verifiedAt = iso(lastRead);
  assert.equal(dueForCheck(history, verifiedAt, CLOSES_AT, iso(CLOSES - CLOSING_WINDOW_MS - TICK)), false, "not yet the window");
  assert.equal(dueForCheck(history, verifiedAt, CLOSES_AT, iso(CLOSES - CLOSING_WINDOW_MS)), true, "the window opens");
  // That read passes, writes nothing, and moves verified_at inside the window.
  const final = read("s", CLOSES - CLOSING_WINDOW_MS, true);
  assert.equal(shouldRecord(history, final), false);
  assert.equal(dueForCheck(history, iso(CLOSES - CLOSING_WINDOW_MS), CLOSES_AT, iso(CLOSES - TICK)), false, "read once in the window, not twice");
});

test("a source whose wall is about to close and was read inside the window already is left alone", () => {
  const lastRead = CLOSES - 20 * MINUTE;
  const history = afterCheck(NEVER_CHECKED, read("s", lastRead, true), true);
  assert.equal(dueForCheck(history, iso(lastRead), CLOSES_AT, iso(CLOSES - 5 * MINUTE)), false);
});

test("summarize keeps the newest row of each kind, the earliest of either, and whether a quotation ever passed", () => {
  const rows: CheckRow[] = [
    ...read("a", T0, false),
    ...read("a", T0 + HOUR, true),
    ...read("a", T0 + 2 * HOUR, false),
    ...read("b", T0 + 3 * HOUR, true),
  ];
  const histories = summarize(rows);
  const a = histories.get("a")!;
  assert.equal(a.first_checked_at, iso(T0));
  assert.equal(a.quotation?.checked_at, iso(T0 + 2 * HOUR));
  assert.equal(a.quotation?.passed, false);
  assert.equal(a.resolves?.passed, false);
  assert.equal(a.ever_passed, true);
  const b = histories.get("b")!;
  assert.equal(b.ever_passed, true);
  assert.equal(b.quotation?.passed, true);
  assert.equal(histories.get("c"), undefined);
});

test("summarize gives a tie on checked_at to the row that came later, the way the seed tool and the submit function write them", () => {
  const at = iso(T0);
  const histories = summarize([
    { source_id: "a", kind: "quotation", checked_at: at, passed: false },
    { source_id: "a", kind: "quotation", checked_at: at, passed: true },
  ]);
  assert.equal(histories.get("a")?.quotation?.passed, true);
});

// ---------------------------------------------------------------------------
// The volume
// ---------------------------------------------------------------------------

/**
 * A three day wall at four ticks an hour, with the sources that were on the
 * open walls on September 10, 2026: 106 passing, 68 answering 200 with a
 * page that does not contain the quotation, 11 that never answer. Every
 * source exists from the first tick, which overstates the old cost slightly
 * for sources filed later in the window and overstates the new cost by the
 * same reads, so the ratio is fair. The old behaviour read every source on
 * every tick and wrote two rows each time.
 */
test("over a three day wall the policy reads and writes a small fraction of what the old behaviour did", (t) => {
  const TICKS = (72 * HOUR) / TICK;
  assert.equal(TICKS, 288);
  const population: Array<[count: number, outcome: () => boolean]> = [
    [106, () => true],
    [68, () => false],
    [11, () => false],
  ];
  let sources = 0;
  let newReads = 0;
  let newRows = 0;
  const perKind: Array<{ label: string; reads: number; rows: number }> = [];
  for (const [count, outcome] of population) {
    const one = walk(`s${sources}`, outcome, TICKS);
    perKind.push({ label: outcome() ? "passing" : "never passing", reads: one.reads.length, rows: one.recorded.length * 2 });
    sources += count;
    newReads += count * one.reads.length;
    newRows += count * one.recorded.length * 2;
  }
  const oldReads = sources * TICKS;
  const oldRows = oldReads * 2;

  t.diagnostic(`old: ${oldReads} reads, ${oldRows} check rows over three days for ${sources} sources`);
  t.diagnostic(`new: ${newReads} reads, ${newRows} check rows over three days for ${sources} sources`);
  for (const k of perKind) t.diagnostic(`one ${k.label} source: ${k.reads} reads, ${k.rows} rows`);

  assert.equal(sources, 185);
  assert.equal(oldReads, 53_280);
  assert.equal(oldRows, 106_560);
  // One passing source: reads at 0, 4, 8, ... 68 hours, and one in the
  // closing window, nineteen; rows at 0, 24 and 48 hours, three pairs.
  assert.deepEqual(perKind[0], { label: "passing", reads: 19, rows: 6 });
  // One never passing source: four reads in the first hour, then 4, 8, ...
  // 68 hours and the closing window, twenty two; every read outside the
  // first hour is a row, nineteen pairs.
  assert.deepEqual(perKind[1], { label: "never passing", reads: 22, rows: 38 });
  assert.equal(newReads, 106 * 19 + 79 * 22);
  assert.equal(newRows, 106 * 6 + 79 * 38);
  assert.equal(newReads, 3_752);
  assert.equal(newRows, 3_638);
  assert.ok(oldReads / newReads > 14, `reads fell by ${(oldReads / newReads).toFixed(1)} times`);
  assert.ok(oldRows / newRows > 29, `rows fell by ${(oldRows / newRows).toFixed(1)} times`);
});

test("a source that passes for two days and then loses its page costs every tick from the change, and the change is in the record", (t) => {
  const TICKS = 288;
  const lost = T0 + 48 * HOUR;
  const s = walk("s", (at) => at < lost, TICKS);
  // Passing reads at 0, 4, ..., 44 hours: twelve. The read at 48 hours fails
  // and is written. Then every tick from 48 hours to the close, ninety six
  // ticks, one of which is the day three heartbeat at 72 hours, which falls
  // on the close itself and so is never reached.
  assert.equal(s.reads.length, 12 + 96);
  assert.deepEqual(s.recorded.map((tick) => tick * TICK / HOUR), [0, 24, 48]);
  assert.equal(s.verifiedAt, null);
  t.diagnostic(`pass then fail at 48 hours: ${s.reads.length} reads, ${s.recorded.length * 2} rows`);
  assert.equal(s.history.quotation?.passed, false);
  assert.equal(s.history.ever_passed, true);
});
