import { strict as assert } from "node:assert";
import { test } from "node:test";

import { eventsSection, parseEventLine, parseEvents } from "../src/events.js";

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
