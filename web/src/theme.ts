// One look for birthed.app, taken from the live hive, September 22, 2026.
//
// Before this file every stylesheet on the site carried its own colours as
// raw hex, and only the full screen hive was honey and dark: the date page,
// About, the comb and the receipt were cool violet with pink and lavender
// accents, in Georgia, while the hive was Fraunces on honeycomb. Two design
// systems on one site read as two products. notes/web-redesign-brief.md.
//
// The tokens are custom properties on :root, so every stylesheet reads the
// same values and a colour changes in one place. The names are the hive's
// own, because the hive is the page that already looked designed.

/** The page behind everything: near black with a little warmth in it. */
export const BG = "#120D08";
/** The warm light at the top of the page, the hive's radial glow. */
export const BG_GLOW = "#2A1D0C";
/** A cell, a card, a row: one step up from the page. */
export const CELL = "#1E1710";
/** A second cell tone for something lifted above a cell. */
export const CELL_2 = "#261D12";
/** A hairline on a cell. */
export const LINE = "#3A2E1C";
/** A border that has to be seen: an outlined button, a picked chip. */
export const LINE_STRONG = "#4A3A24";
/** The honey: the one accent, buttons, counts, marks. */
export const HONEY = "#F4B740";
/** Lighter honey for a hover, a highlight, a label on the dark. */
export const HONEY_LITE = "#FFCF6B";
/** Ember: live, now, today, a story somebody just buzzed. */
export const EMBER = "#FF8A3D";
/** Words on the dark. */
export const CREAM = "#FFF3E0";
/** Body copy, a step under the cream so headings still lead. */
export const CREAM_2 = "#E8DCC8";
/** Quiet words: credits, hosts, dates under a row. 4.65 to one on the cell. */
export const DIM = "#B7A488";
/** Quieter still: a kicker, a disabled control. */
export const DIMMER = "#8A7A63";
/** Words on a honey button. Never white, never cream. */
export const ON_HONEY = "#1B1206";
/** The wordmark's pink. It is the brand and it does not move. Nothing else is pink. */
export const PINK = "#EF5680";

/** The serif for every heading and every headline. Georgia only while Fraunces loads. */
export const SERIF = `"Fraunces", Georgia, "Times New Roman", serif`;
/** The system sans for body copy, the same on every page. */
export const SANS = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

/**
 * Fraunces, served from this origin under /fonts with its Open Font License
 * beside it. Every page names it now, not the live hive alone, which is why
 * serve.ts sends font-src 'self' on every page: without that the browser
 * refuses the file silently and the page looks almost right in Georgia.
 */
export const FONT_FACES = `
@font-face { font-family: "Fraunces"; font-style: normal; font-weight: 100 900; font-display: swap; src: url("/fonts/fraunces-latin-wght-normal.woff2") format("woff2-variations"); }
@font-face { font-family: "Fraunces"; font-style: italic; font-weight: 100 900; font-display: swap; src: url("/fonts/fraunces-latin-wght-italic.woff2") format("woff2-variations"); }
`;

/** The tokens, as the first rules of every stylesheet. */
export const THEME = `${FONT_FACES}
:root {
  color-scheme: dark;
  --bg: ${BG}; --bg-glow: ${BG_GLOW};
  --cell: ${CELL}; --cell-2: ${CELL_2}; --line: ${LINE}; --line-strong: ${LINE_STRONG};
  --honey: ${HONEY}; --honey-lite: ${HONEY_LITE}; --ember: ${EMBER};
  --cream: ${CREAM}; --cream-2: ${CREAM_2}; --dim: ${DIM}; --dimmer: ${DIMMER}; --on-honey: ${ON_HONEY};
  --pink: ${PINK};
  --serif: ${SERIF}; --sans: ${SANS};
}
`;
