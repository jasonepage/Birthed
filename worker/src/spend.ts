// What the tick spent on the model, in one line.
//
// The tick has two steps that ask a model anything: the facts editor
// (rate-facts) and the stories editor (rate-stories). Everything else it does
// is reads of free feeds and free pages. Both Edge Functions already answer
// with how many times they asked the model, so the tick needs no new
// infrastructure to say what a run cost: it reads the two answers and prints
// one line, so the next bill is never a surprise.
//
// The prices are the estimates CLAUDE.md records for each editor, not a
// metered figure: about half a cent for a facts run (one call scoring every
// unscored fact in one run) and about a cent for a stories call (one batch of
// a date's pool). When Google's price or the prompt size changes, change the
// two numbers here and nowhere else.

/** Estimated cost of one rate-facts run, in United States dollars. */
export const FACTS_RUN_USD = 0.005;
/** Estimated cost of one rate-stories call, in United States dollars. */
export const STORIES_CALL_USD = 0.01;

export interface EditorCalls {
  /** rate-facts runs, one model call each. */
  facts: number;
  /** rate-stories calls, one model call each. */
  stories: number;
}

/**
 * How many model calls a rate-facts answer reports.
 *
 * The function answers `{ runs, scored, shown, errors }` and asks the model
 * once per run, so `runs` is the count. Anything unreadable counts as nought
 * rather than throwing: the spend line is a report and must never be the
 * reason a tick fails.
 */
export function factsCalls(answer: string): number {
  return countField(answer, "runs");
}

/**
 * How many model calls a rate-stories answer reports.
 *
 * The function answers `{ status, calls, report }` and `calls` is the number
 * of times it asked the model.
 */
export function storiesCalls(answer: string): number {
  return countField(answer, "calls");
}

function countField(answer: string, field: string): number {
  try {
    const parsed: unknown = JSON.parse(answer);
    if (typeof parsed !== "object" || parsed === null) return 0;
    const value = (parsed as Record<string, unknown>)[field];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

/** The estimated spend of a run, in dollars. */
export function estimatedUsd(calls: EditorCalls): number {
  return calls.facts * FACTS_RUN_USD + calls.stories * STORIES_CALL_USD;
}

/**
 * The one line the tick prints, for example
 * `editor: 2 calls, ~$0.01 (facts 1 run, stories 1 call)`.
 *
 * A run that asked nothing says `editor: 0 calls, $0.00` so the quiet runs
 * are visible too. The amount is rounded to the cent and shown as less than
 * a cent when a positive estimate rounds to nought.
 */
export function spendLine(calls: EditorCalls): string {
  const total = calls.facts + calls.stories;
  const usd = estimatedUsd(calls);
  if (total === 0) return "editor: 0 calls, $0.00";
  const cents = Math.round(usd * 100);
  const amount = cents === 0 ? "<$0.01" : `~$${(cents / 100).toFixed(2)}`;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return `editor: ${plural(total, "call")}, ${amount} (facts ${plural(calls.facts, "run")}, stories ${plural(calls.stories, "call")})`;
}
