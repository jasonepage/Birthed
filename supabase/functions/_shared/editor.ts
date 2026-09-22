// The editor: scores found facts for interest and decides what is shown.
//
// One call to the model per run (a date, a year and a region), with search
// off, so it costs words and never searches: about half a cent a run at
// September 2026 prices. It is asked one question about each fact, would
// somebody born on this day stop scrolling and tell a friend, and answers one
// to ten. A fact is published at PUBLISH_AT and above, when its cited page
// answered. A row a person reviewed in the panel is never read: their
// decision beats the model's. A row from before the citation check was
// recorded counts as checked only if it was published.
//
// It learns from the people. Every call carries a handful of facts a person
// rejected in the panel and a handful that readers liked, so the more the
// panel and the likes are used, the better its examples get, with no change
// here.
//
// Written after the first test on a phone led with a minor league baseball
// score and then "you are six days older than Battlefield 1942". True, cited,
// and nobody would ever say either out loud.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const EDITOR_MODEL = "gemini-3.7-flash";
export const PUBLISH_AT = 7;

type Where = { birth_month: number; birth_day: number; birth_year: number; region_key: string };
type Row = { id: number; fact: string; category: string; region_key: string };
type Score = { id: number; score: number; why: string };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function prompt(where: Where, rows: Row[], rejected: string[], liked: string[]): string {
  const date = `${MONTHS[where.birth_month - 1]} ${where.birth_day}${where.birth_year ? `, ${where.birth_year}` : ""}`;
  return [
    `You are the editor of Birthed, an app people open to see what happened on the day they were born. These facts are about ${date}. Each one is already checked against its source, so do not judge whether it is true. Judge one thing only:`,
    ``,
    `Would somebody born on ${date} stop scrolling and tell a friend about it?`,
    ``,
    `Score each fact from 1 to 10.`,
    `10: a moment nearly everybody alive then remembers or has heard of. The September 11 attacks, Harambe, the first iPhone going on sale, a Super Bowl, a famous death, a record everybody talked about.`,
    `7 to 9: a famous release, championship, record or pop culture moment that a lot of people know, or something strange enough that anybody would repeat it.`,
    `4 to 6: true and fine, but only fans of one niche would care.`,
    `1 to 3: nobody would say this out loud. Minor league and routine sports results, ordinary statistics, product launches nobody remembers, ordinary weather, "you are N days older than" something obscure, local minutiae, anything that needs a paragraph to explain why it matters.`,
    ``,
    `A local fact is scored on the same scale as any other. Do not reward length or detail. Most facts on most days are 4 to 6; be strict with 7 and above.`,
    rejected.length ? `\nFacts people rejected, as examples of what scores low:\n${rejected.map((f) => `- ${f}`).join("\n")}` : ``,
    liked.length ? `\nFacts readers liked, as examples of what scores high:\n${liked.map((f) => `- ${f}`).join("\n")}` : ``,
    ``,
    `The facts to score:`,
    ...rows.map((row) => `${row.id}: ${row.fact}`),
    ``,
    `Answer with JSON only, one entry per fact: [{"id": 123, "score": 7, "why": "five words at most"}]`,
  ].join("\n");
}

async function ask(key: string, text: string): Promise<Score[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EDITOR_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key.trim() },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text }] }],
        // No tools: this call must never search.
        generationConfig: { temperature: 0.2, maxOutputTokens: 8000, responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const body = await response.json();
  const parts: Array<{ text?: string }> = body?.candidates?.[0]?.content?.parts ?? [];
  const raw = parts.map((part) => part.text ?? "").join("").trim();
  const parsed = JSON.parse(raw.replace(/^```(?:json)?/, "").replace(/```$/, ""));
  if (!Array.isArray(parsed)) throw new Error("the editor did not answer with a list");
  return parsed
    .map((entry) => ({ id: Number(entry?.id), score: Math.round(Number(entry?.score)), why: String(entry?.why ?? "").slice(0, 120) }))
    .filter((entry) => Number.isInteger(entry.id) && entry.score >= 1 && entry.score <= 10);
}

/** Examples for the prompt: what people rejected in the panel, and what readers liked. */
async function examples(admin: SupabaseClient): Promise<{ rejected: string[]; liked: string[] }> {
  const { data: rejected } = await admin
    .from("birth_facts")
    .select("fact")
    .not("reviewed_at", "is", null)
    .eq("verified", false)
    .order("reviewed_at", { ascending: false })
    .limit(8);
  const { data: liked } = await admin
    .from("birth_facts")
    .select("fact,birth_fact_likes(count)")
    .eq("verified", true)
    .limit(400);
  const likedFacts = (liked ?? [])
    .map((row: { fact: string; birth_fact_likes?: Array<{ count: number }> }) => ({ fact: row.fact, likes: row.birth_fact_likes?.[0]?.count ?? 0 }))
    .filter((row) => row.likes >= 2)
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 6)
    .map((row) => row.fact);
  return { rejected: (rejected ?? []).map((row: { fact: string }) => row.fact), liked: likedFacts };
}

/**
 * Scores every unscored fact in one run and publishes the ones that pass.
 * Returns how many were scored and how many are now shown.
 */
export async function rateRun(admin: SupabaseClient, key: string, where: Where): Promise<{ scored: number; shown: number }> {
  const { data } = await admin
    .from("birth_facts")
    .select("id,fact,category,region_key")
    .match(where)
    .is("rated_at", null)
    .is("reviewed_at", null)
    .or("source_checked.eq.true,and(source_checked.is.null,verified.eq.true)")
    .order("id")
    .limit(60);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return { scored: 0, shown: 0 };

  const { rejected, liked } = await examples(admin);
  const scores = await ask(key, prompt(where, rows, rejected, liked));
  const byId = new Map(scores.map((score) => [score.id, score]));

  let scored = 0;
  let shown = 0;
  const now = new Date().toISOString();
  for (const row of rows) {
    const score = byId.get(row.id);
    if (!score) continue; // left unscored, and so unpublished; the next sweep asks again
    const update: Record<string, unknown> = {
      interest: score.score,
      interest_note: score.why,
      rated_at: now,
      rated_by: EDITOR_MODEL,
    };
    // Only rows nobody reviewed and whose cited page did not fail reach this
    // point (the read above), so the score alone decides.
    const publish = score.score >= PUBLISH_AT;
    update.verified = publish;
    update.hidden_reason = publish ? null : `editor scored ${score.score}: ${score.why}`;
    if (publish) shown += 1;
    const { error } = await admin.from("birth_facts").update(update).eq("id", row.id);
    if (!error) scored += 1;
  }
  return { scored, shown };
}
