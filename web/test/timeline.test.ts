import test from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, saysTheSameThing, splitDatePrefix } from "../src/timeline.js";
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
