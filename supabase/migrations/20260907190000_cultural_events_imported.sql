-- Imported cultural rows, alongside the hand written ones.
--
-- Two changes, both because a row that came out of Wikidata is a different
-- kind of thing from a row somebody sat down and wrote.
--
-- 1. context_string stops being required.
--
-- A curated row has a sentence a person wrote on purpose. An imported one has
-- a title and a date and nothing else, and the honest thing to store is
-- nothing rather than a sentence generated to fill the column. Filling it
-- would produce exactly the encyclopedia voice this table exists to get away
-- from, on every imported row, at scale. The renderer already falls back to
-- the title when there is no context.
--
-- 2. origin says which kind a row is.
--
-- The credit at the foot of the date page names who found what. Ten hand
-- checked rows and six thousand imported ones cannot share one sentence
-- saying they were written and checked by hand, because that sentence would
-- be false six thousand times. Defaulted to 'curated' so the ten rows already
-- in the table, which were written by hand, come out right without an update.

alter table cultural_events
  alter column context_string drop not null;

alter table cultural_events
  add column if not exists origin text not null default 'curated'
    check (origin in ('curated', 'imported'));

comment on column cultural_events.context_string is
  'The sentence a person wrote. Null on imported rows, where the title is the whole of it.';

comment on column cultural_events.origin is
  'curated: written and checked by a person. imported: taken from a structured source.';

-- The importer writes one row per work per date and needs to find its own
-- rows again to update them without touching the hand written ones.
create index if not exists cultural_events_origin_idx
  on cultural_events (origin);
