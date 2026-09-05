-- The people whose birthdays you keep forgetting.
--
-- This is the only mechanic in the product that gives somebody a reason to
-- open the app in a month that is not their own. Someone you know has a
-- birthday most weeks; your own comes round once.
--
-- It runs on the date engine that already exists, so there is nothing new here
-- except the rows. Deliberately the smallest shape that works: a name, a
-- calendar date, an optional year, an optional note. No contacts import, no
-- relationships, no photographs, nothing that turns somebody else's data into
-- a profile. NFR-031 stays intact.

create table people (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id) on delete cascade,

  name            text not null check (length(trim(name)) > 0),

  -- Two small integers, the same as everywhere else. NFR-001.
  birth_month     smallint not null check (birth_month between 1 and 12),
  birth_day       smallint not null check (birth_day between 1 and 31),
  birth_year      smallint check (birth_year is null or birth_year between 1900 and 2100),
  leap_observance leap_observance not null default 'feb_28',

  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table people is
  'Other people''s birthdays, as entered by the account holder. Never imported
   from contacts, and readable only by the account that wrote them.';

create index people_profile_idx on people (profile_id);
create index people_calendar_day_idx on people (profile_id, birth_month, birth_day);

alter table people enable row level security;

-- Somebody else's birthday is more sensitive than your own, because they did
-- not choose to give it to us. Nobody but the account that wrote the row can
-- read it, and there is no aggregate function over this table the way there is
-- over profiles.
create policy own_people on people
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
