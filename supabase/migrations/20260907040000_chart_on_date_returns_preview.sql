-- The same reason as the migration before it, one column later. The importer
-- has been storing a thirty second preview per title all along and nothing
-- read it, and the Today feed cannot read what the function does not return.

drop function if exists public.chart_on_date(text, integer, integer, integer, integer);

create function public.chart_on_date(
  p_chart text,
  p_month integer,
  p_day integer,
  p_from_year integer,
  p_to_year integer
)
returns table(
  year integer,
  chart_date date,
  song text,
  artist text,
  artwork_url text,
  store_url text,
  preview_url text
)
language sql
stable
set search_path to 'public'
as $function$
  select y.year::int, w.chart_date, w.song, w.artist, w.artwork_url, w.store_url, w.preview_url
  from generate_series(p_from_year, p_to_year) as y(year)
  cross join lateral (
    select chart_date, song, artist, artwork_url, store_url, preview_url
    from chart_weeks
    where chart_name = p_chart
      and chart_date >= make_date(y.year::int, p_month, 1) + (p_day - 1)
    order by chart_date asc
    limit 1
  ) w
  where w.chart_date <= make_date(y.year::int, p_month, 1) + (p_day - 1) + 6
  order by y.year;
$function$;

grant execute on function public.chart_on_date(text, integer, integer, integer, integer)
  to anon, authenticated, service_role;
