import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  anniversaryArticles, articlesByRow, buildSitelinkQuery, isContextTitle,
  linksIn, observanceMatch, observancesFrom, primaryArticle, readSitelinks,
  rowKey, sectionById,
} from "../src/signals.js";

// A stripped down copy of the shape a Wikipedia date article actually has:
// an Events h2, list items of "year – sentence" with links inside, then a
// Holidays and observances h2 further down.
const PAGE = `
<h2 id="Events">Events</h2>
<ul>
<li>1822 – <a href="/wiki/Pedro_I_of_Brazil">Dom Pedro I</a> declares the
<a href="/wiki/Independence_of_Brazil">independence of Brazil</a> from
<a href="/wiki/Portugal">Portugal</a>.</li>
<li>1940 – <a href="/wiki/World_War_II">World War II</a>: The German
<a href="/wiki/Luftwaffe">Luftwaffe</a> begins <a href="/wiki/The_Blitz">the Blitz</a>,
bombing <a href="/wiki/London">London</a>.<sup id="cite_ref-1">[1]</sup></li>
<li>1936 – The last <a href="/wiki/Thylacine">thylacine</a> dies at the
<a href="/wiki/Hobart_Zoo">Hobart Zoo</a> in <a href="/wiki/Tasmania">Tasmania</a>.</li>
<li>c. 1200 – Something with no plain year.</li>
<li>1979 – The cable network <a href="/wiki/ESPN">ESPN</a> makes its debut.</li>
<li>1856 – The Saimaa Canal is inaugurated.</li>
</ul>
<h2 id="Births">Births</h2>
<ul><li>1936 – <a href="/wiki/Buddy_Holly">Buddy Holly</a>, American singer</li></ul>
<h2 id="Holidays_and_observances">Holidays and observances</h2>
<ul>
<li><a href="/wiki/Independence_Day_(Brazil)">Independence Day</a>
(<a href="/wiki/Brazil">Brazil</a>)</li>
<li><a href="/wiki/National_Threatened_Species_Day">National Threatened Species Day</a>
(<a href="/wiki/Australia">Australia</a>)</li>
</ul>`;

test("links are read with their titles and their anchors", () => {
  const links = linksIn(`<a href="/wiki/The_Blitz">the Blitz</a> and <a href="/wiki/London">London</a>`);
  assert.deepEqual(links.map((l) => l.title), ["The Blitz", "London"]);
  assert.deepEqual(links.map((l) => l.anchor), ["the Blitz", "London"]);
});

test("namespaced links are not events", () => {
  assert.equal(linksIn(`<a href="/wiki/File:X.jpg">x</a><a href="/wiki/Help:Y">y</a>`).length, 0);
});

test("percent escaped titles are decoded", () => {
  const links = linksIn(`<a href="/wiki/Torrijos%E2%80%93Carter_Treaties">the treaties</a>`);
  assert.equal(links[0]?.title, "Torrijos–Carter Treaties");
});

test("bare years and month names are context, countries are not", () => {
  assert.ok(isContextTitle("1940"));
  assert.ok(isContextTitle("1980s"));
  assert.ok(isContextTitle("20th century"));
  assert.ok(isContextTitle("September 7"));
  assert.equal(isContextTitle("Brazil"), false);
  assert.equal(isContextTitle("The Blitz"), false);
});

test("a topic prefix before a colon is dropped, so the war does not eat the event", () => {
  const line = `<a href="/wiki/World_War_II">World War II</a>: the
    <a href="/wiki/Luftwaffe">Luftwaffe</a> begins <a href="/wiki/The_Blitz">the Blitz</a>,
    bombing <a href="/wiki/London">London</a>`;
  assert.equal(primaryArticle(line), "The Blitz");
});

test("a link after a preposition of place is demoted below the subject", () => {
  const line = `The last <a href="/wiki/Thylacine">thylacine</a> dies at the
    <a href="/wiki/Hobart_Zoo">Hobart Zoo</a> in <a href="/wiki/Tasmania">Tasmania</a>.`;
  assert.equal(primaryArticle(line), "Thylacine");
});

test("a demoted link is still better than nothing", () => {
  assert.equal(primaryArticle(`Fighting begins in <a href="/wiki/Jordan">Jordan</a>.`), "Jordan");
});

test("a line with no usable link has no article rather than a wrong one", () => {
  assert.equal(primaryArticle(`1856 – The Saimaa Canal is inaugurated.`), null);
  assert.equal(primaryArticle(`<a href="/wiki/1940">1940</a>`), null);
});

test("only the Events section is read for events", () => {
  const events = sectionById(PAGE, "Events");
  assert.ok(events !== null);
  assert.ok(events!.includes("Independence_of_Brazil"));
  assert.equal(events!.includes("Buddy_Holly"), false);
});

test("each event row is keyed to the article it is about", () => {
  const map = articlesByRow(PAGE);
  assert.equal(map.get(rowKey(1822, "Dom Pedro I declares the independence of Brazil from Portugal.")),
    "Independence of Brazil");
  assert.equal(map.get(rowKey(1936, "The last thylacine dies at the Hobart Zoo in Tasmania.")), "Thylacine");
  assert.equal(map.get(rowKey(1979, "The cable network ESPN makes its debut.")), "ESPN");
});

test("a line with no link is absent rather than present and empty", () => {
  const map = articlesByRow(PAGE);
  assert.equal(map.get(rowKey(1856, "The Saimaa Canal is inaugurated.")), undefined);
});

test("the row key survives an edit to the end of a sentence", () => {
  const a = rowKey(1940, "The German Luftwaffe begins the Blitz, bombing London.");
  const b = rowKey(1940, "The German Luftwaffe begins the Blitz, bombing London and other cities.");
  assert.equal(a, b);
});

test("the row key still separates two events in one year", () => {
  assert.notEqual(rowKey(1921, "The first Miss America pageant is held"),
                  rowKey(1921, "The Legion of Mary is founded in Dublin"));
});

test("observances are read off the date page", () => {
  const obs = observancesFrom(PAGE);
  assert.equal(obs.length, 2);
  assert.ok(obs[0]?.text.includes("Independence Day"));
  assert.equal(obs[1]?.article, "National Threatened Species Day");
});

test("an observance that shares words with its event scores, and one that does not scores zero", () => {
  assert.ok(observanceMatch("Independence Day (Brazil)",
    "Dom Pedro declares the independence of Brazil from Portugal") > 0);
  // The case that proves this cannot be automatic. Same fact, no shared words.
  assert.equal(observanceMatch("National Threatened Species Day",
    "The last thylacine dies at the Hobart Zoo"), 0);
});

test("the anniversaries list yields article titles and skips bare years", () => {
  const set = anniversaryArticles(`<ul><li>1979 – The network
    <a href="/wiki/ESPN">ESPN</a> debuted in <a href="/wiki/1979">1979</a>.</li></ul>`);
  assert.ok(set.has("ESPN"));
  assert.equal(set.has("1979"), false);
});

test("a quotation mark in a title cannot break the query", () => {
  const q = buildSitelinkQuery([`He said "no"`, "ESPN"]);
  assert.ok(q.includes('\\"no\\"'));
  assert.ok(q.includes('"ESPN"@en'));
});

test("a sitelink answer that is empty or malformed yields an empty map", () => {
  assert.equal(readSitelinks({}).size, 0);
  assert.equal(readSitelinks({ results: { bindings: [{ title: { value: "X" } }] } }).size, 0);
});

test("sitelink counts are read back by title", () => {
  const map = readSitelinks({ results: { bindings: [
    { title: { value: "The Blitz" }, sitelinks: { value: "44" } },
    { title: { value: "ESPN" }, sitelinks: { value: "40" } },
  ] } });
  assert.equal(map.get("The Blitz"), 44);
  assert.equal(map.get("ESPN"), 40);
});
