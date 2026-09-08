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
  const { data: events } = await admin.from("historical_events").select("source_url")
    .eq("event_month", month).eq("event_day", day).limit(300);
  for (const row of events ?? []) if (row.source_url) out.add(String(row.source_url));
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

interface Views { views: number | null; onDate: number | null; medianDay: number | null; error: string | null }

/**
 * Two years of daily views, read three ways.
 *
 * views: the last twelve months added up, which is reach.
 *
 * onDate and medianDay: the views on this date in the last two years,
 * averaged, against the median day. That ratio is the signal this site
 * exists for and nothing else measures: a thing people bring up ON THE DAY.
 * Pizza Rat's article spikes every September 21. A coronation in 1831 does
 * not spike on anything. Wikipedia's editors picking a row for the day says
 * what editors value; the spike says what people do.
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
    if (response.status === 404) return { views: 0, onDate: 0, medianDay: 0, error: null };
    if (!response.ok) return { views: null, onDate: null, medianDay: null, error: `pageviews answered ${response.status}` };
    const body = await response.json();
    const items: Array<{ timestamp?: string; views?: number }> = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) return { views: 0, onDate: 0, medianDay: 0, error: null };
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
    return { views, onDate, medianDay, error: null };
  } catch {
    return { views: null, onDate: null, medianDay: null, error: "pageviews did not answer" };
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
  const { data: known } = await admin.from("article_reach").select("source_url,measured_at,article,views_on_date").in("source_url", sources);
  const fresh = new Set<string>();
  const cutoff = Date.now() - FRESH_DAYS * 24 * 60 * 60 * 1000;
  for (const row of known ?? []) {
    // A row measured before the anniversary columns existed is not fresh.
    const complete = row.article === null || row.views_on_date !== null;
    if (complete && Date.parse(String(row.measured_at)) > cutoff) fresh.add(String(row.source_url));
  }
  const todo = sources.filter((s) => !fresh.has(s));

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
    const { views, onDate, medianDay, error: viewError } = await dailyViews(article, month, day);
    if (views === null) unmeasurable += 1; else measured += 1;
    rows.push({
      source_url: source, article, views_year: views, views_on_date: onDate, views_median_day: medianDay,
      error: viewError, measured_at: new Date().toISOString(),
    });
  }
  if (rows.length > 0) {
    const { error } = await admin.from("article_reach").upsert(rows, { onConflict: "source_url" });
    if (error) return json({ status: "failed", error: error.message }, 200, request);
  }
  return json({ status: "done", sources: sources.length, already: fresh.size, measured, unmeasurable }, 200, request);
});
