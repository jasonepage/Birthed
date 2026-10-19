import { strict as assert } from "node:assert";
import { test } from "node:test";
import { IMMUNITY_MS, TRIAL_WORDS, buriedOf, crownWithBurials, nextRedraw, trialsAt, type Vote } from "../src/trial.js";
import { crownOf, type WallBoost } from "../src/crown.js";
import { crownFor, graveyard, standingLine, trialsFor, wallMarks, wallSection, type WallDay, type WallStory } from "../src/wall.js";
import { recut, trialWord } from "../src/serve.js";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const C = "cccccccc-0000-4000-8000-000000000003";
const CLOSES = "2026-10-21T04:00:00Z";
const t = (hhmm: string): string => `2026-10-19T${hhmm}:00Z`;
const buzz = (storyId: string, at: string, units = 1): Vote => ({ storyId, at, units });
const sting = (storyId: string, at: string): Vote => ({ storyId, at });

test("three stings open a trial that ends at the next redraw, and more stings than buzzes buries", () => {
  const stings = [sting(A, t("14:05")), sting(A, t("14:10")), sting(A, t("14:20"))];
  const open = trialsAt([buzz(A, t("13:00"))], stings, Date.parse(t("14:30")), CLOSES).get(A)!;
  assert.equal(open.phase, "trial");
  assert.equal(open.endsAt, new Date(Date.parse(t("15:00"))).toISOString());
  assert.deepEqual([open.buzzes, open.stings], [1, 3]);
  const after = trialsAt([buzz(A, t("13:00"))], stings, Date.parse(t("15:01")), CLOSES).get(A)!;
  assert.equal(after.phase, "buried");
  assert.equal(after.buriedAt, new Date(Date.parse(t("15:00"))).toISOString());
  assert.equal(nextRedraw(Date.parse(t("14:59"))), Date.parse(t("15:00")));
  assert.equal(nextRedraw(Date.parse(t("15:00"))), Date.parse(t("16:00")), "a trial opened on the hour runs the whole hour");
});

test("a tie survives, and survival is six hours of immunity in which stings count for nothing", () => {
  const buzzes = [buzz(A, t("13:00")), buzz(A, t("13:01")), buzz(A, t("14:50"))];
  const stings = [sting(A, t("14:05")), sting(A, t("14:10")), sting(A, t("14:20")), sting(A, t("16:00"))];
  const s = trialsAt(buzzes, stings, Date.parse(t("16:30")), CLOSES).get(A)!;
  assert.equal(s.phase, "immune");
  assert.equal(s.immuneUntil, new Date(Date.parse(t("15:00")) + IMMUNITY_MS).toISOString());
  assert.equal(s.stings, 3, "the sting during immunity is ignored");
  assert.equal(s.trials, 1);
  // Six hours on, three fresh stings are needed for a new trial; the old three do not count again.
  const later = [...stings, sting(A, t("21:10")), sting(A, t("21:20"))];
  assert.equal(trialsAt(buzzes, later, Date.parse(t("21:30")), CLOSES).get(A)!.phase, "clear");
  const third = [...later, sting(A, t("21:40"))];
  assert.equal(trialsAt(buzzes, third, Date.parse(t("21:45")), CLOSES).get(A)!.phase, "trial");
});

test("a taken back sting is a row that is not there, so the trial it opened never opened", () => {
  const two = [sting(A, t("14:05")), sting(A, t("14:10"))];
  assert.equal(trialsAt([], two, Date.parse(t("14:30")), CLOSES).get(A)!.phase, "clear");
});

test("nothing cast at a buried story counts, and buzzes during a trial count for its defence", () => {
  const stings = [sting(A, t("14:05")), sting(A, t("14:10")), sting(A, t("14:20"))];
  const saved = trialsAt([buzz(A, t("14:40")), buzz(A, t("14:41")), buzz(A, t("14:42"))], stings, Date.parse(t("15:05")), CLOSES).get(A)!;
  assert.equal(saved.phase, "immune", "three buzzes in the last twenty minutes beat three stings");
  const dead = trialsAt([buzz(A, t("15:30"))], stings, Date.parse(t("16:00")), CLOSES).get(A)!;
  assert.equal(dead.phase, "buried");
  assert.equal(dead.buzzes, 0, "a buzz after the burial counts for nothing");
});

test("a trial still open at the seal is decided at the seal, and nothing after it counts", () => {
  const closes = t("15:30");
  const stings = [sting(A, t("15:10")), sting(A, t("15:15")), sting(A, t("15:20"))];
  const open = trialsAt([], stings, Date.parse(t("15:25")), closes).get(A)!;
  assert.equal(open.endsAt, new Date(Date.parse(closes)).toISOString());
  const sealed = trialsAt([buzz(A, t("15:40"))], stings, Date.parse(t("23:00")), closes).get(A)!;
  assert.equal(sealed.phase, "buried");
  assert.equal(sealed.buzzes, 0);
});

test("the crown leaves a story the moment the hive buries it, and is otherwise the crown it always was", () => {
  const boosts: WallBoost[] = [
    { id: 1, storyId: A, units: 1, castAt: t("13:00") },
    { id: 2, storyId: A, units: 1, castAt: t("13:05") },
    { id: 3, storyId: B, units: 1, castAt: t("13:10") },
  ];
  const eligible = new Set([A, B, C]);
  const plain = crownWithBurials(boosts.map((b) => ({ storyId: b.storyId, at: b.castAt, units: b.units })), eligible, new Map());
  const old = crownOf(boosts, [{ id: A, status: "placed" }, { id: B, status: "placed" }, { id: C, status: "placed" }]);
  assert.deepEqual({ holder: plain.holder, count: plain.count, changes: plain.changes }, { holder: old.holder, count: old.count, changes: old.changes });
  const buried = crownWithBurials(boosts.map((b) => ({ storyId: b.storyId, at: b.castAt, units: b.units })), eligible, new Map([[A, new Date(Date.parse(t("15:00"))).toISOString()]]));
  assert.equal(buried.holder, B);
  assert.deepEqual(buried.changes.at(-1), { at: new Date(Date.parse(t("15:00"))).toISOString(), to: B, from: A });
});

// ---------------------------------------------------------------------------
// On the page
// ---------------------------------------------------------------------------

function story(id: string, headline: string, rect: WallStory["rect"], support = 0): WallStory {
  return {
    id, wallDate: "2026-10-19", submittedAt: "2026-10-19T05:00:00Z", headline, url: `https://example.org/${id}`, outlet: "example.org",
    status: rect === null ? "overflow" : "placed", tier: "claimed", support, priority: 0, placedAt: "2026-10-19T05:01:00Z", rect,
    falseAt: null, falseNote: null, subjectKind: null, subjectId: null, sources: [],
  };
}

function day(stings: Array<{ storyId: string; castAt: string }>, boosts: WallBoost[] = []): WallDay {
  return {
    wallDate: "2026-10-19", year: 2026, month: 10, day: 19,
    opensAt: "2026-10-18T04:00:00Z", liveAt: "2026-10-19T04:00:00Z", closesAt: CLOSES, closedAt: null,
    stories: [
      story(A, "Every Major Game Releasing in November", { mx: 0, my: 0, w: 8, h: 8 }, boosts.filter((b) => b.storyId === A).length),
      story(B, "Violent clashes in France as over 1,200 arrested", { mx: 8, my: 0, w: 8, h: 8 }, boosts.filter((b) => b.storyId === B).length),
      story(C, "Deaths confirmed in major fire at Canada military base", { mx: 0, my: 8, w: 16, h: 8 }),
    ],
    boosts,
    stings: stings.map((x, i) => ({ id: i + 1, ...x })),
  };
}

const three = (id: string) => [{ storyId: id, castAt: t("14:05") }, { storyId: id, castAt: t("14:10") }, { storyId: id, castAt: t("14:20") }];

test("a tile on trial goes gray and cracked, with the words, the score both sides see and the minutes left", () => {
  const html = wallSection(day(three(A), [{ id: 1, storyId: A, units: 1, castAt: t("13:00") }]), "October 19", Date.parse(t("14:30")), { interactive: true });
  assert.match(html, /class="wtile[^"]*\bwtrial\b[^"]*" id="w-aaaaaaaa/);
  assert.ok(html.includes(`<b>${TRIAL_WORDS.trial}</b>`));
  assert.ok(html.includes('<span class="wtb">Buzz 1</span> <span class="wts">Sting 3</span>'));
  assert.ok(html.includes("Verdict in 30 min"));
  assert.ok(html.includes('<form class="wsting" method="post" action="/boost">') && html.includes('name="k" value="sting"'), "the sting is beside the buzz");
});

test("a buried story leaves the board for the graveyard, which a sealed hive keeps", () => {
  const d = day(three(A), [{ id: 1, storyId: B, units: 1, castAt: t("13:00") }]);
  const live = wallSection(d, "October 19", Date.parse(t("15:30")), { interactive: true });
  assert.ok(!/class="wtile[^"]*" id="w-aaaaaaaa/.test(live), "not on the board");
  assert.ok(live.includes('<div class="wgrave"') && live.includes(TRIAL_WORDS.buried));
  assert.ok(live.includes("Every Major Game Releasing in November</a><span class=\"wgravescore\">3 stings to no buzzes</span>"));
  const sealed = wallSection({ ...d, closedAt: CLOSES }, "October 19", Date.parse("2026-10-25T00:00:00Z"));
  assert.ok(sealed.includes('<div class="wgrave"'), "the graveyard is part of the sealed record");
  assert.ok(!sealed.includes("<form"), "and nothing moves after the seal");
  assert.equal(graveyard(day([]), trialsFor(day([]), Date.parse(t("15:30")))), "", "no burial, no graveyard");
});

test("the receipt says where the trial stands, and the server answers immune and buried in words", () => {
  const d = day([...three(A), { storyId: A, castAt: t("16:00") }], [{ id: 1, storyId: A, units: 1, castAt: t("13:00") }, { id: 2, storyId: A, units: 1, castAt: t("14:50") }, { id: 3, storyId: A, units: 1, castAt: t("14:51") }]);
  assert.ok(standingLine(d.stories[0]!, d, undefined, Date.parse(t("16:30"))).endsWith(`${TRIAL_WORDS.immune}.`));
  assert.equal(trialWord(d, A, "sting", Date.parse(t("16:30"))), "immune");
  assert.equal(trialWord(d, A, "buzz", Date.parse(t("16:30"))), null, "an immune story still takes buzzes");
  const dead = day(three(B));
  assert.equal(trialWord(dead, B, "buzz", Date.parse(t("15:30"))), "buried");
  assert.ok(standingLine(dead.stories[1]!, dead, undefined, Date.parse(t("15:30"))).startsWith(TRIAL_WORDS.buried));
  // The board is cut without the buried story.
  const cut = recut(dead, new Map(), Date.parse(t("15:30")));
  assert.equal(cut.stories[1]!.rect, null);
  assert.equal(cut.stories[1]!.status, "overflow");
  assert.deepEqual(buriedOf(trialsFor(dead, Date.parse(t("15:30")))), [B]);
  // A buried crown holder loses it.
  const crowned = day(three(A), [{ id: 1, storyId: A, units: 1, castAt: t("13:00") }]);
  assert.equal(crownFor(crowned, Date.parse(t("14:30"))).holder, A);
  assert.equal(crownFor(crowned, Date.parse(t("15:30"))).holder, null);
});

test("one browser's sting is its own: what is left, and its mark on the story it stung", () => {
  const d = day([]);
  const marks = wallMarks({ left: 3, allowance: 3, backed: [], stingsLeft: 0, stung: B }, d, Date.parse(t("14:00")));
  assert.ok(marks.includes('.wstingleft::after{content:"Sting used today."}'));
  assert.ok(marks.includes(`#w-${B} .wstungmark{display:block}`));
  assert.ok(!wallMarks({ left: 3, allowance: 3, backed: [], stung: "</style><script>" }, d, Date.parse(t("14:00"))).includes("<script>"));
});
