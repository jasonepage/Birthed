-- The merged timeline on a date page draws from three tables, not two. A
-- researched line out of birth_facts sits beside a Wikipedia line and a curated
-- cultural row, and a reader answering "I was there" has no idea which table it
-- came from, nor should they. The constraint knew about three kinds and the
-- page renders four.
alter table remembrances drop constraint if exists remembrances_subject_kind_check;
alter table remembrances add constraint remembrances_subject_kind_check
  check (subject_kind in ('moment', 'cultural_event', 'historical_event', 'birth_fact', 'person'));
