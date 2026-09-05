-- Birthed slice 3: brands, offers, the rules that qualify them, and the user
-- state that tracks them. SRS FR-040 to FR-054, FR-060 to FR-069, FR-110 to
-- FR-114, FR-139, FR-141a, NFR-042a, NFR-043.
-- Design reference: SDS.md sections 6.3 through 6.7.

create type verification_tier as enum ('verified', 'reported', 'unconfirmed');
create type requirement_state as enum ('not_started', 'done', 'not_applicable');

create type rule_type as enum (
  'account_required', 'app_required', 'marketing_consent_required',
  'birthdate_on_file_required', 'advance_signup_fixed_days',
  'advance_signup_relative_period', 'prior_purchase_required',
  'tier_dependent_window', 'tier_dependent_reward',
  'redemption_window', 'reward_is_points', 'minimum_spend', 'basket_composition',
  'channel_exclusion', 'geographic_exclusion', 'participating_locations_only',
  'dine_in_only', 'age_eligibility', 'item_category_exclusion',
  'inventory_contingent', 'single_use', 'non_transferable', 'no_resale',
  'no_cash_value', 'no_combining', 'redemption_method', 'family_enrollment',
  'sunset'
);

create table brands (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  website_url   text,
  category      text,
  typical_hours jsonb,               -- SDS 9.1. Typical for the brand, never
  hours_note    text,                -- confirmed for a location. FR-093.
  created_at    timestamptz not null default now()
);

create table offers (
  id                      uuid primary key default gen_random_uuid(),
  brand_id                uuid not null references brands(id) on delete cascade,
  title                   text not null,
  reward_description      text not null,
  reward_is_currency      boolean not null default false,
  estimated_value_cents   integer,
  verification_tier       verification_tier not null default 'unconfirmed',
  terms_source_url        text,
  terms_last_verified_at  date,
  reviewer_id             text,
  reviewed_at             timestamptz,
  sunset_date             date,
  is_free_tier            boolean not null default false,   -- FR-141a
  is_active               boolean not null default true,
  updated_at              timestamptz not null default now(),

  -- FR-045 and FR-135. The database refuses a verified offer with no source,
  -- no reviewer or no review timestamp, and no code path can go around it.
  constraint verified_requires_provenance check (
    verification_tier <> 'verified' or (
      terms_source_url is not null
      and reviewer_id is not null
      and reviewed_at is not null
      and terms_last_verified_at is not null
    )
  )
);

create index offers_brand_idx on offers (brand_id);
create index offers_tier_idx on offers (verification_tier) where is_active;

create table offer_rules (
  id             uuid primary key default gen_random_uuid(),
  offer_id       uuid not null references offers(id) on delete cascade,
  rule_type      rule_type not null,
  params         jsonb not null default '{}'::jsonb,

  -- FR-041 and FR-134. This single NOT NULL is the whole enforcement. An
  -- extraction model that cannot find a supporting sentence cannot write a
  -- row, and there is no code path that bypasses it.
  source_quote   text not null,
  source_locator text,
  snapshot_id    uuid,               -- FR-139, the archived document it came from
  created_at     timestamptz not null default now(),

  constraint quote_is_substantive check (length(trim(source_quote)) >= 15)
);

create index offer_rules_offer_idx on offer_rules (offer_id);

-- The row level check above cannot see child rows, so an offer with no rules
-- at all would pass it. FR-045's other half needs this trigger: a verified
-- offer must have at least one rule. Deferred so an offer and its rules can be
-- written in one transaction in any order.
create function assert_verified_offer_is_supported() returns trigger
language plpgsql as $$
declare
  rule_count integer;
begin
  if new.verification_tier <> 'verified' then
    return new;
  end if;
  select count(*) into rule_count from public.offer_rules where offer_id = new.id;
  if rule_count = 0 then
    raise exception 'offer % cannot be verified with no rules (FR-045)', new.id;
  end if;
  return new;
end;
$$;

create constraint trigger verified_offer_needs_rules
  after insert or update on offers
  deferrable initially deferred
  for each row execute function assert_verified_offer_is_supported();

create table user_offer_states (
  profile_id      uuid not null references profiles(id) on delete cascade,
  offer_id        uuid not null references offers(id) on delete cascade,
  requirement_key text not null,
  state           requirement_state not null default 'not_started',

  -- FR-065. The calendar year the cycle's occurrence falls in, or 0 for a
  -- requirement that carries over forever. CycleCalculator in the domain layer
  -- owns this choice and nothing else may duplicate it.
  cycle_year      smallint not null,
  updated_at      timestamptz not null default now(),
  primary key (profile_id, offer_id, requirement_key, cycle_year)
);

-- FR-069. A redemption window anchored to the collection date has no end date
-- until collection happens, so the date has to be recorded.
create table user_offer_collections (
  profile_id   uuid not null references profiles(id) on delete cascade,
  offer_id     uuid not null references offers(id) on delete cascade,
  cycle_year   smallint not null,
  collected_on date not null,
  primary key (profile_id, offer_id, cycle_year)
);

create table claims (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  offer_id   uuid not null references offers(id) on delete cascade,
  claimed_on date not null,
  rating     smallint check (rating is null or rating in (-1, 1)),
  cycle_year smallint not null
);

create table problem_reports (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references profiles(id) on delete set null,
  offer_id    uuid not null references offers(id) on delete cascade,
  category    text not null,
  note        text,
  app_version text,
  region_code text,                  -- coarse only, NFR-030
  created_at  timestamptz not null default now()
);

create index problem_reports_offer_idx on problem_reports (offer_id, created_at desc);

-- FR-139. The archived source document every quotation is checked against.
create table terms_snapshots (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references brands(id) on delete cascade,
  source_url     text not null,
  fetched_at     timestamptz not null default now(),
  content_sha256 text not null,
  content        text not null,
  render_mode    text not null
);

create index terms_snapshots_brand_idx on terms_snapshots (brand_id, fetched_at desc);
create unique index terms_snapshots_unchanged_idx on terms_snapshots (brand_id, content_sha256);

alter table offer_rules
  add constraint offer_rules_snapshot_fk
  foreign key (snapshot_id) references terms_snapshots(id) on delete set null;

-- NFR-043. The limit lives in the database because the client cannot be
-- trusted to hold one.
create function enforce_problem_report_rate_limit() returns trigger
language plpgsql as $$
declare
  today_count integer;
begin
  if new.profile_id is null then
    return new;
  end if;
  select count(*) into today_count
  from public.problem_reports
  where profile_id = new.profile_id
    and created_at >= date_trunc('day', now());
  if today_count >= 10 then
    raise exception 'problem report limit reached for today (NFR-043)';
  end if;
  return new;
end;
$$;

create trigger problem_reports_rate_limit
  before insert on problem_reports
  for each row execute function enforce_problem_report_rate_limit();

-- NFR-042a. Row level security on every table in the public schema, including
-- the ones that carry no policy at all.
alter table brands                 enable row level security;
alter table offers                 enable row level security;
alter table offer_rules            enable row level security;
alter table user_offer_states      enable row level security;
alter table user_offer_collections enable row level security;
alter table claims                 enable row level security;
alter table problem_reports        enable row level security;
alter table terms_snapshots        enable row level security;

-- Catalog and identity content: readable by anyone, written only by the
-- service role, which bypasses row level security.
create policy read_brands on brands for select using (true);
create policy read_offers on offers for select using (true);
create policy read_offer_rules on offer_rules for select using (true);

-- A person's own state, and nobody else's.
create policy own_states on user_offer_states
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy own_collections on user_offer_collections
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy own_claims on claims
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Reports are written by their owner and read by nobody but the service role.
create policy write_reports on problem_reports
  for insert with check (profile_id = auth.uid());

-- terms_snapshots carries no policy on purpose. Row level security is on, so
-- every client request against it is denied.
