-- The ledger for "Find it for me", docs/the-wall.md section 15 built out.
--
-- When the typed field on the hive misses, the reader may tap a button that
-- sends the words they typed and the date to the hive-find Edge Function,
-- which searches the web for a source. Every search costs money at Google,
-- and find-culture learned the hard way that a function reading the meter
-- and never writing it is invisible to the ceiling it obeys. So every run is
-- a row here, whether it worked or not, and fact_searches_left() sums this
-- ledger with the other two against the one bill.
--
-- What a row is not: it carries no words. The phrase the reader typed is
-- never written anywhere, by this table, by the function, or by a log line.
-- A row says that an account ran a search for a date, how many searches
-- Google reported, and whether it worked. That is what a per account daily
-- cap needs and nothing more, and the privacy page says exactly this.
--
-- Decided with Nathan, September 10, 2026: a ledger with the account id and
-- no phrase, and five finds per account per Eastern day.

create table if not exists hive_find_runs (
  id bigint generated always as identity primary key,
  wall_date date not null,
  requested_by uuid not null,
  status text not null default 'ok',
  searches integer not null default 0,
  candidates integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists hive_find_runs_finished
  on hive_find_runs (finished_at);

-- The per account count is by the day the run started, Eastern, the same
-- clock the hive keeps everything else on.
create index if not exists hive_find_runs_by_account
  on hive_find_runs (requested_by, started_at);

alter table hive_find_runs enable row level security;

-- Only the service role writes and reads, and it bypasses row level
-- security, so there is deliberately no policy here at all. Nothing in the
-- app reads this table; the function answers "paused" when the reader is
-- out of finds, and that is all the phone ever learns.

-- How many finds an account may run per Eastern day. A value somebody sets
-- while looking at a bill, not a deploy.
alter table fact_search_budget
  add column if not exists hive_finds_per_account_daily integer not null default 5;

-- How many finds this account has left today, Eastern. Service role only,
-- because the answer is about a particular account and the function is the
-- one asking on its behalf.
create or replace function public.hive_finds_left(account_in uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select greatest(0,
    (select hive_finds_per_account_daily from fact_search_budget where only_row)
    - coalesce((
        select count(*)::integer from hive_find_runs
        where requested_by = account_in
          and (started_at at time zone 'America/New_York')::date
              = (now() at time zone 'America/New_York')::date
      ), 0)
  );
$function$;

revoke all on function public.hive_finds_left(uuid) from public, anon, authenticated;
grant execute on function public.hive_finds_left(uuid) to service_role;

-- Same shape as before, now counting all three ledgers.
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
                  where finished_at >= date_trunc('month', now())), 0)
      + coalesce((select sum(searches)::integer from hive_find_runs
                  where finished_at >= date_trunc('month', now())), 0) as this_month,
      coalesce((select sum(searches)::integer from birth_fact_runs
                where finished_at >= date_trunc('day', now())), 0)
      + coalesce((select sum(searches)::integer from culture_search_runs
                  where finished_at >= date_trunc('day', now())), 0)
      + coalesce((select sum(searches)::integer from hive_find_runs
                  where finished_at >= date_trunc('day', now())), 0) as today
  )
  select greatest(0, least(
    b.monthly_limit - spent.this_month,
    b.daily_limit - spent.today
  ))
  from b, spent;
$function$;
