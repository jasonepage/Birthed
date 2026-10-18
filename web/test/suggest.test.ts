// Suggestions, docs/the-wall.md section 32: the name a suggestion goes by and
// the list the sealed picture draws. The box came off the date page on
// October 18, 2026, docs/strip-to-the-hive.md; the database's own rules are
// tested against the migration in worker/test/suggest-migration.test.ts.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { recapSuggestions, suggestionName } from "../src/suggest.js";
import type { WallStory } from "../src/wall.js";

function story(overrides: Partial<WallStory> = {}): WallStory {
  return {
    id: "11111111-2222-3333-4444-555555555555", wallDate: "2026-10-05", submittedAt: "2026-10-05T14:00:00Z",
    headline: "Council approves the river crossing after a decade of study", url: "https://www.example.org/news/river-crossing",
    outlet: "example.org", status: "pool", tier: "claimed", support: 0, priority: 0, placedAt: null, rect: null,
    falseAt: null, falseNote: null, subjectKind: null, subjectId: null, sources: [], ...overrides,
  };
}


test("a suggestion goes by its article's title, read off its own address, never by the headline's description", () => {
  assert.equal(suggestionName({ url: "https://en.wikipedia.org/wiki/Mercury_(planet)", headline: "Mercury (planet): Smallest planet" }), "Mercury (planet)");
  assert.equal(suggestionName({ url: "https://en.wikipedia.org/wiki/Star_Wars:_The_Last_Jedi", headline: "Star Wars: The Last Jedi: 2017 film" }), "Star Wars: The Last Jedi", "a title with its own colon");
  assert.equal(suggestionName({ url: "https://en.wikipedia.org/wiki/Bj%C3%B6rk", headline: "Björk: Icelandic singer" }), "Björk");
  assert.equal(suggestionName({ url: "https://example.org/x", headline: "Plain" }), "Plain");
  assert.equal(suggestionName({ url: "https://en.wikipedia.org/wiki/%E0%A4%A", headline: "Broken escape" }), "Broken escape");
});

test("the sealed picture lists what readers suggested and still stand behind, most buzzed first", () => {
  const s = (id: string, support: number, url: string, extra: Partial<WallStory> = {}): WallStory => story({ id, support, url, subjectKind: "suggestion", headline: "x: y", ...extra });
  const list = recapSuggestions([
    s("a", 2, "https://en.wikipedia.org/wiki/Mercury_(planet)", { submittedAt: "2026-10-05T10:00:00Z" }),
    s("b", 5, "https://en.wikipedia.org/wiki/Freddie_Mercury"),
    s("c", 0, "https://en.wikipedia.org/wiki/Taken_back"),
    s("d", 2, "https://en.wikipedia.org/wiki/Shown_false", { status: "false" }),
    s("e", 2, "https://en.wikipedia.org/wiki/Later", { submittedAt: "2026-10-05T12:00:00Z" }),
    story({ id: "f", support: 9 }),
  ]);
  assert.deepEqual(list, [{ name: "Freddie Mercury", count: 5 }, { name: "Mercury (planet)", count: 2 }, { name: "Later", count: 2 }]);
});
