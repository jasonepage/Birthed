-- What the world wrote about somebody, not what English Wikipedia clicked on.
-- CLAUDE.md section 5, "The ranking", decided by Nathan on September 22, 2026.
--
-- **The bug this is for.** notability_score is English monthly pageviews times
-- bonuses for being alive, modern, musical, a creator and on social media. It
-- was built to surface an internet person over a Bundesliga midfielder and it
-- does that well. What it also does, read as an ordering of a date:
--
--   December 16   Theo James first. Beethoven eighth. Jane Austen sixth.
--   October 2     a teenage footballer first. Gandhi below him.
--   November 30   Kaley Cuoco first, Churchill under her.
--   May 7         three footballers above Tagore, who has 245 languages.
--
-- A reader who came to a site about dates and found Beethoven eighth on his
-- own birthday told us, in effect, that the site is American and
-- entertainment heavy. They were right and this is the column that answers
-- them.
--
-- **sitelink_count is the world's opinion and it is already here.** It is how
-- many language Wikipedias wrote an article about this person: 245 for
-- Tagore, 273 for Beethoven, 339 at the top of the table, 3 at the bottom.
-- Nothing has to be fetched and nothing has to be re-imported.
--
-- **The blend, and why the square root.** world_score is
-- sqrt(monthly_views) * sitelink_count. Attention still counts, so Elvis,
-- Elon Musk, John Cena and Michael Jackson keep the dates they already lead
-- and a reader born on May 7 still finds MrBeast in the first handful. The
-- square root is what stops one viral English month outweighing four hundred
-- years in two hundred languages. Straight multiplication put the footballers
-- back; sitelinks alone dropped every living person off the top of every
-- date, which is not a date page anybody wants either.
--
-- **The two hard zeroes are kept.** notability_score is forced to nought for
-- the adult content and violent notoriety screens, worker/src/notability.ts,
-- and those people must never open a date page. A zero there is a zero here,
-- checked in the expression rather than left to the ordering.
--
-- Stored and generated, so it cannot drift from the columns it is made of,
-- and so an ordering on it is an index read rather than a sort over 25,741
-- rows. Nothing writes it and nothing can.

alter table notable_people
  add column world_score numeric
  generated always as (
    case
      when notability_score = 0 then 0
      else round(sqrt(greatest(monthly_views, 0)::numeric) * greatest(sitelink_count, 0))
    end
  ) stored;

create index notable_people_world_rank
  on notable_people (birth_month, birth_day, world_score desc);

comment on column notable_people.world_score is
  'How many languages wrote about somebody, weighed against how often English Wikipedia is read about them: sqrt(monthly_views) * sitelink_count, and nought for anybody the adult or violence screen has already zeroed. The order a date page puts people in. CLAUDE.md section 5, September 22, 2026.';
