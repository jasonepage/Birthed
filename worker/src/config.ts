// Environment and tuning for the pipeline worker.
// Nothing here is secret except the service role key, which is read from the
// environment and never written to a file that is committed.

export interface WorkerConfig {
  supabaseUrl: string;
  /** Empty on a dry run, which needs no write and so needs no key. */
  serviceRoleKey: string;
  userAgent: string;
  yearFrom: number;
  yearTo: number;
  minSitelinks: number;
  maxPerDay: number;
  /** How many people to look up pageviews for, per date. */
  candidateCap: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing environment variable ${name}. Copy worker/.env.example to worker/.env and fill it in.`,
    );
  }
  return value.trim();
}

function numberOr(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} is not a number: ${raw}`);
  }
  return parsed;
}

/**
  * Reads the environment. A dry run needs no service role key, so asking for
  * one would stop you looking at what a query returns before you have gone and
  * fetched a credential.
  */
export function loadConfig(options: { needsWrite: boolean } = { needsWrite: true }): WorkerConfig {
  const contact = process.env.WIKIDATA_CONTACT?.trim() || "contact@birthed.app";
  return {
    supabaseUrl: required("SUPABASE_URL").replace(/\/+$/, ""),
    serviceRoleKey: options.needsWrite
      ? required("SUPABASE_SERVICE_ROLE_KEY")
      : (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""),
    // The query service asks for a descriptive agent with a way to reach you.
    userAgent: `Birthed/0.1 (https://birthed.app; ${contact}) node-fetch`,
    // 1400, not 1600. At 1600 the earliest person in the table was born in
    // 1600 and nobody before that existed at all: no Shakespeare, no
    // Leonardo, no Galileo. Day-precision birth records thin out fast below
    // 1400, so this is about as far back as the query can usefully reach
    // without making the VALUES list long enough to time the service out.
    // CLAUDE.md section 5, September 22, 2026.
    yearFrom: numberOr("WIKIDATA_YEAR_FROM", 1400),
    yearTo: numberOr("WIKIDATA_YEAR_TO", 2015),
    minSitelinks: numberOr("WIKIDATA_MIN_SITELINKS", 3),
    // 120, not 50. Fifty was the whole of a date, and with the cut ordered by
    // attention it was fifty living entertainers: March 14 held exactly fifty
    // people and Einstein was not among them. The mural draws forty tiles on
    // its own, the date page carries thirty people under it, and a site that
    // means to be the record of a date cannot hold fifty of them.
    maxPerDay: numberOr("IMPORT_MAX_PER_DAY", 120),
    candidateCap: numberOr("IMPORT_CANDIDATE_CAP", 160),
  };
}

// Loads worker/.env without a dependency and without import.meta.dirname,
// which does not exist before Node 20.11. Looks in the working directory
// first, so it works whether you run from worker/ or from the repository root.
export async function loadDotEnv(): Promise<void> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const candidates = [join(process.cwd(), ".env"), join(process.cwd(), "worker", ".env")];

  let text: string | undefined;
  for (const candidate of candidates) {
    try {
      text = await readFile(candidate, "utf8");
      break;
    } catch {
      continue;
    }
  }
  // No .env is fine when the environment is already populated.
  if (text === undefined) return;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
