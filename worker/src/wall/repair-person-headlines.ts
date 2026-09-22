// One repair, run by hand, for person tiles that say the years twice.
//
//   node dist/src/wall/repair-person-headlines.js          # print what would change
//   node dist/src/wall/repair-person-headlines.js --write  # and write it
//
// **Why a script rather than the seeder.** The history seeder files a story
// once per date and inserts with the duplicate ignored, so a story already
// on a hive keeps the headline it was filed with forever. Fixing
// personHeadline fixes every date filed from now on and nothing that is
// already there. On September 21, 2026 that was 214 of 1,142 person stories,
// including the tiles on the live hive.
//
// **What it changes and what it does not.** Only wall_stories.headline, and
// only for rows whose subject is a person, and only where the headline this
// project would write today differs from the one stored. It never touches a
// boost, a rectangle, a support count, a source, a quotation or a check. The
// receipt still quotes the page word for word, because the quotation keeps
// the description exactly as Wikidata has it and is a separate column.
//
// A sealed hive's tiles are rewritten too, and that is deliberate: a person
// tile's headline is a sentence this project composes out of its own
// columns, not a quotation from anybody, so a doubled year in it is our
// typing and correcting it changes no claim the board ever made. Nothing
// about the board's shape or its buzzes moves.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadConfig, loadDotEnv } from "../config.js";
import { rows, update, type Db } from "./db.js";
import { personHeadline, type PersonRow } from "./history.js";

interface StoryRow {
  id: string;
  wall_date: string;
  subject_id: string | null;
  headline: string;
}

export interface Change {
  id: string;
  wallDate: string;
  was: string;
  now: string;
}

/**
 * The rows whose stored headline is not the one this project would write
 * today. Pure, so the whole decision is testable without a database.
 *
 * A story whose person is no longer in the table is left alone rather than
 * guessed at: the headline it has is the only record of who it was.
 */
export function changesFor(stories: StoryRow[], people: PersonRow[]): Change[] {
  const byQid = new Map(people.map((p) => [p.wikidata_qid, p]));
  const out: Change[] = [];
  for (const story of stories) {
    if (story.subject_id === null) continue;
    const person = byQid.get(story.subject_id);
    if (person === undefined) continue;
    const now = personHeadline(person);
    if (now !== "" && now !== story.headline) {
      out.push({ id: story.id, wallDate: story.wall_date, was: story.headline, now });
    }
  }
  return out;
}

export async function run(db: Db, options: { write?: boolean } = {}): Promise<{ looked: number; changed: number }> {
  const stories = await rows<StoryRow>(db, "wall_stories?select=id,wall_date,subject_id,headline&subject_kind=eq.person");
  const people = await rows<PersonRow>(db, "notable_people?select=wikidata_qid,name,birth_year,death_year,short_description");
  const changes = changesFor(stories, people);
  console.log(`person headlines: ${changes.length} of ${stories.length} would change`);
  for (const change of changes) {
    console.log(`  ${change.wallDate}`);
    console.log(`    was: ${change.was}`);
    console.log(`    now: ${change.now}`);
  }
  if (options.write !== true) {
    console.log("Nothing was written. Pass --write to write it.");
    return { looked: stories.length, changed: 0 };
  }
  // One row at a time. It is a few hundred rows run once by hand, and a
  // batch that half fails is harder to reason about than a loop that says
  // where it stopped.
  let changed = 0;
  for (const change of changes) {
    await update(db, "wall_stories", `id=eq.${change.id}`, { headline: change.now });
    changed += 1;
  }
  console.log(`person headlines: ${changed} written`);
  return { looked: stories.length, changed };
}

async function main(): Promise<void> {
  await loadDotEnv();
  const write = process.argv.includes("--write");
  const config = loadConfig({ needsWrite: write });
  await run({ url: config.supabaseUrl, key: config.serviceRoleKey }, { write });
}

function isEntryPoint(): boolean {
  const argv = process.argv[1];
  if (argv === undefined) return false;
  try {
    return realpathSync(argv) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
