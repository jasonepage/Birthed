// Environment and tuning for the pipeline worker.
// Nothing here is secret except the service role key, which is read from the
// environment and never written to a file that is committed.

export interface WorkerConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  userAgent: string;
  yearFrom: number;
  yearTo: number;
  minSitelinks: number;
  maxPerDay: number;
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

export function loadConfig(): WorkerConfig {
  const contact = process.env.WIKIDATA_CONTACT?.trim() || "contact@birthed.app";
  return {
    supabaseUrl: required("SUPABASE_URL").replace(/\/+$/, ""),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    // The query service asks for a descriptive agent with a way to reach you.
    userAgent: `Birthed/0.1 (https://birthed.app; ${contact}) node-fetch`,
    yearFrom: numberOr("WIKIDATA_YEAR_FROM", 1600),
    yearTo: numberOr("WIKIDATA_YEAR_TO", 2015),
    minSitelinks: numberOr("WIKIDATA_MIN_SITELINKS", 10),
    maxPerDay: numberOr("IMPORT_MAX_PER_DAY", 50),
  };
}

// Loads worker/.env without a dependency. Node 22 has --env-file, but reading
// it here means the npm scripts stay simple and the Docker image stays bare.
export async function loadDotEnv(path: string): Promise<void> {
  const { readFile } = await import("node:fs/promises");
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return; // no .env is fine when the environment is already populated
  }
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
