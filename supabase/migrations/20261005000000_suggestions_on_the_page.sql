-- Suggestions on the page. docs/the-wall.md section 32, built October 5, 2026.
--
-- Today's date page lets a reader put something on the hive without the
-- app: search, pick a real thing that has a Wikipedia article (a person, an
-- event, a storm, a prize), and it becomes a tile on today's hive. Never
-- typed text. The database reads the article from Wikipedia itself, the way
-- wall_song_lookup reads a song from Apple, so a hand made post cannot put
-- words of its own on a hive that is kept forever. This file is everything
-- the database needs for it:
--
--   wall_boosts.suggested          a suggestion is a buzz row, marked, and free
--   wall_boosts_one_suggestion_a_day  one suggestion per browser per date
--   wall_topics                    articles as Wikipedia described them
--   wall_topic_lookup              the database asks Wikipedia
--   wall_suggest_topic             the website's one write for a suggestion,
--                                  which points at the tile already there
--                                  rather than making a second one
--   wall_hide_song                 the curator's hide, now for suggestions too
--   wall_suggestions_for_curator   the open dates' suggestions, for the panel
--
-- and the four functions that count a browser's buzzes, each exactly as the
-- song migration left them on the live project, with one change: a
-- suggestion row is not one of the day's three, the same as an answer row.
--
-- **Apply after 20261003000000_the_song_in_your_head.sql**, which this file
-- builds on and which was applied on October 4, 2026. The two older files
-- that rewrite the same four functions and are not applied,
-- 20260911020000_the_anniversary.sql and 20260923010000_buzzes_that_refill.sql,
-- were edited on October 5, 2026 to carry this change too, and now read
-- wall_boosts.suggested, so either of them goes after this file and fails if
-- applied before it.
--
-- **Not yet run on the live project.** Tested in memory on PGlite, on top of
-- the live wall functions copied on October 3, 2026 and the song migration,
-- with Wikipedia as a table of canned answers:
-- worker/test/suggest-migration.test.ts. The two requests wall_topic_lookup
-- makes were checked against Wikipedia from the live project on October 5,
-- 2026 with read only queries, and the canned answers are copied from what
-- came back.

-- ---------------------------------------------------------------------------
-- A suggestion is a buzz, marked, and free
-- ---------------------------------------------------------------------------

-- Each suggestion is a free buzz on what it suggests, Jason's call on
-- October 5, 2026, the same bargain as a song answer: it starts with one, so
-- it can reach the board as soon as it is made. Filled by the trigger from a
-- transaction local flag only wall_suggest_topic sets, never by a caller.
alter table wall_boosts add column suggested boolean not null default false;

comment on column wall_boosts.suggested is
  'True for the buzz a suggestion gives what it suggests: free, outside the day''s three, one per browser per date. Filled by the trigger from a flag only wall_suggest_topic sets. docs/the-wall.md section 32.';

-- A row is a buzz, an answer or a suggestion, never two of them.
alter table wall_boosts add constraint wall_boosts_answer_or_suggestion check (not (answer and suggested));

grant select (suggested) on wall_boosts to anon, authenticated;

-- One suggestion a day. The trigger refuses a suggestion on any date but its
-- own, so one per browser per wall date is one per browser per day.
create unique index wall_boosts_one_suggestion_a_day on wall_boosts (booster_id, wall_date) where suggested;

-- ---------------------------------------------------------------------------
-- The articles, as Wikipedia described them
-- ---------------------------------------------------------------------------

-- One row per English Wikipedia article anybody has suggested, read by
-- wall_topic_lookup and never written by a caller. The words on a
-- suggestion's tile come from here.
create table wall_topics (
  page_id        bigint primary key check (page_id > 0),
  title          text not null check (length(title) between 1 and 300),
  description    text check (description is null or length(description) between 1 and 300),
  first_sentence text check (first_sentence is null or length(first_sentence) between 1 and 1000),
  page_url       text not null check (page_url ~ '^https://en\.wikipedia\.org/wiki/'),
  wikibase_item  text check (wikibase_item is null or wikibase_item ~ '^Q[0-9]{1,12}$'),
  looked_up_at   timestamptz not null default now()
);

comment on table wall_topics is
  'English Wikipedia articles people suggested for today''s hive, as Wikipedia''s own interface described them. Written only by wall_topic_lookup. docs/the-wall.md section 32.';

alter table wall_topics enable row level security;
create policy wall_topics_public_read on wall_topics for select using (true);
grant select on wall_topics to anon, authenticated;

-- The article, read from Wikipedia once and kept. Answers
--   {"result": "ok", "page_id": n}  with the article in wall_topics, which
--                                   may be a different number from the one
--                                   asked when the number was a redirect
--   {"result": "no_topic"}          no article by that number, or one that
--                                   is a disambiguation page, a list, or
--                                   outside the article space
--   {"result": "busy"}              Wikipedia could not be asked: slow,
--                                   refusing, or saying something that is
--                                   not its answer
-- The timeout is under the three seconds a request from the website's role
-- is allowed, so a slow Wikipedia is a word and never a cancelled statement.
create or replace function wall_topic_lookup(page_id_in bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  response  extensions.http_response;
  body      jsonb;
  page      jsonb;
  resolved  bigint;
  title     text;
  said      text;
  opening   text;
  address   text;
  item      text;
begin
  if exists (select 1 from wall_topics where page_id = page_id_in) then
    return jsonb_build_object('result', 'ok', 'page_id', page_id_in);
  end if;

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '2500');
  begin
    response := extensions.http((
      'GET',
      'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&pageids=' || page_id_in::text
        || '&prop=info|pageprops|description|extracts&inprop=url&ppprop=wikibase_item|disambiguation'
        || '&exintro=1&explaintext=1&exsentences=1&redirects=1',
      array[extensions.http_header('User-Agent', 'Birthed/0.1 (https://birthed.app)')],
      null, null
    )::extensions.http_request);
  exception when others then
    perform extensions.http_reset_curlopt();
    return jsonb_build_object('result', 'busy');
  end;
  perform extensions.http_reset_curlopt();

  if response.status is distinct from 200 then
    return jsonb_build_object('result', 'busy');
  end if;
  begin
    body := response.content::jsonb;
  exception when others then
    return jsonb_build_object('result', 'busy');
  end;

  page := body -> 'query' -> 'pages' -> 0;
  if page is null or jsonb_typeof(page) <> 'object' then
    return jsonb_build_object('result', 'busy');
  end if;
  if coalesce((page ->> 'missing')::boolean, false) or coalesce((page ->> 'invalid')::boolean, false)
     or coalesce(page ->> 'ns', '') <> '0'
     or (page -> 'pageprops') ? 'disambiguation'
     or coalesce(page ->> 'pageid', '') !~ '^[0-9]{1,18}$' then
    return jsonb_build_object('result', 'no_topic');
  end if;
  resolved := (page ->> 'pageid')::bigint;

  -- Wikipedia's words, with any control character taken out, because they
  -- are drawn on a page and kept forever.
  title := btrim(regexp_replace(coalesce(page ->> 'title', ''), '[[:cntrl:]]', '', 'g'));
  if title = '' or length(title) > 300 or title ~* '^list of ' then
    return jsonb_build_object('result', 'no_topic');
  end if;
  said := nullif(left(btrim(regexp_replace(coalesce(page ->> 'description', ''), '[[:cntrl:]]', '', 'g')), 300), '');
  opening := nullif(left(btrim(regexp_replace(coalesce(page ->> 'extract', ''), '[[:cntrl:]]', ' ', 'g')), 1000), '');
  address := page ->> 'fullurl';
  if address is null or address !~ '^https://en\.wikipedia\.org/wiki/' then
    return jsonb_build_object('result', 'no_topic');
  end if;
  item := page -> 'pageprops' ->> 'wikibase_item';
  if item is not null and item !~ '^Q[0-9]{1,12}$' then
    item := null;
  end if;

  insert into wall_topics (page_id, title, description, first_sentence, page_url, wikibase_item)
  values (resolved, title, said, opening, address, item)
  on conflict (page_id) do nothing;
  return jsonb_build_object('result', 'ok', 'page_id', resolved);
end;
$$;

-- Only through wall_suggest_topic. A direct caller could otherwise make the
-- database ask Wikipedia for any number it liked, as fast as it liked.
revoke execute on function wall_topic_lookup(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A suggestion is a story of its own kind
-- ---------------------------------------------------------------------------

alter table wall_stories drop constraint if exists wall_stories_subject_kind_check;
alter table wall_stories add constraint wall_stories_subject_kind_check
  check (subject_kind = any (array['historical_event', 'birth_fact', 'cultural_event', 'person', 'song', 'album', 'film', 'answer', 'suggestion']));

-- ---------------------------------------------------------------------------
-- The trigger: the authority
-- ---------------------------------------------------------------------------

-- Exactly the trigger the song migration left, with the suggestion beside
-- the answer: one unit, only on its own date, outside the day's budget, and
-- marked. The budget is counted without either kind of free row.
create or replace function wall_boosts_before_insert()
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

  -- A boost lands only while the wall is open, and only from the live day on.
  -- The day before is submissions only.
  if new.cast_at < day.live_at or new.cast_at >= day.closes_at
     or (day.closed_at is not null and new.cast_at >= day.closed_at) then
    raise exception 'wall_boosts: the wall for % is not taking boosts at %', story.wall_date, new.cast_at;
  end if;

  cast_on := (new.cast_at at time zone 'America/New_York')::date;

  -- An answer and a suggestion are the flags' to say, never the row's.
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
  new.suggested        := is_suggested;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- The three that ask the budget first, each as the song migration left them
-- plus "and not suggested"
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
     and not answer
     and not suggested;
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
     and not answer
     and not suggested;
  return greatest(0, allowance - spent);
end;
$$;

-- What this browser has on a date, as the song migration left it, plus the
-- story it suggested on that date, or null. The page uses it to put the
-- suggestion box away and to mark the reader's own suggestion. Its own story
-- only: never anybody else's.
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
  suggestion uuid;
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
       and not answer
       and not suggested;
    select coalesce(jsonb_agg(story_id order by cast_at), '[]'::jsonb) into backed
      from wall_boosts
     where booster_id = booster
       and wall_date = wall_date_in;
    select story_id into answered
      from wall_boosts
     where booster_id = booster
       and wall_date = wall_date_in
       and answer;
    select story_id into suggestion
      from wall_boosts
     where booster_id = booster
       and wall_date = wall_date_in
       and suggested;
  end if;
  return jsonb_build_object(
    'allowance', allowance,
    'left', greatest(0, allowance - spent),
    'backed', backed,
    'answered', answered,
    'suggested', suggestion
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The suggestion
-- ---------------------------------------------------------------------------

-- One word back, the way a buzz answers:
--
--   kept      the suggestion counted, with its story and its support: a new
--             story, or one somebody suggested and took back, taken up again
--   exists    that thing is already on today's hive, with the story, so the
--             page can say "buzz it instead" rather than make a second tile
--   suggested this browser has already suggested something today, with it
--   hidden    a curator took that thing off today's hive
--   not_yet   today's hive has not opened, which is only ever a moment
--   closed    today's hive has sealed, which is only ever a moment
--   no_topic  no article by that number that can be a tile
--   busy      Wikipedia could not be asked just now
--   crowded   twenty new suggestions in the last minute, across everybody
--   full      three hundred suggestions today, across everybody
--   bad_token the browser token is missing or malformed
--
-- Only the website's role may call it, with its browser token. The app has
-- an account and its own path, and does not suggest from here.
create or replace function wall_suggest_topic(page_id_in bigint, voter_token_in text)
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
  looked    jsonb;
  topic     wall_topics%rowtype;
  subject   text;
  key       text;
  page_key  text;
  existing  wall_stories%rowtype;
  revived   boolean := false;
  lately    integer;
  filed     integer;
  story     wall_stories%rowtype;
  boost     wall_boosts%rowtype;
  headline  text;
  quote     text;
  said      text;
begin
  if auth.uid() is not null or length(coalesce(voter_token_in, '')) < 16 then
    return jsonb_build_object('result', 'bad_token');
  end if;
  if page_id_in is null or page_id_in < 1 then
    return jsonb_build_object('result', 'no_topic');
  end if;
  booster := wall_web_booster_id(voter_token_in);

  -- Today, by the Eastern clock, and nothing else.
  select * into day from wall_days where wall_date = today_e;
  if day.wall_date is null or now() < day.live_at then
    return jsonb_build_object('result', 'not_yet');
  end if;
  if now() >= day.closes_at or day.closed_at is not null then
    return jsonb_build_object('result', 'closed');
  end if;

  -- Asked before Wikipedia is, so a browser that has suggested costs nothing.
  select * into prior from wall_boosts where booster_id = booster and wall_date = today_e and suggested;
  if prior.id is not null then
    return jsonb_build_object('result', 'suggested', 'story_id', prior.story_id)
      || wall_web_standing(today_e, voter_token_in);
  end if;

  -- A ceiling, for the whole site, before Wikipedia is asked. This function
  -- is the anonymous role's to call, like every web write, so the website's
  -- per address limit is not the only thing between a script and a hive full
  -- of permanent tiles: a fresh token passes the one a day rule every time.
  -- At most twenty new suggestions a minute and three hundred a day, across
  -- everybody. Far above anything seen so far, and a number to raise rather
  -- than a rule to argue with if the box is ever that busy. Counted from the
  -- stories themselves, so nothing new is stored to keep it.
  select count(*) filter (where submitted_at > now() - interval '1 minute'), count(*)
    into lately, filed
    from wall_stories
   where wall_date = today_e and subject_kind = 'suggestion';
  if filed >= 300 then
    return jsonb_build_object('result', 'full');
  end if;
  if lately >= 20 then
    return jsonb_build_object('result', 'crowded');
  end if;

  looked := wall_topic_lookup(page_id_in);
  if looked ->> 'result' <> 'ok' then
    return jsonb_build_object('result', looked ->> 'result');
  end if;
  select * into topic from wall_topics where page_id = (looked ->> 'page_id')::bigint;

  -- What the thing is, for every rule below: its Wikidata item where it has
  -- one, which is how a person already on the date is found, else the
  -- article's own number.
  subject := coalesce(topic.wikibase_item, 'wp' || topic.page_id::text);
  key := 'subject:suggestion:' || subject;
  page_key := wall_url_key(topic.page_url);

  -- Already on today's hive, in any shape: suggested before, a person born
  -- on the date, an event whose line is about this article, or any story
  -- whose own address is this article. The page points at that tile and
  -- nothing new is made, so one thing is one tile however it arrived.
  select s.* into existing
    from wall_stories s
   where s.wall_date = today_e
     and (
       s.url_key = key
       or (topic.wikibase_item is not null and s.url_key = 'subject:person:' || topic.wikibase_item)
       or s.url_key = page_key
       or (s.subject_kind = 'historical_event' and exists (
             select 1 from historical_events e
              where e.id::text = s.subject_id
                and e.subject_url is not null
                and wall_url_key(e.subject_url) = page_key))
     )
     -- A suggestion taken back inside its thirty seconds stays filed with
     -- nobody behind it, off the list and off the board. It is not a tile
     -- anybody can see, so it is not what this points at; see below.
     and (s.subject_kind is distinct from 'suggestion' or s.support >= 1 or s.hidden_at is not null)
   order by (s.url_key = key) desc, s.support desc, s.submitted_at asc
   limit 1;
  if existing.id is not null then
    if existing.hidden_at is not null then
      return jsonb_build_object('result', 'hidden');
    end if;
    return jsonb_build_object('result', 'exists', 'story_id', existing.id, 'support', existing.support)
      || wall_web_standing(today_e, voter_token_in);
  end if;
  -- Telling the next reader a taken back suggestion already exists would
  -- send them to spend a buzz on a tile nobody can see, and taking a
  -- suggestion back would block the thing for the rest of the day. So the
  -- next browser to suggest it takes it up, with its own free buzz, below.
  select * into existing from wall_stories where wall_date = today_e and url_key = key;
  revived := existing.id is not null;

  -- The same lock the buzz functions take, so a suggestion and a buzz from
  -- one browser meet one after the other.
  perform pg_advisory_xact_lock(hashtext('wall_boost:' || booster::text));

  select * into prior from wall_boosts where booster_id = booster and wall_date = today_e and suggested;
  if prior.id is not null then
    return jsonb_build_object('result', 'suggested', 'story_id', prior.story_id)
      || wall_web_standing(today_e, voter_token_in);
  end if;

  if revived then
    -- Taken up again: one browser at a time per thing, and only while
    -- nobody else has taken it up first.
    perform pg_advisory_xact_lock(hashtext('wall_suggest:' || existing.id::text));
    select * into story from wall_stories where id = existing.id;
    if story.support >= 1 then
      return jsonb_build_object('result', 'exists', 'story_id', story.id, 'support', story.support)
        || wall_web_standing(today_e, voter_token_in);
    end if;
  else
    -- Wikipedia's title, and its short description where it has one.
    headline := left(topic.title || coalesce(': ' || topic.description, ''), 300);
    insert into wall_stories (wall_date, headline, url, url_key, outlet, tier, status, priority, subject_kind, subject_id)
      values (today_e, headline, topic.page_url, key, 'Wikipedia', 'claimed', 'pool', 0, 'suggestion', subject)
      on conflict (wall_date, url_key) do nothing
      returning * into story;
    if story.id is null then
      -- Somebody else suggested it in the same instant: it is theirs, and this
      -- browser is pointed at it like any other tile already there.
      select * into story from wall_stories where wall_date = today_e and url_key = key;
      return jsonb_build_object('result', 'exists', 'story_id', story.id, 'support', story.support)
        || wall_web_standing(today_e, voter_token_in);
    end if;

    -- One source, the article itself, imported, so the checker leaves it
    -- alone. The quotation is the article's first sentence, or its title and
    -- description where the first sentence is too short to quote.
    quote := case
      when length(coalesce(topic.first_sentence, '')) >= 20 then topic.first_sentence
      else 'Wikipedia article: ' || topic.title || coalesce(', ' || topic.description, '')
    end;
    insert into wall_sources (story_id, url, url_key, outlet, owner, headline, quotation, verified_at, is_primary_doc, imported)
      values (story.id, topic.page_url, page_key, 'Wikipedia', 'Wikipedia', left(topic.title, 300), left(quote, 1000), now(), false, true)
      on conflict (story_id, url_key) do nothing;
  end if;

  perform set_config('wall.boost_auth', 'web_token', true);
  perform set_config('wall.boost_suggest', 'suggest', true);
  begin
    insert into wall_boosts (story_id, booster_id, wall_date, units, tier_at_cast, support_before)
      values (story.id, booster, today_e, 1, 'claimed', 0)
      returning * into boost;
  exception
    when unique_violation then
      said := 'suggested';
    when others then
      if sqlerrm like '%not taking boosts%' then
        said := 'closed';
      else
        perform set_config('wall.boost_auth', '', true);
        perform set_config('wall.boost_suggest', '', true);
        raise;
      end if;
  end;
  perform set_config('wall.boost_auth', '', true);
  perform set_config('wall.boost_suggest', '', true);
  if said is not null then
    return jsonb_build_object('result', said) || wall_web_standing(today_e, voter_token_in);
  end if;

  select * into story from wall_stories where id = story.id;
  return jsonb_build_object('result', 'kept', 'story_id', story.id, 'support', story.support, 'boost_id', boost.id)
    || wall_web_standing(today_e, voter_token_in);
end;
$$;

revoke execute on function wall_suggest_topic(bigint, text) from public, authenticated;
grant execute on function wall_suggest_topic(bigint, text) to anon, service_role;

-- ---------------------------------------------------------------------------
-- The hide, for suggestions too
-- ---------------------------------------------------------------------------

-- The song migration's hide, unchanged but for the kinds it takes: a song
-- and a suggestion are the two things on the hive a reader put there.
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
  if story.id is null or story.subject_kind is null or story.subject_kind not in ('answer', 'suggestion') then
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

-- The open dates' suggestions for the curation panel, hidden ones included,
-- with how many buzzes each has. A curator only; everybody else is refused.
create or replace function wall_suggestions_for_curator()
returns table (story_id uuid, wall_date date, headline text, url text, support integer, hidden_at timestamptz, hidden_note text, closes_at timestamptz)
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
    select s.id, s.wall_date, s.headline, s.url, s.support, s.hidden_at, s.hidden_note, d.closes_at
      from wall_stories s
      join wall_days d on d.wall_date = s.wall_date
     where s.subject_kind = 'suggestion'
       and d.closes_at > now()
       and d.closed_at is null
     order by s.wall_date desc, s.support desc, s.submitted_at asc;
end;
$$;

revoke execute on function wall_suggestions_for_curator() from public, anon;
grant execute on function wall_suggestions_for_curator() to authenticated, service_role;
