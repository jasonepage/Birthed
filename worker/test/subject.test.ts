import { strict as assert } from "node:assert";
import { test } from "node:test";

import { firstSentence, subjectOf, subjectUrl } from "../src/subject.js";

// Real list items from the September 11, September 4 and July 20 date
// pages, as action=parse rendered them on September 11, 2026, with
// reference markers and generated ids removed. Every line below was read
// and judged by a person before it was pinned. The rule is measured
// against these the way wall-news.test.ts measures the news screen: it
// must get the first list right, it must refuse the second list rather
// than guess, and the third list records the answers it gives on lines
// where a person could argue, so a change there is noticed rather than
// slipped.

const RIGHT: Array<[string, string, string]> = [
  ["the event opens the line and is followed by a colon", "Battle of the Teutoburg Forest",
    `<a href="/wiki/AD_9" class="mw-redirect" title="AD 9">9</a> &#8211; The <a href="/wiki/Battle_of_the_Teutoburg_Forest" title="Battle of the Teutoburg Forest">Battle of the Teutoburg Forest</a> ends: The <a href="/wiki/Roman_Empire" title="Roman Empire">Roman Empire</a> suffers the greatest defeat of its history and the <a href="/wiki/Rhine" title="Rhine">Rhine</a> is established as the border between the Empire and the so-called <a href="/wiki/Germanic_peoples" title="Germanic peoples">barbarians</a> for the next four hundred years.`],
  ["a battle used as a prefix beats the people after the colon", "Battle of Stirling Bridge",
    `<a href="/wiki/1297" title="1297">1297</a> &#8211; <a href="/wiki/Battle_of_Stirling_Bridge" title="Battle of Stirling Bridge">Battle of Stirling Bridge</a>: Scots jointly led by <a href="/wiki/William_Wallace" title="William Wallace">William Wallace</a> and <a href="/wiki/Andrew_Moray" title="Andrew Moray">Andrew Moray</a> defeat the English.`],
  ["the event is the third link, after a demonym and a country", "Great Siege of Malta",
    `<a href="/wiki/1565" title="1565">1565</a> &#8211; <a href="/wiki/Ottoman_Empire" title="Ottoman Empire">Ottoman</a> forces retreat from <a href="/wiki/Malta" title="Malta">Malta</a> ending the <a href="/wiki/Great_Siege_of_Malta" title="Great Siege of Malta">Great Siege of Malta</a>.`],
  ["a person who opens the line and is named by name", "Henry Hudson",
    `<a href="/wiki/1609" title="1609">1609</a> &#8211; <a href="/wiki/Henry_Hudson" title="Henry Hudson">Henry Hudson</a> arrives on <a href="/wiki/Manhattan_Island" class="mw-redirect" title="Manhattan Island">Manhattan Island</a> and meets the indigenous people living there.`],
  ["a plain text war prefix comes off and the battle after it is the subject", "Battle of Brandywine",
    `<a href="/wiki/1777" title="1777">1777</a> &#8211; American Revolutionary War: <a href="/wiki/Battle_of_Brandywine" title="Battle of Brandywine">Battle of Brandywine</a>: The British celebrate a major victory in <a href="/wiki/Chester_County,_Pennsylvania" title="Chester County, Pennsylvania">Chester County, Pennsylvania</a>.`],
  ["an object that opens the line", "Hope Diamond",
    `<a href="/wiki/1792" title="1792">1792</a> &#8211; The <a href="/wiki/Hope_Diamond" title="Hope Diamond">Hope Diamond</a> is stolen along with other French crown jewels when six men break into the house where they are stored.`],
  ["a linked war prefix is context and the battle later in the line is the subject", "Battle of Plattsburgh",
    `<a href="/wiki/1814" title="1814">1814</a> &#8211; War of 1812: The climax of the <a href="/wiki/Battle_of_Plattsburgh" title="Battle of Plattsburgh">Battle of Plattsburgh</a>, a major United States victory in the war.`],
  ["the event is the only event shaped link even though a person and a town come first", "Battle of Tampico (1829)",
    `<a href="/wiki/1829" title="1829">1829</a> &#8211; An expedition led by <a href="/wiki/Isidro_Barradas" class="mw-redirect" title="Isidro Barradas">Isidro Barradas</a> at <a href="/wiki/Tampico" title="Tampico">Tampico</a>, sent by the Spanish crown to retake Mexico, surrenders at the <a href="/wiki/Battle_of_Tampico_(1829)" title="Battle of Tampico (1829)">Battle of Tampico</a>, marking the effective end of Spain's resistance to Mexico's campaign for independence.`],
  ["an event linked under different words is still the event", "Bombardment of Beirut (1840)",
    `<a href="/wiki/1840" title="1840">1840</a> &#8211; An Anglo-Turkish force <a href="/wiki/Bombardment_of_Beirut_(1840)" title="Bombardment of Beirut (1840)">captures Beirut</a> with the help of bombardment by an English fleet.`],
  ["a country, a canton and a village around the one event", "Rockslide of Elm",
    `<a href="/wiki/1881" title="1881">1881</a> &#8211; In the <a href="/wiki/Switzerland" title="Switzerland">Swiss</a> state of <a href="/wiki/Canton_of_Glarus" title="Canton of Glarus">Glarus</a>, a <a href="/wiki/Rockslide_of_Elm" title="Rockslide of Elm">rockslide</a> buries parts of the village of <a href="/wiki/Elm,_Switzerland" title="Elm, Switzerland">Elm</a>, destroying 83 buildings and killing 115 people.`],
  ["a linked war prefix, a colony, then the battle", "Battle of Bita Paka",
    `<a href="/wiki/1914" title="1914">1914</a> &#8211; <a href="/wiki/World_War_I" title="World War I">World War I</a>: Australia invades <a href="/wiki/German_New_Guinea" title="German New Guinea">German New Guinea</a>, defeating a German contingent at the <a href="/wiki/Battle_of_Bita_Paka" title="Battle of Bita Paka">Battle of Bita Paka</a>.`],
  ["a possessive first link is the subject when nothing follows it in the first sentence", "Quebec Bridge",
    `<a href="/wiki/1916" title="1916">1916</a> &#8211; The <a href="/wiki/Quebec_Bridge" title="Quebec Bridge">Quebec Bridge</a>'s central span collapses, killing 11 men. The bridge previously collapsed completely on <a href="/wiki/August_29" title="August 29">August 29</a>, <a href="/wiki/1907" title="1907">1907</a>.`],
  ["a building named after a lowercase article", "The Pentagon",
    `<a href="/wiki/1941" title="1941">1941</a> &#8211; Construction begins on <a href="/wiki/The_Pentagon" title="The Pentagon">the Pentagon</a>.`],
  ["a speech is an event and beats the person who gave it", "Des Moines speech",
    `<a href="/wiki/1941" title="1941">1941</a> &#8211; <a href="/wiki/Charles_Lindbergh" title="Charles Lindbergh">Charles Lindbergh</a> makes his <a href="/wiki/Des_Moines_speech" title="Des Moines speech">Des Moines speech</a> accusing the British, Jews and <a href="/wiki/Franklin_D._Roosevelt" title="Franklin D. Roosevelt">FDR's</a> administration of conspiring for war with Germany.`],
  ["a storm named as a storm, with the generic category link ignored", "Hurricane Edna",
    `<a href="/wiki/1954" title="1954">1954</a> &#8211; <a href="/wiki/Hurricane_Edna" title="Hurricane Edna">Hurricane Edna</a> hits <a href="/wiki/New_England" title="New England">New England</a> (United States) as a <a href="/wiki/Category_2_hurricane" class="mw-redirect" title="Category 2 hurricane">Category 2 hurricane</a>, causing significant damage and 29 deaths.`],
  ["a flight number is an event, and the town it fell near is not", "Air France Flight 1611",
    `<a href="/wiki/1968" title="1968">1968</a> &#8211; <a href="/wiki/Air_France_Flight_1611" title="Air France Flight 1611">Air France Flight 1611</a> crashes off <a href="/wiki/Nice" title="Nice">Nice</a>, France, killing 89 passengers and six crew.`],
  ["a coup linked under two words, ahead of a country and two people", "1973 Chilean coup d'état",
    `<a href="/wiki/1973" title="1973">1973</a> &#8211; <a href="/wiki/1973_Chilean_coup_d%27%C3%A9tat" title="1973 Chilean coup d&#39;état">A coup</a> in <a href="/wiki/Chile" title="Chile">Chile</a>, headed by General <a href="/wiki/Augusto_Pinochet" title="Augusto Pinochet">Augusto Pinochet</a>, topples the democratically elected president <a href="/wiki/Salvador_Allende" title="Salvador Allende">Salvador Allende</a>.`],
  ["a possessive acronym stands aside for the spacecraft it owns", "Mars Global Surveyor",
    `<a href="/wiki/1997" title="1997">1997</a> &#8211; <a href="/wiki/NASA" title="NASA">NASA</a>'s <a href="/wiki/Mars_Global_Surveyor" title="Mars Global Surveyor">Mars Global Surveyor</a> reaches <a href="/wiki/Mars" title="Mars">Mars</a>.`],
  ["the attacks, not the group that carried them out, and not the buildings and towns in the second sentence", "September 11 attacks",
    `<a href="/wiki/2001" title="2001">2001</a> &#8211; Nineteen members of <a href="/wiki/Al-Qaeda" title="Al-Qaeda">al-Qaeda</a> execute the <a href="/wiki/September_11_attacks" title="September 11 attacks">September 11 attacks</a>, a series of coordinated terrorist attacks that killed 2,977 people using four hijacked aircraft. Two aircraft crash into the <a href="/wiki/World_Trade_Center_(1973%E2%80%932001)" title="World Trade Center (1973–2001)">World Trade Center</a> in New York City, a third crashes into <a href="/wiki/The_Pentagon" title="The Pentagon">The Pentagon</a> in <a href="/wiki/Arlington_County,_Virginia" title="Arlington County, Virginia">Arlington County, Virginia</a>, and a fourth into a field near <a href="/wiki/Shanksville,_Pennsylvania" title="Shanksville, Pennsylvania">Shanksville, Pennsylvania</a>.`],
  ["a spacecraft on a line with a hidden year", "Soyuz MS-26",
    `2024   &#8211; <a href="/wiki/Soyuz_MS-26" title="Soyuz MS-26">Soyuz MS-26</a> is launched to the <a href="/wiki/International_Space_Station" title="International Space Station">International Space Station</a>, setting a record of 19 people in orbit at the same time.`],
  ["a common noun is passed over for the named thing after it", "Father of All Bombs",
    `<a href="/wiki/2007" title="2007">2007</a> &#8211; Russia tests the largest <a href="/wiki/Conventional_weapon" title="Conventional weapon">conventional weapon</a> ever, the <a href="/wiki/Father_of_All_Bombs" title="Father of All Bombs">Father of All Bombs</a>.`],
  ["a prefix that names itself and is not an event is the subject when no event follows", "Second Period of Russification",
    `1914   &#8211; The <a href="/wiki/Second_Period_of_Russification" class="mw-redirect" title="Second Period of Russification">Second Period of Russification</a>: The teaching of the <a href="/wiki/Russian_language" title="Russian language">Russian language</a> and <a href="/wiki/History_of_Russia" title="History of Russia">Russian history</a> in Finnish schools is ordered to be considerably increased as part of the <a href="/wiki/Russification_of_Finland" title="Russification of Finland">forced Russification program</a> in <a href="/wiki/Grand_Duchy_of_Finland" title="Grand Duchy of Finland">Finland</a> run by Tsar <a href="/wiki/Nicholas_II_of_Russia" class="mw-redirect" title="Nicholas II of Russia">Nicholas II</a>.`],
  ["a programme prefix gives way to the mission after the colon (September 5)", "Voyager 1",
    `<a href="/wiki/1977" title="1977">1977</a> &#8211; <a href="/wiki/Voyager_program" title="Voyager program">Voyager program</a>: <i><a href="/wiki/Voyager_1" title="Voyager 1">Voyager 1</a></i> is launched.`],
  ["the same shape on July 20, with the mission possessive", "Apollo 11",
    `<a href="/wiki/1969" title="1969">1969</a> &#8211; <a href="/wiki/Apollo_program" title="Apollo program">Apollo program</a>: <a href="/wiki/Apollo_11" title="Apollo 11">Apollo 11</a>'s crew successfully makes the first human landing on the <a href="/wiki/Moon" title="Moon">Moon</a> in the <a href="/wiki/Mare_Tranquillitatis" title="Mare Tranquillitatis">Sea of Tranquility</a>. Americans <a href="/wiki/Neil_Armstrong" title="Neil Armstrong">Neil Armstrong</a> and <a href="/wiki/Buzz_Aldrin" title="Buzz Aldrin">Buzz Aldrin</a> become the first humans to walk on the Moon six and a half hours later.`],
  ["an assassination attempt linked under plain words, after a war prefix and a name (July 20)", "20 July plot",
    `<a href="/wiki/1944" title="1944">1944</a> &#8211; <a href="/wiki/World_War_II" title="World War II">World War II</a>: <a href="/wiki/Adolf_Hitler" title="Adolf Hitler">Adolf Hitler</a> survives <a href="/wiki/20_July_plot" title="20 July plot">an assassination attempt</a> led by German Army Colonel <a href="/wiki/Claus_von_Stauffenberg" title="Claus von Stauffenberg">Claus von Stauffenberg</a>.`],
  ["a riot eight days earlier is context, and the performer is the subject (September 4)", "Paul Robeson",
    `<a href="/wiki/1949" title="1949">1949</a> &#8211; <a href="/wiki/Paul_Robeson" title="Paul Robeson">Paul Robeson</a> performs a second concert in <a href="/wiki/Peekskill,_New_York" title="Peekskill, New York">Peekskill, New York</a> eight days after the <a href="/wiki/Peekskill_riots" title="Peekskill riots">Peekskill riots</a>.`],
  ["a city the sentence opens with is where, and the man is the subject (July 20)", "Harry Gold",
    `<a href="/wiki/1950" title="1950">1950</a> &#8211; <a href="/wiki/Cold_War" title="Cold War">Cold War</a>: In <a href="/wiki/Philadelphia" title="Philadelphia">Philadelphia</a>, <a href="/wiki/Harry_Gold" title="Harry Gold">Harry Gold</a> pleads guilty to spying for the Soviet Union by passing secrets from atomic scientist <a href="/wiki/Klaus_Fuchs" title="Klaus Fuchs">Klaus Fuchs</a>.`],
  ["a description that does not name its article is passed over for the name (July 20)", "Joseph Stalin",
    `<a href="/wiki/1941" title="1941">1941</a> &#8211; <a href="/wiki/Soviet_Union" title="Soviet Union">Soviet leader</a> <a href="/wiki/Joseph_Stalin" title="Joseph Stalin">Joseph Stalin</a> consolidates the Commissariats of Home Affairs and National Security to form the <a href="/wiki/NKVD" title="NKVD">NKVD</a> and names <a href="/wiki/Lavrentiy_Beria" title="Lavrentiy Beria">Lavrentiy Beria</a> its chief.`],
  ["a discovery of something is about the something (September 4)", "Buckminsterfullerene",
    `<a href="/wiki/1985" title="1985">1985</a> &#8211; The discovery of <a href="/wiki/Buckminsterfullerene" title="Buckminsterfullerene">Buckminsterfullerene</a>, the first <a href="/wiki/Fullerene" title="Fullerene">fullerene</a> molecule of carbon.`],
  ["the storm is what came before, and the dam failures are what happened (September 11)", "Derna dam collapses",
    `<a href="/wiki/2023" title="2023">2023</a> &#8211; The Libyan city of <a href="/wiki/Derna,_Libya" title="Derna, Libya">Derna</a> experiences catastrophic floods after <a href="/wiki/Storm_Daniel" title="Storm Daniel">Storm Daniel</a> causes <a href="/wiki/Derna_dam_collapses" title="Derna dam collapses">two dams to collapse</a>, killing thousands of people.`],
  ["a war is the subject when it is the only thing the line names (September 4)", "Continuation War",
    `1944   &#8211; World War II: Finland exits from the <a href="/wiki/Continuation_War" title="Continuation War">war with Soviet Union</a>.`],
];

const REFUSED: Array<[string, RegExp, string]> = [
  ["a war prefix, then an order of knights and a city: nothing names the siege", /Teutonic Knights/,
    `<a href="/wiki/1390" title="1390">1390</a> &#8211; <a href="/wiki/Lithuanian_Civil_War_(1389%E2%80%931392)" title="Lithuanian Civil War (1389–1392)">Lithuanian Civil War (1389–1392)</a>: The <a href="/wiki/Teutonic_Knights" class="mw-redirect" title="Teutonic Knights">Teutonic Knights</a> begin a five-week siege of <a href="/wiki/Vilnius" title="Vilnius">Vilnius</a>.`],
  ["a city followed by its country is a place, not the attack on it", /Santiago/,
    `<a href="/wiki/1541" title="1541">1541</a> &#8211; <a href="/wiki/Santiago" title="Santiago">Santiago</a>, Chile, is attacked by indigenous warriors, led by <a href="/wiki/Michimalonco" title="Michimalonco">Michimalonco</a>, to free eight indigenous chiefs held captive by the Spaniards.`],
  ["a battalion is an organisation and the man who disbanded it is not the event", /National Congress Battalions/,
    `<a href="/wiki/1800" title="1800">1800</a> &#8211; The Maltese <a href="/wiki/National_Congress_Battalions" title="National Congress Battalions">National Congress Battalions</a> are disbanded by British <a href="/wiki/List_of_Civil_Commissioners_of_Malta" class="mw-redirect" title="List of Civil Commissioners of Malta">Civil Commissioner</a> <a href="/wiki/Alexander_Ball" title="Alexander Ball">Alexander Ball</a>.`],
  ["a kingdom linked under another name", /not named by its own name/,
    `<a href="/wiki/1802" title="1802">1802</a> &#8211; France annexes the <a href="/wiki/Kingdom_of_Sardinia" title="Kingdom of Sardinia">Kingdom of Piedmont</a>.`],
  ["a war prefix, then a place and a city and no event", /Mount Vernon/,
    `<a href="/wiki/1813" title="1813">1813</a> &#8211; <a href="/wiki/War_of_1812" title="War of 1812">War of 1812</a>: British troops arrive in <a href="/wiki/Mount_Vernon" title="Mount Vernon">Mount Vernon</a> and prepare to march to and invade <a href="/wiki/Washington,_D.C." title="Washington, D.C.">Washington, D.C.</a>`],
  ["a line whose only link is a topic page", /no article is linked/,
    `<a href="/wiki/1919" title="1919">1919</a> &#8211; <a href="/wiki/History_of_Honduras#Honduras_in_the_twentieth_century" title="History of Honduras">United States Marine Corps invades Honduras</a>.`],
  ["a war prefix, an acronym and a city: the raid itself has no article", /RAF/,
    `<a href="/wiki/1944" title="1944">1944</a> &#8211; World War II: <a href="/wiki/RAF" class="mw-redirect" title="RAF">RAF</a> bombing raid on <a href="/wiki/Darmstadt" title="Darmstadt">Darmstadt</a> and the following firestorm kill 11,500.`],
  ["an army, a mountain pass, a state and the generic article on war", /People's Liberation Army/,
    `<a href="/wiki/1967" title="1967">1967</a> &#8211; China's <a href="/wiki/People%27s_Liberation_Army" title="People&#39;s Liberation Army">People's Liberation Army</a> (PLA) launched an attack on Indian posts at <a href="/wiki/Nathu_La" title="Nathu La">Nathu La</a>, <a href="/wiki/Sikkim" title="Sikkim">Sikkim</a>, India, which resulted in <a href="/wiki/War" title="War">military clashes</a>.`],
  ["a history page linked under the thing's name", /no article is linked/,
    `<a href="/wiki/1971" title="1971">1971</a> &#8211; The <a href="/wiki/History_of_the_Egyptian_Constitution" title="History of the Egyptian Constitution">Egyptian Constitution</a> becomes official.`],
  ["forces leaving a city after an invasion: the invasion is context, the refugees are whose, and the massacre is five days later", /whose|not named/,
    `<a href="/wiki/1982" title="1982">1982</a> &#8211; The international forces that were guaranteeing the safety of <a href="/wiki/Palestinian_refugees" title="Palestinian refugees">Palestinian refugees</a> following <a href="/wiki/Israel" title="Israel">Israel</a>'s <a href="/wiki/1982_Invasion_of_Lebanon" class="mw-redirect" title="1982 Invasion of Lebanon">1982 Invasion of Lebanon</a> leave <a href="/wiki/Beirut" title="Beirut">Beirut</a>. Five days later, several thousand refugees are massacred in the <a href="/wiki/Sabra_and_Shatila_massacre" title="Sabra and Shatila massacre">Sabra and Shatila refugee camps</a> by Phalange forces.`],
  ["a country linked as an adjective", /not named by its own name/,
    `<a href="/wiki/1989" title="1989">1989</a> &#8211; Hungary announces that the <a href="/wiki/East_Germany" title="East Germany">East German</a> refugees who had been housed in temporary camps were free to leave for West Germany.`],
  ["the memorial and the attacks it remembers are both events", /2 links are shaped like events/,
    `<a href="/wiki/2011" title="2011">2011</a> &#8211; A dedication ceremony is held at the United States <a href="/wiki/National_September_11_Memorial_%26_Museum" title="National September 11 Memorial &amp; Museum">National September 11 Memorial</a> on the 10th anniversary of the <a href="/wiki/September_11_attacks" title="September 11 attacks">September 11 attacks</a> in New York City, and the memorial opens to family members.`],
  ["a line with no links at all", /no article is linked/,
    `<a href="/wiki/1919" title="1919">1919</a> &#8211; United States Marine Corps invades Honduras.`],
  ["generals of a king capture another king: the first is whose and the second is not first (September 11)", /whose/,
    `<a href="/wiki/1897" title="1897">1897</a> &#8211; After months of pursuit, generals of <a href="/wiki/Menelik_II_of_Ethiopia" class="mw-redirect" title="Menelik II of Ethiopia">Menelik II of Ethiopia</a> capture <a href="/wiki/Gaki_Sherocho" title="Gaki Sherocho">Gaki Sherocho</a>, the last king of the <a href="/wiki/Kingdom_of_Kaffa" title="Kingdom of Kaffa">Kaffa</a>.`],
  ["two links under other names for the founding of a city (September 4)", /not named by its own name/,
    `<a href="/wiki/1781" title="1781">1781</a> &#8211; Los Angeles is founded as <a href="/wiki/Pueblo_de_Los_%C3%81ngeles" title="Pueblo de Los Ángeles">El Pueblo de Nuestra Señora La Reina de los Ángeles</a> (The Village of Our Lady, the Queen of the Angels) by <a href="/wiki/Los_Pobladores" class="mw-redirect" title="Los Pobladores">44 Spanish settlers</a>.`],
  ["a garrison in a city surrenders: the city is where (September 4)", /where or whose/,
    `<a href="/wiki/1800" title="1800">1800</a> &#8211; The French garrison in <a href="/wiki/Valletta" title="Valletta">Valletta</a> surrenders to British troops who had been called at the invitation of the <a href="/wiki/Maltese_people" title="Maltese people">Maltese</a>. The islands of <a href="/wiki/Malta_(island)" title="Malta (island)">Malta</a> and <a href="/wiki/Gozo" title="Gozo">Gozo</a> become the <a href="/wiki/Malta_Protectorate" title="Malta Protectorate">Malta Protectorate</a>.`],
  ["an armoured division liberates a city: an organisation and a place (September 4)", /11th Armoured Division/,
    `<a href="/wiki/1944" title="1944">1944</a> &#8211; World War II: The British <a href="/wiki/11th_Armoured_Division_(United_Kingdom)" title="11th Armoured Division (United Kingdom)">11th Armoured Division</a> liberates the Belgian city of <a href="/wiki/Antwerp" title="Antwerp">Antwerp</a>.`],
  ["a ceasefire between two countries, six days after a war began (July 20)", /Honduras/,
    `1969   &#8211; A cease fire is announced between <a href="/wiki/Honduras" title="Honduras">Honduras</a> and <a href="/wiki/El_Salvador" title="El Salvador">El Salvador</a>, six days after the beginning of the "<a href="/wiki/Football_War" title="Football War">Football War</a>".`],
  ["a country leaves an organisation (July 20)", /League of Nations/,
    `<a href="/wiki/1940" title="1940">1940</a> &#8211; Denmark leaves the <a href="/wiki/League_of_Nations" title="League of Nations">League of Nations</a>.`],
  ["two countries resume relations (July 20)", /United States/,
    `2015   &#8211; The <a href="/wiki/United_States" title="United States">United States</a> and <a href="/wiki/Cuba" title="Cuba">Cuba</a> resume full <a href="/wiki/Cuba%E2%80%93United_States_relations" title="Cuba–United States relations">diplomatic relations</a> after five decades.`],
  ["an agency releases documents: an organisation, a law and a programme (July 20)", /Central Intelligence Agency/,
    `<a href="/wiki/1977" title="1977">1977</a> &#8211; The <a href="/wiki/Central_Intelligence_Agency" title="Central Intelligence Agency">Central Intelligence Agency</a> releases documents under the <a href="/wiki/Freedom_of_Information_Act_(United_States)" title="Freedom of Information Act (United States)">Freedom of Information Act</a> revealing it had engaged in <a href="/wiki/Project_MKUltra" class="mw-redirect" title="Project MKUltra">mind-control experiments</a>.`],
  ["a commission ends a war: an organisation and a war (July 20)", /Israel–Syria Mixed Armistice Commission/,
    `<a href="/wiki/1949" title="1949">1949</a> &#8211; The <a href="/wiki/Israel%E2%80%93Syria_Mixed_Armistice_Commission" title="Israel–Syria Mixed Armistice Commission">Israel–Syria Mixed Armistice Commission</a> brokers the last of four ceasefire agreements to end the <a href="/wiki/1948_Arab%E2%80%93Israeli_War" title="1948 Arab–Israeli War">1948 Arab–Israeli War</a>.`],
];

/**
 * Lines where a person could argue with the answer. These are the rule's
 * answers as of September 11, 2026, recorded so that a change in the rule
 * shows up here rather than quietly in the database. A wrong answer in this
 * list is a known limit, not a pass.
 */
const ARGUABLE: Array<[string, string | null, string]> = [
  ["a republic proclaimed after a battle: the battle is the one event shaped link, and the republic is the polity", "Battle of Seival",
    `<a href="/wiki/1836" title="1836">1836</a> &#8211; The <a href="/wiki/Riograndense_Republic" title="Riograndense Republic">Riograndense Republic</a> is proclaimed by rebels after defeating <a href="/wiki/Empire_of_Brazil" title="Empire of Brazil">Empire of Brazil</a>'s troops in the <a href="/wiki/Battle_of_Seival" title="Battle of Seival">Battle of Seival</a>, during the <a href="/wiki/Ragamuffin_War" title="Ragamuffin War">Ragamuffin War</a>.`],
  ["a conductor named first, at a concert with no article of its own", "John Eliot Gardiner",
    `1968   &#8211; <a href="/wiki/John_Eliot_Gardiner" title="John Eliot Gardiner">John Eliot Gardiner</a> conducts Monteverdi's <i><a href="/wiki/Vespro_della_Beata_Vergine" title="Vespro della Beata Vergine">Vespro della Beata Vergine</a></i> with the <a href="/wiki/Monteverdi_Choir" title="Monteverdi Choir">Monteverdi Choir</a> at the <a href="/wiki/BBC_Proms" title="BBC Proms">Proms</a>.`],
  ["a people named as an adjective before a leader's name (September 4)", "Apache",
    `<a href="/wiki/1886" title="1886">1886</a> &#8211; <a href="/wiki/American_Indian_Wars" title="American Indian Wars">American Indian Wars</a>: After almost 30 years of fighting, <a href="/wiki/Apache" title="Apache">Apache</a> leader <a href="/wiki/Geronimo" title="Geronimo">Geronimo</a>, with his remaining warriors,  surrenders to General <a href="/wiki/Nelson_Miles" class="mw-redirect" title="Nelson Miles">Nelson Miles</a> in <a href="/wiki/Arizona" title="Arizona">Arizona</a>.`],
  ["the man who took a city, chosen over the congress he called there (September 4)", "Mustafa Kemal Atatürk",
    `<a href="/wiki/1919" title="1919">1919</a> &#8211; <a href="/wiki/Mustafa_Kemal_Atat%C3%BCrk" title="Mustafa Kemal Atatürk">Mustafa Kemal Atatürk</a>, who founded the Republic of <a href="/wiki/Turkey" title="Turkey">Turkey</a>, gathers a congress in <a href="/wiki/Sivas_Congress" title="Sivas Congress">Sivas</a> to make decisions as to the future of <a href="/wiki/Anatolia" title="Anatolia">Anatolia</a> and <a href="/wiki/Thrace" title="Thrace">Thrace</a>.`],
  ["a peace conference a year earlier, named as the reason (July 20)", "Paris Peace Conference, 1919",
    `<a href="/wiki/1920" title="1920">1920</a> &#8211; The Greek Army takes control of <a href="/wiki/Silivri" title="Silivri">Silivri</a> after <a href="/wiki/Greece" title="Greece">Greece</a> is awarded the city by the <a href="/wiki/Paris_Peace_Conference,_1919" class="mw-redirect" title="Paris Peace Conference, 1919">Paris Peace Conference</a>; by 1923 Greece effectively lost control to the Turks.`],
  ["a state that opens a road: a place, so nothing (July 20)", null,
    `1940   &#8211; <a href="/wiki/California" title="California">California</a> opens its first <a href="/wiki/Freeway" class="mw-redirect" title="Freeway">freeway</a>, the <a href="/wiki/Arroyo_Seco_Parkway" title="Arroyo Seco Parkway">Arroyo Seco Parkway</a>.`],
];

for (const [name, expected, html] of RIGHT) {
  test(`right: ${name}`, () => {
    const read = subjectOf(html);
    assert.equal(read.subject?.title, expected, read.reason);
  });
}

for (const [name, why, html] of REFUSED) {
  test(`refused: ${name}`, () => {
    const read = subjectOf(html);
    assert.equal(read.subject, null, `chose ${read.subject?.title ?? ""}: ${read.reason}`);
    assert.match(read.reason, why);
  });
}

for (const [name, expected, html] of ARGUABLE) {
  test(`arguable, recorded: ${name}`, () => {
    assert.equal(subjectOf(html).subject?.title ?? null, expected);
  });
}

test("at least twenty of each", () => {
  assert.ok(RIGHT.length >= 20, `${RIGHT.length} right`);
  assert.ok(REFUSED.length >= 20, `${REFUSED.length} refused`);
});

test("the line's own text is read, not its sub bullets", () => {
  const read = subjectOf(`<a href="/wiki/1980" title="1980">1980</a> &#8211; The <a href="/wiki/Gotthard_Road_Tunnel" title="Gotthard Road Tunnel">Gotthard Road Tunnel</a> opens in Switzerland.
<ul><li>A sub bullet about the <a href="/wiki/Battle_of_Somewhere" title="Battle of Somewhere">Battle of Somewhere</a>.</li></ul>`);
  assert.equal(read.subject?.title, "Gotthard Road Tunnel");
});

test("a redirect is marked so the importer resolves it before it is measured", () => {
  const read = subjectOf(`<a href="/wiki/1851" title="1851">1851</a> &#8211; <a href="/wiki/Christiana_Resistance" class="mw-redirect" title="Christiana Resistance">Christiana Resistance</a>: Escaped slaves led by <a href="/wiki/William_Parker_(abolitionist)" title="William Parker (abolitionist)">William Parker</a> fight off and kill a slave owner.`);
  assert.equal(read.subject?.title, "Christiana Resistance");
  assert.equal(read.subject?.redirect, true);
});

test("a war is never the subject when the line names anything else", () => {
  assert.equal(subjectOf(`<a href="/wiki/1967" title="1967">1967</a> &#8211; The <a href="/wiki/Six-Day_War" title="Six-Day War">Six-Day War</a> begins.`).subject?.title, "Six-Day War");
  assert.equal(subjectOf(`<a href="/wiki/1939" title="1939">1939</a> &#8211; <a href="/wiki/World_War_II" title="World War II">World War II</a>: <a href="/wiki/Germany" title="Germany">Germany</a> invades <a href="/wiki/Poland" title="Poland">Poland</a>.`).subject, null);
});

test("the general article on a kind of thing is never an occurrence of it", () => {
  // "Olympic Games" is linked from the Mark Spitz line on September 4; the
  // line is about Mark Spitz.
  const spitz = subjectOf(`<a href="/wiki/1972" title="1972">1972</a> &#8211; <a href="/wiki/Mark_Spitz" title="Mark Spitz">Mark Spitz</a> becomes the first competitor to win seven medals at a single <a href="/wiki/Olympic_Games" title="Olympic Games">Olympic Games</a>.`);
  assert.equal(spitz.subject?.title, "Mark Spitz");
  const quake = subjectOf(`<a href="/wiki/1500" title="1500">1500</a> &#8211; An <a href="/wiki/Earthquake" title="Earthquake">earthquake</a> is felt across the region.`);
  assert.equal(quake.subject, null, quake.reason);
});

test("the first sentence ends at a period before a capital, and not at an initial or an abbreviation", () => {
  assert.equal(firstSentence("Charles stops outside Smolensk. The army is defeated later."), "Charles stops outside Smolensk.");
  assert.equal(firstSentence("Franklin D. Roosevelt speaks. Then he leaves."), "Franklin D. Roosevelt speaks.");
  assert.equal(firstSentence("Troops reach Washington, D.C. The city burns."), "Troops reach Washington, D.C. The city burns.");
  assert.equal(firstSentence("St. Michael's Church falls. Nobody is hurt."), "St. Michael's Church falls.");
  assert.equal(firstSentence("The U.S. embassy is attacked, resulting in four deaths."), "The U.S. embassy is attacked, resulting in four deaths.");
});

test("the address is the article's own, in the shape the importer already writes", () => {
  assert.equal(subjectUrl("September 11 attacks"), "https://en.wikipedia.org/wiki/September_11_attacks");
  assert.equal(subjectUrl("1973 Chilean coup d'état"), "https://en.wikipedia.org/wiki/1973_Chilean_coup_d'%C3%A9tat");
});
