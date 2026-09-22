// Notability scoring. Pure functions, no input or output, so this is the part
// that can be tested without a network.
//
// FR-021 and FR-130. Two versions of this have been wrong in instructive ways.
//
// The first ranked on Wikipedia sitelink count and produced a page of European
// footballers, because sitelink count measures how many languages have an
// article rather than how many people care.
//
// The second ranked on English Wikipedia pageviews, which fixed that, and then
// produced a page of working screen actors, because Wikipedia readers look up
// actors. That is closer, and still not who this audience opens a birthday app
// for. So attention is the base and the signals below tilt it toward people
// who are famous on the internet rather than famous in the credits.
//
// The third is a blend, and it is not in this file. notability_score stayed
// exactly as described above and is still what decides who is screened out
// and who gets the internet tilt. What a date page orders by, since
// September 22, 2026, is notable_people.world_score, which is
// sqrt(monthly_views) * sitelink_count. Neither of the two failures above
// tried a blend: the first used sitelinks alone and got footballers, the
// second used attention alone and got working screen actors and, on five
// dates, a serial killer. Attention alone also put Beethoven eighth on
// December 16 and Gandhi under a teenage footballer on October 2, which is
// the thing that finally settled it. CLAUDE.md section 5, and the migration
// 20260922000000 carries the reasoning.
//
// Every input is stored on the row, so retuning is an UPDATE, not an import.

export interface NotabilityWeights {
  /** Wikidata carries a TikTok, Instagram or YouTube identifier for them. */
  socialBonus: number;
  /** Their one line description says they are an internet person. */
  creatorBonus: number;
  /** Their one line description says they make music. */
  musicBonus: number;
  /** Commentators, pundits and political internet people. Kyle Kulinski is not
   *  an actor, a musician or a YouTuber by description, and the audience that
   *  watches him is the audience this product is for. */
  commentaryBonus: number;
  livingBonus: number;
  modernBirthYear: number;
  modernBonus: number;
  creatorTerms: string[];
  musicTerms: string[];
  commentaryTerms: string[];
  /** Descriptions that must never open a date page. See isAdultContent. */
  adultTerms: string[];
  /** The same, for notoriety earned by harming people. See isViolentNotoriety. */
  violenceTerms: string[];
}

export const DEFAULT_WEIGHTS: NotabilityWeights = {
  socialBonus: 0.35,
  creatorBonus: 1.4,
  musicBonus: 0.5,
  commentaryBonus: 0.9,
  livingBonus: 0.15,
  modernBirthYear: 1985,
  modernBonus: 0.25,
  // Matched against the Wikidata description, which is already on every row,
  // so this costs no extra query and no extra request.
  creatorTerms: [
    "youtuber", "youtube", "streamer", "twitch", "tiktok", "internet personality",
    "internet celebrity", "influencer", "content creator", "podcaster",
    "social media", "vlogger", "media personality", "web personality",
  ],
  musicTerms: ["rapper", "singer", "musician", "songwriter", "record producer", "disc jockey"],
  // Deliberately not "politician". That word would pull in every mayor and
  // senator who ever lived, which is the actor problem wearing a suit.
  commentaryTerms: [
    "political commentator", "commentator", "pundit", "political activist",
    "talk show host", "talk radio", "columnist", "political analyst",
  ],
  // Matched against the same Wikidata description as everything else above.
  // Wikidata is consistent here in a way it is not about much else: it says
  // "pornographic actress", "adult film performer" or "erotic" and it says it
  // in the one line description, which is why a term list is enough and a
  // model is not needed.
  adultTerms: [
    "pornographic", "porn actor", "porn actress", "porn star", "pornstar",
    "adult film", "adult video", "adult actress", "adult actor",
    "adult entertainer", "adult performer", "adult model", "erotic",
  ],
  // Matched against the same one line Wikidata description. Found on
  // September 6: five date pages opened with one of these people, because
  // notability_score is attention and infamy is attention.
  violenceTerms: [
    "serial killer", "serial murderer", "murderer", "mass murderer",
    "spree killer", "mass shooter", "school shooter", "killer",
    "terrorist", "war criminal", "genocide", "dictator", "nazi",
    "rapist", "child abuser", "sex offender", "cult leader",
    "assassin", "mobster", "gangster", "crime boss", "mafia",
    "kidnapper", "arsonist", "torturer", "slave trader",
  ],
};

export interface ScoreInput {
  monthlyViews: number;
  birthYear: number | null;
  isLiving: boolean;
  hasSocial: boolean;
  description: string | null;
}

/** Postgres integers stop at about 2.1 billion. */
const CEILING = 2_000_000_000;

/**
 * Whether this person must never open a date page.
 *
 * Found on September 6, where the page opened with a former pornographic film
 * actress, and then found to be 106 people across the table, nearly all of
 * them ranked first on their own date. About one date page in four.
 *
 * The cause is directly above. Her description reads "American internet
 * personality, podcaster and former pornographic film actress", which matches
 * creatorTerms twice, so the creator bonus that exists to surface an internet
 * person over a Bundesliga midfielder was multiplying her attention by 3.15.
 * The signal worked exactly as designed. It has no idea what it is promoting,
 * and no amount of retuning the weights fixes that, because the problem is not
 * that the score is too high. It is that this is the sentence a fourteen year
 * old reads on their birthday.
 *
 * A rule and not a model, because Wikidata is consistent about this wording
 * and a term list is checkable, free, and gives the same answer every run.
 *
 * The known cost of a term list: "erotic" catches the Marquis de Sade, who is
 * an eighteenth century writer rather than a performer. Suppressing him is the
 * right outcome for this app anyway, so the false positive is left in.
 */
export function isAdultContent(
  description: string | null,
  weights: NotabilityWeights = DEFAULT_WEIGHTS,
): boolean {
  return mentions(description, weights.adultTerms);
}

function mentions(description: string | null, terms: string[]): boolean {
  if (!description) return false;
  const lower = description.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

/**
 * Whether this person is known for harming people, and so must never be the
 * first thing somebody reads on their own birthday.
 *
 * Found on September 6, months after the same problem was fixed for adult
 * performers and in exactly the same place. Five of the 366 date pages opened
 * with one of these: Ted Bundy on November 24, Charles Manson on November 12,
 * Ed Gein on August 27, John Wayne Gacy on March 17 and Benito Mussolini on
 * July 29. Every one of them was first because notability_score is attention
 * and infamy is attention, which is the same sentence that was written about
 * the adult performers and was not followed anywhere else at the time.
 *
 * **What this cannot do, and it is the larger half.** Screening.swift says it
 * plainly: an event's sentence describes the thing being refused, and a
 * person's description does not. Wikidata calls Bashar al-Assad a politician
 * and Andrew Tate a businessman, and no list of words will ever reach them. So
 * this catches the people whose description says what they did and misses the
 * people whose description does not, which is a floor rather than a solution.
 * The solution is the page not leading with a ranked list of names at all,
 * which is the change this landed beside.
 *
 * The bare word "criminal" was in this list and is not any more, because the
 * test below caught it hiding "American criminal defense attorney". Removing
 * it costs nothing that matters: all five of the real rows are still caught,
 * Charles Manson by "cult leader" rather than by "criminal". What it does
 * leave through is somebody Wikidata describes only as "American criminal",
 * which is a gap worth knowing about rather than closing with a word that
 * takes lawyers with it. "war criminal" stays, because that phrase means one
 * thing.
 */
export function isViolentNotoriety(
  description: string | null,
  weights: NotabilityWeights = DEFAULT_WEIGHTS,
): boolean {
  return mentions(description, weights.violenceTerms);
}

export function notabilityScore(
  input: ScoreInput,
  weights: NotabilityWeights = DEFAULT_WEIGHTS,
): number {
  // Before anything else, and it returns rather than subtracting, because a
  // bonus large enough to outrank a penalty is how this would come back.
  if (isAdultContent(input.description, weights)) return 0;
  if (isViolentNotoriety(input.description, weights)) return 0;

  let multiplier = 1;
  if (input.hasSocial) multiplier += weights.socialBonus;
  if (mentions(input.description, weights.creatorTerms)) multiplier += weights.creatorBonus;
  if (mentions(input.description, weights.commentaryTerms)) multiplier += weights.commentaryBonus;
  if (mentions(input.description, weights.musicTerms)) multiplier += weights.musicBonus;
  if (input.isLiving) multiplier += weights.livingBonus;
  if (input.birthYear !== null && input.birthYear >= weights.modernBirthYear) {
    multiplier += weights.modernBonus;
  }
  return Math.min(CEILING, Math.round(Math.max(0, input.monthlyViews) * multiplier));
}

/** Exposed so the importer can record why somebody scored what they scored. */
export function signals(input: ScoreInput, weights: NotabilityWeights = DEFAULT_WEIGHTS): string[] {
  const found: string[] = [];
  if (mentions(input.description, weights.creatorTerms)) found.push("creator");
  if (mentions(input.description, weights.commentaryTerms)) found.push("commentary");
  if (mentions(input.description, weights.musicTerms)) found.push("music");
  if (input.hasSocial) found.push("social");
  if (!input.isLiving) found.push("died");
  if (isAdultContent(input.description, weights)) found.push("adult, score forced to 0");
  if (isViolentNotoriety(input.description, weights)) found.push("violence, score forced to 0");
  return found;
}


// ---------------------------------------------------------------------------

/** The minimum a candidate needs before it is worth spending a request on. */
export interface CandidateInput {
  sitelinks: number;
  /** Named to match WikidataPerson, so the importer can pass its rows straight in. */
  shortDescription: string | null;
}

/**
 * Which people get their pageviews looked up.
 *
 * This was the bug that hid Trisha Paytas. Pageviews cost one request each, so
 * only some candidates can be looked up, and the first version picked them by
 * sitelink count. That quietly put the coverage bias straight back in: she has
 * 13 sitelinks on a date with 4,290 people who have English articles, so she
 * was cut before her pageviews were ever consulted. The signal we removed from
 * the score was still deciding who got scored.
 *
 * So anybody the description marks as an internet person is looked up, always,
 * regardless of how few languages cover them. They are rare enough that this
 * is bounded. The rest of the budget goes to the widest covered, which is a
 * fine proxy for everybody else.
 */
export function isInternetNative(
  description: string | null,
  weights: NotabilityWeights = DEFAULT_WEIGHTS,
): boolean {
  return mentions(description, weights.creatorTerms)
    || mentions(description, weights.commentaryTerms);
}

/**
 * What a date page orders by, and what the importer keeps.
 *
 * The same arithmetic as `notable_people.world_score`, migration
 * 20260922000000, and it has to stay the same or the fifty people kept are
 * not the fifty people shown.
 *
 * **Why the importer needs it and not just the reader.** `toRows` sorted by
 * `notability_score` and cut the date at `maxPerDay`, so attention was
 * deciding who *existed* and not only who came first. Albert Einstein has
 * 321 sitelinks, real English pageviews and no bonuses at all: he is dead,
 * born before the modern cut, not a creator and not on social media. Fifty
 * living actors, footballers and YouTubers with multipliers of up to 3.15
 * beat him, so March 14 held exactly fifty people and none of them was
 * Einstein. The same cut removed Darwin, Mozart and Marie Curie, and the
 * year floor removed Shakespeare, Leonardo and Galileo underneath it.
 *
 * A nought stays a nought, so the adult content and violent notoriety
 * screens still decide who never reaches a date page, ahead of this.
 */
export function worldScore(monthlyViews: number, sitelinks: number, score: number): number {
  if (score <= 0) return 0;
  return Math.round(Math.sqrt(Math.max(0, monthlyViews)) * Math.max(0, sitelinks));
}

export function selectCandidates<T extends CandidateInput>(
  people: T[],
  cap: number,
  weights: NotabilityWeights = DEFAULT_WEIGHTS,
): T[] {
  const creators: T[] = [];
  const rest: T[] = [];

  for (const person of people) {
    if (isInternetNative(person.shortDescription, weights)) creators.push(person);
    else rest.push(person);
  }

  const byCoverage = [...rest].sort((a, b) => b.sitelinks - a.sitelinks);
  const room = Math.max(0, cap - creators.length);
  return [...creators, ...byCoverage.slice(0, room)];
}
