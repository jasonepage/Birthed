-- Cultural milestone events: the pop culture moments a reader is compared
-- against. "You were 7 when Fortnite Battle Royale came out."
--
-- This table is separate from historical_events on purpose. historical_events
-- holds Wikipedia's own date article lines, which are keyed to a month and a
-- day and are imported wholesale. A cultural event is keyed to one exact
-- calendar date including the year, it is curated rather than imported, and
-- every row has passed a content check before it lands. Mixing the two would
-- put an unchecked row and a checked row in the same table with no way to
-- tell them apart.
--
-- A note on the date column. CLAUDE.md section 6 says a calendar birthday is
-- two integers and never a date, because a birthday recurs. A cultural event
-- is the other shape: it happened once, in one year, and never again, which is
-- the same exception chart_weeks makes for a chart week. So event_date is a
-- real date, and like a chart date it is a plain calendar date with no time
-- and no time zone attached to it.

-- The five categories the app knows how to present. A category the interface
-- has no treatment for is worse than no row, so this is an enumerated type
-- rather than free text. Adding a sixth later is one line of alter type in a
-- new migration.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'cultural_event_category') then
    create type cultural_event_category as enum ('tech', 'gaming', 'meme', 'music', 'cinema');
  end if;
end
$$;

create table if not exists cultural_events (
  id             uuid                     primary key default gen_random_uuid(),

  -- The absolute chronological anchor. One exact day, including the year.
  event_date     date                     not null,

  category       cultural_event_category  not null,

  -- The short label. "Fortnite Battle Royale is released".
  event_title    varchar(200)             not null,

  -- The sentence the app shows underneath the title.
  context_string text                     not null,

  -- Provenance, for the same reason every other table in this project carries
  -- it: a row that cannot be checked cannot be corrected. The page this event
  -- was taken from, so a wrong date is a link away from being fixed.
  source_url     text,

  -- Which model passed this row and when. If the content check is ever
  -- tightened, this is how you find the rows that were passed by the old one
  -- and need looking at again.
  vibe_model     text,
  vibe_passed_at timestamptz,

  created_at     timestamptz              not null default now(),

  -- Idempotency. The pipeline can be run again without doubling every row:
  -- the same event on the same day is the same row and is updated in place.
  unique (event_date, event_title)
);

-- The lookup the app actually makes: everything on one calendar day, across
-- every year of the reader's life.
create index if not exists cultural_events_month_day_idx
  on cultural_events (extract(month from event_date), extract(day from event_date));

create index if not exists cultural_events_date_idx
  on cultural_events (event_date);

-- NFR-042a. Row level security on every table in the public schema, no
-- exceptions. A policy written against a table that does not have this
-- enabled does nothing at all, and Supabase publishes every public table
-- through its automatic interface to the anonymous key that ships in the app.
alter table cultural_events enable row level security;

-- NFR-042. Cultural facts are readable by any client, the anonymous role
-- included, and writable only by the service role, which bypasses row level
-- security. The ingestion pipeline holds the service role key. The app never
-- does.
create policy read_cultural_events on cultural_events
  for select using (true);

comment on table cultural_events is
  'Curated pop culture milestones, one exact date each. Every row has passed the ingestion content check. Written only by the service role.';
