// The song in your head. docs/the-wall.md section 31.
//
// "What song is in your head today?" sat at the top of today's date page
// from October 3 to October 18, 2026, when it came off with the rest of the
// strip, docs/strip-to-the-hive.md. The answers people gave are tiles on
// sealed hives, so what is left here is what reading and drawing them needs:
// the song a tile names, its cover's address, how many heads named it, and
// the songs the sealed picture lists. The search, the chart, the examples
// and the script went with the prompt.
//
// Nothing here talks to anything. Every function takes what it needs.

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

/** The songs the sealed picture names, ranked by heads. Only songs somebody named. */
export function recapSongs(stories: readonly StoryLike[], boosts: readonly WallBoost[] | undefined, songs: ReadonlyMap<string, SongInfo>): RecapSong[] {
  return boardSongs(stories, boosts, songs)
    .filter((s) => s.heads > 0)
    .sort((a, b) => b.heads - a.heads || b.story.support - a.story.support || a.story.submittedAt.localeCompare(b.story.submittedAt))
    .map((s) => ({ title: s.title, artist: s.artist, count: s.heads }));
}
