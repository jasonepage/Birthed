// How much of the day's news a story is part of, October 18, 2026.
//
// Nathan could not find the biggest story of the day on its own board. The
// riots in France ran under seven headlines from the BBC, Al Jazeera and the
// Guardian between six in the morning and eight at night, and not one of
// them reached the hive: the eight news tiles were dealt at one in the
// morning Eastern, to the first eight items the feeds sent, and with no
// buzz and no score the order among news was arrival, so those eight held
// the board all day. A list of November video games was on it at dinner.
//
// No model and no search. Three things anybody can count:
//
// - **Coverage.** A word that appears in headlines from two or more
//   different outlets, and in few enough of the day's headlines that it
//   names something ("protest", "france", "anthropic") rather than nothing
//   ("says", "live"), is a topic, weighed by outlets times headlines. A
//   story is scored by its biggest topic. One newsroom repeating itself is
//   not a topic: Al Jazeera's four Gaza headlines are one outlet.
// - **Freshness.** Newer beats older among equals, so the board turns over
//   through the day instead of freezing at one in the morning.
// - **One tile a topic.** A story leading with the same topic as a story
//   already ahead of it, or sharing two topics with one, is the same story
//   told again, and it drops well down, so
//   the eight tiles are eight stories and not one riot eight times.
//
// What it gets wrong, named: a word can tie two different stories (two
// "protests" a continent apart), and a name in every story (a president)
// counts as coverage. The cost of either is a tile's order among the news,
// never a story's place on the board once somebody buzzes it.

export interface CoverageInput {
  id: string;
  headline: string;
  outlet: string;
  submittedAt: string;
}

/** Words that name nothing, plus the feeds' own furniture. */
const STOP = new Set(`
about above after again against ago also always among another around away back been before being best better between
both came come could didn come does doing down during each even ever every first from gets give goes going good great
have here into just know last least less like live long look made make many more most much must near need never news
next only other ours over part says said same seem should since some still such take than that their them then there
these they thing think this those three through time today under until very want week weeks well were what when where
which while will with without would year years your youre isnt dont cant wont thats heres whats theyre
game games season match league player players team teams play played final round world says watch video review
people women live update updates show shows new old big inside out amid how why who
`.split(/\s+/).filter(Boolean));

/** A few demonyms and forms, so "French" finds "France" and "Parisians" finds "Paris". */
const SAME: Record<string, string> = {
  french: "france", parisian: "paris", parisians: "paris", israeli: "israel", israelis: "israel",
  ukrainian: "ukraine", ukrainians: "ukraine", russian: "russia", russians: "russia", chinese: "china",
  indian: "india", american: "america", americans: "america", palestinian: "palestine", palestinians: "palestine",
  canadian: "canada", british: "britain", iranian: "iran", mexican: "mexico", european: "europe",
  protesters: "protest", protests: "protest", protesting: "protest", protested: "protest",
  riots: "riot", rioting: "riot", rioters: "riot", looting: "loot", looted: "loot",
};

/** The topic-bearing words of a headline. */
export function words(headline: string): Set<string> {
  const out = new Set<string>();
  const plain = headline.toLowerCase().replace(/[’']s\b/g, "").replace(/[’']/g, "");
  for (const raw of plain.split(/[^a-z0-9]+/)) {
    if (raw.length < 4 || /^\d+$/.test(raw) || STOP.has(raw)) continue;
    let w = SAME[raw] ?? raw;
    if (SAME[raw] === undefined && w.length > 5 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
    if (STOP.has(w)) continue;
    out.add(w);
  }
  return out;
}

/**
 * A number per story, bigger for a story more of the day's outlets are
 * telling, newer among equals, and well down for one that repeats a story
 * already ahead of it. Every story gets at least ten, so a weight read from
 * it is never nought. Pure.
 */
export function coverageScores(stories: readonly CoverageInput[]): Map<string, number> {
  const out = new Map<string, number>();
  if (stories.length === 0) return out;
  const tokens = stories.map((s) => words(s.headline));
  const outlets = new Map<string, Set<string>>();
  const counts = new Map<string, number>();
  stories.forEach((s, i) => {
    for (const w of tokens[i]!) {
      if (!outlets.has(w)) outlets.set(w, new Set());
      outlets.get(w)!.add(s.outlet);
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  });
  // A topic: two outlets at least, and rare enough to name something. The
  // floor of eight is for a quiet day, where twelve in a hundred is a word
  // in four headlines and a real story can be told more often than that.
  const ceiling = Math.max(8, Math.ceil(stories.length * 0.12));
  const topic = (w: string): boolean => (outlets.get(w)?.size ?? 0) >= 2 && (counts.get(w) ?? 0) <= ceiling;
  // A topic's weight is how many outlets tell it times how many headlines
  // do: seven protest headlines from three newsrooms outweigh three about
  // one company from three, and both outweigh one newsroom saying a thing
  // four times, which is not a topic at all.
  const weight = (w: string): number => outlets.get(w)!.size * counts.get(w)!;
  const topics = tokens.map((t) => [...t].filter(topic).sort((a, b) => weight(b) - weight(a) || (a < b ? -1 : 1)));

  // Freshness: the newest story is one, the oldest nought.
  const times = stories.map((s) => Date.parse(s.submittedAt) || 0);
  const oldest = Math.min(...times);
  const span = Math.max(1, Math.max(...times) - oldest);

  // A story is scored by its biggest topic, with a little for the rest, so
  // the headline that is about the day's big story beats one that merely
  // shares a lot of small words with others.
  const raw = stories.map((_, i) => {
    const [key, ...rest] = topics[i]!;
    const others = rest.reduce((n, w) => n + weight(w), 0);
    return 10 + (key === undefined ? 0 : 2 * weight(key)) + 0.5 * others + 5 * ((times[i]! - oldest) / span);
  });

  // One tile a topic: walk from the strongest; a story whose biggest topic
  // is one a kept story already leads with, or that shares two topics with
  // one, is the same story told again.
  const order = stories.map((_, i) => i).sort((a, b) => raw[b]! - raw[a]! || times[b]! - times[a]!);
  const kept: number[] = [];
  for (const i of order) {
    const mine = topics[i]!;
    const repeat = mine.length > 0 && kept.some((k) => {
      const theirs = topics[k]!;
      if (theirs[0] === mine[0]) return true;
      return mine.filter((w) => theirs.includes(w)).length >= 2;
    });
    out.set(stories[i]!.id, Math.round((repeat ? 10 + (raw[i]! - 10) * 0.25 : raw[i]!) * 100) / 100);
    if (!repeat) kept.push(i);
  }
  return out;
}
