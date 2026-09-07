import test from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, pickHighlights, saysTheSameThing, splitDatePrefix, theRest } from "../src/timeline.js";
import { culturalByDate, culturalForDate, splitDate, textOf, type CulturalEvent } from "../src/culture.js";
import { cardHighlight, renderShareCard } from "../src/share.js";

/**
 * The twelve pairs on September 4 where a researched fact and a Wikipedia
 * event landed on the same year. Seven are the same event and five are not.
 * These are the real sentences from the database, not invented ones, because
 * the whole question is whether the measure separates the pairs that actually
 * occur rather than the pairs that are easy to imagine.
 */
const SAME = [
  [
    "Spanish settlers established the settlement that grew into the city of Los Angeles.",
    "Los Angeles is founded as El Pueblo de Nuestra Señora La Reina de los Ángeles (The Village of Our Lady, the Queen of the Angels) by 44 Spanish settlers.",
  ],
  [
    "Thomas Edison opened Pearl Street Station in New York City, establishing the first commercial power plant in the United States.",
    "The Pearl Street Station in New York City becomes the first power plant to supply electricity to paying customers.",
  ],
  [
    "George Eastman registered the trademark Kodak and received a patent for his camera utilizing roll film.",
    "George Eastman registers the trademark Kodak and receives a patent for his camera that uses roll film.",
  ],
  [
    "The rigid airship USS Shenandoah made its maiden flight.",
    "Maiden flight of the first U.S. airship, the USS Shenandoah.",
  ],
  [
    "The first live transcontinental television broadcast in the United States was transmitted across the nation.",
    "The first live transcontinental television broadcast takes place in San Francisco, United States, from the Japanese Peace Treaty Conference.",
  ],
  [
    "Swimmer Mark Spitz became the first athlete to win seven gold medals at a single Olympic Games.",
    "Mark Spitz becomes the first competitor to win seven medals at a single Olympic Games.",
  ],
  [
    "Larry Page and Sergey Brin formally incorporated Google as a company.",
    "Google is founded by Larry Page and Sergey Brin, two PhD students at Stanford University.",
  ],
];

const DIFFERENT = [
  [
    "Cartoonist Mort Walker published the first comic strip featuring the character Beetle Bailey.",
    "Darlington Raceway is the site of the inaugural Southern 500, the first 500-mile NASCAR race.",
  ],
  [
    "The Ford Motor Company introduced the Edsel to the public on a widely promoted marketing date dubbed E-Day.",
    "American Civil Rights Movement: Little Rock Crisis: The governor of Arkansas calls out the National Guard to prevent African American students from enrolling in Little Rock Central High School, resulting in the lawsuit Cooper v. Aaron the following year.",
  ],
  [
    "The United States launched Orbiting Geophysical Observatory 1 to observe Earth's magnetosphere.",
    "Scotland's Forth Road Bridge near Edinburgh officially opens.",
  ],
  [
    "Swimmer Mark Spitz became the first athlete to win seven gold medals at a single Olympic Games.",
    "The Price Is Right premieres on CBS. It currently is the longest running game show on American television.",
  ],
  [
    "Kelly Clarkson won the finale of the inaugural season of American Idol.",
    "The Oakland Athletics win their 20th consecutive game, an American League record, until the Cleveland Indians surpassed it in 2017.",
  ],
];

test("the same event written twice is recognised as one event", () => {
  for (const [fact, event] of SAME) {
    assert.ok(
      saysTheSameThing(fact ?? "", event ?? ""),
      `should have matched:\n  ${fact}\n  ${event}`,
    );
  }
});

test("two different events in the same year stay two events", () => {
  for (const [fact, event] of DIFFERENT) {
    assert.ok(
      !saysTheSameThing(fact ?? "", event ?? ""),
      `should not have matched:\n  ${fact}\n  ${event}`,
    );
  }
});

test("the comparison is symmetrical", () => {
  // Overlap is measured against the shorter sentence, so the order of the
  // arguments must not change the answer.
  for (const [a, b] of [...SAME, ...DIFFERENT]) {
    assert.equal(saysTheSameThing(a ?? "", b ?? ""), saysTheSameThing(b ?? "", a ?? ""));
  }
});

test("an empty sentence matches nothing", () => {
  assert.equal(saysTheSameThing("", "Google is founded by Larry Page."), false);
  assert.equal(saysTheSameThing("a of to", "Google is founded by Larry Page."), false);
});

test("the date comes off the front and the year comes back", () => {
  const { year, text } = splitDatePrefix(
    "On September 4, 1998, Larry Page and Sergey Brin formally incorporated Google as a company.",
    "September",
    4,
  );
  assert.equal(year, 1998);
  assert.equal(text, "Larry Page and Sergey Brin formally incorporated Google as a company.");
});

test("a lower case first word is raised, and only the first letter", () => {
  const { text } = splitDatePrefix(
    "On September 4, 1752, the date never occurred in Great Britain or its colonies.",
    "September",
    4,
  );
  assert.equal(text, "The date never occurred in Great Britain or its colonies.");

  const phone = splitDatePrefix("On June 29, 2007, iPhone went on sale.", "June", 29);
  assert.equal(phone.text, "IPhone went on sale.", "known limit: a lower case brand is raised too");
});

test("a sentence that is not about this page's date is left exactly alone", () => {
  const other = "On September 5, 1998, something else happened entirely.";
  assert.deepEqual(splitDatePrefix(other, "September", 4), { year: null, text: other });

  const undated = "Kelly Clarkson won American Idol.";
  assert.deepEqual(splitDatePrefix(undated, "September", 4), { year: null, text: undated });
});

test("the merged list drops the duplicates and keeps everything else", () => {
  const facts = [
    { month: 9, day: 4, category: "event", sourceUrl: "https://example.com/google",
      fact: "On September 4, 1998, Larry Page and Sergey Brin formally incorporated Google as a company." },
    { month: 9, day: 4, category: "event", sourceUrl: "https://example.com/edsel",
      fact: "On September 4, 1957, the Ford Motor Company introduced the Edsel to the public." },
  ];
  const events = [
    { month: 9, day: 4, year: 1998, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "Google is founded by Larry Page and Sergey Brin, two PhD students at Stanford University." },
    { month: 9, day: 4, year: 1957, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "Little Rock Crisis: The governor of Arkansas calls out the National Guard." },
    { month: 9, day: 4, year: 1882, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
      description: "The Pearl Street Station in New York City becomes the first power plant." },
  ];

  const rows = buildTimeline(facts, events, "September", 4);

  assert.equal(rows.length, 4, "one of five is a duplicate of another");
  assert.deepEqual(rows.map((row) => row.year), [1882, 1957, 1957, 1998], "ordered by year");
  assert.equal(rows.filter((row) => row.text.includes("Google")).length, 1, "Google is founded once");
  // The researched fact survives the collision, not Wikipedia's line.
  assert.ok(rows.some((row) => row.text.startsWith("Larry Page and Sergey Brin formally")));
  // Little Rock is a different event in a year a fact already covers, and must
  // survive. Dropping by year alone would have lost it.
  assert.ok(rows.some((row) => row.text.includes("Little Rock")));
});

test("a fact with no year sorts last rather than first", () => {
  const facts = [
    { month: 9, day: 4, category: "event", sourceUrl: "https://example.com/a",
      fact: "Something true about this date with no year in it." },
    { month: 9, day: 4, category: "event", sourceUrl: "https://example.com/b",
      fact: "On September 4, 1998, Google was incorporated." },
  ];
  const rows = buildTimeline(facts, [], "September", 4);
  assert.deepEqual(rows.map((row) => row.year), [1998, null]);
});

test("a Wikipedia row carries no per row source, and a fact does", () => {
  const facts = [{ month: 9, day: 4, category: "event", sourceUrl: "https://example.com/a",
    fact: "On September 4, 1998, Google was incorporated." }];
  const events = [{ month: 9, day: 4, year: 1882, sourceUrl: "https://en.wikipedia.org/wiki/September_4",
    description: "The Pearl Street Station in New York City becomes the first power plant." }];
  const rows = buildTimeline(facts, events, "September", 4);
  assert.equal(rows.find((row) => row.year === 1882)?.sourceUrl, null);
  assert.equal(rows.find((row) => row.year === 1998)?.sourceUrl, "https://example.com/a");
});

/**
 * What goes on a birthday card.
 *
 * These tests exist because of a number rather than a worry. 41 percent of the
 * 19,734 imported Wikipedia events match the refusal list, all 366 dates have
 * at least one that does, and picking the most recent event per date would put
 * a killing, a bombing or a crash on 134 of the 366 cards. September 4's most
 * recent event is a school shooting.
 */
test("nothing grim reaches a birthday card", () => {
  const grim = [
    { month: 9, day: 4, category: "event", sourceUrl: "https://e.com/a",
      fact: "On September 4, 2024, a gunman kills four people at a high school in Georgia." },
    { month: 9, day: 4, category: "event", sourceUrl: "https://e.com/b",
      fact: "On September 4, 1995, three servicemen abduct and rape a schoolchild in Okinawa." },
    { month: 9, day: 4, category: "event", sourceUrl: "https://e.com/c",
      fact: "On September 4, 1963, Swissair Flight 306 crashes, killing all 80 on board." },
  ];
  assert.equal(cardHighlight(grim, [], 9, 4), null, "a card with none of these is the right card");
});

test("the card takes the shortest clean fact, and the same one every build", () => {
  const facts = [
    { month: 9, day: 4, category: "event", sourceUrl: "https://e.com/a",
      fact: "On September 4, 1882, Thomas Edison opened Pearl Street Station in New York City, establishing the first commercial power plant in the United States." },
    { month: 9, day: 4, category: "event", sourceUrl: "https://e.com/b",
      fact: "On September 4, 1998, Larry Page and Sergey Brin formally incorporated Google as a company." },
    { month: 9, day: 4, category: "event", sourceUrl: "https://e.com/c",
      fact: "On September 4, 1963, Swissair Flight 306 crashes, killing all 80 on board." },
  ];
  const chosen = cardHighlight(facts, [], 9, 4);
  assert.equal(chosen?.year, 1998);
  assert.equal(chosen?.text, "Larry Page and Sergey Brin formally incorporated Google as a company.");
  // The Edison line is clean but too long for one line on a card, and the
  // Swissair line is refused whatever its length.
  assert.deepEqual(cardHighlight(facts, [], 9, 4), cardHighlight([...facts].reverse(), [], 9, 4));
});

test("a date with no facts gets a card with no line, not a worse line", () => {
  assert.equal(cardHighlight([], [], 9, 4), null);
});

test("a fact that does not name this page's date is not put on the card", () => {
  const facts = [
    { month: 9, day: 4, category: "event", sourceUrl: "https://e.com/a",
      fact: "Something true with no year anywhere in it." },
  ];
  assert.equal(cardHighlight(facts, [], 9, 4), null, "the card prints a year beside the line");
});

test("a card that says what happened does not also list names", () => {
  // The names are ordered by attention and infamy is attention. Ted Bundy led
  // November 24's card and Assad led September 11's, and no word list would
  // have caught the second: Wikidata calls him a politician. A card with
  // something that happened on it does not need the names at all.
  const people = [
    { qid: "Q1", name: "Bashar al-Assad", birthYear: 1965, deathYear: null, description: "Syrian politician", monthlyViews: 900000 },
  ];
  const card = renderShareCard(
    { month: 9, day: 11, people },
    { year: 1967, text: "The Carol Burnett Show premiered on CBS." },
  );
  assert.ok(card.includes("The Carol Burnett Show premiered on CBS."));
  assert.ok(!card.includes("Assad"), "no names on a card that has something to say");
  assert.ok(!card.includes("You share it with"));
});

test("a card with nothing that happened still shows the names it has", () => {
  const people = [
    { qid: "Q2", name: "Somebody Ordinary", birthYear: 1980, deathYear: null, description: "actor", monthlyViews: 10 },
  ];
  const card = renderShareCard({ month: 12, day: 25, people }, null);
  assert.ok(card.includes("Somebody Ordinary"));
  assert.ok(card.includes("You share it with"));
});

test("with no researched fact, a screened Wikipedia line beats the names", () => {
  // The 85 dates the backfill never reached fell through to names, and the
  // names are ordered by attention. November 12 led with Charles Manson and
  // November 24 with Ted Bundy. This is what replaces them, at no cost.
  const events = [
    { month: 11, day: 12, year: 1927, sourceUrl: "https://en.wikipedia.org/wiki/November_12",
      description: "Leon Trotsky is expelled from the Soviet Communist Party, leaving Joseph Stalin in undisputed control." },
    { month: 11, day: 12, year: 1970, sourceUrl: "https://en.wikipedia.org/wiki/November_12",
      description: "The Bhola cyclone kills an estimated 500,000 people." },
    { month: 11, day: 12, year: 2020, sourceUrl: "https://en.wikipedia.org/wiki/November_12",
      description: "The PlayStation 5 is released." },
  ];
  const chosen = cardHighlight([], events, 11, 12);
  assert.equal(chosen?.year, 2020);
  assert.equal(chosen?.text, "The PlayStation 5 is released.");
});

test("the encyclopedia's habits are screened harder than the researched facts", () => {
  // An event's sentence describes the thing being refused, which is why
  // screening works on events and cannot work on people.
  const events = [
    { month: 7, day: 14, year: 1789, sourceUrl: "https://e.com",
      description: "Citizens storm the Bastille, and troops are deposed in the rebellion." },
    { month: 7, day: 14, year: 1867, sourceUrl: "https://e.com",
      description: "Alfred Nobel demonstrates dynamite for the first time." },
  ];
  assert.equal(cardHighlight([], events, 7, 14)?.year, 1867);
});

test("a researched fact still beats a Wikipedia line when there is one", () => {
  const facts = [{ month: 11, day: 12, category: "event", sourceUrl: "https://e.com/a",
    fact: "On November 12, 1990, the World Wide Web proposal was published." }];
  const events = [{ month: 11, day: 12, year: 2020, sourceUrl: "https://e.com",
    description: "The PlayStation 5 is released." }];
  assert.equal(cardHighlight(facts, events, 11, 12)?.year, 1990);
});

test("a date with neither still falls through to nothing, not to something worse", () => {
  assert.equal(cardHighlight([], [], 12, 25), null);
});


// ---------------------------------------------------------------------------
// Picking the handful. Forty three things on a page is everything anybody
// knows about a date and nothing anybody reads, so six of them go in front.
// What must never happen is that the other thirty seven quietly disappear.

function row(year: number, researched = true) {
  return {
    year,
    text: `something in ${year}`,
    sourceUrl: researched ? `https://example.org/${year}` : null,
    category: researched ? "event" : null,
  };
}

test("a date with fewer things than the count keeps all of them", () => {
  const rows = [row(1900), row(1950), row(2000)];
  assert.deepEqual(pickHighlights(rows, 6), rows);
  assert.deepEqual(theRest(rows, pickHighlights(rows, 6)), []);
});

test("the oldest and the newest are always among the picked", () => {
  const rows = [1800, 1850, 1900, 1925, 1950, 1975, 2000, 2010, 2020].map((y) => row(y));
  const picked = pickHighlights(rows, 6);
  assert.equal(picked.length, 6);
  assert.equal(picked[0]?.year, 1800, "the oldest thing on the date is never cut");
  assert.equal(picked[picked.length - 1]?.year, 2020, "nor the newest");
});

test("the picked are spread across the years rather than taken off the top", () => {
  const rows = Array.from({ length: 40 }, (unused, index) => row(1600 + index * 10));
  const picked = pickHighlights(rows, 6);
  // Six taken off the top would all sit in the first sixty years. These do not.
  const span = (picked[picked.length - 1]?.year ?? 0) - (picked[0]?.year ?? 0);
  assert.equal(span, 390, "the picked cover the whole range the date does");
});

test("the same row is never picked twice", () => {
  for (let size = 2; size <= 12; size++) {
    const rows = Array.from({ length: size }, (unused, index) => row(1900 + index));
    const picked = pickHighlights(rows, 6);
    assert.equal(new Set(picked).size, picked.length, `${size} rows produced a repeat`);
  }
});

test("the researched facts are preferred, because their sources were checked", () => {
  const rows = [
    row(1900, false), row(1910, false), row(1920, false), row(1930, false),
    row(1940, true), row(1950, true), row(1960, true),
    row(1970, true), row(1980, true), row(1990, true),
  ];
  const picked = pickHighlights(rows, 6);
  assert.ok(picked.every((r) => r.sourceUrl !== null), "a Wikipedia line was taken over a checked one");
});

test("a date nobody researched still gets a feed rather than an empty section", () => {
  const rows = [1900, 1950, 2000, 2010, 2020, 2021, 2022].map((y) => row(y, false));
  const picked = pickHighlights(rows, 6);
  assert.equal(picked.length, 6, "falling back to the whole list is what stops the section vanishing");
});

test("everything not picked is handed back, so nothing is lost", () => {
  const rows = Array.from({ length: 43 }, (unused, index) => row(1000 + index * 20));
  const picked = pickHighlights(rows, 6);
  const rest = theRest(rows, picked);
  assert.equal(picked.length + rest.length, 43);
  assert.equal(new Set([...picked, ...rest]).size, 43, "a row went missing between the two lists");
});

test("the oldest thing on the date leads, even when Wikipedia is the one who found it", () => {
  // September 4 in miniature. The researcher's oldest is 1752; the oldest
  // thing that happened is the end of the Western Roman Empire, which came
  // from Wikipedia. Preferring checked sources is right for the body of the
  // feed and wrong for the sentence at the top of it.
  const rows = [
    row(476, false),
    ...[1752, 1781, 1882, 1923, 1957, 1972, 1993, 1998].map((y) => row(y, true)),
  ];
  const picked = pickHighlights(rows, 6);
  assert.equal(picked[0]?.year, 476, "the best sentence on the page was filed behind a source rule");
  assert.equal(picked.length, 6);
  assert.equal(new Set(picked).size, 6);
  // And it is still on the page exactly once, not in both lists.
  assert.ok(!theRest(rows, picked).some((r) => r.year === 476));
});

// ---------------------------------------------------------------------------
// The curated rows.

const curated = (over: Partial<CulturalEvent> = {}): CulturalEvent => ({
  month: 9, day: 4, year: 1998,
  title: "Google is founded",
  context: "Two Stanford students filed the paperwork. The search box had one button on it.",
  sourceUrl: "https://en.wikipedia.org/wiki/Google",
  category: "tech",
  ...over,
});

test("a curated row carries its own category into the timeline", () => {
  const rows = buildTimeline([], [], "September", 4, [curated()]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.category, "tech");
  assert.equal(rows[0]?.year, 1998);
  assert.match(rows[0]?.text ?? "", /Stanford/);
});

// The whole reason this table exists is that Wikipedia's sentence reads like
// Wikipedia. Printing both is worse than printing either.
test("a curated row beats the Wikipedia line that says the same thing", () => {
  const rows = buildTimeline(
    [],
    [{ month: 9, day: 4, year: 1998, description: "Google is founded.", sourceUrl: "https://en.wikipedia.org/wiki/September_4" }],
    "September", 4,
    [curated({ context: null })],
  );
  assert.equal(rows.length, 1, "the same thing must not print twice");
  assert.equal(rows[0]?.category, "tech", "and the curated one is the survivor");
});

// Found by rendering a page rather than by reasoning about it: the printed
// text is the context, which is written not to sound like Wikipedia, so it is
// the title that has to be matched against the encyclopedia line.
test("the title suppresses the duplicate even when the printed sentence does not", () => {
  const rows = buildTimeline(
    [],
    [{ month: 9, day: 4, year: 1998, description: "Google is founded.", sourceUrl: "w" }],
    "September", 4,
    [curated()],
  );
  assert.equal(rows.length, 1, "the context reads nothing like the Wikipedia line, and it still has to win");
  assert.match(rows[0]?.text ?? "", /Stanford/);
});

test("a curated row leaves an unrelated event alone", () => {
  const rows = buildTimeline(
    [],
    [{ month: 9, day: 4, year: 1998, description: "A hurricane made landfall in Florida.", sourceUrl: "x" }],
    "September", 4,
    [curated()],
  );
  assert.equal(rows.length, 2);
});

test("the sentence somebody wrote wins over the title, and the title is the floor", () => {
  assert.match(textOf(curated()), /Stanford/);
  assert.equal(textOf(curated({ context: null })), "Google is founded");
  assert.equal(textOf(curated({ context: "   " })), "Google is founded");
});

// January 1 is already where a birth date nobody recorded ends up. A date this
// cannot read must not quietly join them.
test("an unreadable date is dropped rather than defaulted", () => {
  assert.equal(splitDate("2011-11-18")?.day, 18);
  assert.equal(splitDate("not a date"), null);
  assert.equal(splitDate("2011-13-01"), null);
  assert.equal(splitDate("2011-11-00"), null);
});

test("rows are found by month and day, whatever year they are in", () => {
  const byDate = culturalByDate([curated(), curated({ year: 2004, title: "Firefox 1.0", month: 11, day: 9 })]);
  assert.equal(culturalForDate(byDate, 9, 4).length, 1);
  assert.equal(culturalForDate(byDate, 11, 9).length, 1);
  assert.equal(culturalForDate(byDate, 2, 30).length, 0);
});
