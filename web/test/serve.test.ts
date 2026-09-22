import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { ageMark, cardFor, openDates, pictureFor, redirectFor, resolvePath, securityFor, songMark, start, todaySlug, todayStylesheet, yearMarks, yoursMark } from "../src/serve.js";
import { personalName } from "../src/share.js";
import { SHARE_SCRIPT_SOURCE, shareBlock } from "../src/share-button.js";
import { monthName } from "../src/model.js";

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

  // The numbers page sits under /admin/ on purpose, so it is covered by the
  // widening that is already there rather than needing one of its own. This
  // asserts the covering, which is the reason for the path.
  for (const path of ["/admin/numbers", "/admin/numbers/", "/admin/numbers/index.html"]) {
    const numbers = securityFor(path)["Content-Security-Policy"] ?? "";
    assert.match(numbers, /script-src 'unsafe-inline'/, `${path} must run its own script`);
  }
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

test("the dot breathes only on an open date, and only for readers who allow motion", () => {
  const css = todayStylesheet(new Date("2026-09-08T18:00:00Z"));
  for (const date of ["september-7", "september-8", "september-9"]) {
    assert.ok(css.includes(`@media (prefers-reduced-motion:no-preference){.on-${date} .state .dot{animation:breathe 4s ease-in-out infinite}}`), date);
  }
  assert.equal(css.includes(".on-september-10 .state .dot"), false, "a sealed date gets no breath");
  // A four second breath, not a pulse. Anything under two seconds reads as
  // an alarm on a page that carries September 11.
  assert.equal(/breathe [01](\.\d+)?s/.test(css), false);
});

// ---------------------------------------------------------------------------
// The wall, fresh while its date is open. docs/the-wall.md section 12.
// ---------------------------------------------------------------------------

import { forgetWalls, withWall } from "../src/serve.js";
import { WALL_END, WALL_START, openWallDates, replaceWall } from "../src/wall.js";

/** A date page as build.ts writes it: markers, with a baked wall between them. */
const BAKED = `<html><body><h1>A day</h1>${WALL_START}<section class="wall">baked</section>${WALL_END}<p>feed</p></body></html>`;

function wallRows(wallDate: string): { day: unknown[]; stories: unknown[] } {
  return {
    day: [{ wall_date: wallDate, opens_at: "2026-01-01T05:00:00Z", live_at: "2026-01-02T05:00:00Z", closes_at: "2099-01-01T05:00:00Z", closed_at: null }],
    stories: [{
      id: "11111111-1111-1111-1111-111111111111", wall_date: wallDate, submitted_at: "2026-01-02T12:00:00Z",
      headline: "Fresh headline from the live read", url: "https://example.org/fresh", outlet: "example.org",
      status: "placed", tier: "reported", support: 12, placed_at: "2026-01-02T13:00:00Z",
      anchor_mx: 8, anchor_my: 7, w_modules: 2, h_modules: 1, false_at: null, false_note: null,
      wall_sources: [],
    }],
  };
}

test("the wall is swapped in between its markers and nowhere else", () => {
  assert.equal(replaceWall(BAKED, "<section>fresh</section>"), `<html><body><h1>A day</h1><section>fresh</section><p>feed</p></body></html>`);
  assert.equal(replaceWall("<html>no markers</html>", "<section>fresh</section>"), null);
  assert.equal(withWall(BAKED, null), BAKED);
  assert.equal(withWall("<html>no markers</html>", "<section>fresh</section>"), "<html>no markers</html>");
  // A dollar sign in a headline is text, not a capture group.
  assert.ok(replaceWall(BAKED, "<section>$1 $& $'</section>")!.includes("$1 $& $'"));
});

test("the open wall dates are yesterday, today and tomorrow, Eastern, keyed by month and day", () => {
  const open = openWallDates(Date.parse("2026-12-31T20:00:00Z"));
  assert.deepEqual([...open.entries()], [["12-30", "2026-12-30"], ["12-31", "2026-12-31"], ["1-1", "2027-01-01"]]);
  // 03:30 Coordinated Universal Time is still the previous evening in New York.
  assert.deepEqual([...openWallDates(Date.parse("2026-09-10T03:30:00Z")).values()], ["2026-09-08", "2026-09-09", "2026-09-10"]);
  assert.deepEqual([...openWallDates(Date.parse("2028-02-28T20:00:00Z")).values()], ["2028-02-27", "2028-02-28", "2028-02-29"]);
});

test("an open date page reads the wall at request time, falls back to the baked wall when the read fails, and a closed date calls nothing", async (t) => {
  const root = resolve("test-site-wall");
  await rm(root, { recursive: true, force: true });
  const open = openWallDates();
  const [openKey, openDate] = [...open.entries()][1]!;
  const [openMonth, openDay] = openKey.split("-").map(Number) as [number, number];
  // A date that is never within a day of today: six months away.
  const closedMonth = ((openMonth + 5) % 12) + 1;
  const closedSlug = `${["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][closedMonth - 1]}-1`;
  const openSlug = `${["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][openMonth - 1]}-${openDay}`;
  for (const s of [openSlug, closedSlug]) {
    await mkdir(join(root, s), { recursive: true });
    await writeFile(join(root, s, "index.html"), BAKED, "utf8");
  }

  const realFetch = globalThis.fetch;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_ANON_KEY = "test-key";
  const calls: string[] = [];
  let mode: "ok" | "down" | "slow" = "ok";
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("supabase")) return realFetch(input, init);
    calls.push(url);
    if (mode === "down") return new Response("nope", { status: 503 });
    if (mode === "slow") {
      await new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    }
    const rows = wallRows(openDate);
    return new Response(JSON.stringify(url.includes("wall_days") ? rows.day : rows.stories), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    server.close();
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
    forgetWalls();
    await rm(root, { recursive: true, force: true });
  });

  // Fresh.
  forgetWalls();
  const fresh = await (await realFetch(`${base}/${openSlug}/`)).text();
  assert.ok(fresh.includes("Fresh headline from the live read"), "the live wall is on the page");
  assert.ok(!fresh.includes(">baked<"), "the baked wall is gone");
  assert.ok(fresh.includes("<p>feed</p>"), "the rest of the page is untouched");
  assert.equal(calls.filter((c) => c.includes("wall_days")).length, 1);

  // Within twenty seconds the read is not repeated.
  await realFetch(`${base}/${openSlug}/`);
  assert.equal(calls.filter((c) => c.includes("wall_days")).length, 1, "one read per open date per twenty seconds");

  // The front door is today's date page and gets the same live wall. The
  // first version sent the baked file for "/" and the live one for the dated
  // address, so the two showed different boards. Checked when the server's
  // idea of today is the open date, which it is except around the boundary
  // between its clock and the Eastern one.
  if (todaySlug() === openSlug) {
    const front = await (await realFetch(`${base}/`)).text();
    assert.ok(front.includes("Fresh headline from the live read"), "the root shows the live wall too");
    assert.ok(!front.includes(">baked<"));
  }

  // The day's read never asks for the checks: thousands of rows by the
  // afternoon, and the date page draws none of them. That read is what
  // used to push the live section past its deadline.
  assert.ok(calls.length > 0);
  assert.ok(calls.every((url) => !url.includes("wall_checks")), "the date page does not read the checks");

  // Down: the baked page, exactly.
  forgetWalls();
  mode = "down";
  const down = await realFetch(`${base}/${openSlug}/`);
  assert.equal(down.status, 200);
  assert.equal(await down.text(), BAKED);

  // Slow: the deadline passes and the baked page is served.
  forgetWalls();
  mode = "slow";
  const started = Date.now();
  const slow = await realFetch(`${base}/${openSlug}/`);
  assert.equal(await slow.text(), BAKED);
  assert.ok(Date.now() - started < 10_000);

  // A closed date never asks.
  forgetWalls();
  mode = "ok";
  calls.length = 0;
  const closed = await realFetch(`${base}/${closedSlug}/`);
  assert.equal(await closed.text(), BAKED);
  assert.deepEqual(calls, []);

  // No key, no read, the page as built.
  forgetWalls();
  delete process.env.SUPABASE_ANON_KEY;
  assert.equal(await (await realFetch(`${base}/${openSlug}/`)).text(), BAKED);
  assert.deepEqual(calls, []);
});

// ---------------------------------------------------------------------------
// Boosting from the web. docs/the-wall.md section 13.
// ---------------------------------------------------------------------------

import { readTap, receiptFor, tappedFrom } from "../src/serve.js";

test("a posted tap is a story and a date, and nothing else gets through", () => {
  assert.deepEqual(readTap("s=11111111-1111-1111-1111-111111111111&m=9&d=9"), {
    storyId: "11111111-1111-1111-1111-111111111111", month: 9, day: 9, back: "day",
  });
  assert.equal(readTap("s=11111111-1111-1111-1111-111111111111&m=9&d=9&v=hive")!.back, "hive");
  assert.equal(readTap("s=11111111-1111-1111-1111-111111111111&m=9&d=9&v=comb")!.back, "comb");
  assert.equal(readTap("s=11111111-1111-1111-1111-111111111111&m=9&d=9&v=receipt")!.back, "receipt");
  assert.equal(readTap("s=11111111-1111-1111-1111-111111111111&m=9&d=9&v=elsewhere")!.back, "day");
  assert.equal(readTap("s=not-a-story&m=9&d=9"), null);
  assert.equal(readTap("s=11111111-1111-1111-1111-111111111111&m=13&d=9"), null);
  assert.equal(readTap("s=11111111-1111-1111-1111-111111111111&m=9&d=0"), null);
  assert.equal(readTap("s=11111111-1111-1111-1111-111111111111"), null);
  assert.equal(readTap(""), null);
});

test("only a word the server knows may spend a fresh wall read", () => {
  assert.equal(tappedFrom("tapped=kept"), "kept");
  assert.equal(tappedFrom("tapped=spent"), "spent");
  assert.equal(tappedFrom("tapped=anything"), null);
  assert.equal(tappedFrom("kept=moment:1"), null);
  assert.equal(tappedFrom(undefined), null);
});

test("a tap posts to the database, comes back to the date with its word, sets the token, and the next page is fresh and marked", async (t) => {
  const root = resolve("test-site-tap");
  await rm(root, { recursive: true, force: true });
  const open = openWallDates();
  const [openKey, openDate] = [...open.entries()][1]!;
  const [openMonth, openDay] = openKey.split("-").map(Number) as [number, number];
  const openSlug = `${["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][openMonth - 1]}-${openDay}`;
  await mkdir(join(root, openSlug), { recursive: true });
  await writeFile(join(root, openSlug, "index.html"), BAKED, "utf8");

  const realFetch = globalThis.fetch;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_ANON_KEY = "test-key";
  const calls: Array<{ url: string; body: string }> = [];
  let answer: Record<string, unknown> = { result: "kept", support: 13, allowance: 3, left: 2, backed: ["11111111-1111-1111-1111-111111111111"] };
  let standing: Record<string, unknown> = { allowance: 3, left: 2, backed: ["11111111-1111-1111-1111-111111111111"] };
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("supabase")) return realFetch(input, init);
    calls.push({ url, body: String(init?.body ?? "") });
    if (url.endsWith("/rpc/wall_cast_web_boost")) {
      return new Response(JSON.stringify(answer), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/rpc/wall_web_standing")) {
      return new Response(JSON.stringify(standing), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/rpc/my_answers")) {
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const rows = wallRows(openDate);
    return new Response(JSON.stringify(url.includes("wall_days") ? rows.day : rows.stories), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    server.close();
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
    forgetWalls();
    await rm(root, { recursive: true, force: true });
  });

  // A first time reader with no cookie taps. The tap reaches the database
  // with a token this server minted, and the reader is sent back with the
  // word and the cookie.
  forgetWalls();
  const posted = await realFetch(`${base}/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `s=11111111-1111-1111-1111-111111111111&m=${openMonth}&d=${openDay}`,
    redirect: "manual",
  });
  assert.equal(posted.status, 303);
  // The story travels in the query string as well as in the fragment, because
  // a fragment never reaches a server and the Undo button has to know what it
  // is undoing.
  assert.equal(posted.headers.get("location"), `/${openSlug}/?tapped=kept&on=11111111-1111-1111-1111-111111111111#w-11111111-1111-1111-1111-111111111111`);
  const cookie = posted.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^bt=[A-Za-z0-9_-]{16,}; Path=\/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure$/);
  const cast = calls.find((c) => c.url.endsWith("/rpc/wall_cast_web_boost"))!;
  const sent = JSON.parse(cast.body) as { story_id_in: string; voter_token_in: string };
  assert.equal(sent.story_id_in, "11111111-1111-1111-1111-111111111111");
  assert.ok(cookie.startsWith(`bt=${sent.voter_token_in};`), "the token in the cookie is the token the database was given");
  assert.equal(posted.headers.get("cache-control"), "no-store");

  // The page that follows: a fresh read, this browser's marks, never stored.
  const token = cookie.split(";")[0]!;
  calls.length = 0;
  const landed = await realFetch(`${base}/${openSlug}/?tapped=kept`, { headers: { Cookie: token } });
  assert.equal(landed.status, 200);
  assert.equal(landed.headers.get("cache-control"), "no-store");
  const page = await landed.text();
  assert.ok(page.includes("Fresh headline from the live read"));
  assert.ok(page.includes('id="wkept"'), "the sentence for the word is on the page");
  assert.ok(page.includes('.wleft::after{content:"Two buzzes left today."}'), "the count is this browser's own");
  assert.ok(page.includes("#w-11111111-1111-1111-1111-111111111111 .wmine{display:block}"), "the tapped story carries the reader's mark");
  assert.ok(!page.includes('action="/unboost"'), "no Undo without the story the query string names");
  assert.equal(calls.filter((c) => c.url.includes("wall_days")).length, 1, "the read went past the cache");
  const asked = calls.find((c) => c.url.endsWith("/rpc/wall_web_standing"))!;
  assert.equal(JSON.parse(asked.body).voter_token_in, sent.voter_token_in);

  // The page the tap actually lands on: the same request carrying the story,
  // which is the one request that draws the Undo button. After the cache
  // assertion above, because each of these is a read of its own.
  const withUndo = await realFetch(`${base}/${openSlug}/?tapped=kept&on=11111111-1111-1111-1111-111111111111`, { headers: { Cookie: token } });
  const undoPage = await withUndo.text();
  assert.ok(undoPage.includes('<form class="wundo" method="post" action="/unboost">'), "the Undo button is drawn");
  assert.ok(undoPage.includes('<input type="hidden" name="s" value="11111111-1111-1111-1111-111111111111">'), "it names the story it takes back");
  assert.ok(undoPage.includes("Thirty seconds, for a tap you did not mean."));
  assert.ok(undoPage.includes('id="wundone"') && undoPage.includes('id="wtoolate"'), "both undo sentences are on the page");

  // A page nobody just tapped on never carries one, however the query is
  // edited: the word has to be kept and the story has to be on the date.
  const readingOnly = await realFetch(`${base}/${openSlug}/?tapped=already&on=11111111-1111-1111-1111-111111111111`, { headers: { Cookie: token } });
  assert.ok(!(await readingOnly.text()).includes('action="/unboost"'), "a word that is not kept draws no Undo");
  const notOnTheDate = await realFetch(`${base}/${openSlug}/?tapped=kept&on=99999999-9999-9999-9999-999999999999`, { headers: { Cookie: token } });
  assert.ok(!(await notOnTheDate.text()).includes('action="/unboost"'), "a story this date does not have draws no Undo");

  // A second tap on the same story spends nothing and says so.
  answer = { result: "already", support: 13, allowance: 3, left: 2, backed: ["11111111-1111-1111-1111-111111111111"] };
  const again = await realFetch(`${base}/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: token },
    body: `s=11111111-1111-1111-1111-111111111111&m=${openMonth}&d=${openDay}`,
    redirect: "manual",
  });
  assert.equal(again.headers.get("location"), `/${openSlug}/?tapped=already#walready`);
  const reused = calls.filter((c) => c.url.endsWith("/rpc/wall_cast_web_boost")).pop()!;
  assert.equal(JSON.parse(reused.body).voter_token_in, sent.voter_token_in, "the same browser is the same booster");

  // The fourth tap of the day: the database's word, not the page's.
  answer = { result: "spent", support: 4, allowance: 3, left: 0, backed: [] };
  const fourth = await realFetch(`${base}/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: token },
    body: `s=22222222-2222-2222-2222-222222222222&m=${openMonth}&d=${openDay}`,
    redirect: "manual",
  });
  assert.equal(fourth.headers.get("location"), `/${openSlug}/?tapped=spent#wspent`);

  // A word the server does not know is our failure, never a claim about the date.
  answer = { result: "something_new" };
  const odd = await realFetch(`${base}/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: token },
    body: `s=22222222-2222-2222-2222-222222222222&m=${openMonth}&d=${openDay}`,
    redirect: "manual",
  });
  assert.equal(odd.headers.get("location"), `/${openSlug}/?tapped=failed#wfailed`);

  // A malformed tap is a 400 and never reaches the database.
  calls.length = 0;
  const bad = await realFetch(`${base}/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "s=nope&m=9&d=9",
    redirect: "manual",
  });
  assert.equal(bad.status, 400);
  assert.deepEqual(calls, []);

  // A GET is not a tap: nothing a reader reaches by browsing writes anything.
  assert.equal((await realFetch(`${base}/boost`)).status, 404);
  assert.equal((await realFetch(`${base}/boost`, { method: "PUT" })).status, 405);
});

test("a receipt on an open date is drawn live with the buzz control, and a buzz from it comes back to it", async (t) => {
  const root = resolve("test-site-receipt");
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  const open = openWallDates();
  const [openKey, openDate] = [...open.entries()][1]!;
  const [openMonth, openDay] = openKey.split("-").map(Number) as [number, number];
  const openSlug = `${["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][openMonth - 1]}-${openDay}`;

  const realFetch = globalThis.fetch;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_ANON_KEY = "test-key";
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("supabase")) return realFetch(input, init);
    if (url.endsWith("/rpc/wall_cast_web_boost")) {
      return new Response(JSON.stringify({ result: "kept", support: 13, allowance: 3, left: 2, backed: ["11111111-1111-1111-1111-111111111111"] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/rpc/wall_web_standing")) {
      return new Response(JSON.stringify({ allowance: 3, left: 2, backed: ["11111111-1111-1111-1111-111111111111"] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const rows = wallRows(openDate);
    return new Response(JSON.stringify(url.includes("wall_days") ? rows.day : rows.stories), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    server.close();
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
    forgetWalls();
    await rm(root, { recursive: true, force: true });
  });
  forgetWalls();

  // No baked file exists for this story, and the page is still there,
  // because the date is open and the wall was read for it.
  const receiptPath = `/${openSlug}/wall/11111111-1111-1111-1111-111111111111/`;
  const page = await realFetch(`${base}${receiptPath}`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes("Fresh headline from the live read"));
  assert.ok(html.includes('<form class="wbuzz" method="post" action="/boost">'), "the receipt offers the buzz");
  assert.ok(html.includes('name="v" value="receipt"'));
  assert.ok(html.includes('id="wkept"'), "and the sentences the redirect reveals");
  assert.ok(html.includes("the hive for"));

  // A buzz from the receipt lands back on the receipt, with its word.
  const posted = await realFetch(`${base}/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `s=11111111-1111-1111-1111-111111111111&m=${openMonth}&d=${openDay}&v=receipt`,
    redirect: "manual",
  });
  assert.equal(posted.status, 303);
  assert.equal(posted.headers.get("location"), `${receiptPath}?tapped=kept&on=11111111-1111-1111-1111-111111111111#w-11111111-1111-1111-1111-111111111111`);
  const token = (posted.headers.get("set-cookie") ?? "").split(";")[0]!;
  const landed = await realFetch(`${base}${receiptPath}?tapped=kept`, { headers: { Cookie: token } });
  assert.equal(landed.headers.get("cache-control"), "no-store");
  const marked = await landed.text();
  assert.ok(marked.includes("#w-11111111-1111-1111-1111-111111111111 .wmine{display:block}"), "the receipt carries the reader's own mark");
  assert.ok(marked.includes('.wleft::after{content:"Two buzzes left today."}'));

  // The Undo button on a receipt is gated on the word as well as the story,
  // the way the date page's is. Read from ?on= alone it drew a control on a
  // page nobody had tapped anything on, for anybody handed the address.
  const withUndo = await realFetch(`${base}${receiptPath}?tapped=kept&on=11111111-1111-1111-1111-111111111111`, { headers: { Cookie: token } });
  assert.ok((await withUndo.text()).includes('action="/unboost"'), "the Undo button is drawn after a buzz that counted");
  assert.equal(withUndo.headers.get("cache-control"), "no-store");
  const justReading = await realFetch(`${base}${receiptPath}?on=11111111-1111-1111-1111-111111111111`, { headers: { Cookie: token } });
  assert.ok(!(await justReading.text()).includes('action="/unboost"'), "the story alone draws no Undo");
  const strangerReading = await realFetch(`${base}${receiptPath}?on=11111111-1111-1111-1111-111111111111`);
  const strangerPage = await strangerReading.text();
  assert.ok(!strangerPage.includes('action="/unboost"'), "and never for somebody handed the address");
  assert.equal(strangerReading.headers.get("cache-control"), "public, max-age=20, must-revalidate",
               "a page with nothing of one reader's own on it is still shareable");

  // A story the wall does not have falls through to the files, and there is none.
  assert.equal((await realFetch(`${base}/${openSlug}/wall/22222222-2222-2222-2222-222222222222/`)).status, 404);
  // A path that is not a receipt is not one.
  assert.equal(receiptFor("/september-9/wall/not-a-story/"), null);
  assert.equal(receiptFor("/nowhere-9/wall/11111111-1111-1111-1111-111111111111/"), null);
  assert.deepEqual(receiptFor("/september-9/wall/11111111-1111-1111-1111-111111111111/index.html"), { month: 9, day: 9, id: "11111111-1111-1111-1111-111111111111" });
});

test("a year later the date page tells this browser what it backed, and tells nobody else", async (t) => {
  const root = resolve("test-site-anniversary");
  await rm(root, { recursive: true, force: true });
  const open = openWallDates();
  const [openKey, openDate] = [...open.entries()][1]!;
  const [openMonth, openDay] = openKey.split("-").map(Number) as [number, number];
  const openSlug = `${["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][openMonth - 1]}-${openDay}`;
  await mkdir(join(root, openSlug), { recursive: true });
  await writeFile(join(root, openSlug, "index.html"), BAKED, "utf8");

  const realFetch = globalThis.fetch;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_ANON_KEY = "test-key";
  const lastYear = `${Number(openDate.slice(0, 4)) - 1}${openDate.slice(4)}`;
  let standing: Record<string, unknown> = {
    allowance: 3, left: 3, backed: [],
    anniversary: [{ story_id: "99999999-9999-9999-9999-999999999999", headline: "What mattered last year", wall_date: lastYear }],
  };
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("supabase")) return realFetch(input, init);
    if (url.endsWith("/rpc/wall_web_standing")) {
      return new Response(JSON.stringify(standing), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const rows = wallRows(openDate);
    return new Response(JSON.stringify(url.includes("wall_days") ? rows.day : rows.stories), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const token = "bt=aaaaaaaaaaaaaaaaaaaaaaaa";

  t.after(async () => {
    server.close();
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
    forgetWalls();
    await rm(root, { recursive: true, force: true });
  });

  // A browser carrying a token, on a date it backed something on a year ago.
  // It has spent nothing today, so there are no marks: the anniversary alone
  // is reason enough to draw this reader their own page.
  forgetWalls();
  const mine = await realFetch(`${base}/${openSlug}/`, { headers: { Cookie: token } });
  assert.equal(mine.status, 200);
  assert.equal(mine.headers.get("cache-control"), "no-store", "one reader's own memory is never stored");
  const page = await mine.text();
  assert.ok(page.includes("You were here"));
  assert.ok(page.includes("You buzzed this, one year ago today"));
  assert.ok(page.includes("What mattered last year"));
  // The link is to the story's own receipt, which the build keeps after a
  // newer wall takes the hive on this date page.
  assert.ok(page.includes(`href="/${openSlug}/wall/99999999-9999-9999-9999-999999999999/"`));

  // A browser with no cookie is a browser that has done nothing, and it gets
  // the shared page with nobody's memory on it.
  forgetWalls();
  const stranger = await realFetch(`${base}/${openSlug}/`);
  const shared = await stranger.text();
  assert.ok(!shared.includes("You were here"), "nobody else sees it");
  assert.equal(stranger.headers.get("cache-control"), "public, max-age=20, must-revalidate");

  // A misshapen row from the database is dropped rather than drawn, and an
  // older deployment that answers without the field at all is an empty list
  // and never a failed read.
  forgetWalls();
  standing = { allowance: 3, left: 3, backed: [], anniversary: [{ story_id: "nope", headline: "x", wall_date: "2025-09-09" }] };
  assert.ok(!(await (await realFetch(`${base}/${openSlug}/`, { headers: { Cookie: token } })).text()).includes("You were here"));
  forgetWalls();
  standing = { allowance: 3, left: 3, backed: [] };
  const older = await realFetch(`${base}/${openSlug}/`, { headers: { Cookie: token } });
  assert.equal(older.status, 200, "a project that has not run the migration still serves the page");
  assert.ok(!(await older.text()).includes("You were here"));
});

test("a buzz can be taken back for thirty seconds, and only by the browser that cast it", async (t) => {
  const root = resolve("test-site-undo");
  await rm(root, { recursive: true, force: true });
  const open = openWallDates();
  const [openKey, openDate] = [...open.entries()][1]!;
  const [openMonth, openDay] = openKey.split("-").map(Number) as [number, number];
  const openSlug = `${["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][openMonth - 1]}-${openDay}`;
  await mkdir(join(root, openSlug), { recursive: true });
  await writeFile(join(root, openSlug, "index.html"), BAKED, "utf8");

  const realFetch = globalThis.fetch;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_ANON_KEY = "test-key";
  const calls: Array<{ url: string; body: string }> = [];
  let answer: Record<string, unknown> = { result: "undone", support: 12 };
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("supabase")) return realFetch(input, init);
    calls.push({ url, body: String(init?.body ?? "") });
    if (url.endsWith("/rpc/wall_forget_boost")) {
      return new Response(JSON.stringify(answer), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/rpc/wall_web_standing")) {
      return new Response(JSON.stringify({ allowance: 3, left: 3, backed: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const rows = wallRows(openDate);
    return new Response(JSON.stringify(url.includes("wall_days") ? rows.day : rows.stories), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const token = "bt=aaaaaaaaaaaaaaaaaaaaaaaa";

  t.after(async () => {
    server.close();
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
    forgetWalls();
    await rm(root, { recursive: true, force: true });
  });

  // The word comes back from the database and lands on its own sentence.
  forgetWalls();
  const undone = await realFetch(`${base}/unboost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: token },
    body: `s=11111111-1111-1111-1111-111111111111&m=${openMonth}&d=${openDay}`,
    redirect: "manual",
  });
  assert.equal(undone.status, 303);
  assert.equal(undone.headers.get("location"), `/${openSlug}/?tapped=undone#wundone`);
  assert.equal(undone.headers.get("cache-control"), "no-store");
  const sent = JSON.parse(calls.find((c) => c.url.endsWith("/rpc/wall_forget_boost"))!.body) as { story_id_in: string; voter_token_in: string };
  assert.equal(sent.story_id_in, "11111111-1111-1111-1111-111111111111");
  assert.equal(sent.voter_token_in, "aaaaaaaaaaaaaaaaaaaaaaaa", "the token that cast it is the token that takes it back");

  // Past the window, and from the full screen hive, which it returns to.
  answer = { result: "too_late", support: 13 };
  const late = await realFetch(`${base}/unboost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: token },
    body: `s=11111111-1111-1111-1111-111111111111&m=${openMonth}&d=${openDay}&v=hive`,
    redirect: "manual",
  });
  assert.equal(late.headers.get("location"), `/${openSlug}/hive/?tapped=too_late#wtoolate`);

  // A sealed date, and a word this server does not know, each get their own
  // sentence rather than borrowing another refusal's.
  answer = { result: "closed", support: 13 };
  const sealed = await realFetch(`${base}/unboost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: token },
    body: `s=11111111-1111-1111-1111-111111111111&m=${openMonth}&d=${openDay}`,
    redirect: "manual",
  });
  assert.equal(sealed.headers.get("location"), `/${openSlug}/?tapped=closed#wclosed`);
  answer = { result: "something_new" };
  const odd = await realFetch(`${base}/unboost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: token },
    body: `s=11111111-1111-1111-1111-111111111111&m=${openMonth}&d=${openDay}`,
    redirect: "manual",
  });
  assert.equal(odd.headers.get("location"), `/${openSlug}/?tapped=failed#wfailed`);

  // A browser with no token has cast nothing, so there is nothing to take
  // back and no cookie is minted to pretend otherwise.
  calls.length = 0;
  const stranger = await realFetch(`${base}/unboost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `s=11111111-1111-1111-1111-111111111111&m=${openMonth}&d=${openDay}`,
    redirect: "manual",
  });
  assert.equal(stranger.status, 400);
  assert.equal(stranger.headers.get("set-cookie"), null);
  assert.deepEqual(calls, [], "a caller with no token never reaches the database");

  // A malformed post is a 400 before anything is called, and browsing to it
  // writes nothing.
  const bad = await realFetch(`${base}/unboost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: token },
    body: "s=nope&m=9&d=9",
    redirect: "manual",
  });
  assert.equal(bad.status, 400);
  assert.deepEqual(calls, []);
  assert.equal((await realFetch(`${base}/unboost`)).status, 404);
  assert.equal((await realFetch(`${base}/unboost`, { method: "PUT" })).status, 405);
});

test("a flood of taps from one address is refused before the database is touched", async (t) => {
  const root = resolve("test-site-flood");
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  const realFetch = globalThis.fetch;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_ANON_KEY = "test-key";
  let reached = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("supabase")) return realFetch(input, init);
    reached += 1;
    return new Response(JSON.stringify({ result: "kept", allowance: 3, left: 2, backed: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    server.close();
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
    await rm(root, { recursive: true, force: true });
  });

  // One address, well past the per minute ceiling. The address is what the
  // limit keys on, so this is a flood however many cookies it clears.
  const statuses: number[] = [];
  for (let i = 0; i < 80; i++) {
    const r = await realFetch(`${base}/boost`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Forwarded-For": "203.0.113.9" },
      body: `s=33333333-3333-3333-3333-333333333333&m=9&d=9`,
      redirect: "manual",
    });
    statuses.push(r.status);
  }
  assert.ok(statuses.filter((s) => s === 400).length >= 30, `${statuses.filter((s) => s === 400).length} refused`);
  assert.ok(reached <= 40, `${reached} reached the database`);
});

/**
 * A reader's own picture of a hive, and the two ways it must not leak a year.
 *
 * The address names only the date. Which picture comes back is decided by the
 * `by` cookie and by nothing a reader could copy out of the page, and the
 * answer is never stored, because it is one reader's own the way their marks
 * and their anniversary already are.
 */
test("a reader's own picture is chosen by the cookie, never by the address", async (t) => {
  const root = resolve("test-site-yours");
  const personal = resolve("test-personal");
  await rm(root, { recursive: true, force: true });
  await rm(personal, { recursive: true, force: true });
  await mkdir(join(root, "og"), { recursive: true });
  await mkdir(personal, { recursive: true });
  // A date that cannot be open, whichever day this suite runs on: the three
  // open dates are today in Eastern and the two either side of it.
  const closedKey = [...openWallDates(Date.now()).keys()];
  const closed = [...Array(12).keys()].map((m) => `${m + 1}-15`).find((k) => !closedKey.includes(k))!;
  const [cm, cd] = closed.split("-").map(Number) as [number, number];
  const shutSlug = `${monthName(cm).toLowerCase()}-${cd}`;
  await writeFile(join(root, "og", `${shutSlug}-square.png`), "PLAIN", "utf8");

  // The date has to be an open one for a reader's own picture to exist at
  // all, because that is the window og.ts renders.
  const open = [...openWallDates(Date.now()).entries()];
  const [key, wallDate] = open[1]!;
  assert.notEqual(key, closed, "the open date and the shut one must be different dates");
  const [month, day] = key.split("-").map(Number) as [number, number];
  const dated = `${monthName(month).toLowerCase()}-${day}`;
  await writeFile(join(personal, `${personalName(wallDate, 1994)}.png`), "MINE", "utf8");
  await writeFile(join(root, "og", `${dated}-square.png`), "PLAIN-OPEN", "utf8");

  process.env.PERSONAL_ROOT = personal;
  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    server.close();
    delete process.env.PERSONAL_ROOT;
    await rm(root, { recursive: true, force: true });
    await rm(personal, { recursive: true, force: true });
  });

  // A reader who has given a year gets their own, and it is never stored.
  const mine = await fetch(`${base}/${dated}/yours.png`, { headers: { cookie: "by=1994" } });
  assert.equal(mine.status, 200);
  assert.equal(mine.headers.get("content-type"), "image/png");
  assert.equal(mine.headers.get("cache-control"), "no-store");
  assert.equal(await mine.text(), "MINE");

  // A reader who has not gets the shared square, and that one caches.
  const plain = await fetch(`${base}/${dated}/yours.png`);
  assert.equal(plain.status, 200);
  assert.equal(await plain.text(), "PLAIN-OPEN");
  assert.match(plain.headers.get("cache-control") ?? "", /max-age=3600/);

  // A year nothing was rendered for is the shared square rather than a miss,
  // so the link under the board is never broken.
  const odd = await fetch(`${base}/${dated}/yours.png`, { headers: { cookie: "by=1901" } });
  assert.equal(odd.status, 200);
  assert.equal(await odd.text(), "PLAIN-OPEN");

  // A date whose hive is not open has no reader's picture at all.
  const shut = await fetch(`${base}/${shutSlug}/yours.png`, { headers: { cookie: "by=1994" } });
  assert.equal(await shut.text(), "PLAIN");

  // And the folder the pictures live in is not reachable by asking for it,
  // which is why it is not under the site root.
  const direct = await fetch(`${base}/personal/${personalName(wallDate, 1994)}.png`);
  assert.equal(direct.status, 404);
  const climbed = await fetch(`${base}/../test-personal/${personalName(wallDate, 1994)}.png`);
  assert.ok(climbed.status === 404 || climbed.status === 400);
});

test("no address on this site carries a birth year", () => {
  assert.deepEqual(pictureFor("/september-10/yours.png"), { month: 9, day: 10 });
  // There is no shape of this path that takes a year, which is the point.
  assert.equal(pictureFor("/september-10/yours-1994.png"), null);
  assert.equal(pictureFor("/september-10/yours.png?by=1994"), null);
  assert.equal(pictureFor("/february-31/yours.png"), null);
  assert.equal(pictureFor("/september-10/"), null);
});

test("a reader who has given a year is told the picture will be theirs", () => {
  const mark = yoursMark("september-4", 1994);
  assert.ok(mark.includes(".on-september-4 .wsaveall{display:none}"));
  assert.ok(mark.includes(".on-september-4 .wsavemine{display:inline}"));
  // The year itself never reaches the page, only the fact that there is one.
  assert.ok(!mark.includes("1994"));
  assert.equal(yoursMark("september-4", null), "", "and nothing for a reader who never said");
});

test("a reader has their own week marked in the song strip, on their own date only", () => {
  const own = { year: 1994, month: 9, day: 4 };
  const mark = songMark("september-4", own);
  assert.ok(mark.startsWith("<style"));
  assert.ok(mark.endsWith("</style>"));
  // Both shapes of the strip: the baked row carries the id, the live row's
  // year span carries it.
  assert.ok(mark.includes('.on-september-4 .wsongs li:is([id="1994"], :has(.wyr[id="1994"]))'));
  assert.ok(mark.includes("outline:2px solid #FFD98A"));
  assert.ok(mark.includes('.wsongt::before{content:"The week you were born. "'));
  // Only generated text goes in: a year and the site's own label.
  assert.equal(mark.split("<").length, 3, "the only tags are the style element's own");
  assert.equal(songMark("september-4", null), "", "and nothing for a reader who never said");
  // On somebody else's date the birth year's row is the year, never the week.
  const other = songMark("september-22", { year: 1990, month: 6, day: 15 }, 2026);
  assert.ok(!other.includes("The week you were born"));
  assert.ok(other.includes('content:"The year you were born. "'));
  assert.ok(!other.includes("outline"), "the outline is for the reader's own week alone");
  // A cookie holding a year alone cannot know the reader's date, so it never
  // says week either. Hana's walkthrough, September 22, 2026.
  assert.ok(!songMark("september-4", 1994).includes("The week you were born"));
  // A reader born before the charts has no week to mark, but still has an
  // age on every row the charts do cover.
  const early = { year: 1943, month: 9, day: 4 };
  assert.ok(!songMark("september-4", early, 2026).includes("The week you were born"));
  assert.ok(songMark("september-4", early, 2026).includes('[id="1959"], :has(.wyr[id="1959"]))'));
  assert.ok(songMark("september-4", early, 2026).includes('content:"You were 16. "'));
  assert.ok(songMark("september-4", { year: 1959, month: 9, day: 4 }) !== "", "1959 is the first year with a row");
});

test("the song strip starts at the reader's year and walks forward, with the age on each card", () => {
  const mark = songMark("september-22", { year: 2002, month: 9, day: 22 }, 2026);
  const row = (y: number): string => `.on-september-22 .wsongs li:is([id="${y}"], :has(.wyr[id="${y}"]))`;
  // Everything else goes to the back, in the order it was baked.
  assert.ok(mark.includes(".on-september-22 .wsongs li{order:1000}"));
  assert.ok(mark.includes(`${row(2002)}{order:0;`));
  assert.ok(mark.includes(`${row(2018)}{order:16}`));
  assert.ok(mark.includes(`${row(2018)} .wsongt::before{content:"You were 16. "}`));
  assert.ok(mark.includes(`${row(2026)}{order:24}`));
  // Nothing for a year after this one, and no age before the reader.
  assert.ok(!mark.includes('[id="2027"]'));
  assert.ok(!mark.includes('[id="2001"]'));
  assert.equal(mark.split("<").length, 3);
});

test("the age on a card is the age on that date, not the difference of the years", () => {
  // Born September 30, 2002, read on September 22: the 2002 row is a week
  // before the reader existed, 2003 is before their first birthday, and
  // 2018 finds them 15, not 16.
  const mark = songMark("september-22", { year: 2002, month: 9, day: 30 }, 2026);
  const row = (y: number): string => `.on-september-22 .wsongs li:is([id="${y}"], :has(.wyr[id="${y}"]))`;
  assert.ok(!mark.includes(row(2002)), "not born yet on September 22, 2002");
  assert.ok(mark.includes(`${row(2003)} .wsongt::before{content:"Not yet 1. "}`));
  assert.ok(mark.includes(`${row(2018)} .wsongt::before{content:"You were 15. "}`));
  // And a date later in the year than the birthday, in the birth year, is
  // the year they were born.
  const later = ageMark("december-1", { year: 2002, month: 9, day: 30 }, 2026);
  assert.ok(later.includes('li[data-y="2002"]::before{content:"The year you were born"}'));
  assert.ok(later.includes('li[data-y="2018"]::before{content:"You were 16"}'));
});

test("a dated feed row carries the reader's age, and only from their own year", () => {
  const mark = ageMark("september-22", { year: 2002, month: 9, day: 22 }, 2026);
  assert.ok(mark.startsWith('<style class="wage">'));
  assert.ok(mark.endsWith("</style>"));
  assert.ok(mark.includes('.on-september-22 .wlist li[data-y="2002"]::before{content:"The day you were born"}'));
  assert.ok(mark.includes('.on-september-22 .wlist li[data-y="2013"]::before{content:"You were 11"}'));
  assert.ok(mark.includes('.on-september-22 .wlist li[data-y="2026"]::before{content:"You were 24"}'));
  assert.ok(!mark.includes('data-y="2001"'), "a year before the reader says nothing");
  assert.ok(!mark.includes('data-y="2027"'));
  assert.equal(mark.split("<").length, 3, "the only tags are the style element's own");
  assert.equal(ageMark("september-22", null, 2026), "", "and nothing for a reader who never said");
  assert.equal(ageMark("september-22", { year: 2030, month: 1, day: 1 }, 2026), "", "or for a year that has not happened");
  // A year alone keeps the old reading: the year, then the difference.
  const legacy = ageMark("september-22", 2002, 2026);
  assert.ok(legacy.includes('li[data-y="2002"]::before{content:"The year you were born"}'));
  assert.ok(legacy.includes('li[data-y="2013"]::before{content:"You were 11"}'));
});

/**
 * The label on the save link, on a real request with a real wall read.
 *
 * A unit test on `yoursMark` says the rule is right. This says the rule
 * actually reaches the page, which is a different claim and the one that
 * broke first: the birth year had stopped being a reason to draw a reader
 * their own copy of a date page when the year picker came off, so the mark
 * was computed and never sent.
 */
test("a birth year alone is enough to change the label, and to stop the page being cached", async (t) => {
  const root = resolve("test-site-label");
  await rm(root, { recursive: true, force: true });
  const open = openWallDates();
  const [openKey, openDate] = [...open.entries()][1]!;
  const [openMonth, openDay] = openKey.split("-").map(Number) as [number, number];
  const openSlug = `${monthName(openMonth).toLowerCase()}-${openDay}`;
  await mkdir(join(root, openSlug), { recursive: true });
  await writeFile(join(root, openSlug, "index.html"), BAKED, "utf8");
  // The label promises a picture, so the picture has to be there.
  const personal = resolve("test-personal-label");
  await rm(personal, { recursive: true, force: true });
  await mkdir(personal, { recursive: true });
  await writeFile(join(personal, `${personalName(openDate, 1994)}.png`), "MINE", "utf8");
  process.env.PERSONAL_ROOT = personal;

  const realFetch = globalThis.fetch;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_ANON_KEY = "test-key";
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("supabase")) return realFetch(input, init);
    const rows = wallRows(openDate);
    return new Response(JSON.stringify(url.includes("wall_days") ? rows.day : rows.stories), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    server.close();
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
    forgetWalls();
    delete process.env.PERSONAL_ROOT;
    await rm(root, { recursive: true, force: true });
    await rm(personal, { recursive: true, force: true });
  });

  forgetWalls();
  const mine = await realFetch(`${base}/${openSlug}/`, { headers: { cookie: "by=1994" } });
  const mineBody = await mine.text();
  assert.ok(mineBody.includes(`.on-${openSlug} .wsavemine{display:inline}`), "the reader's own label is revealed");
  assert.equal(mine.headers.get("cache-control"), "no-store", "a page carrying one reader's own words is never cached");
  // The year reaches this page in exactly two places, both style rules on a
  // response that is never stored: the one that marks the reader's own row
  // in the song strip, and the one that puts their age on the feed's dated
  // rows. Outside those two elements it is nowhere.
  const songStyle = /<style class="wsong">[^<]*<\/style>/.exec(mineBody)?.[0] ?? "";
  assert.ok(songStyle.includes(`.on-${openSlug} .wsongs li:is([id="1994"], :has(.wyr[id="1994"])){order:0`), "the reader's own year is marked in the song strip");
  assert.ok(mineBody.includes(`<style class="wage">`), "and the feed's dated rows are told the reader's age");
  assert.ok(!mineBody.replace(/<style class="wsong">[^<]*<\/style>/, "").replace(/<style class="wage">[^<]*<\/style>/, "").includes("1994"), "and the year itself is nowhere else on it");

  forgetWalls();
  const shared = await realFetch(`${base}/${openSlug}/`);
  const sharedBody = await shared.text();
  assert.ok(!sharedBody.includes(".wsavemine{display:inline}"), "a reader who never said keeps the shared words");
  assert.match(shared.headers.get("cache-control") ?? "", /max-age=20/, "and the shared page is still shared");
  assert.equal(shared.headers.get("vary"), "Cookie", "a shared cache is told what decides the body");

  // A year nothing was rendered for gets no promise. The label is decided
  // live and the picture is a build artefact, so four days after a deploy,
  // or for a year outside the rendered range, the file is simply not there.
  // Saying "Save your version" and handing over the shared square is a lie
  // told in the one place this feature is visible.
  forgetWalls();
  const unrendered = await realFetch(`${base}/${openSlug}/`, { headers: { cookie: "by=1911" } });
  assert.ok(!(await unrendered.text()).includes(".wsavemine{display:inline}"), "no picture, no promise");
});

test("a reader's own picture is never served as a file, even if the folders overlap", async (t) => {
  // Deliberately the wrong arrangement: the pictures inside the site root,
  // which is what a deployment with one environment variable wrong would do.
  const root = resolve("test-site-overlap");
  const personal = join(root, "personal");
  await rm(root, { recursive: true, force: true });
  await mkdir(personal, { recursive: true });
  await writeFile(join(root, "404.html"), "<p>nope</p>", "utf8");
  const open = openWallDates(Date.now());
  const [, wallDate] = [...open.entries()][1]!;
  const hashed = personalName(wallDate, 1994);
  await writeFile(join(personal, `${hashed}.png`), "MY-OWN-PICTURE", "utf8");

  process.env.PERSONAL_ROOT = personal;
  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    server.close();
    delete process.env.PERSONAL_ROOT;
    await rm(root, { recursive: true, force: true });
  });

  const direct = await fetch(`${base}/personal/${hashed}.png`);
  assert.equal(direct.status, 404, "asking for the file by name gets nothing");
  const listed = await fetch(`${base}/personal/`);
  assert.equal(listed.status, 404, "and neither does asking for the folder");
});

test("the numbers page is never stored by anybody", async (t) => {
  const root = resolve("test-site-numbers");
  await rm(root, { recursive: true, force: true });
  await mkdir(join(root, "admin", "numbers"), { recursive: true });
  await writeFile(join(root, "admin", "numbers", "index.html"), "<p>numbers</p>", "utf8");
  await writeFile(join(root, "admin", "index.html"), "<p>panel</p>", "utf8");

  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    server.close();
    await rm(root, { recursive: true, force: true });
  });

  // A page whose only job is to be read fresh. Every spelling of it, because
  // a rule that covers the slash and not the bare path is a rule that is half
  // there and looks whole.
  for (const path of ["/admin/numbers", "/admin/numbers/", "/admin/numbers/index.html"]) {
    const numbers = await fetch(`${base}${path}`);
    assert.equal(numbers.status, 200, path);
    assert.equal(numbers.headers.get("cache-control"), "no-store", path);
  }

  // And the panel beside it is unchanged, so this did not quietly become a
  // rule about everything under /admin.
  const panel = await fetch(`${base}/admin/`);
  assert.match(panel.headers.get("cache-control") ?? "", /must-revalidate/);
});

// ---------------------------------------------------------------------------
// The live hive. docs/the-wall.md section 21.
// ---------------------------------------------------------------------------

import { jsonAnswer, liveHiveDates, liveHivePathFor } from "../src/serve.js";

test("only the live hive path runs a script, opens a socket to the project and loads a font; a sealed hive, tomorrow's and every date page do not", () => {
  // Four in the afternoon Eastern on September 11: the 10th and the 11th
  // take buzzes, the 12th is open for submissions only and runs nothing.
  const now = Date.parse("2026-09-11T20:00:00Z");
  assert.deepEqual([...liveHiveDates(now).entries()], [["9-10", "2026-09-10"], ["9-11", "2026-09-11"]]);
  assert.deepEqual(liveHivePathFor("/september-11/hive/", now), { month: 9, day: 11, wallDate: "2026-09-11" });
  assert.deepEqual(liveHivePathFor("/september-10/hive", now), { month: 9, day: 10, wallDate: "2026-09-10" });
  assert.equal(liveHivePathFor("/september-12/hive/", now), null, "tomorrow takes no buzzes and runs nothing");
  assert.equal(liveHivePathFor("/september-11/", now), null, "the date page is not the hive");
  assert.equal(liveHivePathFor("/march-3/hive/", now), null);
  // Midnight Eastern on the 12th: the 10th has sealed and the 12th is live.
  const midnight = Date.parse("2026-09-12T04:00:00Z");
  assert.equal(liveHivePathFor("/september-10/hive/", midnight), null);
  assert.deepEqual(liveHivePathFor("/september-12/hive/", midnight)?.wallDate, "2026-09-12");

  const hive = securityFor("/september-11/hive/", now)["Content-Security-Policy"] ?? "";
  assert.match(hive, /^default-src 'none'; /);
  assert.match(hive, /script-src 'unsafe-inline'/);
  assert.match(hive, /connect-src 'self' https:\/\/[a-z0-9]+\.supabase\.co wss:\/\/[a-z0-9]+\.supabase\.co/, "a buzz posts here, the socket goes to the project");
  assert.match(hive, /font-src 'self'/);
  assert.match(hive, /form-action 'self'/, "the buzz form still posts without the script");
  assert.match(hive, /img-src 'self' https:\/\/[a-z0-9]+\.supabase\.co;/, "pictures from here and the project, as everywhere");
  assert.equal(securityFor("/september-10/hive/", now)["Content-Security-Policy"], hive, "yesterday's hive is live too");
  for (const path of ["/september-11/", "/september-12/hive/", "/march-3/hive/", "/", "/calendar/"]) {
    const policy = securityFor(path, now)["Content-Security-Policy"] ?? "";
    assert.ok(!policy.includes("script-src"), `${path} must run nothing`);
    assert.ok(!policy.includes("connect-src"), `${path} must reach nothing`);
    assert.ok(!policy.includes("font-src"), `${path} loads no font`);
  }
  // The word a buzz is answered with, as the page's script is told it.
  assert.deepEqual(jsonAnswer("kept", { result: "kept", support: 4, left: 2, allowance: 3, backed: ["11111111-1111-1111-1111-111111111111", "nope"], boost_id: 77, booster: "secret" }),
    { result: "kept", support: 4, left: 2, allowance: 3, backed: ["11111111-1111-1111-1111-111111111111"], boost_id: 77 });
  assert.deepEqual(jsonAnswer("failed", null), { result: "failed" });
});

test("an open date's full screen hive is served live with the script, its data and the worker's scores; the date page beside it is not", async (t) => {
  const root = resolve("test-site-live-hive");
  await rm(root, { recursive: true, force: true });
  const [liveKey, liveDate] = [...liveHiveDates().entries()].pop()!;
  const [liveMonth, liveDay] = liveKey.split("-").map(Number) as [number, number];
  const liveSlug = `${["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][liveMonth - 1]}-${liveDay}`;
  await mkdir(join(root, liveSlug, "hive"), { recursive: true });
  await writeFile(join(root, liveSlug, "index.html"), BAKED, "utf8");
  await writeFile(join(root, liveSlug, "hive", "index.html"), BAKED, "utf8");

  const realFetch = globalThis.fetch;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_ANON_KEY = "test-key";
  const calls: Array<{ url: string; body: string }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("supabase")) return realFetch(input, init);
    calls.push({ url, body: String(init?.body ?? "") });
    if (url.endsWith("/rpc/wall_cast_web_boost")) {
      return new Response(JSON.stringify({ result: "kept", support: 13, allowance: 3, left: 2, backed: ["11111111-1111-1111-1111-111111111111"], boost_id: 501 }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/rpc/wall_forget_boost")) {
      return new Response(JSON.stringify({ result: "undone", support: 12 }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/rpc/wall_web_standing")) {
      return new Response(JSON.stringify({ allowance: 3, left: 2, backed: ["11111111-1111-1111-1111-111111111111"] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("wall_snapshots")) {
      return new Response(JSON.stringify([{ board: { tiles: [], overflow: [], scores: { "11111111-1111-1111-1111-111111111111": 64 } } }]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const rows = wallRows(liveDate);
    return new Response(JSON.stringify(url.includes("wall_days") ? rows.day : rows.stories), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    server.close();
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
    forgetWalls();
    await rm(root, { recursive: true, force: true });
  });

  // The hive, for a fresh browser: the live section, the allowance, the
  // scores the worker cut with, and the header that lets it run.
  forgetWalls();
  const hive = await realFetch(`${base}/${liveSlug}/hive/`);
  assert.equal(hive.status, 200);
  assert.match(hive.headers.get("content-security-policy") ?? "", /script-src 'unsafe-inline'/);
  const page = await hive.text();
  assert.ok(page.includes('class="wall whive wlivehive"'), "the live section is swapped in");
  assert.ok(page.includes("var HiveAllocator"), "the allocator is on the page");
  assert.ok(page.includes('id="hivedata"'));
  assert.ok(page.includes("Fresh headline from the live read"));
  assert.ok(page.includes("<p>feed</p>"), "the rest of the baked page is untouched");
  const island = /<script type="application\/json" id="hivedata">([\s\S]*?)<\/script>/.exec(page)!;
  const data = JSON.parse(island[1]!) as { left: number; allowance: number; backed: string[]; key: string; date: string; stories: Array<{ id: string; score: number; support: number }> };
  assert.equal(data.key, "test-key");
  assert.equal(data.date, liveDate);
  assert.equal(data.left, data.allowance, "a fresh browser has every buzz");
  assert.deepEqual(data.backed, []);
  assert.equal(data.stories[0]!.score, 64, "the panel's points come off the worker's newest snapshot");
  assert.equal(data.stories[0]!.support, 12);
  assert.equal(calls.filter((c) => c.url.includes("wall_snapshots")).length, 1);

  // The date page beside it: no script, no data, the plain header.
  const day = await realFetch(`${base}/${liveSlug}/`);
  assert.ok(!(day.headers.get("content-security-policy") ?? "").includes("script-src"));
  const dayPage = await day.text();
  assert.ok(!dayPage.includes("<script"), "the date page runs nothing");
  assert.ok(!dayPage.includes("HiveAllocator"));
  assert.ok(dayPage.includes("Fresh headline from the live read"), "and still shows the live wall");

  // A buzz from the script: the same post, answered as JSON rather than a
  // redirect, with the cookie set and the database's word and count.
  const posted = await realFetch(`${base}/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: `s=11111111-1111-1111-1111-111111111111&m=${liveMonth}&d=${liveDay}&v=hive`,
  });
  assert.equal(posted.status, 200);
  assert.equal(posted.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(posted.headers.get("cache-control"), "no-store");
  const cookie = posted.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^bt=[A-Za-z0-9_-]{16,}; Path=\/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure$/);
  assert.deepEqual(await posted.json(), { result: "kept", support: 13, left: 2, allowance: 3, backed: ["11111111-1111-1111-1111-111111111111"], boost_id: 501 });
  const cast = calls.find((c) => c.url.endsWith("/rpc/wall_cast_web_boost"))!;
  const sent = JSON.parse(cast.body) as { voter_token_in: string };
  assert.ok(cookie.startsWith(`bt=${sent.voter_token_in};`), "the token in the cookie is the token the database was given");

  // The hive for that browser: its own standing in the data, never stored.
  const token = cookie.split(";")[0]!;
  const mine = await realFetch(`${base}/${liveSlug}/hive/`, { headers: { Cookie: token } });
  assert.equal(mine.headers.get("cache-control"), "no-store");
  const minePage = await mine.text();
  const mineData = JSON.parse(/<script type="application\/json" id="hivedata">([\s\S]*?)<\/script>/.exec(minePage)![1]!) as { left: number; backed: string[] };
  assert.equal(mineData.left, 2);
  assert.deepEqual(mineData.backed, ["11111111-1111-1111-1111-111111111111"]);
  assert.ok(minePage.includes("Two buzzes left today."));

  // Taking it back, as JSON.
  const undone = await realFetch(`${base}/unboost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", Cookie: token },
    body: `s=11111111-1111-1111-1111-111111111111&m=${liveMonth}&d=${liveDay}&v=hive`,
  });
  assert.equal(undone.status, 200);
  assert.deepEqual(await undone.json(), { result: "undone", support: 12 });

  // Without the Accept header the same post is the redirect it always was.
  const plain = await realFetch(`${base}/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: token },
    body: `s=11111111-1111-1111-1111-111111111111&m=${liveMonth}&d=${liveDay}&v=hive`,
    redirect: "manual",
  });
  assert.equal(plain.status, 303);
  assert.ok((plain.headers.get("location") ?? "").startsWith(`/${liveSlug}/hive/?tapped=kept`));
});

// ---------------------------------------------------------------------------
// The private record. docs/the-wall.md section 25.
// ---------------------------------------------------------------------------

test("the record page is one browser's own, is never stored, runs nothing, and never reads as empty when the read failed", async (t) => {
  const root = resolve("test-site-yours");
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "404.html"), "<p>nope</p>", "utf8");

  const realFetch = globalThis.fetch;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_ANON_KEY = "test-key";
  const asked: Array<{ url: string; body: string }> = [];
  let answer: { status: number; body: string } = {
    status: 200,
    body: JSON.stringify({
      buzzes: [
        { story_id: "11111111-1111-1111-1111-111111111111", headline: "Council approves the river crossing", wall_date: "2026-09-21", sealed: false, status: "pool", outcome: null },
        { story_id: "22222222-2222-2222-2222-222222222222", headline: "The one that got there first", wall_date: "2017-06-12", sealed: true, status: "placed", outcome: "held" },
        // Anything misshapen is dropped rather than drawn, the way the
        // anniversary's rows are.
        { story_id: "not-a-uuid", headline: "Filed under a bad identifier", wall_date: "2026-09-21", sealed: true, status: "placed", outcome: null },
      ],
    }),
  };
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("supabase")) return realFetch(input, init);
    asked.push({ url, body: String(init?.body ?? "") });
    return new Response(answer.body, { status: answer.status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    server.close();
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
    await rm(root, { recursive: true, force: true });
  });

  // A browser that has never buzzed carries no token, so nothing is asked of
  // the database at all and the page says what an empty record means.
  const stranger = await realFetch(`${base}/yours/`);
  assert.equal(stranger.status, 200);
  assert.equal(stranger.headers.get("cache-control"), "no-store");
  assert.equal(asked.length, 0, "a reader with no token is never looked up");
  const strangerPage = await stranger.text();
  assert.ok(strangerPage.includes("Nothing here yet"));
  assert.ok(strangerPage.includes('<meta name="robots" content="noindex">'));
  assert.ok(!strangerPage.includes("<script"), "the record page runs nothing");

  // A browser with a token gets its own rows, and the token is what is sent.
  const token = "bt=abcdefghijklmnopqrstuvwx";
  const mine = await realFetch(`${base}/yours/`, { headers: { Cookie: token } });
  assert.equal(mine.status, 200);
  assert.equal(mine.headers.get("cache-control"), "no-store", "one reader's own page is never stored");
  const page = await mine.text();
  assert.ok(page.includes("Council approves the river crossing"));
  assert.ok(page.includes("The one that got there first"));
  assert.ok(page.includes("Held"));
  assert.ok(!page.includes("Filed under a bad identifier"), "a misshapen row is dropped rather than drawn");
  assert.equal(asked.length, 1);
  assert.ok(asked[0]!.url.endsWith("/rpc/wall_web_record"));
  assert.equal(JSON.parse(asked[0]!.body).voter_token_in, "abcdefghijklmnopqrstuvwx");
  // And the address answers the same without the trailing slash.
  assert.equal((await realFetch(`${base}/yours`, { headers: { Cookie: token } })).status, 200);

  // A read that fails must never say "nothing": an outage and an empty
  // record look the same from the server, and only one of them is the
  // reader's own doing.
  answer = { status: 500, body: "no" };
  const broken = await realFetch(`${base}/yours/`, { headers: { Cookie: token } });
  assert.equal(broken.status, 503);
  const brokenPage = await broken.text();
  assert.ok(brokenPage.includes("could not be read just now"));
  assert.ok(!brokenPage.includes("Nothing here yet"));

  // The page is not a place a script may run, and nothing about it widens
  // the policy the way /add and /admin do.
  const policy = securityFor("/yours/")["Content-Security-Policy"] ?? "";
  assert.ok(!policy.includes("script-src"), "the record page must have no script at all");
  assert.ok(!policy.includes("connect-src"), "and reach nothing");
});

test("the way to the record is on a date page for a browser that has buzzed, and on nobody else's", async (t) => {
  const root = resolve("test-site-yourslink");
  await rm(root, { recursive: true, force: true });
  const open = openWallDates();
  const [openKey, openDate] = [...open.entries()][1]!;
  const [openMonth, openDay] = openKey.split("-").map(Number) as [number, number];
  const openSlug = `${monthName(openMonth).toLowerCase()}-${openDay}`;
  await mkdir(join(root, openSlug), { recursive: true });
  await writeFile(join(root, openSlug, "index.html"), BAKED, "utf8");

  const realFetch = globalThis.fetch;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_ANON_KEY = "test-key";
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("supabase")) return realFetch(input, init);
    if (url.endsWith("/rpc/wall_web_standing")) {
      return new Response(JSON.stringify({ allowance: 3, left: 3, backed: [], anniversary: [] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    const rows = wallRows(openDate);
    return new Response(JSON.stringify(url.includes("wall_days") ? rows.day : rows.stories), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const server = start({ root, port: 0 });
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    server.close();
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
    forgetWalls();
    await rm(root, { recursive: true, force: true });
  });

  // A reader who has buzzed something somewhere carries the token, so the
  // link is on the page and the page is never stored.
  forgetWalls();
  const mine = await realFetch(`${base}/${openSlug}/`, { headers: { Cookie: "bt=abcdefghijklmnopqrstuvwx" } });
  assert.equal(mine.status, 200);
  assert.equal(mine.headers.get("cache-control"), "no-store", "a page carrying one reader's own thing is never stored");
  assert.ok((await mine.text()).includes('href="/yours/"'));

  // And a browser that has never buzzed gets neither the link nor a page
  // that had to be drawn for it alone.
  forgetWalls();
  const stranger = await realFetch(`${base}/${openSlug}/`);
  assert.equal(stranger.status, 200);
  assert.ok(!(await stranger.text()).includes('href="/yours/"'));
  assert.match(stranger.headers.get("cache-control") ?? "", /must-revalidate/);
});

test("a receipt and a card run the share script and nothing else, named by its hash", () => {
  const now = Date.parse("2026-09-11T20:00:00Z");
  for (const path of ["/september-11/wall/11111111-1111-1111-1111-111111111111/", "/march-3/wall/11111111-1111-1111-1111-111111111111/index.html", "/september-22/card/", "/september-22/card"]) {
    const policy = securityFor(path, now)["Content-Security-Policy"] ?? "";
    assert.ok(policy.includes(`script-src ${SHARE_SCRIPT_SOURCE};`), `${path} may run the share script`);
    assert.ok(!/script-src[^;]*unsafe-inline/.test(policy), `${path} may not run inline script in general`);
    assert.match(policy, /connect-src 'self';/, "the one request is for the card's picture, from here");
    assert.ok(!policy.includes("font-src"));
  }
  // The header names exactly the script the pages print.
  const printed = /<script>([\s\S]*?)<\/script>/.exec(shareBlock({ url: "https://birthed.app/september-22/", title: "x" }))?.[1] ?? "";
  assert.equal(`'sha256-${createHash("sha256").update(printed).digest("base64")}'`, SHARE_SCRIPT_SOURCE);
  // Nothing near those paths is widened.
  for (const path of ["/september-22/cards/", "/september-22/card/extra", "/september-22/wall/", "/september-22/"]) {
    assert.ok(!(securityFor(path, now)["Content-Security-Policy"] ?? "").includes("script-src"), `${path} runs nothing`);
  }
  assert.deepEqual(cardFor("/september-22/card/"), { month: 9, day: 22 });
  assert.equal(cardFor("/february-31/card/"), null);
});

test("the words on the bar are an address too", () => {
  assert.equal(redirectFor("/every-date/"), "/calendar/");
  assert.equal(redirectFor("/every-date"), "/calendar/");
});
