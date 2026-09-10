-- Taking one buzz back, for thirty seconds.
--
-- docs/the-wall.md, the last entry in section 16, is the authority for every
-- rule in here, and sections 4, 6 and 8 were amended in the same commit
-- because each of them said something this changes.
--
-- Until now a buzz was final the instant it landed. That is right about a
-- decision and wrong about a finger. A misclick is noticed at once: the
-- wrong tile, the row above the one you meant, a thumb on a phone. So one
-- boost can be removed by the person who cast it, for thirty seconds, on a
-- date that has not sealed, and nothing longer, because the count is on the
-- screen by the time a buzz has landed and a longer window would let
-- somebody watch what everybody else backed and move to it. That is the
-- conformity problem coming back in through the exit door. The same
-- reasoning, at the same length, is written over public.forget for the
-- remembrance answers, and this is that pattern copied.
--
--   wall_forget_boost(story, token)   one word back, both clients
--
-- Two things here are not obvious and are the whole of the risk.
--
-- The first is that wall_boosts is immutable and stays immutable. The
-- trigger that refuses every update and every delete, from everybody
-- including the service role, is replaced by one that refuses every update
-- and every delete except a delete this function flagged, using the same
-- transaction local setting the authenticated_by column already uses. A
-- caller cannot set the flag and a route that is not this function cannot
-- reach it.
--
-- The second is that the refund is the delete. The budget is a sum over the
-- rows that exist, in wall_boost_budget's callers and in the trigger, so a
-- removed row is a returned unit with no second piece of arithmetic to
-- disagree with the first. The only cached number is wall_stories.support,
-- and it comes down through an after delete trigger that is the mirror of
-- the after insert one.

-- ---------------------------------------------------------------------------
-- The one delete the ledger permits
-- ---------------------------------------------------------------------------

-- Immutable still means immutable. An update is refused for everybody. A
-- delete is refused for everybody except one that carries the flag AND is a
-- row the undo rule would have chosen: cast inside the window, on a date
-- that has not sealed.
--
-- Both halves are needed and neither is enough on its own. The flag says a
-- function that checked who was calling did this, and it is what stops the
-- worker, a future function or a careless statement removing a row by
-- accident. But a flag is a session setting and anybody who can run raw SQL
-- against this database can set one, so the flag alone would make the word
-- immutable a matter of good manners. The window and the seal are checked
-- here, on the row itself, which is the part no caller can talk their way
-- past. What is left to a caller with raw SQL and bad intent is the removal
-- of a boost cast in the last thirty seconds on an open date, and somebody
-- holding that much access can drop the table instead.
--
-- Who cast it is not checked here, because a trigger cannot know who asked;
-- that is wall_forget_boost's half and it is why the flag exists at all.
create or replace function wall_boosts_refuse_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  day wall_days%rowtype;
begin
  if tg_op = 'DELETE' and nullif(current_setting('wall.boost_undo', true), '') = 'undo' then
    if old.cast_at <= now() - make_interval(secs => wall_undo_seconds()) then
      raise exception 'wall_boosts: that buzz is older than the % second window and is permanent', wall_undo_seconds();
    end if;
    select * into day from wall_days where wall_date = old.wall_date;
    if day.wall_date is not null and (now() >= day.closes_at or day.closed_at is not null) then
      raise exception 'wall_boosts: the hive for % has sealed and nothing about it moves again', old.wall_date;
    end if;
    return old;
  end if;
  raise exception 'wall_boosts is immutable. A buzz is removable only by wall_forget_boost, inside its window. Outcomes go in wall_outcomes.';
end;
$$;

-- The mirror of wall_boosts_after_insert. support is a cache of sum(units),
-- so the only honest thing to do when a row goes is to take its units off
-- again. The check on the column keeps it from going below zero, which it
-- cannot do anyway: the row it is subtracting was added to it.
create function wall_boosts_after_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update wall_stories set support = greatest(0, support - old.units) where id = old.story_id;
  return old;
end;
$$;

create trigger wall_boosts_take_support_back
  after delete on wall_boosts
  for each row execute function wall_boosts_after_delete();

comment on table wall_boosts is
  'Immutable. Never updated by anybody. Never deleted by anybody except wall_forget_boost, which removes one row cast by the caller inside a thirty second window on a date that has not sealed, and which nothing else can imitate. docs/the-wall.md section 6 and the last entry in section 16.';

-- ---------------------------------------------------------------------------
-- Thirty seconds
-- ---------------------------------------------------------------------------

-- One function, rather than a settings table or a number written twice.
-- remember_settings carries undo_seconds because the remembrance question
-- had a row to hang it on and a person who wanted to turn it off; the hive
-- has neither. The window is read by wall_forget_boost, which chooses the
-- row, and by the trigger, which is the one that cannot be talked past, so
-- it has to be one number or the two could disagree. Changing it is a
-- migration, which is the right weight for a change to how long a permanent
-- thing is not permanent.
create function wall_undo_seconds()
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$ select 30 $$;

revoke all on function wall_undo_seconds() from public, anon, authenticated;

-- Remove one buzz of your own, if you cast it recently enough.
--
-- Deliberately narrow, the way public.forget is. It matches on the caller as
-- well as on the story, so it can only ever reach a row this browser or this
-- account made, and it cannot touch a sealed date at all.
--
-- Who the caller is:
--
--   an authenticated caller is auth.uid(), and a token sent with it is
--   refused rather than used, so an account cannot reach a browser's buzz;
--   anybody else is the browser token, hashed by wall_web_booster_id, which
--   is the same identity wall_cast_web_boost gave the row when it made it.
--
-- Every outcome is a word rather than an exception, on the precedent of
-- wall_cast_web_boost, because the page turns each into its own sentence:
--
--   undone     the buzz is gone and the unit is back
--   too_late   older than the window, or this caller never buzzed that story
--   closed     the date has sealed, so nothing about it moves again
--   no_story   no such story
--   bad_token  no account and no token this site would have set
create function wall_forget_boost(story_id_in uuid, voter_token_in text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  uid       uuid := auth.uid();
  booster   uuid;
  story     wall_stories%rowtype;
  day       wall_days%rowtype;
  doomed    bigint;
  gone      boolean := false;
begin
  if uid is not null then
    -- An account is the account. A token from an authenticated caller is a
    -- caller reaching for somebody else's identity, and wall_web_standing
    -- already refuses the same shape for the same reason.
    if length(coalesce(voter_token_in, '')) > 0 then
      return jsonb_build_object('result', 'bad_token');
    end if;
    booster := uid;
    -- An app write consumes its grant, and this is an app write. Not for the
    -- protection, since this function can only ever reach the caller's own
    -- row inside the window, but because wall-write writes one grant per
    -- call and a grant nobody consumes is a spare one, which the next direct
    -- call to wall_cast_boost would spend instead of attesting. A refused
    -- undo spends it too, the same way a refused boost does.
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

  -- Midnight is the one thing in this document that is final. A square that
  -- is permanent from midnight does not lose a module at ten past, even for
  -- a buzz cast twenty seconds before it.
  if day.wall_date is not null and (now() >= day.closes_at or day.closed_at is not null) then
    return jsonb_build_object('result', 'closed', 'support', story.support);
  end if;

  -- One caller at a time, the same lock the two boost functions take, so an
  -- undo and a second buzz from the same person cannot read the budget at
  -- the same moment and both believe it.
  perform pg_advisory_xact_lock(hashtext('wall_boost:' || booster::text));

  -- Newest first and one row, because one story takes one buzz from one
  -- caller on both clients, and a ledger from before that rule could hold
  -- two. The one being taken back is the one just cast. The row is chosen
  -- before the flag is set, so the flag is on for one statement only.
  select id into doomed
    from wall_boosts
   where story_id = story.id
     and booster_id = booster
     and cast_at > now() - make_interval(secs => wall_undo_seconds())
   order by cast_at desc
   limit 1
   for update;

  if doomed is not null then
    -- The app's tap carries a request identifier and wall_boost_requests
    -- points at the boost, so the pointer goes first or the delete is
    -- refused by the foreign key. Losing it is right: the identifier existed
    -- to make one tap idempotent, the tap it stood for is gone, and the app
    -- mints a fresh identifier for the next one.
    delete from wall_boost_requests where boost_id = doomed;

    perform set_config('wall.boost_undo', 'undo', true);
    begin
      delete from wall_boosts where id = doomed;
      gone := found;
    exception when others then
      perform set_config('wall.boost_undo', '', true);
      raise;
    end;
    perform set_config('wall.boost_undo', '', true);
  end if;

  select * into story from wall_stories where id = story.id;
  if not gone then
    -- Too late and never buzzed are one answer as far as a page is
    -- concerned, which is the reason public.forget returns false for both.
    return jsonb_build_object('result', 'too_late', 'support', story.support);
  end if;
  return jsonb_build_object('result', 'undone', 'support', story.support);
end;
$$;

-- The website calls it with a token as anon. The app calls it through
-- wall-write as the account, which is authenticated. Both, and nobody else.
revoke all on function wall_forget_boost(uuid, text) from public;
grant execute on function wall_forget_boost(uuid, text) to anon, authenticated;

comment on function wall_forget_boost(uuid, text) is
  'Removes one buzz the caller cast in the last thirty seconds on a date that has not sealed, and returns one word: undone, too_late, closed, no_story or bad_token. The unit returns to the day budget because the budget counts the rows that exist. docs/the-wall.md, the last entry in section 16.';
