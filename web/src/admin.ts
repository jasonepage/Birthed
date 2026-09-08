// The curation panel.
//
// A static page like every other page here. It carries the publishable key,
// the same one already inside the iOS app and inside /add, and it is the
// curator's own sign in that decides what they can do. Nothing is protected by
// this page being hard to find: every rule is a row level security policy
// checked against the caller's token, so the worst somebody gets from reading
// the source is the shape of a form. See 20260907210000_admins.sql.
//
// Written against fetch and nothing else, no client library, because the
// policy this page runs under names one origin it may talk to and a library
// loaded from a content delivery network would need a second one.

import { SITE, escapeHtml, head } from "./render.js";


/**
 * The points, as plain JavaScript in a string, because it runs in the panel's
 * script and in the tests and there must be exactly one copy of it. No
 * backticks and no dollar-brace inside, since it is pasted into a template.
 *
 * Built the way osu! builds performance points, for four properties and not
 * for the number: computed from stored inputs and never hand set, comparable
 * across dates, top heavy so three excellent rows beat forty mediocre ones,
 * and a ranking rather than a judgement. docs/panel-brief.md, section 4.
 *
 * It never reaches a public page, an API a reader can hit, or the share card.
 * A test asserts the date page does not contain it.
 */
export const POINTS_JS = `
  // Each component is a column or a count, and each is worth points. The
  // parts are returned as well as the total so a curator can argue with
  // "reach 12", which is a conversation, instead of with "58", which is not.
  // Wikipedia's pick is worth ten, not forty. At forty the top of September 8
  // was five editors' picks from 1888, which is the filler this site exists
  // to replace. The big component is the spike: what the cited article does
  // on the date itself, which is people bringing the thing up on the day.
  var WEIGHTS = { spike: 35, reach: 25, memory: 25, selected: 10, written: 15, sourcing: 10 };
  var FLAG_COST = {
    "release calendar": 20, "explains the joke": 10, "thin": 15,
    "unsourced": 10, "source did not answer": 10, "circa source": 5,
  };
  var SOURCING = { primary: 10, news: 7, encyclopedia: 4, circa: 0, none: 0 };
  /** Where a source sits on the ladder in docs/internet-culture.md. */
  function sourcingOf(url, dateKind) {
    if (!url) return "none";
    var u = String(url).toLowerCase();
    if (/knowyourmeme\\.com/.test(u)) return dateKind === "went_viral" ? "encyclopedia" : "circa";
    if (/wikipedia\\.org|wikidata\\.org|britannica\\.com/.test(u)) return "encyclopedia";
    if (/web\\.archive\\.org|archive\\.today|archive\\.ph|twitter\\.com|x\\.com|youtube\\.com|youtu\\.be|reddit\\.com|tiktok\\.com|vine\\.co|instagram\\.com|steamcommunity\\.com|store\\.steampowered\\.com|minecraft\\.wiki|patchnotes|changelog|\\.gov\\/|nasa\\.gov/.test(u)) return "primary";
    return "news";
  }
  /** Living memory: a curve on the year, full between 1985 and 2015. */
  function memoryOf(year) {
    if (year === null || year === undefined || isNaN(year)) return 0;
    if (year >= 1985 && year <= 2015) return WEIGHTS.memory;
    if (year < 1985) return Math.max(0, Math.round(WEIGHTS.memory * (1 - (1985 - year) / 40)));
    return Math.max(0, Math.round(WEIGHTS.memory * (1 - (year - 2015) / 12)));
  }
  /** Reach: log scaled yearly pageviews, a million a year is the full score. */
  function reachOf(views) {
    if (views === null || views === undefined) return null;
    var v = Math.max(0, Number(views) || 0);
    return Math.round(WEIGHTS.reach * Math.min(1, Math.log10(v + 1) / 6));
  }
  /**
   * The anniversary spike: views on the date against the median day. Twice
   * the median earns a little, sixteen times earns the full score. Under a
   * floor of fifty views on the day it is noise and earns nothing.
   */
  function spikeOf(onDate, medianDay) {
    if (onDate === null || onDate === undefined || medianDay === null || medianDay === undefined) return null;
    var on = Number(onDate) || 0;
    var med = Math.max(1, Number(medianDay) || 0);
    if (on < 50) return 0;
    var ratio = on / med;
    if (ratio < 1.5) return 0;
    return Math.round(WEIGHTS.spike * Math.min(1, Math.log2(ratio) / 4));
  }
  /**
   * One row's points. Input fields: selected (bool), views (number, or null
   * when unmeasured), year, written (bool), sourceUrl, dateKind, flags (names),
   * answers ({there, remembers, heard, never} or null).
   *
   * A reader answer REPLACES the estimate. It does not average with it. The
   * whole estimate is a guess standing in for the measurement this site
   * exists to collect, and when the measurement arrives the guess gets out of
   * the way. That is the first thing this function does, so nothing below it
   * can leak back in. Ten answers is the floor, the same floor the public
   * site uses before it prints a count.
   */
  function rowPoints(input) {
    var a = input.answers;
    if (a) {
      var total = (a.there || 0) + (a.remembers || 0) + (a.heard || 0) + (a.never || 0);
      if (total >= 10) {
        var kept = ((a.there || 0) + (a.remembers || 0)) * 2 + (a.heard || 0);
        var pts = Math.round(100 * kept / (2 * total));
        return { total: pts, measured: true, parts: [["remembered", pts, kept + " of " + (2 * total) + " from " + total + " answers, and this replaces every estimate below"]] };
      }
    }
    var parts = [];
    var spike = spikeOf(input.viewsOnDate, input.viewsMedianDay);
    parts.push(["spike", spike === null ? 0 : spike, spike === null ? "unmeasured"
      : (Number(input.viewsOnDate) || 0).toLocaleString() + " views on the day against " + (Number(input.viewsMedianDay) || 0).toLocaleString() + " on an ordinary day"]);
    var reach = reachOf(input.views);
    parts.push(["reach", reach === null ? 0 : reach, reach === null ? "unmeasured" : (Number(input.views) || 0).toLocaleString() + " views a year on the cited article"]);
    parts.push(["selected", input.selected ? WEIGHTS.selected : 0, input.selected ? "Wikipedia's editors chose it for the day" : "not among Wikipedia's picks for the day"]);
    parts.push(["memory", memoryOf(input.year), input.year ? "the year " + input.year : "no year"]);
    parts.push(["written", input.written ? WEIGHTS.written : 0, input.written ? "somebody wrote it" : "a bare title or nobody wrote a line"]);
    var ladder = sourcingOf(input.sourceUrl, input.dateKind);
    parts.push(["sourcing", SOURCING[ladder], ladder]);
    (input.flags || []).forEach(function (f) {
      if (FLAG_COST[f]) parts.push([f, -FLAG_COST[f], "flagged"]);
    });
    var sum = 0;
    parts.forEach(function (p) { sum += p[1]; });
    return { total: Math.max(0, sum), measured: false, parts: parts };
  }
  /**
   * A date's points: the decayed sum of its rows, best first, each worth 95
   * percent of the one before. Three excellent rows beat forty mediocre
   * ones. Adding a fifth dull row moves a date almost not at all; fixing its
   * top row moves it a lot. That is the property that answers "which of 366
   * dates do I work on tonight".
   */
  function datePoints(rowTotals) {
    var sorted = rowTotals.slice().sort(function (x, y) { return y - x; });
    var sum = 0;
    for (var i = 0; i < sorted.length; i++) sum += sorted[i] * Math.pow(0.95, i);
    return Math.round(sum);
  }
`;

export function renderAdmin(api: { url: string; key: string }): string {
  return `${head(
    "Birthed curation",
    "Internal.",
    `${SITE}/admin/`,
    undefined,
    // noindex. This is not a page for readers and it must never be a search
    // result, whatever it does or does not let anybody do.
    true,
  )}
<style>
.panel { max-width: 1100px; }
.signin { max-width: 420px; margin: 40px 0; }
.months { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin: 20px 0 0; }
.mon h4 { margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #9C9490; }
.cells { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.cell {
  aspect-ratio: 1; border: 0; border-radius: 3px; cursor: pointer;
  font-size: 10px; color: #0E0C16; font-variant-numeric: tabular-nums;
  display: flex; align-items: center; justify-content: center; padding: 0;
}
/* A flag is a named rule from docs/internet-culture.md, checked against the
   row's own words. Set quietly, because it is an argument and not a verdict:
   plenty of good rows carry one and the curator overrules it by pressing a. */
.flags { margin: 10px 0 0; display: flex; flex-wrap: wrap; gap: 6px; }
.flag {
  font-size: 11px; font-weight: 700; letter-spacing: .04em; padding: 3px 8px;
  border-radius: 999px; background: rgba(192, 138, 62, .18); color: #E0B060;
  cursor: help;
}
.flags .ok { font-size: 11px; color: #6FBF8A; }
.qflag { color: #E0B060; }
/* The rest of the date, under the row being judged. Reviewing five rows an
   hour apart with no reference point is the hardest judgement there is, and
   it is what lets mid rows through at two in the morning. */
.also { margin: 14px 0 0; padding: 12px 0 0; border-top: 1px solid rgba(255, 247, 238, .10); }
.alsolab { margin: 0 0 6px; font-size: 11px; color: #827B75; }
.alsorow { margin: 0 0 4px; font-size: 13px; color: #B9B2AD; }
.gap { margin: 6px 0 0; color: #E0B060; }
/* What a row is, beside what it says. The button next to it carries the verb. */
.state {
  font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
  color: #827B75;
}
.state.live { color: #6FBF8A; }
.checked { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6E8F7B; }
.why { margin: 6px 0 0; font-size: 12px; color: #827B75; font-style: italic; }
/* A scan's argument about a row. Deliberately quiet and deliberately a
   sentence: a number would be a thing the curator has to trust and a sentence
   is a thing they can disagree with. */
.verdict { margin: 6px 0 0; font-size: 12px; color: #9C9490; line-height: 1.45; }
.verdict.agrees .vtag { background: rgba(111, 191, 138, .16); color: #6FBF8A; }
.vtag {
  display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: .08em;
  text-transform: uppercase; padding: 2px 7px; border-radius: 999px; margin-right: 6px;
  background: rgba(192, 138, 62, .18); color: #E0B060;
}
.vby { color: #5E5852; font-size: 11px; }
.c0 { background: #3A3348; color: #9C9490; }
.c1 { background: #6E5A4A; color: #FFF7EE; }
.c2 { background: #C08A3E; }
.c3 { background: #6FBF8A; }
.cell.sel { outline: 2px solid #EF5680; outline-offset: 1px; }
.legend { display: flex; gap: 14px; font-size: 12px; color: #9C9490; margin: 14px 0 0; align-items: center; }
.sw { width: 11px; height: 11px; border-radius: 3px; display: inline-block; margin-right: 5px; }
.rows { margin: 18px 0 0; }
.row {
  border-top: 1px solid #2A2434; padding: 12px 0; display: grid;
  grid-template-columns: 58px 1fr auto; gap: 0 14px; align-items: start;
}
.row .yr { font-size: 13px; color: #9C9490; font-variant-numeric: tabular-nums; }
.row .tx { font-size: 15px; margin: 0; line-height: 1.45; }
.row .meta { font-size: 12px; color: #827B75; margin: 4px 0 0; }
.row .meta a { color: #827B75; }
.act { background: none; border: 1px solid #3A3348; color: #B9B2AD; border-radius: 4px;
  font-size: 12px; padding: 5px 9px; cursor: pointer; white-space: nowrap; }
.act:hover { border-color: #EF5680; color: #FFF7EE; }
.act.on { border-color: #6FBF8A; color: #6FBF8A; }
.tagpill { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #827B75; }
.form2 { display: grid; gap: 10px; margin: 16px 0 0; }
.form2 input, .form2 select, .form2 textarea {
  background: #171326; border: 1px solid #3A3348; color: #FFF7EE;
  border-radius: 5px; padding: 9px 11px; font: inherit; font-size: 14px; width: 100%;
}
.form2 textarea { min-height: 70px; resize: vertical; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.note { font-size: 13px; color: #9C9490; margin: 10px 0 0; min-height: 18px; }
.note.bad { color: #FF9BB6; }
.note.good { color: #6FBF8A; }
h3.dh { font-family: Georgia, serif; font-size: 24px; margin: 26px 0 0; }
.card {
  border: 1px solid #3A3348; border-radius: 8px; padding: 20px 22px; margin: 16px 0 0;
  background: #171326;
}
.card .when { font-size: 13px; color: #9C9490; font-variant-numeric: tabular-nums; }
.card .sent { font-family: Georgia, serif; font-size: 21px; line-height: 1.4; margin: 10px 0 0; }
.card .src { font-size: 13px; margin: 12px 0 0; }
.card .src a { color: #9C9490; }
.keys { display: flex; gap: 8px; margin: 16px 0 0; flex-wrap: wrap; align-items: center; }
kbd {
  background: #241E36; border: 1px solid #3A3348; border-bottom-width: 2px; border-radius: 4px;
  padding: 1px 6px; font: inherit; font-size: 12px; color: #B9B2AD;
}
.c4 { background: #8A6BBF; color: #FFF7EE; }
.st { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; padding: 1px 6px;
  border-radius: 3px; margin-right: 6px; }
.st-published { background: #1F4633; color: #8FE0B4; }
.st-candidate { background: #332A4D; color: #C0A9F0; }
.st-rejected { background: #2A2434; color: #7A736D; }
.qcount { font-variant-numeric: tabular-nums; }
.ask { margin: 14px 0 0; }
.asklede { font-size: 13px; color: #9C9490; margin: 0 0 10px; line-height: 1.5; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px; }
.chip {
  background: none; border: 1px solid #3A3348; color: #B9B2AD; border-radius: 999px;
  font: inherit; font-size: 12px; padding: 5px 11px; cursor: pointer;
}
.chip:hover { border-color: #EF5680; color: #FFF7EE; }
.chip.on { border-color: #6FBF8A; color: #6FBF8A; }
#focus {
  background: #171326; border: 1px solid #3A3348; color: #FFF7EE;
  border-radius: 5px; padding: 9px 11px; font: inherit; font-size: 14px;
  width: 100%; min-height: 74px; resize: vertical;
}
.act:disabled { opacity: .45; cursor: default; border-color: #3A3348; color: #827B75; }
/* A row can take focus, so the keys work on it. The ring is the only thing
   that says which row a key will act on, so it is not subtle. */
.row[tabindex]:focus { outline: none; box-shadow: inset 3px 0 0 #EF5680; padding-left: 10px; }
.row .btns { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
/* The draft. Three lines to choose between, the chosen one in a box to edit,
   and the page it was drawn from underneath in case the line says more than
   the record does. Nothing here is saved until the key is pressed. */
.draft { grid-column: 1 / -1; margin: 10px 0 4px; padding: 12px 14px; border: 1px solid #3A3348; border-radius: 8px; background: #120F1E; }
.draft .cand { display: block; width: 100%; text-align: left; background: none; border: 1px solid #2A2434; color: #E9E1DB; border-radius: 6px; padding: 8px 10px; margin: 0 0 6px; font: inherit; font-size: 14px; cursor: pointer; }
.draft .cand:hover, .draft .cand.on { border-color: #6FBF8A; }
.draft .cand kbd { margin-right: 8px; }
.draft textarea { width: 100%; min-height: 56px; background: #171326; border: 1px solid #3A3348; color: #FFF7EE; border-radius: 5px; padding: 8px 10px; font: inherit; font-size: 14px; resize: vertical; margin: 6px 0 0; }
.draft .keys { margin-top: 8px; }
.draft details { margin-top: 8px; font-size: 12px; color: #827B75; }
.draft details p { margin: 6px 0 0; line-height: 1.5; max-height: 160px; overflow: auto; }
.draft .to { font-size: 11px; color: #827B75; margin: 0 0 8px; }
/* The points, in parts. The total is the first thing and the parts are the
   rest of the line, each with its reason on hover. A measured total, one
   readers gave, is blue, the colour the site already means "what people
   said" with. */
.pts { margin: 6px 0 0; font-size: 11.5px; color: #827B75; font-variant-numeric: tabular-nums; }
.pts b { display: inline-block; min-width: 34px; color: #E9E1DB; font-size: 13px; margin-right: 8px; }
.pts b.measured { color: #6FA5DE; }
.pts .dim { color: #5E5852; font-style: italic; }
.pts details.why { display: inline; }
.pts details.why > summary { display: inline; cursor: pointer; color: #6E8F7B; list-style: none; margin-left: 6px; }
.pts details.why > summary::-webkit-details-marker { display: none; }
.pts details.why > span { display: block; margin: 6px 0 0; color: #827B75; line-height: 1.6; }
.did { color: #6FBF8A; font-weight: 600; }
.dp { color: #E9E1DB; font-size: 15px; }
h4.sh { margin: 22px 0 0; font-size: 13px; color: #9C9490; }
details.offpage { margin: 18px 0 0; }
details.offpage > summary { cursor: pointer; font-size: 13px; color: #9C9490; padding: 8px 0; }
/* The weakest dates by decayed points, so "what do I do tonight" is on the
   screen. Estimates only: reader answers are loaded when a date is opened. */
.weak { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin: 10px 0 0; }
.weak button { background: #171326; border: 1px solid #3A3348; color: #B9B2AD; border-radius: 6px; padding: 8px 10px; text-align: left; font: inherit; font-size: 12px; cursor: pointer; }
.weak button:hover { border-color: #EF5680; color: #FFF7EE; }
.weak b { display: block; color: #E9E1DB; font-size: 14px; }
</style>

<div class="panel">
<p class="kicker">Birthed</p>

<div id="signin" class="signin" hidden>
  <h1>Curation</h1>
  <p class="lede">Sign in with the address that was added as a curator. You get a link by email.</p>
  <div class="form2">
    <input id="email" type="email" placeholder="you@example.com" autocomplete="email">
    <button class="act" id="send">Send me a link</button>
  </div>
  <p class="note" id="signin-note"></p>
</div>

<div id="denied" hidden>
  <h1>Not a curator</h1>
  <p class="lede">You are signed in, but this account has not been given curation access. <button class="act" id="signout2">Sign out</button></p>
</div>

<div id="panel" hidden>
  <h1>Curation</h1>
  <p class="lede" id="who"></p>

  <h3 class="dh">Queue</h3>
  <p class="lede" id="q-lede">Loading.</p>
  <div id="q-card" hidden></div>
  <p class="note" id="q-note"></p>

  <h3 class="dh">Weakest dates</h3>
  <p class="lede" id="weak-lede">Ranked by decayed points, the estimate only. Reader answers replace it once a date is opened.</p>
  <div class="weak" id="weak"></div>

  <h3 class="dh">Every date</h3>
  <p class="lede" id="cov-lede">Loading.</p>
  <div class="months" id="months"></div>
  <p class="legend">
    <span><span class="sw c0"></span>nothing curated</span>
    <span><span class="sw c1"></span>imported only</span>
    <span><span class="sw c2"></span>1 to 2 curated</span>
    <span><span class="sw c3"></span>3 or more</span>
    <span><span class="sw c4"></span>waiting on review</span>
    <button class="act" id="signout" style="margin-left:auto">Sign out</button>
  </p>

  <div id="date" hidden>
    <h3 class="dh" id="date-title">A date</h3>
    <div class="ask">
      <p class="asklede">Tell it what to look for on this date. Pick a starter and edit it, or write your own. Leave the box empty to let it look for anything.</p>
      <div class="chips" id="chips"></div>
      <textarea id="focus" maxlength="500" placeholder="Anything. Or: the Minecraft version that came out on this day, and what it added."></textarea>
      <p class="keys">
        <button class="act" id="gen">Ask for candidates</button>
        <button class="act" id="focus-clear">Clear</button>
        <button class="act" id="scan" title="Judges every row on this date and says what it is missing. Writes only to day_scans.">Scan the day <kbd>s</kbd></button>
        <span class="note" id="gen-note" style="margin:0"></span>
      </p>
      <p class="note" id="budget" style="margin:6px 0 0"></p>
    </div>

    <h4 style="margin:20px 0 0;font-size:13px;color:#9C9490">Add a curated row</h4>
    <div class="form2">
      <div class="two">
        <input id="f-date" type="date" aria-label="Date">
        <select id="f-cat" aria-label="Category">
          <option value="meme">Internet</option>
          <option value="gaming">Gaming</option>
          <option value="tech">Tech</option>
          <option value="music">Music</option>
          <option value="cinema">Film</option>
        </select>
      </div>
      <input id="f-title" type="text" maxlength="200" placeholder="Vine shuts down">
      <textarea id="f-context" maxlength="600" placeholder="The sentence a reader sees. Name the thing, say what happened, stop. Leave blank to print the title alone."></textarea>
      <input id="f-src" type="url" placeholder="https://the page that says so">
      <button class="act" id="add">Add row</button>
    </div>
    <p class="note" id="add-note"></p>

    <div class="rows" id="rows"></div>
  </div>
</div>
</div>

<script>
(function () {
  "use strict";
${POINTS_JS}
  var API = ${JSON.stringify(api.url)};
  var KEY = ${JSON.stringify(api.key)};
  var TOKEN_KEY = "birthed.admin.token";
  // The refresh token, kept beside the access token.
  //
  // Only the access token was ever stored, and Supabase issues those with an
  // hour on them, so a curator who came back the next evening was sent to
  // their email for a new link every single time. The refresh token is the
  // thing that fixes that: it lasts weeks, it rotates on every use, and
  // trading it for a new access token is one request that happens before the
  // panel draws. This is what every Supabase client does; there is no client
  // here because the policy for this page names one origin it may talk to.
  var REFRESH_KEY = "birthed.admin.refresh";
  var token = null;
  var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var lengths = [31,29,31,30,31,30,31,31,30,31,30,31];
  var selected = null;

  function el(id) { return document.getElementById(id); }
  function show(id, on) { el(id).hidden = !on; }
  function note(id, text, kind) {
    var n = el(id);
    n.textContent = text || "";
    n.className = "note" + (kind ? " " + kind : "");
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function headers(extra) {
    var h = { apikey: KEY, "Content-Type": "application/json" };
    if (token) h.Authorization = "Bearer " + token;
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k];
    return h;
  }

  /**
   * A request, and one retry after a refresh if the session died under it.
   *
   * The bug this fixes, seen at 03:36 on 8 September 2026: the panel had been
   * open for over an hour, every read still worked, and every write came back
   * 403 "new row violates row-level security policy for table birth_facts".
   * That message reads like a policy problem and is not one. The access token
   * had simply expired, so PostgREST stopped treating the caller as
   * authenticated and fell back to anon, and anon has no write policy on that
   * table. Reads kept working because reading a verified fact is public.
   *
   * Refreshing at page load, which is the other half of this fix, does nothing
   * for a tab left open, and a tab left open is what curating actually looks
   * like. So the retry lives here, around every call the panel makes, rather
   * than in any one of them.
   */
  function rest(path, options, retried) {
    var opts = options || {};
    return fetch(API + "/rest/v1/" + path, {
      method: opts.method || "GET",
      headers: headers(opts.headers),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) {
        if (retried) {
          return r.text().then(function (t) {
            throw new Error("Signed out. " + r.status + " " + t.slice(0, 160));
          });
        }
        return refreshSession().then(function (ok) {
          if (!ok) throw new Error("That sign in has run out. Ask for another link.");
          return rest(path, options, true);
        });
      }
      if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + " " + t.slice(0, 200)); });
      return r.status === 204 ? null : r.json();
    });
  }

  // ---- sign in -----------------------------------------------------------
  // The token arrives in the fragment, which browsers do not send to a server,
  // so it never reaches Render's logs on its way in.
  function readFragment() {
    if (!location.hash) return null;
    var parts = new URLSearchParams(location.hash.slice(1));
    var t = parts.get("access_token");
    if (!t) return null;
    history.replaceState(null, "", location.pathname);
    return { access: t, refresh: parts.get("refresh_token") };
  }

  function remember(access, refresh) {
    token = access;
    try {
      localStorage.setItem(TOKEN_KEY, access);
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    } catch (e) { /* private window, so this session lasts as long as the tab */ }
  }

  /**
   * Trade the refresh token for a new access token, or resolve false.
   *
   * Rotating, so the answer carries a new refresh token and the old one stops
   * working. Storing the new one is not optional: miss it and the next visit
   * is back at the email.
   */
  function refreshSession() {
    var saved = null;
    try { saved = localStorage.getItem(REFRESH_KEY); } catch (e) { saved = null; }
    if (!saved) return Promise.resolve(false);
    return fetch(API + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: saved }),
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (body) {
        if (!body || !body.access_token) return false;
        remember(body.access_token, body.refresh_token);
        return true;
      })
      .catch(function () { return false; });
  }

  el("send").addEventListener("click", function () {
    var email = el("email").value.trim();
    if (!email) { note("signin-note", "An address, first.", "bad"); return; }
    note("signin-note", "Sending.");
    // create_user is true, and the gate is somewhere else.
    //
    // It was false, back when being a curator meant having a row keyed on an
    // account id, so an account had to exist before anybody could be one. That
    // is not how this works any more: admin_emails decides, and it decides
    // after the sign in rather than before it. Somebody who is not on that
    // list signs in perfectly well and is told they cannot curate, which costs
    // nothing and saves inviting every curator by hand from a dashboard.
    //
    // The answer below does not say whether the address is on the list, which
    // is the one thing worth not saying out loud on a page anybody can open.
    fetch(API + "/auth/v1/otp?redirect_to=" + encodeURIComponent(location.origin + "/admin/"), {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, create_user: true }),
    }).then(function (r) {
      if (r.ok) {
        note("signin-note", "Check that inbox. The link lands back here.", "good");
        return;
      }
      // A wrong answer that sounds temporary is worse than one that sounds
      // final, because the reader spends the next ten minutes retrying. 429 is
      // the only one of these that a minute actually fixes.
      if (r.status === 429) {
        note("signin-note", "Too many requests just now. A minute, then try again.", "bad");
        return;
      }
      r.text().then(function (body) {
        note("signin-note", "The server refused that: " + body.slice(0, 160), "bad");
      });
    }).catch(function () { note("signin-note", "Could not reach the server.", "bad"); });
  });

  function signOut() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch (e) { /* private window */ }
    token = null;
    show("panel", false); show("denied", false); show("signin", true);
  }
  el("signout").addEventListener("click", signOut);
  el("signout2").addEventListener("click", signOut);

  // ---- the queue ---------------------------------------------------------
  //
  // One row, one decision, four keys. A curator who has to reach for a
  // trackpad between decisions does about thirty an hour; one who does not
  // does several hundred. That difference is the only reason this is a queue
  // and not the list further down the page.
  var queue = [];
  var everything = [];
  // The written card lines on the open date, keyed the way the answer forms
  // key a row. A timeline row with one of these has its sentence; one without
  // is a row the Draft button applies to.
  var leads = {};
  var onlyFlagged = false;
  var at = 0;
  var userId = null;

  // ---- what is wrong with a row, named ----------------------------------
  //
  // Not a score and not a guess at whether anybody remembers the thing. Every
  // flag below is a rule already written down in docs/internet-culture.md,
  // checked against the row's own words, so a flag is a sentence a curator can
  // agree or disagree with rather than a number they have to trust.
  //
  // The reason this exists: reviewing rows one at a time, an hour apart, with
  // no reference point, is the hardest judgement there is, and it is why mid
  // rows get through at two in the morning. A named flag restores the
  // reference point without deciding anything.
  // Narrower than it first was, because the first version flagged "Apple built
  // a delete button for the U2 album" and "Taylor Swift was accepting an
  // award", which are two of the strongest rows in the queue. The rule in the
  // docs is not "mentions an album", it is "this row is a release calendar
  // entry", and a game or app shipping is explicitly allowed. So it wants a
  // release verb AND a music or film row, and it leaves gaming and tech alone.
  var RELEASE_VERB = /\b(released|releases|is released|comes out|came out|opens in|opened in|hit (?:theaters|theatres|cinemas)|premiered|premieres|drops|dropped|goes on sale)\b/i;
  var RELEASE_THING = /\b(album|single|EP|LP|film|movie|trailer|tour|soundtrack|record)\b/i;
  var EXPLAINED = /\b(widely regarded|is considered|became a viral sensation|went on to|is known for|marked the|cemented|iconic|cultural phenomenon|paved the way)\b/i;

  function flagsFor(row) {
    var out = [];
    var title = String(row.event_title || "");
    var context = String(row.context_string || "");
    var both = title + " " + context;

    // An album coming out is not internet culture. Every date has several,
    // they are what a Wikipedia date page is already full of, and they are the
    // filler this site exists to replace.
    var cat = String(row.category || "");
    // cinema, not film. That is the name in the cultural_event_category enum,
    // and guessing it wrong is a flag that silently never fires.
    if ((cat === "music" || cat === "cinema") && RELEASE_VERB.test(both) && RELEASE_THING.test(both)) {
      out.push(["release calendar", "reads like a release, not like something the internet did"]);
    }

    // Rule four. A reader who was there does not need it explained and a
    // reader who was not is better served by the link.
    if (EXPLAINED.test(both)) out.push(["explains the joke", "says why it mattered instead of saying what happened"]);

    // The Snapchat Lenses problem: a true row nobody wrote. Two sentences is
    // the shape of every good row in here.
    if (context.replace(/\s+/g, " ").trim().length < 60) out.push(["thin", "not enough written for anybody to feel anything"]);

    // Sourcing, in order of preference. Know Your Meme is fine for a row whose
    // qualifier is that it spread, and never for one claiming an exact posting.
    if (/knowyourmeme\.com/i.test(String(row.source_url || "")) && row.date_kind !== "went_viral") {
      out.push(["circa source", "Know Your Meme dating an exact day"]);
    }

    return out;
  }

  function flagMarkup(flags) {
    if (flags.length === 0) return '<p class="flags"><span class="ok">Nothing flagged.</span></p>';
    return '<p class="flags">' + flags.map(function (f) {
      return '<span class="flag" title="' + esc(f[1]) + '">' + esc(f[0]) + "</span>";
    }).join("") + "</p>";
  }

  /**
   * The same idea for a found fact, against the rules that apply to one.
   *
   * A fact is not a culture row and the flags differ. What they share is that
   * every one is checkable and none of them is a guess at whether the thing
   * is interesting, which no rule can tell you.
   */
  function factFlagsFor(row) {
    var out = [];
    var text = String(row.fact || "");
    // Its own category says so. A film opening or a record coming out is what
    // a Wikipedia date page is already full of, and it is the filler this
    // site exists to replace.
    if (String(row.category || "") === "release") {
      out.push(["release calendar", "the row's own category says this is a release"]);
    }
    if (EXPLAINED.test(text)) {
      out.push(["explains the joke", "says why it mattered instead of saying what happened"]);
    }
    if (!row.source_url) out.push(["unsourced", "nothing to check it against"]);
    // The finder fetched the cited page and it did not answer. That is the one
    // machine check in this pipeline that is worth a curator's attention, and
    // it used to be the thing that published the row instead of telling
    // anybody about it.
    if (row.source_checked === false) out.push(["source did not answer", "the finder fetched the cited page and it did not say this"]);
    return out;
  }

  /** The other candidates waiting on the same date, so a set is judged as a set. */
  function siblingsOf(row) {
    return queue.filter(function (other) {
      return other.id !== row.id && other.event_date === row.event_date;
    });
  }

  function drawQueue() {
    var card = el("q-card");
    if (queue.length === 0) {
      card.hidden = true;
      el("q-lede").textContent = "Nothing waiting. Anything a generator or an importer proposes lands here first.";
      return;
    }
    if (at >= queue.length) at = queue.length - 1;
    if (at < 0) at = 0;
    var row = queue[at];
    var flagged = queue.filter(function (r) { return flagsFor(r).length > 0; }).length;
    el("q-lede").innerHTML = '<span class="qcount">' + (at + 1) + " of " + queue.length +
      "</span> waiting" + (onlyFlagged ? " (flagged only, press f for all)" : "") +
      ". Nothing here is on the site until you say so." +
      (flagged > 0 && !onlyFlagged
        ? ' <span class="qflag">' + flagged + " flagged. Press <kbd>f</kbd> for those alone.</span>"
        : "");
    card.hidden = false;

    var also = siblingsOf(row);
    var alsoMarkup = also.length === 0 ? "" :
      '<div class="also"><p class="alsolab">' + also.length +
      (also.length === 1 ? " other row" : " other rows") + " waiting on " + esc(row.event_date) +
      ", so judge the set rather than the row.</p>" +
      also.map(function (o) {
        return '<p class="alsorow">' + esc(o.context_string || o.event_title) + "</p>";
      }).join("") + "</div>";

    card.innerHTML =
      '<div class="card">' +
      '<p class="when">' + esc(row.event_date) + " &middot; " + esc(row.category) +
        " &middot; " + esc(row.origin) + "</p>" +
      '<p class="sent">' + esc(row.context_string || row.event_title) + "</p>" +
      (row.context_string ? '<p class="when" style="margin-top:8px">' + esc(row.event_title) + "</p>" : "") +
      (row.source_url ? '<p class="src"><a href="' + esc(row.source_url) +
        '" rel="noopener" target="_blank">' + esc(row.source_url.slice(0, 90)) + "</a></p>" : "") +
      flagMarkup(flagsFor(row)) +
      '<p class="keys">' +
      '<button class="act" data-q="publish">Publish <kbd>a</kbd></button>' +
      '<button class="act" data-q="reject">Reject <kbd>r</kbd></button>' +
      '<button class="act" data-q="edit">Edit <kbd>e</kbd></button>' +
      '<button class="act" data-q="prev"><kbd>k</kbd></button>' +
      '<button class="act" data-q="next"><kbd>j</kbd></button>' +
      "</p>" + alsoMarkup + "</div>";
    Array.prototype.forEach.call(card.querySelectorAll("[data-q]"), function (b) {
      b.addEventListener("click", function () { act(b.dataset.q); });
    });
  }

  /** Out of the visible queue and out of the full list behind it. */
  function drop(row) {
    var i = queue.indexOf(row);
    if (i >= 0) queue.splice(i, 1);
    var j = everything.indexOf(row);
    if (j >= 0) everything.splice(j, 1);
  }

  function decide(row, status, reason) {
    // reviewed_by and reviewed_at are written here rather than by a trigger,
    // because the two things somebody will actually ask later are why a row on
    // a live page says what it says, and which forty rows went through in one
    // bad hour.
    var patch = {
      status: status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    };
    if (reason) patch.rejected_reason = reason;
    return rest("cultural_events?id=eq." + row.id, { method: "PATCH", body: patch });
  }

  function act(what) {
    if (what === "next") { at += 1; drawQueue(); return; }
    if (what === "prev") { at -= 1; drawQueue(); return; }
    // Flagged first is the fast pass: the rows most likely to be rejected,
    // gathered, so they are cleared in one sitting instead of interrupting the
    // good ones one at a time.
    if (what === "flagged") {
      onlyFlagged = !onlyFlagged;
      queue = onlyFlagged
        ? everything.filter(function (r) { return flagsFor(r).length > 0; })
        : everything.slice();
      at = 0;
      drawQueue();
      return;
    }
    var row = queue[at];
    if (!row) return;

    if (what === "edit") {
      var next = prompt("The sentence a reader sees:", row.context_string || row.event_title);
      if (next === null) return;
      var trimmed = next.trim();
      if (trimmed.length === 0) return;
      note("q-note", "Saving.");
      rest("cultural_events?id=eq." + row.id, {
        method: "PATCH",
        body: { context_string: trimmed, status: "published", reviewed_by: userId, reviewed_at: new Date().toISOString() },
      }).then(function () {
        // Edit and publish is one action, because the most common thing wrong
        // with a proposed row is that it is right and badly written.
        drop(row); note("q-note", "Edited and published.", "good");
        drawQueue(); loadCoverage();
      }).catch(function (e) { note("q-note", e.message, "bad"); });
      return;
    }

    if (what !== "publish" && what !== "reject") return;
    var status = what === "publish" ? "published" : "rejected";
    note("q-note", "Saving.");
    decide(row, status, null).then(function () {
      drop(row);
      note("q-note", status === "published" ? "Published." : "Rejected, and kept.", "good");
      drawQueue(); loadCoverage();
    }).catch(function (e) { note("q-note", e.message, "bad"); });
  }

  document.addEventListener("keydown", function (ev) {
    if (el("panel").hidden) return;
    var tag = (ev.target && ev.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    // A draft open takes 1, 2, 3 and Escape wherever focus is.
    if (drafting) {
      if (ev.key === "Escape") { ev.preventDefault(); closeDraft(); return; }
      if (ev.key === "1" || ev.key === "2" || ev.key === "3") { ev.preventDefault(); pickDraft(+ev.key - 1); return; }
    }
    // Inside the date's rows the same letters act on the focused row, so the
    // queue at the top and the date below never fight over j and k: whichever
    // one has focus gets the key.
    if (focusedRow()) {
      var onRow = {
        j: function () { moveRow(1); },
        k: function () { moveRow(-1); },
        w: function () { pressOnRow("[data-draft]"); },
        h: function () { pressOnRow("[data-fact],[data-ev]"); },
        y: function () { pressOnRow("[data-agree],[data-take]"); },
        n: function () { pressOnRow("[data-overrule]"); },
      };
      if (onRow[ev.key]) { ev.preventDefault(); onRow[ev.key](); return; }
      return;
    }
    // From anywhere else, g drops into the open date's rows and s scans it.
    if (ev.key === "g" && selected && rowsOnScreen().length > 0) { ev.preventDefault(); moveRow(1); return; }
    if (ev.key === "s" && selected) { ev.preventDefault(); el("scan").click(); return; }
    var map = { a: "publish", r: "reject", e: "edit", j: "next", k: "prev", f: "flagged" };
    var what = map[ev.key];
    if (!what) return;
    ev.preventDefault();
    act(what);
  });

  function loadQueue() {
    return rest("cultural_events?select=id,event_date,category,event_title,context_string," +
      "source_url,origin,date_kind&status=eq.candidate&order=event_date.asc&limit=500")
      .then(function (rows) { everything = rows; queue = rows.slice(); onlyFlagged = false; at = 0; drawQueue(); })
      .catch(function (e) { el("q-lede").textContent = e.message; });
  }

  // ---- coverage ----------------------------------------------------------
  function tierOf(row) {
    // Waiting beats everything, because a date with something to decide is
    // where a curator should be looking before a date that merely has little.
    if (row.pending >= 1) return 4;
    if (row.curated >= 3) return 3;
    if (row.curated >= 1) return 2;
    if (row.cultural >= 1) return 1;
    return 0;
  }

  function drawCoverage(rows) {
    var byKey = {};
    rows.forEach(function (r) { byKey[r.month + "-" + r.day] = r; });
    var html = "";
    for (var m = 1; m <= 12; m++) {
      var cells = "";
      for (var d = 1; d <= lengths[m - 1]; d++) {
        var row = byKey[m + "-" + d] || { curated: 0, cultural: 0, facts: 0, events: 0, pending: 0 };
        var title = months[m - 1] + " " + d + ": " + row.curated + " curated, " +
          row.cultural + " cultural, " + row.facts + " facts, " + row.events + " events" +
          (row.pending ? ", " + row.pending + " waiting" : "");
        cells += '<button class="cell c' + tierOf(row) + '" data-m="' + m + '" data-d="' + d +
          '" title="' + esc(title) + '">' + d + "</button>";
      }
      html += '<div class="mon"><h4>' + months[m - 1] + '</h4><div class="cells">' + cells + "</div></div>";
    }
    el("months").innerHTML = html;

    var curatedDates = rows.filter(function (r) { return r.curated > 0; }).length;
    var noFacts = rows.filter(function (r) { return r.facts === 0; }).length;

    // The sentence that says what this project actually is right now.
    //
    // The panel led with a queue, which is a task, above a calendar, which is
    // the state. That was right while one month was being worked and it hid
    // the thing that matters: on 8 September 2026, 333 of 345 published rows
    // were September and the other eleven months had twelve between them. A
    // queue of forty six September rows reads as "the generator is producing
    // mid" when what it means is "September is mined out and nowhere else has
    // been touched". So the biggest month and the emptiest ones are named
    // here, computed, every time the panel loads.
    var byMonth = [];
    for (var mi = 1; mi <= 12; mi++) byMonth.push({ m: mi, curated: 0 });
    rows.forEach(function (r) { byMonth[r.month - 1].curated += (r.curated || 0); });
    var ranked = byMonth.slice().sort(function (a, b) { return b.curated - a.curated; });
    var top = ranked[0];
    var rest = ranked.slice(1).reduce(function (n, x) { return n + x.curated; }, 0);
    var empty = byMonth.filter(function (x) { return x.curated === 0; });

    el("cov-lede").innerHTML =
      esc(curatedDates + " of 366 dates have a curated row. " + noFacts + " have no verified facts at all.") +
      (top && top.curated > 0
        ? '<span class="gap"><br>' + esc(months[top.m - 1] + " holds " + top.curated +
            " of them. Every other month has " + rest + " between them" +
            (empty.length > 0
              ? ", and " + empty.length + " " + (empty.length === 1 ? "month has" : "months have") +
                " none at all: " + empty.map(function (x) { return months[x.m - 1]; }).join(", ")
              : "") + ".") + "</span>"
        : "");

    Array.prototype.forEach.call(el("months").querySelectorAll(".cell"), function (c) {
      c.addEventListener("click", function () { openDate(+c.dataset.m, +c.dataset.d, c); });
    });
  }

  function loadCoverage() {
    return rest("date_coverage?select=*&order=month.asc,day.asc&limit=400").then(drawCoverage);
  }

  // ---- one date ----------------------------------------------------------
  function pad(n) { return String(n).padStart(2, "0"); }

  function openDate(m, d, cell) {
    Array.prototype.forEach.call(el("months").querySelectorAll(".cell.sel"),
      function (c) { c.classList.remove("sel"); });
    if (cell) cell.classList.add("sel");
    selected = { m: m, d: d };
    el("date-title").textContent = months[m - 1] + " " + d;
    el("f-date").value = new Date().getUTCFullYear() + "-" + pad(m) + "-" + pad(d);
    note("add-note", "");
    show("date", true);
    loadBudget();
    el("rows").innerHTML = "<p class=\\"lede\\">Loading.</p>";

    return Promise.all([
      rest("cultural_events?select=id,event_date,category,event_title,context_string,source_url,origin,status" +
        "&event_date=gte." + "1000-" + pad(m) + "-" + pad(d) +
        "&order=event_date.desc&limit=200"),
      // birth_year 0 and an empty region are what fetchFacts() asks for when
      // it builds the site, so this list is exactly what the date page shows.
      // Without those two filters the panel also lists facts generated for one
      // app user's own birthday, in the second person and scoped to their
      // town, which never reach any page and read as errors when they appear
      // beside rows that do.
      rest("birth_facts?select=id,birth_year,fact,category,source_url,verified," +
        "source_checked,hidden_reason" +
        "&birth_month=eq." + m + "&birth_day=eq." + d +
        "&birth_year=eq.0&region_key=eq.&order=id.asc&limit=100"),
      rest("day_scans?select=id,subject_kind,subject_id,verdict,reason,scanned_by,acted_at,agreed," +
        "proposal_title,proposal_context,proposal_source_url,proposal_year,created_at" +
        "&event_month=eq." + m + "&event_day=eq." + d + "&order=id.asc&limit=300"),
      rest("historical_events?select=id,event_year,description,suppressed" +
        "&event_month=eq." + m + "&event_day=eq." + d + "&order=event_year.desc&limit=200"),
      rest("lead_lines?select=subject_kind,subject_id,line" +
        "&event_month=eq." + m + "&event_day=eq." + d + "&limit=300"),
      loadTally(m, d),
    ]).then(function (r) {
      // The cultural filter above cannot express "any year, this month and
      // day" in one PostgREST clause, so the day is matched here instead. The
      // table is small and this is a panel, not a page anybody waits on.
      var cultural = r[0].filter(function (row) {
        var p = row.event_date.split("-");
        return +p[1] === m && +p[2] === d;
      });
      leads = {};
      (r[4] || []).forEach(function (l) { leads[l.subject_kind + ":" + l.subject_id] = l.line; });
      scansOnScreen = r[2] || [];
      draw(cultural, r[1], r[3], r[2]);
    }).catch(function (e) {
      el("rows").innerHTML = '<p class="note bad">' + esc(e.message) + "</p>";
    });
  }

  // ---- the one screen -----------------------------------------------------
  //
  // Everything on the date, ranked, with what is wrong with each row named
  // in a sentence and scored in parts. One list, not three, because the
  // question a curator has is "what should I fix on this date" and that has
  // one answer per date, not one per table.
  var reach = {};      // source_url -> { views_year, error }
  var selectedByDate = {}; // "m-d" -> { year: text }
  var tally = {};      // "kind:id" -> counts, for the open date

  function loadReach() {
    return pageAll("article_reach?select=source_url,views_year,views_on_date,views_median_day,error&order=source_url.asc")
      .then(function (rows) { reach = {}; rows.forEach(function (r) { reach[r.source_url] = r; }); })
      .catch(function () { reach = {}; });
  }
  function loadSelected() {
    return pageAll("selected_anniversaries?select=event_month,event_day,event_year&order=id.asc")
      .then(function (rows) {
        selectedByDate = {};
        rows.forEach(function (r) {
          var k = r.event_month + "-" + r.event_day;
          if (!selectedByDate[k]) selectedByDate[k] = {};
          selectedByDate[k][r.event_year] = true;
        });
      })
      .catch(function () { selectedByDate = {}; });
  }
  function loadTally(m, d) {
    return rest("rpc/remembrance_tally", { method: "POST", body: { month_in: m, day_in: d } })
      .then(function (rows) {
        tally = {};
        (rows || []).forEach(function (r) {
          var k = r.subject_kind + ":" + r.subject_id;
          var t = tally[k] || { there: 0, remembers: 0, heard: 0, never: 0 };
          t.there += r.there || 0; t.remembers += r.remembers || 0; t.heard += r.heard || 0; t.never += r.never || 0;
          tally[k] = t;
        });
      })
      .catch(function () { tally = {}; });
  }
  /** Every page of a PostgREST list, a thousand at a time. */
  function pageAll(path) {
    var out = [];
    function page(offset) {
      return rest(path + "&limit=1000&offset=" + offset).then(function (rows) {
        out = out.concat(rows);
        return rows.length === 1000 ? page(offset + 1000) : out;
      });
    }
    return page(0);
  }

  /** The reach measurement for a source, as the points function wants it. */
  function viewsFor(url) {
    if (!url) return null;
    var r = reach[url];
    if (!r || r.views_year === null || r.views_year === undefined) return null;
    return r.views_year;
  }
  function reachNote(url) {
    if (!url) return "no source";
    var r = reach[url];
    if (!r) return "not measured yet";
    if (r.error) return r.error;
    return null;
  }

  /**
   * One shape for every kind of row, so one list can hold them all. status
   * is "on" when a reader can see it and "off" otherwise, with the reason.
   */
  function itemsOf(cultural, facts, events, m, d) {
    var items = [];
    var picks = selectedByDate[m + "-" + d] || {};
    cultural.forEach(function (row) {
      var status = row.status || "published";
      var said = String(row.context_string || "").trim();
      var year = Number(String(row.event_date).slice(0, 4)) || null;
      var pairs = flagsFor(row);
      var flags = pairs.map(function (f) { return f[0]; });
      items.push({
        flagPairs: pairs,
        kind: "cultural_event", id: row.id, year: year, text: said || row.event_title, title: row.event_title,
        on: status === "published" && said !== "",
        off: status !== "published" ? status : (said === "" ? "needs a sentence" : null),
        sourceUrl: row.source_url, dateKind: row.date_kind, category: row.category, origin: row.origin,
        flags: flags, written: said.length >= 60, selected: !!picks[year], canDraft: status === "published" && said === "",
      });
    });
    facts.forEach(function (row) {
      var line = leads["birth_fact:" + row.id];
      var pairs = factFlagsFor(row);
      var flags = pairs.map(function (f) { return f[0]; });
      // A found fact has no year column; the year is in the sentence, which
      // is where the site's own timeline reads it from too.
      var yearIn = /\b(1[0-9]{3}|20[0-9]{2})\b/.exec(String(row.fact || ""));
      var factYear = yearIn ? Number(yearIn[1]) : null;
      items.push({
        flagPairs: pairs,
        kind: "birth_fact", id: String(row.id), year: factYear, text: row.fact, title: null, line: line || null,
        on: !!row.verified, off: row.verified ? null : "hidden",
        sourceUrl: row.source_url, dateKind: null, category: row.category || "event", origin: "found",
        flags: flags, written: !!line, selected: !!(factYear && picks[factYear]), canDraft: !!row.verified && !line,
        hiddenReason: row.hidden_reason, sourceChecked: row.source_checked,
      });
    });
    events.forEach(function (row) {
      var line = leads["historical_event:" + row.id];
      items.push({
        kind: "historical_event", id: String(row.id), year: row.event_year, text: row.description, title: null, line: line || null,
        on: !row.suppressed, off: row.suppressed ? "hidden" : null,
        sourceUrl: "https://en.wikipedia.org/wiki/" + months[m - 1] + "_" + d, dateKind: null, category: "wikipedia", origin: "wikipedia",
        flags: [], flagPairs: [], written: !!line, selected: !!picks[row.event_year], canDraft: !row.suppressed && !line,
      });
    });
    items.forEach(function (it) {
      var r = it.sourceUrl ? reach[it.sourceUrl] : null;
      it.points = rowPoints({
        selected: it.selected, views: viewsFor(it.sourceUrl), year: it.year, written: it.written,
        viewsOnDate: r ? r.views_on_date : null, viewsMedianDay: r ? r.views_median_day : null,
        sourceUrl: it.sourceUrl, dateKind: it.dateKind, flags: it.flags,
        answers: tally[it.kind + ":" + it.id] || null,
      });
    });
    return items;
  }

  /**
   * The number, said as what it is, with the arithmetic one click away.
   *
   * "44" on its own reads as a grade a robot gave the row, and it is not: no
   * model's opinion is in it. So the line says "44 points" and a plain phrase
   * for where they came from, and the full sum is behind "why", for a curator
   * who wants to argue with a part.
   */
  var PART_WORDS = { spike: "people look it up on the day", selected: "Wikipedia picked it", reach: "people look it up", memory: "recent enough to remember",
    written: "somebody wrote it", sourcing: "sourced", remembered: "readers remembered it" };
  function partsMarkup(it) {
    var p = it.points;
    var earned = p.parts.filter(function (part) { return part[1] > 0; }).map(function (part) { return PART_WORDS[part[0]] || part[0]; });
    var lost = p.parts.filter(function (part) { return part[1] < 0; }).map(function (part) { return part[0]; });
    var summary = p.measured
      ? "from what readers said"
      : (earned.length ? "for: " + earned.join(", ") : "nothing earned yet") + (lost.length ? ". Loses points for: " + lost.join(", ") : "");
    var bits = p.parts.map(function (part) {
      var n = part[1];
      return esc(part[0]) + " " + (n < 0 ? "-" + (-n) : n) + " (" + esc(part[2]) + ")";
    });
    var reachWhy = reachNote(it.sourceUrl);
    if (!p.measured && reachWhy) bits.push("reach: " + esc(reachWhy));
    return '<p class="pts"><b' + (p.measured ? ' class="measured"' : "") + ">" + p.total + " points</b> " + esc(summary) +
      ' <details class="why"><summary>why</summary><span>' + bits.join("<br>") + "</span></details></p>";
  }

  function draw(cultural, facts, events, scans) {
    var byRow = {};
    (scans || []).forEach(function (v) { if (v.subject_kind) byRow[v.subject_kind + ":" + v.subject_id] = v; });
    function verdictMarkup(kind, id) {
      var v = byRow[kind + ":" + id];
      if (!v) return "";
      var ok = v.verdict === "keep";
      // Answered verdicts stay on screen as a record. Unanswered ones carry
      // the two keys, and either key writes agreed, which is the column that
      // tells you later whether the prompt is any good.
      // Plain words, and only where there is a decision. A verdict of keep is
      // a note, so it gets no buttons. A verdict that wants the row gone gets
      // "Hide it" and "Keep it", which is what pressing them does, and after
      // one is pressed the line says what you did in the same words.
      var wants = v.verdict !== "keep" && v.verdict !== "heavy";
      var answer = "";
      if (v.acted_at) {
        answer = '<span class="did"> ' + (v.agreed ? (wants ? "You hid it." : "Noted.") : "You kept it.") + "</span>";
      } else if (wants) {
        answer = ' <button class="act" data-agree="' + v.id + '" data-kind="' + esc(kind) + '" data-id="' + esc(id) + '" data-verdict="' + esc(v.verdict) + '">Hide it <kbd>y</kbd></button>' +
          ' <button class="act" data-overrule="' + v.id + '">Keep it <kbd>n</kbd></button>';
      } else if (v.verdict === "heavy") {
        answer = ' <button class="act" data-agree="' + v.id + '" data-kind="' + esc(kind) + '" data-id="' + esc(id) + '" data-verdict="' + esc(v.verdict) + '">Noted <kbd>y</kbd></button>';
      }
      var label = { keep: "worth keeping", release: "just a release", encyclopedia: "reads like Wikipedia", thin: "nobody wrote it",
        explains: "explains the joke", wrong_date: "wrong date", unsourced: "no source", heavy: "heavy" }[v.verdict] || v.verdict;
      return '<p class="verdict' + (ok ? " agrees" : "") + '">' +
        '<span class="vtag">' + esc(label) + "</span> " + esc(v.reason) +
        '<span class="vby"> ' + esc(v.scanned_by) + "</span>" + answer + "</p>";
    }
    var proposals = (scans || []).filter(function (v) { return v.verdict === "missing"; });
    var html = "";

    // What the scan says the date is short of. A proposal is a row that does
    // not exist, so accepting it fills the form below and the curator's Add is
    // the write. Nothing here reaches a page on its own.
    if (proposals.length > 0) {
      html += '<h4 class="sh">What the scan says is missing (' + proposals.length + ")</h4>";
      proposals.forEach(function (v) {
        var done = v.acted_at ? (v.agreed ? "taken" : "passed") : "";
        html += '<div class="row" tabindex="0" data-kind="proposal" data-id="' + esc(v.id) + '"><span class="yr">' + esc(v.proposal_year || "") + "</span><div>" +
          '<p class="tx">' + esc(v.proposal_title || "") + "</p>" +
          (v.proposal_context ? '<p class="meta" style="color:#B9B2AD">' + esc(v.proposal_context) + "</p>" : "") +
          '<p class="meta">' + (v.proposal_source_url ? '<a href="' + esc(v.proposal_source_url) + '" rel="noopener" target="_blank">' + esc(v.proposal_source_url.slice(0, 80)) + "</a>" : "no source") +
          '<span class="vby"> ' + esc(v.scanned_by) + (done ? ", " + done : "") + "</span></p></div>" +
          '<div class="btns">' + (done ? "" :
            '<button class="act" data-take="' + v.id + '">Take it <kbd>y</kbd></button>' +
            '<button class="act" data-overrule="' + v.id + '">Pass <kbd>n</kbd></button>') + "</div></div>";
      });
    }

    var items = itemsOf(cultural, facts, events, selected.m, selected.d);
    var on = items.filter(function (it) { return it.on; });
    var off = items.filter(function (it) { return !it.on; });
    on.sort(function (a, b) { return b.points.total - a.points.total; });
    var date = datePoints(on.map(function (it) { return it.points.total; }));
    var measured = on.filter(function (it) { return it.points.measured; }).length;
    var unmeasured = on.filter(function (it) { return !it.points.measured && viewsFor(it.sourceUrl) === null && it.sourceUrl && !reachNote(it.sourceUrl); }).length;
    var needy = off.filter(function (it) { return it.off === "needs a sentence"; }).length;

    html += '<h4 class="sh">Everything on the page, ranked (' + on.length + ")</h4>" +
      '<p class="note" style="margin:4px 0 0">Points are a guess at how likely a reader is to remember a row, added up from things a person can check. The big one: whether people look the thing up on this date every year, which is what remembering looks like from outside. Then how many look it up at all, how recent it is, whether somebody wrote a sentence, how good the source is, and a little for Wikipedia having picked it. No model is asked. Once ten readers have answered a row, what they said replaces the guess. ' +
      'This date scores <b class="dp">' + date + "</b>: the best row counts in full, the next at 95 percent, then 90, so fixing the top row moves it and adding a dull one does not. " +
      (measured > 0 ? measured + (measured === 1 ? " row is" : " rows are") + " measured by readers and that number replaces the estimate. " : "") +
      (needy > 0 ? needy + " published " + (needy === 1 ? "row is" : "rows are") + " a title with nothing written, so no reader sees " + (needy === 1 ? "it" : "them") + ". " : "") +
      '<button class="act" id="measure">Measure reach</button> <span class="note" id="measure-note" style="margin:0"></span></p>';

    function rowMarkup(it) {
      var offLabel = it.off ? '<span class="st st-' + esc(it.off === "needs a sentence" ? "candidate" : it.off) + '">' + esc(it.off) + "</span>" : "";
      var buttons = "";
      if (it.canDraft) buttons += '<button class="act" data-draft="' + esc(it.kind + ":" + it.id) + '">Draft <kbd>w</kbd></button>';
      if (it.kind === "cultural_event") buttons += '<button class="act" data-del="' + esc(it.id) + '">Delete</button>';
      if (it.kind === "birth_fact") buttons += '<button class="act" data-fact="' + esc(it.id) + '" data-on="' + (it.on ? "1" : "0") + '">' + (it.on ? "Hide" : "Put back") + "</button>";
      if (it.kind === "historical_event") buttons += '<button class="act" data-ev="' + esc(it.id) + '" data-on="' + (it.on ? "1" : "0") + '">' + (it.on ? "Hide" : "Put back") + "</button>";
      return '<div class="row" tabindex="0" data-kind="' + esc(it.kind) + '" data-id="' + esc(it.id) + '"><span class="yr">' + (it.year || "") + "</span><div>" +
        '<p class="tx">' + esc(it.text) + "</p>" +
        (it.line ? '<p class="meta">Card line: <span style="color:#E9E1DB">' + esc(it.line) + "</span></p>" : "") +
        '<p class="meta">' + offLabel + '<span class="tagpill">' + esc(it.category) + " &middot; " + esc(it.origin) + "</span>" +
        (it.sourceUrl && it.kind !== "historical_event" ? ' &middot; <a href="' + esc(it.sourceUrl) + '" rel="noopener">source</a>' : "") +
        (it.sourceChecked === true ? ' &middot; <span class="checked">source answers</span>' : "") + "</p>" +
        partsMarkup(it) +
        (it.flagPairs.length ? flagMarkup(it.flagPairs) : "") +
        verdictMarkup(it.kind, it.id) +
        (it.hiddenReason ? '<p class="why">' + esc(it.hiddenReason) + "</p>" : "") + "</div>" +
        '<div class="btns">' + buttons + "</div></div>";
    }
    on.forEach(function (it) { html += rowMarkup(it); });
    if (on.length === 0) html += '<p class="note">Nothing on the page for this date.</p>';

    if (off.length > 0) {
      html += '<details class="offpage"><summary>Off the page (' + off.length + "): " +
        (needy > 0 ? needy + " needing a sentence, " : "") + off.filter(function (it) { return it.off !== "needs a sentence"; }).length +
        " hidden, rejected or waiting</summary>";
      off.sort(function (a, b) { return (a.off === "needs a sentence" ? 0 : 1) - (b.off === "needs a sentence" ? 0 : 1) || b.points.total - a.points.total; });
      off.forEach(function (it) { html += rowMarkup(it); });
      html += "</details>";
    }

    el("rows").innerHTML = html;
    wire();
    el("measure").addEventListener("click", measureReach);
  }

  function measureReach() {
    if (!selected) return;
    var b = el("measure");
    b.disabled = true;
    note("measure-note", "Asking Wikipedia how many people looked each thing up. Free, no key.");
    fetch(API + "/functions/v1/measure-reach", {
      method: "POST", headers: headers(),
      body: JSON.stringify({ month: selected.m, day: selected.d }),
    }).then(function (r) { return r.json(); })
      .then(function (r) {
        if (r.status !== "done") { note("measure-note", r.error || "Failed.", "bad"); return; }
        note("measure-note", r.measured + " measured, " + r.unmeasurable + " could not be, " + r.already + " already fresh.", "good");
        return loadReach().then(reloadDate);
      })
      .catch(function (e) { note("measure-note", String(e.message || e), "bad"); })
      .then(function () { b.disabled = false; });
  }

  function wire() {
    var box = el("rows");
    Array.prototype.forEach.call(box.querySelectorAll("[data-del]"), function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Sure?"; return; }
        rest("cultural_events?id=eq." + b.dataset.del, { method: "DELETE" })
          .then(reload).catch(function (e) { note("add-note", e.message, "bad"); });
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-fact]"), function (b) {
      b.addEventListener("click", function () {
        var next = b.dataset.on !== "1";
        rest("birth_facts?id=eq." + b.dataset.fact, { method: "PATCH", body: { verified: next } })
          .then(reload).catch(function (e) { note("add-note", e.message, "bad"); });
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-agree]"), function (b) {
      b.addEventListener("click", function () { agreeWith(b.dataset.agree, b.dataset.kind, b.dataset.id, b.dataset.verdict); });
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-overrule]"), function (b) {
      b.addEventListener("click", function () { answerScan(b.dataset.overrule, false).then(reloadDate).catch(function (e) { note("add-note", e.message, "bad"); }); });
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-take]"), function (b) {
      b.addEventListener("click", function () { takeProposal(b.dataset.take); });
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-draft]"), function (b) {
      b.addEventListener("click", function () {
        var parts = b.dataset.draft.split(":");
        openDraft(b.closest(".row"), parts[0], parts.slice(1).join(":"));
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-ev]"), function (b) {
      b.addEventListener("click", function () {
        var live = b.dataset.on === "1";
        rest("historical_events?id=eq." + b.dataset.ev, {
          method: "PATCH",
          body: { suppressed: live, suppressed_reason: live ? "hidden by a curator" : null },
        }).then(reload).catch(function (e) { note("add-note", e.message, "bad"); });
      });
    });
  }

  // ---- answering a scan ---------------------------------------------------
  //
  // A verdict is an argument. Agreeing with one that says a row should go
  // does the thing the verdict implies, on the row's own table, with the
  // verdict written in as the reason; agreeing with keep or heavy moves
  // nothing. Either way the scan row gets acted_at and agreed, which is the
  // record that says whether the model is winning its arguments.
  var scansOnScreen = [];

  function answerScan(scanId, agreed) {
    return rest("day_scans?id=eq." + scanId, {
      method: "PATCH",
      body: { agreed: agreed, acted_at: new Date().toISOString() },
    });
  }

  function agreeWith(scanId, kind, id, verdict) {
    var moves = verdict !== "keep" && verdict !== "heavy";
    var reason = "scan said " + verdict;
    var change = Promise.resolve();
    if (moves && kind === "cultural_event") {
      change = rest("cultural_events?id=eq." + id, { method: "PATCH",
        body: { status: "rejected", rejected_reason: reason, reviewed_by: userId, reviewed_at: new Date().toISOString() } });
    } else if (moves && kind === "birth_fact") {
      change = rest("birth_facts?id=eq." + id, { method: "PATCH",
        body: { verified: false, hidden_reason: reason, reviewed_by: userId, reviewed_at: new Date().toISOString() } });
    } else if (moves && kind === "historical_event") {
      change = rest("historical_events?id=eq." + id, { method: "PATCH",
        body: { suppressed: true, suppressed_reason: reason } });
    }
    note("add-note", "Saving.");
    change.then(function () { return answerScan(scanId, true); })
      .then(function () { note("add-note", moves ? "Hidden. It is in the list at the bottom if you change your mind." : "Noted.", "good"); return reloadDate(); })
      .catch(function (e) { note("add-note", e.message, "bad"); });
  }

  // A proposal is not a row until a person adds it. Taking one fills the form
  // with what the scan found, marks the scan as taken, and leaves the category
  // and the Add button to the curator, because the scan does not know the
  // category and the Add is the decision.
  function takeProposal(scanId) {
    var v = null;
    scansOnScreen.forEach(function (x) { if (String(x.id) === String(scanId)) v = x; });
    if (!v) return;
    el("f-date").value = v.proposal_year + "-" + pad(selected.m) + "-" + pad(selected.d);
    el("f-title").value = v.proposal_title || "";
    el("f-context").value = v.proposal_context || "";
    el("f-src").value = v.proposal_source_url || "";
    answerScan(scanId, true).then(function () {
      note("add-note", "Filled in below. Pick the category and press Add. Nothing is on the page yet.");
      el("f-cat").focus();
      return reloadDate();
    }).catch(function (e) { note("add-note", e.message, "bad"); });
  }

  el("scan").addEventListener("click", function () {
    if (!selected) return;
    var button = el("scan");
    button.disabled = true;
    note("gen-note", "Scanning. Judging every row and looking for what is missing takes up to a minute.");
    fetch(API + "/functions/v1/scan-day", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ month: selected.m, day: selected.d }),
    }).then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (r) {
        var b = r.body || {};
        if (!r.ok) { note("gen-note", b.error || "Refused.", "bad"); return; }
        if (b.status === "paused") { note("gen-note", "No searches left, so nothing ran and nothing was spent.", "bad"); return; }
        if (b.status === "failed") { note("gen-note", b.error || "Failed.", "bad"); return; }
        note("gen-note", b.verdicts + " verdicts on " + b.rows + " rows, " + b.proposals + " proposed. All of it is an argument until you press a key.", "good");
        reloadDate();
      })
      .catch(function (e) { note("gen-note", String(e.message || e), "bad"); })
      .then(function () { button.disabled = false; loadBudget(); });
  });

  // ---- drafting the missing sentence ------------------------------------
  //
  // One control, two destinations. A culture row's sentence is
  // cultural_events.context_string and a timeline row's is lead_lines.line.
  // They do the same job for different tables, and the function says which
  // one it is writing to so this panel never guesses.
  //
  // Nothing is saved until Enter. Three candidates are offered rather than
  // one because choosing is faster and more accurate than judging, and the
  // page the row cites is shown underneath so a line that says more than the
  // record can be caught before it is on a page.
  var drafting = null;

  function closeDraft() {
    if (drafting && drafting.box && drafting.box.parentNode) drafting.box.parentNode.removeChild(drafting.box);
    drafting = null;
  }

  function openDraft(rowEl, kind, id) {
    if (!rowEl) return;
    closeDraft();
    var box = document.createElement("div");
    box.className = "draft";
    box.innerHTML = '<p class="to">Drafting. Nothing is saved until you press Enter.</p>';
    rowEl.appendChild(box);
    drafting = { box: box, kind: kind, id: id, row: rowEl, candidates: [] };
    fetch(API + "/functions/v1/draft-line", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ kind: kind, id: id }),
    }).then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (r) {
        if (!drafting || drafting.box !== box) return;
        var b = r.body || {};
        if (!r.ok || b.status !== "done") {
          box.innerHTML = '<p class="to">' + esc(b.error || "Nothing came back.") + ' <button class="act" data-x="1">Close <kbd>Esc</kbd></button></p>';
          box.querySelector("[data-x]").addEventListener("click", closeDraft);
          return;
        }
        drafting.candidates = b.candidates;
        drafting.writesTo = b.row.writes_to;
        var html = '<p class="to">Writes to ' + esc(b.row.writes_to) + ". Pick with <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>, edit, <kbd>Enter</kbd> saves, <kbd>Esc</kbd> closes.</p>";
        b.candidates.forEach(function (c, i) {
          html += '<button class="cand" data-pick="' + i + '"><kbd>' + (i + 1) + "</kbd>" + esc(c) + "</button>";
        });
        html += '<textarea id="draft-text" placeholder="Or write your own."></textarea>' +
          '<p class="keys"><button class="act" data-save="1">Save <kbd>Enter</kbd></button>' +
          '<button class="act" data-x="1">Close <kbd>Esc</kbd></button><span class="note" id="draft-note" style="margin:0"></span></p>' +
          (b.source_text
            ? "<details><summary>The page it cites, as text. A line may not say more than this and the row do.</summary><p>" + esc(b.source_text) + "</p></details>"
            : '<p class="to" style="margin-top:8px">The cited page did not answer, so these rest on the sentence the row already has.</p>');
        box.innerHTML = html;
        Array.prototype.forEach.call(box.querySelectorAll("[data-pick]"), function (c) {
          c.addEventListener("click", function () { pickDraft(+c.dataset.pick); });
        });
        box.querySelector("[data-save]").addEventListener("click", saveDraft);
        box.querySelector("[data-x]").addEventListener("click", closeDraft);
        var ta = el("draft-text");
        ta.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveDraft(); }
          if (e.key === "Escape") { e.preventDefault(); closeDraft(); }
        });
        pickDraft(0);
      })
      .catch(function (e) {
        if (drafting && drafting.box === box) box.innerHTML = '<p class="to">' + esc(String(e.message || e)) + "</p>";
      });
  }

  function pickDraft(i) {
    if (!drafting || !drafting.candidates[i]) return;
    Array.prototype.forEach.call(drafting.box.querySelectorAll(".cand"), function (c, j) {
      c.classList.toggle("on", j === i);
    });
    var ta = el("draft-text");
    ta.value = drafting.candidates[i];
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  function saveDraft() {
    if (!drafting) return;
    var line = (el("draft-text").value || "").replace(/[\u2013\u2014]/g, ",").replace(/\s+/g, " ").trim();
    if (line.length < 8) { note("draft-note", "Too short to be a line.", "bad"); return; }
    if (line.length > 190) { note("draft-note", "Over 190 characters. The card is two lines on a phone.", "bad"); return; }
    note("draft-note", "Saving.");
    var write;
    if (drafting.kind === "cultural_event") {
      // The same write the queue's edit does: a sentence on a published row.
      write = rest("cultural_events?id=eq." + drafting.id, {
        method: "PATCH",
        body: { context_string: line, reviewed_by: userId, reviewed_at: new Date().toISOString() },
      });
    } else {
      write = rest("lead_lines?on_conflict=subject_kind,subject_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: [{
          subject_kind: drafting.kind, subject_id: drafting.id,
          event_month: selected.m, event_day: selected.d,
          line: line, written_by: userId, updated_at: new Date().toISOString(),
        }],
      });
    }
    write.then(function () {
      note("draft-note", "Saved.", "good");
      var kind = drafting.kind, id = drafting.id;
      closeDraft();
      reloadDate().then(function () { focusRow(kind, id); });
    }).catch(function (e) { note("draft-note", e.message, "bad"); });
  }

  // ---- the keyboard path through a date ----------------------------------
  function rowsOnScreen() {
    return Array.prototype.slice.call(el("rows").querySelectorAll(".row[tabindex]"));
  }
  function focusedRow() {
    var a = document.activeElement;
    return a && a.closest ? a.closest(".row[tabindex]") : null;
  }
  function focusRow(kind, id) {
    var rows = rowsOnScreen();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].dataset.kind === kind && rows[i].dataset.id === id) { rows[i].focus(); return; }
    }
  }
  function moveRow(step) {
    var rows = rowsOnScreen();
    if (rows.length === 0) return false;
    var cur = focusedRow();
    var i = cur ? rows.indexOf(cur) : -1;
    var next = Math.max(0, Math.min(rows.length - 1, i + step));
    rows[next].focus();
    rows[next].scrollIntoView({ block: "nearest" });
    return true;
  }
  /** Press the button the key names on the focused row, if it has one. */
  function pressOnRow(selector) {
    var cur = focusedRow();
    if (!cur) return false;
    var b = cur.querySelector(selector);
    if (!b) return false;
    b.click();
    return true;
  }

  function reloadDate() {
    if (!selected) return Promise.resolve();
    return openDate(selected.m, selected.d, null);
  }

  // ---- the weakest dates --------------------------------------------------
  //
  // Every row on every date, scored with the same function, summed with the
  // same decay, and the bottom of the list drawn. Reader answers are not
  // loaded here, that is one request per date, so this is the estimate and
  // it says so; opening a date loads the answers and they replace it.
  function rankYear() {
    el("weak-lede").textContent = "Loading every row on every date.";
    return Promise.all([
      pageAll("cultural_events?select=id,event_date,category,event_title,context_string,source_url,date_kind,origin,status&status=eq.published&order=id.asc"),
      pageAll("birth_facts?select=id,birth_month,birth_day,fact,category,source_url,verified,source_checked&verified=eq.true&birth_year=eq.0&region_key=eq.&order=id.asc"),
      pageAll("historical_events?select=id,event_month,event_day,event_year&suppressed=eq.false&order=id.asc"),
      pageAll("lead_lines?select=subject_kind,subject_id,event_month,event_day,line&order=id.asc"),
    ]).then(function (r) {
      var byDate = {};
      function bucket(m, d) { var k = m + "-" + d; if (!byDate[k]) byDate[k] = { m: m, d: d, cultural: [], facts: [], events: [] }; return byDate[k]; }
      r[0].forEach(function (row) { var p = row.event_date.split("-"); bucket(+p[1], +p[2]).cultural.push(row); });
      r[1].forEach(function (row) { bucket(row.birth_month, row.birth_day).facts.push(row); });
      r[2].forEach(function (row) { bucket(row.event_month, row.event_day).events.push({ id: row.id, event_year: row.event_year, description: "", suppressed: false }); });
      var savedLeads = leads, savedTally = tally;
      var leadsByDate = {};
      r[3].forEach(function (l) { var k = l.event_month + "-" + l.event_day; if (!leadsByDate[k]) leadsByDate[k] = {}; leadsByDate[k][l.subject_kind + ":" + l.subject_id] = l.line; });
      tally = {};
      var scored = [];
      for (var m = 1; m <= 12; m++) {
        for (var d = 1; d <= lengths[m - 1]; d++) {
          var b = bucket(m, d);
          leads = leadsByDate[m + "-" + d] || {};
          var items = itemsOf(b.cultural, b.facts, b.events, m, d).filter(function (it) { return it.on; });
          var top = items.slice().sort(function (x, y) { return y.points.total - x.points.total; })[0];
          scored.push({ m: m, d: d, points: datePoints(items.map(function (it) { return it.points.total; })), rows: items.length, top: top ? top.points.total : 0 });
        }
      }
      leads = savedLeads; tally = savedTally;
      scored.sort(function (x, y) { return x.points - y.points || x.rows - y.rows; });
      // A date with nothing on it is the weakest there is and also not a
      // thing to rank: it needs rows, not fixing. Counted, then set aside.
      var empty = scored.filter(function (x) { return x.rows === 0; }).length;
      var withRows = scored.filter(function (x) { return x.rows > 0; });
      var weakest = withRows.slice(0, 18);
      var best = withRows[withRows.length - 1];
      el("weak-lede").textContent = "The 18 lowest of the " + withRows.length + " dates with rows, by decayed points, the estimate only. Reader answers replace it once a date is opened." +
        (empty > 0 ? " " + empty + " dates have nothing on them at all." : "") +
        (best ? " The strongest is " + months[best.m - 1] + " " + best.d + " at " + best.points + "." : "");
      el("weak").innerHTML = weakest.map(function (x) {
        return '<button data-m="' + x.m + '" data-d="' + x.d + '"><b>' + x.points + "</b>" + months[x.m - 1] + " " + x.d + ", " + x.rows + " rows, top " + x.top + "</button>";
      }).join("");
      Array.prototype.forEach.call(el("weak").querySelectorAll("button"), function (c) {
        c.addEventListener("click", function () {
          var cell = el("months").querySelector('.cell[data-m="' + c.dataset.m + '"][data-d="' + c.dataset.d + '"]');
          openDate(+c.dataset.m, +c.dataset.d, cell);
          el("date").scrollIntoView({ block: "start" });
        });
      });
    }).catch(function (e) { el("weak-lede").textContent = e.message; });
  }

  function reload() {
    if (selected) openDate(selected.m, selected.d, null);
    loadCoverage();
    loadQueue();
  }

  // ---- what to look for --------------------------------------------------
  // Starters, not categories. Each one is a sentence the model reads, so it is
  // written the way you would ask a person, and it is editable in the box
  // before it runs. The point of all of them is the same: a reader should be
  // able to put themselves next to the thing and say how old they were.
  // The first four are aimed at a reader rather than at a category, and each
  // one says how to look, because docs/researching-a-date.md found that
  // searching the date returns listicles and the method that works is to
  // search a memory and then check the date. The steer sits above the dating
  // and sourcing rules in the prompt, so it can narrow what is looked for and
  // cannot relax what a row has to prove.
  var METHOD = " Do not search the date, which finds nothing. Think first of the things this person brings up unprompted, work out which of them fall on this date, then find a page published within days of it that says so. Absent beats wrong.";
  var PRESETS = [
    {
      label: "Twelve in 2009",
      text: "Things somebody who was twelve in 2009 would recognise instantly: what they played, watched, posted and got in trouble for between about 2007 and 2013. Club Penguin, Runescape, early Minecraft, Call of Duty lobbies, the videos everybody at school had seen, the site that got blocked. Write for them, not about them." + METHOD,
    },
    {
      label: "Twelve in 2016",
      text: "Things somebody who was twelve in 2016 would recognise instantly: what they played, watched, posted and copied between about 2014 and 2020. Vine, musical.ly, Fortnite seasons, Undertale, the dress, the memes with a first post. Write for them, not about them." + METHOD,
    },
    {
      label: "Broke containment",
      text: "The thing that broke containment on this date, not the thing that was announced. A post, clip, leak or incident that left the place it started and everybody saw it that week. Use the day it got out, say where it surfaced, and skip anything that was merely scheduled or released." + METHOD,
    },
    {
      label: "Still argued about",
      text: "Things from this date that people still argue about the details of, years later: who was right, what really happened, whether it was staged. If nobody argues about it any more, leave it out. Prefer the thing with an anniversary post over the thing with a press release." + METHOD,
    },
    {
      label: "Since 2018",
      text: "Only things from 2018 onward, nothing older. TikTok, Discord, Twitch, YouTube Shorts, Fortnite and Roblox seasons and live events, game patches, app changes, and things that happened on phones rather than on desktops. If this date has nothing from 2018 on, say so and return nothing rather than reaching further back.",
    },
    {
      label: "Game updates",
      text: "Version releases and major updates for games people kept playing for years: Minecraft, Fortnite, Roblox, Grand Theft Auto Online, League of Legends, Valorant, Old School RuneScape. Read the version histories and patch notes directly, the Minecraft Wiki version history and the Fortnite season and live event dates especially, because those carry exact days and stay online. Name the version or season number and say what it added that people noticed.",
    },
    {
      label: "Pokemon",
      text: "Pokemon on this day: game releases and the region they released in, generation reveals, Pokemon Go events and updates, Trading Card Game set releases, and anime episodes people still bring up.",
    },
    {
      label: "Consoles",
      text: "Console and handheld launches, by region, and the hardware people remember being given: PlayStation, Xbox, Nintendo, Game Boy, Nintendo DS, Steam Deck, iPod, the first iPhone. The launch date in one named region, not a vague year.",
    },
    {
      label: "Leaks",
      text: "Leaks, datamines and reveals that got out before the company meant them to. Use the day the internet found out, not the day the thing later shipped, and say where it surfaced.",
    },
    {
      label: "Videos",
      text: "Videos everybody had seen that week: Vines, YouTube uploads, Twitch clips, TikToks. Use the upload date of the video itself, not the day an article was written about it.",
    },
    {
      label: "Memes born",
      text: "The day a meme actually started: the original post, tweet, image or video that everything else was copying. Point at the first version where it can still be pointed at.",
    },
    {
      label: "Apps and platforms",
      text: "Apps and platforms changing under everybody: launches, shutdowns, redesigns people hated, rebrands, and the day a feature everybody used disappeared.",
    },
    {
      label: "Anime and streaming",
      text: "Anime episodes and season premieres, and streaming releases that everybody watched at the same time and talked about the next day.",
    },
  ];

  function clearChips() {
    Array.prototype.forEach.call(el("chips").querySelectorAll(".chip.on"),
      function (c) { c.classList.remove("on"); });
  }

  function drawChips() {
    var box = el("chips");
    box.innerHTML = "";
    PRESETS.forEach(function (preset) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = preset.label;
      button.addEventListener("click", function () {
        // Clicking the lit one puts the box back to empty, which is the
        // setting that lets the model look for anything.
        var lit = button.classList.contains("on");
        clearChips();
        el("focus").value = lit ? "" : preset.text;
        if (!lit) button.classList.add("on");
        el("focus").focus();
      });
      box.appendChild(button);
    });
  }

  // Setting value from a chip does not fire input, so this only ever means the
  // curator typed over it, and the chip should stop claiming to describe it.
  el("focus").addEventListener("input", clearChips);

  el("focus").addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); el("gen").click(); }
  });

  el("focus-clear").addEventListener("click", function () {
    el("focus").value = "";
    clearChips();
    el("focus").focus();
  });

  // The ceiling shown before the button is pressed rather than after. It is
  // one number shared with find-facts, it is a value somebody set while
  // looking at a bill, and it resets on the first of the month.
  function loadBudget() {
    return rest("rpc/fact_searches_left", { method: "POST", body: {} })
      .then(function (left) {
        if (typeof left !== "number") { note("budget", ""); return; }
        el("gen").disabled = left <= 0;
        if (left <= 0) {
          note("budget", "No searches left this month. The count resets on the 1st, or somebody raises monthly_limit in fact_search_budget.", "bad");
          return;
        }
        // Runs so far have averaged about ten searches each.
        note("budget", left.toLocaleString() + " searches left this month, roughly " +
          Math.floor(left / 10) + " more runs. Resets on the 1st.");
      })
      .catch(function () { note("budget", ""); });
  }

  // Generation. The function checks is_admin() with this same token before it
  // spends anything, because verify_jwt alone would let every reader of the
  // iOS app run up a Gemini bill: they all hold a valid token.
  el("gen").addEventListener("click", function () {
    if (!selected) return;
    var button = el("gen");
    button.disabled = true;
    note("gen-note", "Searching. This takes up to a minute.");
    fetch(API + "/functions/v1/find-culture", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ month: selected.m, day: selected.d, focus: el("focus").value.trim() }),
    }).then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (r) {
        var b = r.body || {};
        if (!r.ok) { note("gen-note", b.error || "Refused.", "bad"); return; }
        if (b.status === "paused") {
          note("gen-note", "No searches left this month, so nothing was run and nothing was spent.", "bad");
          loadBudget();
          return;
        }
        if (b.status === "failed") { note("gen-note", b.error || "Failed.", "bad"); return; }
        // Written and dropped are both worth saying. A run that proposes
        // nothing because everything it found was already here, or because no
        // cited page answered, is a working run and not a broken one.
        // Zero and zero is now a real answer rather than a disappointment. A
        // narrowed run is told to come back empty rather than substitute
        // something adjacent, so this is the shape of it obeying.
        if (b.written === 0 && b.dropped === 0) {
          note("gen-note", "Nothing on this date matched. That is an answer, not a failure.");
        } else {
          note("gen-note",
            b.written + " proposed" + (b.dropped ? ", " + b.dropped + " dropped" : "") +
            ". They are in the queue at the top, not on the site.",
            b.written > 0 ? "good" : "");
        }
        reload();
      })
      .catch(function (e) { note("gen-note", String(e.message || e), "bad"); })
      .then(function () { button.disabled = false; loadBudget(); });
  });

  el("add").addEventListener("click", function () {
    var date = el("f-date").value;
    var title = el("f-title").value.trim();
    var src = el("f-src").value.trim();
    if (!date || !title) { note("add-note", "A date and a title, at least.", "bad"); return; }
    if (!src) { note("add-note", "A row with no source cannot be checked or corrected later.", "bad"); return; }
    note("add-note", "Saving.");
    rest("cultural_events", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: [{
        event_date: date,
        category: el("f-cat").value,
        event_title: title,
        context_string: el("f-context").value.trim() || null,
        source_url: src,
        origin: "curated",
        // Somebody typed this by hand, which is the decision. It does not go
        // back into their own queue to be approved a second time.
        status: "published",
      }],
    }).then(function () {
      el("f-title").value = ""; el("f-context").value = ""; el("f-src").value = "";
      note("add-note", "Added.", "good");
      reload();
    }).catch(function (e) { note("add-note", e.message, "bad"); });
  });

  // ---- start -------------------------------------------------------------
  function start() {
    var fragment = readFragment();
    if (fragment) {
      remember(fragment.access, fragment.refresh);
    } else {
      try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { token = null; }
    }

    // No access token but maybe a refresh one, which is the ordinary state
    // after a browser restart.
    if (!token) {
      refreshSession().then(function (ok) {
        if (ok) { admitted(); return; }
        show("signin", true);
      });
      return;
    }
    admitted();
  }

  /**
   * Draw the panel if this token may curate, once, after trying a refresh.
   *
   * An hour old access token and a revoked account look identical from here,
   * and only one of them is worth sending somebody to their email over. So a
   * refusal spends one request finding out which it was before it says
   * anything, and the sentence at the end is only reached when the refresh
   * token is gone or dead too.
   */
  function admitted(retried) {
    // The panel is drawn only after the database says this token may curate.
    // Not because hiding it protects anything, every write is checked again by
    // a policy, but because a panel full of buttons that all fail is a worse
    // answer than a sentence saying why.
    fetch(API + "/rest/v1/rpc/is_admin", { method: "POST", headers: headers(), body: "{}" })
      .then(function (r) { return r.ok ? r.json() : false; })
      .then(function (ok) {
        if (ok !== true) {
          if (!retried) {
            refreshSession().then(function (fresh) {
              if (fresh) { admitted(true); return; }
              forgetAndAsk();
            });
            return;
          }
          forgetAndAsk();
          return;
        }
        show("panel", true);
        fetch(API + "/auth/v1/user", { headers: headers() })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (u) {
            if (u && u.id) { userId = u.id; el("who").textContent = "Signed in as " + (u.email || u.id); }
          })
          .catch(function () { /* the panel still works, the audit column is null */ });
        drawChips();
        loadQueue();
        // Reach and the editors' picks are loaded once and used by every date
        // and by the ranking, so the ranking waits for them.
        Promise.all([loadReach(), loadSelected()]).then(rankYear);
        loadCoverage().catch(function (e) { el("cov-lede").textContent = e.message; });
      })
      .catch(function () { show("signin", true); note("signin-note", "Could not reach the server.", "bad"); });
  }

  function forgetAndAsk() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch (e) { /* ignore */ }
    token = null;
    show("signin", true);
    note("signin-note", "That sign in has run out, or the account cannot curate. Ask for another.");
  }

  start();
})();
</script>
${escapeHtml("")}`;
}
