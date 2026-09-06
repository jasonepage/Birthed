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

export function notabilityScore(
  input: ScoreInput,
  weights: NotabilityWeights = DEFAULT_WEIGHTS,
): number {
  // Before anything else, and it returns rather than subtracting, because a
  // bonus large enough to outrank a penalty is how this would come back.
  if (isAdultContent(input.description, weights)) return 0;

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
