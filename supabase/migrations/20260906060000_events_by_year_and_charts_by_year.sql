-- The Today tab becomes a feed of everything the database knows about a
-- date, mixed, with the reader's age on each item. docs/today-in-your-years.md.
--
-- Two things it needs from the database that were not there.

-- 1. A key for historical_events, so the events import can be run again
--    without doubling every row. The table was created in the first
--    migration with only a serial id and has been empty since. The
--    fingerprint is written by the worker: sha1 of month, day, year and the
--    exact sentence, so the same line from the same page is the same row and
--    an edit on Wikipedia arrives as a new one.
alter table historical_events
  add column if not exists fingerprint text;

update historical_events
set fingerprint = md5(event_month::text || '|' || event_day::text || '|' || coalesce(event_year::text, '') || '|' || description)
where fingerprint is null;

alter table historical_events
  alter column fingerprint set not null;

create unique index if not exists historical_events_fingerprint_key
  on historical_events (fingerprint);

create index if not exists historical_events_day_year_idx
  on historical_events (event_month, event_day, event_year);

-- 2. The number one on a date in every year of somebody's life, in one
--    request rather than one per year.
--
--    ChartWeek.covers in SQL: the first issue on or after the date, and no
--    more than six days after it, for the reason in CLAUDE.md section 5. The
--    Hot 100 begins in 1959 and the box office in the 1940s, so years before
--    a chart existed simply return no row. February 29 in a year that has
--    none is passed as the observed date by the app, because make_date
--    refuses a date the calendar does not have.
--
--    Security invoker, not definer: chart_weeks is already readable by the
--    anonymous role and this needs nothing more.
create or replace function chart_on_date(
  p_chart text,
  p_month int,
  p_day int,
  p_from_year int,
  p_to_year int
)
returns table (year int, chart_date date, song text, artist text)
language sql
stable
security invoker
set search_path = public
as $$
  select y.year::int, w.chart_date, w.song, w.artist
  from generate_series(p_from_year, p_to_year) as y(year)
  cross join lateral (
    select chart_date, song, artist
    from chart_weeks
    where chart_name = p_chart
      and chart_date >= make_date(y.year::int, p_month, p_day)
    order by chart_date asc
    limit 1
  ) w
  where w.chart_date <= make_date(y.year::int, p_month, p_day) + 6
  order by y.year;
$$;

grant execute on function chart_on_date(text, int, int, int, int) to anon, authenticated;
