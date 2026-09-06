-- A number one keyed to a year rather than to a week.
--
-- chart_weeks is the wrong table for this and the reason is in ChartWeek
-- itself. A chart week happens once and is found by asking for the first
-- issue dated on or after a birth date, and ChartWeek.covers refuses an
-- answer more than six days later so that a 1943 birthday cannot be handed
-- the January 1959 chart as fact. A yearly chart has no issue date to anchor
-- that rule to, and putting one in with an invented date would defeat the one
-- control that stops that whole class of wrong answer.
--
-- So a second table, and CLAUDE.md already anticipated it: the most watched
-- television show by season is written down there as its own lookup "because
-- it is keyed to a year and a chart rather than to a day, which is the one
-- shape a search for a single date does not reliably return". This is that
-- lookup, and television can move in beside games later with no schema
-- change.
--
-- The first chart in it is the best selling video game in the United States,
-- from Wikipedia's own year list, which runs 1980 to the present and is
-- sourced to Circana from 1994 and to NPD and Atari's own figures before it.
--
-- What this data is not, which the app has to say out loud rather than imply.
-- It is United States sales only. It is a year and not a week, so it is what
-- sold most across the whole year somebody was born rather than what was
-- selling that day. And it is incomplete by the source's own admission,
-- because plenty of publishers and most independent developers never reported
-- to NPD at all. The note column carries that sentence so it can be corrected
-- from the server without an app release, which is the same reason the reward
-- catalog was built to publish that way.

create table if not exists year_charts (
  -- 'us_best_selling_game'. The key the app asks for.
  chart           text        not null,
  year            smallint    not null check (year between 1900 and 2100),
  title           text        not null check (length(title) between 1 and 300),
  -- Publisher or developer, when the page carries one. Null rather than an
  -- empty string when it does not, so absent reads as absent.
  credit          text,
  -- The page that states it, on every row, for the reason every other table
  -- here carries one: a row that cannot be checked cannot be corrected.
  source_url      text        not null,
  content_license text        not null default 'CC-BY-SA-4.0',
  -- What the interface must show beside the claim. Server side so a better
  -- wording does not need an app release.
  note            text,
  imported_at     timestamptz not null default now(),

  primary key (chart, year)
);

comment on table year_charts is
  'Number ones keyed to a year rather than to a week, for charts that have no issue date to anchor ChartWeek.covers against. Written only by the service role.';

comment on column year_charts.note is
  'The caveat the interface shows beside the claim, such as United States sales only and incomplete because not every publisher reported. Server side so it can be corrected without an app release.';

alter table year_charts enable row level security;

-- NFR-042. Readable by any client including the anonymous key in the app,
-- writable only by the service role, which bypasses row level security.
create policy read_year_charts on year_charts
  for select using (true);
