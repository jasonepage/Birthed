// The bee. The hive's mascot since the unit became a buzz, drawn here for the
// first time on the website, September 22, 2026, because Jason's mom asked
// for one.
//
// Drawn in the page as markup rather than loaded as a picture, the same as
// the honeycomb: the site sends img-src 'self', and an inline svg element is
// neither a request nor an image, so it cannot be refused or fail to load.
// Its own drawing, one stroke colour, the honey the rest of the hive uses.

export function beeSvg(className: string = ""): string {
  // The bee from the hero art since October 18, 2026, design/hero/parts.py,
  // served from this site, so the image policy stays 'self'. A picture rather
  // than inline markup: the drawing carries its own gradients, and the same
  // ids written into a page three times would collide.
  return `<img class="bee${className ? ` ${className}` : ""}" src="/hero/bee-signal.svg" alt="" width="320" height="220" decoding="async">`;
}

export const MASCOT_STYLE = `
.bee { display: inline-block; flex: none; width: 40px; height: auto; vertical-align: -8px; filter: drop-shadow(0 5px 12px rgba(0, 0, 0, .34)); }
.whead .bee { width: 38px; margin-right: 5px; vertical-align: -7px; }

.wsaid .bee { width: 42px; margin-right: 7px; vertical-align: -9px; }
@keyframes beebob { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-2px) rotate(1deg); } }
@keyframes beefly {
  0% { opacity: 0; transform: translate(-48px, -18px) rotate(-12deg) scale(.82); }
  60% { opacity: 1; transform: translate(4px, 1px) rotate(3deg) scale(1.03); }
  100% { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: no-preference) {
  .whead .bee { animation: beebob 2.6s ease-in-out infinite; }
  .wsaid .bee { animation: beefly 900ms cubic-bezier(.2, .8, .2, 1) both; }
}
`;
