// The share pictures, on deploy, only when something that draws them changed.
//
//   node --env-file-if-exists=.env dist/src/og-ci.js
//   OG_FORCE=1 node dist/src/og-ci.js        # regenerate whatever the stamp says
//
// Until October 11, 2026 every deploy downloaded Chromium and shot all 732
// pictures (a 1200 by 630 preview and a 1080 by 1080 square for each of the
// 366 dates), which was most of the build minutes, for pictures that were
// nearly always identical to the ones the last deploy made. This step keeps
// the last good set, and a fingerprint of everything that drew it, in a
// folder Render preserves between builds, and generates only when the
// fingerprint moves.
//
// What is fingerprinted: og.ts, every source file it imports, directly or
// through another, and the covers and faces under static/ that the cards
// inline as bytes. A change to any of those is a design change and
// regenerates. A data change is not: new people on a date or a new hive do
// not move the fingerprint, so a deploy that should refresh the pictures for
// data alone sets OG_FORCE=1.
//
// Where the set lives: $OG_CACHE_DIR, or $XDG_CACHE_HOME/birthed-og, or
// ~/.cache/birthed-og. Render sets XDG_CACHE_HOME and keeps it between builds
// until "Clear build cache & deploy" or the cache passes seven gigabytes
// (community.render.com, "Documentation for caching additional directories").
// An empty or cleared cache is not a reason to skip; it is a reason to
// generate.
//
// The one rule that must survive every edit here: skipping when unchanged is
// not tolerating failure. A build either restores every expected picture
// from the cache or runs the generator, and a generator that fails, or that
// comes back short, fails the deploy exactly as before. render.yaml says
// why: every page carries an og:image tag, and 366 broken previews have
// nothing to notice them by.

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { everyDate, slug } from "./model.js";

/** The entry point of the picture code, relative to src/. */
export const ENTRY = "og.ts";
/** The folders under static/ whose files the cards inline. */
export const STATIC_INPUTS = ["covers", "faces"];
/** The file in the cache that names the fingerprint the kept set was drawn from. */
export const STAMP = "stamp";

/**
 * The source files `./x.js` imports in one TypeScript source name, as src
 * relative names: `./share.js` is `share.ts`. Type-only imports count too,
 * because the file is read either way and the rule is simpler with no
 * exceptions.
 */
export function importsOf(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(/from\s+"\.\/([^"]+)\.js"/g)) found.add(`${match[1]}.ts`);
  return [...found].sort();
}

/**
 * Every source file the entry reaches, the entry included, sorted. `read`
 * answers the text of a src relative name, so the walk can be tested with
 * no files on disk.
 */
export function walkImports(read: (file: string) => string, entry: string = ENTRY): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const next of importsOf(read(file))) if (!seen.has(next)) queue.push(next);
  }
  return [...seen].sort();
}

/**
 * One hash over a set of named inputs. The order the inputs arrive in does
 * not matter; the names do, so a file moving is a change, and so does every
 * byte. Each entry is framed by its name and length, so two inputs cannot
 * be told apart by nothing but where one ends and the next begins.
 */
export function fingerprint(inputs: Array<{ name: string; bytes: Uint8Array }>): string {
  const hash = createHash("sha256");
  for (const input of [...inputs].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    hash.update(input.name);
    hash.update("\0");
    hash.update(String(input.bytes.byteLength));
    hash.update("\0");
    hash.update(input.bytes);
  }
  return hash.digest("hex");
}

/** The 732 file names a complete set holds, under out/og. */
export function expectedPictures(): string[] {
  const names: string[] = [];
  for (const date of everyDate()) {
    names.push(`${slug(date.month, date.day)}.png`);
    names.push(`${slug(date.month, date.day)}-square.png`);
  }
  return names;
}

export interface Decision {
  action: "skip" | "generate";
  reason: string;
}

/**
 * Skip only when nothing argues for generating: not forced, the stamp names
 * the fingerprint we have now, and every expected picture is in the cache.
 * Any one of those failing generates. The reason is printed, so a build log
 * always says why Chromium did or did not start.
 */
export function decide(input: { force: boolean; stamp: string | null; current: string; present: number; expected: number }): Decision {
  if (input.force) return { action: "generate", reason: "OG_FORCE is set" };
  if (input.stamp === null) return { action: "generate", reason: "no stamp in the cache; nothing has been kept yet or the cache was cleared" };
  if (input.stamp !== input.current) return { action: "generate", reason: `the picture sources changed (${input.stamp.slice(0, 12)} to ${input.current.slice(0, 12)})` };
  if (input.present !== input.expected) return { action: "generate", reason: `the cache holds ${input.present} of ${input.expected} pictures` };
  return { action: "skip", reason: `unchanged since ${input.current.slice(0, 12)}; ${input.expected} pictures restored from the cache` };
}

/** The folder the kept set and its stamp live in. */
export function cacheDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.OG_CACHE_DIR) return resolve(env.OG_CACHE_DIR);
  if (env.XDG_CACHE_HOME) return join(env.XDG_CACHE_HOME, "birthed-og");
  return join(homedir(), ".cache", "birthed-og");
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

/** The fingerprint of the picture sources as they are on disk now, from web/. */
export function currentFingerprint(root: string = process.cwd()): string {
  const src = join(root, "src");
  const read = (file: string) => readFileSync(join(src, file), "utf8");
  const inputs: Array<{ name: string; bytes: Uint8Array }> = [];
  for (const file of walkImports(read)) inputs.push({ name: `src/${file}`, bytes: readFileSync(join(src, file)) });
  for (const folder of STATIC_INPUTS) {
    const dir = join(root, "static", folder);
    for (const full of filesUnder(dir)) {
      inputs.push({ name: `static/${folder}/${full.slice(dir.length + 1).split("\\").join("/")}`, bytes: readFileSync(full) });
    }
  }
  return fingerprint(inputs);
}

function presentIn(dir: string, expected: string[]): number {
  let present = 0;
  for (const name of expected) {
    const full = join(dir, name);
    if (existsSync(full) && statSync(full).size > 0) present++;
  }
  return present;
}

function runOrFail(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`og: ${command} ${args.join(" ")} exited ${result.status ?? "by signal"}`);
    process.exit(result.status ?? 1);
  }
}

export function main(): void {
  const out = join("out", "og");
  const cache = cacheDir();
  const kept = join(cache, "og");
  const stampPath = join(cache, STAMP);
  const expected = expectedPictures();
  const current = currentFingerprint();
  const stamp = existsSync(stampPath) ? readFileSync(stampPath, "utf8").trim() : null;
  const decision = decide({
    force: process.env.OG_FORCE === "1",
    stamp,
    current,
    present: presentIn(kept, expected),
    expected: expected.length,
  });
  console.log(`og: ${decision.action}, ${decision.reason}`);
  console.log(`og: cache at ${cache}`);

  if (decision.action === "skip") {
    mkdirSync(out, { recursive: true });
    for (const name of expected) cpSync(join(kept, name), join(out, name));
    return;
  }

  runOrFail("npx", ["--yes", "playwright", "install", "chromium"]);
  runOrFail(process.execPath, [join("dist", "src", "og.js")]);
  // The generator said it succeeded. Believe it only if the set is whole:
  // a short set in the cache would be restored short on every later deploy.
  const made = presentIn(out, expected);
  if (made !== expected.length) {
    console.error(`og: the generator wrote ${made} of ${expected.length} pictures; not keeping the set`);
    process.exit(1);
  }
  rmSync(kept, { recursive: true, force: true });
  mkdirSync(kept, { recursive: true });
  for (const name of expected) cpSync(join(out, name), join(kept, name));
  writeFileSync(stampPath, `${current}\n`);
  console.log(`og: kept ${expected.length} pictures and stamp ${current.slice(0, 12)} in ${cache}`);
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("og-ci.js")) {
  try {
    main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
