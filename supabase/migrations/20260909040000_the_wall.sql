-- The wall. docs/the-wall.md is the authority for every rule in here.
--
-- Every calendar date gets a wall. People submit news stories with a link,
-- spend a few boosts on the ones they think will still matter, and support
-- decides how much of a fixed square each story takes. The date closes at
-- midnight United States Eastern, ending the day after the date, and the wall
-- is then permanent.
--
-- Every table is prefixed wall_ so nothing collides with what is already here.
-- Identity is the existing profiles row keyed to auth.users. There is no
-- handle, no public profile and no score anywhere. Nothing in this migration
-- lets a client write: reads are public, writes arrive in a later session
-- through functions that enforce the budget, and the seed tool writes with the
-- service role.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

-- pool: submitted, waiting for evidence and support. placed: on the wall with a
-- rectangle. overflow: earned a place but the board had no free module.
-- false: later shown false, stamped, keeps its exact rectangle.
create type wall_story_status as enum ('pool', 'placed', 'overflow', 'false');

-- A tier, never a verdict. claimed: somebody said it and nobody has confirmed
-- it. reported: two or more independently owned outlets. seen_direct: video,
-- a filing, a record or an official statement.
create type wall_evidence_tier as enum ('claimed', 'reported', 'seen_direct');

-- ---------------------------------------------------------------------------
-- Eastern midnight
-- ---------------------------------------------------------------------------

-- The instant a calendar date begins in United States Eastern time. One date
-- has to mean one thing for everybody or a permanent archive is not possible,
-- and Eastern was chosen over Coordinated Universal Time because midnight
-- Coordinated Universal Time is five in the afternoon in Oregon.
--
-- stable rather than immutable, because time zone rules are data that can be
-- updated, which is also why these instants are stored on the day row rather
-- than recomputed on every read.
create function wall_eastern_midnight(d date)
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select (d::timestamp) at time zone 'America/New_York';
$$;

-- ---------------------------------------------------------------------------
-- Days
-- ---------------------------------------------------------------------------

create table wall_days (
  wall_date  date primary key,

  -- The three day window, section 3. Opens the day before for submissions,
  -- is live on its own day, gets one more day after, then closes at the
  -- midnight ending that third day. Filled by the trigger below from
  -- wall_date and never trusted from the caller.
  opens_at   timestamptz not null,
  live_at    timestamptz not null,
  closes_at  timestamptz not null,

  -- Stamped by the close job in a later session. Null means the wall is open
  -- or closed by the clock alone, the same way day_editions.sealed_at works.
  closed_at  timestamptz,

  created_at timestamptz not null default now(),

  constraint wall_days_window_in_order check (opens_at < live_at and live_at < closes_at)
);

comment on table wall_days is
  'One row per calendar date that has a wall. docs/the-wall.md section 3.';

create function wall_days_fill_window()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.opens_at  := wall_eastern_midnight(new.wall_date - 1);
  new.live_at   := wall_eastern_midnight(new.wall_date);
  new.closes_at := wall_eastern_midnight(new.wall_date + 2);
  return new;
end;
$$;

create trigger wall_days_window
  before insert or update of wall_date on wall_days
  for each row execute function wall_days_fill_window();

-- ---------------------------------------------------------------------------
-- Stories
-- ---------------------------------------------------------------------------

create table wall_stories (
  id            uuid primary key default gen_random_uuid(),
  wall_date     date not null references wall_days (wall_date),

  -- The person who submitted it, kept so the account's own behaviour can be
  -- measured. Set null when the account goes, because a story is not personal
  -- once it has no identifier on it. Never shown to anybody.
  submitted_by  uuid references profiles (id) on delete set null,
  submitted_at  timestamptz not null default now(),

  -- The wording comes from the source page, never from the person.
  headline      text not null check (length(headline) between 1 and 300),
  url           text not null,
  -- The normalized fingerprint from worker/src/wall/url.ts, so the same page
  -- cannot be submitted twice on one date under two spellings of its address.
  url_key       text not null,
  outlet        text not null,

  status        wall_story_status not null default 'pool',
  tier          wall_evidence_tier not null default 'claimed',

  -- Boost units so far. Maintained by the trigger on wall_boosts and never
  -- written by anything else. It is a cache of sum(units) that exists so the
  -- allocator and the page read one column instead of a join.
  support       integer not null default 0 check (support >= 0),

  -- Placement. An anchor is assigned once and never changes. A tile may grow
  -- and may never move or shrink. The board is 16 by 16 modules, zero
  -- indexed, origin top left.
  placed_at     timestamptz,
  anchor_mx     smallint check (anchor_mx between 0 and 15),
  anchor_my     smallint check (anchor_my between 0 and 15),
  w_modules     smallint check (w_modules between 1 and 16),
  h_modules     smallint check (h_modules between 1 and 16),

  -- A story later shown false is stamped, never deleted.
  false_at      timestamptz,
  false_note    text,

  constraint wall_stories_one_page_per_date unique (wall_date, url_key),

  constraint wall_stories_rectangle_whole check (
    (anchor_mx is null and anchor_my is null and w_modules is null and h_modules is null)
    or (anchor_mx is not null and anchor_my is not null and w_modules is not null and h_modules is not null)
  ),
  constraint wall_stories_rectangle_on_board check (
    anchor_mx is null or (anchor_mx + w_modules <= 16 and anchor_my + h_modules <= 16)
  ),
  constraint wall_stories_placed_has_rectangle check (
    status <> 'placed' or anchor_mx is not null
  ),
  constraint wall_stories_false_is_stamped check (
    (status = 'false') = (false_at is not null)
  )
);

comment on table wall_stories is
  'One submitted story on one date. docs/the-wall.md section 5. The rectangle is authoritative and is written only by the server side allocator.';
comment on column wall_stories.tier is
  'An evidence tier, never a verdict. Interface copy may never say verified truth or fact checked.';

create index wall_stories_by_date on wall_stories (wall_date, status);

-- ---------------------------------------------------------------------------
-- Sources and checks: the receipt
-- ---------------------------------------------------------------------------

-- Every source a story cites, with the sentence from that page that supports
-- the headline. The quotation is checked by exact string match against the
-- fetched page. A paraphrase fails and is discarded. This is the same control
-- offer_rules.source_quote already applies to reward terms.
create table wall_sources (
  id           uuid primary key default gen_random_uuid(),
  story_id     uuid not null references wall_stories (id),
  url          text not null,
  url_key      text not null,
  outlet       text not null,
  -- Who owns the outlet, as plainly as it can be named. Two sources count as
  -- independent only when this differs, section 5.
  owner        text not null,
  headline     text not null check (length(headline) between 1 and 300),
  quotation    text not null check (length(quotation) >= 20),
  -- When a check last found the quotation on the page, exactly. Null means
  -- it has not yet, and the page shows it as unverified.
  verified_at  timestamptz,
  added_by     uuid references profiles (id) on delete set null,
  added_at     timestamptz not null default now(),

  constraint wall_sources_one_page_per_story unique (story_id, url_key)
);

create index wall_sources_by_story on wall_sources (story_id);

-- Every check ever run on a source, kept. A check confirms a link resolves,
-- or confirms the page contains the quotation. Nothing here decides truth.
create table wall_checks (
  id           bigint generated always as identity primary key,
  source_id    uuid not null references wall_sources (id),
  checked_at   timestamptz not null default now(),
  kind         text not null check (kind in ('resolves', 'quotation')),
  passed       boolean not null,
  http_status  integer,
  -- What the checker saw, in one line: the final address after redirects, the
  -- reason a match failed, the size of the page. Plain and inspectable.
  detail       text
);

create index wall_checks_by_source on wall_checks (source_id, checked_at);

-- ---------------------------------------------------------------------------
-- Boosts: immutable
-- ---------------------------------------------------------------------------

-- Every row permanently stores who, which story, how many units, when, the
-- evidence tier at that moment and how much support the story already had at
-- that moment. Those last three cannot be reconstructed afterwards, which is
-- why they are captured from the first version even though nothing uses them
-- yet. Section 6.
create table wall_boosts (
  id              bigint generated always as identity primary key,
  story_id        uuid not null references wall_stories (id),

  -- The account, as a value rather than a foreign key, on the precedent of
  -- events.profile_id. A foreign key would force either a cascade that
  -- deletes history or a set null that edits it, and this row is never
  -- deleted and never edited. When the account goes, this is a random
  -- identifier that points at nothing and names nobody.
  booster_id      uuid not null,

  -- The wall the units were spent on, copied from the story so the budget
  -- query is one index rather than a join.
  wall_date       date not null,
  units           smallint not null check (units between 1 and 3),
  cast_at         timestamptz not null default now(),

  -- Filled by the trigger from the story at the moment of the insert. A
  -- caller cannot supply them and cannot get them wrong.
  tier_at_cast    wall_evidence_tier not null,
  support_before  integer not null check (support_before >= 0)
);

comment on table wall_boosts is
  'Immutable. Never updated, never deleted, by anybody, including the service role. docs/the-wall.md section 6.';

create index wall_boosts_by_story on wall_boosts (story_id);
create index wall_boosts_budget on wall_boosts (booster_id, wall_date);

-- The budget, section 4: three units on today's date, one on yesterday's,
-- none on tomorrow's. "Today" is the calendar date in Eastern time at the
-- moment the boost is cast. The limit is server authoritative, and a trigger
-- is the one place every write has to pass through.
create function wall_boost_budget(cast_on date, wall_date_in date)
returns integer
language sql
immutable
as $$
  select case
    when cast_on = wall_date_in then 3
    when cast_on = wall_date_in + 1 then 1
    else 0
  end;
$$;

create function wall_boosts_before_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  story     wall_stories%rowtype;
  day       wall_days%rowtype;
  cast_on   date;
  already   integer;
  allowance integer;
begin
  select * into story from wall_stories where id = new.story_id;
  if story.id is null then
    raise exception 'wall_boosts: no such story %', new.story_id;
  end if;
  select * into day from wall_days where wall_date = story.wall_date;

  -- A boost lands only while the wall is open, and only from the live day on.
  -- The day before is submissions only.
  if new.cast_at < day.live_at or new.cast_at >= day.closes_at
     or (day.closed_at is not null and new.cast_at >= day.closed_at) then
    raise exception 'wall_boosts: the wall for % is not taking boosts at %', story.wall_date, new.cast_at;
  end if;

  cast_on := (new.cast_at at time zone 'America/New_York')::date;
  allowance := wall_boost_budget(cast_on, story.wall_date);

  select coalesce(sum(units), 0) into already
    from wall_boosts
   where booster_id = new.booster_id
     and wall_date = story.wall_date
     and (cast_at at time zone 'America/New_York')::date = cast_on;

  if already + new.units > allowance then
    raise exception 'wall_boosts: % units on % from % would exceed the budget of % for that day (already %)',
      new.units, story.wall_date, cast_on, allowance, already;
  end if;

  new.wall_date      := story.wall_date;
  new.tier_at_cast   := story.tier;
  new.support_before := story.support;
  return new;
end;
$$;

create trigger wall_boosts_snapshot
  before insert on wall_boosts
  for each row execute function wall_boosts_before_insert();

create function wall_boosts_after_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update wall_stories set support = support + new.units where id = new.story_id;
  return new;
end;
$$;

create trigger wall_boosts_add_support
  after insert on wall_boosts
  for each row execute function wall_boosts_after_insert();

-- Immutable means immutable. Triggers are not bypassed by the service role,
-- which is the point: the rule holds for the worker, the dashboard and any
-- future function alike. Outcomes live in wall_outcomes and are joined.
create function wall_boosts_refuse_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'wall_boosts is immutable. Outcomes go in wall_outcomes.';
end;
$$;

create trigger wall_boosts_immutable
  before update or delete on wall_boosts
  for each row execute function wall_boosts_refuse_change();

-- ---------------------------------------------------------------------------
-- Outcomes: exists, stays empty
-- ---------------------------------------------------------------------------

-- Recorded on a story's anniversaries at one, five and ten years. Three
-- outcomes, not two: held up, turned out false, and true but forgotten.
-- Folding the third into wrong would make every number dishonest. What counts
-- as surviving to an anniversary is undecided on purpose, section 9, so
-- nothing writes here yet.
create table wall_outcomes (
  id           bigint generated always as identity primary key,
  story_id     uuid not null references wall_stories (id),
  anniversary  smallint not null check (anniversary in (1, 5, 10)),
  outcome      text not null check (outcome in ('held', 'false', 'forgotten')),
  recorded_at  timestamptz not null default now(),
  note         text,

  constraint wall_outcomes_once_per_anniversary unique (story_id, anniversary)
);

-- ---------------------------------------------------------------------------
-- Snapshots
-- ---------------------------------------------------------------------------

-- The whole board at one moment, as the allocator produced it: every placed
-- tile with its rectangle, support and tier. One is taken whenever the
-- allocator runs, so the page for a closed wall can be rebuilt from the last
-- one and so the way a day took shape is kept, tick by tick.
create table wall_snapshots (
  id         bigint generated always as identity primary key,
  wall_date  date not null references wall_days (wall_date),
  taken_at   timestamptz not null default now(),
  -- seed, tick, close.
  reason     text not null check (reason in ('seed', 'tick', 'close')),
  -- [{story_id, mx, my, w, h, support, tier}, ...] plus overflow: [story_id]
  board      jsonb not null
);

create index wall_snapshots_by_date on wall_snapshots (wall_date, taken_at desc);

-- ---------------------------------------------------------------------------
-- What the wall needs on profiles
-- ---------------------------------------------------------------------------

-- Signing in is requested at the moment somebody first submits or boosts.
-- That moment is the one fact about the account the wall needs that no wall
-- table holds, and it is what lets behaviour be measured over years. It
-- identifies nobody.
alter table profiles add column wall_joined_at timestamptz;

comment on column profiles.wall_joined_at is
  'When this account first submitted or boosted on the wall. docs/the-wall.md section 6. Never shown.';

-- ---------------------------------------------------------------------------
-- Row level security: on everywhere, public reads, no client writes
-- ---------------------------------------------------------------------------

alter table wall_days      enable row level security;
alter table wall_stories   enable row level security;
alter table wall_sources   enable row level security;
alter table wall_checks    enable row level security;
alter table wall_boosts    enable row level security;
alter table wall_outcomes  enable row level security;
alter table wall_snapshots enable row level security;

create policy wall_days_public_read      on wall_days      for select using (true);
create policy wall_stories_public_read   on wall_stories   for select using (true);
create policy wall_sources_public_read   on wall_sources   for select using (true);
create policy wall_checks_public_read    on wall_checks    for select using (true);
create policy wall_boosts_public_read    on wall_boosts    for select using (true);
create policy wall_outcomes_public_read  on wall_outcomes  for select using (true);
create policy wall_snapshots_public_read on wall_snapshots for select using (true);

-- No insert, update or delete policy exists on any of these, so the anonymous
-- and authenticated roles cannot write through the automatic interface at
-- all. Writes in later sessions arrive through security definer functions
-- that enforce the budget. Grants are revoked too, so a policy added by
-- mistake would still not be enough on its own.
revoke insert, update, delete on wall_days, wall_stories, wall_sources, wall_checks,
  wall_boosts, wall_outcomes, wall_snapshots from anon, authenticated;

revoke all on function wall_boost_budget(date, date) from public;
revoke all on function wall_eastern_midnight(date) from public;
