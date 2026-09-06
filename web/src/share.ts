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
import { splitDatePrefix } from "./timeline.js";

/** One thing that happened, for the card. */
export interface Highlight {
  year: number;
  text: string;
}

/**
 * Words that keep a line off a birthday card.
 *
 * This exists because of what the data actually looks like rather than out of
 * caution. 41 percent of the 19,734 Wikipedia events match this list, every
 * one of the 366 dates has at least one that does, and if the card took the
 * most recent event for its date then 134 of the 366 cards would carry a
 * killing, a bombing or a crash. September 4's most recent is a school
 * shooting. That is not a thing to put next to a lit candle and somebody's
 * birthday, and it is the kind of mistake that gets screenshotted for exactly
 * the wrong reason.
 *
 * The list is deliberately broad and deliberately stupid. It does not
 * understand anything; it only refuses. A false refusal costs one card its
 * extra line, and the card is complete without it.
 */
const NOT_ON_A_BIRTHDAY_CARD =
  /\b(kill|killed|kills|killing|massacre|shooting|shoots|shot|murder|murdered|bomb|bombing|bombed|attack|attacked|dies|died|death|deaths|dead|crash|crashed|crashes|earthquake|hurricane|tsunami|famine|war|battle|siege|executed|execution|assassinat\w*|rape|raped|slaughter|genocide|terror\w*|hostage|riot|riots|invasion|invades|invaded|disaster|sank|sinking|sunk|explosion|exploded|epidemic|pandemic|plague|suicide|abduct\w*|torture\w*)\b/i;

/** Long enough to say something, short enough to read at a glance. */
const LONGEST_LINE = 110;

/**
 * The one thing that happened, chosen for a card.
 *
 * Drawn from the researched facts rather than from Wikipedia's events, and
 * that is the important part. The fact finder is already steered away from
 * encyclopedia shaped content and toward things somebody would screenshot, so
 * it is the curated set; Wikipedia's date articles lean the other way, toward
 * wars, disasters and elections, because that is what an encyclopedia is for.
 *
 * The shortest passing fact wins. Not because short means good, but because
 * the card has one line of room and the alternative is choosing at random. It
 * is stable across rebuilds for the same reason, so the image for a date does
 * not change every deploy for no reason.
 *
 * Returns null rather than reaching for something worse. 85 of the 366 dates
 * have no researched facts at all, and their cards stay exactly as they are
 * today, which is a card that already works.
 */
export function cardHighlight(facts: Fact[], month: number, day: number): Highlight | null {
  const month_name = monthName(month);
  const usable: Highlight[] = [];

  for (const fact of facts) {
    if (NOT_ON_A_BIRTHDAY_CARD.test(fact.fact)) continue;
    const { year, text } = splitDatePrefix(fact.fact, month_name, day);
    if (year === null) continue;
    if (text.length > LONGEST_LINE) continue;
    usable.push({ year, text });
  }

  if (usable.length === 0) return null;
  usable.sort((a, b) => a.text.length - b.text.length || a.year - b.year);
  return usable[0] ?? null;
}

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
  <g transform="translate(400.19 148) scale(4.4632)">
    <path d="M 50 3 C 53 20, 63 28, 68 40 C 73 51, 73 58, 73 65 C 73 81, 63 95, 50 95 C 37 95, 27 81, 27 65 C 27 55, 33 47, 39 39 C 41 43, 43 46, 46 48 C 46 34, 46 17, 50 3 Z" fill="url(#flame)"/>
    <path d="M 50 40 C 52 52, 60 58, 60 68 C 60 80, 55 87, 49 87 C 43 87, 38 80, 38 69 C 38 59, 47 52, 50 40 Z" fill="url(#hot)"/>
  </g>
</svg>`;

export function renderShareCard(page: DayPage, highlight: Highlight | null = null): string {
  const name = `${monthName(page.month)} ${page.day}`;
  // Two names rather than three when there is something else to say. A third
  // name is one more of the thing every competitor already has; the line about
  // what happened is the thing none of them can put on a card.
  const names = page.people.slice(0, highlight ? 2 : 3);

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
