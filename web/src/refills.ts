// Buzzes that refill through the day. docs/the-wall.md section 30, decided
// September 23, 2026; the Eastern times confirmed by Nathan the same day.
//
// Still three a day on a date's own day, one on the day after. They arrive
// one at a time: at midnight Eastern, at 8 am Eastern and at 4 pm Eastern,
// and unspent ones carry over inside the day. The database is the authority
// (migration 20260923010000_buzzes_that_refill.sql); this is the page's copy
// of the same arithmetic, for the count under the board and the sentence
// that says when the next one arrives. The two are pinned to the same
// instants: the ones the migration was tested against.
//
// REFILLS_ON is false until Jason applies the migration, and is flipped in
// the same deploy. Until then the database gives three at midnight and the
// pages say three at midnight, which agree. With the flag on and the
// migration not applied, the page would say one and the database would give
// three, which is only a shy page; with the migration applied and the flag
// off, the page would say three and the database would refuse the second
// before 8 am, which is a lying page. So the migration goes first.

import { easternDateOf, easternMidnight } from "./wall.js";

/** Whether the pages say the refill sentences. Flip with the migration. */
export const REFILLS_ON = false;

/** The Eastern hours a unit arrives on the date's own day, after the midnight one. */
export const REFILL_HOURS: readonly number[] = [8, 16];

let easternClock: Intl.DateTimeFormat | null = null;
function easternHour(millis: number): number {
  if (easternClock === null) {
    easternClock = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" });
  }
  const p = Object.fromEntries(easternClock.formatToParts(new Date(millis)).map((x) => [x.type, x.value]));
  return Number(p.hour);
}

/** "2026-09-24" for the day after a wall date, by the calendar. */
function dayAfter(wallDate: string): string {
  const [y, m, d] = wallDate.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * How many units have arrived for a wall date by an instant: one at
 * midnight Eastern, two from 8 am, three from 4 pm, and one on the day
 * after. The database's wall_boost_allowance. Nought when the window is not
 * open, which the caller checks first with takingBoosts.
 */
export function arrivedBy(millis: number, wallDate: string): number {
  const today = easternDateOf(millis);
  if (today === wallDate) {
    const hour = easternHour(millis);
    return 1 + REFILL_HOURS.filter((h) => hour >= h).length;
  }
  return today === dayAfter(wallDate) ? 1 : 0;
}

/**
 * The instant the next unit arrives for a wall date after `millis`, or null
 * when none will: 8 am and 4 pm Eastern on the date, then the midnight
 * that starts the day after. The database's wall_next_refill. Each is the
 * wall clock time in New York as an instant, so the clocks changing on a
 * date moves the instant and not the hour, the same as the database.
 */
export function nextRefill(millis: number, wallDate: string): number | null {
  const midnight = easternMidnight(wallDate);
  const candidates = [
    ...REFILL_HOURS.map((h) => {
      // Walk from midnight in whole hours until the Eastern clock reads h,
      // so a day the clocks change is still answered by the clock.
      let at = midnight;
      for (let i = 0; i < 26; i++) {
        if (easternDateOf(at) === wallDate && easternHour(at) === h) return at;
        at += 60 * 60 * 1000;
      }
      return midnight + h * 60 * 60 * 1000;
    }),
    easternMidnight(dayAfter(wallDate)),
  ];
  const later = candidates.filter((t) => t > millis);
  return later.length === 0 ? null : Math.min(...later);
}

/**
 * The refills still to come on the date's own day after `millis`: the 8 am
 * and 4 pm instants, never the midnight that starts the day after, which is
 * the day changing rather than a unit arriving.
 */
export function dayRefills(millis: number, wallDate: string): number[] {
  const end = easternMidnight(dayAfter(wallDate));
  const out: number[] = [];
  let at = nextRefill(millis, wallDate);
  while (at !== null && at < end) {
    out.push(at);
    at = nextRefill(at, wallDate);
  }
  return out;
}

/** "8 am Eastern", "4 pm Eastern", "midnight Eastern". */
export function refillWords(millis: number): string {
  const hour = easternHour(millis);
  if (hour === 0) return "midnight Eastern";
  if (hour === 12) return "noon Eastern";
  return `${hour % 12} ${hour < 12 ? "am" : "pm"} Eastern`;
}

/**
 * When the next one arrives, as the words for the count line, or "" when
 * refills are off, none is coming, or the date is the day after (its one
 * arrives at midnight and the day sentence already says it closes tonight).
 */
export function nextRefillWords(millis: number, wallDate: string, allowance: number, on: boolean = REFILLS_ON): string {
  if (!on || allowance !== 3) return "";
  const next = nextRefill(millis, wallDate);
  if (next === null) return "";
  // The midnight that starts the day after is the day's end, not a refill
  // the reader waits for: the count line on the day after says its own.
  if (next >= easternMidnight(dayAfter(wallDate))) return "";
  return refillWords(next);
}
