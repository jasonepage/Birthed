-- History on the hive. docs/the-wall.md section 13, decided September 10,
-- 2026, by Nathan: everything with a birthday today is a pixel. What
-- happened on this date, who was born on it and what came out on it join the
-- day's news in the one pool, take the same three buzzes a day, and can take
-- the square. The three answer remembrance game comes off the page; nothing
-- of it is dropped from the database.
--
-- A history story is a wall story whose subject is a row the importers
-- already hold. The worker files them when a date opens, with the row's own
-- link and the row's own words, submitted by nobody, like the news.

-- Which imported row a story stands for, when it stands for one. A news story
-- has neither. The pair is what stops the same event being filed twice on one
-- date, through url_key, which for a history story is the subject rather than
-- the page: forty events share one Wikipedia article and the article is not
-- what makes them distinct.
alter table wall_stories
  add column subject_kind text
    check (subject_kind in ('historical_event', 'birth_fact', 'cultural_event', 'person')),
  add column subject_id text,
  add constraint wall_stories_subject_whole check ((subject_kind is null) = (subject_id is null));

comment on column wall_stories.subject_kind is
  'The imported row this story stands for: historical_event, birth_fact, cultural_event or person. Null for a news story. docs/the-wall.md section 13.';
comment on column wall_stories.subject_id is
  'The id of that row in its own table, as text. A person is a Wikidata identifier.';

-- What goes first when a date opens. The square holds eight stories nobody
-- has backed yet, and section 13 decided they are the date's biggest history
-- rather than whichever feed item was read first. The allocator considers
-- higher priority first among stories with equal support and it decides
-- nothing else: a buzz still beats any priority.
alter table wall_stories
  add column priority smallint not null default 0 check (priority between 0 and 9);

comment on column wall_stories.priority is
  'Order among unbacked stories when the square has room: 3 a written line or Wikipedia''s pick for the date, 2 the most looked up people, 1 other history, 0 the news feeds. Set by the worker, read by the allocator, beaten by a single buzz.';

create index wall_stories_by_subject on wall_stories (wall_date, subject_kind, subject_id) where subject_kind is not null;

-- A source the importer already read. The checker fetches every other source
-- on every run and clears its verification when the page no longer carries
-- the quotation. An imported source is the row's own citation, read once by
-- the importer that wrote the row, and the checker leaves it alone: its
-- receipt says so rather than claiming a check that never ran.
alter table wall_sources
  add column imported boolean not null default false;

comment on column wall_sources.imported is
  'True when the importer that wrote the row read this page; the checker does not fetch it again and the receipt says so.';
