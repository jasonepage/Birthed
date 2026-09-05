import { strict as assert } from "node:assert";
import { test } from "node:test";

import { cellText, decodeEntities, readGrid, readTables } from "../src/html.js";
import {
  auditYear,
  cleanArtist,
  cleanTitle,
  fillWeeks,
  parseIssueDate,
  parseYear,
} from "../src/hot100.js";

/**
 * Real markup, captured from the rendered 1970 page: the header row, the
 * first two weeks of a four week run, and the last three weeks of the year.
 * The only edit is the first run's rowspan, cut from 4 to 2 so that it covers
 * the two rows kept here rather than two that were left out.
 *
 * It is here rather than a tidied version of itself because every awkward
 * thing in it is a thing that actually happens. The date cells are th and not
 * td. The date sits inside a span whose data-sort-value says 2026, which is a
 * MediaWiki quirk and would have been believed by anything reading attributes
 * instead of text. The artist sits inside two nested spans. The reference
 * numbers are superscripts. The last row is a double A side: two quoted
 * titles with a slash between them and a footnote letter on the end.
 */
const NINETEEN_SEVENTY = `<table class="wikitable">
<tr>
<th scope="col"><abbr title="Hot 100 consecutive No.1">No.</abbr><sup id="cite_ref-17" class="reference"><a href="#cite_note-17"><span class="cite-bracket">[</span>a<span class="cite-bracket">]</span></a></sup>
</th>
<th scope="col">Issue date
</th>
<th scope="col">Title
</th>
<th scope="col">Artist(s)
</th>
<th scope="col" class="unsortable"><abbr title="Reference">Ref.</abbr>
</th></tr>
<tr>
<td bgcolor="#EDEAE0" align="center" rowspan="2">227
</td>
<th scope="row"><span data-sort-value="000000002026-01-03-0000" style="white-space:nowrap">January 3</span>
</th>
<td align="center" rowspan="2">"<a href="/wiki/Raindrops_Keep_Fallin%27_on_My_Head" title="Raindrops Keep Fallin' on My Head">Raindrops Keep Fallin' on My Head</a>"
</td>
<td align="center" rowspan="2"><span data-sort-value="Thomas, B. J."><span class="vcard"><span class="fn"><a href="/wiki/B._J._Thomas" title="B. J. Thomas">B. J. Thomas</a></span></span></span>
</td>
<td align="center"><sup id="cite_ref-J7_2-1" class="reference"><a href="#cite_note-J7-2"><span class="cite-bracket">[</span>2<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<th scope="row"><span data-sort-value="000000002026-01-10-0000" style="white-space:nowrap">January 10</span>
</th>
<td align="center"><sup id="cite_ref-18" class="reference"><a href="#cite_note-18"><span class="cite-bracket">[</span>17<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<td bgcolor="#EDEAE0" align="center" rowspan="2">246
</td>
<th scope="row"><span data-sort-value="000000002026-12-12-0000" style="white-space:nowrap">December 12</span>
</th>
<td align="center" rowspan="2">"<span data-sort-value="Tears&nbsp;!"><a href="/wiki/The_Tears_of_a_Clown" title="The Tears of a Clown">The Tears of a Clown</a></span>"
</td>
<td align="center" rowspan="2"><span data-sort-value="Robinson&nbsp;!"><a href="/wiki/The_Miracles" title="The Miracles">Smokey Robinson &amp; the Miracles</a></span>
</td>
<td align="center"><sup id="cite_ref-67" class="reference"><a href="#cite_note-67"><span class="cite-bracket">[</span>65<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<th scope="row"><span data-sort-value="000000002026-12-19-0000" style="white-space:nowrap">December 19</span>
</th>
<td align="center"><sup id="cite_ref-68" class="reference"><a href="#cite_note-68"><span class="cite-bracket">[</span>66<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<td bgcolor="#EDEAE0" align="center">247
</td>
<th scope="row"><span data-sort-value="000000002026-12-26-0000" style="white-space:nowrap">December 26</span>
</th>
<td align="center">"<a href="/wiki/My_Sweet_Lord" title="My Sweet Lord">My Sweet Lord</a>" / "<a href="/wiki/Isn%27t_It_a_Pity" title="Isn't It a Pity">Isn't It a Pity</a>"<sup id="cite_ref-double_23-3" class="reference"><a href="#cite_note-double-23"><span class="cite-bracket">[</span>b<span class="cite-bracket">]</span></a></sup>
</td>
<td align="center"><span data-sort-value="Harrison, George"><span class="vcard"><span class="fn"><a href="/wiki/George_Harrison" title="George Harrison">George Harrison</a></span></span></span>
</td>
<td align="center"><sup id="cite_ref-69" class="reference"><a href="#cite_note-69"><span class="cite-bracket">[</span>67<span class="cite-bracket">]</span></a></sup>
</td></tr>
</table>`;

/** The two other wikitables these pages carry, which must not be chosen. */
const DECOYS = `<table class="wikitable"><tr><th>&#8224;</th><th>Indicates best-performing single of 2004</th></tr></table>
<table class="wikitable plainrowheaders"><tr><th scope="col">Position</th><th scope="col">Artist</th><th scope="col">Weeks at No. 1</th></tr>
<tr><td>1</td><th scope="row">Usher</th><td>28</td></tr></table>`;

test("the header row is read past its abbreviations and footnote", () => {
  const grid = readGrid(readTables(NINETEEN_SEVENTY)[0] ?? "");
  assert.deepEqual(grid[0], ["No.", "Issue date", "Title", "Artist(s)", "Ref."]);
});

test("a run spanning rows puts its song in every one of them", () => {
  const grid = readGrid(readTables(NINETEEN_SEVENTY)[0] ?? "");
  // The second week of the run wrote only a date and a reference. Its song and
  // artist have to come from the rowspan above it.
  assert.deepEqual(grid[2]?.slice(0, 4), [
    "227",
    "January 10",
    '"Raindrops Keep Fallin\' on My Head"',
    "B. J. Thomas",
  ]);
});

test("every row of the real fixture reads", () => {
  const { weeks, notes } = parseYear(NINETEEN_SEVENTY, 1970);
  assert.deepEqual(notes, []);
  assert.deepEqual(weeks, [
    { chartDate: "1970-01-03", song: "Raindrops Keep Fallin' on My Head", artist: "B. J. Thomas" },
    { chartDate: "1970-01-10", song: "Raindrops Keep Fallin' on My Head", artist: "B. J. Thomas" },
    { chartDate: "1970-12-12", song: "The Tears of a Clown", artist: "Smokey Robinson & the Miracles" },
    { chartDate: "1970-12-19", song: "The Tears of a Clown", artist: "Smokey Robinson & the Miracles" },
    { chartDate: "1970-12-26", song: "My Sweet Lord / Isn't It a Pity", artist: "George Harrison" },
  ]);
});

test("the sort key is ignored, because it lies", () => {
  // data-sort-value on every date cell of the 1970 page says 2026.
  const { weeks } = parseYear(NINETEEN_SEVENTY, 1970);
  assert.ok(weeks.every((week) => week.chartDate.startsWith("1970-")));
});

test("the legend table and the artists table are not mistaken for the chart", () => {
  const { weeks } = parseYear(DECOYS + NINETEEN_SEVENTY, 1970);
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0]?.artist, "B. J. Thomas");
});

test("a page with no chart table says so rather than returning nothing quietly", () => {
  const { weeks, notes } = parseYear(DECOYS, 1970);
  assert.deepEqual(weeks, []);
  assert.equal(notes.length, 1);
});

test("entities and superscripts come out of cell text", () => {
  assert.equal(decodeEntities("Simon &amp; Garfunkel &#8212; &quot;Cecilia&quot;"), 'Simon & Garfunkel — "Cecilia"');
  assert.equal(cellText('<td>Beyonc&eacute;<sup class="reference">[1]</sup></td>'), "Beyoncé");
  assert.equal(cellText('<span style="display:none">Thomas, B. J.</span>B. J. Thomas'), "B. J. Thomas");
});

test("issue dates parse in the shapes the pages use", () => {
  assert.equal(parseIssueDate("January 3", 2004), "2004-01-03");
  assert.equal(parseIssueDate("December 26", 1970), "1970-12-26");
  assert.equal(parseIssueDate("August 4, 1958", 1958), "1958-08-04");
  assert.equal(parseIssueDate("4 August", 1958), "1958-08-04");
  // A stated year wins over the page's, so a December issue listed on the
  // next year's page does not land eleven months out.
  assert.equal(parseIssueDate("December 27, 2025", 2026), "2025-12-27");
});

test("a date the calendar does not have is a failure, not a guess", () => {
  assert.equal(parseIssueDate("February 30", 2004), null);
  assert.equal(parseIssueDate("Februrary 3", 2004), null);
  assert.equal(parseIssueDate("", 2004), null);
  assert.equal(parseIssueDate("Week 3", 2004), null);
});

test("February 29 exists in a leap year and not otherwise", () => {
  assert.equal(parseIssueDate("February 29", 2004), "2004-02-29");
  assert.equal(parseIssueDate("February 29", 2003), null);
});

test("quotation marks come off titles without wrecking the awkward ones", () => {
  assert.equal(cleanTitle('"Hey Ya!"'), "Hey Ya!");
  assert.equal(cleanTitle("“Yeah!”"), "Yeah!");
  assert.equal(cleanTitle("Hey Ya!"), "Hey Ya!");
  assert.equal(cleanTitle(""), "");
  // A double A side is two titles, not one title with a quote in the middle.
  assert.equal(cleanTitle('"My Sweet Lord" / "Isn\'t It a Pity"'), "My Sweet Lord / Isn't It a Pity");
  // A remix is a quoted title with something after it.
  assert.equal(cleanTitle('"Macarena" (Bayside Boys Mix)'), "Macarena (Bayside Boys Mix)");
  // An apostrophe inside a title is not a quotation mark.
  assert.equal(cleanTitle('"Ain\'t No Mountain High Enough"'), "Ain't No Mountain High Enough");
  // Odd quoting is left alone rather than half unwrapped.
  assert.equal(cleanTitle('"Half a title'), '"Half a title');
});

test("the best-of-the-year dagger is not part of the title", () => {
  // It is a superscript on some year pages and bare text on others, which is
  // how it survived the first pass and shipped as part of the song name.
  assert.equal(cleanTitle('"We Belong Together"†'), "We Belong Together");
  assert.equal(cleanTitle('"Blinding Lights" †'), "Blinding Lights");
  assert.equal(cleanTitle('"Yeah!"[b]'), "Yeah!");
});

test("an asterisk in a title is left alone, because it is the title", () => {
  assert.equal(cleanTitle('"F**kin\' Perfect"'), "F**kin' Perfect");
});

test("a nickname in quotes stays in the artist", () => {
  assert.equal(cleanArtist('Bobby "Boris" Pickett and the Crypt-Kickers'), 'Bobby "Boris" Pickett and the Crypt-Kickers');
  assert.equal(cleanArtist("Los del R\u00edo[a]"), "Los del R\u00edo");
});

test("a page that lists only the week a song arrived is filled forward", () => {
  const { weeks, notes } = fillWeeks([
    { chartDate: "2004-01-03", song: "Hey Ya!", artist: "OutKast" },
    { chartDate: "2004-02-14", song: "The Way You Move", artist: "OutKast" },
  ]);
  assert.deepEqual(notes, []);
  assert.equal(weeks.length, 7);
  assert.equal(weeks[1]?.chartDate, "2004-01-10");
  assert.equal(weeks[5]?.song, "Hey Ya!", "the last week before the change is still the old song");
  assert.equal(weeks[6]?.song, "The Way You Move");
});

test("a gap that is not whole weeks is reported rather than filled", () => {
  const { weeks, notes } = fillWeeks([
    { chartDate: "2004-01-03", song: "Hey Ya!", artist: "OutKast" },
    { chartDate: "2004-01-08", song: "Something Else", artist: "Somebody" },
  ]);
  assert.equal(weeks.length, 2, "nothing invented across a gap it does not understand");
  assert.equal(notes.length, 1);
  assert.match(notes[0] ?? "", /5 days/);
});

test("a short year is reported, and the current year is not", () => {
  const nine = Array.from({ length: 9 }, (_, index) => ({
    chartDate: `2004-01-${String(3 + index * 7).padStart(2, "0")}`,
    song: "Hey Ya!",
    artist: "OutKast",
  }));
  assert.match(auditYear(nine, 2004, false).join(" "), /only 9 weeks/);
  assert.equal(auditYear(nine, 2004, true).some((note) => note.includes("only 9 weeks")), false);
});

test("a year starting late is reported", () => {
  const weeks = [{ chartDate: "2004-03-06", song: "A", artist: "B" }];
  assert.match(auditYear(weeks, 2004, true).join(" "), /more than a week into the year/);
});
