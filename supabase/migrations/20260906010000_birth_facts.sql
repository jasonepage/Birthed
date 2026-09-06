-- Facts found about one birth date, by a model that searches, and kept only
-- when the page it cites really says so.
--
-- Decided September 6, 2026. A hand curated list of fact types caps out at
-- whatever the curator thought of. Instead a model with web search is asked
-- what was true on and around a specific day in a specific year, and in a
-- specific region when one is known. Every answer arrives with the page it
-- drew on and a short quotation, both stored, so a wrong fact can be traced
-- and pulled. The grounding is trusted as it stands; `verified` is the switch
-- that decides what the interface can read, and the read policy enforces it
-- rather than trusting the client to filter, so a stricter check can be
-- added later without touching the app.
--
-- Keyed by month, day and year, plus a normalised region that is the empty
-- string when nobody typed one. The region is in the key because the weather
-- and the local news are different in Salem and in Salem, Massachusetts.

create table if not exists birth_facts (
  id              bigserial   primary key,
  birth_month     smallint    not null check (birth_month between 1 and 12),
  birth_day       smallint    not null check (birth_day between 1 and 31),
  birth_year      smallint    not null check (birth_year between 1880 and 2100),
  region_key      text        not null default '',
  fact            text        not null check (length(fact) between 10 and 400),
  category        text        not null,
  source_url      text        not null,
  source_quote    text        not null default '',
  verified        boolean     not null default false,
  model           text        not null,
  generated_at    timestamptz not null default now(),
  unique (birth_month, birth_day, birth_year, region_key, fact)
);

create index if not exists birth_facts_date_idx
  on birth_facts (birth_month, birth_day, birth_year, region_key) where verified;

-- One row per search, so the app can tell "still looking" from "looked and
-- found nothing" from "never asked", and so two phones asking for the same
-- date in the same minute do not both pay for a search.
create table if not exists birth_fact_runs (
  birth_month     smallint    not null,
  birth_day       smallint    not null,
  birth_year      smallint    not null,
  region_key      text        not null default '',
  status          text        not null check (status in ('running', 'done', 'failed')),
  found           integer     not null default 0,
  error           text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  primary key (birth_month, birth_day, birth_year, region_key)
);

-- NFR-042a. Row level security on every public table, no exceptions.
alter table birth_facts     enable row level security;
alter table birth_fact_runs enable row level security;

-- Only verified facts are readable at all. Unverified rows exist for audit
-- and are reachable only with the service role.
create policy read_verified_birth_facts on birth_facts
  for select using (verified);

create policy read_birth_fact_runs on birth_fact_runs
  for select using (true);
