// The song in your head. docs/the-wall.md section 31.
//
// "What song is in your head today?" at the top of today's date page. An
// answer is a real song picked from Apple's search, never typed text, and
// each answer is one free buzz on its song's story on today's hive. This file
// is the pure half: folding a title so one song is one tile, reading what
// Apple's search and chart send, the example rows the empty board shows, the
// songs the sealed picture names, and the one script the page runs. The
// drawing is in wall.ts beside the hive it sits above, and the routes are in
// serve.ts.
//
// Nothing here talks to anything. Every function takes what it needs.

import { createHash } from "node:crypto";

import type { WallBoost } from "./crown.js";
import type { RecapSong } from "./recap.js";

/** A track as the project keeps it, from wall_songs. Apple's words, read by the database from Apple. */
export interface SongInfo {
  trackId: string;
  title: string;
  artist: string;
  album: string | null;
  /** yyyy-mm-dd, Apple's release date for this version, or null. */
  released: string | null;
  explicit: boolean;
  /** Apple's artwork address. Never given to a browser: /cover/<track>.jpg fetches it. */
  artwork: string | null;
}

/** One song a search found, after folding. */
export interface Found {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  /** Apple's release date for this version, an ISO timestamp or "". */
  released: string;
  year: number | null;
  explicit: boolean;
  artwork: string | null;
}

/** One row of Apple's chart. */
export interface ChartSong {
  id: string;
  title: string;
  artist: string;
  artwork: string | null;
  explicit: boolean;
}

/** What the page says after a pick, an undo or a search, in the database's words and two of ours. */
export type SongWord =
  | "kept" | "answered" | "already" | "hidden" | "not_yet" | "closed" | "no_song" | "busy" | "failed" | "bad"
  | "undone" | "too_late";

export const SONG_WORDS: ReadonlySet<string> = new Set<SongWord>([
  "kept", "answered", "already", "hidden", "not_yet", "closed", "no_song", "busy", "failed", "bad", "undone", "too_late",
]);

/** The question, word for word, every day. */
export const SONG_QUESTION = "What song is in your head today?";

/** The most a reader may type into the search. The input says so and the server holds it to the same. */
export const SONG_QUERY_MAX = 80;

/** How many songs a search offers. */
export const SONG_RESULTS = 8;

/** How many example rows an empty board carries. */
export const SONG_EXAMPLES = 3;

/** How many chart rows the strip beside the board carries. */
export const CHART_SHOWN = 5;

/**
 * One song however it is spelled: Apple's artist number and the title
 * folded. Lower case, anything in brackets dropped, a " - Remastered 2011"
 * tail dropped, spaces and punctuation dropped; a title that folds to
 * nothing keeps its lower case self.
 *
 * The database's copy is wall_song_key in
 * 20261003000000_the_song_in_your_head.sql, and it is the one that decides
 * which tile an answer joins. This one only folds a search's rows so the
 * reader is offered one row per song; web/test/song-prompt.test.ts holds the
 * two to the answers the live project printed on October 3, 2026, including
 * curly quotes, accents and Korean, where POSIX punctuation and Unicode
 * punctuation could have disagreed and did not.
 */
export function songKey(artistId: string | number, title: string): string {
  const lower = title.toLowerCase();
  const folded = lower
    .replace(/[(\[][^)\]]*[)\]]/g, "")
    .replace(/\s+-\s.*$/s, "")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
  return `${artistId}:${folded === "" ? lower : folded}`;
}

/** Apple's image host, and nothing else, is ever fetched for a cover. */
export function isAppleArt(url: unknown): url is string {
  return typeof url === "string" && /^https:\/\/is\d+-ssl\.mzstatic\.com\/image\/thumb\//.test(url);
}

/** Apple's artwork address at another size: ".../100x100bb.jpg" becomes ".../300x300bb.jpg". Null for anything not Apple's. */
export function artAt(url: string | null | undefined, size: number = 300): string | null {
  if (!isAppleArt(url)) return null;
  const sized = url.replace(/\/\d+x\d+[a-z]*\.(?:jpg|jpeg|png|webp)$/i, `/${size}x${size}bb.jpg`);
  return sized === url && !/\/\d+x\d+bb\.jpg$/.test(url) ? null : sized;
}

/** The address a cover is served from on this site. Digits only, or null. */
export function coverPath(trackId: string): string | null {
  return /^\d{1,15}$/.test(trackId) ? `/cover/${trackId}.jpg` : null;
}

function text(value: unknown, max: number = 300): string | null {
  if (typeof value !== "string") return null;
  // Control characters out, the way the database's lookup takes them out.
  // eslint-disable-next-line no-control-regex
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return clean === "" || clean.length > max ? null : clean;
}

function digits(value: unknown): string | null {
  const s = typeof value === "number" ? String(Math.trunc(value)) : typeof value === "string" ? value : "";
  return /^\d{1,18}$/.test(s) ? s : null;
}

function yearOfIso(value: string): number | null {
  const m = /^(\d{4})-/.exec(value);
  return m === null ? null : Number(m[1]);
}

/**
 * Apple's search answer as songs, in Apple's order, and nothing that is not
 * a song: an album, a music video or a podcast that shares a word with the
 * query is not something a person can have in their head as a tile.
 */
export function parseSearch(json: unknown): Found[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const out: Found[] = [];
  for (const raw of results) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (r.wrapperType !== "track" || r.kind !== "song") continue;
    const id = digits(r.trackId);
    const artistId = digits(r.artistId);
    const title = text(r.trackName);
    const artist = text(r.artistName);
    if (id === null || artistId === null || title === null || artist === null) continue;
    const released = typeof r.releaseDate === "string" ? r.releaseDate : "";
    out.push({
      id, title, artist, artistId, released, year: yearOfIso(released),
      explicit: r.trackExplicitness === "explicit",
      artwork: isAppleArt(r.artworkUrl100) ? r.artworkUrl100 : null,
    });
  }
  return out;
}

/**
 * One row per song, in the order Apple ranked the songs, each the oldest
 * release of that song Apple returned. The oldest, so the year a reader sees
 * and the tile carries is the song's rather than a compilation's wherever
 * Apple has the original, and so two readers who pick "Espresso" from two
 * different searches usually pick the same track. The database joins them
 * on the folded key whichever they pick.
 */
export function collapse(found: Found[], limit: number = SONG_RESULTS): Found[] {
  const order: string[] = [];
  const best = new Map<string, Found>();
  for (const f of found) {
    const key = songKey(f.artistId, f.title);
    const held = best.get(key);
    if (held === undefined) {
      order.push(key);
      best.set(key, f);
      continue;
    }
    const older = f.released !== "" && (held.released === "" || f.released < held.released);
    const sameDayLowerId = f.released === held.released && BigInt(f.id) < BigInt(held.id);
    if (older || sameDayLowerId) best.set(key, f);
  }
  return order.slice(0, limit).map((k) => best.get(k)!);
}

/**
 * Apple's chart feed as rows. Apple marks an explicit row with
 * "contentAdvisoryRating", spelled "Explict" in the feed itself.
 */
export function parseChart(json: unknown, limit: number = CHART_SHOWN): ChartSong[] {
  const results = (json as { feed?: { results?: unknown } } | null)?.feed?.results;
  if (!Array.isArray(results)) return [];
  const out: ChartSong[] = [];
  for (const raw of results) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const id = digits(r.id);
    const title = text(r.name);
    const artist = text(r.artistName);
    if (id === null || title === null || artist === null) continue;
    out.push({ id, title, artist, artwork: isAppleArt(r.artworkUrl100) ? r.artworkUrl100 : null, explicit: typeof r.contentAdvisoryRating === "string" && r.contentAdvisoryRating !== "" });
    if (out.length >= limit) break;
  }
  return out;
}

/** wall_songs rows as the page reads them. Anything malformed is dropped. */
export function songsFrom(rows: unknown): Map<string, SongInfo> {
  const out = new Map<string, SongInfo>();
  if (!Array.isArray(rows)) return out;
  for (const raw of rows) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const trackId = digits(r.track_id);
    const title = text(r.title);
    const artist = text(r.artist);
    if (trackId === null || title === null || artist === null) continue;
    out.set(trackId, {
      trackId, title, artist,
      album: text(r.album),
      released: typeof r.released === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.released) ? r.released : null,
      explicit: r.explicit === true,
      artwork: isAppleArt(r.artwork_url) ? r.artwork_url : null,
    });
  }
  return out;
}

/** "2024", "Espresso" and "Sabrina Carpenter" out of an answer's headline, for a song whose row could not be read. */
export function answerParts(headline: string): { year: number | null; title: string; artist: string } | null {
  const m = /^(?:(\d{4}): )?"(.+)" by (.+)$/s.exec(headline);
  if (m === null) return null;
  return { year: m[1] === undefined ? null : Number(m[1]), title: m[2]!, artist: m[3]! };
}

/** How many heads each song is in: its answer rows. */
export function headsBy(boosts: readonly WallBoost[] | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of boosts ?? []) {
    if (b.answer !== true) continue;
    out.set(b.storyId, (out.get(b.storyId) ?? 0) + 1);
  }
  return out;
}

/** The parts of a story the board reads. A type, so this file never imports wall.ts. */
export interface StoryLike {
  id: string;
  headline: string;
  support: number;
  submittedAt: string;
  status: string;
  subjectKind: string | null;
  subjectId: string | null;
}

export interface Answered<S extends StoryLike = StoryLike> {
  story: S;
  title: string;
  artist: string;
  year: number | null;
  explicit: boolean;
  /** The track whose cover is drawn, or null. */
  trackId: string | null;
  heads: number;
}

/**
 * The day's songs, most buzzed first, then most heads, then the first
 * answered. A song every answer was taken back from, with no buzz either, is
 * not on the board: it is in nobody's head. Hidden songs never reach here,
 * because the read policy keeps them from every reader.
 */
export function boardSongs<S extends StoryLike>(stories: readonly S[], boosts: readonly WallBoost[] | undefined, songs: ReadonlyMap<string, SongInfo>): Array<Answered<S>> {
  const heads = headsBy(boosts);
  const out: Array<Answered<S>> = [];
  for (const story of stories) {
    if (story.subjectKind !== "answer" || story.status === "false") continue;
    const n = heads.get(story.id) ?? 0;
    if (n === 0 && story.support === 0) continue;
    const song = story.subjectId === null ? undefined : songs.get(story.subjectId);
    const parsed = answerParts(story.headline);
    const title = song?.title ?? parsed?.title ?? story.headline;
    const artist = song?.artist ?? parsed?.artist ?? "";
    const year = parsed?.year ?? (song?.released ? Number(song.released.slice(0, 4)) : null);
    out.push({ story, title, artist, year, explicit: song?.explicit ?? false, trackId: story.subjectId !== null && /^\d+$/.test(story.subjectId) ? story.subjectId : null, heads: n });
  }
  return out.sort((a, b) => b.story.support - a.story.support || b.heads - a.heads || a.story.submittedAt.localeCompare(b.story.submittedAt) || a.story.id.localeCompare(b.story.id));
}

/**
 * The example rows an empty board carries, from the date's own number one
 * songs: the hive files one story a year for them, headline
 * '1985: "Song" by Artist was the number one song'. Spread across the years
 * rather than the newest three, so the examples read as a range of answers:
 * the newest, one from the middle and the oldest. Never a story's buzz
 * button, never anybody's name, and gone the moment the board has a real
 * answer, because the board draws them only while it has none.
 */
export function exampleSongs(stories: readonly StoryLike[], limit: number = SONG_EXAMPLES): Array<{ year: number; title: string; artist: string }> {
  const rows: Array<{ year: number; title: string; artist: string }> = [];
  for (const s of stories) {
    if (s.subjectKind !== "song") continue;
    const m = /^(\d{4}): "(.+)" by (.+) was the number one song$/s.exec(s.headline);
    if (m === null) continue;
    rows.push({ year: Number(m[1]), title: m[2]!, artist: m[3]! });
  }
  const byYear = [...new Map(rows.map((r) => [r.year, r])).values()].sort((a, b) => b.year - a.year);
  if (byYear.length <= limit) return byYear;
  const picks = new Set<number>();
  for (let i = 0; i < limit; i += 1) picks.add(Math.round((i * (byYear.length - 1)) / Math.max(1, limit - 1)));
  return [...picks].sort((a, b) => a - b).map((i) => byYear[i]!);
}

/** The songs the sealed picture names, ranked by heads. Only songs somebody named. */
export function recapSongs(stories: readonly StoryLike[], boosts: readonly WallBoost[] | undefined, songs: ReadonlyMap<string, SongInfo>): RecapSong[] {
  return boardSongs(stories, boosts, songs)
    .filter((s) => s.heads > 0)
    .sort((a, b) => b.heads - a.heads || b.story.support - a.story.support || a.story.submittedAt.localeCompare(b.story.submittedAt))
    .map((s) => ({ title: s.title, artist: s.artist, count: s.heads }));
}

/** What the page says after a word. The site's own words; no song title is ever put in one. */
export const SONG_SENTENCES: Record<SongWord, string> = {
  kept: "Your song is on today's board. It counts as one buzz for it on today's hive, free.",
  answered: "You already answered today. One song a day. Yours is marked on the board.",
  already: "You already buzzed that song today, so it cannot be your answer too. Pick a different song.",
  hidden: "That song cannot go on today's board. Pick a different one.",
  not_yet: "Today's question is not open yet. It opens at midnight Eastern.",
  closed: "That came in after midnight Eastern, when the question for that day closed.",
  no_song: "Apple does not list that as a song. Try another search.",
  busy: "The song search is busy for a moment. Try again in a few seconds.",
  failed: "That did not save, and it was this end rather than yours. Try again.",
  bad: "That did not save, and it was this end rather than yours. Try again.",
  undone: "Taken back. You can pick a different song.",
  too_late: "That one stands. An answer can be taken back for thirty seconds after it is picked.",
};

/**
 * Search as you type, the one script today's date page runs. Named by its
 * hash in the header, the way the share script is, so the page can run this
 * script and no other even if an escape were ever missed.
 *
 * It searches through POST /song/search on this origin, the phrase in the
 * body and never in an address, and draws the songs it gets back as plain
 * forms with DOM calls and textContent, never as markup built from what came
 * back. Picking a song is the form posting, with or without this script.
 * Without it the search box posts and the server draws the matches.
 */
export const SONG_SCRIPT = `(function(){
var form=document.getElementById("sgask");if(!form)return;
var input=document.getElementById("sgq"),out=document.getElementById("sgresults");
var m=form.querySelector("input[name=m]").value,d=form.querySelector("input[name=d]").value;
var timer=null,seq=0,last="";
function clear(){while(out.firstChild)out.removeChild(out.firstChild);}
function say(t){clear();var p=document.createElement("p");p.className="sgnote";p.textContent=t;out.appendChild(p);}
function el(tag,cls,t){var e=document.createElement(tag);if(cls)e.className=cls;if(t!=null)e.textContent=t;return e;}
function draw(list){clear();
if(!list.length){say("Nothing found yet. Try the title and the artist.");return;}
var ol=el("ol","sgpicks");
list.forEach(function(s){var li=el("li"),f=el("form","sgpick");f.method="post";f.action="/song";
[["t",s.id],["m",m],["d",d]].forEach(function(p){var i=document.createElement("input");i.type="hidden";i.name=p[0];i.value=p[1];f.appendChild(i);});
var b=el("button");b.type="submit";var art=el("span","sgart"),img=document.createElement("img");
img.src="/cover/"+s.id+".jpg";img.alt="";img.width=48;img.height=48;img.loading="lazy";art.appendChild(img);
var tx=el("span","sgtext"),a=el("span","sga",s.artist+(s.year?" \\u00b7 "+s.year:""));
tx.appendChild(el("span","sgt",s.title));
if(s.explicit){a.appendChild(document.createTextNode(" "));var e=el("span","sge","E");e.title="Explicit";a.appendChild(e);}
tx.appendChild(a);b.appendChild(art);b.appendChild(tx);b.appendChild(el("span","sggo","This one"));
f.appendChild(b);li.appendChild(f);ol.appendChild(li);});
out.appendChild(ol);}
function search(q){var mine=++seq;say("Searching\\u2026");
fetch("/song/search",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},body:"q="+encodeURIComponent(q)+"&m="+m+"&d="+d})
.then(function(r){return r.ok?r.json():null;})
.then(function(j){if(mine!==seq)return;if(!j){say("The search did not answer. Try again.");return;}
if(j.busy){say("The song search is busy for a moment. Try again in a few seconds.");return;}draw(j.results||[]);})
.catch(function(){if(mine===seq)say("The search did not answer. Try again.");});}
input.addEventListener("input",function(){var q=input.value.trim();clearTimeout(timer);
if(q.length<2){seq++;last="";clear();return;}if(q===last)return;
timer=setTimeout(function(){last=q;search(q);},300);});
form.addEventListener("submit",function(ev){ev.preventDefault();var q=input.value.trim();if(q.length<2)return;clearTimeout(timer);last=q;search(q);});
})();`;

/** The value for script-src: this script and no other. */
export const SONG_SCRIPT_SOURCE = `'sha256-${createHash("sha256").update(SONG_SCRIPT).digest("base64")}'`;
