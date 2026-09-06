-- A hard ceiling on what the fact finder can spend in a month.
--
-- Written the night the prepaid credits ran out mid backfill. Nothing in the
-- system knew what it was allowed to spend, so the only thing that stopped it
-- was Google refusing to serve. Every guard until now was about quality: is
-- the model searching, does the cited page answer. None of them was about
-- money, and money is the one that fails silently in the wrong direction,
-- because a run that is working is a run that is spending.
--
-- The ceiling is deliberately in the database rather than in the function.
-- Changing it is then a value somebody sets while looking at a bill, not a
-- deploy, and the function cannot be redeployed past it by accident.
--
-- `searches` on `birth_fact_runs` is the meter and it already exists, so the
-- spend is derived from the work rather than counted twice. The two can
-- never disagree, which is the whole reason not to keep a second counter.

create table if not exists fact_search_budget (
  -- One row, forever. The check constraint is what enforces that.
  only_row       boolean     primary key default true check (only_row),
  monthly_limit  integer     not null default 3000 check (monthly_limit >= 0),
  note           text        not null default '',
  updated_at     timestamptz not null default now()
);

insert into fact_search_budget (only_row, monthly_limit, note)
values (true, 3000, 'Set the night the first backfill emptied the prepaid credits.')
on conflict (only_row) do nothing;

alter table fact_search_budget enable row level security;
-- No policy. Only the service role reads this, which is the Edge Function.

/**
 * How many searches are still allowed this calendar month.
 *
 * Counted from finished runs rather than from a counter, so it cannot drift
 * away from the work that was actually done. A run that is still in flight is
 * not counted, which means the true spend can overshoot the ceiling by
 * whatever is running at the moment it is crossed. That is a handful of
 * searches, it is bounded, and the alternative is reserving budget before the
 * work and reconciling afterwards, which is a lot of machinery to save an
 * amount of money too small to matter.
 */
create or replace function fact_searches_left()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select greatest(
    0,
    (select monthly_limit from fact_search_budget where only_row)
    - coalesce((
        select sum(searches)::integer
        from birth_fact_runs
        where finished_at >= date_trunc('month', now())
      ), 0)
  );
$$;

revoke all on function fact_searches_left() from public;
grant execute on function fact_searches_left() to service_role;
