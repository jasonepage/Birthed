-- The publishable key is public by design, so anyone can call the functions
-- that anonymous callers are allowed to reach. These are the limits that make
-- that safe: a gap between calls, a ceiling per hour, and a unique index so a
-- repeated press cannot become a repeated row.

-- Who is calling. Returns a salted hash of the caller's network address so we
-- never store the address itself. Cloudflare sets cf-connecting-ip and a
-- caller cannot forge it; x-forwarded-for is only a fallback.
create or replace function public.request_client_key()
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  h json;
  ip text;
begin
  begin
    h := current_setting('request.headers', true)::json;
  exception when others then
    return null;
  end;
  if h is null then
    return null;
  end if;
  ip := nullif(btrim(coalesce(h ->> 'cf-connecting-ip', '')), '');
  if ip is null then
    ip := nullif(btrim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), '');
  end if;
  if ip is null then
    return null;
  end if;
  return md5('birthed-throttle-v1:' || ip);
end;
$$;

-- One row per caller per protected function.
create table if not exists public.rpc_throttle (
  bucket       text not null,
  client_key   text not null,
  last_at      timestamptz not null default now(),
  window_start timestamptz not null default now(),
  hits         integer not null default 0,
  primary key (bucket, client_key)
);

alter table public.rpc_throttle enable row level security;
revoke all on public.rpc_throttle from anon, authenticated;
create index if not exists rpc_throttle_last_at_idx on public.rpc_throttle (last_at);

-- Returns true when the call is allowed. Enforces both a minimum gap between
-- calls and a ceiling per rolling window.
create or replace function public.rate_limit_ok(
  p_bucket         text,
  p_min_interval   interval,
  p_max_per_window integer,
  p_window         interval
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  ck         text := public.request_client_key();
  prev_last  timestamptz;
  prev_hits  integer;
  prev_start timestamptz;
begin
  -- If the caller cannot be identified we let the call through on purpose.
  -- The unique index and the fifty-per-code ceiling are the unconditional
  -- limits; this one is an extra layer and must never take the feature down
  -- by itself if the platform stops sending the header.
  if ck is null then
    return true;
  end if;

  if random() < 0.01 then
    delete from public.rpc_throttle where last_at < now() - interval '2 days';
  end if;

  select last_at, hits, window_start
    into prev_last, prev_hits, prev_start
  from public.rpc_throttle
  where bucket = p_bucket and client_key = ck
  for update;

  if not found then
    insert into public.rpc_throttle (bucket, client_key, last_at, window_start, hits)
    values (p_bucket, ck, now(), now(), 1)
    on conflict (bucket, client_key) do update
      set last_at = now(), hits = public.rpc_throttle.hits + 1;
    return true;
  end if;

  if p_min_interval > interval '0' and prev_last > now() - p_min_interval then
    update public.rpc_throttle set last_at = now()
      where bucket = p_bucket and client_key = ck;
    return false;
  end if;

  if prev_start < now() - p_window then
    update public.rpc_throttle
      set hits = 1, window_start = now(), last_at = now()
      where bucket = p_bucket and client_key = ck;
    return true;
  end if;

  if prev_hits >= p_max_per_window then
    update public.rpc_throttle set last_at = now()
      where bucket = p_bucket and client_key = ck;
    return false;
  end if;

  update public.rpc_throttle
    set hits = prev_hits + 1, last_at = now()
    where bucket = p_bucket and client_key = ck;
  return true;
end;
$$;

revoke all on function public.rate_limit_ok(text, interval, integer, interval) from public, anon, authenticated;
revoke all on function public.request_client_key() from public, anon, authenticated;

-- The same person and birthday can only land in the same collection once,
-- however many times the button is pressed.
create unique index if not exists birthday_replies_no_duplicates
  on public.birthday_replies (code, lower(btrim(name)), birth_month, birth_day, coalesce(birth_year, 0));

create or replace function public.leave_birthday(
  request_code text,
  person_name  text,
  month        integer,
  day          integer,
  year         integer default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  alive boolean;
begin
  if person_name is null or length(btrim(person_name)) = 0
     or month is null or month < 1 or month > 12
     or day is null or day < 1 or day > 31 then
    return;
  end if;

  -- At most one submission every two seconds, and twenty an hour, per caller.
  if not public.rate_limit_ok('leave_birthday', interval '2 seconds', 20, interval '1 hour') then
    return;
  end if;

  -- Housekeeping, occasionally, rather than a write on every public request.
  if random() < 0.05 then
    delete from birthday_requests where expires_at < now();
  end if;

  select true into alive
  from birthday_requests
  where code = request_code and expires_at >= now()
  limit 1;

  if alive is null then
    return;
  end if;

  if (select count(*) from birthday_replies where code = request_code) >= 50 then
    return;
  end if;

  insert into birthday_replies (code, name, birth_month, birth_day, birth_year)
  values (
    request_code,
    left(btrim(person_name), 60),
    month,
    day,
    case when year between 1900 and 2100 then year else null end
  )
  on conflict do nothing;
end;
$$;

create or replace function public.record_fact_events(
  seen   bigint[] default '{}'::bigint[],
  shared bigint[] default '{}'::bigint[]
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Generous ceiling: normal reading must never hit it, a script must.
  if not public.rate_limit_ok('record_fact_events', interval '0 seconds', 240, interval '1 hour') then
    return;
  end if;

  if coalesce(array_length(seen, 1), 0) between 1 and 60 then
    update birth_facts set impressions = impressions + 1 where id = any(seen);
  end if;
  if coalesce(array_length(shared, 1), 0) between 1 and 10 then
    update birth_facts set share_opens = share_opens + 1 where id = any(shared);
  end if;
end;
$$;
