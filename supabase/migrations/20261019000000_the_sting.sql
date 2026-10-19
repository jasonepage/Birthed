-- The sting, October 19, 2026.
--
-- The hive's other verb: "this does not matter". One sting a day per browser
-- (or per app install), across every open hive, never on a story the same
-- caller buzzed, and never a buzz on a story the same caller stung: pick a
-- side. Taken back inside the same thirty seconds a buzz can be, with the
-- sting refunded by the row being gone. Nothing moves after the seal.
--
-- What this migration does not do is decide trials. Three stings put a story
-- on trial until the next hourly redraw, and the verdict, the burial and the
-- six hours of immunity are a replay of these rows and the buzz rows, in
-- web/src/trial.ts and its copy worker/src/wall/trial.ts. The rows never
-- change, so the replay gives the same answer forever, which is what lets a
-- sealed hive's graveyard be part of its record without a column for it.
-- The replay ignores a sting cast during immunity and anything cast at a
-- buried story, so a caller who reaches these functions directly cannot use
-- the gap: the site refuses those in words before it gets here.
--
-- Apply after 20261005000000_suggestions_on_the_page.sql. It touches none of
-- the functions the unapplied anniversary and refill migrations redefine, so
-- it can go before or after them.

create table if not exists public.wall_stings (
  id               bigint generated always as identity primary key,
  story_id         uuid not null references public.wall_stories(id),
  wall_date        date not null,
  booster_id       uuid not null,
  cast_at          timestamptz not null default now(),
  authenticated_by text not null,
  unique (story_id, booster_id)
);
create index if not exists wall_stings_by_date on public.wall_stings (wall_date, cast_at);
create index if not exists wall_stings_by_booster on public.wall_stings (booster_id, cast_at);

-- Readable by anybody, as the buzzes are, and never the caller: the trial is
-- public and both sides see the score, but nobody sees who stung.
alter table public.wall_stings enable row level security;
drop policy if exists wall_stings_public_read on public.wall_stings;
create policy wall_stings_public_read on public.wall_stings for select using (true);
revoke all on public.wall_stings from anon, authenticated;
grant select (id, story_id, wall_date, cast_at) on public.wall_stings to anon, authenticated;

-- One sting a day, per caller, across every hive. "Day" is the Eastern
-- calendar day the sting is cast on, the clock every hive runs on.
create or replace function public.wall_sting_budget() returns integer
language sql immutable
set search_path = public, pg_temp
as $$ select 1 $$;

-- The insert's rules, the authority whatever function called it.
create or replace function public.wall_stings_before_insert() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  story   wall_stories%rowtype;
  day     wall_days%rowtype;
  cast_on date;
  spent   integer;
  auth_by text;
begin
  select * into story from wall_stories where id = new.story_id;
  if story.id is null then
    raise exception 'wall_stings: no such story %', new.story_id;
  end if;
  if story.status = 'false' then
    raise exception 'wall_stings: that story has been shown false and takes no stings';
  end if;
  select * into day from wall_days where wall_date = story.wall_date;
  if new.cast_at < day.live_at or new.cast_at >= day.closes_at
     or (day.closed_at is not null and new.cast_at >= day.closed_at) then
    raise exception 'wall_stings: the hive for % is not taking stings at %', story.wall_date, new.cast_at;
  end if;

  -- Pick a side.
  if exists (select 1 from wall_boosts where booster_id = new.booster_id and story_id = new.story_id) then
    raise exception 'wall_stings: that caller buzzed this story, and a story is buzzed or stung, never both';
  end if;

  cast_on := (new.cast_at at time zone 'America/New_York')::date;
  select count(*) into spent
    from wall_stings
   where booster_id = new.booster_id
     and (cast_at at time zone 'America/New_York')::date = cast_on;
  if spent >= wall_sting_budget() then
    raise exception 'wall_stings: % already stung % times on %, and the budget is %', new.booster_id, spent, cast_on, wall_sting_budget();
  end if;

  auth_by := nullif(current_setting('wall.sting_auth', true), '');
  if auth_by is null then
    raise exception 'wall_stings: a sting has to say how it was authenticated, and only the sting functions can';
  end if;

  new.wall_date        := story.wall_date;
  new.authenticated_by := auth_by;
  return new;
end;
$$;

drop trigger if exists wall_stings_rules on public.wall_stings;
create trigger wall_stings_rules before insert on public.wall_stings
  for each row execute function public.wall_stings_before_insert();

-- Immutable but for the thirty seconds, exactly as a buzz is.
create or replace function public.wall_stings_refuse_change() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  day wall_days%rowtype;
begin
  if tg_op = 'DELETE' and nullif(current_setting('wall.sting_undo', true), '') = 'undo' then
    if old.cast_at <= now() - make_interval(secs => wall_undo_seconds()) then
      raise exception 'wall_stings: that sting is older than the % second window and is permanent', wall_undo_seconds();
    end if;
    select * into day from wall_days where wall_date = old.wall_date;
    if day.wall_date is not null and (now() >= day.closes_at or day.closed_at is not null) then
      raise exception 'wall_stings: the hive for % has sealed and nothing about it moves again', old.wall_date;
    end if;
    return old;
  end if;
  raise exception 'wall_stings is immutable. A sting is removable only by wall_forget_sting, inside its window.';
end;
$$;

drop trigger if exists wall_stings_immutable on public.wall_stings;
create trigger wall_stings_immutable before delete or update on public.wall_stings
  for each row execute function public.wall_stings_refuse_change();

-- The other half of pick a side: a buzz on a story the same caller stung.
-- Its own trigger, so the buzz trigger's long body is not rewritten here.
create or replace function public.wall_boosts_one_side() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from wall_stings where booster_id = new.booster_id and story_id = new.story_id) then
    raise exception 'wall_boosts: that caller stung this story, and a story is buzzed or stung, never both';
  end if;
  return new;
end;
$$;

drop trigger if exists wall_boosts_one_side on public.wall_boosts;
create trigger wall_boosts_one_side before insert on public.wall_boosts
  for each row execute function public.wall_boosts_one_side();

-- What one browser has done with its sting: how many it has left today, and
-- which story on this hive it stung, if any. Never anybody else's.
create or replace function public.wall_web_sting_standing(wall_date_in date, voter_token_in text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  today_e date := (now() at time zone 'America/New_York')::date;
  booster uuid;
  spent   integer := 0;
  stung   uuid;
  day     wall_days%rowtype;
  open_now boolean;
begin
  select * into day from wall_days where wall_date = wall_date_in;
  open_now := day.wall_date is not null and now() >= day.live_at and now() < day.closes_at and day.closed_at is null;
  if length(coalesce(voter_token_in, '')) >= 16 then
    booster := wall_web_booster_id(voter_token_in);
    select count(*) into spent from wall_stings
     where booster_id = booster and (cast_at at time zone 'America/New_York')::date = today_e;
    select story_id into stung from wall_stings where booster_id = booster and wall_date = wall_date_in;
  end if;
  return jsonb_build_object(
    'stings_left', case when open_now then greatest(0, wall_sting_budget() - spent) else 0 end,
    'stung', stung
  );
end;
$$;

-- A sting from the website, by the browser's token: the same identity, the
-- same limit and the same one word answers as a buzz.
create or replace function public.wall_cast_web_sting(story_id_in uuid, voter_token_in text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  today_e date := (now() at time zone 'America/New_York')::date;
  booster uuid;
  story   wall_stories%rowtype;
  day     wall_days%rowtype;
  spent   integer;
  sting   wall_stings%rowtype;
  said    text;
begin
  if length(coalesce(voter_token_in, '')) < 16 then
    return jsonb_build_object('result', 'bad_token');
  end if;
  booster := wall_web_booster_id(voter_token_in);

  select * into story from wall_stories where id = story_id_in;
  if story.id is null or story.hidden_at is not null then
    return jsonb_build_object('result', 'no_story');
  end if;
  select * into day from wall_days where wall_date = story.wall_date;
  if story.status = 'false' then
    said := 'false';
  elsif now() < day.live_at then
    said := 'not_yet';
  elsif now() >= day.closes_at or day.closed_at is not null then
    said := 'closed';
  end if;
  if said is not null then
    return jsonb_build_object('result', said) || wall_web_sting_standing(story.wall_date, voter_token_in);
  end if;

  -- The same lock a buzz takes, so a buzz and a sting from one browser on
  -- one story cannot both pass the one side check at the same moment.
  perform pg_advisory_xact_lock(hashtext('wall_boost:' || booster::text));

  if exists (select 1 from wall_stings where booster_id = booster and story_id = story.id) then
    return jsonb_build_object('result', 'already_stung') || wall_web_sting_standing(story.wall_date, voter_token_in);
  end if;
  if exists (select 1 from wall_boosts where booster_id = booster and story_id = story.id) then
    return jsonb_build_object('result', 'sided') || wall_web_sting_standing(story.wall_date, voter_token_in);
  end if;
  select count(*) into spent from wall_stings
   where booster_id = booster and (cast_at at time zone 'America/New_York')::date = today_e;
  if spent >= wall_sting_budget() then
    return jsonb_build_object('result', 'sting_spent') || wall_web_sting_standing(story.wall_date, voter_token_in);
  end if;

  perform set_config('wall.sting_auth', 'web_token', true);
  begin
    insert into wall_stings (story_id, wall_date, booster_id, authenticated_by)
      values (story.id, story.wall_date, booster, 'web_token')
      returning * into sting;
  exception when others then
    perform set_config('wall.sting_auth', '', true);
    if sqlerrm like '%not taking stings%' then
      return jsonb_build_object('result', 'closed') || wall_web_sting_standing(story.wall_date, voter_token_in);
    end if;
    if sqlerrm like '%budget is%' then
      return jsonb_build_object('result', 'sting_spent') || wall_web_sting_standing(story.wall_date, voter_token_in);
    end if;
    raise;
  end;
  perform set_config('wall.sting_auth', '', true);

  return jsonb_build_object('result', 'stung', 'sting_id', sting.id) || wall_web_sting_standing(story.wall_date, voter_token_in);
end;
$$;

-- A sting from the app: attested, the way the app's buzz is. The app has no
-- sting control yet; when wall-write gains the action it must consume its
-- grant, which this does.
create or replace function public.wall_cast_sting(story_id_in uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  uid   uuid := auth.uid();
  story wall_stories%rowtype;
  sting wall_stings%rowtype;
begin
  if uid is null then
    raise exception 'wall: not signed in';
  end if;
  perform pg_advisory_xact_lock(hashtext('wall_boost:' || uid::text));
  perform wall_require_attestation(uid);
  select * into story from wall_stories where id = story_id_in;
  if story.id is null or story.hidden_at is not null then
    raise exception 'wall: no such story';
  end if;
  perform set_config('wall.sting_auth', 'attested', true);
  insert into wall_stings (story_id, wall_date, booster_id, authenticated_by)
    values (story.id, story.wall_date, uid, 'attested')
    returning * into sting;
  perform set_config('wall.sting_auth', '', true);
  return jsonb_build_object('result', 'stung', 'sting_id', sting.id);
end;
$$;

-- Taking a sting back inside its thirty seconds. The window and the seal are
-- the trigger's to check; this only finds the caller's own row.
create or replace function public.wall_forget_sting(story_id_in uuid, voter_token_in text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  uid     uuid := auth.uid();
  booster uuid;
  story   wall_stories%rowtype;
  day     wall_days%rowtype;
  doomed  bigint;
  gone    boolean := false;
begin
  if uid is not null then
    if length(coalesce(voter_token_in, '')) > 0 then
      return jsonb_build_object('result', 'bad_token');
    end if;
    booster := uid;
    perform wall_require_attestation(uid);
  elsif length(coalesce(voter_token_in, '')) >= 16 then
    booster := wall_web_booster_id(voter_token_in);
  else
    return jsonb_build_object('result', 'bad_token');
  end if;

  select * into story from wall_stories where id = story_id_in;
  if story.id is null then
    return jsonb_build_object('result', 'no_story');
  end if;
  select * into day from wall_days where wall_date = story.wall_date;
  if day.wall_date is not null and (now() >= day.closes_at or day.closed_at is not null) then
    return jsonb_build_object('result', 'closed');
  end if;

  perform pg_advisory_xact_lock(hashtext('wall_boost:' || booster::text));
  select id into doomed from wall_stings
   where story_id = story.id and booster_id = booster
     and cast_at > now() - make_interval(secs => wall_undo_seconds())
   limit 1 for update;
  if doomed is not null then
    perform set_config('wall.sting_undo', 'undo', true);
    begin
      delete from wall_stings where id = doomed;
      gone := found;
    exception when others then
      perform set_config('wall.sting_undo', '', true);
      raise;
    end;
    perform set_config('wall.sting_undo', '', true);
  end if;
  return jsonb_build_object('result', case when gone then 'unstung' else 'too_late' end);
end;
$$;

revoke all on function public.wall_web_sting_standing(date, text) from public;
revoke all on function public.wall_cast_web_sting(uuid, text) from public;
revoke all on function public.wall_cast_sting(uuid) from public;
revoke all on function public.wall_forget_sting(uuid, text) from public;
grant execute on function public.wall_web_sting_standing(date, text) to anon, service_role;
grant execute on function public.wall_cast_web_sting(uuid, text) to anon, service_role;
grant execute on function public.wall_cast_sting(uuid) to authenticated, service_role;
grant execute on function public.wall_forget_sting(uuid, text) to anon, authenticated, service_role;
