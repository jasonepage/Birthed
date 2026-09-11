-- The four questions the hive is judged on, answered in the database.
--
-- docs/measuring.md is the authority for what each number means and for the
-- sentence saying what would make it lie. This file is only the plumbing.
--
-- The one question behind all four: of the people who buzz once, how many buzz
-- again on a different day. Nothing new is stored to answer it. Every number
-- below is a count of rows that already exist, computed here rather than
-- shipped to a browser, and the browser is shown totals and never a row.
--
-- security definer for one reason. 20260909120000_the_wall_writes.sql revoked
-- select on wall_boosts and granted back every column except booster_id,
-- precisely so that no client could see that one account backed two stories.
-- That grant is right and stays. A function that has to count distinct
-- boosters therefore cannot run as its caller. It runs as its owner and checks
-- is_admin() itself, on the first line, before it reads anything.
--
-- The check is the same one every curation policy uses: an address on
-- admin_emails, confirmed, not anonymous. There is no second way in and no
-- widening of the existing one.

create or replace function wall_numbers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  boosters   jsonb;
  came_back  jsonb;
  gaps       jsonb;
  hives      jsonb;
begin
  -- First line, before a single row is read. A caller with no session gets
  -- this too, because auth.uid() is null for them and is_admin() says false.
  if not is_admin() then
    raise exception 'wall_numbers: not a curator'
      using errcode = '42501';
  end if;

  -- 1. How many boosters buzzed at all, and what they came from. A booster is
  -- a browser token or an install, never a person: docs/measuring.md says why
  -- and that sentence belongs on the page beside the number.
  select jsonb_build_object(
    'boosters_all',   count(distinct booster_id),
    'browser_tokens', count(distinct booster_id) filter (where authenticated_by = 'web_token'),
    'app_installs',   count(distinct booster_id) filter (where authenticated_by = 'attested'),
    'seeded',         count(distinct booster_id) filter (where authenticated_by = 'seed_tool'),
    'boost_rows',     count(*)
  )
  into boosters
  from wall_boosts;

  -- 2. How many buzzed on two or more different days. The day is the calendar
  -- day in United States Eastern time, the same clock wall_eastern_midnight
  -- uses to decide when a date opens and seals, because one site cannot have
  -- two definitions of a day and keep a permanent archive.
  with cast_days as (
    select booster_id,
           (cast_at at time zone 'America/New_York')::date as cast_day
    from wall_boosts
    group by 1, 2
  ),
  per_booster as (
    select booster_id, count(*) as days_buzzed
    from cast_days
    group by 1
  )
  select jsonb_build_object(
    'boosters_with_any_buzz',   count(*),
    'came_back_on_another_day', count(*) filter (where days_buzzed >= 2),
    'most_days_by_one_booster', coalesce(max(days_buzzed), 0)
  )
  into came_back
  from per_booster;

  -- 3. The days between a first buzz and a second. Only the first gap, on
  -- purpose: a booster who came on four days is counted the same as one who
  -- came on two, and the question here is whether anybody comes back at all.
  with cast_days as (
    select booster_id,
           (cast_at at time zone 'America/New_York')::date as cast_day
    from wall_boosts
    group by 1, 2
  ),
  ranked as (
    select booster_id, cast_day,
           row_number() over (partition by booster_id order by cast_day) as nth
    from cast_days
  ),
  first_gap as (
    select f.booster_id, (s.cast_day - f.cast_day) as days_between
    from ranked f
    join ranked s on s.booster_id = f.booster_id and f.nth = 1 and s.nth = 2
  )
  select jsonb_build_object(
    'boosters_with_a_second_day', count(*),
    'shortest_days',              min(days_between),
    'longest_days',               max(days_between),
    'mean_days',                  round(avg(days_between), 1),
    'every_gap',                  coalesce(jsonb_agg(days_between order by days_between), '[]'::jsonb)
  )
  into gaps
  from first_gap;

  -- 4. How many stories on each hive had a buzz. One story counts once however
  -- many buzzes it holds, because the question is how much of the board anybody
  -- touched and not how big the pile on the favourite got.
  select coalesce(jsonb_agg(row order by row->>'wall_date'), '[]'::jsonb)
  into hives
  from (
    select jsonb_build_object(
      'wall_date',           s.wall_date,
      'stories',             count(*),
      'stories_with_a_buzz', count(*) filter (where b.story_id is not null),
      'buzz_rows',           coalesce(sum(b.boost_rows), 0)
    ) as row
    from wall_stories s
    left join (
      select story_id, count(*) as boost_rows
      from wall_boosts
      group by story_id
    ) b on b.story_id = s.id
    group by s.wall_date
  ) per_hive;

  return jsonb_build_object(
    'as_of',     now(),
    'boosters',  boosters,
    'came_back', came_back,
    'gaps',      gaps,
    'hives',     hives
  );
end;
$$;

comment on function wall_numbers() is
  'The four numbers in docs/measuring.md, counted from rows that already exist. Curators only. Reads booster_id, which no client may read, which is why it is security definer.';

-- Anonymous callers are not offered it at all. A security definer function
-- reachable by anybody on the internet is a thing to justify rather than leave
-- lying around, which is the reasoning 20260907220000_admins_tighten.sql gives
-- for the same revoke on is_admin().
revoke all on function wall_numbers() from public, anon;
grant execute on function wall_numbers() to authenticated;
