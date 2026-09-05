-- Which dates already have people, so a backfill that dies at July can pick up
-- at July instead of starting again at January.
--
-- One request instead of 366 counting requests. Security invoker, so it obeys
-- the read policy on notable_people rather than going around it.

create function imported_days()
returns table (birth_month smallint, birth_day smallint, people integer)
language sql
security invoker
stable
set search_path = public, pg_temp
as $$
  select birth_month, birth_day, count(*)::int as people
  from public.notable_people
  group by birth_month, birth_day;
$$;

grant execute on function imported_days() to anon, authenticated;
