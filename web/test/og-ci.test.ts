import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cacheDir, currentFingerprint, decide, expectedPictures, fingerprint, importsOf, walkImports } from "../src/og-ci.js";

test("the imports of a source file are read as src relative names, type imports included", () => {
  const source = `import { a } from "./model.js";\nimport type { B } from "./share.js";\nimport { c } from "node:fs";\nimport { d } from "playwright";\nimport { a as again } from "./model.js";`;
  assert.deepEqual(importsOf(source), ["model.ts", "share.ts"]);
});

test("the walk reaches every file the entry imports through any depth, once, sorted", () => {
  const files: Record<string, string> = {
    "og.ts": `import { x } from "./share.js"; import { y } from "./model.js";`,
    "share.ts": `import { z } from "./highlight.js"; import { y } from "./model.js";`,
    "highlight.ts": `import { y } from "./model.js"; import { x } from "./share.js";`,
    "model.ts": `export const y = 1;`,
    "unrelated.ts": `import { q } from "./og.js";`,
  };
  const reads: string[] = [];
  const read = (file: string) => { reads.push(file); return files[file] ?? ""; };
  assert.deepEqual(walkImports(read, "og.ts"), ["highlight.ts", "model.ts", "og.ts", "share.ts"]);
  assert.equal(reads.length, 4, "each reached file is read once and nothing else is");
});

test("the fingerprint ignores input order and notices a name, a byte, or a boundary moving", () => {
  const a = { name: "src/og.ts", bytes: Buffer.from("one") };
  const b = { name: "static/faces/x.jpg", bytes: Buffer.from("two") };
  const same = fingerprint([a, b]);
  assert.equal(fingerprint([b, a]), same, "order does not matter");
  assert.notEqual(fingerprint([{ ...a, bytes: Buffer.from("onE") }, b]), same, "a byte matters");
  assert.notEqual(fingerprint([{ ...a, name: "src/og2.ts" }, b]), same, "a name matters");
  assert.notEqual(fingerprint([{ name: "src/og.ts", bytes: Buffer.from("on") }, { name: "static/faces/x.jpg", bytes: Buffer.from("etwo") }]), same, "bytes cannot slide between inputs");
  assert.match(same, /^[0-9a-f]{64}$/);
});

test("a complete set is two pictures for each of the 366 dates", () => {
  const names = expectedPictures();
  assert.equal(names.length, 732);
  assert.ok(names.includes("september-4.png") && names.includes("september-4-square.png"), "the names come from the site's own slug");
  assert.equal(new Set(names).size, 732, "no two dates share a name");
  assert.equal(names.filter((n) => n.endsWith("-square.png")).length, 366);
});

test("skip only when not forced, the stamp matches, and every picture is kept", () => {
  const current = "a".repeat(64);
  const whole = { force: false, stamp: current, current, present: 732, expected: 732 };
  assert.equal(decide(whole).action, "skip");
  assert.equal(decide({ ...whole, force: true }).action, "generate", "OG_FORCE=1 regenerates on demand");
  assert.match(decide({ ...whole, force: true }).reason, /OG_FORCE/);
  assert.equal(decide({ ...whole, stamp: null }).action, "generate", "an empty or cleared cache generates, never skips");
  assert.equal(decide({ ...whole, stamp: "b".repeat(64) }).action, "generate", "a design change generates");
  assert.equal(decide({ ...whole, present: 731 }).action, "generate", "a short set is never restored");
  assert.equal(decide({ ...whole, present: 0 }).action, "generate");
});

test("the cache folder is OG_CACHE_DIR, then Render's XDG_CACHE_HOME, then ~/.cache", () => {
  assert.equal(cacheDir({ OG_CACHE_DIR: "/tmp/x", XDG_CACHE_HOME: "/opt/render/.cache" }), "/tmp/x");
  assert.equal(cacheDir({ XDG_CACHE_HOME: "/opt/render/.cache" }), "/opt/render/.cache/birthed-og");
  assert.ok(cacheDir({}).endsWith(join(".cache", "birthed-og")));
});

test("the fingerprint on disk follows the picture sources and the inlined pictures, and nothing else", () => {
  const root = mkdtempSync(join(tmpdir(), "og-ci-"));
  try {
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "static", "faces"), { recursive: true });
    mkdirSync(join(root, "static", "covers"), { recursive: true });
    writeFileSync(join(root, "src", "og.ts"), `import { r } from "./share.js";`);
    writeFileSync(join(root, "src", "share.ts"), `export const r = 1;`);
    writeFileSync(join(root, "src", "serve.ts"), `export const unrelated = 1;`);
    writeFileSync(join(root, "static", "faces", "a.jpg"), "face");
    const first = currentFingerprint(root);
    writeFileSync(join(root, "src", "serve.ts"), `export const unrelated = 2;`);
    assert.equal(currentFingerprint(root), first, "a file the cards never import does not move it");
    writeFileSync(join(root, "src", "share.ts"), `export const r = 2;`);
    const second = currentFingerprint(root);
    assert.notEqual(second, first, "the template moving does");
    writeFileSync(join(root, "static", "covers", "b.jpg"), "cover");
    assert.notEqual(currentFingerprint(root), second, "a new inlined picture does");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the build step is the incremental one, and the generator alone is still reachable", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  assert.match(pkg.scripts["og:ci"]!, /og-ci\.js/, "og:ci decides before it downloads anything");
  assert.ok(!/playwright install/.test(pkg.scripts["og:ci"]!), "Chromium is downloaded inside the step, only when generating");
  assert.match(pkg.scripts["og"]!, /og\.js/, "npm run og still generates unconditionally");
});
