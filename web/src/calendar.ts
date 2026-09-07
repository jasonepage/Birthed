// The year as twelve calendars, and the index of all 366 dates.
//
// Its own module because both the date pages and the about page draw it, and
// pages.ts already imports from render.ts. Leaving it in pages.ts and reaching
// for it from render.ts would have closed that into a cycle, which resolves at
// runtime by handing one of the two an undefined binding, at whichever import
// happened to be evaluated second. Nothing about that failure names itself.
//
// Laying weeks out means picking a year, because a weekday is a fact about a
// year and a date page is not. The build passes the year it runs in, so a
// deploy refreshes it. Nothing else on the site depends on it.

import { DAYS_IN_MONTH, monthName, slug } from "./model.js";

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

export interface CalendarDate { month: number; day: number }

function dayCell(month: number, day: number, className = ""): string {
  const label = `${monthName(month)} ${day}`;
  // The visible text is a number, so the full date goes on the link itself for
  // anything that reads the page out loud and for anybody who hovers it.
  return `<a${className ? ` class="${className}"` : ""} href="/${slug(month, day)}/" aria-label="${label}" title="${label}">${day}</a>`;
}

function monthCalendar(year: number, month: number, current?: CalendarDate): string {
  const leap = isLeapYear(year);
  const length = month === 2 ? (leap ? 29 : 28) : (DAYS_IN_MONTH[month - 1] ?? 31);
  const blanks = Array.from({ length: firstColumn(year, month) }, () => `<span class="pad"></span>`).join("");
  const days = Array.from({ length }, (_, index) => {
    const day = index + 1;
    // The square for the page you are standing on. Known at build time,
    // because a date page knows its own date. Today is the other marker and
    // it cannot be known here: see the note on calendar() below.
    const here = current && current.month === month && current.day === day ? "thispage" : "";
    return dayCell(month, day, here);
  }).join("");
  // February 29 has a page in every year, so it gets a square in every year.
  // In a year without one it sits after the 28th, marked, rather than being
  // quietly dropped and leaving one of the 366 unreachable from here.
  const isCurrentLeapDay = current !== undefined && current.month === 2 && current.day === 29;
  const leapDay = month === 2 && !leap
    ? dayCell(2, 29, isCurrentLeapDay ? "leap thispage" : "leap")
    : "";
  const header = WEEKDAY_INITIALS.map((initials) => `<span>${initials}</span>`).join("");
  // The id is what the "born in" strip at the top of the page jumps to.
  return `<section class="cal" id="${monthAnchor(month)}">
<h3>${monthName(month)}</h3>
<div class="dow" aria-hidden="true">${header}</div>
<div class="days">${blanks}${days}${leapDay}</div>
</section>`;
}

/**
 * The twelve months, with the current page's date marked.
 *
 * Two squares want marking and only one of them can be marked here. The page
 * knows its own date, so `current` is a build-time fact. Which date is *today*
 * is not: these pages are rendered into a deploy and served unchanged until
 * the next one, so a today ring written in here would still be pointing at the
 * day of the deploy a week later, on all 366 pages, quietly.
 *
 * So today is marked by /today.css instead, one generated rule served by
 * serve.ts against the clock at the moment of the request. No script, which
 * this site does not allow anywhere, and the pages themselves are still read
 * off a disk and streamed.
 */
export function calendar(year: number, current?: CalendarDate): string {
  const months: string[] = [];
  for (let month = 1; month <= 12; month++) months.push(monthCalendar(year, month, current));
  const note = isLeapYear(year)
    ? ""
    : `\n<p class="calnote">February 29 comes around every fourth year. It has a page in the years it does not.</p>`;
  // Two rings and no way to tell them apart is a puzzle rather than a signal,
  // so they are named. The labels are fixed words: the dates they point at are
  // in the grid above and do not need repeating.
  const key = current === undefined
    ? ""
    : `\n<p class="calkey"><span class="sw thispage"></span>This page<span class="sw today"></span>Today</p>`;
  return `<div class="months">
${months.join("\n")}
</div>${key}${note}`;
}

/** "september", the fragment a month's calendar sits under. */
export function monthAnchor(month: number): string {
  return monthName(month).toLowerCase();
}
