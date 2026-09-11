// The token machinery the hive now runs on.
//
// This file is named for the remembrance question, which is gone: its routes
// came off the server on September 11, 2026 and its answers are kept in the
// database exactly as they were. What is left here is the `bt` cookie, the
// per address limit and the birth year cookie, all three of which the wall
// uses, so the tests stayed and the name did not.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { newToken, projectBase, tokenFromCookie, underLimit, yearFromCookie } from "../src/serve.js";

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

test("a saved birth year is read back and a hand edited one is not", () => {
  assert.equal(yearFromCookie("bt=abcdefghijklmnop; by=1994"), 1994);
  assert.equal(yearFromCookie("by=1899"), null);
  assert.equal(yearFromCookie("by=2101"), null);
  assert.equal(yearFromCookie("by=nineteen"), null);
  assert.equal(yearFromCookie("bt=abcdefghijklmnop"), null);
  assert.equal(yearFromCookie(undefined), null);
});

test("the project is reachable without SUPABASE_URL being set anywhere", () => {
  // The bug this guards is the whole feature having done nothing on the live
  // site. render.yaml sets SUPABASE_ANON_KEY and does not set SUPABASE_URL,
  // because build.ts, og.ts and apiOrigin all carry the project address as a
  // fallback and never needed it. record() did not, so it returned false
  // before calling anything, and every reader who answered was told the date
  // was sealed. It was not sealed. Nothing was ever sent.
  const had = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  try {
    assert.equal(projectBase(), "https://lunqqhjwqrpbujwxwdzk.supabase.co");
  } finally {
    if (had !== undefined) process.env.SUPABASE_URL = had;
  }
});

test("a set project address wins and loses its trailing slashes", () => {
  const had = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = "https://example.supabase.co//";
  try {
    assert.equal(projectBase(), "https://example.supabase.co");
  } finally {
    if (had === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = had;
  }
});
