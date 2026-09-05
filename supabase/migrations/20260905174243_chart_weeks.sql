-- The number one record for one chart week. Written out from the live
-- database on September 5, 2026: this migration was applied to the project
-- as "chart_weeks" at this version but the file never made it into the
-- repository, and a migration that exists only in the database is the exact
-- thing the "migrations only" rule is there to prevent. The definition below
-- matches the live table column for column.
--
-- One row per chart per issue date. The chart name is part of the key so
-- that a second chart, the Billboard 200 or the box office, lives in the
-- same table with no schema change: a number one is a name, a date, a title
-- and a credit whatever it is number one at. The film chart has no credit
-- and stores an empty string.
--
-- The compiled list is Wikipedia's, under Creative Commons Attribution
-- ShareAlike, and every row carries the page it came from.
create table if not exists chart_weeks (
  chart_date      date        not null,
  chart_name      text        not null default 'Billboard Hot 100',
  song            text        not null,
  artist          text        not null,
  source_url      text        not null,
  content_license text        not null,
  imported_at     timestamptz not null default now(),
  primary key (chart_name, chart_date)
);

-- NFR-042a. Row level security on every public table, no exceptions.
alter table chart_weeks enable row level security;

-- NFR-042. Chart facts are readable by any client, anonymous included, and
-- writable only by the service role, which bypasses row level security.
create policy read_chart_weeks on chart_weeks
  for select using (true);
