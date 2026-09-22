// Drafts the one sentence a row is missing, for a person to choose from.
//
//   POST /functions/v1/draft-line
//   { "kind": "cultural_event" | "historical_event" | "birth_fact", "id": "..." }
//
// Returns two or three candidate sentences and the source text they were
// drawn from. It writes nothing. The curator picks one, edits it, and presses
// a key in /admin, and that keypress is the only thing that puts a word on a
// page. notes/panel-brief.md, section 1.
//
// Three rather than one on purpose. One suggestion is a thing you accept or
// reject; three is a thing you choose between, and choosing is faster and
// more accurate than judging.
//
// The row is loaded here by its kind and id rather than taken from the
// request, so a model is only ever asked to rewrite a sentence the database
// holds. No search tool: there is nothing to look up. The row's own sentence
// and the page it cites are the whole of what a line may rest on, because a
// line that says more than the record says is the site doing the one thing
// it promises not to do. docs/lead-lines.md, rule three.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };
const ALLOWED_ORIGINS = [
  "https://birthed.app",
  "https://www.birthed.app",
  "http://localhost:10000",
];
/** No search, so the cheap fast one. */
const MODEL = "gemini-3.7-flash";
const PAGE_MS = 8000;
const SOURCE_CHARS = 3500;

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

interface Row {
  kind: string;
  id: string;
  /** What the row itself says. The line is checked against this. */
  text: string;
  /** A title, when the table has one. Never printed by the site. */
  title: string | null;
  year: number | null;
  sourceUrl: string | null;
  /** Where the chosen sentence is written. Said here so the panel does not guess. */
  writesTo: "cultural_events.context_string" | "lead_lines.line";
}

async function loadRow(
  admin: ReturnType<typeof createClient>,
  kind: string,
  id: string,
): Promise<Row | null> {
  if (kind === "cultural_event") {
    const { data } = await admin.from("cultural_events")
      .select("id,event_title,context_string,source_url,event_date").eq("id", id).maybeSingle();
    if (!data) return null;
    return {
      kind, id: String(data.id),
      text: String(data.context_string ?? "").trim() || String(data.event_title ?? ""),
      title: String(data.event_title ?? ""),
      year: Number(String(data.event_date ?? "").slice(0, 4)) || null,
      sourceUrl: data.source_url ? String(data.source_url) : null,
      writesTo: "cultural_events.context_string",
    };
  }
  if (kind === "birth_fact") {
    const { data } = await admin.from("birth_facts")
      .select("id,fact,source_url,birth_year").eq("id", id).maybeSingle();
    if (!data) return null;
    return {
      kind, id: String(data.id), text: String(data.fact ?? ""), title: null,
      year: null, sourceUrl: data.source_url ? String(data.source_url) : null,
      writesTo: "lead_lines.line",
    };
  }
  if (kind === "historical_event") {
    const { data } = await admin.from("historical_events")
      .select("id,description,source_url,event_year").eq("id", id).maybeSingle();
    if (!data) return null;
    return {
      kind, id: String(data.id), text: String(data.description ?? ""), title: null,
      year: data.event_year === null ? null : Number(data.event_year),
      sourceUrl: data.source_url ? String(data.source_url) : null,
      writesTo: "lead_lines.line",
    };
  }
  return null;
}

/**
 * The cited page as text, or nothing. A page that does not answer is not a
 * failure of this function: the row's own sentence is enough to draft from,
 * and the panel says which it had.
 */
async function sourceText(url: string | null): Promise<string> {
  if (!url) return "";
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_MS),
      headers: { "User-Agent": "birthed.app curation (draft-line)" },
    });
    if (!response.ok) return "";
    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, SOURCE_CHARS);
  } catch {
    return "";
  }
}

/** docs/lead-lines.md, as instructions. If they disagree, the document is right. */
function prompt(row: Row, source: string): string {
  const subject = row.title ? `\nThe row's title, which the page never prints: ${row.title}` : "";
  const year = row.year === null ? "" : `\nThe year, which the card prints beside the line in large type: ${row.year}`;
  const page = source
    ? `\n\nThe page the row cites, as text. Use it only to check that a line says nothing the record does not:\n"""\n${source}\n"""`
    : "\n\nThe cited page did not answer, so the row's own sentence is the whole record.";
  return `Write the one sentence a card asks its question in. The card says "Do you remember this one?" and then this line. Write three different lines for the row below and return them as a JSON array of three strings, nothing else.

The rules, and every one of them is checked by a person before anything is used:

One. Say the thing, then stop. The card is read in about a second. Under 120 characters, one sentence, two at most.
Two. Write it as a person would say it out loud, in a kitchen. Not a headline, not a caption, not an encyclopedia.
Three. Never add a fact that is not in the row. If the row does not say where, do not write where. If it does not give a number, do not give one.
Four. Do not explain why it mattered. No "changing science fiction forever", no iconic, no cultural phenomenon, no paved the way.
Five. No dates in the line. The year is printed beside it.
Six. Name the subject in the first sentence. The page prints the line, never the title, so a line starting with a pronoun has nothing behind it.
Seven. No dashes of any kind.

Good: "Star Trek went out for the first time." Good: "McGwire hit his 62nd, and broke a record that had stood since 1961." Good: "Ford pardoned Nixon."
Bad: "The science fiction television series Star Trek made its broadcast television debut in the United States on NBC with the episode The Man Trap."

Make the three genuinely different: one as short as it can be, one with the one detail from the row that a person would actually mention, one in the plainest words available.

The row: ${row.text}${subject}${year}${page}`;
}

async function draft(key: string, text: string): Promise<{ lines: string[]; raw: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { ...JSON_HEADERS, "x-goog-api-key": key.trim() },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text }] }],
      // Not 800. The model thinks before it answers and thinking spends this
      // budget too, so at 800 it came back with nothing three times in a row
      // and the panel said "no usable lines". find-culture gives it 24000.
      generationConfig: { temperature: 0.7, maxOutputTokens: 8000 },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const body = await response.json();
  const parts: Array<{ text?: string; thought?: boolean }> = body?.candidates?.[0]?.content?.parts ?? [];
  const out = parts.filter((part) => part.thought !== true).map((part) => part.text ?? "").join("");
  return { lines: pickLines(out), raw: out.slice(0, 300) };
}

/**
 * Three lines out of whatever came back. A JSON array of strings is what was
 * asked for; an array of objects with a string in them, or three lines of
 * prose with bullets, are what models also send, and a curator waiting on a
 * draft does not care which.
 */
export function pickLines(out: string): string[] {
  const found: string[] = [];
  const start = out.indexOf("[");
  const end = out.lastIndexOf("]");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(out.slice(start, end + 1));
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === "string") found.push(item);
          else if (item && typeof item === "object") {
            const first = Object.values(item as Record<string, unknown>).find((v) => typeof v === "string");
            if (typeof first === "string") found.push(first);
          }
        }
      }
    } catch {
      // fall through to the lines
    }
  }
  if (found.length === 0) {
    for (const line of out.split(/\r?\n/)) {
      const cleaned = line.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, "").replace(/^["\u201c]|["\u201d],?$/g, "").trim();
      if (cleaned.length >= 8 && !/^```/.test(cleaned)) found.push(cleaned);
    }
  }
  const lines: string[] = [];
  for (const item of found) {
    // The database refuses a line outside 8 to 190 characters and the site
    // refuses a dash, so neither reaches the curator as a choice.
    const line = item.replace(/[–—]/g, ",").replace(/\s+/g, " ").trim();
    if (line.length < 8 || line.length > 190) continue;
    if (!lines.includes(line)) lines.push(line);
  }
  return lines.slice(0, 3);
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

  // is_admin() with the caller's own token. verify_jwt is not the check that
  // matters: every reader of the iOS app holds a valid token.
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
  const kind = String(body.kind ?? "");
  const id = String(body.id ?? "").trim();
  if (!["cultural_event", "historical_event", "birth_fact"].includes(kind)) return json({ error: "bad kind" }, 400, request);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return json({ error: "bad id" }, 400, request);

  const admin = createClient(url, serviceRoleKey);
  const row = await loadRow(admin, kind, id);
  if (row === null) return json({ error: "no such row" }, 404, request);
  if (row.text.trim().length === 0) return json({ error: "the row has no words to draft from" }, 400, request);

  const source = await sourceText(row.sourceUrl);
  try {
    const { lines: candidates, raw } = await draft(geminiKey, prompt(row, source));
    if (candidates.length === 0) {
      // Say what came back, so the next person to see this is not guessing.
      return json({ status: "failed", error: "No usable lines came back. It said: " + (raw || "nothing at all") }, 200, request);
    }
    return json({
      status: "done",
      candidates,
      source_text: source,
      source_url: row.sourceUrl,
      row: { kind: row.kind, id: row.id, text: row.text, writes_to: row.writesTo },
    }, 200, request);
  } catch (error) {
    return json({ status: "failed", error: String(error instanceof Error ? error.message : error).slice(0, 400) }, 200, request);
  }
});
