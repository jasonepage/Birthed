-- Grounding is billed for every search query Google runs, not once per
-- request, and one fact run fires several of them. Storing the count with the
-- run is the only honest way to know what a date costs, so the number is
-- recorded rather than estimated.
alter table birth_fact_runs
  add column if not exists searches integer not null default 0;
