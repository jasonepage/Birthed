-- The article a history row is about.
--
-- Every row in historical_events cites the Wikipedia date page it was read
-- from, all 19,734 of them, 366 distinct addresses. That is the right
-- receipt and the wrong thing to measure: the reach measurement in
-- article_reach asks how many people look a thing up, and the date page is
-- the same number on every line of the date. measure-reach correctly
-- refuses it ("cites the date page, not an article"), so with the table as
-- it was, a successful run would have measured nothing from history.
--
-- Wikipedia's own markup links the subject of each line. The importer now
-- keeps that one link, chosen by the rule in worker/src/subject.ts and
-- pinned against real lines in worker/test/subject.test.ts, and writes it
-- here as a full address in the same shape as source_url. Null means the
-- rule could not name a subject without guessing, which is a fact about the
-- row and not a gap to fill in later: a wrong article here is a city's
-- pageviews ranking a skirmish above the thing everybody remembers.
--
-- source_url is untouched. The receipt still says where the sentence came
-- from; this says what it is about.
alter table historical_events add column if not exists subject_url text;

comment on column historical_events.subject_url is
  'The Wikipedia article this line is about, as a full address, chosen from the line''s own links by worker/src/subject.ts. Null when no link names the subject without guessing. What article_reach is measured on for this row; source_url stays the date page the sentence was read from.';

-- Only rows that name an article are ever measured, so the measurement reads
-- this column by date and skips the nulls.
create index if not exists historical_events_subject_by_date
  on historical_events (event_month, event_day)
  where subject_url is not null;
