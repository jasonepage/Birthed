-- The album art and the thirty second preview, on the chart week rows.
--
-- Two problems with one answer. The date pages have no images anywhere, which
-- is most of why a stranger called the site vibe coded four seconds after
-- seeing it: an identical stack of rounded cards with no picture in any of
-- them is what every scaffold looks like. And the number one song is the one
-- thing on this whole product people read out loud, and it has never made a
-- sound.
--
-- The iTunes Search API answers both in one request. No key, no developer
-- account, no Apple Music subscription: it returns a thirty second preview
-- file, the cover, and a link into Apple Music. Apple provides it to promote
-- the store, so playing a preview and linking out is the use it exists for.
-- It costs nothing, which is the whole point until there is traction.
--
-- Stored rather than looked up live, for four reasons and they all point the
-- same way. The matching is auditable, so one dry run is read by a person
-- instead of a live search nobody ever sees. No request goes from a reader's
-- phone or browser to Apple carrying a song title. The rate limit, about
-- twenty calls a minute, becomes a one-time backfill instead of a per-reader
-- problem. And a bad match is fixed by updating a row rather than shipping an
-- app.
--
-- 1,189 distinct songs and 1,262 distinct albums across 6,804 chart weeks, so
-- the backfill is roughly two hours once. The same title is number one for
-- several weeks running, which is why the work is per distinct title and the
-- answer is written to every row that shares it.

alter table chart_weeks
  add column if not exists preview_url  text,
  add column if not exists artwork_url  text,
  add column if not exists store_url    text,
  add column if not exists matched_at   timestamptz;

comment on column chart_weeks.preview_url is
  'A thirty second preview on Apple''s own servers, from the iTunes Search API. Null on a row that was looked up and had no confident match, which is why matched_at exists separately: it is how a miss is told from a row nobody has tried yet.';

comment on column chart_weeks.artwork_url is
  'The cover, at 600 by 600. Apple returns 100 by 100 and the size is a segment of the path, so the larger one is the same address with the number changed.';

comment on column chart_weeks.store_url is
  'The Apple Music page for this recording. The preview is allowed because it promotes the store, so the link out is not optional decoration, it is the other half of the arrangement.';

comment on column chart_weeks.matched_at is
  'When this title was last looked up, whether or not anything was found. A row with matched_at set and preview_url null was searched and refused, and must not be searched again on every run.';

-- The backfill walks these, so it should not table scan 6,804 rows to find
-- the next thousand that have never been tried.
create index if not exists chart_weeks_unmatched_idx
  on chart_weeks (chart_name) where matched_at is null;
