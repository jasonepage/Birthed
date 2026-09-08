-- Faces.
--
-- Every notable_people row already carries a Wikidata identifier, and Wikidata
-- records a picture of most people in P18, pointing at Wikimedia Commons where
-- the licence is free to reuse with credit. 29 of the 30 people on September 7
-- have one. The page has been drawing coloured monograms this whole time next
-- to a column that could have told it what the person looks like.
--
-- The FILE NAME rather than a URL. Commons serves the same picture from
-- Special:FilePath at any width, so a stored URL would bake one size into the
-- database and go stale the day the page wants another. The name is also what
-- the credit line needs, because the licence asks for the work to be named.
--
-- Null is a normal answer and not a gap to fill later. Across 25,741 people a
-- few thousand will have no picture, and the renderer draws a monogram for
-- those, which is what it drew for everybody until today.
alter table notable_people add column if not exists image_file text;

comment on column notable_people.image_file is
  'Wikimedia Commons file name from Wikidata P18. Null when Wikidata has no picture. The renderer works the served path out from wikidata_qid, so this is a flag and a credit, not an address.';

-- Written in batches, because the alternative is one request per person and
-- there are 25,741 of them. A single statement over a JSON array turns a
-- twenty minute run into a few seconds and, more usefully, makes the whole
-- pass atomic: it either lands or it does not, rather than stopping halfway
-- through and leaving nobody able to tell which half.
--
-- Not granted to anon. Only the service role calls this, and the service role
-- bypasses row level security anyway, so the grant exists to make the intent
-- explicit rather than to enable anything.
create or replace function public.set_person_images(rows jsonb)
returns integer
language sql
security definer
set search_path to 'public'
as $function$
  with incoming as (
    select r->>'qid' as qid, nullif(r->>'file', '') as file
      from jsonb_array_elements(rows) as r
  ), touched as (
    update notable_people p
       set image_file = i.file
      from incoming i
     where p.wikidata_qid = i.qid
       and p.image_file is distinct from i.file
    returning 1
  )
  select count(*)::integer from touched;
$function$;

revoke all on function public.set_person_images(jsonb) from public, anon, authenticated;
