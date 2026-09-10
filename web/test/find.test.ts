import { strict as assert } from "node:assert";
import { test } from "node:test";

import { FLOOR, PREFIX_WEIGHT, answer, matches, outletWords, queryWords, weight, words } from "../src/find.js";
import type { WallStory } from "../src/wall.js";

// The typed field, docs/the-wall.md section 15: what it finds, what it
// refuses to find, and the order it answers in. A port of HiveSearchTests
// in the iOS app, against the same fixture.
//
// The fixture is the sixteen real headlines filed for September 9, 2026 in
// the live database, copied out rather than invented, in the repository's
// habit of pinning a rule to real rows. Several of them curl their
// apostrophes, one has a dollar sign and one has a hyphenated pair of
// countries, and every one of those shapes has been a bug somewhere in this
// product already.

function story(id: string, headline: string, outlet: string, minute: number, extra: Partial<WallStory> = {}): WallStory {
  return {
    id, wallDate: "2026-09-09",
    submittedAt: new Date(Date.UTC(2026, 8, 9, 12, minute)).toISOString(),
    headline, url: `https://example.org/${id}`, outlet,
    status: "pool", tier: "claimed", support: 0, priority: 0, placedAt: null, rect: null,
    falseAt: null, falseNote: null, subjectKind: null, subjectId: null, sources: [],
    ...extra,
  };
}

/** September 9, 2026, as the live database holds it. */
const filed: WallStory[] = [
  story("oil", "Oil hits $100 a barrel for first time since July after US and Houthi strikes", "bbc.com", 1),
  story("moldova", "Two die at Moldovan border as Russia-Ukraine drone war rages", "bbc.com", 2),
  story("westbank", "Land in limbo: BBC visits West Bank village in area earmarked by Israel for settlement", "bbc.com", 3),
  story("gauff", "Gauff beats Andreeva to reach US Open semifinals in comeback win", "aljazeera.com", 4),
  story("methane", "Chinese scientists find a hidden atomic structure that unlocks methane", "sciencedaily.com", 5),
  story("arrows", "Devil’s Arrows: Ancient builders hauled 55,000-pound stones 11 miles for Britain’s tallest stone row", "sciencedaily.com", 6),
  story("ecuador", "Notorious Ecuadorian crime gang designated a terrorist group by US", "theguardian.com", 7),
  story("nasa", "NASA’s Chandra Unveils Mysterious X-Ray Objects", "nasa.gov", 8),
  story("cohen", "Trump says he would consider pardon for former attorney Michael Cohen", "theguardian.com", 9),
  story("iphone", "Apple unveils first-ever foldable iPhone Duo", "aljazeera.com", 10),
  story("sandler", "Adam Sandler, American actor and comedian, born 1966", "wikidata.org", 11),
  story("williams", "Michelle Williams, American actress (born 1980), born 1980", "wikidata.org", 12),
  story("crimea", "1855: Crimean War: The Siege of Sevastopol comes to an end when Russian forces abandon the city.", "en.wikipedia.org", 13),
  story("u2", "2014: The album Songs of Innocence by U2 is digitally released at no charge to all customers of the iTunes Music Store", "en.wikipedia.org", 14),
  story("bug", "1947: First case of a computer bug being found", "en.wikipedia.org", 15),
  story("spore", "2008: Spore shipped with copy protection that allowed three installs.", "heraldnet.com", 16),
];

const ids = (found: Array<{ story: WallStory }>): string[] => found.map((m) => m.story.id);

// ---------------------------------------------------------------------------
// What it finds
// ---------------------------------------------------------------------------

test("every query a reader would type finds the story they mean, and offers it alone", () => {
  const expected: Array<[string, string]> = [
    ["oil", "oil"], ["oil prices", "oil"], ["the oil thing", "oil"],
    ["moldova", "moldova"], ["gauff", "gauff"], ["sandler", "sandler"], ["adam sandler", "sandler"],
    ["foldable iphone", "iphone"], ["u2 album", "u2"], ["crimean war", "crimea"], ["nasa", "nasa"],
    ["spore", "spore"], ["computer bug", "bug"], ["ecuador gang", "ecuador"],
  ];
  for (const [query, id] of expected) {
    assert.equal(matches(query, filed)[0]?.story.id, id, `"${query}" should find ${id} first`);
    const a = answer(query, filed);
    assert.equal(a.kind, "one", `"${query}" should be one answer, got ${a.kind}`);
    if (a.kind === "one") assert.equal(a.match.story.id, id, `"${query}"`);
  }
});

test("a query fully met by a long headline is a full match: coverage is about the query, not the headline", () => {
  const found = matches("songs innocence", filed);
  assert.equal(found[0]?.story.id, "u2");
  assert.equal(found[0]?.coverage, 1);
  assert.equal(found[0]?.exact, 2);
});

test("the front of a longer word counts, and counts for less", () => {
  const short = matches("moldov", filed);
  assert.equal(short[0]?.story.id, "moldova", "moldov finds Moldovan");
  assert.equal(short[0]?.coverage, PREFIX_WEIGHT);
  assert.equal(short[0]?.exact, 0);

  // "Russia" is the drone war and "Russian" is the Siege of Sevastopol.
  // Both are found, the whole word first, and because only one answers the
  // whole query it is offered alone.
  const russia = matches("russia", filed);
  assert.deepEqual(ids(russia), ["moldova", "crimea"]);
  assert.equal(russia[0]!.coverage, 1);
  assert.equal(russia[1]!.coverage, PREFIX_WEIGHT);
  const a = answer("russia", filed);
  assert.equal(a.kind, "one");
  if (a.kind === "one") assert.equal(a.match.story.id, "moldova");
});

test("a short word does not match the front of anything, and a whole word only matches itself", () => {
  const headline = words("Two die at Moldovan border");
  // "die" is a word on the date and "died" is not, and a reader whose
  // grandmother died is not asking about the Moldovan border.
  assert.equal(weight("died", headline, ["bbc"]), 0);
  assert.equal(weight("die", headline, ["bbc"]), 1);
  assert.equal(weight("di", headline, ["bbc"]), 0);
  // Whole tokens, never substrings: "oil" cannot find "spoiled".
  assert.equal(weight("oil", words("The spoiled harvest"), []), 0);
});

// ---------------------------------------------------------------------------
// What it refuses to find
// ---------------------------------------------------------------------------

test("a query nothing says is a miss, never the nearest thing", () => {
  for (const query of ["zzzzzz", "my grandmother died today"]) {
    assert.deepEqual(matches(query, filed), [], `"${query}" should match nothing`);
    assert.deepEqual(answer(query, filed), { kind: "miss" }, `"${query}" is a miss`);
  }
});

test("a query with no words in it is blank rather than every story", () => {
  for (const query of ["", "   ", "the", "a the of and", "the thing"]) {
    assert.deepEqual(matches(query, filed), [], `"${query}" should match nothing`);
    assert.deepEqual(answer(query, filed), { kind: "blank" }, `"${query}" is blank`);
  }
});

test("a word inside another word is not a match", () => {
  // "age" sits inside "rages" and "village" and is neither.
  assert.deepEqual(matches("age", filed), []);
  // "died" is longer than "die" and is not it.
  assert.deepEqual(matches("died", filed), []);
});

test("one word in three is not enough, and one in two is", () => {
  // "war" is on the date twice, and a query that is mostly about something
  // else is not answered by it.
  assert.deepEqual(matches("cold war spies", filed), []);
  assert.deepEqual(ids(matches("oil prices", filed)), ["oil"]);
  assert.equal(FLOOR, 0.5);
});

test("the quotation is not searched: a match found only there is on words the reader never saw", () => {
  const quoted = story("q", "Council approves the river crossing", "example.org", 20, {
    sources: [{
      id: "s", url: "https://example.org/q", outlet: "example.org", owner: "Example", headline: "Council approves the river crossing",
      quotation: "The mayor said the grandmother of the plan had died years ago.", verifiedAt: null, addedAt: "2026-09-09T12:00:00Z", checks: [],
    }],
  });
  assert.deepEqual(matches("grandmother", [quoted]), []);
  assert.deepEqual(matches("mayor", [quoted]), []);
  assert.equal(matches("river crossing", [quoted])[0]?.story.id, "q");
});

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

test("both apostrophes are one apostrophe, and a possessive comes off", () => {
  assert.deepEqual(words("Devil’s Arrows"), ["devil", "arrows"]);
  assert.deepEqual(words("Devil's Arrows"), ["devil", "arrows"]);
  assert.deepEqual(words("NASA’s Chandra"), ["nasa", "chandra"]);
  assert.deepEqual(words("Britain’s tallest"), ["britain", "tallest"]);
  assert.deepEqual(words("the builders’ stones"), ["the", "builders", "stones"]);
  assert.deepEqual(words("don’t"), ["dont"]);
  // Straight or curled, the reader finds the same story.
  assert.equal(matches("devil's arrows", filed)[0]?.story.id, "arrows");
  assert.equal(matches("devil’s arrows", filed)[0]?.story.id, "arrows");
  assert.equal(matches("nasa's chandra", filed)[0]?.story.id, "nasa");
  assert.equal(matches("britain", filed)[0]?.story.id, "arrows");
});

test("punctuation, case and accents are folded", () => {
  assert.deepEqual(words("Oil hits $100 a barrel"), ["oil", "hits", "100", "a", "barrel"]);
  assert.deepEqual(words("Russia-Ukraine drone war"), ["russia", "ukraine", "drone", "war"]);
  assert.deepEqual(words("X-Ray Objects"), ["x", "ray", "objects"]);
  assert.deepEqual(words("  Land   in\tlimbo:  "), ["land", "in", "limbo"]);
  assert.deepEqual(words("Café Zürich"), ["cafe", "zurich"]);
  assert.deepEqual(words("1855: Crimean War"), ["1855", "crimean", "war"]);
});

test("stop words come off the query and never leave it empty by accident", () => {
  assert.deepEqual(queryWords("the oil thing"), ["oil"]);
  assert.deepEqual(queryWords("what happened with the iphone"), ["happened", "iphone"]);
  assert.deepEqual(queryWords("a the of and"), []);
  // "us" and "open" are headline words on this date and are not stop words.
  assert.deepEqual(queryWords("us open"), ["us", "open"]);
});

test("an outlet is its host without the top level domain", () => {
  assert.deepEqual(outletWords("bbc.com"), ["bbc"]);
  assert.deepEqual(outletWords("en.wikipedia.org"), ["en", "wikipedia"]);
  assert.deepEqual(outletWords("www.theguardian.com"), ["theguardian"]);
  assert.deepEqual(outletWords("The Guardian"), ["the", "guardian"]);
  assert.deepEqual(outletWords("nasa.gov"), ["nasa"]);
});

test("the outlet is searched, and a run together label counts as a prefix", () => {
  const wikipedia = matches("wikipedia", filed);
  assert.deepEqual(new Set(ids(wikipedia)), new Set(["crimea", "u2", "bug"]));
  assert.equal(wikipedia[0]?.coverage, 1);
  // "guardian" inside "theguardian" is worth a prefix, not a whole word.
  const guardian = matches("guardian", filed);
  assert.deepEqual(new Set(ids(guardian)), new Set(["ecuador", "cohen"]));
  assert.equal(guardian[0]?.coverage, PREFIX_WEIGHT);
  // And it narrows a headline query rather than replacing it.
  assert.equal(ids(matches("bbc oil", filed))[0], "oil");
  const a = answer("bbc oil", filed);
  assert.equal(a.kind, "one");
  if (a.kind === "one") assert.equal(a.match.story.id, "oil");
});

// ---------------------------------------------------------------------------
// The order
// ---------------------------------------------------------------------------

test("several stories come back best first and in the same order every time", () => {
  // Three from one outlet, told apart only by support, which is the feed's
  // own first tie break: what people backed comes first.
  const stories = filed.map((s) => s.id === "oil" ? { ...s, support: 1 } : s.id === "westbank" ? { ...s, support: 2 } : s);
  const first = matches("bbc", stories);
  assert.deepEqual(ids(first), ["westbank", "oil", "moldova"]);
  assert.deepEqual(matches("bbc", stories), first, "the same query twice gives the same order");
  assert.deepEqual(ids(matches("bbc", [...stories].reverse())), ["westbank", "oil", "moldova"]);
  assert.deepEqual(answer("bbc", stories), { kind: "several", matches: first });
});

test("a whole word outranks the front of one, and more of the query outranks both", () => {
  // "crimean war" is the whole query for the siege and half of it for the
  // drone war, so the siege is first and alone.
  const war = matches("crimean war", filed);
  assert.deepEqual(ids(war), ["crimea", "moldova"]);
  assert.equal(war[0]!.coverage, 1);
  assert.equal(war[1]!.coverage, 0.5);
  const a = answer("crimean war", filed);
  assert.equal(a.kind, "one");
  if (a.kind === "one") assert.equal(a.match.story.id, "crimea");
});

test("a word that several stories say is the reader's choice", () => {
  // "US" is the oil strikes, the US Open and the terrorist designation,
  // and no score can say which was meant.
  const us = matches("us", filed);
  assert.deepEqual(new Set(ids(us)), new Set(["oil", "gauff", "ecuador"]));
  const a = answer("us", filed);
  assert.equal(a.kind, "several");
  if (a.kind === "several") assert.deepEqual(a.matches, us);
});

test("the limit holds and the best survive it", () => {
  const two = matches("us", filed, 2);
  assert.equal(two.length, 2);
  assert.deepEqual(ids(two), ids(matches("us", filed)).slice(0, 2));
  assert.deepEqual(matches("us", filed, 0), []);
});
