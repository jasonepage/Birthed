-- The editor, September 22, 2026.
--
-- Every found fact is scored by a model for one question, would somebody born
-- on this day tell a friend about it, and the score decides whether it is
-- shown. It replaces the human queue that new facts were waiting in: since
-- September 9 every new fact landed unverified and none has been published,
-- while the 2,471 published before then were never read by anybody. A person's
-- decision in the panel still wins over the score, always.
--
-- supabase/functions/_shared/editor.ts writes these. Nothing else does.

alter table birth_facts
  add column if not exists interest smallint check (interest between 1 and 10),
  add column if not exists interest_note text,
  add column if not exists rated_at timestamptz,
  add column if not exists rated_by text;

comment on column birth_facts.interest is
  'One to ten: would somebody born on this day tell a friend. Published at 7 and above unless a person reviewed the row. supabase/functions/_shared/editor.ts.';

-- The sweep reads the rows nobody has scored yet, a run at a time.
create index if not exists birth_facts_unrated
  on birth_facts (birth_month, birth_day, birth_year, region_key)
  where rated_at is null;
