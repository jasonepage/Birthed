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
