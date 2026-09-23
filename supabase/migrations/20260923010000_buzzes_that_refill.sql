-- Buzzes that refill through the day. docs/the-wall.md section 30, decided
-- September 23, 2026; the times confirmed by Nathan the same day.
--
-- Still three a day on a date's own day and one on the day after, section
-- 4. What changes is when they arrive: one at midnight Eastern, the second
-- at 8 am Eastern, the third at 4 pm Eastern. Unspent ones carry over inside
-- the same day, because the allowance is cumulative: at any instant it is
-- how many have arrived so far, and what has been spent counts against that.
-- A reader who opens the site at 5 pm and has spent nothing has three. A
-- reader at 9 am who spent one at 1 am has one. The day after is unchanged:
-- one, arriving at the midnight that starts it.
--
-- The limit stays server authoritative. The budget trigger is the one place
-- every write passes through and it is the authority; the two boost
-- functions ask the same arithmetic first only so they can answer in a word.
--
-- One buzz is one unit at every hour. Nothing here weighs a late buzz or an
-- early one, and no reader is shown a number about themselves beyond how
-- many they have left and when the next arrives.
--
-- NOT APPLIED. Run inside a transaction on the live project on September
-- 23, 2026, checked at twenty nine instants and rows, and rolled back; the
-- live project was confirmed unchanged afterwards. Jason applies it, and in
-- the same deploy flips REFILLS_ON in web/src/refills.ts and Refills.on in
-- Birthed/Domain/Wall.swift, which make the pages say the refill sentences.
-- The migration goes first: with the flag on and this not applied the page
-- is only shy (it says one, the database gives three); with this applied
-- and the flag off the page lies (it says three, the database refuses the
-- second before 8 am). Until both happen the site says three at midnight
-- and the database gives three at midnight, which agree.

-- ---------------------------------------------------------------------------
-- The arithmetic
-- ---------------------------------------------------------------------------

-- How many units a caller may have spent on a wall by an instant: the units
-- that have arrived by then, in Eastern time. The day's total,
-- wall_boost_budget, is unchanged and still says three and one; this is the
-- part of it that has arrived so far.
--
-- stable, not immutable: the Eastern clock is a rule the operating system
-- carries, and a rule can change. Nothing indexes it.
create function wall_boost_allowance(at_in timestamptz, wall_date_in date)
returns integer
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when (at_in at time zone 'America/New_York')::date = wall_date_in then
      1
      + (extract(hour from (at_in at time zone 'America/New_York')) >= 8)::integer
      + (extract(hour from (at_in at time zone 'America/New_York')) >= 16)::integer
    when (at_in at time zone 'America/New_York')::date = wall_date_in + 1 then 1
    else 0
  end;
$$;

revoke all on function wall_boost_allowance(timestamptz, date) from public;
grant execute on function wall_boost_allowance(timestamptz, date) to anon, authenticated;

comment on function wall_boost_allowance(timestamptz, date) is
  'How many units have arrived for a wall date by an instant: one at midnight Eastern, two from 8 am, three from 4 pm, and one on the day after. The budget trigger and wall_units_left read it. docs/the-wall.md section 30.';

-- When the next unit arrives for a wall date after an instant, or null when
-- none will: 8 am and 4 pm Eastern on the date, and the midnight that starts
-- the day after. A naive timestamp AT TIME ZONE 'America/New_York' is that
-- wall clock time in New York as an instant, which is what makes the 8 am
-- right on the two days the clocks change.
create function wall_next_refill(at_in timestamptz, wall_date_in date)
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select min(t) from (values
    ((wall_date_in::timestamp + interval '8 hours') at time zone 'America/New_York'),
    ((wall_date_in::timestamp + interval '16 hours') at time zone 'America/New_York'),
    (((wall_date_in + 1)::timestamp) at time zone 'America/New_York')
  ) as refills(t)
  where t > at_in;
$$;

revoke all on function wall_next_refill(timestamptz, date) from public;
grant execute on function wall_next_refill(timestamptz, date) to anon, authenticated;

comment on function wall_next_refill(timestamptz, date) is
  'The next instant a unit arrives for a wall date, or null: 8 am and 4 pm Eastern on the date, then the midnight that starts the day after. docs/the-wall.md section 30.';

-- ---------------------------------------------------------------------------
-- The trigger: the authority
-- ---------------------------------------------------------------------------

-- Exactly the trigger from 20260910010000_boosting_from_the_web.sql, with one
-- line changed: the allowance is what has arrived by cast_at rather than the
-- day's total. Everything else, the window check, the day's spend, how the
-- boost was authenticated, is as it was.
create or replace function wall_boosts_before_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  story     wall_stories%rowtype;
  day       wall_days%rowtype;
  cast_on   date;
  already   integer;
  allowance integer;
  auth_by   text;
  jwt_role  text;
begin
  select * into story from wall_stories where id = new.story_id;
  if story.id is null then
    raise exception 'wall_boosts: no such story %', new.story_id;
  end if;
  select * into day from wall_days where wall_date = story.wall_date;

  if new.cast_at < day.live_at or new.cast_at >= day.closes_at
     or (day.closed_at is not null and new.cast_at >= day.closed_at) then
    raise exception 'wall_boosts: the wall for % is not taking boosts at %', story.wall_date, new.cast_at;
  end if;

  cast_on := (new.cast_at at time zone 'America/New_York')::date;
  -- The units that have arrived by this instant, not the day's total.
  allowance := wall_boost_allowance(new.cast_at, story.wall_date);

  select coalesce(sum(units), 0) into already
    from wall_boosts
   where booster_id = new.booster_id
     and wall_date = story.wall_date
     and (cast_at at time zone 'America/New_York')::date = cast_on;

  if already + new.units > allowance then
    raise exception 'wall_boosts: % units on % from % would exceed the budget of % for that day so far (already %)',
      new.units, story.wall_date, cast_on, allowance, already;
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
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- What the app is told
-- ---------------------------------------------------------------------------

-- Exactly 20260909120000_the_wall_writes.sql's wall_units_left, with the
-- allowance read from the clock.
create or replace function wall_units_left(wall_date_in date)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid       uuid := auth.uid();
  today_e   date := (now() at time zone 'America/New_York')::date;
  day       wall_days%rowtype;
  spent     integer;
  allowance integer;
begin
  if uid is null then return 0; end if;
  allowance := wall_boost_allowance(now(), wall_date_in);
  if allowance = 0 then return 0; end if;
  select * into day from wall_days where wall_date = wall_date_in;
  if day.wall_date is not null and (now() >= day.closes_at or day.closed_at is not null) then
    return 0;
  end if;
  select coalesce(sum(units), 0) into spent
    from wall_boosts
   where booster_id = uid
     and wall_date = wall_date_in
     and (cast_at at time zone 'America/New_York')::date = today_e;
  return greatest(0, allowance - spent);
end;
$$;

-- ---------------------------------------------------------------------------
-- What the website is told
-- ---------------------------------------------------------------------------

-- Exactly 20260911020000_the_anniversary.sql's wall_web_standing, with two
-- changes: `left` is against what has arrived so far, and `next_at` says
-- when the next unit arrives, or null. `allowance` is still the day's total,
-- because that is how many dots the page draws.
create or replace function wall_web_standing(wall_date_in date, voter_token_in text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  today_e     date := (now() at time zone 'America/New_York')::date;
  booster     uuid;
  day         wall_days%rowtype;
  allowance   integer;
  arrived     integer;
  next_at     timestamptz;
  spent       integer := 0;
  backed      jsonb := '[]'::jsonb;
  anniversary jsonb := '[]'::jsonb;
begin
  allowance := wall_boost_budget(today_e, wall_date_in);
  arrived := wall_boost_allowance(now(), wall_date_in);
  next_at := wall_next_refill(now(), wall_date_in);
  select * into day from wall_days where wall_date = wall_date_in;
  if day.wall_date is not null and (now() >= day.closes_at or day.closed_at is not null) then
    allowance := 0;
    arrived := 0;
    next_at := null;
  end if;
  if length(coalesce(voter_token_in, '')) >= 16 then
    booster := wall_web_booster_id(voter_token_in);
    select coalesce(sum(units), 0) into spent
      from wall_boosts
     where booster_id = booster
       and wall_date = wall_date_in
       and (cast_at at time zone 'America/New_York')::date = today_e;
    select coalesce(jsonb_agg(story_id order by cast_at), '[]'::jsonb) into backed
      from wall_boosts
     where booster_id = booster
       and wall_date = wall_date_in;

    select coalesce(jsonb_agg(row order by (row ->> 'wall_date') desc), '[]'::jsonb)
      into anniversary
      from (
        select jsonb_build_object(
                 'story_id', b.story_id,
                 'headline', s.headline,
                 'wall_date', b.wall_date::text
               ) as row
          from wall_boosts b
          join wall_stories s on s.id = b.story_id
         where b.booster_id = booster
           and extract(month from b.wall_date) = extract(month from wall_date_in)
           and extract(day from b.wall_date) = extract(day from wall_date_in)
           and extract(year from b.wall_date) < extract(year from wall_date_in)
         order by b.wall_date desc, b.cast_at asc
         limit 10
      ) as rows;
  end if;
  return jsonb_build_object(
    'allowance', allowance,
    'left', greatest(0, arrived - spent),
    'next_at', next_at,
    'backed', backed,
    'anniversary', anniversary
  );
end;
$$;

comment on function wall_web_standing(date, text) is
  'What one browser has done on one wall date: buzzes left right now against what has arrived so far, when the next arrives, the stories it backed, and the stories it backed on the same day in earlier years. Shown back to the browser that gave the token and to nobody else, and never as a number. docs/the-wall.md sections 13, 15 and 30.';

-- ---------------------------------------------------------------------------
-- The web boost, answering in a word
-- ---------------------------------------------------------------------------

-- Exactly 20260910010000_boosting_from_the_web.sql's wall_cast_web_boost,
-- with the early check reading the clock. The trigger is still the authority
-- and refuses under the same lock; the check here is so the answer is a word.
create or replace function wall_cast_web_boost(story_id_in uuid, voter_token_in text)
returns jsonb
language plpgsql
volatile
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
  if story.id is null then
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
    return jsonb_build_object('result', said, 'support', story.support)
      || wall_web_standing(story.wall_date, voter_token_in);
  end if;

  perform pg_advisory_xact_lock(hashtext('wall_boost:' || booster::text));

  if exists (select 1 from wall_boosts where booster_id = booster and story_id = story.id) then
    return jsonb_build_object('result', 'already', 'support', story.support)
      || wall_web_standing(story.wall_date, voter_token_in);
  end if;

  -- What has arrived by now, not the day's total.
  allowance := wall_boost_allowance(now(), story.wall_date);
  select coalesce(sum(units), 0) into spent
    from wall_boosts
   where booster_id = booster
     and wall_date = story.wall_date
     and (cast_at at time zone 'America/New_York')::date = today_e;
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

-- The grants on the three replaced functions are unchanged by create or
-- replace and are restated so a reader of this file sees them.
revoke all on function wall_web_standing(date, text) from public, authenticated;
grant execute on function wall_web_standing(date, text) to anon;
revoke all on function wall_cast_web_boost(uuid, text) from public, authenticated;
grant execute on function wall_cast_web_boost(uuid, text) to anon;
