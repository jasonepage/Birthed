// Finds a source for something a reader typed on the hive, with a model that
// searches. docs/the-wall.md section 15, the typed field, built out past the
// miss.
//
//   POST /functions/v1/hive-find
//   { "phrase": "Charlie Kirk", "wall_date": "2026-09-10" }
//
// Answers with two or three real pages, or with nothing:
//
//   { status: "found", candidates: [{ title, outlet, url, quote }] }
//   { status: "nothing" }
//   { status: "paused" }       the month, the day or this account is out
//
// **The model finds addresses and nothing else reaches the reader.** It is
// asked for pages and for a short quotation copied from each, and both are
// then held to the page itself: this function fetches every address it is
// handed, drops any that does not answer, reads the title off the page's own
// Open Graph tag or title element, and keeps a candidate only when the
// quotation is on the fetched page by exact match with whitespace folded,
// the same rule wall_page_contains applies at submission and page.ts applies
// on every checker run. A quotation that is not on the page is a paraphrase
// or an invention, and the candidate goes with it. Nothing the model wrote
// is ever shown as the page's words, and nothing this function returns is
// stored: the app files the reader's pick through the ordinary submit path,
// which reads the page again and takes the headline and quotation itself.
//
// **Two calls, not one.** The fact finder learned that a model asked to
// search and to return JSON in one breath stops searching and answers from
// memory, with addresses that look right and are not. So the first call
// only researches, with search on and prose out, and the second call only
// reshapes the notes into JSON with no search tool and nothing to look up,
// told to copy addresses rather than correct them. A run that reports no
// searches is discarded, because the list of queries Google reports back is
// the only evidence the tool was used.
//
// **What is kept, and what is not.** The phrase is not written anywhere:
// not to a table, not to a log line, not to an error message. Every run is
// one row in hive_find_runs carrying the account, the date, the number of
// searches Google reported and whether it worked, so the month's meter sees
// this spend and so an account gets five finds a day and no more. That is
// the whole of what the privacy page has to say about this feature.
//
// The phrase and the date are sent to Google's Gemini service to do this.
// Nothing that identifies the person goes with them.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };

// The same model the fact finder uses, for the same reason: it is the one
// that reaches for the search tool. find-facts records the comparison.
const MODEL = "gemini-3.7-flash";
/** The most the model is asked for, and the most that is fetched. */
const ASKED_FOR = 4;
/** The most that is returned. Two or three; more is the ballot the field exists to replace. */
const SHOWN = 3;
/** The most of a phrase accepted. Matches HiveFind.phraseLimit in the app. */
const PHRASE_LIMIT = 120;
const PHRASE_MINIMUM = 2;
/** How long one page gets to answer. */
const PAGE_MS = 8000;
/** How much of one page is read. A news article is well under this; a video page is not and does not need to be. */
const PAGE_BYTES = 1_500_000;
/** How many times to ask before giving up on a run that will not search. find-facts explains the two. */
const RESEARCH_ATTEMPTS = 2;

interface Candidate {
  title: string;
  outlet: string;
  url: string;
  quote: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function monthName(month: number): string {
  return ["January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December"][month - 1];
}

/** "2026-09-10" into its parts, or null. A wall date is text and is never a Date object here. */
function parseWallDate(value: unknown): { year: number; month: number; day: number } | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  return { year, month, day };
}

/** The phrase as the app sends it: whitespace folded, ends trimmed, cut at the limit. */
function cleanPhrase(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, PHRASE_LIMIT);
}

// MARK: The two prompts

/**
 * The first call. Search on, prose out, and it is told in so many words not
 * to write a headline or a sentence of its own about the event. The phrase
 * is the reader's and is quoted as typed; what comes back is held to the
 * fetched pages, so a phrase that tries to steer the model can at worst
 * produce addresses that do not hold up.
 */
function researchPrompt(phrase: string, year: number, month: number, day: number): string {
  return `You are finding sources for a page about one calendar date, ${monthName(month)} ${day}, ${year}.
A reader typed these words to describe something that happened on or around that date, and nothing already filed for the date matched them:
"${phrase}"
Run web searches and use what you find. Do not answer from memory.
Find 2 to ${ASKED_FOR} web pages that report the thing the reader means. Each page must be a news article, an official statement or an encyclopedia article that describes the event itself, and it must be a page you opened during this search.
For each page, write two lines and nothing else:
the full address of the page you opened;
then a short verbatim quotation from that page, under 30 words, copied exactly as the page has it, character for character, that shows the page is about the thing the reader means.
Do not write a headline, a summary or a sentence of your own about the event. Do not write an address you did not open, and do not assemble one that looks plausible.
Prefer pages that open for somebody who is not logged in. Do not cite a social media post, a search results page or a video.
If the reader's words are too vague to search for, or nothing you find reports it, write "nothing found" and nothing else. No em dashes.`;
}

/**
 * The second call. No search tool and nothing to look up, so there is
 * nothing for it to invent: its whole job is to copy the notes into fields.
 */
function shapePrompt(notes: string): string {
  return `Turn the research notes at the end into JSON.
Answer with a JSON array only, no prose before or after. Each object has exactly these fields:
"source_url": the page address for that entry, copied from the notes exactly. Never invent one, never correct one, and never substitute a different page.
"quote": the quotation for that entry, copied from the notes exactly, character for character.
Drop any entry that has no page address or no quotation in the notes. Do not add anything that is not in the notes. If the notes say nothing was found, answer with an empty array.

Research notes:
${notes}`;
}

// MARK: Asking the model

interface Answer {
  text: string;
  finishReason: string;
  /** Google bills for each search query it ran, so the count is kept. */
  searches: number;
}

async function askGemini(key: string, text: string, grounded: boolean): Promise<Answer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const payload: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text }] }],
    // The ceiling is far above what the answer needs, because the model
    // thinks from the same allowance and a tight ceiling returns nothing.
    generationConfig: { temperature: 0.2, maxOutputTokens: 12000 },
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

/**
 * The research call, asked again once if it answered without searching. The
 * searches are summed across attempts because each one is billed.
 */
async function research(key: string, base: string): Promise<Answer> {
  let searches = 0;
  let last: Answer | null = null;
  for (let attempt = 0; attempt < RESEARCH_ATTEMPTS; attempt++) {
    const nudge = attempt === 0
      ? ""
      : "\nYou answered without searching. Search the web first, then write. Do not write anything you have not looked up on this attempt.";
    last = await askGemini(key, base + nudge, true);
    searches += last.searches;
    if (last.searches > 0 && last.text.trim().length > 0) return { ...last, searches };
  }
  // A run that reports no searches is discarded, not shown. The error names
  // the finish reason and nothing the reader typed.
  throw Object.assign(
    new Error(`would not search after ${RESEARCH_ATTEMPTS} attempts, finish reason ${last?.finishReason ?? "none"}`),
    { searches },
  );
}

/** The JSON array out of whatever the model wrapped it in. Addresses and quotations only. */
function parseShaped(text: string): Array<{ url: string; quote: string }> {
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
  const out: Array<{ url: string; quote: string }> = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const c = item as Record<string, unknown>;
    if (typeof c.source_url !== "string" || typeof c.quote !== "string") continue;
    const url = c.source_url.trim();
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const quote = fold(c.quote);
    if (quote.length < 8) continue;
    out.push({ url, quote });
    if (out.length >= ASKED_FOR) break;
  }
  return out;
}

// MARK: Reading the page

// The quotation rule, written a third time. It is wall_page_contains in the
// database and pageContains in worker/src/wall/page.ts, and an Edge Function
// cannot import from either. Same fixtures would hold all three to one
// answer; that test is not written here, and the report says so.

const NAMED: Record<string, string> = {
  nbsp: " ", quot: "\"", apos: "'", lt: "<", gt: ">",
  ndash: "\u2013", mdash: "\u2014", lsquo: "\u2018", rsquo: "\u2019",
  ldquo: "\u201c", rdquo: "\u201d", hellip: "\u2026",
};

function decodeEntities(text: string): string {
  let s = text.replace(/&#[xX]([0-9A-Fa-f]{1,6});/g, (whole, hex: string) => {
    const n = parseInt(hex, 16);
    return n >= 1 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : whole;
  });
  s = s.replace(/&#([0-9]{1,7});/g, (whole, dec: string) => {
    const n = Number(dec);
    return n >= 1 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : whole;
  });
  for (const [name, value] of Object.entries(NAMED)) s = s.split(`&${name};`).join(value);
  return s.split("&amp;").join("&");
}

function fold(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function withoutCode(html: string): string {
  return html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function pageText(html: string): string {
  return fold(decodeEntities(withoutCode(html).replace(/<[^>]*>/g, " ")));
}

/** True when the page contains the quotation, exactly, by either reading. */
function pageContains(html: string, quotation: string): boolean {
  const q = fold(quotation);
  if (q === "") return false;
  if (pageText(html).includes(q)) return true;
  return fold(decodeEntities(withoutCode(html))).includes(q);
}

/** One meta tag's content, by property or by name, whichever order the attributes come in. */
function meta(html: string, key: string): string | null {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta\\s[^>]*?(?:property|name)\\s*=\\s*["']${k}["'][^>]*?content\\s*=\\s*"([^"]*)"`, "i"),
    new RegExp(`<meta\\s[^>]*?(?:property|name)\\s*=\\s*["']${k}["'][^>]*?content\\s*=\\s*'([^']*)'`, "i"),
    new RegExp(`<meta\\s[^>]*?content\\s*=\\s*"([^"]*)"[^>]*?(?:property|name)\\s*=\\s*["']${k}["']`, "i"),
    new RegExp(`<meta\\s[^>]*?content\\s*=\\s*'([^']*)'[^>]*?(?:property|name)\\s*=\\s*["']${k}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const m = pattern.exec(html);
    if (m) {
      const value = fold(decodeEntities(m[1]));
      if (value) return value;
    }
  }
  return null;
}

/** The page's own title: Open Graph first, then the title element. Never a sentence the model wrote. */
function pageTitle(html: string): string | null {
  const og = meta(html, "og:title");
  if (og) return og;
  const m = /<title[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html);
  if (m) {
    const value = fold(decodeEntities(m[1]));
    if (value) return value;
  }
  return null;
}

/** The outlet a page belongs to, as its host with no www. */
function outletOf(raw: string): string {
  const host = new URL(raw).hostname.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}

/** The page, as text, or null when it does not answer or is not a page. */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_MS),
      headers: { "User-Agent": "Birthed hive-find (https://birthed.app)", Accept: "text/html,application/xhtml+xml" },
    });
    if (response.status >= 400 || !response.body) return null;
    const type = response.headers.get("content-type") ?? "";
    if (type && !/html|xml/i.test(type)) {
      await response.body.cancel();
      return null;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < PAGE_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
    await reader.cancel().catch(() => {});
    const joined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(joined);
  } catch {
    return null;
  }
}

/** Where a cited page stopped, so a run of nothing can say why without saying what. */
type Held =
  | { candidate: Candidate; quoteFrom: "body" | "description" }
  | { dropped: "no page" | "no title" | "no quote" };

/** The shortest description worth quoting. The submit path draws the same line at twenty. */
const DESCRIPTION_MINIMUM = 20;

/** The page's own description tag: Open Graph first, then the plain one. */
function pageDescription(html: string): string | null {
  return meta(html, "og:description") ?? meta(html, "description");
}

/**
 * A cited page into a candidate, or the reason it is not one. The page has
 * to answer, has to have a title of its own, and has to carry a quotation
 * that is on the fetched page. Any of the three missing and the candidate
 * is dropped rather than shown thin, and the stage it was dropped at is
 * counted on the ledger row. A stage that fails on every run must not look
 * like one that failed once, and without these counts it would.
 *
 * The quotation is the model's sentence when the page contains it exactly.
 * When it does not, and on the first live run it did not on either of two
 * real pages, the page's own description tag stands in. News sites hand a
 * plain fetch their title and description and put the article body behind
 * a script, so a sentence the model read through the search tool is often
 * not in the page as fetched here. The description is the quotation the
 * submit path stores on the receipt anyway, so the reader is shown the
 * words the receipt will carry. Either way it is the page's wording and
 * never the model's; what changes is only which of the page's sentences.
 */
async function hold(entry: { url: string; quote: string }): Promise<Held> {
  const html = await fetchPage(entry.url);
  if (!html) return { dropped: "no page" };
  const title = pageTitle(html);
  if (!title) return { dropped: "no title" };
  const base = { title: title.slice(0, 300), outlet: outletOf(entry.url), url: entry.url };
  if (pageContains(html, entry.quote)) {
    return { candidate: { ...base, quote: entry.quote.slice(0, 400) }, quoteFrom: "body" };
  }
  const description = pageDescription(html);
  if (description && description.length >= DESCRIPTION_MINIMUM) {
    return { candidate: { ...base, quote: description.slice(0, 400) }, quoteFrom: "description" };
  }
  return { dropped: "no quote" };
}

// MARK: The function

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "missing authorization" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!url || !anonKey || !serviceRoleKey) return json({ error: "function is misconfigured" }, 500);
  if (!geminiKey) return json({ error: "GEMINI_API_KEY is not set" }, 500);
  if (geminiKey.trim().startsWith("ey")) {
    return json({ error: "GEMINI_API_KEY holds a JSON Web Token, not a Google key" }, 500);
  }

  // Who is asking, according to their own token and nothing else. The
  // anonymous account Birthed makes on first launch is enough; the key alone
  // is not, because the key ships inside the app and this costs money.
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: identity, error: identityError } = await caller.auth.getUser();
  const user = identity?.user;
  if (identityError || !user) return json({ error: "not signed in" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const phrase = cleanPhrase(body.phrase);
  const date = parseWallDate(body.wall_date);
  if (phrase.length < PHRASE_MINIMUM) return json({ error: "phrase is too short" }, 400);
  if (!date) return json({ error: "bad wall_date" }, 400);

  const admin = createClient(url, serviceRoleKey);

  // The three ceilings, in one place each. Nothing starts a search once any
  // of them is reached, and "paused" is not an error: the date has done
  // nothing wrong and neither has the reader.
  const { data: remaining } = await admin.rpc("fact_searches_left");
  if (typeof remaining !== "number" || remaining <= 0) return json({ status: "paused" });
  const { data: mine } = await admin.rpc("hive_finds_left", { account_in: user.id });
  if (typeof mine !== "number" || mine <= 0) return json({ status: "paused" });

  // The row goes in before the search, so a run that dies mid way still
  // counts against the account. Nothing typed is in it.
  const wallDateText = `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
  const { data: run } = await admin
    .from("hive_find_runs")
    .insert({ wall_date: wallDateText, requested_by: user.id, status: "running" })
    .select("id")
    .single();
  const runID = run?.id;

  async function finish(fields: Record<string, unknown>): Promise<void> {
    if (runID === undefined || runID === null) return;
    await admin.from("hive_find_runs").update({ ...fields, finished_at: new Date().toISOString() }).eq("id", runID);
  }

  let searches = 0;
  try {
    const notes = await research(geminiKey, researchPrompt(phrase, date.year, date.month, date.day));
    searches = notes.searches;
    // The note on the ledger row says which stage a run of nothing stopped
    // at, in counts and stage names only. Never a word the reader typed and
    // never a word the model wrote.
    if (/^\s*nothing found\.?\s*$/i.test(notes.text)) {
      await finish({ status: "nothing", searches, error: "the model said nothing found" });
      return json({ status: "nothing" });
    }
    const shaped = await askGemini(geminiKey, shapePrompt(notes.text), false);
    const entries = parseShaped(shaped.text);
    if (entries.length === 0) {
      await finish({
        status: "nothing", searches,
        error: `no entries shaped, finish reason ${shaped.finishReason}, ${notes.text.length} characters of notes`,
      });
      return json({ status: "nothing" });
    }

    // Every address is fetched and held to the page. What does not hold up
    // is dropped, and the order the search gave is kept among the rest.
    const held = await Promise.all(entries.map(hold));
    const candidates = held.flatMap((h) => ("candidate" in h ? [h.candidate] : [])).slice(0, SHOWN);
    const dropped = held.flatMap((h) => ("dropped" in h ? [h.dropped] : []));
    const count = (stage: string) => dropped.filter((d) => d === stage).length;
    const fromBody = held.filter((h) => "quoteFrom" in h && h.quoteFrom === "body").length;
    const fromDescription = held.filter((h) => "quoteFrom" in h && h.quoteFrom === "description").length;
    const note = `${entries.length} shaped, ${fromBody} quoted from body, ${fromDescription} from description,`
      + ` ${count("no page")} no page, ${count("no title")} no title, ${count("no quote")} no quote`;
    await finish({ status: candidates.length > 0 ? "found" : "nothing", searches, candidates: candidates.length, error: note });
    if (candidates.length === 0) return json({ status: "nothing" });
    return json({ status: "found", candidates });
  } catch (error) {
    // The error carries what the model did and never what the reader typed:
    // the only strings in it are finish reasons and status codes.
    const message = String(error instanceof Error ? error.message : error).slice(0, 300);
    const spent = typeof (error as { searches?: unknown })?.searches === "number"
      ? (error as { searches: number }).searches
      : searches;
    await finish({ status: "failed", searches: spent, error: message });
    return json({ error: "the search did not answer" }, 502);
  }
});
