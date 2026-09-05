# Birthed pipeline worker

Slice 1 scope: import the notable people born on one calendar date from the
Wikidata query service into `notable_people`.

## Setup, once

```
cd worker
npm install
cp .env.example .env      # then paste the service role key into it
```

Node 18.18 or newer. There is no framework and no runtime dependency: the only
package installed is TypeScript itself, for the build.

## Running it

```
npm test                                          # 13 tests, no network needed
npm run build
node dist/src/import-day.js 9 4 --dry-run --print  # September 4, writes nothing
node dist/src/import-day.js 9 4                    # same, and upserts
```

`--dry-run` writes nothing. `--print` lists the top 15 for the date, which is
how you judge whether the notability ordering reads as interesting or as an
encyclopedia index. If it reads wrong, change the weights in
`src/notability.ts` and run it again. The score inputs are stored on every row,
so re-scoring never needs another trip to Wikidata.

With no arguments it imports today.

The whole backfill, paced:

```
node dist/src/import-all.js
```

## The number ones

Three charts, one table, one reader. Each is backfilled from Wikipedia's
per-year lists and written to `chart_weeks` under its own `chart_name`.

```
npm run import:songs                              # Billboard Hot 100, 1959 on
npm run import:albums                             # Billboard 200, 1964 on
npm run import:films                              # US box office weekends, 1940s on
node dist/src/import-charts.js --chart films --from 1990 --to 1999 --dry
```

`--dry` parses and prints the report but writes nothing. Read the report,
not the progress: a year that comes out with nine weeks in it is the failure
that matters. Albums start at 1964 because the 1959 to 1963 pages carry
separate mono and stereo charts side by side, and reading one of them as
"the" number one would be a guess. Film pages change their date header
between decades ("Week ending", "Weekend end date") and the reader accepts
both. Reruns overwrite rather than duplicate.

## The service role key

`SUPABASE_SERVICE_ROLE_KEY` is in the Supabase dashboard under Project
Settings, API Keys, `service_role`. It bypasses row level security, which is
the whole reason the worker can write to a table the app can only read. It
belongs in `worker/.env`, which is gitignored, and nowhere else. If it ever
appears in the iOS target that is a security incident, not a bug.

## Why the query looks the way it does

Two traps, both written up in `CLAUDE.md` section 6.

The query binds exact birth dates with `VALUES`, one literal per year in the
configured range, instead of filtering with `MONTH()` and `DAY()`. Those
functions are computed over every entity in Wikidata carrying a birth date,
cannot use an index, and run against a 60 second timeout.

The query reads time precision from the full statement, `p:P569/psv:P569`,
rather than from the truthy `wdt:P569`. Wikidata stores a birth date known only
to the year as January 1 of that year, and the truthy property returns that
value with no precision attached. Without the precision filter, January 1
fills with people whose birth date nobody ever recorded. That is FR-131, and
the database enforces it a second time with a check constraint on
`birth_precision`.
