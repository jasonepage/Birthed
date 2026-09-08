import { strict as assert } from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { openDates, redirectFor, resolvePath, securityFor, start, todaySlug, todayStylesheet } from "../src/serve.js";

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

/**
 * The page that runs a script is allowed to run it, and nothing else is.
 *
 * This test exists because the opposite shipped. The policy said
 * `default-src 'none'` with no `script-src`, which is a browser instruction to
 * drop the script on `/add` without drawing anything and without saying so,
 * and the page had been blank in every browser since it was written. A test
 * that reads the header is the only thing that would have caught it, because
 * the file on disk was right the whole time.
 */
// The calendar's today ring, which is a stylesheet rather than a script
// because this site refuses scripts and today is not knowable at build time.
test("today.css names the date it is asked for, and turns over", () => {
  const seventh = todayStylesheet(new Date("2026-09-07T18:00:00Z"));
  assert.match(seventh, /a\[href="\/september-7\/"\]/);
  assert.match(seventh, /outline: ?2px solid #/);

  const eighth = todayStylesheet(new Date("2026-09-08T18:00:00Z"));
  assert.match(eighth, /a\[href="\/september-8\/"\]/);
});

test("today.css is shifted off UTC the same way /today is", () => {
  // Early morning UTC is still the previous evening in North America, which is
  // where the traffic is. The redirect already makes that choice; the ring has
  // to make the same one or the two disagree on the same screen.
  const early = new Date("2026-09-08T03:00:00Z");
  assert.equal(todaySlug(early), "september-7");
  assert.match(todayStylesheet(early), /a\[href="\/september-7\/"\]/);
});

test("a stylesheet from this origin is allowed and a script still is not", () => {
  const day = securityFor("/september-4/")["Content-Security-Policy"] ?? "";
  assert.match(day, /style-src 'unsafe-inline' 'self'/, "today.css has to load");
  assert.ok(!day.includes("script-src"), "widening style-src must not widen script-src");
  assert.match(day, /default-src 'none'/);
});

test("only the add page may run its script and reach the project", () => {
  const day = securityFor("/september-4/")["Content-Security-Policy"] ?? "";
  assert.ok(!day.includes("script-src"), "a date page must have no script at all");
  assert.ok(!day.includes("connect-src"), "a date page must reach nothing");

  for (const path of ["/add", "/add/", "/add/index.html"]) {
    const add = securityFor(path)["Content-Security-Policy"] ?? "";
    assert.match(add, /script-src 'unsafe-inline'/, `${path} must run its own script`);
    assert.match(add, /connect-src https:\/\/[a-z0-9]+\.supabase\.co/, `${path} must reach the project`);
    assert.match(add, /frame-ancestors 'none'/, `${path} keeps the rest of the policy`);
  }

  // The name of a date page that merely starts with the same letters is not
  // the add page.
  const other = securityFor("/adder/")["Content-Security-Policy"] ?? "";
  assert.ok(!other.includes("script-src"));

  // The curation panel is the second and last page that runs anything.
  for (const path of ["/admin", "/admin/", "/admin/index.html"]) {
    const admin = securityFor(path)["Content-Security-Policy"] ?? "";
    assert.match(admin, /script-src 'unsafe-inline'/, `${path} must run its own script`);
    assert.match(admin, /connect-src https:\/\/[a-z0-9]+\.supabase\.co/);
  }
  assert.ok(!(securityFor("/administrator/")["Content-Security-Policy"] ?? "").includes("script-src"));
});

// ---------------------------------------------------------------------------
// The three open dates.

test("yesterday, today and tomorrow are the three that take answers", () => {
  const open = openDates(new Date("2026-09-08T18:00:00Z"));
  assert.deepEqual(open, ["september-7", "september-8", "september-9"]);
});

test("the three roll over a month boundary without a gap", () => {
  assert.deepEqual(openDates(new Date("2026-10-01T18:00:00Z")),
    ["september-30", "october-1", "october-2"]);
});

test("and over a year boundary", () => {
  assert.deepEqual(openDates(new Date("2027-01-01T18:00:00Z")),
    ["december-31", "january-1", "january-2"]);
});

test("the stylesheet opens exactly three dates and no others", () => {
  const css = todayStylesheet(new Date("2026-09-08T18:00:00Z"));
  for (const date of ["september-7", "september-8", "september-9"]) {
    assert.ok(css.includes(`.on-${date} .rem{display:flex}`), `${date} should be open`);
  }
  assert.equal(css.includes(".on-september-6 .rem"), false, "a sealed date draws no buttons");
  assert.equal(css.includes(".on-september-10 .rem"), false, "and neither does one not yet open");
  assert.equal((css.match(/\.rem\{display:flex\}/g) ?? []).length, 3);
});

test("yesterday and tomorrow are redirects, so a link to them is never stale", () => {
  const now = new Date("2026-09-08T18:00:00Z");
  assert.equal(redirectFor("/yesterday/", now), "/september-7/");
  assert.equal(redirectFor("/tomorrow/", now), "/september-9/");
  assert.equal(redirectFor("/today/", now), "/september-8/");
});

test("today.css opens the year question on the same three dates as the buttons", () => {
  const css = todayStylesheet(new Date(Date.UTC(2026, 8, 8, 12)));
  for (const date of ["september-7", "september-8", "september-9"]) {
    assert.ok(css.includes(`.on-${date} .yearask{display:block}`), `${date} should ask`);
  }
  assert.equal(css.includes(".on-september-6 .yearask"), false, "a sealed date does not ask");
  assert.equal(css.includes(".on-september-10 .yearask"), false, "and neither does one not yet open");
  assert.equal((css.match(/\.yearask\{display:block\}/g) ?? []).length, 3);
});
