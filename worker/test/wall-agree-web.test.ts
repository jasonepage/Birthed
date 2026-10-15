import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

// The fold in news.ts and the feed on the website decide "the same story"
// with one rule, docs/the-wall.md section 28, and since slice 1 of the pivot
// (October 14, 2026) the worker applies it when a story is filed. Two
// packages, one source file, copied: this holds the copy to the original
// byte for byte, the way wall-allocator-web.test.ts holds the pie. Skipped,
// not passed, when the checkout has no web/.

test("worker/src/wall/agree.ts is web/src/agree.ts, byte for byte", (t) => {
  const here = dirname(fileURLToPath(import.meta.url));
  const web = join(here, "..", "..", "..", "web", "src", "agree.ts");
  const worker = join(here, "..", "..", "src", "wall", "agree.ts");
  if (!existsSync(web)) { t.skip("no web/src/agree.ts in this checkout"); return; }
  assert.equal(readFileSync(worker, "utf8"), readFileSync(web, "utf8"));
});
