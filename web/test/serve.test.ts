import { strict as assert } from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { openDates, redirectFor, resolvePath, securityFor, start, todaySlug, todayStylesheet, yearMarks } from "../src/serve.js";

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

// The rotation. This sheet is generated on every request and never cached, so
// the slot it names is the whole of what makes the ask card change under a
// reader who reloads. Injected rather than left to Math.random, because a test
// that rolls dice reports a bug once every few hundred runs and gets muted.
// The author's name is baked hidden into every date page and drawn on one.
// The site asked "born in?" on every date page and kept asking after it had
// been told, which is the site not listening. It knows: it set that cookie and
// it reads it on the way back in.
test("a known birth year puts the picker away, with a way back to it", () => {
  const marks = yearMarks("september-8", 1994);
  assert.match(marks, /\.on-september-8 \.yearask\{display:none\}/, "the question stops being asked");
  assert.match(marks, /\.on-september-8 \.yearset\{display:block\}/, "and a line says what it is now");
  assert.match(marks, /content:"the 1990s"/, "the decade, not the year, which is nobody's business on a page");

  // Hidden and not removed, because hiding it is the only route back to it.
  assert.match(marks, /\.yearask:target\{display:block\}/, "the link brings it out again");

  // Prefixed the way today.css prefixes, since that is what revealed the
  // picker and an unprefixed rule loses to it on specificity.
  assert.equal(marks.includes(".yearask{display:none}") && !marks.includes(".on-september-8 .yearask{display:none}"), false);

  assert.equal(yearMarks("september-8", null), "", "and nothing at all for somebody who never said");
});

test("today.css signs today's date and no other", () => {
  const css = todayStylesheet(new Date("2026-09-08T18:00:00Z"), () => 0.5);
  assert.match(css, /\.on-september-8 \.signed\{display:block\}/);
  // Not the other two open dates, and not the 363 shut ones.
  assert.equal(css.includes(".on-september-7 .signed"), false);
  assert.equal(css.includes(".on-september-9 .signed"), false);
  assert.equal(css.split(".signed{display:block}").length, 2, "one page, once");
});

test("today.css deals a different ask card per request, and gives back the one just answered", () => {
  const when = new Date("2026-09-08T18:00:00Z");

  // A fixed roll picks a fixed slot, and the same roll picks it on all three
  // open dates. Every date page carries a card for every slot, so no roll can
  // ever leave a page with nothing to answer.
  const middle = todayStylesheet(when, () => 0.5);
  for (const date of ["september-7", "september-8", "september-9"]) {
    assert.match(middle, new RegExp(`\\.on-${date} \\.asks2\\{display:block\\}`));
  }
  assert.match(todayStylesheet(when, () => 0), /\.on-september-8 \.asks0\{display:block\}/);
  // A source that returned exactly one would index one past the end.
  assert.match(todayStylesheet(when, () => 0.999999), /\.on-september-8 \.asks4\{display:block\}/);
  assert.match(todayStylesheet(when, () => 1), /\.on-september-8 \.asks4\{display:block\}/);

  // Each date rolls separately, so stepping between the three open dates does
  // not show the same slot on each.
  const rolls = [0, 0.5, 0.99];
  let next = 0;
  const stepped = todayStylesheet(when, () => rolls[next++ % rolls.length] ?? 0);
  assert.match(stepped, /\.on-september-7 \.asks0\{display:block\}/);
  assert.match(stepped, /\.on-september-8 \.asks2\{display:block\}/);
  assert.match(stepped, /\.on-september-9 \.asks4\{display:block\}/);

  // The card the reader just answered is revealed by its own identifier
  // whatever the roll landed on, and the rolled one steps aside so there is
  // never a second card on screen. Written with :has so a browser without it
  // shows two cards rather than none.
  assert.match(middle, /\.on-september-8 \.ask:target\{display:block\}/);
  assert.match(middle, /\.on-september-8:has\(\.ask:target\) \.ask:not\(:target\)\{display:none\}/);

  // And none of it reaches a sealed date, which would be an answer button on a
  // page that refuses answers.
  assert.equal(middle.includes(".on-september-20"), false);
});

test("today.css switches the first screen on for the three open dates and nothing else", () => {
  // Noon in the site's clock on September 8: six hours behind UTC is 18:00Z.
  const css = todayStylesheet(new Date("2026-09-08T18:00:00Z"));
  // Each open page gets its own sentence, in the order the dates read.
  assert.match(css, /\.on-september-7 \.senpast,/);
  assert.match(css, /\.on-september-8 \.sennow,/);
  assert.match(css, /\.on-september-9 \.sennext,/);
  assert.equal(css.includes(".on-september-10 "), false, "a sealed date gets nothing");
  // The fuse. Yesterday's date is in its last third, today's in the middle,
  // tomorrow's in its first, and noon puts each one halfway through its third.
  const gone = (date: string) => Number(new RegExp(`\\.on-${date} \\.fuse span\\{--gone:([0-9.]+)\\}`).exec(css)?.[1]);
  assert.ok(Math.abs(gone("september-7") - 5 / 6) < 0.01, `yesterday's date reads ${gone("september-7")}`);
  assert.ok(Math.abs(gone("september-8") - 3 / 6) < 0.01, `today's date reads ${gone("september-8")}`);
  assert.ok(Math.abs(gone("september-9") - 1 / 6) < 0.01, `tomorrow's date reads ${gone("september-9")}`);
  // The link to the page itself is hidden, so the line names the other two.
  assert.match(css, /\.on-september-8 \.also a\[href="\/today\/"\]\{display:none\}/);
  assert.match(css, /\.on-september-7 \.also a\[href="\/yesterday\/"\]\{display:none\}/);
  // The ask comes up and the feed's copy of its row goes away, together.
  assert.match(css, /\.on-september-8 \.asks[0-4]\{display:block\}/);
  // Equal specificity would lose to the baked grey, because this sheet loads
  // first. Two classes, not one.
  assert.match(css, /\.on-september-8 \.state \.dot\{background:#6FA5DE/);
  assert.match(css, /\.on-september-8 \.asked\{display:none\}/);
  // Nothing sets a rule for an element the page no longer has.
  assert.equal(css.includes("openflag"), false);
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
