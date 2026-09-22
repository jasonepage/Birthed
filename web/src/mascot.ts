// The bee. The hive's mascot since the unit became a buzz, drawn here for the
// first time on the website, September 22, 2026, because Jason's mom asked
// for one.
//
// Drawn in the page as markup rather than loaded as a picture, the same as
// the honeycomb: the site sends img-src 'self', and an inline svg element is
// neither a request nor an image, so it cannot be refused or fail to load.
// Its own drawing, one stroke colour, the honey the rest of the hive uses.

export function beeSvg(className: string = ""): string {
  return `<svg class="bee${className ? ` ${className}` : ""}" viewBox="0 0 48 40" width="48" height="40" aria-hidden="true" focusable="false">`
    + `<g class="beewings">`
    + `<ellipse cx="20" cy="11" rx="7.5" ry="10" fill="#EAF6FF" fill-opacity=".8" stroke="var(--on-honey)" stroke-width="1.6" transform="rotate(-22 20 11)"/>`
    + `<ellipse cx="29" cy="10.5" rx="6.5" ry="9" fill="#EAF6FF" fill-opacity=".65" stroke="var(--on-honey)" stroke-width="1.6" transform="rotate(16 29 10.5)"/>`
    + `</g>`
    + `<path d="M8.6 25.2 3.4 26.8 8.8 28.6Z" fill="var(--on-honey)"/>`
    + `<ellipse cx="24" cy="26" rx="15.5" ry="11" fill="#FFC93C" stroke="var(--on-honey)" stroke-width="2"/>`
    + `<path d="M17.5 15.6c-1.7 6.6-1.7 14.2 0 20.8M25 15c-1.8 7-1.8 15 0 22" fill="none" stroke="var(--on-honey)" stroke-width="3.4" stroke-linecap="round"/>`
    + `<path d="M34 16.5c1-4.4 3.2-7 6.2-7.6M31 16c-.2-4.6 1.2-7.8 3.6-9.4" fill="none" stroke="var(--on-honey)" stroke-width="1.6" stroke-linecap="round"/>`
    + `<circle cx="40.6" cy="8.8" r="1.5" fill="var(--on-honey)"/><circle cx="34.8" cy="6.4" r="1.5" fill="var(--on-honey)"/>`
    + `<circle cx="34.4" cy="23.4" r="2" fill="var(--on-honey)"/><circle cx="35" cy="22.8" r=".6" fill="#FFF"/>`
    + `<path d="M33.6 28.6c1.4 1.3 3.2 1.4 4.6.2" fill="none" stroke="var(--on-honey)" stroke-width="1.5" stroke-linecap="round"/>`
    + `</svg>`;
}

export const MASCOT_STYLE = `
.bee { display: inline-block; flex: none; width: 30px; height: auto; vertical-align: -8px; overflow: visible; }
.bee .beewings { transform-origin: 25px 18px; transform-box: view-box; }
.whead .bee { width: 26px; margin-right: 6px; vertical-align: -7px; }
.wcombkick .bee { width: 22px; margin-right: 6px; vertical-align: -6px; }
.wsaid .bee { width: 30px; margin-right: 8px; vertical-align: -9px; }
@keyframes beeflap { from { transform: scaleY(1); } to { transform: scaleY(.55); } }
@keyframes beebob { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-3px) rotate(3deg); } }
@keyframes beefly {
  0% { opacity: 0; transform: translate(-70px, -26px) rotate(-18deg) scale(.7); }
  60% { opacity: 1; transform: translate(6px, 2px) rotate(8deg) scale(1.05); }
  100% { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: no-preference) {
  .bee .beewings { animation: beeflap 90ms ease-in-out infinite alternate; }
  .whead .bee, .wcombkick .bee { animation: beebob 2.6s ease-in-out infinite; }
  .wsaid .bee { animation: beefly 900ms cubic-bezier(.2, .8, .2, 1) both; }
}
`;
