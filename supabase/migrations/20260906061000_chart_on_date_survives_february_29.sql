-- make_date(2001, 2, 29) raises, and generate_series walks every year, so a
-- February 29 reader took the whole function down with them. The first of
-- the month plus the day offset never raises, and in a year with no
-- February 29 it lands on March 1, which is one of the two observances the
-- app already offers for that birthday.
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
      and chart_date >= make_date(y.year::int, p_month, 1) + (p_day - 1)
    order by chart_date asc
    limit 1
  ) w
  where w.chart_date <= make_date(y.year::int, p_month, 1) + (p_day - 1) + 6
  order by y.year;
$$;
