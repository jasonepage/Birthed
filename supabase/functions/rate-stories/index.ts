// The editor on the hive.
//
//   POST /functions/v1/rate-stories   { "date": "2026-09-23", "limit": 4 }
//   apikey: <the project's secret key>
//
// Scores the stories nobody has scored yet on the open dates, or on the one
// date given, a batch of sixty at a time up to the limit, and says how many
// are still waiting. The wall worker calls it every quarter hour
// (worker/src/stories-editor.ts) and the curation panel has a button for it.
// With nothing unscored it asks the model nothing and costs nothing.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { rateDate } from "../_shared/story-editor.ts";

// The curation panel calls this from birthed.app, so the browser asks first.
const ALLOWED_ORIGINS = ["https://birthed.app", "https://www.birthed.app", "http://localhost:10000"];
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
    Vary: "Origin",
  };
}

Deno.serve(async (request: Request) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders(request) } });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!url || !serviceRoleKey || !geminiKey) return json({ error: "function is misconfigured" }, 500);
  // The same gate as rate-facts: the key it was sent has to read a row only
  // the service role can see. Deployed with JWT verification off.
  const provided = (request.headers.get("apikey") ??
    (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")).trim();
  if (!provided) return json({ error: "not allowed" }, 403);
  const probe = await createClient(url, provided).from("birth_facts").select("id").eq("verified", false).limit(1);
  if (probe.error || !probe.data?.length) return json({ error: "not allowed" }, 403);

  let limit = 4;
  let date: string | null = null;
  try {
    const body = await request.json();
    if (Number.isInteger(body?.limit)) limit = Math.max(1, Math.min(20, body.limit));
    if (typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) date = body.date;
  } catch {
    // An empty body is the defaults.
  }

  const admin = createClient(url, serviceRoleKey);
  let dates: string[];
  if (date !== null) {
    dates = [date];
  } else {
    const { data } = await admin.from("wall_days").select("wall_date").gt("closes_at", new Date().toISOString()).order("wall_date");
    dates = (data ?? []).map((d: { wall_date: string }) => d.wall_date);
  }

  const report: Array<{ date: string; scored: number; waiting: number }> = [];
  let calls = 0;
  try {
    for (const wallDate of dates) {
      let scored = 0;
      let waiting = 0;
      while (calls < limit) {
        const result = await rateDate(admin, geminiKey, wallDate);
        if (result.scored === 0 && result.waiting === 0) break;
        calls += 1;
        scored += result.scored;
        waiting = result.waiting;
        if (result.scored === 0 || waiting === 0) break;
      }
      report.push({ date: wallDate, scored, waiting });
      if (calls >= limit) break;
    }
  } catch (error) {
    return json({ status: "failed", error: error instanceof Error ? error.message : String(error), report }, 502);
  }
  return json({ status: "done", calls, report });
});
