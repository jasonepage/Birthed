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

  <h3 class="dh">Every date</h3>
  <p class="lede" id="cov-lede">Loading.</p>
  <div class="months" id="months"></div>
  <p class="legend">
    <span><span class="sw c0"></span>nothing curated</span>
    <span><span class="sw c1"></span>imported only</span>
    <span><span class="sw c2"></span>1 to 2 curated</span>
    <span><span class="sw c3"></span>3 or more</span>
    <button class="act" id="signout" style="margin-left:auto">Sign out</button>
  </p>

  <div id="date" hidden>
    <h3 class="dh" id="date-title">A date</h3>

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

  function rest(path, options) {
    var opts = options || {};
    return fetch(API + "/rest/v1/" + path, {
      method: opts.method || "GET",
      headers: headers(opts.headers),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
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
    if (t) history.replaceState(null, "", location.pathname);
    return t;
  }

  el("send").addEventListener("click", function () {
    var email = el("email").value.trim();
    if (!email) { note("signin-note", "An address, first.", "bad"); return; }
    note("signin-note", "Sending.");
    fetch(API + "/auth/v1/otp", {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, create_user: false }),
    }).then(function (r) {
      // create_user is false on purpose: this form must never be a way to make
      // an account. An address that is not already a user gets the same answer
      // as one that is, which is also the answer that does not confirm to a
      // stranger whether an address is a curator.
      note("signin-note", r.ok
        ? "If that address can curate, a link is on its way."
        : "Could not send that. Try again in a minute.", r.ok ? "good" : "bad");
    }).catch(function () { note("signin-note", "Could not reach the server.", "bad"); });
  });

  function signOut() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* private window */ }
    token = null;
    show("panel", false); show("denied", false); show("signin", true);
  }
  el("signout").addEventListener("click", signOut);
  el("signout2").addEventListener("click", signOut);

  // ---- coverage ----------------------------------------------------------
  function tierOf(row) {
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
        var row = byKey[m + "-" + d] || { curated: 0, cultural: 0, facts: 0, events: 0 };
        var title = months[m - 1] + " " + d + ": " + row.curated + " curated, " +
          row.cultural + " cultural, " + row.facts + " facts, " + row.events + " events";
        cells += '<button class="cell c' + tierOf(row) + '" data-m="' + m + '" data-d="' + d +
          '" title="' + esc(title) + '">' + d + "</button>";
      }
      html += '<div class="mon"><h4>' + months[m - 1] + '</h4><div class="cells">' + cells + "</div></div>";
    }
    el("months").innerHTML = html;

    var curatedDates = rows.filter(function (r) { return r.curated > 0; }).length;
    var noFacts = rows.filter(function (r) { return r.facts === 0; }).length;
    el("cov-lede").textContent =
      curatedDates + " of 366 dates have a curated row. " + noFacts + " have no verified facts at all.";

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
    el("rows").innerHTML = "<p class=\\"lede\\">Loading.</p>";

    Promise.all([
      rest("cultural_events?select=id,event_date,category,event_title,context_string,source_url,origin" +
        "&event_date=gte." + "1000-" + pad(m) + "-" + pad(d) +
        "&order=event_date.desc&limit=200"),
      rest("birth_facts?select=id,birth_year,fact,category,source_url,verified" +
        "&birth_month=eq." + m + "&birth_day=eq." + d + "&order=birth_year.desc&limit=100"),
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
      draw(cultural, r[1], r[2]);
    }).catch(function (e) {
      el("rows").innerHTML = '<p class="note bad">' + esc(e.message) + "</p>";
    });
  }

  function draw(cultural, facts, events) {
    var html = "";

    html += '<h4 style="margin:22px 0 0;font-size:13px;color:#9C9490">Cultural rows (' + cultural.length + ")</h4>";
    if (cultural.length === 0) html += '<p class="note">None yet.</p>';
    cultural.forEach(function (row) {
      html += '<div class="row"><span class="yr">' + esc(row.event_date.slice(0, 4)) + "</span><div>" +
        '<p class="tx">' + esc(row.context_string || row.event_title) + "</p>" +
        '<p class="meta"><span class="tagpill">' + esc(row.category) + " &middot; " + esc(row.origin) + "</span>" +
        (row.source_url ? ' &middot; <a href="' + esc(row.source_url) + '" rel="noopener">source</a>' : "") +
        "</p></div>" +
        '<button class="act" data-del="' + esc(row.id) + '">Delete</button></div>';
    });

    html += '<h4 style="margin:26px 0 0;font-size:13px;color:#9C9490">Found facts (' + facts.length + ")</h4>";
    facts.forEach(function (row) {
      html += '<div class="row"><span class="yr">' + (row.birth_year || "") + "</span><div>" +
        '<p class="tx">' + esc(row.fact) + "</p>" +
        '<p class="meta"><span class="tagpill">' + esc(row.category || "event") + "</span>" +
        (row.source_url ? ' &middot; <a href="' + esc(row.source_url) + '" rel="noopener">source</a>' : "") +
        "</p></div>" +
        '<button class="act' + (row.verified ? " on" : "") + '" data-fact="' + esc(row.id) +
        '" data-on="' + (row.verified ? "1" : "0") + '">' + (row.verified ? "Shown" : "Hidden") + "</button></div>";
    });

    html += '<h4 style="margin:26px 0 0;font-size:13px;color:#9C9490">Wikipedia lines (' + events.length + ")</h4>";
    events.forEach(function (row) {
      var live = !row.suppressed;
      html += '<div class="row"><span class="yr">' + (row.event_year || "") + "</span><div>" +
        '<p class="tx">' + esc(row.description) + "</p></div>" +
        '<button class="act' + (live ? " on" : "") + '" data-ev="' + esc(row.id) +
        '" data-on="' + (live ? "1" : "0") + '">' + (live ? "Shown" : "Hidden") + "</button></div>";
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
  }

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
      token = fragment;
      try { localStorage.setItem(TOKEN_KEY, token); } catch (e) { /* private window */ }
    } else {
      try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { token = null; }
    }

    if (!token) { show("signin", true); return; }

    // The panel is drawn only after the database says this token may curate.
    // Not because hiding it protects anything, every write is checked again by
    // a policy, but because a panel full of buttons that all fail is a worse
    // answer than a sentence saying why.
    fetch(API + "/rest/v1/rpc/is_admin", { method: "POST", headers: headers(), body: "{}" })
      .then(function (r) { return r.ok ? r.json() : false; })
      .then(function (ok) {
        if (ok !== true) {
          // An expired token looks the same as a refused one from here, and
          // the useful thing in both cases is to offer the sign in again.
          try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
          token = null;
          show("signin", true);
          note("signin-note", "That link has expired or the account cannot curate. Ask for another.");
          return;
        }
        show("panel", true);
        loadCoverage().catch(function (e) { el("cov-lede").textContent = e.message; });
      })
      .catch(function () { show("signin", true); note("signin-note", "Could not reach the server.", "bad"); });
  }

  start();
})();
</script>
${escapeHtml("")}`;
}
