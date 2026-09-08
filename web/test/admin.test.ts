import test from "node:test";
import assert from "node:assert/strict";
import { renderAdmin } from "../src/admin.js";

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
  assert.ok(script.includes('data-draft="cultural_event:'), "culture rows can be drafted");
  assert.ok(script.includes('data-draft="birth_fact:'), "found facts can be drafted");
  assert.ok(script.includes('data-draft="historical_event:'), "Wikipedia lines can be drafted");
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
