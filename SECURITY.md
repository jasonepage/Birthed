# Security

## Reporting a vulnerability

Write to support@birthed.app with what you found, how to reproduce it, and
what it lets someone do. You will get a reply from the one person who runs
this, and a fix or an explanation of why it is not one. There is no bounty.
Please do not open a public issue for a vulnerability until it is fixed.

## What is in scope

- The website at birthed.app, served by `web/src/serve.ts`.
- The iPhone app.
- The Supabase project the two talk to: its row level security policies,
  its database functions, and the Edge Functions under `supabase/functions/`.
- The worker under `worker/`, to the extent a page it reads could make it
  write something wrong.

Reports that are wanted: a way to read a row that row level security should
hide, a way to write to the hive without spending a buzz, a way to change or
delete a row in `wall_boosts`, a way to learn a reader's birth year or the
people on their list from anything the website or app sends, a content
security policy that lets a script run on a page that should not run one,
and any secret in this repository or its history.

## What is not a finding

**The anonymous Supabase key.** It is in the website's built pages and in the
app, on purpose. Supabase's anonymous key is designed to ship in clients and
identifies the project, not a person; every table in the public schema has row
level security enabled, and the policies in `supabase/migrations/` are what
decide what that key may read and write. A report that the key is exposed is
not a finding. A report that a policy lets the key do something it should not
is, and is welcome.

**The Supabase project reference and address.** `lunqqhjwqrpbujwxwdzk` and
`https://lunqqhjwqrpbujwxwdzk.supabase.co` appear in `render.yaml` and the
`.env.example` files. Neither is secret.

**`twin_count` being callable by the anonymous role.** Supabase's security
advisor flags every `security definer` function the anonymous role may
execute. `twin_count` is intentional: it returns a count and nothing else,
applies a privacy floor inside itself, and has its search path pinned.
`CLAUDE.md` section 5 records this. The same applies to the other functions
the website and app call without signing in; each returns a number or a
status and never a row.

**Tables with row level security enabled and no policy.** That is the
intended state for tables only the service role may touch.

**The service role key.** It is not in this repository and never has been.
It is held by the Render cron job and the worker's local `.env`. If you find
it anywhere in a client, that is a security incident, and the address above
is the right place to say so.

## What has been checked

Before the repository was made public, every object in every commit was
scanned for credentials from Google, Anthropic, OpenAI, GitHub, Amazon and
Slack, for JSON Web Tokens, for Supabase secret and access tokens, for
private key blocks and for database connection strings carrying a password.
There were no hits. No `.env` file, `Secrets.swift`, certificate or key file
was ever committed.
