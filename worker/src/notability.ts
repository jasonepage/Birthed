// Notability scoring. Pure functions, no input or output, so this is the part
// that can be tested without a network.
//
// FR-021 and FR-130. The first version ranked on Wikipedia sitelink count and
// produced a day page of European footballers, because sitelink count measures
// how many languages have an article rather than how many people care. The
// score now starts from English Wikipedia pageviews, which measures attention
// directly, and adjusts it with two cheap signals.
//
// The weights live here rather than in the app, and every input is stored on
// the row, so retuning the order is an UPDATE rather than another import.

export interface NotabilityWeights {
  /** Somebody Wikidata knows a TikTok, Instagram or YouTube account for is a
   *  person who exists on the internet, not only in an encyclopedia. */
  socialBonus: number;
  livingBonus: number;
  modernBirthYear: number;
  modernBonus: number;
}

export const DEFAULT_WEIGHTS: NotabilityWeights = {
  socialBonus: 0.35,
  livingBonus: 0.15,
  modernBirthYear: 1985,
  modernBonus: 0.25,
};

export interface ScoreInput {
  monthlyViews: number;
  birthYear: number | null;
  isLiving: boolean;
  hasSocial: boolean;
}

/** Postgres integers stop at about 2.1 billion, and no article gets near this. */
const CEILING = 2_000_000_000;

export function notabilityScore(
  input: ScoreInput,
  weights: NotabilityWeights = DEFAULT_WEIGHTS,
): number {
  let multiplier = 1;
  if (input.hasSocial) multiplier += weights.socialBonus;
  if (input.isLiving) multiplier += weights.livingBonus;
  if (input.birthYear !== null && input.birthYear >= weights.modernBirthYear) {
    multiplier += weights.modernBonus;
  }
  return Math.min(CEILING, Math.round(Math.max(0, input.monthlyViews) * multiplier));
}
