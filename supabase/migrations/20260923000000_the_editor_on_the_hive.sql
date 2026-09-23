-- The editor on the hive. Nathan's call, September 22, 2026.
--
-- The editor (20260922150000_the_editor) scores the found facts one to ten
-- for one question: would somebody born on this day stop scrolling and tell
-- a friend. It scored facts alone. The hive's board for everything nobody
-- has buzzed yet was ordered by a priority of 0 to 3 stamped by rules, which
-- put a film market trade item and the Emancipation Proclamation as equals.
--
-- This gives every story on the hive the same score, so the unbuzzed part
-- of the board and the comb open with what a person would tell a friend
-- about, before a single buzz. One buzz still beats every score: the
-- allocator weights by support wherever anybody has buzzed, and the score
-- only decides among stories nobody has. The score is written by the
-- rate-stories Edge Function and read by the worker's tick and the web.
-- It never overrides a person's buzz and it never changes a sealed board.

alter table wall_stories
  add column if not exists interest smallint check (interest between 1 and 10),
  add column if not exists interest_note text,
  add column if not exists rated_at timestamptz,
  add column if not exists rated_by text;

comment on column wall_stories.interest is
  'The editor''s one to ten: would somebody born on this day tell a friend. Orders the unbuzzed board and the comb; a buzz beats it. Written by rate-stories.';
comment on column wall_stories.interest_note is
  'The editor''s reason, five words at most. Read in the panel; never drawn on a page.';

-- The sweep asks for the unscored stories of the open dates.
create index if not exists wall_stories_unrated on wall_stories (wall_date) where rated_at is null;
