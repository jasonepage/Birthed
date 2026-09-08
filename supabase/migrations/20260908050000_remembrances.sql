-- What a day is remembered for, decided by the people who were there.
--
-- Every ranking signal this project has measures documentation. Sitelinks
-- measure what crossed a language border. Pageviews measure what got looked up.
-- Wikipedia's anniversaries list measures what its editors chose. None of them
-- measure what got TRANSMITTED: the thing somebody brings up unprompted, the
-- thing everybody your age knows without having read it. That is a different
-- axis and no database holds it, because it has never been collected.
--
-- Wikipedia's weakness here is not that nobody works on date pages. It is that
-- the work is never synchronised. Fifty people edit September 7 across a
-- decade, alone, with no deadline. Consensus never forms because nobody is ever
-- in the room at the same time.
--
-- This site can do the opposite for free, because its audience synchronises
-- itself: the person who cares most about September 7 is somebody born on
-- September 7, and they arrive on September 7. So each date opens for a window
-- around itself, takes what people remember, and then seals into an edition.
--
-- Sealing rather than locking, deliberately. A page finalised forever gets one
-- thin day and stays wrong for a year. An edition per year means the page can
-- be re-opened next year on top of the last one, and that produces the thing
-- worth owning: how a date's memory CHANGES. What people remembered in 2026
-- against what they remember in 2031. That cannot be scraped from anywhere,
-- because it does not exist anywhere.

create table if not exists remember_settings (
  only_row boolean primary key default true check (only_row),
  -- Days either side of the date that accept an answer. Three is the target.
  -- It starts wider because scarcity with nobody in the room is just an empty
  -- room, and it lives in a column rather than in code for the same reason the
  -- daily fact ceiling does: it was needed once without a redeploy.
  window_days smallint not null default 7 check (window_days between 0 and 182)
);

insert into remember_settings (only_row) values (true) on conflict do nothing;

-- One row per date per year. A date has as many editions as years it has run.
create table if not exists day_editions (
  id bigint generated always as identity primary key,
  event_month smallint not null check (event_month between 1 and 12),
  event_day smallint not null check (event_day between 1 and 31),
  edition_year smallint not null,
  opened_at timestamptz not null default now(),
  closes_at timestamptz not null,
  sealed_at timestamptz,
  unique (event_month, event_day, edition_year)
);

-- One tap. Deliberately not a vote, because a vote has two directions and a
-- direction is a weapon. There is no way to say a thing did not matter, only
-- how close to you it was. An up and down score on January 6 or October 7 is a
-- brigading target inside a week, and a site claiming to be a sourced record
-- cannot host a faction fight.
create table if not exists remembrances (
  id bigint generated always as identity primary key,
  edition_id bigint not null references day_editions (id) on delete cascade,
  -- Which table the row came from. Text rather than a foreign key because the
  -- page ranks rows out of four different tables and a union of four keys is a
  -- worse thing to maintain than a label somebody can read.
  subject_kind text not null check (subject_kind in ('moment', 'cultural_event', 'historical_event', 'person')),
  subject_id text not null,
  -- A random opaque value the browser is given the first time somebody answers.
  -- Not an account, not an address, not a fingerprint. It exists so one person
  -- cannot answer the same row twice, and it says nothing about who they are.
  voter_token text not null,
  -- Optional, and only what they already told the page's year picker. It is the
  -- whole point of the exercise: crossed with the answer below it produces a
  -- map of what each generation remembers, which is the one dataset here that
  -- cannot be scraped from anybody.
  birth_year smallint check (birth_year between 1900 and 2100),
  -- 'never' is kept and counted rather than thrown away. A row that is
  -- thoroughly documented and that nobody has heard of is the most interesting
  -- result this table can produce, and it is invisible if you only record the
  -- people who remember.
  depth text not null check (depth in ('there', 'remember', 'heard', 'never')),
  created_at timestamptz not null default now(),
  unique (edition_id, subject_kind, subject_id, voter_token)
);

create index if not exists remembrances_edition on remembrances (edition_id);
create index if not exists remembrances_subject on remembrances (subject_kind, subject_id);

alter table remember_settings enable row level security;
alter table day_editions enable row level security;
alter table remembrances enable row level security;

-- Anybody may read the editions, so a page can say whether it is open and when
-- it seals.
create policy "anyone reads editions" on day_editions for select to anon, authenticated using (true);

-- Nobody writes remembrances directly, not even signed in. Every insert goes
-- through the function below, which checks the window and cannot be argued
-- with from a client. This is the same shape every other write on this project
-- has: the table is closed and one guarded path opens it.
create policy "admins read remembrances" on remembrances for select to authenticated using (is_admin());
create policy "anyone reads settings" on remember_settings for select to anon, authenticated using (true);

-- The edition covering a date right now, created on first use.
create or replace function public.open_edition(month_in smallint, day_in smallint)
returns day_editions
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  -- Neither of these may be called "found". plpgsql has a special boolean of
  -- that name set by every statement, and declaring over it silently shadows
  -- something the next person to edit this will expect to work.
  days smallint;
  this_year smallint := extract(year from now())::smallint;
  the_date date;
  edition day_editions;
begin
  select rs.window_days into days from remember_settings rs where only_row;

  -- 29 February in a year that does not have one has no edition, and that is
  -- correct rather than a bug to work around.
  begin
    the_date := make_date(this_year, month_in, day_in);
  exception when others then
    return null;
  end;

  if now() < (the_date - days)::timestamptz
     or now() > (the_date + days + 1)::timestamptz then
    return null;
  end if;

  select * into edition from day_editions
   where event_month = month_in and event_day = day_in and edition_year = this_year;
  if edition.id is not null then
    return edition;
  end if;

  insert into day_editions (event_month, event_day, edition_year, closes_at)
  values (month_in, day_in, this_year, (the_date + days + 1)::timestamptz)
  on conflict (event_month, event_day, edition_year) do nothing;

  select * into edition from day_editions
   where event_month = month_in and event_day = day_in and edition_year = this_year;
  return edition;
end;
$function$;

-- One answer. Returns true when it was recorded, false when the date is not
-- open or the same token has already answered that row.
create or replace function public.remember(
  month_in smallint,
  day_in smallint,
  subject_kind_in text,
  subject_id_in text,
  voter_token_in text,
  depth_in text,
  birth_year_in smallint default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  edition day_editions;
begin
  -- "found" below is plpgsql's own, set by the insert. Nothing here shadows it.
  if length(coalesce(voter_token_in, '')) < 16 then
    return false;
  end if;

  edition := open_edition(month_in, day_in);
  if edition.id is null or edition.sealed_at is not null then
    return false;
  end if;

  insert into remembrances (edition_id, subject_kind, subject_id, voter_token, birth_year, depth)
  values (edition.id, subject_kind_in, subject_id_in, voter_token_in, birth_year_in, depth_in)
  on conflict (edition_id, subject_kind, subject_id, voter_token) do nothing;

  return found;
end;
$function$;

revoke all on function public.remember(smallint, smallint, text, text, text, text, smallint) from public;
grant execute on function public.remember(smallint, smallint, text, text, text, text, smallint) to anon, authenticated;
grant execute on function public.open_edition(smallint, smallint) to anon, authenticated;

-- What a date's rows scored, for the build and for the page.
--
-- Counted apart rather than summed into one number, because the four answers
-- are not points on one scale. "I was there" and "I have never heard of it" are
-- both information, and a single average would hide the second one, which is
-- the more interesting of the two.
create or replace function public.remembrance_tally(month_in smallint, day_in smallint)
returns table (
  subject_kind text,
  subject_id text,
  edition_year smallint,
  there integer,
  remembers integer,
  heard integer,
  never integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.subject_kind,
         r.subject_id,
         e.edition_year,
         count(*) filter (where r.depth = 'there')::integer,
         count(*) filter (where r.depth = 'remember')::integer,
         count(*) filter (where r.depth = 'heard')::integer,
         count(*) filter (where r.depth = 'never')::integer
    from remembrances r
    join day_editions e on e.id = r.edition_id
   where e.event_month = month_in and e.event_day = day_in
   group by r.subject_kind, r.subject_id, e.edition_year;
$function$;

grant execute on function public.remembrance_tally(smallint, smallint) to anon, authenticated;
