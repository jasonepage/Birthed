-- A monthly ceiling alone did not stop what actually happened. On September 6
-- one backfill spent the entire month between 01:22 and 02:32: 319 dates, 10
-- searches each, 3182 searches, about $40. The ceiling worked, it stopped the
-- run at the limit. The limit was just set as a count by somebody who had not
-- worked out that 3000 searches is $40, and it was spendable in 70 minutes.
--
-- What was missing is a limit on the rate, so there is a daily one now.
--
-- Both ceilings are folded into fact_searches_left() rather than checked at
-- the call sites, so find-facts gets the daily cap without being redeployed
-- and neither function can be the one that forgets to look.

alter table fact_search_budget
  add column if not exists daily_limit integer not null default 400;

create or replace function public.fact_searches_left()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  with b as (
    select monthly_limit, daily_limit from fact_search_budget where only_row
  ), spent as (
    select
      coalesce((select sum(searches)::integer from birth_fact_runs
                where finished_at >= date_trunc('month', now())), 0)
      + coalesce((select sum(searches)::integer from culture_search_runs
                  where finished_at >= date_trunc('month', now())), 0) as this_month,
      coalesce((select sum(searches)::integer from birth_fact_runs
                where finished_at >= date_trunc('day', now())), 0)
      + coalesce((select sum(searches)::integer from culture_search_runs
                  where finished_at >= date_trunc('day', now())), 0) as today
  )
  select greatest(0, least(
    b.monthly_limit - spent.this_month,
    b.daily_limit - spent.today
  ))
  from b, spent;
$function$;
