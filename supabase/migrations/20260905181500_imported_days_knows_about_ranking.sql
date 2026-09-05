-- A date can have plenty of people and still be wrong.
--
-- The first version of this function answered "how many people does this date
-- have", and --only-missing skipped anything with ten or more. But the dates
-- imported before pageviews existed have their full ten and are ranked on
-- sitelink count, which is the coverage-not-attention bug that made the day
-- page read like a UEFA roster. They were being protected from ever being
-- fixed by the very flag meant to finish the job.
--
-- So the answer now includes how many of those rows were actually ranked, and
-- the worker treats a date with no ranked rows as unfinished.
--
-- The return type changes, so this drops rather than replaces.

drop function if exists imported_days();

create function imported_days()
returns table (birth_month smallint, birth_day smallint, people integer, scored integer)
language sql
security invoker
stable
set search_path = public, pg_temp
as $$
  select
    birth_month,
    birth_day,
    count(*)::int as people,
    count(*) filter (where monthly_views > 0)::int as scored
  from public.notable_people
  group by birth_month, birth_day;
$$;

comment on function imported_days() is
  'Per date: how many people, and how many of them have pageview data. A date with people but nothing scored was imported before ranking worked.';

grant execute on function imported_days() to anon, authenticated;
