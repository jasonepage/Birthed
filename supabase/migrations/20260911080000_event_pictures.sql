-- Pictures for the events on the hive. docs/the-wall.md section 19, decided
-- by Jason, September 11, 2026: the pictures live in Supabase Storage.
--
-- Every history row that names its article can have that article's lead
-- picture. worker/src/event-pictures.ts fetches it for the twelve best
-- scored events on each date, free pictures only, sized for a tile, puts the
-- file in the `pictures` bucket and records here where it is and who made
-- it. The receipt prints the credit; the tile draws the picture through a
-- style rule the build bakes, the same way covers and faces reach a tile.
--
-- Read by everyone: the build reads it with the anonymous key. Written by
-- the worker with the service role, which is not bound by these policies.
create table if not exists event_pictures (
  event_id bigint primary key references historical_events(id) on delete cascade,
  article text not null,
  file text not null,
  path text not null,
  artist text,
  license text,
  license_url text,
  commons_url text not null,
  fetched_at timestamptz not null default now()
);

comment on table event_pictures is
  'The lead picture of the article a history row is about, stored in the pictures bucket at path, with the credit Wikimedia Commons gives it. Twelve a date at most, chosen by the curation points. worker/src/event-pictures.ts.';

alter table event_pictures enable row level security;

create policy "anyone reads event pictures"
  on event_pictures for select
  using (true);

-- The bucket. Public, because a picture on a public page is public, and
-- read only for everybody but the service role.
insert into storage.buckets (id, name, public)
  values ('pictures', 'pictures', true)
  on conflict (id) do nothing;

create policy "anyone reads pictures"
  on storage.objects for select
  using (bucket_id = 'pictures');
