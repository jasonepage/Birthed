-- The live project's wall tables and functions as they stood on October 3,
-- 2026, for testing the song migration in memory on PGlite. The functions
-- were read from the project with pg_get_functiondef and are copied as they
-- were. The tables carry the columns, checks and triggers those functions
-- touch, not every index and grant on the live project.
--
-- Stand-ins, not copies: the three roles; auth.uid(), read from the setting
-- test.uid; is_admin(), read from the setting test.admin; wall_outcomes and
-- wall_attest_grants, which are only as wide as the functions here need;
-- and the pgsql-http extension, which answers from the table
-- extensions.fake_apple, records every address asked in extensions.calls,
-- and times out on track 999999. Nothing in this file has asked Apple.

create role anon;
create role authenticated;
create role service_role;
create schema extensions;
create schema auth;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

-- pgsql-http, faked
create type extensions.http_header as (field varchar, value varchar);
create type extensions.http_response as (status integer, content_type varchar, headers extensions.http_header[], content varchar);
create type extensions.http_request as (method varchar, uri varchar, headers extensions.http_header[], content_type varchar, content varchar);
create function extensions.http_header(field varchar, value varchar) returns extensions.http_header language sql as $$ select row(field, value)::extensions.http_header $$;
create table extensions.fake_apple (uri text primary key, status int not null, body text not null);
create table extensions.calls (uri text, at timestamptz default clock_timestamp());
create function extensions.http(req extensions.http_request) returns extensions.http_response language plpgsql as $$
declare f extensions.fake_apple%rowtype;
begin
  insert into extensions.calls(uri) values (req.uri);
  if req.uri like '%id=999999%' then raise exception 'Operation timed out after 2500 milliseconds'; end if;
  select * into f from extensions.fake_apple where uri = req.uri;
  if f.uri is null then
    return row(200, 'application/json', null, '{"resultCount":0,"results":[]}')::extensions.http_response;
  end if;
  return row(f.status, 'application/json', null, f.body)::extensions.http_response;
end $$;
create function extensions.http_set_curlopt(a varchar, b varchar) returns boolean language sql as $$ select true $$;
create function extensions.http_reset_curlopt() returns boolean language sql as $$ select true $$;
grant usage on schema extensions to anon, authenticated, service_role;

create type wall_story_status as enum ('pool', 'placed', 'overflow', 'false');
create type wall_evidence_tier as enum ('claimed', 'reported', 'seen_direct');

create table wall_days (
  wall_date date primary key,
  opens_at timestamptz not null,
  live_at timestamptz not null,
  closes_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table wall_stories (
  id uuid primary key default gen_random_uuid(),
  wall_date date not null references wall_days (wall_date),
  submitted_by uuid,
  submitted_at timestamptz not null default now(),
  headline text not null check (length(headline) >= 1 and length(headline) <= 300),
  url text not null,
  url_key text not null,
  outlet text not null,
  status wall_story_status not null default 'pool',
  tier wall_evidence_tier not null default 'claimed',
  support integer not null default 0 check (support >= 0),
  placed_at timestamptz,
  anchor_mx smallint check (anchor_mx >= 0 and anchor_mx <= 15),
  anchor_my smallint check (anchor_my >= 0 and anchor_my <= 15),
  w_modules smallint check (w_modules >= 1 and w_modules <= 16),
  h_modules smallint check (h_modules >= 1 and h_modules <= 16),
  false_at timestamptz,
  false_note text,
  subject_kind text,
  subject_id text,
  priority smallint not null default 0 check (priority >= 0 and priority <= 9),
  interest smallint check (interest >= 1 and interest <= 10),
  interest_note text,
  rated_at timestamptz,
  rated_by text,
  constraint wall_stories_one_page_per_date unique (wall_date, url_key),
  constraint wall_stories_false_is_stamped check ((status = 'false') = (false_at is not null)),
  constraint wall_stories_placed_has_rectangle check ((status <> 'placed') or (anchor_mx is not null)),
  constraint wall_stories_subject_kind_check check (subject_kind = any (array['historical_event', 'birth_fact', 'cultural_event', 'person', 'song', 'album', 'film'])),
  constraint wall_stories_subject_whole check ((subject_kind is null) = (subject_id is null))
);

create table wall_sources (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references wall_stories (id),
  url text not null,
  url_key text not null,
  outlet text not null,
  owner text not null,
  headline text not null check (length(headline) >= 1 and length(headline) <= 300),
  quotation text not null check (length(quotation) >= 20),
  verified_at timestamptz,
  added_by uuid,
  added_at timestamptz not null default now(),
  is_primary_doc boolean not null default false,
  imported boolean not null default false,
  constraint wall_sources_one_page_per_story unique (story_id, url_key)
);

create table wall_boosts (
  id bigserial primary key,
  story_id uuid not null references wall_stories (id),
  booster_id uuid not null,
  wall_date date not null,
  units smallint not null check (units >= 1 and units <= 3),
  cast_at timestamptz not null default now(),
  tier_at_cast wall_evidence_tier not null,
  support_before integer not null check (support_before >= 0),
  authenticated_by text not null check (authenticated_by = any (array['attested', 'web_token', 'seed_tool']))
);

create table wall_boost_requests (
  request_id uuid primary key,
  booster_id uuid not null,
  boost_id bigint not null references wall_boosts (id),
  created_at timestamptz not null default now()
);

create table wall_outcomes (id bigserial primary key, story_id uuid references wall_stories (id), anniversary int, outcome text, note text, recorded_at timestamptz default now());

create table wall_attest_grants (id bigserial primary key, profile_id uuid, granted_at timestamptz default now(), expires_at timestamptz, consumed_at timestamptz);

alter table wall_days enable row level security;
alter table wall_stories enable row level security;
alter table wall_sources enable row level security;
alter table wall_boosts enable row level security;
create policy wall_days_public_read on wall_days for select using (true);
create policy wall_stories_public_read on wall_stories for select using (true);
create policy wall_sources_public_read on wall_sources for select using (true);
create policy wall_boosts_public_read on wall_boosts for select using (true);
grant select on wall_days, wall_stories, wall_sources to anon, authenticated;
grant select (id, story_id, wall_date, units, cast_at, tier_at_cast, support_before) on wall_boosts to anon, authenticated;

create function is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin', true) = 'yes', false) $$;

create or replace function public.wall_boost_budget(cast_on date, wall_date_in date)
 returns integer language sql immutable set search_path to 'public', 'pg_temp'
as $function$
  select case
    when cast_on = wall_date_in then 3
    when cast_on = wall_date_in + 1 then 1
    else 0
  end;
$function$;

create or replace function public.wall_web_booster_id(token_in text)
 returns uuid language sql immutable set search_path to 'public', 'pg_temp'
as $function$
  select md5('birthed-wall-web-v1:' || token_in)::uuid;
$function$;

create or replace function public.wall_undo_seconds()
 returns integer language sql immutable set search_path to 'public', 'pg_temp'
as $function$ select 30 $function$;

create or replace function public.wall_form_decode(value_in text)
 returns text language plpgsql immutable set search_path to 'public', 'pg_temp'
as $function$
declare
  s       text := replace(value_in, '+', ' ');
  out     bytea := '\x'::bytea;
  i       integer := 1;
  n       integer := length(s);
  c       text;
  hex     text;
begin
  while i <= n loop
    c := substr(s, i, 1);
    if c = '%' and i + 2 <= n and substr(s, i + 1, 2) ~ '^[0-9A-Fa-f]{2}$' then
      hex := substr(s, i + 1, 2);
      out := out || decode(hex, 'hex');
      i := i + 3;
    else
      out := out || convert_to(c, 'UTF8');
      i := i + 1;
    end if;
  end loop;
  return convert_from(out, 'UTF8');
end;
$function$;

create or replace function public.wall_form_encode(value_in text)
 returns text language plpgsql immutable set search_path to 'public', 'pg_temp'
as $function$
declare
  raw     bytea;
  out     text := '';
  i       integer;
  b       integer;
begin
  raw := convert_to(value_in, 'UTF8');
  for i in 0 .. length(raw) - 1 loop
    b := get_byte(raw, i);
    if (b between 48 and 57) or (b between 65 and 90) or (b between 97 and 122)
       or b in (42, 45, 46, 95) then
      out := out || chr(b);
    elsif b = 32 then
      out := out || '+';
    else
      out := out || '%' || upper(lpad(to_hex(b), 2, '0'));
    end if;
  end loop;
  return out;
end;
$function$;

create or replace function public.wall_url_key(url_in text)
 returns text language plpgsql immutable set search_path to 'public', 'pg_temp'
as $function$
declare
  raw      text := btrim(url_in);
  m        text[];
  host     text;
  port     text;
  path     text;
  query    text;
  pair     text;
  name     text;
  value    text;
  key      text;
  kept     text[] := '{}';
  pairs    text[];
  parts    text[];
  i        integer;
  tracking text[] := array['fbclid', 'gclid', 'msclkid', 'igshid', 'mc_cid', 'mc_eid',
                           'ref', 'ref_src', 'cmpid', 'si', 'spm'];
begin
  m := regexp_match(raw, '^([A-Za-z][A-Za-z0-9+.-]*)://([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$');
  if m is null or lower(m[1]) not in ('http', 'https') then
    raise exception 'wall: not a web address: %', url_in;
  end if;
  host := lower(m[2]);
  if position('@' in host) > 0 then host := split_part(host, '@', 2); end if;
  port := '';
  if host ~ ':\d+$' then
    port := substring(host from ':(\d+)$');
    host := regexp_replace(host, ':\d+$', '');
    if port in ('80', '443') then port := ''; else port := ':' || port; end if;
  end if;
  if host like 'www.%' then host := substr(host, 5); end if;
  path := coalesce(m[3], '');
  if length(path) > 1 and path like '%/' then path := left(path, length(path) - 1); end if;
  if path = '/' then path := ''; end if;
  query := coalesce(substr(m[4], 2), '');
  if query <> '' then
    pairs := string_to_array(query, '&');
    for i in 1 .. array_length(pairs, 1) loop
      pair := pairs[i];
      if pair = '' then continue; end if;
      if position('=' in pair) > 0 then
        name := wall_form_decode(split_part(pair, '=', 1));
        value := wall_form_decode(substr(pair, position('=' in pair) + 1));
      else
        name := wall_form_decode(pair);
        value := '';
      end if;
      key := lower(name);
      if key like 'utm\_%' then continue; end if;
      if key = any (tracking) then continue; end if;
      if key = 's' and host in ('x.com', 'twitter.com') then continue; end if;
      kept := kept || (wall_form_encode(name) || '=' || wall_form_encode(value));
    end loop;
  end if;
  select coalesce(string_agg(k, '&' order by split_part(k, '=', 1) collate "C", substr(k, position('=' in k) + 1) collate "C"), '')
    into query
    from unnest(kept) as k;
  return 'https://' || host || port || path || case when query <> '' then '?' || query else '' end;
end;
$function$;

create or replace function public.wall_boosts_after_insert()
 returns trigger language plpgsql set search_path to 'public', 'pg_temp'
as $function$
begin
  update wall_stories set support = support + new.units where id = new.story_id;
  return new;
end;
$function$;

create or replace function public.wall_boosts_after_delete()
 returns trigger language plpgsql set search_path to 'public', 'pg_temp'
as $function$
begin
  update wall_stories set support = greatest(0, support - old.units) where id = old.story_id;
  return old;
end;
$function$;

create or replace function public.wall_boosts_refuse_change()
 returns trigger language plpgsql set search_path to 'public', 'pg_temp'
as $function$
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
$function$;

-- The live trigger before this change.
create or replace function public.wall_boosts_before_insert()
 returns trigger language plpgsql set search_path to 'public', 'pg_temp'
as $function$
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
$function$;

create trigger wall_boosts_snapshot before insert on wall_boosts for each row execute function wall_boosts_before_insert();
create trigger wall_boosts_add_support after insert on wall_boosts for each row execute function wall_boosts_after_insert();
create trigger wall_boosts_immutable before update or delete on wall_boosts for each row execute function wall_boosts_refuse_change();
create trigger wall_boosts_take_support_back after delete on wall_boosts for each row execute function wall_boosts_after_delete();

create or replace function public.wall_require_attestation(profile_in uuid)
 returns void language plpgsql set search_path to 'public', 'pg_temp'
as $function$
declare
  grant_id bigint;
begin
  select id into grant_id
    from wall_attest_grants
   where profile_id = profile_in and consumed_at is null and expires_at > now()
   order by granted_at desc
   limit 1
   for update skip locked;
  if grant_id is null then
    raise exception 'wall: this device has not been checked. Writes go through the app.'
      using errcode = 'P0001';
  end if;
  update wall_attest_grants set consumed_at = now() where id = grant_id;
end;
$function$;

create or replace function public.wall_forget_boost(story_id_in uuid, voter_token_in text default null::text)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare
  uid       uuid := auth.uid();
  booster   uuid;
  story     wall_stories%rowtype;
  day       wall_days%rowtype;
  doomed    bigint;
  gone      boolean := false;
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
    return jsonb_build_object('result', 'closed', 'support', story.support);
  end if;
  perform pg_advisory_xact_lock(hashtext('wall_boost:' || booster::text));
  select id into doomed
    from wall_boosts
   where story_id = story.id
     and booster_id = booster
     and cast_at > now() - make_interval(secs => wall_undo_seconds())
   order by cast_at desc
   limit 1
   for update;
  if doomed is not null then
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
    return jsonb_build_object('result', 'too_late', 'support', story.support);
  end if;
  return jsonb_build_object('result', 'undone', 'support', story.support);
end;
$function$;
