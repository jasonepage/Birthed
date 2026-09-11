-- Pictures for the news on the hive. docs/the-wall.md section 20, decided
-- September 11, 2026: a news tile draws the publisher's own preview picture,
-- the og:image the page offers for link cards, copied once into the
-- `pictures` bucket by worker/src/wall/story-pictures.ts.
--
-- One row per story read. A story whose page offered no picture keeps a row
-- with no path, so the page is not read again for it. Deleting a row is how a
-- picture comes off the site: the tile draws its colour again, and the next
-- run reads the page again, so a publisher's request to remove a picture is
-- honoured by deleting the row and adding the page to the worker's silence
-- list if it should stay off.
--
-- Read by everyone: the build and the live wall read it with the anonymous
-- key. Written by the worker with the service role.
create table if not exists story_pictures (
  story_id uuid primary key references wall_stories(id) on delete cascade,
  page_url text not null,
  image_url text,
  outlet text not null,
  path text,
  fetched_at timestamptz not null default now()
);

comment on table story_pictures is
  'The publisher''s own preview picture (og:image) for a news story on the hive, copied into the pictures bucket at path. Null path: the page offered none. worker/src/wall/story-pictures.ts.';

alter table story_pictures enable row level security;

create policy "anyone reads story pictures"
  on story_pictures for select
  using (true);
