// Asks the editor to score the stories nobody has scored yet on the open
// dates. The editor is the rate-stories Edge Function; this is the quarter
// hour call from the tick, so a date's pool is scored within fifteen minutes
// of the seeder filing it. With nothing unscored it costs nothing.

import type { Db } from "./wall/db.js";

export async function run(db: Db, limit = 6): Promise<void> {
  const response = await fetch(`${db.url}/functions/v1/rate-stories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: db.key },
    body: JSON.stringify({ limit }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`rate-stories answered ${response.status}: ${text.slice(0, 200)}`);
  console.log(`stories editor: ${text.slice(0, 300)}`);
}
