-- The picture of each sealed hive, stored once per date. CLAUDE.md, "The
-- sealed picture". web/src/recap-job.ts writes it with the service role
-- after the date seals and never replaces it; anyone may read it, at
--   /storage/v1/object/public/sealed/<yyyy-mm-dd>.png
--
-- Public, like the pictures bucket, because the whole point is somebody
-- saving and posting it. Limited to PNG and to two megabytes, so the bucket
-- can hold only what the job makes. No write policy: the service role
-- bypasses row level security and nothing else may write here.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('sealed', 'sealed', true, 2097152, array['image/png'])
  on conflict (id) do nothing;

create policy "anyone reads sealed pictures"
  on storage.objects for select
  using (bucket_id = 'sealed');
