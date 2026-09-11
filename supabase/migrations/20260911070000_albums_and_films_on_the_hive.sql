-- Albums and films are pixels. docs/the-wall.md section 18, Nathan,
-- September 11, 2026: music, films, games, birthdays and television should
-- reach the hive more often. The site already keeps the Billboard 200 and
-- the United States box office beside the Hot 100, in chart_weeks; the
-- history seeder had filed only the songs. Two more kinds, keyed like a
-- song by the chart's issue date.
alter table wall_stories drop constraint if exists wall_stories_subject_kind_check;
alter table wall_stories add constraint wall_stories_subject_kind_check
  check (subject_kind = any (array['historical_event', 'birth_fact', 'cultural_event', 'person', 'song', 'album', 'film']));

comment on column wall_stories.subject_kind is
  'The imported row this story stands for: historical_event, birth_fact, cultural_event, person, or a chart week as song, album or film. Null for a news story. docs/the-wall.md sections 13 and 18.';
