// Notability scoring. Pure functions, no input or output, so this is the part
// that can be tested without a network.
//
// FR-021 and FR-130. Raw Wikipedia sitelink count is the starting point and it
// is a good, boring proxy, but on its own it orders a day page toward people
// who died a century ago and are covered in forty languages. The audience for
// this product opens a birthday page for modern figures, who often carry
// articles in only a handful of languages. So the stored score carries a
// recency term, and the weights live here rather than compiled into the app,
// so retuning is a re-score rather than a re-import.

export interface NotabilityWeights {
  sitelinkWeight: number;
  livingBonus: number;
  modernBirthYear: number;
  modernBonus: number;
}

export const DEFAULT_WEIGHTS: NotabilityWeights = {
  sitelinkWeight: 10,
  livingBonus: 0.75,
  modernBirthYear: 1960,
  modernBonus: 0.5,
};

export interface ScoreInput {
  sitelinks: number;
  birthYear: number | null;
  isLiving: boolean;
}

export function notabilityScore(
  input: ScoreInput,
  weights: NotabilityWeights = DEFAULT_WEIGHTS,
): number {
  let multiplier = 1;
  if (input.isLiving) multiplier += weights.livingBonus;
  if (input.birthYear !== null && input.birthYear >= weights.modernBirthYear) {
    multiplier += weights.modernBonus;
  }
  return Math.round(input.sitelinks * weights.sitelinkWeight * multiplier);
}
