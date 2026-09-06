-- A like on the subject, not on the sentence.
--
-- "The world when you arrived" wants likes so that adding more lines like it
-- is an informed decision rather than a guess. The obvious way to do that does
-- not work, and the reason is worth writing down before somebody tries it.
--
-- A found fact is one row per date. Everybody born September 4 sees the same
-- row, so likes land on one object and the five vote floor in FactOrder means
-- something. A world line is computed per reader: "You are 6 years older than
-- Minecraft" only exists for people born in one year, and its identity in the
-- code is the subject plus that exact sentence. Somebody born September 4,
-- 2015 sees a different sentence about the same game. Likes on the sentence
-- would therefore never aggregate, would sit at zero forever, and a control
-- showing zero forever is precisely why docs/first-five-minutes.md shelved
-- likes in the first place.
--
-- So the like is on the subject. Minecraft, ChatGPT, Instagram, the iPhone.
-- Every reader who sees any sentence about Minecraft is voting on the same
-- row, whatever their birth year, and the question the counts answer is the
-- one actually being asked: which of these should there be more of.
--
-- The subject key is the line's kicker, lowercased. That is already the stable
-- handle: MyDayView stores the reader's preferred lead line by kicker for the
-- same reason, because position moves when a timeline is extended and the
-- sentence changes on every birthday.

create table if not exists world_subject_likes (
  subject    text        not null check (subject = lower(subject) and length(subject) between 1 and 60),
  user_id    uuid        not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (subject, user_id)
);

create index if not exists world_subject_likes_subject_idx
  on world_subject_likes (subject);

comment on table world_subject_likes is
  'One thumbs up from one account on one world-when-you-arrived subject, keyed by the line kicker in lower case. Never on the sentence, which is computed per reader and could not aggregate. Nothing here says which sentence anybody saw or what year they were born.';

alter table world_subject_likes enable row level security;

-- The same three policies as birth_fact_likes, and for the same reasons:
-- anybody may count, only your own row may be written, only your own row may
-- be removed.
create policy count_world_subject_likes on world_subject_likes
  for select using (true);
create policy like_a_world_subject on world_subject_likes
  for insert to authenticated with check (user_id = auth.uid());
create policy unlike_a_world_subject on world_subject_likes
  for delete to authenticated using (user_id = auth.uid());

-- One request for every subject's total, rather than one request per subject.
--
-- security_invoker so the view is read with the caller's own permissions and
-- the policy above is what decides, rather than the view owner's. The counts
-- are an aggregate over a table anybody may already count, so nothing is
-- exposed that was not already, and Supabase's advisor does not have to be
-- argued with the way twin_count had to be.
create or replace view world_subject_like_counts
with (security_invoker = true) as
  select subject, count(*)::int as likes
  from world_subject_likes
  group by subject;

comment on view world_subject_like_counts is
  'Totals per subject, in one request. The app hides a total below five, the same floor FactOrder uses, because a row of zeros teaches a reader that nobody is here.';
