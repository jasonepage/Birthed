-- The anniversary spike: what an article does on the date itself.
--
-- views_year is reach, how many people look a thing up at all. These two
-- are the signal this site exists for: the views on this date, averaged over
-- the last two years, against the median day. A thing people bring up on the
-- day spikes; a thing editors think is important does not. Wikipedia's
-- selected anniversaries say what editors value. This says what people do.
alter table article_reach add column if not exists views_on_date bigint;
alter table article_reach add column if not exists views_median_day bigint;
