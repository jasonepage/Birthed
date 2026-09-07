-- Who may curate, and what curating is allowed to touch.
--
-- The panel at /admin is a static page like every other page on this site. It
-- carries the publishable key, the same one that already ships inside the iOS
-- app and inside /add, and it is the reader's own sign in that decides what
-- they can do. Nothing here is protected by the page being hard to find. Every
-- rule below is enforced by the database against the caller's token, so the
-- worst somebody can do with the page source is see the shape of a form.

create table if not exists admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  -- For reading the table as a person. Never trusted for anything: the join
  -- above is the identity, this is a label.
  email      text,
  added_at   timestamptz not null default now(),
  added_by   uuid references auth.users (id)
);

alter table admins enable row level security;

-- An admin may see who else is one. Nobody else may see the table at all,
-- because a list of accounts with write access is a list of accounts worth
-- attacking.
create policy read_admins on admins
  for select using (exists (select 1 from admins a where a.user_id = auth.uid()));

/**
 * Whether the caller may curate.
 *
 * security definer so the check itself can read the admins table without the
 * caller needing to be able to, which is what lets the read policy above stay
 * closed. search_path is pinned for the usual reason: a definer function that
 * resolves its own table through the caller's search path is how a definer
 * function becomes somebody else's function.
 */
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

revoke all on function is_admin() from public;
grant execute on function is_admin() to authenticated;

-- Curated rows. An admin may write them; everybody may still read them.
create policy admin_insert_cultural on cultural_events
  for insert to authenticated with check (is_admin());
create policy admin_update_cultural on cultural_events
  for update to authenticated using (is_admin()) with check (is_admin());
create policy admin_delete_cultural on cultural_events
  for delete to authenticated using (is_admin());

-- Wikipedia's own lines are never edited, only hidden. The row keeps its text
-- and gains a reason, so a suppression can be read back and argued with later
-- rather than being an absence nobody can explain.
create policy admin_update_events on historical_events
  for update to authenticated using (is_admin()) with check (is_admin());

-- A found fact can be marked unverified, which takes it off the pages without
-- destroying what was found or the page it cited.
create policy admin_update_facts on birth_facts
  for update to authenticated using (is_admin()) with check (is_admin());

/**
 * How much every date has on it, in one query.
 *
 * The panel opens on a map of 366 cells and the first thing a curator needs is
 * where the holes are. 85 dates have no found facts at all today. A view
 * rather than a query in the page, so the definition of "thin" lives in one
 * place and the panel and any later report cannot drift apart.
 */
create or replace view date_coverage as
with days as (
  select extract(month from d)::int as month, extract(day from d)::int as day
  from generate_series(date '2024-01-01', date '2024-12-31', interval '1 day') d
)
select
  days.month,
  days.day,
  (select count(*) from birth_facts f
     where f.birth_month = days.month and f.birth_day = days.day and f.verified) as facts,
  (select count(*) from historical_events e
     where e.event_month = days.month and e.event_day = days.day and not coalesce(e.suppressed, false)) as events,
  (select count(*) from cultural_events c
     where extract(month from c.event_date) = days.month
       and extract(day from c.event_date) = days.day) as cultural,
  (select count(*) from cultural_events c
     where extract(month from c.event_date) = days.month
       and extract(day from c.event_date) = days.day and c.origin = 'curated') as curated,
  (select count(*) from notable_people p
     where p.birth_month = days.month and p.birth_day = days.day) as people
from days;

grant select on date_coverage to anon, authenticated;

comment on view date_coverage is
  'One row per calendar date with how much is on it. The admin panel opens on this.';
