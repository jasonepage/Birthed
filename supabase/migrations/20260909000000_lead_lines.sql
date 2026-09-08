-- A short human sentence for the card, written by a person, for one row.
--
-- The site asks one question above the fold: do you remember this one. Which
-- row it asks about was chosen by arithmetic until now, and on 8 September 2026
-- that arithmetic was measured against the live September 8 page and found to
-- be doing the opposite of its job.
--
-- Fourteen rows on that date are from 1958 on. Exactly one could be a card,
-- because thirteen were longer than the limit. Star Trek going out for the
-- first time is 139 characters. Mark McGwire's 62nd home run is 168. What fits
-- in ninety four is a routine space station resupply flight, and that is what
-- the page led with, every reload, because it was alone.
--
-- Raising the limit helps and does not fix it. Between "The science fiction
-- television series Star Trek made its broadcast television debut in the
-- United States on NBC with the episode The Man Trap" and "UNESCO proclaimed
-- International Literacy Day to highlight the importance of literacy for people
-- and communities globally", the scorer takes the second, because it is
-- eighteen characters shorter. Nothing measurable about those two sentences
-- says which one anybody remembers. A person knows instantly.
--
-- So this table is where the judgement goes. One row here is one row of the
-- timeline, said the way a person would say it:
--
--   "Star Trek went out for the first time."
--
-- It is not a correction and it is not a new claim. The row keeps its own
-- sentence and its own source, and the feed still prints them. This is the
-- card's wording only, which is why there is no source column: a line that
-- needed its own source would be a fact, and facts go in the tables that
-- already exist for them.
create table if not exists lead_lines (
  id bigint generated always as identity primary key,
  -- Which row this is the card wording for. The same pair the answer forms
  -- carry, so a lead line is attached to the thing a reader answers about and
  -- not to a position in a list, which moves.
  subject_kind text not null check (subject_kind in ('historical_event', 'birth_fact', 'cultural_event')),
  subject_id text not null,
  -- Carried as well as the pair, because the build reads a date at a time and
  -- joining on it is one request instead of three.
  event_month smallint not null check (event_month between 1 and 12),
  event_day smallint not null check (event_day between 1 and 31),
  -- The sentence. Capped where the card is comfortable at two lines on a
  -- phone, and floored above nothing, because an empty line would blank the
  -- card rather than fall back to the row.
  line text not null check (char_length(btrim(line)) between 8 and 190),
  written_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_kind, subject_id)
);

create index if not exists lead_lines_by_date on lead_lines (event_month, event_day);

alter table lead_lines enable row level security;

-- Everybody reads. The build is an anonymous caller and this is the wording
-- that goes on a public page, so there is nothing here to withhold.
create policy "anyone reads lead lines"
  on lead_lines for select
  to anon, authenticated
  using (true);

-- Only a curator writes. is_admin() is the security definer check against the
-- allowlist, not the JWT claim, for the reason given where it was defined:
-- every iOS reader holds a valid token because the app signs everyone in
-- anonymously, so verify_jwt alone would let any reader write the words at the
-- top of a page.
create policy "admins write lead lines"
  on lead_lines for insert
  to authenticated
  with check (is_admin());

create policy "admins change lead lines"
  on lead_lines for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "admins remove lead lines"
  on lead_lines for delete
  to authenticated
  using (is_admin());
