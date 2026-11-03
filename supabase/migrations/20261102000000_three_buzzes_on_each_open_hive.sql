-- Three independent buzzes on each of the three open hives.
-- Yesterday, today and tomorrow all take buzzes from opens_at through closes_at.

create or replace function public.wall_boost_budget(cast_on date, wall_date_in date)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case when cast_on between wall_date_in - 1 and wall_date_in + 1 then 3 else 0 end;
$$;

-- Keep the optional refill path on the same rule. All three are available at
-- once on each hive, so there is no intra-day refill clock for this budget.
create or replace function public.wall_boost_allowance(at_in timestamptz, wall_date_in date)
returns integer
language sql
stable
set search_path = public, pg_temp
as $$
  select wall_boost_budget((at_in at time zone 'America/New_York')::date, wall_date_in);
$$;

revoke all on function public.wall_boost_allowance(timestamptz, date) from public;
grant execute on function public.wall_boost_allowance(timestamptz, date) to anon, authenticated;

create or replace function public.wall_boosts_before_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  story        wall_stories%rowtype;
  day          wall_days%rowtype;
  cast_on      date;
  already      integer;
  allowance    integer;
  auth_by      text;
  jwt_role     text;
  is_answer    boolean;
  is_suggested boolean;
begin
  select * into story from wall_stories where id = new.story_id;
  if story.id is null then
    raise exception 'wall_boosts: no such story %', new.story_id;
  end if;
  select * into day from wall_days where wall_date = story.wall_date;

  if new.cast_at < day.opens_at or new.cast_at >= day.closes_at
     or (day.closed_at is not null and new.cast_at >= day.closed_at) then
    raise exception 'wall_boosts: the wall for % is not taking boosts at %', story.wall_date, new.cast_at;
  end if;

  cast_on := (new.cast_at at time zone 'America/New_York')::date;
  is_answer := coalesce(nullif(current_setting('wall.boost_answer', true), '') = 'answer', false);
  is_suggested := coalesce(nullif(current_setting('wall.boost_suggest', true), '') = 'suggest', false);
  if is_answer and is_suggested then
    raise exception 'wall_boosts: a row is an answer or a suggestion, not both';
  end if;
  if is_answer or is_suggested then
    if cast_on <> story.wall_date then
      raise exception 'wall_boosts: an answer or a suggestion is taken on its own date only, not on %', cast_on;
    end if;
    if new.units <> 1 then
      raise exception 'wall_boosts: an answer or a suggestion is one unit';
    end if;
  else
    allowance := wall_boost_budget(cast_on, story.wall_date);
    select coalesce(sum(units), 0) into already
      from wall_boosts
     where booster_id = new.booster_id
       and wall_date = story.wall_date
       and (cast_at at time zone 'America/New_York')::date = cast_on
       and not answer
       and not suggested;
    if already + new.units > allowance then
      raise exception 'wall_boosts: % units on % from % would exceed the budget of % for that day so far (already %)',
        new.units, story.wall_date, cast_on, allowance, already;
    end if;
  end if;

  auth_by := nullif(current_setting('wall.boost_auth', true), '');
  if auth_by is null then
    begin
      jwt_role := nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role';
    exception when others then
      jwt_role := null;
    end;
    if current_user in ('postgres', 'service_role') or jwt_role = 'service_role' then
      auth_by := 'seed_tool';
    else
      raise exception 'wall_boosts: a boost has to say how it was authenticated, and only the boost functions can';
    end if;
  end if;

  new.wall_date        := story.wall_date;
  new.tier_at_cast     := story.tier;
  new.support_before   := story.support;
  new.authenticated_by := auth_by;
  new.answer           := is_answer;
  new.suggested        := is_suggested;
  return new;
end;
$$;

create or replace function public.wall_cast_web_boost(story_id_in uuid, voter_token_in text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  today_e   date := (now() at time zone 'America/New_York')::date;
  booster   uuid;
  story     wall_stories%rowtype;
  day       wall_days%rowtype;
  allowance integer;
  spent     integer;
  boost     wall_boosts%rowtype;
  said      text;
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
  elsif now() < day.opens_at then
    said := 'not_yet';
  elsif now() >= day.closes_at or day.closed_at is not null then
    said := 'closed';
  end if;
  if said is not null then
    return jsonb_build_object('result', said, 'support', story.support)
      || wall_web_standing(story.wall_date, voter_token_in);
  end if;

  perform pg_advisory_xact_lock(hashtext('wall_boost:' || booster::text));
  if exists (select 1 from wall_boosts where booster_id = booster and story_id = story.id) then
    return jsonb_build_object('result', 'already', 'support', story.support)
      || wall_web_standing(story.wall_date, voter_token_in);
  end if;
  allowance := wall_boost_budget(today_e, story.wall_date);
  select coalesce(sum(units), 0) into spent
    from wall_boosts
   where booster_id = booster
     and wall_date = story.wall_date
     and (cast_at at time zone 'America/New_York')::date = today_e
     and not answer
     and not suggested;
  if spent >= allowance then
    return jsonb_build_object('result', 'spent', 'support', story.support)
      || wall_web_standing(story.wall_date, voter_token_in);
  end if;

  perform set_config('wall.boost_auth', 'web_token', true);
  begin
    insert into wall_boosts (story_id, booster_id, wall_date, units, tier_at_cast, support_before)
      values (story.id, booster, story.wall_date, 1, 'claimed', 0)
      returning * into boost;
  exception when others then
    perform set_config('wall.boost_auth', '', true);
    if sqlerrm like '%exceed the budget%' then
      return jsonb_build_object('result', 'spent', 'support', story.support)
        || wall_web_standing(story.wall_date, voter_token_in);
    end if;
    if sqlerrm like '%not taking boosts%' then
      return jsonb_build_object('result', 'closed', 'support', story.support)
        || wall_web_standing(story.wall_date, voter_token_in);
    end if;
    raise;
  end;
  perform set_config('wall.boost_auth', '', true);
  select * into story from wall_stories where id = story.id;
  return jsonb_build_object('result', 'kept', 'support', story.support, 'boost_id', boost.id)
    || wall_web_standing(story.wall_date, voter_token_in);
end;
$$;

comment on function public.wall_boost_budget(date, date) is
  'Three independent buzzes on each of yesterday, today and tomorrow. Each wall_date has its own budget.';
