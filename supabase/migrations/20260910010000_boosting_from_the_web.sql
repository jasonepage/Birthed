-- Boosting from the web, without an account. docs/the-wall.md is the
-- authority for every rule in here, and section 13 records what this session
-- decided.
--
-- Until now the only way to boost was wall_cast_boost, granted to the
-- authenticated role and guarded by App Attest, which meant the iOS app, which
-- is not built. So no person could boost anything, every tile was at the
-- minimum size, and the wall communicated nothing. This migration opens one
-- more way in, for the web:
--
--   wall_cast_web_boost(story, token)   one tap, one unit, from a browser
--   wall_web_standing(date, token)      what this browser has left and backed
--
-- Identity on the web is the token cookie serve.ts already sets for the
-- remembrance answers: a random value that identifies a browser for a year
-- and names nobody. It is turned into a booster_id here by hashing, so the
-- same browser is the same booster every time and the token itself is never
-- stored. Nothing else about the person is recorded. booster_id was
-- deliberately not a foreign key, docs/the-wall.md section 10, which is what
-- lets a boost exist without an account existing.
--
-- The trade, stated plainly. A cookie is not a person. Anybody who clears one
-- is a new voter, and there is no honest way around that without an account,
-- which reading on this site must never require. It is the same trade the
-- remembrance answers already make, it is bounded by the rate limit in
-- serve.ts and by the three unit budget, and it is why every boost now records
-- how it was authenticated: an attested app boost and an unattested web boost
-- count the same today, and the ledger knows which was which forever, so a
-- future formula can weigh them differently without a migration over history.
--
-- Nothing here weakens the app path. wall_cast_boost still consumes an
-- attestation grant, still takes one to three units, and gains exactly one
-- line: it says it was attested before it inserts. The budget trigger is the
-- authority for both paths and is untouched except for filling the new column.

-- ---------------------------------------------------------------------------
-- How a boost was authenticated
-- ---------------------------------------------------------------------------

-- attested: the app proved itself with App Attest and consumed a grant.
-- web_token: a browser holding the token cookie, unattested, rate limited.
-- seed_tool: written directly by the service role with nothing in front of
-- it, which only the test seed does, and the seed must never run against the
-- live project. Every existing row came through wall_cast_boost, which has
-- always required attestation, so the default for them is true, and the
-- default is then dropped so nothing can rely on it.
alter table wall_boosts
  add column authenticated_by text not null default 'attested'
    check (authenticated_by in ('attested', 'web_token', 'seed_tool'));
alter table wall_boosts alter column authenticated_by drop default;

comment on column wall_boosts.authenticated_by is
  'How the boost was authenticated: attested (App Attest, through wall_cast_boost), web_token (the token cookie, through wall_cast_web_boost), or seed_tool. Filled by the trigger from a transaction local flag the boost functions set, never by a caller. docs/the-wall.md section 13.';

-- The budget trigger, exactly as it was, plus the new column. The flag is a
-- transaction local setting the two boost functions write just before they
-- insert, so a caller cannot supply the value and a function cannot forget
-- to: an insert with no flag from anything but the service role is refused.
-- The service role case is the seed tool writing rows directly, and those
-- rows are labelled as what they are.
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

  -- A boost lands only while the wall is open, and only from the live day on.
  -- The day before is submissions only.
  if new.cast_at < day.live_at or new.cast_at >= day.closes_at
     or (day.closed_at is not null and new.cast_at >= day.closed_at) then
    raise exception 'wall_boosts: the wall for % is not taking boosts at %', story.wall_date, new.cast_at;
  end if;

  cast_on := (new.cast_at at time zone 'America/New_York')::date;
  allowance := wall_boost_budget(cast_on, story.wall_date);

  select coalesce(sum(units), 0) into already
    from wall_boosts
   where booster_id = new.booster_id
     and wall_date = story.wall_date
     and (cast_at at time zone 'America/New_York')::date = cast_on;

  if already + new.units > allowance then
    raise exception 'wall_boosts: % units on % from % would exceed the budget of % for that day (already %)',
      new.units, story.wall_date, cast_on, allowance, already;
  end if;

  -- How this boost was authenticated. The value a caller sent in the column
  -- is discarded; only the flag counts.
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
-- The app path, unchanged but for saying it was attested
-- ---------------------------------------------------------------------------

create or replace function wall_cast_boost(story_id_in uuid, units_in integer, request_id_in uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  uid       uuid := auth.uid();
  story     wall_stories%rowtype;
  day       wall_days%rowtype;
  seen      wall_boost_requests%rowtype;
  boost     wall_boosts%rowtype;
  left_now  integer;
begin
  if uid is null then
    raise exception 'wall: not signed in';
  end if;
  if request_id_in is null then
    raise exception 'wall: a boost needs a request identifier';
  end if;
  if units_in is null or units_in < 1 or units_in > 3 then
    raise exception 'wall: units are one, two or three';
  end if;

  -- One account at a time, so a double tap that somehow carried two
  -- identifiers still meets the budget one after the other.
  perform pg_advisory_xact_lock(hashtext('wall_boost:' || uid::text));

  -- The same tap again returns what it already did, before a grant is
  -- spent and before the budget is asked anything.
  select * into seen from wall_boost_requests where request_id = request_id_in;
  if seen.request_id is not null then
    if seen.booster_id <> uid then
      raise exception 'wall: that request identifier belongs to somebody else';
    end if;
    select * into boost from wall_boosts where id = seen.boost_id;
    select * into story from wall_stories where id = boost.story_id;
    return jsonb_build_object(
      'repeated', true,
      'boost_id', boost.id,
      'units', boost.units,
      'support', story.support,
      'units_left', wall_units_left(story.wall_date)
    );
  end if;

  perform wall_require_attestation(uid);

  select * into story from wall_stories where id = story_id_in;
  if story.id is null then
    raise exception 'wall: no such story';
  end if;
  if story.status = 'false' then
    raise exception 'wall: that story has been shown false and takes no boosts';
  end if;
  select * into day from wall_days where wall_date = story.wall_date;
  if now() < day.live_at then
    raise exception 'wall: the wall for % takes no boosts until the day arrives', story.wall_date;
  end if;
  if now() >= day.closes_at or day.closed_at is not null then
    raise exception 'wall: the wall for % has closed', story.wall_date;
  end if;

  left_now := wall_units_left(story.wall_date);
  if units_in > left_now then
    raise exception 'wall: % left on % today, not %', left_now, story.wall_date, units_in;
  end if;

  -- The grant was consumed above, so this boost is attested. The trigger
  -- reads the flag and fills the column; nothing else can.
  perform set_config('wall.boost_auth', 'attested', true);

  -- The trigger fills wall_date, tier_at_cast and support_before from the
  -- story and enforces the budget again. The values here are placeholders it
  -- replaces.
  insert into wall_boosts (story_id, booster_id, wall_date, units, tier_at_cast, support_before)
    values (story.id, uid, story.wall_date, units_in, 'claimed', 0)
    returning * into boost;

  perform set_config('wall.boost_auth', '', true);

  insert into wall_boost_requests (request_id, booster_id, boost_id)
    values (request_id_in, uid, boost.id);

  insert into profiles (id) values (uid) on conflict (id) do nothing;
  update profiles set wall_joined_at = coalesce(wall_joined_at, now()) where id = uid;

  select * into story from wall_stories where id = story.id;
  return jsonb_build_object(
    'repeated', false,
    'boost_id', boost.id,
    'units', boost.units,
    'support', story.support,
    'units_left', wall_units_left(story.wall_date)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- A browser as a booster
-- ---------------------------------------------------------------------------

-- The token cookie, hashed into the uuid shape booster_id already has. The
-- same token is the same booster every time, which is what lets the budget
-- trigger count it, and the token itself never reaches a table. A salt so the
-- value is not simply md5 of a cookie anybody could recompute from a leaked
-- one; the cookie is HttpOnly and never leaves the browser and this server.
create function wall_web_booster_id(token_in text)
returns uuid
language sql
immutable
set search_path = public, pg_temp
as $$
  select md5('birthed-wall-web-v1:' || token_in)::uuid;
$$;

revoke all on function wall_web_booster_id(text) from public, anon, authenticated;

-- What this browser has on this date right now: how many taps it has left
-- today by server time, and which stories on the date it has already backed.
-- The second is shown back to the browser that gave it and to nobody else,
-- the way my_answers hands a reader their own remembrance answers back. No
-- token, or a token too short to have been ours, gets the plain allowance and
-- an empty list, which is what a first time reader should see.
create function wall_web_standing(wall_date_in date, voter_token_in text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  today_e   date := (now() at time zone 'America/New_York')::date;
  booster   uuid;
  day       wall_days%rowtype;
  allowance integer;
  spent     integer := 0;
  backed    jsonb := '[]'::jsonb;
begin
  allowance := wall_boost_budget(today_e, wall_date_in);
  select * into day from wall_days where wall_date = wall_date_in;
  if day.wall_date is not null and (now() >= day.closes_at or day.closed_at is not null) then
    allowance := 0;
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
  end if;
  return jsonb_build_object(
    'allowance', allowance,
    'left', greatest(0, allowance - spent),
    'backed', backed
  );
end;
$$;

revoke all on function wall_web_standing(date, text) from public, authenticated;
grant execute on function wall_web_standing(date, text) to anon;

-- ---------------------------------------------------------------------------
-- One tap, one unit
-- ---------------------------------------------------------------------------

-- The web path. One unit, always: the one, two or three unit conviction
-- sizing stays in the app, and on the web a tap is a tap. No request
-- identifier either, because a second tap on a story this browser already
-- backed is answered 'already' and spends nothing, which is what a double
-- tap or a retry needs.
--
-- Every outcome is a word rather than an exception, on the precedent of
-- remember_status: the page turns each into its own sentence, and a boolean
-- or a raised error cannot be made honest by better copy around it.
--
--   kept       one unit landed
--   already    this browser had backed this story; nothing spent
--   spent      no taps left on this date today; the budget refused it
--   not_yet    the date takes no taps until it arrives
--   closed     the wall for that date has closed
--   false      the story was shown false and takes no boosts
--   no_story   no such story
--   bad_token  the token is not one this site would have set
create function wall_cast_web_boost(story_id_in uuid, voter_token_in text)
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

  -- Server time decides, to the transaction: now() here and cast_at in the
  -- trigger are the same instant, so a tap arriving in the second a date
  -- closes gets one answer, not two.
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

  -- One browser at a time, so a double tap meets the budget one after the
  -- other rather than both reading three left.
  perform pg_advisory_xact_lock(hashtext('wall_boost:' || booster::text));

  if exists (select 1 from wall_boosts where booster_id = booster and story_id = story.id) then
    return jsonb_build_object('result', 'already', 'support', story.support)
      || wall_web_standing(story.wall_date, voter_token_in);
  end if;

  -- Checked first only to answer in a word. The trigger is the authority and
  -- checks it again under the same lock.
  allowance := wall_boost_budget(today_e, story.wall_date);
  select coalesce(sum(units), 0) into spent
    from wall_boosts
   where booster_id = booster
     and wall_date = story.wall_date
     and (cast_at at time zone 'America/New_York')::date = today_e;
  if spent >= allowance then
    return jsonb_build_object('result', 'spent', 'support', story.support)
      || wall_web_standing(story.wall_date, voter_token_in);
  end if;

  -- Unattested, and the ledger says so. The trigger reads the flag and fills
  -- the column; the values in the insert are the placeholders it replaces.
  perform set_config('wall.boost_auth', 'web_token', true);
  begin
    insert into wall_boosts (story_id, booster_id, wall_date, units, tier_at_cast, support_before)
      values (story.id, booster, story.wall_date, 1, 'claimed', 0)
      returning * into boost;
  exception when others then
    perform set_config('wall.boost_auth', '', true);
    -- The trigger's refusals are the same two facts said again, so they get
    -- the same two words rather than an error the page cannot explain.
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

revoke all on function wall_cast_web_boost(uuid, text) from public, authenticated;
grant execute on function wall_cast_web_boost(uuid, text) to anon;
