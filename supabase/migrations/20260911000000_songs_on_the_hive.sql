-- The number one songs are pixels. docs/the-wall.md section 16.
--
-- wall_stories_subject_kind_check listed the four kinds the history seeder
-- filed when it was written, and the seeder now files a fifth, "song", keyed
-- by the chart issue date. Without this the insert for a whole date was
-- refused with 23514 on every tick from the moment the seeder shipped, and
-- because the songs went in the same insert as the date's events and people,
-- the date's history went with them. The worker now files songs on their own
-- so a refused kind can never take the rest of the date down again; this is
-- the other half.

alter table wall_stories drop constraint if exists wall_stories_subject_kind_check;
alter table wall_stories add constraint wall_stories_subject_kind_check
  check (subject_kind = any (array['historical_event', 'birth_fact', 'cultural_event', 'person', 'song']));
