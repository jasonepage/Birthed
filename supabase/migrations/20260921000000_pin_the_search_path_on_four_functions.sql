-- Pin the search path on the four functions that did not have one.
--
-- Supabase's security advisor reports a function whose search_path is not
-- set as "role mutable": the function resolves unqualified names using
-- whatever search path the calling role brings, so a role able to create
-- objects in a schema earlier on that path could put a table or function of
-- the same name in front of the real one. Every security definer function in
-- this project already pins its path. These four are not security definer,
-- two of them are triggers that qualify every table they touch with public.,
-- and the risk is correspondingly small. Two of them are also
-- wall_boosts_refuse_change and wall_boost_budget, which between them make a
-- buzz permanent and count the day's allowance, and the trigger that keeps
-- written history immutable should not have its name resolution depend on
-- the caller.
--
-- The four were read from the advisor on September 21, 2026, and the four
-- statements below were run on the live project inside a transaction that
-- was rolled back, which set the path on all four. Not applied.
--
--   enforce_problem_report_rate_limit()   trigger, 20260905154500
--   assert_verified_offer_is_supported()  trigger, 20260905154500
--   wall_boost_budget(date, date)         sql, immutable, 20260909040000
--   wall_boosts_refuse_change()           trigger, 20260909040000
--
-- alter function rather than create or replace, so the bodies are not
-- restated here and a later create or replace still carries its own set
-- search_path. 20260911010000_thirty_seconds_to_take_it_back.sql replaces
-- wall_boosts_refuse_change with a body that pins the path itself; this
-- migration is correct whether it is applied before or after that one.
--
-- pg_temp is listed last, the way twin_count and the other pinned functions
-- in this project do it, so a temporary object can never shadow a public one.

alter function public.enforce_problem_report_rate_limit()
  set search_path = public, pg_temp;

alter function public.assert_verified_offer_is_supported()
  set search_path = public, pg_temp;

alter function public.wall_boost_budget(date, date)
  set search_path = public, pg_temp;

alter function public.wall_boosts_refuse_change()
  set search_path = public, pg_temp;
