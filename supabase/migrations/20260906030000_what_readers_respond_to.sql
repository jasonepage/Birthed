-- What readers actually respond to, so the search can be told.
--
-- Decided September 6, 2026. A like alone cannot steer this. Facts are cached
-- per date, per year and per region, and a year specific bucket is shared by
-- roughly one user in five thousand five hundred for a teens and twenties
-- audience, so those lists collect no votes at all until the app is very
-- large. The signal that generalises across dates is not which fact won, it is
-- which SHAPE of fact wins: whether "you are older than Kingdom Hearts" beats
-- "a United Nations summit concluded". That is a category level aggregate, and
-- it is the only thing here that can honestly be fed back into the prompt.
--
-- Three things are counted rather than one:
--
--   impressions   the fact was on screen. Without this a like is a raw count
--                 and a fact shown to fifty people beats one shown to five,
--                 whatever either is worth.
--   share_opens   the reader opened the share sheet on that fact's card. Not
--                 a completed send: iOS does not tell us whether anything was
--                 sent, and the column is named for what is actually observed.
--   likes         already in birth_fact_likes, one row per account per fact.
--
-- Share opens matter most. A thumbs up costs a tap. Making a card out of a
-- fact costs real effort and it is the exact behaviour the whole distribution
-- plan depends on, so it is the outcome worth optimising rather than a proxy
-- for it. It is also far less sensitive to where the fact sat on screen, which
-- matters because the first fact in a section is set large and will collect
-- likes for being first.

alter table birth_facts
  add column if not exists impressions bigint not null default 0,
  add column if not exists share_opens bigint not null default 0;

-- Client reported counters, incremented through one pinned function rather
-- than by granting the anonymous key update on the table. The same reasoning
-- as `twin_count` in CLAUDE.md section 5: a security definer function that
-- anonymous clients may execute is intentional when it is the only way to do
-- the job without exposing a row, and its search path is pinned.
--
-- These numbers are inflatable by anybody holding the key that ships in the
-- app. That is true of every client reported metric and it is acceptable here
-- because nothing is ever shown to a reader from them and nothing is spent on
-- them. They rank a prompt. If that ever stops being true, this needs a real
-- events table with per account rate limiting instead.
create or replace function record_fact_events(
  seen bigint[] default '{}',
  shared bigint[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Capped so one call cannot rewrite the whole table.
  if coalesce(array_length(seen, 1), 0) between 1 and 60 then
    update birth_facts set impressions = impressions + 1 where id = any(seen);
  end if;
  if coalesce(array_length(shared, 1), 0) between 1 and 10 then
    update birth_facts set share_opens = share_opens + 1 where id = any(shared);
  end if;
end;
$$;

revoke all on function record_fact_events(bigint[], bigint[]) from public;
grant execute on function record_fact_events(bigint[], bigint[]) to anon, authenticated;

-- How each shape of fact performs, as a rate rather than a count.
--
-- The priors are not decoration. Without them a category with nine
-- impressions and one share reads as a runaway winner, and the prompt would
-- chase it. Adding a notional 500 impressions and a small number of successes
-- to every row means a category has to earn its position over real volume
-- before it can move, and every category starts life indistinguishable from
-- every other.
create or replace view fact_category_performance
with (security_invoker = true) as
select
  f.category,
  count(distinct f.id)                                        as facts,
  coalesce(sum(f.impressions), 0)                             as impressions,
  coalesce(sum(f.share_opens), 0)                             as share_opens,
  count(l.fact_id)                                            as likes,
  round((count(l.fact_id) + 5) * 1000.0
        / (coalesce(sum(f.impressions), 0) + 500), 2)         as likes_per_thousand,
  round((coalesce(sum(f.share_opens), 0) + 1) * 1000.0
        / (coalesce(sum(f.impressions), 0) + 500), 2)         as shares_per_thousand
from birth_facts f
left join birth_fact_likes l on l.fact_id = f.id
where f.verified
group by f.category;
