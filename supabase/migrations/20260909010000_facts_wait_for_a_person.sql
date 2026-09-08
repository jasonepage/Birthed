-- Found facts stop publishing themselves.
--
-- Every cultural_events row waits for a curator to press a key. Every
-- birth_facts row did not: find-facts fetched each cited page, asked whether
-- that page says what the row says, and wrote the answer straight into
-- `verified`, which is the column the site reads to decide what a reader sees.
-- So the model checking its own citation was also the thing publishing it, and
-- 2,411 sentences reached public pages with nobody having read one.
--
-- The check is good and it stays. It is simply not a decision. A citation that
-- holds up says the row is true. Whether a true thing belongs at the top of
-- somebody's birthday is a judgement about what is worth reading, and no fetch
-- answers it.

-- Who decided, and when, mirroring cultural_events. Null means nobody has.
alter table birth_facts
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists hidden_reason text;

comment on column birth_facts.reviewed_at is
  'When a person decided about this row. Null means nobody has, which is what puts it in the curation queue. verified says whether it is on a page; this says whether anybody chose that.';

create index if not exists birth_facts_waiting
  on birth_facts (birth_month, birth_day)
  where reviewed_at is null and birth_year = 0 and region_key = '';

-- Removal, which the panel had no way to do at all. Hiding stays the ordinary
-- action for the same reason a rejected culture row is kept: the record of
-- what the finder keeps proposing is what tells you the prompt is wrong.
create policy "admins delete facts"
  on birth_facts for delete
  to authenticated
  using (is_admin());

-- The finder's own check, kept apart from whether the row is on a page.
alter table birth_facts add column if not exists source_checked boolean;

comment on column birth_facts.source_checked is
  'The finder fetched the cited page and it answered. Advice to a curator, never a reason to publish.';

update birth_facts set source_checked = true where verified and source_checked is null;
update birth_facts set source_checked = false
  where not verified and source_checked is null
    and hidden_reason = 'the finder did not verify this when it wrote it';

-- Applied on 8 September 2026 against the live database, recorded here so the
-- migration history matches what the tables hold:
--
--   * 340 rows of category 'release' came off the pages. docs/internet-culture.md
--     calls a film opening or a record coming out the filler this site exists
--     to replace, and every one of those had published itself.
--   * 318 rows the finder had already declined were marked with that as their
--     hidden_reason, so they read as the finder's rejects rather than as a
--     backlog waiting on a person.
