// Which article an Events line on a Wikipedia date page is about.
//
// Every line on those pages links the things it mentions: the year, the
// event, the people, the places. The importer kept the sentence and threw
// the links away, so nothing in historical_events said what a row was
// about, and the one number that separates one row from another, how many
// people look the thing up on its date each year, had nothing to be
// measured on. This picks the one link that names the subject.
//
// The rule is written against the real September 11 page and pinned in
// worker/test/subject.test.ts, twenty lines it must get right and twenty
// it must refuse. It refuses whenever it would have to guess, because a
// wrong article here is not a blank: it is a city's pageviews ranking a
// quiet skirmish above the thing everybody remembers. Absent beats wrong.
//
// In order:
//
//   1. Only the first sentence is read. "The army is defeated nine months
//      later in the Battle of Poltava" is a second sentence about a
//      different day.
//   2. Leading "Something:" prefixes come off one at a time. A war used as
//      a prefix ("World War I: Australia invades...") is context. An event
//      used as a prefix ("Battle of Stirling Bridge: Scots jointly led
//      by...") is the subject, and wins over everything after the colon.
//   3. Among what is left, a link whose title is shaped like an event, a
//      battle, a treaty, a hurricane, a flight number, a year in front of
//      a noun, is the subject when it is the only such link. Two or more
//      is a guess, and is refused.
//   4. With no event shaped link, the first link is the subject when it
//      names its own article, nothing but the year and a possessive stands
//      in front of it, and it is not a country, a place, a polity, an
//      organisation, or an acronym. "Henry Hudson arrives on Manhattan
//      Island" is about Henry Hudson. "RAF bombing raid on Darmstadt" is
//      about neither the RAF nor Darmstadt, and gets nothing.
//
// A war is never a subject unless it is the only link on the line
// ("Six-Day War begins"), because on these pages a war is the heading a
// battle is filed under.

import { decodeEntities } from "./html.js";

export interface Subject {
  /** The article title as Wikipedia writes it, with spaces. */
  title: string;
  /** True when the link is marked as a redirect, so the title needs resolving before it is measured. */
  redirect: boolean;
}

export interface SubjectRead {
  subject: Subject | null;
  /** Why, in a few words, for the report and the tests. */
  reason: string;
}

interface Link {
  title: string;
  /** The visible text of the link, entities decoded. */
  anchor: string;
  redirect: boolean;
  /** True when the anchor is followed by 's or ', so it modifies what comes next. */
  possessive: boolean;
  /** True when the anchor is followed by a comma and a capitalised word: "Santiago, Chile". */
  appositive: boolean;
  /** The plain text just before the link, up to a few words, so "in Valletta" and "after the Peekskill riots" can be read. */
  before: string;
  /** True when a comma follows the anchor: "In Philadelphia, Harry Gold pleads guilty". */
  commaAfter: boolean;
}

const MONTH = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";

/** The year link that opens every line, and links to other dates and years in the text. */
function isDateLink(title: string): boolean {
  return /^(?:AD\s*)?\d{1,4}(?:\s*(?:BC|BCE))?$/i.test(title)
    || /^\d{1,4}s$/.test(title)
    || /^\d+(?:st|nd|rd|th) century/i.test(title)
    || new RegExp(`^${MONTH} \\d{1,2}$`).test(title)
    || new RegExp(`^\\d{1,2} ${MONTH}$`).test(title);
}

/** Pages that are about a topic rather than a thing, and a few technical shapes. */
function isMeta(title: string): boolean {
  return /^(?:List|Lists|History|Timeline|Outline|Glossary|Index|Category|Portal|Template|Wikipedia|Help|File|Special|Talk|Draft) (?:of|:)/i.test(title)
    || /^(?:List|Lists|History|Timeline|Outline|Glossary|Index|Category|Portal|Template|Wikipedia|Help|File|Special|Talk|Draft):/i.test(title)
    || /^Category \d/i.test(title)
    || /^Saffir/i.test(title);
}

/**
 * The words that make a title the name of something that happened. Matched
 * as whole words, case insensitive, against the title with its
 * disambiguator kept, so "Battle of Delhi (1803)" is a battle.
 */
const EVENT_WORDS =
  /\b(?:battles?|sieges?|massacres?|attacks?|bombings?|bombardments?|raids?|crash(?:es)?|disasters?|earthquakes?|fires?|floods?|hurricanes?|typhoons?|cyclones?|storms?|tornado(?:es)?|eruptions?|tsunamis?|collapses?|derailments?|disappearances?|hijackings?|coups?|revolutions?|uprisings?|rebellions?|revolts?|riots?|resistance|referendums?|referenda|elections?|treat(?:y|ies)|conventions?|conferences?|agreements?|accords?|declarations?|proclamations?|constitutions?|expeditions?|invasions?|occupations?|liberations?|mutin(?:y|ies)|strikes?|speech(?:es)?|championships?|festivals?|games|olympics|traged(?:y|ies)|incidents?|shootings?|explosions?|assassinations?|executions?|trials?|weddings?|coronations?|landings?|independence|founding|annexations?|blockades?|surrenders?|armistices?|ceasefires?|conquests?|campaigns?|crusades?|plagues?|famines?|epidemics?|pandemics?|outbreaks?|cris[ie]s|scandals?|affairs?|premieres?|expositions?|summits?|ceremon(?:y|ies)|inaugurations?|dedications?|memorials?|rockslides?|landslides?|avalanches?|wrecks?|sinkings?|protests?|boycotts?|embargo(?:es)?|purges?|pogroms?|genocides?|expulsions?|secessions?|unifications?|partitions?|plebiscites?|abdications?|tournaments?|cup|grand prix|marathons?|exhibitions?|concerts?|broadcasts?|crossings?|voyages?|marches?|persecutions?|ambush(?:es)?|skirmish(?:es)?|firebombings?|airstrikes?|mission|operation|brawls?|duels?|demonstrations?|stabbings?|plot|riots?)\b/i;

/** Words that do not count as naming anything when they are all a title has besides an event word. */
const FILLER = /^(?:the|of|in|at|on|and|de|la|le|du|des|del|von|der|d'état|d’état|a|an|for|to)$/i;

/** Missions and vehicles whose flights are events: "Apollo 11", "Soyuz MS-26", "Air France Flight 1611". */
const MISSION = /(?:\bFlight \d|^(?:Soyuz|Progress|Apollo|Gemini|Vostok|Voskhod|Skylab|Salyut|Artemis|Shenzhou|Sputnik|Luna|Voyager|Viking|Pioneer|Mariner|Mars|Venera|Zond|STS-|SpaceX|Crew|Expedition|Chandrayaan|Mangalyaan|Hayabusa|Rosetta|Cassini|Galileo|Juno|Curiosity|Perseverance|Opportunity|Spirit|Phoenix|InSight|New Horizons|Parker|Kepler|Hubble|Webb|Explorer|Vanguard|Ranger|Surveyor|Mercury-)[ -](?:\d|[A-Z]{1,3}-?\d))/;

/** The general article on a recurring thing: "Olympic Games" is not the 1972 games, whatever line links it. */
const GENERAL = new Set(["Olympic Games", "Summer Olympic Games", "Winter Olympic Games", "Paralympic Games", "FIFA World Cup", "Super Bowl", "World Series", "Grand Prix", "Tour de France", "Wimbledon Championships", "Stanley Cup", "General election", "Presidential election", "Referendum", "Coup d'état", "War", "Battle", "Earthquake", "Hurricane", "Tsunami", "Flood", "Fire", "Treaty", "Constitution", "Election", "Revolution", "Genocide", "Massacre", "Riot", "Strike action", "Special Olympics", "Airship", "Freeway"]);

/** A title that names a war, which on these pages is a heading rather than a happening. */
function isWar(title: string): boolean {
  return /\bwars?\b/i.test(title);
}

function isEventShaped(title: string): boolean {
  if (isMeta(title) || isWar(title) || GENERAL.has(title)) return false;
  // "Apollo 11 anniversaries" is about remembering, not about the day.
  if (/anniversar/i.test(title)) return false;
  if (/^\d{4}(?:–\d{2,4})? /.test(title)) return true;
  if (/\b(?:of|in) \d{4}$/.test(title.replace(/\s*\(.*\)\s*$/, ""))) return true;
  if (MISSION.test(title)) return true;
  // "People's Liberation Army" has "Liberation" in it and is an army.
  if (isOrganisation(title)) return false;
  if (!EVENT_WORDS.test(title)) return false;
  // A bare "Earthquake" or "Coup d'état" is the concept, not an occurrence.
  const named = title.replace(/\s*\(.*\)\s*$/, "").split(/[\s_]+/).filter((w) => w !== "" && !FILLER.test(w) && !EVENT_WORDS.test(w));
  return named.length > 0;
}

// ---------------------------------------------------------------------------
// Context: the things a line mentions that it is not about
// ---------------------------------------------------------------------------

const COUNTRIES = new Set([
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burma", "Burundi", "Cambodia", "Cameroon",
  "Canada", "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Costa Rica", "Croatia",
  "Cuba", "Cyprus", "Czech Republic", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
  "El Salvador", "England", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia (country)", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau",
  "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo",
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
  "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Mauritania", "Mauritius", "Mexico",
  "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal",
  "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan",
  "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
  "Romania", "Russia", "Rwanda", "Samoa", "San Marino", "Saudi Arabia", "Scotland", "Senegal", "Serbia", "Seychelles",
  "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka",
  "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Tibet",
  "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates",
  "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Wales", "Yemen",
  "Zambia", "Zimbabwe",
  // Gone, or larger than a country.
  "Great Britain", "Britain", "Soviet Union", "Prussia", "Persia", "Nazi Germany", "West Germany", "East Germany", "Yugoslavia",
  "Czechoslovakia", "Austria-Hungary", "Byzantium", "Rome", "Ancient Rome", "Ancient Greece", "Europe", "Asia", "Africa",
  "North America", "South America", "Central America", "Latin America", "Antarctica", "Oceania", "Middle East", "Scandinavia",
  "Balkans", "Caribbean", "Siberia", "Manchuria", "Korea", "Indochina", "Bengal", "Punjab", "Kashmir", "Corsica", "Sicily",
  "Sardinia", "Crete", "Borneo", "Java", "Sumatra", "Hawaii", "Alaska", "Texas", "California", "Florida", "New York (state)",
  "Virginia", "Pennsylvania", "Massachusetts", "Ohio", "Illinois", "Georgia (U.S. state)", "Michigan", "New Jersey", "Washington (state)",
  "Arizona", "Tennessee", "Indiana", "Missouri", "Maryland", "Wisconsin", "Colorado", "Minnesota", "South Carolina", "Alabama",
  "Louisiana", "Kentucky", "Oregon", "Oklahoma", "Connecticut", "Utah", "Iowa", "Nevada", "Arkansas", "Mississippi", "Kansas",
  "New Mexico", "Nebraska", "Idaho", "West Virginia", "New Hampshire", "Maine", "Montana", "Rhode Island", "Delaware",
  "South Dakota", "North Dakota", "Vermont", "Wyoming", "New England", "Quebec", "Ontario", "British Columbia", "Sikkim", "Kosovo",
  "Metohija", "Manhattan", "Brooklyn", "Mars", "Moon", "Earth", "Venus", "Jupiter", "Saturn",
]);

function isCountry(title: string): boolean {
  return COUNTRIES.has(title);
}

/** "Cambridge, Massachusetts", "Mount Vernon", "Colorado County, Texas", "Gulf of Mexico", "New York City". */
function isPlace(title: string): boolean {
  return /, /.test(title)
    || /^(?:Mount|Mt\.|Lake|Cape|Fort|Port|River|Isle|Gulf|Bay|Strait|Sea|Cape|Loch|Canton|Province|Region|County|Department|Prefecture|District|Municipality|Republic|Kingdom|Duchy|Grand Duchy|Principality|Emirate|Sultanate|Caliphate|Empire|State|Free State|Dominion|Colony|Territory|Commonwealth|Union|Federation|Confederation) of\b/i.test(title)
    || /\b(?:River|Island|Islands|County|Mountain|Mountains|Valley|Bay|Strait|Peninsula|Desert|Sea|Ocean|Lake|Canal|Harbor|Harbour|City|Province|Region|Territory|Empire|Republic|Kingdom|Dynasty|Caliphate|Sultanate|Khanate|Confederacy|Colony|Coast|Forest|Plateau|Basin|Delta|Gulf|Cape|Point|Ridge|Pass|Airport|Station)$/i.test(title)
    || /^(?:Mount|Lake|Cape|Fort|Port|Saint|St\.|San|Santa|Santo|São|Las|Los|La|El) /.test(title) && !EVENT_WORDS.test(title)
    || /^Canton of\b/i.test(title);
}

/** Armies, parties, companies, churches, choirs: the things that do things. */
function isOrganisation(title: string): boolean {
  return /\b(?:Army|Armies|Navy|Air Force|Marine Corps|Marines|Corps|Division|Regiment|Brigade|Battalion|Battalions|Squadron|Fleet|Legion|Guard|Guards|Police|Department|Ministry|Party|Company|Corporation|Inc\.|University|College|School|Church|Cathedral|Abbey|Choir|Orchestra|Knights|Order|Society|Association|Union|Federation|League|Committee|Council|Congress|Parliament|Senate|Assembly|Court|Bank|Airlines|Air Lines|Airways|Railway|Railroad|Agency|Bureau|Office|Institute|Foundation|Organization|Organisation|Force|Forces|Troops|Militia|Secretary|Minister|Governor|Commission|Commissioner|Authority|Service|Group|Team|Club|Band|Units|Movement|Junta|Cabinet|Administration)\b/i.test(title)
    || /^[A-Z][A-Z0-9&.-]{1,7}$/.test(title);
}

/** Anything the line mentions that it is not about. */
function isContext(title: string): boolean {
  return isDateLink(title) || isMeta(title) || isCountry(title) || isPlace(title) || isOrganisation(title) || isWar(title);
}

// ---------------------------------------------------------------------------
// Reading the line
// ---------------------------------------------------------------------------

/** Tags that carry no meaning here come off; links stay. */
function keepOnlyLinks(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<span\b[^>]*style="[^"]*display\s*:\s*none[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<span\b[^>]*style="[^"]*visibility\s*:\s*hidden[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<(?!\/?a\b)[^>]*>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ABBREVIATIONS = /^(?:St|Mt|Dr|Mr|Mrs|Ms|Gen|Col|Lt|Capt|Sgt|Adm|Gov|Pres|Sen|Rep|Jr|Sr|No|vs|Inc|Co|Ltd|Ft|Pt|Ave|Blvd|Rev|Hon|Prof|Msgr|Fr|Br|Sts|Mts|approx|ca|c|Cmdr|Maj|Brig|Cpl|Pvt|Adm|Messrs|Mme|Mlle|Capt|Op|Nos|vol|ed|al|Bros|Mfg)$/i;

/**
 * The first sentence of the line, as HTML with its links intact.
 *
 * A sentence ends at a period followed by white space and a capital letter
 * or a link, unless the word before the period is an abbreviation or a
 * single initial ("Franklin D. Roosevelt", "Washington, D.C.").
 */
export function firstSentence(html: string): string {
  const pattern = /\.\s+(?=[A-Z"“(]|<a\b)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const before = html.slice(0, match.index).replace(/<[^>]*>/g, "");
    const lastWord = /(\S+)$/.exec(before)?.[1] ?? "";
    const token = lastWord.replace(/^[("“'‘]+/, "");
    if (ABBREVIATIONS.test(token)) continue;
    if (/^[A-Z]$/.test(token)) continue;
    if (/^[A-Z]\.[A-Z]$/.test(token)) continue;
    return html.slice(0, match.index + 1);
  }
  return html;
}

/** Every article link in a stretch of HTML, in order, with what follows it noted. */
function linksIn(html: string): Link[] {
  const out: Link[] = [];
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>([\s\S]{0,3})/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const attributes = match[1] ?? "";
    const before = decodeEntities(html.slice(Math.max(0, match.index - 80), match.index).replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trimEnd();
    const href = /\bhref="([^"]*)"/i.exec(attributes)?.[1] ?? "";
    if (!href.startsWith("/wiki/")) continue;
    const rawTitle = /\btitle="([^"]*)"/i.exec(attributes)?.[1];
    const fromHref = decodeURIComponent(href.slice("/wiki/".length).split(/[#?]/)[0] ?? "").replace(/_/g, " ");
    const title = decodeEntities(rawTitle ?? fromHref).trim();
    if (title === "") continue;
    const anchor = decodeEntities((match[2] ?? "").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
    const after = match[3] ?? "";
    out.push({
      title,
      anchor,
      redirect: /\bmw-redirect\b/.test(attributes),
      possessive: /^['’]s?\b/.test(after),
      appositive: /^,\s*[A-Z]/.test(after),
      before,
      commaAfter: /^,/.test(after),
    });
    // Rewind so the three characters of lookahead are not lost to the next match.
    pattern.lastIndex = match.index + match[0].length - after.length;
  }
  return out;
}

/** True when the visible text of a link is the article's own name. */
function namesItself(link: Link): boolean {
  const norm = (s: string): string => s.replace(/\s*\(.*\)\s*$/, "").replace(/^the\s+/i, "").replace(/\s+/g, " ").trim().toLowerCase();
  return norm(link.anchor) === norm(link.title);
}

/** The year and the dash that open every line, in any of the forms the pages use. */
const OPENING = /^\s*(?:<a\b[^>]*>)?\s*(?:AD\s*)?\d{1,4}(?:\s*(?:BC|BCE))?\s*(?:<\/a>)?[\s ]*(?:&#8211;|&#x2013;|&ndash;|&#8212;|&mdash;|–|—|-)\s*/i;

/**
 * A leading "Something:" prefix, linked or plain. Allows "The " in front and a
 * word or two between the link and the colon ("Battle of the Teutoburg
 * Forest ends:", "Siege of Drogheda ends:").
 */
const LINKED_PREFIX = /^(?:The\s+)?(<a\b[^>]*>[\s\S]*?<\/a>)(?:\s+[a-z]+){0,2}:\s+/;
const PLAIN_PREFIX = /^(?:The\s+)?[A-Z][^<>:]{1,60}?:\s+(?=\S)/;

/**
 * The subject of one Events line, given the list item's own inner HTML: the
 * part before any nested list. Pure.
 */
export function subjectOf(itemHtml: string): SubjectRead {
  let html = keepOnlyLinks(itemHtml.split(/<ul\b/i)[0] ?? "");
  html = html.replace(OPENING, "");
  html = firstSentence(html);

  // Step 2: the prefixes. A prefix that names itself and is neither a war
  // nor an event ("The Second Period of Russification: The teaching of...")
  // is held: it is the subject unless an event follows the colon ("Voyager
  // program: Voyager 1 is launched" is about Voyager 1).
  let held: Link | null = null;
  for (let guard = 0; guard < 4; guard += 1) {
    const linked = LINKED_PREFIX.exec(html);
    if (linked !== null) {
      const [link] = linksIn(linked[1] ?? "");
      html = html.slice(linked[0].length);
      if (link === undefined) continue;
      if (isDateLink(link.title) || isMeta(link.title)) continue;
      if (isWar(link.title)) continue;
      if (isEventShaped(link.title)) {
        return { subject: { title: link.title, redirect: link.redirect }, reason: "the line opens with the event, then a colon" };
      }
      if (held === null && namesItself(link) && !isContext(link.title)) held = link;
      continue;
    }
    const plain = PLAIN_PREFIX.exec(html);
    if (plain !== null) {
      html = html.slice(plain[0].length);
      continue;
    }
    break;
  }

  const links = linksIn(html).filter((l) => !isDateLink(l.title) && !isMeta(l.title));
  if (links.length === 0 && held !== null) {
    return { subject: { title: held.title, redirect: held.redirect }, reason: "the line opens with its subject, then a colon" };
  }
  if (links.length === 0) return { subject: null, reason: "no article is linked" };

  // A war is a heading, not a happening, unless the line is about nothing else.
  if (links.length === 1 && links[0] !== undefined && isWar(links[0].title)) {
    return { subject: { title: links[0].title, redirect: links[0].redirect }, reason: "the war is the only thing the line names" };
  }

  // Step 3: the event shaped links. One that the sentence places in time
  // against something else ("eight days after the Peekskill riots",
  // "following Israel's 1982 Invasion of Lebanon") is context, unless the
  // sentence opens with it ("After a nationwide referendum, Scotland
  // votes..."), which is the referendum itself being reported.
  const inTime = (l: Link): boolean => {
    const words = l.before.replace(/[,;]/g, " ").trim().split(/\s+/).filter((w) => w !== "");
    const tail = words.slice(-4);
    const preposition = tail.findIndex((w) => /^(?:after|following|since|before|amid|until|despite|because)$/i.test(w));
    return preposition >= 0 && words.length > tail.length - preposition;
  };
  const events = links.filter((l) => isEventShaped(l.title) && !inTime(l));
  if (events.length === 1 && events[0] !== undefined) {
    return { subject: { title: events[0].title, redirect: events[0].redirect }, reason: "the one link shaped like an event" };
  }
  if (events.length > 1) {
    return { subject: null, reason: `${events.length} links are shaped like events: ${events.map((e) => e.title).join("; ")}` };
  }
  if (held !== null) {
    return { subject: { title: held.title, redirect: held.redirect }, reason: "the line opens with its subject, then a colon" };
  }

  // Step 4: the first link, when it names itself and nothing stands in front
  // of it. A possessive ("NASA's Mars Global Surveyor") and a common noun
  // ("the largest conventional weapon ever, the Father of All Bombs") are
  // passed over when something follows them; a proper noun is capitalised in
  // running text, so a link whose anchor is not is the concept and never the
  // subject on its own.
  const commonNoun = (l: Link): boolean => !/^(?:the\s+)?[A-Z0-9]/.test(l.anchor);
  // "In Philadelphia, Harry Gold pleads guilty": a place the sentence opens
  // with, set off by a comma, is where and not what.
  const opensWithPlace = (l: Link): boolean => /^(?:In|At|Near|Outside)\s*(?:the\s+)?$/i.test(l.before) && l.commaAfter;
  // "Soviet leader Joseph Stalin", "Sienese Ghibellines": a link that does
  // not name its own article is describing the next thing, not naming this one.
  let index = 0;
  while (index + 1 < links.length && (links[index]?.possessive || commonNoun(links[index]!) || opensWithPlace(links[index]!) || !namesItself(links[index]!))) index += 1;
  const first = links[index];
  if (first === undefined) return { subject: null, reason: "no article is linked" };
  if (commonNoun(first)) return { subject: null, reason: `${first.title} is a common noun here, not a name` };
  if (!namesItself(first)) return { subject: null, reason: `the first link, ${first.title}, is not named by its own name` };
  // "in Valletta" is where something happened; "the safety of Palestinian
  // refugees" is whose. Neither is what happened. "The discovery of
  // Buckminsterfullerene" is, so a noun that names a happening lets its
  // "of" through.
  const lead = first.before.split(/\s+/).slice(-2).join(" ");
  if (/\b(?:in|near|from|into|outside|across|throughout|off|within|of)$/i.test(lead)
    && !/\b(?:discovery|founding|foundation|death|birth|opening|premiere|launch|signing|creation|establishment|fall|end|start|beginning|completion|dedication|consecration|coronation|inauguration|abdication|assassination|execution|arrest|release|publication|unveiling|introduction|invention|formation|proclamation|independence|surrender|capture|liberation|destruction|sinking|collapse|closure|ratification|adoption|passage|election|appointment|resignation|wedding|marriage|funeral|burial|canonisation|canonization|construction|demolition|sale|purchase|debut|first flight|maiden flight|first performance|first publication) of$/i.test(lead)) {
    return { subject: null, reason: `${first.title} is where or whose, not what happened` };
  }
  if (first.appositive) return { subject: null, reason: `${first.title} reads as a place, followed by a comma and a region` };
  if (isContext(first.title)) return { subject: null, reason: `the first link, ${first.title}, is a country, a place, a polity, an organisation or an acronym` };
  return { subject: { title: first.title, redirect: first.redirect }, reason: "the first thing the line names" };
}

/** The address the measurement is keyed by, the way the rest of the importer writes one. */
export function subjectUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}
