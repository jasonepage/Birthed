-- Test accounts that are not held to five finds a day.
--
-- The five a day cap did its job on the first night and stopped the person
-- testing the feature. A curator exemption cannot help: is_admin() keys on
-- a confirmed email and refuses anonymous accounts on purpose, and the
-- phone's account is anonymous. So this is a list of account ids, written
-- by a person with the service role, that get a hundred finds a day
-- instead of five. Still counted against the shared monthly and daily
-- ceilings, so a loop on a test phone is stopped by the same meter as
-- everybody else, only later.
--
-- A reinstall makes a new anonymous account, and the new id has to be added
-- here again. That is deliberate: the exemption follows the install that
-- was vouched for, not the phone.

create table if not exists hive_find_testers (
  account uuid primary key,
  note text,
  added_at timestamptz not null default now()
);

alter table hive_find_testers enable row level security;
-- Service role only. Nothing in the app reads or writes this.

alter table fact_search_budget
  add column if not exists hive_finds_per_tester_daily integer not null default 100;

create or replace function public.hive_finds_left(account_in uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select greatest(0,
    (select case when exists (select 1 from hive_find_testers where account = account_in)
                 then hive_finds_per_tester_daily
                 else hive_finds_per_account_daily end
       from fact_search_budget where only_row)
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
