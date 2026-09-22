// Asks the editor to score the found facts nobody has scored yet.
//
// The editor itself is the rate-facts Edge Function, because it shares its
// scoring with find-facts, which scores its own run inline. This is the
// sweep: the backlog from before the editor existed, and any run whose inline
// scoring failed. Called from the quarter hour tick. With nothing unscored the
// function asks the model nothing.

import type { Db } from "./wall/db.js";

export async function run(db: Db, limit = 20): Promise<void> {
  const response = await fetch(`${db.url}/functions/v1/rate-facts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: db.key },
    body: JSON.stringify({ limit }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`rate-facts answered ${response.status}: ${text.slice(0, 200)}`);
  console.log(`facts editor: ${text.slice(0, 300)}`);
}
