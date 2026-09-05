// Reading tables out of MediaWiki's rendered HTML, with no dependencies.
//
// This is not a general HTML parser and does not try to be. It handles the
// shape MediaWiki emits for a wikitable, which is regular in the ways that
// matter: attribute values never contain a raw > (MediaWiki escapes them),
// every cell is closed, and nothing nests except the occasional table inside
// a cell, which the depth counter below survives.
//
// Why parse HTML rather than wikitext: the wikitext of these pages is written
// by hundreds of people over sixty years and uses different templates in
// different decades. The rendered HTML is what those templates expand to, and
// it is the same everywhere.

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  eacute: "é",
  amp39: "'",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED[body] ?? whole;
  });
}

/**
 * A cell's visible text.
 *
 * Superscripts go first and go entirely: in these tables every sup is either a
 * reference marker or a footnote letter, and both would otherwise end up
 * glued to the end of a song title. Elements hidden with display:none go too,
 * because MediaWiki uses them for sort keys that are not meant to be read.
 */
export function cellText(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<span\b[^>]*style="[^"]*display\s*:\s*none[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "");
  return decodeEntities(stripped).replace(/\s+/g, " ").trim();
}

export interface Table {
  /** Every row, every cell, with row and column spans already filled in. */
  grid: string[][];
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  if (match === null) return null;
  return match[2] ?? match[3] ?? match[4] ?? null;
}

function span(tag: string, name: string): number {
  const raw = attribute(tag, name);
  if (raw === null) return 1;
  const value = Number.parseInt(raw, 10);
  // A rowspan of 0 means "to the end of the section" in the specification and
  // nothing sane in practice. Anything absurd is treated as 1 rather than
  // allowed to allocate a million rows.
  if (!Number.isFinite(value) || value < 1 || value > 400) return 1;
  return value;
}

/**
 * Splits a document into its tables, outermost first, each as its inner HTML.
 *
 * A table inside a cell stays inside that cell rather than becoming an entry
 * of its own, which is what makes the infobox and navbox on these pages
 * harmless.
 */
export function readTables(html: string): string[] {
  const tables: string[] = [];
  const tag = /<(\/?)table\b[^>]*>/gi;
  let depth = 0;
  let start = 0;
  let match: RegExpExecArray | null;

  while ((match = tag.exec(html)) !== null) {
    const closing = match[1] === "/";
    if (!closing) {
      if (depth === 0) start = match.index + match[0].length;
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0) tables.push(html.slice(start, match.index));
    }
  }
  return tables;
}

interface RawCell {
  text: string;
  rows: number;
  columns: number;
}

/** The cells of one row, in the order they are written. */
function readCells(rowHtml: string): RawCell[] {
  const cells: RawCell[] = [];
  const tag = /<(\/?)(table|td|th)\b([^>]*)>/gi;
  let depth = 0;
  let open: { start: number; tag: string } | null = null;
  let match: RegExpExecArray | null;

  const close = (end: number): void => {
    if (open === null) return;
    cells.push({
      text: cellText(rowHtml.slice(open.start, end)),
      rows: span(open.tag, "rowspan"),
      columns: span(open.tag, "colspan"),
    });
    open = null;
  };

  while ((match = tag.exec(rowHtml)) !== null) {
    const closing = match[1] === "/";
    const name = (match[2] ?? "").toLowerCase();
    if (name === "table") {
      depth += closing ? -1 : 1;
      if (depth < 0) depth = 0;
      continue;
    }
    if (depth > 0) continue;
    if (closing) {
      close(match.index);
    } else {
      // A cell whose closing tag was left out still ends where the next
      // one starts.
      close(match.index);
      open = { start: match.index + match[0].length, tag: match[3] ?? "" };
    }
  }
  close(rowHtml.length);
  return cells;
}

/** Each row's inner HTML, in order. */
function readRows(tableHtml: string): string[] {
  const rows: string[] = [];
  const tag = /<(\/?)(table|tr)\b[^>]*>/gi;
  let depth = 0;
  let start = -1;
  let match: RegExpExecArray | null;

  while ((match = tag.exec(tableHtml)) !== null) {
    const closing = match[1] === "/";
    const name = (match[2] ?? "").toLowerCase();
    if (name === "table") {
      depth += closing ? -1 : 1;
      if (depth < 0) depth = 0;
      continue;
    }
    if (depth > 0) continue;
    if (closing) {
      if (start >= 0) rows.push(tableHtml.slice(start, match.index));
      start = -1;
    } else {
      // An unclosed row ends where the next one begins.
      if (start >= 0) rows.push(tableHtml.slice(start, match.index));
      start = match.index + match[0].length;
    }
  }
  if (start >= 0) rows.push(tableHtml.slice(start));
  return rows;
}

/**
 * Turns one table's inner HTML into a rectangular grid of cell text.
 *
 * Row and column spans are filled in, so a song that held number one for six
 * weeks appears in all six of its rows rather than only the first. Without
 * this, every row after a run's first would be a date with no song against
 * it, which reads like missing data rather than like a parsing bug, and would
 * have been believed.
 *
 * The rule is the one the specification gives: walk the columns of a row, and
 * at each column take the cell a previous row is still owing before taking
 * the next cell this row actually wrote.
 */
export function readGrid(tableHtml: string): string[][] {
  const grid: string[][] = [];
  let owed = new Map<number, { rows: number; text: string }>();

  for (const rowHtml of readRows(tableHtml)) {
    const own = readCells(rowHtml);
    const next = new Map<number, { rows: number; text: string }>();
    const row: string[] = [];
    let index = 0;
    let column = 0;

    while (index < own.length || owed.has(column)) {
      const carried = owed.get(column);
      if (carried !== undefined) {
        row.push(carried.text);
        if (carried.rows > 1) next.set(column, { rows: carried.rows - 1, text: carried.text });
        column += 1;
        continue;
      }
      const cell = own[index];
      index += 1;
      if (cell === undefined) break;
      for (let repeat = 0; repeat < cell.columns; repeat += 1) {
        row.push(cell.text);
        if (cell.rows > 1) next.set(column, { rows: cell.rows - 1, text: cell.text });
        column += 1;
      }
    }

    owed = next;
    grid.push(row);
  }

  return grid;
}

/**
 * The index of the first column whose header matches, or -1.
 *
 * Headers are matched by what they say rather than by where they sit, because
 * the column order is the one thing about these pages that could change
 * without anybody noticing.
 */
export function columnMatching(header: string[], pattern: RegExp): number {
  return header.findIndex((cell) => pattern.test(cell.toLowerCase()));
}
