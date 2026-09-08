-- The coverage map counts published rows, and gains the size of the queue.
--
-- Recreated rather than replaced: create or replace view cannot rename or
-- reorder columns, and the new count has to go last for that reason. The
-- ordering is not meaningful, only the names are.
drop view if exists date_coverage;

create view date_coverage as
with days as (
  select extract(month from d)::int as month, extract(day from d)::int as day
  from generate_series(date '2024-01-01', date '2024-12-31', interval '1 day') d
)
select
  days.month,
  days.day,
  (select count(*) from birth_facts f
     where f.birth_month = days.month and f.birth_day = days.day and f.verified) as facts,
  (select count(*) from historical_events e
     where e.event_month = days.month and e.event_day = days.day and not coalesce(e.suppressed, false)) as events,
  (select count(*) from cultural_events c
     where extract(month from c.event_date) = days.month
       and extract(day from c.event_date) = days.day and c.status = 'published') as cultural,
  (select count(*) from cultural_events c
     where extract(month from c.event_date) = days.month
       and extract(day from c.event_date) = days.day
       and c.status = 'published' and c.origin = 'curated') as curated,
  (select count(*) from notable_people p
     where p.birth_month = days.month and p.birth_day = days.day) as people,
  (select count(*) from cultural_events c
     where extract(month from c.event_date) = days.month
       and extract(day from c.event_date) = days.day and c.status = 'candidate') as pending
from days;

alter view date_coverage set (security_invoker = on);
grant select on date_coverage to anon, authenticated;
