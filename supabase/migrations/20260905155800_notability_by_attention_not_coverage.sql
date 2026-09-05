-- The ranking was wrong, and wrong in a way that showed. Sitelink count
-- measures how many languages have an article about somebody, not how many
-- people care about them, so a Bundesliga midfielder outranked a pop star and
-- the day page read like a UEFA roster.
--
-- These columns carry the signals the new score is built from, so the weights
-- can be retuned with an UPDATE rather than another trip to Wikidata.
-- FR-021 and FR-130.

alter table notable_people
  add column if not exists enwiki_title text,
  -- Average monthly English Wikipedia pageviews over the last twelve months.
  -- A direct measure of how many people look somebody up, which is exactly
  -- the question a day page answers.
  add column if not exists monthly_views integer not null default 0
    check (monthly_views >= 0),
  -- Whether Wikidata carries a TikTok, Instagram or YouTube identifier for
  -- them. Not a popularity measure. It is a cheap, licensed signal that this
  -- is a person who exists on the internet rather than only in an encyclopedia.
  add column if not exists has_social boolean not null default false;

comment on column notable_people.monthly_views is
  'Average monthly English Wikipedia pageviews. The primary ranking signal.';
comment on column notable_people.has_social is
  'Wikidata carries a TikTok, Instagram or YouTube identifier for this person.';

-- The day page reads this index. It is now ordered by the score the new
-- signals produce.
drop index if exists notable_people_day_rank_idx;
create index notable_people_day_rank_idx
  on notable_people (birth_month, birth_day, notability_score desc);

create index if not exists notable_people_views_idx
  on notable_people (monthly_views desc);
