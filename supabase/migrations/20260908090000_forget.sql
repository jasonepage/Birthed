-- Taking one answer back, for a little while.
--
-- The first version of this made an answer permanent the instant it was given,
-- on the grounds that consequence is what r/place had instead of points. That
-- borrowed the wrong half of the analogy. Nothing on that canvas was final:
-- every pixel could be painted over by anybody, including by the person who
-- placed it, the moment their cooldown was up, and the thing churned for four
-- days. What was final was the ending. Sealing is already that, and it is
-- enough.
--
-- So a misclick can be taken back, and only a misclick. The reason for the
-- limit is not tidiness, it is the one hazard that letting people change their
-- minds actually creates: the result is on screen by the time you have
-- answered, so somebody who says "never heard of it" and then sees that ninety
-- percent of the room remembers it can feel foolish and switch. That is the
-- conformity problem coming back in through the exit door, and it is worse
-- than answering under a visible count, because the change is caused by the
-- number rather than merely coloured by it.
--
-- A misclick is noticed at once. Second thoughts about your place in the room
-- take longer than that. So the window is short, and it is enforced here
-- rather than on a device, for the same reason the answering window is: a
-- limit a client can argue with is not a limit.

alter table remember_settings
  add column if not exists undo_seconds smallint not null default 30
    check (undo_seconds between 0 and 3600);

-- Delete one of your own answers, if you gave it recently enough.
--
-- Deliberately narrow. It matches on the token as well as the row, so it can
-- only ever reach an answer the caller gave themselves, and it cannot touch a
-- sealed edition at all. Returns false rather than raising when there is
-- nothing to remove, because "too late" and "you never answered this" are the
-- same answer as far as a page is concerned.
create or replace function public.forget(
  month_in smallint,
  day_in smallint,
  subject_kind_in text,
  subject_id_in text,
  voter_token_in text
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  -- Not called "found". plpgsql has a special boolean of that name, set by
  -- every statement, and the delete below depends on it.
  edition day_editions;
  seconds smallint;
begin
  if length(coalesce(voter_token_in, '')) < 16 then
    return false;
  end if;

  select rs.undo_seconds into seconds from remember_settings rs where only_row;
  if seconds is null or seconds = 0 then
    return false;
  end if;

  select * into edition from day_editions
   where event_month = month_in
     and event_day = day_in
     and edition_year = extract(year from now())::smallint;
  if edition.id is null or edition.sealed_at is not null then
    return false;
  end if;

  delete from remembrances
   where edition_id = edition.id
     and subject_kind = subject_kind_in
     and subject_id = subject_id_in
     and voter_token = voter_token_in
     and created_at > now() - make_interval(secs => seconds);

  return found;
end;
$function$;

revoke all on function public.forget(smallint, smallint, text, text, text) from public;
grant execute on function public.forget(smallint, smallint, text, text, text) to anon, authenticated;
