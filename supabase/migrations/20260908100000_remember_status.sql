-- Why an answer was not taken, said out loud.
--
-- This is the third time one failure has worn another one's clothes on this
-- feature, and the third time it cost an evening, so this migration is about
-- the shape of the answer rather than about any one bug.
--
-- remember() returns a boolean. False means one of four different things: the
-- date has sealed, the window does not cover it, the token is too short, or
-- this browser has already answered this row. The page turned all four into
-- "This date is sealed", which is a claim about the date, and three of the
-- four are not about the date at all. The most common one by far is the last:
-- somebody taps a row they already answered, which is the single easiest
-- mistake to make on a page of a hundred and fifty rows where nothing on
-- screen says which ones you have done.
--
-- So the function says which. A boolean cannot be made honest by better copy
-- around it, because the information is not in it.
--
-- remember() stays, and is now a wrapper over this, so there is one
-- implementation rather than two that drift. The deployed website reads it as
-- a boolean today and keeps working while the clients move across.
create or replace function public.remember_status(
  month_in smallint,
  day_in smallint,
  subject_kind_in text,
  subject_id_in text,
  voter_token_in text,
  depth_in text,
  birth_year_in smallint default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  -- Not named "found". plpgsql owns that one and the insert below sets it.
  edition day_editions;
begin
  if length(coalesce(voter_token_in, '')) < 16 then
    return 'bad_token';
  end if;

  edition := open_edition(month_in, day_in);
  -- No edition means the window does not reach this date, or the date does not
  -- exist this year, which is 29 February three years in four. Not the same as
  -- sealed, and a page that says "come back on the day" is right for one and
  -- wrong for the other.
  if edition.id is null then
    return 'closed';
  end if;
  if edition.sealed_at is not null then
    return 'sealed';
  end if;

  insert into remembrances (edition_id, subject_kind, subject_id, voter_token, birth_year, depth)
  values (edition.id, subject_kind_in, subject_id_in, voter_token_in, birth_year_in, depth_in)
  on conflict (edition_id, subject_kind, subject_id, voter_token) do nothing;

  -- The conflict target is exactly one person answering one row once, so
  -- nothing else can land here.
  return case when found then 'kept' else 'already' end;
end;
$function$;

-- One implementation. The boolean is now derived from the reason rather than
-- computed alongside it, so the two can never disagree about whether an answer
-- was taken.
create or replace function public.remember(
  month_in smallint,
  day_in smallint,
  subject_kind_in text,
  subject_id_in text,
  voter_token_in text,
  depth_in text,
  birth_year_in smallint default null
)
returns boolean
language sql
security definer
set search_path to 'public'
as $function$
  select remember_status(month_in, day_in, subject_kind_in, subject_id_in,
                         voter_token_in, depth_in, birth_year_in) = 'kept';
$function$;

revoke all on function public.remember_status(smallint, smallint, text, text, text, text, smallint) from public;
grant execute on function public.remember_status(smallint, smallint, text, text, text, text, smallint) to anon, authenticated;
grant execute on function public.remember(smallint, smallint, text, text, text, text, smallint) to anon, authenticated;
