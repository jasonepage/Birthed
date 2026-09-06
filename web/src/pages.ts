// The three pages that are not dates: the front door, support, and privacy.
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
import { FOOT, SITE, head } from "./render.js";

/** Where a person can reach us. One place, so it changes in one place. */
export const SUPPORT_EMAIL = "support@birthed.app";

/** Empty until the app is on the store. Until then the TestFlight link is the button. */
export const APP_STORE_URL = "";
export const TESTFLIGHT_URL = "https://testflight.apple.com/join/hzm6Mhhm";

const UPDATED = "September 6, 2026";

// The index of all 366 dates, drawn as twelve calendars rather than as twelve
// lists. A list of 366 lines is a wall of text that nobody scans; a grid of
// seven columns is the shape everybody already reads a date in, and it fits on
// one screen and a bit instead of eleven.
//
// Laying weeks out means picking a year, because a weekday is a fact about a
// year and a date page is not. The build uses the year it runs in, so a deploy
// refreshes it. Nothing else on the site depends on it.

/** Sunday first, the way a calendar is printed in the United States. */
const WEEKDAY_INITIALS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Which column the first of a month lands in, counted from Sunday.
 *
 * UTC throughout, so the timezone of whatever machine runs the build cannot
 * shift a whole month by a day.
 */
function firstColumn(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

function dayCell(month: number, day: number, className = ""): string {
  const label = `${monthName(month)} ${day}`;
  // The visible text is a number, so the full date goes on the link itself for
  // anything that reads the page out loud and for anybody who hovers it.
  return `<a${className ? ` class="${className}"` : ""} href="/${slug(month, day)}/" aria-label="${label}" title="${label}">${day}</a>`;
}

function monthCalendar(year: number, month: number): string {
  const leap = isLeapYear(year);
  const length = month === 2 ? (leap ? 29 : 28) : (DAYS_IN_MONTH[month - 1] ?? 31);
  const blanks = Array.from({ length: firstColumn(year, month) }, () => `<span class="pad"></span>`).join("");
  const days = Array.from({ length }, (_, index) => dayCell(month, index + 1)).join("");
  // February 29 has a page in every year, so it gets a square in every year.
  // In a year without one it sits after the 28th, marked, rather than being
  // quietly dropped and leaving one of the 366 unreachable from here.
  const leapDay = month === 2 && !leap ? dayCell(2, 29, "leap") : "";
  const header = WEEKDAY_INITIALS.map((initials) => `<span>${initials}</span>`).join("");
  return `<section class="cal">
<h3>${monthName(month)}</h3>
<div class="dow" aria-hidden="true">${header}</div>
<div class="days">${blanks}${days}${leapDay}</div>
</section>`;
}

export function calendar(year: number): string {
  const months: string[] = [];
  for (let month = 1; month <= 12; month++) months.push(monthCalendar(year, month));
  const note = isLeapYear(year)
    ? ""
    : `\n<p class="calnote">February 29 comes around every fourth year. It has a page in the years it does not.</p>`;
  return `<div class="months">
${months.join("\n")}
</div>${note}`;
}

function storeButton(): string {
  if (APP_STORE_URL) return `<a class="btn" href="${APP_STORE_URL}">Get Birthed on the App Store</a>`;
  return `<a class="btn" href="${TESTFLIGHT_URL}">Try the beta on TestFlight</a>
<p class="lede" style="margin:10px 0 0;font-size:14px">iPhone only for now. TestFlight is Apple's free app for trying apps before they are on the store.</p>`;
}

export function renderHome(year: number = new Date().getUTCFullYear()): string {
  const canonical = `${SITE}/`;
  return `${head(
    "Birthed: the day you were born",
    "Who shares your birthday, what happened on it, what was number one the week you were born, how many days you have been here, and whose birthdays you keep forgetting.",
    canonical,
  )}
<p class="kicker">Birthed</p>
<div class="hero">
  <img src="/icon-192.png" alt="" width="92" height="92">
  <div>
    <h1>The day you were born, and everything that was true about it.</h1>
    <p class="lede">Who shares it. What happened on it. What was number one that week. How many days you have been here. And whose birthdays you keep forgetting.</p>
    ${storeButton()}
  </div>
</div>

<ul class="features">
  <li><h3>The week you were born</h3><p>The number one song, album and film the week you arrived, with the chart date next to each so you can check it.</p></li>
  <li><h3>Your day, counted</h3><p>The day of the week you were born, how many days that has been, and the day you turn ten thousand.</p></li>
  <li><h3>Who shares it</h3><p>The people most looked up who were born on your date, from Wikidata.</p></li>
  <li><h3>What happened on it</h3><p>Specific things that happened on your date across history, found by a model that searches, each one showing the page it came from so you can check it yourself.</p></li>
  <li><h3>Other people's days</h3><p>Add the people you care about. Birthed tells you three days before and on the day, so you are never the one who forgot.</p></li>
</ul>

<p class="lede" style="margin-top:34px">No sign up. No name. Nothing Birthed makes carries your name, and nothing shared out of it carries your birth year. <a href="/privacy/">How your data is handled</a>.</p>

<h2 class="plain">Every day of the year</h2>
<p class="lede" style="margin-bottom:0">Pick a date and see who shares it and what happened on it. The weeks are laid out the way they fall in ${year}.</p>
${calendar(year)}
${FOOT}`;
}

export function renderSupport(): string {
  const canonical = `${SITE}/support/`;
  return `${head("Birthed support", "Help with the Birthed app: your birthday, the number one song, reminders, and deleting your data.", canonical)}
<p class="kicker">Birthed</p>
<h1>Support</h1>
<p class="lede">Most questions are answered below. For anything else, write to <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> and a person will answer.</p>

<div class="prose">
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

<h3>How do I delete everything?</h3>
<p>Settings, then "Delete my account and data." That removes your profile from the Birthed account service and clears the app. Deleting the app from your phone afterwards removes the rest. There is no login, so there is nothing else to close.</p>

<h3>Something is wrong on a date page.</h3>
<p>Names, years and descriptions come from Wikidata. If a person is misfiled, the fix is on their Wikidata record, and every entry links to it. If a chart week looks wrong, write to us with the date and we will check it against the page it came from.</p>
</div>
${FOOT}`;
}

export function renderPrivacy(): string {
  const canonical = `${SITE}/privacy/`;
  return `${head("Birthed privacy policy", "What Birthed collects, where it goes, and how to delete it. Written from what the app actually does.", canonical)}
<p class="kicker">Birthed</p>
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
<p>When you first open Birthed it silently creates an anonymous account with our account service, so that your profile can be counted and restored. The birthday, the birth year, the region and the February 29 preference are sent to that account. Nothing else is. The account is identified by a random token stored in your phone's keychain, not by anything about you.</p>
<p>The account service is <a href="https://supabase.com">Supabase</a>, which hosts the database on servers in the United States. The website you are reading is served by <a href="https://render.com">Render</a>.</p>

<h3>Finding things about your day</h3>
<p>The Mine tab shows specific things that happened on the day you were born, and those are found by a model that searches the web, Google's Gemini service. To ask it, the Birthed server sends the month, the day, the birth year and the region you typed, and nothing else. Your account and the token that identifies it stay behind, so what Google is asked is a date and a place, not a person.</p>
<p>The answers are stored under the date rather than under you, so the next person born on the same day is shown what was already found instead of causing a new search. If you tap the thumbs up on one of those facts, that is recorded against your anonymous account, which is how it is counted once and how you can take it back.</p>

<h3>What stays on your phone</h3>
<ul>
  <li><strong>The people you add</strong> in the People tab, with their birthdays and any note you write. This list is kept on your phone and is not sent to the account service.</li>
  <li><strong>Reminders</strong>. They are scheduled on your phone by iOS. Birthed has no server that sends notifications.</li>
  <li><strong>Share cards</strong>. The images you share are drawn on your phone when you tap Share. No name is on them. The card for a date never carries a birth year; the card for your own day shows the song and your day count, which imply the year, and it only exists when you make it.</li>
</ul>

<h3>What Birthed never does</h3>
<ul>
  <li>It never reads your device's location. The region field is the only location it has, and it is optional.</li>
  <li>It never reads your contacts, photos, calendar, or anything else on the phone.</li>
  <li>It contains no advertising, no analytics, and no tracking of any kind. There is no third party code in the app that reports on you.</li>
  <li>It never sells or shares your information with anyone, for any reason.</li>
</ul>

<h3>What Birthed counts</h3>
<p>The app can tell you how many Birthed users share your birthday. That number is computed on the server from birthdays alone, is never shown below a small floor, and never exposes anyone's record.</p>

<h3>This website</h3>
<p>birthed.app sets no cookies, runs no scripts, and uses no analytics. Like every website, the server that serves it keeps ordinary access logs, which include the address your request came from, for a short time for operational reasons.</p>

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
