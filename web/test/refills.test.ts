// Buzzes that refill through the day, docs/the-wall.md section 30. The
// instants here are the ones migration 20260923010000_buzzes_that_refill.sql
// was tested against inside a rolled back transaction on September 23,
// 2026, so the page's arithmetic and the database's agree at every one.
import { strict as assert } from "node:assert";
import { test } from "node:test";

import { REFILLS_ON, arrivedBy, dayRefills, nextRefill, nextRefillWords, refillWords } from "../src/refills.js";
import { BEE, PLAIN, freshLeft, tapsLeftSentence, type WallDay } from "../src/wall.js";

const D = "2026-09-23";
const at = (iso: string): number => Date.parse(iso);

function day(): WallDay {
  return {
    wallDate: D, year: 2026, month: 9, day: 23,
    opensAt: "2026-09-22T04:00:00Z", liveAt: "2026-09-23T04:00:00Z", closesAt: "2026-09-25T04:00:00Z", closedAt: null,
    stories: [], boosts: [],
  };
}

test("the pages say nothing about refills until the migration is applied", () => {
  assert.equal(REFILLS_ON, false, "flip with the migration, docs/the-wall.md section 30");
  assert.equal(nextRefillWords(at("2026-09-23T05:00:00Z"), D, 3), "");
  assert.equal(freshLeft(day(), at("2026-09-23T05:00:00Z")), 3, "three at 1 am, as the database still gives");
  assert.equal(tapsLeftSentence(3, 3, BEE, nextRefillWords(at("2026-09-23T05:00:00Z"), D, 3)), "Three buzzes left today.");
});

test("what has arrived by an instant, daylight time, is the database's answer", () => {
  assert.equal(arrivedBy(at("2026-09-23T04:00:00Z"), D), 1, "midnight Eastern");
  assert.equal(arrivedBy(at("2026-09-23T11:59:59Z"), D), 1, "7:59 am");
  assert.equal(arrivedBy(at("2026-09-23T12:00:00Z"), D), 2, "8 am");
  assert.equal(arrivedBy(at("2026-09-23T19:59:59Z"), D), 2, "3:59 pm");
  assert.equal(arrivedBy(at("2026-09-23T20:00:00Z"), D), 3, "4 pm");
  assert.equal(arrivedBy(at("2026-09-24T03:59:59Z"), D), 3, "11:59 pm");
  assert.equal(arrivedBy(at("2026-09-24T04:00:00Z"), D), 1, "the day after, its one");
  assert.equal(arrivedBy(at("2026-09-24T21:00:00Z"), D), 1, "the day after at 5 pm, still one");
  assert.equal(arrivedBy(at("2026-09-23T03:59:59Z"), D), 0, "the day before");
  assert.equal(arrivedBy(at("2026-09-25T04:00:00Z"), D), 0, "two days on");
});

test("standard time: 8 am Eastern is 13:00 in coordinated universal time", () => {
  assert.equal(arrivedBy(at("2026-12-23T12:59:59Z"), "2026-12-23"), 1);
  assert.equal(arrivedBy(at("2026-12-23T13:00:00Z"), "2026-12-23"), 2);
  assert.equal(arrivedBy(at("2026-12-23T21:00:00Z"), "2026-12-23"), 3);
  assert.equal(nextRefill(at("2026-12-23T05:00:00Z"), "2026-12-23"), at("2026-12-23T13:00:00Z"));
});

test("the next refill is the database's answer, and none on the day after", () => {
  assert.equal(nextRefill(at("2026-09-23T04:00:00Z"), D), at("2026-09-23T12:00:00Z"));
  assert.equal(nextRefill(at("2026-09-23T12:00:00Z"), D), at("2026-09-23T20:00:00Z"));
  assert.equal(nextRefill(at("2026-09-23T20:00:00Z"), D), at("2026-09-24T04:00:00Z"));
  assert.equal(nextRefill(at("2026-09-24T05:00:00Z"), D), null);
  assert.deepEqual(dayRefills(at("2026-09-23T04:00:00Z"), D), [at("2026-09-23T12:00:00Z"), at("2026-09-23T20:00:00Z")]);
  assert.deepEqual(dayRefills(at("2026-09-23T13:00:00Z"), D), [at("2026-09-23T20:00:00Z")]);
  assert.deepEqual(dayRefills(at("2026-09-23T21:00:00Z"), D), [], "the midnight that starts the day after is the day changing, not a refill");
});

test("the day the clocks go back: 8 am Eastern is still 8 am Eastern", () => {
  // November 1, 2026 is the first Sunday of November; clocks go back at 2 am.
  const fall = "2026-11-01";
  const eight = nextRefill(at("2026-11-01T04:00:00Z"), fall)!;
  assert.equal(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date(eight)), "08");
  assert.equal(eight, at("2026-11-01T13:00:00Z"), "8 am Eastern Standard Time");
  assert.equal(arrivedBy(at("2026-11-01T12:30:00Z"), fall), 1, "7:30 am EST, one");
  assert.equal(arrivedBy(at("2026-11-01T13:00:00Z"), fall), 2);
});

test("the words", () => {
  assert.equal(refillWords(at("2026-09-23T12:00:00Z")), "8 am Eastern");
  assert.equal(refillWords(at("2026-09-23T20:00:00Z")), "4 pm Eastern");
  assert.equal(refillWords(at("2026-09-24T04:00:00Z")), "midnight Eastern");
  assert.equal(nextRefillWords(at("2026-09-23T05:00:00Z"), D, 3, true), "8 am Eastern");
  assert.equal(nextRefillWords(at("2026-09-23T13:00:00Z"), D, 3, true), "4 pm Eastern");
  assert.equal(nextRefillWords(at("2026-09-23T21:00:00Z"), D, 3, true), "", "after 4 pm nothing more arrives today");
  assert.equal(nextRefillWords(at("2026-09-24T13:00:00Z"), D, 1, true), "", "the day after has its one and no refill");
});

test("the count line with refills on: how many right now and when the next one comes", () => {
  assert.equal(tapsLeftSentence(0, 3, BEE, "4 pm Eastern"), "No buzzes left right now. The next one arrives at 4 pm Eastern.");
  assert.equal(tapsLeftSentence(1, 3, BEE, "8 am Eastern"), "One buzz left right now. The next one arrives at 8 am Eastern.");
  assert.equal(tapsLeftSentence(2, 3, PLAIN, "4 pm Eastern"), "Two taps left right now. The next one arrives at 4 pm Eastern.");
  // After 4 pm the words are "" and the day sentence is back.
  assert.equal(tapsLeftSentence(3, 3, BEE, ""), "Three buzzes left today.");
  assert.equal(tapsLeftSentence(0, 1, BEE, ""), "No buzzes left today on this date.");
  // A fresh browser at 1 am has one, at 9 am two, at 5 pm three.
  assert.equal(freshLeft(day(), at("2026-09-23T05:00:00Z"), true), 1);
  assert.equal(freshLeft(day(), at("2026-09-23T13:00:00Z"), true), 2);
  assert.equal(freshLeft(day(), at("2026-09-23T21:00:00Z"), true), 3);
  assert.equal(freshLeft(day(), at("2026-09-24T13:00:00Z"), true), 1, "the day after");
  assert.equal(freshLeft(day(), at("2026-09-26T13:00:00Z"), true), 0, "sealed");
});
