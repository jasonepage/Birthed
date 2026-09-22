import { strict as assert } from "node:assert";
import { test } from "node:test";

import { COMMON, agree, agreeOnNews, isNews, words, type Agreeable } from "../src/agree.js";

let seq = 0;
function s(headline: string, outlet: string, over: Partial<Agreeable> = {}): Agreeable {
  seq++;
  return {
    id: `id-${String(seq).padStart(3, "0")}`,
    headline,
    outlet,
    tier: "claimed",
    submittedAt: `2026-09-22T10:${String(seq % 60).padStart(2, "0")}:00Z`,
    support: 0,
    subjectKind: null,
    priority: 0,
    ...over,
  };
}

// The four headlines are the live September 22 wall, read off the database
// while docs/the-wall.md section 28 was being written.
const VERDICT = [
  s("Sri Lanka court convicts 14 over deadly Easter bombings", "aljazeera.com"),
  s("Sri Lanka court convicts 15 men over deadly Easter Sunday bombings", "bbc.com"),
  s("Sri Lanka court convicts 15 over deadly 2019 Easter bombings", "npr.org"),
  s("Fifteen guilty in 2019 Sri Lanka Easter bombings: What the verdict says", "aljazeera.com"),
];

const BETS = s("Early bets for Week 3: Three games to target right away", "espn.com");
const VENUE = [
  s("Apple Music to open concert venue in Battersea Power Station", "bbc.com"),
  s("Apple Reveals Apple Music Hall, a New Live Venue in London", "variety.com"),
];

test("words keeps the uncommon ones and drops the rest", () => {
  const found = words("Sri Lanka court convicts 15 over deadly Easter bombings");
  assert.ok(found.has("lanka"));
  assert.ok(found.has("convicts"));
  assert.ok(found.has("bombings"));
  // Under five letters.
  assert.ok(!found.has("sri"));
  assert.ok(!found.has("over"));
  assert.ok(!found.has("15"));
  // On the common list.
  assert.ok(!found.has("deadly") === false);
  for (const common of COMMON) assert.ok(!found.has(common), `${common} should be dropped`);
});

test("words treats punctuation as a space, so a possessive gives the name", () => {
  const found = words("Trump’s bizarre social media blitz leaves world guessing");
  assert.ok(found.has("trump"));
  assert.ok(!found.has("trumps"));
  assert.ok(!found.has("world"), "world is on the common list");
});

test("four desks on one story make one cluster naming all of them", () => {
  const clusters = agree(VERDICT);
  assert.equal(clusters.length, 1);
  const [only] = clusters;
  assert.equal(only!.others.length, 3);
  assert.deepEqual([...only!.outlets].sort(), ["aljazeera.com", "bbc.com", "npr.org"]);
});

test("the leader is the shortest telling, which is the plainest one", () => {
  const [only] = agree(VERDICT);
  assert.equal(only!.leader.headline, "Sri Lanka court convicts 14 over deadly Easter bombings");
});

test("a better sourced member leads over a shorter one", () => {
  const clusters = agree([
    s("Sri Lanka court convicts over Easter bombings", "aljazeera.com"),
    s("Sri Lanka court convicts fifteen men over the deadly Easter bombings", "bbc.com", { tier: "seen_direct" }),
  ]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]!.leader.outlet, "bbc.com");
});

test("a story one desk carried is its own cluster of one", () => {
  const clusters = agree([BETS]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]!.others.length, 0);
  assert.deepEqual(clusters[0]!.outlets, ["espn.com"]);
});

test("one shared word is not enough", () => {
  const clusters = agree([
    s("Apple Music to open concert venue in Battersea", "bbc.com"),
    s("Apple loses appeal in the Dutch dating market case", "theverge.com"),
  ]);
  assert.equal(clusters.length, 2, "one shared word, apple, must not merge them");
});

test("clusters come back most agreed first", () => {
  const clusters = agree([BETS, ...VENUE, ...VERDICT]);
  assert.equal(clusters.length, 3);
  assert.equal(clusters[0]!.outlets.length, 3, "the verdict, three desks");
  assert.equal(clusters[1]!.outlets.length, 2, "the venue, two desks");
  assert.equal(clusters[2]!.outlets.length, 1, "the bets, one desk");
});

test("distinct outlets rank a cluster, not members, so one desk filing four times does not win", () => {
  const spam = ["a", "b", "c", "d"].map((n) =>
    s(`Council approves the riverside crossing plan, filing ${n}`, "onedesk.com"));
  const clusters = agree([...spam, ...VENUE]);
  const first = clusters[0]!;
  assert.equal(first.outlets.length, 2);
  assert.ok(first.leader.headline.startsWith("Apple"), "two desks beat four filings from one");
});

test("the answer does not depend on the order the rows arrived in", () => {
  const forwards = agree([BETS, ...VENUE, ...VERDICT]).map((c) => c.leader.id);
  const backwards = agree([...VERDICT, ...VENUE, BETS].reverse()).map((c) => c.leader.id);
  assert.deepEqual(forwards, backwards);
});

test("agreeOnNews draws one row per story and names who else carried it", () => {
  const { stories, alsoIn } = agreeOnNews([BETS, ...VENUE, ...VERDICT]);
  assert.equal(stories.length, 3, "eight filings, three stories");
  const lead = stories[0]!;
  assert.deepEqual(alsoIn.get(lead.id), ["bbc.com", "npr.org"]);
  assert.equal(alsoIn.has(BETS.id), false, "a story one desk carried says nothing extra");
});

test("a backed story is never collapsed and never reordered", () => {
  const backed = { ...VERDICT[1]!, support: 3 };
  const { stories, alsoIn } = agreeOnNews([BETS, ...VENUE, VERDICT[0]!, backed, VERDICT[2]!, VERDICT[3]!]);
  const ids = stories.map((x) => x.id);
  assert.equal(ids[0], backed.id, "the backed row leads and keeps its own button");
  assert.ok(ids.includes(VERDICT[0]!.id), "the rest of the verdict still gets a row");
  assert.equal(alsoIn.get(backed.id), undefined, "a backed row is not a cluster leader");
});

test("the date's own history keeps its priority and is never clustered", () => {
  const filed = [
    s("1888: The Football League kicks off at Deepdale", "", { priority: 3 }),
    s("1888: The Football League kicks off in Lancashire", "", { priority: 3 }),
  ];
  const { stories, alsoIn } = agreeOnNews([BETS, ...filed]);
  assert.equal(stories.length, 3, "two filed rows stay two rows");
  assert.deepEqual(stories.slice(0, 2).map((x) => x.id), filed.map((f) => f.id), "priority stays above the feeds");
  assert.equal(alsoIn.size, 0);
});

test("everything that is not news comes back untouched and in order", () => {
  const people = [
    s("1938: Anybody Here was born", "", { subjectKind: "person" }),
    s("1959: Somebody Else was born", "", { subjectKind: "person" }),
  ];
  const { stories } = agreeOnNews([...people, BETS]);
  const kept = stories.filter((x) => !isNews(x)).map((x) => x.id);
  assert.deepEqual(kept, people.map((p) => p.id));
});

test("two people born the same year do not become one story", () => {
  const people = [
    s("1938: Frederick Hollows, surgeon, born in Dunedin", "", { subjectKind: "person" }),
    s("1938: Frederick Somebody, surgeon, born in Dunedin", "", { subjectKind: "person" }),
  ];
  const { stories } = agreeOnNews(people);
  assert.equal(stories.length, 2, "clustering is for the news feeds only");
});

test("an empty day is an empty answer", () => {
  assert.deepEqual(agree([]), []);
  assert.deepEqual(agreeOnNews([]).stories, []);
});
