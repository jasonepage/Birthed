// The live hive: the one page on birthed.app that runs a script.
//
// docs/the-wall.md section 21, decided September 11, 2026. The full screen
// hive for an open date, and only that page, is a live board: a buzz grows
// and lights its tile the instant it lands, the board reflows around it, and
// other people's buzzes arrive over Supabase Realtime within a second or
// two. Every other page on the site, the 366 date pages and the birthday
// flow included, is exactly what it was: no script, default-src 'none'.
//
// What the page does, in order. It reads the day's stories and buzz counts
// from a data island serve.ts writes into it, runs the same pie allocator
// the worker runs (web/src/hive-allocator.ts, held to the worker's copy by a
// test), positions the tiles absolutely with transitions, subscribes to
// inserts on wall_boosts for its date, and buzzes on tap through POST /boost
// asking for a JSON answer instead of a redirect. The board it draws from the
// counts it has is the board the worker would bake from the same counts, so
// the tick re-baking the layout changes nothing on screen.
//
// What it does not do. No polling, no external script, no font or picture
// from any host but this one and the project, nothing on load that makes a
// sound. The song tile plays a short chord through WebAudio on tap and never
// on its own. The worker still bakes the authoritative sealed layout at
// midnight, unchanged.
//
// Nothing in this module may cost anything at import. serve.ts imports it.

import { slug } from "./model.js";
import { HIVE_ALLOCATOR_JS } from "./hive-allocator.js";
import {
  afterwords, allowanceOn, anniversaryBlock, liveTile, storyPath, subjectOf, takingBoosts, tapsLeftSentence,
  tileKind, kindMark, voiceFor, type Anniversary, type TileKind, type WallDay, type WallStory,
} from "./wall.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** One reader's standing on the date, as wall_web_standing answers it. */
export interface Standing {
  left: number;
  allowance: number;
  backed: string[];
}

export interface LiveHiveOptions {
  /** The project's address and publishable key, for the Realtime socket. Neither is a secret. */
  project: string;
  key: string;
  /** The reader's own standing, on a request answered no-store. Null for a fresh browser, which gets the allowance. */
  standing?: Standing | null;
  /** The panel's points by story id, from the worker's last snapshot, so the pie is cut from the same numbers. */
  scores?: Map<string, number>;
  /** What this browser backed on this day in earlier years. */
  anniversary?: Anniversary[];
}

/**
 * The stories the page hands its allocator, as JSON. Every story on the
 * date is here, because a buzz can land on any of them and the swarm line
 * names what was buzzed; the allocator reads only the ones that earned a
 * place, placed and overflow, which is the set the worker's settle hands
 * its own copy, and a story stamped false with its rectangle, which is what
 * tells the port to leave the board alone.
 */
export interface LiveStory {
  id: string;
  headline: string;
  outlet: string;
  tier: WallStory["tier"];
  status: WallStory["status"];
  support: number;
  score: number;
  priority: number;
  placedAt: string;
  subjectKind: string | null;
  subject: string;
  kind: TileKind;
  receipt: string;
  rect: { mx: number; my: number; w: number; h: number } | null;
}

export function liveStories(day: WallDay, scores: Map<string, number> = new Map()): LiveStory[] {
  return day.stories.map((s) => ({
    id: s.id,
    headline: s.headline,
    outlet: s.outlet,
    tier: s.tier,
    status: s.status,
    support: s.support,
    score: scores.get(s.id) ?? 0,
    priority: s.priority,
    placedAt: s.placedAt ?? s.submittedAt,
    subjectKind: s.subjectKind,
    subject: subjectOf(s) ?? `story:${s.id}`,
    kind: tileKind(s),
    receipt: storyPath(s),
    rect: s.rect,
  }));
}

/**
 * The scores the worker cut the last board with, read off its newest
 * snapshot for the date. The snapshot carries them since September 11, 2026
 * (worker/src/wall/check.ts writes board.scores); an older snapshot has none
 * and every story scores nought, which is what the worker's own allocator
 * does with a story that has no score. Empty on any failure: the page then
 * cuts by buzzes alone, which is right the moment anybody has buzzed and
 * even on a quiet date only until the next tick.
 */
export async function fetchSnapshotScores(url: string, key: string, wallDate: string, timeoutMs: number = 3000): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `${url}/rest/v1/wall_snapshots?select=board&wall_date=eq.${wallDate}&order=taken_at.desc&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: controller.signal },
    );
    if (!response.ok) return out;
    const rows = (await response.json()) as Array<{ board?: { scores?: unknown } }>;
    const scores = rows[0]?.board?.scores;
    if (typeof scores !== "object" || scores === null) return out;
    for (const [id, score] of Object.entries(scores as Record<string, unknown>)) {
      if (typeof score === "number" && Number.isFinite(score) && /^[0-9a-f-]{36}$/i.test(id)) out.set(id, score);
    }
    return out;
  } catch {
    return out;
  } finally {
    clearTimeout(timer);
  }
}

/** JSON that is safe inside a script element: no close tag, no line separators. */
export function jsonIsland(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** A rectangle as the live board positions it: percentages of the sixteen module board, written as custom properties. */
export function rectVars(rect: { mx: number; my: number; w: number; h: number }): string {
  return `--x:${rect.mx};--y:${rect.my};--w:${rect.w};--h:${rect.h}`;
}

/** A clock reading, "23:14:09", for the seconds until an instant; "00:00:00" once it has passed. */
export function clockFor(untilMillis: number): string {
  const s = Math.max(0, Math.floor(untilMillis / 1000));
  const two = (n: number): string => String(n).padStart(2, "0");
  return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
}

/**
 * The live section, in place of wallSection's hive for an open date that is
 * taking buzzes. Same markers, so serve.ts swaps it in exactly as before.
 */
export function liveHiveSection(day: WallDay, name: string, now: number, options: LiveHiveOptions): string {
  const voice = voiceFor(day.month, day.day);
  const live = takingBoosts(day, now);
  const allowance = allowanceOn(day, now);
  const standing = options.standing ?? null;
  const left = standing?.left ?? allowance;
  const backed = standing?.backed ?? [];
  const onWall = day.stories.filter((s) => s.rect !== null && (s.status === "placed" || s.status === "false"));
  const max = Math.max(1, ...onWall.map((s) => s.support));
  const tiles = onWall.map((s, index) => liveTile(s, live, voice, index, heatFor(s.support, max))).join("\n");
  const total = day.stories.reduce((sum, s) => sum + s.support, 0);
  const closes = day.closedAt ?? day.closesAt;
  const seals = clockFor(Date.parse(closes) - now);
  const month = day.month;
  const d = day.day;
  const kinds: Record<string, string> = {};
  for (const kind of ["happened", "born", "song", "album", "film", "news"] as TileKind[]) kinds[kind] = kindMark(kind);
  const data = {
    date: day.wallDate, month, day: d, name,
    project: options.project, key: options.key,
    liveAt: day.liveAt, closesAt: closes,
    allowance, left, backed,
    voice,
    stories: liveStories(day, options.scores ?? new Map()),
    kinds,
  };
  const dots = Array.from({ length: allowance }, (_, i) => `<span class="wdot${i < left ? "" : " wspent"}"></span>`).join("");
  const sentence = tapsLeftSentence(left, allowance, voice);
  // The words on the board while it is empty. A hive taking buzzes with no
  // tile is a date the worker has not laid out yet, and the page says so.
  const empty = onWall.length === 0
    ? `<p class="wnothing"><b>Nothing on the hive yet</b><span>What people ${voice.past} lands here.</span></p>`
    : "";
  return `<section class="wall whive wlivehive" aria-labelledby="wallhead">
<style>${HIVE_LIVE_STYLE}</style>
<div class="wlivetop">
<span class="wawake"><span class="wlivedot" id="wlivedot"></span><span id="wliveword">The hive is awake</span></span>
<span class="wseal">Seals in <b id="wclock">${seals}</b> &middot; <b id="wtotal">${total}</b> ${total === 1 ? voice.one : voice.many} so far</span>
</div>
<h2 class="section wlivehead" id="wallhead">${escapeHtml(name)}. <em>What will still matter?</em></h2>
<p class="wlivesub">Everything with a birthday on ${escapeHtml(name)} is here. What people ${voice.past} grows and lights up. At midnight Eastern it seals, for good.</p>
<div class="wbudget"><span class="wdots" id="wdots" aria-hidden="true">${dots}</span><p class="wcount"><span class="wleft wset" id="wleft">${sentence}</span></p></div>
${afterwords(voice, name, null, "hive")}
<div class="wboard wlive${onWall.length === 0 ? " wblank" : ""}" id="wboard" role="list" aria-label="The hive, ${onWall.length} stories" style="--side:16">
${tiles}${empty}
</div>
<div class="wliveunder">
<p class="wlegend"><span class="wlg"><span class="wsw w-seen_direct"></span>Seen directly</span> <span class="wlg"><span class="wsw w-reported"></span>Reported</span> <span class="wlg"><span class="wsw w-claimed"></span>Claimed</span> <span class="wlegendsay">Brightness is how ${voice.past} a story is. The stripe is how well it is sourced, not whether it is true.</span></p>
<div class="wswarm"><p class="wswarmhead">The swarm, right now</p><div id="wswarm" aria-live="polite"><p class="wswarmrow wswarmquiet">Nobody has ${voice.past} since you arrived.</p></div></div>
</div>
<p class="wsave"><a href="/${slug(month, d)}/yours.png"><span class="wsaveall">Save this picture</span><span class="wsavemine">Save your version</span></a> &middot; <a href="/${slug(month, d)}/">Back to the day</a></p>
${anniversaryBlock(options.anniversary ?? [], day, voice)}
<script type="application/json" id="hivedata">${jsonIsland(data)}</script>
<script>${HIVE_ALLOCATOR_JS}
${HIVE_LIVE_JS}</script>
</section>`;
}

/**
 * How lit a tile is, nought to one, from its share of the biggest count on
 * the board. Even a modest tile shows some warmth and the leader blazes.
 * A story nobody has buzzed is dark. The page recomputes this on every
 * buzz with the same curve.
 */
export function heatFor(support: number, max: number): number {
  if (support <= 0) return 0;
  return Math.round((0.15 + 0.85 * Math.pow(support / Math.max(1, max), 0.8)) * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Style
// ---------------------------------------------------------------------------

/**
 * The live hive's own rules, on top of WALL_STYLE. Fraunces is served from
 * this origin, under /fonts, and only this page names it; the policy for
 * this path allows font-src 'self' and no other page's does. The honeycomb
 * ground is an SVG file from this origin for the same reason a data address
 * would not do: img-src names this origin and the project and nothing else.
 */
export const HIVE_LIVE_STYLE = `
@font-face { font-family: "Fraunces"; font-style: normal; font-weight: 100 900; font-display: swap; src: url("/fonts/fraunces-latin-wght-normal.woff2") format("woff2-variations"); }
@font-face { font-family: "Fraunces"; font-style: italic; font-weight: 100 900; font-display: swap; src: url("/fonts/fraunces-latin-wght-italic.woff2") format("woff2-variations"); }
.hivepage { background: radial-gradient(140% 100% at 50% -20%, #2A1D0C 0%, #120D08 58%) fixed; }
.wlivehive { --honey: #F4B740; --honey-lite: #FFCF6B; --ember: #FF8A3D; --cream: #FFF3E0; --dim: #B7A488; --dimmer: #8A7A63; --line: #3A2E1C; --cell: #1E1710; }
.wlivetop { display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; margin: 4px 0 0; }
.wawake { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--dim); }
.wlivedot { width: 8px; height: 8px; border-radius: 50%; background: var(--dimmer); flex: none; }
.wlivedot.won { background: var(--ember); box-shadow: 0 0 10px var(--ember); }
.wseal { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--dim); }
.wseal b { color: var(--cream); font-weight: 700; }
.whive h2.wlivehead { font-family: "Fraunces", Georgia, "Times New Roman", serif; font-optical-sizing: auto; font-weight: 800; font-size: clamp(28px, 5.4vw, 48px); line-height: 1.04; letter-spacing: -.01em; margin: 14px 0 0; text-wrap: balance; color: var(--cream); }
.wlivehead em { color: var(--honey); font-style: italic; font-weight: 600; }
.wlivesub { margin: 8px 0 0; color: var(--dim); font-size: 15px; max-width: 60ch; line-height: 1.5; }
.wbudget { display: flex; align-items: center; gap: 12px; margin: 14px 0 8px; flex-wrap: wrap; }
.wbudget .wcount { margin: 0; }
.wdots { display: inline-flex; gap: 7px; }
.wdot { width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, var(--honey-lite), var(--honey)); box-shadow: 0 0 10px rgba(244, 183, 64, .5); transition: transform .3s, background .3s, box-shadow .3s; }
.wdot.wspent { background: #35291A; box-shadow: none; transform: scale(.78); }
.wleft.wset::after { content: none; }
.wsaid.wshow { display: block; }
.wboard.wlive {
  display: block; position: relative; aspect-ratio: 1 / 1; padding: 0; gap: 0; border-radius: 16px;
  border: 1px solid var(--line); box-shadow: none; overflow: hidden;
  background: radial-gradient(circle at 50% 40%, rgba(255, 150, 50, .05), transparent 60%), url("/honeycomb.svg") 0 0 / 56px 96px repeat, #17110A;
}
.wboard.wlive.wblank { display: grid; }
.wlive .wtile {
  display: block; position: absolute; left: calc(var(--x, 0) / 16 * 100%); top: calc(var(--y, 0) / 16 * 100%);
  width: calc(var(--w, 4) / 16 * 100%); height: calc(var(--h, 3) / 16 * 100%);
  padding: 4px; background: transparent; --wink: #FFF3E0; --wbtn: #F4B740; --wbtn-ink: #1B1206; --wmark: #FFCF6B;
  color: var(--cream); border-radius: 0; overflow: visible; --heat: 0;
  transition: left .55s cubic-bezier(.22, .61, .36, 1), top .55s cubic-bezier(.22, .61, .36, 1), width .55s cubic-bezier(.22, .61, .36, 1), height .55s cubic-bezier(.22, .61, .36, 1);
}
.wlive .wtile:hover { transform: none; box-shadow: none; z-index: 2; outline: none; }
.wlive .wtile.wleaving { opacity: 0; transform: scale(.96); pointer-events: none; }
.wlive .wtile.warriving { animation: rise 460ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards; }
.wlive .wcell {
  position: absolute; inset: 4px; overflow: hidden; border-radius: 10px; border: 1px solid #4A3A24; background: var(--cell);
  display: flex; flex-direction: column; justify-content: flex-end; gap: 2px;
  padding: clamp(5px, calc(14cqi / 16), 14px) clamp(6px, calc(16cqi / 16), 16px) clamp(5px, calc(14cqi / 16), 14px) calc(clamp(6px, calc(16cqi / 16), 16px) + 4px);
  box-shadow: inset 0 0 calc(30px * var(--heat)) rgba(255, 175, 70, calc(.42 * var(--heat))), 0 0 calc(26px * var(--heat)) rgba(244, 150, 50, calc(.30 * var(--heat)));
  transition: box-shadow .6s ease, border-color .6s ease;
}
.wlive .wtile:hover .wcell { border-color: var(--honey); }
.wlive .wtile.wlead .wcell { border-color: rgba(244, 183, 64, .5); }
.wlive .wtile::before, .wlive .wtile::after { content: none; }
.wlive .wcell::before, .wlive .wcell::after { content: ""; position: absolute; inset: 0; pointer-events: none; }
.wlive .wcell::before { background: var(--pic, none) center / cover no-repeat; opacity: .9; }
.wlive .wcell::after { background: linear-gradient(to top, rgba(12, 7, 3, .92) 0%, rgba(12, 7, 3, .5) 46%, rgba(12, 7, 3, .08) 100%); }
.wlive .wcell > * { position: relative; z-index: 1; }
.wlive .wstripe { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; z-index: 2; background: #9C8862; }
.wlive .w-reported .wstripe { background: #F0B84E; }
.wlive .w-seen_direct .wstripe { background: #FF9A3C; }
.wlive .wtile .wh { font-family: "Fraunces", Georgia, "Times New Roman", serif; font-optical-sizing: auto; font-weight: 600; color: var(--cream); line-height: 1.14; }
.wlive .wtile .wh:hover { text-decoration-color: rgba(255, 243, 224, .5); }
.wlive .wfoot { color: var(--dim); }
.wlive .wfoot .wn { color: var(--honey-lite); }
.wlive .wbuzz button { background: linear-gradient(180deg, var(--honey-lite), var(--honey)); color: #1B1206; }
.wlive .wbuzz button:disabled { background: #35291A; color: var(--dimmer); cursor: default; filter: none; }
.wlive .wmine { color: var(--honey-lite); }
.wlive .wplay { flex: none; margin: 0; padding: 0; width: clamp(16px, calc(44cqi / 16), 24px); height: clamp(16px, calc(44cqi / 16), 24px); border-radius: 999px; border: 1px solid rgba(255, 255, 255, .28); background: rgba(255, 255, 255, .12); color: var(--cream); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 60%; }
.wlive .wplay:hover { background: rgba(255, 207, 107, .28); }
.wlive .wripple { position: absolute; z-index: 3; border-radius: 50%; pointer-events: none; background: radial-gradient(circle, rgba(255, 207, 107, .55), rgba(255, 207, 107, 0) 70%); transform: translate(-50%, -50%) scale(0); animation: wripple .8s ease-out forwards; }
@keyframes wripple { to { transform: translate(-50%, -50%) scale(1); opacity: 0; } }
.wlive .wsurge { position: absolute; z-index: 4; left: 50%; top: 10px; transform: translateX(-50%); background: var(--ember); color: #1B1206; font-size: 10px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; white-space: nowrap; animation: wsurge 1.6s ease forwards; }
@keyframes wsurge { 0% { opacity: 0; transform: translate(-50%, 6px); } 15%, 70% { opacity: 1; transform: translateX(-50%); } 100% { opacity: 0; transform: translate(-50%, -6px); } }
.wliveunder { display: grid; grid-template-columns: 1fr; gap: 14px; margin: 14px auto 0; max-width: none; }
@media (min-width: 800px) { .wliveunder { grid-template-columns: 1.1fr 1fr; align-items: start; } }
.wlivehive .wlegend { margin: 0; max-width: none; display: flex; gap: 6px 14px; flex-wrap: wrap; align-items: center; font-size: 12px; color: var(--dim); }
.wlg { display: inline-flex; align-items: center; gap: 6px; }
.wsw { width: 12px; height: 12px; border-radius: 3px; background: #9C8862; }
.wsw.w-reported { background: #F0B84E; }
.wsw.w-seen_direct { background: #FF9A3C; }
.wswarm { border: 1px solid var(--line); border-radius: 14px; background: linear-gradient(180deg, #241B11, #1E1710); padding: 12px 14px; min-height: 96px; }
.wswarmhead { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--dimmer); margin: 0 0 8px; }
.wswarmrow { margin: 0; font-size: 13px; padding: 3px 0; color: var(--dim); animation: wslidein .5s ease; }
.wswarmrow .wwho { color: var(--honey-lite); }
.wswarmrow .wwhat { color: var(--cream); }
.wswarmquiet { color: var(--dimmer); }
@keyframes wslidein { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
.wlivehive .wsave { text-align: center; margin: 14px auto 0; }
.wlivehive .wsaids { margin: 8px 0 0; }
.wlivehive .wsaid { margin: 0 0 10px; }
@media (prefers-reduced-motion: reduce) {
  .wlive .wtile, .wlive .wcell, .wdot { transition: none; }
  .wlive .wripple, .wlive .wsurge, .wlive .wtile.warriving { animation: none; }
  .wlive .wripple, .wlive .wsurge { display: none; }
  .wswarmrow { animation: none; }
}
`;

// ---------------------------------------------------------------------------
// The script
// ---------------------------------------------------------------------------

/**
 * The page's script. Plain, old style JavaScript, no modules, because it is
 * written into the page as text. It runs after HiveAllocator, which the same
 * script element defines above it.
 *
 * The Realtime socket speaks Phoenix's version 1 protocol by hand: one join
 * on a channel for the date carrying a postgres_changes subscription on
 * wall_boosts, a heartbeat every thirty seconds, and a reconnect with a
 * growing wait when the socket closes. After a reconnect the counts are read
 * once from the project, because a buzz that landed while the socket was
 * down never arrives; that read is a reconcile and not a poll.
 */
export const HIVE_LIVE_JS = `
(function () {
  "use strict";
  var dataEl = document.getElementById("hivedata");
  var board = document.getElementById("wboard");
  if (!dataEl || !board || typeof HiveAllocator === "undefined") return;
  var D;
  try { D = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var voice = D.voice || { button: "Buzz", one: "buzz", many: "buzzes", past: "buzzed", imperative: "Buzz" };
  var byId = {};
  var stories = D.stories || [];
  for (var i = 0; i < stories.length; i++) byId[stories[i].id] = stories[i];
  var left = typeof D.left === "number" ? D.left : D.allowance;
  var backed = {};
  (D.backed || []).forEach(function (id) { backed[id] = true; });
  var seenBoosts = {};
  var boostStory = {};
  // A buzz of this reader's that is on its way to the database. Its own row
  // comes back over the socket too, sometimes before the answer does, and it
  // is already counted on the screen.
  var pendingOwn = {};
  var placedOrder = [];
  var sealed = Date.now() >= Date.parse(D.closesAt);
  var q = function (sel, root) { return (root || document).querySelector(sel); };
  var el = function (tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; };
  var text = function (id, value) { var e = document.getElementById(id); if (e) e.textContent = value; };

  function units(n) { return n <= 0 ? "" : n === 1 ? "1 " + voice.one : n + " " + voice.many; }
  function leftSentence(n) {
    var words = ["No", "One", "Two", "Three", "Four"];
    var m = Math.max(0, Math.min(n, 4));
    var tap = m === 1 ? voice.one : voice.many;
    var yesterday = D.allowance === 1;
    if (m === 0) return yesterday ? "No " + voice.many + " left today on this date." : "No " + voice.many + " left today.";
    return yesterday ? words[m] + " " + tap + " left today on this date. It closes tonight." : words[m] + " " + tap + " left today.";
  }

  // The tiles. One per story that holds a place; made on demand for a story
  // the pie brings onto the board, from the same shape the server drew.
  function makeTile(s) {
    var t = el("div", "wtile big w-" + s.tier + " warriving");
    t.id = "w-" + s.id;
    t.setAttribute("role", "listitem");
    t.setAttribute("data-subject", s.subject);
    var cell = el("div", "wcell");
    cell.appendChild(el("span", "wstripe"));
    var h = el("a", "wh"); h.href = s.receipt; h.textContent = s.headline; cell.appendChild(h);
    var mine = el("span", "wmine"); mine.textContent = "You " + voice.past + " this"; cell.appendChild(mine);
    var foot = el("span", "wfoot");
    var kindWrap = el("span"); kindWrap.innerHTML = D.kinds[s.kind] || ""; while (kindWrap.firstChild) foot.appendChild(kindWrap.firstChild);
    if (!sealed && s.status !== "false") {
      var form = el("form", "wbuzz"); form.method = "post"; form.action = "/boost";
      form.innerHTML = '<input type="hidden" name="s"><input type="hidden" name="m" value="' + D.month + '"><input type="hidden" name="d" value="' + D.day + '"><input type="hidden" name="v" value="hive">';
      form.querySelector('input[name="s"]').value = s.id;
      var b = el("button"); b.type = "submit"; b.textContent = voice.button; b.setAttribute("aria-label", voice.button + ": " + s.headline);
      form.appendChild(b); foot.appendChild(form);
    }
    var n = el("span", "wn"); foot.appendChild(n);
    var o = el("span", "wo"); o.textContent = s.outlet; foot.appendChild(o);
    cell.appendChild(foot);
    t.appendChild(cell);
    return t;
  }
  function tileFor(s) {
    var t = document.getElementById("w-" + s.id);
    if (!t) { t = makeTile(s); board.appendChild(t); setTimeout(function () { t.classList.remove("warriving"); }, 500); }
    return t;
  }

  // The song tile plays a short chord on tap, through WebAudio, and never on
  // load: the context is made on the first tap and nowhere else.
  var actx = null;
  function playChord() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var now = actx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = "triangle"; o.frequency.value = f; var t = now + i * 0.12;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.95);
      });
    } catch (e) {}
  }
  function addPlay(s, t) {
    if (s.kind !== "song" || q(".wplay", t)) return;
    var foot = q(".wfoot", t); if (!foot) return;
    var p = el("button", "wplay"); p.type = "button"; p.title = "Play a chord for the number one song"; p.setAttribute("aria-label", p.title);
    p.innerHTML = "&#9654;";
    p.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); playChord(); });
    var n = q(".wn", foot);
    foot.insertBefore(p, n);
  }

  // The pie. The same allocator the worker runs, on the same inputs: the
  // stories that earned a place, with the counts as they are now.
  function inputs() {
    var out = [];
    for (var i = 0; i < stories.length; i++) {
      var s = stories[i];
      if (s.status === "false") { if (s.rect) out.push({ id: s.id, tier: s.tier, support: 0, placedAt: s.placedAt, anchor: s.rect, frozen: true }); continue; }
      if (s.status !== "placed" && s.status !== "overflow") continue;
      out.push({ id: s.id, tier: s.tier, support: s.support, score: s.score, priority: s.priority, placedAt: s.placedAt, anchor: null, subjectKind: s.subjectKind, outlet: s.outlet });
    }
    return out;
  }
  function linesFor(h) { return h <= 3 ? 3 : h === 4 ? 5 : h === 5 ? 7 : h === 6 ? 9 : 11; }
  function paintTile(s, r, index, max) {
    var t = tileFor(s);
    t.style.setProperty("--x", r.mx); t.style.setProperty("--y", r.my);
    t.style.setProperty("--w", r.w); t.style.setProperty("--h", r.h);
    t.style.setProperty("--tw", r.w); t.style.setProperty("--lines", linesFor(r.h)); t.style.setProperty("--i", index);
    t.classList.toggle("wh3", r.h <= 3);
    t.classList.toggle("wlead", index === 0 && s.support > 0);
    var heat = s.support <= 0 ? 0 : 0.15 + 0.85 * Math.pow(s.support / Math.max(1, max), 0.8);
    var cell = q(".wcell", t); if (cell) cell.style.setProperty("--heat", heat.toFixed(3));
    // A tile the server drew for a story nobody had buzzed has no count
    // element, because a tile never says nought; it gets one on its first buzz.
    var n = q(".wn", t);
    if (!n) { var foot = q(".wfoot", t); if (foot) { n = el("span", "wn"); foot.insertBefore(n, q(".wo", foot)); } }
    if (n) n.textContent = units(s.support);
    if (backed[s.id]) { t.classList.add("wbacked"); var m = q(".wmine", t); if (m) m.style.display = "block"; var b = q(".wbuzz button", t); if (b) b.disabled = true; }
    addPlay(s, t);
    t.classList.remove("wleaving");
    t.hidden = false;
  }
  function layout() {
    var result = null;
    try { result = HiveAllocator.allocate(inputs()); } catch (e) { result = null; }
    var placed;
    if (result === null) {
      // A story stamped false holds its rectangle and the worker's growth
      // engine owns this board. The rectangles it stored stand.
      placed = [];
      for (var i = 0; i < stories.length; i++) { var s = stories[i]; if (s.rect && (s.status === "placed" || s.status === "false")) placed.push({ id: s.id, mx: s.rect.mx, my: s.rect.my, w: s.rect.w, h: s.rect.h }); }
    } else {
      placed = result.placed;
    }
    var max = 1;
    placed.forEach(function (p) { max = Math.max(max, byId[p.id] ? byId[p.id].support : 0); });
    var keep = {};
    placedOrder = placed.map(function (p) { return p.id; });
    placed.forEach(function (p, index) { keep[p.id] = true; paintTile(byId[p.id], p, index, max); });
    var tiles = board.querySelectorAll(".wtile");
    for (var k = 0; k < tiles.length; k++) {
      var t = tiles[k];
      var id = t.id.slice(2);
      if (!keep[id] && !t.classList.contains("wleaving")) {
        t.classList.add("wleaving");
        (function (gone) { setTimeout(function () { if (gone.classList.contains("wleaving")) gone.remove(); }, 600); })(t);
      }
    }
    board.classList.toggle("wblank", placed.length === 0);
    var nothing = q(".wnothing", board); if (nothing && placed.length > 0) nothing.remove();
    var total = 0; stories.forEach(function (s) { total += s.support; });
    var totalEl = document.getElementById("wtotal");
    if (totalEl) { totalEl.textContent = String(total); var after = totalEl.nextSibling; if (after && after.nodeType === 3) after.textContent = " " + (total === 1 ? voice.one : voice.many) + " so far"; }
  }
  function rankOf(id) { return placedOrder.indexOf(id); }

  // What a buzz looks like: a gold ripple from where it landed, and a flag
  // when the story climbs past the one above it.
  function ripple(t, ev) {
    if (reduce || !t) return;
    var cell = q(".wcell", t) || t;
    var r = cell.getBoundingClientRect();
    var cx = ev && typeof ev.clientX === "number" && ev.clientX ? ev.clientX - r.left : r.width / 2;
    var cy = ev && typeof ev.clientY === "number" && ev.clientY ? ev.clientY - r.top : r.height / 2;
    var size = Math.max(r.width, r.height) * 1.6;
    var rip = el("span", "wripple");
    rip.style.left = cx + "px"; rip.style.top = cy + "px"; rip.style.width = size + "px"; rip.style.height = size + "px";
    cell.appendChild(rip); setTimeout(function () { rip.remove(); }, 850);
  }
  function overtook(t) {
    if (reduce || !t) return;
    var flag = el("span", "wsurge"); flag.textContent = "Overtook";
    (q(".wcell", t) || t).appendChild(flag); setTimeout(function () { flag.remove(); }, 1700);
  }
  function bump(s, delta, ev) {
    var before = rankOf(s.id);
    s.support = Math.max(0, s.support + delta);
    layout();
    var t = document.getElementById("w-" + s.id);
    if (delta > 0) {
      ripple(t, ev);
      var after = rankOf(s.id);
      if (before >= 0 && after >= 0 && after < before) overtook(t);
    }
  }

  // The swarm: who just buzzed. Nobody is named, because nobody can be:
  // the boost row carries no reader and the page is shown none.
  var swarm = document.getElementById("wswarm");
  function swarmLine(who, s) {
    if (!swarm) return;
    var quiet = q(".wswarmquiet", swarm); if (quiet) quiet.remove();
    var row = el("p", "wswarmrow");
    var whoEl = el("span", "wwho"); whoEl.textContent = who;
    var whatEl = el("span", "wwhat");
    var head = s ? s.headline : "a story in the feed";
    whatEl.textContent = head.length > 60 ? head.slice(0, 60).replace(/\\s+\\S*$/, "") + "\\u2026" : head;
    row.appendChild(whoEl); row.appendChild(document.createTextNode(" " + voice.past + " \\u201c")); row.appendChild(whatEl); row.appendChild(document.createTextNode("\\u201d"));
    swarm.insertBefore(row, swarm.firstChild);
    while (swarm.children.length > 6) swarm.removeChild(swarm.lastChild);
  }

  // The reader's own buzzes.
  function paintBudget() {
    var dots = document.getElementById("wdots");
    if (dots) { var ds = dots.querySelectorAll(".wdot"); for (var i = 0; i < ds.length; i++) ds[i].classList.toggle("wspent", i >= left); }
    text("wleft", leftSentence(left));
  }
  function say(id) {
    var all = document.querySelectorAll(".wsaid"); for (var i = 0; i < all.length; i++) all[i].classList.remove("wshow");
    var e = document.getElementById(id); if (e) e.classList.add("wshow");
  }
  function post(path, storyId) {
    var body = "s=" + encodeURIComponent(storyId) + "&m=" + D.month + "&d=" + D.day + "&v=hive";
    return fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: body })
      .then(function (r) { return r.ok ? r.json() : null; });
  }
  var undoTimer = null;
  function offerUndo(s) {
    var kept = document.getElementById("wkept"); if (!kept) return;
    var old = q(".wundoline", kept); if (old) old.remove();
    var line = el("div", "wundoline");
    var form = el("form", "wundo"); form.method = "post"; form.action = "/unboost";
    var b = el("button"); b.type = "button"; b.textContent = "Undo"; b.setAttribute("aria-label", "Undo that " + voice.one + ": " + s.headline);
    form.appendChild(b); line.appendChild(form);
    var note = el("span", "wundonote"); note.textContent = "Thirty seconds, for a tap you did not mean."; line.appendChild(note);
    kept.appendChild(line);
    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = setTimeout(function () { line.remove(); }, 30000);
    b.addEventListener("click", function () {
      b.disabled = true;
      post("/unboost", s.id).then(function (a) {
        var word = a && typeof a.result === "string" ? a.result : "failed";
        if (word === "undone") {
          if (a && typeof a.support === "number") { s.support = a.support; layout(); } else { bump(s, -1, null); }
          if (a && typeof a.left === "number") left = a.left; else left = Math.min(D.allowance, left + 1);
          delete backed[s.id];
          var t = document.getElementById("w-" + s.id);
          if (t) { t.classList.remove("wbacked"); var m = q(".wmine", t); if (m) m.style.display = ""; var bb = q(".wbuzz button", t); if (bb) bb.disabled = false; }
          paintBudget(); say("wundone"); line.remove();
        } else {
          say(word === "closed" ? "wclosed" : word === "failed" ? "wfailed" : "wtoolate"); line.remove();
        }
      }).catch(function () { say("wfailed"); line.remove(); });
    });
  }
  function youBuzz(s, ev) {
    if (sealed) { say("wclosed"); return; }
    if (backed[s.id]) { say("walready"); return; }
    if (left <= 0) { say("wspent"); return; }
    left -= 1; paintBudget();
    backed[s.id] = true;
    pendingOwn[s.id] = true;
    bump(s, 1, ev);
    swarmLine("You", s);
    post("/boost", s.id).then(function (a) {
      delete pendingOwn[s.id];
      var word = a && typeof a.result === "string" ? a.result : "failed";
      if (a && typeof a.left === "number") left = a.left;
      if (word === "kept") {
        if (typeof a.support === "number") { s.support = a.support; layout(); }
        if (typeof a.boost_id === "number" || typeof a.boost_id === "string") { seenBoosts[String(a.boost_id)] = true; boostStory[String(a.boost_id)] = s.id; }
        say("wkept"); offerUndo(s);
      } else {
        // Refused. The count goes back to what the database says it is.
        if (typeof a.support === "number") { s.support = a.support; } else { s.support = Math.max(0, s.support - 1); }
        if (word !== "already") { delete backed[s.id]; var t = document.getElementById("w-" + s.id); if (t) { t.classList.remove("wbacked"); var m = q(".wmine", t); if (m) m.style.display = ""; var bb = q(".wbuzz button", t); if (bb) bb.disabled = false; } }
        if (word === "failed" || word === "bad") left = Math.min(D.allowance, left + 1);
        layout();
        say({ already: "walready", spent: "wspent", not_yet: "wnotyet", closed: "wclosed", "false": "wfalse" }[word] || "wfailed");
      }
      paintBudget();
    }).catch(function () {
      delete pendingOwn[s.id];
      s.support = Math.max(0, s.support - 1); delete backed[s.id]; left = Math.min(D.allowance, left + 1);
      var t = document.getElementById("w-" + s.id); if (t) { t.classList.remove("wbacked"); var m = q(".wmine", t); if (m) m.style.display = ""; var bb = q(".wbuzz button", t); if (bb) bb.disabled = false; }
      layout(); paintBudget(); say("wfailed");
    });
  }
  board.addEventListener("click", function (ev) {
    var button = ev.target && ev.target.closest ? ev.target.closest(".wbuzz button") : null;
    if (!button) return;
    var t = button.closest(".wtile"); if (!t) return;
    var s = byId[t.id.slice(2)]; if (!s) return;
    ev.preventDefault();
    youBuzz(s, ev);
  });
  board.addEventListener("submit", function (ev) {
    var form = ev.target;
    if (form && form.classList && form.classList.contains("wbuzz")) {
      ev.preventDefault();
      var t = form.closest(".wtile"); var s = t ? byId[t.id.slice(2)] : null;
      if (s) youBuzz(s, null);
    }
  });

  // Other people's buzzes, over Realtime.
  var dot = document.getElementById("wlivedot");
  var word = document.getElementById("wliveword");
  function setLive(on, label) { if (dot) dot.classList.toggle("won", on); if (word) word.textContent = label; }
  function onBoost(record) {
    if (!record || String(record.wall_date) !== D.date) return;
    var id = String(record.id);
    if (seenBoosts[id]) return;
    seenBoosts[id] = true;
    var s = byId[record.story_id];
    if (s && pendingOwn[s.id]) { boostStory[id] = s.id; delete pendingOwn[s.id]; return; }
    if (s) { boostStory[id] = s.id; bump(s, typeof record.units === "number" ? record.units : 1, null); }
    swarmLine("Someone", s || null);
  }
  function onUnboost(old) {
    if (!old) return;
    var id = String(old.id);
    var storyId = boostStory[id];
    if (!storyId) return;
    delete boostStory[id];
    var s = byId[storyId]; if (s) bump(s, -1, null);
  }
  function reconcile() {
    var url = D.project + "/rest/v1/wall_stories?select=id,support&wall_date=eq." + encodeURIComponent(D.date);
    fetch(url, { headers: { apikey: D.key, Authorization: "Bearer " + D.key, Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (!rows || !rows.length) return;
        var changed = false;
        rows.forEach(function (row) { var s = byId[row.id]; if (s && typeof row.support === "number" && s.support !== row.support) { s.support = row.support; changed = true; } });
        if (changed) layout();
      }).catch(function () {});
  }
  var socket = null, ref = 0, heartbeat = null, wait = 1000, everJoined = false, closedByUs = false;
  function send(topic, event, payload) {
    if (!socket || socket.readyState !== 1) return;
    ref += 1;
    socket.send(JSON.stringify({ topic: topic, event: event, payload: payload, ref: String(ref) }));
  }
  function connect() {
    if (sealed || !D.project || !D.key || typeof WebSocket === "undefined") return;
    var base = D.project.replace(/^http/, "ws");
    try { socket = new WebSocket(base + "/realtime/v1/websocket?apikey=" + encodeURIComponent(D.key) + "&vsn=1.0.0"); } catch (e) { return; }
    var topic = "realtime:hive:" + D.date;
    socket.onopen = function () {
      wait = 1000;
      send(topic, "phx_join", {
        config: {
          broadcast: { self: false }, presence: { key: "" },
          postgres_changes: [
            { event: "INSERT", schema: "public", table: "wall_boosts", filter: "wall_date=eq." + D.date },
            { event: "DELETE", schema: "public", table: "wall_boosts" }
          ]
        },
        access_token: D.key
      });
      heartbeat = setInterval(function () { send("phoenix", "heartbeat", {}); }, 30000);
    };
    socket.onmessage = function (m) {
      var msg; try { msg = JSON.parse(m.data); } catch (e) { return; }
      if (msg.event === "phx_reply" && msg.topic === topic && msg.payload && msg.payload.status === "ok") {
        if (everJoined) reconcile();
        everJoined = true;
        setLive(true, "The hive is awake");
        return;
      }
      if (msg.event === "postgres_changes" && msg.payload && msg.payload.data) {
        var data = msg.payload.data;
        if (data.table !== "wall_boosts") return;
        if (data.type === "INSERT") onBoost(data.record);
        if (data.type === "DELETE") onUnboost(data.old_record);
      }
    };
    socket.onclose = function () {
      if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
      socket = null;
      if (closedByUs) return;
      setLive(false, "Reconnecting");
      setTimeout(connect, wait);
      wait = Math.min(30000, wait * 2);
    };
    socket.onerror = function () { try { socket && socket.close(); } catch (e) {} };
  }

  // The clock to the seal.
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function tick() {
    var ms = Date.parse(D.closesAt) - Date.now();
    var s = Math.max(0, Math.floor(ms / 1000));
    text("wclock", two(Math.floor(s / 3600)) + ":" + two(Math.floor((s % 3600) / 60)) + ":" + two(s % 60));
    if (ms <= 0 && !sealed) {
      sealed = true;
      setLive(false, "Sealed");
      var buttons = board.querySelectorAll(".wbuzz button"); for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;
      closedByUs = true; try { socket && socket.close(); } catch (e) {}
    }
  }

  stories.forEach(function (s) { if (backed[s.id]) { var t = document.getElementById("w-" + s.id); if (t) { t.classList.add("wbacked"); } } });
  paintBudget();
  layout();
  tick(); setInterval(tick, 1000);
  connect();
  window.addEventListener("pagehide", function () { closedByUs = true; try { socket && socket.close(); } catch (e) {} });
})();
`;

/** Which sentences the page can show after a buzz: the same ids afterwords writes. */
export const LIVE_SAID_IDS = ["wkept", "wundone", "wtoolate", "walready", "wspent", "wnotyet", "wclosed", "wfalse", "wfailed"] as const;
