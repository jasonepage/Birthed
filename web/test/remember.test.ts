import { strict as assert } from "node:assert";
import { test } from "node:test";
import { keptFrom, newToken, readAnswer, tokenFromCookie, underLimit, yearFromCookie } from "../src/serve.js";
import { resultId, resultMarkup } from "../src/render.js";

test("a token is long enough for the database to accept it", () => {
  // The function refuses anything under sixteen characters, so a token that
  // could ever be shorter is a vote that silently fails.
  for (let i = 0; i < 50; i++) assert.ok(newToken().length >= 16);
});

test("tokens are not predictable and not reused", () => {
  const seen = new Set(Array.from({ length: 500 }, () => newToken()));
  assert.equal(seen.size, 500);
});

test("a cookie is read out of a header with other cookies in it", () => {
  assert.equal(tokenFromCookie("a=1; bt=abcdefghijklmnop; z=2"), "abcdefghijklmnop");
});

test("a truncated or hand edited cookie counts as no cookie", () => {
  assert.equal(tokenFromCookie("bt=short"), null);
  assert.equal(tokenFromCookie("bt=has spaces and punctuation!!"), null);
  assert.equal(tokenFromCookie(undefined), null);
  assert.equal(tokenFromCookie(""), null);
});

test("a well formed answer is read", () => {
  const answer = readAnswer("k=cultural_event&i=42&m=9&d=7&a=remember&y=1994");
  assert.deepEqual(answer, {
    month: 9, day: 7, kind: "cultural_event", id: "42", depth: "remember", birthYear: 1994,
  });
});

test("the birth year is optional and a bad one is dropped rather than stored", () => {
  assert.equal(readAnswer("k=person&i=Q1&m=1&d=1&a=heard")?.birthYear, null);
  assert.equal(readAnswer("k=person&i=Q1&m=1&d=1&a=heard&y=nonsense")?.birthYear, null);
  assert.equal(readAnswer("k=person&i=Q1&m=1&d=1&a=heard&y=1200")?.birthYear, null);
});

test("a kind or an answer this site does not have is refused", () => {
  assert.equal(readAnswer("k=nonsense&i=1&m=9&d=7&a=remember"), null);
  assert.equal(readAnswer("k=person&i=1&m=9&d=7&a=downvote"), null,
    "there is deliberately no way to say a thing did not matter");
});

test("an impossible date is refused before it reaches the database", () => {
  assert.equal(readAnswer("k=person&i=1&m=13&d=7&a=heard"), null);
  assert.equal(readAnswer("k=person&i=1&m=9&d=0&a=heard"), null);
  assert.equal(readAnswer("k=person&i=1&m=x&d=7&a=heard"), null);
});

test("an empty or absurd identifier is refused", () => {
  assert.equal(readAnswer("k=person&i=&m=9&d=7&a=heard"), null);
  assert.equal(readAnswer(`k=person&i=${"x".repeat(65)}&m=9&d=7&a=heard`), null);
});

test("the rate limit lets a person answer a page and stops a script", () => {
  const now = Date.now();
  let allowed = 0;
  for (let i = 0; i < 60; i++) if (underLimit("1.2.3.4", now)) allowed++;
  assert.equal(allowed, 40, "forty in a minute is more rows than a date has");
});

test("the limit is per address and forgets after the window", () => {
  const now = Date.now();
  for (let i = 0; i < 60; i++) underLimit("5.6.7.8", now);
  assert.ok(underLimit("9.9.9.9", now), "somebody else is not punished");
  assert.ok(underLimit("5.6.7.8", now + 61_000), "and a minute later neither are you");
});

test("a researched fact can be answered, which it could not before", () => {
  // birth_fact was missing from KINDS while the timeline drew buttons on those
  // rows, so every answer given on a researched fact came back 400 and the
  // reader was shown "No." with nothing on screen saying why.
  const answer = readAnswer("k=birth_fact&i=812&m=9&d=7&a=never");
  assert.equal(answer?.kind, "birth_fact");
  assert.equal(answer?.id, "812");
});

test("every kind the timeline draws is a kind the server accepts", () => {
  // The three the merged timeline actually pushes. A kind the page renders and
  // the server refuses is invisible from either side on its own.
  for (const kind of ["historical_event", "birth_fact", "cultural_event"]) {
    assert.ok(readAnswer(`k=${kind}&i=1&m=9&d=7&a=heard`) !== null, `${kind} was refused`);
  }
});

test("a saved birth year is read back and a hand edited one is not", () => {
  assert.equal(yearFromCookie("bt=abcdefghijklmnop; by=1994"), 1994);
  assert.equal(yearFromCookie("by=1899"), null);
  assert.equal(yearFromCookie("by=2101"), null);
  assert.equal(yearFromCookie("by=nineteen"), null);
  assert.equal(yearFromCookie("bt=abcdefghijklmnop"), null);
  assert.equal(yearFromCookie(undefined), null);
});

test("only a well formed kept marker may spend a database call", () => {
  assert.deepEqual(keptFrom("kept=historical_event:7214"), { kind: "historical_event", id: "7214" });
  assert.deepEqual(keptFrom("kept=person:Q42"), { kind: "person", id: "Q42" });
  assert.equal(keptFrom("kept=nonsense:1"), null, "an unknown kind reaches nothing");
  assert.equal(keptFrom("kept=person:"), null);
  assert.equal(keptFrom(`kept=person:${"x".repeat(65)}`), null);
  assert.equal(keptFrom("kept=person"), null);
  assert.equal(keptFrom(""), null);
  assert.equal(keptFrom(undefined), null);
});

test("the result draws the three answers and says how many there were", () => {
  const html = resultMarkup({ there: 0, remembers: 3, heard: 0, never: 40 });
  assert.ok(html.includes("I remember it"));
  assert.ok(html.includes("Heard of it"));
  assert.ok(html.includes("Never heard of it"));
  assert.ok(html.includes("43 answers so far"));
  assert.equal(html.includes("I was there"), false, "not offered, and nobody gave it");
});

test("an answer the site stopped offering is still drawn when somebody gave it", () => {
  // Or the numbers under a row do not add up to the total printed beside them.
  const html = resultMarkup({ there: 9, remembers: 3, heard: 0, never: 40 });
  assert.ok(html.includes("I was there"));
  assert.ok(html.includes("52 answers so far"));
});

test("a row nobody has answered draws nothing at all", () => {
  assert.equal(resultMarkup({ there: 0, remembers: 0, heard: 0, never: 0 }), "");
});

test("one answer is one answer and not one answers", () => {
  assert.ok(resultMarkup({ there: 0, remembers: 1, heard: 0, never: 0 }).includes("1 answer so far"));
});

test("a result identifier is safe to put in an id attribute", () => {
  assert.equal(resultId("historical_event", "7214"), "rr-historical_event-7214");
  assert.equal(resultId("person", "Q42"), "rr-person-Q42");
  // Cultural rows carry identifiers this site did not choose.
  assert.match(resultId("cultural_event", "a b\"c<d"), /^[A-Za-z0-9_-]+$/);
});
