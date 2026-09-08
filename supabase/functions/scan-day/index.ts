// Scans one date: judges every row on it and says what it is missing.
//
//   POST /functions/v1/scan-day
//   { "month": 9, "day": 8 }
//
// Writes one day_scans row per verdict and NOTHING ELSE, EVER. It never sets
// verified, never sets status, never deletes, never puts a word on a page. It
// produces arguments. A curator reads one, agrees or does not, and presses a
// key, and the keypress is the only thing that moves a row. The verdicts are
// kept including the overruled ones, because a model that loses most of its
// arguments has a bad prompt and that is invisible otherwise.
// docs/scan-a-day.md is the whole specification, and section 5 is the prompt
// below. If the two disagree, the document is right.
//
// Shape copied from find-culture, because each piece was paid for: two calls
// (research with search, then shaping with none), a retry when the model did
// not search, a ledger row whether it worked or not, the shared ceilings.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };
const ALLOWED_ORIGINS = [
  "https://birthed.app",
  "https://www.birthed.app",
  "http://localhost:10000",
];
const MODEL = "gemini-3.7-flash";
const PROMPT_VERSION = "scan-a-day prompt v1";
const RESEARCH_ATTEMPTS = 2;
const VERDICTS = ["keep", "release", "encyclopedia", "thin", "explains", "wrong_date", "unsourced", "heavy"];
const MAX_PROPOSALS = 6;

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

function json(body: unknown, status = 200, request?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...(request ? corsHeaders(request) : {}) },
  });
}

function monthName(month: number): string {
  return ["January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December"][month - 1];
}

interface Subject { kind: string; id: string; year: number | null; text: string; source: string | null }

/**
 * What the date holds, as the model sees it: every published culture row,
 * every verified fact the page shows, every Wikipedia line not suppressed.
 * Same lists the page itself draws from.
 */
async function subjectsOf(admin: ReturnType<typeof createClient>, month: number, day: number): Promise<Subject[]> {
  const out: Subject[] = [];
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  const { data: culture } = await admin.from("cultural_events")
    .select("id,event_date,event_title,context_string,source_url,status")
    .eq("status", "published").limit(1000);
  for (const row of culture ?? []) {
    const date = String(row.event_date ?? "");
    if (date.slice(5, 7) !== mm || date.slice(8, 10) !== dd) continue;
    const said = String(row.context_string ?? "").trim();
    out.push({
      kind: "cultural_event", id: String(row.id), year: Number(date.slice(0, 4)) || null,
      text: said ? `${row.event_title}. ${said}` : String(row.event_title ?? ""),
      source: row.source_url ? String(row.source_url) : null,
    });
  }
  const { data: facts } = await admin.from("birth_facts")
    .select("id,fact,source_url,birth_year")
    .eq("birth_month", month).eq("birth_day", day).eq("birth_year", 0).eq("region_key", "").eq("verified", true).limit(200);
  for (const row of facts ?? []) {
    out.push({ kind: "birth_fact", id: String(row.id), year: null, text: String(row.fact ?? ""), source: row.source_url ? String(row.source_url) : null });
  }
  const { data: events } = await admin.from("historical_events")
    .select("id,event_year,description,source_url")
    .eq("event_month", month).eq("event_day", day).eq("suppressed", false).limit(200);
  for (const row of events ?? []) {
    out.push({
      kind: "historical_event", id: String(row.id), year: row.event_year === null ? null : Number(row.event_year),
      text: String(row.description ?? ""), source: row.source_url ? String(row.source_url) : null,
    });
  }
  return out;
}

/** Section 5 of docs/scan-a-day.md, verbatim, then the rows. */
function scanPrompt(month: number, day: number, subjects: Subject[]): string {
  const rows = subjects.map((s) =>
    `[${s.kind}:${s.id}] ${s.year === null ? "" : `(${s.year}) `}${s.text}${s.source ? ` <${s.source}>` : " <no source>"}`,
  ).join("\n");
  return `You are helping curate one date on a site that records what people remember, not what happened. Wikipedia already records what happened.

The reader is a person who landed on their own birthday. They are usually under forty. They will decide in about four seconds whether this site is real or whether it is a database with a nice font.

The date is ${monthName(month)} ${day}.

Two jobs.

One. Judge every row I give you. For each, return one verdict from this list and one sentence saying why, addressed to a curator who will overrule you if you are wrong: keep, release, encyclopedia, thin, explains, wrong_date, unsourced, heavy.

A row is a release if it is a film opening, a record coming out, a single, a tour, a trailer or an awards show. A game, console or app shipping is not automatically a release: it is one if nothing is said about it beyond the name. "Mini Ninjas is released" is a release. "Toby Fox released it on Steam. Sans has not left the internet since" is not.

A row is encyclopedia if the sentence could sit on a Wikipedia date page without looking out of place. That is the whole differentiator and it is the most common failure.

A row is thin if it is true and nobody wrote it. Two sentences is the shape.

Two. Say what this date is missing. Not by searching the date, which finds nothing, because no page on the web is organised by date the way this site is. Search your memory instead: think of things people bring up unprompted, work out which of them fall on this date, then find a page published within days of it that says so. Run web searches to check each one.

For each proposal give a title, two sentences in the voice below, the year, and a source URL whose own address or dateline carries the date. If you cannot find such a page, do not propose it. Absent beats wrong, always.

Prefer things with an afterlife: people still post it on the anniversary, there are jokes that assume you know it, somebody wrote it up years later, people argue about the details. Big at the time is not the same as remembered.

The voice: name the thing, say what happened, stop. Do not explain why it mattered. Do not say iconic, viral sensation, cultural phenomenon, went on to, or paved the way. A reader who was there does not need it explained and a reader who was not is better served by the link. No dashes.

Good, all real rows from this site:
- "A rat dragged a slice of pizza down the stairs at First Avenue station. Matt Little filmed it and posted it before lunch."
- "Team Salvato put a free dating sim on itch.io. It was not a dating sim."
- "Rogan passed him a joint on a livestream. The still frame became a reaction image for the next decade."

Bad, also real rows from this site:
- "Streamers went dark for a day over hate raids." Thin. True and nobody wrote it.
- "Mini Ninjas is released." A release calendar entry.
- "Georges Méliès released the landmark French silent film A Trip to the Moon, widely recognized as one of the first science fiction films." Explains, and reads like an encyclopedia.

Never propose: a death, an attack, a disaster, a crime or a war as something to celebrate. If a date carries one and it is genuinely what people remember, return it with the verdict heavy and say plainly what it is. A person decides. You do not.

Write your answer as prose notes, in two parts headed VERDICTS and PROPOSALS. Under VERDICTS, one line per row: the row's tag in square brackets exactly as given, the verdict word, then the sentence. Under PROPOSALS, for each: the title, the two sentences, the year, and the full address of the page you opened that carries the date. Propose at most ${MAX_PROPOSALS}. Zero is a correct answer.

The rows on this date now:
${rows}`;
}

/** The shaping call. No search tool, nothing to look up, nothing to invent. */
function shapePrompt(notes: string): string {
  return `Turn the notes at the end into JSON. Answer with one JSON object only, no prose before or after, of this shape:
{"verdicts":[{"tag":"kind:id","verdict":"keep","reason":"one sentence"}],
 "proposals":[{"title":"...","context":"two sentences","year":2015,"source_url":"https://..."}]}
"tag" is copied exactly from the square brackets in the notes. "verdict" is one of keep, release, encyclopedia, thin, explains, wrong_date, unsourced, heavy. Drop any proposal with no page address or no year in the notes. Copy every address exactly; never invent one, never correct one. If a part is empty in the notes, return an empty array for it.

Notes:
${notes}`;
}

interface Answer { text: string; finishReason: string; searches: number }

async function askGemini(key: string, text: string, grounded: boolean): Promise<Answer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const payload: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 24000 },
  };
  if (grounded) payload.tools = [{ google_search: {} }];
  const response = await fetch(url, {
    method: "POST",
    headers: { ...JSON_HEADERS, "x-goog-api-key": key.trim() },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Gemini answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const body = await response.json();
  const candidate = body?.candidates?.[0];
  const parts: Array<{ text?: string }> = candidate?.content?.parts ?? [];
  const searched = candidate?.groundingMetadata?.webSearchQueries;
  return {
    text: parts.map((part) => part.text ?? "").join(""),
    finishReason: String(candidate?.finishReason ?? "unknown"),
    searches: Array.isArray(searched) ? searched.length : 0,
  };
}

async function research(key: string, base: string): Promise<Answer> {
  let last: Answer | null = null;
  for (let attempt = 0; attempt < RESEARCH_ATTEMPTS; attempt++) {
    const nudge = attempt === 0
      ? ""
      : "\nYou answered without searching. Search the web to check each proposal before writing it, and judge the rows as asked.";
    last = await askGemini(key, base + nudge, true);
    if (last.text.trim().length > 0 && (last.searches > 0 || attempt === RESEARCH_ATTEMPTS - 1)) return last;
  }
  throw new Error(`no answer after ${RESEARCH_ATTEMPTS} attempts, finish reason ${last?.finishReason ?? "none"}`);
}

interface Verdict { kind: string; id: string; verdict: string; reason: string }
interface Proposal { title: string; context: string; year: number; source_url: string }

export function parseScan(text: string, subjects: Subject[]): { verdicts: Verdict[]; proposals: Proposal[] } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return { verdicts: [], proposals: [] };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { verdicts: [], proposals: [] };
  }
  const known = new Set(subjects.map((s) => `${s.kind}:${s.id}`));
  const verdicts: Verdict[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(parsed.verdicts) ? parsed.verdicts : []) {
    if (typeof item !== "object" || item === null) continue;
    const v = item as Record<string, unknown>;
    const tag = String(v.tag ?? "").trim();
    const verdict = String(v.verdict ?? "").trim().toLowerCase();
    // A verdict about a row that is not on the date is a verdict about
    // nothing, and a second verdict on one row is the model arguing with
    // itself. Both are dropped here so the reason is legible.
    if (!known.has(tag) || seen.has(tag) || !VERDICTS.includes(verdict)) continue;
    const colon = tag.indexOf(":");
    seen.add(tag);
    verdicts.push({
      kind: tag.slice(0, colon), id: tag.slice(colon + 1), verdict,
      reason: String(v.reason ?? "").replace(/[–—]/g, ",").trim().slice(0, 400) || "No reason given.",
    });
  }
  const proposals: Proposal[] = [];
  for (const item of Array.isArray(parsed.proposals) ? parsed.proposals : []) {
    if (typeof item !== "object" || item === null) continue;
    const p = item as Record<string, unknown>;
    const title = String(p.title ?? "").replace(/[–—]/g, ",").trim().slice(0, 200);
    const url = String(p.source_url ?? "").trim();
    const year = Number(p.year);
    if (!title || !/^https?:\/\//.test(url) || !Number.isInteger(year) || year < 1000 || year > new Date().getUTCFullYear()) continue;
    proposals.push({
      title, year, source_url: url.slice(0, 1000),
      context: String(p.context ?? "").replace(/[–—]/g, ",").trim().slice(0, 600),
    });
  }
  return { verdicts, proposals: proposals.slice(0, MAX_PROPOSALS) };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405, request);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!url || !serviceRoleKey || !anonKey) return json({ error: "function is misconfigured" }, 500, request);
  if (!geminiKey) return json({ error: "GEMINI_API_KEY is not set" }, 500, request);

  // is_admin() with the caller's own token, not verify_jwt: every reader of
  // the iOS app holds a valid token.
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return json({ error: "sign in first" }, 401, request);
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: allowed, error: adminError } = await asCaller.rpc("is_admin");
  if (adminError) return json({ error: "could not check curation access" }, 500, request);
  if (allowed !== true) return json({ error: "not a curator" }, 403, request);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400, request);
  }
  const month = Number(body.month);
  const day = Number(body.day);
  if (!Number.isInteger(month) || month < 1 || month > 12) return json({ error: "bad month" }, 400, request);
  if (!Number.isInteger(day) || day < 1 || day > 31) return json({ error: "bad day" }, 400, request);

  const admin = createClient(url, serviceRoleKey);

  // One bill. A scan searches, so it spends from the same ceilings a culture
  // run does and it is refused the same way when they are spent.
  const { data: remaining } = await admin.rpc("fact_searches_left");
  const searchesLeft = typeof remaining === "number" ? remaining : 0;
  if (searchesLeft <= 0) return json({ status: "paused", searchesLeft, verdicts: 0, proposals: 0 }, 200, request);

  const { data: caller } = await asCaller.auth.getUser();
  const requestedBy = caller?.user?.id ?? null;
  const startedAt = new Date().toISOString();
  const meter = { searches: 0 };
  const scannedBy = `${MODEL}, ${PROMPT_VERSION}`;

  // The ledger, whether it worked or not, in the same table the culture runs
  // use so fact_searches_left() sees it. focus names the kind of run.
  async function record(status: string, written: number, error: string | null) {
    const { error: logError } = await admin.from("culture_search_runs").insert({
      event_month: month, event_day: day, focus: "scan-day", status,
      written, dropped: 0, searches: meter.searches, error,
      requested_by: requestedBy, started_at: startedAt, finished_at: new Date().toISOString(),
    });
    if (logError) console.error("culture_search_runs insert failed:", logError.message);
  }

  try {
    const subjects = await subjectsOf(admin, month, day);
    if (subjects.length === 0) {
      await record("ok", 0, null);
      return json({ status: "done", verdicts: 0, proposals: 0, searchesLeft }, 200, request);
    }
    const notes = await research(geminiKey, scanPrompt(month, day, subjects));
    meter.searches = notes.searches;
    const shaped = await askGemini(geminiKey, shapePrompt(notes.text), false);
    const { verdicts, proposals } = parseScan(shaped.text, subjects);

    // Only unanswered verdicts are replaced. A verdict a curator has already
    // agreed with or overruled is a record and it stays.
    await admin.from("day_scans").delete()
      .eq("event_month", month).eq("event_day", day).is("acted_at", null);

    const rows = [
      ...verdicts.map((v) => ({
        subject_kind: v.kind, subject_id: v.id, event_month: month, event_day: day,
        verdict: v.verdict, reason: v.reason, scanned_by: scannedBy,
      })),
      ...proposals.map((p) => ({
        subject_kind: null, subject_id: null, event_month: month, event_day: day,
        verdict: "missing", reason: "Not a row here yet, and should be.",
        proposal_title: p.title, proposal_context: p.context || null,
        proposal_source_url: p.source_url, proposal_year: p.year, scanned_by: scannedBy,
      })),
    ];
    if (rows.length > 0) {
      const { error } = await admin.from("day_scans").insert(rows);
      if (error) throw new Error(error.message);
    }
    await record("ok", rows.length, null);
    return json({
      status: "done", verdicts: verdicts.length, proposals: proposals.length,
      rows: subjects.length, searchesLeft: Math.max(0, searchesLeft - meter.searches),
    }, 200, request);
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 400);
    await record("failed", 0, message);
    return json({ status: "failed", error: message, searchesLeft: Math.max(0, searchesLeft - meter.searches) }, 200, request);
  }
});
