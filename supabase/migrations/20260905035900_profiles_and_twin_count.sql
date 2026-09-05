-- Birthed slice 2: the profile, and the twin count that reads it.
-- Covers SRS FR-001 to FR-014, FR-026, FR-120 to FR-122, NFR-033, NFR-041,
-- NFR-042a. Design reference: SDS.md sections 6.1 and 6.6.

create type profile_type as enum ('HUMAN', 'AGENT');
create type leap_observance as enum ('feb_28', 'mar_01');

create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  profile_type      profile_type not null default 'HUMAN',

  -- A calendar birthday is two small integers. Never a date, never a
  -- timestamp, never anything that has been through a time zone. NFR-001.
  birth_month       smallint check (birth_month between 1 and 12),
  birth_day         smallint check (birth_day between 1 and 31),
  birth_year        smallint check (birth_year is null or birth_year between 1900 and 2100),

  leap_observance   leap_observance not null default 'feb_28',
  region_code       text,
  first_plan_cycle  smallint,          -- FR-141b, the cycle whose plan was free
  created_at        timestamptz not null default now(),

  constraint birthday_is_whole check (
    (birth_month is null and birth_day is null)
    or (birth_month is not null and birth_day is not null)
  )
);

comment on column profiles.profile_type is
  'FR-120 to FR-122. The entire agent hedge. Every version 1.0 query filters to HUMAN.';

create index profiles_calendar_day_idx
  on profiles (birth_month, birth_day) where profile_type = 'HUMAN';

alter table profiles enable row level security;

create policy own_profile on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- FR-026 and NFR-033. Row level security correctly blocks a client from
-- selecting other people's rows, so the count comes back through a function
-- that returns nothing but an integer, with the privacy floor applied inside
-- it. Counts below 5 come back as -1, which the app renders as "fewer than 5",
-- so an exact number never leaves the database on a rare date.
create function twin_count(m integer, d integer)
returns integer
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case when count(*) < 5 then -1 else count(*)::int end
  from public.profiles
  where birth_month = m::smallint
    and birth_day = d::smallint
    and profile_type = 'HUMAN';
$$;

-- set search_path is mandatory on a security definer function. Without it the
-- function runs with the caller's search path while holding the definer's
-- privileges, which is the standard privilege escalation pattern.
revoke all on function twin_count(integer, integer) from public;
grant execute on function twin_count(integer, integer) to authenticated, anon;
