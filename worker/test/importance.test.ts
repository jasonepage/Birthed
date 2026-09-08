import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  gravityOf, importanceOf, memorialCount, rememberedFor, shapeOf,
} from "../src/importance.js";

const sig = (views: number, sitelinks: number, anniversary = false, observed = false, ownArticle = true) =>
  ({ views, sitelinks, anniversary, observed, ownArticle });

test("a commemorated national day outranks a bigger English audience", () => {
  // The case this file exists for. ESPN's article is read far more in English
  // than Brazil's independence, and Brazil's independence is what the seventh
  // of September is. Sitelinks and the observance have to be enough to fix it.
  const brazil = importanceOf(sig(40000, 70, false, true));
  const espn = importanceOf(sig(120000, 40, true, false));
  assert.ok(brazil > espn, `brazil ${brazil} should beat espn ${espn}`);
});

test("the anniversary list is worth a thumb, not the decision", () => {
  const listedButSmall = importanceOf(sig(900, 6, true, false));
  const unlistedAndLarge = importanceOf(sig(90000, 60, false, false));
  assert.ok(unlistedAndLarge > listedButSmall);
});

test("zero everything does not throw and scores nothing", () => {
  assert.equal(importanceOf(sig(0, 0)), 0);
});

test("a row measured on somebody else's fame is docked", () => {
  // Giuseppe Garibaldi entering Naples: a person and a city and no article
  // about the event. It finished sixth on September 7 on his fame alone.
  const borrowed = importanceOf(sig(44235, 130, false, false, false));
  const own = importanceOf(sig(36750, 45, true, false, true));
  assert.ok(own > borrowed, `the Blitz ${own} should beat Garibaldi ${borrowed}`);
});

test("the penalty is exactly three points and nothing else changes", () => {
  assert.equal(
    importanceOf(sig(1000, 20, true, true, true)) - importanceOf(sig(1000, 20, true, true, false)),
    3,
  );
});

test("negative counts are floored rather than producing NaN", () => {
  assert.ok(Number.isFinite(importanceOf(sig(-5, -5))));
});

test("one overwhelming event makes the day a single", () => {
  assert.equal(shapeOf([9.1, 5.0, 4.4]), "single");
});

test("several comparable events make the day a several", () => {
  assert.equal(shapeOf([7.2, 6.9, 6.1, 5.4]), "several");
});

test("a date where nothing clears the bar is quiet", () => {
  assert.equal(shapeOf([3.2, 2.9]), "quiet");
  assert.equal(memorialCount([3.2, 2.9]), 0);
});

test("an empty date is quiet rather than a crash", () => {
  assert.equal(shapeOf([]), "quiet");
  assert.equal(memorialCount([]), 0);
});

test("the memorial takes what is close to the top, not a fixed number", () => {
  assert.equal(memorialCount([8.0, 7.6, 7.1, 6.2, 3.0, 2.1]), 4);
});

test("the memorial is capped so it stays a memorial", () => {
  assert.equal(memorialCount([8, 7.9, 7.8, 7.7, 7.6, 7.5, 7.4, 7.3]), 6);
});

test("gravity leans sober when a row is ambiguous", () => {
  assert.equal(gravityOf("The Blitz begins, bombing London for 57 nights"), "grave");
  assert.equal(gravityOf("Georgi Markov is assassinated on Waterloo Bridge"), "grave");
  assert.equal(gravityOf("The last thylacine dies at the Hobart Zoo"), "grave");
  assert.equal(gravityOf("ESPN launches as the first 24 hour sports channel"), "notable");
  assert.equal(gravityOf("The first Miss America pageant is held"), "light");
});

test("the remembered-for line joins subjects and never invents one", () => {
  assert.equal(rememberedFor(["Brazil's independence"]), "Brazil's independence");
  assert.equal(rememberedFor(["a", "b"]), "a and b");
  assert.equal(rememberedFor(["a", "b", "c", "d"]), "a, b and c");
  assert.equal(rememberedFor([]), "");
  assert.equal(rememberedFor(["", "  "]), "");
});
