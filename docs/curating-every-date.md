# Curating every date, cheaply

Written September 22, 2026. A plan, not a decision. Nothing here has run and
nothing here has spent money.

## The goal

Every date, 1920 to 2026, carries the best few things that happened on it
across internet culture, sports, music, film, art and news: Harambe on May 28,
2016, not the seventh best thing on the day. The hive and the Mine likes then
decide what rises.

## The rule that sets the cost

**Search only where the free sources are thin.** Searching every date in every
year is 366 times 107 date-years, about 255,000 grounded searches, about
$4,200 a pass at September 2026 prices, and about 435 hours of review. That
is the version not to build.

Prices, from https://ai.google.dev/gemini-api/docs/pricing on September 22,
2026: Gemini 3.7 Flash is $0.75 per million tokens in and $3.75 out through
December 31, 2026, doubling on January 1, 2027. Batch is half. Grounded search
is 5,000 free a month across Gemini 3 models, then $14 per 1,000. The project's
own ledger measured about 1.3 cents a search, which agrees.

## The four steps

1. **Harvest, free.** Wikipedia date pages (already imported into
   `historical_events`), Wikidata items with an exact point in time, and
   Wikipedia pageviews on each anniversary for reach (already measured, see
   the ranking entry in `CLAUDE.md`). No model.
2. **Rank, no search.** One batch call a date: the candidates in, the best few
   per topic out, each with a short headline that only shortens, never adds
   (the editorial pass rule). About 1.2 cents a date at standard prices, about
   $2 for the year in batch.
3. **Fill the gaps, searched.** Only topics the harvest left thin, mostly
   internet culture. Five topics a date is about 12,000 searches, about $125
   after the free allowance. Same two call shape as the fact finder: research
   with search on, then reshape with search off, and a run with no searches is
   discarded.
4. **People finish it.** Buzzes on the hive and likes on Mine. Nothing an
   algorithm picks outranks one buzz.

## Rules carried over, not new

- Every row carries its source, and a source page has to answer before its row
  is shown.
- Deaths and violence follow `docs/researching-a-date.md` section 4, and the
  violent notoriety screen still applies. A model does not make that call.
- Estimate in dollars before anything runs, then run one week and measure the
  real spend and the real keep rate before the year.

## First step, when this is picked up

Run steps 1 and 2 on one month, 31 dates, with no search at all. Cost: well
under a dollar. Count how many rows survive review. That number decides whether
step 3 is needed at all.

## Unknown

- How many harvested rows are worth keeping. Nobody has measured it.
- Whether Wikidata's dated items cover internet culture well enough, or step 3
  carries most of that topic.
- Token counts per call are estimates (about 8,000 in and 1,500 out for a
  ranking call) and could be off by two or three times.
