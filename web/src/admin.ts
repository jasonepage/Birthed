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

    Promise.all([
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
      rest("day_scans?select=subject_kind,subject_id,verdict,reason,scanned_by,acted_at,agreed" +
        "&event_month=eq." + m + "&event_day=eq." + d + "&order=id.asc&limit=300"),
      rest("historical_events?select=id,event_year,description,suppressed" +
        "&event_month=eq." + m + "&event_day=eq." + d + "&order=event_year.desc&limit=200"),
    ]).then(function (r) {
      // The cultural filter above cannot express "any year, this month and
      // day" in one PostgREST clause, so the day is matched here instead. The
      // table is small and this is a panel, not a page anybody waits on.
      var cultural = r[0].filter(function (row) {
        var p = row.event_date.split("-");
        return +p[1] === m && +p[2] === d;
      });
      draw(cultural, r[1], r[3], r[2]);
    }).catch(function (e) {
      el("rows").innerHTML = '<p class="note bad">' + esc(e.message) + "</p>";
    });
  }

  function draw(cultural, facts, events, scans) {
    // What a scan said about a row, if anything. A verdict is an argument and
    // never a change: it is drawn beside the row and the curator's key is the
    // only thing that moves anything. See docs/scan-a-day.md.
    var byRow = {};
    (scans || []).forEach(function (v) { byRow[v.subject_kind + ":" + v.subject_id] = v; });
    function verdictMarkup(kind, id) {
      var v = byRow[kind + ":" + id];
      if (!v) return "";
      var ok = v.verdict === "keep";
      return '<p class="verdict' + (ok ? " agrees" : "") + '">' +
        '<span class="vtag">' + esc(v.verdict) + "</span> " + esc(v.reason) +
        '<span class="vby"> ' + esc(v.scanned_by) + "</span></p>";
    }
    var html = "";

    // Published and written about. A published row with no sentence is not on
    // any page: renderDayPage drops it, because a game's name followed by "is
    // released" is the filler the site exists to replace. Counting it here
    // would put this panel back to telling the curator something the site does
    // not agree with, which is the bug that took an evening to find.
    function onThePage(r) {
      return (r.status || "published") === "published" &&
        String(r.context_string || "").trim() !== "";
    }
    var live = cultural.filter(onThePage).length;
    html += '<h4 style="margin:22px 0 0;font-size:13px;color:#9C9490">Cultural rows (' + cultural.length + ")</h4>";
    var needy = cultural.filter(function (r) {
      return (r.status || "published") === "published" && String(r.context_string || "").trim() === "";
    }).length;
    html += '<p class="note" style="margin:4px 0 0">' + live + " on the page. " +
      (needy > 0
        ? needy + " more are a title with nothing written about them, so no reader sees those either. Write one line and it is back."
        : "Everything else here is waiting in the queue at the top or already turned down, and no reader can see it.") +
      "</p>";
    if (cultural.length === 0) html += '<p class="note">None yet.</p>';
    // Status on every row. Without it a candidate sitting in the queue and a
    // row that is live on the page looked exactly alike here, which makes the
    // one question this list exists to answer, what is actually on the page,
    // unanswerable by looking at it.
    cultural.forEach(function (row) {
      var status = row.status || "published";
      var needsWriting = status === "published" && String(row.context_string || "").trim() === "";
      html += '<div class="row"><span class="yr">' + esc(row.event_date.slice(0, 4)) + "</span><div>" +
        '<p class="tx">' + esc(row.context_string || row.event_title) + "</p>" +
        '<p class="meta"><span class="st st-' + esc(status) + '">' +
        esc(needsWriting ? "needs a sentence" : (status === "published" ? "on the page" : status)) + "</span>" +
        '<span class="tagpill">' + esc(row.category) + " &middot; " + esc(row.origin) + "</span>" +
        (row.source_url ? ' &middot; <a href="' + esc(row.source_url) + '" rel="noopener">source</a>' : "") +
        "</p>" + verdictMarkup("cultural_event", row.id) + "</div>" +
        '<button class="act" data-del="' + esc(row.id) + '">Delete</button></div>';
    });

    html += '<h4 style="margin:26px 0 0;font-size:13px;color:#9C9490">Facts on the page (' + facts.length + ")</h4>";
    facts.forEach(function (row) {
      // State on the left with the rest of the row's facts about itself, and
      // the button says what pressing it does. It used to say "Shown", which
      // is the state, so the only control on a found fact read as a label and
      // the page looked like it had none.
      var flags = factFlagsFor(row);
      html += '<div class="row"><span class="yr">' + (row.birth_year || "") + "</span><div>" +
        '<p class="tx">' + esc(row.fact) + "</p>" +
        '<p class="meta"><span class="state' + (row.verified ? " live" : "") + '">' +
        (row.verified ? "on the page" : "hidden") + "</span>" +
        ' &middot; <span class="tagpill">' + esc(row.category || "event") + "</span>" +
        (row.source_url ? ' &middot; <a href="' + esc(row.source_url) + '" rel="noopener">source</a>' : "") +
        (row.source_checked === true ? ' &middot; <span class="checked">source answers</span>' : "") +
        "</p>" + (flags.length ? flagMarkup(flags) : "") +
        verdictMarkup("birth_fact", row.id) +
        (row.hidden_reason ? '<p class="why">' + esc(row.hidden_reason) + "</p>" : "") + "</div>" +
        '<button class="act" data-fact="' + esc(row.id) +
        '" data-on="' + (row.verified ? "1" : "0") + '">' + (row.verified ? "Hide" : "Put back") + "</button></div>";
    });

    html += '<h4 style="margin:26px 0 0;font-size:13px;color:#9C9490">Wikipedia lines (' + events.length + ")</h4>";
    events.forEach(function (row) {
      var live = !row.suppressed;
      html += '<div class="row"><span class="yr">' + (row.event_year || "") + "</span><div>" +
        '<p class="tx">' + esc(row.description) + "</p>" +
        '<p class="meta"><span class="state' + (live ? " live" : "") + '">' +
        (live ? "on the page" : "hidden") + "</span></p></div>" +
        '<button class="act" data-ev="' + esc(row.id) +
        '" data-on="' + (live ? "1" : "0") + '">' + (live ? "Hide" : "Put back") + "</button></div>";
    });

    el("rows").innerHTML = html;
    wire();
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
  var PRESETS = [
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
