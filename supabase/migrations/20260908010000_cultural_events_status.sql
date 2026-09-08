-- Nothing a model proposes may reach a page without a person saying so.
--
-- cultural_events had no state. Every row in it was live, because the site
-- reads the table directly, so a batch generator aimed at this table would
-- publish to 366 public pages the moment it finished with nobody having read a
-- word. That is the whole reason this column exists and it has to be here
-- before any generator is written, not after.
--
-- Rejected rows are kept and never deleted. They are the only record of what a
-- generator keeps proposing that is not good enough, and a generator proposing
-- the same rejected thing forty times is a fixable prompt and an invisible
-- problem if the rejections are thrown away.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'cultural_status') then
    create type cultural_status as enum ('candidate', 'published', 'rejected');
  end if;
end
$$;

-- Defaulting to candidate rather than to published, so that anything written
-- by something that forgets to say which it meant is invisible rather than
-- live. The safe direction for a default is the one where a mistake costs a
-- missing row instead of a public one.
alter table cultural_events
  add column if not exists status cultural_status not null default 'candidate',
  add column if not exists reviewed_by uuid references auth.users (id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejected_reason text;

-- The ten rows already here were written by hand, one at a time, by a person.
-- That is what published means.
update cultural_events set status = 'published', reviewed_at = created_at
where origin = 'curated' and status = 'candidate';

-- Two policies rather than one with an OR in it.
--
-- A single policy reading "published or is_admin()" would call is_admin() for
-- anonymous callers too, and anon has no execute permission on it, so the
-- whole read would fail rather than fall through. Postgres does not promise to
-- short circuit an OR. Splitting by role means the anonymous path never
-- reaches the function at all.
drop policy if exists read_cultural_events on cultural_events;

create policy read_published_cultural on cultural_events
  for select to anon using (status = 'published');

create policy read_cultural_as_curator on cultural_events
  for select to authenticated using (status = 'published' or is_admin());

create index if not exists cultural_events_status_idx on cultural_events (status);

comment on column cultural_events.status is
  'candidate: proposed, panel only. published: a curator said yes. rejected: kept forever, never proposed again.';
