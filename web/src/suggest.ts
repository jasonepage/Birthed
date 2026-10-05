// Suggestions on the page, docs/the-wall.md section 32, built October 5, 2026.
//
// The board never filled because adding to it took the app. This is the box
// on today's date page that lets anybody put something on today's hive: type
// a few letters, pick a real thing that has an English Wikipedia article (a
// person, an event, a storm, a prize), and it becomes a tile. Never typed
// text, because a sealed hive is kept forever: the database reads the article
// from Wikipedia itself (wall_topic_lookup), the way it reads a song from
// Apple, so nothing posted here can put words on a tile.
//
// Before anything new is offered, the box looks at what is already filed for
// the date, with the find field's own matcher (find.ts). One thing is one
// tile: if what the reader means is already on today's hive in any shape,
// the page points at it and says buzz it instead. The database makes the same
// check again and refuses a second tile for the same thing however the post
// is edited.
//
// This file holds the pure parts, which the tests read, and the one network
// call the server makes to Wikipedia's search. Nothing here costs anything at
// import, and nothing here stores what anybody typed.

import { createHash } from "node:crypto";
import { answer as findAnswer } from "./find.js";
import type { WallStory } from "./wall.js";

/** The longest phrase the box takes. The input says so and the server holds it to the same. */
export const SUGGEST_QUERY_MAX = 80;
/** How many articles a search offers. Six is a phone's screen of rows. */
export const SUGGEST_RESULTS = 6;
/** The question over the box. */
export const SUGGEST_QUESTION = "What else mattered today?";

/** One English Wikipedia article a search found, in Wikipedia's words. */
export interface Topic {
  /** Wikipedia's own number for the article, which is what a pick posts. */
  pageId: number;
  title: string;
  /** Wikipedia's short description, or null where it has none. */
  description: string | null;
  /** The Wikidata item, "Q26876", or null. How a person already on the date is recognised. */
  item: string | null;
}

/**
 * What happened to a suggestion, in the database's words, plus three that
 * are ours: failed, for never reaching it, and the undo's two.
 */
export type SuggestWord =
  | "kept" | "exists" | "suggested" | "hidden" | "not_yet" | "closed" | "no_topic" | "busy" | "crowded" | "full" | "bad_token" | "failed"
  | "undone" | "too_late";

export const SUGGEST_WORDS: ReadonlySet<string> = new Set([
  "kept", "exists", "suggested", "hidden", "not_yet", "closed", "no_topic", "busy", "crowded", "full", "bad_token", "failed", "undone", "too_late",
]);

/**
 * A suggestion taken back inside its thirty seconds: still filed, with
 * nobody behind it, drawn nowhere. It is not a tile to point anybody at,
 * and the next browser to suggest the same thing takes it up.
 */
function takenBack(s: Pick<WallStory, "subjectKind" | "support">): boolean {
  return s.subjectKind === "suggestion" && s.support < 1;
}

/** Control characters out and the ends trimmed, the way the database does it. */
function clean(text: unknown, limit: number): string | null {
  if (typeof text !== "string") return null;
  const said = text.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return said === "" ? null : said.slice(0, limit);
}

/**
 * The articles in an answer from Wikipedia's prefix search, in Wikipedia's
 * own order, without the ones that cannot be a tile: a disambiguation page,
 * which is several things, a list, which is many, and anything outside the
 * article space. The same rules wall_topic_lookup applies, so the box never
 * offers what the database would refuse.
 */
export function parseTopics(json: unknown, limit: number = SUGGEST_RESULTS): Topic[] {
  const pages = (json as { query?: { pages?: unknown } } | null)?.query?.pages;
  if (!Array.isArray(pages)) return [];
  const out: Array<Topic & { index: number }> = [];
  for (const raw of pages) {
    const p = raw as { pageid?: unknown; ns?: unknown; title?: unknown; index?: unknown; description?: unknown; pageprops?: Record<string, unknown>; missing?: unknown };
    if (p.missing === true || p.ns !== 0) continue;
    if (typeof p.pageid !== "number" || !Number.isInteger(p.pageid) || p.pageid < 1) continue;
    if (p.pageprops !== undefined && "disambiguation" in p.pageprops) continue;
    const title = clean(p.title, 300);
    if (title === null || /^list of /i.test(title)) continue;
    const item = typeof p.pageprops?.wikibase_item === "string" && /^Q\d{1,12}$/.test(p.pageprops.wikibase_item) ? p.pageprops.wikibase_item : null;
    out.push({ pageId: p.pageid, title, description: clean(p.description, 300), item, index: typeof p.index === "number" ? p.index : 999 });
  }
  return out
    .sort((a, b) => a.index - b.index || a.pageId - b.pageId)
    .slice(0, limit)
    .map(({ index: _index, ...topic }) => topic);
}

/** The article's own address, the one the database stores for it. */
export function topicUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURI(title.replace(/ /g, "_"))}`;
}

/** The address an article lives at, as one string to compare, whatever escaping it was written with. */
function sameAddress(a: string, b: string): boolean {
  const fold = (u: string): string => {
    try {
      return decodeURI(u).replace(/\/+$/, "").toLowerCase();
    } catch {
      return u.toLowerCase();
    }
  };
  return fold(a) === fold(b);
}

/**
 * The story already on the date that stands for an article, or null: a
 * person born on the date, something already suggested, or any story whose
 * own address is the article. The database checks the same and one more,
 * an event whose line is about the article, which the page cannot see.
 */
export function tileFor(topic: Topic, stories: readonly WallStory[]): WallStory | null {
  const address = topicUrl(topic.title);
  const tiles = stories.filter((s) => !takenBack(s));
  for (const s of tiles) {
    if (topic.item !== null && (s.subjectKind === "person" || s.subjectKind === "suggestion") && s.subjectId === topic.item) return s;
  }
  for (const s of tiles) {
    if (sameAddress(s.url, address)) return s;
  }
  return null;
}

/**
 * What the box finds already on the date for a phrase, best first: the find
 * field's matcher over every story filed for it, so the reader is pointed at
 * a tile that is there before they are offered a new one.
 */
export function hereFor(q: string, stories: WallStory[]): WallStory[] {
  const found = findAnswer(q, stories.filter((s) => !takenBack(s)));
  if (found.kind === "one") return [found.match.story];
  if (found.kind === "several") return found.matches.map((m) => m.story);
  return [];
}

/**
 * The name a suggestion goes by on a crown or a picture: the article's
 * title, read back off its own address, because the headline adds
 * Wikipedia's description after it and a title can itself carry a colon.
 */
export function suggestionName(story: Pick<WallStory, "url" | "headline">): string {
  const m = /^https:\/\/en\.wikipedia\.org\/wiki\/(.+)$/.exec(story.url);
  if (m !== null) {
    try {
      const title = decodeURIComponent(m[1]!).replace(/_/g, " ").trim();
      if (title !== "") return title;
    } catch {
      // The headline below, then.
    }
  }
  return story.headline;
}

/**
 * What readers suggested for a sealed day, for its picture: every suggestion
 * somebody still stands behind, most buzzed first, by its article's title.
 */
export function recapSuggestions(stories: readonly Pick<WallStory, "subjectKind" | "support" | "status" | "url" | "headline" | "submittedAt">[]): Array<{ name: string; count: number }> {
  return stories
    .filter((s) => s.subjectKind === "suggestion" && s.support > 0 && s.status !== "false")
    .sort((a, b) => b.support - a.support || a.submittedAt.localeCompare(b.submittedAt))
    .map((s) => ({ name: suggestionName(s), count: s.support }));
}

// ---------------------------------------------------------------------------
// Asking Wikipedia
// ---------------------------------------------------------------------------

/** Wikipedia is asked at most this often a minute by this server; a search past it waits a moment and says so. */
const SEARCH_PER_MINUTE = 30;
/** How long a phrase's answer is kept, so typing the same thing twice asks once. */
const SEARCH_TTL_MS = 10 * 60_000;
const WIKIPEDIA_TIMEOUT_MS = 3000;
const USER_AGENT = "Birthed/0.1 (https://birthed.app)";

const searches = new Map<string, { at: number; results: Topic[] }>();
const found = new Map<number, Topic>();
const calls: number[] = [];

function keep<K, V>(map: Map<K, V>, key: K, value: V, limit: number): void {
  map.delete(key);
  map.set(key, value);
  while (map.size > limit) map.delete(map.keys().next().value as K);
}

/** For tests: forget every search and every article. */
export function forgetWikipedia(): void {
  searches.clear();
  found.clear();
  calls.length = 0;
}

/** For tests: how many phrases are held in memory. */
export function searchesHeld(): number {
  return searches.size;
}

/** Whether this server may ask Wikipedia again this minute. Counts the call when it may. */
export function mayAskWikipedia(now: number = Date.now()): boolean {
  while (calls.length > 0 && now - calls[0]! > 60_000) calls.shift();
  if (calls.length >= SEARCH_PER_MINUTE) return false;
  calls.push(now);
  return true;
}

/** A phrase as the cache knows it: trimmed, folded to lower case, one space between words. */
export function topicKey(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The address of a prefix search for a phrase. */
export function searchAddress(q: string): string {
  const query = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", generator: "prefixsearch", gpsnamespace: "0", gpslimit: "10",
    gpssearch: q, prop: "pageprops|description", ppprop: "wikibase_item|disambiguation", redirects: "1",
  });
  return `https://en.wikipedia.org/w/api.php?${query}`;
}

/**
 * The articles for a phrase, or "busy" when Wikipedia could not be asked or
 * did not answer. A phrase under two characters or over the box's limit is
 * no articles.
 */
export async function searchTopics(q: string, now: number = Date.now()): Promise<Topic[] | "busy"> {
  // The phrase is the cache's key, so an answer past its ten minutes is
  // dropped here rather than left until five hundred newer ones push it
  // out: the privacy page says it is gone after ten minutes, and it is.
  for (const [held, entry] of searches) if (now - entry.at >= SEARCH_TTL_MS) searches.delete(held);
  const key = topicKey(q);
  if (key.length < 2 || key.length > SUGGEST_QUERY_MAX) return [];
  const held = searches.get(key);
  if (held !== undefined && now - held.at < SEARCH_TTL_MS) return held.results;
  if (!mayAskWikipedia(now)) return "busy";
  let results: Topic[];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WIKIPEDIA_TIMEOUT_MS);
  try {
    const response = await fetch(searchAddress(key), { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) return "busy";
    results = parseTopics(await response.json());
  } catch {
    return "busy";
  } finally {
    clearTimeout(timer);
  }
  keep(searches, key, { at: now, results }, 500);
  for (const t of results) keep(found, t.pageId, t, 2000);
  return results;
}

/** Articles a search found, by number, in the order asked; any this process has forgotten are left out. */
export function topicsById(ids: readonly number[]): Topic[] {
  return ids.flatMap((id) => {
    const t = found.get(id);
    return t === undefined ? [] : [t];
  });
}

// ---------------------------------------------------------------------------
// Search as you type
// ---------------------------------------------------------------------------

/**
 * The box's script, the second on today's date page, named by its hash in
 * the page's policy. Everything works without it: the form posts, the server
 * answers with the same rows drawn into the page. With it, the rows appear as
 * the reader types. Every element is made with DOM calls and every word goes
 * in as text, so nothing Wikipedia or a headline says can become markup.
 */
export const SUGGEST_SCRIPT = `(function(){
var form=document.getElementById("tgask");if(!form)return;
var input=document.getElementById("tgq"),out=document.getElementById("tgresults");
var m=form.querySelector("input[name=m]").value,d=form.querySelector("input[name=d]").value;
var timer=null,seq=0,last="";
function clear(){while(out.firstChild)out.removeChild(out.firstChild);}
function el(tag,cls,t){var e=document.createElement(tag);if(cls)e.className=cls;if(t!=null)e.textContent=t;return e;}
function say(t){clear();out.appendChild(el("p","tgnote",t));}
function post(action,fields,label,cls){var f=el("form","tgpick");f.method="post";f.action=action;
fields.forEach(function(p){var i=document.createElement("input");i.type="hidden";i.name=p[0];i.value=p[1];f.appendChild(i);});
var b=el("button",cls,label);b.type="submit";f.appendChild(b);return f;}
function row(text,sub,control){var li=el("li","tgfound"),tx=el("span","tgtext");tx.appendChild(el("span","tgt",text));
if(sub)tx.appendChild(el("span","tga",sub));li.appendChild(tx);li.appendChild(control);return li;}
function draw(j){clear();var here=j.here||[],res=j.results||[];
if(here.length){out.appendChild(el("p","tglabel","Already on today's hive. Buzz it instead"));var ul=el("ol","tgpicks");
here.forEach(function(s){ul.appendChild(row(s.headline,s.outlet,post("/boost",[["s",s.id],["m",m],["d",d],["v","suggest"]],"Buzz it","wbuzz")));});out.appendChild(ul);}
if(res.length){out.appendChild(el("p","tglabel",here.length?"Or something new, from Wikipedia":"From Wikipedia"));var ol=el("ol","tgpicks");
res.forEach(function(t){ol.appendChild(row(t.title,t.description||"",t.tile?post("/boost",[["s",t.tile],["m",m],["d",d],["v","suggest"]],"Already here. Buzz it","wbuzz"):post("/suggest",[["p",t.pageId],["m",m],["d",d]],"Suggest this","tggo")));});out.appendChild(ol);}
if(!here.length&&!res.length)say("Nothing found yet. Try a name, a place or what happened.");}
function search(q){var mine=++seq;say("Searching\\u2026");
fetch("/suggest/search",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},body:"q="+encodeURIComponent(q)+"&m="+m+"&d="+d})
.then(function(r){return r.ok?r.json():null;})
.then(function(j){if(mine!==seq)return;if(!j){say("The search did not answer. Try again.");return;}
if(j.busy&&!(j.here||[]).length){say("The search is busy for a moment. Try again in a few seconds.");return;}draw(j);})
.catch(function(){if(mine===seq)say("The search did not answer. Try again.");});}
input.addEventListener("input",function(){var q=input.value.trim();clearTimeout(timer);
if(q.length<2){seq++;last="";clear();return;}if(q===last)return;
timer=setTimeout(function(){last=q;search(q);},300);});
form.addEventListener("submit",function(ev){ev.preventDefault();var q=input.value.trim();if(q.length<2)return;clearTimeout(timer);last=q;search(q);});
})();`;

/** The value for script-src: this script and no other. */
export const SUGGEST_SCRIPT_SOURCE = `'sha256-${createHash("sha256").update(SUGGEST_SCRIPT).digest("base64")}'`;
