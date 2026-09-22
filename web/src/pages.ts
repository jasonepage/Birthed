// The four pages that are not dates: the front door, support, privacy, and
// the one that moves a birthday between two phones.
//
// The front door is a landing page and the date index in one, because the
// date index is the search entry point and a landing page that hides it
// would be trading the thing that works for the thing that looks nice.
//
// Support and privacy are what App Store Connect asks for, and the privacy
// page is written from what the code actually does rather than from a
// template. Every sentence in it is checkable against the repository, and
// the comments say where. When the code changes, this changes with it.

import { DAYS_IN_MONTH, monthName, slug } from "./model.js";
import { hostOf, type Highlight } from "./facts.js";
import { FOOT, FOOT_ADD, SITE, TESTFLIGHT_URL, escapeHtml, head, renderBirthdayBar, siteBar } from "./render.js";

/** Where a person can reach us. One place, so it changes in one place. */
export const SUPPORT_EMAIL = "support@birthed.app";

/** Empty until the app is on the store. Until then the TestFlight link is the button. */
export const APP_STORE_URL = "";
export { TESTFLIGHT_URL };

const UPDATED = "September 22, 2026";

// The index of all 366 dates, drawn as twelve calendars rather than as twelve
// lists. A list of 366 lines is a wall of text that nobody scans; a grid of
// seven columns is the shape everybody already reads a date in, and it fits on
// one screen and a bit instead of eleven.
//
// Laying weeks out means picking a year, because a weekday is a fact about a
// year and a date page is not. The build uses the year it runs in, so a deploy
// refreshes it. Nothing else on the site depends on it.

import { calendar, isLeapYear, monthAnchor } from "./calendar.js";

// Re-exported because the tests and the about page have always reached for
// these through this module.
export { calendar, isLeapYear, monthAnchor };




/**
 * The strip across the top: the name on the left, and on the right the two
 * things a visitor can do that are not "pick your own birthday".
 *
 * Neither is a page. `/today/` and `/random/` are redirects the server
 * answers, which is what lets them exist at all: this site sends
 * `default-src 'none'`, so no page here may run a script, and a script is the
 * only way a page could pick a date for itself. See `redirectFor` in
 * `serve.ts`, which also says why "today" is decided the way it is.
 *
 * Random is here because the 366 pages are the product and a visitor who does
 * not want to think about their own birthday yet has, until now, had no way
 * into any of them except by hunting for a square.
 */
// The bar is siteBar in render.ts, the same one every page draws, since
// September 22, 2026. This page had its own with different words in a
// different order.

/**
 * A hive the size of a paragraph, sealed, so a reader sees what a tile and a
 * buzz are before the rules say so. The board's own markup and rules, with
 * made up counts and nothing to press: the button is drawn disabled and the
 * board takes no pointer at all. The stories are real ones from September
 * 22, so the sample is a day rather than lorem ipsum, and their receipts are
 * not linked because a sample is not a record.
 */
function sampleHive(): string {
  // The button is drawn, because it is what the reader is being shown, and
  // it is out of the tab order and hidden from a screen reader, because it
  // does nothing.
  const tile = (col: string, row: string, tw: number, tier: string, headline: string, buzzes: string, kind: string): string =>
    `<div class="wtile big w-${tier}" style="grid-column:${col};grid-row:${row};--tw:${tw};--fit:.9;--lines:4" role="listitem"><span class="wh">${escapeHtml(headline)}</span><span class="wfoot"><span class="wkind wk-${kind}"></span><span class="wbuzz"><button type="button" tabindex="-1" aria-hidden="true">Buzz</button></span><span class="wn">${buzzes}</span></span></div>`;
  return `<div class="wboard wsealed wsample" style="--side:8" role="list" aria-label="A sample hive">
${tile("1 / span 5", "1 / span 4", 5, "reported", "1948: Gail Halvorsen starts parachuting candy to children in the Berlin Airlift.", "7 buzzes", "happened")}
${tile("6 / span 3", "1 / span 4", 3, "claimed", "Michael Faraday, British scientist, 1791 to 1867", "3 buzzes", "born")}
${tile("1 / span 3", "5 / span 4", 3, "claimed", "1991: The Dead Sea Scrolls are made public for the first time.", "2 buzzes", "happened")}
${tile("4 / span 5", "5 / span 4", 5, "seen_direct", "1862: A preliminary Emancipation Proclamation is released by Abraham Lincoln.", "4 buzzes", "happened")}
</div>
<p class="wsamplesay">A hive, sealed. Each tile is a story with a birthday on the date, and its size is its share of the day's buzzes. Tap Buzz on a live hive and its story grows.</p>`;
}

/**
 * Twelve month buttons, each jumping to that month on the calendar page.
 *
 * The twelve grids used to sit at the foot of this page as well as on
 * /calendar/. Nathan, September 10, 2026: with Every date in the bar the
 * copy at the foot was the same page twice, so the buttons point at the one
 * calendar and the same :target rule lights the month there.
 *
 * The page cannot know when a visitor was born, and a picker that asked would
 * need a script. So the visitor tells it with one tap, and the answer is a
 * fragment, which the browser resolves without a request and without the
 * month ever leaving it.
 *
 * The month that has been jumped to lights up, which is a `:target` rule in
 * the stylesheet and not a script. That matters more than it sounds: before
 * it, tapping a month scrolled the page a long way and landed on twelve
 * identical grids with nothing saying which one had been asked for, so the
 * one interactive thing on the page gave no sign it had worked.
 */
function bornInStrip(): string {
  const links = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const name = monthName(month);
    return `<a href="/calendar/#${monthAnchor(month)}" aria-label="Born in ${name}"><span aria-hidden="true">${name.slice(0, 3)}</span></a>`;
  }).join("");
  return `<section class="picker">
<h2 class="pickerlabel">Born in</h2>
<nav class="bornin" aria-label="Pick the month you were born in">${links}</nav>
</section>`;
}

function storeButton(): string {
  if (APP_STORE_URL) return `<a class="btn brand" href="${APP_STORE_URL}">Get Birthed on the App Store</a>`;
  return `<a class="btn brand" href="${TESTFLIGHT_URL}">Try the beta on TestFlight</a>`;
}

/**
 * The rail of real facts: one off each month's date pages, moving.
 *
 * A landing page for a site whose whole value is 366 pages of content, that
 * shows none of the content, is asking to be taken on trust by somebody who
 * has no reason to. These rows cost the build nothing, because every fact on
 * the site is already in memory by the time this page is written.
 *
 * It moves because a still grid of six is a thing you read once and a rail
 * that keeps bringing another one past is a thing you watch, and what it is
 * bringing past is the argument for the product. It moves without a script,
 * which on this site is not a preference: default-src 'none' means no page
 * here may run one. So the track is a keyframe animation and the pause is a
 * hover rule, and there is no state anywhere that can get out of step with
 * what is on screen.
 *
 * The track is written out twice. That is what makes the loop seamless: the
 * first copy slides its own width to the left, by which point the second copy
 * is standing exactly where the first one started, and the animation restarts
 * with nothing having moved. The second copy is the same links a second time,
 * so it is hidden from anything that reads the page out loud and taken out of
 * the tab order, or a keyboard would walk the same twelve dates twice.
 *
 * Empty when the facts have not been imported yet, which is a section that is
 * simply not there rather than a heading over nothing.
 */
function highlightStrip(highlights: Highlight[]): string {
  if (highlights.length === 0) return "";
  // Spelled out, because a numeral in the middle of a sentence reads as a
  // quantity worth noting and this one is not.
  const words = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
  const count = words[highlights.length] ?? String(highlights.length);

  const card = (row: Highlight, duplicate: boolean): string => {
    const name = `${monthName(row.month)} ${row.day}`;
    // The second copy is furniture. It says the same thing as the first and
    // goes to the same place, so it is not announced and cannot be tabbed to.
    const spare = duplicate ? ' tabindex="-1"' : "";
    return `<li class="hlcard">
<a class="hl" href="/${slug(row.month, row.day)}/"${spare}>
<span class="hlhead"><span class="hldate">${escapeHtml(name)}</span><span class="hlyear">${row.year}</span></span>
<span class="hltext">${escapeHtml(row.text)}</span>
</a>
<p class="hlsrc"><a href="${escapeHtml(row.sourceUrl)}" rel="nofollow noopener"${spare}>${escapeHtml(hostOf(row.sourceUrl))}</a></p>
</li>`;
  };

  const track = (duplicate: boolean): string =>
    `<ul class="railtrack"${duplicate ? ' aria-hidden="true"' : ""}>
${highlights.map((row) => card(row, duplicate)).join("\n")}
</ul>`;

  return `<section class="proof">
<div class="col">
<h2 class="plain">Every date has a day like this in it</h2>
<p class="lede">${count} of them, spread across the year, off ${count.toLowerCase()} of the 366 pages. Tap one for the rest of that date.</p>
</div>
<div class="rail">
${track(false)}
${track(true)}
</div>
<p class="col credit">Each of these was found by a model searching the web and kept only because the page it cites answered when it was checked. The page under each one is where it came from.</p>
</section>`;
}

/**
 * The front door.
 *
 * It has three jobs, in this order: say what Birthed is, show that the thing
 * it says is true, and get the visitor onto their own date. The order used to
 * be the first job five times over and then a wall of 366 numbers, which is a
 * page that argues rather than one that demonstrates.
 *
 * It is the only page on the site that takes a `bodyClass`, because it is the
 * only one that is a landing page rather than a document: it gets the wider
 * column the calendar needs and the light behind the heading, and every other
 * page keeps the narrow measure that prose is meant to be read at.
 */
export function renderHome(
  year: number = new Date().getUTCFullYear(),
  highlights: Highlight[] = [],
): string {
  // /about/ rather than /. The root now serves whatever date it is, and two
  // addresses claiming the same words is how a site asks a search engine to
  // pick a winner on its behalf.
  const canonical = `${SITE}/about/`;
  return `${head(
    "About Birthed",
    // What a link preview says, which for most people is the whole of what
    // they read before deciding. It said what is on a page. It now says what
    // the site does, because the page itself no longer leads with the feature
    // list either and the two should not disagree.
    "Every date has a hive. Everything with a birthday on it is on one feed, whoever turns up buzzes what they think will still matter, and at midnight it seals for good. History is written the day it happens. Birthed keeps what mattered.",
    canonical,
    // The card. Every date page has had one since it was built and the home
    // page never did, so this was the one page on the site that shared as a
    // bare link. It was posted to Reddit on September 6 with no thumbnail,
    // next to three posts that had one, which is the whole cost of the
    // omission: a link with no picture on an aggregator loses to the links
    // beside it before anybody reads the title.
    //
    // A file rather than a render. The date cards come out of og.ts, which
    // needs Chromium and is deliberately kept out of `npm run site` so a
    // content rebuild stays fast and needs no browser. One unchanging card
    // does not need that machinery, and putting it in static/ means it can
    // never be missing because somebody rebuilt the site without running the
    // slow step.
    `${SITE}/og-home.png`,
    false,
    "home",
  )}
${siteBar()}
<div class="col">
<section class="hero">
  <div class="herotext">
    <h1>Every date has a hive. <span class="glow">Here is how to play.</span></h1>
    <p class="lede">Birthed is a small game about the calendar. Every day, whoever shows up decides what mattered about that date. At midnight it locks for good, and next year the same date gets another go.</p>
    <p class="actions"><a class="btn play" href="/today/">Play today's hive</a></p>
  </div>
</section>
${sampleHive()}
</div>

<section class="col how">
<h2 class="plain">How to play</h2>
<ol class="beats">
  <li>
    <h3>Open a date</h3>
    <p>Today is the one that is live. Everything with a birthday on it is in one pile: what happened on this date in history, who was born on it, what was number one, and today's news.</p>
  </li>
  <li>
    <h3>Spend your three buzzes</h3>
    <p><span class="bzz" aria-hidden="true"><i></i><i></i><i></i></span>You get three a day. Tap Buzz on the stories you think people will still care about. Each buzz makes that story's tile bigger. No score, no downvote, and no way to say a thing did not matter.</p>
  </li>
  <li>
    <h3>Yesterday gets one more</h3>
    <p>The day after a date, you get one more buzz to spend on its hive.</p>
  </li>
  <li>
    <h3>Midnight seals it</h3>
    <p>At midnight Eastern the hive locks. No edits and no do overs. That board is what people thought mattered, for good.</p>
  </li>
  <li>
    <h3>Come back next year</h3>
    <p>The same date opens a new hive and the old one stays. Put them side by side and you can see what actually lasted.</p>
  </li>
</ol>
</section>

<section class="col how">
<h2 class="plain">The rules, short</h2>
<ul class="rules">
  <li><b>3</b> buzzes a day</li>
  <li><b>1</b> buzz per story</li>
  <li><b>Bigger tile</b> means more buzzes</li>
  <li><b>Every tile</b> links to its source</li>
  <li><b>No</b> sign up, no ads, nothing to buy</li>
</ul>
<p class="fine">Tap any headline to see where it came from. Looking for your own birthday? Every date page has a See your own birthday button at the top.</p>
</section>

<section class="col how">
<h2 class="plain">Who made this</h2>
<p class="lede">My name is Jason Evan Page and I built Birthed on my own. I made it because I wanted to know what people actually remember of a day, which is a different thing from what got written down about it, and nowhere kept that.</p>
<p class="lede">It costs me money to run and it does not make any. There are no ads on it, there is nothing on it to buy, and there is no company behind it. I am not collecting birthdays to sell, and the <a href="/privacy/">privacy page</a> lists every single thing that is kept, down to the two cookies and what each one is for. If you find something on this site that does not match what that page says, write to me and I will fix it the same day.</p>
</section>

<section class="col how">
<p class="fine">There is an iPhone app too, in beta on <a href="${TESTFLIGHT_URL}">TestFlight</a>, Apple's free app for trying apps before they are on the store. The website works without it.</p>
</section>
${FOOT}`;
}

/**
 * The page a shared birthday link lands on.
 *
 * Two jobs in one page, decided by whether the address has anything after the
 * hash. With a date in it, it shows that date and hands off to the app. With
 * nothing in it, it is a form somebody fills in about themselves, which builds
 * a link they send back.
 *
 * The data lives after the hash because a browser never sends a fragment to
 * the server. So this page is served identically to everybody, the logs record
 * that somebody opened /add and nothing else, and no birthday ever reaches
 * birthed.app. That is what lets the privacy page keep saying the people list
 * stays on the phone while the app gains a way to move one between two of them.
 *
 * This is the only page on the site that runs a script, and the privacy page
 * says so rather than keeping the tidier sentence it used to have.
 */
/// The one page on birthed.app that does something rather than say something.
///
/// It has three jobs and picks between them by reading the address bar:
///
///   #m=6&d=26      somebody shared a birthday with you, open it in the app
///   #c=ABCD2345    somebody asked for yours, fill it in and it reaches them
///   nothing        make a link with yours in it to send back
///
/// The first and third never touch a server, which is the claim the privacy
/// page makes and the reason the birthday travels after the hash symbol.
/// The second one does, and it is the only place in Birthed where anybody's
/// data passes through us on the way to somebody else. The page says so in
/// those words rather than burying it, and it offers the link route underneath
/// so nobody is forced through the server to answer a question.
export function renderAdd(api: { url: string; key: string }): string {
  const canonical = `${SITE}/add/`;
  const months = JSON.stringify([
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]);
  return `${head(
    "Add a birthday to Birthed",
    "Open a shared birthday in Birthed, or make a link with yours in it to send back.",
    canonical,
    undefined,
    true,
  )}
<p class="kicker">Birthed</p>
<div id="incoming" hidden>
  <h1 id="incoming-date">A birthday</h1>
  <p class="lede" id="incoming-name"></p>
  <p><a class="btn primary" id="open-app" href="#">Add it in Birthed</a></p>
  <p class="lede" style="font-size:14px">If nothing happens, you do not have Birthed yet.</p>
  ${storeButton()}
</div>

<div id="compose" hidden>
  <h1 id="compose-title">Send them your birthday</h1>
  <p class="lede" id="compose-lede">Fill this in and you get a link to send back. It never touches our server: everything you type stays in the address bar, and the part it goes in is the part browsers do not send.</p>
  <div class="form">
    <div class="field">
      <!-- The label holds nothing but its own words. The script rewrites it
           when somebody has been asked for their birthday and the name stops
           being optional, and it used to do that by reaching for the first
           child node of a label that also held a line break and the input.
           One extra element in front of that text and the rewrite would have
           gone silently nowhere, leaving "if you want" over a field that is
           now required. -->
      <label class="label" id="name-label" for="name">Your name, if you want</label>
      <input class="input" id="name" type="text" maxlength="60" autocomplete="name" placeholder="Sam">
    </div>

    <div class="field">
      <!-- A span rather than a label, because three controls cannot share one
           label. Each of them carries its own name for a screen reader. -->
      <span class="label">Birthday</span>
      <div class="dates">
        <span class="select"><select id="month" aria-label="Month"></select></span>
        <span class="select"><select id="day" aria-label="Day"></select></span>
        <input class="input year" id="year" type="number" inputmode="numeric" placeholder="Year" min="1900" max="2100" aria-label="Year, optional">
      </div>
      <span class="hint">The year is optional. It is only used to say the age you are turning.</span>
    </div>

    <a class="btn primary" id="make" href="#">Make my link</a>
    <a class="btn primary" id="send" href="#" hidden>Send it</a>
    <p class="problem" id="problem" hidden></p>
    <p class="result" id="result" hidden><span id="link"></span></p>
  </div>
</div>

<div id="sent" hidden>
  <h1>Sent</h1>
  <p class="lede" id="sent-line">It will be there the next time they open Birthed.</p>
  <p class="lede" style="font-size:14px">Nothing else about you was sent, and it is deleted from our server as soon as their phone has it.</p>
  <p class="lede" id="sent-backup" hidden><span id="sent-link"></span></p>
</div>

<noscript><p class="lede">This page needs JavaScript, because reading the birthday out of the address is the thing that keeps it off our server.</p></noscript>

<script>
(function () {
  var MONTHS = ${months};
  var API = ${JSON.stringify(api.url)};
  var KEY = ${JSON.stringify(api.key)};
  function read() {
    var out = {};
    var raw = location.hash.replace(/^#/, "");
    if (!raw) return out;
    raw.split("&").forEach(function (pair) {
      var bits = pair.split("=");
      if (bits.length !== 2) return;
      try { out[bits[0]] = decodeURIComponent(bits[1]); } catch (e) { out[bits[0]] = bits[1]; }
    });
    return out;
  }
  var values = read();
  var month = parseInt(values.m, 10);
  var day = parseInt(values.d, 10);
  var hasDate = month >= 1 && month <= 12 && day >= 1 && day <= 31;
  // A code somebody generated in the app. Checked for shape here only so a
  // mistyped address does not become a request; whether it is a live code is
  // the server's business, and the server deliberately will not say.
  var code = /^[A-Z2-9]{6,12}$/.test(values.c || "") ? values.c : "";
  var asker = (values.r || "").slice(0, 60);

  if (hasDate) {
    document.getElementById("incoming").hidden = false;
    document.getElementById("incoming-date").textContent = MONTHS[month - 1] + " " + day;
    document.getElementById("incoming-name").textContent = values.n
      ? values.n + " shared their birthday with you."
      : "Somebody shared their birthday with you.";
    document.getElementById("open-app").href = "birthed://add?" + location.hash.replace(/^#/, "");
    return;
  }

  document.getElementById("compose").hidden = false;
  var monthSelect = document.getElementById("month");
  var daySelect = document.getElementById("day");
  var nameInput = document.getElementById("name");
  var problem = document.getElementById("problem");
  MONTHS.forEach(function (name, index) {
    var option = document.createElement("option");
    option.value = String(index + 1);
    option.textContent = name;
    monthSelect.appendChild(option);
  });
  function fillDays() {
    var lengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var count = lengths[parseInt(monthSelect.value, 10) - 1];
    var chosen = daySelect.value;
    daySelect.innerHTML = "";
    for (var d = 1; d <= count; d++) {
      var option = document.createElement("option");
      option.value = String(d);
      option.textContent = String(d);
      daySelect.appendChild(option);
    }
    if (chosen && parseInt(chosen, 10) <= count) daySelect.value = chosen;
  }
  monthSelect.addEventListener("change", fillDays);
  fillDays();

  function chosenYear() {
    var year = parseInt(document.getElementById("year").value, 10);
    return year >= 1900 && year <= 2100 ? year : null;
  }

  function myLink() {
    var pairs = [];
    var name = nameInput.value.trim();
    if (name) pairs.push("n=" + encodeURIComponent(name.slice(0, 60)));
    pairs.push("m=" + monthSelect.value);
    pairs.push("d=" + daySelect.value);
    var year = chosenYear();
    if (year) pairs.push("y=" + year);
    return "${SITE}/add/#" + pairs.join("&");
  }

  function show(holder, url) {
    holder.innerHTML = "";
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.textContent = url;
    holder.appendChild(anchor);
  }

  document.getElementById("make").addEventListener("click", function (event) {
    event.preventDefault();
    var url = myLink();
    show(document.getElementById("link"), url);
    document.getElementById("result").hidden = false;
    if (navigator.share) { navigator.share({ url: url }).catch(function () {}); }
  });

  if (!code) return;

  // Asked, rather than volunteered. The name stops being optional here,
  // because a birthday with no name attached to it is not something anybody
  // can put in a list.
  var who = asker ? asker : "Somebody";
  document.getElementById("compose-title").textContent = who + " wants your birthday";
  document.getElementById("compose-lede").textContent =
    "Fill this in and press send. It goes to their phone the next time they open Birthed, and it is deleted from our server the moment it arrives. You do not need the app, and nothing else about you is sent.";
  // The label is now a label and nothing else, so this is its whole content.
  document.getElementById("name-label").textContent = "Your name";
  document.getElementById("make").hidden = true;
  var send = document.getElementById("send");
  send.hidden = false;

  send.addEventListener("click", function (event) {
    event.preventDefault();
    // A second press while the first is still in the air would send the same
    // birthday twice. The server drops the duplicate, but the button should
    // not create it in the first place.
    if (send.disabled) return;
    var name = nameInput.value.trim();
    if (!name) {
      problem.textContent = "Put your name in, so they know whose birthday it is.";
      problem.hidden = false;
      nameInput.focus();
      return;
    }
    problem.hidden = true;
    send.disabled = true;
    send.textContent = "Sending";
    fetch(API + "/rest/v1/rpc/leave_birthday", {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: "Bearer " + KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        request_code: code,
        person_name: name.slice(0, 60),
        month: parseInt(monthSelect.value, 10),
        day: parseInt(daySelect.value, 10),
        year: chosenYear()
      })
    }).then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      document.getElementById("compose").hidden = true;
      var sent = document.getElementById("sent");
      document.getElementById("sent-line").textContent = asker
        ? "It will be there the next time " + asker + " opens Birthed."
        : "It will be there the next time they open Birthed.";
      sent.hidden = false;
    }).catch(function () {
      // The server answers the same way whether or not the code is still
      // alive, so a failure here is the network rather than the request. The
      // link is offered as the way round it, which is the route that never
      // needed us in the first place.
      send.disabled = false;
      send.textContent = "Send it";
      problem.textContent = "That did not go through. Send them this link instead:";
      problem.hidden = false;
      show(document.getElementById("link"), myLink());
      document.getElementById("result").hidden = false;
    });
  });
})();
</script>
${FOOT_ADD}`;
}

/**
 * Support, for both of the places Birthed lives. Hana's walkthrough, September
 * 22, 2026: the page was written for the iPhone app alone, so a website
 * reader asking about buzzes or hives found nothing, and it told them to
 * delete an account the website says it does not have. The website comes
 * first because that is where the people reading this page are.
 */
export function renderSupport(): string {
  const canonical = `${SITE}/support/`;
  return `${head("Birthed support", "Help with Birthed: buzzes, hives and sealing on the website, and your birthday, the number one song and reminders in the iPhone app.", canonical, `${SITE}/og-home.png`)}
${siteBar()}
<h1>Support</h1>
<p class="lede">Most questions are answered below, the website first and then the iPhone app. For anything else, write to <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> and a person will answer.</p>

<div class="prose">
<h2>On the website</h2>

<h3>Do I need an account?</h3>
<p>No. The website has no accounts and no sign up. The first time you buzz something, the site keeps one random string in a cookie, so your browser gets its few buzzes a day and no more. If you give the site your birthday, that is kept in a second cookie, in your browser. That is all it keeps, and the <a href="/privacy/">privacy page</a> says exactly what each one is.</p>

<h3>What is a buzz?</h3>
<p>A buzz is a vote that a story will still matter years from now. Each one makes that story's tile on the hive bigger. You get three a day, one per story. The day after a date, you get one more to spend on its hive. There is no downvote and no score.</p>

<h3>What is the hive, and what does sealed mean?</h3>
<p>Every date has a hive: one board holding everything with a birthday on that date, from what happened on it in history to today's news. A date's hive opens at midnight Eastern time when the date begins, takes buzzes that day and the next, and seals at the midnight that ends the next day. Sealed means permanent. Nothing on the board changes after that, and next year the same date gets a new hive beside it.</p>

<h3>Why is a sealed hive smaller than an open one?</h3>
<p>Nothing is removed when a hive seals. Hives that sealed before September 22, 2026 were cut under an older rule that put at most eight stories nobody had buzzed on the board, and a sealed board is never redrawn. Hives from then on hold many more. The line under each sealed board says how many buzzes it sealed with.</p>

<h3>I buzzed the wrong story.</h3>
<p>For thirty seconds after a buzz there is an Undo button beside it. Pressing it takes the buzz back completely. After thirty seconds a buzz stands.</p>

<h3>My buzzes are gone.</h3>
<p>They are not. Your buzzes stay on their hives and still count. What your browser forgets, if its cookies are cleared, is which ones were yours, so your marks and the list at <a href="/yours/">birthed.app/yours</a> start empty again. There is no account to sign in to and get them back.</p>

<h3>Where do the stories come from?</h3>
<p>From the source, in the source's own words. History comes from Wikipedia's date pages, people from Wikidata, songs from the Billboard Hot 100 as compiled by Wikipedia, and the day's news from the public feeds of news sites. Tap any headline to see its receipt: every source, the quotation, and every check run on it.</p>

<h3>How do I change or forget my birthday on the website?</h3>
<p>To change it, use See your own birthday at the top of any date page and enter it again. To forget it, press this button. It clears the birthday from this browser and nothing else.</p>
<form class="forget" method="post" action="/year"><input type="hidden" name="y" value=""><button type="submit">Forget my birthday on this browser</button></form>

<h3>Why is there no number one song for my year?</h3>
<p>The chart this site uses, the Billboard Hot 100, starts in August 1958 and Birthed reads it from 1959. A song also appears only once its chart is published and copied into Wikipedia's list, so the newest week can lag behind by a week or two.</p>

<h2>In the iPhone app</h2>
<p>The app is in beta. You can try it through <a href="${TESTFLIGHT_URL}">TestFlight</a>, Apple's free app for trying apps before they are on the App Store. The questions below are about the app, not the website.</p>

<h3>How do I change my birthday or birth year?</h3>
<p>Open the cog at the top of any tab, then tap the Birthday row. The wheels save as you move them; there is no Save button. You can also tap "Play the reveal again," which walks you through the opening with your saved day already set, and finishing it saves whatever the wheels say.</p>

<h3>Why is there no song for my birthday?</h3>
<p>The song needs your birth year. If you skipped it, add it in Settings. If you gave it and there is still no song, you were born before the chart Birthed uses existed: the Billboard Hot 100 starts in August 1958 and Birthed reads it from 1959, the Billboard 200 album chart from 1964, and the United States box office from the 1940s. Birthed shows nothing rather than a guess.</p>

<h3>The song is not the one I expected.</h3>
<p>Birthed shows the chart whose issue date is the first one on or after your birthday, and it prints that date next to the song so you can check it. Billboard's issue date is not the same as the week it measured, and the convention has changed several times since 1958, so a list you find elsewhere may pick a different week. Both are right about different things.</p>

<h3>I was born on February 29.</h3>
<p>Birthed keeps February 29 as your birthday forever. In a year without one, you choose in Settings whether Birthed treats February 28 or March 1 as your day, and the app says so on screen when it is standing in.</p>

<h3>Reminders are not arriving.</h3>
<p>Birthed never asks for notification permission during setup. Turn reminders on from the switch in Settings, which is when iOS asks. If the switch is on and nothing arrives, check that Birthed is allowed to notify you in the iPhone Settings app under Notifications. Reminders are scheduled on your phone at the local time, so they survive travel and clock changes.</p>

<h3>Does Birthed know where I am?</h3>
<p>No. Birthed never reads your device's location. The only place it has is whatever you typed into the Region field, and that field is optional.</p>

<h3>How do I delete everything in the app?</h3>
<p>Settings, then "Delete my account and data." That removes your profile from the Birthed account service and clears the app. Deleting the app from your phone afterwards removes the rest. There is no login, so there is nothing else to close.</p>

<h2>Anywhere</h2>

<h3>Something is wrong on a date page.</h3>
<p>Names, years and descriptions come from Wikidata. If a person is misfiled, the fix is on their Wikidata record, and every entry links to it. If a chart week looks wrong, write to us with the date and we will check it against the page it came from.</p>
</div>
${FOOT}`;
}

export function renderPrivacy(): string {
  const canonical = `${SITE}/privacy/`;
  return `${head("Birthed privacy policy", "What Birthed collects, where it goes, and how to delete it. Written from what the app actually does.", canonical, `${SITE}/og-home.png`)}
${siteBar()}
<h1>Privacy</h1>
<p class="lede">This is written from what the app does, not from a template. It is short because Birthed does not collect much.</p>

<div class="prose">
<p class="updated">Last updated ${UPDATED}.</p>

<h3>What Birthed asks for</h3>
<ul>
  <li><strong>Your birthday</strong>, as a month and a day. This is the only thing the app needs.</li>
  <li><strong>Your birth year</strong>, optional. It turns on the number one song, album and film the week you were born, the day of the week, and the day counts.</li>
  <li><strong>A region</strong>, optional, typed by you in Settings. A postal code or a city.</li>
  <li><strong>Your February 29 preference</strong>, if that is your birthday.</li>
</ul>
<p>Birthed never asks for your name, email address, phone number, or a password. There is no sign up.</p>

<h3>Where it goes</h3>
<p>When you first open Birthed it silently creates an anonymous account with our account service, so that your profile can be counted and restored. The birthday, the birth year, the region and the February 29 preference are sent to that account. The account is identified by a random token stored in your phone's keychain, not by anything about you.</p>
<p>Four numbers about your own use of the app go to that same account, so that we can tell whether Birthed actually works for people:</p>
<ul>
  <li><strong>How many people are on your list.</strong> The number only. It carries no name, no date and no note, so your people list stays on your phone exactly as described below.</li>
  <li><strong>Whether you have given permission for reminders.</strong> True or false.</li>
  <li><strong>How many reminders have reached their moment</strong> on your phone.</li>
  <li><strong>How many messages you have sent</strong> after one, counted at the moment the iOS Messages composer reports that a message went. What was in it, and who it went to, are never known to Birthed.</li>
</ul>
<p>That is the whole list, and each one is a single current number rather than a history. There is no record of when you opened the app, what you looked at, or what you tapped, and nothing is timestamped. Deleting the app resets all four.</p>
<p>The account service is <a href="https://supabase.com">Supabase</a>, which hosts the database on servers in the United States. The pictures on the hive's event tiles are copies of freely licensed pictures from Wikimedia Commons, stored with the same service and served from its address, so your browser asks Supabase for those pictures and asks Wikimedia for nothing. The website you are reading is served by <a href="https://render.com">Render</a>.</p>

<h3>Finding things about your day</h3>
<p>The Mine tab shows specific things that happened on the day you were born, and those are found by a model that searches the web, Google's Gemini service. To ask it, the Birthed server sends the month, the day, the birth year and the region you typed, and nothing else. Your account and the token that identifies it stay behind, so what Google is asked is a date and a place, not a person.</p>
<p>The answers are stored under the date rather than under you, so the next person born on the same day is shown what was already found instead of causing a new search. If you tap the thumbs up on one of those facts, that is recorded against your anonymous account, which is how it is counted once and how you can take it back.</p>
<p>The same is true of the heart on "The world when you arrived". What is recorded there is the subject, such as Minecraft or the iPhone, and not the sentence you were shown, because that sentence is worked out on your phone from your birth year and it never leaves it. So the record says that one account liked Minecraft. It does not say what it said to you, or what year you were born.</p>

<h3>What stays on your phone</h3>
<ul>
  <li><strong>The people you add</strong> in the People tab, with their birthdays and any note you write. This list is kept on your phone and is not sent to the account service. The one exception is described under "Asking somebody for their birthday" below, and it runs the other way: it is about a birthday arriving, not about your list leaving.</li>
  <li><strong>Reminders</strong>. They are scheduled on your phone by iOS. Birthed has no server that sends notifications.</li>
  <li><strong>Which stories you buzzed</strong>, and one note per date about how the story you buzzed turned out. Both are kept on your phone. They are what puts your own mark on a tile, what stops the same story taking two buzzes from you, and what lets your phone tell you the morning after a hive seals without asking our server anything at that moment. The buzz itself is in the database, as described under the website above; this is your phone's own copy of what it did, it is never sent anywhere, and deleting the app removes it.</li>
  <li><strong>Share cards</strong>. The images you share are drawn on your phone when you tap Share. No name is on them. The card for a date never carries a birth year; the card for your own day shows the song and your day count, which imply the year, and it only exists when you make it.</li>
</ul>

<h3>What Birthed never does</h3>
<ul>
  <li>It never reads your device's location. The region field is the only location it has, and it is optional.</li>
  <li>It never reads your contacts, photos, calendar, or anything else on the phone.</li>
  <li>It contains no advertising and no third party code of any kind. There is no analytics service, no tracking service and no advertising network behind it, nothing in it follows you between apps or across the web, and no company other than the ones named on this page receives anything at all. The four numbers described above are the whole of what Birthed counts, and Birthed counts them itself.</li>
  <li>It never sells or shares your information with anyone, for any reason.</li>
</ul>

<h3>Asking somebody for their birthday</h3>
<p>Birthed can make you a link that asks somebody for their birthday. They open it, fill in their name and their date, and press send. This is the only feature in Birthed where one person's information passes through our server on the way to another person, and it works like this.</p>
<ul>
  <li>The app makes a short code and sends it to our account service, against your account. Nothing else goes with it.</li>
  <li>When somebody answers your link, <strong>their name and their birthday are stored against that code</strong>. Nothing about who they are, where they answered from, or what device they used is recorded with it.</li>
  <li>Only the account that made the code can read what came back. Everybody else, including anybody holding the key the app and this website ship with, gets an empty answer.</li>
  <li>The next time you open Birthed, it collects what has arrived and asks you to confirm each one. <strong>Confirming deletes it from the server.</strong></li>
  <li>A code lasts a fortnight from the last time you shared it. After that the code stops working and anything still waiting under it is deleted, whether it was collected or not.</li>
</ul>
<p>Nothing is sent to anybody's phone by our server, because there is no such thing here. The app checks when you open it. If you would rather nothing passed through us at all, the "send yours" link described further down does the same job with no server involved, and it is still there.</p>

<h3>What Birthed counts</h3>
<p>The app can tell you how many Birthed users share your birthday. That number is computed on the server from birthdays alone, is never shown below a small floor, and never exposes anyone's record.</p>

<h3>This website</h3>
<p>birthed.app has no accounts, no analytics service, no advertising and no third party code of any kind. It sets two cookies, both of them only after you do something, and this is all of what they are.</p>
<ul>
  <li><strong>The first time you buzz a story on the hive</strong>, the site puts a random string in a cookie called <code>bt</code>. It is not a name, an account or an address, and it is not built from anything about you or your browser. It exists so that the hive can count your buzzes against the few you get a day, and so that the same browser is not counted twice on the same story. It lasts a year. Before September 10, 2026 the site also set it when you answered a remembrance question; those answers are kept as they were and the question is no longer asked.</li>
  <li><strong>If you tell the site your birthday</strong>, it is kept in a cookie called <code>by</code>, as the year, month and day, so you are asked once instead of on every date and the site can tell your own date from every other one. Your browser sends it back to this site with each page, the page is drawn for you from it, and it is not written down anywhere on our side. It is optional, nothing on the site requires it, and the button on the <a href="/support/">support page</a> deletes it. Until September 22, 2026 this cookie held the year alone, and one set before then still works as a year.</li>
</ul>
<p>Both cookies are marked <em>HttpOnly</em>, which means no script in any browser can read them, including the scripts on this site described further down. Nothing about you is stored on our side except the buzzes themselves. A buzz is which story, that it was one buzz, when, what the story's evidence tier and support were at that moment, that it came from this website rather than from the app, and the random string in a scrambled form that cannot be turned back into it. A buzz is kept for good, because the hive it lands on is permanent; it names nobody and is shown to nobody as yours except to the browser that made it. That is also what lets the site show you your own buzzes back. Two places do it, and both read the same rows and show them only to the browser that made them: a year later on the same date, the story you backed on it, and at <a href="/yours/">birthed.app/yours</a>, every story this browser has buzzed with what became of each one. Both carry no number of any kind, neither says anything about anybody else, and nobody else can see either. The link to that page appears under the board only for a browser that has buzzed something, nothing else on the site points at it, and clearing the cookie empties it while the buzzes themselves stay on their hives and still count. For thirty seconds after you make one there is an Undo button beside it, and pressing it deletes that buzz outright: the record of it is gone, not marked as cancelled, and nothing is kept anywhere to say you changed your mind. After those thirty seconds a buzz stands, and so does one on a hive that has sealed. An answer to the old remembrance question, if you gave one, is a date, which row, which answer, the random string, and your birth year if you gave that; it is kept as it was. <strong>The address your request came from is never sent to our database and is never stored against a buzz or an answer.</strong> There is no profile, nothing that follows you to another site, and nothing about any of this is for sale or ever will be.</p>
<p>The person who runs Birthed can see how many buzzes there have been, how many different browsers and phones made them, and how many of those came back on another day. Those are counts of the buzzes already described above, worked out in the database when the page asking for them is opened, and they are not stored anywhere afterwards. Nothing was added to the site to make them possible, and no buzz is ever shown as anybody's. There is still no analytics service, no tracking service and no third party code of any kind on this site.</p>
<p>The server counts requests per address, in memory, for one minute at a time, so that a script cannot make thousands of writes in a minute. Those counts are never written down and vanish when the server restarts. Like every website, the machine serving this one keeps ordinary access logs, which include the address your request came from, for a short time for operational reasons. Those logs are not joined to buzzes and nothing in this site can join them.</p>
<p>A few pages run a script, and each is described here. The first is worth explaining because it looks like the opposite of what it is. When somebody shares a birthday with you, the birthday travels in the part of the web address after the hash symbol, and browsers never send that part to a server. The page at <a href="/add/">birthed.app/add</a> reads it in your browser to show you the date and hand it to the app. So that page is sent to everybody identically, our logs record only that somebody opened it, and no birthday you send or receive that way ever reaches us.</p>
<p>The second is the full screen hive of a date that is open, the one at <em>birthed.app/the-date/hive/</em>, since September 11, 2026. Its script keeps the board moving while you watch: it opens a connection to our database, Supabase, carrying the same public key the app carries, and the database sends it each buzz as it lands so the board can grow that tile. What it is sent is the buzz as described above, which names nobody. Your own buzz from that page goes to our server the same way a buzz from any other page does, with the same cookie, and nothing new is kept about you. Every page on this site, this one included, draws its headings in a typeface served from this site rather than from a font company, so no font company hears from your browser.</p>
<p>The third, since September 22, 2026, is the Share and Copy link buttons on a story's own page. The script opens your phone's own share sheet, or copies the page's address, and that is all it does. It sends nothing to us or to anybody else. The security header names that one script by its fingerprint, so those pages can run it and nothing else. Every other page on this site, the date pages included, runs nothing.</p>
<p>The same page has a second job. If you arrived through a link somebody used to <em>ask</em> for your birthday, the page shows a send button, and pressing it does send what you typed to our account service, to wait for them. That is the one case above, and the page says so on it before you press anything. The code identifying whose request it is also travels after the hash symbol, so our website's logs never see it either.</p>

<h3>Deleting your data</h3>
<p>In the app, open Settings and tap "Delete my account and data." That deletes your profile from the account service and clears the app's own storage. Deleting the app from your phone removes everything else, including the people list and any reminders. If you would like us to confirm a deletion, write to <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>

<h3>Children</h3>
<p>Birthed is not directed at children under 13, and we do not knowingly collect information from them. If you believe a child under 13 has created a profile, write to us and we will delete it.</p>

<h3>Where the content comes from</h3>
<p>Names, years and descriptions of notable people come from Wikidata under Creative Commons Zero. Chart weeks come from Wikipedia's year lists under Creative Commons Attribution ShareAlike, and every one carries the page it came from. Birthed is not affiliated with Wikipedia, Wikidata, the Wikimedia Foundation, Billboard, or Penske Media.</p>
<p>The things found about your day are found by Google's Gemini service searching the web, and each one shows the page it came from so that you can open it and check. Birthed is not affiliated with Google.</p>

<h3>Changes</h3>
<p>If this page changes, the date at the top changes with it. Since Birthed collects so little, changes should be rare and small.</p>

<h3>Contact</h3>
<p><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
</div>
${FOOT}`;
}
