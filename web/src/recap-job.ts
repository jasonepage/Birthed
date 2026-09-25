// Renders the picture of every recently sealed hive and stores it once.
//
//   npm run recap                 every date that sealed in the last three days
//   npm run recap -- 2026-09-23   one date
//   npm run recap -- --dry        write to out/recap/ and upload nothing
//
// Run on a schedule by .github/workflows/sealed-recap.yml shortly after
// midnight Eastern, and safe to run again: a date whose picture is already
// stored is skipped, never replaced, because the day it shows can never
// change and neither should its picture. A date that has not sealed is
// refused by sealedRecap, not by the schedule, so running this early does
// nothing rather than something wrong.
//
// Reads the wall tables with the publishable key, the same reads the site
// makes. Writes to one place, the public "sealed" storage bucket, with the
// service role key, and nothing else. It posts nothing anywhere.
//
// The stored address is the date and nothing else:
//   <SUPABASE_URL>/storage/v1/object/public/sealed/2026-09-23.png

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { recapPath, renderRecap, RECAP_SIDE, sealedRecap } from "./recap.js";
import { fetchWallDay } from "./wall.js";

const BUCKET = "sealed";
/** How far back the default run looks, so a missed night is caught up by the next one. */
const LOOKBACK_DAYS = 3;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}

export function publicUrl(base: string, wallDate: string): string {
  return `${base}/storage/v1/object/public/${BUCKET}/${recapPath(wallDate)}`;
}

async function fontFaces(): Promise<string> {
  const face = async (file: string, style: string): Promise<string> => {
    const bytes = await readFile(join("static", "fonts", file));
    return `@font-face { font-family: "Fraunces"; font-style: ${style}; font-weight: 100 900; src: url(data:font/woff2;base64,${bytes.toString("base64")}) format("woff2-variations"); }`;
  };
  return [await face("fraunces-latin-wght-normal.woff2", "normal"), await face("fraunces-latin-wght-italic.woff2", "italic")].join("\n");
}

async function recentlySealed(base: string, key: string, now: number): Promise<string[]> {
  const since = new Date(now - LOOKBACK_DAYS * 86_400_000).toISOString();
  const at = new Date(now).toISOString();
  const response = await fetch(
    `${base}/rest/v1/wall_days?select=wall_date&closes_at=gte.${since}&closes_at=lte.${at}&order=wall_date.asc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!response.ok) throw new Error(`wall_days answered ${response.status}`);
  return ((await response.json()) as Array<{ wall_date: string }>).map((row) => row.wall_date);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const named = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const base = (process.env.SUPABASE_URL ?? "https://lunqqhjwqrpbujwxwdzk.supabase.co").replace(/\/+$/, "");
  const key = env("SUPABASE_ANON_KEY");
  const serviceKey = dry ? "" : env("SUPABASE_SERVICE_ROLE_KEY");
  const now = Date.now();
  const dates = named.length > 0 ? named : await recentlySealed(base, key, now);
  console.log(`${dates.length} date${dates.length === 1 ? "" : "s"} to look at${dry ? ", dry run" : ""}.`);

  const faces = await fontFaces();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: RECAP_SIDE, height: RECAP_SIDE } });
  try {
    for (const wallDate of dates) {
      if (!dry) {
        const head = await fetch(publicUrl(base, wallDate), { method: "HEAD" });
        if (head.ok) { console.log(`  ${wallDate}: already stored, left alone`); continue; }
      }
      const day = await fetchWallDay(base, key, wallDate, 20_000);
      if (day === null) { console.log(`  ${wallDate}: no hive`); continue; }
      const recap = sealedRecap(day, now);
      if (recap === null) { console.log(`  ${wallDate}: not sealed yet, refused`); continue; }
      await page.setContent(renderRecap(recap, faces), { waitUntil: "load" });
      // Wait for the inlined font, so the picture is never taken in Georgia.
      await page.evaluate("document.fonts.ready");
      const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: RECAP_SIDE, height: RECAP_SIDE } });
      if (dry) {
        await mkdir(join("out", "recap"), { recursive: true });
        await writeFile(join("out", "recap", recapPath(wallDate)), png);
        console.log(`  ${wallDate}: written to out/recap/${recapPath(wallDate)} (${recap.totalBuzzes} buzzes)`);
        continue;
      }
      const upload = await fetch(`${base}/storage/v1/object/${BUCKET}/${recapPath(wallDate)}`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
          // Never replace. A second run on a stored date is refused here as
          // well as skipped above, in case two runs race.
          "x-upsert": "false",
        },
        body: png,
      });
      if (!upload.ok) throw new Error(`${wallDate}: upload answered ${upload.status}: ${(await upload.text()).slice(0, 200)}`);
      console.log(`  ${wallDate}: stored at ${publicUrl(base, wallDate)} (${recap.totalBuzzes} buzzes)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
