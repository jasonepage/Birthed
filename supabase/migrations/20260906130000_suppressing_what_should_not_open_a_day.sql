-- Two things that must never be the first thing somebody reads on their
-- birthday, and the columns that keep them off the page.
--
-- Neither of these is fixed by deleting rows. Both tables are re-imported:
-- notable_people is rescored by the importer and historical_events is pruned
-- and rewritten by import-events on every run. A deleted row is back the next
-- time the worker runs. So the suppression is a column and a rule, not a
-- delete, and the rule lives in the importer as well so it survives the
-- rebuild.

-- 1. Adult performers at the top of a date page.
--
-- Found on September 6, where the page opened with a former pornographic film
-- actress, and then found to be 106 people across the table, almost all of
-- them ranked first on their own date. So roughly one date page in four opened
-- this way, not one.
--
-- The cause is in notabilityScore. She is described as an "internet
-- personality, podcaster and former pornographic film actress", which matches
-- creatorTerms twice, so the creator bonus that exists to surface Trisha
-- Paytas over a Bundesliga midfielder was multiplying her attention by 3.15.
-- The signal was doing its job. It had no idea what it was promoting.
alter table notable_people
  add column if not exists adult_content boolean not null default false;

comment on column notable_people.adult_content is
  'Their Wikidata description marks them as an adult performer. Forces notability_score to zero so they never open a date page. Set by the same rule in worker/src/notability.ts, so a re-import keeps it.';

create index if not exists notable_people_adult_content_idx
  on notable_people (adult_content) where adult_content;

-- 2. Battles, disasters and killings in the events feed.
--
-- historical_events is Wikipedia's date article imported wholesale, so
-- September 6 opens with an emperor being defeated and killed and a general
-- killing himself two days later. A rough keyword count says about 40 percent
-- of the 19,734 rows read that way.
--
-- suppressed rather than deleted, for the re-import reason above, and because
-- 40 percent of recorded history is a large thing to throw away on a filter
-- nobody has looked through yet. Flipping it back is one update.
alter table historical_events
  add column if not exists suppressed boolean not null default false,
  add column if not exists suppressed_reason text,
  add column if not exists suppressed_model text,
  add column if not exists suppressed_at timestamptz;

comment on column historical_events.suppressed is
  'Held back from readers by the content screen. The row is kept, not deleted, because import-events rewrites this table and a delete would not survive the next run.';

create index if not exists historical_events_visible_idx
  on historical_events (event_month, event_day, event_year) where not suppressed;

-- The filter goes in the read policy rather than in each reader.
--
-- There are two readers, web/src/timeline.ts and the iOS
-- SupabaseRestDayPageRepository, and a third will be written eventually. A
-- filter each one has to remember to apply is a filter one of them will
-- forget. Row level security applies to the anonymous key both of them use and
-- to nothing the service role does, so the importer, the prune and the screen
-- below all still see every row.
--
-- Nothing is suppressed when this migration runs, so applying it changes what
-- readers see by exactly nothing.
drop policy if exists read_historical_events on historical_events;

create policy read_historical_events on historical_events
  for select using (not suppressed);
