// The holding pool. docs/the-wall.md section 5.
//
// Nothing a person submits appears on the wall immediately. A story sits in
// the pool until it has enough evidence and enough support. This file is the
// two rules, pure, so the seed tool and a later placement job apply the same
// ones.

import type { Tier } from "./allocator.js";

/**
 * How long a story with one source waits before evidence is considered
 * enough. The document says "a set number of hours" and leaves the number
 * open. Twelve was chosen on September 9, 2026: a single source story is
 * placed by the following morning, and a rumour is not on the wall an hour
 * after it is posted.
 */
export const HOLD_HOURS = 12;
export const HOLD_MS = HOLD_HOURS * 60 * 60 * 1000;

export interface SourceLike {
  /** Who owns the outlet, as plainly as it can be named. */
  owner: string;
  /** The quotation was found on the page, exactly. */
  verified: boolean;
}

/** How many differently owned outlets have a verified quotation. */
export function independentOwners(sources: SourceLike[]): number {
  const owners = new Set<string>();
  for (const source of sources) {
    if (!source.verified) continue;
    owners.add(source.owner.trim().toLowerCase());
  }
  return owners.size;
}

/**
 * Enough evidence means two sources under different corporate ownership, or
 * the holding period having passed.
 */
export function hasEnoughEvidence(
  sources: SourceLike[],
  submittedAt: number | string,
  now: number | string,
): boolean {
  if (independentOwners(sources) >= 2) return true;
  const submitted = typeof submittedAt === "number" ? submittedAt : Date.parse(submittedAt);
  const at = typeof now === "number" ? now : Date.parse(now);
  return at - submitted >= HOLD_MS;
}

/** Enough support means at least one boost unit. */
export function hasEnoughSupport(support: number): boolean {
  return support >= 1;
}

/**
 * A story the news importer put there, rather than a person. news.ts leaves
 * submitted_by null, and nothing else can: wall_submit_story always writes the
 * caller's own id.
 */
export function isSeeded(story: { submittedBy?: string | null }): boolean {
  // Explicitly null and nothing else. An absent field must never waive a rule
  // by accident: a caller that forgot to read the column gets the stricter
  // answer, which is the one that keeps a story off the board.
  return story.submittedBy === null;
}

export function eligibleForWall(
  story: { support: number; submittedAt: number | string; submittedBy?: string | null },
  sources: SourceLike[],
  now: number | string,
): boolean {
  // A seeded story is placed once one of its sources has a verified quotation,
  // and waits for nothing else. Neither the hold nor the support rule applies.
  //
  // The hold exists so a rumour is not carved into permanent history an hour
  // after somebody posted it. A story taken from NPR's own feed is not that:
  // the feed list is the vetting, and the outlet published it under its own
  // name. Applied here the hold does the opposite of its job, because
  // submitted_at is when the row was written rather than when the thing
  // happened, so today's news could not reach today's wall until tomorrow,
  // which is the one thing the wall exists to do.
  //
  // Nothing is waived that protects a reader. One source still means the
  // claimed tier and a hard ceiling of four modules, and an unverified
  // quotation still keeps a story off the board entirely.
  if (isSeeded(story)) return sources.some((source) => source.verified);

  if (!hasEnoughEvidence(sources, story.submittedAt, now)) return false;
  // The support rule exists to stop the board filling with modules nobody
  // asked for, and a curated news feed is the asking. A seeded story is placed
  // on evidence alone and stays at one module until somebody boosts it, so
  // what people think still decides every size on the wall. Without this the
  // wall is deadlocked before it opens: a seeded story waits for a boost, and
  // on a day one product there is nobody to cast one. A story a person
  // submitted still needs someone other than the submitter to agree it
  // belongs. docs/the-wall.md section 11.
  return hasEnoughSupport(story.support);
}

/**
 * The evidence tier a story's sources earn it. Seen directly is a judgement
 * about the kind of source, video, a filing, a record, an official statement,
 * and is passed in rather than guessed from a host name. Reported needs two
 * independently owned outlets with verified quotations. Anything else is
 * claimed.
 */
export function tierFor(sources: SourceLike[], seenDirect: boolean): Tier {
  if (seenDirect) return "seen_direct";
  if (independentOwners(sources) >= 2) return "reported";
  return "claimed";
}
