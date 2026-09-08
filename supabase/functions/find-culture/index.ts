// Proposes internet and cultural rows for one calendar date.
//
//   POST /functions/v1/find-culture
//   { "month": 9, "day": 7 }
//
// Every row it writes is a candidate. Nothing here can put anything on a page:
// that takes a curator pressing a key in /admin, and the read policy on
// cultural_events refuses a candidate row to an anonymous caller, which is
// what the site build is. See docs/curation-panel.md section 8.
//
// This is find-facts with a different question and a different destination,
// and it deliberately keeps that function's shape rather than inventing its
// own, because each piece of that shape was paid for:
//
//   Two calls, not one. Asking a model to research and to emit JSON in one
//   breath made it stop searching and answer from memory with invented page
//   addresses that looked real. The research call has search on and returns
//   prose; the shaping call has no search and nothing to look up.
//
//   A retry when the model did not search, checked against the query list
//   Google reports back, because nothing makes the tool compulsory.
//
//   Every cited page has to answer before the row is written at all.
//
//   One monthly ceiling, shared with find-facts, because it is one bill.
//
// What is different here, and it is the hard part: this asks for a DATE, not
// for a fact about a date. docs/internet-culture.md is the whole specification
// for what may be proposed, and the two rules that do the work are that a row
// is a thing that happened at a timestamp rather than a meme, and that a row
// with no defensible day does not exist.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };
/** Pinned for the reason find-facts pins it: this is the one that searches. */
const MODEL = "gemini-3.7-flash";
const MAX_ROWS = 12;
const LINK_CHECK_MS = 8000;
const RESEARCH_ATTEMPTS = 2;
/** Internet culture barely predates this, and padding earlier years is lying. */
const EARLIEST = 1980;

const CATEGORIES = ["meme", "gaming", "tech", "music", "cinema"];
const DATE_KINDS = ["posted", "happened", "went_viral", "ended"];

interface Candidate {
  event_date: string;
  category: string;
  date_kind: string;
  event_title: string;
  context_string: string;
  source_url: string;
  quote: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function monthName(month: number): string {
  return ["January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December"][month - 1];
}

/**
 * The research prompt, which is docs/internet-culture.md turned into
 * instructions. If that document and this string ever disagree, the document
 * is right and this is a bug.
 */
function researchPrompt(month: number, day: number, already: string): string {
  const date = `${monthName(month)} ${day}`;
  return `You are building a dated timeline of internet and popular culture for one calendar date: ${date}, in any year from ${EARLIEST} onward.

Run web searches and use what you find. Do not answer from memory.

Find up to ${MAX_ROWS} things that happened on ${date} in some year and that somebody in their teens or twenties would recognise. A video being uploaded, a tweet being posted, a game or console or phone or app arriving, a platform launching or changing or shutting down, a real world event that became a meme, an album or a film that mattered to that audience.

The single hardest rule, and the one that decides whether this is worth doing:

A MEME DOES NOT HAVE A DATE. It has a spread. So do not file the meme. File the thing that happened at a timestamp which later became one. A specific video being uploaded has a date. A tweet has a date. A platform shutting down has a date. "The year everyone said bruh" does not, and neither does a reaction image with no traceable first post. If you cannot point at a day, leave it out. A short list of real things beats a long list with three guesses in it.

For each finding, say which kind of date it is:
posted, for an upload or publication timestamp, exact.
happened, for the event itself.
went_viral, for a documented week it broke out, when the original posting is not known or is gone.
ended, for a shutdown, a deletion or a ban.

Say it honestly. "This is when it spread, not when it was posted" is a better sentence than any competitor writes and it is not a hedge.

Write your findings as a numbered list. For each one write six lines and nothing else:
the full date, as YYYY-MM-DD, with the real year;
one of: meme, gaming, tech, music, cinema;
one of: posted, happened, went_viral, ended;
a short title naming the thing, under 100 characters, for example "Vine shuts down";
one or two plain sentences a reader sees. Name the thing, say what happened, stop. Do not explain the joke: somebody who was there does not need it explained and somebody who was not is better served by the link. No em dashes;
then the full address of the page you opened, then a short verbatim quotation from it, under 30 words, that supports the date.

Sourcing, in order of preference: the post itself if it still exists and shows its timestamp; an archive of it showing the timestamp; a news report published within days, which dates the spread even when the posting is gone; Know Your Meme, but only for a finding whose kind is went_viral and never for one claiming an exact posting date.

Do not write an address you did not open and do not assemble one that looks plausible. Leave out anything no page you opened supports.

Internet culture clusters into about fifteen years, so a date will have few of these and some will have almost none. That is correct. Returning four real things is a good answer. Returning four real things and four invented ones is a dead site. Do not pad.

No astrology, no numerology, no politics, no brand promotions, and nothing about anybody's death.${already}`;
}

/** The shaping call. No search tool, nothing to look up, nothing to invent. */
function shapePrompt(notes: string): string {
  return `Turn the research notes at the end into JSON.
Answer with a JSON array only, no prose before or after. Each object has exactly these fields:
"event_date": the full date as YYYY-MM-DD, copied from the notes.
"category": one of meme, gaming, tech, music, cinema.
"date_kind": one of posted, happened, went_viral, ended.
"event_title": the short title, copied from the notes.
"context_string": the sentences a reader sees, copied from the notes.
"source_url": the page address for that finding, copied exactly. Never invent one, never correct one, never substitute a different page.
"quote": the quotation, copied exactly.
Drop any finding with no page address or no full date in the notes. Do not add anything that is not in the notes.

Research notes:
${notes}`;
}

interface Answer { text: string; finishReason: string; searches: number }

async function askGemini(key: string, text: string, grounded: boolean): Promise<Answer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const payload: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 24000 },
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
      : "\nYou answered without searching. Search the web first, then write. Do not write anything you have not looked up on this attempt.";
    last = await askGemini(key, base + nudge, true);
    if (last.searches > 0 && last.text.trim().length > 0) return last;
  }
  throw new Error(
    `would not search after ${RESEARCH_ATTEMPTS} attempts, finish reason ${last?.finishReason ?? "none"}`,
  );
}

/**
 * The JSON array, with every row that cannot be trusted thrown away here
 * rather than by a database constraint, so the reason is legible.
 */
export function parseCandidates(text: string, month: number, day: number): Candidate[] {
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
    if (typeof c.event_date !== "string" || typeof c.source_url !== "string") continue;
    if (typeof c.event_title !== "string" || c.event_title.trim().length === 0) continue;
    if (!/^https?:\/\//.test(c.source_url)) continue;

    // The date has to be a real day, in the year range, and on the date that
    // was asked about. A model that drifts onto a neighbouring day is a model
    // writing rows for the wrong page, which nothing downstream would catch.
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c.event_date.trim());
    if (match === null) continue;
    const year = Number(match[1]);
    if (Number(match[2]) !== month || Number(match[3]) !== day) continue;
    if (year < EARLIEST || year > new Date().getUTCFullYear()) continue;

    const category = String(c.category ?? "").trim().toLowerCase();
    const kind = String(c.date_kind ?? "").trim().toLowerCase();
    if (!CATEGORIES.includes(category)) continue;
    // A row that will not say which kind of date it carries is the row this
    // whole exercise is trying not to produce.
    if (!DATE_KINDS.includes(kind)) continue;

    out.push({
      event_date: c.event_date.trim(),
      category,
      date_kind: kind,
      event_title: c.event_title.trim().replace(/—/g, ",").slice(0, 200),
      context_string: String(c.context_string ?? "").trim().replace(/—/g, ",").slice(0, 600),
      source_url: c.source_url.trim().slice(0, 1000),
      quote: String(c.quote ?? "").trim().slice(0, 600),
    });
  }
  return out.slice(0, MAX_ROWS);
}

async function pageAnswers(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(LINK_CHECK_MS),
    });
    await response.body?.cancel();
    return response.status < 400;
  } catch {
    return false;
  }
}

/**
 * What this date already holds, in any state, as a note to the model.
 *
 * Rejected rows are included on purpose. A curator who threw something out
 * should never be shown it again by the next run, and the rejections are kept
 * precisely so this list can exist.
 */
async function alreadyHere(
  admin: ReturnType<typeof createClient>,
  month: number,
  day: number,
): Promise<{ note: string; titles: Set<string> }> {
  const { data } = await admin
    .from("cultural_events")
    .select("event_title,event_date,status")
    .limit(1000);
  const rows = (data ?? []).filter((row) => {
    const parts = String(row.event_date ?? "").split("-");
    return Number(parts[1]) === month && Number(parts[2]) === day;
  });
  const titles = new Set(rows.map((row) => String(row.event_title ?? "").toLowerCase().trim()));
  if (rows.length === 0) return { note: "", titles };
  const list = rows.map((row) => `- ${row.event_title}`).join("\n");
  return {
    note: `\n\nThese are already on this date, including some a curator has already turned down. Do not propose any of them again, in these words or others. Find different things:\n${list}`,
    titles,
  };
}

async function propose(
  admin: ReturnType<typeof createClient>,
  key: string,
  month: number,
  day: number,
): Promise<{ written: number; dropped: number; searches: number }> {
  const { note, titles } = await alreadyHere(admin, month, day);
  const notes = await research(key, researchPrompt(month, day, note));
  const shaped = await askGemini(key, shapePrompt(notes.text), false);
  const parsed = parseCandidates(shaped.text, month, day);

  const fresh = parsed.filter((row) => !titles.has(row.event_title.toLowerCase().trim()));
  if (fresh.length === 0) {
    return { written: 0, dropped: parsed.length, searches: notes.searches };
  }

  // A citation that does not resolve does not become a candidate at all.
  // find-facts keeps unverified rows because only the service role can read
  // them; here a candidate is something a curator will be asked to read, and
  // their time is the scarce thing.
  const live = await Promise.all(fresh.map((row) => pageAnswers(row.source_url)));
  const rows = fresh.filter((_, index) => live[index]).map((row) => ({
    event_date: row.event_date,
    category: row.category,
    date_kind: row.date_kind,
    event_title: row.event_title,
    context_string: row.context_string || null,
    source_url: row.source_url,
    origin: "imported",
    status: "candidate",
    vibe_model: MODEL,
  }));

  if (rows.length > 0) {
    const { error } = await admin
      .from("cultural_events")
      .upsert(rows, { onConflict: "event_date,event_title", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return {
    written: rows.length,
    dropped: parsed.length - rows.length,
    searches: notes.searches,
  };
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!url || !serviceRoleKey || !anonKey) return json({ error: "function is misconfigured" }, 500);
  if (!geminiKey) return json({ error: "GEMINI_API_KEY is not set" }, 500);
  if (geminiKey.trim().startsWith("ey")) {
    return json({ error: "GEMINI_API_KEY holds a JSON Web Token, not a Google key" }, 500);
  }

  // verify_jwt is not the check that matters here.
  //
  // Every reader of the iOS app holds a valid token, because the app signs
  // everybody in anonymously on first launch. So a function that only asks
  // "is this token real" is a function every reader may spend money with.
  // is_admin() is asked with the caller's own token, so the answer is about
  // them and not about this function.
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return json({ error: "sign in first" }, 401);
  }
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: allowed, error: adminError } = await asCaller.rpc("is_admin");
  if (adminError) return json({ error: "could not check curation access" }, 500);
  if (allowed !== true) return json({ error: "not a curator" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const month = Number(body.month);
  const day = Number(body.day);
  if (!Number.isInteger(month) || month < 1 || month > 12) return json({ error: "bad month" }, 400);
  if (!Number.isInteger(day) || day < 1 || day > 31) return json({ error: "bad day" }, 400);

  const admin = createClient(url, serviceRoleKey);

  // One ceiling, shared with find-facts, because it is one bill. A run that
  // would cross it does not start and says so, rather than being a surprise on
  // a statement.
  const { data: remaining } = await admin.rpc("fact_searches_left");
  const searchesLeft = typeof remaining === "number" ? remaining : 0;
  if (searchesLeft <= 0) {
    return json({ status: "paused", searchesLeft, written: 0 }, 200);
  }

  try {
    const result = await propose(admin, geminiKey, month, day);
    return json({ status: "done", searchesLeft: searchesLeft - result.searches, ...result });
  } catch (error) {
    return json({
      status: "failed",
      error: String(error instanceof Error ? error.message : error).slice(0, 400),
    }, 200);
  }
});
