// Measures reach for every source a date cites: yearly pageviews on the
// Wikipedia article the source resolves to.
//
//   POST /functions/v1/measure-reach
//   { "month": 9, "day": 8 }
//
// Writes only to article_reach. No model, no search, no spend: the Wikimedia
// pageviews API is free and needs no key, only a User-Agent that says who is
// asking. A source that is a Wikipedia article is measured directly; a
// Wikidata entity is resolved to its English article first; anything else is
// recorded with an error, which the panel prints as "unmeasured", never as
// zero. Measurements under sixty days old are not repeated.
//
// History rows are measured on historical_events.subject_url, the article
// the line is about, never on source_url, which is the date page the line
// was read from and the same number on every line of the date. Before
// subject_url existed every one of the 19,734 history rows cited the date
// page, and a run of this function would have measured none of them.
//
// One call measures at most BATCH sources and answers with how many are
// still waiting on the date, so it never runs into its own time limit; the
// caller calls again until remaining is nought. The panel's "Measure every
// date" walks all 366 that way, in a browser tab a person can watch.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };
const ALLOWED_ORIGINS = [
  "https://birthed.app",
  "https://www.birthed.app",
  "http://localhost:10000",
];
const AGENT = "birthed.app curation (measure-reach; https://birthed.app/about/)";
const FRESH_DAYS = 60;
const FETCH_MS = 8000;
/** The most sources measured in one call. Forty at about a third of a second each is well inside the function's time. */
const BATCH = 40;
/** A pause between pageviews requests. The service asks for a modest rate and this is one caller. */
const PAUSE_MS = 120;

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

/** Every source address on the date, from the same lists the page draws. */
async function sourcesOf(admin: ReturnType<typeof createClient>, month: number, day: number): Promise<string[]> {
  const out = new Set<string>();
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const { data: culture } = await admin.from("cultural_events").select("event_date,source_url").limit(2000);
  for (const row of culture ?? []) {
    const date = String(row.event_date ?? "");
    if (date.slice(5, 7) === mm && date.slice(8, 10) === dd && row.source_url) out.add(String(row.source_url));
  }
  const { data: facts } = await admin.from("birth_facts").select("source_url")
    .eq("birth_month", month).eq("birth_day", day).eq("birth_year", 0).eq("region_key", "").limit(300);
  for (const row of facts ?? []) if (row.source_url) out.add(String(row.source_url));
  // The subject, not the source. A row with no subject names nothing to
  // measure and is left out here rather than recorded as an error, because
  // the panel already says "names no article to measure" for it.
  const { data: events } = await admin.from("historical_events").select("subject_url")
    .eq("event_month", month).eq("event_day", day).not("subject_url", "is", null).limit(300);
  for (const row of events ?? []) if (row.subject_url) out.add(String(row.subject_url));
  return [...out];
}

/** The English article a source points at, or null with the reason. */
async function articleFor(url: string): Promise<{ article: string | null; error: string | null }> {
  const wiki = /^https?:\/\/en\.(?:m\.)?wikipedia\.org\/wiki\/([^#?]+)/.exec(url);
  if (wiki) {
    const article = decodeURIComponent(wiki[1]);
    // The date page itself is not the thing the row is about, and its views
    // would be the same number on every Wikipedia line of the date.
    if (/^(January|February|March|April|May|June|July|August|September|October|November|December)_\d{1,2}$/.test(article)) {
      return { article: null, error: "cites the date page, not an article" };
    }
    return { article, error: null };
  }
  const data = /^https?:\/\/(?:www\.)?wikidata\.org\/(?:wiki|entity)\/(Q\d+)/.exec(url);
  if (data) {
    try {
      const response = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${data[1]}&props=sitelinks&sitefilter=enwiki&format=json`,
        { headers: { "User-Agent": AGENT }, signal: AbortSignal.timeout(FETCH_MS) },
      );
      if (!response.ok) return { article: null, error: `wikidata answered ${response.status}` };
      const body = await response.json();
      const title = body?.entities?.[data[1]]?.sitelinks?.enwiki?.title;
      if (typeof title !== "string") return { article: null, error: "no English article for this entity" };
      return { article: title.replace(/ /g, "_"), error: null };
    } catch {
      return { article: null, error: "wikidata did not answer" };
    }
  }
  return { article: null, error: "not a Wikipedia or Wikidata source" };
}

interface Views { views: number | null; onDate: number | null; onDateLow: number | null; medianDay: number | null; error: string | null }

/**
 * Two years of daily views, read three ways.
 *
 * views: the last twelve months added up, which is reach.
 *
 * onDate, onDateLow and medianDay: the views on this date in the last two
 * years, averaged and at their lower, against the median day. That is the
 * signal this site exists for and nothing else measures: a thing people
 * bring up ON THE DAY. Pizza Rat's article spikes every September 21. A
 * coronation in 1831 does not spike on anything.
 *
 * The lower of the two years is what the points use, decided September 11,
 * 2026 after measuring the real September 11 subjects: a thing people
 * remember spikes every year, and an article Wikipedia's main page featured
 * one anniversary spikes once (the Des Moines speech: 840 views one year,
 * 16,224 the next, median 25). The average could not tell them apart and
 * the lower can. Wikipedia's editors picking a row says what editors
 * value; the spike that comes back says what people do.
 */
async function dailyViews(article: string, month: number, day: number): Promise<Views> {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const start = new Date(Date.UTC(end.getUTCFullYear() - 2, end.getUTCMonth(), end.getUTCDate()));
  const stamp = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const title = encodeURIComponent(article);
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${title}/daily/${stamp(start)}/${stamp(end)}`;
  try {
    const response = await fetch(url, { headers: { "User-Agent": AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(FETCH_MS) });
    if (response.status === 404) return { views: 0, onDate: 0, onDateLow: 0, medianDay: 0, error: null };
    if (!response.ok) return { views: null, onDate: null, onDateLow: null, medianDay: null, error: `pageviews answered ${response.status}` };
    const body = await response.json();
    const items: Array<{ timestamp?: string; views?: number }> = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) return { views: 0, onDate: 0, onDateLow: 0, medianDay: 0, error: null };
    const yearAgo = stamp(new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate())));
    let views = 0;
    const all: number[] = [];
    const onDates: number[] = [];
    const mmdd = `${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
    for (const item of items) {
      const v = Number(item.views) || 0;
      const ts = String(item.timestamp ?? "");
      all.push(v);
      if (ts.slice(0, 8) >= yearAgo) views += v;
      if (ts.slice(4, 8) === mmdd) onDates.push(v);
    }
    all.sort((x, y) => x - y);
    const medianDay = all[Math.floor(all.length / 2)] ?? 0;
    const onDate = onDates.length === 0 ? null : Math.round(onDates.reduce((n, v) => n + v, 0) / onDates.length);
    // An article younger than two years has one anniversary or none. One is
    // not "every year", so the low is null and the points call it unmeasured
    // rather than crediting a single number.
    const onDateLow = onDates.length < 2 ? null : Math.min(...onDates);
    return { views, onDate, onDateLow, medianDay, error: null };
  } catch {
    return { views: null, onDate: null, onDateLow: null, medianDay: null, error: "pageviews did not answer" };
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405, request);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceRoleKey || !anonKey) return json({ error: "function is misconfigured" }, 500, request);

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
  const sources = await sourcesOf(admin, month, day);
  const { data: known } = await admin.from("article_reach").select("source_url,measured_at,article,views_on_date,views_on_date_low,error").in("source_url", sources);
  const fresh = new Set<string>();
  const cutoff = Date.now() - FRESH_DAYS * 24 * 60 * 60 * 1000;
  for (const row of known ?? []) {
    // A row measured before the two year column existed is not fresh, and
    // neither is one the service did not answer for; both are measured again.
    const unmeasurable = row.article === null;
    const complete = unmeasurable || (row.error === null && row.views_on_date !== null && (row.views_on_date_low !== null || row.views_on_date === 0));
    if (complete && Date.parse(String(row.measured_at)) > cutoff) fresh.add(String(row.source_url));
  }
  const waiting = sources.filter((s) => !fresh.has(s));
  const todo = waiting.slice(0, BATCH);
  const remaining = waiting.length - todo.length;

  let measured = 0;
  let unmeasurable = 0;
  const rows: Array<Record<string, unknown>> = [];
  // In series, on purpose. The pageviews API asks for a modest rate and a
  // date has at most a few dozen sources.
  for (const source of todo) {
    const { article, error } = await articleFor(source);
    if (article === null) {
      unmeasurable += 1;
      rows.push({ source_url: source, article: null, views_year: null, error, measured_at: new Date().toISOString() });
      continue;
    }
    const { views, onDate, onDateLow, medianDay, error: viewError } = await dailyViews(article, month, day);
    if (views === null) unmeasurable += 1; else measured += 1;
    rows.push({
      source_url: source, article, views_year: views, views_on_date: onDate, views_on_date_low: onDateLow, views_median_day: medianDay,
      error: viewError, measured_at: new Date().toISOString(),
    });
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }
  if (rows.length > 0) {
    const { error } = await admin.from("article_reach").upsert(rows, { onConflict: "source_url" });
    if (error) return json({ status: "failed", error: error.message }, 200, request);
  }
  return json({ status: "done", sources: sources.length, already: fresh.size, measured, unmeasurable, remaining }, 200, request);
});
