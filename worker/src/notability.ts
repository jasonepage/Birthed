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
  livingBonus: number;
  modernBirthYear: number;
  modernBonus: number;
  creatorTerms: string[];
  musicTerms: string[];
}

export const DEFAULT_WEIGHTS: NotabilityWeights = {
  socialBonus: 0.35,
  creatorBonus: 1.4,
  musicBonus: 0.5,
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

function mentions(description: string | null, terms: string[]): boolean {
  if (!description) return false;
  const lower = description.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

export function notabilityScore(
  input: ScoreInput,
  weights: NotabilityWeights = DEFAULT_WEIGHTS,
): number {
  let multiplier = 1;
  if (input.hasSocial) multiplier += weights.socialBonus;
  if (mentions(input.description, weights.creatorTerms)) multiplier += weights.creatorBonus;
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
  if (mentions(input.description, weights.musicTerms)) found.push("music");
  if (input.hasSocial) found.push("social");
  if (!input.isLiving) found.push("died");
  return found;
}
