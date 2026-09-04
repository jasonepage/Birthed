# Birthed: Software Design Specification

**Status:** Draft 1
**Date:** September 4, 2026
**Scope:** Version 1.0, iOS only
**Companion documents:** `PRD.md` (why), `SRS.md` (what)

---

## 1. Design principles

Five rules govern every decision below.

**Correctness lives in pure code.** All date arithmetic and all qualification logic sit in plain Swift types with no framework dependencies, so they can be tested exhaustively without a simulator, a database or a network. See section 5.

**The server stores data, the client computes answers.** Qualification status, countdowns and the day plan are all computed on device from data the server hands down. This makes the app work offline, makes the logic unit testable, and means a rule change does not require a server deployment.

**Nothing is published without a source.** The database schema physically prevents a rule from existing without the sentence that supports it. This is a constraint, not a convention.

**Build for one hundred thousand users, not ten million.** Postgres with sensible indexes carries this product a very long way. No queues, no caches, no microservices until something actually hurts.

**One type field is the entire agent hedge.** Nothing else in this document accommodates agents, and that is deliberate.

---

## 2. System context

```
┌─────────────────────────────────────────────────┐
│  iOS app (SwiftUI)                              │
│                                                 │
│  Feature layer   SwiftUI views + view models    │
│  Domain layer    pure Swift, no dependencies    │
│  Data layer      SwiftData cache + network      │
└──────────────┬──────────────────────────────────┘
               │
      ┌────────┴────────┬──────────────┬──────────────┐
      ▼                 ▼              ▼              ▼
┌───────────┐   ┌──────────────┐  ┌─────────┐  ┌───────────┐
│ Supabase  │   │  WeatherKit  │  │ MapKit  │  │ StoreKit 2│
│ Postgres  │   │  (forecast)  │  │(nearest │  │ (payments)│
│ Auth      │   └──────────────┘  │ branch) │  └───────────┘
│ Edge Fns  │                     └─────────┘
└─────┬─────┘
      │  (backend only, never called by the app)
      ▼
┌───────────────────────────────────────────────────────┐
│  Pipeline worker  (Docker container on Render, cron)  │
│                                                       │
│  Wikidata query service ──► people and events         │
│  Brand discovery ──► fetch (headless browser) ──►     │
│         model extraction ──► quote check ──► review   │
└───────────────────────────────────────────────────────┘
```

The app talks to exactly four external systems. The pipeline worker is a separate deployment that writes into the same Postgres database, and the app never calls it.

**Why the worker is not a Supabase Edge Function.** Two of the fourteen brands in our own terms research, Firehouse Subs and Texas Roadhouse, could not be read at all because their terms pages render client side, meaning the content only exists after JavaScript runs. Reading those requires a headless browser, which needs hundreds of megabytes of Chromium and a long-running process. Edge Functions are short-lived and cannot host that. So the worker is a container. Everything else about the backend stays in Supabase.

---

## 3. iOS application architecture

**Platform target.** iOS 17 minimum. This gives Observation, SwiftData and the current WeatherKit interface without carrying compatibility shims.

**Three layers, one dependency direction.**

**Domain.** Plain Swift structs and enums in their own module with no import of SwiftUI, SwiftData, Foundation networking, or anything Apple beyond `Foundation` itself. It contains:

- `BirthdayCalendar`, which answers every "when" question. Next occurrence, days until, is-it-today, window membership, leap day observance.
- `QualificationEngine`, which takes an offer's rules plus the user's recorded states plus a reference date and returns a status and an outstanding action.
- `DayPlanBuilder`, which takes qualified offers plus typical hours plus optional distances plus an optional forecast and returns an ordered plan.
- `CycleCalculator`, which decides when annual requirements reset.

These four types carry essentially all of the product's correctness risk, and none of them touch a database or a network. Every one of them should reach very high test coverage. If a bug is going to embarrass this app in public, it is going to be in here.

**Data.** SwiftData models mirroring the server schema for offline caching, plus a thin Supabase client, plus a sync coordinator. The data layer converts persistence models into domain values at the boundary. Domain types never gain a `@Model` attribute.

**Feature.** SwiftUI views and `@Observable` view models, one folder per screen area: DayPage, MyDay, Catalog, DayPlan, Settings.

**Why the strict separation.** SwiftData is the newest and least battle-tested piece of this stack. Keeping the domain free of it means that if SwiftData has to be replaced with GRDB or raw SQLite, the replacement touches one layer and no tests change.

**Navigation.** A single `TabView` with three tabs matching `PRD.md` section 10.9: Today, Mine, Me. `NavigationStack` per tab with a typed path enum.

---

## 4. Backend architecture

**Supabase**, which is Postgres with authentication, row level security and serverless functions attached.

- **Postgres** holds every table in sections 6 and 14.
- **Auth** provides anonymous sign-in, which is what makes `FR-010` possible with no user-visible screen, and Sign in with Apple for the later upgrade path. Supabase supports converting an anonymous user into a permanent one while keeping the same user identifier, which means `FR-012` requires no data migration.
- **Row level security** enforces `NFR-041` and `NFR-042` in the database rather than in application code.
- **Edge Functions** run the content pipeline on a schedule. The app never calls them.
- **Storage** is not used in version 1.0. See section 8 on why there are no images.

**Client sync model.** The catalog is read-mostly and small. The client keeps a `last_synced_at` timestamp and requests rows changed since then. User state is written to local storage first and pushed opportunistically, per `NFR-022`.

**Offline caching, satisfying `FR-031` and `NFR-020`.** Three distinct caches, with different lifetimes:

- **Catalog.** Every offer, rule and brand is pulled in full on first sync and kept locally forever, refreshed by the changed-since query. It is a few hundred kilobytes and there is no reason to evict it. This is what makes the qualification engine work offline.
- **Day pages.** A least-recently-used cache of the 30 most recently viewed dates, per `FR-031`, plus the user's own date pinned so it is never evicted. Each cached page records the date it was fetched, which is what the staleness note in `FR-031` displays.
- **Bundled seed.** A small set of day pages ships inside the application bundle so that `FR-011` holds on a first launch with no network. Today's date is not knowable at build time, so the seed covers a fallback page explaining that content will load when a connection is available, plus the identity content for the user's own date once onboarding supplies it.

The twin count is deliberately **not** cached, because it is a live aggregate and a stale count is worse than an honest placeholder. `NFR-020` exempts it alongside weather and distances.

**No custom server.** There is no application server. The app talks to Postgres through Supabase's generated interface with row level security doing the authorization.

---

## 5. Calendar date handling

This is the most defect-prone area in the entire product, and a competitor's own reviews contain the exact bug we are trying to avoid: reminders firing an hour off in the winter months, which is a daylight saving time error.

### 5.1 Storage

A calendar birthday is **two small integers**, `birth_month` and `birth_day`. It is never a `date`, never a `timestamp`, and never a `timestamptz`. There is no year and no time zone, because September 4 is not a moment in time. It is a label that recurs.

`birth_year` is a separate nullable integer, used only for computing age when the user asks for it.

`leap_observance` is an enum with values `feb_28` and `mar_01`, defaulting to `feb_28`, and is meaningful only for a February 29 birthday.

### 5.2 Computation

All computation goes through `BirthdayCalendar`, which takes an explicit `Calendar` and `TimeZone` on construction rather than reading `Calendar.current` internally. Tests inject fixed values. Production injects the device's.

```swift
struct BirthdayCalendar {
    let calendar: Calendar
    let timeZone: TimeZone

    func nextOccurrence(ofMonth m: Int, day d: Int,
                        observance: LeapObservance,
                        from reference: Date) -> Date
    func daysUntil(month m: Int, day d: Int, ...) -> Int
    func isBirthdayToday(month m: Int, day d: Int, ...) -> Bool
    func isInWindow(month m: Int, day d: Int, ...) -> Bool
}
```

**Three rules that are not negotiable.**

First, never add or subtract seconds to move between days. `date.addingTimeInterval(86_400)` is wrong across a daylight saving boundary. Use `calendar.date(byAdding: .day, value: n, to: date)`, which knows that some days are 23 or 25 hours long. This satisfies `NFR-004`.

Second, "is it my birthday" is a comparison of calendar components, not of instants. Extract month and day from the reference date using the user's calendar and time zone, then compare integers. Never compare a stored date to `Date()`.

Third, February 29 resolves at read time, never at write time. The stored birthday stays February 29 forever. `nextOccurrence` consults `leap_day_observance` and the target year's leap status each time it is asked. A user who moves from 2027 to 2028 sees the behavior change with no data migration.

### 5.3 Notifications and the daylight saving bug

Notifications must use `UNCalendarNotificationTrigger` built from `DateComponents` that include the hour and minute. They must **not** use `UNTimeIntervalNotificationTrigger`.

This is the whole fix. An interval trigger scheduled 40 days out will fire 40 times 86,400 seconds later, which lands an hour off if a daylight saving transition falls in between. A calendar trigger fires at 8:00 local no matter what the clocks did in the meantime. That single choice satisfies `FR-075` and avoids the defect visible in a competitor's public reviews.

**The February 29 trap.** A calendar trigger built from the literal components month 2, day 29 fires only in leap years, so a February 29 user would receive no birthday notification in three years out of four. The scheduler must therefore **resolve leap day observance first and build the trigger from the observed date**, not from the stored birthday. A February 29 user with `feb_28` observance gets components for month 2, day 28 in non-leap years and month 2, day 29 in leap years. The stored birthday never changes. This is the same read-time resolution rule as section 5.2, applied to scheduling, and it is why `FR-073` is written against the observed birthday rather than the calendar birthday.

On `NSSystemTimeZoneDidChange`, the app cancels and rebuilds all pending notification requests, satisfying `FR-074`.

### 5.4 Required tests

`NFR-003` enumerates them. They belong in the domain module's test target and should run on every commit. February 29 in both leap and non-leap years under both observance settings, December 31 to January 1 rollover, a countdown spanning a daylight saving transition in both directions, and users at coordinated universal time plus 14 and minus 11.

---

## 6. Database schema

Postgres. Abbreviated for readability, with the load-bearing constraints shown.

### 6.1 Profiles

```sql
create type profile_type as enum ('HUMAN', 'AGENT');
create type leap_observance as enum ('feb_28', 'mar_01');

create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  profile_type      profile_type not null default 'HUMAN',
  birth_month       smallint check (birth_month between 1 and 12),
  birth_day         smallint check (birth_day between 1 and 31),
  birth_year        smallint,
  leap_observance   leap_observance not null default 'feb_28',
  region_code       text,              -- postal code or city+state, coarse
  created_at        timestamptz not null default now()
);
create index on profiles (birth_month, birth_day) where profile_type = 'HUMAN';
```

`profile_type` is the entire agent hedge, per `FR-120` to `FR-122`. Every version 1.0 query filters on it. Nothing else in the schema mentions agents.

The composite index on month and day is what makes the twin count in `FR-026` a single fast query.

### 6.2 Identity content

```sql
create table notable_people (
  id                bigserial primary key,
  wikidata_qid      text unique not null,
  name              text not null,
  birth_month       smallint not null,
  birth_day         smallint not null,
  birth_year        smallint,
  death_year        smallint,
  short_description text,              -- Wikidata, public domain
  notability_score  integer not null default 0,
  source_url        text not null,
  content_license   text not null,
  imported_at       timestamptz not null default now()
);
create index on notable_people (birth_month, birth_day, notability_score desc);

create table historical_events (
  id                bigserial primary key,
  event_month       smallint not null,
  event_day         smallint not null,
  event_year        smallint,
  description       text not null,
  source_url        text not null,
  content_license   text not null
);
```

There is deliberately **no `calendar_days` table**. A day is `(month, day)` and every query filters on it. Adding a table for 366 rows would buy nothing.

### 6.3 Brands and offers

```sql
create type verification_tier as enum ('verified', 'reported', 'unconfirmed');

create table brands (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  website_url    text,
  category       text,                -- coffee, fast food, beauty, ...
  typical_hours  jsonb,               -- shape shown in section 9.1
  hours_note     text
);

create table offers (
  id                      uuid primary key default gen_random_uuid(),
  brand_id                uuid not null references brands(id),
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
  is_active               boolean not null default true,
  updated_at              timestamptz not null default now(),

  -- FR-045 and FR-135: a verified offer must have a source, a reviewer,
  -- a verification date and a review timestamp
  constraint verified_requires_provenance check (
    verification_tier <> 'verified' or (
      terms_source_url is not null
      and reviewer_id is not null
      and reviewed_at is not null
      and terms_last_verified_at is not null
    )
  )
);
```

**What this constraint does and does not do.** It enforces the provenance half of `FR-045` and all of `FR-135`. The database refuses a verified offer with no source, no reviewer or no review timestamp, and no code path can bypass it.

It does **not** enforce the other half of `FR-045`, that every rule carries a supporting quotation, because a row-level check cannot see child rows. An offer with zero rules would pass it. That half needs a deferred constraint trigger on `offers` that counts rules with an empty quotation and rejects the transition to `verified` if any exist, or if the offer has no rules at all. The `not null` on `offer_rules.source_quote` in section 6.4 covers the per-rule case; the trigger covers the "verified but empty" case. Both are needed.

`sunset_date` exists because Red Robin published one. An offer past its sunset date is filtered out client side and flagged for review server side.

### 6.4 Rules

```sql
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

create table offer_rules (
  id              uuid primary key default gen_random_uuid(),
  offer_id        uuid not null references offers(id) on delete cascade,
  rule_type       rule_type not null,
  params          jsonb not null default '{}'::jsonb,
  source_quote    text not null,       -- FR-041, NOT NULL is the enforcement
  source_locator  text,
  created_at      timestamptz not null default now(),

  constraint quote_is_substantive check (length(trim(source_quote)) >= 15)
);
```

**`source_quote` is `not null` with a minimum length.** That single line is how `FR-041` and `FR-134` are enforced. An extraction model that cannot find a supporting sentence cannot write a row. There is no code path that bypasses it.

`params` carries the type-specific detail:

| rule_type | params shape |
|---|---|
| `advance_signup_fixed_days` | `{"days": 7}` |
| `advance_signup_relative_period` | `{"before": "birthday_month"}` |
| `prior_purchase_required` | `{"lookback_months": 12, "category": "regular or giant sub, wrap, or sub bowl", "recurs_annually": true}` |
| `redemption_window` | `{"anchor": "collection_date", "days": 30}` |
| `minimum_spend` | `{"channel": "brand_web", "cents": 2500}` |
| `age_eligibility` | `{"min_age": 13}` |
| `reward_is_points` | `{"amount": 72, "unit": "Shore Points", "expiry_days": 365}` |

`reward_is_points` is the Jersey Mike's and IHOP case, where the reward is a currency grant rather than an item, so the point expiry clock becomes the real deadline rather than the redemption window. It pairs with the `reward_is_currency` flag on `offers`, which drives display, while this rule carries the detail and its supporting quotation.

The four permitted anchors are `birthday_date`, `birthday_month`, `month_start` and `collection_date`, satisfying `FR-043`. Dutch Bros needs `collection_date` and nothing else in the model can express it.

`minimum_spend` and location rules repeat per channel rather than carrying a channel map, satisfying `FR-044`. Sephora is two rows: `{"channel":"brand_web","cents":2500}` and `{"channel":"in_store","cents":0}`.

### 6.5 User state

```sql
create type requirement_state as enum ('not_started', 'done', 'not_applicable');

create table user_offer_states (
  profile_id       uuid not null references profiles(id) on delete cascade,
  offer_id         uuid not null references offers(id) on delete cascade,
  requirement_key  text not null,      -- 'account', 'app', 'birthdate_on_file',
                                       -- 'marketing_consent', 'prior_purchase'
  state            requirement_state not null default 'not_started',
  cycle_year       smallint not null,  -- FR-065
  updated_at       timestamptz not null default now(),
  primary key (profile_id, offer_id, requirement_key, cycle_year)
);

create table claims (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  offer_id     uuid not null references offers(id),
  claimed_on   date not null,
  rating       smallint check (rating in (-1, 1)),
  cycle_year   smallint not null
);

create table problem_reports (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete set null,
  offer_id     uuid not null references offers(id),
  category     text not null,
  note         text,
  app_version  text,
  region_code  text,                   -- coarse only, NFR-030
  created_at   timestamptz not null default now()
);
```

**`cycle_year` defined.** A birthday cycle is the period running from 45 days before one birthday occurrence through 30 days after it, matching the window in `FR-032`. `cycle_year` is **the calendar year in which that cycle's birthday occurrence falls**, not the current calendar year. The value rolls over on the day after the window closes, which is birthday plus 31 days. A user with a September 4 birthday is in cycle 2026 from July 21, 2026 through October 5, 2026, and enters cycle 2027 on October 6, 2026. `CycleCalculator` in the domain layer owns this single computation and nothing else duplicates it.

This scheme is how `FR-065` works **without any scheduled reset job**. An annually recurring requirement, such as the Starbucks star earning transaction, is looked up under the current cycle year, finds no row, and reads as `not_started`. It resets by not existing. A persistent requirement, such as having created an account, is written under `cycle_year = 0`, a sentinel meaning "carries over forever," and is found in every cycle. Nothing is ever deleted or reset, no job runs, and the correct behavior falls out of the lookup key.

The engine in section 7 must therefore look up each requirement under both the current cycle year and zero, taking whichever row exists.

### 6.6 Row level security

```sql
alter table profiles enable row level security;
alter table user_offer_states enable row level security;
alter table claims enable row level security;

create policy own_profile on profiles
  for all using (id = auth.uid());
create policy own_states on user_offer_states
  for all using (profile_id = auth.uid());
create policy own_claims on claims
  for all using (profile_id = auth.uid());

-- catalog and identity content: readable by anyone signed in, anonymous
-- users included; writable only by the service role
create policy read_offers on offers for select using (true);
create policy read_rules  on offer_rules for select using (true);
create policy read_people on notable_people for select using (true);
```

The twin count in `FR-026` cannot be a direct select against `profiles`, since row level security blocks it and exposing other profiles would violate the privacy design. It is a `security definer` function returning only an integer, with the `NFR-033` floor applied inside the function:

```sql
create function twin_count(m integer, d integer)
returns integer
language sql
security definer
set search_path = public, pg_temp   -- required, see below
stable
as $$
  select case when count(*) < 5 then -1 else count(*)::int end
  from public.profiles
  where birth_month = m::smallint
    and birth_day   = d::smallint
    and profile_type = 'HUMAN';
$$;

revoke all on function twin_count(integer, integer) from public;
grant execute on function twin_count(integer, integer) to authenticated, anon;
```

Two details that are easy to get wrong. **`set search_path` is mandatory on any `security definer` function.** Without it the function runs with the caller's search path while holding the definer's privileges, which is the standard privilege escalation pattern and is flagged by Supabase's own security advisor. And the parameters are declared `integer` rather than `smallint`, because Postgres will not implicitly resolve an integer literal from a generic client to a `smallint` parameter, so a `smallint` signature fails to find the function at call time.

The sentinel of negative one renders as "fewer than 5" in the app. The exact number never leaves the database on rare dates.

---

## 7. Qualification engine

Pure Swift, in the domain layer, with this shape:

```swift
enum QualificationStatus {
    case qualified
    case actionNeeded(next: RequiredAction, by: Date?)
    case notEligibleThisCycle(reason: IneligibilityReason)
}

func evaluate(offer: Offer,
              rules: [OfferRule],
              states: [RequirementKey: RequirementState],
              birthday: CalendarBirthday,
              on reference: Date,
              using calendar: BirthdayCalendar) -> QualificationStatus
```

**Two kinds of rule, and the distinction matters.**

A **requirement** is something the user must do. There are exactly five: `account_required`, `app_required`, `marketing_consent_required`, `birthdate_on_file_required` and `prior_purchase_required`. Each maps to one `requirement_key` in `user_offer_states`.

A **deadline modifier** is not something the user does. It is a date by which a requirement must already be satisfied. Two rule types are modifiers: `advance_signup_fixed_days` and `advance_signup_relative_period`.

Modifiers are not user-actionable and are not requirements, but they are **not** informational either. They must be joined to the requirements they gate, or the engine has no deadline to report and `FR-062` and `FR-063` cannot be satisfied. Everything else in the rule set is genuinely informational: displayed on the detail screen, never affecting status.

**Algorithm.**

1. Build the requirement set from the offer's requirement rules.
2. Build a deadline for each requirement:
   - Enrollment requirements (`account`, `app`, `marketing_consent`, `birthdate_on_file`) inherit the offer's signup modifier, whichever is present.
   - `prior_purchase_required` carries its own deadline, which is the day before the birthday, because every source we verified says "prior to your birthday" rather than "on."
   - A requirement with no applicable modifier has no deadline and can be satisfied at any time up to the birthday.
3. Resolve each modifier to a **last valid day**:
   - `advance_signup_fixed_days` with `days: N` gives birthday minus N days. Starbucks at 7 gives the seventh day before.
   - `advance_signup_relative_period` with `before: "birthday_month"` gives the **last day of the month preceding the birthday month**, not the first day of the birthday month. Ulta requires the birth date on file before the birthday month begins, so acting on the first of that month is already too late. Getting this backwards would wrongly mark a user Qualified.
4. Look up each requirement's recorded state under the correct cycle year, per section 6.5. **Both `done` and `not_applicable` count as satisfied**, per `FR-060`. Only `not_started` is outstanding.
5. If every requirement is satisfied, return `qualified`.
6. If any outstanding requirement's last valid day is already past for this cycle, return `notEligibleThisCycle` naming that requirement and the date it lapsed, satisfying `FR-063` and `FR-064`.
7. Otherwise return `actionNeeded` with the outstanding requirement whose last valid day is soonest, and that date, satisfying `FR-062`. Requirements with no deadline sort last.

**Why on the client.** It runs offline, it needs no round trip, it is trivially unit testable with fixture rules, and adding a new rule type requires only a server row plus a client release for the display string. Nothing about it benefits from running on a server.

---

## 8. Identity content pipeline

### 8.1 Source and license strategy

**Use Wikidata, not Wikipedia, for everything that ships.**

Wikidata's structured statements are released under a public domain dedication known as Creative Commons Zero, which imposes no share-alike obligation and no attribution requirement as a matter of law. Wikipedia article text is licensed share-alike with attribution, which is workable but drags obligations into the app for no product gain.

The practical consequence: person names, birth dates, death dates and the one-line description all come from Wikidata's own fields. Wikipedia article extracts are **not** used in version 1.0. This removes an entire category of licensing work.

Attribution is still shown for both, prominently, per `FR-027` and Jason's explicit instruction, because crediting the source is the right thing to do regardless of whether the license compels it.

### 8.2 No images in version 1.0

Version 1.0 ships **no celebrity photographs**. Person entries render as a name, a year, a description, and a typographic mark.

Two reasons. Images on Wikimedia Commons carry per-file licenses ranging from public domain to non-commercial, so each one needs an individual check and there is no safe bulk path. Separately, using a living person's likeness in a commercial product raises publicity rights questions that are independent of copyright.

This is a design decision, not a requirement. `NFR-062` is narrower than the decision: it forbids caching any image without a recorded license basis, which would still permit images if each one carried that record. Version 1.0 goes further and ships none at all. If images are added later they need a per-file license record and a legal review, not a bulk import.

### 8.3 Import

A scheduled Edge Function queries the Wikidata query service endpoint for people with a date of birth precise to the day, one calendar date at a time, and upserts into `notable_people`.

**Notability score** is the count of Wikipedia language editions that have an article about the person, which Wikidata exposes directly as sitelink count. It is a good, boring, defensible proxy: someone with articles in 80 languages is more notable than someone with two. It requires no editorial judgment and no model.

The import runs as a one-time backfill across all 366 dates, then monthly to catch new records. It is not a live query path. The query endpoint is rate limited and must never sit in front of a user request.

`FR-131` is enforced at import: a record whose birth date precision is year-only or month-only is discarded.

---

## 9. Day plan

### 9.1 The store hours problem, and the solution

MapKit does not expose business opening hours. This was verified against Apple's developer forums, where the conclusion is that the data is visible in the Apple Maps application but has no public property on `MKMapItem`. General-purpose places interfaces that do carry hours, such as Google Places, Yelp Fusion or Foursquare, cost money and add a vendor.

**We do not need a general places interface, because we do not have a general problem.** The catalog covers roughly 150 specific national chains. Chain hours are highly regular: most Starbucks locations open early and close mid-evening, most beauty retailers run mall hours. So hours become **a property of the brand, curated once, rather than a property of the location, fetched constantly.**

```json
{
  "mon": {"open": "05:00", "close": "21:00"},
  "sat": {"open": "05:30", "close": "21:30"},
  "sun": {"open": "05:30", "close": "20:00"}
}
```

These are gathered by stage 3 of the pipeline in section 10, alongside the reward rules, rather than by a manual pass. Chain hours are published on brand store-locator pages, so the same fetch that reads the terms can read the hours. The reviewer confirms them in the same pass they already do for the rules. It costs one extra field on 150 rows and it eliminates a paid vendor from the architecture.

The honest tradeoff is that typical hours are sometimes wrong for a specific location, so `FR-093` requires the interface to label them as typical for the brand rather than confirmed for that store, and to offer a tap through to Apple Maps for the real answer.

### 9.2 Nearest location

`MKLocalSearch` with a natural language query of the brand name, scoped to a region around the user, returns nearby `MKMapItem` values with coordinates and addresses. That covers `FR-091`. No key to manage, no bill, no vendor.

### 9.3 Weather

WeatherKit, which is included with an Apple Developer Program membership at a generous free call allowance. It supplies the daily high in degrees Fahrenheit and hourly precipitation chance for `FR-095` and `FR-096`.

### 9.4 Assembly

`DayPlanBuilder` is pure and takes everything as input: qualified offers, their redemption windows, brand typical hours, optional distances, optional forecast, and the current local time. It returns an ordered list plus advisories. It never calls a network. The feature layer gathers the inputs and hands them over, which keeps the ordering and at-risk logic in `FR-092` and `FR-094` fully unit testable against fixed clocks.

---

## 10. Extraction and review pipeline

Backend only. The app never touches it. **A language model is the primary aggregator at every stage except the last one**, which is a deliberate decision: the human is a checkpoint, not a researcher.

```
stage 1  DISCOVERY          model + search
         find candidate brands with birthday rewards, and for each,
         locate the brand's own loyalty terms page address
              │
stage 2  FETCH              plain request, then headless browser on failure
         archive the rendered page source with a retrieval timestamp
              │
stage 3  EXTRACTION         model
         propose rules, each with a verbatim quotation and a locator
         into the archived document. Also propose typical operating
         hours for the brand (section 9.1)
              │
stage 4  QUOTE CHECK        mechanical, no model
         exact string match of every quotation against the archived
         document. No match, no row. Nothing reaches a human unless
         its quotation provably exists in the source
              │
stage 5  HUMAN REVIEW       Jason
         approve or reject each quotation-to-rule mapping
              │
         publish at tier 'verified' with reviewer id and timestamp
```

**Stage 1 is why a brand list is not a bottleneck.** The model does the finding, the reading and the drafting. Discovery output enters at the `unconfirmed` tier immediately, so the catalog can reach 150 brands without waiting on review, and offers move up to `reported` and then `verified` as they progress through the stages.

**Stage 4 is the load-bearing one.** It is mechanical string matching, not judgment. A model that paraphrases, embellishes or invents produces a quotation that is not present in the archived source, and the proposal is discarded before any human time is spent on it. This turns hallucination into a build failure rather than a review burden, and it satisfies `FR-134`.

**Stage 5 is fast because of stage 4.** The reviewer reads one sentence and confirms that it means what the structured rule says. That is a few seconds per rule. They are never asked to evaluate a model's prose summary, which is the slow and error-prone version of the same task, and this is what `FR-136` requires.

**The automatic rejection step is the important one.** Before any human time is spent, every quotation is checked by exact string match against the archived source document. A model that paraphrases, embellishes or invents produces a quotation that is not present, and the proposal is dropped. This makes hallucination a mechanical failure rather than a judgment call, and it satisfies `FR-134`.

**The reviewer approves a quotation-to-rule mapping, never a prose summary.** This is `FR-136` and it is what keeps review fast. Reading one sentence and confirming it means what the structured rule says is a few seconds of work. Reading a model's summary and deciding whether to trust it is not.

**Reaching 150 offers.** The catalog target is 150 with at least 50 at the Verified tier, per `FR-052`. The three-tier design in `FR-045` is what makes that honest. Offers we have not fully confirmed still ship, visibly marked, with qualification tracking disabled and a warning attached. That is strictly better than the listicles, which present everything with identical confidence and are demonstrably wrong about Red Robin and Buffalo Wild Wings. The product promise becomes "we tell you what we know and what we do not," which is more defensible than a short list claiming perfection.

**Freshness.** A nightly job downgrades any Verified offer whose `terms_last_verified_at` is more than 180 days old, per `FR-048`. Another job flags offers whose archived source document has changed since the last fetch, which is the cheapest possible early warning that a brand quietly rewrote its terms.

---

## 11. Notifications design

Local notifications only. There is no push infrastructure in version 1.0, because every notification the product sends is computable on device from data already downloaded. That removes a whole subsystem.

Scheduling is idempotent. A single `NotificationScheduler` cancels all pending Birthed requests and rebuilds the full set from current state whenever anything relevant changes: birthday edited, offer state changed, catalog synced, time zone changed, permission granted.

Identifiers are deterministic, formed as `deadline.<offerId>.<cycleYear>` and similar, so a rebuild replaces rather than duplicates.

Consolidation in `FR-077` groups pending deadline notifications by fire date before scheduling, so three offers sharing a date produce one request.

The iOS pending-request limit is 64. The scheduler must respect it by scheduling only the nearest 60 requests and rebuilding on each app foreground. With consolidation this is not a practical constraint, but it must not be discovered in production.

---

## 12. Client services: sharing, entitlements and payments

### 12.1 Sharing

The share image is rendered on device with `ImageRenderer` over a SwiftUI view, satisfying `FR-117`. No server round trip and no network dependency.

`FR-118` defaults every personal field to off. The image carries the date, the notable names, and optionally the claimed count and value. No name, no age, no location unless each is explicitly turned on.

### 12.2 Entitlements and payments

StoreKit 2, with a single non-consumable auto-renewing annual subscription product. An `EntitlementStore` observes `Transaction.updates` and `Transaction.currentEntitlements` and publishes one boolean, `hasPro`. There is no receipt validation server, because StoreKit 2's on-device verification is signed by Apple and this product has no server-side entitlement to protect.

**What is gated, per `FR-141`:** the catalog beyond the free set, personal qualification tracking, deadline notifications, and the day plan. `FR-140` keeps every identity surface free with no entitlement check at all, because it is the funnel.

**Defining the free set, which `FR-141` previously left untestable.** "The first 15 offers" needs a deterministic order or a tester cannot say which 15 they are. The free set is therefore **not** a slice of a sorted list. It is an explicit flag, `is_free_tier boolean not null default false`, on `offers`, curated so the free set is a genuinely useful sample: the 15 highest-value Verified offers from distinct brands across at least four categories. This makes the free tier a product decision rather than an accident of sort order, makes it changeable from the server without an app release, and makes `FR-141` testable by counting rows where the flag is true.

**Honest limitation.** Section 6.6 makes the whole catalog readable by any signed-in client, anonymous included, so the gate is enforced in the client rather than in the database. A determined user can read the full catalog from the network layer. This is accepted deliberately: hiding the rows would break the offline cache and the catalog is public information republished from brand websites, so the value of the paid tier is the qualification engine, the deadline ladder and the day plan, none of which are data. If that judgment ever changes, the fix is a `select` policy on `offers` conditioned on an entitlement column on `profiles`, written by a server-side receipt check.

---

## 13. Privacy design

**Precise location never reaches Birthed's backend**, per `NFR-030`. Coordinates are used on device for `MKLocalSearch` and are passed to WeatherKit, which is Apple's own service. What the Birthed database stores is `region_code`, a postal code or city, supplied by the user.

**No contacts access** in version 1.0. There is no code path that requests it. This is worth noting in the App Store review notes because a birthday app not asking for contacts is unusual.

**Birth year is never transmitted to a third party**, per `NFR-032`, and is not included in analytics.

**Analytics carry a bucket, not a birthday.** `NFR-035` forbids sending the exact calendar birthday. Events carry a days-until-birthday bucket instead, such as `61_plus` or `8_to_14`, which is what the retention metric in `NFR-071` actually needs.

**Account deletion** removes the `auth.users` row. `profiles`, `user_offer_states` and `claims` cascade from it. Two tables deliberately do not, and both must be handled explicitly or `FR-014` is not met:

- `problem_reports.profile_id` is `on delete set null`, so the report survives without an owner. This is intentional, because a report is evidence about an offer rather than personal data, and `FR-114`'s duplicate detection depends on the row remaining. Nothing personally identifying is left behind once the identifier is nulled.
- `events.profile_id` carries no foreign key, so nothing happens to it automatically. A deletion routine must null it in the same transaction. This is a real gap in the naive design and it is the kind of thing that fails a privacy audit quietly.

Deletion is therefore a single Edge Function that nulls `events.profile_id`, then deletes the `auth.users` row and lets the cascades run.

---

## 14. Analytics

A single `events` table in Postgres, written through an Edge Function, rather than a third-party analytics vendor. The event volume for this product is small, keeping it in Postgres means the retention query in `NFR-071` is a plain database query rather than a vendor dashboard export, and it avoids adding a data processor to the privacy label.

```sql
create table events (
  id             bigserial primary key,
  profile_id     uuid,
  name           text not null,
  props          jsonb not null default '{}'::jsonb,
  days_to_bday_bucket text,
  app_version    text,
  created_at     timestamptz not null default now()
);
```

The one metric that matters most, from `PRD.md` section 14, is day 30 retention among users whose birthday is more than 60 days away. That is a query over this table with a bucket filter, and it should be on a dashboard from week one, because it is the number that tells you whether the identity bet is working.

---

## 15. Human and agent profile types

The entire provision is `profile_type` on `profiles`, plus the discipline that every version 1.0 query filters to `HUMAN`.

If agents ever arrive, the extension is: allow `AGENT` rows, give them a nullable `created_by` and a `deployment_date` that maps onto the same month and day fields, and add a labeled section to the day page. The identity content pipeline, the day page, the twin count and the share card all work unchanged, because they operate on `(month, day)` and know nothing about what kind of thing was born.

Nothing else in this document accommodates agents. If the human product does not work, this column costs nothing and is deleted in one migration.

---

## 16. Build order

**Slice 1, the first vertical slice.** One calendar date, end to end. A Wikidata import for September 4 only, into `notable_people`, served through Supabase, rendered as a day page in SwiftUI, with the share image. No accounts, no offers, no notifications. This proves the content pipeline produces something worth looking at, which is the largest genuinely new unknown in the project, and it produces a shareable artifact in week one.

**Slice 2.** The domain module. `BirthdayCalendar` and its full test suite from `NFR-003`, plus onboarding, the anonymous account, and the countdown. Nothing user-visible is hard here, but every date bug in the product's future is prevented in this slice.

**Slice 3.** Three offers with deliberately different rule shapes: Starbucks for advance signup plus an annually recurring prior purchase plus a tier-dependent window, Sephora for a birthday-month anchor plus per-channel minimum spend, and Dutch Bros for an app requirement plus a collection-anchored window. Full schema, the qualification engine, and the catalog screen. If the model handles these three it handles the other 147.

**Slice 4.** The notification ladder, on top of slice 3.

**Slice 5.** The pipeline worker and the catalog build-out to 150 brands. For the first 20 brands, review directly in the Supabase table editor rather than building a console. Build the purpose-made review screen only once the volume justifies it, which is somewhere past 100 rules.

**Slice 6.** The day plan, including the brand typical-hours curation pass, `MKLocalSearch` and WeatherKit.

**Slice 7.** Entitlements, paywall, App Store submission.

---

## 17. Open technical questions

1. **Wikidata query service rate limits for the initial backfill.** All 366 dates at up to 50 people each is a large one-time pull. It may need to run as a slow paced batch over several days, or come from a Wikidata database dump instead. This should be tested early in slice 1, since it is the only unknown that could change the plan.
2. **SwiftData under a 150-offer catalog with nested rules.** Expected to be fine, but if migration behavior proves painful, the domain layer's independence means swapping to GRDB touches only the data layer.
3. **`MKLocalSearch` result quality for chain names.** Searching a brand name near a user usually returns that brand's locations, but it is not contractually guaranteed and results for common words may be noisy. Needs a real-device check in slice 6.
4. **Anonymous to permanent account conversion.** Supabase supports it, but the exact behavior when the same Apple identity already has a permanent account elsewhere needs testing before shipping Sign in with Apple.
5. **WeatherKit call volume** against the included allowance, once the day plan is used by every user on their birthday. Expected to be far under, but worth measuring.
6. **App Store category.** `PRD.md` argues for Lifestyle rather than the Finance category Freebird chose. This affects discovery and should be decided before submission.
