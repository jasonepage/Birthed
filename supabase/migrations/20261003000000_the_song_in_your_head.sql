-- The song in your head. docs/the-wall.md section 31, built October 3, 2026.
--
-- One question at the top of today's date page, "What song is in your head
-- today?", answered by picking a real song from Apple's search. This file is
-- everything the database needs for it:
--
--   wall_boosts.answer           an answer is a buzz row, marked, and free
--   wall_boosts_one_answer_a_day one answer per browser per date
--   wall_songs                   tracks as Apple described them, looked up once
--   wall_song_key                one song however it is spelled
--   wall_song_lookup             the database asks Apple, so no caller can
--                                put words of its own on a tile
--   wall_answer_song             the website's one write for an answer
--   wall_stories.hidden_at       a curator's hide, and the read policy that
--                                honours it
--   wall_hide_song               the hide, admins only, before the seal
--   wall_songs_for_curator       the open dates' songs, for the curation panel
--
-- and the four functions that count a browser's buzzes, each exactly as it
-- is on the live project on October 3, 2026, with one change: an answer row
-- is not one of the day's three. Those four are the trigger, which is the
-- authority, wall_cast_web_boost and wall_units_left, which ask the same sum
-- first so they can answer in a word, and wall_web_standing, which also says
-- which story this browser answered with. And wall_web_record, the private
-- record, which leaves a hidden song out.
--
-- **Two older files rewrite those same functions and are not applied:**
-- 20260911020000_the_anniversary.sql and 20260923010000_buzzes_that_refill.sql.
-- Both were edited on October 3, 2026 to carry the same change, and both now
-- read wall_boosts.answer, so either of them goes after this file and never
-- before it. Applied the other way round they would fail on the missing
-- column, which is the safe direction to fail in.
--
-- **Not yet run on the live project.** A run inside a transaction that rolls
-- back was attempted on October 3, 2026 and was cancelled before it started;
-- the project was read afterwards and had none of this. It was tested
-- instead in memory, on PGlite, on top of the live project's wall tables and
-- functions as they stood that day: worker/test/song-migration.test.ts. What
-- that cannot test is Apple itself, the lookup wall_song_lookup makes. The
-- title folding was checked on the live project with a read only query and
-- matches. Applied when Jason says, and before the website that reads it is
-- pushed.

-- ---------------------------------------------------------------------------
-- An answer is a buzz, marked, and free
-- ---------------------------------------------------------------------------

-- Each answer is a free buzz on its song, Jason's call: the song's support
-- counts the heads it is in, so the crown, the pie, the decade line and the
-- live hive count an answer with no rule of their own. Filled by the trigger
-- from a transaction local flag only wall_answer_song sets, never by a
-- caller, the way authenticated_by is. Every existing row is a buzz.
alter table wall_boosts add column answer boolean not null default false;

comment on column wall_boosts.answer is
  'True for the buzz an answer to "What song is in your head today?" gives its song: free, outside the day''s three, one per browser per date. Filled by the trigger from a flag only wall_answer_song sets. docs/the-wall.md section 31.';

-- The page counts heads from these rows, so the website's role may read the
-- column, beside the six it already reads. booster_id stays refused.
grant select (answer) on wall_boosts to anon, authenticated;

-- One answer a day. The wall date is the Eastern date the answer was given
-- on, because the trigger refuses an answer on any other day, so one per
-- browser per wall date is one per browser per day.
create unique index wall_boosts_one_answer_a_day on wall_boosts (booster_id, wall_date) where answer;

-- ---------------------------------------------------------------------------
-- The songs, as Apple described them
-- ---------------------------------------------------------------------------

-- One row per Apple track number anybody has answered with, read from
-- Apple's lookup by wall_song_lookup and never written by a caller. The title
-- and artist on a tile come from here, which is what keeps a hand made post
-- from putting words of its own on a sealed hive.
create table wall_songs (
  track_id      bigint primary key check (track_id > 0),
  title         text not null check (length(title) between 1 and 300),
  artist        text not null check (length(artist) between 1 and 300),
  artist_id     bigint not null check (artist_id > 0),
  album         text check (album is null or length(album) <= 300),
  released      date,
  explicit      boolean not null default false,
  -- Apple's artwork address, on Apple's image host and nowhere else. The
  -- site never hands it to a browser: /cover/<track>.jpg fetches it.
  artwork_url   text check (artwork_url is null or artwork_url ~ '^https://is[0-9]+-ssl\.mzstatic\.com/image/thumb/'),
  store_url     text not null check (store_url ~ '^https://(music|itunes)\.apple\.com/'),
  song_key      text not null,
  looked_up_at  timestamptz not null default now()
);

comment on table wall_songs is
  'Apple tracks people answered "What song is in your head today?" with, as Apple''s lookup described them. Written only by wall_song_lookup. docs/the-wall.md section 31.';

alter table wall_songs enable row level security;
create policy wall_songs_public_read on wall_songs for select using (true);
grant select on wall_songs to anon, authenticated;

-- One song however it is spelled. Apple files the same song under several
-- track numbers, the single, the album, the deluxe album and the clean
-- version, so a song is its artist's number and its title folded: lower
-- case, anything in brackets dropped, a " - Remastered 2011" tail dropped,
-- spaces and punctuation dropped. A title that folds to nothing keeps its
-- lower case self. songKey in web/src/song-prompt.ts is the other copy, and
-- web/test/song-prompt.test.ts holds it to the answers this one printed.
create or replace function wall_song_key(artist_id_in bigint, title_in text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select artist_id_in::text || ':' || coalesce(
    nullif(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(title_in), '[(\[][^)\]]*[)\]]', '', 'g'),
          '\s+-\s.*$', ''),
        '[[:space:][:punct:]]+', '', 'g'),
      ''),
    lower(title_in));
$$;

-- The track, read from Apple once and kept. Answers 'ok' when the track is
-- in wall_songs afterwards, 'no_song' when Apple has no song by that number,
-- and 'busy' when Apple could not be asked: slow, refusing, or saying
-- something that is not its lookup. The timeout is under the three seconds a
-- request from the website's role is allowed, so a slow Apple is a word and
-- never a cancelled statement.
create or replace function wall_song_lookup(track_id_in bigint)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  response  extensions.http_response;
  body      jsonb;
  item      jsonb;
  title     text;
  artist    text;
  art       text;
  store     text;
  released  date;
begin
  if exists (select 1 from wall_songs where track_id = track_id_in) then
    return 'ok';
  end if;

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '2500');
  begin
    response := extensions.http((
      'GET',
      'https://itunes.apple.com/lookup?id=' || track_id_in::text || '&entity=song&country=US',
      array[extensions.http_header('User-Agent', 'Birthed/0.1 (https://birthed.app)')],
      null, null
    )::extensions.http_request);
  exception when others then
    perform extensions.http_reset_curlopt();
    return 'busy';
  end;
  perform extensions.http_reset_curlopt();

  if response.status is distinct from 200 then
    return 'busy';
  end if;
  begin
    body := response.content::jsonb;
  exception when others then
    return 'busy';
  end;

  select r into item
    from jsonb_array_elements(coalesce(body -> 'results', '[]'::jsonb)) as r
   where r ->> 'wrapperType' = 'track'
     and r ->> 'kind' = 'song'
     and r ->> 'trackId' = track_id_in::text
   limit 1;
  if item is null then
    return 'no_song';
  end if;

  -- Apple's words, with any control character taken out, because a title is
  -- drawn on a page and kept forever.
  title := btrim(regexp_replace(coalesce(item ->> 'trackName', ''), '[[:cntrl:]]', '', 'g'));
  artist := btrim(regexp_replace(coalesce(item ->> 'artistName', ''), '[[:cntrl:]]', '', 'g'));
  if title = '' or artist = '' or length(title) > 300 or length(artist) > 300
     or coalesce(item ->> 'artistId', '') !~ '^[0-9]{1,18}$' then
    return 'no_song';
  end if;

  store := item ->> 'trackViewUrl';
  if store is null or store !~ '^https://(music|itunes)\.apple\.com/' then
    return 'no_song';
  end if;
  art := item ->> 'artworkUrl100';
  if art is not null and art !~ '^https://is[0-9]+-ssl\.mzstatic\.com/image/thumb/' then
    art := null;
  end if;
  begin
    released := (item ->> 'releaseDate')::timestamptz::date;
  exception when others then
    released := null;
  end;

  insert into wall_songs (track_id, title, artist, artist_id, album, released, explicit, artwork_url, store_url, song_key)
  values (
    track_id_in, title, artist, (item ->> 'artistId')::bigint,
    nullif(left(btrim(regexp_replace(coalesce(item ->> 'collectionName', ''), '[[:cntrl:]]', '', 'g')), 300), ''),
    released,
    coalesce(item ->> 'trackExplicitness', '') = 'explicit',
    art, store,
    wall_song_key((item ->> 'artistId')::bigint, title)
  )
  on conflict (track_id) do nothing;
  return 'ok';
end;
$$;

-- Only through wall_answer_song. A direct caller could otherwise make the
-- database ask Apple for any number it liked, as fast as it liked.
revoke execute on function wall_song_lookup(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A song answer is a story of its own kind, and a curator can hide one
-- ---------------------------------------------------------------------------

alter table wall_stories drop constraint if exists wall_stories_subject_kind_check;
alter table wall_stories add constraint wall_stories_subject_kind_check
  check (subject_kind = any (array['historical_event', 'birth_fact', 'cultural_event', 'person', 'song', 'album', 'film', 'answer']));

-- A hidden story is gone from every reader: the website, the app and the
-- live hive all read through the policy below, so none of them needed a
-- change to honour it. The rows stay, as everything here does.
alter table wall_stories add column hidden_at timestamptz;
alter table wall_stories add column hidden_note text;
alter table wall_stories add constraint wall_stories_hidden_is_noted
  check ((hidden_at is null) = (hidden_note is null));

comment on column wall_stories.hidden_at is
  'When a curator hid this story from every reader, through wall_hide_song, before its hive sealed. Null for every story anybody can see. docs/the-wall.md section 31.';

drop policy if exists wall_stories_public_read on wall_stories;
create policy wall_stories_public_read on wall_stories for select using (hidden_at is null);

-- ---------------------------------------------------------------------------
-- The trigger: the authority
-- ---------------------------------------------------------------------------

-- Exactly the live trigger, from 20260910010000_boosting_from_the_web.sql,
-- with the answer: an answer row is one unit, only on its own date, outside
-- the day's budget, and marked. A buzz is counted against the budget without
-- the answer rows, so the free one never costs anybody one of their three.
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
  is_answer boolean;
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

  -- An answer is the flag's to say, never the row's.
  is_answer := coalesce(nullif(current_setting('wall.boost_answer', true), '') = 'answer', false);
  if is_answer then
    if cast_on <> story.wall_date then
      raise exception 'wall_boosts: an answer is taken on its own date only, not on %', cast_on;
    end if;
    if new.units <> 1 then
      raise exception 'wall_boosts: an answer is one unit';
    end if;
  else
    allowance := wall_boost_budget(cast_on, story.wall_date);

    select coalesce(sum(units), 0) into already
      from wall_boosts
     where booster_id = new.booster_id
       and wall_date = story.wall_date
       and (cast_at at time zone 'America/New_York')::date = cast_on
       and not answer;

    if already + new.units > allowance then
      raise exception 'wall_boosts: % units on % from % would exceed the budget of % for that day (already %)',
        new.units, story.wall_date, cast_on, allowance, already;
    end if;
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
  new.answer           := is_answer;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- The three that ask the budget first, each as live plus "and not answer"
-- ---------------------------------------------------------------------------

create or replace function wall_cast_web_boost(story_id_in uuid, voter_token_in text)
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
  -- A hidden story is no story to a reader, so it is none to a buzz either.
  if story.id is null or story.hidden_at is not null then
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
     and (cast_at at time zone 'America/New_York')::date = today_e
     and not answer;
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
  allowance := wall_boost_budget(today_e, wall_date_in);
  if allowance = 0 then return 0; end if;
  select * into day from wall_days where wall_date = wall_date_in;
  if day.wall_date is not null and (now() >= day.closes_at or day.closed_at is not null) then
    return 0;
  end if;
  select coalesce(sum(units), 0) into spent
    from wall_boosts
   where booster_id = uid
     and wall_date = wall_date_in
     and (cast_at at time zone 'America/New_York')::date = today_e
     and not answer;
  return greatest(0, allowance - spent);
end;
$$;

-- What this browser has on a date, as live, plus the story it answered with
-- on that date, or null. The page uses it to put the search away and to
-- mark the reader's own song. Its own story only: never anybody else's.
create or replace function wall_web_standing(wall_date_in date, voter_token_in text)
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
  answered  uuid;
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
       and (cast_at at time zone 'America/New_York')::date = today_e
       and not answer;
    select coalesce(jsonb_agg(story_id order by cast_at), '[]'::jsonb) into backed
      from wall_boosts
     where booster_id = booster
       and wall_date = wall_date_in;
    select story_id into answered
      from wall_boosts
     where booster_id = booster
       and wall_date = wall_date_in
       and answer;
  end if;
  return jsonb_build_object(
    'allowance', allowance,
    'left', greatest(0, allowance - spent),
    'backed', backed,
    'answered', answered
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The private record leaves out a hidden song
-- ---------------------------------------------------------------------------

-- Exactly the live wall_web_record, from 20260921010000_the_private_record.sql,
-- with one condition on the join: it reads past the read policy, being a
-- definer function, so it has to leave a hidden story out itself, or a song
-- a curator hid would still be listed to the browsers that buzzed it.
create or replace function wall_web_record(voter_token_in text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  booster uuid;
  buzzes  jsonb := '[]'::jsonb;
begin
  if length(coalesce(voter_token_in, '')) < 16 then
    return jsonb_build_object('buzzes', buzzes);
  end if;
  booster := wall_web_booster_id(voter_token_in);

  select coalesce(jsonb_agg(row order by ord desc), '[]'::jsonb)
    into buzzes
    from (
      select jsonb_build_object(
               'story_id', mine.story_id,
               'headline', s.headline,
               'wall_date', mine.wall_date::text,
               'sealed', (now() >= d.closes_at or d.closed_at is not null),
               'status', s.status::text,
               'outcome', (
                 select o.outcome
                   from wall_outcomes o
                  where o.story_id = mine.story_id
                  order by o.anniversary desc
                  limit 1
               )
             ) as row,
             mine.cast_at as ord
        from (
          select distinct on (b.story_id) b.story_id, b.wall_date, b.cast_at
            from wall_boosts b
           where b.booster_id = booster
           order by b.story_id, b.cast_at desc
        ) as mine
        join wall_stories s on s.id = mine.story_id and s.hidden_at is null
        join wall_days d on d.wall_date = mine.wall_date
       order by mine.cast_at desc
       limit 200
    ) as rows;

  return jsonb_build_object('buzzes', buzzes);
end;
$$;

-- ---------------------------------------------------------------------------
-- The answer
-- ---------------------------------------------------------------------------

-- One word back, the way a buzz answers:
--
--   kept      the answer counted, with the story and its support
--   answered  this browser has already answered today, with that story
--   already   this browser already buzzed that song, so it cannot also be
--             the answer: one story takes one buzz from one browser
--   hidden    a curator took that song off today's hive
--   not_yet   today's hive has not opened, which is only ever a moment
--   closed    today's hive has sealed, which is only ever a moment
--   no_song   Apple has no song by that number
--   busy      Apple could not be asked just now
--   bad_token the browser token is missing or malformed
--
-- Only the website's role may call it, with its browser token. The app has
-- an account and its own path, and does not answer yet.
create or replace function wall_answer_song(track_id_in bigint, voter_token_in text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  today_e   date := (now() at time zone 'America/New_York')::date;
  booster   uuid;
  day       wall_days%rowtype;
  prior     wall_boosts%rowtype;
  looked    text;
  song      wall_songs%rowtype;
  key       text;
  story     wall_stories%rowtype;
  boost     wall_boosts%rowtype;
  headline  text;
  said      text;
begin
  if auth.uid() is not null or length(coalesce(voter_token_in, '')) < 16 then
    return jsonb_build_object('result', 'bad_token');
  end if;
  if track_id_in is null or track_id_in < 1 then
    return jsonb_build_object('result', 'no_song');
  end if;
  booster := wall_web_booster_id(voter_token_in);

  -- Today, by the Eastern clock, and nothing else: the question asks about
  -- today, so an answer is never filed on yesterday's hive.
  select * into day from wall_days where wall_date = today_e;
  if day.wall_date is null or now() < day.live_at then
    return jsonb_build_object('result', 'not_yet');
  end if;
  if now() >= day.closes_at or day.closed_at is not null then
    return jsonb_build_object('result', 'closed');
  end if;

  -- Asked before Apple is, so a browser that has answered costs nothing.
  select * into prior from wall_boosts where booster_id = booster and wall_date = today_e and answer;
  if prior.id is not null then
    return jsonb_build_object('result', 'answered', 'story_id', prior.story_id)
      || wall_web_standing(today_e, voter_token_in);
  end if;

  looked := wall_song_lookup(track_id_in);
  if looked <> 'ok' then
    return jsonb_build_object('result', looked);
  end if;
  select * into song from wall_songs where track_id = track_id_in;

  -- The same lock the buzz functions take, so an answer and a buzz from one
  -- browser meet one after the other.
  perform pg_advisory_xact_lock(hashtext('wall_boost:' || booster::text));

  select * into prior from wall_boosts where booster_id = booster and wall_date = today_e and answer;
  if prior.id is not null then
    return jsonb_build_object('result', 'answered', 'story_id', prior.story_id)
      || wall_web_standing(today_e, voter_token_in);
  end if;

  -- One story per song per date, however Apple spelled the version picked.
  key := 'answer:' || song.song_key;
  select * into story from wall_stories where wall_date = today_e and url_key = key;
  if story.id is null then
    -- The release year in front, the way every dated row on the hive carries
    -- its year, so the website and the app both read its decade from it.
    headline := left(
      coalesce(extract(year from song.released)::integer::text || ': ', '')
        || '"' || song.title || '" by ' || song.artist,
      300);
    insert into wall_stories (wall_date, headline, url, url_key, outlet, tier, status, priority, subject_kind, subject_id)
      values (today_e, headline, song.store_url, key, 'Apple Music', 'seen_direct', 'pool', 0, 'answer', song.track_id::text)
      on conflict (wall_date, url_key) do nothing
      returning * into story;
    if story.id is null then
      select * into story from wall_stories where wall_date = today_e and url_key = key;
    else
      -- One source, the track's own page at Apple, marked as the thing
      -- itself and imported, so the checker leaves it alone and the tier is
      -- seen directly. The quotation is Apple's record of the track.
      insert into wall_sources (story_id, url, url_key, outlet, owner, headline, quotation, verified_at, is_primary_doc, imported)
        values (
          story.id, song.store_url, wall_url_key(song.store_url), 'Apple Music', 'Apple',
          left('"' || song.title || '" by ' || song.artist, 300),
          '"' || song.title || '" by ' || song.artist
            || coalesce(', from ' || song.album, '')
            || coalesce(', released ' || song.released::text, '')
            || '. Apple Music track ' || song.track_id::text || '.',
          now(), true, true)
        on conflict (story_id, url_key) do nothing;
    end if;
  end if;

  if story.hidden_at is not null then
    return jsonb_build_object('result', 'hidden');
  end if;
  if exists (select 1 from wall_boosts where booster_id = booster and story_id = story.id) then
    return jsonb_build_object('result', 'already', 'story_id', story.id, 'support', story.support)
      || wall_web_standing(today_e, voter_token_in);
  end if;

  perform set_config('wall.boost_auth', 'web_token', true);
  perform set_config('wall.boost_answer', 'answer', true);
  begin
    insert into wall_boosts (story_id, booster_id, wall_date, units, tier_at_cast, support_before)
      values (story.id, booster, today_e, 1, 'claimed', 0)
      returning * into boost;
  exception
    when unique_violation then
      said := 'answered';
    when others then
      if sqlerrm like '%not taking boosts%' then
        said := 'closed';
      else
        perform set_config('wall.boost_auth', '', true);
        perform set_config('wall.boost_answer', '', true);
        raise;
      end if;
  end;
  perform set_config('wall.boost_auth', '', true);
  perform set_config('wall.boost_answer', '', true);
  if said is not null then
    return jsonb_build_object('result', said) || wall_web_standing(today_e, voter_token_in);
  end if;

  select * into story from wall_stories where id = story.id;
  return jsonb_build_object('result', 'kept', 'story_id', story.id, 'support', story.support, 'boost_id', boost.id)
    || wall_web_standing(today_e, voter_token_in);
end;
$$;

revoke execute on function wall_answer_song(bigint, text) from public, authenticated;
grant execute on function wall_answer_song(bigint, text) to anon, service_role;

-- ---------------------------------------------------------------------------
-- The hide
-- ---------------------------------------------------------------------------

-- A curator takes one song off a hive that has not sealed: off the board,
-- off the list above it, off every reader. Songs only, because a song is the
-- one thing on the hive a reader put there. The story leaves the board at
-- once rather than at the next tick, so the hole is closed by the worker's
-- next cut and never drawn.
create or replace function wall_hide_song(story_id_in uuid, note_in text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  story wall_stories%rowtype;
  day   wall_days%rowtype;
begin
  if not is_admin() then
    raise exception 'wall: only a curator can hide a song';
  end if;
  if length(btrim(coalesce(note_in, ''))) = 0 then
    raise exception 'wall: say why, in a few words';
  end if;
  select * into story from wall_stories where id = story_id_in for update;
  if story.id is null or story.subject_kind is distinct from 'answer' then
    return jsonb_build_object('result', 'no_song');
  end if;
  if story.hidden_at is not null then
    return jsonb_build_object('result', 'hidden');
  end if;
  select * into day from wall_days where wall_date = story.wall_date;
  if now() >= day.closes_at or day.closed_at is not null then
    return jsonb_build_object('result', 'closed');
  end if;
  update wall_stories
     set hidden_at = now(),
         hidden_note = left(btrim(note_in), 300),
         status = case when status = 'placed' then 'overflow'::wall_story_status else status end,
         anchor_mx = null, anchor_my = null, w_modules = null, h_modules = null
   where id = story.id;
  return jsonb_build_object('result', 'hidden');
end;
$$;

revoke execute on function wall_hide_song(uuid, text) from public, anon;
grant execute on function wall_hide_song(uuid, text) to authenticated, service_role;

-- The open dates' songs for the curation panel, hidden ones included, with
-- how many heads each is in. A curator only; everybody else is refused.
create or replace function wall_songs_for_curator()
returns table (story_id uuid, wall_date date, headline text, support integer, heads integer, explicit boolean, hidden_at timestamptz, hidden_note text, closes_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'wall: only a curator can read this';
  end if;
  return query
    select s.id, s.wall_date, s.headline, s.support,
           (select count(*)::integer from wall_boosts b where b.story_id = s.id and b.answer),
           coalesce(g.explicit, false), s.hidden_at, s.hidden_note, d.closes_at
      from wall_stories s
      join wall_days d on d.wall_date = s.wall_date
      left join wall_songs g on g.track_id::text = s.subject_id
     where s.subject_kind = 'answer'
       and d.closes_at > now()
       and d.closed_at is null
     order by s.wall_date desc, s.support desc, s.submitted_at asc;
end;
$$;

revoke execute on function wall_songs_for_curator() from public, anon;
grant execute on function wall_songs_for_curator() to authenticated, service_role;
