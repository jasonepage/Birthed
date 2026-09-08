-- How many people looked up the thing a row cites, measured once, kept.
--
-- The one component of the panel's points that is a property of the object
-- rather than an opinion about it: yearly pageviews on the Wikipedia article
-- a row's source resolves to, from the Wikimedia pageviews API, which is free
-- and needs no key. The same measurement for a game as for a coronation.
--
-- Keyed by the source address as written on the row, so a row's reach is
-- looked up with what the row already carries and nothing has to be joined.
-- A Wikidata entity resolves to its English article first; a source that is
-- neither is recorded with an error saying so, which the panel prints as
-- "unmeasured" rather than as zero, because zero is a claim.
--
-- Never read by the site. The build does not select from this table and no
-- policy lets an anonymous caller see it: the points are for a curator
-- deciding what to work on tonight and for nobody else. docs/panel-brief.md
-- says where they may never appear.
create table if not exists article_reach (
  source_url text primary key,
  article text,
  views_year bigint,
  measured_at timestamptz not null default now(),
  error text
);

alter table article_reach enable row level security;

create policy "admins read reach"
  on article_reach for select
  to authenticated
  using (is_admin());
