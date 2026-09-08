-- Two things the iOS app needs that the web did not.
--
-- 1. The app's feed carries two kinds the website's timeline does not have.
--
-- The website merges three tables into one list of sentences. The app merges
-- five, because it also draws the number one song and the number one film of
-- the week a date fell in, with a sleeve or a poster beside them. Those rows
-- are not decoration. "I remember that song" is the strongest transmission
-- signal on the page: a number one is the thing everybody your age knows
-- without having read it anywhere, which is the exact axis this table exists
-- to measure and the exact axis Wikipedia cannot see.
--
-- They get one kind rather than two, because a song and a film are the same
-- object here: the thing that was on top of a chart the week of a date. The
-- chart is carried in the id, so 'hot100-1985' and 'boxoffice-1985' never
-- collide and a third chart needs no migration.
--
-- The id is a chart and a year rather than a database row id on purpose. A
-- chart week has no stable row of its own that a client can see, and the pair
-- is already the identity of the thing everywhere else in the app.
alter table remembrances drop constraint if exists remembrances_subject_kind_check;
alter table remembrances add constraint remembrances_subject_kind_check
  check (subject_kind in (
    'moment', 'cultural_event', 'historical_event', 'birth_fact', 'person', 'chart_number_one'
  ));

-- 2. What a sealed date decided, in one call.
--
-- The seal line says "Sealed 8 September 2026. Forty seven people answered."
-- Forty seven PEOPLE, which is not a number anything here could produce yet.
-- remembrance_tally counts answers per row, and one person answering twelve
-- rows is twelve answers. Printing that as twelve people would be a lie on the
-- one screen whose whole job is to be a record, so the count of distinct
-- tokens is computed here instead of guessed at on a phone.
--
-- Individual tokens never leave this function. It returns two integers and the
-- edition's own timestamps, which is everything a page needs and nothing about
-- anybody. remembrances stays closed to every client, as before.
--
-- A date with no edition row returns no rows, which is the honest answer to
-- "what did this date decide": nothing yet, because nobody has answered.
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
         e.sealed_at,
         count(distinct r.voter_token)::integer,
         count(r.id)::integer
    from day_editions e
    left join remembrances r on r.edition_id = e.id
   where e.event_month = month_in and e.event_day = day_in
   group by e.id, e.edition_year, e.opened_at, e.closes_at, e.sealed_at
   order by e.edition_year desc;
$function$;

grant execute on function public.edition_summary(smallint, smallint) to anon, authenticated;
