// The charts Birthed knows how to read, one entry per kind of number one.
//
// Every chart is the same shape once it is in the table: a name, an issue
// date, a title, and a credit. What differs is which Wikipedia page holds a
// year and what its columns are called, and that is all a spec says. The
// reader in hot100.ts does the rest for all of them.

export interface ChartSpec {
  /** The word on the command line: --chart albums. */
  key: string;
  /** The chart_name value in chart_weeks. Also what the app shows. */
  name: string;
  /** The first year with a page that can be read without guessing. */
  firstYear: number;
  pageTitle(year: number): string;
  /** Header patterns, matched against lower case header text. */
  dateHeader: RegExp;
  titleHeader: RegExp;
  /** Null when the chart has no credit column, in which case artist is "". */
  creditHeader: RegExp | null;
}

export const SONGS: ChartSpec = {
  key: "songs",
  name: "Billboard Hot 100",
  // 1958 is a combined page carrying several charts. See hot100.ts.
  firstYear: 1959,
  pageTitle: (year) => `List of Billboard Hot 100 number ones of ${year}`,
  dateHeader: /^issue date$|^date$|issue date/,
  titleHeader: /^song|^title|^single/,
  creditHeader: /^artist/,
};

export const ALBUMS: ChartSpec = {
  key: "albums",
  name: "Billboard 200",
  // From May 1959 to August 1963 Billboard ran separate mono and stereo
  // album charts, and those year pages lay them out as paired columns under
  // a grouped header. Reading one of the pair as "the" number one would be a
  // guess, so the import starts with the first whole year of the combined
  // chart. A 1962 birthday shows no album. Absent beats wrong.
  firstYear: 1964,
  pageTitle: (year) => `List of Billboard 200 number-one albums of ${year}`,
  dateHeader: /^issue date$|^date$|issue date/,
  titleHeader: /^album|^title/,
  creditHeader: /^artist/,
};

export const FILMS: ChartSpec = {
  key: "films",
  name: "US box office",
  // Pages exist back into the 1940s. The date is the end of the weekend the
  // film topped, so the six day rule in ChartWeek.covers reads as "the film
  // that was number one the first weekend after you were born".
  firstYear: 1940,
  pageTitle: (year) => `List of ${year} box office number-one films in the United States`,
  dateHeader: /week ending|weekend end|^weekend$|^date$/,
  titleHeader: /^film|^title|^movie/,
  creditHeader: null,
};

export const CHARTS: ChartSpec[] = [SONGS, ALBUMS, FILMS];

export function chartNamed(key: string): ChartSpec | undefined {
  return CHARTS.find((chart) => chart.key === key);
}
