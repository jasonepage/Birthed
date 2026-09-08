-- Ten answers a date, and why a limit makes the data better rather than worse.
--
-- A date page carries about a hundred and fifty rows and until now a reader
-- could answer every one of them in about ninety seconds. Two things follow
-- from that, and both are bad.
--
-- The data. Somebody who answers a hundred and fifty rows is not remembering,
-- they are clicking. The signal this whole thing exists to collect is which
-- things a person actually carries around, and an instrument that cannot tell
-- the difference between a memory and a scroll is measuring the scroll.
--
-- The feeling. r/place gave you one pixel every five minutes, and that
-- cooldown was not decoration around the canvas, it was the canvas: a wall
-- with unlimited pixels is a paint program. Scarcity is what made each mark a
-- decision, and a decision is the thing people come back for. Birthed has the
-- clock already, in the seal. It has never had the scarcity.
--
-- So ten. Enough to say the things you actually remember about a date, few
-- enough that the eleventh row makes you choose, and the choosing is the
-- point: which ten of these do I actually have a memory of.
--
-- This is not a score and it must never become one. Nobody is ranked by how
-- many they spend, spending all ten earns nothing, and spending none costs
-- nothing. It is a budget, and a budget is the opposite of a leaderboard: it
-- limits what one person can do rather than comparing them to anybody.
--
-- A column rather than a constant, like window_days and undo_seconds, because
-- the right number is unknown and finding it out must not need a deploy.
alter table remember_settings
  add column if not exists answers_per_date smallint not null default 10
    check (answers_per_date between 1 and 1000);

-- How many this token has left on this date, for the interface to show.
--
-- Says nothing about anybody else and nothing about what was answered. It is
-- the reader's own remaining count and it is the only number this feature
-- shows anybody before a date has sealed.
create or replace function public.answers_left(
  month_in smallint,
  day_in smallint,
  voter_token_in text
)
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  allowed smallint;
  spent integer;
  edition_id_found bigint;
begin
  select rs.answers_per_date into allowed from remember_settings rs where only_row;
  if allowed is null then
    return 0;
  end if;
  if length(coalesce(voter_token_in, '')) < 16 then
    return allowed;
  end if;

  -- Read rather than opened. Asking open_edition here would create an edition
  -- row for every date anybody merely looked at, and the only thing that may
  -- ever create one is somebody actually answering.
  select e.id into edition_id_found from day_editions e
   where e.event_month = month_in
     and e.event_day = day_in
     and e.edition_year = extract(year from now())::smallint;
  if edition_id_found is null then
    return allowed;
  end if;

  select count(*) into spent from remembrances r
   where r.edition_id = edition_id_found
     and r.voter_token = voter_token_in;

  return greatest(allowed - spent, 0);
end;
$function$;

-- The budget is checked where every other rule is checked, inside the one
-- guarded path, so no client has to be trusted to count and no client can be
-- out of step with the number in the settings row.
create or replace function public.remember_status(
  month_in smallint,
  day_in smallint,
  subject_kind_in text,
  subject_id_in text,
  voter_token_in text,
  depth_in text,
  birth_year_in smallint default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  -- Not named "found". plpgsql owns that one and the insert below sets it.
  edition day_editions;
  allowed smallint;
  spent integer;
begin
  if length(coalesce(voter_token_in, '')) < 16 then
    return 'bad_token';
  end if;

  edition := open_edition(month_in, day_in);
  if edition.id is null then
    return 'closed';
  end if;
  if edition.sealed_at is not null then
    return 'sealed';
  end if;

  -- Counted before the insert, and an answer already given on this row does
  -- not spend anything, because it lands as 'already' below rather than as a
  -- new row. So a reader who taps the same thing twice has not lost one.
  select rs.answers_per_date into allowed from remember_settings rs where only_row;
  select count(*) into spent from remembrances r
   where r.edition_id = edition.id
     and r.voter_token = voter_token_in;
  if allowed is not null and spent >= allowed
     and not exists (
       select 1 from remembrances r
        where r.edition_id = edition.id
          and r.subject_kind = subject_kind_in
          and r.subject_id = subject_id_in
          and r.voter_token = voter_token_in
     )
  then
    return 'spent';
  end if;

  insert into remembrances (edition_id, subject_kind, subject_id, voter_token, birth_year, depth)
  values (edition.id, subject_kind_in, subject_id_in, voter_token_in, birth_year_in, depth_in)
  on conflict (edition_id, subject_kind, subject_id, voter_token) do nothing;

  return case when found then 'kept' else 'already' end;
end;
$function$;

revoke all on function public.answers_left(smallint, smallint, text) from public;
grant execute on function public.answers_left(smallint, smallint, text) to anon, authenticated;
grant execute on function public.remember_status(smallint, smallint, text, text, text, text, smallint) to anon, authenticated;
