import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { historyPoints, scoreEvents } from "../src/wall/points.js";

// Real numbers from the pageviews service, September 11, 2026, for the
// September 11 subjects. The same numbers are pinned on the panel's side in
// web/test/admin.test.ts.
const ATTACKS = { year: 2001, selected: false, written: false, views: 6_331_579, viewsOnDateLow: 395_581, viewsMedianDay: 14_238 };
const PENTAGON = { year: 1941, selected: false, written: false, views: 873_300, viewsOnDateLow: 15_290, viewsMedianDay: 2_610 };
const DES_MOINES = { year: 1941, selected: false, written: false, views: 27_630, viewsOnDateLow: 840, viewsMedianDay: 25 };
const HOPE_DIAMOND = { year: 1792, selected: false, written: false, views: 357_456, viewsOnDateLow: 2_225, viewsMedianDay: 1_037 };
const UNMEASURED_2001 = { year: 2001, selected: false, written: false, views: null, viewsOnDateLow: null, viewsMedianDay: null };

test("the attacks outscore everything else on the date, and an unmeasured 2001 row is the 29 the panel showed for all of them", () => {
  assert.equal(historyPoints(UNMEASURED_2001), 29, "memory 25 and sourcing 4: the tie the brief measured");
  assert.equal(historyPoints(ATTACKS), 35 + 25 + 25 + 4);
  assert.ok(historyPoints(ATTACKS) > historyPoints(PENTAGON));
  assert.ok(historyPoints(PENTAGON) > historyPoints(HOPE_DIAMOND));
  // The Des Moines speech was the top of the date by ratio and is a main
  // page feature; the lower anniversary earns it nothing for the spike.
  assert.equal(historyPoints(DES_MOINES), 0 + 19 + 0 + 4, `${historyPoints(DES_MOINES)}`);
});

test("scores for a date are keyed the way wall_stories keys a subject, and a row with no subject still scores on its year", () => {
  const scores = scoreEvents(
    [{ id: 13857, event_year: 2001, subject_url: "https://en.wikipedia.org/wiki/September_11_attacks" }, { id: 1, event_year: 1897, subject_url: null }, { id: 2, event_year: 1995, subject_url: "https://en.wikipedia.org/wiki/Broken" }],
    [{ source_url: "https://en.wikipedia.org/wiki/September_11_attacks", views_year: 6_331_579, views_on_date_low: 395_581, views_median_day: 14_238, error: null },
     { source_url: "https://en.wikipedia.org/wiki/Broken", views_year: null, views_on_date_low: null, views_median_day: null, error: "pageviews did not answer" }],
    new Set([2001]),
    new Set(["1"]),
  );
  assert.equal(scores.get("historical_event:13857"), 35 + 25 + 10 + 25 + 4);
  // 1897 is past the edge of living memory and earns nothing for the year; the lead line earns 15.
  assert.equal(scores.get("historical_event:1"), 0 + 0 + 0 + 0 + 15 + 4);
  // A measurement that errored is unmeasured, not zero reach.
  assert.equal(scores.get("historical_event:2"), 25 + 4);
});

test("the worker's copy of the formula agrees with the panel's, on the panel's own inputs", (t) => {
  // The panel's formula is a JavaScript string in web/src/admin.ts. Read it
  // off disk and evaluate it the way the panel does, so the two copies are
  // held to the same numbers without the worker depending on the web
  // package. Skipped, not passed, when the checkout has no web/.
  const here = dirname(fileURLToPath(import.meta.url));
  const adminPath = join(here, "..", "..", "..", "web", "src", "admin.ts");
  if (!existsSync(adminPath)) { t.skip("no web/src/admin.ts in this checkout"); return; }
  const source = readFileSync(adminPath, "utf8");
  const match = /export const POINTS_JS = `([\s\S]*?)`;\n/.exec(source);
  assert.ok(match, "POINTS_JS not found in web/src/admin.ts");
  // The string is a template literal in the source, so backslashes are
  // doubled there; evaluating it as one gives the panel's text.
  const panelJs = new Function(`return \`${match![1]}\`;`)() as string;
  const panel = new Function(`${panelJs}; return rowPoints;`)() as (input: unknown) => { total: number };
  const cases = [ATTACKS, PENTAGON, DES_MOINES, HOPE_DIAMOND, UNMEASURED_2001,
    { year: 1185, selected: true, written: true, views: 75_519, viewsOnDateLow: 944, viewsMedianDay: 206 },
    { year: 2024, selected: false, written: false, views: 9_616, viewsOnDateLow: null, viewsMedianDay: 30 }];
  for (const c of cases) {
    const theirs = panel({ ...c, sourceUrl: "https://en.wikipedia.org/wiki/X", dateKind: null, flags: [], answers: null }).total;
    assert.equal(historyPoints(c), theirs, `year ${c.year}: worker ${historyPoints(c)}, panel ${theirs}`);
  }
});
