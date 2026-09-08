-- Curators are allowed by address, not by account id.
--
-- The version before this keyed on auth.users(id), which cannot be written
-- until the person has signed in at least once. So adding a curator meant
-- inviting them, waiting for them to arrive, finding their id and coming back
-- to finish the job. An address can be allowed before the account behind it
-- exists, and access simply begins the first time they sign in.

create table if not exists admin_emails (
  email      text primary key,
  note       text,
  added_at   timestamptz not null default now()
);

alter table admin_emails enable row level security;

create policy read_admin_emails on admin_emails
  for select to authenticated using (is_admin());

-- Checked against auth.users rather than against the email claim in the token.
--
-- The claim is signed by the auth service and would be enough on its own, but
-- the table carries two things the claim does not: whether the address was
-- ever confirmed, and whether the account is an anonymous one.
--
-- That second test is the one that matters here. The iOS app signs everybody
-- in anonymously on first launch, so without it every reader of the app would
-- be a single row in this table away from being able to write to the date
-- pages, and the row would look completely reasonable sitting there.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    join admin_emails a on lower(u.email) = a.email
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and coalesce(u.is_anonymous, false) = false
  );
$$;

revoke all on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

drop table if exists admins;
