// This or that, docs/the-wall.md section 30, decided September 23, 2026.
//
// Two stories side by side and one question: which will people still care
// about in ten years. One tap spends one buzz and the next pair comes up. A
// stranger who lands on the date page is handed forty tiles and has to shop
// them to spend one tap; this page hands them two and a question, which is
// the first thing they can do in two seconds.
//
// No script, like the rest of the date page. Each side is the same plain
// form every tile carries, posting to /boost, and the server sends the
// reader back here with the outcome word in the query. The page is drawn
// per request for this reader and never stored, because which pairs are
// shown depends on what this browser has already buzzed.
//
// The pairs come from the board's own order: the comb's ranking, which is
// buzzes, then the editor's score, then priority, then how many desks filed
// the story, then arrival. A story stamped false is out, a story this
// browser already buzzed is out, and two news stories from one outlet are
// never a pair. A buzz removes the winner from the list, so the loser faces
// the next story down; a skip moves down one pair and spends nothing.

import { agreeOnNews } from "./agree.js";
import { monthName, slug } from "./model.js";
import { FOOT, dayHue, head, siteBar, SITE } from "./render.js";
import { nextRefillWords } from "./refills.js";
import {
  allowanceOn, combRank, crownTook, freshLeft, hivePath, storyPath, takingBoosts, tapsLeftSentence, tierLabel, tileKind, kindMark, units, voiceFor,
  type Voice, type WallDay, type WallStory,
} from "./wall.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const PICK_QUESTION = "Which will people still care about in ten years?";

/** The most pairs a hand made address may ask for. Past the end is "seen every pair", not a crash. */
export const PICK_MAX = 9999;

export interface Pair { a: WallStory; b: WallStory }

/** "/september-23/pick/", with the pair index when it is not the first. */
export function pickPath(month: number, day: number, p: number = 0): string {
  return `/${slug(month, day)}/pick/${p > 0 ? `?p=${p}` : ""}`;
}

/** The address a request path names, or null. */
export function pickFor(requestPath: string, dates: ReadonlyArray<{ month: number; day: number }>): { month: number; day: number } | null {
  const m = /^\/([a-z]+-\d{1,2})\/pick\/?$/.exec(requestPath);
  if (m === null) return null;
  const d = dates.find((x) => slug(x.month, x.day) === m[1]);
  return d === undefined ? null : { month: d.month, day: d.day };
}

/** The pair index in a query string: a whole number from 0 to PICK_MAX, else 0. */
export function pickIndexFrom(query: string | undefined): number {
  const p = Number(new URLSearchParams(query ?? "").get("p") ?? "0");
  return Number.isInteger(p) && p >= 0 && p <= PICK_MAX ? p : 0;
}

function isNews(s: Pick<WallStory, "subjectKind">): boolean {
  return s.subjectKind === null;
}

/**
 * Every story this browser could buzz, in the board's own order. The day's
 * stories, the news collapsed to one row per story the way the feed does,
 * ranked as the comb ranks them, minus the false and minus what this
 * browser already backed.
 */
export function pickList(day: Pick<WallDay, "stories">, backed: ReadonlySet<string>): WallStory[] {
  const agreed = agreeOnNews(day.stories.filter((s) => s.status !== "false"));
  return combRank(agreed.stories, agreed.alsoIn).filter((s) => !backed.has(s.id));
}

/**
 * The list cut into pairs, top down. Each story takes the next one below
 * it that it may face: two news stories from one outlet are not a pair,
 * because that is a newsroom against itself. A story with nobody to face
 * is left out. A story never faces itself, which the walk cannot produce
 * and the test checks anyway.
 */
export function pickPairs(list: readonly WallStory[]): Pair[] {
  const pool = [...list];
  const pairs: Pair[] = [];
  while (pool.length > 1) {
    const a = pool.shift()!;
    const at = pool.findIndex((b) => b.id !== a.id && !(isNews(a) && isNews(b) && a.outlet === b.outlet));
    if (at < 0) continue;
    const b = pool.splice(at, 1)[0]!;
    pairs.push({ a, b });
  }
  return pairs;
}

export interface PickOptions {
  /** This browser's standing, or null for a browser with no token. */
  standing: { left: number; allowance: number; backed: string[] } | null;
  /** Which pair, from the query. */
  p: number;
  /** The outcome word of the tap that led here, or null. */
  tapped: string | null;
  /** The story a buzz just counted for, for the Undo button. */
  undo: WallStory | null;
}

function side(story: WallStory, voice: Voice, live: boolean, left: number, p: number, month: number, day: number, which: "a" | "b"): string {
  const count = units(story.support, voice);
  const kind = tileKind(story);
  const control = live
    ? `<form class="wbuzz wpickbuzz" method="post" action="/boost"><input type="hidden" name="s" value="${story.id}"><input type="hidden" name="m" value="${month}"><input type="hidden" name="d" value="${day}"><input type="hidden" name="v" value="pick"><input type="hidden" name="p" value="${p}">`
      + `<button type="submit"${left <= 0 ? " disabled" : ""} aria-label="${escapeHtml(`This one: ${story.headline}`)}">This one</button></form>`
    : "";
  return `<div class="wpickside wpick-${which} w-${story.tier}">
<p class="wpickkind">${kindMark(kind)}</p>
<a class="wpickh" href="${storyPath(story)}">${escapeHtml(story.headline)}</a>
<p class="wpickmeta">${escapeHtml(story.outlet)} &middot; ${escapeHtml(tierLabel(story.tier))}${count === "" ? "" : ` &middot; ${count}`}</p>
${control}
</div>`;
}

/** What the page says after a tap, in the voice's words. */
export function pickSaid(tapped: string, voice: Voice, undo: WallStory | null, took: string | null, month: number, day: number, p: number): string {
  const v = voice;
  const undoForm = undo === null ? "" : `<div class="wundoline"><form class="wundo" method="post" action="/unboost"><input type="hidden" name="s" value="${undo.id}"><input type="hidden" name="m" value="${month}"><input type="hidden" name="d" value="${day}"><input type="hidden" name="v" value="pick"><input type="hidden" name="p" value="${p}"><button type="submit" aria-label="${escapeHtml(`Undo that ${v.one}: ${undo.headline}`)}">Undo</button></form><span class="wundonote">Thirty seconds, for a tap you did not mean.</span></div>`;
  const sentences: Record<string, string> = {
    kept: `That counts.${took === null ? "" : ` <b class="wcrowntook">${escapeHtml(took)}</b>`} Here is the next pair.`,
    undone: `Taken back. That ${v.one} is gone and you have it again.`,
    too_late: `That one stands. A ${v.one} can be taken back for thirty seconds after it is cast, and only by the browser that cast it. Nothing was changed.`,
    already: `You already ${v.past} that one, on this browser. It did not spend a ${v.one}.`,
    spent: `That is every ${v.one} you have on this date today, so that one did not count. It is still a good story to have picked.`,
    not_yet: `Not yet. A date takes ${v.many} from the day itself, and this one has not arrived.`,
    closed: `This hive has sealed and is permanent now. That ${v.one} arrived after midnight and was not counted.`,
    false: `That story was later shown false. It keeps its place on the hive and takes no ${v.many}.`,
    failed: `That did not save, and it was this end rather than yours. The date is fine. Try it again.`,
    bad: `That did not save, and it was this end rather than yours. The date is fine. Try it again.`,
  };
  const sentence = sentences[tapped];
  if (sentence === undefined) return "";
  return `<div class="wsaid wshow" id="wsaid" role="status"><p>${sentence}</p>${tapped === "kept" ? undoForm : ""}</div>`;
}

export function renderPickPage(day: WallDay, month: number, d: number, now: number, options: PickOptions): string {
  const name = `${monthName(month)} ${d}`;
  const voice = voiceFor(month, d);
  const live = takingBoosts(day, now);
  const allowance = allowanceOn(day, now);
  const left = options.standing?.left ?? freshLeft(day, now);
  const backed = new Set(options.standing?.backed ?? []);
  const list = pickList(day, backed);
  const pairs = pickPairs(list);
  const p = Math.max(0, Math.min(options.p, PICK_MAX));
  const pair = pairs[p] ?? null;
  const hue = dayHue(month);
  const took = options.undo === null ? null : crownTook(day, options.undo.id, now);
  const said = options.tapped === null ? "" : pickSaid(options.tapped, voice, options.undo, took, month, d, p);

  // The three states past the pairs: no buzzes left, nothing left to pair,
  // and past the last pair.
  let body: string;
  if (pair !== null) {
    body = `<div class="wpickpair">
${side(pair.a, voice, live, left, p, month, d, "a")}
<span class="wpickor" aria-hidden="true">or</span>
${side(pair.b, voice, live, left, p, month, d, "b")}
</div>
<p class="wpickskip">${p + 1 < pairs.length ? `<a href="${pickPath(month, d, p + 1)}" rel="nofollow">Skip this pair</a> <span class="wpicknote">Shows the next two and spends nothing.</span>` : `<span class="wpicknote">This is the last pair on the hive.</span>`}</p>`;
  } else if (pairs.length === 0) {
    body = `<p class="wnote wpickdone">${list.length === 1
      ? `One story left on this hive that you have not ${voice.past}, and nothing to put it against.`
      : `Nothing left to pair. Every story on this hive has your ${voice.one} or is off the board.`} <a href="/${slug(month, d)}/">Back to the hive</a>.</p>`;
  } else {
    body = `<p class="wnote wpickdone">You have seen every pair. <a href="${pickPath(month, d)}">Start from the top</a> or <a href="/${slug(month, d)}/">go back to the hive</a>.</p>`;
  }

  const count = live ? `<p class="wcount"><span class="wleft wset">${tapsLeftSentence(left, allowance, voice, nextRefillWords(now, day.wallDate, allowance))}</span></p>` : `<p class="wcount">This hive is not taking ${voice.many} right now.</p>`;
  return `${head(`Pick one on ${name}`, `Two stories from ${name}'s hive and one question: which will people still care about in ten years?`, `${SITE}${pickPath(month, d)}`, undefined, true, "pickpage")}
<div class="day wstory wpick" style="--day:${hue.day};--day-soft:${hue.soft}">
${siteBar(`<span class="barnav"><a class="here" href="/${slug(month, d)}/">${escapeHtml(name)}</a></span>
`)}
<section class="wall wpicksection" aria-labelledby="pickhead">
<p class="wback"><a href="/${slug(month, d)}/">&larr; The hive for ${escapeHtml(name)}</a> &middot; <a href="${hivePath(month, d)}">Full screen</a></p>
<h1 class="wtitle wpickq" id="pickhead">${PICK_QUESTION}</h1>
<p class="wlede">One tap is one ${voice.one}, and the next pair comes up. Pairs run down the hive from the most ${voice.past}.</p>
${count}
${said}
${body}
</section>
</div>
${FOOT}`;
}
