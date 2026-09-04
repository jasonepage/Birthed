-- Birthed slice 1: identity content for the day page.
-- Covers SRS FR-020 to FR-031, FR-130 to FR-132, NFR-042 and NFR-042a.
-- Design reference: SDS.md section 6.2.
--
-- House rules that show up in this file:
--   * A calendar date is two small integers. Never a date, never a timestamp.
--   * Day precision is structural, not a convention. See birth_precision.
--   * Row level security is enabled on every table in the public schema.

create table if not exists notable_people (
  id                bigserial primary key,
  wikidata_qid      text        not null unique,
  name              text        not null,
  birth_month       smallint    not null check (birth_month between 1 and 12),
  birth_day         smallint    not null check (birth_day between 1 and 31),
  birth_year        smallint,
  death_year        smallint,
  short_description text,

  -- FR-131 made structural. Wikidata time precision 11 is day, 9 is year only.
  -- A year-only record is stored by Wikidata as January 1 of that year, so
  -- without this constraint January 1 fills with people whose birth date
  -- nobody actually recorded.
  birth_precision   smallint    not null check (birth_precision >= 11),

  -- FR-130: the score is derived, and its inputs are stored so that the
  -- weights can be retuned without re-fetching anything from Wikidata.
  sitelink_count    integer     not null default 0 check (sitelink_count >= 0),
  is_living         boolean     not null default false,
  notability_score  integer     not null default 0,

  -- FR-132: every record carries where it came from and under what license.
  source_url        text        not null,
  content_license   text        not null,
  imported_at       timestamptz not null default now(),

  constraint death_year_not_before_birth_year check (
    death_year is null or birth_year is null or death_year >= birth_year
  )
);

comment on column notable_people.birth_precision is
  'Wikidata time precision. 11 is day precision, which FR-131 requires.';

create index if not exists notable_people_day_rank_idx
  on notable_people (birth_month, birth_day, notability_score desc);

create table if not exists historical_events (
  id              bigserial   primary key,
  event_month     smallint    not null check (event_month between 1 and 12),
  event_day       smallint    not null check (event_day between 1 and 31),
  event_year      smallint,
  description     text        not null,
  source_url      text        not null,
  content_license text        not null,
  imported_at     timestamptz not null default now()
);

create index if not exists historical_events_day_idx
  on historical_events (event_month, event_day);

-- NFR-042a. Row level security is enabled on every table in the public
-- schema, with no exceptions. A policy on a table that does not have it
-- enabled does nothing at all, and every public table is reachable with the
-- anonymous key that ships inside the application.
alter table notable_people    enable row level security;
alter table historical_events enable row level security;

-- NFR-042. Identity content is readable by any client, anonymous included,
-- and writable only by the service role, which bypasses row level security.
create policy read_notable_people on notable_people
  for select using (true);
create policy read_historical_events on historical_events
  for select using (true);
