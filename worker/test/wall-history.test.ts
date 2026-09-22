import { strict as assert } from "node:assert";
import { test } from "node:test";

import { PRIORITY_HISTORY, PRIORITY_PERSON, PRIORITY_PICK, PRIORITY_SONG, hivePeoplePath, mayLead, monthDay, monthDayOf, personHeadline, planHistory, planSongs, songsOn, withoutStatedYears, type DateHistory, type Dropped, type PersonRow, type SongRow } from "../src/wall/history.js";
import { allocate, type StoryInput } from "../src/wall/allocator.js";
import { changesFor } from "../src/wall/repair-person-headlines.js";

function history(overrides: Partial<DateHistory> = {}): DateHistory {
  return {
    events: [
      { id: 1, event_year: 1957, description: "Ford unveiled the Edsel to the public.", source_url: "https://en.wikipedia.org/wiki/September_4" },
      { id: 2, event_year: 1888, description: "George Eastman registers the trademark Kodak.", source_url: "https://en.wikipedia.org/wiki/September_4" },
      { id: 3, event_year: 2001, description: "A bombing killed forty people in the capital.", source_url: "https://en.wikipedia.org/wiki/September_4" },
      { id: 4, event_year: 1200, description: "Short.", source_url: "https://en.wikipedia.org/wiki/September_4" },
    ],
    facts: [{ id: 9, fact: "The first Wii console went on sale in Japan on this date.", source_url: "https://example.org/wii" }],
    culture: [
      { id: 11, event_date: "2015-09-04", context_string: "Nintendo shipped the level editor and people spent a decade making levels.", source_url: "https://example.org/mm", origin: "curated" },
      { id: 12, event_date: "2009-09-04", context_string: null, source_url: "https://example.org/mn", origin: "imported" },
    ],
    people: [
      { wikidata_qid: "Q1", name: "Anton Bruckner", birth_year: 1824, death_year: 1896, short_description: "Austrian composer" },
      { wikidata_qid: "Q2", name: "Beyoncé", birth_year: 1981, death_year: null, short_description: "American singer" },
      { wikidata_qid: "Q3", name: "Ali", birth_year: 1990, death_year: null, short_description: null },
      { wikidata_qid: "Q4", name: "Somebody Fourth", birth_year: 1950, death_year: null, short_description: "a person" },
    ],
    selectedYears: new Set([1888]),
    leadLines: [{ subject_kind: "historical_event", subject_id: "1", line: "The Edsel arrived." }],
    ...overrides,
  };
}

test("a date's history becomes wall stories keyed by subject, with the row's own link and words", () => {
  const stories = planHistory("2026-09-04", history());
  const byKey = new Map(stories.map((s) => [s.urlKey, s]));
  const edsel = byKey.get("subject:historical_event:1")!;
  assert.equal(edsel.headline, "1957: The Edsel arrived.", "a written line is the headline");
  assert.equal(edsel.quotation, "Ford unveiled the Edsel to the public.", "the receipt still quotes the page");
  assert.equal(edsel.url, "https://en.wikipedia.org/wiki/September_4");
  assert.equal(edsel.outlet, "en.wikipedia.org");
  assert.equal(edsel.priority, PRIORITY_PICK);
  const kodak = byKey.get("subject:historical_event:2")!;
  assert.equal(kodak.headline, "1888: George Eastman registers the trademark Kodak.");
  assert.equal(kodak.priority, PRIORITY_PICK, "Wikipedia's pick for the date leads");
  // Forty events share one article; the subject is what makes them distinct.
  assert.notEqual(edsel.urlKey, kodak.urlKey);
  assert.equal(edsel.url, kodak.url);
});

test("a killing enters the pool and does not lead; a row with nothing to quote is not filed", () => {
  const stories = planHistory("2026-09-04", history({ selectedYears: new Set([2001]) }));
  const byKey = new Map(stories.map((s) => [s.urlKey, s]));
  const grim = byKey.get("subject:historical_event:3")!;
  assert.ok(grim, "it is on the wall's pool");
  assert.equal(grim.priority, PRIORITY_HISTORY, "and it does not take the first eight");
  assert.equal(byKey.has("subject:historical_event:4"), false, "fewer than twenty characters is not a receipt");
  assert.equal(mayLead("A parade went by."), true);
  assert.equal(mayLead("Troops entered the city."), false);
});

test("people, facts and written releases file too, and a bare title does not", () => {
  const stories = planHistory("2026-09-04", history());
  const byKey = new Map(stories.map((s) => [s.urlKey, s]));
  const bruckner = byKey.get("subject:person:Q1")!;
  assert.equal(bruckner.headline, "Anton Bruckner, Austrian composer, 1824 to 1896", "somebody who has died gets both years, once each");
  assert.equal(bruckner.url, "https://www.wikidata.org/wiki/Q1");
  assert.equal(bruckner.priority, PRIORITY_PERSON);
  assert.ok(bruckner.quotation.length >= 20);
  // A short name with no description has nothing twenty characters long to
  // quote from its page, so it is not filed: a story has a receipt or it is
  // not on the wall.
  assert.equal(byKey.has("subject:person:Q3"), false);
  assert.equal(byKey.get("subject:person:Q4")!.priority, PRIORITY_HISTORY, "only the top few people lead");
  assert.equal(byKey.get("subject:birth_fact:9")!.headline, "The first Wii console went on sale in Japan on this date.");
  const mario = byKey.get("subject:cultural_event:11")!;
  assert.equal(mario.headline, "2015: Nintendo shipped the level editor and people spent a decade making levels.");
  assert.equal(mario.priority, PRIORITY_PICK, "somebody wrote about it");
  assert.equal(byKey.has("subject:cultural_event:12"), false, "a bare imported title is not on the page and not on the wall");
});

test("when the board has room and nobody has buzzed, the date's picks go on before the feeds, and one buzz beats any priority", () => {
  const stories: StoryInput[] = [];
  // More than the board holds, so there is something for the order to
  // decide. Sixty since the mural, docs/the-wall.md section 27.
  for (let i = 0; i < 80; i++) stories.push({ id: `news-${String(i).padStart(2, "0")}`, tier: "claimed", support: 0, priority: 0, placedAt: 1 });
  stories.push({ id: "pick", tier: "claimed", support: 0, priority: PRIORITY_PICK, placedAt: 2 });
  stories.push({ id: "person", tier: "claimed", support: 0, priority: PRIORITY_PERSON, placedAt: 2 });
  stories.push({ id: "buzzed-news", tier: "claimed", support: 1, priority: 0, placedAt: 3 });
  const result = allocate(stories);
  const placed = result.placed.map((p) => p.id);
  assert.deepEqual(placed.slice(0, 3), ["buzzed-news", "pick", "person"]);
  assert.ok(result.overflow.length > 0);
});

// The bug that kept every one of these stories off the hive for as long as
// the seeder existed. `cultural_events.event_date` is a date column, and the
// read asked the automatic interface for `event_date=like.*-09-09`, which
// builds `event_date LIKE '%-09-09'` and which Postgres refuses outright:
// there is no `date ~~ text` operator, so it answers 42883. That is a 400,
// the read throws it, the throw takes the whole date's history with it, and
// tick.ts logs one line and moves on to the news. The wall filled with wire
// copy and nothing said why.
//
// The date is screened here now, so these assert the screen rather than a
// query string, and the seeder no longer asks a date column to match text.

test("a month and a day are written the way a stored date writes them", () => {
  assert.equal(monthDay(9, 9), "09-09");
  assert.equal(monthDay(12, 25), "12-25");
  assert.equal(monthDay(1, 1), "01-01");
});

test("the month and day of a stored date, and nothing at all from a value that is not one", () => {
  assert.equal(monthDayOf("1994-09-09"), "09-09");
  assert.equal(monthDayOf("2026-12-25"), "12-25");
  // The automatic interface can hand a date back with a time on it.
  assert.equal(monthDayOf("1994-09-09T00:00:00+00:00"), "09-09");
  // A row filed under something nobody can read matches no date rather than
  // being guessed at.
  assert.equal(monthDayOf(""), "");
  assert.equal(monthDayOf("not a date"), "");
  assert.equal(monthDayOf("09-09"), "");
});

test("the culture screen keeps this date's rows and drops every other date, whatever the year", () => {
  const rows = [
    { id: 1, event_date: "2015-09-09", keep: true },
    { id: 2, event_date: "1977-09-09", keep: true },
    { id: 3, event_date: "2015-09-08", keep: false },
    { id: 4, event_date: "2015-10-09", keep: false },
    { id: 5, event_date: "", keep: false },
  ];
  const kept = rows.filter((r) => monthDayOf(r.event_date) === monthDay(9, 9)).map((r) => r.id);
  assert.deepEqual(kept, rows.filter((r) => r.keep).map((r) => r.id));
});

// ---------------------------------------------------------------------------
// What is left out is said out loud, and the date page's screen is not the
// hive's. September 10, 2026.
// ---------------------------------------------------------------------------

test("a row left out is counted by reason rather than dropped in silence", () => {
  const dropped: Dropped = { noLink: 0, shortQuotation: 0, noHeadline: 0 };
  const stories = planHistory("2026-09-04", history({
    events: [
      { id: 1, event_year: 1957, description: "Ford unveiled the Edsel to the public.", source_url: null },
      { id: 2, event_year: 1888, description: "Ford unveiled the Edsel to the public.", source_url: "" },
      { id: 3, event_year: 1200, description: "Short.", source_url: "https://en.wikipedia.org/wiki/September_4" },
      { id: 4, event_year: 1201, description: "Ford unveiled the Edsel to the public.", source_url: "https://en.wikipedia.org/wiki/September_4" },
    ],
    facts: [], culture: [], people: [], leadLines: [],
  }), dropped);
  assert.equal(stories.length, 1);
  assert.deepEqual(dropped, { noLink: 2, shortQuotation: 1, noHeadline: 0 });
  // Without a counter the answer is the same; only the silence differs.
  assert.equal(planHistory("2026-09-04", history()).length, planHistory("2026-09-04", history(), { noLink: 0, shortQuotation: 0, noHeadline: 0 }).length);
});

test("a suppressed event files like any other history and never as a pick", () => {
  const stories = planHistory("2026-09-10", history({
    events: [
      // The row that started this: held back from the date page by the word
      // screen, on the hive with its own link and its own sentence.
      { id: 13782, event_year: 2025, description: "American right-wing political activist Charlie Kirk is assassinated while onstage at Utah Valley University in Orem, Utah.", source_url: "https://en.wikipedia.org/wiki/September_10", suppressed: true },
      // Suppressed for a reason mayLead does not know, and picked by
      // Wikipedia: still not a pick on the hive, because the screen said no.
      { id: 2, event_year: 1960, description: "A plain sentence the word screen would pass, held back by a person.", source_url: "https://en.wikipedia.org/wiki/September_10", suppressed: true },
      { id: 3, event_year: 1960, description: "The same year's ordinary event, which is a pick.", source_url: "https://en.wikipedia.org/wiki/September_10", suppressed: false },
    ],
    facts: [], culture: [], people: [], leadLines: [], selectedYears: new Set([1960]),
  }));
  const byKey = new Map(stories.map((s) => [s.urlKey, s]));
  const kirk = byKey.get("subject:historical_event:13782")!;
  assert.ok(kirk, "it is in the pool");
  assert.equal(kirk.priority, PRIORITY_HISTORY);
  assert.equal(kirk.url, "https://en.wikipedia.org/wiki/September_10");
  assert.equal(byKey.get("subject:historical_event:2")!.priority, PRIORITY_HISTORY, "suppressed, so not a pick even when picked");
  assert.equal(byKey.get("subject:historical_event:3")!.priority, PRIORITY_PICK);
});

// ---------------------------------------------------------------------------
// The number one songs become pixels. docs/the-wall.md section 16.
// ---------------------------------------------------------------------------

const WEEKS: SongRow[] = [
  { chart_date: "1994-09-10", song: "I'll Make Love to You", artist: "Boyz II Men", source_url: "https://en.wikipedia.org/wiki/List_of_Billboard_Hot_100_number_ones_of_1994" },
  { chart_date: "1994-09-17", song: "I'll Make Love to You", artist: "Boyz II Men", source_url: "https://en.wikipedia.org/wiki/List_of_Billboard_Hot_100_number_ones_of_1994" },
  { chart_date: "2026-09-05", song: "Older", artist: "Somebody", source_url: "https://en.wikipedia.org/wiki/List_of_Billboard_Hot_100_number_ones_of_2026" },
  { chart_date: "2026-09-12", song: "Newer", artist: "Somebody Else", source_url: "https://en.wikipedia.org/wiki/List_of_Billboard_Hot_100_number_ones_of_2026" },
  { chart_date: "2024-03-02", song: "Leap", artist: "Year", source_url: "https://en.wikipedia.org/wiki/List_of_Billboard_Hot_100_number_ones_of_2024" },
  { chart_date: "2023-03-04", song: "Not a leap", artist: "Year", source_url: "https://en.wikipedia.org/wiki/List_of_Billboard_Hot_100_number_ones_of_2023" },
];

test("the song on a date is the first issue on or after it and no more than six days after, newest year first", () => {
  const on = songsOn(WEEKS, 9, 10);
  assert.deepEqual(on.map((s) => [s.year, s.chart_date, s.song]), [
    [2026, "2026-09-12", "Newer"],
    [1994, "1994-09-10", "I'll Make Love to You"],
  ]);
  // The issue dated on the day itself covers the day.
  assert.equal(songsOn(WEEKS, 9, 5)[0]!.song, "Older");
  // Seven days after is not covered: 1994-09-17 does not answer September 3.
  assert.deepEqual(songsOn(WEEKS, 9, 3).map((s) => s.year), [2026]);
  // February 29 exists in 2024 and not in 2023, so 2023 is left out rather than given March's chart.
  assert.deepEqual(songsOn(WEEKS, 2, 29).map((s) => s.year), [2024]);
});

test("a quotation under twenty characters carries the chart's name, so one short row cannot fail the batch", () => {
  // "Butter" BTS is twelve characters, and wall_sources refuses a quotation
  // under twenty. From the day the songs shipped that one row failed every
  // date's batch of sources, so no song ever reached a hive.
  const [butter] = planSongs("2026-09-10", [{ chart_date: "2021-09-11", song: "Butter", artist: "BTS", source_url: "https://en.wikipedia.org/wiki/List_of_Billboard_Hot_100_number_ones_of_2021", year: 2021 }]);
  assert.equal(butter!.quotation, `"Butter" BTS, number one on the Billboard Hot 100`);
  assert.ok(butter!.quotation.length >= 20);
});

test("albums and films are pixels too, keyed by their own kind so a week's song, album and film are three stories", () => {
  const week = { chart_date: "2024-09-14", source_url: "https://en.wikipedia.org/wiki/List_of_Billboard_200_number-one_albums_of_2024", year: 2024 };
  const [album] = planSongs("2026-09-10", [{ ...week, song: "Short n' Sweet", artist: "Sabrina Carpenter" }], "album");
  assert.equal(album!.subjectKind, "album");
  assert.equal(album!.urlKey, "subject:album:2024-09-14");
  assert.equal(album!.headline, "2024: Short n' Sweet by Sabrina Carpenter was the number one album");
  const [film] = planSongs("2026-09-10", [{ ...week, song: "Beetlejuice Beetlejuice", artist: "", source_url: "https://en.wikipedia.org/wiki/List_of_2024_box_office_number-one_films_in_the_United_States" }], "film");
  assert.equal(film!.subjectKind, "film");
  assert.equal(film!.headline, "2024: Beetlejuice Beetlejuice was the number one film at the box office");
  assert.equal(film!.quotation, "Beetlejuice Beetlejuice");
  const [short] = planSongs("2026-09-10", [{ ...week, song: "Us", artist: "", source_url: "https://en.wikipedia.org/wiki/List_of_2019_box_office_number-one_films_in_the_United_States" }], "film");
  assert.equal(short!.quotation, "Us, number one on the US box office");
});

test("a song story is keyed by its issue, quotes the table's own song and artist, and files at the news's priority", () => {
  const stories = planSongs("2026-09-10", songsOn(WEEKS, 9, 10));
  assert.equal(stories.length, 2);
  const boyz = stories[1]!;
  assert.equal(boyz.urlKey, "subject:song:1994-09-10");
  assert.equal(boyz.subjectKind, "song");
  assert.equal(boyz.subjectId, "1994-09-10");
  assert.equal(boyz.headline, `1994: "I'll Make Love to You" by Boyz II Men was the number one song`);
  assert.equal(boyz.quotation, `"I'll Make Love to You" Boyz II Men`);
  assert.equal(boyz.url, "https://en.wikipedia.org/wiki/List_of_Billboard_Hot_100_number_ones_of_1994");
  assert.equal(boyz.outlet, "en.wikipedia.org");
  assert.equal(boyz.priority, PRIORITY_SONG);
  assert.ok(PRIORITY_SONG < PRIORITY_HISTORY, "a song waits behind the date's history");
  // The same issue never files twice, and the other kinds of history keep their own keys.
  assert.equal(new Set(stories.map((s) => s.urlKey)).size, stories.length);
});


// ---------------------------------------------------------------------------
// The years on a person's tile, said once.
//
// Every description below was read out of notable_people on the live project
// on September 21, 2026, and every headline is what the tile said or would
// have said. They are copied rather than invented for the same reason the
// hundred birthday messages and the news screen's headlines are: a rule
// tuned against descriptions somebody made up is tuned against the wrong
// thing, and this one turns entirely on shapes real editors write.
// ---------------------------------------------------------------------------

function person(overrides: Partial<PersonRow> = {}): PersonRow {
  return { wikidata_qid: "Q1", name: "Somebody", birth_year: 1970, death_year: null, short_description: null, ...overrides };
}

test("the years Wikidata already states come off, so a tile does not say them twice", () => {
  // The tile on September 21, 2026 read: "Luke Wilson, American actor (born
  // 1971), born 1971". This is that bug.
  assert.equal(
    personHeadline(person({ name: "Luke Wilson", birth_year: 1971, short_description: "American actor (born 1971)" })),
    "Luke Wilson, American actor, born 1971",
  );
  assert.equal(
    personHeadline(person({ name: "Stephen King", birth_year: 1947, short_description: "American novelist and writer (born 1947)" })),
    "Stephen King, American novelist and writer, born 1947",
  );
  // The abbreviated form, and the one that spells out a whole life.
  assert.equal(
    personHeadline(person({ name: "Jeffrey Combs", birth_year: 1954, short_description: "American actor (b. 1954)" })),
    "Jeffrey Combs, American actor, born 1954",
  );
  assert.equal(
    personHeadline(person({ name: "Catherine II of Russia", birth_year: 1729, death_year: 1796, short_description: "eighth Emperor of Russia, called the Great, r. 1762-1796 (lived 1729-1796)" })),
    "Catherine II of Russia, eighth Emperor of Russia, called the Great, r. 1762-1796, 1729 to 1796",
  );
  // A lifespan in brackets is the years too, and taking it off is why the
  // death year has to come back in the words we write ourselves.
  assert.equal(
    personHeadline(person({ name: "Michael Jackson", birth_year: 1958, death_year: 2009, short_description: "American singer, songwriter, record producer, and dancer (1958\u20132009)" })),
    "Michael Jackson, American singer, songwriter, record producer, and dancer, 1958 to 2009",
  );
  // Recorded as one of two possible birth years, and the death year is the
  // other number in the bracket, so matching on a year we hold takes it off.
  assert.equal(
    personHeadline(person({ name: "Alexander Hamilton", birth_year: 1757, death_year: 1804, short_description: "American Founding Father and statesman (1755/1757\u20131804)" })),
    "Alexander Hamilton, American Founding Father and statesman, 1757 to 1804",
  );
});

test("and a bracket that is not this person's years stays exactly where it is", () => {
  // The three that would be destroyed by a rule written on shape alone.
  const jimin = person({ name: "Jimin", birth_year: 1995, short_description: "South Korean singer and dancer (BTS)" });
  assert.equal(personHeadline(jimin), "Jimin, South Korean singer and dancer (BTS), born 1995");
  const rohit = person({ name: "Rohit Sharma", birth_year: 1987, short_description: "Indian cricketer (Captain)" });
  assert.equal(personHeadline(rohit), "Rohit Sharma, Indian cricketer (Captain), born 1987");
  // A term of office, on somebody alive, whose years are nothing like it.
  const rivlin = person({ name: "Reuven Rivlin", birth_year: 1939, short_description: "10th President of Israel (2014\u20132021)" });
  assert.equal(personHeadline(rivlin), "Reuven Rivlin, 10th President of Israel (2014\u20132021), born 1939");
  // A single year that is not a life either.
  const queen = person({ name: "Queen Mette-Marit of Norway", birth_year: 1973, short_description: "Queen Consort of Norway (2026)" });
  assert.equal(personHeadline(queen), "Queen Mette-Marit of Norway, Queen Consort of Norway (2026), born 1973");
});

test("the description survives having nothing left, and a person with no year says none", () => {
  assert.equal(personHeadline(person({ name: "Nobody Else", birth_year: 1971, short_description: "(born 1971)" })), "Nobody Else, born 1971");
  assert.equal(personHeadline(person({ name: "Undated Person", birth_year: null, short_description: "American actor" })), "Undated Person, American actor");
  assert.equal(personHeadline(person({ name: "Bare Name", birth_year: null, short_description: null })), "Bare Name");
  // Nothing in brackets at all, which is most of them.
  assert.equal(withoutStatedYears("American actor", person()), "American actor");
  assert.equal(withoutStatedYears("", person()), "");
});

// ---------------------------------------------------------------------------
// The repair for the rows already filed. worker/src/wall/repair-person-headlines.ts
// ---------------------------------------------------------------------------

test("the repair picks only the rows whose headline this project would write differently today", () => {
  const people: PersonRow[] = [
    { wikidata_qid: "Q1", name: "Luke Wilson", birth_year: 1971, death_year: null, short_description: "American actor (born 1971)" },
    { wikidata_qid: "Q2", name: "Jimin", birth_year: 1995, death_year: null, short_description: "South Korean singer and dancer (BTS)" },
  ];
  const stories = [
    { id: "a", wall_date: "2026-09-21", subject_id: "Q1", headline: "Luke Wilson, American actor (born 1971), born 1971" },
    // Already right, so it is left alone rather than written again.
    { id: "b", wall_date: "2026-09-21", subject_id: "Q2", headline: "Jimin, South Korean singer and dancer (BTS), born 1995" },
    // Somebody no longer in the table: the stored headline is the only
    // record of who it was, so it is never guessed at.
    { id: "c", wall_date: "2026-09-21", subject_id: "Q9", headline: "Gone From The Table, a person (born 1900), born 1900" },
    { id: "d", wall_date: "2026-09-21", subject_id: null, headline: "No subject at all" },
  ];
  assert.deepEqual(changesFor(stories, people), [
    { id: "a", wallDate: "2026-09-21", was: "Luke Wilson, American actor (born 1971), born 1971", now: "Luke Wilson, American actor, born 1971" },
  ]);
});

// ---------------------------------------------------------------------------
// What a date page is ordered by. CLAUDE.md section 5, September 22, 2026.
// ---------------------------------------------------------------------------

test("a date asks for its people by what the world wrote, not by what English Wikipedia clicked", () => {
  const path = hivePeoplePath(12, 16);
  // world_score is sqrt(monthly_views) * sitelink_count, migration
  // 20260922000000. Ordering by notability_score put Beethoven eighth on his
  // own birthday and Gandhi under a teenage footballer on October 2.
  assert.ok(path.includes("order=world_score.desc"), path);
  assert.ok(!path.includes("notability_score"), "attention alone is not the order any more");
  // The screens are unchanged and still run ahead of it.
  assert.ok(path.includes("adult_content=eq.false"));
  assert.ok(path.includes("birth_month=eq.12") && path.includes("birth_day=eq.16"));
  // And the limit still rides on the end when one is asked for.
  assert.ok(hivePeoplePath(12, 16, 30).endsWith("&limit=30"));
});

// ---------------------------------------------------------------------------
// The violence screen on the hive. September 22, 2026.
// ---------------------------------------------------------------------------

test("the hive never files a person the violence screen catches", () => {
  // The score forced these people to nought, and the hive read every person
  // on the date with no floor, so a nought still became a story with a Buzz
  // button. "Hamida Djandoubi, sentenced to death in France" was on the
  // September 22, 2026 hive that way.
  const planned = planHistory("2026-09-22", history({
    events: [], facts: [], culture: [], leadLines: [],
    people: [
      person({ wikidata_qid: "Q10", name: "Tatiana Maslany", birth_year: 1985, short_description: "Canadian actress" }),
      person({ wikidata_qid: "Q11", name: "Hamida Djandoubi", birth_year: 1949, death_year: 1977, short_description: "sentenced to death in France" }),
      person({ wikidata_qid: "Q12", name: "Ted Bundy", birth_year: 1946, death_year: 1989, short_description: "American serial killer (1946-1989)" }),
    ],
  }));
  const people = planned.filter((s) => s.subjectKind === "person").map((s) => s.subjectId);
  assert.deepEqual(people, ["Q10"]);
});
