// The sealed hive as one picture: the date, the crown, the most buzzed
// stories and the day's total, 1080 by 1080, for somebody to save and post.
//
// Nathan's call, September 25, 2026. Generation and storage only: nothing
// here posts anywhere. recap-job.ts renders it with Playwright after the date
// seals and stores it once, at a path that is the date and nothing else.
//
// This file is pure. It takes a WallDay that has already been read and
// answers with a recap, or with null when the day has not sealed, and it
// turns a recap into HTML. No clock, no network, no browser, so a test can
// hand it a fixture and read the answer.
//
// Sealed only, and that is not a courtesy. A picture of a board that can
// still move is a picture that can be wrong the moment after it is taken,
// and a picture of a sealed board is a picture of a record that never
// changes. isSealed is the one rule and both the job and the tests read it.

import { monthName, slug } from "./model.js";
import { escapeHtml, SITE } from "./render.js";
import { BG, BG_GLOW, CELL, CREAM, DIM, DIMMER, HONEY, LINE, ON_HONEY, PINK, SANS, SERIF } from "./theme.js";
import { crownFor, crownName, type WallDay } from "./wall.js";

export const RECAP_SIDE = 1080;
/** How many stories the picture names under the crown. Four fit at a size a phone can read. */
export const RECAP_BELOW_CROWN = 4;
/** Under the crown when the songs are drawn too, so the square never runs past its foot. */
export const RECAP_BELOW_WITH_SONGS = 2;

/**
 * A song somebody said was stuck in their head, once the daily prompt
 * ships. CLAUDE.md, "The song in your head". Always empty until then, and an
 * empty list draws nothing, so the picture is exactly what it would be
 * without the field.
 */
export interface RecapSong {
  title: string;
  artist: string;
  /** How many people named it, or buzzed it, whichever the prompt settles on. */
  count: number;
}

export interface RecapLine {
  name: string;
  buzzes: number;
}

export interface SealedRecap {
  wallDate: string;
  year: number;
  month: number;
  day: number;
  totalBuzzes: number;
  crown: RecapLine | null;
  below: RecapLine[];
  songs: RecapSong[];
}

/** A date has sealed when its close has passed. The same close the hive reads. */
export function isSealed(day: Pick<WallDay, "closesAt" | "closedAt">, now: number): boolean {
  return now >= Date.parse(day.closedAt ?? day.closesAt);
}

/**
 * What the picture says about one sealed day, or null while it can still
 * move. The crown is the hive's own crown, replayed from the buzzes, so a
 * tie is held by whoever reached it first exactly as the page says. Below it
 * are the most buzzed stories that are not the crown and were not stamped
 * false; a story nobody buzzed is not on the picture, because the picture
 * is of what people chose.
 */
export function sealedRecap(day: WallDay, now: number, songs: RecapSong[] = []): SealedRecap | null {
  if (!isSealed(day, now)) return null;
  const boosts = day.boosts ?? [];
  const totalBuzzes = boosts.reduce((sum, b) => sum + b.units, 0);
  const crown = crownFor(day);
  const holder = crown.holder === null ? undefined : day.stories.find((s) => s.id === crown.holder);
  const below = day.stories
    .filter((s) => s.support > 0 && s.status !== "false" && s.id !== crown.holder)
    .sort((a, b) => b.support - a.support || (b.interest ?? 0) - (a.interest ?? 0) || a.id.localeCompare(b.id))
    .slice(0, songs.length > 0 ? RECAP_BELOW_WITH_SONGS : RECAP_BELOW_CROWN)
    .map((s) => ({ name: crownName(s), buzzes: s.support }));
  return {
    wallDate: day.wallDate,
    year: day.year,
    month: day.month,
    day: day.day,
    totalBuzzes,
    crown: holder === undefined ? null : { name: crownName(holder), buzzes: crown.count },
    below,
    songs: [...songs].sort((a, b) => b.count - a.count).slice(0, 3),
  };
}

/** Where a recap lives in storage: the date, and nothing a reader could not type. */
export function recapPath(wallDate: string): string {
  return `${wallDate}.png`;
}

function buzzWord(n: number): string {
  return n === 1 ? "1 buzz" : `${n.toLocaleString("en-US")} buzzes`;
}

/**
 * The picture as HTML, sized to the square. fontFaces is the @font-face CSS
 * with the font inlined as bytes, because Playwright's setContent leaves the
 * page on an opaque origin that refuses every file address (og.ts says so at
 * length). Passed in rather than read here, so this file stays pure.
 */
export function renderRecap(recap: SealedRecap, fontFaces: string = ""): string {
  const name = `${monthName(recap.month)} ${recap.day}, ${recap.year}`;
  const address = `${SITE.replace(/^https:\/\//, "")}/${slug(recap.month, recap.day)}/`;
  const crown = recap.crown === null
    ? `<div class="crown none"><p class="kicker">No crown</p><p class="held">Nobody buzzed this one. It sealed as it was.</p></div>`
    : `<div class="crown"><p class="kicker">Wore the crown</p><p class="held">${escapeHtml(recap.crown.name)}</p><p class="count">${buzzWord(recap.crown.buzzes)}</p></div>`;
  const below = recap.below.length === 0 ? "" : `<ol class="below">
${recap.below.map((line) => `<li><span class="name">${escapeHtml(line.name)}</span><span class="n">${line.buzzes}</span></li>`).join("\n")}
</ol>`;
  const songs = recap.songs.length === 0 ? "" : `<div class="songs"><p class="kicker">Stuck in everyone's head</p><ol>
${recap.songs.map((s) => `<li><span class="name">&ldquo;${escapeHtml(s.title)}&rdquo; ${escapeHtml(s.artist)}</span><span class="n">${s.count}</span></li>`).join("\n")}
</ol></div>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(name)}, sealed</title>
<style>
${fontFaces}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${RECAP_SIDE}px; height: ${RECAP_SIDE}px; overflow: hidden; }
body { background: radial-gradient(ellipse at 50% 0%, ${BG_GLOW} 0%, ${BG} 62%); color: ${CREAM}; font-family: ${SANS}; padding: 72px 80px; display: flex; flex-direction: column; }
.top { display: flex; justify-content: space-between; align-items: baseline; }
.mark { color: ${PINK}; font-family: ${SANS}; font-weight: 800; letter-spacing: 0.32em; font-size: 26px; }
.sealed { color: ${HONEY}; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; font-size: 22px; }
h1 { font-family: ${SERIF}; font-weight: 800; font-size: 92px; line-height: 1; margin-top: 40px; }
.total { color: ${DIM}; font-size: 30px; margin-top: 16px; }
.kicker { color: ${HONEY}; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; font-size: 20px; }
.crown { background: ${HONEY}; color: ${ON_HONEY}; border-radius: 28px; padding: 30px 36px; margin-top: 44px; }
.crown .kicker { color: ${ON_HONEY}; opacity: 0.75; }
.crown .held { font-family: ${SERIF}; font-weight: 800; font-size: 50px; line-height: 1.08; margin-top: 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.crown .count { font-weight: 700; font-size: 26px; margin-top: 12px; }
.crown.none { background: ${CELL}; color: ${CREAM}; border: 2px solid ${LINE}; }
.crown.none .kicker { color: ${HONEY}; opacity: 1; }
.crown.none .held { font-size: 40px; }
ol { list-style: none; margin-top: 24px; }
li { display: flex; justify-content: space-between; align-items: baseline; gap: 24px; padding: 14px 0; border-top: 2px solid ${LINE}; font-size: 30px; }
li .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
li .n { color: ${HONEY}; font-weight: 700; flex: none; }
.songs { margin-top: 28px; }
.songs ol { margin-top: 10px; }
.foot { margin-top: auto; color: ${DIMMER}; font-size: 24px; display: flex; justify-content: space-between; }
</style></head>
<body>
<div class="top"><span class="mark">BIRTHED</span><span class="sealed">Sealed for good</span></div>
<h1>${escapeHtml(name)}</h1>
<p class="total">Sealed with ${buzzWord(recap.totalBuzzes)}</p>
${crown}
${below}
${songs}
<p class="foot"><span>${escapeHtml(address)}</span><span>No edits, ever.</span></p>
</body></html>`;
}
