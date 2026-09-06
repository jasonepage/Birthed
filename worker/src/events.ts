// Reading the Events section of a Wikipedia date article.
//
// The article for "September 5" has an Events section, split into
// subsections by era, and every line in it is a year, a dash, and a
// sentence somebody wrote and a great many people checked. That sentence is
// stored verbatim. Nothing here summarises, rephrases or ranks; the app does
// the ranking with the reader's age, and the sentence is Wikipedia's.
//
// Like the chart readers, this reads the rendered HTML rather than wikitext,
// because two centuries of hand editing expand to the same handful of tags.

import { cellText } from "./html.js";

export interface DateEvent {
  year: number;
  /** The sentence as written, links reduced to their text, no references. */
  description: string;
}

export interface EventsRead {
  events: DateEvent[];
  /** Things a person should look at before trusting the run. */
  notes: string[];
}

/**
 * The HTML between the Events heading and the next heading of the same level,
 * which on these pages is Births. Null when there is no Events heading, which
 * means the page is not a date page or has been restructured.
 */
export function eventsSection(html: string): string | null {
  // The heading is an h2 whose id is "Events". The recent skin wraps it in a
  // div.mw-heading; the older one does not. Match the h2 itself either way.
  const start = html.search(/<h2[^>]*\bid="Events"[^>]*>/i);
  if (start < 0) return null;
  const rest = html.slice(start);
  const next = rest.slice(1).search(/<h2\b/i);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

/** Every top level list item in a stretch of HTML, as inner HTML. */
function listItems(html: string): string[] {
  const items: string[] = [];
  const pattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    items.push(match[1] ?? "");
  }
  return items;
}

/**
 * "1972 – The Munich massacre begins." into a year and a sentence.
 *
 * The dash between them is an en dash on almost every line and a hyphen or
 * an em dash on a few, so any of the three is accepted. A year that is not
 * a plain whole number, such as "c. 1200" or "1400s", is refused: absent
 * beats wrong, the same rule as the 1958 chart.
 */
export function parseEventLine(text: string, thisYear: number): DateEvent | null {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const match = /^(\d{1,4})\s*(?:BC|BCE)?\s*[\u2013\u2014-]\s*(.+)$/.exec(cleaned);
  if (match === null) return null;
  const year = Number(match[1]);
  if (!Number.isInteger(year) || year < 1 || year > thisYear) return null;
  // Lines like "1984 BC" reach here with the era stripped by the pattern,
  // which would file them under the wrong millennium. Refuse them.
  if (/^\d{1,4}\s*(BC|BCE)\b/.test(cleaned)) return null;
  const description = (match[2] ?? "").trim();
  if (description.length < 12) return null;
  return { year, description };
}

/**
 * All the events on a date page, in the order the page lists them.
 *
 * A few years carry two events as sub bullets under the year. The item
 * pattern stops at the first closing tag, so a parent line is read up to
 * where its sub list begins and the sub bullets themselves are not read.
 * That loses a handful of lines per page and never files one under the
 * wrong year, which is the right side to err on.
 */
export function parseEvents(html: string, thisYear: number = new Date().getUTCFullYear()): EventsRead {
  const section = eventsSection(html);
  if (section === null) {
    return { events: [], notes: ["no Events section on this page"] };
  }

  const events: DateEvent[] = [];
  const notes: string[] = [];
  let refused = 0;

  for (const item of listItems(section)) {
    const own = item.split(/<ul\b/i)[0] ?? "";
    const text = cellText(own);
    if (text.trim() === "") continue;
    const event = parseEventLine(text, thisYear);
    if (event === null) {
      refused += 1;
      continue;
    }
    events.push(event);
  }

  if (events.length < 20) notes.push(`only ${events.length} events read, which is low for a date page`);
  if (refused > 0) notes.push(`${refused} lines refused for having no plain year`);
  return { events, notes };
}
