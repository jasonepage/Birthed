import { strict as assert } from "node:assert";
import { test } from "node:test";

import { count, eventsSection, parseEventLine, parseEvents } from "../src/events.js";
import { pruneQuery } from "../src/upsert.js";

/**
 * The shape of a date article as the parser sees it: an Events h2 wrapped in
 * the new skin's heading div, era subsections as h3, one list item per line,
 * a year linked, an en dash, the sentence with links and a reference marker,
 * then a Births h2 that must not be read.
 */
const SEPTEMBER_5 = `
<div class="mw-heading mw-heading2"><h2 id="Events">Events</h2></div>
<div class="mw-heading mw-heading3"><h3 id="Pre-1600">Pre-1600</h3></div>
<ul>
<li><a href="/wiki/917">917</a> – <a href="/wiki/Liu_Yan">Liu Yan</a> declares himself emperor, establishing the <a href="/wiki/Southern_Han">Southern Han</a> state in southern China.<sup class="reference">[1]</sup></li>
<li>c. 1200 – Something too vague to have a year.</li>
<li>44 BC – A line before the common era.</li>
</ul>
<div class="mw-heading mw-heading3"><h3 id="1901–present">1901–present</h3></div>
<ul>
<li><a href="/wiki/1972">1972</a> – <a href="/wiki/Munich_massacre">Munich massacre</a>: A Palestinian terrorist group called "Black September" attacks and takes hostage 11 Israeli athletes at the <a href="/wiki/1972_Summer_Olympics">Munich Olympic Games</a>.<sup class="reference">[40]</sup></li>
<li><a href="/wiki/1977">1977</a> – <a href="/wiki/Voyager_program">Voyager program</a>: <i><a href="/wiki/Voyager_1">Voyager 1</a></i> is launched.</li>
<li><a href="/wiki/1980">1980</a> – The <a href="/wiki/Gotthard_Road_Tunnel">Gotthard Road Tunnel</a> opens in Switzerland.
<ul><li>A sub bullet that belongs to 1980 and is not read.</li></ul></li>
<li>2999 – A year that has not happened.</li>
<li>1999 - A hyphen instead of a dash still reads.</li>
</ul>
<div class="mw-heading mw-heading2"><h2 id="Births">Births</h2></div>
<ul>
<li><a href="/wiki/1946">1946</a> – <a href="/wiki/Freddie_Mercury">Freddie Mercury</a>, Tanzanian-English singer-songwriter (d. 1991)</li>
</ul>
`;

test("the Events section ends where Births begins", () => {
  const section = eventsSection(SEPTEMBER_5);
  assert.ok(section !== null);
  assert.ok(section.includes("Munich"));
  assert.ok(!section.includes("Freddie Mercury"));
});

test("a line is a year, a dash and the sentence as written", () => {
  const event = parseEventLine("1977 – Voyager program: Voyager 1 is launched.", 2026);
  assert.deepEqual(event, { year: 1977, description: "Voyager program: Voyager 1 is launched." });
});

test("a citation marker typed as text comes off the end of the sentence", () => {
  // One real line out of 19,734 in the first full import arrived like this,
  // because somebody typed the footnote instead of using a reference tag, so
  // `cellText` had no `sup` element to remove.
  const event = parseEventLine(
    "1946 \u2013 It's a Wonderful Life premieres at the Globe Theatre in New York to mixed reviews. [1]",
    2026,
  );
  assert.equal(event?.description.endsWith("to mixed reviews."), true);

  // Only on the end. A bracketed number inside a sentence is somebody's words.
  const inside = parseEventLine("1970 \u2013 The [1] Squadron is formed and flies its first sortie.", 2026);
  assert.match(inside?.description ?? "", /\[1\] Squadron/);
});

test("a line before the common era is counted as its own thing", () => {
  // Both are refused, and the report must not call them the same problem: a
  // BC line has a year and nowhere to put it, and a "c." line has no year.
  const read = parseEvents(
    "<h2 id=\"Events\">Events</h2><ul>" +
      "<li>44 BC \u2013 Caesar is assassinated in the Senate.</li>" +
      "<li>c. 1200 \u2013 Something vague happens somewhere.</li>" +
      "</ul><h2 id=\"Births\">Births</h2>",
    2026,
  );
  assert.equal(read.events.length, 0);
  assert.equal(read.notes.filter((note) => note.includes("before the common era")).length, 1);
  assert.equal(read.notes.filter((note) => note.includes("no plain year")).length, 1);
});

test("lines without a plain year are refused rather than guessed", () => {
  assert.equal(parseEventLine("c. 1200 – Something vague.", 2026), null);
  assert.equal(parseEventLine("44 BC – Before the common era.", 2026), null);
  assert.equal(parseEventLine("2999 – Not yet.", 2026), null);
  assert.equal(parseEventLine("1400s – A decade is not a year.", 2026), null);
});

test("a whole page reads to verbatim sentences with links and references stripped", () => {
  const read = parseEvents(SEPTEMBER_5, 2026);
  const years = read.events.map((event) => event.year);
  assert.deepEqual(years, [917, 1972, 1977, 1980, 1999]);
  const munich = read.events.find((event) => event.year === 1972);
  assert.ok(munich !== undefined);
  assert.ok(munich.description.startsWith("Munich massacre: A Palestinian terrorist group"));
  assert.ok(!munich.description.includes("[40]"));
  assert.ok(!munich.description.includes("<a"));
  const gotthard = read.events.find((event) => event.year === 1980);
  assert.equal(gotthard?.description, "The Gotthard Road Tunnel opens in Switzerland.");
  assert.ok(!read.events.some((event) => event.description.includes("Freddie")));
});

test("a page with no Events section says so instead of reading nothing quietly", () => {
  const read = parseEvents("<h2 id=\"Births\">Births</h2><ul><li>1946 – Somebody</li></ul>", 2026);
  assert.equal(read.events.length, 0);
  assert.ok(read.notes.some((note) => note.includes("no Events section")));
});

test("a prune is scoped to one calendar date and one moment", () => {
  const query = pruneQuery(12, 20, "2026-09-06T07:15:00.000Z");
  assert.match(query, /(^|&)event_month=eq\.12(&|$)/);
  assert.match(query, /(^|&)event_day=eq\.20(&|$)/);
  // The colons in the timestamp have to be escaped or PostgREST reads the
  // filter as a different operator and the delete is not the one we meant.
  assert.match(query, /imported_at=lt\.2026-09-06T07%3A15%3A00\.000Z/);
  assert.ok(!query.includes("event_year"), "a prune must never be scoped by year");
});

test("the report counts in words a person would use", () => {
  assert.equal(count(1, "line"), "1 line");
  assert.equal(count(0, "line"), "0 lines");
  assert.equal(count(43, "line"), "43 lines");
  assert.equal(count(1, "date"), "1 date");
});

test("every line read carries the article it is about, or null, and the report counts the nulls", () => {
  const read = parseEvents(SEPTEMBER_5, 2026);
  const about = Object.fromEntries(read.events.map((e) => [e.year, e.subject?.title ?? null]));
  assert.deepEqual(about, {
    917: "Liu Yan",
    1972: "Munich massacre",
    1977: "Voyager 1",
    1980: "Gotthard Road Tunnel",
    1999: null,
  });
  assert.ok(read.notes.some((n) => n.startsWith("1 line of 5 name no article")), read.notes.join("; "));
});
