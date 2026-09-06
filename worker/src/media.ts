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

/**
 * Brackets that mean this is a different performance from the one that
 * charted. These disqualify a row outright.
 *
 * Deliberately short, and it got shorter after the first real run. It used to
 * hold "version", "edit", "radio", "mix", "remaster" and "extended", and that
 * threw out "Is It Over Now? (Taylor's Version) [From The Vault]", which is
 * not a variant of the 2023 number one, it *is* the 2023 number one. A
 * remaster or a radio edit is the same performance at a different length or
 * loudness, and for a thirty second preview that is the right recording. A
 * live take, a karaoke backing or a cover is a different performance by
 * definition, and those are what this list is for.
 */
const DIFFERENT_PERFORMANCE = /\b(live|karaoke|instrumental|acoustic|demo|cover|remix|reprise|tribute|a cappella|acapella)\b/i;

/** Albums that exist to imitate a recording rather than to be one. */
const NOT_THE_RECORD = /\b(karaoke|tribute|made famous by|in the style of|as made popular|cover version|performed by the)\b/i;

/** Apple appends these to a collection name. They are packaging, not identity. */
const PACKAGING = /\s*-\s*(ep|single)\s*$/i;

/** Every bracketed group, of either kind. */
const BRACKETS = /[([][^)\]]*[)\]]/g;

/** Only what a name says inside its brackets. Empty when it has none. */
function bracketedPartsOf(name: string): string {
  return (name.match(BRACKETS) ?? []).join(" ");
}

/** A record whose title ends by saying it is a soundtrack. Apple writes it,
 *  Wikipedia usually does not, and it is packaging rather than a name. */
const SOUNDTRACK_SUFFIX = /\s+(original\s+)?(motion\s+picture\s+)?soundtrack\s*$/i;

export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Brackets go entirely, once the blacklist above has had its say. That
    // covers a featuring credit, a source credit like (From "Toy Story 5"),
    // an artist's own re-recording mark like (Taylor's Version), a vault note
    // like [From The Vault], and a deluxe or bonus label, all of which name
    // the same recording this chart row is about.
    .replace(BRACKETS, " ")
    .replace(PACKAGING, "")
    .replace(SOUNDTRACK_SUFFIX, "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    // A name written with symbols standing in for letters. P!nk, Ke$ha and
    // A$AP all reach us one way from Billboard and the other from Apple, and
    // without this the two spellings share no word at all.
    .replace(/!/g, "i")
    .replace(/\$/g, "s")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Quote marks around a word, which is how Apple writes the English half
    // of a Korean title: Love Yourself 結 'Answer'. The apostrophe inside
    // don't is left alone, because only the edges are taken.
    .split(" ")
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .join(" ")
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

/**
 * A credit that names nobody.
 *
 * Wikipedia files a film record under "Soundtrack" and a label compilation
 * under "Various Artists", sometimes on its own and sometimes hung off the
 * real names with a slash: "Lady Gaga and Bradley Cooper / Soundtrack". Apple
 * credits the people. Neither is wrong, and comparing the word soundtrack
 * against a list of composers can only ever refuse a correct row.
 */
const NAMES_NOBODY = /^(soundtrack|various\s+artists?|original\s+(broadway\s+|motion\s+picture\s+)?(cast|soundtrack)|cast|original\s+cast)$/i;

/** The credit with the placeholder parts taken off, which may be nothing. */
export function realNames(credit: string): string {
  const parts = credit.split("/").map((part) => part.trim()).filter((part) => part.length > 0);
  const named = parts.filter((part) => !NAMES_NOBODY.test(part));
  return named.join(" ");
}

/** Words that carry no identity, so sharing one proves nothing. */
const EMPTY_WORDS = new Set(["and", "the", "of", "a", "an", "with", "feat", "ft", "featuring", "x"]);

function meaningfulWords(text: string): string[] {
  return normalise(text).split(" ").filter((word) => word.length > 0 && !EMPTY_WORDS.has(word));
}

/**
 * Whether two artist credits are the same act.
 *
 * Not string equality, because a chart credit and a store credit write the
 * same people differently and the first run proved it in three ways at once.
 * Billboard says "Huntrix: Ejae, Audrey Nuna and Rei Ami" where Apple says
 * "HUNTR/X, EJAE, AUDREY NUNA, REI AMI & KPop Demon Hunters Cast". Billboard
 * says "Ye" where Apple says "Kanye West". Billboard says "Daryl Hall and John
 * Oates" where a store might say "Hall & Oates".
 *
 * So: a single name has to appear, and a credit with several names has to
 * share at least two of them. A covers act shares nothing, which is the case
 * that matters, and "The Hitmakers" is still refused for Nelly's Dilemma.
 */
export function sameArtist(chartCredit: string, storeCredit: string): boolean {
  // A record credited only to "Soundtrack" has no name to check, so checking
  // is not a test that can be passed. Everything else about the row still has
  // to hold: the title must match exactly and the imitation filters still run.
  const named = realNames(chartCredit);
  if (named === "") return true;

  const wanted = meaningfulWords(primaryArtist(named));
  const found = meaningfulWords(storeCredit);
  if (wanted.length === 0) return true;
  if (found.length === 0) return false;

  const shared = wanted.filter((word) => found.includes(word)).length;
  if (wanted.length === 1) return shared === 1;
  return shared >= 2 || shared >= Math.ceil(wanted.length / 2);
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

  const survivors = results.filter((row) => {
    const name = wantTrack ? row.trackName : row.collectionName;
    if (!name) return false;
    // Judged on what is inside the brackets and nowhere else, because that is
    // where a different performance is announced: "Dilemma (Live)". Reading
    // the whole name instead refused every record whose title happens to
    // contain one of these words, and it was not a rare accident. It threw
    // out Dying to Live, Live in No Shoes Nation and Live Your Life, all of
    // which are the record that charted with the word live in their name.
    if (DIFFERENT_PERFORMANCE.test(bracketedPartsOf(name))) return false;
    if (row.collectionName && NOT_THE_RECORD.test(row.collectionName)) return false;
    if (normalise(name) !== wantedTitle) return false;
    return sameArtist(credit, row.artistName ?? "");
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
