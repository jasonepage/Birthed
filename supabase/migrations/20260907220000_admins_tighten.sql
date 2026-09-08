-- Two things the Supabase linter caught in the migration before this one, one
-- of them at error level and both of them mine.
--
-- A view in Postgres 15 and later runs as its creator unless it is told not
-- to, so date_coverage was reading four tables with the permissions of the
-- migration that made it rather than of whoever asked. It happens to aggregate
-- only counts from tables that are already publicly readable, so nothing
-- leaked. It is still a hole waiting for the day one of those tables stops
-- being public, which is a change somebody would make in a different file
-- while thinking about something else.
alter view date_coverage set (security_invoker = on);

-- The admins list was readable under a policy with no role named on it, so it
-- was evaluated for anonymous callers too. The exists() check already refused
-- them, because an anonymous account is not in the table, but a policy that
-- depends on its own body to refuse a role it should never have been offered
-- to is one edit away from being wrong.
drop policy if exists read_admins on admins;
create policy read_admins on admins
  for select to authenticated
  using (exists (select 1 from admins a where a.user_id = auth.uid()));

-- is_admin() answers false for a caller with no session anyway, since
-- auth.uid() is null, but a security definer function that anybody on the
-- internet may call is a thing to justify rather than to leave lying around.
revoke all on function is_admin() from anon;
