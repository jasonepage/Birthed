-- Twice now a date has looked finished and been wrong, and both times
-- --only-missing was the thing protecting it.
--
-- First it was dates with people but no pageviews at all. Now it is dates
-- whose pageviews were fetched by a version of the worker that matched
-- Wikipedia's answers to the wrong key: article URLs use underscores, the
-- batch interface answers with spaces, and every title with a space in it came
-- back as zero. Those dates have scored rows, so they passed the last check,
-- and every one of their scored rows is somebody whose article title happens
-- to be a single word.
--
-- So that is the signal, and it is exact rather than a guess at a threshold:
-- a date where nobody with an underscore in their article title has any
-- pageviews had its lookup fail. On a date that imported correctly, some of
-- the ten most looked up people have a space in their name.

drop function if exists imported_days();

create function imported_days()
returns table (
  birth_month smallint,
  birth_day smallint,
  people integer,
  scored integer,
  scored_multiword integer
)
language sql
security invoker
stable
set search_path = public, pg_temp
as $$
  select
    birth_month,
    birth_day,
    count(*)::int as people,
    count(*) filter (where monthly_views > 0)::int as scored,
    count(*) filter (where monthly_views > 0 and enwiki_title like '%\_%')::int as scored_multiword
  from public.notable_people
  group by birth_month, birth_day;
$$;

comment on function imported_days() is
  'Per date: people, how many carry pageviews, and how many of those have a multi-word article title. The last one is zero when the pageview lookup silently failed.';

grant execute on function imported_days() to anon, authenticated;
