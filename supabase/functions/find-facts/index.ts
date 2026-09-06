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
// Two calls to the model, not one, and the reason matters. Asking for facts
// and for a JSON array in the same breath made the model skip searching
// altogether and answer from memory, twice, with invented page addresses
// that looked right, including two different NASA addresses for the same
// picture. So the first call only researches, with search on and prose out,
// and the second call only reshapes those notes into JSON, with no search
// and nothing to look up. The formatting call is told to copy addresses
// rather than correct them.
//
// What the model says about a fact is trusted and the fact is shown as
// returned. The address under it is not: a run that reports no searches is
// thrown away, and every cited page has to answer before its fact is marked
// `verified`, which is the only thing the interface can read. The quotation
// is stored either way, so a stricter check that reads the page can be
// switched on later without a migration.
//
// The date, the year and the region are sent to Google's Gemini service to
// do this. Nothing that identifies the person goes with them, and the
// privacy page says so.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };
// Gemini 2.5 is closed to keys made after it shipped, and grounding is a
// paid feature on every model, so this one is chosen and pinned rather than
// tracking an alias that could move under the app without warning.
//
// 3.7 rather than its neighbours because it is the one that actually
// searches. Given the same research prompt for September 4, 2002, 3.7 ran
// six targeted searches, 3.6 ran one, and 3.8 ran none and answered from
// memory. Whether a model reaches for the tool is the whole job here, so it
// is worth more than being a generation newer.
const MODEL = "gemini-3.7-flash";
const MAX_FACTS = 14;
const RUN_STALE_MS = 4 * 60 * 1000;
/** A failed search is tried again after this long, not left failed forever. */
const RETRY_AFTER_MS = 2 * 60 * 1000;
/** How long one cited page gets to answer before it counts as missing. */
const LINK_CHECK_MS = 8000;
/**
 * How many times to ask before giving up on a run that will not search.
 *
 * Whether the model reaches for the tool is a decision it makes, not a
 * setting, and on a date it believes it already knows it sometimes writes
 * from memory instead. Asking again, and saying so, gets it most of the
 * time. A call that ran no searches is not billed for any, so the retry is
 * cheap in the only way that matters.
 */
const RESEARCH_ATTEMPTS = 3;
/**
 * How many times facts have to have been seen before what readers do with
 * them is allowed to steer the search.
 *
 * Below this the rates in `fact_category_performance` are the priors talking
 * and every category looks identical, which is the correct answer to "what do
 * readers like" when nobody has read anything. Steering on a handful of taps
 * would not be learning, it would be chasing noise and calling it learning.
 */
const LEARNING_FLOOR = 5000;

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

/**
 * Who the sentence is talking to.
 *
 * A fact about a birth year belongs to the person who was born then, so it
 * says "you". A fact about a calendar date across history belongs to the
 * date, and the same rows are read on the birthed.app page for that date by
 * anybody looking it up, so "on your birthday in 1940" is simply false there.
 * The date voice is correct in both places; the reader voice is only correct
 * in one.
 */
type Voice = "reader" | "date";

const READER_LINE =
  'the finding itself, as one plain sentence addressed to the reader as "you";';

const DATE_LINE =
  'the finding itself, as one plain sentence that names the date and the year it happened, for example "On September 4, 1957, Ford unveiled the Edsel". Do not address a reader and do not use the words you or your, because this sentence is read by anybody looking the date up and not only by somebody born on it;';

function shapeRules(voice: Voice): string {
  return `Write your findings as a numbered list. For each finding, write three lines and nothing else:
${voice === "date" ? DATE_LINE : READER_LINE}
then the full address of the page you opened;
then a short verbatim quotation from that page, under 30 words, that supports it.
Leave out anything that no page you opened supports. Do not write an address you did not open, and do not assemble one that looks plausible.
Prefer reference and primary sources: Wikipedia, official sites, NASA, the National Oceanic and Atmospheric Administration, government statistics, newspaper archives, Billboard, Box Office Mojo.
No brand promotions, no deals, no astrology, no horoscopes, no numerology, no politics, and nothing about anyone's death that day. No em dashes.`;
}

/** A run with no birth year is about the date itself, wherever it is read. */
function voiceFor(year: number): Voice {
  return year === 0 ? "date" : "reader";
}

/**
 * Two different questions, not one question asked twice.
 *
 * The shared question is the world on that date, and it is the one the cache
 * pays for, because everybody born that day gets the same answer. The
 * regional question is asked only for what the shared one cannot know: the
 * weather in that place, the local paper, the local team. Asking both the
 * same question produced eight duplicates out of twelve on the first real
 * run, which is a doubled bill and the same fact twice on screen.
 */
function researchPrompt(month: number, day: number, year: number, region: string): string {
  if (region) return regionalResearchPrompt(month, day, year, region);
  if (year === 0) {
    return `You are researching one calendar date, ${monthName(month)} ${day}, for a page about that date and for a birthday app.
Run web searches and use what you find. Do not answer from memory.
Find 8 to ${MAX_FACTS} specific, true, surprising things that happened on ${monthName(month)} ${day} across history, or that are tied to that date: an event, a launch, a record, a discovery, a first, a sports result, and something quirky about the date itself. Spread them across decades rather than clustering in one year.
${shapeRules("date")}`;
  }
  return `You are researching one birth date for a birthday app: ${monthName(month)} ${day}, ${year}.
Run web searches and use what you find. Do not answer from memory.
The reader is the person born that day. Find 8 to ${MAX_FACTS} specific, true, surprising facts tied to that exact day, that week, or that year: something that happened in the world on that day; a game, album, film, product or website that launched that week or shortly after, so the reader is "older than" it; a sports result that day; a record set; what a specific everyday thing cost that year; a space or science event.
${shapeRules("reader")}`;
}

/** Only what the shared search cannot know, because it does not know where. */
function regionalResearchPrompt(month: number, day: number, year: number, region: string): string {
  const when = year === 0 ? `${monthName(month)} ${day}` : `${monthName(month)} ${day}, ${year}`;
  return `You are researching one place on one date for a birthday app. The reader was born in or near ${region} on ${when}.
Run web searches and use what you find. Do not answer from memory.
Find 4 to 8 facts that are specific to ${region} and could not be found by somebody who did not know where the reader was born: the recorded weather there that day in degrees Fahrenheit, what the local newspaper carried, a local sports result, something that opened or closed there, a local record, what a local thing cost.
Do not include national or world events, and do not include anything a reader anywhere else would also be told. If you can only find two local facts, return two. Returning fewer real local facts is better than padding with national ones.
${shapeRules(voiceFor(year))}`;
}

/**
 * The second call. It has no search tool and nothing to look up, so there is
 * nothing for it to invent: its whole job is to copy the notes into fields.
 */
function shapePrompt(notes: string, voice: Voice): string {
  const sentence = voice === "date"
    ? 'the finding as one plain sentence naming the date and the year, exactly as the notes have it. Do not rewrite it to address a reader and do not introduce the words you or your.'
    : 'the finding as one plain sentence addressed to the reader as "you", with no em dashes.';
  return `Turn the research notes at the end into JSON.
Answer with a JSON array only, no prose before or after. Each object has exactly these fields:
"fact": ${sentence}
"category": one of event, release, older_than, sport, science, price, weather, local, record.
"source_url": the page address for that finding, copied from the notes exactly. Never invent one, never correct one, and never substitute a different page.
"quote": the quotation for that finding, copied from the notes exactly.
Drop any finding that has no page address in the notes. Do not add anything that is not in the notes.

Research notes:
${notes}`;
}

/**
 * A line about what readers actually do with these facts, or nothing.
 *
 * What generalises from one date to another is the shape of a fact, not the
 * fact. Nobody born on September 5 cares which September 4 fact won, but if
 * readers everywhere share "you are older than" findings and scroll past
 * summit communiques, that is worth telling the next search.
 *
 * Ranked by share opens rather than by likes on purpose. A like costs a tap
 * and goes disproportionately to whatever sat at the top of the list, which
 * is set large; opening the share sheet on a card costs real effort and is
 * the behaviour the product is actually for.
 *
 * The line is advice, not a quota. A date that genuinely has no sport on it
 * must not have sport invented for it, so the prompt says so.
 */
async function readerPreference(admin: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await admin.from("fact_category_performance").select("*");
  if (!Array.isArray(data) || data.length < 4) return "";

  const rows = data.map((row) => ({
    category: String(row.category),
    impressions: Number(row.impressions ?? 0),
    rate: Number(row.shares_per_thousand ?? 0),
  }));
  const seen = rows.reduce((total, row) => total + row.impressions, 0);
  if (seen < LEARNING_FLOOR) return "";

  const ranked = [...rows].sort((a, b) => b.rate - a.rate);
  const best = ranked.slice(0, 3).map((row) => row.category).join(", ");
  const worst = ranked.slice(-2).map((row) => row.category).join(" or ");
  return `\nReaders of this app share findings of these kinds far more than any other: ${best}. They almost never share ${worst}. Weight what you look for that way. This is advice about where to spend your searching, not a quota: a real finding of an unpopular kind is worth more than a stretched one of a popular kind, and a date that genuinely has none of the popular kinds should not have them invented for it.`;
}

/** What the model said, why it stopped, and what it cost. */
interface Answer {
  text: string;
  finishReason: string;
  /** Google bills for each search query it ran, so the count is kept. */
  searches: number;
}

/**
 * Asks the model, with web search on or off.
 *
 * The output ceiling is deliberately far above what the answer needs. These
 * models think before they answer and the thinking is drawn from the same
 * allowance, so a tight ceiling lets a run spend everything thinking and
 * return nothing, which arrives looking like a date with no facts rather
 * than like a failure.
 */
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

/**
 * The research call, asked again if it answered without searching.
 *
 * There is no setting that makes the search tool compulsory, so this checks
 * the one thing that proves it was used, the list of queries Google reports
 * back, and asks again when that list is empty.
 */
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
    `would not search after ${RESEARCH_ATTEMPTS} attempts, ` +
    `finish reason ${last?.finishReason ?? "none"}, ${last?.text.length ?? 0} characters back`,
  );
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

/**
 * Does the page the model cited actually exist.
 *
 * The fact is only as good as the page under it, because the interface puts
 * that page one tap away, so a citation that does not resolve does not ship.
 * This asks whether the page answers, not whether it agrees; `verified` is
 * the switch a stricter reading check would flip later.
 */
async function pageAnswers(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(LINK_CHECK_MS),
    });
    // The body is not read, only the status, so this stays cheap.
    await response.body?.cancel();
    return response.status < 400;
  } catch {
    return false;
  }
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
    // An answer that ran no searches was written from memory, whatever it
    // says, and its citations are guesses, so this throws rather than store it.
    const preference = await readerPreference(admin);
    const notes = await research(key, researchPrompt(month, day, year, region) + preference);
    const shaped = await askGemini(key, shapePrompt(notes.text, voiceFor(year)), false);
    const candidates = parseCandidates(shaped.text);
    // Nothing parsed is a failure, so the run is retried rather than cached
    // forever as a date that simply has nothing interesting about it.
    if (candidates.length === 0) {
      throw new Error(
        `no facts parsed, finish reason ${shaped.finishReason}, ` +
        `${shaped.text.length} characters back: ${shaped.text.slice(0, 200)}`,
      );
    }

    const live = await Promise.all(candidates.map((candidate) => pageAnswers(candidate.source_url)));
    const rows = candidates.map((candidate, index) => ({
      ...where,
      fact: candidate.fact.slice(0, 400),
      category: candidate.category.slice(0, 30),
      source_url: candidate.source_url.slice(0, 1000),
      source_quote: candidate.quote.slice(0, 600),
      // Unverified rows are kept, because only the service role can read
      // them and they are how a bad citation gets looked at later.
      verified: live[index],
      model: MODEL,
    }));
    const { error } = await admin.from("birth_facts").upsert(rows, {
      onConflict: "birth_month,birth_day,birth_year,region_key,fact",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(error.message);

    const found = rows.filter((row) => row.verified).length;
    if (found === 0) {
      throw new Error(`no cited page answered, out of ${rows.length}`);
    }
    await admin.from("birth_fact_runs").upsert({
      ...where,
      status: "done",
      found,
      searches: notes.searches,
      error: rows.length === found ? null : `${rows.length - found} of ${rows.length} citations did not resolve`,
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
  // A Supabase key pasted into this secret by mistake costs a failed run and a
  // Google error that says nothing about the mix up, so name it here instead.
  if (geminiKey.trim().startsWith("ey")) {
    return json({ error: "GEMINI_API_KEY holds a JSON Web Token, not a Google key" }, 500);
  }

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

  // What the month has left. Nothing starts a search once the ceiling is
  // reached, whatever asks for it. Reading still works, so every date already
  // found stays on screen and the app degrades to what it has rather than to
  // an error. The ceiling lives in `fact_search_budget` so raising it is a
  // value somebody sets while looking at a bill, not a deploy.
  const { data: remaining } = await admin.rpc("fact_searches_left");
  const searchesLeft = typeof remaining === "number" ? remaining : 0;

  const statuses: string[] = [];
  for (const regionKeyValue of keys) {
    const where = { birth_month: month, birth_day: day, birth_year: year, region_key: regionKeyValue };
    const { data: run } = await admin.from("birth_fact_runs").select("*").match(where).maybeSingle();
    if (run?.status === "done") {
      statuses.push("done");
      continue;
    }
    if (run?.status === "failed" && run.finished_at && Date.now() - new Date(run.finished_at).getTime() < RETRY_AFTER_MS) {
      statuses.push("failed");
      continue;
    }
    if (run?.status === "running" && Date.now() - new Date(run.started_at).getTime() < RUN_STALE_MS) {
      statuses.push("running");
      continue;
    }
    // Deliberately not written down as a failed run. This date is not the
    // problem and marking it failed would cache a verdict about the budget
    // against a date that has done nothing wrong.
    if (searchesLeft <= 0) {
      statuses.push("paused");
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

  // The region is filtered here rather than in the query. The client library
  // does not quote an empty string inside an `in` list, so `.in("region_key",
  // [""])` matched nothing at all and this array came back empty for every
  // date without a region, which is most of them. Two keys at most reach this
  // point, so filtering them after the read costs nothing and cannot be
  // wrong in a way that looks like a date having no facts.
  const { data: rows } = await admin
    .from("birth_facts")
    .select("id,fact,category,source_url,region_key")
    .match({ birth_month: month, birth_day: day, birth_year: year, verified: true })
    .order("id");
  const facts = (rows ?? []).filter((row) => keys.includes(String(row.region_key ?? "")));

  // "paused" is not an error and the app treats it as one more thing that is
  // not "started" or "running", so it stops waiting and shows what it has.
  const status = statuses.includes("started")
    ? "started"
    : statuses.includes("running")
      ? "running"
      : statuses.includes("paused")
        ? "paused"
        : "done";
  return json({ status, searchesLeft, facts }, status === "started" ? 202 : 200);
});
