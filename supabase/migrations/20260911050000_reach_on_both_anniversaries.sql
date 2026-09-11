-- The lower of the two anniversaries.
--
-- views_on_date averages the last two anniversaries. Measured on the real
-- September 11 subjects on September 11, 2026, the average could not tell a
-- memory from a main page feature: the Des Moines speech had 840 views one
-- September 11 and 16,224 the next, because Wikipedia's main page featured
-- it that day, and by ratio to its median of 25 it outscored the September
-- 11 attacks, which had 489,251 and 395,581. A thing people remember spikes
-- every year. A thing editors featured spikes once. The lower of the two
-- years keeps the first and drops the second, and it is what the panel's
-- points read from now. Null when the article has fewer than two
-- anniversaries of data, which the points call unmeasured rather than
-- crediting one number as "every year".
alter table article_reach add column if not exists views_on_date_low bigint;

comment on column article_reach.views_on_date_low is
  'The lower of the views on this date in each of the last two years. What the spike component of the curation points reads. Null when there are fewer than two anniversaries of data.';
