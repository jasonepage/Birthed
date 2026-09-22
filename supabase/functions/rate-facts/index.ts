// The editor's sweep.
//
//   POST /functions/v1/rate-facts   { "limit": 20 }
//   apikey: <the project's secret key>
//
// Scores the facts nobody has scored yet, a run at a time, oldest first, and
// publishes the ones that pass. The wall worker calls it every quarter hour
// (worker/src/facts-editor.ts), so the backlog clears on its own and anything
// find-facts could not score inline is picked up within fifteen minutes.
// With nothing unscored it asks the model nothing and costs nothing.
//
// The limit is the cost ceiling: at about half a cent a run, twenty runs a
// quarter hour is at most ten cents, and only while there is a backlog.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { rateRun } from "../_shared/editor.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!url || !serviceRoleKey || !geminiKey) return json({ error: "function is misconfigured" }, 500);
  // Only a caller holding the project's secret key may spend on this. The
  // worker holds a new style secret key and this function's environment
  // holds the legacy one, so the two strings never match; instead the key
  // it was sent is asked to read a row that only the service role can see.
  // Deployed with JWT verification off for the same reason.
  const provided = (request.headers.get("apikey") ??
    (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")).trim();
  if (!provided) return json({ error: "not allowed" }, 403);
  const probe = await createClient(url, provided).from("birth_facts").select("id").eq("verified", false).limit(1);
  if (probe.error || !probe.data?.length) return json({ error: "not allowed" }, 403);

  let limit = 20;
  try {
    const body = await request.json();
    if (Number.isInteger(body?.limit)) limit = Math.max(1, Math.min(60, body.limit));
  } catch {
    // An empty body is the default limit.
  }

  const admin = createClient(url, serviceRoleKey);
  const { data } = await admin
    .from("birth_facts")
    .select("birth_month,birth_day,birth_year,region_key")
    .is("rated_at", null)
    // The same filter rateRun reads with, or a run whose only unscored rows
    // are ones it will never score would be picked every quarter hour and
    // starve the rest: a person reviewed them, or their cited page failed.
    .is("reviewed_at", null)
    .or("source_checked.eq.true,and(source_checked.is.null,verified.eq.true)")
    .order("generated_at", { ascending: true })
    .limit(2000);
  const seen = new Set<string>();
  const runs: Array<{ birth_month: number; birth_day: number; birth_year: number; region_key: string }> = [];
  for (const row of data ?? []) {
    const key = `${row.birth_month}-${row.birth_day}-${row.birth_year}-${row.region_key}`;
    if (seen.has(key)) continue;
    seen.add(key);
    runs.push({ birth_month: row.birth_month, birth_day: row.birth_day, birth_year: row.birth_year, region_key: row.region_key ?? "" });
    if (runs.length >= limit) break;
  }

  let scored = 0;
  let shown = 0;
  const errors: string[] = [];
  for (const where of runs) {
    try {
      const result = await rateRun(admin, geminiKey, where);
      scored += result.scored;
      shown += result.shown;
    } catch (error) {
      errors.push(String(error instanceof Error ? error.message : error).slice(0, 200));
    }
  }
  return json({ runs: runs.length, scored, shown, errors: errors.slice(0, 5) });
});
