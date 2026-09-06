# Cultural event ingestion

Reads structured cultural milestone events, puts every one past a content
check run by a Claude model, and writes only the ones that pass into the
Supabase table `cultural_events`.

## Files

| File | What it is |
|---|---|
| `ingestion_agent.py` | The pipeline. Three stages: read, check, write. |
| `seed_events.json` | Ten technology and gaming launches, the proving data. |
| `requirements.txt` | Two direct dependencies. |
| `.env.example` | The environment variables. Copy to `.env`, which is gitignored. |
| `../supabase/migrations/20260906120000_cultural_events.sql` | The table. |

## Running it

```
cd ingestion
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then fill in the two keys

python3 ingestion_agent.py --dry-run    # reads and validates, calls nothing
python3 ingestion_agent.py --limit 3    # three events, live
python3 ingestion_agent.py              # the whole file, live
```

Apply the migration first, through the Supabase command line interface, and
never by editing the database by hand.

## Two things to know before you trust this data

**The ten dates in `seed_events.json` were written from memory.** Every row
carries a `source_url` pointing at the page it came from. Check the dates
against those pages before any of this reaches a reader. This is the same rule
`CLAUDE.md` applies to `WorldThen`, and for the same reason: absent beats
wrong, and a wrong launch date is the kind of wrong this audience notices
first.

**The content check fails closed.** The only answer that lets a row through is
the single word `ACCEPT`. A refusal, an explanation, an empty answer, or a
model that is unreachable all count as a rejection. Dropping a cheerful event
costs a missing row. Passing a grim one costs somebody reading about a
disaster on their birthday morning.

## Why this table is not `historical_events`

`historical_events` holds Wikipedia's own date article lines. They are keyed to
a month and a day, imported wholesale, and pruned by the run that reads them.
A cultural event is keyed to one exact date including the year, it is curated
rather than imported, and every row has passed a check before it lands. Putting
the two in one table would mean a checked row and an unchecked row sitting side
by side with nothing to tell them apart.
