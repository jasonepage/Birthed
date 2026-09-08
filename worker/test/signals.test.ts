import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  allEventLinks, anniversaryArticles, articlesByRow, buildEntityQuery,
  isContextEntity, isContextTitle, linksIn, observanceMatch, observancesFrom,
  isEventEntity, isObservance, pickArticle, primaryArticle, readEntities,
  rowKey, sectionById, type Entity,
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

const ent = (sitelinks: number, ...types: string[]): Entity => ({ sitelinks, types });

// The real Battle of Arsuf line, which the first two versions of this picker
// both scored as Richard I of England.
const ARSUF = `<a href="/wiki/Third_Crusade">Third Crusade</a>: <a href="/wiki/Battle_of_Arsuf">Battle of Arsuf</a>: <a href="/wiki/Richard_I_of_England">Richard I of England</a> defeats <a href="/wiki/Saladin">Saladin</a>.`;
const ARSUF_ENTITIES = new Map<string, Entity>([
  ["Third Crusade", ent(80, "crusade", "war")],
  ["Battle of Arsuf", ent(41, "battle")],
  ["Richard I of England", ent(112, "human")],
  ["Saladin", ent(130, "human")],
]);

test("people and places are thrown out, which is what stops a king eating a battle", () => {
  assert.equal(primaryArticle(ARSUF, ARSUF_ENTITIES), "Battle of Arsuf");
});

test("dropping the single most famous link would not have been enough", () => {
  // Saladin outranks Richard, so removing one context link only promotes the
  // next one. This is the case that broke the second version.
  const withoutRichard = new Map(ARSUF_ENTITIES);
  withoutRichard.delete("Richard I of England");
  assert.equal(primaryArticle(ARSUF, withoutRichard), "Battle of Arsuf");
});

test("a line of only people and places says it has no article of its own", () => {
  const line = `<a href="/wiki/Giuseppe_Garibaldi">Giuseppe Garibaldi</a> enters <a href="/wiki/Naples">Naples</a>.`;
  const e = new Map<string, Entity>([
    ["Giuseppe Garibaldi", ent(130, "human")],
    ["Naples", ent(200, "big city", "municipality of italy")],
  ]);
  const pick = pickArticle(line, e);
  assert.equal(pick.ownArticle, false);
  assert.equal(pick.article, "Giuseppe Garibaldi", "still names what it measured");
});

test("the most specific survivor wins, not the longest anchor", () => {
  const line = `The <a href="/wiki/Treaty_of_Baden">treaty of Baden</a> between the
    <a href="/wiki/Kingdom_of_France">kingdom of France</a> and the
    <a href="/wiki/Holy_Roman_Empire">Holy Roman Empire</a> is ratified.`;
  const e = new Map<string, Entity>([
    ["Treaty of Baden", ent(21, "treaty")],
    ["Kingdom of France", ent(87, "historical country", "kingdom")],
    ["Holy Roman Empire", ent(180, "historical country", "empire")],
  ]);
  assert.equal(primaryArticle(line, e), "Treaty of Baden");
});

test("without an entity map the picker answers but does not claim an event article", () => {
  const pick = pickArticle(ARSUF);
  assert.equal(pick.ownArticle, false);
});

test("a single link line is never emptied", () => {
  const line = `The network <a href="/wiki/ESPN">ESPN</a> makes its debut.`;
  const e = new Map<string, Entity>([["ESPN", ent(40, "television network")]]);
  assert.equal(primaryArticle(line, e), "ESPN");
});

test("the Boxer Protocol is not demoted out of its own line by a genitive", () => {
  // "of" used to be treated as a preposition of place, so "the signing of the
  // Boxer Protocol" threw the Protocol away and the parent Rebellion won.
  const line = `The <a href="/wiki/Boxer_Rebellion">Boxer Rebellion</a> in
    <a href="/wiki/Qing_dynasty">Qing dynasty</a> officially ends with the signing of the
    <a href="/wiki/Boxer_Protocol">Boxer Protocol</a>.`;
  const e = new Map<string, Entity>([
    ["Boxer Rebellion", ent(78, "rebellion")],
    ["Qing dynasty", ent(150, "historical country", "dynasty")],
    ["Boxer Protocol", ent(25, "treaty")],
  ]);
  assert.equal(primaryArticle(line, e), "Boxer Protocol");
});

test("a painting, a currency and a vehicle class are not events", () => {
  // All three passed the person-and-place filter on September 7 and ranked as
  // if the day were remembered for them.
  assert.equal(isEventEntity(ent(146, "painting")), false);
  assert.equal(isEventEntity(ent(152, "cryptocurrency")), false);
  assert.equal(isEventEntity(ent(140, "class of vehicle")), false);
  assert.equal(isEventEntity(ent(46, "aviation accident")), true);
  assert.equal(isEventEntity(ent(36, "battle")), true);
  assert.equal(isEventEntity(ent(25, "treaty")), true);
  assert.equal(isEventEntity(undefined), false);
});

test("a line pointing at an object rather than a happening says so", () => {
  const line = `<a href="/wiki/Guillaume_Apollinaire">Guillaume Apollinaire</a> is arrested
    on suspicion of stealing the <a href="/wiki/Mona_Lisa">Mona Lisa</a>.`;
  const e = new Map<string, Entity>([
    ["Guillaume Apollinaire", ent(90, "human")],
    ["Mona Lisa", ent(146, "painting")],
  ]);
  const pick = pickArticle(line, e);
  assert.equal(pick.article, "Mona Lisa");
  assert.equal(pick.ownArticle, false, "a painting is not what happened");
});

test("saints are not observances and national days are", () => {
  assert.equal(isObservance("Independence Day (Brazil)"), true);
  assert.equal(isObservance("National Threatened Species Day (Australia)"), true);
  assert.equal(isObservance("Clodoald"), false);
  assert.equal(isObservance("Gratus of Aosta"), false);
  assert.equal(isObservance("Christian feast day:"), false);
});

test("a taxon is a subject, not a place", () => {
  assert.equal(isContextEntity(ent(90, "taxon")), false);
  assert.equal(isContextEntity(ent(112, "human")), true);
  assert.equal(isContextEntity(ent(200, "big city")), true);
  assert.equal(isContextEntity(undefined), false);
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
  assert.equal(map.get(rowKey(1822, "Dom Pedro I declares the independence of Brazil from Portugal."))?.article,
    "Independence of Brazil");
  assert.equal(map.get(rowKey(1936, "The last thylacine dies at the Hobart Zoo in Tasmania."))?.article, "Thylacine");
  assert.equal(map.get(rowKey(1979, "The cable network ESPN makes its debut."))?.article, "ESPN");
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
  const q = buildEntityQuery([`He said "no"`, "ESPN"]);
  assert.ok(q.includes('\\"no\\"'));
  assert.ok(q.includes('"ESPN"@en'));
});

test("an answer that is empty or malformed yields an empty map", () => {
  assert.equal(readEntities({}).size, 0);
  assert.equal(readEntities({ results: { bindings: [{ title: { value: "X" } }] } }).size, 0);
});

test("sitelinks and types are read back by title", () => {
  const map = readEntities({ results: { bindings: [
    { title: { value: "The Blitz" }, sitelinks: { value: "44" }, types: { value: "aerial bombing|Military operation" } },
    { title: { value: "ESPN" }, sitelinks: { value: "40" } },
  ] } });
  assert.equal(map.get("The Blitz")?.sitelinks, 44);
  assert.deepEqual(map.get("The Blitz")?.types, ["aerial bombing", "military operation"]);
  assert.deepEqual(map.get("ESPN")?.types, []);
});

test("every link in the events section is offered for the fame lookup", () => {
  const all = allEventLinks(PAGE);
  assert.ok(all.includes("The Blitz"));
  assert.ok(all.includes("London"));
  assert.ok(all.includes("Independence of Brazil"));
  assert.equal(all.includes("Buddy Holly"), false, "births are not events");
});
