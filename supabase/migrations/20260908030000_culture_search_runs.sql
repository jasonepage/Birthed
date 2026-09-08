-- find-culture read fact_searches_left but never wrote to it, so every culture
-- run was invisible to the meter it obeyed. Raising the ceiling would have
-- given the panel unlimited runway.
--
-- birth_fact_runs cannot hold these rows: it requires a birth_year, and a
-- culture run has no birthday. So culture gets its own ledger and the meter
-- learns to sum both against the one ceiling, because it is one bill.

create table if not exists culture_search_runs (
  id bigint generated always as identity primary key,
  event_month smallint not null,
  event_day smallint not null,
  focus text,
  status text not null default 'ok',
  written integer not null default 0,
  dropped integer not null default 0,
  searches integer not null default 0,
  error text,
  requested_by uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists culture_search_runs_finished
  on culture_search_runs (finished_at);

alter table culture_search_runs enable row level security;

-- Only the service role writes, and it bypasses row level security, so there
-- is deliberately no insert policy here. Curators read so the panel can show
-- what is left before they press the button.
create policy "admins read culture runs"
  on culture_search_runs for select
  to authenticated
  using (is_admin());

-- Same shape as before, now counting both ledgers.
create or replace function public.fact_searches_left()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select greatest(
    0,
    (select monthly_limit from fact_search_budget where only_row)
    - coalesce((
        select sum(searches)::integer
        from birth_fact_runs
        where finished_at >= date_trunc('month', now())
      ), 0)
    - coalesce((
        select sum(searches)::integer
        from culture_search_runs
        where finished_at >= date_trunc('month', now())
      ), 0)
  );
$function$;
