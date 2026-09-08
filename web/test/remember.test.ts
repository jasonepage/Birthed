import { strict as assert } from "node:assert";
import { test } from "node:test";
import { newToken, readAnswer, tokenFromCookie, underLimit } from "../src/serve.js";

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
