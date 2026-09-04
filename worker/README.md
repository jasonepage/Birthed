# Birthed pipeline worker

Slice 1 scope: import the notable people born on one calendar date from the
Wikidata query service into `notable_people`.

## Running it

There is no build step and nothing to install. Node 22 strips TypeScript types
when it loads a file.

```
cp .env.example .env       # then paste the service role key into it
node --experimental-strip-types src/import-day.ts 9 4 --dry-run --print
node --experimental-strip-types src/import-day.ts 9 4
```

`--dry-run` writes nothing. `--print` lists the top 15 for the date, which is
how you judge whether the notability ordering reads as interesting or as an
encyclopedia index. If it reads wrong, change the weights in
`src/notability.ts` and run it again. The score inputs are stored on every row,
so re-scoring never needs another trip to Wikidata.

The whole backfill, paced:

```
node --experimental-strip-types src/import-all.ts
```

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
