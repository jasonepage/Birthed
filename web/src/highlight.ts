// Which single line a date leads with, on a card or at the top of a page.
//
// Extracted out of share.ts so that render.ts can reuse it without the two
// files importing each other. calendar.ts came out of pages.ts for the same
// reason and the note is worth leaving twice: an import cycle in this codebase
// works right up until the day module evaluation order changes underneath it.
//
// Everything here was written for the share image and every word of the
// reasoning applies to the page as well, which is the argument for sharing it
// rather than writing a second filter that drifts.

import type { Fact } from "./facts.js";
import { monthName } from "./model.js";
import { splitDatePrefix, type DayEvent } from "./timeline.js";

/** The shortest line wins, so the choice is stable across rebuilds. */
function shortest(lines: Highlight[]): Highlight | null {
  if (lines.length === 0) return null;
  const sorted = [...lines].sort((a, b) => a.text.length - b.text.length || a.year - b.year);
  return sorted[0] ?? null;
}

/** One thing that happened, for the card. */
export interface Highlight {
  year: number;
  text: string;
}

/**
 * Words that keep a line off a birthday card.
 *
 * This exists because of what the data actually looks like rather than out of
 * caution. 41 percent of the 19,734 Wikipedia events match this list, every
 * one of the 366 dates has at least one that does, and if the card took the
 * most recent event for its date then 134 of the 366 cards would carry a
 * killing, a bombing or a crash. September 4's most recent is a school
 * shooting. That is not a thing to put next to a lit candle and somebody's
 * birthday, and it is the kind of mistake that gets screenshotted for exactly
 * the wrong reason.
 *
 * The list is deliberately broad and deliberately stupid. It does not
 * understand anything; it only refuses. A false refusal costs one card its
 * extra line, and the card is complete without it.
 */
const NOT_ON_A_BIRTHDAY_CARD =
  /\b(kill|killed|kills|killing|massacre|shooting|shoots|shot|murder|murdered|bomb|bombing|bombed|attack|attacked|dies|died|death|deaths|dead|crash|crashed|crashes|earthquake|hurricane|tsunami|famine|war|battle|siege|executed|execution|assassinat\w*|rape|raped|slaughter|genocide|terror\w*|hostage|riot|riots|invasion|invades|invaded|disaster|sank|sinking|sunk|explosion|exploded|epidemic|pandemic|plague|suicide|abduct\w*|torture\w*)\b/i;

/**
 * The same refusal, stricter, for Wikipedia's own lines.
 *
 * Two lists rather than one because the two sources have very different base
 * rates and there is no sense punishing the curated one for the other's
 * habits. 3.6 percent of the researched facts match the list above. 41 percent
 * of the 19,734 Wikipedia events match it, because an encyclopedia's date
 * article is a list of wars, coups, disasters and elections, which is what an
 * encyclopedia is for and is not what a birthday card is for.
 */
const NOT_FROM_AN_ENCYCLOPEDIA =
  /\b(deposed|revolt|rebellion|coup|troops|army|armies|military|nazi|holocaust|massacred|uprising|mutiny|purge|famine|refugees|persecution)\b/i;

/** Long enough to say something, short enough to read at a glance. */
const LONGEST_LINE = 110;

/**
 * The same limit for the ask card, which has more room than the share image.
 *
 * 110 was written for cardHighlight, which paints one line into a picture and
 * genuinely has one line of room. The ask card is a serif block inside a box
 * that already wraps to two lines, and it inherited the number because both
 * called mayLead.
 *
 * What that cost, measured on the live September 8 page rather than guessed:
 * fourteen rows on that date are from 1958 on, and exactly one became a
 * candidate. Thirteen died here, not on the word screens. Star Trek's first
 * broadcast is 139 characters. Mark McGwire's 62nd home run is 168. The Nixon
 * pardon is 133. The one survivor, at 94, was a routine space station resupply
 * flight, and it carried all five rotation slots because it was alone. A limit
 * that admits only the shortest sentence admits only the dullest one, because
 * a memorable thing usually needs a clause to say what it was.
 *
 * 190 is two comfortable lines at the card's size on a 375 wide phone. It is
 * not a licence to print a paragraph: askScore still pays for shortness, so a
 * tight row beats a long one whenever both are there.
 */
const LONGEST_ASK = 190;

/**
 * Whether a sentence may lead a page.
 *
 * Both screens and the length, in one place, for the first ask on a date
 * page. The ask sits above everything else on the three open dates, so it is
 * held to the card's standard rather than the feed's: 41 percent of the
 * imported events would fail this, every date has at least one, and the one
 * that leads must not be a killing set in the type reserved for a question.
 */
export function mayLead(text: string): boolean {
  return text.length <= LONGEST_LINE &&
    !NOT_ON_A_BIRTHDAY_CARD.test(text) &&
    !NOT_FROM_AN_ENCYCLOPEDIA.test(text);
}

/**
 * Whether a sentence is one a birthday page may put a question mark over.
 *
 * The two word screens with no length on them, because how heavy a sentence is
 * has nothing to do with how much room the card has. Split out so a lead line
 * can be screened by length while the row it is written for is still screened
 * by subject: a gentle line over a killing is exactly what these refuse.
 */
export function mayLeadWords(text: string): boolean {
  return !NOT_ON_A_BIRTHDAY_CARD.test(text) && !NOT_FROM_AN_ENCYCLOPEDIA.test(text);
}

/**
 * Whether a sentence may be an ask card.
 *
 * Both word screens, unchanged, because a killing must never be set in the
 * type reserved for a question and that has nothing to do with how much room
 * the card has. Only the length differs. See LONGEST_ASK.
 */
export function mayAsk(text: string): boolean {
  return text.length <= LONGEST_ASK && mayLeadWords(text);
}

/**
 * The one thing that happened, chosen for a card.
 *
 * Drawn from the researched facts rather than from Wikipedia's events, and
 * that is the important part. The fact finder is already steered away from
 * encyclopedia shaped content and toward things somebody would screenshot, so
 * it is the curated set; Wikipedia's date articles lean the other way, toward
 * wars, disasters and elections, because that is what an encyclopedia is for.
 *
 * The shortest passing fact wins. Not because short means good, but because
 * the card has one line of room and the alternative is choosing at random. It
 * is stable across rebuilds for the same reason, so the image for a date does
 * not change every deploy for no reason.
 *
 * Returns null rather than reaching for something worse. 85 of the 366 dates
 * have no researched facts at all, and their cards stay exactly as they are
 * today, which is a card that already works.
 */
export function cardHighlight(
  facts: Fact[],
  events: DayEvent[],
  month: number,
  day: number,
): Highlight | null {
  const month_name = monthName(month);
  const fromFacts: Highlight[] = [];

  for (const fact of facts) {
    if (NOT_ON_A_BIRTHDAY_CARD.test(fact.fact)) continue;
    const { year, text } = splitDatePrefix(fact.fact, month_name, day);
    if (year === null) continue;
    if (text.length > LONGEST_LINE) continue;
    fromFacts.push({ year, text });
  }

  const chosen = shortest(fromFacts);
  if (chosen) return chosen;

  // Nothing researched for this date, so rather than fall back to the names,
  // fall back to Wikipedia's own line for it, screened twice.
  //
  // This exists because of what the names do when there is nothing else. The
  // list is ordered by attention, infamy is attention, and on the 85 dates the
  // backfill never reached it led with Charles Manson on November 12, Ted
  // Bundy on November 24, Andrew Tate on December 1, Vladimir Putin on
  // October 7 and an incelosphere streamer on December 17. A word list cannot
  // fix that, because a person's description does not say what is wrong with
  // them: Wikidata calls Assad a politician and Tate a businessman.
  //
  // An event's sentence, unlike a person's description, does describe the
  // thing being refused, which is why screening works here and does not work
  // there. November 12 becomes the PlayStation 5 being released.
  const fromEvents: Highlight[] = [];
  for (const event of events) {
    if (event.description.length > LONGEST_LINE) continue;
    if (NOT_ON_A_BIRTHDAY_CARD.test(event.description)) continue;
    if (NOT_FROM_AN_ENCYCLOPEDIA.test(event.description)) continue;
    fromEvents.push({ year: event.year, text: event.description });
  }
  return shortest(fromEvents);
}
