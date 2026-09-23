// Decade teams, docs/the-wall.md section 30, decided September 23, 2026.
//
// Every tile carries a year: a history row's, a number one's, a person's
// birth year, and the day's news is this year. The board says which decade
// holds the most of the hive, "The 1940s lead September 23." Teams with no
// accounts and no membership: a reader rallies for a decade by buzzing it,
// and nothing records which decade a reader favoured.
//
// Nathan's calls, September 23, 2026, made on the three live boards. The
// news counts as the 2020s, because a buzz on today's news is a buzz on
// this decade and leaving it out would let the line say "the 1940s lead"
// while most buzzes went to the news. Counted by buzzes, which is what the
// pie already cuts the hive by, so the news does not lead on tile count
// alone: on September 21 the news was nine of forty four tiles and held one
// buzz of five. With no buzzes there is no line, the same rule as the crown:
// a decade leads only because somebody buzzed it.
//
// One copy of the sentence in plain JavaScript, the way the crown is done,
// because the live hive says it as buzzes land. The decade of each story is
// worked out here on the server from the headline and handed to the page.

import type { WallDay, WallStory } from "./wall.js";

/** The decade a story belongs to, as its first year (1940 for the 1940s), or null when the headline carries no year. */
export function decadeOf(story: Pick<WallStory, "headline" | "subjectKind" | "wallDate">): number | null {
  const year = yearOf(story);
  return year === null ? null : Math.floor(year / 10) * 10;
}

/** The year a story is about. The day's news is the wall date's year. */
export function yearOf(story: Pick<WallStory, "headline" | "subjectKind" | "wallDate">): number | null {
  if (story.subjectKind === null) return Number(story.wallDate.slice(0, 4));
  const h = story.headline;
  const lead = /^(\d{3,4}): /.exec(h);
  if (lead !== null) return Number(lead[1]);
  if (story.subjectKind === "person") {
    const born = /\bborn (\d{3,4})\b/.exec(h);
    if (born !== null) return Number(born[1]);
  }
  const fact = /^On [A-Z][a-z]+ \d{1,2}, (\d{3,4}),/.exec(h);
  if (fact !== null) return Number(fact[1]);
  return null;
}

export interface DecadeTeam {
  decade: number;
  buzzes: number;
  /**
   * The generation named on the line, when the decade's buzzed people all
   * belong to one: "Boomers" for a 1940s led by Springsteen. Null when the
   * decade's buzzes are on events, songs or news, which belong to no
   * generation, or when its people straddle two. Nathan's call, September
   * 23, 2026: people get a generation, everything else stays a decade.
   */
  generation: string | null;
}

/**
 * The generation a birth year falls in, by the Pew Research Center's
 * boundaries for Silent through Generation Z, and the common ones either
 * side of them. Null outside 1883 to 2024.
 */
export const GENERATIONS: ReadonlyArray<{ name: string; from: number; to: number }> = [
  { name: "Lost Generation", from: 1883, to: 1900 },
  { name: "Greatest Generation", from: 1901, to: 1927 },
  { name: "Silent Generation", from: 1928, to: 1945 },
  { name: "Boomers", from: 1946, to: 1964 },
  { name: "Gen X", from: 1965, to: 1980 },
  { name: "Millennials", from: 1981, to: 1996 },
  { name: "Gen Z", from: 1997, to: 2012 },
  { name: "Gen Alpha", from: 2013, to: 2024 },
];

export function generationOf(born: number | null): string | null {
  if (born === null) return null;
  return GENERATIONS.find((g) => born >= g.from && born <= g.to)?.name ?? null;
}

/** A person's birth year, for the generation; null for anything that is not a person. */
export function bornOf(story: Pick<WallStory, "headline" | "subjectKind" | "wallDate">): number | null {
  return story.subjectKind === "person" ? yearOf(story) : null;
}

export interface DecadeStanding {
  /** Every decade with a buzz, most first, then the older decade first on a tie. */
  teams: DecadeTeam[];
  /** All the buzzes counted. */
  total: number;
  /** The decades sharing the top count. One means a leader; more is a tie. */
  leaders: number[];
}

export const HIVE_DECADES_JS = `
var HiveDecades = (function () {
  "use strict";
  var GENERATIONS = ${JSON.stringify(GENERATIONS)};
  function generationOf(born) {
    if (typeof born !== "number") return null;
    for (var i = 0; i < GENERATIONS.length; i++) if (born >= GENERATIONS[i].from && born <= GENERATIONS[i].to) return GENERATIONS[i].name;
    return null;
  }
  // rows: [{decade, support, born}]. A story with no decade, or stamped
  // false, is left out by the caller. born is a person's birth year and
  // null for everything else.
  function standing(rows) {
    var by = {}, gens = {}, total = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || typeof r.decade !== "number" || typeof r.support !== "number" || !(r.support >= 1) || Math.floor(r.support) !== r.support) continue;
      by[r.decade] = (by[r.decade] || 0) + r.support;
      total += r.support;
      // Every buzzed person's generation in the decade, and a marker for a
      // buzzed story that is not a person, which belongs to none.
      var g = r.generation !== undefined ? r.generation : generationOf(r.born);
      if (!gens[r.decade]) gens[r.decade] = {};
      gens[r.decade][g === null || g === undefined ? "" : g] = true;
    }
    var teams = Object.keys(by).map(function (k) {
      var seen = Object.keys(gens[k] || {});
      return { decade: Number(k), buzzes: by[k], generation: seen.length === 1 && seen[0] !== "" ? seen[0] : null };
    });
    teams.sort(function (a, b) { return b.buzzes - a.buzzes || a.decade - b.decade; });
    var top = teams.length ? teams[0].buzzes : 0;
    var leaders = teams.filter(function (t) { return t.buzzes === top; }).map(function (t) { return t.decade; });
    return { teams: teams, total: total, leaders: leaders };
  }
  function name(decade) { return decade + "s"; }
  function named(team) { return name(team.decade) + (team.generation ? " (" + team.generation + ")" : ""); }
  function teamFor(s, decade) { for (var i = 0; i < s.teams.length; i++) if (s.teams[i].decade === decade) return s.teams[i]; return { decade: decade, buzzes: 0, generation: null }; }
  function units(n, voice) { return n === 1 ? "1 " + voice.one : n + " " + voice.many; }
  function list(names) {
    if (names.length <= 1) return names.join("");
    return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  }
  // The line under the board, or "" with no buzzes. Past tense once sealed.
  function line(s, dateName, voice, sealed) {
    if (!s || s.total <= 0 || !s.leaders.length) return "";
    var v = voice || { one: "buzz", many: "buzzes" };
    var top = s.teams[0].buzzes;
    var sofar = sealed ? "" : " so far";
    if (s.leaders.length === 1) {
      var with_ = top === s.total
        ? (s.total === 1 ? "the only " + v.one + sofar : "all " + units(s.total, v) + sofar)
        : top + " of " + units(s.total, v);
      return "The " + named(teamFor(s, s.leaders[0])) + (sealed ? " led " : " lead ") + dateName + " with " + with_ + ".";
    }
    var names = s.leaders.map(function (d) { return named(teamFor(s, d)); });
    return "The " + list(names) + (sealed ? " were level on " : " are level on ") + dateName + ", " + units(top, v) + " each.";
  }
  return { standing: standing, line: line, name: name, generationOf: generationOf };
})();
`;

type DecadesApi = {
  standing: (rows: Array<{ decade: number | null; support: number; born?: number | null }>) => DecadeStanding;
  line: (s: DecadeStanding, dateName: string, voice: { one: string; many: string }, sealed: boolean) => string;
  name: (decade: number) => string;
  generationOf: (born: number | null) => string | null;
};
let evaluated: DecadesApi | null = null;
/** The page's own HiveDecades, evaluated once, so the server and the tests run the code the page runs. */
export function hiveDecades(): DecadesApi {
  if (evaluated === null) evaluated = new Function(`${HIVE_DECADES_JS}; return HiveDecades;`)() as DecadesApi;
  return evaluated;
}

/** The teams as a day's stories stand: every story on the date that is not stamped false, by its decade. */
export function decadeStanding(day: Pick<WallDay, "stories">): DecadeStanding {
  return hiveDecades().standing(day.stories.filter((s) => s.status !== "false").map((s) => ({ decade: decadeOf(s), support: s.support, born: bornOf(s) })));
}

/** "The 1940s lead September 23 with 2 buzzes of 5." or "" with no buzzes. */
export function decadeLine(day: Pick<WallDay, "stories">, dateName: string, voice: { one: string; many: string }, sealed: boolean): string {
  return hiveDecades().line(decadeStanding(day), dateName, voice, sealed);
}
