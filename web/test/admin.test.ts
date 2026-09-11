import test from "node:test";
import assert from "node:assert/strict";
import { renderAdmin, renderNumbers } from "../src/admin.js";

/**
 * The panel is a scripted page. A syntax error in that script is a blank
 * screen for a curator and nothing else in this suite would run it, so the
 * script is cut out of the page and parsed here.
 */
function panelScript(): string {
  const html = renderAdmin({ url: "https://x.supabase.co", key: "k" });
  return html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
}

test("the panel's script parses", () => {
  const script = panelScript();
  assert.ok(script.length > 1000);
  new Function(script);
});

test("a row with no sentence offers a draft, and the draft writes to the right table", () => {
  const script = panelScript();
  assert.ok(script.includes('canDraft: status === "published" && said === ""'), "a published culture row with no sentence can be drafted");
  assert.ok(script.includes("canDraft: !!row.verified && !line"), "a shown fact with no card line can be drafted");
  assert.ok(script.includes("canDraft: !row.suppressed && !line"), "a shown Wikipedia line with no card line can be drafted");
  assert.ok(script.includes('data-draft="'), "and the button is drawn for them");
  // The trap in docs/panel-brief.md: same job, two tables.
  assert.ok(script.includes("cultural_events?id=eq.\" + drafting.id"), "a culture row's sentence is context_string");
  assert.ok(script.includes("lead_lines?on_conflict=subject_kind,subject_id"), "a timeline row's sentence is a lead line");
  // Nothing saves until a key is pressed.
  assert.ok(script.includes("Nothing is saved until you press Enter"));
});

test("a scan is an argument: the panel answers it and only a key moves a row", () => {
  const script = panelScript();
  assert.ok(script.includes("/functions/v1/scan-day"));
  // Every verdict carries agree and overrule, and both write the record.
  assert.ok(script.includes('data-agree="'));
  assert.ok(script.includes('data-overrule="'));
  // The buttons say what they do, and a keep verdict is a note with none.
  assert.ok(script.includes("Hide it <kbd>y</kbd>"));
  assert.ok(script.includes("Keep it <kbd>n</kbd>"));
  assert.ok(script.includes("You kept it."));
  assert.ok(script.includes("body: { agreed: agreed, acted_at:"), "the overruled ones are kept");
  // Agreeing with keep or heavy moves nothing.
  assert.ok(script.includes('var moves = verdict !== "keep" && verdict !== "heavy";'));
  // A proposal fills the form; the Add button is the write.
  assert.ok(script.includes("Pick the category and press Add"));
});

test("the starters aim at a reader and carry the method that works", () => {
  const script = panelScript();
  assert.ok(script.includes('label: "Twelve in 2009"'));
  assert.ok(script.includes('label: "Broke containment"'));
  // docs/researching-a-date.md: searching the date finds nothing.
  assert.ok(script.includes("Do not search the date, which finds nothing."));
  assert.ok(script.includes("then check the date") || script.includes("then find a page published within days of it"));
});

import { POINTS_JS } from "../src/admin.js";
import { renderDayPage } from "../src/render.js";

/** The one copy of the formula, evaluated the way the panel evaluates it. */
function points(): { rowPoints: (input: unknown) => { total: number; measured: boolean; parts: Array<[string, number, string]> }; datePoints: (t: number[]) => number } {
  return new Function(POINTS_JS + "; return { rowPoints: rowPoints, datePoints: datePoints };")();
}

test("a row's points are computed from stored inputs and shown in parts", () => {
  const { rowPoints } = points();
  const strong = rowPoints({ selected: true, views: 1_000_000, viewsOnDate: 8000, viewsMedianDay: 500, year: 1998, written: true, sourceUrl: "https://en.wikipedia.org/wiki/Mark_McGwire", dateKind: null, flags: [], answers: null });
  assert.equal(strong.total, 35 + 25 + 10 + 25 + 15 + 4);
  assert.deepEqual(strong.parts.map((p) => p[0]), ["spike", "reach", "selected", "memory", "written", "sourcing"]);
  const dull = rowPoints({ selected: false, views: 0, year: 2026, written: false, sourceUrl: "https://www.wikidata.org/wiki/Q1", dateKind: null, flags: ["release calendar", "thin"], answers: null });
  assert.equal(dull.total, 0, "a bare release from this year with nothing written is worth nothing");
  // Unmeasured reach is zero points and says so, never a guessed number.
  const unmeasured = rowPoints({ selected: false, views: null, year: 2000, written: true, sourceUrl: "https://example.com/x", dateKind: null, flags: [], answers: null });
  assert.equal(unmeasured.parts[1]?.[1], 0);
  assert.equal(unmeasured.parts[1]?.[2], "unmeasured");
});

test("Wikipedia's pick cannot outrank a thing people look up on the day", () => {
  const { rowPoints } = points();
  // An 1888 editors' pick with nothing else: what the top of September 8 was.
  const pick = rowPoints({ selected: true, views: null, year: 1888, written: false, sourceUrl: "https://en.wikipedia.org/wiki/September_8", dateKind: null, flags: [], answers: null });
  // A 2015 row nobody selected whose article spikes eight times on the date.
  const spiky = rowPoints({ selected: false, views: 200_000, viewsOnDate: 4000, viewsMedianDay: 500, year: 2015, written: true, sourceUrl: "https://en.wikipedia.org/wiki/Pizza_Rat", dateKind: null, flags: [], answers: null });
  assert.ok(spiky.total > pick.total * 3, `${spiky.total} against ${pick.total}`);
  // A spike under fifty views on the day is noise and earns nothing.
  const noise = rowPoints({ selected: false, views: 1000, viewsOnDate: 30, viewsMedianDay: 2, year: 2015, written: false, sourceUrl: null, dateKind: null, flags: [], answers: null });
  assert.equal(noise.parts[0]?.[1], 0);
});

test("a reader answer replaces the estimate and does not average with it", () => {
  const { rowPoints } = points();
  const base = { selected: true, views: 1_000_000, year: 1998, written: true, sourceUrl: "https://en.wikipedia.org/wiki/X", dateKind: null, flags: [] };
  const remembered = rowPoints({ ...base, answers: { there: 0, remembers: 10, heard: 0, never: 0 } });
  assert.equal(remembered.measured, true);
  assert.equal(remembered.total, 100);
  assert.equal(remembered.parts.length, 1, "no estimate part survives a measurement");
  const forgotten = rowPoints({ ...base, answers: { there: 0, remembers: 0, heard: 0, never: 10 } });
  assert.equal(forgotten.total, 0, "a strong estimate cannot prop up a row nobody remembered");
  // Under the floor of ten the estimate stands.
  const few = rowPoints({ ...base, answers: { there: 0, remembers: 0, heard: 0, never: 9 } });
  assert.equal(few.measured, false);
  assert.equal(few.total, 25 + 10 + 25 + 15 + 4, "no spike measured, the rest stands");
});

test("a date's points are top heavy: three excellent rows beat forty mediocre ones", () => {
  const { datePoints } = points();
  // Said plainly, because the decay is osu!'s 95 percent per rank and that
  // number sets where "mediocre" is. The sum of forty rows at n points is
  // about 17.4n, so three rows at 100, 95 and 90 (271) beat forty of them
  // only while n is under about 15. A bare Wikipedia line with nothing
  // selected, nothing measured and nobody writing a card line scores 4 to
  // 12, so that is the case the property is for. Forty rows at 30 would win,
  // and a curator reading the parts will see why: thirty is not mediocre.
  const three = datePoints([100, 95, 90]);
  assert.ok(three > datePoints(Array(40).fill(12)), "forty bare lines lose to three excellent rows");
  assert.ok(three < datePoints(Array(40).fill(30)), "forty rows at thirty win, which is the threshold, said out loud");
  // Adding a dull row moves a date almost not at all; fixing the top row moves it a lot.
  const before = datePoints([80, 60, 40, 20]);
  assert.ok(datePoints([80, 60, 40, 20, 5]) - before < 5);
  assert.ok(datePoints([100, 60, 40, 20]) - before >= 19);
});

test("the number is labelled and its arithmetic is one click away", () => {
  const script = panelScript();
  assert.ok(script.includes('" points</b> "'), "the number says it is points");
  assert.ok(script.includes("<summary>why</summary>"), "the parts are behind why");
  assert.ok(script.includes("No model is asked."), "and the explainer says no model is in it");
});

test("the points never reach a public page", () => {
  const html = renderDayPage({ month: 9, day: 8, people: [] }, [], [], [
    { id: "a", month: 9, day: 8, year: 1998, sourceUrl: "https://en.wikipedia.org/wiki/September_8", description: "A thing happened." },
  ]);
  for (const word of ["rowPoints", "datePoints", 'class="pts"', "article_reach"]) {
    assert.equal(html.includes(word), false, `${word} is on a date page`);
  }
});

// ---------------------------------------------------------------------------
// The four numbers, at /admin/numbers/
// ---------------------------------------------------------------------------

function numbersPage(): string {
  return renderNumbers({ url: "https://x.supabase.co", key: "k" });
}

function numbersScript(): string {
  const html = numbersPage();
  return html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
}

test("the numbers page's script parses", () => {
  const script = numbersScript();
  assert.ok(script.length > 1000);
  new Function(script);
});

test("the numbers page asks the database and carries no figures itself", () => {
  const script = numbersScript();
  // The one call it makes. Everything on the screen comes from this.
  assert.ok(script.includes("/rest/v1/rpc/wall_numbers"), "it asks wall_numbers()");
  // Nothing is baked in. A number in the file would survive in a cache, in a
  // deploy artefact and in anybody's browser history, which is the whole thing
  // this design is avoiding.
  const html = numbersPage();
  for (const figure of ["boosters_all\":", "13 buzz", "2 of 4"]) {
    assert.ok(!html.includes(figure), `no figure is baked into the page: ${figure}`);
  }
});

test("the numbers page is noindex and is linked from nothing", () => {
  assert.match(numbersPage(), /noindex/);
  // Not from the panel, which is the only other page a curator opens.
  const panel = renderAdmin({ url: "https://x.supabase.co", key: "k" });
  assert.ok(!panel.includes("/admin/numbers"), "the curation panel does not link to it");
});

test("every number on the page carries the sentence saying what would make it lie", () => {
  const html = numbersPage();
  // Four numbers, four sentences, and the class is the same one every time so
  // a fifth number added without its sentence is visible in a diff.
  assert.equal((html.match(/class="lies"/g) ?? []).length, 4);
});

test("a small number says so on the page rather than being read as a rate", () => {
  const script = numbersScript();
  assert.ok(script.includes("it is a count and not a rate"), "the warning wording is there");
  assert.ok(script.includes("all > 0 && all < 30"), "and it fires while the rows are few");
  assert.ok(script.includes("Nobody has buzzed yet"), "and zero is reported as zero rather than hidden");
});
