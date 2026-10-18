// Suggestions, docs/the-wall.md section 32, built October 5, 2026.
//
// From October 5 to October 18, 2026 today's date page had a box asking
// "What else mattered today?", where a reader picked a real thing with an
// English Wikipedia article and it became a tile. The box came off with the
// rest of the strip on October 18, 2026, docs/strip-to-the-hive.md, and so
// did the search, the matcher and the script. What is left is what a
// suggestion already on a hive needs to be named on a crown or a picture.

import type { WallStory } from "./wall.js";

/**
 * The name a suggestion goes by on a crown or a picture: the article's
 * title, read back off its own address, because the headline adds
 * Wikipedia's description after it and a title can itself carry a colon.
 */
export function suggestionName(story: Pick<WallStory, "url" | "headline">): string {
  const m = /^https:\/\/en\.wikipedia\.org\/wiki\/(.+)$/.exec(story.url);
  if (m !== null) {
    try {
      const title = decodeURIComponent(m[1]!).replace(/_/g, " ").trim();
      if (title !== "") return title;
    } catch {
      // The headline below, then.
    }
  }
  return story.headline;
}

/**
 * What readers suggested for a sealed day, for its picture: every suggestion
 * somebody still stands behind, most buzzed first, by its article's title.
 */
export function recapSuggestions(stories: readonly Pick<WallStory, "subjectKind" | "support" | "status" | "url" | "headline" | "submittedAt">[]): Array<{ name: string; count: number }> {
  return stories
    .filter((s) => s.subjectKind === "suggestion" && s.support > 0 && s.status !== "false")
    .sort((a, b) => b.support - a.support || a.submittedAt.localeCompare(b.submittedAt))
    .map((s) => ({ name: suggestionName(s), count: s.support }));
}
