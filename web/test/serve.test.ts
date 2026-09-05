import { strict as assert } from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { resolvePath, start } from "../src/serve.js";

const ROOT = resolve("out");

test("a plain path lands inside the root", () => {
  assert.equal(resolvePath(ROOT, "/september-4/"), join(ROOT, "september-4"));
});

test("the root itself is allowed", () => {
  assert.equal(resolvePath(ROOT, "/"), ROOT);
});

/**
 * The guarantee is containment, not rejection. Climbing paths are clamped
 * back inside the root and then miss, which is the same answer a crawler
 * gets for any other path that is not one of the 366.
 */
function inside(path: string | null): boolean {
  return path !== null && (path === ROOT || path.startsWith(ROOT + "/"));
}

test("dot dot cannot climb out of the root", () => {
  assert.ok(inside(resolvePath(ROOT, "/../../etc/passwd")));
  assert.ok(inside(resolvePath(ROOT, "/september-4/../../../etc/passwd")));
});

test("an encoded dot dot cannot climb out either", () => {
  // The oldest version of this bug: the check ran before decoding.
  assert.ok(inside(resolvePath(ROOT, "/%2e%2e/%2e%2e/etc/passwd")));
  assert.ok(inside(resolvePath(ROOT, "/..%2f..%2fetc%2fpasswd")));
});

test("a null byte is refused rather than truncated", () => {
  assert.equal(resolvePath(ROOT, "/september-4%00.html"), null);
});

test("a broken escape is refused rather than thrown", () => {
  assert.equal(resolvePath(ROOT, "/%"), null);
});

test("a sibling of the root is not reachable", () => {
  // out-of-band/ starts with the root's name but is not inside it.
  assert.ok(inside(resolvePath(ROOT, "/../out-of-band/secret")));
});

test("the server answers a page, a directory and a miss", async (t) => {
  const root = resolve("test-site");
  await rm(root, { recursive: true, force: true });
  await mkdir(join(root, "september-4"), { recursive: true });
  await writeFile(join(root, "september-4", "index.html"), "<p>day</p>", "utf8");
  await writeFile(join(root, "404.html"), "<p>nope</p>", "utf8");

  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    server.close();
    await rm(root, { recursive: true, force: true });
  });

  const page = await fetch(`${base}/september-4/`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  assert.match(page.headers.get("cache-control") ?? "", /must-revalidate/);
  assert.equal(await page.text(), "<p>day</p>");

  // Without the trailing slash, which is how most links to it will be written.
  assert.equal((await fetch(`${base}/september-4`)).status, 200);

  const missing = await fetch(`${base}/february-31/`);
  assert.equal(missing.status, 404, "a miss must be a 404, not a 200");
  assert.equal(await missing.text(), "<p>nope</p>");

  const escape = await fetch(`${base}/../../etc/passwd`);
  assert.ok(escape.status === 404 || escape.status === 400);

  const posted = await fetch(`${base}/`, { method: "POST" });
  assert.equal(posted.status, 405);
});
