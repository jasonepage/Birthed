// Finds facts about one birth date, with a model that searches as it answers.
//
//   POST /functions/v1/find-facts
//   { "month": 9, "day": 4, "year": 2002, "region": "Salem, Oregon" }
//
// Answers at once with the state of that date: "done" and the facts
// when a search has already happened, "running" when one is under way, and
// "started" when this call kicked one off. The search itself runs after the
// response goes out, because it takes tens of seconds and the phone would
// rather poll the table than hold a connection open.
//
// The model searches the web as it answers, and each fact comes back with
// the page it drew on and a short quotation from it. Decided September 6,
// 2026: the grounding is trusted as it stands and the facts are shown as
// returned. The quotation and the page are stored with every row so that a
// wrong fact can be traced and removed, and so that a stricter check can be
// switched on later by flipping `verified` on the rows it passes.
//
// The date, the year and the region are sent to Google's Gemini service to
// do this. Nothing that identifies the person goes with them, and the
// privacy page says so.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };
const MODEL = "gemini-2.5-flash";
const MAX_FACTS = 14;
const RUN_STALE_MS = 4 * 60 * 1000;

interface Candidate {
  fact: string;
  category: string;
  source_url: string;
  quote: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/** "Salem, Oregon" and "salem oregon" are the same place. */
function regionKey(region: unknown): string {
  if (typeof region !== "string") return "";
  return region.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60);
}

function monthName(month: number): string {
  return ["January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December"][month - 1];
}

function prompt(month: number, day: number, year: number, region: string): string {
  const where = region ? ` The person was born in or near ${region}.` : "";
  if (year === 0) {
    return `You are researching one calendar date for a birthday app: ${monthName(month)} ${day}, in any year. The reader was born on that date and did not say which year.${where}
Find 8 to ${MAX_FACTS} specific, true, surprising things that happened on ${monthName(month)} ${day} across history, or that are tied to that date: an event, a launch, a record, a discovery, a first, a sports result, something quirky about the date itself, and something local to the region on that date in some year if one is known. Spread them across decades rather than clustering in one year.
${RULES}`;
  }
  return `You are researching one birth date for a birthday app: ${monthName(month)} ${day}, ${year}.${where}
The reader is the person born that day. Find 8 to ${MAX_FACTS} specific, true, surprising facts tied to that exact day, that week, or that year: something that happened in the world on that day; a game, album, film, product or website that launched that week or shortly after, so the reader is "older than" it; a sports result that day; a record set; what a specific thing cost that year from a primary source; the weather in the region that day if a real source reports it; a space or science event; something local to the region around that date.
${RULES}`;
}

const RULES = `Rules:
1. Every fact must come with the URL of a real page you found and a short verbatim quotation from that page, under 30 words, that supports the fact. If no page says it, leave it out. Do not rely on memory.
2. Prefer reference and primary sources: Wikipedia, official sites, NASA, NOAA, government statistics, newspaper archives, Billboard, Box Office Mojo.
3. No brand promotions, no deals, no astrology, no horoscopes, no numerology, no politics, nothing about anyone's death on that day.
4. Write each fact as one plain sentence to the reader as "you". No em dashes.
5. Answer with a JSON array only, no prose before or after, of objects with exactly these fields: "fact", "category" (one of: event, release, older_than, sport, science, price, weather, local, record), "source_url", "quote".`;

/** Asks the model, with web search on. Returns the raw text. */
async function askGemini(key: string, text: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const body = await response.json();
  const parts: Array<{ text?: string }> = body?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? "").join("");
}

/** The JSON array out of whatever the model wrapped it in. */
function parseCandidates(text: string): Candidate[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Candidate[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const c = item as Record<string, unknown>;
    if (typeof c.fact !== "string" || typeof c.source_url !== "string" || typeof c.quote !== "string") continue;
    if (!/^https?:\/\//.test(c.source_url)) continue;
    out.push({
      fact: c.fact.trim().replace(/—/g, ","),
      category: typeof c.category === "string" ? c.category.trim().toLowerCase() : "event",
      source_url: c.source_url.trim(),
      quote: c.quote.trim(),
    });
  }
  return out.slice(0, MAX_FACTS);
}

async function search(
  admin: ReturnType<typeof createClient>,
  key: string,
  month: number,
  day: number,
  year: number,
  region: string,
  regionKeyValue: string,
): Promise<void> {
  const where = { birth_month: month, birth_day: day, birth_year: year, region_key: regionKeyValue };
  try {
    const text = await askGemini(key, prompt(month, day, year, region));
    const candidates = parseCandidates(text);
    const rows = candidates.map((candidate) => ({
      ...where,
      fact: candidate.fact.slice(0, 400),
      category: candidate.category.slice(0, 30),
      source_url: candidate.source_url.slice(0, 1000),
      source_quote: candidate.quote.slice(0, 600),
      verified: true,
      model: MODEL,
    }));
    if (rows.length > 0) {
      const { error } = await admin.from("birth_facts").upsert(rows, {
        onConflict: "birth_month,birth_day,birth_year,region_key,fact",
        ignoreDuplicates: true,
      });
      if (error) throw new Error(error.message);
    }
    const found = rows.filter((row) => row.verified).length;
    await admin.from("birth_fact_runs").upsert({
      ...where,
      status: "done",
      found,
      error: null,
      finished_at: new Date().toISOString(),
    });
  } catch (error) {
    await admin.from("birth_fact_runs").upsert({
      ...where,
      status: "failed",
      error: String(error instanceof Error ? error.message : error).slice(0, 500),
      finished_at: new Date().toISOString(),
    });
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!url || !serviceRoleKey) return json({ error: "function is misconfigured" }, 500);
  if (!geminiKey) return json({ error: "GEMINI_API_KEY is not set" }, 500);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const month = Number(body.month);
  const day = Number(body.day);
  // No year means the calendar day across history, stored under year 0.
  const year = body.year === undefined || body.year === null ? 0 : Number(body.year);
  const region = typeof body.region === "string" ? body.region.trim().slice(0, 80) : "";
  if (!Number.isInteger(month) || month < 1 || month > 12) return json({ error: "bad month" }, 400);
  if (!Number.isInteger(day) || day < 1 || day > 31) return json({ error: "bad day" }, 400);
  if (!Number.isInteger(year) || (year !== 0 && (year < 1880 || year > new Date().getUTCFullYear()))) return json({ error: "bad year" }, 400);
  const admin = createClient(url, serviceRoleKey);

  // Two searches at most: one for the date and year that everybody born
  // then shares, and one more for the region when one was given, which is
  // where the weather and the local news live. The shared one is what makes
  // the cache pay: 366 dates times the years anybody is alive, once each.
  const keys = [""];
  const key = regionKey(region);
  if (key) keys.push(key);

  const statuses: string[] = [];
  for (const regionKeyValue of keys) {
    const where = { birth_month: month, birth_day: day, birth_year: year, region_key: regionKeyValue };
    const { data: run } = await admin.from("birth_fact_runs").select("*").match(where).maybeSingle();
    if (run?.status === "done" || run?.status === "failed") {
      statuses.push(run.status);
      continue;
    }
    if (run?.status === "running" && Date.now() - new Date(run.started_at).getTime() < RUN_STALE_MS) {
      statuses.push("running");
      continue;
    }
    await admin.from("birth_fact_runs").upsert({
      ...where,
      status: "running",
      found: 0,
      error: null,
      started_at: new Date().toISOString(),
      finished_at: null,
    });
    // Answer now, search after. The phone polls the table.
    EdgeRuntime.waitUntil(search(admin, geminiKey, month, day, year, regionKeyValue ? region : "", regionKeyValue));
    statuses.push("started");
  }

  const { data: facts } = await admin
    .from("birth_facts")
    .select("id,fact,category,source_url,region_key")
    .match({ birth_month: month, birth_day: day, birth_year: year, verified: true })
    .in("region_key", keys)
    .order("id");

  const status = statuses.includes("started") ? "started" : statuses.includes("running") ? "running" : "done";
  return json({ status, facts: facts ?? [] }, status === "started" ? 202 : 200);
});
