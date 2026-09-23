// The editor, on the hive: scores every story on an open date for interest.
//
// The same question the facts editor asks, editor.ts, put to everything
// with a birthday on the date: what happened, who was born, what was number
// one, and the day's news. The score orders what nobody has buzzed, on the
// board and on the comb. One buzz beats every score.
//
// One call a date, no search, about a cent. A story left unscored by a bad
// answer is asked again next sweep.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { EDITOR_MODEL } from "./editor.ts";

type Row = { id: string; headline: string; outlet: string; subject_kind: string | null };
type Score = { id: string; score: number; why: string };

const BATCH = 60;

export function prompt(date: string, rows: Row[]): string {
  const kind = (r: Row): string =>
    r.subject_kind === null ? "news today" : r.subject_kind === "person" ? "born on this date" : ["song", "album", "film"].includes(r.subject_kind) ? "number one" : "happened on this date";
  return [
    `You are the editor of a page about ${date}. Everything below has a birthday on this date: things that happened on it, people born on it, what was number one, and today's news.`,
    `Score each one from 1 to 10 for one question: would somebody born on this day stop scrolling and tell a friend about it?`,
    `A name people say out loud, a moment people remember, a thing a twelve year old could be told in one breath: high. A trade item, a listicle, a live blog, a minor appointment, a technical milestone nobody outside the field knows: low.`,
    `A death, an attack, a crash or a massacre is never above 6, however famous. Do not reward length or detail. Most rows on most days are 3 to 5; be strict with 7 and above, and give a 9 or 10 only to something the whole world knows.`,
    `Score what the row is, not how it is worded.`,
    ``,
    `The rows to score:`,
    ...rows.map((r) => `- id ${r.id} [${kind(r)}] ${r.headline} (${r.outlet})`),
    ``,
    `Answer with JSON only, one entry per row: [{"id": "the id", "score": 7, "why": "five words at most"}]`,
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
    .map((entry) => ({ id: String(entry?.id ?? ""), score: Math.round(Number(entry?.score)), why: String(entry?.why ?? "").slice(0, 120) }))
    .filter((entry) => /^[0-9a-f-]{36}$/.test(entry.id) && entry.score >= 1 && entry.score <= 10);
}

/**
 * Scores up to one batch of unscored stories on one date. Returns how many
 * were scored and how many are still waiting on that date.
 */
export async function rateDate(admin: SupabaseClient, key: string, wallDate: string): Promise<{ scored: number; waiting: number }> {
  const { data, count } = await admin
    .from("wall_stories")
    .select("id,headline,outlet,subject_kind", { count: "exact" })
    .eq("wall_date", wallDate)
    .in("status", ["pool", "placed", "overflow"])
    .is("rated_at", null)
    .order("submitted_at")
    .limit(BATCH);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return { scored: 0, waiting: 0 };
  const scores = await ask(key, prompt(wallDate, rows));
  const byId = new Map(scores.map((s) => [s.id, s]));
  const now = new Date().toISOString();
  let scored = 0;
  for (const row of rows) {
    const score = byId.get(row.id);
    if (!score) continue;
    const { error } = await admin
      .from("wall_stories")
      .update({ interest: score.score, interest_note: score.why, rated_at: now, rated_by: EDITOR_MODEL })
      .eq("id", row.id);
    if (!error) scored += 1;
  }
  return { scored, waiting: Math.max(0, (count ?? rows.length) - scored) };
}
