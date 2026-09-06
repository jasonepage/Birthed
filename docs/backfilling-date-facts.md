# Topping up the calendar date facts

The date pages on birthed.app carry a section of specific things that happened
on that date, found by the `find-facts` Edge Function in its no year mode and
stored under `birth_year = 0` with an empty `region_key`. This is how to fill
in the dates that do not have any yet.

## Why this is a manual top up and not a job

Historical facts about a calendar date do not go stale, so this is a backfill
that finishes rather than a pipeline that runs. Once all 366 dates are done,
nothing needs to run again. A date the backfill never reached is not broken
either: the first person in the app with that birthday triggers the search
themselves, and the next site build picks it up.

## The one thing that limits it

Google throttles a new billing account by spending rate, not only by requests
per minute. The message is:

    You exceeded your spend-based rate limit. Your spending rate has exceeded
    the allowed limit for your account's billing history and tier.

That limit rises as the account builds a billing history, so a batch size that
fails tonight may be fine next week. Ninety at once was refused. Thirty at
once worked for a while and then was refused as well, which is the account
level cap rather than a per minute one. When it refuses, wait rather than
retrying harder. Nothing is lost: a run that failed is retried automatically
two minutes later, and the query below skips anything already done.

## Running it

In the Supabase SQL editor. Change the limit to taste, run it, wait about two
minutes, run it again. Repeat until the count of missing dates is zero. The
anonymous key is the publishable one from Project Settings, API Keys, and it
is safe to paste here.

```sql
with every_date as (
  select extract(month from d)::int as m, extract(day from d)::int as dd
  from generate_series('2024-01-01'::date, '2024-12-31'::date, '1 day') g(d)
),
missing as (
  select m, dd from every_date e
  where not exists (
    select 1 from birth_fact_runs r
    where r.birth_year = 0 and r.region_key = ''
      and r.birth_month = e.m and r.birth_day = e.dd
      and (r.status = 'done'
        or (r.status = 'running' and r.started_at > now() - interval '4 minutes'))
  )
  order by m, dd
  limit 20
)
select count(*) as fired from (
  select net.http_post(
    url := 'https://lunqqhjwqrpbujwxwdzk.supabase.co/functions/v1/find-facts',
    headers := '{"Content-Type":"application/json","apikey":"<anon key>","Authorization":"Bearer <anon key>"}'::jsonb,
    body := jsonb_build_object('month', m, 'day', dd),
    timeout_milliseconds := 25000)
  from missing) t;
```

2024 is used to generate the dates because it is a leap year, so February 29
is included. The year itself is never sent; the request carries only a month
and a day, which the function stores under year 0.

## Watching it

```sql
select status, count(*) as dates, sum(found) as facts, sum(searches) as searches
from birth_fact_runs where birth_year = 0 group by status order by status;

-- how many of the 366 still have nothing
select 366 - count(*) as missing from birth_fact_runs
where birth_year = 0 and region_key = '' and status = 'done';

-- what went wrong, if anything did
select left(error, 200) as error, count(*) from birth_fact_runs
where birth_year = 0 and status = 'failed' group by 1 order by 2 desc;
```

A date typically costs eleven or twelve searches and returns nine or ten facts
after the ones with dead citations are dropped. At fourteen dollars per
thousand searches beyond the free five thousand a month, a full 366 date
backfill is roughly 4,100 searches.

## After it finishes

The site bakes the facts into each page at build time, so nothing reaches
birthed.app until the site is built and deployed again:

```
cd web && npm run site
```

then redeploy on Render. Until that happens the pages serve whatever they were
built with, which is the same rule the people list already follows.
