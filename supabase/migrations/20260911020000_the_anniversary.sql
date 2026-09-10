-- The anniversary. docs/the-wall.md section 15 designed it and this is it on
-- the website: what you backed a year ago today, shown to you and to nobody
-- else, never as a number.
--
-- No new table. The boost row has the date on it, which is the whole of what
-- this needs: every buzz already records which story and which wall date, and
-- a wall date is a real calendar date with a year in it, so "the same day in
-- an earlier year" is a query rather than a schema.
--
-- It is added to wall_web_standing rather than given a function of its own.
-- That function is already called once on the request of any reader carrying
-- a token, it already answers the question "what has this browser done here",
-- and this is one more answer to it. A second function would be a second
-- round trip on the same page to the same table for the same browser.
--
-- **Nothing here is a number and nothing here is anybody else's.** Sections 6
-- and 8 refuse every score, and section 13's line about what the reversal
-- does not license still holds: no totals, no other token's buzzes, no count
-- of people. It returns the stories this one browser backed, with the wording
-- that is already public on the page, and it returns them only to the browser
-- that gave the token that made them.

create or replace function wall_web_standing(wall_date_in date, voter_token_in text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  today_e     date := (now() at time zone 'America/New_York')::date;
  booster     uuid;
  day         wall_days%rowtype;
  allowance   integer;
  spent       integer := 0;
  backed      jsonb := '[]'::jsonb;
  anniversary jsonb := '[]'::jsonb;
begin
  allowance := wall_boost_budget(today_e, wall_date_in);
  select * into day from wall_days where wall_date = wall_date_in;
  if day.wall_date is not null and (now() >= day.closes_at or day.closed_at is not null) then
    allowance := 0;
  end if;
  if length(coalesce(voter_token_in, '')) >= 16 then
    booster := wall_web_booster_id(voter_token_in);
    select coalesce(sum(units), 0) into spent
      from wall_boosts
     where booster_id = booster
       and wall_date = wall_date_in
       and (cast_at at time zone 'America/New_York')::date = today_e;
    select coalesce(jsonb_agg(story_id order by cast_at), '[]'::jsonb) into backed
      from wall_boosts
     where booster_id = booster
       and wall_date = wall_date_in;

    -- The same month and day, in an earlier year. Compared as month and day
    -- rather than by subtracting a year, because subtracting a year from
    -- February 29 lands on a date that does not exist and the reader born on
    -- it is exactly the reader this product is for.
    --
    -- Newest first, and bounded. A browser that has backed something on this
    -- date every year for a decade gets a page, not a scroll, and the page
    -- decides how many of them to draw.
    select coalesce(jsonb_agg(row order by (row ->> 'wall_date') desc), '[]'::jsonb)
      into anniversary
      from (
        select jsonb_build_object(
                 'story_id', b.story_id,
                 'headline', s.headline,
                 'wall_date', b.wall_date::text
               ) as row
          from wall_boosts b
          join wall_stories s on s.id = b.story_id
         where b.booster_id = booster
           and extract(month from b.wall_date) = extract(month from wall_date_in)
           and extract(day from b.wall_date) = extract(day from wall_date_in)
           and extract(year from b.wall_date) < extract(year from wall_date_in)
         order by b.wall_date desc, b.cast_at asc
         limit 10
      ) as rows;
  end if;
  return jsonb_build_object(
    'allowance', allowance,
    'left', greatest(0, allowance - spent),
    'backed', backed,
    'anniversary', anniversary
  );
end;
$$;

revoke all on function wall_web_standing(date, text) from public, authenticated;
grant execute on function wall_web_standing(date, text) to anon;

comment on function wall_web_standing(date, text) is
  'What one browser has done on one wall date: buzzes left today, the stories it backed, and the stories it backed on the same day in earlier years. Shown back to the browser that gave the token and to nobody else, and never as a number. docs/the-wall.md sections 13 and 15.';
