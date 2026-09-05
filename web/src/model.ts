/** What a date page needs to render. Deliberately the same shape the app reads. */
export interface Person {
  qid: string;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  description: string | null;
  /**
   * Average monthly English Wikipedia pageviews, the signal the ordering is
   * built on. Never rendered. It is here so a page can tell the difference
   * between ten people who were ranked and ten who were not.
   */
  monthlyViews: number;
}

export interface DayPage {
  month: number;
  day: number;
  people: Person[];
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? String(month);
}

/** "september-4". Readable, stable, and what somebody would type. */
export function slug(month: number, day: number): string {
  return `${monthName(month).toLowerCase()}-${day}`;
}

export function everyDate(): Array<{ month: number; day: number }> {
  const dates: Array<{ month: number; day: number }> = [];
  for (let month = 1; month <= 12; month++) {
    const days = DAYS_IN_MONTH[month - 1] ?? 31;
    for (let day = 1; day <= days; day++) dates.push({ month, day });
  }
  return dates;
}

/** The date before and after, wrapping around the year. */
export function neighbours(month: number, day: number) {
  const all = everyDate();
  const index = all.findIndex((d) => d.month === month && d.day === day);
  const previous = all[(index - 1 + all.length) % all.length]!;
  const next = all[(index + 1) % all.length]!;
  return { previous, next };
}
