// The typed field on a date page, docs/the-wall.md section 15.
//
// The first real board was ten tiles of wire copy, and the reaction was that
// the mechanic was broken. It was not: a person handed that ballot and asked
// to spend a permanent vote on it answers correctly by spending nothing. The
// candidates were the problem, and a feed of two hundred headlines is a
// recognition task that needs a good list. This turns it into a recall task,
// which does not: ask what mattered about the date and find the story the
// reader means among what is already filed for it.
//
// No model, no network, no new stored data. Plain word matching over the
// stories the server has already read for the date, in memory, on the one
// request that carries the phrase. Section 15 leaves room for a model on the
// hard cases, picking from a closed list with grounded search off and
// returning an identifier; it would sit behind `answer` and is not built.
// What is stored of what people type is Nathan's call, and nothing here
// stores it.
//
// A miss is an answer, and a wrong match is a spent buzz. A buzz is scarce,
// permanent and irreversible, so a weak best match is worse than an honest
// miss: the miss is the front door to submission and the only editorial
// signal in this design that comes from a person, and the wrong match costs
// something that cannot be given back. Every rule below leans that way.
//
// A port of Birthed/Domain/HiveSearch.swift, rule for rule, tested against
// the same real headlines filed for September 9, 2026. If a rule changes in
// one, it changes in both or in neither.

import type { WallStory } from "./wall.js";

/** One story the query found, and how well. */
export interface Match {
  story: WallStory;
  /**
   * How much of the query the story answers, 0 to 1. Scored on the query's
   * side rather than the headline's: a two word query fully met by a long
   * headline is a good match, and a long headline is not a worse answer for
   * saying more.
   */
  coverage: number;
  /** How many of the query's words were met by the same word rather than by the front of a longer one. */
  exact: number;
}

/** What the field says back. */
export type Answer =
  /** The query had no words worth searching on. Not a miss: "the" does not fail to match, it never asked. */
  | { kind: "blank" }
  /** Nothing filed for the date says that. */
  | { kind: "miss" }
  /** One story, and it stands alone. */
  | { kind: "one"; match: Match }
  /** A few stories say that, best first. Which is the reader's to say. */
  | { kind: "several"; matches: Match[] };

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------

/**
 * The least of the query a story must answer to be offered at all. Half: a
 * two word query with one word met is offered, because "oil prices" means
 * the oil story, and a three word query with one word met is not, because
 * one word in three is a coincidence more often than a meaning.
 */
export const FLOOR = 0.5;

/**
 * What the front of a longer word is worth against a whole one. "moldov"
 * finds "Moldovan" and "moldova" finds "Moldovan", and both should, and
 * neither should outrank a story that says the word itself.
 */
export const PREFIX_WEIGHT = 0.7;

/**
 * The shortest query word that may match the front of a longer one. Under
 * this, "us" would find "used" and "die" would find "diet", which is the
 * substring problem back in a different coat.
 */
export const PREFIX_MINIMUM = 4;

/** How many stories the field offers when several say the same thing. */
export const SHOWN = 3;

/**
 * Words that carry no meaning worth matching on. "the oil thing" is the oil
 * story, and "the" on its own is not every story on the date.
 *
 * Deliberately short. "us" is not here because on a news headline it is the
 * United States far more often than a pronoun, and "open" is not here
 * because it is the US Open. A word left off this list costs a looser match
 * on one query; a word wrongly on it makes a query blind to a headline that
 * says it.
 */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  "a", "an", "the", "of", "and", "or", "in", "on", "at", "to", "for", "with", "by", "from",
  "is", "was", "were", "are", "be", "been", "it", "its", "this", "that", "these", "those",
  "about", "what", "which", "who", "when", "how", "did", "does", "do", "as", "but", "so",
  "not", "no", "my", "me", "i", "you", "your", "he", "she", "they", "we", "our", "their",
  "his", "her", "him", "them", "thing", "things", "stuff", "one", "some", "any", "there",
  "here", "just", "like", "up", "out", "into", "over",
]);

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/**
 * The apostrophes the feeds use. Half of them curl theirs, and a screen that
 * treats "NASA’s" and "NASA's" as different words has already been a bug in
 * this repository twice.
 */
const CURLY_APOSTROPHES = /[’‘ʼ′`]/g;

/** Combining marks, which is what an accent is once the text is decomposed. */
const MARKS = /[̀-ͯ]/g;

/** Anything that is not a letter, a digit or the apostrophe splits words. */
const NOT_WORD = /[^\p{L}\p{N}']+/u;

/**
 * A text as the words in it: lowercased, accents folded, apostrophes
 * straightened, possessives dropped, punctuation gone. Matching is on these
 * whole words and never on substrings, so "oil" does not find "spoiled".
 *
 * The possessive comes off both sides the same way, so "Britain’s" and
 * "britain" are one word. A reader who types "devils" for "Devil’s" is not
 * caught by this and is not guessed at either: the other words in the query
 * carry it or the answer is a miss.
 *
 * NFKD rather than NFD so a full width letter folds to its plain one, which
 * is the width insensitivity the Swift port asks for by name.
 */
export function words(text: string): string[] {
  const folded = text
    .normalize("NFKD")
    .replace(MARKS, "")
    .toLowerCase()
    .replace(CURLY_APOSTROPHES, "'");
  const out: string[] = [];
  for (const piece of folded.split(NOT_WORD)) {
    let word = piece;
    if (word.endsWith("'s")) word = word.slice(0, -2);
    else if (word.endsWith("s'")) word = word.slice(0, -1);
    word = word.replace(/'/g, "");
    if (word !== "") out.push(word);
  }
  return out;
}

/**
 * The query's words with the stop words gone. Empty when nothing is left,
 * and an empty query matches nothing rather than everything.
 */
export function queryWords(text: string): string[] {
  return words(text).filter((w) => !STOP_WORDS.has(w));
}

/**
 * An outlet as the labels of its host, without the top level domain and
 * without "www". "bbc.com" is the one word "bbc", and "en.wikipedia.org" is
 * "en" and "wikipedia". An outlet that is not a host, "The Guardian", is
 * simply its words.
 */
export function outletWords(outlet: string): string[] {
  let labels = outlet.trim().toLowerCase().split(".");
  if (labels.length > 1) labels = labels.slice(0, -1);
  labels = labels.filter((l) => l !== "www");
  return labels.flatMap((l) => words(l));
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface Score {
  coverage: number;
  exact: number;
}

/**
 * What one query word is worth against a story: the whole word in the
 * headline or the outlet, the front of a longer headline word, or nothing.
 *
 * The outlet is treated one step more loosely than the headline: a label
 * like "theguardian" or "sciencedaily" is two words run together rather
 * than prose, so a query word found anywhere inside it counts at the prefix
 * weight. The headline is prose and gets no such thing, because that is
 * exactly where "oil" would find "spoiled".
 */
export function weight(word: string, headline: string[], outlet: string[]): number {
  if (headline.includes(word) || outlet.includes(word)) return 1;
  if (word.length < PREFIX_MINIMUM) return 0;
  if (headline.some((h) => h.startsWith(word))) return PREFIX_WEIGHT;
  if (outlet.some((o) => o.includes(word))) return PREFIX_WEIGHT;
  return 0;
}

/**
 * How much of the query the story answers. Each query word takes its best
 * weight and the mean is the coverage, so the score is about the query and
 * not about the headline's length.
 */
export function score(query: string[], headline: string[], outlet: string[]): Score {
  if (query.length === 0) return { coverage: 0, exact: 0 };
  let total = 0;
  let exact = 0;
  for (const word of query) {
    const value = weight(word, headline, outlet);
    total += value;
    if (value === 1) exact += 1;
  }
  return { coverage: total / query.length, exact };
}

/**
 * The headline and the outlet, and deliberately not the quotation.
 *
 * The quotation is the source's own paragraph and it is prose: it is where
 * "today", "died", "people" and "said" live, and a query that only meets a
 * story there meets it on words the reader never saw on a tile. The headline
 * is what the hive shows and what a reader recognises, and the cost of a
 * wrong match is a permanent buzz, so the search is held to what the reader
 * could have meant.
 */
export function scoreStory(query: string[], story: WallStory): Score {
  return score(query, words(story.headline), outletWords(story.outlet));
}

/**
 * The feed's own order, the same comparison wallBody makes under the hive:
 * most backed first, then the date's own history ahead of the news feeds,
 * then arrival, then the identifier so two runs of one query give one order.
 */
function feedOrder(a: WallStory, b: WallStory): number {
  return b.support - a.support || b.priority - a.priority || a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id);
}

/** Best first: most of the query answered, then answered with whole words rather than fronts of words, then the feed's own order. */
export function before(a: Match, b: Match): number {
  return b.coverage - a.coverage || b.exact - a.exact || feedOrder(a.story, b.story);
}

// ---------------------------------------------------------------------------
// Asking
// ---------------------------------------------------------------------------

/**
 * Every story that answers enough of the query, best first, at most `limit`
 * of them. Empty for an empty query, a query of stop words, and a query
 * nothing says.
 */
export function matches(query: string, stories: WallStory[], limit: number = SHOWN): Match[] {
  const wanted = queryWords(query);
  if (wanted.length === 0) return [];
  const found: Match[] = [];
  for (const story of stories) {
    const result = scoreStory(wanted, story);
    if (result.coverage < FLOOR) continue;
    found.push({ story, coverage: result.coverage, exact: result.exact });
  }
  found.sort(before);
  return found.slice(0, Math.max(0, limit));
}

/**
 * The field's answer.
 *
 * One story is offered alone when it is the only one that clears the floor,
 * or when it answers the whole query and nothing else does: "russia" is the
 * drone war at the border before it is the Siege of Sevastopol, whose
 * headline says "Russian". Anything closer than that is a few candidates
 * and the reader's choice, because "us" is the oil strikes, the US Open and
 * the terrorist designation all at once and no score can say which the
 * reader meant.
 */
export function answer(query: string, stories: WallStory[], limit: number = SHOWN): Answer {
  if (queryWords(query).length === 0) return { kind: "blank" };
  const found = matches(query, stories, limit);
  const first = found[0];
  if (first === undefined) return { kind: "miss" };
  if (found.length === 1) return { kind: "one", match: first };
  const second = found[1]!;
  if (first.coverage >= 1 && second.coverage < 1) return { kind: "one", match: first };
  return { kind: "several", matches: found };
}
