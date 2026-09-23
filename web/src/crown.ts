// The crown, docs/the-wall.md section 30, decided September 23, 2026.
//
// The most buzzed story on a hive wears a crown, and every time the crown
// changed hands is kept as a short list under the board. Both are derived
// from the day's buzz rows replayed in the order they were cast, and from
// nothing else: no table records a takeover, because replaying the rows
// that already exist answers the question exactly and a buzz taken back in
// its thirty seconds simply never happened.
//
// The tie rule, Nathan's call on September 23, 2026: the crown is held until
// another story has strictly more buzzes, and on a tie the holder keeps it.
// The board's own order breaks ties by the editor's score, which is not a
// buzz, and a crown that moved on a tie would say somebody was passed when
// nobody was. A crown is only ever won by a buzz, so nothing here reads a
// score, a priority or an arrival time.
//
// One copy, in plain JavaScript, because the live hive runs it in the
// browser as buzzes land and the server runs it to draw the baked page and
// every sealed hive. The wrappers below evaluate the same string, so the
// tests read the code the page runs, the way HiveShare in hive-live.ts is
// held to its page.

/** One buzz row as the website may read it: no booster, ever. */
export interface WallBoost {
  id: number;
  storyId: string;
  units: number;
  castAt: string;
}

/** One change of hands. `from` is null for the first crown of the day. */
export interface CrownChange {
  at: string;
  to: string;
  from: string | null;
}

export interface Crown {
  /** The story wearing the crown, or null when nobody has buzzed. */
  holder: string | null;
  /** Its buzzes. Nought when nobody has buzzed. */
  count: number;
  changes: CrownChange[];
}

/** The shape the page's rows and the database's rows share. */
interface RawBoost { id: number | string; story_id: string; units: number; cast_at: string }

export const HIVE_CROWN_JS = `
var HiveCrown = (function () {
  "use strict";
  var LIMIT = 60;
  // A row is counted only when it is shaped like a buzz row the database
  // would write: a story, one to three units, and a time that parses. A
  // row shaped like anything else is not a buzz and is skipped, whichever
  // end it came from.
  function valid(b) {
    return !!b && typeof b.story_id === "string" && typeof b.units === "number"
      && b.units >= 1 && b.units <= 3 && Math.floor(b.units) === b.units
      && typeof b.cast_at === "string" && !isNaN(Date.parse(b.cast_at));
  }
  function ordered(boosts) {
    var rows = [];
    for (var i = 0; i < boosts.length; i++) if (valid(boosts[i])) rows.push(boosts[i]);
    rows.sort(function (a, b) {
      var d = Date.parse(a.cast_at) - Date.parse(b.cast_at);
      if (d !== 0) return d;
      var ai = Number(a.id), bi = Number(b.id);
      if (!isNaN(ai) && !isNaN(bi) && ai !== bi) return ai - bi;
      return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
    });
    return rows;
  }
  // The replay. eligible is the stories that can hold the crown, by id: the
  // stories on the date that are not stamped false. A buzz on anything else
  // counts for nothing here, the same way the pie gives a false story no
  // share whatever it was buzzed.
  function replay(boosts, eligible) {
    var counts = {}, holder = null, top = 0, changes = [];
    var rows = ordered(boosts || []);
    for (var i = 0; i < rows.length; i++) {
      var b = rows[i];
      if (!eligible || !eligible[b.story_id]) continue;
      counts[b.story_id] = (counts[b.story_id] || 0) + b.units;
      if (counts[b.story_id] > top) {
        if (holder !== b.story_id) changes.push({ at: b.cast_at, to: b.story_id, from: holder });
        holder = b.story_id;
        top = counts[b.story_id];
      }
    }
    return { holder: holder, count: top, changes: changes, counts: counts };
  }
  var fmt = null;
  // "3:12 pm Eastern". The hive runs on the Eastern clock and so does this.
  function clock(iso) {
    if (fmt === null) fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
    var s = fmt.format(new Date(iso));
    return s.replace(/[\\s\\u00a0\\u202f]*(AM|PM)$/i, function (_, ap) { return " " + ap.toLowerCase(); }) + " Eastern";
  }
  // A headline cut at a word, the way the swarm line cuts one.
  function short(h) {
    var s = String(h || "");
    return s.length > LIMIT ? s.slice(0, LIMIT).replace(/\\s+\\S*$/, "") + "\\u2026" : s;
  }
  // One line of the list. nameOf maps a story id to what to call it: a
  // person's name, a song's title, otherwise the headline (crownName in
  // wall.ts). "Bruce Springsteen took the crown from Ray Charles."
  function line(change, nameOf) {
    var from = change.from === null || change.from === undefined ? "" : " from " + short(nameOf(change.from));
    return clock(change.at) + ": " + short(nameOf(change.to)) + " took the crown" + from + ".";
  }
  // The same change said on the live page the moment it lands, without the time.
  function said(change, nameOf) {
    var from = change.from === null || change.from === undefined ? "" : " from " + short(nameOf(change.from));
    return short(nameOf(change.to)) + " took the crown" + from + ".";
  }
  // Said when a buzz taken back hands the crown back: nobody took it.
  function back(name) { return "The crown is back with " + short(name) + "."; }
  function none(voice) {
    var v = voice || { one: "buzz" };
    return "No crown yet. The first " + v.one + " on this hive takes it.";
  }
  return { replay: replay, clock: clock, line: line, said: said, back: back, none: none, short: short, valid: valid };
})();
`;

type CrownApi = {
  replay: (boosts: RawBoost[], eligible: Record<string, boolean>) => Crown & { counts: Record<string, number> };
  clock: (iso: string) => string;
  line: (change: CrownChange, headlineOf: (id: string) => string) => string;
  said: (change: CrownChange, headlineOf: (id: string) => string) => string;
  back: (name: string) => string;
  none: (voice?: { one: string }) => string;
  short: (headline: string) => string;
  valid: (row: unknown) => boolean;
};

let evaluated: CrownApi | null = null;
/** The page's own HiveCrown, evaluated once, so the server and the tests run the code the page runs. */
export function hiveCrown(): CrownApi {
  if (evaluated === null) evaluated = new Function(`${HIVE_CROWN_JS}; return HiveCrown;`)() as CrownApi;
  return evaluated;
}

/** The database's row shape, which is the page's. */
export function rawBoost(b: WallBoost): RawBoost {
  return { id: b.id, story_id: b.storyId, units: b.units, cast_at: b.castAt };
}

/**
 * The crown as the buzzes stand. Stories stamped false cannot hold it and
 * a buzz on a story that is not on the date counts for nothing.
 */
export function crownOf(boosts: readonly WallBoost[], stories: ReadonlyArray<{ id: string; status: string }>): Crown {
  const eligible: Record<string, boolean> = {};
  for (const s of stories) if (s.status !== "false") eligible[s.id] = true;
  const { holder, count, changes } = hiveCrown().replay(boosts.map(rawBoost), eligible);
  return { holder, count, changes };
}

/** "3:12 pm Eastern". */
export function crownClock(iso: string): string {
  return hiveCrown().clock(iso);
}

/** One line of the list under the board, as plain text. nameOf is crownName in wall.ts. */
export function crownLine(change: CrownChange, nameOf: (id: string) => string): string {
  return hiveCrown().line(change, nameOf);
}

/** What the live page says when the crown moves, as plain text. */
export function crownSaid(change: CrownChange, nameOf: (id: string) => string): string {
  return hiveCrown().said(change, nameOf);
}

/** The line under an open board nobody has buzzed. */
export function noCrownYet(voice?: { one: string }): string {
  return hiveCrown().none(voice);
}

/**
 * A buzz row from the database, read with the columns the website's role
 * may select. `booster_id` is not among them and is never asked for. A row
 * that is not shaped like a buzz is dropped rather than repaired.
 */
export function boostFrom(row: unknown): WallBoost | null {
  if (!hiveCrown().valid(row)) return null;
  const r = row as RawBoost;
  const id = Number(r.id);
  if (!Number.isFinite(id)) return null;
  return { id, storyId: r.story_id, units: r.units, castAt: r.cast_at };
}

/** The crown as a mark on a tile. Our own drawing, one stroke weight, never an emoji. */
export function crownMark(): string {
  return `<span class="wcrownmark" title="Wears the crown: the most buzzed story on this hive"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M3.5 8.5l4.6 4.2L12 5.8l3.9 6.9 4.6-4.2-1.6 9.5H5.1z"/><path d="M5.6 20.2h12.8" fill="none" stroke-width="1.8" stroke-linecap="round"/></svg><span class="sr">Wears the crown.</span></span>`;
}
