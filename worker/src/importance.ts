// What a day is remembered for.
//
// The old page printed every line Wikipedia holds for a date, oldest first, and
// let the reader sort it out. On September 7 that put Louis the Stammerer being
// crowned in 878 above the night the Blitz began, because 878 is a smaller
// number than 1940. A reader has no way to tell, from the page, that one of
// those changed the world and the other did not.
//
// This file answers a different question: of the seventy odd things that
// happened on a date, which handful is the day actually remembered for?
//
// It is deliberately built from signals other people already maintain, because
// a ranking this site invented on its own would be one more model opinion, and
// the entire argument of this project is that a model opinion is not evidence.
//
// ---------------------------------------------------------------------------
// The four signals, weakest to strongest.
//
// VIEWS. Sixty day English Wikipedia pageviews of the article the event links
// to, not of a person in it. This measures whether anybody alive is currently
// looking the thing up, which is the closest available proxy for living memory.
// It is also the signal that handles recency without a decay constant: a thing
// that happened last year has enormous views and falls naturally as it fades.
// Its bias is that it is English only.
//
// SITELINKS. How many language Wikipedias carry an article about it. This is
// the correction for the bias above, and it is weighted higher than views for
// exactly that reason. On September 7 it is the difference between ranking the
// launch of an American sports channel above the independence of Brazil and
// ranking it below, which is the difference between a useful page and an
// embarrassing one.
//
// ANNIVERSARY. Whether Wikipedia's own editors chose the event for
// Wikipedia:Selected anniversaries, the curated list their main page draws
// from. Human judgement, maintained for free, and worth a point. Only a point,
// because that list balances subject matter rather than ranking importance:
// on September 7 it includes the founding of an Italian football club and
// leaves out the first television picture.
//
// OBSERVED. Whether an annual commemoration is anchored to this event on this
// date. This is the strongest signal there is, because a country holding a
// public holiday every year is the literal definition of a day being
// remembered for a thing. September 7 has two, for opposite reasons: Brazil
// celebrates its independence, and Australia marks National Threatened Species
// Day for the thylacine that died in 1936.
//
// ---------------------------------------------------------------------------
// What this file deliberately does NOT do.
//
// It does not weight recent events up by hand. Views already do that, honestly,
// and a decay constant is a number somebody makes up and then defends forever.
//
// It does not rank by death toll. Counting bodies ranks the Lokomotiv Yaroslavl
// crash below a battle nobody remembers, and it turns a memorial into a ledger.
//
// It does not decide tone. Gravity below is a separate axis on purpose. How
// important a thing is and how grave it is are different questions, and the
// page needs both: a card for an assassination must not look like a card for a
// sports channel launching, however close their scores are.

export interface EventSignals {
  /** 60 day English Wikipedia pageviews of the event's own article. */
  views: number;
  /** Language Wikipedias holding an article on it. */
  sitelinks: number;
  /** Chosen for Wikipedia:Selected anniversaries for this date. */
  anniversary: boolean;
  /** An annual observance is anchored to this event on this date. */
  observed: boolean;
}

/**
 * How grave a row is, which sets its tone rather than its rank.
 *
 * Three levels and no more. A finer scale invites arguments nobody can settle
 * and produces a page with six visual registers on it.
 */
export type Gravity = "grave" | "notable" | "light";

/**
 * The score.
 *
 * Logarithms because both inputs span four orders of magnitude and a linear
 * sum would let one enormous pageview count decide every date on the calendar.
 *
 * Sitelinks carry half again the weight of views, for the reason written
 * above: views are English and the calendar is not.
 *
 * The two bonuses are flat rather than multiplied, so a commemorated event
 * cannot ride a single signal to the top of a date where something genuinely
 * larger happened. Two and a half points is roughly the gap between an article
 * in thirty languages and an article in three, which is the size of thumb this
 * deserves.
 */
export function importanceOf(s: EventSignals): number {
  return (
    Math.log10(Math.max(0, s.views) + 1) * 1.0 +
    Math.log10(Math.max(0, s.sitelinks) + 1) * 1.5 +
    (s.anniversary ? 1.0 : 0) +
    (s.observed ? 2.5 : 0)
  );
}

/**
 * How the page should be shaped for this date.
 *
 * A template that renders every date identically is the thing that makes a
 * site feel machine made, and it is also just wrong: September 11 and
 * September 7 are not the same kind of day and should not look alike.
 *
 * "single" means one event so far ahead of the rest that the page is that
 * event. The test is a gap of two full points to the runner up, which on this
 * scale is about a hundredfold difference in attention.
 *
 * "several" is the ordinary case: three or four things of comparable weight.
 *
 * "quiet" means nothing on the date clears the bar, and the page should say so
 * and lead with the people or the music instead of pretending.
 */
export type DayShape = "single" | "several" | "quiet";

export const QUIET_BELOW = 4.0;

export function shapeOf(scores: number[]): DayShape {
  const sorted = [...scores].sort((a, b) => b - a);
  const top = sorted[0] ?? 0;
  if (top < QUIET_BELOW) return "quiet";
  const second = sorted[1] ?? 0;
  return top - second >= 2.0 ? "single" : "several";
}

/**
 * How many rows belong in the memorial, as opposed to the drawer.
 *
 * Not a fixed number. A fixed number is how a quiet date ends up padded with
 * the inauguration of a canal, and how a heavy date gets truncated. The rule
 * is instead a distance from the top of the date: a row belongs if it is
 * within two points of the best thing that happened, up to a ceiling of six,
 * because past six nobody is reading a memorial any more.
 */
export function memorialCount(scores: number[], max = 6): number {
  const sorted = [...scores].sort((a, b) => b - a);
  const top = sorted[0] ?? 0;
  if (top < QUIET_BELOW) return 0;
  let n = 0;
  for (const s of sorted) {
    if (s < top - 2.0 || n >= max) break;
    n++;
  }
  return n;
}

/**
 * A first pass at gravity from the words of the row.
 *
 * A word list is a blunt instrument and it is meant to be. It exists so that
 * no row reaches a public page in a celebratory register by default, and the
 * curator can correct it in the panel. Wrong in the quiet direction is a card
 * that is more sober than it needed to be. Wrong in the other direction is a
 * massacre with a bright pink chip on it, so the default leans sober.
 */
const GRAVE = [
  "massacre", "assassinat", "murder", "kill", "died", "dies", "death", "dead",
  "crash", "earthquake", "disaster", "bombing", "bomb", "war", "battle",
  "siege", "shooting", "shot", "attack", "invasion", "genocide", "famine",
  "hostage", "terror", "executed", "lynch", "capsiz", "sank", "sinks",
  "fire at", "casualt", "extinct", "last known", "last surviving",
];

const LIGHT = [
  "pageant", "founded by british expatriates", "hall of fame", "cricket",
  "football club", "debut album", "premiere", "opens in", "inaugurat",
];

export function gravityOf(text: string): Gravity {
  const t = text.toLowerCase();
  if (GRAVE.some((w) => t.includes(w))) return "grave";
  if (LIGHT.some((w) => t.includes(w))) return "light";
  return "notable";
}

/**
 * The line at the top of a date page, built rather than written.
 *
 * Names the subjects of the top rows and stops. It is deliberately not a
 * sentence a model composed about the day, because that is where invented
 * significance creeps in. Joining three things the evidence already ranked is
 * a claim the page can stand behind.
 */
export function rememberedFor(subjects: string[]): string {
  const kept = subjects.filter((s) => s.trim() !== "").slice(0, 3);
  if (kept.length === 0) return "";
  if (kept.length === 1) return kept[0]!;
  if (kept.length === 2) return `${kept[0]} and ${kept[1]}`;
  return `${kept[0]}, ${kept[1]} and ${kept[2]}`;
}
