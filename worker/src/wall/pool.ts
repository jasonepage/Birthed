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

export function eligibleForWall(
  story: { support: number; submittedAt: number | string },
  sources: SourceLike[],
  now: number | string,
): boolean {
  return hasEnoughSupport(story.support) && hasEnoughEvidence(sources, story.submittedAt, now);
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
