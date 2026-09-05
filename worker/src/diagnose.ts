// Why is somebody missing from a date?
//
//   node dist/src/diagnose.js 9 4 "Beyoncé"
//
// The importer's query is five clauses stacked on top of each other. This runs
// them one at a time and reports the step at which a named person disappears,
// which turns "she is not in the results" into "this clause dropped her".

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

/** The clauses, in the order the importer stacks them. */
function clauses(): Array<{ name: string; sparql: string }> {
  return [
    { name: "born on the date at all", sparql: "" },
    { name: "is a human (wdt:P31 wd:Q5)", sparql: "  ?person wdt:P31 wd:Q5 ." },
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
}

function buildProbe(values: string, accumulated: string[], minSitelinks: number | null): string {
  const sitelinks = minSitelinks === null
    ? "  ?person wikibase:sitelinks ?sitelinks ."
    : `  ?person wikibase:sitelinks ?sitelinks .\n  FILTER(?sitelinks >= ${minSitelinks})`;
  return `SELECT ?person ?personLabel ?sitelinks WHERE {
  VALUES ?dob {
${values}
  }
  ?person wdt:P569 ?dob .
${sitelinks}
${accumulated.join("\n")}
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 5000`;
}

function found(rows: Binding[], needle: string): { hit: Binding | null; total: number } {
  const lowered = needle.toLowerCase();
  const hit = rows.find((row) => (row.personLabel?.value ?? "").toLowerCase() === lowered)
    ?? rows.find((row) => (row.personLabel?.value ?? "").toLowerCase().includes(lowered))
    ?? null;
  return { hit: hit ?? null, total: rows.length };
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

  const values = dateLiterals(month, day, config.yearFrom, config.yearTo)
    .map((literal) => `    ${literal}`)
    .join("\n");

  console.log(`Looking for "${who}" born ${month}/${day}, years ${config.yearFrom} to ${config.yearTo}.\n`);

  const accumulated: string[] = [];
  let stillThere = true;

  for (const clause of clauses()) {
    if (clause.sparql) accumulated.push(clause.sparql);
    const rows = await ask(buildProbe(values, accumulated, null), config.userAgent);
    const { hit, total } = found(rows, who);
    const mark = hit ? "present" : "GONE";
    const extra = hit ? `  (${hit.sitelinks?.value ?? "?"} sitelinks)` : "";
    console.log(`  ${mark.padEnd(8)} after "${clause.name}"   ${total} people on this date${extra}`);
    if (!hit && stillThere) {
      console.log(`\n  ==> this clause is what drops them: ${clause.name}\n`);
      stillThere = false;
    }
  }

  if (stillThere) {
    const rows = await ask(buildProbe(values, accumulated, config.minSitelinks), config.userAgent);
    const { hit, total } = found(rows, who);
    console.log(`  ${(hit ? "present" : "GONE").padEnd(8)} after "sitelinks >= ${config.minSitelinks}"   ${total} people`);
    if (hit) {
      console.log("\n  They survive every clause. If they are still missing from the import,");
      console.log("  the candidate cap or the scoring is what dropped them, not the query.");
      console.log(`  Try IMPORT_CANDIDATE_CAP=400 in worker/.env and run the import again.`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
