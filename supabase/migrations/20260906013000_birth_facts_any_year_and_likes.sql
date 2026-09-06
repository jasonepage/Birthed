-- Year 0 is "any year": facts about the calendar day itself, for people who
-- did not give a birth year. Cached once per date.
alter table birth_facts drop constraint if exists birth_facts_birth_year_check;
alter table birth_facts add constraint birth_facts_birth_year_check
  check (birth_year = 0 or birth_year between 1880 and 2100);

-- A thumbs up from one account on one fact. The count is what the app sorts
-- by, so the fact the most exact birthday sharers liked rises to the top.
-- One row per account per fact, and only your own row can be written or
-- removed. Anybody can count them.
create table if not exists birth_fact_likes (
  fact_id    bigint      not null references birth_facts (id) on delete cascade,
  user_id    uuid        not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (fact_id, user_id)
);
create index if not exists birth_fact_likes_fact_idx on birth_fact_likes (fact_id);

alter table birth_fact_likes enable row level security;
create policy count_birth_fact_likes on birth_fact_likes
  for select using (true);
create policy like_a_fact on birth_fact_likes
  for insert to authenticated with check (user_id = auth.uid());
create policy unlike_a_fact on birth_fact_likes
  for delete to authenticated using (user_id = auth.uid());
