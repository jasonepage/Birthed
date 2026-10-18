import { strict as assert } from "node:assert";
import { test } from "node:test";
import { coverageScores, words, type CoverageInput } from "../src/wall/coverage.js";

// The news filed for October 18, 2026, as the feeds sent it, with the hour
// each arrived. The first eight held the board all day under the old order.
const DAY: Array<[string, string, string]> = [
  ["05", "polygon.com", "Every Major Game Releasing in November That Isn’t GTA 6"],
  ["05", "aljazeera.com", "UK police rule out probe into Palestine Action post by PM adviser’s wife"],
  ["05", "aljazeera.com", "Tunisia’s economic crisis deepens as the promise of a better life fades"],
  ["05", "theguardian.com", "‘I felt disgusted’: MEP speaks out over nude deepfakes and urges EU action"],
  ["05", "bbc.com", "Deaths confirmed in major fire at Canada military base"],
  ["05", "theguardian.com", "‘4,000 people minding our own business’: four decades on, Falklands again face a hostile Argentina"],
  ["05", "nasa.gov", "APOD: 2026 October 18 – Sonified: Eagle Nebula Pillars"],
  ["05", "sphinx-six-theta.vercel.app", "Show HN: Sphinx – a hook that quizzes you on your AI's code before shipping"],
  ["06", "bbc.com", "Violent clashes, looting and buildings ablaze in France as over 1,200 arrested after protests"],
  ["06", "aljazeera.com", "St Petersburg under attack from Ukrainian drone swarm"],
  ["07", "aljazeera.com", "AI tool helps stranded protesters find their way home in the Indian capital"],
  ["07", "polygon.com", "60 Years Ago, the Best Charlie Brown Quote Was So Perfect It Made It Into the Movie"],
  ["09", "aljazeera.com", "‘Young protesters across Europe share grievances and tactics’"],
  ["10", "aljazeera.com", "Rubio says Ukraine without access to Starshield, future ‘under discussion’"],
  ["11", "aljazeera.com", "Russia’s war in Ukraine puts Europe on edge"],
  ["11", "polygon.com", "13 Years Ago, Rockstar Suffered a Leak Worse Than GTA 6"],
  ["12", "theguardian.com", "‘We are suffocating’: protests spread to Lisbon and Milan as housing and living cost tensions intensify"],
  ["12", "bbc.com", "Parisians wake up to protest damage and looted shops"],
  ["12", "niemanlab.org", "Legal experts warn Meta's new terms still grant broad scraping permissions"],
  ["12", "anthropic.com", "How employment is changing at Anthropic"],
  ["13", "bbc.com", "European diplomats attacked by Israeli settlers in West Bank"],
  ["13", "theguardian.com", "Microsoft drops huge AI datacentre project in Essex over power supply concerns"],
  ["14", "aljazeera.com", "Paris left reeling as student-led protests turn chaotic"],
  ["14", "theverge.com", "Trump says Google kisses his ass"],
  ["14", "aljazeera.com", "Gaza families fear food shortages as Israel halts commercial shipments"],
  ["15", "tomshardware.com", "Anthropic's proposed AI safety bill only kicks in if 50 deaths or $1B in damages"],
  ["16", "theguardian.com", "French government in crisis talks after ‘colossal failure of the state’"],
  ["16", "aljazeera.com", "A timeline of West Bank attacks on Palestinians and foreign officials"],
  ["16", "theguardian.com", "Multiple people killed as Canadian authorities tackle active blaze at Alberta military base"],
  ["16", "polygon.com", "13 Years Ago, 'The Legend of Korra' Finally Answered the Biggest Avatar Mystery"],
  ["17", "aljazeera.com", "Trump endorses Netanyahu in Israeli legislative elections"],
  ["18", "arstechnica.com", "Anthropic gives outside AI watchdog “employee-like” access"],
  ["18", "theguardian.com", "Trump ‘border czar’ says Ilhan Omar could be ‘of course’ denaturalized and deported"],
  ["18", "liveandletsfly.com", "British Airways: Filming Crew W Meta Glasses Could Get Your Tickets Cancelled"],
  ["19", "theguardian.com", "Guardian reporter filmed masked militants seconds before West Bank attack on French mayor"],
  ["20", "bbc.com", "Macron calls for calm in France and warns rioting must not escalate"],
  ["20", "theguardian.com", "Outrage after Meta suspends No Kings Instagram account during protests"],
  ["20", "polygon.com", "New Steam Game is Basically Kiki’s Delivery Service in Video Game Form"],
];

const stories: CoverageInput[] = DAY.map(([hour, outlet, headline], i) => ({ id: `s${i}`, outlet, headline, submittedAt: `2026-10-18T${hour}:01:00Z` }));
const top = (n: number): string[] => [...coverageScores(stories)].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => stories[Number(id.slice(1))]!.headline);

test("words: demonyms find their country, plurals fold, and furniture is dropped", () => {
  assert.ok(words("French government in crisis talks").has("france"));
  assert.ok(words("Parisians wake up to protest damage").has("paris"));
  assert.ok(words("Young protesters across Europe").has("protest"));
  assert.ok(!words("Trump says Google kisses his ass").has("says"));
});

test("the day's biggest story reaches the top eight, and the November games list does not", () => {
  const eight = top(8);
  assert.ok(eight.some((h) => /France|Paris|French/.test(h) && /protest|riot|clash|crisis/i.test(h)), eight.join("\n"));
  assert.ok(!eight.includes("Every Major Game Releasing in November That Isn’t GTA 6"), eight.join("\n"));
  assert.ok(!eight.some((h) => h.startsWith("13 Years Ago")), "one outlet repeating itself is not coverage");
});

test("the eight are mostly different stories, not one riot eight times", () => {
  const eight = top(8);
  const france = eight.filter((h) => /France|Paris|French/.test(h)).length;
  assert.ok(france <= 3, eight.join("\n"));
});

test("newer beats older among equals, every score is at least ten, and an empty day is empty", () => {
  const two = coverageScores([
    { id: "old", outlet: "a.com", headline: "Lighthouse keeper retires", submittedAt: "2026-10-18T05:00:00Z" },
    { id: "new", outlet: "b.com", headline: "Orchard harvest begins", submittedAt: "2026-10-18T20:00:00Z" },
  ]);
  assert.ok(two.get("new")! > two.get("old")!);
  assert.ok([...coverageScores(stories).values()].every((v) => v >= 10));
  assert.equal(coverageScores([]).size, 0);
});
