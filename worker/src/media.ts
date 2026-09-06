// Matching a chart title to a recording in Apple's catalogue.
//
// The matching is the whole job. Playing audio is trivial; playing the *right*
// audio is not, and this product's entire promise is that it does not lie to
// you. Playing a karaoke "Dilemma" and calling it the number one the week
// somebody was born is a lie with a soundtrack on it.
//
// The rule below was written twice. The first version required the track name
// to equal the chart title, and one live search killed it: searching Dilemma
// returns "Dilemma (feat. Kelly Rowland)" on Nellyville, which is the actual
// number one single, and "Dilemma" on Simply Deep, which is Kelly Rowland's
// own album. Requiring equality rejected the right one and took the other. So
// a featuring credit is stripped before comparing, and nothing else is.

/** Anything in brackets that is a featuring credit and not a different take. */
const FEATURING = /[([]\s*(?:feat\.?|ft\.?|featuring|with)\b[^)\]]*[)\]]\s*$/i;

/**
 * Brackets that mean this is a different recording from the one that charted.
 * These must survive normalisation and disqualify the row.
 */
const OTHER_VERSION = /[([][^)\]]*\b(live|remix|mix|version|edit|karaoke|instrumental|acoustic|re-?record|cover|demo|reprise|remaster|radio|single edit|extended)\b[^)\]]*[)\]]/i;

/** Albums that exist to imitate a recording rather than to be one. */
const NOT_THE_RECORD = /\b(karaoke|tribute|made famous by|in the style of|as made popular|cover version|performed by the)\b/i;

export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(FEATURING, "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The artist a chart credit is really about.
 *
 * Split on featuring and nothing else. "&" and "and" are not separators here:
 * Hall & Oates and Simon & Garfunkel are one act each, and cutting at the
 * ampersand would look them up as Hall and as Simon.
 */
export function primaryArtist(credit: string): string {
  return credit.split(/\s+(?:feat\.?|ft\.?|featuring|with)\s+/i)[0] ?? credit;
}

export interface StoreResult {
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  releaseDate?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  collectionViewUrl?: string;
  artworkUrl100?: string;
}

export interface Match {
  previewUrl: string | null;
  artworkUrl: string | null;
  storeUrl: string | null;
}

/** Apple returns 100 by 100 and the size is a path segment, not a parameter. */
export function bigArtwork(url: string | undefined, size = 600): string | null {
  if (!url) return null;
  return url.replace(/\/\d+x\d+([a-z-]*)\.(jpg|png)$/i, `/${size}x${size}$1.$2`);
}

/**
 * The one result that is the recording that charted, or nothing.
 *
 * `wantTrack` false matches an album, where Apple fills collectionName instead
 * of trackName and there is no preview to be had.
 *
 * Refusing is a normal outcome and not a failure. Apple's catalogue thins out
 * in the early years and some recordings are restricted by country, so a row
 * with no play button is expected and correct. Absent beats wrong.
 */
export function pickMatch(
  results: StoreResult[],
  title: string,
  credit: string,
  chartYear: number,
  wantTrack = true,
): Match | null {
  const wantedTitle = normalise(title);
  const wantedArtist = normalise(primaryArtist(credit));

  const survivors = results.filter((row) => {
    const name = wantTrack ? row.trackName : row.collectionName;
    if (!name) return false;
    // A bracket that is not a featuring credit means a different take.
    if (OTHER_VERSION.test(name)) return false;
    if (row.collectionName && NOT_THE_RECORD.test(row.collectionName)) return false;
    if (normalise(name) !== wantedTitle) return false;
    if (wantedArtist === "") return true;
    const artist = normalise(row.artistName ?? "");
    // Equal, or the chart credit is the fuller form of the same act.
    return artist === wantedArtist
      || artist.startsWith(`${wantedArtist} `)
      || wantedArtist.startsWith(`${artist} `);
  });

  if (survivors.length === 0) return null;

  // The original rather than a reissue, a remaster's parent album or a
  // greatest hits. The first draft refused whenever two survived, which threw
  // away the Dilemma case where both were correct.
  const best = survivors.slice().sort((a, b) => {
    const ya = a.releaseDate ? new Date(a.releaseDate).getUTCFullYear() : 9999;
    const yb = b.releaseDate ? new Date(b.releaseDate).getUTCFullYear() : 9999;
    return Math.abs(ya - chartYear) - Math.abs(yb - chartYear);
  })[0];
  if (!best) return null;

  return {
    previewUrl: wantTrack ? best.previewUrl ?? null : null,
    artworkUrl: bigArtwork(best.artworkUrl100),
    storeUrl: (wantTrack ? best.trackViewUrl : best.collectionViewUrl) ?? null,
  };
}
