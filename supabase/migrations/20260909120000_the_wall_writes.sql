-- The wall, session two: the write path. docs/the-wall.md is the authority
-- for every rule in here, and section 10 records what this session decided.
--
-- Until now every wall table had public reads and no way to write. This
-- migration adds the two ways in, both security definer functions granted to
-- the authenticated role only:
--
--   wall_submit_story(url, wall_date)   a link becomes a story in the pool
--   wall_cast_boost(story, units, request)   units go on a story
--
-- Clients never insert into wall_stories, wall_sources, wall_checks or
-- wall_boosts, and no insert policy is added for any of them. The wording on
-- the wall is the source page's: the submit function fetches the page itself,
-- through the http extension, and takes the headline and outlet from its Open
-- Graph tags, falling back to the title element. A caller cannot supply a
-- headline, and there is no argument through which one could arrive.
--
-- The budget, the snapshots of tier and support on every boost, and the
-- refusal of every update and delete on wall_boosts are the triggers from the
-- first migration, untouched. The boost function inserts a row and lets them
-- do their work.
--
-- Bots. App Attest is the anti-bot control and it guards writes only. Apple's
-- attestation cannot be checked in SQL, so the wall-write Edge Function
-- checks it and then, with the service role, writes a short lived grant for
-- the account. Both functions here consume one grant per call and refuse to
-- run without one. A client that calls the function directly with its own
-- token, skipping the Edge Function, finds no grant and is refused. Reading
-- needs nothing.

-- ---------------------------------------------------------------------------
-- The http extension, for fetching the submitted page inside the database
-- ---------------------------------------------------------------------------

create extension if not exists http with schema extensions;

-- ---------------------------------------------------------------------------
-- Who owns an outlet
-- ---------------------------------------------------------------------------

-- Reported means two sources under different corporate ownership, and
-- wall_sources.owner was a text column nothing filled outside the seed. This
-- is the table the owner is resolved through. A domain that is not here is
-- its own owner, so an unknown outlet is never silently grouped with, or
-- separated from, anything. Ownership changes hands; this is a snapshot as of
-- September 2026 and rows are edited as the world moves.
create table wall_outlet_owners (
  domain      text primary key,
  -- The owning group, as plainly as it can be named. Two sources count as
  -- independent only when this differs.
  owner       text not null,
  note        text,
  updated_at  timestamptz not null default now(),

  constraint wall_outlet_owners_domain_is_a_host check (domain = lower(domain) and domain !~ '[/\s]')
);

comment on table wall_outlet_owners is
  'Which corporate group owns which news domain. docs/the-wall.md section 5. An unknown domain is its own owner.';

insert into wall_outlet_owners (domain, owner) values
  -- Wires and agencies
  ('apnews.com',            'The Associated Press'),
  ('reuters.com',           'Thomson Reuters'),
  ('afp.com',               'Agence France-Presse'),
  ('bloomberg.com',         'Bloomberg L.P.'),
  -- Public broadcasters
  ('npr.org',               'National Public Radio'),
  ('pbs.org',               'Public Broadcasting Service'),
  ('bbc.com',               'British Broadcasting Corporation'),
  ('bbc.co.uk',             'British Broadcasting Corporation'),
  ('cbc.ca',                'Canadian Broadcasting Corporation'),
  ('abc.net.au',            'Australian Broadcasting Corporation'),
  ('dw.com',                'Deutsche Welle'),
  ('france24.com',          'France Medias Monde'),
  ('rfi.fr',                'France Medias Monde'),
  ('aljazeera.com',         'Al Jazeera Media Network'),
  -- New York Times Company
  ('nytimes.com',           'The New York Times Company'),
  ('theathletic.com',       'The New York Times Company'),
  -- Nash Holdings
  ('washingtonpost.com',    'Nash Holdings'),
  -- News Corp
  ('wsj.com',               'News Corp'),
  ('nypost.com',            'News Corp'),
  ('barrons.com',           'News Corp'),
  ('marketwatch.com',       'News Corp'),
  ('thetimes.com',          'News Corp'),
  ('thetimes.co.uk',        'News Corp'),
  ('thesun.co.uk',          'News Corp'),
  ('theaustralian.com.au',  'News Corp'),
  ('news.com.au',           'News Corp'),
  -- Fox Corporation, separate from News Corp since 2019
  ('foxnews.com',           'Fox Corporation'),
  ('foxbusiness.com',       'Fox Corporation'),
  -- Comcast
  ('nbcnews.com',           'Comcast'),
  ('cnbc.com',              'Comcast'),
  ('telemundo.com',         'Comcast'),
  ('sky.com',               'Comcast'),
  ('news.sky.com',          'Comcast'),
  -- Warner Bros. Discovery
  ('cnn.com',               'Warner Bros. Discovery'),
  ('edition.cnn.com',       'Warner Bros. Discovery'),
  -- Paramount
  ('cbsnews.com',           'Paramount Skydance'),
  -- The Walt Disney Company
  ('abcnews.go.com',        'The Walt Disney Company'),
  ('abcnews.com',           'The Walt Disney Company'),
  ('espn.com',              'The Walt Disney Company'),
  -- Gannett
  ('usatoday.com',          'Gannett'),
  ('azcentral.com',         'Gannett'),
  ('dispatch.com',          'Gannett'),
  ('tennessean.com',        'Gannett'),
  ('indystar.com',          'Gannett'),
  ('courier-journal.com',   'Gannett'),
  ('freep.com',             'Gannett'),
  ('statesmanjournal.com',  'Gannett'),
  ('registerguard.com',     'Gannett'),
  -- Alden Global Capital, through MediaNews Group and Tribune Publishing
  ('chicagotribune.com',    'Alden Global Capital'),
  ('nydailynews.com',       'Alden Global Capital'),
  ('denverpost.com',        'Alden Global Capital'),
  ('mercurynews.com',       'Alden Global Capital'),
  ('orlandosentinel.com',   'Alden Global Capital'),
  ('bostonherald.com',      'Alden Global Capital'),
  ('ocregister.com',        'Alden Global Capital'),
  -- Hearst
  ('sfchronicle.com',       'Hearst'),
  ('houstonchronicle.com',  'Hearst'),
  ('chron.com',             'Hearst'),
  ('seattlepi.com',         'Hearst'),
  ('timesunion.com',        'Hearst'),
  -- Lee Enterprises
  ('stltoday.com',          'Lee Enterprises'),
  ('buffalonews.com',       'Lee Enterprises'),
  ('richmond.com',          'Lee Enterprises'),
  ('omaha.com',             'Lee Enterprises'),
  ('tucson.com',            'Lee Enterprises'),
  -- Advance Publications, including Conde Nast
  ('oregonlive.com',        'Advance Publications'),
  ('nj.com',                'Advance Publications'),
  ('al.com',                'Advance Publications'),
  ('cleveland.com',         'Advance Publications'),
  ('syracuse.com',          'Advance Publications'),
  ('mlive.com',             'Advance Publications'),
  ('newyorker.com',         'Advance Publications'),
  ('wired.com',             'Advance Publications'),
  ('vanityfair.com',        'Advance Publications'),
  -- McClatchy, owned by Chatham Asset Management
  ('miamiherald.com',       'Chatham Asset Management'),
  ('sacbee.com',            'Chatham Asset Management'),
  ('kansascity.com',        'Chatham Asset Management'),
  ('charlotteobserver.com', 'Chatham Asset Management'),
  ('star-telegram.com',     'Chatham Asset Management'),
  -- Nexstar Media Group
  ('thehill.com',           'Nexstar Media Group'),
  ('newsnationnow.com',     'Nexstar Media Group'),
  ('koin.com',              'Nexstar Media Group'),
  ('kxan.com',              'Nexstar Media Group'),
  -- Tegna
  ('kgw.com',               'Tegna'),
  ('king5.com',             'Tegna'),
  ('wusa9.com',             'Tegna'),
  -- Sinclair
  ('katu.com',              'Sinclair'),
  ('komonews.com',          'Sinclair'),
  -- Gray Media
  ('kptv.com',              'Gray Media'),
  -- E.W. Scripps
  ('scrippsnews.com',       'The E.W. Scripps Company'),
  -- Axel Springer
  ('politico.com',          'Axel Springer'),
  ('politico.eu',           'Axel Springer'),
  ('businessinsider.com',   'Axel Springer'),
  ('welt.de',               'Axel Springer'),
  ('bild.de',               'Axel Springer'),
  -- Cox Enterprises
  ('axios.com',             'Cox Enterprises'),
  ('ajc.com',               'Cox Enterprises'),
  -- Single title owners
  ('latimes.com',           'Patrick Soon-Shiong'),
  ('bostonglobe.com',       'Boston Globe Media Partners'),
  ('startribune.com',       'Glen Taylor'),
  ('inquirer.com',          'The Lenfest Institute for Journalism'),
  ('seattletimes.com',      'The Seattle Times Company'),
  ('tampabay.com',          'Times Publishing Company'),
  ('time.com',              'Marc Benioff'),
  ('theatlantic.com',       'Emerson Collective'),
  ('forbes.com',            'Integrated Whale Media Investments'),
  ('newsweek.com',          'Newsweek Publishing'),
  ('economist.com',         'The Economist Group'),
  -- Nikkei
  ('ft.com',                'Nikkei'),
  ('nikkei.com',            'Nikkei'),
  ('asia.nikkei.com',       'Nikkei'),
  -- Vox Media
  ('vox.com',               'Vox Media'),
  ('theverge.com',          'Vox Media'),
  -- United Kingdom
  ('theguardian.com',       'Guardian Media Group'),
  ('dailymail.co.uk',       'Daily Mail and General Trust'),
  ('metro.co.uk',           'Daily Mail and General Trust'),
  ('inews.co.uk',           'Daily Mail and General Trust'),
  ('mirror.co.uk',          'Reach plc'),
  ('express.co.uk',         'Reach plc'),
  ('dailystar.co.uk',       'Reach plc'),
  ('manchestereveningnews.co.uk', 'Reach plc'),
  ('telegraph.co.uk',       'Telegraph Media Group'),
  ('independent.co.uk',     'Independent Digital News and Media'),
  -- Canada
  ('nationalpost.com',      'Postmedia Network'),
  ('torontosun.com',        'Postmedia Network'),
  ('thestar.com',           'Torstar'),
  -- Australia
  ('smh.com.au',            'Nine Entertainment'),
  ('theage.com.au',         'Nine Entertainment'),
  ('9news.com.au',          'Nine Entertainment'),
  -- Governments and agencies whose statements are seen directly
  ('nasa.gov',              'United States government'),
  ('whitehouse.gov',        'United States government'),
  ('justice.gov',           'United States government'),
  ('sciencedaily.com',      'ScienceDaily');

alter table wall_outlet_owners enable row level security;
create policy wall_outlet_owners_public_read on wall_outlet_owners for select using (true);
revoke insert, update, delete on wall_outlet_owners from anon, authenticated;

-- The outlet a page belongs to: its host, lowercased, with no www.
-- worker/src/wall/url.ts outletOf, the same rule.
create function wall_outlet_of(url_in text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  host text;
begin
  host := lower((regexp_match(btrim(url_in), '^https?://([^/?#]+)', 'i'))[1]);
  if host is null then
    raise exception 'wall: not a web address: %', url_in;
  end if;
  host := regexp_replace(host, ':(80|443)$', '');
  host := regexp_replace(host, ':\d+$', '');
  if host like 'www.%' then host := substr(host, 5); end if;
  return host;
end;
$$;

-- Who owns a host. The host itself first, then each parent domain, so
-- edition.cnn.com resolves through cnn.com, and a host that matches nothing
-- is its own owner rather than being grouped with anything.
create function wall_owner_of(host_in text)
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  host   text := lower(btrim(host_in));
  found  text;
  parts  text[];
  i      integer;
begin
  if host like 'www.%' then host := substr(host, 5); end if;
  parts := string_to_array(host, '.');
  for i in 1 .. greatest(array_length(parts, 1) - 1, 1) loop
    select owner into found from wall_outlet_owners
     where domain = array_to_string(parts[i:array_length(parts, 1)], '.');
    if found is not null then return found; end if;
  end loop;
  return host;
end;
$$;

-- ---------------------------------------------------------------------------
-- The address key
-- ---------------------------------------------------------------------------

-- worker/src/wall/url.ts normalizeUrl, in SQL, so the database refuses a
-- duplicate under the same rule the worker uses. What it does: lowercase the
-- host, drop a leading www, force https, drop the fragment, remove every
-- parameter starting utm_, remove the tracking parameters listed, remove s
-- only on x.com and twitter.com, sort what is left, strip one trailing slash.
-- What it never does: remove a parameter that changes which page you see.
-- worker/test/wall-url-sql.test.ts holds the two to the same answers.

-- One query value, decoded and re-encoded the way URLSearchParams prints it:
-- letters, digits, star, hyphen, dot and underscore as they are, a space as a
-- plus, everything else as percent and two uppercase hexadecimal digits.
create function wall_form_encode(value_in text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  raw     bytea;
  out     text := '';
  i       integer;
  b       integer;
begin
  raw := convert_to(value_in, 'UTF8');
  for i in 0 .. length(raw) - 1 loop
    b := get_byte(raw, i);
    if (b between 48 and 57) or (b between 65 and 90) or (b between 97 and 122)
       or b in (42, 45, 46, 95) then
      out := out || chr(b);
    elsif b = 32 then
      out := out || '+';
    else
      out := out || '%' || upper(lpad(to_hex(b), 2, '0'));
    end if;
  end loop;
  return out;
end;
$$;

-- Percent escapes and plus signs undone, the way URLSearchParams reads them.
create function wall_form_decode(value_in text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  s       text := replace(value_in, '+', ' ');
  out     bytea := '\x'::bytea;
  i       integer := 1;
  n       integer := length(s);
  c       text;
  hex     text;
begin
  while i <= n loop
    c := substr(s, i, 1);
    if c = '%' and i + 2 <= n and substr(s, i + 1, 2) ~ '^[0-9A-Fa-f]{2}$' then
      hex := substr(s, i + 1, 2);
      out := out || decode(hex, 'hex');
      i := i + 3;
    else
      out := out || convert_to(c, 'UTF8');
      i := i + 1;
    end if;
  end loop;
  return convert_from(out, 'UTF8');
end;
$$;

create function wall_url_key(url_in text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  raw      text := btrim(url_in);
  m        text[];
  host     text;
  port     text;
  path     text;
  query    text;
  pair     text;
  name     text;
  value    text;
  key      text;
  kept     text[] := '{}';
  pairs    text[];
  parts    text[];
  i        integer;
  tracking text[] := array['fbclid', 'gclid', 'msclkid', 'igshid', 'mc_cid', 'mc_eid',
                           'ref', 'ref_src', 'cmpid', 'si', 'spm'];
begin
  m := regexp_match(raw, '^([A-Za-z][A-Za-z0-9+.-]*)://([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$');
  if m is null or lower(m[1]) not in ('http', 'https') then
    raise exception 'wall: not a web address: %', url_in;
  end if;

  host := lower(m[2]);
  -- Credentials in an address are not part of which page you see.
  if position('@' in host) > 0 then host := split_part(host, '@', 2); end if;
  port := '';
  if host ~ ':\d+$' then
    port := substring(host from ':(\d+)$');
    host := regexp_replace(host, ':\d+$', '');
    if port in ('80', '443') then port := ''; else port := ':' || port; end if;
  end if;
  if host like 'www.%' then host := substr(host, 5); end if;

  path := coalesce(m[3], '');
  if length(path) > 1 and path like '%/' then path := left(path, length(path) - 1); end if;
  if path = '/' then path := ''; end if;

  query := coalesce(substr(m[4], 2), '');
  if query <> '' then
    pairs := string_to_array(query, '&');
    for i in 1 .. array_length(pairs, 1) loop
      pair := pairs[i];
      if pair = '' then continue; end if;
      if position('=' in pair) > 0 then
        name := wall_form_decode(split_part(pair, '=', 1));
        value := wall_form_decode(substr(pair, position('=' in pair) + 1));
      else
        name := wall_form_decode(pair);
        value := '';
      end if;
      key := lower(name);
      if key like 'utm\_%' then continue; end if;
      if key = any (tracking) then continue; end if;
      if key = 's' and host in ('x.com', 'twitter.com') then continue; end if;
      kept := kept || (wall_form_encode(name) || '=' || wall_form_encode(value));
    end loop;
  end if;

  -- Sorted by name then value, the way the worker sorts, in byte order.
  select coalesce(string_agg(k, '&' order by split_part(k, '=', 1) collate "C", substr(k, position('=' in k) + 1) collate "C"), '')
    into query
    from unnest(kept) as k;

  return 'https://' || host || port || path || case when query <> '' then '?' || query else '' end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading a page: text, entities, and whether it contains a quotation
-- ---------------------------------------------------------------------------

-- Named character references undone. Enough for what appears in a headline
-- or a description; anything not listed stays as written.
create function wall_html_decode(text_in text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  s     text := text_in;
  code  text;
  n     integer;
begin
  if s is null then return null; end if;
  -- Numeric references first, so that an encoded ampersand is not decoded
  -- twice.
  for code in select distinct m[1] from regexp_matches(s, '&#[xX]([0-9A-Fa-f]{1,6});', 'g') as m loop
    n := ('x' || code)::bit(32)::integer;
    if n between 1 and 1114111 and not (n between 55296 and 57343) then
      s := replace(s, '&#x' || code || ';', chr(n));
      s := replace(s, '&#X' || code || ';', chr(n));
    end if;
  end loop;
  for code in select distinct m[1] from regexp_matches(s, '&#([0-9]{1,7});', 'g') as m loop
    n := code::integer;
    if n between 1 and 1114111 and not (n between 55296 and 57343) then
      s := replace(s, '&#' || code || ';', chr(n));
    end if;
  end loop;
  s := replace(s, '&nbsp;', ' ');
  s := replace(s, '&quot;', '"');
  s := replace(s, '&apos;', '''');
  s := replace(s, '&lt;', '<');
  s := replace(s, '&gt;', '>');
  s := replace(s, '&ndash;', chr(8211));
  s := replace(s, '&mdash;', chr(8212));
  s := replace(s, '&lsquo;', chr(8216));
  s := replace(s, '&rsquo;', chr(8217));
  s := replace(s, '&ldquo;', chr(8220));
  s := replace(s, '&rdquo;', chr(8221));
  s := replace(s, '&hellip;', chr(8230));
  s := replace(s, '&amp;', '&');
  return s;
end;
$$;

-- Runs of whitespace folded to one space, ends trimmed. Not a rewrite: every
-- word stays, in order, exactly as spelled.
create function wall_fold(text_in text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select btrim(regexp_replace(text_in, '\s+', ' ', 'g'));
$$;

-- The visible text of a page: scripts and styles gone, tags gone, entities
-- decoded, whitespace folded. What a reader would see, roughly, and what a
-- quotation is matched against.
create function wall_page_text(html_in text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select wall_fold(wall_html_decode(regexp_replace(
    regexp_replace(
      regexp_replace(html_in, '<(script|style|noscript)\b.*?</\1\s*>', ' ', 'gi'),
      '<!--.*?-->', ' ', 'g'),
    '<[^>]*>', ' ', 'g')));
$$;

-- Whether a page contains a quotation, by exact string match. The page is
-- read two ways: as its visible text, and as its markup with entities decoded,
-- so a description carried in a meta tag counts. The quotation is compared
-- with its whitespace folded and is never otherwise changed. A paraphrase
-- fails. worker/src/wall/check.ts applies the same rule on every run.
create function wall_page_contains(html_in text, quotation_in text)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  q text := wall_fold(quotation_in);
begin
  if q is null or q = '' then return false; end if;
  if position(q in wall_page_text(html_in)) > 0 then return true; end if;
  if position(q in wall_fold(wall_html_decode(html_in))) > 0 then return true; end if;
  return false;
end;
$$;

-- One meta tag's content, by property or by name, whichever order the
-- attributes come in. Null when absent.
create function wall_meta(html_in text, key_in text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  k text := regexp_replace(key_in, '([.*+?^${}()|\[\]\\])', '\\\1', 'g');
  m text[];
begin
  m := regexp_match(html_in, '<meta\s[^>]*?(?:property|name)\s*=\s*["'']' || k || '["''][^>]*?content\s*=\s*"([^"]*)"', 'i');
  if m is null then
    m := regexp_match(html_in, '<meta\s[^>]*?(?:property|name)\s*=\s*["'']' || k || '["''][^>]*?content\s*=\s*''([^'']*)''', 'i');
  end if;
  if m is null then
    m := regexp_match(html_in, '<meta\s[^>]*?content\s*=\s*"([^"]*)"[^>]*?(?:property|name)\s*=\s*["'']' || k || '["'']', 'i');
  end if;
  if m is null then
    m := regexp_match(html_in, '<meta\s[^>]*?content\s*=\s*''([^'']*)''[^>]*?(?:property|name)\s*=\s*["'']' || k || '["'']', 'i');
  end if;
  if m is null then return null; end if;
  return nullif(wall_fold(wall_html_decode(m[1])), '');
end;
$$;

-- The headline, the outlet name and the description a page gives itself.
-- Open Graph first, the title element second. Nothing here is written by a
-- person using Birthed.
create function wall_page_meta(html_in text)
returns table (headline text, site_name text, description text)
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  h    text := left(html_in, 400000);
  t    text[];
begin
  headline := coalesce(wall_meta(h, 'og:title'), wall_meta(h, 'twitter:title'));
  if headline is null then
    t := regexp_match(h, '<title[^>]*>(.*?)</title\s*>', 'i');
    if t is not null then headline := nullif(wall_fold(wall_html_decode(t[1])), ''); end if;
  end if;
  site_name := wall_meta(h, 'og:site_name');
  description := coalesce(wall_meta(h, 'og:description'), wall_meta(h, 'description'),
                          wall_meta(h, 'twitter:description'));
  return next;
end;
$$;

-- The first three hundred characters of a headline, cut at a word, when the
-- source's own headline is longer than the column. Fewer of the source's
-- words, never different ones.
create function wall_fit_headline(text_in text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  s   text := wall_fold(text_in);
  cut text;
begin
  if s is null or length(s) <= 300 then return s; end if;
  cut := left(s, 300);
  if position(' ' in reverse(cut)) > 0 then
    cut := btrim(left(cut, 300 - position(' ' in reverse(cut))));
  end if;
  return cut;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fetching a page from inside the database
-- ---------------------------------------------------------------------------

-- Ten seconds, five redirects, a plain browser-like agent, and every failure
-- returned as a row rather than raised, so the caller can write the failure
-- down. Only the submit function calls this, and only for a page a signed in,
-- attested caller just pasted.
create function wall_fetch(url_in text)
returns table (status integer, body text, detail text)
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  response extensions.http_response;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '10000');
  begin
    response := extensions.http((
      'GET', url_in,
      array[
        extensions.http_header('User-Agent', 'Mozilla/5.0 (compatible; Birthed/0.1; +https://birthed.app)'),
        extensions.http_header('Accept', 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5')
      ],
      null, null
    )::extensions.http_request);
    status := response.status;
    body := response.content;
    detail := coalesce(response.content_type, '') || ', ' || coalesce(length(response.content), 0) || ' characters';
  exception when others then
    status := null;
    body := null;
    detail := left(sqlerrm, 300);
  end;
  perform extensions.http_reset_curlopt();
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- App Attest: keys, challenges, grants
-- ---------------------------------------------------------------------------

-- One attested key per account, registered by the wall-write Edge Function
-- after it has checked Apple's attestation. The public key is what every
-- later assertion is checked against, and the counter must only ever rise.
create table wall_attest_keys (
  profile_id    uuid primary key references profiles (id) on delete cascade,
  key_id        text not null unique,
  -- The P-256 public key, as base64 of its SubjectPublicKeyInfo.
  public_key    text not null,
  counter       bigint not null default 0 check (counter >= 0),
  -- appattest or appattestdevelop, as the attestation said.
  environment   text not null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

-- A challenge is issued to an account, embedded by the device in what it
-- signs, and used once. Without it an attestation or an assertion could be
-- replayed.
create table wall_attest_challenges (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles (id) on delete cascade,
  challenge   bytea not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create index wall_attest_challenges_by_profile on wall_attest_challenges (profile_id, created_at desc);

-- A grant is the Edge Function saying: this account, on this device, just
-- proved itself. The write functions below consume one each. Short lived,
-- single use, and written only with the service role.
create table wall_attest_grants (
  id           bigint generated always as identity primary key,
  profile_id   uuid not null references profiles (id) on delete cascade,
  granted_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  consumed_at  timestamptz
);

create index wall_attest_grants_open on wall_attest_grants (profile_id, expires_at) where consumed_at is null;

alter table wall_attest_keys       enable row level security;
alter table wall_attest_challenges enable row level security;
alter table wall_attest_grants     enable row level security;
-- No policies. Only the service role, and the functions below, touch these.
revoke all on wall_attest_keys, wall_attest_challenges, wall_attest_grants from anon, authenticated;

-- Consumes one open grant for the account or refuses. Called first thing by
-- both write functions.
create function wall_require_attestation(profile_in uuid)
returns void
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  grant_id bigint;
begin
  select id into grant_id
    from wall_attest_grants
   where profile_id = profile_in and consumed_at is null and expires_at > now()
   order by granted_at desc
   limit 1
   for update skip locked;
  if grant_id is null then
    raise exception 'wall: this device has not been checked. Writes go through the app.'
      using errcode = 'P0001';
  end if;
  update wall_attest_grants set consumed_at = now() where id = grant_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Idempotent boosting
-- ---------------------------------------------------------------------------

-- A tap carries a request identifier the app made once for that tap. The
-- same identifier arriving twice, from a double tap or a retried request,
-- returns the boost the first arrival made and spends nothing.
create table wall_boost_requests (
  request_id  uuid primary key,
  booster_id  uuid not null,
  boost_id    bigint not null references wall_boosts (id),
  created_at  timestamptz not null default now()
);

alter table wall_boost_requests enable row level security;
revoke all on wall_boost_requests from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The clock
-- ---------------------------------------------------------------------------

-- Server time, and the Eastern calendar date it falls on. A client that asks
-- this before it draws knows which three dates are open without trusting its
-- own clock. Server time decides; a client's clock is never sent.
create function wall_clock()
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'now', to_jsonb(now()),
    'eastern_today', to_jsonb(((now() at time zone 'America/New_York')::date)::text)
  );
$$;

grant execute on function wall_clock() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Units left
-- ---------------------------------------------------------------------------

-- How many units the caller may still spend on a date right now, by server
-- time: the allowance for today's Eastern date against that wall, less what
-- this account has already spent on it today. Zero on the day before, and
-- zero once the wall has closed.
create function wall_units_left(wall_date_in date)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid       uuid := auth.uid();
  today_e   date := (now() at time zone 'America/New_York')::date;
  day       wall_days%rowtype;
  spent     integer;
  allowance integer;
begin
  if uid is null then return 0; end if;
  allowance := wall_boost_budget(today_e, wall_date_in);
  if allowance = 0 then return 0; end if;
  select * into day from wall_days where wall_date = wall_date_in;
  if day.wall_date is not null and (now() >= day.closes_at or day.closed_at is not null) then
    return 0;
  end if;
  select coalesce(sum(units), 0) into spent
    from wall_boosts
   where booster_id = uid
     and wall_date = wall_date_in
     and (cast_at at time zone 'America/New_York')::date = today_e;
  return greatest(0, allowance - spent);
end;
$$;

revoke all on function wall_units_left(date) from public;
grant execute on function wall_units_left(date) to authenticated;

-- ---------------------------------------------------------------------------
-- Submitting a story
-- ---------------------------------------------------------------------------

-- Ten submissions per account per Eastern day, section 4's instinct applied
-- to submitting: scarcity is the engine.
create function wall_submit_story(url_in text, wall_date_in date default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  uid          uuid := auth.uid();
  today_e      date := (now() at time zone 'America/New_York')::date;
  target       date := coalesce(wall_date_in, (now() at time zone 'America/New_York')::date);
  key          text;
  host         text;
  existing     wall_stories%rowtype;
  day          wall_days%rowtype;
  submitted    integer;
  fetched      record;
  meta         record;
  headline     text;
  outlet       text;
  quotation    text;
  found        boolean;
  story        wall_stories%rowtype;
  source_id    uuid;
begin
  if uid is null then
    raise exception 'wall: not signed in';
  end if;
  perform wall_require_attestation(uid);

  -- The address, normalized before anything else so the duplicate check and
  -- the fetch see the same page.
  key := wall_url_key(url_in);
  host := wall_outlet_of(key);

  -- One account at a time, so ten means ten under a burst as well.
  perform pg_advisory_xact_lock(hashtext('wall_submit:' || uid::text));

  -- The date has to be open right now, by server time. Open means the day
  -- before, the day itself, or the day after, Eastern.
  if target < today_e - 1 or target > today_e + 1 then
    raise exception 'wall: the wall for % is not open today', target;
  end if;
  insert into wall_days (wall_date, opens_at, live_at, closes_at)
    values (target, now(), now(), now())
    on conflict (wall_date) do nothing;
  select * into day from wall_days where wall_date = target;
  if day.closed_at is not null or now() >= day.closes_at or now() < day.opens_at then
    raise exception 'wall: the wall for % has closed', target;
  end if;

  -- The same page already on this date is that story, not a new one.
  select * into existing from wall_stories where wall_date = target and url_key = key;
  if existing.id is not null then
    update profiles set wall_joined_at = coalesce(wall_joined_at, now()) where id = uid;
    return jsonb_build_object(
      'existing', true,
      'story', wall_story_json(existing)
    );
  end if;

  select count(*) into submitted
    from wall_stories
   where submitted_by = uid
     and (submitted_at at time zone 'America/New_York')::date = today_e;
  if submitted >= 10 then
    raise exception 'wall: ten submissions a day, and today''s ten are spent';
  end if;

  -- The page, read by the database and nobody else.
  select * into fetched from wall_fetch(key);
  if fetched.status is null then
    raise exception 'wall: that page could not be read: %', fetched.detail;
  end if;
  if fetched.status < 200 or fetched.status >= 300 then
    raise exception 'wall: that page answered %', fetched.status;
  end if;
  if fetched.body is null or length(fetched.body) < 64 then
    raise exception 'wall: that page has nothing on it to quote';
  end if;

  select * into meta from wall_page_meta(fetched.body);
  headline := wall_fit_headline(meta.headline);
  if headline is null or headline = '' then
    raise exception 'wall: that page does not say what it is about';
  end if;
  outlet := coalesce(nullif(wall_fold(meta.site_name), ''), host);
  outlet := left(outlet, 120);
  quotation := coalesce(nullif(wall_fold(meta.description), ''), headline);
  if length(quotation) < 20 then
    quotation := headline;
  end if;
  if length(quotation) < 20 then
    raise exception 'wall: that page describes itself in fewer than twenty characters';
  end if;
  quotation := left(quotation, 1000);

  -- A profiles row exists for every account the app has pushed one for. An
  -- account that has not yet still gets to submit; the row is the minimum.
  insert into profiles (id) values (uid) on conflict (id) do nothing;

  insert into wall_stories (wall_date, submitted_by, headline, url, url_key, outlet)
    values (target, uid, headline, key, key, outlet)
    returning * into story;

  insert into wall_sources (story_id, url, url_key, outlet, owner, headline, quotation, added_by)
    values (story.id, key, key, outlet, wall_owner_of(host), headline, quotation, uid)
    returning id into source_id;

  -- The first two checks, from the read that just happened. The page
  -- answered, and either it contains its own description or it does not;
  -- the checker reads it again on its next run either way.
  insert into wall_checks (source_id, kind, passed, http_status, detail)
    values (source_id, 'resolves', true, fetched.status, 'at submission: ' || fetched.detail);
  found := wall_page_contains(fetched.body, quotation);
  insert into wall_checks (source_id, kind, passed, http_status, detail)
    values (source_id, 'quotation', found, fetched.status,
            case when found then 'at submission: the page contains the quotation, exactly'
                 else 'at submission: the page does not contain the quotation' end);
  if found then
    update wall_sources set verified_at = now() where id = source_id;
  end if;

  update profiles set wall_joined_at = coalesce(wall_joined_at, now()) where id = uid;

  select * into story from wall_stories where id = story.id;
  return jsonb_build_object(
    'existing', false,
    'story', wall_story_json(story)
  );
end;
$$;

-- A story as the app reads it back. Nothing about who submitted it.
create function wall_story_json(story wall_stories)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', story.id,
    'wall_date', story.wall_date::text,
    'submitted_at', story.submitted_at,
    'headline', story.headline,
    'url', story.url,
    'outlet', story.outlet,
    'status', story.status,
    'tier', story.tier,
    'support', story.support,
    'placed_at', story.placed_at,
    'anchor_mx', story.anchor_mx,
    'anchor_my', story.anchor_my,
    'w_modules', story.w_modules,
    'h_modules', story.h_modules,
    'false_at', story.false_at,
    'false_note', story.false_note
  );
$$;

revoke all on function wall_submit_story(text, date) from public;
grant execute on function wall_submit_story(text, date) to authenticated;
revoke all on function wall_story_json(wall_stories) from public;

-- ---------------------------------------------------------------------------
-- Casting a boost
-- ---------------------------------------------------------------------------

create function wall_cast_boost(story_id_in uuid, units_in integer, request_id_in uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  uid       uuid := auth.uid();
  story     wall_stories%rowtype;
  day       wall_days%rowtype;
  seen      wall_boost_requests%rowtype;
  boost     wall_boosts%rowtype;
  left_now  integer;
begin
  if uid is null then
    raise exception 'wall: not signed in';
  end if;
  if request_id_in is null then
    raise exception 'wall: a boost needs a request identifier';
  end if;
  if units_in is null or units_in < 1 or units_in > 3 then
    raise exception 'wall: units are one, two or three';
  end if;

  -- One account at a time, so a double tap that somehow carried two
  -- identifiers still meets the budget one after the other.
  perform pg_advisory_xact_lock(hashtext('wall_boost:' || uid::text));

  -- The same tap again returns what it already did, before a grant is
  -- spent and before the budget is asked anything.
  select * into seen from wall_boost_requests where request_id = request_id_in;
  if seen.request_id is not null then
    if seen.booster_id <> uid then
      raise exception 'wall: that request identifier belongs to somebody else';
    end if;
    select * into boost from wall_boosts where id = seen.boost_id;
    select * into story from wall_stories where id = boost.story_id;
    return jsonb_build_object(
      'repeated', true,
      'boost_id', boost.id,
      'units', boost.units,
      'support', story.support,
      'units_left', wall_units_left(story.wall_date)
    );
  end if;

  perform wall_require_attestation(uid);

  select * into story from wall_stories where id = story_id_in;
  if story.id is null then
    raise exception 'wall: no such story';
  end if;
  if story.status = 'false' then
    raise exception 'wall: that story has been shown false and takes no boosts';
  end if;
  select * into day from wall_days where wall_date = story.wall_date;
  if now() < day.live_at then
    raise exception 'wall: the wall for % takes no boosts until the day arrives', story.wall_date;
  end if;
  if now() >= day.closes_at or day.closed_at is not null then
    raise exception 'wall: the wall for % has closed', story.wall_date;
  end if;

  left_now := wall_units_left(story.wall_date);
  if units_in > left_now then
    raise exception 'wall: % left on % today, not %', left_now, story.wall_date, units_in;
  end if;

  -- The trigger fills wall_date, tier_at_cast and support_before from the
  -- story and enforces the budget again. The values here are placeholders it
  -- replaces.
  insert into wall_boosts (story_id, booster_id, wall_date, units, tier_at_cast, support_before)
    values (story.id, uid, story.wall_date, units_in, 'claimed', 0)
    returning * into boost;

  insert into wall_boost_requests (request_id, booster_id, boost_id)
    values (request_id_in, uid, boost.id);

  insert into profiles (id) values (uid) on conflict (id) do nothing;
  update profiles set wall_joined_at = coalesce(wall_joined_at, now()) where id = uid;

  select * into story from wall_stories where id = story.id;
  return jsonb_build_object(
    'repeated', false,
    'boost_id', boost.id,
    'units', boost.units,
    'support', story.support,
    'units_left', wall_units_left(story.wall_date)
  );
end;
$$;

revoke all on function wall_cast_boost(uuid, integer, uuid) from public;
grant execute on function wall_cast_boost(uuid, integer, uuid) to authenticated;

-- The helpers are internal. Nothing but the functions above should call
-- them, and nothing else can.
revoke all on function wall_outlet_of(text) from public;
revoke all on function wall_owner_of(text) from public;
revoke all on function wall_form_encode(text) from public;
revoke all on function wall_form_decode(text) from public;
revoke all on function wall_url_key(text) from public;
revoke all on function wall_html_decode(text) from public;
revoke all on function wall_fold(text) from public;
revoke all on function wall_page_text(text) from public;
revoke all on function wall_page_contains(text, text) from public;
revoke all on function wall_meta(text, text) from public;
revoke all on function wall_page_meta(text) from public;
revoke all on function wall_fit_headline(text) from public;
revoke all on function wall_fetch(text) from public;
revoke all on function wall_require_attestation(uuid) from public;

-- ---------------------------------------------------------------------------
-- Who boosted what is recorded and is not published
-- ---------------------------------------------------------------------------

-- Section 10 noted that public read on wall_boosts exposed booster_id: an
-- opaque value that names nobody but lets a reader see that one account
-- backed two stories. Closed here with a column grant. Every other column is
-- still readable by anybody, the row is exactly what it was, and the service
-- role and the functions above still see all of it. A client asking for
-- every column of wall_boosts is refused; it asks for the columns it may
-- read.
revoke select on wall_boosts from anon, authenticated;
grant select (id, story_id, wall_date, units, cast_at, tier_at_cast, support_before)
  on wall_boosts to anon, authenticated;
