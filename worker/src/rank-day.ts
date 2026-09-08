// What is this date remembered for? Run it and read the answer.
//
//   npm run rank:day -- 9 7
//   npm run rank:day -- 9 7 --all
//
// Free. It talks to Wikipedia and Wikidata and nothing else, no key, nothing
// metered, which puts it in the same category as the culture importer: run it
// as often as you like, and keep the courtesy pause, because both are somebody
// else's volunteer funded server.
//
// It writes nothing. This prints what the ranker would decide and why, so the
// ordering can be argued with before it reaches a page. The columns to store
// it in do not exist yet, on purpose: a ranking nobody has read is not one to
// bake into 366 pages.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadConfig, loadDotEnv } from "./config.js";
import { parseEvents } from "./events.js";
import { fetchPage } from "./wikipedia.js";
import { monthlyViewsForTitles } from "./pageviews.js";
import {
  allEventLinks, anniversaryArticles, anniversaryUrl, articlesByRow, fetchSitelinks,
  observanceMatch, observancesFrom, primaryArticle, rowKey, type Observance,
} from "./signals.js";
import { gravityOf, importanceOf, memorialCount, rememberedFor, shapeOf } from "./importance.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const PAUSE_MS = 1200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RankedRow {
  year: number;
  description: string;
  article: string | null;
  views: number;
  sitelinks: number;
  anniversary: boolean;
  observed: boolean;
  score: number;
  gravity: string;
}

export interface RankedDay {
  month: number;
  day: number;
  rows: RankedRow[];
  observances: Observance[];
  /** Observance and event pairs worth a curator's attention, best first. */
  proposals: Array<{ observance: string; year: number; description: string; match: number }>;
  shape: string;
  memorial: number;
  headline: string;
}

export async function rankDay(month: number, day: number): Promise<RankedDay | null> {
  const config = loadConfig({ needsWrite: false });
  const name = `${MONTHS[month - 1]} ${day}`;

  const page = await fetchPage(name, config.userAgent);
  if (page === null) return null;

  const { events } = parseEvents(page.html);
  const observances = observancesFrom(page.html);

  // Two passes over the same HTML, because picking the article needs to know
  // which link is the famous one and that is a question only Wikidata answers.
  // One batched query for every link on the date, then the picker, then views
  // for the handful of articles it settled on.
  const fame = await fetchSitelinks(allEventLinks(page.html), config.userAgent);
  const articles = articlesByRow(page.html, fame);

  // Wikipedia's own editors' pick for this date. A missing page is fine and
  // common on the less eventful dates, and costs the run one signal.
  const annPage = await fetchPage(
    anniversaryUrl(MONTHS[month - 1]!, day).replace("https://en.wikipedia.org/wiki/", ""),
    config.userAgent,
  );
  const anniversaries = annPage === null ? new Set<string>() : anniversaryArticles(annPage.html);

  const titles = [...new Set([...articles.values()])];
  const views = await monthlyViewsForTitles(titles, config.userAgent);

  // An observance is proposed, never applied. Tying "National Threatened
  // Species Day" to the thylacine dying cannot be done by string overlap, and
  // guessing it would be exactly the kind of confident wrong this site exists
  // to avoid. So nothing is marked observed by this script, and the pairs a
  // curator should look at are printed instead.
  const proposals: RankedDay["proposals"] = [];
  for (const obs of observances) {
    for (const event of events) {
      const m = observanceMatch(obs.text, event.description);
      if (m > 0) proposals.push({ observance: obs.text, year: event.year, description: event.description, match: m });
    }
  }
  proposals.sort((a, b) => b.match - a.match);

  const rows: RankedRow[] = events.map((event) => {
    const article = articles.get(rowKey(event.year, event.description)) ?? null;
    const signals = {
      views: article === null ? 0 : views.get(article) ?? 0,
      sitelinks: article === null ? 0 : fame.get(article) ?? 0,
      anniversary: article !== null && anniversaries.has(article),
      observed: false,
    };
    return {
      year: event.year,
      description: event.description,
      article,
      ...signals,
      score: importanceOf(signals),
      gravity: gravityOf(event.description),
    };
  });
  rows.sort((a, b) => b.score - a.score);

  const scores = rows.map((r) => r.score);
  const memorial = memorialCount(scores);
  const headline = rememberedFor(rows.slice(0, 3).map((r) => r.article ?? ""));

  return { month, day, rows, observances, proposals, shape: shapeOf(scores), memorial, headline };
}

function report(d: RankedDay): void {
  const name = `${MONTHS[d.month - 1]} ${d.day}`;
  console.log(`\n${"=".repeat(72)}\n${name}  ${d.shape}, ${d.memorial} in the memorial, ${d.rows.length} rows`);
  if (d.headline) console.log(`headline: ${d.headline}`);
  if (d.observances.length > 0) {
    console.log(`observed: ${d.observances.map((o) => o.text).join(" | ")}`);
  }
  console.log("");
  const shown = Math.max(d.memorial, 8);
  d.rows.slice(0, shown).forEach((r, i) => {
    const mark = i < d.memorial ? "*" : " ";
    const flags = [r.anniversary ? "anniv" : "", r.gravity === "grave" ? "GRAVE" : ""]
      .filter(Boolean).join(",");
    console.log(
      `${mark} ${r.score.toFixed(2).padStart(5)}  ${String(r.year).padStart(4)}  ` +
      `v${String(r.views).padStart(7)} s${String(r.sitelinks).padStart(3)} ${flags.padEnd(12)}` +
      `${(r.article ?? "(no article)").slice(0, 34).padEnd(35)}${r.description.slice(0, 60)}`,
    );
  });
  const noArticle = d.rows.filter((r) => r.article === null).length;
  if (noArticle > 0) console.log(`\n  ${noArticle} rows scored zero because no article could be picked from the line`);
  if (d.proposals.length > 0) {
    console.log("\n  observance links to confirm or reject:");
    for (const p of d.proposals.slice(0, 3)) {
      console.log(`    ${p.match.toFixed(2)}  "${p.observance}"  <-  ${p.year} ${p.description.slice(0, 54)}`);
    }
  }
}

async function main(): Promise<void> {
  await loadDotEnv();
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const nums = args.filter((a) => /^\d+$/.test(a)).map(Number);

  const dates: Array<{ month: number; day: number }> = [];
  if (all) {
    for (let m = 1; m <= 12; m++) {
      for (let dd = 1; dd <= (DAYS_IN_MONTH[m - 1] ?? 31); dd++) dates.push({ month: m, day: dd });
    }
  } else {
    const month = nums[0];
    const day = nums[1];
    if (month === undefined || day === undefined) {
      console.error("usage: npm run rank:day -- <month> <day>   or   npm run rank:day -- --all");
      process.exit(1);
    }
    dates.push({ month, day });
  }

  const started = Date.now();
  let failed = 0;
  for (const { month, day } of dates) {
    try {
      const ranked = await rankDay(month, day);
      if (ranked === null) {
        failed++;
        console.error(`  ${month}/${day}: no such date page`);
      } else {
        report(ranked);
      }
    } catch (error) {
      failed++;
      console.error(`  ${month}/${day} failed: ${String(error)}`);
    }
    if (dates.length > 1) await sleep(PAUSE_MS);
  }
  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\n${dates.length} dates, ${failed} failed, in ${minutes} minutes. Nothing written.`);
}

function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}

// primaryArticle is re-exported so the admin panel can show a curator what the
// ranker looked at without importing the whole signals module.
export { primaryArticle };
