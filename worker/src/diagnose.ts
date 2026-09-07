// Why is somebody missing from a date?
//
//   node dist/src/diagnose.js 9 4 "Beyoncé"
//
// The importer's query is clauses stacked on each other, and "she is not in
// the results" is not something you can debug. This runs them one at a time
// against a named person and reports the step at which they disappear.
//
// The first version of this file had two bugs of its own, both of which
// produced confident wrong answers, so both are now impossible:
//
//   1. It pulled every person on the date and searched the rows in JavaScript,
//      under a LIMIT. On a date with 5,000 people the limit truncated the list
//      and everybody looked missing. The match is done by the database now, so
//      there is nothing to truncate.
//   2. It compared names as raw strings. A terminal on macOS can hand over
//      "Beyoncé" with the accent as a separate combining character, which is a
//      different string from the one Wikidata stores, so an exact match fails
//      on a person who is right there. The search now stops at the first
//      non-ASCII character, so "Beyoncé" is looked up as "beyonc".
//   3. It looked for an English label. Asked about Beyoncé it answered that
//      Wikidata does not have her on September 4, and printed her September 4
//      birth date three lines below that, and the contradiction was in the
//      output rather than in the reader. Her name is filed under mul, the code
//      for a name spelled the same in every language, so the English label
//      does not exist and the search matched nothing. The very thing being
//      diagnosed was breaking the diagnosis. Both languages are searched now.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadConfig, loadDotEnv } from "./config.js";
import { dateLiterals } from "./wikidata.js";

const ENDPOINT = "https://query.wikidata.org/sparql";

interface Binding { [key: string]: { value: string } | undefined }
interface SparqlResponse { results: { bindings: Binding[] } }

async function ask(query: string, userAgent: string): Promise<Binding[]> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
      "User-Agent": userAgent,
    },
    body: new URLSearchParams({ query }).toString(),
  });
  if (!response.ok) {
    throw new Error(`query failed with ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  return ((await response.json()) as SparqlResponse).results.bindings;
}

/**
 * An accent-proof search term. Normalises, lowercases, and truncates at the
 * first character outside plain ASCII, so however the accent was encoded the
 * part before it still matches.
 */
export function searchTerm(name: string): string {
  const normalised = name.normalize("NFC").toLowerCase();
  const cut = [...normalised].findIndex((character) => character.charCodeAt(0) > 127);
  const trimmed = cut > 2 ? normalised.slice(0, cut) : normalised;
  return trimmed.replace(/["\\]/g, "").trim();
}

const CLAUSES: Array<{ name: string; sparql: string }> = [
  { name: "born on the date at all", sparql: "" },
  { name: "is a human", sparql: "  ?person wdt:P31 wd:Q5 ." },
  {
    name: "has an English Wikipedia article",
    sparql: "  ?article schema:about ?person ; schema:isPartOf <https://en.wikipedia.org/> .",
  },
  {
    name: "birth date is day precision on the statement",
    sparql: `  ?person p:P569/psv:P569 ?dobNode .
  ?dobNode wikibase:timeValue ?dob .
  ?dobNode wikibase:timePrecision ?precision .
  FILTER(?precision >= 11)`,
  },
];

/** Matching happens in the database, so nothing can be truncated away. */
function probe(values: string, accumulated: string[], term: string): string {
  return `SELECT ?person ?name ?sitelinks WHERE {
  VALUES ?dob {
${values}
  }
  ?person wdt:P569 ?dob .
  ?person wikibase:sitelinks ?sitelinks .
  ?person rdfs:label ?name .
  FILTER(LANG(?name) IN ("en", "mul"))
  FILTER(CONTAINS(LCASE(?name), "${term}"))
${accumulated.join("\n")}
}
LIMIT 20`;
}

function countProbe(values: string, accumulated: string[]): string {
  return `SELECT (COUNT(DISTINCT ?person) AS ?total) WHERE {
  VALUES ?dob {
${values}
  }
  ?person wdt:P569 ?dob .
  ?person wikibase:sitelinks ?sitelinks .
${accumulated.join("\n")}
}`;
}

/** How many people on this date have more language coverage than they do. */
function rankProbe(values: string, accumulated: string[], sitelinks: number): string {
  return `SELECT (COUNT(DISTINCT ?person) AS ?ahead) WHERE {
  VALUES ?dob {
${values}
  }
  ?person wdt:P569 ?dob .
  ?person wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks > ${sitelinks})
${accumulated.join("\n")}
}`;
}

interface SearchHit { id: string; label?: string; description?: string }

/**
 * When somebody is not on the date at all, the useful question stops being
 * "which clause dropped them" and becomes "what does Wikidata actually have".
 * The search interface answers the name to identifier half, and one small
 * query answers the rest.
 */
async function whatDoesWikidataThink(name: string, userAgent: string): Promise<void> {
  const search = new URLSearchParams({
    action: "wbsearchentities",
    search: name,
    language: "en",
    type: "item",
    format: "json",
    limit: "5",
    origin: "*",
  });
  const response = await fetch(`https://www.wikidata.org/w/api.php?${search}`, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
  });
  if (!response.ok) {
    console.log(`\n  (could not search Wikidata for the name: ${response.status})`);
    return;
  }
  const hits = ((await response.json()) as { search?: SearchHit[] }).search ?? [];
  if (hits.length === 0) {
    console.log(`\n  Wikidata has no item whose name matches "${name}" at all.`);
    return;
  }

  console.log("\n  What Wikidata has under that name:\n");
  for (const hit of hits.slice(0, 3)) {
    const rows = await ask(
      `SELECT ?dob ?precision WHERE {
  OPTIONAL {
    wd:${hit.id} p:P569/psv:P569 ?node .
    ?node wikibase:timeValue ?dob ; wikibase:timePrecision ?precision .
  }
} LIMIT 5`,
      userAgent,
    );
    const dates = rows
      .map((row) => row.dob?.value)
      .filter((value): value is string => Boolean(value))
      .map((value) => `${value.slice(0, 10)}`);
    const shown = dates.length > 0 ? dates.join(", ") : "no date of birth recorded";
    console.log(`    ${hit.id}  ${hit.label ?? "?"}  ${hit.description ?? ""}`);
    console.log(`         birth date on Wikidata: ${shown}`);
  }
  console.log("\n  If the date there is not the one you searched, the data is the problem,");
  console.log("  not the importer. If it says no date of birth recorded, nothing we do");
  console.log("  can put them on a day page until somebody adds one to Wikidata.");
}

async function main(): Promise<void> {
  await loadDotEnv();
  const config = loadConfig({ needsWrite: false });

  const args = process.argv.slice(2);
  const month = Number(args[0]);
  const day = Number(args[1]);
  const who = args[2];

  if (!Number.isInteger(month) || !Number.isInteger(day) || !who) {
    throw new Error('Usage: node dist/src/diagnose.js <month> <day> "<name>"');
  }

  const term = searchTerm(who);
  const values = dateLiterals(month, day, config.yearFrom, config.yearTo)
    .map((literal) => `    ${literal}`)
    .join("\n");

  console.log(`Looking for "${who}" born ${month}/${day}, matching on "${term}".\n`);

  const accumulated: string[] = [];
  let lastSeen: Binding | null = null;
  let droppedBy: string | null = null;

  for (const clause of CLAUSES) {
    if (clause.sparql) accumulated.push(clause.sparql);
    const [hits, counts] = await Promise.all([
      ask(probe(values, accumulated, term), config.userAgent),
      ask(countProbe(values, accumulated), config.userAgent),
    ]);
    const total = counts[0]?.total?.value ?? "?";
    const hit = hits[0] ?? null;
    if (hit) lastSeen = hit;
    console.log(
      `  ${(hit ? "present" : "GONE").padEnd(8)} after "${clause.name}"` +
        `   ${total} people on this date` +
        (hit ? `   ${hit.name?.value} (${hit.sitelinks?.value} sitelinks)` : ""),
    );
    if (!hit && !droppedBy) droppedBy = clause.name;
  }

  console.log("");

  if (droppedBy) {
    console.log(`  ==> the query drops them at: ${droppedBy}`);
    if (droppedBy === CLAUSES[0]?.name) {
      // Nothing about our clauses removed them, so they are not on this date
      // as far as Wikidata is concerned. Ask Wikidata what date it does have,
      // which is the only thing that settles it.
      await whatDoesWikidataThink(who, config.userAgent);
    }
    return;
  }

  // They survive the query, so the next suspect is candidate selection.
  const sitelinks = Number(lastSeen?.sitelinks?.value ?? "0");
  const ahead = await ask(rankProbe(values, accumulated, sitelinks), config.userAgent);
  const rank = Number(ahead[0]?.ahead?.value ?? "0") + 1;

  console.log(`  They survive every clause, with ${sitelinks} sitelinks.`);
  console.log(`  That is rank ${rank} on this date by language coverage.`);
  if (rank > config.candidateCap) {
    console.log(`\n  ==> candidate selection is what drops them. The cap is ${config.candidateCap}.`);
    console.log("      Anybody the description marks as an internet person is now always");
    console.log("      looked up regardless of coverage, so rebuild and try the import again.");
    console.log("      If their description does not say so, raise IMPORT_CANDIDATE_CAP.");
  } else {
    console.log("\n  ==> they reach the pageviews step, so the score is what buries them.");
    console.log("      Run the import with --print and look at their view count.");
  }
}

// Only run when this file is the entry point. Without this, importing
// searchTerm for a test ran the whole diagnostic and demanded a database URL.
function isEntryPoint(): boolean {
  const argv = process.argv[1];
  if (argv === undefined) return false;
  try {
    return realpathSync(argv) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
