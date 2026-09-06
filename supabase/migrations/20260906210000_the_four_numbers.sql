-- The four numbers, and a deliberate decision about how not to measure.
--
-- docs/first-five-minutes.md names four numbers and says not twenty:
-- how many people entered a birth year, how many added at least one person,
-- how many granted notification permission, and how many messages are sent
-- for every reminder delivered. The loop has been proved to work on a real
-- phone and nothing in the product can tell whether anybody walks it, which
-- is the last thing standing between here and TestFlight.
--
-- **This is why there is no analytics service.** The live privacy page says
-- the app contains no advertising, no analytics and no tracking of any kind,
-- and that there is no third party code in it that reports on you. Dropping
-- in PostHog or anything like it would make that sentence false on the day
-- Birthed ships, on a page that opens by saying it was written from what the
-- app does rather than from a template. The promise is worth more than the
-- flexibility, so the numbers ride on the profile row the app already writes,
-- and the privacy page is edited in the same commit as this file rather than
-- afterwards.
--
-- The first of the four needs nothing at all: birth_year is already on this
-- table, so "how many entered a year" is a count of rows where it is not null.
-- The other three are below, plus the length of the people list.
--
-- What this cannot do, written down so nobody is surprised in three months.
-- These are current totals and not events. There is no history, no timestamp,
-- no session, no screen, and no ordering, so no funnel, no cohort and no
-- retention curve can be built from them, and a question nobody thought to
-- ask in advance cannot be answered from old data. That is the trade. Wanting
-- more later is a real decision to reopen and it comes with rewriting that
-- privacy line and meaning it.

alter table profiles
  add column if not exists people_added_count smallint not null default 0,
  add column if not exists notification_permission_granted boolean not null default false,
  add column if not exists reminders_delivered_count integer not null default 0,
  add column if not exists messages_sent_count integer not null default 0;

alter table profiles
  add constraint profiles_counts_are_not_negative
  check (
    people_added_count >= 0
    and reminders_delivered_count >= 0
    and messages_sent_count >= 0
  );

comment on column profiles.people_added_count is
  'How many people are on this account holder''s People list. The number and nothing else: no name, no date, no note. The people list itself stays on the phone and this does not weaken that, because a length is not a list.';

comment on column profiles.notification_permission_granted is
  'Whether iOS has granted this phone notification permission, as the app last saw it. Goes back to false if permission is revoked, which is correct rather than a loss.';

comment on column profiles.reminders_delivered_count is
  'How many reminders have reached their moment on this phone, counted from the schedule rather than from Notification Centre, so that swiping notifications away does not undercount. Cumulative, reset only by deleting the app.';

comment on column profiles.messages_sent_count is
  'How many messages went after a reminder, counted when the iOS Messages composer reports that one was sent. Never the recipient, the words or the time. It undercounts on purpose: a message sent through the share sheet reports nothing back, so this is a floor rather than a rate.';

-- The queries this exists for. Written down because a number nobody knows how
-- to ask for is a column that quietly stops being maintained.
--
--   Entered a year:
--     select count(*) filter (where birth_year is not null), count(*)
--     from profiles where profile_type = 'HUMAN';
--
--   Added at least one person, which is the second half of activation:
--     select count(*) filter (where people_added_count > 0), count(*)
--     from profiles where profile_type = 'HUMAN';
--
--   Granted permission:
--     select count(*) filter (where notification_permission_granted), count(*)
--     from profiles where profile_type = 'HUMAN';
--
--   The one ratio the product lives or dies by:
--     select sum(messages_sent_count)::numeric
--          / nullif(sum(reminders_delivered_count), 0)
--     from profiles where profile_type = 'HUMAN';
