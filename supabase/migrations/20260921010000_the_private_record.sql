-- The private record. docs/the-wall.md section 25.
--
-- One page, /yours/, listing the stories this browser has buzzed and what
-- became of each one. Shown to the browser that gave the token and to nobody
-- else, and never as a number of any kind.
--
-- No new table and no new column. Every buzz already records which story,
-- which wall date and which booster, every story already carries its status
-- and its headline, and section 23's verdicts are already in wall_outcomes.
-- This is a query over all of that and nothing more.
--
-- A function of its own rather than another field on wall_web_standing,
-- which is the opposite of what the anniversary did and for the opposite
-- reason: the anniversary rides on that function because the date page calls
-- it anyway, and this page calls nothing else at all. It also takes no wall
-- date, because the whole point of it is that it is not about one.
--
-- **Nothing here is a number and nothing here is anybody else's.** Sections 6
-- and 8 refuse every score, and section 25 carries the anniversary's rules
-- over whole: no total, no rank, no count of the people who backed the same
-- story, no comparison. What comes back is a list of rows, each one carrying
-- wording that is already public on the date page, and it comes back only to
-- the browser whose token made them.

create or replace function wall_web_record(voter_token_in text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  booster uuid;
  buzzes  jsonb := '[]'::jsonb;
begin
  -- A token too short to have been ours is not looked up at all. A reader
  -- with no cookie has buzzed nothing, and the empty list is the true
  -- answer rather than a refusal.
  if length(coalesce(voter_token_in, '')) < 16 then
    return jsonb_build_object('buzzes', buzzes);
  end if;
  booster := wall_web_booster_id(voter_token_in);

  -- One row per story, newest first, bounded. distinct on rather than a
  -- plain select because the one buzz per story rule lives in the clients
  -- and in the website's already check rather than in a constraint, and a
  -- record that listed the same headline twice would be the reader's
  -- problem to work out.
  --
  -- The verdict is the latest anniversary's, section 23, and is null on
  -- every row until September 9, 2027 because no outcome can exist before
  -- then. The status is the story's own and says whether it took a tile.
  select coalesce(jsonb_agg(row order by ord desc), '[]'::jsonb)
    into buzzes
    from (
      select jsonb_build_object(
               'story_id', mine.story_id,
               'headline', s.headline,
               'wall_date', mine.wall_date::text,
               'sealed', (now() >= d.closes_at or d.closed_at is not null),
               'status', s.status::text,
               'outcome', (
                 select o.outcome
                   from wall_outcomes o
                  where o.story_id = mine.story_id
                  order by o.anniversary desc
                  limit 1
               )
             ) as row,
             mine.cast_at as ord
        from (
          select distinct on (b.story_id) b.story_id, b.wall_date, b.cast_at
            from wall_boosts b
           where b.booster_id = booster
           order by b.story_id, b.cast_at desc
        ) as mine
        join wall_stories s on s.id = mine.story_id
        join wall_days d on d.wall_date = mine.wall_date
       order by mine.cast_at desc
       limit 200
    ) as rows;

  return jsonb_build_object('buzzes', buzzes);
end;
$$;

revoke all on function wall_web_record(text) from public, authenticated;
grant execute on function wall_web_record(text) to anon;

comment on function wall_web_record(text) is
  'Every story one browser has buzzed, with what became of each: whether its date has sealed, whether it took a tile, and its anniversary verdict once one exists. Shown back to the browser that gave the token and to nobody else, and never as a number. docs/the-wall.md section 25.';
