// The image that shows up when somebody posts a date page into a group chat,
// a story or a timeline.
//
// On a growth-first bet this is not decoration, it is the product's only
// distribution surface that travels on its own. A link with no card is a grey
// box nobody clicks.
//
// Rendered as HTML at 1200 by 630, which is what every platform crops to, and
// screenshotted at build time so the shipped artefact is a plain PNG.

import type { Fact } from "./facts.js";
import { DayPage, monthName } from "./model.js";
import { escapeHtml } from "./render.js";
import { cardHighlight, type Highlight } from "./highlight.js";
import { splitDatePrefix, type DayEvent } from "./timeline.js";
import { subjectOf, units, viewportFor, voiceFor, type Viewport, type Voice, type WallDay, type WallStory } from "./wall.js";



/** Shortest wins, ties by year, so a card reads well and never changes on a rebuild. */

const INK = "#0E0C16";
const ACCENT = "#EF5680";
const CREAM = "#FFF7EE";

/** The candle from the app icon, so the card and the icon are the same object. */
const CANDLE = `<svg width="262" height="458" viewBox="380 120 264 800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="flame" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#FFE08A"/><stop offset="0.45" stop-color="#FFC24A"/>
      <stop offset="1" stop-color="#FF8A3D"/>
    </linearGradient>
    <linearGradient id="hot" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFF0C2"/>
    </linearGradient>
    <linearGradient id="wax" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#241031"/><stop offset="0.3" stop-color="#4A2456"/>
      <stop offset="1" stop-color="#1B0B24"/>
    </linearGradient>
    <clipPath id="body"><path d="M 465 556 H 559 A 28 28 0 0 1 587 584 V 920 H 437 V 584 A 28 28 0 0 1 465 556 Z"/></clipPath>
  </defs>
  <path d="M 465 556 H 559 A 28 28 0 0 1 587 584 V 920 H 437 V 584 A 28 28 0 0 1 465 556 Z" fill="url(#wax)"/>
  <g clip-path="url(#body)"><g transform="rotate(-36 512 790)">
    <rect x="300" y="380" width="500" height="54" fill="#FFF3E2" opacity="0.94"/>
    <rect x="300" y="506" width="500" height="54" fill="#FFF3E2" opacity="0.94"/>
    <rect x="300" y="632" width="500" height="54" fill="#FFF3E2" opacity="0.94"/>
    <rect x="300" y="758" width="500" height="54" fill="#FFF3E2" opacity="0.94"/>
    <rect x="300" y="884" width="500" height="54" fill="#FFF3E2" opacity="0.94"/>
  </g></g>
  <g transform="translate(288.84 148) scale(4.4632)">
    <path d="M 50 3 C 53 20, 63 28, 68 40 C 73 51, 73 58, 73 65 C 73 81, 63 95, 50 95 C 37 95, 27 81, 27 65 C 27 55, 33 47, 39 39 C 41 43, 43 46, 46 48 C 46 34, 46 17, 50 3 Z" fill="url(#flame)"/>
    <path d="M 50 40 C 52 52, 60 58, 60 68 C 60 80, 55 87, 49 87 C 43 87, 38 80, 38 69 C 38 59, 47 52, 50 40 Z" fill="url(#hot)"/>
  </g>
</svg>`;

/**
 * The hive a card draws, when the date has one with tiles on it: the day,
 * and each pictured subject's picture, as something the card's browser can
 * load with no origin to resolve it against.
 *
 * og.ts hands in the bytes, as a data address. Neither of the two shapes
 * that point outward works: the card is screenshotted from a page put up
 * with setContent, so "/covers/x.jpg" resolves against nothing, and a
 * file:// address is refused outright as a local resource. See the note on
 * `picture` in og.ts, which is where that was found.
 */
export interface CardHive {
  day: WallDay;
  pictures: Map<string, string>;
}

/**
 * The card for a date that has a hive: the name on the left, the board on
 * the right with its covers, so a link to a date looks like the board.
 * Decided September 10, 2026. The tiles are the stored rectangles through
 * the same viewport the page uses, drawn once more here rather than by
 * reusing the page's markup, because the page's tiles are links and forms
 * inside a container query and a card is a still picture at one size.
 */
function hiveCard(page: DayPage, hive: CardHive): string {
  const name = `${monthName(page.month)} ${page.day}`;
  const day = hive.day;
  const onWall = day.stories.filter((s) => s.rect !== null && (s.status === "placed" || s.status === "false"));
  const view = viewportFor(onWall.map((s) => s.rect!));
  const voice = voiceFor(page.month, page.day);
  const sealed = day.closedAt !== null || Date.parse(day.closesAt) <= Date.now();
  const backed = onWall.filter((s) => s.support > 0).length;
  const tone: Record<WallStory["tier"], string> = { claimed: "#EFE0B8", reported: "#E7A83A", seen_direct: "#B05A0C" };
  const tiles = onWall.map((s) => {
    const r = s.rect!;
    const subject = subjectOf(s);
    const pic = subject === null ? undefined : hive.pictures.get(subject);
    const pictured = pic !== undefined;
    const style = `grid-column:${r.mx - view.ox + 1} / span ${r.w};grid-row:${r.my - view.oy + 1} / span ${r.h};background:${pictured ? `linear-gradient(to top, rgba(20,12,4,.94) 0%, rgba(20,12,4,.55) 50%, rgba(20,12,4,.1) 100%), url(&quot;${escapeHtml(pic)}&quot;) center / cover` : tone[s.tier]}`;
    const lines = r.h <= 3 ? 3 : r.h === 4 ? 4 : 6;
    const count = units(s.support, voice);
    return `<div class="t${pictured || s.tier === "seen_direct" ? " light" : ""}" style="${style};--lines:${lines}"><span class="h">${escapeHtml(s.headline)}</span><span class="f">${count === "" ? "" : `<b>${count}</b> `}${escapeHtml(s.outlet)}</span></div>`;
  }).join("\n");
  const few = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const word = (n: number): string => few[n] ?? String(n);
  const line = sealed
    ? `What ${onWall.length === 1 ? "one story" : `${onWall.length} stories`} people here thought would still matter. Sealed for good.`
    : backed > 0
      ? `${onWall.length} stories on the hive, ${word(backed)} of them ${voice.past}. Open until midnight Eastern.`
      : `${onWall.length} stories on the hive. Open until midnight Eastern. What people ${voice.past === "buzzed" ? "buzz" : "back"} gets bigger.`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden; background: ${INK};
    color: ${CREAM}; display: flex; align-items: center; gap: 44px; padding: 0 56px 0 72px;
    font: 400 24px/1.4 -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; position: relative;
  }
  .bloom {
    position: absolute; left: -260px; top: -300px; width: 900px; height: 900px;
    border-radius: 50%; background: radial-gradient(circle, rgba(239,86,128,0.30), rgba(239,86,128,0) 60%);
  }
  .body { position: relative; flex: 1 1 auto; min-width: 0; }
  .kicker { font-size: 20px; font-weight: 800; letter-spacing: 0.26em; color: ${ACCENT}; text-transform: uppercase; margin-bottom: 14px; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-weight: 800; font-size: 88px; line-height: 0.98; letter-spacing: -0.02em; margin-bottom: 8px; }
  .yr { font-family: Georgia, "Times New Roman", serif; font-size: 40px; color: #EFE0B8; margin-bottom: 26px; }
  .line { font-size: 24px; line-height: 1.4; color: #C9C2D4; max-width: 24ch; text-wrap: pretty; }
  .foot { position: absolute; left: 72px; bottom: 42px; color: #7A7280; font-size: 22px; letter-spacing: 0.06em; font-weight: 600; }
  .board {
    position: relative; flex: 0 0 540px; width: 540px; height: 540px; padding: 3px; border-radius: 14px; background: #100D16;
    display: grid; gap: 3px; grid-template-columns: repeat(${view.side}, 1fr); grid-template-rows: repeat(${view.side}, 1fr);
    box-shadow: inset 0 0 0 1px rgba(255,247,238,.1), 0 30px 60px rgba(0,0,0,.5);
    --m: ${(534 / view.side).toFixed(2)}px;
  }
  .t { position: relative; overflow: hidden; border-radius: 4px; color: #2A1A08; display: flex; flex-direction: column; justify-content: space-between; padding: calc(var(--m) * .16) calc(var(--m) * .18); }
  .t.light { color: ${CREAM}; justify-content: flex-end; }
  .t .h {
    font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: calc(var(--m) * .36); line-height: 1.2; text-wrap: pretty;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--lines, 3); overflow: hidden;
  }
  .t .f { font-size: calc(var(--m) * .22); opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: calc(var(--m) * .1); }
  .t .f b { font-weight: 800; }
</style></head>
<body>
  <div class="bloom"></div>
  <div class="body">
    <p class="kicker">The hive for</p>
    <h1>${name}</h1>
    <p class="yr">${day.year}</p>
    <p class="line">${line}</p>
  </div>
  <div class="board">
${tiles}
  </div>
  <p class="foot">birthed.app</p>
</body></html>`;
}

export function renderShareCard(page: DayPage, highlight: Highlight | null = null, hive: CardHive | null = null): string {
  const name = `${monthName(page.month)} ${page.day}`;
  // A date with a hive shows the hive. The card is the one piece of the
  // site that travels on its own, and the board is the product now.
  if (hive !== null && hive.day.stories.some((s) => s.rect !== null && (s.status === "placed" || s.status === "false"))) {
    return hiveCard(page, hive);
  }
  // No names at all when there is something that happened to say instead.
  //
  // Not a layout preference. The list is ordered by how much attention a
  // person gets and infamy is attention, so "You share it with" led with John
  // Wayne Gacy on March 17, Mussolini on July 29, Ed Gein on August 27,
  // Charles Manson on November 12 and Ted Bundy on November 24, with Hitler
  // and Göring second on two more. September 11's card said "You share it
  // with Bashar al-Assad", which is the case that matters most, because no
  // word list would have caught it: Wikidata calls him a politician.
  //
  // That is the whole argument for cutting rather than filtering. There is no
  // field anywhere in the data that means "not on a birthday card", so a
  // filter is a list somebody has to keep adding to forever, and every miss
  // ships. A card with one thing that happened on it needs no list, and it was
  // the better card regardless: the names are what every competitor already
  // has and the line about the date is the half none of them can print.
  //
  // The 89 dates with no researched fact still show names, because names are
  // all they have. The fix for those is to finish searching the 85 dates the
  // backfill never reached, not to start keeping a list of people.
  const names = highlight ? [] : page.people.slice(0, 3);

  const rows = names.map((person) => `<li>
  <span class="year">${person.birthYear ?? ""}</span>
  <span class="name">${escapeHtml(person.name)}</span>
</li>`).join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden; background: ${INK};
    color: ${CREAM}; display: flex; align-items: center; gap: 40px;
    padding: 0 72px;
    font: 400 24px/1.4 -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    position: relative;
  }
  .bloom {
    position: absolute; right: -120px; top: -220px; width: 860px; height: 860px;
    border-radius: 50%; background: radial-gradient(circle, rgba(239,86,128,0.34), rgba(239,86,128,0) 60%);
  }
  /* The candle runs off the bottom edge, the way the app icon does. One
     that stops in mid air reads as a mistake. */
  .mark { position: relative; flex: 0 0 auto; margin: 0 26px -78px 0; align-self: flex-end; }
  .body { position: relative; flex: 1 1 auto; min-width: 0; }
  .kicker {
    font-size: 20px; font-weight: 800; letter-spacing: 0.26em; color: ${ACCENT};
    text-transform: uppercase; margin-bottom: 14px;
  }
  h1 {
    font-family: Georgia, "Times New Roman", serif; font-weight: 800;
    font-size: 96px; line-height: 0.98; letter-spacing: -0.02em; margin-bottom: 26px;
  }
  .with { font-size: 22px; color: #A79FA9; margin-bottom: 14px; }
  /* What happened. Set above the names because it is the half of this card
     that nobody else can print. */
  .happened {
    display: flex; align-items: baseline; gap: 16px; margin-bottom: 26px;
    padding-bottom: 24px; border-bottom: 1px solid #2A2434;
  }
  .happened .when {
    color: ${ACCENT}; font-variant-numeric: tabular-nums; font-weight: 700;
    font-size: 26px; flex: 0 0 auto;
  }
  .happened .what {
    font-family: Georgia, "Times New Roman", serif; font-size: 27px;
    line-height: 1.28; color: ${CREAM}; min-width: 0;
  }
  ul { list-style: none; padding: 0; display: grid; gap: 10px; }
  li { display: flex; align-items: baseline; gap: 18px; }
  .year {
    color: ${ACCENT}; font-variant-numeric: tabular-nums; font-weight: 700;
    font-size: 26px; width: 82px; flex: 0 0 82px;
  }
  .name {
    font-size: 34px; font-weight: 600; white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis;
  }
  .foot {
    position: absolute; left: 72px; bottom: 42px; color: #7A7280;
    font-size: 22px; letter-spacing: 0.06em; font-weight: 600;
  }
</style></head>
<body>
  <div class="bloom"></div>
  <div class="body">
    <p class="kicker">Born on</p>
    <h1>${name}</h1>
    ${highlight ? `<div class="happened"><span class="when">${highlight.year}</span><span class="what">${escapeHtml(highlight.text)}</span></div>` : ""}
    ${names.length > 0 ? `<p class="with">You share it with</p><ul>${rows}</ul>` : ""}
  </div>
  <div class="mark">${CANDLE}</div>
  <p class="foot">birthed.app</p>
</body></html>`;
}

// ---------------------------------------------------------------------------
// The square
// ---------------------------------------------------------------------------

/**
 * The square is 1080 by 1080, which is what a picture saved out of a page and
 * put somewhere else is expected to be.
 *
 * Why a second shape at all, when the wide card above already draws the board.
 * The wide card is a link preview and its job is to sit in a strip 1200 by 630,
 * so the board is squeezed into a 540 pixel column beside the date and the
 * tiles come out smaller than the page draws them. The square is the board at
 * its own proportions, which is the shape the thing actually is, and it is the
 * one somebody saves.
 */
const SQUARE = 1080;

/** The three tones of honey, the same three the board uses. */
const TONE: Record<WallStory["tier"], string> = {
  claimed: "#EFE0B8",
  reported: "#E7A83A",
  seen_direct: "#B05A0C",
};

/**
 * What a tile carries and how it is drawn, shared by the square and the
 * personal square below so the two cannot drift apart.
 *
 * **Size is what the colour was going to be.** Every seeded story is
 * `claimed`, so all three tones are one tone in practice, which
 * `docs/the-wall.md` section 15 already wrote down. So the square leans on the
 * thing that is real: a tile's size is the buzzes it took, and the covers and
 * the faces are already on disk. The tones stay in the code because the day a
 * second source lands on a story they start working again, and nothing here
 * pretends they are working now.
 */
function squareTiles(hive: CardHive, view: Viewport, voice: Voice, pulled: string | null = null): string {
  const onWall = hive.day.stories.filter((s) => s.rect !== null && (s.status === "placed" || s.status === "false"));
  return onWall.map((s) => {
    const r = s.rect!;
    const subject = subjectOf(s);
    const pic = subject === null ? undefined : hive.pictures.get(subject);
    const pictured = pic !== undefined;
    const back = pictured
      ? `linear-gradient(to top, rgba(20,12,4,.94) 0%, rgba(20,12,4,.55) 50%, rgba(20,12,4,.1) 100%), url(&quot;${escapeHtml(pic)}&quot;) center / cover`
      : TONE[s.tier];
    const style = `grid-column:${r.mx - view.ox + 1} / span ${r.w};grid-row:${r.my - view.oy + 1} / span ${r.h};background:${back}`;
    // How many lines of headline the height allows. The same hint the page's
    // own tiles take, so a tall tile reads as a tall tile here too.
    const lines = r.h <= 3 ? 3 : r.h === 4 ? 4 : 6;
    const count = units(s.support, voice);
    const dim = pulled !== null && s.id !== pulled ? " dim" : "";
    const lit = pulled !== null && s.id === pulled ? " lit" : "";
    return `<div class="t${pictured || s.tier === "seen_direct" ? " light" : ""}${dim}${lit}" style="${style};--lines:${lines}"><span class="h">${escapeHtml(s.headline)}</span><span class="f">${count === "" ? "" : `<b>${count}</b> `}${escapeHtml(s.outlet)}</span></div>`;
  }).join("\n");
}

/** The stylesheet both squares share. `boardPx` is how many pixels the board gets. */
function squareStyle(view: Viewport, boardPx: number): string {
  return `
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${SQUARE}px; height: ${SQUARE}px; overflow: hidden; background: ${INK}; color: ${CREAM};
    font: 400 24px/1.4 -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    position: relative; display: flex; flex-direction: column; align-items: center; padding: 34px 36px 30px;
  }
  .bloom {
    position: absolute; left: -300px; top: -340px; width: 1000px; height: 1000px; border-radius: 50%;
    background: radial-gradient(circle, rgba(239,86,128,0.26), rgba(239,86,128,0) 60%);
  }
  .top { position: relative; width: 100%; display: flex; align-items: baseline; gap: 18px; margin-bottom: 18px; }
  .kicker { font-size: 19px; font-weight: 800; letter-spacing: 0.24em; color: ${ACCENT}; text-transform: uppercase; }
  .top h1 { font-family: Georgia, "Times New Roman", serif; font-weight: 800; font-size: 54px; line-height: 1; letter-spacing: -0.02em; }
  .top .yr { font-family: Georgia, "Times New Roman", serif; font-size: 30px; color: #EFE0B8; margin-left: auto; }
  .board {
    position: relative; flex: 0 0 auto; width: ${boardPx}px; height: ${boardPx}px; padding: 4px; border-radius: 16px; background: #100D16;
    display: grid; gap: 4px; grid-template-columns: repeat(${view.side}, 1fr); grid-template-rows: repeat(${view.side}, 1fr);
    box-shadow: inset 0 0 0 1px rgba(255,247,238,.1), 0 30px 60px rgba(0,0,0,.5);
    --m: ${((boardPx - 8) / view.side).toFixed(2)}px;
  }
  .t {
    position: relative; overflow: hidden; border-radius: 6px; color: #2A1A08;
    display: flex; flex-direction: column; justify-content: space-between; padding: calc(var(--m) * .13) calc(var(--m) * .15);
  }
  .t.light { color: ${CREAM}; justify-content: flex-end; }
  .t.dim { opacity: .34; }
  .t.lit { box-shadow: 0 0 0 4px ${ACCENT}; z-index: 2; }
  .t .h {
    font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: calc(var(--m) * .30); line-height: 1.18; text-wrap: pretty;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--lines, 3); overflow: hidden;
  }
  .t .f { font-size: calc(var(--m) * .19); opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: calc(var(--m) * .08); }
  .t .f b { font-weight: 800; }
  .foot { position: relative; width: 100%; margin-top: auto; display: flex; align-items: baseline; gap: 16px; padding-top: 18px; }
  .foot .line { font-size: 21px; color: #C9C2D4; text-wrap: pretty; min-width: 0; }
  .foot .mark { margin-left: auto; color: #7A7280; font-size: 20px; letter-spacing: 0.06em; font-weight: 600; flex: 0 0 auto; }
`;
}

/** How a hive's state reads in one sentence, in the date's own voice. */
function squareLine(hive: CardHive, voice: Voice): string {
  const day = hive.day;
  const onWall = day.stories.filter((s) => s.rect !== null && (s.status === "placed" || s.status === "false"));
  const sealed = day.closedAt !== null || Date.parse(day.closesAt) <= Date.now();
  const backed = onWall.filter((s) => s.support > 0).length;
  const few = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const word = (n: number): string => few[n] ?? String(n);
  if (sealed) return `What ${onWall.length === 1 ? "one story" : `${onWall.length} stories`} people here thought would still matter. Sealed for good.`;
  if (backed > 0) return `${onWall.length} stories, ${word(backed)} of them ${voice.past}. Open until midnight Eastern.`;
  return `${onWall.length} stories. Open until midnight Eastern. What people ${voice.past === "buzzed" ? "buzz" : "back"} gets bigger.`;
}

/**
 * The square for a date that has a board with tiles on it.
 *
 * The board takes as much of the square as the date line above it and the one
 * sentence below it leave, which is 880 pixels, so a tile is between 55 and 110
 * pixels a module and a headline is set from the module. That is the whole
 * reason this shape exists: at 540 pixels in the wide card the same headline is
 * half the size and a reader has to know what they are looking at already.
 */
function hiveSquare(page: DayPage, hive: CardHive): string {
  const name = `${monthName(page.month)} ${page.day}`;
  const voice = voiceFor(page.month, page.day);
  const onWall = hive.day.stories.filter((s) => s.rect !== null && (s.status === "placed" || s.status === "false"));
  const view = viewportFor(onWall.map((s) => s.rect!));
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>${squareStyle(view, 880)}</style></head>
<body>
  <div class="bloom"></div>
  <div class="top">
    <span class="kicker">The hive for</span>
    <h1>${name}</h1>
    <span class="yr">${hive.day.year}</span>
  </div>
  <div class="board">
${squareTiles(hive, view, voice)}
  </div>
  <div class="foot">
    <span class="line">${squareLine(hive, voice)}</span>
    <span class="mark">birthed.app</span>
  </div>
</body></html>`;
}

/**
 * The square for a date with no board, which today is 362 of the 366.
 *
 * It is not an apology and it is not a picture of nothing. It is the one
 * sourced thing that happened on the date, set as large as it will go, which
 * is the half of this site nobody else can print, plus a quiet line saying
 * when the hive opens. A date with no researched fact either falls back to the
 * three names, because names are all it has.
 */
function emptySquare(page: DayPage, highlight: Highlight | null): string {
  const name = `${monthName(page.month)} ${page.day}`;
  const names = highlight ? [] : page.people.slice(0, 3);
  const rows = names.map((person) => `<li><span class="year">${person.birthYear ?? ""}</span><span class="nm">${escapeHtml(person.name)}</span></li>`).join("\n");
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${SQUARE}px; height: ${SQUARE}px; overflow: hidden; background: ${INK}; color: ${CREAM};
    font: 400 24px/1.4 -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    position: relative; display: flex; flex-direction: column; justify-content: center; padding: 72px;
  }
  .bloom {
    position: absolute; right: -200px; top: -280px; width: 940px; height: 940px; border-radius: 50%;
    background: radial-gradient(circle, rgba(239,86,128,0.32), rgba(239,86,128,0) 60%);
  }
  /* Every line stops short of the candle's column. A sentence that runs
     under the flame is the one fault a picture like this cannot carry, and
     the candle is the fixed object, so the text is what yields. */
  .col { position: relative; width: 660px; }
  .kicker { font-size: 21px; font-weight: 800; letter-spacing: 0.26em; color: ${ACCENT}; text-transform: uppercase; margin-bottom: 16px; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-weight: 800; font-size: 104px; line-height: 0.96; letter-spacing: -0.02em; }
  .what {
    margin-top: 40px; padding-top: 36px; border-top: 1px solid #2A2434;
    font-family: Georgia, "Times New Roman", serif; font-size: 44px; line-height: 1.24; text-wrap: pretty;
  }
  .what .when { display: block; color: ${ACCENT}; font-family: -apple-system, Helvetica, Arial, sans-serif; font-variant-numeric: tabular-nums; font-weight: 700; font-size: 30px; margin-bottom: 14px; }
  ul { list-style: none; padding: 0; margin-top: 40px; padding-top: 36px; border-top: 1px solid #2A2434; display: grid; gap: 18px; }
  li { display: flex; align-items: baseline; gap: 22px; }
  .year { color: ${ACCENT}; font-variant-numeric: tabular-nums; font-weight: 700; font-size: 30px; width: 96px; flex: 0 0 96px; }
  .nm { font-size: 42px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .soon { margin-top: 38px; color: #C9C2D4; font-size: 23px; line-height: 1.45; text-wrap: pretty; }
  .mark { position: absolute; left: 72px; bottom: 56px; color: #7A7280; font-size: 21px; letter-spacing: 0.06em; font-weight: 600; }
  .cand { position: absolute; right: 40px; bottom: -84px; opacity: .92; }
</style></head>
<body>
  <div class="bloom"></div>
  <div class="col">
    <p class="kicker">Born on</p>
    <h1>${name}</h1>
    ${highlight ? `<p class="what"><span class="when">${highlight.year}</span>${escapeHtml(highlight.text)}</p>` : ""}
    ${names.length > 0 ? `<ul>${rows}</ul>` : ""}
    <p class="soon">Its hive opens the day before, and everything<br>with a birthday on ${name} goes on it.</p>
  </div>
  <p class="mark">birthed.app</p>
  <div class="cand">${CANDLE}</div>
</body></html>`;
}

/**
 * The square for a date, whichever kind it is. One entry point, so a caller
 * never has to know which of the two it is getting: a date with tiles gets its
 * board, and every other date gets an honest picture rather than none.
 */
export function renderSquare(page: DayPage, highlight: Highlight | null = null, hive: CardHive | null = null): string {
  if (hive !== null && hive.day.stories.some((s) => s.rect !== null && (s.status === "placed" || s.status === "false"))) {
    return hiveSquare(page, hive);
  }
  return emptySquare(page, highlight);
}

/** The size the square is rendered and shipped at, for the head tags and the shooter. */
export const SQUARE_SIDE = SQUARE;

export { cardHighlight, type Highlight };
