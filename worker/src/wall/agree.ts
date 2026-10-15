// What the day agreed on. docs/the-wall.md section 28.
//
// Pure, and arithmetic all the way down: no model, no score anybody has to
// trust, no request to anybody's API. Two headlines from different desks that
// share two uncommon words are the same story, and the number of desks that
// carried it is the only ranking the feed needs.
//
// Nothing here reads the clock, the network or the database. It is given
// stories and it answers with stories, so a test can hand it four headlines
// and read the answer.

/**
 * The shape this module needs out of a wall story. WallStory satisfies it;
 * so does a small object in a test, which is the point.
 */
export interface Agreeable {
  id: string;
  headline: string;
  outlet: string;
  tier: string;
  submittedAt: string;
  support: number;
  subjectKind: string | null;
  /** Order among unbacked stories in the feed: the date's own history above the news feeds. */
  priority: number;
}

/** Shorter words carry no subject: "after", "says", "the". */
export const MIN_WORD = 5;

/** How many uncommon words two headlines must share to be the same story. */
export const SHARED_WORDS = 2;

/**
 * The words that say nothing about which story this is.
 *
 * A list and not a frequency count, and docs/the-wall.md section 28 says why:
 * a day is a few hundred headlines, which is not enough text to learn the
 * common words from, and a list that is wrong in public is easier to see and
 * fix than a threshold that is wrong quietly.
 */
export const COMMON: ReadonlySet<string> = new Set([
  "about", "after", "again", "against", "ahead", "among", "because", "before",
  "being", "below", "between", "billion", "could", "current", "during",
  "every", "first", "front", "going", "himself", "herself", "inside", "itself",
  "latest", "least", "might", "million", "more", "most", "never", "other",
  "others", "people", "photos", "report", "reported", "reports", "said",
  "says", "second", "should", "since", "still", "their", "there", "these",
  "third", "those", "three", "through", "under", "until", "watch", "where",
  "which", "while", "whole", "without", "world", "would", "years", "video",
  "update", "updates",
]);

/**
 * The uncommon words in a headline, lowercased, punctuation gone.
 *
 * Curly quotes and dashes become spaces rather than nothing, so an outlet
 * writing "Trump's" gives "trump" and not "trumps". No stemming: two desks
 * writing the same story reuse the same proper nouns, which is the signal,
 * and stemming an unknown vocabulary invents matches instead of finding them.
 */
export function words(headline: string): Set<string> {
  const out = new Set<string>();
  for (const word of headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ")) {
    if (word.length >= MIN_WORD && !COMMON.has(word)) out.add(word);
  }
  return out;
}

/** Best sourced first. The same order the tile colours are in. */
const TIER_RANK: Record<string, number> = { seen_direct: 0, reported: 1, claimed: 2 };

function rankOf(tier: string): number {
  return TIER_RANK[tier] ?? 3;
}

/** One story as several desks filed it. */
export interface Cluster<T extends Agreeable> {
  /** The one row the feed draws. */
  leader: T;
  /** The rest of the cluster, which the feed does not draw as rows. */
  others: T[];
  /** Every outlet in the cluster, the leader's first, then the rest by name. */
  outlets: string[];
}

/**
 * Group the stories that are the same story.
 *
 * Union find over an inverted index, so the pairs actually compared are the
 * ones sharing at least one uncommon word rather than all n squared of them.
 * A day is a few hundred headlines and this is microseconds.
 *
 * The leader is the best sourced member, then the shortest headline, then the
 * earliest filed, then the id, so the answer never depends on the order the
 * rows arrived in. Shortest wins because the shortest statement of a story is
 * usually the plainest: "Sri Lanka court convicts 15 over deadly 2019 Easter
 * bombings" over "Fifteen guilty in 2019 Sri Lanka Easter bombings: What the
 * verdict says".
 *
 * Clusters come back most agreed first, counting distinct outlets and not
 * members, so one desk filing a story four times does not outrank four desks
 * filing it once.
 */
export function agree<T extends Agreeable>(stories: readonly T[]): Cluster<T>[] {
  const bags = stories.map((s) => words(s.headline));
  const parent = stories.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root]!;
    let walk = i;
    while (parent[walk] !== walk) { const next = parent[walk]!; parent[walk] = root; walk = next; }
    return root;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  const byWord = new Map<string, number[]>();
  for (let i = 0; i < stories.length; i++) {
    for (const word of bags[i]!) {
      const list = byWord.get(word) ?? [];
      list.push(i);
      byWord.set(word, list);
    }
  }
  // Candidate pairs are the ones sharing a word. Each shared word is counted
  // once, and the pair is linked when the count reaches the threshold.
  const shared = new Map<string, number>();
  for (const list of byWord.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const key = list[a] + ":" + list[b];
        const count = (shared.get(key) ?? 0) + 1;
        shared.set(key, count);
        if (count >= SHARED_WORDS) union(list[a]!, list[b]!);
      }
    }
  }

  const groups = new Map<number, T[]>();
  for (let i = 0; i < stories.length; i++) {
    const root = find(i);
    const list = groups.get(root) ?? [];
    list.push(stories[i]!);
    groups.set(root, list);
  }

  const clusters: Cluster<T>[] = [];
  for (const members of groups.values()) {
    const sorted = [...members].sort((a, b) =>
      rankOf(a.tier) - rankOf(b.tier)
      || a.headline.length - b.headline.length
      || a.submittedAt.localeCompare(b.submittedAt)
      || a.id.localeCompare(b.id));
    const leader = sorted[0]!;
    const others = sorted.slice(1);
    const names = [...new Set(others.map((s) => s.outlet).filter((o) => o !== "" && o !== leader.outlet))].sort();
    clusters.push({ leader, others, outlets: [leader.outlet, ...names] });
  }
  return clusters.sort((a, b) =>
    b.outlets.length - a.outlets.length
    || rankOf(a.leader.tier) - rankOf(b.leader.tier)
    || a.leader.submittedAt.localeCompare(b.leader.submittedAt)
    || a.leader.id.localeCompare(b.leader.id));
}

/** A story the day's news feeds filed, rather than something with a birthday. */
export function isNews(story: Agreeable): boolean {
  return story.subjectKind === null || story.subjectKind === "news";
}

/** What the feed draws, and who else carried each row. */
export interface Agreed<T extends Agreeable> {
  /** Every story the feed should draw, the news ordered by how well it agreed. */
  stories: T[];
  /** Story id to the other outlets that carried it. */
  alsoIn: Map<string, string[]>;
}

/**
 * The feed's stories, with the news collapsed to one row per story and
 * ordered by how many desks carried it.
 *
 * A backed story is never collapsed and never reordered: support is counted
 * per story, and folding a backed story into somebody else's row would hide a
 * buzz that was already spent. Nor is a story carrying a priority, which is
 * how the date's own history rides above the news feeds. Both stay at the
 * front, out of the clustering entirely, and only what actually came off a
 * news feed is grouped. Everything that is not news comes back untouched and
 * in the order it arrived, for takeTurns to rotate.
 */
export function agreeOnNews<T extends Agreeable>(stories: readonly T[]): Agreed<T> {
  const news = stories.filter(isNews);
  const rest = stories.filter((s) => !isNews(s));
  // Left alone, in the order they came in: a story somebody backed, and a
  // story carrying a priority. Priority is how the date's own history rides
  // above the news feeds, so a row with one did not come off a feed at all
  // and there is nothing for it to agree with.
  const kept = news.filter((s) => s.support > 0 || s.priority > 0);
  const clusters = agree(news.filter((s) => s.support === 0 && s.priority === 0));
  const alsoIn = new Map<string, string[]>();
  const leaders: T[] = [];
  for (const cluster of clusters) {
    leaders.push(cluster.leader);
    if (cluster.outlets.length > 1) alsoIn.set(cluster.leader.id, cluster.outlets.slice(1));
  }
  return { stories: [...kept, ...leaders, ...rest], alsoIn };
}
