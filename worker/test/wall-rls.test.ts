import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

// Row level security is enabled on every table in the public schema, with no
// exceptions. CLAUDE.md section 6 says why: a policy on a table without it
// does nothing, and every public table is published to the anonymous key
// that ships in the app.
//
// This reads the catalogue of a real database, so it needs one. Set
// DATABASE_URL to a Postgres connection string, for a local stack the one
// `supabase status` prints, and it runs through psql. Without it the test is
// skipped and says so, rather than passing on nothing. It was run against the
// wall-session-one branch on September 9, 2026: 39 tables, none without.

const url = process.env.DATABASE_URL;

function query(sql: string): string[] {
  return execFileSync("psql", [url!, "--no-psqlrc", "-Atc", sql], { encoding: "utf8" })
    .trim().split("\n").filter((line) => line !== "");
}

test("row level security is enabled on every table in the public schema", {
  skip: url ? false : "set DATABASE_URL to a Postgres connection string to run this",
}, () => {
  const off = query("select tablename from pg_tables where schemaname = 'public' and not rowsecurity order by 1");
  assert.deepEqual(off, [], `row level security is off on: ${off.join(", ")}`);
});

test("the wall tables exist and the boosts table refuses changes", {
  skip: url ? false : "set DATABASE_URL to a Postgres connection string to run this",
}, () => {
  const walls = query("select tablename from pg_tables where schemaname = 'public' and tablename like 'wall\\_%' order by 1");
  assert.deepEqual(walls, [
    "wall_attest_challenges", "wall_attest_grants", "wall_attest_keys", "wall_boost_requests", "wall_boosts",
    "wall_checks", "wall_days", "wall_outcomes", "wall_outlet_owners", "wall_snapshots", "wall_sources", "wall_stories",
  ]);
  const triggers = query("select tgname from pg_trigger where tgrelid = 'public.wall_boosts'::regclass and not tgisinternal order by 1");
  assert.ok(triggers.includes("wall_boosts_immutable"));
  const policies = query("select cmd from pg_policies where schemaname = 'public' and tablename like 'wall\\_%' and cmd <> 'SELECT'");
  assert.deepEqual(policies, [], "no wall table may carry a client write policy");
  // The two ways in are functions, granted to authenticated and to nobody else.
  const grants = query("select routine_name || ':' || grantee from information_schema.routine_privileges where specific_schema = 'public' and routine_name in ('wall_submit_story', 'wall_cast_boost') and privilege_type = 'EXECUTE' order by 1");
  assert.deepEqual(grants.filter((g) => !g.endsWith(":postgres") && !g.endsWith(":service_role")), ["wall_cast_boost:authenticated", "wall_submit_story:authenticated"]);
  // booster_id is recorded and is not published.
  const boostColumns = query("select column_name from information_schema.column_privileges where table_name = 'wall_boosts' and grantee = 'anon' and privilege_type = 'SELECT' order by 1");
  assert.ok(boostColumns.length > 0 && !boostColumns.includes("booster_id"), `anon reads ${boostColumns.join(", ")}`);
});
