-- A date seals when its window passes, and nothing had to be told to do it.
--
-- sealed_at was declared in the first migration, is read by remember_status,
-- forget and edition_summary, is read by both clients, and was written by
-- nothing. No cron job, no trigger, no scheduled function, nothing. September
-- 7's window closes at midnight on the 9th and that edition would have sat
-- with a null sealed_at until the heat death of the project.
--
-- Every consequence of that is silent. Answering stops correctly, because
-- open_edition refuses a date outside its window, so the only visible
-- behaviour was right. But no date is ever sealed, so the memory ranking never
-- applies, the front page lead never appears, the seal line never prints, and
-- the counts stay hidden from everybody who did not answer. The whole second
-- half of the feature was unreachable and nothing failed.
--
-- The fix is not a scheduler. A scheduler would be a second thing that has to
-- be running and that can drift, to maintain a value that is already implied
-- by one that is stored. A date is sealed exactly when its window has passed,
-- which is a fact about the clock and needs nobody to notice it.
--
-- So sealed_at stays, and it keeps one job: sealing a date EARLY, by hand,
-- which is the only case a stored value is needed for and is worth keeping for
-- the day a date has to be shut before its time. Everything else derives.
create or replace function public.edition_summary(month_in smallint, day_in smallint)
returns table (
  edition_year smallint,
  opened_at timestamptz,
  closes_at timestamptz,
  sealed_at timestamptz,
  people integer,
  answers integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select e.edition_year,
         e.opened_at,
         e.closes_at,
         -- Sealed by hand, or sealed by the clock. The second is the ordinary
         -- case and the timestamp it reports is the instant the window shut,
         -- which is the honest answer to "when did this date close".
         coalesce(e.sealed_at, case when e.closes_at <= now() then e.closes_at end),
         count(distinct r.voter_token)::integer,
         count(r.id)::integer
    from day_editions e
    left join remembrances r on r.edition_id = e.id
   where e.event_month = month_in and e.event_day = day_in
   group by e.id, e.edition_year, e.opened_at, e.closes_at, e.sealed_at
   order by e.edition_year desc;
$function$;

grant execute on function public.edition_summary(smallint, smallint) to anon, authenticated;
