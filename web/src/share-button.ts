// The share control, on the two kinds of page that have one: a story's
// receipt, and a reader's card.
//
// Everywhere else on this site runs no script, and these two run exactly this
// one. It is a constant, and the security header names it by its hash rather
// than allowing inline scripts in general, so a story page, which carries a
// source's words, cannot be made to run anything else even if an escape were
// ever missed. The hash is computed from the same constant the page prints,
// in the same process, so the two cannot drift apart the way a hash pasted
// into a header can. Decided September 22, 2026.
//
// What it does, and all it does:
//
//   Share      opens the phone's own share sheet (the Web Share interface),
//              with the picture itself when the page has one and the phone
//              can take a file, and with the page's address otherwise.
//   Copy link  puts the page's address on the clipboard.
//
// Both buttons are hidden in the page as sent and the script shows only the
// ones the browser can do, so a browser with no share sheet never shows a
// button that does nothing. It sends nothing anywhere: the one request it can
// make is for the picture, from this site, before anybody taps.

import { createHash } from "node:crypto";

/**
 * The site's own escape, repeated rather than imported: render.ts imports this
 * file for its stylesheet, and importing render.ts back would make the two
 * depend on which loads first.
 */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export const SHARE_SCRIPT = `(function () {
  var box = document.querySelector("[data-sharebox]");
  if (!box) return;
  var url = box.getAttribute("data-url") || location.href;
  var title = box.getAttribute("data-title") || document.title;
  var fileAt = box.getAttribute("data-file");
  var say = box.querySelector(".sharesay");
  var share = box.querySelector(".shareit");
  var copy = box.querySelector(".sharecopy");
  var file = null;
  function tell(words) { if (say) say.textContent = words; }
  if (fileAt && window.fetch && window.File) {
    fetch(fileAt, { credentials: "same-origin" }).then(function (r) { return r.ok ? r.blob() : null; }).then(function (blob) {
      if (!blob) return;
      var f = new File([blob], "birthed.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) file = f;
    }).catch(function () {});
  }
  if (navigator.share && share) {
    share.hidden = false;
    share.addEventListener("click", function () {
      var data = file ? { files: [file], title: title } : { title: title, url: url };
      navigator.share(data).catch(function () {});
    });
  }
  if (navigator.clipboard && copy) {
    copy.hidden = false;
    copy.addEventListener("click", function () {
      navigator.clipboard.writeText(url).then(function () { tell("Link copied."); }, function () { tell(url); });
    });
  }
})();`;

/** The value for script-src: this script and no other. */
export const SHARE_SCRIPT_SOURCE = `'sha256-${createHash("sha256").update(SHARE_SCRIPT).digest("base64")}'`;

/**
 * The buttons, and the script that wakes them.
 *
 * `url` is the address to share, absolute. `file` is a picture on this site
 * to share instead of the address when the phone can take one.
 */
export function shareBlock(options: { url: string; title: string; file?: string; lead?: string }): string {
  const file = options.file === undefined ? "" : ` data-file="${escapeHtml(options.file)}"`;
  return `<div class="sharebox" data-sharebox data-url="${escapeHtml(options.url)}" data-title="${escapeHtml(options.title)}"${file}>
${options.lead ? `<span class="sharelead">${escapeHtml(options.lead)}</span>` : ""}<button type="button" class="shareit" hidden>Share</button><button type="button" class="sharecopy" hidden>Copy link</button><span class="sharesay" role="status"></span>
</div>
<script>${SHARE_SCRIPT}</script>`;
}

export const SHARE_STYLE = `
.sharebox { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; font-size: 14px; }
.sharebox .sharelead { color: #A49BAE; margin-right: 2px; }
.sharebox button { font: inherit; font-weight: 700; font-size: 14px; padding: 7px 14px; border-radius: 999px; border: 1px solid #3A3348; background: #1E1A27; color: #FFF7EE; cursor: pointer; }
.sharebox button.shareit { background: #E7A83A; border-color: #E7A83A; color: #2A1A08; }
.sharebox button:hover { border-color: #FFD98A; }
.sharebox button[hidden] { display: none; }
.sharebox .sharesay { color: #FFD98A; font-weight: 600; }
`;
